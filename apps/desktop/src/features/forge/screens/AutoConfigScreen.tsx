import React, { useState } from 'react';
import {
  Sliders,
  Sparkles,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
} from 'lucide-react';
import type {
  TrainingConfig,
  HardwareConstraintEstimates,
} from '@local-ai/shared';

interface AutoConfigScreenProps {
  config: TrainingConfig;
  estimates: HardwareConstraintEstimates;
  isAutoConfig: boolean;
  onToggleAutoConfig: (auto: boolean) => void;
  onConfigChange: (updated: Partial<TrainingConfig>) => void;
  onResetAutoConfig: () => void;
  onBack: () => void;
  onContinue: () => void;
}

export const AutoConfigScreen: React.FC<AutoConfigScreenProps> = ({
  config,
  estimates,
  isAutoConfig,
  onToggleAutoConfig,
  onConfigChange,
  onResetAutoConfig,
  onBack,
  onContinue,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(0)} MB`;
    return `${(mb / 1024).toFixed(1)} GB`;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return 'Few seconds';
    if (seconds < 60) return `~${seconds}s`;
    const mins = Math.ceil(seconds / 60);
    return `~${mins} min${mins > 1 ? 's' : ''}`;
  };

  return (
    <div className="h-full flex flex-col p-6 space-y-6 overflow-y-auto">
      {/* Wizard Header */}
      <div className="flex items-center justify-between border-b border-[#202227] pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-900 dark:text-zinc-100">
            <span>Step 3 of 4</span>
            <span>•</span>
            <span>Automatic Configuration</span>
          </div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight mt-0.5">
            Auto-Tuning & Hardware Profiling
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Zaylo profiled your hardware and dataset to generate an optimal, safe fine-tuning plan.
          </p>
        </div>

        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#14161a] border border-[#202227] text-zinc-300 hover:text-white hover:bg-[#1b1e24] text-xs font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dataset</span>
        </button>
      </div>

      {/* Auto Configure Master Banner */}
      <div className="p-5 rounded-xl bg-[#121418] border border-[#eaeaea] dark:border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-zinc-100">Auto Configure</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700">
                RECOMMENDED
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Automatically selects hyperparameters, rank, and sequence length based on hardware limits.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isAutoConfig}
              onChange={(e) => onToggleAutoConfig(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black dark:peer-checked:bg-white"></div>
          </label>

          {!isAutoConfig && (
            <button
              onClick={onResetAutoConfig}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1b1e24] hover:bg-[#252830] border border-[#2e323b] text-zinc-300 text-xs transition-colors"
              title="Reset to recommended auto settings"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Readable Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Model & Method */}
        <div className="p-4 rounded-xl bg-[#121418] border border-[#202227] space-y-1.5">
          <div className="text-[11px] text-zinc-400">Model & Method</div>
          <div className="font-semibold text-xs text-zinc-100 truncate">{config.modelName}</div>
          <div className="text-xs font-mono text-zinc-900 dark:text-zinc-100">
            LoRA (Rank {config.loraRank}, Alpha {config.loraAlpha})
          </div>
        </div>

        {/* Backend & Precision */}
        <div className="p-4 rounded-xl bg-[#121418] border border-[#202227] space-y-1.5">
          <div className="text-[11px] text-zinc-400">Backend & Engine</div>
          <div className="font-semibold text-xs text-zinc-100 font-mono">
            PyTorch + PEFT
          </div>
          <div className="text-xs font-mono text-zinc-900 dark:text-zinc-100">
            Device: {estimates.acceleration.toUpperCase()} ({config.precision})
          </div>
        </div>

        {/* Resource Feasibility */}
        <div className="p-4 rounded-xl bg-[#121418] border border-[#202227] space-y-1.5">
          <div className="text-[11px] text-zinc-400">Estimated Memory</div>
          <div className="font-semibold text-xs text-zinc-100 font-mono">
            {formatBytes(estimates.estimatedMemoryBytes)}
          </div>
          <div className="text-xs font-mono text-zinc-500">
            Available: {formatBytes(estimates.availableMemoryBytes)}
          </div>
        </div>

        {/* Training Duration */}
        <div className="p-4 rounded-xl bg-[#121418] border border-[#202227] space-y-1.5">
          <div className="text-[11px] text-zinc-400">Estimated Duration</div>
          <div className="font-semibold text-xs text-emerald-400 font-mono">
            {formatDuration(estimates.estimatedDurationSeconds)}
          </div>
          <div className="text-xs font-mono text-zinc-500">
            {config.epochs} epochs ({config.epochs * Math.ceil(10 / (config.batchSize * config.gradientAccumulationSteps))} total steps)
          </div>
        </div>
      </div>

      {/* Warnings & Limitations */}
      {estimates.warnings.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Hardware Warnings & Limitations</span>
          </div>
          <ul className="text-xs text-zinc-300 space-y-1 list-disc list-inside font-mono text-[11px]">
            {estimates.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Advanced Settings Expander */}
      <div className="border border-[#202227] rounded-xl overflow-hidden bg-[#101216]">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-[#14161b] transition-colors"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
            <Sliders className="w-4 h-4 text-zinc-400" />
            <span>Advanced Training Hyperparameters</span>
            {!isAutoConfig && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700">
                Customized
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span>{showAdvanced ? 'Hide' : 'Customize Parameters'}</span>
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showAdvanced && (
          <div className="p-5 border-t border-[#1f2228] bg-[#0c0d10] space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Learning Rate */}
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Learning Rate</label>
                <input
                  type="number"
                  step="0.00005"
                  value={config.learningRate}
                  onChange={(e) => onConfigChange({ learningRate: parseFloat(e.target.value) })}
                  className="w-full bg-[#121418] border border-[#202227] rounded-lg p-2 text-xs text-zinc-100 font-mono"
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">Default: 2e-4</span>
              </div>

              {/* LoRA Rank */}
              <div>
                <label className="text-xs text-zinc-400 block mb-1">LoRA Rank (r)</label>
                <select
                  value={config.loraRank}
                  onChange={(e) => {
                    const r = parseInt(e.target.value);
                    onConfigChange({ loraRank: r, loraAlpha: r * 2 });
                  }}
                  className="w-full bg-[#121418] border border-[#202227] rounded-lg p-2 text-xs text-zinc-100 font-mono"
                >
                  <option value={4}>4 (Ultra Lightweight)</option>
                  <option value={8}>8 (Standard Balanced)</option>
                  <option value={16}>16 (High Capacity)</option>
                  <option value={32}>32 (Maximum Capacity)</option>
                </select>
                <span className="text-[10px] text-zinc-500 mt-1 block">Alpha: {config.loraAlpha}</span>
              </div>

              {/* LoRA Dropout */}
              <div>
                <label className="text-xs text-zinc-400 block mb-1">LoRA Dropout</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="0.5"
                  value={config.loraDropout}
                  onChange={(e) => onConfigChange({ loraDropout: parseFloat(e.target.value) })}
                  className="w-full bg-[#121418] border border-[#202227] rounded-lg p-2 text-xs text-zinc-100 font-mono"
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">Prevents overfitting (0.05)</span>
              </div>

              {/* Batch Size */}
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Per-Device Batch Size</label>
                <select
                  value={config.batchSize}
                  onChange={(e) => onConfigChange({ batchSize: parseInt(e.target.value) })}
                  className="w-full bg-[#121418] border border-[#202227] rounded-lg p-2 text-xs text-zinc-100 font-mono"
                >
                  <option value={1}>1 (Safest Memory)</option>
                  <option value={2}>2 (Faster)</option>
                  <option value={4}>4 (Requires High RAM)</option>
                </select>
              </div>

              {/* Gradient Accumulation */}
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Gradient Accumulation Steps</label>
                <input
                  type="number"
                  min="1"
                  max="32"
                  value={config.gradientAccumulationSteps}
                  onChange={(e) => onConfigChange({ gradientAccumulationSteps: parseInt(e.target.value) })}
                  className="w-full bg-[#121418] border border-[#202227] rounded-lg p-2 text-xs text-zinc-100 font-mono"
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">Effective batch: {config.batchSize * config.gradientAccumulationSteps}</span>
              </div>

              {/* Sequence Length */}
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Max Sequence Length</label>
                <select
                  value={config.maxSeqLength}
                  onChange={(e) => onConfigChange({ maxSeqLength: parseInt(e.target.value) })}
                  className="w-full bg-[#121418] border border-[#202227] rounded-lg p-2 text-xs text-zinc-100 font-mono"
                >
                  <option value={256}>256 tokens</option>
                  <option value={512}>512 tokens</option>
                  <option value={1024}>1024 tokens</option>
                  <option value={2048}>2048 tokens</option>
                </select>
              </div>

              {/* Epochs */}
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Training Epochs</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={config.epochs}
                  onChange={(e) => onConfigChange({ epochs: parseInt(e.target.value) })}
                  className="w-full bg-[#121418] border border-[#202227] rounded-lg p-2 text-xs text-zinc-100 font-mono"
                />
              </div>

              {/* Precision */}
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Compute Precision</label>
                <select
                  value={config.precision}
                  onChange={(e) => onConfigChange({ precision: e.target.value as any })}
                  className="w-full bg-[#121418] border border-[#202227] rounded-lg p-2 text-xs text-zinc-100 font-mono"
                >
                  <option value="float32">Float32 (Maximum Stability)</option>
                  <option value="float16">Float16 (Half Precision)</option>
                  <option value="bfloat16">BFloat16 (Brain Float)</option>
                </select>
              </div>

              {/* Checkpoint Frequency */}
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Checkpoint Save Frequency</label>
                <input
                  type="number"
                  min="1"
                  value={config.saveSteps}
                  onChange={(e) => onConfigChange({ saveSteps: parseInt(e.target.value) })}
                  className="w-full bg-[#121418] border border-[#202227] rounded-lg p-2 text-xs text-zinc-100 font-mono"
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">Save every N optimizer steps</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Footer */}
      <div className="border-t border-[#202227] pt-4 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#14161a] border border-[#202227] text-zinc-300 hover:text-white hover:bg-[#1b1e24] text-xs font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <button
          onClick={onContinue}
          disabled={!estimates.isFeasible}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black font-medium text-xs shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span>Continue to Preflight Review</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
