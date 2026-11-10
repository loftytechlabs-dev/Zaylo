import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {
  findLoftyDbBinary,
  getDefaultLoftyDbConfig,
  getPlatformBinaryFilenames,
  InferenceService,
  LoftyDbClient,
  LoftyDbProcessManager,
  MemoryEngine,
} from '@local-ai/inference';
import { createDatabaseAsync, SettingsRepository, ServerRepository, ModelRepository, APIKeyRepository, DeviceRepository } from '@local-ai/database';
import { ModelManager } from '@local-ai/models';
import { KeyManager } from '@local-ai/security';
import { DevicePairingManager } from '@local-ai/network';
import { ApiServer } from '@local-ai/server';
import type { InferenceRuntime, RuntimeCapabilities, RuntimeConfig, RuntimeHealth } from '@local-ai/runtimes';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  LoftyDbSubscriptionEvent,
  RuntimeInstance,
} from '@local-ai/shared';
import { createChatCompletionChunk } from '@local-ai/protocol';

function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (addr && typeof addr === 'object') {
        const port = addr.port;
        srv.close(() => resolve(port));
      } else {
        srv.close(() => reject(new Error('Could not allocate ephemeral port')));
      }
    });
  });
}

class MockMemoryCaptureRuntime implements InferenceRuntime {
  public readonly id = 'mock-memory-rt';
  public readonly name = 'Mock Memory Runtime';
  public lastReceivedRequest?: ChatCompletionRequest;

  async detectCapabilities(): Promise<RuntimeCapabilities> {
    return {
      supportedFormats: ['gguf'],
      supportedBackends: ['cpu'],
      supportsEmbeddings: false,
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
      gpuLayersOffloaded: 0,
    };
  }

  async stop(): Promise<void> {}

  async health(): Promise<RuntimeHealth> {
    return { isHealthy: true, state: 'RUNNING', modelLoaded: true, uptimeSeconds: 10 };
  }

  async *chatStream(request: ChatCompletionRequest): AsyncIterable<ChatCompletionResponse> {
    this.lastReceivedRequest = request;
    yield createChatCompletionChunk({
      id: 'mem-chunk-1',
      model: request.model,
      delta: { content: 'Acknowledged with memory.' },
    });
    yield createChatCompletionChunk({
      id: 'mem-chunk-1',
      model: request.model,
      delta: {},
      finishReason: 'stop',
    });
  }

  async embeddings(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    return {
      object: 'list',
      data: [{ object: 'embedding', index: 0, embedding: [0.1, 0.2] }],
      model: request.model,
      usage: { prompt_tokens: 1, total_tokens: 1 },
    };
  }
}

const binInfo = findLoftyDbBinary();
const describeWithLoftyDb = binInfo.found ? describe : describe.skip;

