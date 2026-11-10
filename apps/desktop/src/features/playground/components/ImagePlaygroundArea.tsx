import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  RotateCw,
  Download,
  FolderOpen,
  Maximize2,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  X,
  Plus,
} from 'lucide-react';
import type { GeneratedImage, ImageGenerationProgress } from '@local-ai/shared';
import type { UnifiedModelOption } from '../types';

interface ImagePlaygroundAreaProps {
  images: GeneratedImage[];
  isGenerating: boolean;
  progress?: ImageGenerationProgress;
  selectedModel: UnifiedModelOption;
  sessionStartTime?: number;
  onSelectSuggestion: (prompt: string, settings?: any) => void;
  onCancelGeneration: () => void;
  onSaveImageAs: (imagePath: string, name?: string) => Promise<any>;
  onOpenFolder: (imagePath: string) => Promise<any>;
  onDeleteImage: (imageId: string) => Promise<void>;
  onOpenLightbox: (image: GeneratedImage) => void;
  onRegenerate: (image: GeneratedImage) => void;
  onResetCanvas?: () => void;
}

const INSPIRATION_PROMPTS = [
  {
    title: 'Cyberpunk Wanderer',
    prompt: 'A cinematic portrait of a neon cyberpunk wanderer in a rainy Tokyo alley at midnight, 8k, photorealistic, intricate lighting',
    tags: ['Portrait', 'Sci-Fi'],
  },
  {
    title: 'Alpine Sanctuary',
    prompt: 'A breathtaking misty alpine lake sanctuary surrounded by ancient pine forests and dramatic snow-capped peaks, sunrise golden hour',
    tags: ['Landscape', 'Nature'],
  },
  {
    title: 'Celestial Observatory',
    prompt: 'An ornate brass astrolabe observatory perched on a cliff edge under a swirling nebula sky, detailed digital concept art',
    tags: ['Architecture', 'Fantasy'],
  },
  {
    title: 'Mechanical Dragonfly',
    prompt: 'Macro photography of an intricate steampunk mechanical dragonfly with filigree wings resting on a dewy emerald leaf',
    tags: ['Macro', 'Steampunk'],
  },
];

