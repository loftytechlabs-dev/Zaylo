import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { api } from '../../api/client';
import type {
  ChatMessage,
  FineTunedModelArtifact,
  ChatCompletionResponse,
  GeneratedImage,
  ImageGenerationParams,
} from '@local-ai/shared';
import { ModelCapabilityRegistry } from '@local-ai/capabilities';
import type {
  PlaygroundConversation,
  GenerationSettings,
  UnifiedModelOption,
  InferenceGenerationStats,
  CompareRunResult,
} from './types';
import { PlaygroundToolbar } from './components/PlaygroundToolbar';
import { ConversationArea } from './components/ConversationArea';
import { MessageComposer } from './components/MessageComposer';
import { PerformancePanel } from './components/PerformancePanel';
import { SettingsDrawer } from './components/SettingsDrawer';
import { HistoryDrawer } from './components/HistoryDrawer';
import { CompareView } from './components/CompareView';
import { RagSelectorModal } from './components/RagSelectorModal';
import { ImagePlaygroundArea } from './components/ImagePlaygroundArea';
import { ImagePromptComposer } from './components/ImagePromptComposer';
import { ImageLightboxModal } from './components/ImageLightboxModal';

const DEFAULT_SETTINGS: GenerationSettings = {
  systemPrompt: 'You are a helpful, fast, and accurate local AI assistant.',
  temperature: 0.7,
  topP: 0.9,
  maxTokens: 1024,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0,
  stopSequences: [],
};

const STORAGE_KEY = 'zaylo_playground_conversations_v3';
const SETTINGS_KEY = 'zaylo_playground_settings_v3';

