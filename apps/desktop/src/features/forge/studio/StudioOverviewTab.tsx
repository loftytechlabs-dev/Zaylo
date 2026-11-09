import React from 'react';
import {
  Cpu,
  Clock,
  Database,
  Sliders,
  Bookmark,
  Activity,
  AlertCircle,
} from 'lucide-react';
import type { TrainingJob, TrainingMetricSample } from '@local-ai/shared';

interface StudioOverviewTabProps {
  job: TrainingJob;
}

export const StudioOverviewTab: React.FC<StudioOverviewTabProps> = ({ job }) => {
  const config = job.config;
  const metricsHistory = Array.isArray(job.metricsHistory) ? job.metricsHistory : [];
  const checkpoints = Array.isArray(job.checkpoints) ? job.checkpoints : [];
  const latestSample: TrainingMetricSample | undefined =
    metricsHistory.length > 0 ? metricsHistory[metricsHistory.length - 1] : undefined;
  const latestCheckpoint = checkpoints.length > 0 ? checkpoints[checkpoints.length - 1] : undefined;

  const progressPct =
    job.totalSteps > 0 ? Math.min(100, Math.round((job.currentStep / job.totalSteps) * 100)) : 0;

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '—';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const formatSeconds = (sec?: number) => {
    if (sec === undefined || sec === null || !Number.isFinite(sec) || sec < 0) return '—';
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    if (m === 0) return `${s}s`;
    if (m < 60) return `${m}m ${s}s`;
    const h = Math.floor(m / 60);
    const remM = m % 60;
    return `${h}h ${remM}m`;
  };

  // Calculate actual elapsed duration
  const elapsedSec =
    latestSample?.elapsedSeconds ??
    (job.startedAt ? Math.max(0, Math.round(((job.completedAt || Date.now()) - job.startedAt) / 1000)) : 0);

  // Remaining time
  let remainingSec = latestSample?.estimatedRemainingSeconds;
  if (remainingSec === undefined && job.status === 'TRAINING' && elapsedSec > 0 && job.currentStep > 0) {
    const secPerStep = elapsedSec / job.currentStep;
    const remainingSteps = Math.max(0, job.totalSteps - job.currentStep);
    remainingSec = Math.round(secPerStep * remainingSteps);
  }

  // Disk consumption: calculate actual size from checkpoints if available, else estimate
  const checkpointsTotalBytes = checkpoints.reduce((acc, c) => acc + (c.sizeBytes || 0), 0);
  const diskUsageBytes =
    checkpointsTotalBytes > 0 ? checkpointsTotalBytes : job.estimates?.estimatedDiskBytes || 0;

  const acceleration = job.estimates?.acceleration || 'mps';
  const accelerationLabel =
    acceleration === 'mps'
      ? 'Apple Silicon MPS (Metal)'
      : acceleration === 'cuda'
      ? 'NVIDIA CUDA GPU'
      : 'CPU Multi-Threading';

  return (
    <div className="space-y-6">
      {/* Failure Banner */}
      {job.status === 'FAILED' && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
          <div className="space-y-1 text-sm flex-1">
            <div className="font-semibold text-red-200">Training Execution Failed</div>
            <div className="text-red-300 text-xs font-mono bg-red-950/60 p-2.5 rounded border border-red-500/20 break-words">
              {job.error || 'The training worker process terminated unexpectedly. Check the Training Logs tab for details.'}
            </div>
            {job.datasetRecords === 0 && (
              <div className="text-amber-300 text-xs mt-1">
                Tip: 0 dataset records were tokenized. Ensure your dataset columns are mapped correctly to Prompt / Response pairs.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top Stat Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Progress Card */}
        <div className="p-4 rounded-xl bg-[#101216] border border-[#1e2128] space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-medium">Job Progress</span>
            <span className="font-mono text-zinc-900 dark:text-zinc-100 font-semibold">{progressPct}%</span>
          </div>
          <div className="text-xl font-bold font-mono text-zinc-100">
            Step {job.currentStep}{' '}
            <span className="text-xs font-normal text-zinc-500">/ {job.totalSteps}</span>
          </div>
          <div className="h-1.5 w-full bg-[#1b1e24] rounded-full overflow-hidden">
            <div
              className="h-full bg-black dark:bg-white rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="text-[11px] text-zinc-400 font-mono">
            Epoch {job.currentEpoch} / {job.totalEpochs}
          </div>
        </div>

        {/* Current Loss Card */}
        <div className="p-4 rounded-xl bg-[#101216] border border-[#1e2128] space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-medium">Current Training Loss</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-zinc-100">
            {typeof job.currentLoss === 'number' && !isNaN(job.currentLoss) ? job.currentLoss.toFixed(4) : '—'}
          </div>
          <div className="text-[11px] text-zinc-400 flex items-center justify-between">
            <span>
              {typeof latestSample?.evalLoss === 'number' && !isNaN(latestSample.evalLoss)
                ? `Val Loss: ${latestSample.evalLoss.toFixed(4)}`
                : 'Validation: pending'}
            </span>
            {typeof latestSample?.tokenAccuracy === 'number' && !isNaN(latestSample.tokenAccuracy) && (
              <span className="text-cyan-400 font-mono">
                {(latestSample.tokenAccuracy * 100).toFixed(1)}% acc
              </span>
            )}
          </div>
        </div>

        {/* Time Card */}
        <div className="p-4 rounded-xl bg-[#101216] border border-[#1e2128] space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-medium">Execution Time</span>
            <Clock className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
          </div>
          <div className="text-xl font-bold font-mono text-zinc-100">
            {formatSeconds(elapsedSec)}
          </div>
          <div className="text-[11px] text-zinc-400">
            {job.status === 'COMPLETED' ? (
              <span className="text-emerald-400 font-medium">Completed</span>
            ) : job.status === 'TRAINING' && remainingSec !== undefined ? (
              <span>
                Est. remaining: <strong className="text-zinc-300">{formatSeconds(remainingSec)}</strong>
              </span>
            ) : (
              <span>Job is {job.status.toLowerCase()}</span>
            )}
          </div>
        </div>

        {/* Latest Checkpoint Card */}
        <div className="p-4 rounded-xl bg-[#101216] border border-[#1e2128] space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-medium">Latest Checkpoint</span>
            <Bookmark className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-zinc-100">
            {latestCheckpoint ? `Step ${latestCheckpoint.step}` : 'None saved'}
          </div>
          <div className="text-[11px] text-zinc-400 truncate">
            {latestCheckpoint
              ? `${formatBytes(latestCheckpoint.sizeBytes)} • Saved ${new Date(
                  latestCheckpoint.createdAt
                ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : `Auto-saves every ${config?.saveSteps || 25} steps`}
          </div>
        </div>
      </div>

      {/* Resource Utilization Section */}
      <div className="p-5 rounded-xl bg-[#101216] border border-[#1e2128] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
            <h3 className="text-sm font-semibold text-zinc-100">Hardware Resource Usage</h3>
          </div>
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700">
            {accelerationLabel}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* CPU Meter */}
          <div className="p-3.5 rounded-lg bg-[#14161b] border border-[#20232a] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">CPU Compute</span>
              <span className="font-mono font-semibold text-zinc-200">
                {typeof latestSample?.cpuPercent === 'number' && !isNaN(latestSample.cpuPercent)
                  ? `${latestSample.cpuPercent.toFixed(1)}%`
                  : 'Active'}
              </span>
            </div>
            <div className="h-2 w-full bg-[#1b1e24] rounded-full overflow-hidden">
              <div
                className="h-full bg-black dark:bg-white rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(5, latestSample?.cpuPercent || 35))}%` }}
              />
            </div>
            <div className="text-[11px] text-zinc-500">
              Multi-threaded tensor operations
            </div>
          </div>

          {/* RAM Meter */}
          <div className="p-3.5 rounded-lg bg-[#14161b] border border-[#20232a] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">Process Memory (RAM)</span>
              <span className="font-mono font-semibold text-zinc-200">
                {formatBytes(latestSample?.memoryBytes || job.estimates?.estimatedMemoryBytes)}
              </span>
            </div>
            <div className="h-2 w-full bg-[#1b1e24] rounded-full overflow-hidden">
              <div
                className="h-full bg-black dark:bg-white rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      ((latestSample?.memoryBytes || 1024 * 1024 * 1024) /
                        (job.estimates?.availableMemoryBytes || 16 * 1024 * 1024 * 1024)) *
                        100
                    )
                  )}%`,
                }}
              />
            </div>
            <div className="text-[11px] text-zinc-500">
              Allocated for PyTorch model weights & activations
            </div>
          </div>

          {/* Storage Meter */}
          <div className="p-3.5 rounded-lg bg-[#14161b] border border-[#20232a] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">Disk Consumption</span>
              <span className="font-mono font-semibold text-zinc-200">
                {formatBytes(diskUsageBytes)}
              </span>
            </div>
            <div className="h-2 w-full bg-[#1b1e24] rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(
                      5,
                      Math.round(
                        (diskUsageBytes /
                          (job.estimates?.availableDiskBytes || 50 * 1024 * 1024 * 1024)) *
                          100
                      )
                    )
                  )}%`,
                }}
              />
            </div>
            <div className="text-[11px] text-zinc-500">
              {checkpoints.length} checkpoint{checkpoints.length === 1 ? '' : 's'} stored on disk
            </div>
          </div>
        </div>
      </div>

      {/* Hyperparameters & Job Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model & Dataset Details */}
        <div className="p-5 rounded-xl bg-[#101216] border border-[#1e2128] space-y-4">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Model & Dataset Setup</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-start justify-between py-1.5 border-b border-[#1b1e24]">
              <span className="text-zinc-400">Base Model:</span>
              <span className="font-medium text-zinc-200 text-right">{job.modelName}</span>
            </div>
            <div className="flex items-start justify-between py-1.5 border-b border-[#1b1e24]">
              <span className="text-zinc-400">Base Weights:</span>
              <span className="font-mono text-[11px] text-zinc-300 truncate max-w-[280px]" title={job.checkpointPath}>
                {job.checkpointPath}
              </span>
            </div>
            <div className="flex items-start justify-between py-1.5 border-b border-[#1b1e24]">
              <span className="text-zinc-400">Fine-Tuning Method:</span>
              <span className="font-medium text-zinc-200">
                LoRA (Rank {config.loraRank}, Alpha {config.loraAlpha})
              </span>
            </div>
            <div className="flex items-start justify-between py-1.5 border-b border-[#1b1e24]">
              <span className="text-zinc-400">Training Objective:</span>
              <span className="font-medium text-zinc-200 capitalize">{config.objective}</span>
            </div>
            <div className="flex items-start justify-between py-1.5 border-b border-[#1b1e24]">
              <span className="text-zinc-400">Dataset Name & Records:</span>
              <span className="font-medium text-zinc-200">
                {config.datasetName || 'Dataset'} ({job.datasetRecords.toLocaleString()} records)
              </span>
            </div>
            <div className="flex items-start justify-between py-1.5 border-b border-[#1b1e24]">
              <span className="text-zinc-400">Train / Validation Split:</span>
              <span className="font-medium text-zinc-200">
                {Math.round((1 - config.trainValSplit) * 100)}% Train /{' '}
                {Math.round(config.trainValSplit * 100)}% Validation
              </span>
            </div>
            <div className="flex items-start justify-between py-1.5">
              <span className="text-zinc-400">Output Directory:</span>
              <span className="font-mono text-[11px] text-zinc-300 truncate max-w-[280px]" title={job.outputDir}>
                {job.outputDir}
              </span>
            </div>
          </div>
        </div>

        {/* Hyperparameter Configuration */}
        <div className="p-5 rounded-xl bg-[#101216] border border-[#1e2128] space-y-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
            <h3 className="text-sm font-semibold text-zinc-100">Hyperparameters</h3>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-[#14161b] border border-[#20232a]">
              <div className="text-zinc-500 text-[11px]">Learning Rate</div>
              <div className="font-mono font-semibold text-zinc-200 mt-0.5">
                {config.learningRate}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#14161b] border border-[#20232a]">
              <div className="text-zinc-500 text-[11px]">Optimizer</div>
              <div className="font-mono font-semibold text-zinc-200 mt-0.5">
                {config.optimizer || 'adamw_torch'}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#14161b] border border-[#20232a]">
              <div className="text-zinc-500 text-[11px]">Batch Size</div>
              <div className="font-mono font-semibold text-zinc-200 mt-0.5">
                {config.batchSize} (Eff. {config.batchSize * (config.gradientAccumulationSteps || 1)})
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#14161b] border border-[#20232a]">
              <div className="text-zinc-500 text-[11px]">Grad Accumulation</div>
              <div className="font-mono font-semibold text-zinc-200 mt-0.5">
                {config.gradientAccumulationSteps || 1} steps
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#14161b] border border-[#20232a]">
              <div className="text-zinc-500 text-[11px]">Max Sequence Length</div>
              <div className="font-mono font-semibold text-zinc-200 mt-0.5">
                {config.maxSeqLength} tokens
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#14161b] border border-[#20232a]">
              <div className="text-zinc-500 text-[11px]">Precision</div>
              <div className="font-mono font-semibold text-zinc-200 mt-0.5">
                {config.precision || 'float32'}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#14161b] border border-[#20232a]">
              <div className="text-zinc-500 text-[11px]">LoRA Dropout</div>
              <div className="font-mono font-semibold text-zinc-200 mt-0.5">
                {config.loraDropout}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#14161b] border border-[#20232a]">
              <div className="text-zinc-500 text-[11px]">Target Modules</div>
              <div className="font-mono font-semibold text-zinc-200 mt-0.5 truncate" title={config.targetModules?.join(', ')}>
                {config.targetModules?.join(', ') || 'q_proj, v_proj'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
