import crypto from 'node:crypto';
import type { IPCChannels, IPCEvents } from '@local-ai/protocol';
import type { SettingsRepository } from '@local-ai/database';
import {
  InferenceService,
  LoftyDbClient,
  LoftyDbProcessManager,
  MemoryEngine,
  getDefaultLoftyDbConfig,
} from '@local-ai/inference';
import type { LoftyDbConfig } from '@local-ai/shared';

export type IpcRegistrar = <K extends keyof IPCChannels>(
  channel: K,
  fn: (req: IPCChannels[K]['request']) => Promise<IPCChannels[K]['response']> | IPCChannels[K]['response']
) => void;

export type EventEmitterFn = <K extends keyof IPCEvents>(channel: K, data: IPCEvents[K]) => void;

const LOFTYDB_CONFIG_KEY = 'loftydb_config';

export function registerLoftyDbHandlers(deps: {
  handle: IpcRegistrar;
  sendEvent: EventEmitterFn;
  settingsRepo: SettingsRepository;
  inferenceService: InferenceService;
}): () => Promise<void> {
  const { handle, sendEvent, settingsRepo, inferenceService } = deps;

  let config: LoftyDbConfig = {
    ...getDefaultLoftyDbConfig(),
    ...(settingsRepo.get<Partial<LoftyDbConfig>>(LOFTYDB_CONFIG_KEY) || {}),
  };

  const client = new LoftyDbClient(
    config.mode === 'external' ? config.baseUrl : `http://127.0.0.1:${config.port}`
  );
  const processManager = new LoftyDbProcessManager(client);
  const memoryEngine = new MemoryEngine(client, {
    autoRecallEnabled: config.enabled && config.memoryEnabled,
    autoExtractEnabled: config.enabled && config.memoryEnabled && config.autoExtractMemories,
    defaultRecallLimit: config.recallLimit,
    defaultMinSimilarity: config.minSimilarity,
  });

  const syncMemoryAttachment = () => {
    memoryEngine.configure({
      autoRecallEnabled: config.enabled && config.memoryEnabled,
      autoExtractEnabled: config.enabled && config.memoryEnabled && config.autoExtractMemories,
      defaultRecallLimit: config.recallLimit,
      defaultMinSimilarity: config.minSimilarity,
    });
    if (config.enabled && config.memoryEnabled) {
      inferenceService.setMemoryEngine(memoryEngine, () => {
        sendEvent('memory:updated', undefined);
      });
    } else {
      inferenceService.setMemoryEngine(undefined);
    }
  };

  syncMemoryAttachment();

  const activeSubscriptions = new Map<string, () => void>();
  const clearAllSubscriptions = () => {
    for (const unsub of activeSubscriptions.values()) {
      try {
        unsub();
      } catch {
        // Ignored
      }
    }
    activeSubscriptions.clear();
  };

  const unsubLog = processManager.onLog((line) => {
    sendEvent('loftydb:log', line);
  });

  // Auto-start or connect in background without delaying Electron window boot
  if (config.enabled && config.autoStart) {
    void processManager
      .start(config)
      .then((status) => sendEvent('loftydb:status-changed', status))
      .catch(() => {});
  }

  handle('loftydb:get-config', () => config);

  handle('loftydb:update-config', async (patch) => {
    const prevMode = config.mode;
    const prevPort = config.port;
    const prevDir = config.dataDir;

    config = {
      ...config,
      ...patch,
      baseUrl:
        patch.baseUrl ??
        (patch.port && (patch.mode ?? config.mode) === 'managed'
          ? `http://127.0.0.1:${patch.port}`
          : config.baseUrl),
    };
    settingsRepo.set(LOFTYDB_CONFIG_KEY, config);
    client.setBaseUrl(processManager.resolveTargetUrl(config));
    syncMemoryAttachment();

    const connectionChanged =
      prevMode !== config.mode || prevPort !== config.port || prevDir !== config.dataDir;
    if (connectionChanged && config.enabled && config.autoStart) {
      clearAllSubscriptions();
      const status = await processManager.start(config);
      sendEvent('loftydb:status-changed', status);
    } else {
      const status = await processManager.getStatus(config);
      sendEvent('loftydb:status-changed', status);
    }

    return config;
  });

  handle('loftydb:get-status', async () => {
    return processManager.getStatus(config);
  });

  handle('loftydb:start', async () => {
    const status = await processManager.start(config);
    syncMemoryAttachment();
    sendEvent('loftydb:status-changed', status);
    return status;
  });

  handle('loftydb:stop', async () => {
    clearAllSubscriptions();
    await processManager.stop();
    const status = await processManager.getStatus(config);
    sendEvent('loftydb:status-changed', status);
    return status;
  });

  handle('loftydb:test-connection', async ({ baseUrl }) => {
    const probeClient = new LoftyDbClient(baseUrl || processManager.resolveTargetUrl(config));
    try {
      const stats = await probeClient.getStats();
      return { ok: true, stats };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Connection failed' };
    }
  });

  // Direct LoftyDB Collections, Query, SQL, Vector, Time-Travel, Compaction, SSE
  handle('loftydb:list-collections', async () => {
    return client.listCollections();
  });

  handle('loftydb:delete-collection', async ({ collection }) => {
    return client.deleteCollection(collection);
  });

  handle('loftydb:compact-collection', async ({ collection }) => {
    return client.compactCollection(collection);
  });

  handle('loftydb:query-documents', async ({ collection, filter, asOf }) => {
    return client.queryDocuments(collection, filter || {}, asOf);
  });

  handle('loftydb:upsert-document', async ({ collection, document, id }) => {
    const saved = await client.upsertDocument(collection, document, id);
    sendEvent('memory:updated', undefined);
    return saved;
  });

  handle('loftydb:get-document', async ({ collection, id, asOf }) => {
    return client.getDocument(collection, id, asOf);
  });

  handle('loftydb:delete-document', async ({ collection, id }) => {
    const deleted = await client.deleteDocument(collection, id);
    sendEvent('memory:updated', undefined);
    return deleted;
  });

  handle('loftydb:vector-search', async ({ collection, text, vector, limit, minSimilarity }) => {
    return client.vectorSearch(collection, { text, vector, limit, minSimilarity });
  });

  handle('loftydb:execute-sql', async ({ query, asOf }) => {
    return client.executeSql(query, asOf);
  });

  handle('loftydb:get-history', async ({ collection, id }) => {
    return client.getHistory(collection, id);
  });

  handle('loftydb:diff-versions', async ({ collection, id, v1, v2 }) => {
    return client.diffVersions(collection, id, v1, v2);
  });

  handle('loftydb:rollback', async ({ collection, id, version }) => {
    const doc = await client.rollbackDocument(collection, id, version);
    sendEvent('memory:updated', undefined);
    return doc;
  });

  handle('loftydb:subscribe', ({ collection, filter }) => {
    const subscriptionId = `sub_${crypto.randomBytes(6).toString('hex')}`;
    const unsub = client.subscribe(collection, filter || {}, (ev) => {
      sendEvent('loftydb:subscription-event', {
        ...ev,
        subscriptionId,
      });
    });
    activeSubscriptions.set(subscriptionId, unsub);
    return { subscriptionId };
  });

  handle('loftydb:unsubscribe', ({ subscriptionId }) => {
    const unsub = activeSubscriptions.get(subscriptionId);
    if (!unsub) return false;
    unsub();
    activeSubscriptions.delete(subscriptionId);
    return true;
  });

  // Better Memory & Persistent Conversations backed by LoftyDB
  handle('memory:list', async (filter) => {
    return memoryEngine.listMemories(filter || undefined);
  });

  handle('memory:save', async (input) => {
    const saved = await memoryEngine.saveMemory(input);
    sendEvent('memory:updated', undefined);
    return saved;
  });

  handle('memory:delete', async ({ id }) => {
    const ok = await memoryEngine.deleteMemory(id);
    if (ok) sendEvent('memory:updated', undefined);
    return ok;
  });

  handle('memory:recall', async (opts) => {
    return memoryEngine.recall(opts);
  });

  handle('memory:history', async ({ id }) => {
    return memoryEngine.getMemoryHistory(id);
  });

  handle('memory:diff', async ({ id, v1, v2 }) => {
    return memoryEngine.diffMemoryVersions(id, v1, v2);
  });

  handle('memory:rollback', async ({ id, version }) => {
    const rolled = await memoryEngine.rollbackMemory(id, version);
    sendEvent('memory:updated', undefined);
    return rolled;
  });

  handle('memory:query-as-of', async ({ asOf, filter }) => {
    return memoryEngine.queryMemoriesAsOf(asOf, filter || {});
  });

  handle('memory:list-conversations', async () => {
    return memoryEngine.listConversations();
  });

  handle('memory:save-conversation', async (conv) => {
    return memoryEngine.saveConversation(conv);
  });

  handle('memory:delete-conversation', async ({ id }) => {
    return memoryEngine.deleteConversation(id);
  });

  handle('memory:search-conversations', async ({ query, limit }) => {
    return memoryEngine.searchConversations(query, limit);
  });

  handle('memory:sync-conversations', async ({ conversations }) => {
    return memoryEngine.syncConversations(conversations);
  });

  handle('memory:extract-from-conversations', async ({ conversationId }) => {
    const result = await memoryEngine.extractMemoriesFromConversations(conversationId);
    if (result.extracted.length > 0) {
      sendEvent('memory:updated', undefined);
    }
    return result;
  });

  handle('memory:get-graph', async (req) => {
    return memoryEngine.getKnowledgeGraph(req?.collection);
  });

  handle('memory:create-relationship', async (req) => {
    const rel = await memoryEngine.createRelationship({ ...req, autoGenerated: false });
    sendEvent('memory:updated', undefined);
    return rel;
  });

  handle('memory:delete-relationship', async ({ id }) => {
    const ok = await memoryEngine.deleteRelationship(id);
    if (ok) sendEvent('memory:updated', undefined);
    return ok;
  });

  handle('memory:merge', async ({ primaryId, secondaryId, mergedContent }) => {
    const merged = await memoryEngine.mergeMemories(primaryId, secondaryId, mergedContent);
    sendEvent('memory:updated', undefined);
    return merged;
  });

  return async () => {
    unsubLog();
    clearAllSubscriptions();
    await processManager.stop();
  };
}