export const PlaygroundView: React.FC = () => {
  const {
    availableModels,
    installedModels,
    serverState,
    serverInstance,
    serverConfig,
    currentMetric,
    ragEnabled,
    ragDocuments,
    pendingImage,
    startServer,
    setRagEnabled,
    setPendingImage,
    fetchRagDocuments,
    addRagDocument,
    deleteRagDocument,
    imageHistory,
    isGeneratingImage,
    activeImageJob,
    imageProgress,
    generateImage,
    cancelImageGeneration,
    deleteGeneratedImage,
    saveImageAs,
    openImageFolder,
    fetchImageHistory,
    selectedModel,
    setSelectedModel,
  } = useAppStore();

  // Fine-Tuned Models from Forge
  const [forgeArtifacts, setForgeArtifacts] = useState<FineTunedModelArtifact[]>([]);

  // Image Lightbox & Inspiration State
  const [lightboxImage, setLightboxImage] = useState<GeneratedImage | null>(null);
  const [selectedInspirationPrompt, setSelectedInspirationPrompt] = useState<string>('');
  const [canvasSessionTime, setCanvasSessionTime] = useState<number>(() => Date.now());
  const [composerResetTrigger, setComposerResetTrigger] = useState<number>(0);

  // Generation Settings State
  const [settings, setSettings] = useState<GenerationSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {
      // Ignored
    }
    return DEFAULT_SETTINGS;
  });

  // Conversations State
  const [conversations, setConversations] = useState<PlaygroundConversation[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Ignored
    }
    const initialId = `conv_${Date.now()}`;
    return [
      {
        id: initialId,
        title: 'New Chat',
        modelId: '',
        modelName: '',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
  });

  const [activeConvId, setActiveConvId] = useState<string>(() => conversations[0]?.id || `conv_${Date.now()}`);

  // Selected Model ID
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [isLoadingModel, setIsLoadingModel] = useState<boolean>(false);
  const [isStartingServer, setIsStartingServer] = useState<boolean>(false);

  // Streaming & Generation State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [liveStats, setLiveStats] = useState<{
    tokensPerSec: number;
    tokenCount: number;
    latencyMs: number;
    timeToFirstTokenMs?: number;
    promptTokens?: number;
  }>({ tokensPerSec: 0, tokenCount: 0, latencyMs: 0 });

  // RAG Document Selection
  const [selectedRagDocIds, setSelectedRagDocIds] = useState<string[]>([]);
  const [isRagModalOpen, setIsRagModalOpen] = useState<boolean>(false);

  // Drawers Visibility
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isPerformanceOpen, setIsPerformanceOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isCompareMode, setIsCompareMode] = useState<boolean>(false);

  // Compare Mode History
  const [compareHistory, setCompareHistory] = useState<CompareRunResult[]>([]);
  const [isComparing, setIsComparing] = useState<boolean>(false);

  // Refs for streaming token accumulation
  const activeStreamContentRef = useRef<string>('');
  const streamTokenCountRef = useRef<number>(0);
  const streamStartTimeRef = useRef<number>(0);
  const firstTokenTimeRef = useRef<number | null>(null);

  // Load Forge Artifacts & Documents
  const loadForgeArtifacts = useCallback(async () => {
    try {
      const artifacts = await api.invoke('forge:list-fine-tuned-models', undefined);
      setForgeArtifacts(artifacts || []);
    } catch (err) {
      console.error('Failed to load forge artifacts:', err);
    }
  }, []);

  useEffect(() => {
    fetchRagDocuments();
    loadForgeArtifacts();
    fetchImageHistory();
  }, [fetchRagDocuments, loadForgeArtifacts, fetchImageHistory]);

  // Persist conversations
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch {
      // Ignored
    }
  }, [conversations]);

  // Persist settings
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Ignored
    }
  }, [settings]);

  // Build Unified Model List (Installed Models + Image Models + Forge LoRA Adapters)
  const unifiedModels: UnifiedModelOption[] = React.useMemo(() => {
    const list: UnifiedModelOption[] = [];

    // 1. Installed models (Text, Vision, and Image)
    for (const inst of installedModels) {
      const taskType = inst.taskType || ModelCapabilityRegistry.resolveTaskType(inst);
      const isImage = taskType === 'image-generation';
      list.push({
        id: inst.id,
        name: inst.name,
        type: 'base',
        taskType,
        isImageModel: isImage,
        imageProfile: isImage ? ModelCapabilityRegistry.getProfile(inst.modelId || inst.id) : undefined,
        format: inst.format,
        quantization: inst.quantization,
        localPath: inst.localPath,
        isLoaded: Boolean(inst.isLoaded || serverInstance?.modelName === inst.name),
        isVisionSupported: Boolean(inst.mmprojPath || taskType === 'vision'),
        rawInstallation: inst,
      });
    }

    // 2. Curated Image Generation Models from catalog
    for (const avail of availableModels) {
      if (ModelCapabilityRegistry.isImageGenerationModel(avail)) {
        if (!list.some((item) => item.id === avail.id || item.rawInstallation?.modelId === avail.id)) {
          const profile = ModelCapabilityRegistry.getProfile(avail.id);
          list.push({
            id: avail.id,
            name: avail.name,
            type: 'base',
            taskType: 'image-generation',
            isImageModel: true,
            imageProfile: profile,
            format: avail.variants[0]?.format || 'safetensors',
            quantization: avail.variants[0]?.quantization || 'F16',
            isLoaded: false,
            isVisionSupported: false,
          });
        }
      }
    }

    // 3. Fine-tuned models & adapters from Forge
    for (const art of forgeArtifacts) {
      list.push({
        id: art.id,
        name: art.name,
        type: art.type === 'lora' ? 'adapter' : 'standalone',
        taskType: 'text-generation',
        isImageModel: false,
        baseModelId: art.baseModelId,
        baseModelName: art.baseModelName,
        adapterPath: art.artifactPath,
        localPath: art.artifactPath,
        format: art.format,
        isLoaded: false,
        isVisionSupported: false,
        rawArtifact: art,
      });
    }

    return list;
  }, [installedModels, availableModels, forgeArtifacts, serverInstance]);

  // Sync selected model with global store (e.g. from Models view "Open in Playground") or server
  useEffect(() => {
    if (unifiedModels.length === 0) return;

    if (selectedModel) {
      // Find matching model from store
      const match = unifiedModels.find(
        (m) =>
          m.id === selectedModel ||
          m.rawInstallation?.modelId === selectedModel ||
          m.rawInstallation?.id === selectedModel ||
          m.name.toLowerCase() === selectedModel.toLowerCase() ||
          m.rawInstallation?.name?.toLowerCase() === selectedModel.toLowerCase()
      );
      if (match) {
        if (selectedModelId !== match.id) {
          setSelectedModelId(match.id);
        }
        return;
      }
    }

    if (!selectedModelId) {
      const loaded = unifiedModels.find((m) => m.isLoaded);
      const initial = loaded || unifiedModels[0];
      setSelectedModelId(initial.id);
      setSelectedModel(initial.name);
    }
  }, [selectedModel, unifiedModels, selectedModelId, setSelectedModel]);

  // Current active conversation
  const activeConv = conversations.find((c) => c.id === activeConvId) || conversations[0];
  const activeModel = unifiedModels.find((m) => m.id === selectedModelId) || unifiedModels[0];

  // Handle Model Switching
  const handleSelectModel = async (modelId: string) => {
    setSelectedModelId(modelId);
    const target = unifiedModels.find((m) => m.id === modelId);
    if (!target) return;

    // Keep global store in sync so Header and other views immediately reflect active model
    setSelectedModel(target.name);

    if (target.isImageModel) {
      // Image model selected: do not disrupt active text server
      return;
    }

    // Update active conversation's model metadata
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConvId
          ? {
              ...c,
              modelId: target.id,
              modelName: target.name,
              isAdapter: target.type === 'adapter',
              adapterPath: target.adapterPath,
              updatedAt: Date.now(),
            }
          : c
      )
    );

    // If it's a base GGUF model and server is running, switch it
    if (target.type === 'base' && target.rawInstallation) {
      setIsLoadingModel(true);
      try {
        if (serverState === 'RUNNING') {
          await api.invoke('server:load-model', { modelId: target.rawInstallation.id });
        } else {
          await startServer(target.rawInstallation.modelId, target.rawInstallation.variantId);
        }
      } catch (err: any) {
        console.error('Failed to switch model:', err);
      } finally {
        setIsLoadingModel(false);
      }
    }
  };

  // Handle Image Generation
  const handleGenerateImage = async (params: ImageGenerationParams) => {
    try {
      await generateImage({
        modelId: activeModel.rawInstallation?.modelId || activeModel.id,
        modelName: activeModel.name,
        modelPath: activeModel.localPath || activeModel.rawInstallation?.localPath,
        params,
      });
    } catch (err: any) {
      alert(`Image generation failed: ${err.message}`);
    }
  };

  const handleCancelImage = async () => {
    await cancelImageGeneration(activeImageJob?.id || '');
  };

  // Start Server handler
  const handleStartServer = async () => {
    setIsStartingServer(true);
    try {
      const target = activeModel?.rawInstallation || installedModels[0];
      if (target) {
        await startServer(target.modelId, target.variantId);
      }
    } catch (err: any) {
      alert(`Failed to start server: ${err.message}`);
    } finally {
      setIsStartingServer(false);
    }
  };

  // Conversation & Canvas Management Handlers
  const handleNewChat = () => {
    if (activeModel?.isImageModel) {
      setCanvasSessionTime(Date.now());
      setSelectedInspirationPrompt('');
      setComposerResetTrigger((prev) => prev + 1);
      setIsHistoryOpen(false);
      return;
    }

    const newId = `conv_${Date.now()}`;
    const newConv: PlaygroundConversation = {
      id: newId,
      title: 'New Chat',
      modelId: activeModel?.id || '',
      modelName: activeModel?.name || '',
      isAdapter: activeModel?.type === 'adapter',
      adapterPath: activeModel?.adapterPath,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setConversations((prev) => [newConv, ...prev]);
    setActiveConvId(newId);
    setIsHistoryOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    const conv = conversations.find((c) => c.id === id);
    if (conv) {
      setActiveConvId(id);
      if (conv.modelId && unifiedModels.some((m) => m.id === conv.modelId)) {
        setSelectedModelId(conv.modelId);
      }
    }
    setIsHistoryOpen(false);
  };

  const handleRenameConversation = (id: string, newTitle: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: newTitle, updatedAt: Date.now() } : c))
    );
  };

  const handleDeleteConversation = (id: string) => {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (next.length === 0) {
        const freshId = `conv_${Date.now()}`;
        return [
          {
            id: freshId,
            title: 'New Chat',
            modelId: activeModel?.id || '',
            modelName: activeModel?.name || '',
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ];
      }
      return next;
    });

    if (activeConvId === id) {
      const remaining = conversations.filter((c) => c.id !== id);
      if (remaining.length > 0) {
        setActiveConvId(remaining[0].id);
      }
    }
  };

  const handleClearConversation = () => {
    if (!confirm('Clear all messages in this conversation?')) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === activeConvId ? { ...c, messages: [], updatedAt: Date.now() } : c))
    );
  };

  // Chat Submission & Streaming Execution
  const handleSendMessage = async (userText: string) => {
    if (isGenerating || (!userText.trim() && !pendingImage)) return;

    const attachedImage = pendingImage;
    const userMsg: ChatMessage = attachedImage
      ? {
          role: 'user',
          content: [
            { type: 'text', text: userText.trim() || 'Analyze this image.' },
            { type: 'image_url', image_url: { url: attachedImage.dataUrl } },
          ],
        }
      : { role: 'user', content: userText.trim() };

    setPendingImage(undefined);

    // Build message payload
    const existingMsgs = activeConv?.messages || [];
    const payloadMessages: ChatMessage[] = [];

    if (settings.systemPrompt.trim()) {
      payloadMessages.push({ role: 'system', content: settings.systemPrompt.trim() });
    }
    payloadMessages.push(...existingMsgs, userMsg);

    // Append user message + blank assistant message to conversation
    const updatedMessages: ChatMessage[] = [
      ...existingMsgs,
      userMsg,
      { role: 'assistant', content: '' },
    ];

    // Generate auto-title for conversation from first message if titled 'New Chat'
    const newTitle =
      activeConv.title === 'New Chat' && userText.trim()
        ? userText.trim().slice(0, 32) + (userText.trim().length > 32 ? '...' : '')
        : activeConv.title;

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConvId
          ? {
              ...c,
              title: newTitle,
              messages: updatedMessages,
              updatedAt: Date.now(),
            }
          : c
      )
    );

    setIsGenerating(true);
    activeStreamContentRef.current = '';
    streamTokenCountRef.current = 0;
    streamStartTimeRef.current = performance.now();
    firstTokenTimeRef.current = null;

    const reqId = `chatcmpl-${Date.now()}`;
    setActiveRequestId(reqId);

    // Listen to real streamed token chunks
    const unsubChunk = api.on('inference:chunk', (data: { requestId: string; chunk: ChatCompletionResponse }) => {
      const delta = data.chunk.choices[0]?.delta?.content;
      if (delta) {
        if (!firstTokenTimeRef.current) {
          firstTokenTimeRef.current = performance.now();
        }

        activeStreamContentRef.current += delta;
        streamTokenCountRef.current += 1;

        const now = performance.now();
        const durationSec = (now - (firstTokenTimeRef.current || streamStartTimeRef.current)) / 1000;
        const liveTokPerSec = durationSec > 0 ? streamTokenCountRef.current / durationSec : 0;
        const liveLatency = Math.round(now - streamStartTimeRef.current);
        const ttft = firstTokenTimeRef.current
          ? Math.round(firstTokenTimeRef.current - streamStartTimeRef.current)
          : undefined;

        setLiveStats({
          tokensPerSec: parseFloat(liveTokPerSec.toFixed(1)),
          tokenCount: streamTokenCountRef.current,
          latencyMs: liveLatency,
          timeToFirstTokenMs: ttft,
          promptTokens: Math.max(1, Math.ceil(userText.length / 4)),
        });

        // Update active assistant bubble in state
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== activeConvId) return c;
            const msgs = [...c.messages];
            if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
              msgs[msgs.length - 1] = {
                role: 'assistant',
                content: activeStreamContentRef.current,
              };
            }
            return { ...c, messages: msgs };
          })
        );
      }
    });

    try {
      const response = await api.invoke('inference:chat', {
        model: activeModel?.name || 'default',
        messages: payloadMessages,
        temperature: settings.temperature,
        top_p: settings.topP,
        max_tokens: settings.maxTokens,
        frequency_penalty: settings.frequencyPenalty,
        presence_penalty: settings.presencePenalty,
        stop: settings.stopSequences.length > 0 ? settings.stopSequences : undefined,
        stream: true,
        rag: ragEnabled,
        ragDocumentIds: selectedRagDocIds.length > 0 ? selectedRagDocIds : undefined,
      });

      const endTime = performance.now();
      const totalLatencyMs = Math.round(endTime - streamStartTimeRef.current);
      const ttftMs = firstTokenTimeRef.current
        ? Math.round(firstTokenTimeRef.current - streamStartTimeRef.current)
        : undefined;

      // Final response text
      const rawFinal = response?.choices[0]?.message?.content || activeStreamContentRef.current;
      const finalContent =
        typeof rawFinal === 'string'
          ? rawFinal
          : Array.isArray(rawFinal)
          ? rawFinal.map((p: any) => (p.type === 'text' ? p.text : '')).join('')
          : '';

      const completionTokens =
        response?.usage?.completion_tokens || Math.max(1, streamTokenCountRef.current || Math.ceil(finalContent.length / 4));
      const promptTokens =
        response?.usage?.prompt_tokens || Math.max(1, Math.ceil(userText.length / 4));

      const durationSec = (endTime - (firstTokenTimeRef.current || streamStartTimeRef.current)) / 1000;
      const finalTokensPerSec = durationSec > 0 ? parseFloat((completionTokens / durationSec).toFixed(1)) : 0;

      const finalStats: InferenceGenerationStats = {
        latencyMs: totalLatencyMs,
        tokensPerSec: finalTokensPerSec,
        tokenCount: completionTokens,
        timeToFirstTokenMs: ttftMs,
        promptTokens,
        totalDurationMs: totalLatencyMs,
      };

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== activeConvId) return c;
          const msgs = [...c.messages];
          if (msgs.length > 0) {
            msgs[msgs.length - 1] = {
              role: 'assistant',
              content: finalContent || activeStreamContentRef.current,
            };
          }
          return {
            ...c,
            messages: msgs,
            lastStats: finalStats,
            updatedAt: Date.now(),
          };
        })
      );
    } catch (err: any) {
      const rawError = err?.message || 'Inference request failed';
      let errorMsg = `[Error: ${rawError}]`;

      if (rawError.includes('image input is not supported') || rawError.includes('mmproj')) {
        errorMsg = `⚠️ **Vision Projector Required**\n\n**${activeModel?.name}** is running in text-only mode and does not have a multimodal projector loaded.\n\nTo chat with images, select a vision model in the model dropdown.`;
      }

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== activeConvId) return c;
          const msgs = [...c.messages];
          if (msgs.length > 0) {
            msgs[msgs.length - 1] = { role: 'assistant', content: errorMsg };
          }
          return { ...c, messages: msgs };
        })
      );
    } finally {
      unsubChunk?.();
      setIsGenerating(false);
      setActiveRequestId(null);
    }
  };

  // Stop active generation
  const handleStopGeneration = () => {
    if (activeRequestId) {
      api.invoke('inference:abort', { requestId: activeRequestId });
    }
    setIsGenerating(false);
  };

  // Regenerate last response
  const handleRegenerate = () => {
    const msgs = activeConv?.messages || [];
    if (msgs.length < 2) return;
    const lastUserIndex = [...msgs].reverse().findIndex((m) => m.role === 'user');
    if (lastUserIndex === -1) return;
    const realIndex = msgs.length - 1 - lastUserIndex;
    const lastUserMsg = msgs[realIndex];

    const promptText =
      typeof lastUserMsg.content === 'string'
        ? lastUserMsg.content
        : Array.isArray(lastUserMsg.content)
        ? (lastUserMsg.content.find((p) => p.type === 'text') as any)?.text || ''
        : '';

    // Remove the last assistant message
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConvId
          ? { ...c, messages: c.messages.slice(0, realIndex), updatedAt: Date.now() }
          : c
      )
    );

    handleSendMessage(promptText);
  };

  // Run Comparison Mode Execution
  const handleRunComparison = async (prompt: string) => {
    setIsComparing(true);
    try {
      const baseInst = installedModels[0];
      const ftArtifact = forgeArtifacts[0];

      if (!baseInst) {
        throw new Error('No base model installed to compare against.');
      }

      const res = await api.invoke('forge:compare-models', {
        baseModelPath: baseInst.localPath,
        adapterPath: ftArtifact?.artifactPath,
        prompt,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
      });

      setCompareHistory((prev) => [
        {
          prompt,
          baseResponse: res.baseResponse,
          baseLatencyMs: res.baseDurationMs,
          ftResponse: res.fineTunedResponse,
          ftLatencyMs: res.fineTunedDurationMs,
          timestamp: Date.now(),
        },
        ...prev,
      ]);
    } catch (err: any) {
      alert(`Comparison error: ${err.message}`);
    } finally {
      setIsComparing(false);
    }
  };

  const isVisionSupported = Boolean(activeModel?.isVisionSupported);

  return (
    <div className="flex h-full w-full bg-[#090a0c] text-zinc-100 overflow-hidden relative font-sans">
      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col min-w-0 justify-between overflow-hidden bg-[#090a0c]">
        {/* Top Toolbar */}
        <PlaygroundToolbar
          models={unifiedModels}
          selectedModelId={selectedModelId}
          onSelectModel={handleSelectModel}
          serverState={serverState}
          isLoadingModel={isLoadingModel}
          isGeneratingImage={isGeneratingImage}
          onNewChat={handleNewChat}
          onToggleHistory={() => {
            setIsHistoryOpen(!isHistoryOpen);
            setIsPerformanceOpen(false);
            setIsSettingsOpen(false);
          }}
          onTogglePerformance={() => {
            setIsPerformanceOpen(!isPerformanceOpen);
            setIsHistoryOpen(false);
            setIsSettingsOpen(false);
          }}
          onToggleSettings={() => {
            setIsSettingsOpen(!isSettingsOpen);
            setIsHistoryOpen(false);
            setIsPerformanceOpen(false);
          }}
          onToggleCompare={() => setIsCompareMode(!isCompareMode)}
          isHistoryOpen={isHistoryOpen}
          isPerformanceOpen={isPerformanceOpen}
          isSettingsOpen={isSettingsOpen}
          isCompareMode={isCompareMode}
          conversationCount={conversations.length}
        />

        {/* Workspace Canvas: Normal Conversation Area, Comparative View, or Image Generation Canvas */}
        {activeModel?.isImageModel ? (
          <>
            <ImagePlaygroundArea
              images={imageHistory}
              sessionStartTime={canvasSessionTime}
              isGenerating={isGeneratingImage}
              progress={imageProgress}
              selectedModel={activeModel}
              onSelectSuggestion={(prompt) => setSelectedInspirationPrompt(prompt)}
              onCancelGeneration={handleCancelImage}
              onSaveImageAs={saveImageAs}
              onOpenFolder={openImageFolder}
              onDeleteImage={deleteGeneratedImage}
              onOpenLightbox={(img) => setLightboxImage(img)}
              onRegenerate={(img) => setSelectedInspirationPrompt(img.prompt)}
              onResetCanvas={handleNewChat}
            />

            <ImagePromptComposer
              selectedModel={activeModel}
              isGenerating={isGeneratingImage}
              onGenerate={handleGenerateImage}
              onCancel={handleCancelImage}
              externalPrompt={selectedInspirationPrompt}
              onClearExternalPrompt={() => setSelectedInspirationPrompt('')}
              resetTrigger={composerResetTrigger}
            />

            {lightboxImage && (
              <ImageLightboxModal
                image={lightboxImage}
                onClose={() => setLightboxImage(null)}
                onSaveAs={saveImageAs}
                onOpenFolder={openImageFolder}
                onRegenerate={(img) => setSelectedInspirationPrompt(img.prompt)}
              />
            )}
          </>
        ) : isCompareMode ? (
          <CompareView
            baseModel={unifiedModels.find((m) => m.type === 'base')}
            fineTunedModel={unifiedModels.find((m) => m.type === 'adapter') || unifiedModels[0]}
            onRunComparison={handleRunComparison}
            isComparing={isComparing}
            history={compareHistory}
          />
        ) : (
          <>
            <ConversationArea
              messages={activeConv?.messages || []}
              isGenerating={isGenerating}
              selectedModel={activeModel}
              generationStats={activeConv?.lastStats}
              onSelectSuggestion={(prompt) => handleSendMessage(prompt)}
              onRegenerate={handleRegenerate}
              onRetry={handleRegenerate}
              onClearConversation={handleClearConversation}
            />

            {/* Bottom Message Composer */}
            <MessageComposer
              onSendMessage={handleSendMessage}
              onStopGeneration={handleStopGeneration}
              isGenerating={isGenerating}
              serverState={serverState}
              isVisionSupported={isVisionSupported}
              pendingImage={pendingImage}
              onSetPendingImage={setPendingImage}
              ragEnabled={ragEnabled}
              ragDocsCount={ragDocuments.length}
              onOpenRagModal={() => setIsRagModalOpen(true)}
              onStartServer={handleStartServer}
              isStartingServer={isStartingServer}
            />
          </>
        )}
      </div>

      {/* Right Drawer: Performance Panel */}
      {isPerformanceOpen && (
        <PerformancePanel
          stats={activeConv?.lastStats}
          liveStats={liveStats}
          systemMetric={currentMetric}
          contextLimit={serverConfig?.contextLimit || 4096}
          isGenerating={activeModel?.isImageModel ? isGeneratingImage : isGenerating}
          isImageModel={activeModel?.isImageModel}
          lastGeneratedImage={imageHistory[0]}
          onClose={() => setIsPerformanceOpen(false)}
        />
      )}

      {/* Right Drawer: Generation Settings */}
      {isSettingsOpen && (
        <SettingsDrawer
          settings={settings}
          onChange={(up) => setSettings((s) => ({ ...s, ...up }))}
          onReset={() => setSettings(DEFAULT_SETTINGS)}
          onClose={() => setIsSettingsOpen(false)}
          contextLimit={serverConfig?.contextLimit || 4096}
        />
      )}

      {/* Right Drawer: History */}
      {isHistoryOpen && (
        <HistoryDrawer
          conversations={conversations}
          activeId={activeConvId}
          onSelect={handleSelectConversation}
          onNewChat={handleNewChat}
          onRename={handleRenameConversation}
          onDelete={handleDeleteConversation}
          onClose={() => setIsHistoryOpen(false)}
        />
      )}

      {/* RAG Knowledge Selector Modal */}
      <RagSelectorModal
        isOpen={isRagModalOpen}
        onClose={() => setIsRagModalOpen(false)}
        ragEnabled={ragEnabled}
        onToggleRag={setRagEnabled}
        documents={ragDocuments}
        selectedDocIds={selectedRagDocIds}
        onToggleDocSelect={(id) => {
          setSelectedRagDocIds((prev) =>
            prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
          );
        }}
        onSelectAllDocs={() => {
          if (selectedRagDocIds.length === ragDocuments.length) {
            setSelectedRagDocIds([]);
          } else {
            setSelectedRagDocIds(ragDocuments.map((d) => d.id));
          }
        }}
        onAddDocument={addRagDocument}
        onDeleteDocument={deleteRagDocument}
      />
    </div>
  );
};
