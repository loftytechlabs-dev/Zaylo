import React, { useState } from 'react';
import {
  Boxes,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HardDrive,
  DownloadCloud,
  ArrowRight,
  ArrowLeft,
  Info,
  Loader2,
} from 'lucide-react';
import type { ForgeModelInspection } from '@local-ai/shared';

interface SelectModelScreenProps {
  models: ForgeModelInspection[];
  selectedModel: ForgeModelInspection | null;
  onSelectModel: (model: ForgeModelInspection) => void;
  onFetchCheckpoint: (modelId: string, hfRepoId?: string) => Promise<void>;
  onCustomCheckpointPath: (modelId: string, path: string) => void;
  onBack: () => void;
  onContinue: () => void;
  isFetchingCheckpoint: boolean;
}

export const SelectModelScreen: React.FC<SelectModelScreenProps> = ({
  models,
  selectedModel,
  onSelectModel,
  onFetchCheckpoint,
  onCustomCheckpointPath,
  onBack,
  onContinue,
  isFetchingCheckpoint,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'requires_checkpoint' | 'unsupported'>('all');
  const [customPathInput, setCustomPathInput] = useState('');

  const filteredModels = models.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.modelId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.architecture && m.architecture.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    if (statusFilter === 'ready') return m.status === 'READY';
    if (statusFilter === 'requires_checkpoint') return m.status === 'REQUIRES_CHECKPOINT';
    if (statusFilter === 'unsupported') return m.status === 'UNSUPPORTED' || m.status === 'MISSING_DEPENDENCIES';
    return true;
  });

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const getStatusBadge = (status: ForgeModelInspection['status']) => {
    switch (status) {
      case 'READY':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Ready to fine-tune
          </span>
        );
      case 'REQUIRES_CHECKPOINT':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3 h-3" />
            Requires checkpoint
          </span>
        );
      case 'MISSING_DEPENDENCIES':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3" />
            Missing dependencies
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-800 text-zinc-400">
            <XCircle className="w-3 h-3" />
            Unsupported format
          </span>
        );
    }
  };

  return (
    <div className="h-full flex flex-col p-6 space-y-6 overflow-y-auto">
      {/* Wizard Header */}
      <div className="flex items-center justify-between border-b border-[#202227] pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-900 dark:text-zinc-100">
            <span>Step 1 of 4</span>
            <span>•</span>
            <span>Model Selection</span>
          </div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight mt-0.5">
            Select Model to Fine-Tune
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Choose a downloaded model from your local Zaylo model registry to inspect training compatibility.
          </p>
        </div>

        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#14161a] border border-[#202227] text-zinc-300 hover:text-white hover:bg-[#1b1e24] text-xs font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Home</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search installed models..."
            className="w-full bg-[#121418] border border-[#202227] rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-black dark:focus:border-white transition-colors"
          />
        </div>

        <div className="flex items-center gap-1 bg-[#121418] p-1 rounded-lg border border-[#202227]">
          {(['all', 'ready', 'requires_checkpoint', 'unsupported'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                statusFilter === tab
                  ? 'bg-[#1e222a] text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Models Grid & Inspection Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Left: Models List */}
        <div className="lg:col-span-2 space-y-3 overflow-y-auto pr-1">
          {filteredModels.length === 0 ? (
            <div className="p-8 rounded-xl bg-[#101216] border border-[#1f2228] text-center">
              <Boxes className="w-8 h-8 text-zinc-600 mx-auto mb-2 opacity-50" />
              <div className="text-xs font-medium text-zinc-400">No models match the active filter</div>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Ensure models are downloaded in Zaylo before launching a fine-tuning job.
              </p>
            </div>
          ) : (
            filteredModels.map((model) => {
              const isSelected = selectedModel?.modelId === model.modelId;

              return (
                <div
                  key={model.modelId}
                  onClick={() => onSelectModel(model)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer space-y-3 ${
                    isSelected
                      ? 'bg-zinc-800/40 border-black dark:border-white ring-1 ring-black/20 dark:ring-white/20'
                      : 'bg-[#121418] border-[#202227] hover:border-[#2e323b]'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-zinc-100">{model.name}</span>
                        {getStatusBadge(model.status)}
                      </div>
                      <div className="text-xs text-zinc-400 mt-1 flex items-center gap-2 font-mono">
                        <span>Arch: {model.architecture || 'Llama'}</span>
                        <span>•</span>
                        <span>Params: {model.parameterCount || 'Unknown'}</span>
                        <span>•</span>
                        <span className="uppercase">{model.format}</span>
                        {model.quantization && <span>({model.quantization})</span>}
                      </div>
                    </div>

                    <div className="text-xs font-mono text-zinc-400 flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{formatBytes(model.sizeBytes)}</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-zinc-400 truncate font-mono bg-[#0c0d10] p-2 rounded-lg border border-[#1a1c22]">
                    {model.localPath}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Selected Model Inspection Details */}
        <div className="lg:col-span-1">
          {selectedModel ? (
            <div className="p-5 rounded-xl bg-[#121418] border border-[#202227] space-y-5 sticky top-0">
              <div>
                <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Model Inspection
                </div>
                <h3 className="text-base font-bold text-zinc-100 mt-1">{selectedModel.name}</h3>
                <div className="mt-2">{getStatusBadge(selectedModel.status)}</div>
              </div>

              {/* Status Explanation */}
              <div className="p-3.5 rounded-lg bg-[#0e1013] border border-[#1d2026] space-y-2 text-xs">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-zinc-900 dark:text-zinc-100 shrink-0 mt-0.5" />
                  <p className="text-zinc-300 leading-relaxed">
                    {selectedModel.statusReason ||
                      'Model inspected and verified for fine-tuning.'}
                  </p>
                </div>

                {selectedModel.recommendedResolution && (
                  <p className="text-zinc-400 text-[11px] border-t border-[#1a1c22] pt-2">
                    <strong className="text-zinc-300">Supported Resolution:</strong>{' '}
                    {selectedModel.recommendedResolution}
                  </p>
                )}
              </div>

              {/* Action for REQUIRES_CHECKPOINT */}
              {selectedModel.status === 'REQUIRES_CHECKPOINT' && (
                <div className="space-y-3 p-3.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <div className="text-xs font-semibold text-amber-300">
                    Acquire Compatible Training Weights
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Fine-tuning requires unquantized Safetensors base weights for gradient computation.
                  </p>

                  {selectedModel.hfRepoId && (
                    <button
                      onClick={() =>
                        onFetchCheckpoint(selectedModel.modelId, selectedModel.hfRepoId)
                      }
                      disabled={isFetchingCheckpoint}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-medium text-xs transition-colors disabled:opacity-50"
                    >
                      {isFetchingCheckpoint ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Fetching Checkpoint...</span>
                        </>
                      ) : (
                        <>
                          <DownloadCloud className="w-3.5 h-3.5" />
                          <span>Fetch Training Checkpoint ({selectedModel.hfRepoId})</span>
                        </>
                      )}
                    </button>
                  )}

                  <div className="border-t border-amber-500/20 pt-3 space-y-1.5">
                    <label className="text-[11px] text-zinc-400">Or specify local Safetensors folder:</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={customPathInput}
                        onChange={(e) => setCustomPathInput(e.target.value)}
                        placeholder="/path/to/checkpoint"
                        className="flex-1 bg-[#101216] border border-[#202227] rounded-md px-2.5 py-1 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                      />
                      <button
                        onClick={() => {
                          if (customPathInput.trim()) {
                            onCustomCheckpointPath(selectedModel.modelId, customPathInput.trim());
                          }
                        }}
                        className="px-2.5 py-1 bg-[#1e222a] hover:bg-[#282d38] border border-[#2e323b] text-zinc-200 text-xs rounded-md transition-colors"
                      >
                        Set
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Supported Backends */}
              <div className="space-y-2 border-t border-[#1d2026] pt-3 text-xs">
                <div className="text-zinc-400">Supported Training Backends:</div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedModel.supportedBackends.map((b) => (
                    <span
                      key={b}
                      className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#1a1d24] text-zinc-300 border border-[#252832]"
                    >
                      {b === 'peft' ? 'PyTorch + PEFT (LoRA)' : 'Apple MLX-LM'}
                    </span>
                  ))}
                </div>
              </div>

              {/* Navigation Action */}
              <div className="pt-2">
                <button
                  onClick={onContinue}
                  disabled={selectedModel.status !== 'READY'}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black font-medium text-xs shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>Continue to Dataset Import</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                {selectedModel.status !== 'READY' && (
                  <p className="text-[11px] text-zinc-500 text-center mt-2">
                    Resolve checkpoint requirement above to proceed.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-[#101216] border border-[#1f2228] text-center text-xs text-zinc-500">
              Select a model from the list to view its architecture and training compatibility profile.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
