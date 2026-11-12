import { create } from 'zustand';
import { api } from '../api/client';
import type {
  HardwareProfile,
  CapabilityProfile,
  Model,
  ModelInstallation,
  DownloadProgress,
  ServerConfiguration,
  RuntimeInstance,
  ServerState,
  ConnectedDevice,
  APIKeyInfo,
  SystemMetricSample,
  StructuredLog,
  ChatMessage,
  DocumentInfo,
  DocumentType,
  FineTunedModelArtifact,
  GeneratedImage,
  ImageGenerationJob,
  ImageGenerationParams,
  ImageGenerationProgress,
  Persona,
  LoftyDbConfig,
  LoftyDbStatus,
  MemoryEntry,
  MemoryCategory,
  MemoryScope,
} from '@local-ai/shared';
import type { PlaygroundConversation } from '../features/playground/types';
import {
  PersonaManager,
  PersonaResolver,
  PersonaPromptAdapter,
} from '@local-ai/inference';

export type NavTab =
  | 'overview'
  | 'models'
  | 'forge'
  | 'playground'
  | 'personas'
  | 'loftydb'
  | 'server'
  | 'devices'
  | 'performance'
  | 'logs'
  | 'benchmark'
  | 'settings';

interface AppStore {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;

  // Theme
  theme: 'dark' | 'light';
  themePreference: 'dark' | 'light' | 'system';
  setTheme: (theme: 'dark' | 'light') => void;
  setThemePreference: (pref: 'dark' | 'light' | 'system') => void;
  toggleTheme: () => void;

  // Onboarding
  showOnboarding: boolean;
  setShowOnboarding: (show: boolean) => void;

  // Hardware & Capabilities
  hardware?: HardwareProfile;
  capabilities?: CapabilityProfile;
  fetchHardware: () => Promise<void>;

  // Server & Lifecycle
  serverState: ServerState;
  serverInstance?: RuntimeInstance;
  serverConfig?: ServerConfiguration;
  lanAddress?: string;
  fetchServerState: () => Promise<void>;
  startServer: (modelId?: string, variantId?: string) => Promise<void>;
  stopServer: () => Promise<void>;
  restartServer: () => Promise<void>;
  updateServerConfig: (config: Partial<ServerConfiguration>) => Promise<void>;

  // Models
  availableModels: Model[];
  installedModels: ModelInstallation[];
  fineTunedModels: FineTunedModelArtifact[];
  downloads: Record<string, DownloadProgress>;
  fetchModels: () => Promise<void>;
  downloadModel: (modelId: string, variantId: string, downloadUrl?: string, name?: string) => Promise<string>;
  cancelDownload: (downloadId: string) => Promise<void>;
  setDownloadProgress: (progress: DownloadProgress) => void;
  removeDownload: (downloadId: string) => void;
  deleteModel: (installationId: string) => Promise<void>;
  deleteFineTunedModel: (artifactId: string) => Promise<void>;
  importLocalModel: (filePath?: string, name?: string) => Promise<ModelInstallation | null>;

  // Metrics & Telemetry
  currentMetric?: SystemMetricSample;
  metricHistory: SystemMetricSample[];
  updateMetric: (sample: SystemMetricSample) => void;

  // Logs
  logs: StructuredLog[];
  addLog: (log: StructuredLog) => void;
  fetchLogs: () => Promise<void>;
  clearLogs: () => Promise<void>;

  // Devices & Keys
  devices: ConnectedDevice[];
  apiKeys: APIKeyInfo[];
  fetchDevicesAndKeys: () => Promise<void>;
  createKey: (name: string) => Promise<{ key: APIKeyInfo; rawKey: string }>;
  revokeKey: (keyId: string) => Promise<void>;
  deleteKey: (keyId: string) => Promise<void>;
  revokeDevice: (deviceId: string) => Promise<void>;
  deleteDevice: (deviceId: string) => Promise<void>;

  // Local Document Knowledge & RAG
  ragEnabled: boolean;
  ragDocuments: DocumentInfo[];
  fetchRagDocuments: () => Promise<void>;
  addRagDocument: (name: string, content: string, type?: DocumentType) => Promise<DocumentInfo>;
  deleteRagDocument: (id: string) => Promise<void>;
  setRagEnabled: (enabled: boolean) => void;

