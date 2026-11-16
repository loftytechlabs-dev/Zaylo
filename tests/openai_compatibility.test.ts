import { describe, it, expect } from 'vitest';
import { InferenceService } from '@local-ai/inference';
import { ChatCompletionRequestSchema } from '@local-ai/shared';
import type { ChatCompletionRequest, ChatCompletionResponse, EmbeddingRequest, EmbeddingResponse, RuntimeInstance } from '@local-ai/shared';
import type { InferenceRuntime, RuntimeConfig, RuntimeCapabilities, RuntimeHealth } from '@local-ai/runtimes';

class StructuredRuntime implements InferenceRuntime {
  readonly id = 'structured-test';
  readonly name = 'Structured runtime';
  request?: ChatCompletionRequest;
  async detectCapabilities(): Promise<RuntimeCapabilities> {
    return { supportedFormats: ['gguf'], supportedBackends: ['cpu'], supportsEmbeddings: false, supportsStreaming: true, version: 'test' };
  }
  async isInstalled() { return true; }
  async install() { return { success: true }; }
  async start(config: RuntimeConfig): Promise<RuntimeInstance> {
    return { id: config.instanceId, runtimeId: this.id, port: config.port, state: 'RUNNING', modelPath: config.modelPath, modelName: config.modelName, gpuLayersOffloaded: 0 };
  }
  async stop() {}
  async health(): Promise<RuntimeHealth> { return { isHealthy: true, state: 'RUNNING', modelLoaded: true }; }
  async embeddings(_request: EmbeddingRequest): Promise<EmbeddingResponse> { throw new Error('Not supported'); }
  async *chatStream(request: ChatCompletionRequest): AsyncIterable<ChatCompletionResponse> {
    this.request = request;
    const base = { id: 'native-id', object: 'chat.completion.chunk' as const, created: 1, model: request.model };
    yield { ...base, system_fingerprint: 'test-fingerprint', choices: [
      { index: 0, delta: { role: 'assistant', tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'weather', arguments: '{"city":' } }] }, finish_reason: null },
      { index: 1, delta: { content: 'Other ' }, logprobs: { content: [{ token: 'Other' }] }, finish_reason: null },
    ] };
    yield { ...base, timings: { prompt_n: 8, prompt_ms: 10, prompt_per_second: 800, predicted_n: 5, predicted_ms: 20, predicted_per_second: 250 }, choices: [
      { index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: '"Paris"}' } }] }, finish_reason: 'tool_calls' },
      { index: 1, delta: { content: 'answer' }, logprobs: { content: [{ token: 'answer' }] }, finish_reason: 'stop' },
    ] };
    yield { ...base, choices: [], usage: { prompt_tokens: 8, completion_tokens: 5, total_tokens: 13 } };
  }
}

describe('OpenAI chat contract', () => {
  it('keeps tool messages, request options, and vendor extensions at validation', () => {
    const parsed = ChatCompletionRequestSchema.parse({
      messages: [
        { role: 'assistant', content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'weather', arguments: '{}' } }] },
        { role: 'tool', content: 'Sunny', tool_call_id: 'call_1' },
      ],
      tools: [{ type: 'function', function: { name: 'weather', parameters: { type: 'object' } } }],
      n: 2, response_format: { type: 'json_object' }, cache_prompt: false, repeat_penalty: 1.1,
    });
    expect(parsed.messages[1].tool_call_id).toBe('call_1');
    expect(parsed.tools?.[0].function.name).toBe('weather');
    expect(parsed).toMatchObject({ n: 2, response_format: { type: 'json_object' }, cache_prompt: false, repeat_penalty: 1.1 });
    expect(ChatCompletionRequestSchema.safeParse({ messages: [{ role: 'tool', content: 'missing id' }] }).success).toBe(false);
  });

  it('assembles every choice and tool fragment while preserving actual usage and native timings', async () => {
    const runtime = new StructuredRuntime();
    const service = new InferenceService();
    service.setRuntime(runtime, 'test-model');
    const result = await service.chat({ model: 'default', messages: [{ role: 'user', content: 'Weather?' }], n: 2 });
    expect(result.choices).toEqual([
      { index: 0, message: { role: 'assistant', content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'weather', arguments: '{"city":"Paris"}' } }] }, finish_reason: 'tool_calls' },
      { index: 1, message: { role: 'assistant', content: 'Other answer' }, finish_reason: 'stop', logprobs: { content: [{ token: 'Other' }, { token: 'answer' }], refusal: [] } },
    ]);
    expect(result.usage).toEqual({ prompt_tokens: 8, completion_tokens: 5, total_tokens: 13 });
    expect(result.timings?.prompt_n).toBe(8);
    expect(result.system_fingerprint).toBe('test-fingerprint');
    expect(runtime.request?.stream_options?.include_usage).toBe(true);
  });
});
