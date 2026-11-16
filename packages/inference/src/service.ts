import crypto from 'node:crypto';
import fs from 'node:fs';
import type {
  ChatCompletionChoice,
  ChatCompletionRequest,
  ChatCompletionUsage,
  ChatToolCall,
  DocumentType,
  ModelInstallation,
  ChatCompletionResponse,
  ChatMessage,
  EmbeddingRequest,
  EmbeddingResponse,
} from '@local-ai/shared';
import { AppError, ModelNotLoadedError, ValidationError } from '@local-ai/shared';
import { ChatCompletionRequestSchema, EmbeddingRequestSchema } from '@local-ai/shared';
import type { InferenceRuntime } from '@local-ai/runtimes';
import { RequestQueue } from './queue.js';
import { MetricsRepository, LogsRepository } from '@local-ai/database';
import { RagEngine } from './rag.js';
import { MemoryEngine } from './memory/MemoryEngine.js';

export function extractMessageText(message: ChatMessage): string {
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => (part.type === 'text' ? part.text || '' : '[image]'))
      .join(' ');
  }
  return '';
}

export function getModelEmbeddingIdentity(
  installation: Pick<ModelInstallation, 'id' | 'modelId' | 'variantId' | 'localPath' | 'sha256'>
): string | undefined {
  try {
    const weightPath = fs.realpathSync(installation.localPath);
    const stat = fs.statSync(weightPath, { bigint: true });
    if (!stat.isFile()) return undefined;
    const fingerprint = JSON.stringify([
      installation.id, installation.modelId, installation.variantId, installation.sha256 || null,
      weightPath, stat.size.toString(), stat.mtimeNs.toString(), stat.ctimeNs.toString(), stat.dev.toString(), stat.ino.toString(),
    ]);
    return `llama.cpp:pooling-mean:v1:${crypto.createHash('sha256').update(fingerprint).digest('hex')}`;
  } catch {
    // Without an identifiable weight file, keep document retrieval lexical.
    return undefined;
  }
}

export interface InferenceMetrics {
  totalRequests: number;
  activeRequests: number;
  averageTokensPerSec: number;
  averageLatencyMs: number;
}

export class InferenceService {
  private queue: RequestQueue;
  private currentRuntime?: InferenceRuntime;
  private currentModelName: string = '';
  private currentEmbeddingIdentity?: string;
  private activeAbortControllers = new Map<string, AbortController>();
  private ragEngine?: RagEngine;
  private memoryEngine?: MemoryEngine;
  private onMemoryMutated?: () => void;
  
  // Rolling metrics
  private totalRequests = 0;
  private recentTokensPerSec: number[] = [];
  private recentLatencies: number[] = [];

  constructor(
    private metricsRepo?: MetricsRepository,
    _logsRepo?: LogsRepository,
    maxConcurrent: number = 4,
    ragEngine?: RagEngine,
    memoryEngine?: MemoryEngine
  ) {
    this.queue = new RequestQueue(maxConcurrent);
    this.ragEngine = ragEngine;
    this.memoryEngine = memoryEngine;
  }

  public setRagEngine(ragEngine?: RagEngine): void {
    this.ragEngine = ragEngine;
  }

  public getRagEngine(): RagEngine | undefined {
    return this.ragEngine;
  }

  private async documentEmbedder(): Promise<{
    model: string;
    embed: (text: string) => Promise<number[] | undefined>;
  } | undefined> {
    const runtime = this.currentRuntime;
    const model = this.currentModelName;
    const identity = this.currentEmbeddingIdentity;
    if (!runtime || !model || !identity) return undefined;
    try {
      if (!(await runtime.detectCapabilities()).supportsEmbeddings) return undefined;
    } catch {
      return undefined;
    }
    return {
      model: identity,
      embed: async (text) => {
        const response = await runtime.embeddings({ model, input: text, encoding_format: 'float' });
        const vector = response.data[0]?.embedding;
        return Array.isArray(vector) && vector.length > 0 && vector.every(Number.isFinite) ? vector : undefined;
      },
    };
  }

  public async ingestDocument(name: string, content: string, type: DocumentType = 'txt') {
    if (!this.ragEngine) throw new ValidationError('Document search is not configured');
    const embedder = await this.documentEmbedder();
    return this.ragEngine.ingestDocument(name, content, type, embedder?.embed, embedder?.model);
  }