  // LoftyDB Engine & Long-Term Memory
  loftyDbConfig?: LoftyDbConfig;
  loftyDbStatus?: LoftyDbStatus;
  loftyDbLogs: string[];
  memoryEnabled: boolean;
  memories: MemoryEntry[];
  setMemoryEnabled: (enabled: boolean) => void;
  setLoftyDbStatus: (status: LoftyDbStatus) => void;
  appendLoftyDbLog: (line: string) => void;
  fetchLoftyDbState: () => Promise<void>;
  updateLoftyDbConfig: (patch: Partial<LoftyDbConfig>) => Promise<LoftyDbConfig>;
  startLoftyDb: () => Promise<LoftyDbStatus>;
  stopLoftyDb: () => Promise<LoftyDbStatus>;
  fetchMemories: () => Promise<void>;
  saveMemory: (input: {
    id?: string;
    title?: string;
    content: string;
    category?: MemoryCategory;
    scope?: MemoryScope;
    personaId?: string;
    conversationId?: string;
    importance?: number;
    confidence?: number;
    pinned?: boolean;
    tags?: string[];
    source?: 'auto' | 'manual' | 'chat';
  }) => Promise<MemoryEntry>;
  deleteMemory: (id: string) => Promise<void>;
  syncConversationsWithLoftyDb: () => Promise<void>;
  persistConversationToLoftyDb: (conv: PlaygroundConversation) => Promise<void>;

  // Multimodal Vision
  pendingImage?: { dataUrl: string; name: string };
  setPendingImage: (img?: { dataUrl: string; name: string }) => void;

  // Image Generation
  imageHistory: GeneratedImage[];
  activeImageJob: ImageGenerationJob | null;
  isGeneratingImage: boolean;
  imageProgress?: ImageGenerationProgress;
  fetchImageHistory: () => Promise<void>;
  generateImage: (params: {
    modelId: string;
    modelName?: string;
    modelPath?: string;
    params: Partial<ImageGenerationParams>;
    device?: 'auto' | 'mps' | 'cuda' | 'cpu';
  }) => Promise<string>;
  cancelImageGeneration: (jobId: string) => Promise<boolean>;
  deleteGeneratedImage: (imageId: string) => Promise<void>;
  saveImageAs: (imagePath: string, defaultName?: string) => Promise<string | null>;
  openImageFolder: (imagePath: string) => Promise<void>;
  setImageProgress: (progress?: ImageGenerationProgress) => void;
  setActiveImageJob: (job: ImageGenerationJob | null) => void;
  setIsGeneratingImage: (isGenerating: boolean) => void;

  // Playground Chat State
  playgroundMessages: ChatMessage[];
  isGenerating: boolean;
  activeRequestId?: string;
  generationStats?: { latencyMs: number; tokensPerSec: number; tokenCount: number };
  systemPrompt: string;
  temperature: number;
  topP: number;
  selectedModel: string;
  setSystemPrompt: (prompt: string) => void;
  setTemperature: (t: number) => void;
  setTopP: (p: number) => void;
  setSelectedModel: (m: string) => void;
  addPlaygroundMessage: (msg: ChatMessage) => void;
  updateLastAssistantMessage: (delta: string) => void;
  clearPlayground: () => void;
  sendChatMessage: (content: string) => Promise<void>;
  stopGeneration: () => void;

  // Conversations & History State
  conversations: PlaygroundConversation[];
  activeConvId: string;
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setConversations: (updater: PlaygroundConversation[] | ((prev: PlaygroundConversation[]) => PlaygroundConversation[])) => void;
  setActiveConvId: (id: string) => void;
  createNewChat: (options?: { personaId?: string }) => string;
  selectChat: (id: string) => void;
  deleteChat: (id: string) => void;
  renameChat: (id: string, newTitle: string) => void;

  // Personas Management State
  personas: Persona[];
  activePersonaId: string;
  defaultPersonaId: string;
  fetchPersonas: () => void;
  setActivePersonaId: (id: string) => void;
  setDefaultPersonaId: (id: string) => void;
  savePersona: (personaData: {
    id?: string;
    name: string;
    description: string;
    avatar?: string;
    systemInstructions: string;
    personalityTraits?: string[];
    communicationStyle?: Persona['communicationStyle'];
    responsePreferences?: Persona['responsePreferences'];
    behavioralRules?: string[];
    responseStructure?: string;
    greetingMessage?: string;
  }) => Persona;
  duplicatePersona: (id: string, newName?: string) => Persona;
  deletePersona: (id: string) => boolean;
}

const personaManager = new PersonaManager();

