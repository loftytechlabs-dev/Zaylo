import React, { useState } from 'react';
import {
  Download,
  Trash2,
  Play,
  Square,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HardDrive,
  FolderOpen,
  Plus,
  Layers,
  Flame,
  MessageSquare,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { api } from '../../api/client';
import type { Model, ModelVariant, CompatibilityRating } from '@local-ai/shared';
import { CapabilityEngine, ModelCapabilityRegistry } from '@local-ai/capabilities';

export const ModelsView: React.FC = () => {
  const {
    availableModels,
    installedModels,
    fineTunedModels,
    capabilities,
    downloads,
    serverState,
    serverConfig,
    downloadModel,
    cancelDownload,
    deleteModel,
    deleteFineTunedModel,
    importLocalModel,
    startServer,
    stopServer,
    updateServerConfig,
    setSelectedModel,
    setActiveTab: setNavTab,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'installed' | 'fine-tuned' | 'recommended' | 'catalog' | 'search' | 'import'>('installed');
  const [installedFilter, setInstalledFilter] = useState<'all' | 'base' | 'fine-tuned'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [hfSearchResults, setHfSearchResults] = useState<Model[]>([]);
  const [isSearchingHf, setIsSearchingHf] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Low memory preview toggle
  const [lowMemoryOverride, setLowMemoryOverride] = useState<boolean | null>(null);
  const isLowMemoryActive = lowMemoryOverride !== null ? lowMemoryOverride : Boolean(serverConfig?.lowMemoryMode);

  // Manual local model import state
  const [customPath, setCustomPath] = useState('');
  const [customName, setCustomName] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const handleToggleLowMemory = async (enabled: boolean) => {
    setLowMemoryOverride(enabled);
    try {
      await updateServerConfig({ lowMemoryMode: enabled });
    } catch (err: any) {
      console.error('Failed to update low memory config:', err);
    }
  };

  const handleDownload = async (model: Model, variant: ModelVariant) => {
    try {
      setDownloadingId(variant.id);
      await downloadModel(model.id, variant.id, variant.downloadUrl, model.name);
      setTimeout(() => setDownloadingId((curr) => (curr === variant.id ? null : curr)), 1200);
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
      setDownloadingId(null);
    }
  };

  const handleSearchHf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearchingHf(true);
    try {
      const results = await api.invoke('models:search-hf', { query: searchQuery.trim(), limit: 8 });
      setHfSearchResults(results);
    } catch (err: any) {
      alert(`Search failed: ${err.message}`);
    } finally {
      setIsSearchingHf(false);
    }
  };

  const handleBrowseAndImport = async () => {
    setIsImporting(true);
    try {
      const result = await importLocalModel();
      if (result) {
        setActiveTab('installed');
      }
    } catch (err: any) {
      alert(`Failed to import local model: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleManualImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPath.trim()) return;
    setIsImporting(true);
    try {
      const result = await importLocalModel(customPath.trim(), customName.trim() || undefined);
      if (result) {
        setCustomPath('');
        setCustomName('');
        setActiveTab('installed');
      }
    } catch (err: any) {
      alert(`Failed to import local model: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const getRatingBadge = (rating: CompatibilityRating) => {
    switch (rating) {
      case 'Excellent':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-800/50">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Excellent
          </span>
        );
      case 'Good':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
            <CheckCircle2 className="w-3 h-3 text-zinc-600 dark:text-zinc-400" />
            {isLowMemoryActive ? 'Good (Streaming)' : 'Good'}
          </span>
        );
      case 'Limited':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-950/60 text-amber-300 border border-amber-800/50">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            Limited
          </span>
        );
      case 'Not recommended':
      case 'Unsupported':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-950/60 text-rose-300 border border-rose-800/50">
            <XCircle className="w-3 h-3 text-rose-400" />
            {rating}
          </span>
        );
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto overflow-y-auto h-[calc(100vh-4rem)]">
      {/* Top Tabs & Action Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#eaeaea] dark:border-[#222222] pb-4">
        <div className="flex items-center gap-2 flex-wrap">
          {(['installed', 'fine-tuned', 'recommended', 'catalog', 'search', 'import'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium capitalize transition-colors flex items-center gap-1.5 ${
                activeTab === tab
                  ? 'bg-black dark:bg-white text-white dark:text-black font-semibold'
                  : 'text-[#666666] dark:text-[#a1a1aa] hover:text-[#111111] dark:hover:text-white hover:bg-[#f5f5f5] dark:hover:bg-[#202020]'
              }`}
            >
              {tab === 'fine-tuned' && <Flame className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />}
              <span>
                {tab === 'search'
                  ? 'Hugging Face Hub'
                  : tab === 'import'
                  ? 'Import Local File'
                  : tab === 'fine-tuned'
                  ? 'Fine-Tuned'
                  : tab}
              </span>
              {tab === 'installed' && (
                <span className="ml-1 px-1.5 py-0.2 rounded bg-black/10 dark:bg-white/10 text-[10px] text-current">
                  {installedModels.length + fineTunedModels.length}
                </span>
              )}
              {tab === 'fine-tuned' && (
                <span className="ml-1 px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px]">
                  {fineTunedModels.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Right Action Bar: Low-Memory Mode Toggle & Import Button */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => handleToggleLowMemory(!isLowMemoryActive)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              isLowMemoryActive
                ? 'bg-black dark:bg-white border-black dark:border-white text-white dark:text-black'
                : 'bg-white dark:bg-[#141414] border-[#eaeaea] dark:border-[#262626] text-[#666666] dark:text-[#a1a1aa] hover:text-[#111111] dark:hover:text-white'
            }`}
            title="Enable dynamic disk layer paging & quantized KV cache to run 7B/12B models on low RAM"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Low-Memory Streaming: <strong>{isLowMemoryActive ? 'ON' : 'OFF'}</strong></span>
          </button>

          <button
            onClick={handleBrowseAndImport}
            disabled={isImporting}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-white dark:bg-[#141414] hover:bg-[#f5f5f5] dark:hover:bg-[#202020] border border-[#eaeaea] dark:border-[#262626] text-[#111111] dark:text-[#f5f5f5] text-xs font-medium transition-colors"
          >
            <FolderOpen className="w-4 h-4 text-[#666666] dark:text-[#a1a1aa]" />
            <span>Select Local GGUF File...</span>
          </button>
        </div>
      </div>

      {/* Active Downloads Bar */}
      {Object.values(downloads).length > 0 && (
        <div className="space-y-3 p-4 rounded-lg bg-[#fafafa] dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626]">
          <div className="text-xs font-semibold text-[#111111] dark:text-[#f5f5f5] flex items-center gap-2">
            <Download className="w-4 h-4 animate-bounce" />
            Active Downloads
          </div>
          {Object.values(downloads).map((dl) => {
            const pct = dl.totalBytes > 0 ? Math.round((dl.downloadedBytes / dl.totalBytes) * 100) : 0;
            const downloadedMb = (dl.downloadedBytes / 1e6).toFixed(1);
            const totalMb = (dl.totalBytes / 1e6).toFixed(1);
            const speedMb = (dl.bytesPerSecond / 1e6).toFixed(2);

            return (
              <div key={dl.id} className="p-3 rounded-lg bg-white dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-[#111111] dark:text-[#f5f5f5] font-medium">{dl.filename}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[#666666] dark:text-[#a1a1aa]">
                      {downloadedMb} / {totalMb} MB ({speedMb} MB/s)
                    </span>
                    {dl.estimatedSecondsRemaining !== undefined && (
                      <span className="text-[#888888] dark:text-[#737373]">{dl.estimatedSecondsRemaining}s left</span>
                    )}
                    <button
                      onClick={() => cancelDownload(dl.id)}
                      className="text-rose-500 hover:text-rose-600 ml-2"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-[#eaeaea] dark:bg-[#262626] rounded-full overflow-hidden">
                  <div className="h-full bg-black dark:bg-white transition-all duration-300" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab Content: INSTALLED */}
      {activeTab === 'installed' && (
        <div className="space-y-4">
          {/* Sub-filter bar when fine-tuned models exist */}
          {fineTunedModels.length > 0 && installedModels.length > 0 && (
            <div className="flex items-center gap-2 pb-1">
              <span className="text-xs text-[#888888] dark:text-[#737373] font-mono">View:</span>
              {(['all', 'base', 'fine-tuned'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setInstalledFilter(filter)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    installedFilter === filter
                      ? 'bg-black dark:bg-white text-white dark:text-black border border-black dark:border-white'
                      : 'bg-white dark:bg-[#141414] text-[#666666] dark:text-[#a1a1aa] hover:text-[#111111] dark:hover:text-white border border-[#eaeaea] dark:border-[#262626]'
                  }`}
                >
                  {filter === 'all'
                    ? `All (${installedModels.length + fineTunedModels.length})`
                    : filter === 'base'
                    ? `Base Models (${installedModels.length})`
                    : `Fine-Tuned (${fineTunedModels.length})`}
                </button>
              ))}
            </div>
          )}

          {installedModels.length === 0 && fineTunedModels.length === 0 ? (
            <div className="p-12 text-center rounded-lg bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] space-y-4">
              <HardDrive className="w-10 h-10 text-[#888888] dark:text-[#737373] mx-auto" />
              <div className="space-y-1">
                <div className="text-sm font-semibold text-[#111111] dark:text-[#f5f5f5]">No models downloaded or loaded yet</div>
                <p className="text-xs text-[#666666] dark:text-[#a1a1aa] max-w-md mx-auto">
                  You can select an existing GGUF model file on your machine or download from our curated recommendations.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={handleBrowseAndImport}
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-black dark:bg-white hover:bg-[#222222] dark:hover:bg-[#f0f0f0] text-white dark:text-black text-xs font-medium transition-colors"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>Select Local GGUF File on Computer</span>
                </button>
                <button
                  onClick={() => setActiveTab('recommended')}
                  className="px-4 py-2 rounded-md bg-[#f5f5f5] dark:bg-[#202020] hover:bg-[#eaeaea] dark:hover:bg-[#262626] text-[#111111] dark:text-[#f5f5f5] text-xs font-medium transition-colors"
                >
                  Browse Catalog →
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Render Base Models */}
              {installedFilter !== 'fine-tuned' &&
                installedModels.map((inst) => {
                  const isLoaded = serverState === 'RUNNING' && inst.isLoaded;

                  return (
                    <div
                      key={inst.id}
                      className={`p-5 rounded-lg border flex flex-col justify-between space-y-4 transition-all ${
                        isLoaded
                          ? 'bg-white dark:bg-[#141414] border-black dark:border-white shadow-xs'
                          : 'bg-white dark:bg-[#141414] border-[#eaeaea] dark:border-[#262626]'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            {(() => {
                              const taskType = inst.taskType || ModelCapabilityRegistry.resolveTaskType(inst);
                              const isImage = taskType === 'image-generation';
                              return (
                                <>
                                  <div className="font-semibold text-sm text-[#111111] dark:text-[#f5f5f5] flex items-center gap-2 flex-wrap">
                                    <span>{inst.name}</span>
                                    {isImage ? (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 font-semibold">
                                        IMAGE GEN
                                      </span>
                                    ) : inst.mmprojPath || taskType === 'vision' ? (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 font-semibold">
                                        VISION
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/40 font-semibold">
                                        TEXT
                                      </span>
                                    )}
                                    {isLoaded && (
                                      <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/50">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                                        ACTIVE
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-[#666666] dark:text-[#a1a1aa] font-mono mt-0.5">
                                    {inst.format.toUpperCase()} • {inst.quantization} • {isImage ? 'Diffusion' : `${inst.contextLength} ctx`}
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                          <div className="p-2 rounded-md bg-[#fafafa] dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-[#666666] dark:text-[#a1a1aa] truncate">
                            <span className="text-[#888888] dark:text-[#737373] block text-[10px]">FILE PATH</span>
                            {inst.localPath.split('/').pop()}
                          </div>
                          <div className="p-2 rounded-md bg-[#fafafa] dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-[#666666] dark:text-[#a1a1aa]">
                            <span className="text-[#888888] dark:text-[#737373] block text-[10px]">FILE SIZE</span>
                            {(inst.sizeBytes / 1e9).toFixed(2)} GB
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[#eaeaea] dark:border-[#222222] flex items-center justify-between">
                        <button
                          onClick={() => deleteModel(inst.id)}
                          disabled={isLoaded}
                          className="p-1.5 rounded text-[#888888] dark:text-[#737373] hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors disabled:opacity-30"
                          title="Remove model from library"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <div className="flex items-center gap-2">
                          {(() => {
                            const taskType = inst.taskType || ModelCapabilityRegistry.resolveTaskType(inst);
                            const isImage = taskType === 'image-generation';
                            if (isImage) {
                              return (
                                <button
                                  onClick={() => {
                                    setSelectedModel(inst.name || inst.modelId || inst.id);
                                    setNavTab('playground');
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-black dark:bg-white hover:bg-[#222222] dark:hover:bg-[#f0f0f0] text-white dark:text-black text-xs font-medium transition-colors shadow-sm"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>Open in Playground</span>
                                </button>
                              );
                            }
                            if (isLoaded) {
                              return (
                                <>
                                  <button
                                    onClick={() => {
                                      setSelectedModel(inst.name || inst.modelId || inst.id);
                                      setNavTab('playground');
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-black dark:bg-white hover:bg-[#222222] dark:hover:bg-[#f0f0f0] text-white dark:text-black text-xs font-medium transition-colors"
                                    title="Open in Playground"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    <span>Playground</span>
                                  </button>
                                  <button
                                    onClick={() => stopServer()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800/40 text-rose-600 dark:text-rose-300 text-xs font-medium"
                                  >
                                    <Square className="w-3.5 h-3.5 fill-current" />
                                    <span>Stop</span>
                                  </button>
                                </>
                              );
                            }
                            return (
                              <button
                                onClick={() => startServer(inst.modelId, inst.variantId)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-black dark:bg-white hover:bg-[#222222] dark:hover:bg-[#f0f0f0] text-white dark:text-black text-xs font-medium transition-colors"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>Load & Start</span>
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })}

              {/* Render Fine-Tuned Models inside Installed View */}
              {installedFilter !== 'base' &&
                fineTunedModels.map((art) => {
                  const matchingBase = installedModels.find(
                    (m) =>
                      m.modelId === art.baseModelId ||
                      m.name.toLowerCase().includes(art.baseModelName.toLowerCase())
                  );
                  const isBaseLoaded = serverState === 'RUNNING' && matchingBase?.isLoaded;

                  return (
                    <div
                      key={art.id}
                      className={`p-5 rounded-lg border flex flex-col justify-between space-y-4 transition-all ${
                        isBaseLoaded
                          ? 'bg-white dark:bg-[#141414] border-black dark:border-white shadow-xs'
                          : 'bg-white dark:bg-[#141414] border-[#eaeaea] dark:border-[#262626]'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-sm text-[#111111] dark:text-[#f5f5f5] flex items-center gap-2 flex-wrap">
                              <span>{art.name}</span>
                              <span className="flex items-center gap-1 text-[10px] font-mono font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                <Flame className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                                FINE-TUNED
                              </span>
                              <span className="text-[10px] font-mono text-[#666666] dark:text-[#a1a1aa] bg-[#f5f5f5] dark:bg-[#191919] px-1.5 py-0.5 rounded border border-[#eaeaea] dark:border-[#262626] uppercase">
                                {art.type === 'lora' ? 'LoRA Adapter' : 'Merged Standalone'}
                              </span>
                              {isBaseLoaded && (
                                <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/50">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                                  ACTIVE ADAPTER
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[#666666] dark:text-[#a1a1aa] font-mono mt-1 flex items-center gap-2">
                              <span>
                                Base Model: <strong className="text-[#111111] dark:text-[#f5f5f5]">{art.baseModelName}</strong>
                              </span>
                              <span>•</span>
                              <span>{art.format.toUpperCase()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                          <div className="p-2 rounded-md bg-[#fafafa] dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-[#666666] dark:text-[#a1a1aa]">
                            <span className="text-[#888888] dark:text-[#737373] block text-[10px]">FINAL LOSS</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              {typeof art.finalLoss === 'number' && !isNaN(art.finalLoss)
                                ? art.finalLoss.toFixed(4)
                                : 'Completed'}
                            </span>
                          </div>
                          <div className="p-2 rounded-md bg-[#fafafa] dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-[#666666] dark:text-[#a1a1aa]">
                            <span className="text-[#888888] dark:text-[#737373] block text-[10px]">ADAPTER SIZE</span>
                            <span>{(art.sizeBytes / 1e6).toFixed(1)} MB</span>
                          </div>
                        </div>

                        <div className="text-[11px] text-[#888888] dark:text-[#737373] font-mono truncate">
                          Path: {art.artifactPath.split('/').pop()}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[#eaeaea] dark:border-[#222222] flex items-center justify-between gap-2 flex-wrap">
                        <button
                          onClick={() => {
                            if (confirm(`Delete fine-tuned adapter "${art.name}"?`)) {
                              deleteFineTunedModel(art.id);
                            }
                          }}
                          className="p-1.5 rounded text-[#888888] dark:text-[#737373] hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                          title="Delete fine-tuned adapter"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setNavTab('forge')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#f5f5f5] dark:bg-[#202020] hover:bg-[#eaeaea] dark:hover:bg-[#262626] border border-[#eaeaea] dark:border-[#262626] text-[#111111] dark:text-[#f5f5f5] text-xs font-medium transition-colors"
                            title="Inspect in Forge Studio"
                          >
                            <Flame className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                            <span>Forge Studio</span>
                          </button>

                          <button
                            onClick={() => {
                              setSelectedModel(art.name);
                              setNavTab('playground');
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-black dark:bg-white hover:bg-[#222222] dark:hover:bg-[#f0f0f0] text-white dark:text-black text-xs font-medium transition-colors"
                            title="Test in Playground"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Playground</span>
                          </button>

                          {matchingBase &&
                            (isBaseLoaded ? (
                              <button
                                onClick={() => stopServer()}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800/40 text-rose-600 dark:text-rose-300 text-xs font-medium"
                              >
                                <Square className="w-3.5 h-3.5 fill-current" />
                                <span>Stop</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => startServer(matchingBase.modelId, matchingBase.variantId)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-black dark:bg-white hover:bg-[#222222] dark:hover:bg-[#f0f0f0] text-white dark:text-black text-xs font-medium transition-colors"
                                title={`Start ${matchingBase.name} with this adapter`}
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>Run Base</span>
                              </button>
                            ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: DEDICATED FINE-TUNED TAB */}
      {activeTab === 'fine-tuned' && (
        <div className="space-y-5">
          {/* Header Action Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <h3 className="text-sm font-semibold text-[#111111] dark:text-[#f5f5f5]">Forge Fine-Tuned Models</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {fineTunedModels.length} {fineTunedModels.length === 1 ? 'ADAPTER' : 'ADAPTERS'}
                </span>
              </div>
              <p className="text-xs text-[#666666] dark:text-[#a1a1aa]">
                LoRA adapters and standalone fine-tuned models created in Forge. Connect them to their base models for specialized inference.
              </p>
            </div>

            <button
              onClick={() => setNavTab('forge')}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-black dark:bg-white hover:bg-[#222222] dark:hover:bg-[#f0f0f0] text-white dark:text-black text-xs font-medium transition-colors shadow-sm shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Train New in Forge</span>
            </button>
          </div>

          {fineTunedModels.length === 0 ? (
            <div className="p-12 text-center rounded-lg bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] space-y-4">
              <Flame className="w-10 h-10 text-amber-500/60 dark:text-amber-400/60 mx-auto" />
              <div className="space-y-1">
                <div className="text-sm font-semibold text-[#111111] dark:text-[#f5f5f5]">No fine-tuned models yet</div>
                <p className="text-xs text-[#666666] dark:text-[#a1a1aa] max-w-md mx-auto">
                  Fine-tune any installed open-source model on your custom dataset using Forge. Your fine-tuned adapters will automatically register and appear here.
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => setNavTab('forge')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-black dark:bg-white hover:bg-[#222222] dark:hover:bg-[#f0f0f0] text-white dark:text-black text-xs font-medium transition-colors"
                >
                  <Flame className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                  <span>Open Forge Studio →</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fineTunedModels.map((art) => {
                const matchingBase = installedModels.find(
                  (m) =>
                    m.modelId === art.baseModelId ||
                    m.name.toLowerCase().includes(art.baseModelName.toLowerCase())
                );
                const isBaseLoaded = serverState === 'RUNNING' && matchingBase?.isLoaded;

                return (
                  <div
                    key={art.id}
                    className={`p-5 rounded-lg border flex flex-col justify-between space-y-4 transition-all ${
                      isBaseLoaded
                        ? 'bg-white dark:bg-[#141414] border-black dark:border-white shadow-xs'
                        : 'bg-white dark:bg-[#141414] border-[#eaeaea] dark:border-[#262626]'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-sm text-[#111111] dark:text-[#f5f5f5] flex items-center gap-2 flex-wrap">
                            <span>{art.name}</span>
                            <span className="flex items-center gap-1 text-[10px] font-mono font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              <Flame className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                              FINE-TUNED
                            </span>
                            <span className="text-[10px] font-mono text-[#666666] dark:text-[#a1a1aa] bg-[#f5f5f5] dark:bg-[#191919] px-1.5 py-0.5 rounded border border-[#eaeaea] dark:border-[#262626] uppercase">
                              {art.type === 'lora' ? 'LoRA Adapter' : 'Merged Standalone'}
                            </span>
                            {isBaseLoaded && (
                              <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/50">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                                ACTIVE ADAPTER
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[#666666] dark:text-[#a1a1aa] font-mono mt-1 flex items-center gap-2">
                            <span>
                              Base Model: <strong className="text-[#111111] dark:text-[#f5f5f5]">{art.baseModelName}</strong>
                            </span>
                            <span>•</span>
                            <span>{art.format.toUpperCase()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div className="p-2 rounded-md bg-[#fafafa] dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-[#666666] dark:text-[#a1a1aa]">
                          <span className="text-[#888888] dark:text-[#737373] block text-[10px]">FINAL LOSS</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            {typeof art.finalLoss === 'number' && !isNaN(art.finalLoss)
                              ? art.finalLoss.toFixed(4)
                              : 'Completed'}
                          </span>
                        </div>
                        <div className="p-2 rounded-md bg-[#fafafa] dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-[#666666] dark:text-[#a1a1aa]">
                          <span className="text-[#888888] dark:text-[#737373] block text-[10px]">ADAPTER SIZE</span>
                          <span>{(art.sizeBytes / 1e6).toFixed(1)} MB</span>
                        </div>
                      </div>

                      <div className="text-[11px] text-[#888888] dark:text-[#737373] font-mono truncate">
                        Path: {art.artifactPath.split('/').pop()}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#eaeaea] dark:border-[#222222] flex items-center justify-between gap-2 flex-wrap">
                      <button
                        onClick={() => {
                          if (confirm(`Delete fine-tuned adapter "${art.name}"?`)) {
                            deleteFineTunedModel(art.id);
                          }
                        }}
                        className="p-1.5 rounded text-[#888888] dark:text-[#737373] hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        title="Delete fine-tuned adapter"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setNavTab('forge')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#f5f5f5] dark:bg-[#202020] hover:bg-[#eaeaea] dark:hover:bg-[#262626] border border-[#eaeaea] dark:border-[#262626] text-[#111111] dark:text-[#f5f5f5] text-xs font-medium transition-colors"
                          title="Inspect in Forge Studio"
                        >
                          <Flame className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                          <span>Forge Studio</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedModel(art.name);
                            setNavTab('playground');
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-black dark:bg-white hover:bg-[#222222] dark:hover:bg-[#f0f0f0] text-white dark:text-black text-xs font-medium transition-colors"
                          title="Test in Playground"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Playground</span>
                        </button>

                        {matchingBase &&
                          (isBaseLoaded ? (
                            <button
                              onClick={() => stopServer()}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800/40 text-rose-600 dark:text-rose-300 text-xs font-medium"
                            >
                              <Square className="w-3.5 h-3.5 fill-current" />
                              <span>Stop</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => startServer(matchingBase.modelId, matchingBase.variantId)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-black dark:bg-white hover:bg-[#222222] dark:hover:bg-[#f0f0f0] text-white dark:text-black text-xs font-medium transition-colors"
                              title={`Start ${matchingBase.name} with this adapter`}
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Run Base</span>
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: IMPORT LOCAL MODEL */}
      {activeTab === 'import' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="p-6 rounded-lg bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-[#111111] dark:text-[#f5f5f5] flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-[#666666] dark:text-[#a1a1aa]" />
                Import Existing Local GGUF Model File
              </h3>
              <p className="text-xs text-[#666666] dark:text-[#a1a1aa] mt-1">
                Select any <code className="font-mono text-[#111111] dark:text-[#f5f5f5]">.gguf</code> model file on your computer to add it instantly to your server library without downloading.
              </p>
            </div>

            {/* Option A: File Picker Dialog */}
            <div className="p-5 rounded-lg bg-[#fafafa] dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-center space-y-3">
              <FolderOpen className="w-8 h-8 text-[#666666] dark:text-[#a1a1aa] mx-auto" />
              <div className="text-xs font-medium text-[#111111] dark:text-[#f5f5f5]">Browse filesystem for GGUF file</div>
              <button
                onClick={handleBrowseAndImport}
                disabled={isImporting}
                className="px-5 py-2 rounded-md bg-black dark:bg-white hover:bg-[#222222] dark:hover:bg-[#f0f0f0] text-white dark:text-black text-xs font-medium transition-colors inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>{isImporting ? 'Importing...' : 'Browse & Select File...'}</span>
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 text-xs text-[#888888] dark:text-[#737373] font-mono">
              <div className="flex-1 h-px bg-[#eaeaea] dark:bg-[#222222]" />
              <span>OR ENTER FILEPATH MANUALLY</span>
              <div className="flex-1 h-px bg-[#eaeaea] dark:bg-[#222222]" />
            </div>

            {/* Option B: Direct Path Input */}
            <form onSubmit={handleManualImport} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-[#111111] dark:text-[#f5f5f5] font-medium">Absolute File Path to .gguf</label>
                <input
                  type="text"
                  placeholder="/Users/username/models/my-model-q4_k_m.gguf"
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                  className="w-full bg-[#fafafa] dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] rounded px-3 py-2 text-xs font-mono text-[#111111] dark:text-[#f5f5f5] placeholder-[#888888] dark:placeholder-[#737373] focus:outline-none focus:border-black dark:focus:border-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-[#111111] dark:text-[#f5f5f5] font-medium">Model Display Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Caden SQL 1.5B"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full bg-[#fafafa] dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] rounded px-3 py-2 text-xs font-mono text-[#111111] dark:text-[#f5f5f5] placeholder-[#888888] dark:placeholder-[#737373] focus:outline-none focus:border-black dark:focus:border-white"
                />
              </div>

              <button
                type="submit"
                disabled={isImporting || !customPath.trim()}
                className="w-full py-2 bg-black dark:bg-white hover:bg-[#222222] dark:hover:bg-[#f0f0f0] text-white dark:text-black text-xs font-medium rounded-md transition-colors disabled:opacity-40"
              >
                {isImporting ? 'Importing Model...' : 'Register Local Model'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab Content: RECOMMENDED & CATALOG */}
      {(activeTab === 'recommended' || activeTab === 'catalog') && (
        <div className="space-y-4">
          {/* Low-Memory Mode Banner */}
          {isLowMemoryActive && (
            <div className="p-3 rounded-lg bg-[#fafafa] dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] flex items-center justify-between text-xs text-[#111111] dark:text-[#f5f5f5]">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#666666] dark:text-[#a1a1aa]" />
                <span><strong>Low-Memory Layer Streaming is Active:</strong> 7B and 12B models are evaluated using dynamic disk layer paging & 8-bit quantized KV cache.</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {availableModels.map((model) => {
              const variant = model.variants.find((v) => v.id === model.defaultVariantId) || model.variants[0];
              const isInstalled = installedModels.some((i) => i.modelId === model.id);
              const analysis = capabilities ? CapabilityEngine.evaluateModelCompatibility(variant, capabilities, { lowMemoryMode: isLowMemoryActive }) : null;

              const activeDownload = Object.values(downloads).find(
                (dl) => dl.variantId === variant.id || dl.modelId === model.id || (dl.status === 'downloading' && dl.filename.includes(variant.id))
              );
              const isPending = downloadingId === variant.id;

              return (
                <div
                  key={model.id}
                  className="p-5 rounded-lg bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-sm text-[#111111] dark:text-[#f5f5f5] flex items-center gap-2 flex-wrap">
                          <span>{model.name}</span>
                          {model.taskType === 'image-generation' || model.capabilities.includes('IMAGE_GENERATION') ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 font-semibold">
                              IMAGE GEN
                            </span>
                          ) : model.capabilities.includes('VISION') ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 font-semibold">
                              VISION
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/40 font-semibold">
                              TEXT
                            </span>
                          )}
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#f5f5f5] dark:bg-[#191919] text-[#666666] dark:text-[#a1a1aa] border border-[#eaeaea] dark:border-[#262626]">
                            {model.parameterCount}
                          </span>
                        </div>
                        <div className="text-xs text-[#666666] dark:text-[#a1a1aa] font-mono mt-0.5">{model.publisher}</div>
                      </div>
                      {analysis && getRatingBadge(analysis.rating)}
                    </div>

                    <p className="text-xs text-[#666666] dark:text-[#a1a1aa] mt-3 line-clamp-2 leading-relaxed">
                      {model.description}
                    </p>

                    {/* Mathematical compatibility reason */}
                    {analysis && (
                      <div className="mt-3 p-2.5 rounded bg-[#fafafa] dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-[11px] space-y-1">
                        <div className="text-[#111111] dark:text-[#f5f5f5] font-medium">{analysis.reason}</div>
                        <div className="text-[#888888] dark:text-[#737373] font-mono text-[10px]">
                          {isLowMemoryActive ? 'Active Working RAM' : 'Full RAM Req'}: ~{(analysis.estimatedMemoryBytes / 1e9).toFixed(1)} GB | GPU Offload:{' '}
                          {analysis.recommendedGpuLayers} layers
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[#eaeaea] dark:border-[#222222] space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-mono text-[#666666] dark:text-[#a1a1aa]">
                        {(variant.sizeBytes / 1e9).toFixed(2)} GB • {variant.quantization}
                      </div>

                      {isInstalled ? (
                        <button
                          onClick={() => setActiveTab('installed')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Installed ✓</span>
                        </button>
                      ) : activeDownload ? (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#fafafa] dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-[#111111] dark:text-[#f5f5f5] text-xs font-medium font-mono">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#666666] dark:text-[#a1a1aa]" />
                            <span>
                              Downloading {activeDownload.totalBytes > 0 ? `${Math.round((activeDownload.downloadedBytes / activeDownload.totalBytes) * 100)}%` : '...'}
                            </span>
                          </div>
                          <button
                            onClick={() => cancelDownload(activeDownload.id)}
                            className="px-2.5 py-1.5 rounded bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/70 border border-rose-200 dark:border-rose-800/50 text-rose-600 dark:text-rose-300 hover:text-rose-700 dark:hover:text-white text-xs font-medium transition-colors"
                            title="Cancel download"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : isPending ? (
                        <button
                          disabled
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#f5f5f5] dark:bg-[#191919] text-[#888888] dark:text-[#737373] text-xs font-medium cursor-not-allowed opacity-90"
                        >
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#888888] dark:text-[#737373]" />
                          <span>Starting...</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDownload(model, variant)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-black dark:bg-white hover:bg-[#222222] dark:hover:bg-[#f0f0f0] text-white dark:text-black text-xs font-medium transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                      )}
                    </div>

                    {activeDownload && (
                      <div className="space-y-1 pt-1">
                        <div className="h-1.5 w-full bg-[#eaeaea] dark:bg-[#262626] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-black dark:bg-white transition-all duration-300"
                            style={{
                              width: `${
                                activeDownload.totalBytes > 0
                                  ? Math.min(100, Math.round((activeDownload.downloadedBytes / activeDownload.totalBytes) * 100))
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-[#888888] dark:text-[#737373] font-mono">
                          <span>
                            {(activeDownload.downloadedBytes / 1e6).toFixed(1)} / {(activeDownload.totalBytes / 1e6).toFixed(1)} MB
                            {activeDownload.bytesPerSecond > 0 && ` (${(activeDownload.bytesPerSecond / 1e6).toFixed(1)} MB/s)`}
                          </span>
                          {activeDownload.estimatedSecondsRemaining !== undefined && (
                            <span>{activeDownload.estimatedSecondsRemaining}s left</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab Content: HUGGING FACE SEARCH */}
      {activeTab === 'search' && (
        <div className="space-y-6">
          <form onSubmit={handleSearchHf} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#888888] dark:text-[#737373] absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search Hugging Face GGUF models (e.g. Qwen, DeepSeek, Gemma, Phi)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] rounded-md pl-9 pr-4 py-2 text-xs text-[#111111] dark:text-[#f5f5f5] placeholder-[#888888] dark:placeholder-[#737373] focus:outline-none focus:border-black dark:focus:border-white font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={isSearchingHf}
              className="px-4 py-2 bg-black dark:bg-white hover:bg-[#222222] dark:hover:bg-[#f0f0f0] text-white dark:text-black text-xs font-medium rounded-md transition-colors disabled:opacity-50"
            >
              {isSearchingHf ? 'Searching...' : 'Search'}
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hfSearchResults.map((model) => {
              const variant = model.variants[0];
              const isInstalled = installedModels.some((i) => i.name === model.name);
              const activeDownload = Object.values(downloads).find(
                (dl) => dl.modelId === model.id || (variant && dl.variantId === variant.id)
              );
              const isPending = variant && downloadingId === variant.id;

              return (
                <div
                  key={model.id}
                  className="p-5 rounded-lg bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="font-semibold text-sm text-[#111111] dark:text-[#f5f5f5]">{model.name}</div>
                    <div className="text-xs text-[#666666] dark:text-[#a1a1aa] font-mono">{model.publisher}</div>
                    <p className="text-xs text-[#666666] dark:text-[#a1a1aa] mt-2 line-clamp-2">{model.description}</p>
                  </div>

                  <div className="pt-3 border-t border-[#eaeaea] dark:border-[#222222] space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-mono text-[#666666] dark:text-[#a1a1aa]">
                        {variant.quantization} • {variant.format.toUpperCase()}
                      </div>
                      {isInstalled ? (
                        <button
                          disabled
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Installed ✓</span>
                        </button>
                      ) : activeDownload ? (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#fafafa] dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-[#111111] dark:text-[#f5f5f5] text-xs font-medium font-mono">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#666666] dark:text-[#a1a1aa]" />
                            <span>
                              Downloading {activeDownload.totalBytes > 0 ? `${Math.round((activeDownload.downloadedBytes / activeDownload.totalBytes) * 100)}%` : '...'}
                            </span>
                          </div>
                          <button
                            onClick={() => cancelDownload(activeDownload.id)}
                            className="px-2.5 py-1.5 rounded bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/70 border border-rose-200 dark:border-rose-800/50 text-rose-600 dark:text-rose-300 hover:text-rose-700 dark:hover:text-white text-xs font-medium transition-colors"
                            title="Cancel download"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : isPending ? (
                        <button
                          disabled
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#f5f5f5] dark:bg-[#191919] text-[#888888] dark:text-[#737373] text-xs font-medium cursor-not-allowed opacity-90"
                        >
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#888888] dark:text-[#737373]" />
                          <span>Starting...</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDownload(model, variant)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-black dark:bg-white hover:bg-[#222222] dark:hover:bg-[#f0f0f0] text-white dark:text-black text-xs font-medium transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download GGUF</span>
                        </button>
                      )}
                    </div>

                    {activeDownload && (
                      <div className="space-y-1 pt-1">
                        <div className="h-1.5 w-full bg-[#eaeaea] dark:bg-[#262626] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-black dark:bg-white transition-all duration-300"
                            style={{
                              width: `${
                                activeDownload.totalBytes > 0
                                  ? Math.min(100, Math.round((activeDownload.downloadedBytes / activeDownload.totalBytes) * 100))
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
