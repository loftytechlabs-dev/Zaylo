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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-950/60 text-blue-300 border border-blue-800/50">
            <CheckCircle2 className="w-3 h-3 text-blue-400" />
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
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#202227] pb-4">
        <div className="flex items-center gap-2 flex-wrap">
          {(['installed', 'fine-tuned', 'recommended', 'catalog', 'search', 'import'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium capitalize transition-colors flex items-center gap-1.5 ${
                activeTab === tab
                  ? 'bg-[#1b1e24] text-zinc-100 border border-[#2e323b]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#14161a]'
              }`}
            >
              {tab === 'fine-tuned' && <Flame className="w-3.5 h-3.5 text-amber-400" />}
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
                <span className="ml-1 px-1.5 py-0.2 rounded bg-[#252830] text-[10px] text-zinc-300">
                  {installedModels.length + fineTunedModels.length}
                </span>
              )}
              {tab === 'fine-tuned' && (
                <span className="ml-1 px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px]">
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
                ? 'bg-blue-950/80 border-blue-700 text-blue-300'
                : 'bg-[#14161c] border-[#252934] text-zinc-400 hover:text-zinc-200'
            }`}
            title="Enable dynamic disk layer paging & quantized KV cache to run 7B/12B models on low RAM"
          >
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>Low-Memory Streaming: <strong>{isLowMemoryActive ? 'ON' : 'OFF'}</strong></span>
          </button>

          <button
            onClick={handleBrowseAndImport}
            disabled={isImporting}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-[#181a20] hover:bg-[#22252e] border border-[#2d313b] text-zinc-200 hover:text-white text-xs font-medium transition-colors"
          >
            <FolderOpen className="w-4 h-4 text-blue-400" />
            <span>Select Local GGUF File...</span>
          </button>
        </div>
      </div>

      {/* Active Downloads Bar */}
      {Object.values(downloads).length > 0 && (
        <div className="space-y-3 p-4 rounded-lg bg-[#111317] border border-blue-900/40">
          <div className="text-xs font-semibold text-blue-400 flex items-center gap-2">
            <Download className="w-4 h-4 animate-bounce" />
            Active Downloads
          </div>
          {Object.values(downloads).map((dl) => {
            const pct = dl.totalBytes > 0 ? Math.round((dl.downloadedBytes / dl.totalBytes) * 100) : 0;
            const downloadedMb = (dl.downloadedBytes / 1e6).toFixed(1);
            const totalMb = (dl.totalBytes / 1e6).toFixed(1);
            const speedMb = (dl.bytesPerSecond / 1e6).toFixed(2);

            return (
              <div key={dl.id} className="p-3 rounded bg-[#0c0d10] border border-[#1f2229] space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-200 font-medium">{dl.filename}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-400">
                      {downloadedMb} / {totalMb} MB ({speedMb} MB/s)
                    </span>
                    {dl.estimatedSecondsRemaining !== undefined && (
                      <span className="text-zinc-500">{dl.estimatedSecondsRemaining}s left</span>
                    )}
                    <button
                      onClick={() => cancelDownload(dl.id)}
                      className="text-rose-400 hover:text-rose-300 ml-2"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-[#1c1f26] rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${pct}%` }} />
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
              <span className="text-xs text-zinc-500 font-mono">View:</span>
              {(['all', 'base', 'fine-tuned'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setInstalledFilter(filter)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    installedFilter === filter
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
                      : 'bg-[#14161a] text-zinc-400 hover:text-zinc-200 border border-[#22252c]'
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
            <div className="p-12 text-center rounded-lg bg-[#111317] border border-[#22252c] space-y-4">
              <HardDrive className="w-10 h-10 text-zinc-600 mx-auto" />
              <div className="space-y-1">
                <div className="text-sm font-semibold text-zinc-200">No models downloaded or loaded yet</div>
                <p className="text-xs text-zinc-500 max-w-md mx-auto">
                  You can select an existing GGUF model file on your machine or download from our curated recommendations.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={handleBrowseAndImport}
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>Select Local GGUF File on Computer</span>
                </button>
                <button
                  onClick={() => setActiveTab('recommended')}
                  className="px-4 py-2 rounded-md bg-[#1c1f26] hover:bg-[#262a33] text-zinc-300 hover:text-white text-xs font-medium transition-colors"
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
                          ? 'bg-[#111622] border-blue-600/60 shadow-lg shadow-blue-950/20'
                          : 'bg-[#111317] border-[#22252c]'
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
                                  <div className="font-semibold text-sm text-zinc-100 flex items-center gap-2 flex-wrap">
                                    <span>{inst.name}</span>
                                    {isImage ? (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20 font-semibold">
                                        IMAGE GEN
                                      </span>
                                    ) : inst.mmprojPath || taskType === 'vision' ? (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-300 border border-blue-500/20 font-semibold">
                                        VISION
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700/40 font-semibold">
                                        TEXT
                                      </span>
                                    )}
                                    {isLoaded && (
                                      <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        ACTIVE
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-zinc-500 font-mono mt-0.5">
                                    {inst.format.toUpperCase()} • {inst.quantization} • {isImage ? 'Diffusion' : `${inst.contextLength} ctx`}
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                          <div className="p-2 rounded bg-[#0d0f12] text-zinc-400 truncate">
                            <span className="text-zinc-600 block text-[10px]">FILE PATH</span>
                            {inst.localPath.split('/').pop()}
                          </div>
                          <div className="p-2 rounded bg-[#0d0f12] text-zinc-400">
                            <span className="text-zinc-600 block text-[10px]">FILE SIZE</span>
                            {(inst.sizeBytes / 1e9).toFixed(2)} GB
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[#1c1f26] flex items-center justify-between">
                        <button
                          onClick={() => deleteModel(inst.id)}
                          disabled={isLoaded}
                          className="p-1.5 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors disabled:opacity-30"
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
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors shadow-sm"
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
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                                    title="Open in Playground"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    <span>Playground</span>
                                  </button>
                                  <button
                                    onClick={() => stopServer()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/40 text-rose-300 text-xs font-medium"
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
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
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
                          ? 'bg-[#111622] border-blue-600/60 shadow-lg shadow-blue-950/20'
                          : 'bg-[#111317] border-[#22252c] hover:border-[#2e323b]'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-sm text-zinc-100 flex items-center gap-2 flex-wrap">
                              <span>{art.name}</span>
                              <span className="flex items-center gap-1 text-[10px] font-mono font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                <Flame className="w-3 h-3 text-amber-400" />
                                FINE-TUNED
                              </span>
                              <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 uppercase">
                                {art.type === 'lora' ? 'LoRA Adapter' : 'Merged Standalone'}
                              </span>
                              {isBaseLoaded && (
                                <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  ACTIVE ADAPTER
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-zinc-400 font-mono mt-1 flex items-center gap-2">
                              <span>
                                Base Model: <strong className="text-zinc-200">{art.baseModelName}</strong>
                              </span>
                              <span>•</span>
                              <span>{art.format.toUpperCase()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                          <div className="p-2 rounded bg-[#0c0d11] text-zinc-400">
                            <span className="text-zinc-600 block text-[10px]">FINAL LOSS</span>
                            <span className="text-emerald-400 font-bold">
                              {typeof art.finalLoss === 'number' && !isNaN(art.finalLoss)
                                ? art.finalLoss.toFixed(4)
                                : 'Completed'}
                            </span>
                          </div>
                          <div className="p-2 rounded bg-[#0c0d11] text-zinc-400">
                            <span className="text-zinc-600 block text-[10px]">ADAPTER SIZE</span>
                            <span>{(art.sizeBytes / 1e6).toFixed(1)} MB</span>
                          </div>
                        </div>

                        <div className="text-[11px] text-zinc-500 font-mono truncate">
                          Path: {art.artifactPath.split('/').pop()}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[#1a1c24] flex items-center justify-between gap-2 flex-wrap">
                        <button
                          onClick={() => {
                            if (confirm(`Delete fine-tuned adapter "${art.name}"?`)) {
                              deleteFineTunedModel(art.id);
                            }
                          }}
                          className="p-1.5 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                          title="Delete fine-tuned adapter"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setNavTab('forge')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#171922] hover:bg-[#202330] border border-[#272b38] text-zinc-300 hover:text-white text-xs font-medium transition-colors"
                            title="Inspect in Forge Studio"
                          >
                            <Flame className="w-3.5 h-3.5 text-amber-400" />
                            <span>Forge Studio</span>
                          </button>

                          <button
                            onClick={() => {
                              setSelectedModel(art.name);
                              setNavTab('playground');
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                            title="Test in Playground"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Playground</span>
                          </button>

                          {matchingBase &&
                            (isBaseLoaded ? (
                              <button
                                onClick={() => stopServer()}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/40 text-rose-300 text-xs font-medium"
                              >
                                <Square className="w-3.5 h-3.5 fill-current" />
                                <span>Stop</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => startServer(matchingBase.modelId, matchingBase.variantId)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-[#13151b] to-[#101217] border border-amber-500/20">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-zinc-100">Forge Fine-Tuned Models</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {fineTunedModels.length} {fineTunedModels.length === 1 ? 'ADAPTER' : 'ADAPTERS'}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                LoRA adapters and standalone fine-tuned models created in Forge. Connect them to their base models for specialized inference.
              </p>
            </div>

            <button
              onClick={() => setNavTab('forge')}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors shadow-sm shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Train New in Forge</span>
            </button>
          </div>

          {fineTunedModels.length === 0 ? (
            <div className="p-12 text-center rounded-lg bg-[#111317] border border-[#22252c] space-y-4">
              <Flame className="w-10 h-10 text-amber-400/60 mx-auto" />
              <div className="space-y-1">
                <div className="text-sm font-semibold text-zinc-200">No fine-tuned models yet</div>
                <p className="text-xs text-zinc-400 max-w-md mx-auto">
                  Fine-tune any installed open-source model on your custom dataset using Forge. Your fine-tuned adapters will automatically register and appear here.
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => setNavTab('forge')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                >
                  <Flame className="w-4 h-4 text-amber-400" />
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
                        ? 'bg-[#111622] border-blue-600/60 shadow-lg shadow-blue-950/20'
                        : 'bg-[#111317] border-[#22252c] hover:border-[#2e323b]'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-sm text-zinc-100 flex items-center gap-2 flex-wrap">
                            <span>{art.name}</span>
                            <span className="flex items-center gap-1 text-[10px] font-mono font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              <Flame className="w-3 h-3 text-amber-400" />
                              FINE-TUNED
                            </span>
                            <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 uppercase">
                              {art.type === 'lora' ? 'LoRA Adapter' : 'Merged Standalone'}
                            </span>
                            {isBaseLoaded && (
                              <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                ACTIVE ADAPTER
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-zinc-400 font-mono mt-1 flex items-center gap-2">
                            <span>
                              Base Model: <strong className="text-zinc-200">{art.baseModelName}</strong>
                            </span>
                            <span>•</span>
                            <span>{art.format.toUpperCase()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div className="p-2 rounded bg-[#0c0d11] text-zinc-400">
                          <span className="text-zinc-600 block text-[10px]">FINAL LOSS</span>
                          <span className="text-emerald-400 font-bold">
                            {typeof art.finalLoss === 'number' && !isNaN(art.finalLoss)
                              ? art.finalLoss.toFixed(4)
                              : 'Completed'}
                          </span>
                        </div>
                        <div className="p-2 rounded bg-[#0c0d11] text-zinc-400">
                          <span className="text-zinc-600 block text-[10px]">ADAPTER SIZE</span>
                          <span>{(art.sizeBytes / 1e6).toFixed(1)} MB</span>
                        </div>
                      </div>

                      <div className="text-[11px] text-zinc-500 font-mono truncate">
                        Path: {art.artifactPath.split('/').pop()}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#1a1c24] flex items-center justify-between gap-2 flex-wrap">
                      <button
                        onClick={() => {
                          if (confirm(`Delete fine-tuned adapter "${art.name}"?`)) {
                            deleteFineTunedModel(art.id);
                          }
                        }}
                        className="p-1.5 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                        title="Delete fine-tuned adapter"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setNavTab('forge')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#171922] hover:bg-[#202330] border border-[#272b38] text-zinc-300 hover:text-white text-xs font-medium transition-colors"
                          title="Inspect in Forge Studio"
                        >
                          <Flame className="w-3.5 h-3.5 text-amber-400" />
                          <span>Forge Studio</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedModel(art.name);
                            setNavTab('playground');
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                          title="Test in Playground"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Playground</span>
                        </button>

                        {matchingBase &&
                          (isBaseLoaded ? (
                            <button
                              onClick={() => stopServer()}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/40 text-rose-300 text-xs font-medium"
                            >
                              <Square className="w-3.5 h-3.5 fill-current" />
                              <span>Stop</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => startServer(matchingBase.modelId, matchingBase.variantId)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
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
          <div className="p-6 rounded-lg bg-[#111317] border border-[#22252c] space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-blue-400" />
                Import Existing Local GGUF Model File
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Select any <code className="font-mono text-zinc-300">.gguf</code> model file on your computer to add it instantly to your server library without downloading.
              </p>
            </div>

            {/* Option A: File Picker Dialog */}
            <div className="p-5 rounded-lg bg-[#0d0f12] border border-[#22252c] text-center space-y-3">
              <FolderOpen className="w-8 h-8 text-blue-400 mx-auto" />
              <div className="text-xs font-medium text-zinc-200">Browse filesystem for GGUF file</div>
              <button
                onClick={handleBrowseAndImport}
                disabled={isImporting}
                className="px-5 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>{isImporting ? 'Importing...' : 'Browse & Select File...'}</span>
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 text-xs text-zinc-500 font-mono">
              <div className="flex-1 h-px bg-[#20232a]" />
              <span>OR ENTER FILEPATH MANUALLY</span>
              <div className="flex-1 h-px bg-[#20232a]" />
            </div>

            {/* Option B: Direct Path Input */}
            <form onSubmit={handleManualImport} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-300 font-medium">Absolute File Path to .gguf</label>
                <input
                  type="text"
                  placeholder="/Users/username/models/my-model-q4_k_m.gguf"
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                  className="w-full bg-[#0d0f12] border border-[#23262f] rounded px-3 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-zinc-300 font-medium">Model Display Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Caden SQL 1.5B"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full bg-[#0d0f12] border border-[#23262f] rounded px-3 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={isImporting || !customPath.trim()}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-md transition-colors disabled:opacity-40"
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
            <div className="p-3 rounded-lg bg-blue-950/40 border border-blue-800/40 flex items-center justify-between text-xs text-blue-300">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
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
                  className="p-5 rounded-lg bg-[#111317] border border-[#22252c] flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-sm text-zinc-100 flex items-center gap-2 flex-wrap">
                          <span>{model.name}</span>
                          {model.taskType === 'image-generation' || model.capabilities.includes('IMAGE_GENERATION') ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20 font-semibold">
                              IMAGE GEN
                            </span>
                          ) : model.capabilities.includes('VISION') ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-300 border border-blue-500/20 font-semibold">
                              VISION
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700/40 font-semibold">
                              TEXT
                            </span>
                          )}
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1f2229] text-zinc-400">
                            {model.parameterCount}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-500 font-mono mt-0.5">{model.publisher}</div>
                      </div>
                      {analysis && getRatingBadge(analysis.rating)}
                    </div>

                    <p className="text-xs text-zinc-400 mt-3 line-clamp-2 leading-relaxed">
                      {model.description}
                    </p>

                    {/* Mathematical compatibility reason */}
                    {analysis && (
                      <div className="mt-3 p-2.5 rounded bg-[#0d0f12] border border-[#1b1e25] text-[11px] space-y-1">
                        <div className="text-zinc-300 font-medium">{analysis.reason}</div>
                        <div className="text-zinc-500 font-mono text-[10px]">
                          {isLowMemoryActive ? 'Active Working RAM' : 'Full RAM Req'}: ~{(analysis.estimatedMemoryBytes / 1e9).toFixed(1)} GB | GPU Offload:{' '}
                          {analysis.recommendedGpuLayers} layers
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[#1c1f26] space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-mono text-zinc-400">
                        {(variant.sizeBytes / 1e9).toFixed(2)} GB • {variant.quantization}
                      </div>

                      {isInstalled ? (
                        <button
                          onClick={() => setActiveTab('installed')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-xs font-medium"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Installed ✓</span>
                        </button>
                      ) : activeDownload ? (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-950/70 border border-blue-700/50 text-blue-300 text-xs font-medium font-mono">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                            <span>
                              Downloading {activeDownload.totalBytes > 0 ? `${Math.round((activeDownload.downloadedBytes / activeDownload.totalBytes) * 100)}%` : '...'}
                            </span>
                          </div>
                          <button
                            onClick={() => cancelDownload(activeDownload.id)}
                            className="px-2.5 py-1.5 rounded bg-rose-950/60 hover:bg-rose-900/70 border border-rose-800/50 text-rose-300 hover:text-white text-xs font-medium transition-colors"
                            title="Cancel download"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : isPending ? (
                        <button
                          disabled
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-900/60 text-blue-200 text-xs font-medium cursor-not-allowed opacity-90"
                        >
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-300" />
                          <span>Starting...</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDownload(model, variant)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                      )}
                    </div>

                    {activeDownload && (
                      <div className="space-y-1 pt-1">
                        <div className="h-1.5 w-full bg-[#1b1e26] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{
                              width: `${
                                activeDownload.totalBytes > 0
                                  ? Math.min(100, Math.round((activeDownload.downloadedBytes / activeDownload.totalBytes) * 100))
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
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
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search Hugging Face GGUF models (e.g. Qwen, DeepSeek, Gemma, Phi)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#111317] border border-[#22252c] rounded-md pl-9 pr-4 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={isSearchingHf}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-md transition-colors disabled:opacity-50"
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
                  className="p-5 rounded-lg bg-[#111317] border border-[#22252c] flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="font-semibold text-sm text-zinc-100">{model.name}</div>
                    <div className="text-xs text-zinc-500 font-mono">{model.publisher}</div>
                    <p className="text-xs text-zinc-400 mt-2 line-clamp-2">{model.description}</p>
                  </div>

                  <div className="pt-3 border-t border-[#1c1f26] space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-mono text-zinc-400">
                        {variant.quantization} • {variant.format.toUpperCase()}
                      </div>
                      {isInstalled ? (
                        <button
                          disabled
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-xs font-medium"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Installed ✓</span>
                        </button>
                      ) : activeDownload ? (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-950/70 border border-blue-700/50 text-blue-300 text-xs font-medium font-mono">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                            <span>
                              Downloading {activeDownload.totalBytes > 0 ? `${Math.round((activeDownload.downloadedBytes / activeDownload.totalBytes) * 100)}%` : '...'}
                            </span>
                          </div>
                          <button
                            onClick={() => cancelDownload(activeDownload.id)}
                            className="px-2.5 py-1.5 rounded bg-rose-950/60 hover:bg-rose-900/70 border border-rose-800/50 text-rose-300 hover:text-white text-xs font-medium transition-colors"
                            title="Cancel download"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : isPending ? (
                        <button
                          disabled
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-900/60 text-blue-200 text-xs font-medium cursor-not-allowed opacity-90"
                        >
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-300" />
                          <span>Starting...</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDownload(model, variant)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download GGUF</span>
                        </button>
                      )}
                    </div>

                    {activeDownload && (
                      <div className="space-y-1 pt-1">
                        <div className="h-1.5 w-full bg-[#1b1e26] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 transition-all duration-300"
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