const getInitialThemePreference = (): 'dark' | 'light' | 'system' => {
  if (typeof window !== 'undefined' && window.localStorage) {
    const savedPref = localStorage.getItem('zaylo_theme_preference');
    if (savedPref === 'light' || savedPref === 'dark' || savedPref === 'system') {
      return savedPref;
    }
    const savedTheme = localStorage.getItem('zaylo_theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }
  }
  return 'dark';
};

const getInitialTheme = (): 'dark' | 'light' => {
  const pref = getInitialThemePreference();
  let resolved: 'dark' | 'light' = 'dark';
  if (pref === 'system' && typeof window !== 'undefined' && window.matchMedia) {
    const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    resolved = systemIsDark ? 'dark' : 'light';
  } else if (pref === 'light' || pref === 'dark') {
    resolved = pref;
  }
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    document.documentElement.classList.toggle('light', resolved === 'light');
  }
  return resolved;
};

const PLAYGROUND_STORAGE_KEY = 'zaylo_playground_conversations_v3';

function loadStoredConversations(initialPersonaId?: string): { conversations: PlaygroundConversation[]; activeConvId: string } {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = localStorage.getItem(PLAYGROUND_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return {
            conversations: parsed,
            activeConvId: parsed[0].id,
          };
        }
      }
    } catch {
      // Ignored
    }
  }
  const initialId = `conv_${Date.now()}`;
  const initialConv: PlaygroundConversation = {
    id: initialId,
    title: 'New Chat',
    modelId: '',
    modelName: '',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    personaId: initialPersonaId || 'persona_general',
  };
  const sample1: PlaygroundConversation = {
    id: 'conv_sample_sql',
    title: 'SQL Optimization',
    modelId: '',
    modelName: '',
    messages: [
      { role: 'user', content: 'How do I optimize complex SQLite joins with indexing?' },
      { role: 'assistant', content: 'To optimize complex SQLite joins with indexing, follow these key strategies:\n\n1. **Create Composite Indexes**: Index foreign keys used in `JOIN ON` conditions.\n2. **Run `EXPLAIN QUERY PLAN`**: Verify whether SQLite is using an indexed search or table scan.\n3. **Analyze Statistics**: Run `ANALYZE;` periodically to populate `sqlite_stat1` for the query optimizer.' }
    ],
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 3500000,
    personaId: 'persona_developer',
  };
  const sample2: PlaygroundConversation = {
    id: 'conv_sample_db',
    title: 'SQLite vs PostgreSQL',
    modelId: '',
    modelName: '',
    messages: [
      { role: 'user', content: 'What are the architectural trade-offs between embedded SQLite and PostgreSQL for local AI apps?' },
      { role: 'assistant', content: 'When comparing SQLite and PostgreSQL for local AI applications:\n\n- **SQLite**: Zero configuration, single-file storage, extremely low latency for single-process embedded apps. Perfect for local vector stores with `sqlite-vec`.\n- **PostgreSQL**: Robust concurrency, rich data types (`pgvector`), and advanced connection pooling. Ideal for multi-user local network deployments.' }
    ],
    createdAt: Date.now() - 7200000,
    updatedAt: Date.now() - 7100000,
    personaId: 'persona_analyst',
  };
  const sample3: PlaygroundConversation = {
    id: 'conv_sample_rag',
    title: 'Local RAG Setup',
    modelId: '',
    modelName: '',
    messages: [
      { role: 'user', content: 'How does Zaylo index local markdown files for RAG retrieval?' },
      { role: 'assistant', content: 'Zaylo processes local markdown documents through a 3-stage pipeline:\n\n1. **Chunking**: Text is split into semantic paragraphs with configurable chunk overlap.\n2. **Embedding**: Chunks are embedded locally using the integrated embedding model.\n3. **Cosine Similarity Search**: At query time, top-$k$ nearest chunks are injected directly into the persona prompt context.' }
    ],
    createdAt: Date.now() - 10800000,
    updatedAt: Date.now() - 10700000,
    personaId: 'persona_researcher',
  };
  return {
    conversations: [initialConv, sample1, sample2, sample3],
    activeConvId: initialId,
  };
}

const initialConvsData = loadStoredConversations();