describeWithLoftyDb('LoftyDB Direct Integration & Better Memory Engine', () => {
  let tempDir: string;
  let dbDir: string;
  let sqlitePath: string;
  let port: number;
  let client: LoftyDbClient;
  let processManager: LoftyDbProcessManager;
  let memoryEngine: MemoryEngine;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zaylo-loftydb-test-'));
    dbDir = path.join(tempDir, 'loftydb-data');
    sqlitePath = path.join(tempDir, 'settings.sqlite');
    port = await getAvailablePort();

    client = new LoftyDbClient(`http://127.0.0.1:${port}`);
    processManager = new LoftyDbProcessManager(client);
    const config = {
      ...getDefaultLoftyDbConfig(),
      port,
      baseUrl: `http://127.0.0.1:${port}`,
      dataDir: dbDir,
    };

    const status = await processManager.start(config);
    expect(status.connected).toBe(true);
    expect(status.binaryFound).toBe(true);

    memoryEngine = new MemoryEngine(client, {
      autoRecallEnabled: true,
      autoExtractEnabled: true,
      defaultRecallLimit: 5,
      defaultMinSimilarity: 0.1,
    });
  }, 15000);

  afterAll(async () => {
    await processManager.stop();
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should persist LoftyDB config in SQLite SettingsRepository without storing memories in SQLite', async () => {
    const dbConn = await createDatabaseAsync(sqlitePath);
    try {
      const settingsRepo = new SettingsRepository(dbConn.raw);
      const customConfig = {
        ...getDefaultLoftyDbConfig(),
        port,
        baseUrl: `http://127.0.0.1:${port}`,
        dataDir: dbDir,
      };
      settingsRepo.set('loftydb_config', customConfig);
      const loaded = settingsRepo.get<typeof customConfig>('loftydb_config');
      expect(loaded?.port).toBe(port);
      expect(loaded?.dataDir).toBe(dbDir);

      // Verify SQLite has no memory or conversation tables
      const tables = dbConn.raw
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map((r: any) => r.name);
      expect(tables).not.toContain('zaylo_memories');
      expect(tables).not.toContain('memories');
      expect(tables).not.toContain('conversations');
    } finally {
      dbConn.close();
    }
  });

  it('should support full LoftyDB feature set: CRUD, NoSQL query, SQL JOIN, Vector Search, Time Travel, Compaction, and SSE', async () => {
    // 1. Auto-vectorized document insert + update (creates v1 and v2)
    const v1 = await client.upsertDocument(
      'notes',
      {
        _id: 'note_1',
        title: 'Database Architecture',
        body: 'LoftyDB is a temporal document database with vector search',
        _vector_source: 'body',
        priority: 3,
      },
      'note_1'
    );
    expect(v1._version).toBe(1);

    const v2 = await client.upsertDocument(
      'notes',
      {
        _id: 'note_1',
        title: 'Database Architecture v2',
        body: 'LoftyDB handles temporal versioning, SQL joins, and SSE streams',
        _vector_source: 'body',
        priority: 5,
      },
      'note_1'
    );
    expect(v2._version).toBe(2);

    // 2. History + Diff + Rollback + AS OF
    const history = await client.getHistory('notes', 'note_1');
    expect(history.length).toBe(2);
    expect(history[0].version).toBe(1);
    expect(history[1].version).toBe(2);

    const diff = await client.diffVersions('notes', 'note_1', 1, 2);
    expect(diff.changed.priority).toEqual({ from: 3, to: 5 });

    const tsAfterV1 = history[0].timestampNs || history[0].timestamp;
    const asOfDocs = await client.queryDocuments('notes', { _id: 'note_1' }, tsAfterV1);
    expect(asOfDocs.length).toBe(1);
    expect(asOfDocs[0].priority).toBe(3);

    const rolled = await client.rollbackDocument('notes', 'note_1', 1);
    expect(rolled._version).toBe(3);
    expect(rolled.priority).toBe(3);

    // 3. NoSQL Query with MongoDB operators
    const filtered = await client.queryDocuments('notes', { priority: { $gte: 2 } });
    expect(filtered.some((d) => d._id === 'note_1')).toBe(true);

    // 4. Vector Search
    const vecRes = await client.vectorSearch('notes', {
      text: 'temporal document database vector search',
      limit: 5,
      minSimilarity: 0.1,
    });
    expect(vecRes.documents.length).toBeGreaterThanOrEqual(1);
    expect(typeof vecRes.documents[0]._similarity).toBe('number');

    // 5. SQL Query with JOIN
    await client.upsertDocument('authors', { _id: 'auth_1', name: 'Akhil' }, 'auth_1');
    await client.upsertDocument('notes', { _id: 'note_2', title: 'Joined', author_id: 'auth_1', priority: 4 }, 'note_2');
    const sqlRes = await client.executeSql(
      'SELECT notes.title, authors.name FROM notes INNER JOIN authors ON notes.author_id = authors._id WHERE notes.priority >= 4 LIMIT 5'
    );
    expect(sqlRes.documents.length).toBe(1);
    expect((sqlRes.documents[0] as any).authors.name).toBe('Akhil');

    // 6. Reactive SSE Subscription
    const receivedEvents: LoftyDbSubscriptionEvent[] = [];
    const unsubscribe = client.subscribe('notes', { priority: { $gte: 4 } }, (ev) => {
      receivedEvents.push(ev);
    });

    await new Promise((r) => setTimeout(r, 250));
    await client.upsertDocument('notes', { _id: 'note_live', title: 'Live SSE', priority: 5 }, 'note_live');
    await new Promise((r) => setTimeout(r, 300));
    unsubscribe();

    expect(receivedEvents.some((e) => e.type === 'connected')).toBe(true);
    expect(receivedEvents.some((e) => e.type === 'insert' && e.doc_id === 'note_live')).toBe(true);

    // 7. Compact & Drop collection
    const compacted = await client.compactCollection('notes');
    expect(compacted).toBe(true);
    const stats = await client.getStats();
    expect(stats.col_count).toBeGreaterThanOrEqual(2);
    expect(await client.deleteCollection('notes')).toBe(true);
    expect(await client.deleteCollection('authors')).toBe(true);
  });

  it('should store, recall, auto-extract, version, and persist conversations for Zaylo better memory', async () => {
    // 1. Save manual memory + update to test versioning
    const m1 = await memoryEngine.saveMemory({
      content: 'User builds high-performance systems in Rust and TypeScript.',
      category: 'fact',
      scope: 'global',
      importance: 4,
      tags: ['rust', 'typescript'],
    });
    expect(m1.version).toBe(1);

    const m1v2 = await memoryEngine.saveMemory({
      id: m1.id,
      content: 'User builds high-performance local AI systems in Rust, Go, and TypeScript.',
      category: 'fact',
      scope: 'global',
      importance: 5,
      tags: ['rust', 'go', 'typescript'],
    });
    expect(m1v2.version).toBe(2);

    // 2. Semantic recall
    const recalled = await memoryEngine.recall({
      query: 'What languages does the user build local AI systems in?',
      limit: 3,
      minSimilarity: 0.05,
    });
    expect(recalled.length).toBeGreaterThanOrEqual(1);
    expect(recalled[0].memory.content).toContain('Rust, Go, and TypeScript');

    // 3. Auto-extraction & deduplication
    const extracted = await memoryEngine.extractAndPersistFromUserMessage(
      'Remember that I always prefer concise code without verbose explanations.',
      { conversationId: 'conv_test_1' }
    );
    expect(extracted.length).toBe(1);
    expect(extracted[0].pinned).toBe(true);
    expect(extracted[0].category).toBe('instruction');

    // Repeating same fact updates existing version instead of creating duplicate row
    const extractedAgain = await memoryEngine.extractAndPersistFromUserMessage(
      'Remember that I always prefer concise code without verbose explanations.',
      { conversationId: 'conv_test_1' }
    );
    expect(extractedAgain[0].id).toBe(extracted[0].id);

    // 4. InferenceService prompt injection with MemoryEngine
    const mockRuntime = new MockMemoryCaptureRuntime();
    const inferenceService = new InferenceService(undefined, undefined, 2, undefined, memoryEngine);
    inferenceService.setRuntime(mockRuntime, 'Mock-Model');

    const res = await inferenceService.chat({
      model: 'Mock-Model',
      messages: [
        { role: 'system', content: 'Base system prompt.' },
        { role: 'user', content: 'Tell me which programming languages I use.' },
      ],
      memory: true,
      conversationId: 'conv_test_1',
    });
    expect(res.choices[0].message?.content).toBe('Acknowledged with memory.');
    const sentSys = mockRuntime.lastReceivedRequest?.messages.find((m) => m.role === 'system')?.content;
    expect(typeof sentSys).toBe('string');
    expect(sentSys).toContain('Base system prompt.');
    expect(sentSys).toContain('LONG-TERM MEMORY');
    expect(sentSys).toContain('Rust, Go, and TypeScript');

    // 5. Conversation persistence + semantic search + sync
    await memoryEngine.saveConversation({
      id: 'conv_test_1',
      title: 'LoftyDB Memory Verification',
      modelId: 'mock',
      modelName: 'Mock-Model',
      messages: [{ role: 'user', content: 'Testing LoftyDB memory recall with Rust and Go' }],
      createdAt: Date.now() - 1000,
      updatedAt: Date.now(),
    });

    const foundConvs = await memoryEngine.searchConversations('LoftyDB memory recall Rust');
    expect(foundConvs.some((c) => c.id === 'conv_test_1')).toBe(true);

    const synced = await memoryEngine.syncConversations([
      {
        id: 'conv_local_only',
        title: 'Local Only Chat',
        modelId: 'mock',
        modelName: 'Mock-Model',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);
    expect(synced.some((c) => c.id === 'conv_test_1')).toBe(true);
    expect(synced.some((c) => c.id === 'conv_local_only')).toBe(true);

    // 6. Scanning stored conversations extracts durable statements and links conversationId
    await memoryEngine.saveConversation({
      id: 'conv_extract_source',
      title: 'Project Setup Chat',
      modelId: 'mock',
      modelName: 'Mock-Model',
      messages: [
        { role: 'user', content: 'Remember that we deploy services using Docker Compose.' },
      ],
      createdAt: Date.now() - 500,
      updatedAt: Date.now(),
    });
    const scanRes = await memoryEngine.extractMemoriesFromConversations('conv_extract_source');
    expect(scanRes.scannedConversations).toBe(1);
    expect(scanRes.scannedMessages).toBe(1);
    expect(scanRes.extracted.length).toBe(1);
    expect(scanRes.extracted[0].conversationId).toBe('conv_extract_source');
  });

  it('should expose /v1/memories endpoints on Zaylo ApiServer backed by LoftyDB', async () => {
    const apiPort = await getAvailablePort();
    const apiDbPath = path.join(tempDir, 'apiserver.sqlite');
    const dbConn = await createDatabaseAsync(apiDbPath);
    const serverRepo = new ServerRepository(dbConn.raw);
    const config = {
      ...serverRepo.getConfig(),
      port: apiPort,
      modelsDirectory: path.join(tempDir, 'models'),
      runtimeDirectory: path.join(tempDir, 'runtimes'),
    };
    const modelRepo = new ModelRepository(dbConn.raw);
    const modelManager = new ModelManager(modelRepo, config.modelsDirectory);
    const keyManager = new KeyManager(new APIKeyRepository(dbConn.raw));
    const deviceRepo = new DeviceRepository(dbConn.raw);
    const pairingManager = new DevicePairingManager(keyManager, deviceRepo);
    const inferenceService = new InferenceService(undefined, undefined, 2, undefined, memoryEngine);
    inferenceService.setRuntime(new MockMemoryCaptureRuntime(), 'Mock-Model');

    const apiServer = new ApiServer({
      config,
      inferenceService,
      modelManager,
      keyManager,
      deviceRepo,
      pairingManager,
    });
    await apiServer.start();

    try {
      const createRes = await fetch(`http://127.0.0.1:${apiPort}/v1/memories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'API client uses Dark monochrome theme and TypeScript strict mode.',
          category: 'preference',
          scope: 'global',
          importance: 5,
          pinned: true,
        }),
      });
      expect(createRes.status).toBe(200);
      const created = (await createRes.json()) as any;
      expect(created.id).toBeDefined();

      const searchRes = await fetch(`http://127.0.0.1:${apiPort}/v1/memories/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'TypeScript strict mode monochrome theme', limit: 3 }),
      });
      expect(searchRes.status).toBe(200);
      const matches = (await searchRes.json()) as any[];
      expect(matches.some((m) => m.memory.id === created.id)).toBe(true);

      const historyRes = await fetch(`http://127.0.0.1:${apiPort}/v1/memories/${created.id}/history`);
      expect(historyRes.status).toBe(200);
      const histData = (await historyRes.json()) as any;
      expect(histData.history.length).toBe(1);

      const graphRes = await fetch(`http://127.0.0.1:${apiPort}/v1/memories/graph`);
      expect(graphRes.status).toBe(200);
      const graphPayload = (await graphRes.json()) as any;
      expect(Array.isArray(graphPayload.memories)).toBe(true);
      expect(Array.isArray(graphPayload.entities)).toBe(true);
      expect(Array.isArray(graphPayload.relationships)).toBe(true);
      expect(graphPayload.intelligence).toBeDefined();
    } finally {
      await apiServer.stop();
      dbConn.close();
    }
  });

  it('should build a real property Knowledge Graph with entities, typed relationships, intelligence insights, and confirmed merges', async () => {
    const projectMem = await memoryEngine.saveMemory({
      content: 'Our backend project is built with Fastify, TypeScript, and LoftyDB.',
      category: 'project',
      scope: 'global',
      importance: 5,
      pinned: true,
      conversationId: 'conv_extract_source',
    });

    const conflictingVerbose = await memoryEngine.saveMemory({
      content: 'Always provide comprehensive, verbose explanations in answers.',
      category: 'preference',
      scope: 'global',
      importance: 3,
    });

    const dupMemA = await memoryEngine.saveMemory({
      content: 'Prefer dark theme monochrome panels with TypeScript types.',
      category: 'preference',
      scope: 'global',
      importance: 4,
      tags: ['ui'],
    });
    const dupMemB = await memoryEngine.saveMemory({
      content: 'User prefers dark theme monochrome panels with strict TypeScript types.',
      category: 'preference',
      scope: 'global',
      importance: 3,
      tags: ['style'],
    });

    // Trigger recall telemetry (must NOT bump memory document _version)
    await memoryEngine.recall({ query: 'Fastify TypeScript LoftyDB backend', limit: 3 });
    await new Promise((r) => setTimeout(r, 120));

    const graph = await memoryEngine.getKnowledgeGraph();

    // Entities extracted automatically
    const entityNames = graph.entities.map((e) => e.name);
    expect(entityNames).toContain('Fastify');
    expect(entityNames).toContain('TypeScript');
    expect(entityNames).toContain('LoftyDB');

    // Typed BUILT_WITH and DERIVED_FROM relationships persisted
    expect(
      graph.relationships.some(
        (r) => r.sourceId === projectMem.id && r.type === 'BUILT_WITH'
      )
    ).toBe(true);
    expect(
      graph.relationships.some(
        (r) => r.sourceId === projectMem.id && r.targetId === 'conv_extract_source' && r.type === 'DERIVED_FROM'
      )
    ).toBe(true);

    // Contradiction detected against earlier concise instruction
    expect(
      graph.relationships.some(
        (r) =>
          (r.sourceId === conflictingVerbose.id || r.targetId === conflictingVerbose.id) &&
          r.type === 'CONTRADICTS'
      )
    ).toBe(true);
    expect(graph.intelligence.contradictions.length).toBeGreaterThanOrEqual(1);

    // Duplicate pair detected & confirmed manual merge preserves tags cleanly
    expect(graph.intelligence.similarDuplicates.length).toBeGreaterThanOrEqual(1);
    const merged = await memoryEngine.mergeMemories(
      dupMemA.id,
      dupMemB.id,
      'Prefer dark theme monochrome panels with strict TypeScript types.'
    );
    expect(merged.tags).toEqual(expect.arrayContaining(['ui', 'style']));

    // Confirmed manual custom relationship CRUD
    const customRel = await memoryEngine.createRelationship({
      sourceId: projectMem.id,
      targetId: dupMemA.id,
      sourceKind: 'memory',
      targetKind: 'memory',
      type: 'DEPENDS_ON',
      strength: 0.91,
      directed: true,
    });
    expect(customRel.type).toBe('DEPENDS_ON');
    expect(await memoryEngine.deleteRelationship(customRel.id)).toBe(true);

    // Regression: "long-term" must not false-trigger a CONTRADICTS edge against concise instructions,
    // and undirected relationships created in either node order must deduplicate to a single canonical edge.
    const longTermFact = await memoryEngine.saveMemory({
      content: 'LoftyDB serves strictly for long-term AI memory and conversation persistence.',
      category: 'fact',
      scope: 'global',
      importance: 4,
    });
    const canonicalA = await memoryEngine.createRelationship({
      sourceId: longTermFact.id,
      targetId: projectMem.id,
      sourceKind: 'memory',
      targetKind: 'memory',
      type: 'RELATED_TO',
      strength: 0.75,
      directed: false,
    });
    const canonicalB = await memoryEngine.createRelationship({
      sourceId: projectMem.id,
      targetId: longTermFact.id,
      sourceKind: 'memory',
      targetKind: 'memory',
      type: 'RELATED_TO',
      strength: 0.75,
      directed: false,
    });
    expect(canonicalA.id).toBe(canonicalB.id);

    const refreshedGraph = await memoryEngine.getKnowledgeGraph();
    expect(
      refreshedGraph.relationships.some(
        (r) =>
          (r.sourceId === longTermFact.id || r.targetId === longTermFact.id) &&
          r.type === 'CONTRADICTS'
      )
    ).toBe(false);
    expect(
      refreshedGraph.relationships.filter((r) => r.id === canonicalA.id).length
    ).toBe(1);
    expect(await memoryEngine.deleteRelationship(canonicalA.id)).toBe(true);
  });

  it('should bundle and resolve LoftyDB engine binaries cleanly for macOS, Windows, and Linux', () => {
    const resourcesDir = path.resolve(process.cwd(), 'apps/desktop/resources/loftydb');
    const platformTargets: Array<[NodeJS.Platform, string, string]> = [
      ['darwin', 'arm64', 'loftyDB-darwin-arm64'],
      ['darwin', 'x64', 'loftyDB-darwin-amd64'],
      ['win32', 'x64', 'loftyDB-windows-amd64.exe'],
      ['win32', 'arm64', 'loftyDB-windows-arm64.exe'],
      ['linux', 'x64', 'loftyDB-linux-amd64'],
      ['linux', 'arm64', 'loftyDB-linux-arm64'],
    ];

    for (const [platform, arch, expectedBinary] of platformTargets) {
      const candidates = getPlatformBinaryFilenames(platform, arch);
      expect(candidates[0]).toBe(expectedBinary);
      const bundledFile = path.join(resourcesDir, expectedBinary);
      expect(fs.existsSync(bundledFile)).toBe(true);
      expect(fs.statSync(bundledFile).size).toBeGreaterThan(1_000_000);
    }
  });
});
