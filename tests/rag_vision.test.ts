import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  createDatabaseAsync,
  ServerRepository,
  ModelRepository,
  APIKeyRepository,
  DeviceRepository,
  MetricsRepository,
  LogsRepository,
  DocumentRepository,
} from '@local-ai/database';
import { ModelManager } from '@local-ai/models';
import { KeyManager } from '@local-ai/security';
import { DevicePairingManager } from '@local-ai/network';
import { InferenceService, RagEngine, extractMessageText, getModelEmbeddingIdentity } from '@local-ai/inference';
import { ApiServer } from '@local-ai/server';
import { ChatCompletionRequestSchema } from '@local-ai/shared';
import type {
  InferenceRuntime,
  RuntimeCapabilities,
  RuntimeHealth,
  RuntimeConfig,
} from '@local-ai/runtimes';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  RuntimeInstance,
} from '@local-ai/shared';
import { createChatCompletionChunk } from '@local-ai/protocol';

class MockVisionRagRuntime implements InferenceRuntime {
  public readonly id = 'mock-vision';
  public readonly name = 'Mock Vision RAG Runtime';
  public lastReceivedRequest?: ChatCompletionRequest;

  async detectCapabilities(): Promise<RuntimeCapabilities> {
    return {
      supportedFormats: ['gguf'],
      supportedBackends: ['cpu'],
      supportsEmbeddings: true,
      supportsStreaming: true,
      version: '1.0.0',
    };
  }

  async isInstalled(): Promise<boolean> {
    return true;
  }

  async install(): Promise<{ success: boolean }> {
    return { success: true };
  }

  async start(config: RuntimeConfig): Promise<RuntimeInstance> {
    return {
      id: config.instanceId,
      runtimeId: this.id,
      port: config.port,
      state: 'RUNNING',
      modelPath: config.modelPath,
      modelName: config.modelName,
      gpuLayersOffloaded: config.gpuLayers,
      loadedAt: Date.now(),
    };
  }

  async stop(): Promise<void> {}

  async health(): Promise<RuntimeHealth> {
    return {
      isHealthy: true,
      state: 'RUNNING',
      modelLoaded: true,
      uptimeSeconds: 100,
    };
  }

  async *chatStream(request: ChatCompletionRequest): AsyncIterable<ChatCompletionResponse> {
    this.lastReceivedRequest = request;
    const words = ['Mock', 'inference', 'response'];
    for (const w of words) {
      yield createChatCompletionChunk({
        id: 'chunk-1',
        model: request.model,
        delta: { content: `${w} ` },
      });
    }
    yield createChatCompletionChunk({
      id: 'chunk-1',
      model: request.model,
      delta: {},
      finishReason: 'stop',
    });
  }

  async embeddings(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    return {
      object: 'list',
      data: [{ object: 'embedding', index: 0, embedding: [0.1, 0.2, 0.3] }],
      model: request.model,
      usage: { prompt_tokens: 5, total_tokens: 5 },
    };
  }
}