export const useAppStore = create<AppStore>((set, get) => ({
  activeTab: 'playground',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Conversations State & Actions
  conversations: initialConvsData.conversations,
  activeConvId: initialConvsData.activeConvId,
  isSidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  setConversations: (updater) => {
    set((state) => {
      const next = typeof updater === 'function' ? updater(state.conversations) : updater;
      try {
        localStorage.setItem(PLAYGROUND_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return { conversations: next };
    });
  },
  setActiveConvId: (id) => set({ activeConvId: id }),
  createNewChat: (options) => {
    const state = get();
    const newId = `conv_${crypto.randomUUID()}`;
    const initialPersona = PersonaResolver.resolve(options?.personaId || state.defaultPersonaId, state.personas, state.defaultPersonaId);
    const initialMessages: ChatMessage[] = initialPersona?.greetingMessage
      ? [{ role: 'assistant', content: initialPersona.greetingMessage }]
      : [];
    const newConv: PlaygroundConversation = {
      id: newId,
      title: 'New Chat',
      modelId: state.selectedModel || '',
      modelName: state.selectedModel || '',
      messages: initialMessages,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      personaId: initialPersona?.id,
    };
    const nextConvs = [newConv, ...state.conversations];
    try {
      localStorage.setItem(PLAYGROUND_STORAGE_KEY, JSON.stringify(nextConvs));
    } catch {}
    set({
      conversations: nextConvs,
      activeConvId: newId,
      activePersonaId: initialPersona?.id || state.defaultPersonaId,
      activeTab: 'playground',
    });
    if (state.loftyDbStatus?.connected) {
      void api.invoke('memory:save-conversation', newConv).catch(() => {});
    }
    return newId;
  },
  selectChat: (id) => {
    set({ activeConvId: id, activeTab: 'playground' });
  },
  deleteChat: (id) => {
    const wasConnected = Boolean(get().loftyDbStatus?.connected);
    set((state) => {
      const remaining = state.conversations.filter((c) => c.id !== id);
      let nextActive = state.activeConvId;
      if (state.activeConvId === id) {
        nextActive = remaining[0]?.id || `conv_${Date.now()}`;
        if (remaining.length === 0) {
          const freshConv: PlaygroundConversation = {
            id: nextActive,
            title: 'New Chat',
            modelId: state.selectedModel || '',
            modelName: state.selectedModel || '',
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            personaId: state.activePersonaId,
          };
          remaining.push(freshConv);
        }
      }
      try {
        localStorage.setItem(PLAYGROUND_STORAGE_KEY, JSON.stringify(remaining));
      } catch {}
      return {
        conversations: remaining,
        activeConvId: nextActive,
      };
    });
    if (wasConnected) {
      void api.invoke('memory:delete-conversation', { id }).catch(() => {});
    }
  },
  renameChat: (id, newTitle) => {
    let renamedConv: PlaygroundConversation | undefined;
    set((state) => {
      const updated = state.conversations.map((c) => {
        if (c.id === id) {
          renamedConv = { ...c, title: newTitle, updatedAt: Date.now() };
          return renamedConv;
        }
        return c;
      });
      try {
        localStorage.setItem(PLAYGROUND_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return { conversations: updated };
    });
    if (renamedConv && get().loftyDbStatus?.connected) {
      void api.invoke('memory:save-conversation', renamedConv).catch(() => {});
    }
  },

  theme: getInitialTheme(),
  themePreference: getInitialThemePreference(),
  setTheme: (theme) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('zaylo_theme', theme);
    }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.classList.toggle('dark', theme === 'dark');
      document.documentElement.classList.toggle('light', theme === 'light');
    }
    set({ theme });
  },
  setThemePreference: (pref) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('zaylo_theme_preference', pref);
    }
    let resolvedTheme: 'dark' | 'light' = 'dark';
    if (pref === 'system') {
      if (typeof window !== 'undefined' && window.matchMedia) {
        resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
    } else {
      resolvedTheme = pref;
    }
    get().setTheme(resolvedTheme);
    set({ themePreference: pref });
  },
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
    set({ themePreference: next });
  },

  showOnboarding: false,
  setShowOnboarding: (show) => set({ showOnboarding: show }),

  serverState: 'STOPPED',
  serverConfig: undefined,
  availableModels: [],
  installedModels: [],
  fineTunedModels: [],
  downloads: {},
  metricHistory: [],
  logs: [],
  devices: [],
  apiKeys: [],

  // Personas State & Actions
  personas: personaManager.getAllPersonas(),
  activePersonaId: personaManager.getActivePersona().id,
  defaultPersonaId: personaManager.getDefaultPersona().id,

  fetchPersonas: () => {
    personaManager.reload();
    set({
      personas: personaManager.getAllPersonas(),
      activePersonaId: personaManager.getActivePersona().id,
      defaultPersonaId: personaManager.getDefaultPersona().id,
    });
  },

  setActivePersonaId: (id) => {
    personaManager.setActivePersona(id);
    set({ activePersonaId: id });
    const state = get();
    const active = state.conversations.find(chat => chat.id === state.activeConvId);
    if (active && active.personaId !== id) {
      get().setConversations(previous => previous.map(chat => chat.id === active.id ? { ...chat, personaId: id, updatedAt: Date.now() } : chat));
    }
  },

  setDefaultPersonaId: (id) => {
    personaManager.setDefaultPersona(id);
    set({
      defaultPersonaId: id,
      personas: personaManager.getAllPersonas(),
    });
  },

  savePersona: (personaData) => {
    let saved: Persona;
    if (personaData.id && personaManager.getPersona(personaData.id)) {
      const existing = personaManager.getPersona(personaData.id)!;
      if (existing.isBuiltIn) {
        // Built-ins are protected presets; clone changes into a new custom persona
        saved = personaManager.createPersona({
          ...personaData,
          name: personaData.name || `Custom ${existing.name}`,
        });
      } else {
        saved = personaManager.updatePersona(personaData.id, personaData);
      }
    } else {
      saved = personaManager.createPersona(personaData);
    }
    set({ personas: personaManager.getAllPersonas() });
    return saved;
  },

  duplicatePersona: (id, newName) => {
    const dup = personaManager.duplicatePersona(id, newName);
    set({ personas: personaManager.getAllPersonas() });
    return dup;
  },

  deletePersona: (id) => {
    const ok = personaManager.deletePersona(id);
    if (ok) {
      set({
        personas: personaManager.getAllPersonas(),
        activePersonaId: personaManager.getActivePersona().id,
        defaultPersonaId: personaManager.getDefaultPersona().id,
      });
    }
    return ok;
  },

  // Playground Defaults
  playgroundMessages: [
    { role: 'assistant', content: 'Hello! I am your private local AI assistant running on this server. How can I help you today?' },
  ],
  isGenerating: false,
  systemPrompt: 'You are a helpful, fast, and accurate local AI assistant.',
  temperature: 0.7,
  topP: 0.9,
  selectedModel: '',
  setSystemPrompt: (prompt) => set({ systemPrompt: prompt }),
  setTemperature: (t) => set({ temperature: t }),
  setTopP: (p) => set({ topP: p }),
  setSelectedModel: (m) => set({ selectedModel: m }),

  // RAG & Knowledge State
  ragEnabled: false,
  ragDocuments: [],
  pendingImage: undefined,
  setRagEnabled: (enabled) => set({ ragEnabled: enabled }),
  setPendingImage: (img) => set({ pendingImage: img }),

  fetchRagDocuments: async () => {
    try {
      const docs = await api.invoke('rag:list-documents', undefined);
      set({ ragDocuments: docs || [] });
    } catch (err) {
      console.error('Failed to fetch rag documents:', err);
    }
  },

  addRagDocument: async (name, content, type = 'txt') => {
    const doc = await api.invoke('rag:add-document', { name, content, type });
    await get().fetchRagDocuments();
    return doc;
  },

  deleteRagDocument: async (id) => {
    await api.invoke('rag:delete-document', { id });
    await get().fetchRagDocuments();
  },

  // LoftyDB Engine & Long-Term Memory State & Actions
  loftyDbConfig: undefined,
  loftyDbStatus: undefined,
  loftyDbLogs: [],
  memoryEnabled: true,
  memories: [],
  setMemoryEnabled: (enabled) => set({ memoryEnabled: enabled }),
  setLoftyDbStatus: (status) => {
    const wasConnected = Boolean(get().loftyDbStatus?.connected);
    set({
      loftyDbStatus: status,
      loftyDbLogs: status.logs || get().loftyDbLogs,
    });
    if (!wasConnected && status.connected) {
      void get().fetchMemories();
      void get().syncConversationsWithLoftyDb();
    }
  },
  appendLoftyDbLog: (line) => {
    set((state) => ({
      loftyDbLogs: [...state.loftyDbLogs, line].slice(-200),
    }));
  },
  fetchLoftyDbState: async () => {
    try {
      const [config, status] = await Promise.all([
        api.invoke('loftydb:get-config', undefined),
        api.invoke('loftydb:get-status', undefined),
      ]);
      if (config) {
        set({
          loftyDbConfig: config,
          memoryEnabled: config.memoryEnabled,
        });
      }
      if (status) {
        get().setLoftyDbStatus(status);
      }
    } catch (err) {
      console.error('Failed to fetch LoftyDB state:', err);
    }
  },
  updateLoftyDbConfig: async (patch) => {
    const updated = await api.invoke('loftydb:update-config', patch);
    set({
      loftyDbConfig: updated,
      memoryEnabled: updated.memoryEnabled,
    });
    await get().fetchLoftyDbState();
    return updated;
  },
  startLoftyDb: async () => {
    const status = await api.invoke('loftydb:start', undefined);
    get().setLoftyDbStatus(status);
    return status;
  },
  stopLoftyDb: async () => {
    const status = await api.invoke('loftydb:stop', undefined);
    get().setLoftyDbStatus(status);
    return status;
  },
  fetchMemories: async () => {
    if (!get().loftyDbStatus?.connected) return;
    try {
      const list = await api.invoke('memory:list', undefined);
      set({ memories: Array.isArray(list) ? list : [] });
    } catch (err) {
      console.error('Failed to fetch LoftyDB memories:', err);
    }
  },
  saveMemory: async (input) => {
    const saved = await api.invoke('memory:save', input);
    await get().fetchMemories();
    return saved;
  },
  deleteMemory: async (id) => {
    await api.invoke('memory:delete', { id });
    await get().fetchMemories();
  },
  syncConversationsWithLoftyDb: async () => {
    if (!get().loftyDbStatus?.connected) return;
    try {
      const localConvs = get().conversations;
      const merged = await api.invoke('memory:sync-conversations', { conversations: localConvs });
      if (Array.isArray(merged) && merged.length > 0) {
        const activeId = get().activeConvId;
        const resolvedActiveId = merged.some((c) => c.id === activeId) ? activeId : merged[0].id;
        try {
          localStorage.setItem(PLAYGROUND_STORAGE_KEY, JSON.stringify(merged));
        } catch {}
        set({
          conversations: merged,
          activeConvId: resolvedActiveId,
        });
      }
    } catch (err) {
      console.error('Failed to sync conversations with LoftyDB:', err);
    }
  },
  persistConversationToLoftyDb: async (conv) => {
    if (!get().loftyDbStatus?.connected) return;
    try {
      await api.invoke('memory:save-conversation', conv);
    } catch (err) {
      console.warn('Failed to persist conversation to LoftyDB:', err);
    }
  },

  // Image Generation State & Actions
  imageHistory: [],
  activeImageJob: null,
  isGeneratingImage: false,
  imageProgress: undefined,

  fetchImageHistory: async () => {
    try {
      const history = await api.invoke('image:list-history', undefined);
      set({ imageHistory: history || [] });
    } catch (err) {
      console.error('Failed to fetch image generation history:', err);
    }
  },

  generateImage: async (params) => {
    set({
      isGeneratingImage: true,
      imageProgress: {
        step: 0,
        totalSteps: params.params.steps || 20,
        percentage: 0,
        elapsedSeconds: 0,
        statusMessage: 'Starting generation...',
      },
    });
    try {
      const res = await api.invoke('image:generate', params);
      return res.jobId;
    } catch (err) {
      set({ isGeneratingImage: false, imageProgress: undefined });
      throw err;
    }
  },

  cancelImageGeneration: async (jobId) => {
    const ok = await api.invoke('image:cancel', { jobId });
    set({ isGeneratingImage: false, imageProgress: undefined });
    return ok;
  },

  deleteGeneratedImage: async (imageId) => {
    await api.invoke('image:delete', { imageId });
    await get().fetchImageHistory();
  },

  saveImageAs: async (imagePath, defaultName) => {
    return api.invoke('image:save-as', { imagePath, defaultName });
  },

  openImageFolder: async (imagePath) => {
    return api.invoke('image:open-folder', { imagePath });
  },

  setImageProgress: (progress) => set({ imageProgress: progress }),
  setActiveImageJob: (job) => set({ activeImageJob: job }),
  setIsGeneratingImage: (isGenerating) => set({ isGeneratingImage: isGenerating }),

  fetchHardware: async () => {
    try {
      const [hardware, capabilities] = await Promise.all([
        api.invoke('hardware:get-profile', undefined),
        api.invoke('hardware:get-capabilities', undefined),
      ]);
      set({ hardware, capabilities });
    } catch (err) {
      console.error('Failed to fetch hardware profile:', err);
    }
  },

  fetchServerState: async () => {
    try {
      const [stateRes, config] = await Promise.all([
        api.invoke('server:get-state', undefined),
        api.invoke('server:get-config', undefined),
      ]);
      set({
        serverState: stateRes.state,
        serverInstance: stateRes.instance,
        lanAddress: stateRes.lanAddress,
        serverConfig: config,
      });
      if (stateRes.instance?.modelName && !get().selectedModel) {
        set({ selectedModel: stateRes.instance.modelName });
      }
    } catch (err) {
      console.error('Failed to fetch server state:', err);
    }
  },

  startServer: async (modelId, variantId) => {
    try {
      set({ serverState: 'STARTING' });
      await api.invoke('server:start', { modelId, variantId });
      await get().fetchServerState();
    } catch (err) {
      console.error('Failed to start server:', err);
      await get().fetchServerState();
      throw err;
    }
  },

  stopServer: async () => {
    try {
      set({ serverState: 'STOPPING' });
      await api.invoke('server:stop', undefined);
      await get().fetchServerState();
    } catch (err) {
      console.error('Failed to stop server:', err);
      await get().fetchServerState();
      throw err;
    }
  },

  restartServer: async () => {
    try {
      set({ serverState: 'STARTING' });
      await api.invoke('server:restart', undefined);
      await get().fetchServerState();
    } catch (err) {
      console.error('Failed to restart server:', err);
      await get().fetchServerState();
      throw err;
    }
  },

  updateServerConfig: async (config) => {
    try {
      const updated = await api.invoke('server:update-config', config);
      set({ serverConfig: updated });
    } catch (err) {
      console.error('Failed to update config:', err);
      throw err;
    }
  },

  fetchModels: async () => {
    try {
      const [available, installed, downloadsList, fineTuned] = await Promise.all([
        api.invoke('models:list-available', undefined),
        api.invoke('models:list-installed', undefined),
        api.invoke('models:get-downloads', undefined),
        api.invoke('forge:list-fine-tuned-models', undefined).catch(() => []),
      ]);
      const dlMap: Record<string, DownloadProgress> = {};
      for (const d of downloadsList || []) {
        dlMap[d.id] = d;
      }
      set({
        availableModels: available || [],
        installedModels: installed || [],
        fineTunedModels: fineTuned || [],
        downloads: dlMap,
      });
    } catch (err) {
      console.error('Failed to fetch models:', err);
    }
  },

  downloadModel: async (modelId, variantId, downloadUrl, name) => {
    const res = await api.invoke('models:download', { modelId, variantId, downloadUrl, name });
    return res.downloadId;
  },

  setDownloadProgress: (progress) => {
    set((state) => ({
      downloads: {
        ...state.downloads,
        [progress.id]: progress,
      },
    }));
  },

  removeDownload: (downloadId) => {
    set((state) => {
      const next = { ...state.downloads };
      delete next[downloadId];
      return { downloads: next };
    });
  },

  cancelDownload: async (downloadId) => {
    // Immediately remove from UI state
    set((state) => {
      const next = { ...state.downloads };
      delete next[downloadId];
      return { downloads: next };
    });
    try {
      await api.invoke('models:cancel-download', { downloadId });
    } catch (err) {
      console.warn('Failed to cancel download:', err);
    }
  },

  deleteModel: async (installationId) => {
    await api.invoke('models:delete', { installationId });
    await get().fetchModels();
  },

  deleteFineTunedModel: async (artifactId) => {
    await api.invoke('forge:delete-artifact', { artifactId });
    await get().fetchModels();
  },

  importLocalModel: async (filePath, name) => {
    const inst = await api.invoke('models:import-local', { filePath, name });
    if (inst) {
      await get().fetchModels();
    }
    return inst;
  },

  updateMetric: (sample) => {
    set((state) => {
      const history = [...state.metricHistory, sample];
      if (history.length > 60) history.shift();
      return { currentMetric: sample, metricHistory: history };
    });
  },

  addLog: (log) => {
    set((state) => ({
      logs: [log, ...state.logs].slice(0, 300),
    }));
  },

  fetchLogs: async () => {
    try {
      const logs = await api.invoke('logs:get-recent', { limit: 100 });
      set({ logs: logs || [] });
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  },

  clearLogs: async () => {
    await api.invoke('logs:clear', undefined);
    set({ logs: [] });
  },

  fetchDevicesAndKeys: async () => {
    try {
      const [devices, apiKeys] = await Promise.all([
        api.invoke('devices:list', undefined),
        api.invoke('keys:list', undefined),
      ]);

      // If no active keys exist, auto-create a default primary key on startup
      if (!apiKeys || apiKeys.filter((k: any) => !k.isRevoked).length === 0) {
        const created = await api.invoke('keys:create', { name: 'Default Primary Key' });
        if (created?.rawKey) {
          localStorage.setItem('default_raw_api_key', created.rawKey);
        }
        const refreshedKeys = await api.invoke('keys:list', undefined);
        set({ devices: devices || [], apiKeys: refreshedKeys || [] });
      } else {
        set({ devices: devices || [], apiKeys: apiKeys || [] });
      }
    } catch (err) {
      console.error('Failed to fetch devices and keys:', err);
    }
  },

  createKey: async (name) => {
    const res = await api.invoke('keys:create', { name });
    if (res?.rawKey) {
      localStorage.setItem('default_raw_api_key', res.rawKey);
    }
    await get().fetchDevicesAndKeys();
    return res;
  },

  revokeKey: async (keyId) => {
    await api.invoke('keys:revoke', { keyId });
    await get().fetchDevicesAndKeys();
  },

  deleteKey: async (keyId) => {
    await api.invoke('keys:delete', { keyId });
    await get().fetchDevicesAndKeys();
  },

  revokeDevice: async (deviceId) => {
    await api.invoke('devices:revoke', { deviceId });
    await get().fetchDevicesAndKeys();
  },

  deleteDevice: async (deviceId) => {
    await api.invoke('devices:delete', { deviceId });
    await get().fetchDevicesAndKeys();
  },

  addPlaygroundMessage: (msg) => {
    set((state) => ({ playgroundMessages: [...state.playgroundMessages, msg] }));
  },

  updateLastAssistantMessage: (delta) => {
    set((state) => {
      const msgs = [...state.playgroundMessages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === 'assistant') {
        msgs[msgs.length - 1] = { ...last, content: last.content + delta };
      } else {
        msgs.push({ role: 'assistant', content: delta });
      }
      return { playgroundMessages: msgs };
    });
  },

  clearPlayground: () => {
    set({
      playgroundMessages: [],
      generationStats: undefined,
    });
  },

  sendChatMessage: async (content) => {
    const state = get();
    if (state.isGenerating || (!content.trim() && !state.pendingImage)) return;

    const attachedImage = state.pendingImage;
    const userMsg: ChatMessage = attachedImage
      ? {
          role: 'user',
          content: [
            { type: 'text', text: content.trim() || 'Describe and analyze this image.' },
            { type: 'image_url', image_url: { url: attachedImage.dataUrl } },
          ],
        }
      : { role: 'user', content: content.trim() };

    const activePersona = PersonaResolver.resolve(
      state.activePersonaId,
      state.personas,
      state.defaultPersonaId
    );

    const rawMsgs = [...state.playgroundMessages, userMsg];
    const allMsgs = PersonaPromptAdapter.augmentMessages(
      rawMsgs,
      activePersona,
      state.systemPrompt.trim() || undefined
    );

    set((s) => ({
      playgroundMessages: [...s.playgroundMessages, userMsg, { role: 'assistant', content: '' }],
      pendingImage: undefined,
      isGenerating: true,
      generationStats: undefined,
    }));

    const startTime = Date.now();
    let tokenCount = 0;

    try {
      const response = await api.invoke('inference:chat', {
        model: state.selectedModel || 'default',
        messages: allMsgs,
        temperature: state.temperature,
        top_p: state.topP,
        stream: false,
        rag: state.ragEnabled,
        memory: state.memoryEnabled && Boolean(state.loftyDbStatus?.connected),
        conversationId: state.activeConvId,
        personaId: activePersona?.id,
      });

      const endTime = Date.now();
      const rawContent = response.choices[0]?.message?.content;
      const contentOut = typeof rawContent === 'string'
        ? rawContent
        : (Array.isArray(rawContent) ? rawContent.map((p) => p.type === 'text' ? p.text : '').join('') : '');

      tokenCount = response.usage?.completion_tokens || Math.max(1, Math.ceil(contentOut.length / 4));
      const latencyMs = endTime - startTime;
      const tokPerSec = latencyMs > 0 ? (tokenCount / (latencyMs / 1000)) : 0;

      set((s) => {
        const msgs = [...s.playgroundMessages];
        msgs[msgs.length - 1] = { role: 'assistant', content: contentOut };
        return {
          playgroundMessages: msgs,
          isGenerating: false,
          generationStats: {
            latencyMs,
            tokensPerSec: parseFloat(tokPerSec.toFixed(1)),
            tokenCount,
          },
        };
      });
    } catch (err: any) {
      const rawError = err?.message || 'Inference request failed';
      let friendlyError = `[Error: ${rawError}]`;

      if (rawError.includes('image input is not supported') || rawError.includes('mmproj')) {
        const activeName = state.selectedModel || 'The active model';
        friendlyError = `⚠️ **Vision Projector Required**\n\n**${activeName}** is running in text-only mode and does not have a multimodal projector (\`--mmproj\`) loaded to process images.\n\n**To chat with images:**\n1. Open the **Models** tab in the left sidebar.\n2. Download a Vision model (such as **Qwen 2.5 VL 3B Instruct** or **SmolVLM 500M**).\n3. Start the server with the vision model—Zaylo will automatically attach the companion projector!`;
      }

      set((s) => {
        const msgs = [...s.playgroundMessages];
        msgs[msgs.length - 1] = {
          role: 'assistant',
          content: friendlyError,
        };
        return {
          playgroundMessages: msgs,
          isGenerating: false,
        };
      });
    }
  },

  stopGeneration: () => {
    const requestId = get().activeRequestId;
    if (requestId) {
      api.invoke('inference:abort', { requestId });
    }
    set({ isGenerating: false });
  },
}));
