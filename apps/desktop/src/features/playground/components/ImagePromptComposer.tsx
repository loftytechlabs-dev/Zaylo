import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Sliders,
  ChevronUp,
  ChevronDown,
  Dices,
  X,
  Ratio,
} from 'lucide-react';
import type { ImageGenerationParams, ImageResolution } from '@local-ai/shared';
import type { UnifiedModelOption } from '../types';
import { STANDARD_IMAGE_RESOLUTIONS } from '@local-ai/capabilities';

interface ImagePromptComposerProps {
  selectedModel: UnifiedModelOption;
  isGenerating: boolean;
  onGenerate: (params: ImageGenerationParams) => Promise<void>;
  onCancel: () => void;
  externalPrompt?: string;
  onClearExternalPrompt?: () => void;
  resetTrigger?: number;
}

export const ImagePromptComposer: React.FC<ImagePromptComposerProps> = ({
  selectedModel,
  isGenerating,
  onGenerate,
  onCancel,
  externalPrompt,
  onClearExternalPrompt,
  resetTrigger,
}) => {
  const profile = selectedModel.imageProfile;
  const imageMeta = profile?.imageParameters;

  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [showNegative, setShowNegative] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Settings
  const [width, setWidth] = useState(imageMeta?.defaultWidth || 512);
  const [height, setHeight] = useState(imageMeta?.defaultHeight || 512);
  const [steps, setSteps] = useState(imageMeta?.defaultSteps || 20);
  const [guidanceScale, setGuidanceScale] = useState(imageMeta?.defaultGuidanceScale || 7.5);
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 2147483647));
  const [useRandomSeed, setUseRandomSeed] = useState(true);
  const [batchSize, setBatchSize] = useState(1);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync when selected model changes
  useEffect(() => {
    if (imageMeta) {
      setWidth(imageMeta.defaultWidth);
      setHeight(imageMeta.defaultHeight);
      setSteps(imageMeta.defaultSteps);
      setGuidanceScale(imageMeta.defaultGuidanceScale);
    }
  }, [selectedModel.id, imageMeta]);

  // Sync external prompt (e.g. from clicking an inspiration prompt)
  useEffect(() => {
    if (externalPrompt) {
      setPrompt(externalPrompt);
      onClearExternalPrompt?.();
      textareaRef.current?.focus();
    }
  }, [externalPrompt, onClearExternalPrompt]);

  // Handle New Canvas reset
  useEffect(() => {
    if (resetTrigger && resetTrigger > 0) {
      setPrompt('');
      setNegativePrompt('');
      setShowNegative(false);
      setShowAdvanced(false);
      if (imageMeta) {
        setWidth(imageMeta.defaultWidth);
        setHeight(imageMeta.defaultHeight);
        setSteps(imageMeta.defaultSteps);
        setGuidanceScale(imageMeta.defaultGuidanceScale);
      }
      setSeed(Math.floor(Math.random() * 2147483647));
      setUseRandomSeed(true);
      textareaRef.current?.focus();
    }
  }, [resetTrigger, imageMeta]);

  const resolutions: ImageResolution[] = imageMeta?.supportedResolutions || STANDARD_IMAGE_RESOLUTIONS.slice(0, 4);
  const supportsNegative = imageMeta?.supportsNegativePrompt !== false;
  const supportsCFG = imageMeta?.supportsGuidanceScale !== false;

  const handleRandomizeSeed = () => {
    setSeed(Math.floor(Math.random() * 2147483647));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    const actualSeed = useRandomSeed ? Math.floor(Math.random() * 2147483647) : seed;
    if (useRandomSeed) {
      setSeed(actualSeed);
    }

    await onGenerate({
      prompt: prompt.trim(),
      negativePrompt: supportsNegative && negativePrompt.trim() ? negativePrompt.trim() : undefined,
      width,
      height,
      steps,
      guidanceScale: supportsCFG ? guidanceScale : 1.0,
      seed: actualSeed,
      batchSize,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-[#eaeaea] dark:border-[#222222] bg-white dark:bg-[#090909] px-6 py-4 space-y-3.5 shrink-0 select-none">
      {/* Top Bar: Dimension Presets and Options Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Aspect Ratio / Dimension Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          <span className="text-[#888888] dark:text-[#737373] text-[11px] font-mono mr-1 flex items-center gap-1">
            <Ratio className="w-3 h-3" />
            <span>Size:</span>
          </span>
          {resolutions.map((res) => {
            const isActive = width === res.width && height === res.height;
            return (
              <button
                key={`${res.width}x${res.height}`}
                type="button"
                onClick={() => {
                  setWidth(res.width);
                  setHeight(res.height);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors border ${
                  isActive
                    ? 'bg-black dark:bg-white border-black dark:border-white text-white dark:text-black font-semibold'
                    : 'bg-[#fafafa] dark:bg-[#141414] border-[#eaeaea] dark:border-[#262626] text-[#666666] dark:text-[#a1a1aa] hover:text-black dark:hover:text-white'
                }`}
              >
                {res.label}
              </button>
            );
          })}
        </div>

        {/* Toggles: Negative Prompt & Advanced Parameters */}
        <div className="flex items-center gap-2">
          {supportsNegative && (
            <button
              type="button"
              onClick={() => setShowNegative(!showNegative)}
              className={`px-2.5 py-1 rounded-lg border text-xs transition-colors ${
                showNegative || negativePrompt.trim()
                  ? 'bg-black dark:bg-white border-black dark:border-white text-white dark:text-black'
                  : 'bg-[#fafafa] dark:bg-[#141414] border-[#eaeaea] dark:border-[#262626] text-[#666666] dark:text-[#a1a1aa] hover:text-black dark:hover:text-white'
              }`}
            >
              Negative Prompt
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-colors ${
              showAdvanced
                ? 'bg-black dark:bg-white border-black dark:border-white text-white dark:text-black'
                : 'bg-[#fafafa] dark:bg-[#141414] border-[#eaeaea] dark:border-[#262626] text-[#666666] dark:text-[#a1a1aa] hover:text-black dark:hover:text-white'
            }`}
          >
            <Sliders className="w-3 h-3" />
            <span>Settings</span>
            {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Negative Prompt Expandable Box */}
      {showNegative && supportsNegative && (
        <div className="p-3 rounded-xl bg-[#fafafa] dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] space-y-1 animate-in fade-in duration-200">
          <label className="text-[10px] font-mono text-[#888888] dark:text-[#737373] uppercase tracking-wider block">
            Negative Prompt (Elements to avoid)
          </label>
          <input
            type="text"
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            placeholder="e.g. blurry, low quality, artifacts, distorted, extra limbs, watermark"
            className="w-full bg-transparent border-0 text-xs text-[#111111] dark:text-[#f5f5f5] placeholder-[#888888] dark:placeholder-[#737373] focus:outline-none"
          />
        </div>
      )}

      {/* Advanced Parameters Expandable Drawer */}
      {showAdvanced && (
        <div className="p-4 rounded-xl bg-[#fafafa] dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono animate-in fade-in duration-200">
          {/* Steps Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[#666666] dark:text-[#a1a1aa] text-[11px]">
              <span>Denoising Steps</span>
              <span className="text-[#111111] dark:text-[#f5f5f5] font-semibold">{steps}</span>
            </div>
            <input
              type="range"
              min={imageMeta?.minSteps || 1}
              max={imageMeta?.maxSteps || 50}
              value={steps}
              onChange={(e) => setSteps(parseInt(e.target.value, 10))}
              className="w-full accent-black dark:accent-white h-1.5 bg-[#eaeaea] dark:bg-[#262626] rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-[#888888] dark:text-[#737373]">
              <span>{imageMeta?.minSteps || 1} min</span>
              <span>{imageMeta?.defaultSteps || 20} rec</span>
              <span>{imageMeta?.maxSteps || 50} max</span>
            </div>
          </div>

          {/* Guidance Scale (CFG) Slider */}
          {supportsCFG ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[#666666] dark:text-[#a1a1aa] text-[11px]">
                <span>Guidance Scale (CFG)</span>
                <span className="text-[#111111] dark:text-[#f5f5f5] font-semibold">{guidanceScale.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={imageMeta?.minGuidanceScale || 0.0}
                max={imageMeta?.maxGuidanceScale || 15.0}
                step="0.5"
                value={guidanceScale}
                onChange={(e) => setGuidanceScale(parseFloat(e.target.value))}
                className="w-full accent-black dark:accent-white h-1.5 bg-[#eaeaea] dark:bg-[#262626] rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-[#888888] dark:text-[#737373]">
                <span>{imageMeta?.minGuidanceScale || 0}</span>
                <span>{imageMeta?.defaultGuidanceScale || 7.5} rec</span>
                <span>{imageMeta?.maxGuidanceScale || 15}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 text-[#888888] dark:text-[#737373] text-[11px]">
              <span>Guidance Scale</span>
              <div className="text-[#666666] dark:text-[#a1a1aa] mt-1">1.0 (Distilled Turbo)</div>
            </div>
          )}

          {/* Seed Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[#666666] dark:text-[#a1a1aa] text-[11px]">
              <span>Seed</span>
              <button
                type="button"
                onClick={() => setUseRandomSeed(!useRandomSeed)}
                className={`text-[10px] ${useRandomSeed ? 'text-black dark:text-white font-semibold' : 'text-[#888888] dark:text-[#737373]'}`}
              >
                {useRandomSeed ? 'Randomized' : 'Fixed'}
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={seed}
                disabled={useRandomSeed}
                onChange={(e) => setSeed(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2 py-1 bg-white dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] rounded text-xs text-[#111111] dark:text-[#f5f5f5] disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleRandomizeSeed}
                className="p-1 rounded bg-white dark:bg-[#191919] hover:bg-[#f5f5f5] dark:hover:bg-[#202020] border border-[#eaeaea] dark:border-[#262626] text-[#666666] dark:text-[#a1a1aa]"
                title="Generate new random seed"
              >
                <Dices className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Batch Size */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[#666666] dark:text-[#a1a1aa] text-[11px]">
              <span>Number of Images</span>
              <span className="text-[#111111] dark:text-[#f5f5f5] font-semibold">{batchSize}</span>
            </div>
            <div className="grid grid-cols-4 gap-1 pt-0.5">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setBatchSize(n)}
                  className={`py-1 rounded text-center text-xs border ${
                    batchSize === n
                      ? 'bg-black dark:bg-white border-black dark:border-white text-white dark:text-black font-semibold'
                      : 'bg-white dark:bg-[#191919] border-[#eaeaea] dark:border-[#262626] text-[#666666] dark:text-[#a1a1aa]'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Composer Box */}
      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        <div className="flex-1 relative rounded-xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] focus-within:border-black dark:focus-within:border-white transition-colors p-2.5 shadow-xs">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder={`Describe the image you want ${selectedModel.name} to generate... (Press Cmd+Enter to run)`}
            className="w-full bg-transparent resize-none text-xs text-[#111111] dark:text-[#f5f5f5] placeholder-[#888888] dark:placeholder-[#737373] focus:outline-none leading-relaxed"
          />
        </div>

        {/* Action Button: Generate or Cancel */}
        {isGenerating ? (
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors flex items-center gap-2 shadow-xs shrink-0"
          >
            <X className="w-4 h-4" />
            <span>Cancel</span>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!prompt.trim()}
            className="px-6 py-3.5 rounded-xl bg-black dark:bg-white hover:bg-[#222222] dark:hover:bg-[#f0f0f0] disabled:opacity-30 disabled:cursor-not-allowed text-white dark:text-black font-semibold text-xs transition-all flex items-center gap-2 shadow-xs shrink-0"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate</span>
          </button>
        )}
      </form>
    </div>
  );
};