  public async searchDocuments(query: string, limit = 4, documentIds?: string[]) {
    if (!this.ragEngine) throw new ValidationError('Document search is not configured');
    const embedder = await this.documentEmbedder();
    let queryVector: number[] | undefined;
    if (embedder) {
      try {
        queryVector = await embedder.embed(query);
        if (queryVector) await this.ragEngine.indexMissingEmbeddings(embedder.model, embedder.embed, documentIds);
      } catch {
        // Unsupported models leave keyword retrieval available and labeled lexical.
      }
    }
    return this.ragEngine.search(query, limit, documentIds, queryVector, embedder?.model);
  }

  public setMemoryEngine(memoryEngine?: MemoryEngine, onMemoryMutated?: () => void): void {
    this.memoryEngine = memoryEngine;
    this.onMemoryMutated = onMemoryMutated;
  }

  public getMemoryEngine(): MemoryEngine | undefined {
    return this.memoryEngine;
  }

  public setRuntime(runtime?: InferenceRuntime, modelName?: string, embeddingIdentity?: string): void {
    this.currentRuntime = runtime;
    this.currentModelName = modelName || '';
    this.currentEmbeddingIdentity = runtime ? embeddingIdentity : undefined;
  }

  public getEmbeddingIdentity(): string | undefined {
    return this.currentEmbeddingIdentity;
  }

  public getRuntime(): InferenceRuntime | undefined {
    return this.currentRuntime;
  }

  public getModelName(): string {
    return this.currentModelName;
  }

  public setMaxConcurrency(max: number): void {
    this.queue.setMaxConcurrent(max);
  }

  public abortRequest(requestId: string): boolean {
    const controller = this.activeAbortControllers.get(requestId);
    if (controller) {
      controller.abort();
      this.activeAbortControllers.delete(requestId);
      return true;
    }
    return false;
  }

  public async *chatStream(
    request: ChatCompletionRequest,
    clientIp: string = '127.0.0.1',
    externalSignal?: AbortSignal
  ): AsyncIterable<ChatCompletionResponse> {
    const parsed = ChatCompletionRequestSchema.safeParse(request);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
    }

    if (!this.currentRuntime) {
      throw new ModelNotLoadedError('No inference model is currently loaded');
    }

    const release = await this.queue.acquire();
    const requestId = `chatcmpl-${crypto.randomBytes(12).toString('hex')}`;
    const abortController = new AbortController();
    this.activeAbortControllers.set(requestId, abortController);

    const startTime = Date.now();
    let firstTokenTime: number | null = null;
    let completionTokens = 0;
    let accumulatedContent = '';
    let upstreamUsage: ChatCompletionUsage | undefined;

    // If external signal aborts, abort our internal controller
    const abort = () => abortController.abort();
    if (externalSignal?.aborted) abort();
    else externalSignal?.addEventListener('abort', abort, { once: true });

