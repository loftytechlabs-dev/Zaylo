import React, { useState } from 'react';
import {
  Sparkles,
  Trash2,
  GitMerge,
  ArrowLeft,
  AlertCircle,
  RotateCw,
  FolderOpen,
  Loader2,
} from 'lucide-react';
import type { FineTunedModelArtifact } from '@local-ai/shared';

interface FineTunedLibraryScreenProps {
  artifacts: FineTunedModelArtifact[];
  onOpenPlayground: (modelId: string, adapterPath?: string) => void;
  onCompareWithBase: (jobId: string) => void;
  onMergeAdapter: (artifactId: string) => Promise<void>;
  onExport: (artifactId: string) => Promise<void>;
  onDelete: (artifactId: string) => Promise<void>;
  onBack: () => void;
  onRefresh: () => void;
  isMerging: boolean;
}

export const FineTunedLibraryScreen: React.FC<FineTunedLibraryScreenProps> = ({
  artifacts,
  onOpenPlayground,
  onCompareWithBase,
  onMergeAdapter,
  onExport,
  onDelete,
  onBack,
  onRefresh,
  isMerging,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'lora' | 'merged'>('all');
  const [mergingId, setMergingId] = useState<string | null>(null);

  const filteredArtifacts = (artifacts || []).filter((art) => {
    if (filterType === 'all') return true;
    return art.type === filterType;
  });

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleMergeClick = async (artifactId: string) => {
    setMergingId(artifactId);
    try {
      await onMergeAdapter(artifactId);
    } finally {
      setMergingId(null);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#202227] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-zinc-100 tracking-tight">
              Fine-Tuned Models Library
            </h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Manage, evaluate, export, and merge your specialized LoRA adapters and fine-tuned models.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg bg-[#14161a] border border-[#202227] text-zinc-400 hover:text-zinc-200"
            title="Refresh library"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#14161a] border border-[#202227] text-zinc-300 hover:text-white text-xs font-medium transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Forge Home</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-[#121418] p-1 rounded-lg border border-[#202227]">
          {(['all', 'lora', 'merged'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterType(tab)}
              className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                filterType === tab
                  ? 'bg-[#1e222a] text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab === 'all' ? 'All Artifacts' : tab === 'lora' ? 'LoRA Adapters' : 'Merged Models'}
            </button>
          ))}
        </div>

        <div className="text-xs text-zinc-400 font-mono">
          {filteredArtifacts.length} model{filteredArtifacts.length === 1 ? '' : 's'} registered
        </div>
      </div>

      {/* Artifacts List / Grid */}
      {filteredArtifacts.length === 0 ? (
        <div className="p-12 rounded-xl bg-[#101216] border border-[#1f2228] text-center space-y-2">
          <Sparkles className="w-10 h-10 text-zinc-600 mx-auto opacity-50" />
          <div className="text-sm font-semibold text-zinc-300">No fine-tuned models found</div>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Once a training run finishes in Forge, the resulting LoRA adapter or merged weights will be cataloged here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredArtifacts.map((art) => {
            const isLora = art.type === 'lora';
            const isCurrentMerging = mergingId === art.id;

            return (
              <div
                key={art.id}
                className="p-5 rounded-xl bg-[#121418] border border-[#202227] hover:border-[#2e323b] transition-all space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Top line: Name & Type badge */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-zinc-100">{art.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                            isLora
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                          }`}
                        >
                          {isLora ? 'LoRA Adapter' : 'Merged Model'}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400 mt-1">
                        Base Model: <span className="text-zinc-200">{art.baseModelName}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => onDelete(art.id)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete model artifact"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Artifact File Info */}
                  <div className="p-3 rounded-lg bg-[#0c0d10] border border-[#1a1c22] space-y-1.5 font-mono text-[11px]">
                    <div className="text-zinc-500 truncate" title={art.artifactPath}>
                      Path: {art.artifactPath}
                    </div>
                    <div className="flex items-center justify-between text-zinc-400">
                      <span>Size: {formatBytes(art.sizeBytes)}</span>
                      <span>Format: {art.format}</span>
                    </div>
                  </div>

                  {/* LoRA Base Dependency Explainer */}
                  {isLora && (
                    <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[11px] text-zinc-700 dark:text-zinc-300 flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100 shrink-0 mt-0.5" />
                      <span>
                        This LoRA adapter requires base model{' '}
                        <strong className="text-zinc-900 dark:text-zinc-100 font-mono">{art.baseModelName}</strong> to load.
                      </span>
                    </div>
                  )}

                  {/* Metrics & Creation Date */}
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 border-t border-[#1a1c22] pt-2">
                    <div>
                      {typeof art.finalLoss === 'number' && !isNaN(art.finalLoss) && (
                        <span>Final Loss: <strong className="text-zinc-300">{art.finalLoss.toFixed(4)}</strong></span>
                      )}
                    </div>
                    <div>Created {formatDate(art.createdAt)}</div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1a1c22]">
                  <button
                    onClick={() => onCompareWithBase(art.jobId)}
                    className="py-1.5 px-3 rounded-lg bg-[#1b1e24] hover:bg-[#252830] border border-[#2e323b] text-zinc-200 text-xs font-medium text-center transition-colors"
                  >
                    Compare with Base
                  </button>

                  <button
                    onClick={() => onOpenPlayground(art.baseModelId, art.artifactPath)}
                    className="py-1.5 px-3 rounded-lg bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 border border-black dark:border-white text-white dark:text-black text-xs font-medium text-center transition-colors"
                  >
                    Open in Playground
                  </button>

                  {isLora && (
                    <button
                      onClick={() => handleMergeClick(art.id)}
                      disabled={isMerging}
                      className="py-1.5 px-3 rounded-lg bg-[#1b1e24] hover:bg-[#252830] border border-[#2e323b] text-zinc-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      {isCurrentMerging ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Merging...</span>
                        </>
                      ) : (
                        <>
                          <GitMerge className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
                          <span>Merge Adapter</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => onExport(art.id)}
                    className="py-1.5 px-3 rounded-lg bg-[#1b1e24] hover:bg-[#252830] border border-[#2e323b] text-zinc-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Export</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