export const ImagePlaygroundArea: React.FC<ImagePlaygroundAreaProps> = ({
  images,
  isGenerating,
  progress,
  selectedModel,
  sessionStartTime,
  onSelectSuggestion,
  onCancelGeneration,
  onSaveImageAs,
  onOpenFolder,
  onDeleteImage,
  onOpenLightbox,
  onRegenerate,
  onResetCanvas,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewScope, setViewScope] = useState<'current' | 'all'>('current');

  // Reset viewScope to 'current' when sessionStartTime resets
  useEffect(() => {
    setViewScope('current');
  }, [sessionStartTime]);

  const sessionImages = sessionStartTime
    ? images.filter((img) => img.createdAt >= sessionStartTime)
    : images;

  const displayImages = viewScope === 'current' ? sessionImages : images;

  const handleCopyPrompt = (img: GeneratedImage) => {
    navigator.clipboard.writeText(img.prompt);
    setCopiedId(img.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isModelNotInstalled = !selectedModel.rawInstallation && !selectedModel.rawArtifact;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Model uninstalled warning banner */}
      {isModelNotInstalled && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <div className="text-xs space-y-1">
            <div className="font-semibold text-amber-200">
              {selectedModel.name} is not installed locally
            </div>
            <p className="text-amber-300/80 leading-relaxed">
              To generate images using real local diffusion weights, download this model in the <strong>Models</strong> tab. In the meantime, generation runs via high-fidelity on-device preview mode.
            </p>
          </div>
        </div>
      )}

      {/* Active Generation Banner Card */}
      {isGenerating && (
        <div className="p-5 rounded-2xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] shadow-xl space-y-3.5 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white">
                <RotateCw className="w-4 h-4 animate-spin" />
              </div>
              <div>
                <div className="text-xs font-semibold text-[#111111] dark:text-[#f5f5f5] flex items-center gap-2">
                  <span>Generating Local Diffusion Image</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                    {progress?.percentage || 0}%
                  </span>
                </div>
                <div className="text-[11px] text-[#666666] dark:text-[#a1a1aa] font-mono mt-0.5">
                  {progress?.statusMessage || `Denoising step ${progress?.step || 0} of ${progress?.totalSteps || 20}`}
                  {progress?.elapsedSeconds ? ` • ${progress.elapsedSeconds.toFixed(1)}s elapsed` : ''}
                </div>
              </div>
            </div>

            <button
              onClick={onCancelGeneration}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40 text-xs font-medium transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
          </div>

          {/* Progress Bar */}
          <div className="h-2 w-full bg-[#eaeaea] dark:bg-[#262626] rounded-full overflow-hidden">
            <div
              className="h-full bg-black dark:bg-white rounded-full transition-all duration-200"
              style={{ width: `${Math.max(5, progress?.percentage || 0)}%` }}
            />
          </div>
        </div>
      )}

      {/* Scope Selector & Canvas Management Bar */}
      {images.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#eaeaea] dark:border-[#222222]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs text-[#111111] dark:text-[#f5f5f5]">Canvas</span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              {displayImages.length} {displayImages.length === 1 ? 'image' : 'images'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center p-0.5 rounded-lg bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] text-xs">
              <button
                onClick={() => setViewScope('current')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  viewScope === 'current'
                    ? 'bg-black dark:bg-white text-white dark:text-black shadow-xs'
                    : 'text-[#666666] dark:text-[#a1a1aa] hover:text-black dark:hover:text-white'
                }`}
              >
                Current Canvas ({sessionImages.length})
              </button>
              <button
                onClick={() => setViewScope('all')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  viewScope === 'all'
                    ? 'bg-black dark:bg-white text-white dark:text-black shadow-xs'
                    : 'text-[#666666] dark:text-[#a1a1aa] hover:text-black dark:hover:text-white'
                }`}
              >
                All History ({images.length})
              </button>
            </div>

            {onResetCanvas && (
              <button
                onClick={onResetCanvas}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-[#141414] hover:bg-[#f5f5f5] dark:hover:bg-[#202020] border border-[#eaeaea] dark:border-[#262626] text-[#666666] dark:text-[#a1a1aa] hover:text-[#111111] dark:hover:text-white text-[11px] font-medium transition-colors"
                title="Start a fresh blank canvas"
              >
                <Plus className="w-3.5 h-3.5 text-[#666666] dark:text-[#a1a1aa]" />
                <span>New Canvas</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Empty State / Welcome Screen */}
      {displayImages.length === 0 && !isGenerating && (
        <div className="max-w-2xl mx-auto py-10 text-center space-y-6">
          <div className="inline-flex p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[#111111] dark:text-zinc-200 mb-1 shadow-xs">
            <Sparkles className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl font-bold text-[#111111] dark:text-zinc-100 tracking-tight">
              {viewScope === 'current' && images.length > 0 ? 'Canvas Cleared & Ready' : 'What would you like to create?'}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
              {viewScope === 'current' && images.length > 0
                ? 'Your previous generations are safely preserved in All History. Enter a new prompt below to start painting this canvas.'
                : `Enter a descriptive prompt below to synthesize high-resolution images locally using ${selectedModel.name}.`}
            </p>
          </div>

          {/* Prompt Suggestions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left pt-2">
            {INSPIRATION_PROMPTS.map((item, idx) => (
              <div
                key={idx}
                onClick={() => onSelectSuggestion(item.prompt)}
                className="p-3.5 rounded-xl bg-white dark:bg-[#12141a] hover:bg-zinc-50 dark:hover:bg-[#161822] border border-[#eaeaea] dark:border-[#20232e] hover:border-zinc-400 dark:hover:border-zinc-600 transition-all cursor-pointer group space-y-1.5 shadow-xs"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-black dark:group-hover:text-white transition-colors">
                    {item.title}
                  </span>
                  <div className="flex gap-1">
                    {item.tags.map((t) => (
                      <span key={t} className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#1a1d26] text-zinc-400">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                  "{item.prompt}"
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generated Images Grid */}
      {displayImages.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-medium text-zinc-300">
              {viewScope === 'current' ? `Current Canvas (${displayImages.length})` : `All Images (${displayImages.length})`}
            </span>
            <span className="font-mono text-[11px]">Stored locally in ~/Pictures/Zaylo</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {displayImages.map((img) => (
              <div
                key={img.id}
                className="group relative rounded-2xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] hover:border-black/30 dark:hover:border-white/30 overflow-hidden flex flex-col shadow-xs transition-all"
              >
                {/* Image Container with Hover Overlay */}
                <div className="relative aspect-square bg-[#fafafa] dark:bg-[#090909] overflow-hidden flex items-center justify-center cursor-pointer" onClick={() => onOpenLightbox(img)}>
                  <img
                    src={img.base64Data || `file://${img.localPath}`}
                    alt={img.prompt}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />

                  {/* Hover Quick Action Buttons */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenLightbox(img);
                        }}
                        className="p-1.5 rounded-lg bg-black/60 hover:bg-black text-white border border-white/20 transition-colors"
                        title="View Full Resolution"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenFolder(img.localPath);
                        }}
                        className="p-1.5 rounded-lg bg-black/60 hover:bg-black text-white border border-white/20 transition-colors"
                        title="Show in Folder"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteImage(img.id);
                        }}
                        className="p-1.5 rounded-lg bg-black/60 hover:bg-rose-900 text-white border border-white/20 transition-colors"
                        title="Delete Image"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-white font-mono">
                      <span>{img.width} × {img.height}</span>
                      <span>Seed: {img.seed}</span>
                    </div>
                  </div>
                </div>

                {/* Card Metadata Footer */}
                <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
                  <p className="text-xs text-[#111111] dark:text-[#f5f5f5] line-clamp-2 leading-relaxed" title={img.prompt}>
                    "{img.prompt}"
                  </p>

                  <div className="pt-2 border-t border-[#eaeaea] dark:border-[#222222] flex items-center justify-between text-[11px] font-mono text-[#666666] dark:text-[#a1a1aa]">
                    <span className="truncate max-w-[120px] text-[#888888] dark:text-[#737373]">{img.modelName}</span>
                    <span className="text-emerald-600 dark:text-emerald-400">{(img.durationMs / 1000).toFixed(1)}s</span>
                  </div>

                  {/* Actions Row */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    <button
                      onClick={() => onSaveImageAs(img.localPath, `zaylo_${img.seed}.png`)}
                      className="flex items-center justify-center gap-1 py-1.5 rounded bg-[#f5f5f5] dark:bg-[#191919] hover:bg-[#eaeaea] dark:hover:bg-[#202020] text-[#111111] dark:text-[#f5f5f5] border border-[#eaeaea] dark:border-[#262626] text-[11px] font-medium transition-colors"
                      title="Save Image"
                    >
                      <Download className="w-3 h-3" />
                      <span>Save</span>
                    </button>

                    <button
                      onClick={() => handleCopyPrompt(img)}
                      className="flex items-center justify-center gap-1 py-1.5 rounded bg-[#f5f5f5] dark:bg-[#191919] hover:bg-[#eaeaea] dark:hover:bg-[#202020] text-[#111111] dark:text-[#f5f5f5] border border-[#eaeaea] dark:border-[#262626] text-[11px] font-medium transition-colors"
                      title="Copy Prompt"
                    >
                      {copiedId === img.id ? <Check className="w-3 h-3 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedId === img.id ? 'Copied' : 'Prompt'}</span>
                    </button>

                    <button
                      onClick={() => onRegenerate(img)}
                      className="flex items-center justify-center gap-1 py-1.5 rounded bg-[#f5f5f5] dark:bg-[#191919] hover:bg-[#eaeaea] dark:hover:bg-[#202020] text-[#111111] dark:text-[#f5f5f5] border border-[#eaeaea] dark:border-[#262626] text-[11px] font-medium transition-colors"
                      title="Regenerate Image"
                    >
                      <RotateCw className="w-3 h-3" />
                      <span>Redo</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