    try {
      this.totalRequests++;

      // Automatically augment messages with local document context if RAG is requested
      let effectiveRequest: ChatCompletionRequest = { ...parsed.data, messages: [...parsed.data.messages] };

      // Layer persona instructions if passed in request and not already present
      if (request.personaInstructions && request.personaInstructions.trim()) {
        const hasInstructions = effectiveRequest.messages.some((m) =>
          typeof m.content === 'string' && m.content.includes(request.personaInstructions!.trim())
        );
        if (!hasInstructions) {
          const sysIdx = effectiveRequest.messages.findIndex((m) => m.role === 'system');
          if (sysIdx >= 0) {
            const existing = typeof effectiveRequest.messages[sysIdx].content === 'string'
              ? (effectiveRequest.messages[sysIdx].content as string)
              : '';
            const updated = existing
              ? `${existing}\n\n---\n\n${request.personaInstructions.trim()}`
              : request.personaInstructions.trim();
            effectiveRequest.messages = effectiveRequest.messages.map((m, idx) =>
              idx === sysIdx ? { ...m, content: updated } : m
            );
          } else {
            effectiveRequest.messages = [
              { role: 'system', content: request.personaInstructions.trim() },
              ...effectiveRequest.messages,
            ];
          }
        }
      }

      const userMessages = request.messages.filter((m) => m.role === 'user');
      const lastUserMsg = userMessages[userMessages.length - 1];
      const lastUserText = lastUserMsg ? extractMessageText(lastUserMsg) : '';

      // Automatically recall long-term memories from LoftyDB when enabled
      const shouldUseMemory =
        Boolean(this.memoryEngine) &&
        (request.memory === true ||
          (request.memory !== false && Boolean(this.memoryEngine?.isAutoRecallEnabled())));

      if (shouldUseMemory && this.memoryEngine && lastUserText) {
        try {
          const recalled = await this.memoryEngine.recall({
            query: lastUserText,
            scope: request.memoryScope || 'all',
            personaId: request.personaId,
            conversationId: request.conversationId,
          });
          if (recalled.length > 0) {
            effectiveRequest.messages = this.memoryEngine.augmentMessages(effectiveRequest.messages, recalled);
          }
        } catch {
          // Graceful fallback if LoftyDB is offline or unreachable
        }

        if (this.memoryEngine.isAutoExtractEnabled() && request.memory !== false) {
          this.memoryEngine
            .extractAndPersistFromUserMessage(lastUserText, {
              personaId: request.personaId,
              conversationId: request.conversationId,
            })
            .then((saved) => {
              if (saved.length > 0) {
                this.onMemoryMutated?.();
              }
            })
            .catch(() => {});
        }
      }

      if (request.rag && this.ragEngine && lastUserText) {
        const searchResults = await this.searchDocuments(lastUserText, 4, request.ragDocumentIds);
        if (searchResults.length > 0) {
          effectiveRequest.messages = this.ragEngine.augmentMessages(effectiveRequest.messages, searchResults);
        }
      }

      const stream = this.currentRuntime.chatStream(effectiveRequest, abortController.signal);

      for await (const chunk of stream) {
        if (!firstTokenTime) {
          firstTokenTime = Date.now();
        }

        if (chunk.usage) upstreamUsage = chunk.usage;
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          completionTokens++;
          accumulatedContent += delta;
        }

        // Ensure chunk contains ID
        chunk.id = requestId;
        chunk.model = this.currentModelName || request.model;
        yield chunk;
      }

      const endTime = Date.now();
      const latencyMs = endTime - startTime;
      const durationSec = (endTime - (firstTokenTime || startTime)) / 1000;
      completionTokens = upstreamUsage?.completion_tokens ?? Math.ceil(accumulatedContent.length / 4);
      const tokensPerSec = upstreamUsage && durationSec > 0 ? completionTokens / durationSec : 0;

      // Update rolling metrics
      this.recordMetricsSample(tokensPerSec, latencyMs);

      // Estimate prompt tokens roughly (4 chars per token)
      const promptText = effectiveRequest.messages.map(extractMessageText).join(' ');
      const promptTokens = upstreamUsage?.prompt_tokens ?? Math.max(1, Math.ceil(promptText.length / 4));