describe('P2 Features: Local Document RAG & Multimodal Vision', () => {
  let tempDir: string;
  let dbPath: string;
  let dbConn: any;
  let docRepo: DocumentRepository;
  let ragEngine: RagEngine;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zaylo-test-rag-'));
    dbPath = path.join(tempDir, 'test.db');
    dbConn = await createDatabaseAsync(dbPath);
    docRepo = new DocumentRepository(dbConn.raw);
    ragEngine = new RagEngine(docRepo, { chunkSize: 200, chunkOverlap: 40 });
  });

  afterEach(() => {
    try {
      dbConn?.close();
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  describe('Local Document RAG', () => {
    it('should chunk text cleanly while respecting boundaries', () => {
      const sampleText = `Zaylo is an enterprise-grade private AI server and desktop application developed by Lofty Tech Labs. It bridges bare-metal hardware acceleration with a modern developer workflow, enabling you to run large language models entirely on your local machine with zero subscription fees, zero cloud telemetry, and complete data confidentiality.

Second paragraph describes the RAG capabilities. It indexes documents offline in SQLite with full text search and vector similarity, allowing users to chat directly with their local PDFs, codebases, and technical notes without sending any private data outside the local network.`;
      const chunks = ragEngine.chunkText(sampleText);
      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(chunks[0]).toContain('Zaylo is an enterprise-grade');
    });

    it('should ingest and persist documents with chunks in SQLite', async () => {
      const doc = await ragEngine.ingestDocument(
        'architecture.md',
        'Zaylo uses llama.cpp for raw inference speed on Apple Silicon Metal and NVIDIA CUDA. Fastify serves OpenAI endpoints.',
        'md'
      );

      expect(doc.id).toBeDefined();
      expect(doc.name).toBe('architecture.md');
      expect(doc.chunkCount).toBeGreaterThan(0);

      const allDocs = docRepo.getAllDocuments();
      expect(allDocs).toHaveLength(1);
      expect(allDocs[0].name).toBe('architecture.md');

      const chunks = docRepo.getChunks(doc.id);
      expect(chunks.length).toBe(doc.chunkCount);
      expect(chunks[0].content).toContain('Zaylo uses llama.cpp');
    });

    it('should perform lexical search when no embedding model is loaded', async () => {
      await ragEngine.ingestDocument(
        'networking.txt',
        'Local Wi-Fi network QR code pairing allows mobile devices to connect to Zaylo without any app installation.',
        'txt'
      );

      await ragEngine.ingestDocument(
        'database.txt',
        'SQLite WAL mode ensures persistent key storage, hardware metrics, and device pairing.',
        'txt'
      );

      const results = await ragEngine.search('mobile QR pairing');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].documentName).toBe('networking.txt');
      expect(results[0].content).toContain('QR code pairing');
      expect(results[0].score).toBeGreaterThan(0);
    });

    it('indexes and retrieves semantic-only matches through the actual service path', async () => {
      class SemanticRuntime extends MockVisionRagRuntime {
        async embeddings(request: EmbeddingRequest): Promise<EmbeddingResponse> {
          const text = typeof request.input === 'string' ? request.input : request.input[0];
          const vehicle = /cars|automobiles/i.test(text);
          return { object: 'list', model: request.model, data: [{ object: 'embedding', index: 0, embedding: vehicle ? [1, 0] : [0, 1] }], usage: { prompt_tokens: 1, total_tokens: 1 } };
        }
      }
      const service = new InferenceService(undefined, undefined, 1, ragEngine);
      service.setRuntime(new SemanticRuntime(), 'semantic-v1', 'semantic-v1:weights:mean');
      const document = await service.ingestDocument('vehicles.txt', 'Automobiles travel on highways.');
      await service.ingestDocument('fruit.txt', 'Bananas grow on plants.');
      expect(document.retrievalMode).toBe('hybrid');
      expect(docRepo.getChunks(document.id)[0].embeddingModel).toBe('semantic-v1:weights:mean');
      const results = await service.searchDocuments('cars');
      expect(results[0]).toMatchObject({ documentName: 'vehicles.txt', searchMode: 'hybrid' });
    });

    it('does not compare vectors from different models, and upgrades lexical documents when embeddings become available', async () => {
      const document = await ragEngine.ingestDocument('facts.txt', 'Bananas grow on plants.');
      const service = new InferenceService(undefined, undefined, 1, ragEngine);
      service.setRuntime(new MockVisionRagRuntime(), 'new-embedding-model', 'new-weights:mean');
      const upgraded = await service.searchDocuments('semantic query');
      expect(upgraded[0]?.searchMode).toBe('hybrid');
      expect(docRepo.getChunks(document.id)[0].embeddingModel).toBe('new-weights:mean');
      expect(await ragEngine.search('unrelated', 4, undefined, [0.1, 0.2, 0.3], 'other-model')).toEqual([]);
    });

    it('keeps searchable documents and labels results lexical when embeddings fail', async () => {
      class UnsupportedRuntime extends MockVisionRagRuntime {
        async embeddings(_request: EmbeddingRequest): Promise<EmbeddingResponse> { throw new Error('Pooling unsupported'); }
      }
      const service = new InferenceService(undefined, undefined, 1, ragEngine);
      service.setRuntime(new UnsupportedRuntime(), 'decoder', 'unsupported:weights:mean');
      const document = await service.ingestDocument('facts.txt', 'Bananas grow on plants.');
      expect(document.retrievalMode).toBe('lexical');
      expect((await service.searchDocuments('Bananas'))[0]?.searchMode).toBe('lexical');
    });

    it('reuses the same weight identity but reindexes same-name variants and replaced files', async () => {
      class CountingRuntime extends MockVisionRagRuntime {
        calls = 0;
        constructor(private readonly vector: number[]) { super(); }
        async embeddings(request: EmbeddingRequest): Promise<EmbeddingResponse> {
          this.calls++;
          return { object: 'list', model: request.model, data: [{ object: 'embedding', index: 0, embedding: this.vector }], usage: { prompt_tokens: 1, total_tokens: 1 } };
        }
      }
      const q4Path = path.join(tempDir, 'q4.gguf');
      const q8Path = path.join(tempDir, 'q8.gguf');
      fs.writeFileSync(q4Path, 'first test weights');
      fs.writeFileSync(q8Path, 'other test weights');
      const q4 = { id: 'install-q4', modelId: 'same-model', variantId: 'q4', localPath: q4Path };
      const q8 = { id: 'install-q8', modelId: 'same-model', variantId: 'q8', localPath: q8Path };
      const q4Identity = getModelEmbeddingIdentity(q4);
      const q8Identity = getModelEmbeddingIdentity(q8);
      expect(q4Identity).toContain('pooling-mean');
      expect(q8Identity).not.toBe(q4Identity);
      const service = new InferenceService(undefined, undefined, 1, ragEngine);
      const runtimeQ4 = new CountingRuntime([1, 0]);
      service.setRuntime(runtimeQ4, 'Same display name', q4Identity);
      const document = await service.ingestDocument('facts.txt', 'Bananas grow on plants.');
      expect(docRepo.getChunks(document.id)[0].embeddingModel).toBe(q4Identity);

      runtimeQ4.calls = 0;
      expect(getModelEmbeddingIdentity(q4)).toBe(q4Identity);
      service.setRuntime(runtimeQ4, 'Same display name', getModelEmbeddingIdentity(q4));
      await service.searchDocuments('semantic query');
      expect(runtimeQ4.calls).toBe(1);

      const runtimeQ8 = new CountingRuntime([0, 1]);
      service.setRuntime(runtimeQ8, 'Same display name', q8Identity);
      await service.searchDocuments('semantic query');
      expect(runtimeQ8.calls).toBe(2);
      expect(docRepo.getChunks(document.id)[0]).toMatchObject({ embeddingModel: q8Identity, embedding: [0, 1] });

      const replacement = path.join(tempDir, 'replacement.gguf');
      fs.writeFileSync(replacement, 'other test weights');
      fs.renameSync(replacement, q8Path);
      const replacedIdentity = getModelEmbeddingIdentity(q8);
      expect(replacedIdentity).toBeDefined();
      expect(replacedIdentity).not.toBe(q8Identity);
      service.setRuntime(runtimeQ8, 'Same display name', replacedIdentity);
      await service.searchDocuments('semantic query');
      expect(runtimeQ8.calls).toBe(4);
      expect(docRepo.getChunks(document.id)[0].embeddingModel).toBe(replacedIdentity);
    });

    it('uses lexical retrieval when the caller cannot identify its loaded weights', async () => {
      const service = new InferenceService(undefined, undefined, 1, ragEngine);
      service.setRuntime(new MockVisionRagRuntime(), 'Ambiguous display name');
      const document = await service.ingestDocument('facts.txt', 'Bananas grow on plants.');
      expect(document.retrievalMode).toBe('lexical');
      expect(docRepo.getChunks(document.id)[0].embedding).toBeUndefined();
      expect((await service.searchDocuments('Bananas'))[0]?.searchMode).toBe('lexical');
      expect(getModelEmbeddingIdentity({ id: 'missing', modelId: 'same', variantId: 'q4', localPath: path.join(tempDir, 'missing.gguf') })).toBeUndefined();
    });

    it('should augment user prompt messages with retrieved document context', async () => {
      await ragEngine.ingestDocument(
        'spec.md',
        'Zaylo server runs on port 8080 by default with LAN binding enabled.',
        'md'
      );

      const searchResults = await ragEngine.search('port 8080 default');
      const messages = [{ role: 'user' as const, content: 'What is the default port?' }];
      const augmented = ragEngine.augmentMessages(messages, searchResults);

      expect(augmented.length).toBeGreaterThanOrEqual(2);
      const systemMsg = augmented.find((m) => m.role === 'system');
      expect(systemMsg).toBeDefined();
      expect(systemMsg?.content).toContain('spec.md');
      expect(systemMsg?.content).toContain('port 8080');
    });

    it('should automatically trigger RAG augmentation inside InferenceService when rag=true', async () => {
      await ragEngine.ingestDocument(
        'hardware.md',
        'Apple Silicon M4 Pro has 273 GB/s memory bandwidth for unified memory inference.',
        'md'
      );

      const mockRuntime = new MockVisionRagRuntime();
      const inferenceService = new InferenceService(undefined, undefined, 4, ragEngine);
      inferenceService.setRuntime(mockRuntime, 'test-model');

      const req: ChatCompletionRequest = {
        model: 'test-model',
        messages: [{ role: 'user', content: 'What is the memory bandwidth of M4 Pro?' }],
        rag: true,
      };

      const chunks = [];
      for await (const chunk of inferenceService.chatStream(req)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(mockRuntime.lastReceivedRequest).toBeDefined();
      const sysMsg = mockRuntime.lastReceivedRequest?.messages.find((m) => m.role === 'system');
      expect(sysMsg?.content).toContain('hardware.md');
      expect(sysMsg?.content).toContain('273 GB/s');
    });
  });

  describe('Multimodal Vision Support', () => {
    it('should validate multimodal OpenAI-format message schemas with text and image_url', () => {
      const visionRequest = {
        model: 'qwen2.5-vl-3b-instruct',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe what is shown in this screenshot:' },
              {
                type: 'image_url',
                image_url: {
                  url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                },
              },
            ],
          },
        ],
      };

      const parsed = ChatCompletionRequestSchema.safeParse(visionRequest);
      expect(parsed.success).toBe(true);
    });

    it('should accurately extract prompt text from multimodal message parts', () => {
      const msg = {
        role: 'user' as const,
        content: [
          { type: 'text' as const, text: 'Analyze this dashboard' },
          {
            type: 'image_url' as const,
            image_url: { url: 'data:image/jpeg;base64,...' },
          },
        ],
      };

      const extracted = extractMessageText(msg);
      expect(extracted).toContain('Analyze this dashboard');
      expect(extracted).toContain('[image]');
    });

    it('should execute chat stream and chat completion on vision requests without error', async () => {
      const mockRuntime = new MockVisionRagRuntime();
      const inferenceService = new InferenceService(undefined, undefined, 4);
      inferenceService.setRuntime(mockRuntime, 'qwen2.5-vl-3b-instruct');

      const visionReq: ChatCompletionRequest = {
        model: 'qwen2.5-vl-3b-instruct',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What is this diagram?' },
              {
                type: 'image_url',
                image_url: { url: 'data:image/png;base64,iVBORw0KGgo=' },
              },
            ],
          },
        ],
      };

      const resp = await inferenceService.chat(visionReq);
      expect(resp.choices[0].message?.content).toContain('Mock inference response');
      expect(resp.usage?.prompt_tokens).toBeGreaterThan(0);
    });
  });

  describe('API Server Document & RAG Endpoints', () => {
    it('should provide /v1/documents and /v1/rag/search endpoints', async () => {
      const serverRepo = new ServerRepository(dbConn.raw);
      const modelRepo = new ModelRepository(dbConn.raw);
      const keyRepo = new APIKeyRepository(dbConn.raw);
      const deviceRepo = new DeviceRepository(dbConn.raw);
      const logsRepo = new LogsRepository(dbConn.raw);
      const metricsRepo = new MetricsRepository(dbConn.raw);

      const config = serverRepo.getConfig();
      const modelManager = new ModelManager(modelRepo, tempDir);
      const keyManager = new KeyManager(keyRepo);
      const pairingManager = new DevicePairingManager(keyManager, deviceRepo);
      const mockRuntime = new MockVisionRagRuntime();
      const inferenceService = new InferenceService(metricsRepo, logsRepo, 4, ragEngine);
      inferenceService.setRuntime(mockRuntime, 'test-model');

      const server = new ApiServer({
        config,
        inferenceService,
        modelManager,
        keyManager,
        deviceRepo,
        pairingManager,
        logsRepo,
        documentRepo: docRepo,
      });

      // 1. Ingest via RAG Engine
      await ragEngine.ingestDocument('api-guide.txt', 'Zaylo provides fast endpoints for chat and embeddings.', 'txt');

      // 2. Query /v1/documents
      const docsRes = await (server as any).fastify.inject({
        method: 'GET',
        url: '/v1/documents',
      });
      expect(docsRes.statusCode).toBe(200);
      const docs = JSON.parse(docsRes.body);
      expect(docs).toHaveLength(1);
      expect(docs[0].name).toBe('api-guide.txt');

      // 3. Query /v1/rag/search
      const searchRes = await (server as any).fastify.inject({
        method: 'POST',
        url: '/v1/rag/search',
        payload: { query: 'fast endpoints' },
      });
      expect(searchRes.statusCode).toBe(200);
      const results = JSON.parse(searchRes.body);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].documentName).toBe('api-guide.txt');
    });
  });
});
