import React from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  ArrowLeft,
  HardDrive,
  FolderOpen,
  Loader2,
} from 'lucide-react';
import type {
  TrainingConfig,
  PreflightReport,
  HardwareConstraintEstimates,
} from '@local-ai/shared';

interface PreflightReviewScreenProps {
  config: TrainingConfig;
  preflight: PreflightReport | null;
  estimates: HardwareConstraintEstimates;
  isStarting: boolean;
  onSelectOutputDir: () => Promise<void>;
  onStartTraining: () => Promise<void>;
  onBack: () => void;
}

export const PreflightReviewScreen: React.FC<PreflightReviewScreenProps> = ({
  config,
  preflight,
  estimates,
  isStarting,
  onSelectOutputDir,
  onStartTraining,
  onBack,
}) => {
  const canStart = preflight?.canProceed && !isStarting;

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(0)} MB`;
    return `${(mb / 1024).toFixed(1)} GB`;
  };

  return (
    <div className="h-full flex flex-col p-6 space-y-6 overflow-y-auto">
      {/* Wizard Header */}
      <div className="flex items-center justify-between border-b border-[#202227] pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-900 dark:text-zinc-100">
            <span>Step 4 of 4</span>
            <span>•</span>
            <span>Preflight Review</span>
          </div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight mt-0.5">
            Preflight Validation & Job Launch
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Verify training environment readiness, hardware requirements, and output storage before execution.
          </p>
        </div>

        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#14161a] border border-[#202227] text-zinc-300 hover:text-white hover:bg-[#1b1e24] text-xs font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Configuration</span>
        </button>
      </div>

      {/* Main Review Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Preflight Checklist */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-5 rounded-xl bg-[#121418] border border-[#202227] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Automated Preflight Integrity Checks</span>
              </div>

              {preflight && (
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                    preflight.canProceed
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {preflight.canProceed ? 'ALL CHECKS PASSED' : 'CHECK FAILED'}
                </span>
              )}
            </div>

            <div className="space-y-2.5">
              {preflight?.checks.map((check) => {
                const isPassed = check.status === 'passed';
                const isWarning = check.status === 'warning';

                return (
                  <div
                    key={check.id}
                    className={`p-3.5 rounded-lg border transition-colors ${
                      isPassed
                        ? 'bg-[#101216] border-[#1e222a]'
                        : isWarning
                        ? 'bg-amber-500/5 border-amber-500/20'
                        : 'bg-rose-500/5 border-rose-500/20'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {isPassed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : isWarning ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      )}

                      <div className="space-y-1 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-zinc-200">
                            {check.name}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500 uppercase">
                            {check.category}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-300">{check.message}</p>
                        {check.detail && (
                          <p className="text-[11px] text-zinc-500 font-mono truncate">
                            {check.detail}
                          </p>
                        )}
                        {check.remediation && (
                          <p className="text-[11px] text-amber-300/90 border-t border-[#232732] pt-1 mt-1">
                            <strong>Remedy:</strong> {check.remediation}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Output Storage Location */}
          <div className="p-5 rounded-xl bg-[#121418] border border-[#202227] space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
                <span>Job Artifacts Output Directory</span>
              </div>
              <button
                onClick={onSelectOutputDir}
                className="text-xs text-zinc-900 dark:text-zinc-100 hover:underline flex items-center gap-1 transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Change Directory</span>
              </button>
            </div>

            <div className="p-3 rounded-lg bg-[#0c0d10] border border-[#1b1d24] font-mono text-xs text-zinc-300 break-all">
              {config.outputDir}
            </div>
            <p className="text-[11px] text-zinc-500">
              Checkpoints and final LoRA adapter weights will be securely saved into this directory.
            </p>
          </div>
        </div>

        {/* Right: Plan Summary & Start Button */}
        <div className="lg:col-span-1 space-y-4">
          <div className="p-5 rounded-xl bg-[#121418] border border-[#202227] space-y-4">
            <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Training Blueprint
            </div>

            <div className="space-y-3 text-xs border-b border-[#1f2228] pb-4">
              <div className="flex justify-between">
                <span className="text-zinc-400">Model:</span>
                <span className="font-semibold text-zinc-200 text-right truncate max-w-[160px]">
                  {config.modelName}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-zinc-400">Dataset:</span>
                <span className="text-zinc-200 text-right truncate max-w-[160px] font-mono">
                  {config.datasetName}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-zinc-400">Objective:</span>
                <span className="text-zinc-200 capitalize font-mono">{config.objective}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-zinc-400">Fine-Tuning Method:</span>
                <span className="text-zinc-200 font-mono">LoRA</span>
              </div>

              <div className="flex justify-between">
                <span className="text-zinc-400">LoRA Rank (r) / Alpha:</span>
                <span className="text-zinc-200 font-mono">
                  r={config.loraRank}, α={config.loraAlpha}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-zinc-400">Target Modules:</span>
                <span className="text-zinc-300 font-mono text-[11px]">
                  {config.targetModules.join(', ')}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-zinc-400">Batch / Accumulation:</span>
                <span className="text-zinc-200 font-mono">
                  {config.batchSize} / {config.gradientAccumulationSteps}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-zinc-400">Max Sequence Length:</span>
                <span className="text-zinc-200 font-mono">{config.maxSeqLength} tokens</span>
              </div>

              <div className="flex justify-between">
                <span className="text-zinc-400">Training Epochs:</span>
                <span className="text-zinc-200 font-mono">{config.epochs}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-zinc-400">Precision:</span>
                <span className="text-zinc-200 font-mono">{config.precision}</span>
              </div>
            </div>

            {/* Hardware Resources */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-400">Required Memory:</span>
                <span className="text-zinc-200 font-mono">
                  ~{formatBytes(estimates.estimatedMemoryBytes)}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-zinc-400">Estimated Duration:</span>
                <span className="text-emerald-400 font-mono">
                  {estimates.estimatedDurationSeconds
                    ? `~${Math.ceil(estimates.estimatedDurationSeconds / 60)} min`
                    : 'Few minutes'}
                </span>
              </div>
            </div>

            {/* Launch Button */}
            <div className="pt-2">
              <button
                onClick={onStartTraining}
                disabled={!canStart}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black font-semibold text-xs shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isStarting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Launching Fine-Tuning Process...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white dark:fill-black" />
                    <span>Start Fine-Tuning</span>
                  </>
                )}
              </button>

              {!preflight?.canProceed && (
                <p className="text-[11px] text-rose-400 text-center mt-2 leading-relaxed">
                  Fix failed preflight requirements on the left to start training.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
