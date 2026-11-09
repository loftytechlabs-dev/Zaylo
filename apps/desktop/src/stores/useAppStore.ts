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
} from '@local-ai/shared';
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
  if (pref === 'system' && typeof window !== 'undefined' && window.matchMedia) {
    const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const resolved = systemIsDark ? 'dark' : 'light';
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', resolved);
    }
    return resolved;
  }
  if (pref === 'light' || pref === 'dark') {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', pref);
    }
    return pref;
  }
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
  return 'dark';
};

export const useAppStore = create<AppStore>((set, get) => ({
  activeTab: 'overview',
  setActiveTab: (tab) => set({ activeTab: tab }),

  theme: getInitialTheme(),
  themePreference: getInitialThemePreference(),
  setTheme: (theme) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('zaylo_theme', theme);
    }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
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
    try {
      const saved = localStorage.getItem('zaylo_playground_conversations_v3');
      if (saved) {
        const convs = JSON.parse(saved);
        if (Array.isArray(convs) && convs.length > 0) {
          convs[0].personaId = id;
          localStorage.setItem('zaylo_playground_conversations_v3', JSON.stringify(convs));
        }
      }
    } catch {
      // Ignored
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