      this.metricsRepo?.logRequest({
        id: requestId,
        modelId: this.currentModelName || request.model,
        clientIp,
        promptTokens,
        completionTokens,
        latencyMs,
        tokensPerSec,
        statusCode: 200,
        isStreaming: true,
      });
    } catch (err: any) {
      const endTime = Date.now();
      const latencyMs = endTime - startTime;
      this.metricsRepo?.logRequest({
        id: requestId,
        modelId: this.currentModelName || request.model,
        clientIp,
        promptTokens: 0,
        completionTokens,
        latencyMs,
        tokensPerSec: 0,
        statusCode: err?.statusCode || 500,
        isStreaming: true,
        errorMessage: err?.message,
      });
      throw err;
    } finally {
      externalSignal?.removeEventListener('abort', abort);
      this.activeAbortControllers.delete(requestId);
      release();
    }
  }

  public async chat(
    request: ChatCompletionRequest,
    clientIp: string = '127.0.0.1',
    signal?: AbortSignal
  ): Promise<ChatCompletionResponse> {
    const choices = new Map<number, { choice: ChatCompletionChoice & { message: ChatMessage }; tools: Map<number, ChatToolCall> }>();
    let latest: ChatCompletionResponse | undefined;
    let responseMetadata: Partial<ChatCompletionResponse> = {};
    let usage: ChatCompletionUsage | undefined;
    for await (const chunk of this.chatStream({
      ...request, stream_options: { ...request.stream_options, include_usage: true },
    }, clientIp, signal)) {
      latest = chunk;
      const { choices: _choices, ...metadata } = chunk;
      responseMetadata = { ...responseMetadata, ...metadata };
      if (chunk.usage) usage = chunk.usage;
      for (const part of chunk.choices) {
        let state = choices.get(part.index);
        if (!state) {
          state = { choice: { index: part.index, message: { role: 'assistant', content: null }, finish_reason: null }, tools: new Map() };
          choices.set(part.index, state);
        }
        if (part.message) state.choice.message = { ...part.message };
        const message = state.choice.message;
        if (part.delta) {
          if (part.delta.role) message.role = part.delta.role;
          if (typeof part.delta.content === 'string') message.content = `${typeof message.content === 'string' ? message.content : ''}${part.delta.content}`;
          if (typeof part.delta.refusal === 'string') message.refusal = `${message.refusal || ''}${part.delta.refusal}`;
          if (part.delta.function_call) {
            const previous = message.function_call || { name: '', arguments: '' };
            message.function_call = {
              name: previous.name + (part.delta.function_call.name || ''),
              arguments: previous.arguments + (part.delta.function_call.arguments || ''),
            };
          }
          for (const delta of part.delta.tool_calls || []) {
            const tool = state.tools.get(delta.index) || { id: '', type: 'function', function: { name: '', arguments: '' } };
            if (delta.id) tool.id = delta.id;
            if (delta.type) tool.type = delta.type;
            tool.function.name += delta.function?.name || '';
            tool.function.arguments += delta.function?.arguments || '';
            state.tools.set(delta.index, tool);
            message.tool_calls = [...state.tools.entries()].sort(([a], [b]) => a - b).map(([, call]) => call);
          }
        }
        if (part.finish_reason) state.choice.finish_reason = part.finish_reason;
        if (part.logprobs) {
          const previous = state.choice.logprobs;
          state.choice.logprobs = {
            content: [...(previous?.content || []), ...(part.logprobs.content || [])],
            refusal: [...(previous?.refusal || []), ...(part.logprobs.refusal || [])],
          };
        } else if (part.logprobs === null && state.choice.logprobs === undefined) {
          state.choice.logprobs = null;
        }
      }
    }
    if (!latest || choices.size === 0) throw new AppError('The model returned an empty completion stream', 'UPSTREAM_ERROR', 502);
    if (!usage) {
      const promptTokens = Math.ceil(request.messages.map(extractMessageText).join(' ').length / 4);
      const completionTokens = Math.ceil([...choices.values()].map(({ choice }) => JSON.stringify(choice.message)).join('').length / 4);
      usage = { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens, estimated: true };
    }
    return {
      ...latest,
      ...responseMetadata,
      object: 'chat.completion',
      choices: [...choices.values()].sort((a, b) => a.choice.index - b.choice.index).map(({ choice }) => choice),
      usage,
    };
  }

  public async embeddings(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const parsed = EmbeddingRequestSchema.safeParse(request);
    if (!parsed.success) throw new ValidationError(parsed.error.errors.map((error) => error.message).join(', '));
    if (!this.currentRuntime) throw new ModelNotLoadedError('No inference model is currently loaded');
    return this.currentRuntime.embeddings(parsed.data);
  }

  public getMetrics(): InferenceMetrics {
    const avgTok = this.recentTokensPerSec.length > 0
      ? this.recentTokensPerSec.reduce((a, b) => a + b, 0) / this.recentTokensPerSec.length
      : 0;

    const avgLat = this.recentLatencies.length > 0
      ? this.recentLatencies.reduce((a, b) => a + b, 0) / this.recentLatencies.length
      : 0;

    return {
      totalRequests: this.totalRequests,
      activeRequests: this.queue.getActiveCount(),
      averageTokensPerSec: parseFloat(avgTok.toFixed(1)),
      averageLatencyMs: Math.round(avgLat),
    };
  }

  private recordMetricsSample(tokPerSec: number, latencyMs: number): void {
    if (tokPerSec > 0) {
      this.recentTokensPerSec.push(tokPerSec);
      if (this.recentTokensPerSec.length > 20) this.recentTokensPerSec.shift();
    }
    if (latencyMs > 0) {
      this.recentLatencies.push(latencyMs);
      if (this.recentLatencies.length > 20) this.recentLatencies.shift();
    }
  }
}
