import React, { useState } from 'react';
import {
  Bookmark,
  AlertTriangle,
  RotateCw,
  Copy,
  Check,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import type { TrainingJob, TrainingCheckpoint } from '@local-ai/shared';

interface StudioCheckpointsTabProps {
  job: TrainingJob;
  onResumeFromCheckpoint: (step: number) => Promise<void>;
  onRefresh?: () => void;
}

export const StudioCheckpointsTab: React.FC<StudioCheckpointsTabProps> = ({
  job,
  onResumeFromCheckpoint,
  onRefresh,
}) => {
  const [resumingStep, setResumingStep] = useState<number | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const checkpoints = Array.isArray(job.checkpoints) ? job.checkpoints : [];
  const isTrainingActive = job.status === 'TRAINING' || job.status === 'INITIALIZING';

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '—';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const handleCopyPath = async (p: string) => {
    try {
      await navigator.clipboard.writeText(p);
      setCopiedPath(p);
      setTimeout(() => setCopiedPath(null), 2000);
    } catch {
      // Ignored
    }
  };

  const handleResume = async (ckpt: TrainingCheckpoint) => {
    if (isTrainingActive) {
      alert('Training is currently active. Pause or stop the current run before resuming from a checkpoint.');
      return;
    }

    if (ckpt.recoverable === false) {
      alert('This checkpoint cannot be resumed because its adapter weights file is missing or corrupted.');
      return;
    }

    const confirmMsg = `Resume training from Step ${ckpt.step}?\n\nThis will re-launch the PyTorch training worker using the exact weights and optimizer state saved at step ${ckpt.step}.`;
    if (!confirm(confirmMsg)) return;

    setResumingStep(ckpt.step);
    setActionError(null);

    try {
      await onResumeFromCheckpoint(ckpt.step);
      onRefresh?.();
    } catch (err: any) {
      setActionError(err.message || `Failed to resume from checkpoint step ${ckpt.step}`);
    } finally {
      setResumingStep(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="p-5 rounded-xl bg-[#101216] border border-[#1e2128] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Saved Checkpoints & Weights</h3>
          </div>
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
            {checkpoints.length} checkpoint{checkpoints.length === 1 ? '' : 's'} recorded
          </span>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          Intermediate state weights and optimizer checkpoints are automatically stored in the job's
          working directory every <strong className="text-zinc-200">{job.config.saveSteps}</strong>{' '}
          steps. Verified compatible checkpoints can be restored at any time to resume training
          or inspect intermediate model quality.
        </p>

        {actionError && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {actionError}
          </div>
        )}
      </div>

      {/* Checkpoints List */}
      {checkpoints.length === 0 ? (
        <div className="p-12 rounded-xl bg-[#101216] border border-[#1e2128] text-center space-y-3">
          <Bookmark className="w-8 h-8 text-zinc-600 mx-auto opacity-50" />
          <h4 className="text-xs font-semibold text-zinc-300">No Checkpoints Saved Yet</h4>
          <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
            Checkpoints are saved automatically when the training progress reaches step{' '}
            <strong className="text-zinc-400">{job.config.saveSteps}</strong>,{' '}
            <strong className="text-zinc-400">{job.config.saveSteps * 2}</strong>, etc.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {checkpoints.map((ckpt, idx) => {
            const isRecoverable = ckpt.recoverable !== false;
            const isResumingThis = resumingStep === ckpt.step;

            return (
              <div
                key={ckpt.path || idx}
                className="p-4 rounded-xl bg-[#101216] border border-[#1e2128] hover:border-[#272a33] transition-colors space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700">
                      Step {ckpt.step}
                    </span>

                    {isRecoverable ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <ShieldCheck className="w-3 h-3" />
                        Verified Recoverable
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <AlertTriangle className="w-3 h-3" />
                        Corrupted / Missing Weights
                      </span>
                    )}
                  </div>

                  {/* Resume Action */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleResume(ckpt)}
                      disabled={isTrainingActive || !isRecoverable || isResumingThis}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500 text-white dark:text-black text-xs font-semibold shadow transition-colors"
                      title={
                        isTrainingActive
                          ? 'Pause active training to resume'
                          : !isRecoverable
                          ? 'Checkpoint is unrecoverable'
                          : 'Resume training from this checkpoint step'
                      }
                    >
                      {isResumingThis ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Resuming...</span>
                        </>
                      ) : (
                        <>
                          <RotateCw className="w-3.5 h-3.5" />
                          <span>Resume from Here</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Metadata Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-1">
                  <div className="p-2 rounded-lg bg-[#14161b] border border-[#1f2229]">
                    <div className="text-zinc-500 text-[11px]">Loss at Checkpoint</div>
                    <div className="font-mono font-semibold text-zinc-200 mt-0.5">
                      {typeof ckpt.loss === 'number' && !isNaN(ckpt.loss) ? ckpt.loss.toFixed(4) : '—'}
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-[#14161b] border border-[#1f2229]">
                    <div className="text-zinc-500 text-[11px]">Size on Disk</div>
                    <div className="font-mono font-semibold text-zinc-200 mt-0.5">
                      {formatBytes(ckpt.sizeBytes)}
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-[#14161b] border border-[#1f2229]">
                    <div className="text-zinc-500 text-[11px]">Timestamp</div>
                    <div className="font-mono text-zinc-300 mt-0.5 text-[11px]">
                      {new Date(ckpt.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-[#14161b] border border-[#1f2229]">
                    <div className="text-zinc-500 text-[11px]">Format</div>
                    <div className="font-mono font-semibold text-zinc-200 mt-0.5">
                      PEFT / SafeTensors
                    </div>
                  </div>
                </div>

                {/* Disk Path Bar */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#14161b] border border-[#1f2229] text-[11px] font-mono text-zinc-400">
                  <span className="truncate mr-3 select-all" title={ckpt.path}>
                    {ckpt.path}
                  </span>
                  <button
                    onClick={() => handleCopyPath(ckpt.path)}
                    className="p-1 rounded hover:bg-[#1f2229] text-zinc-400 hover:text-zinc-200 transition-colors shrink-0"
                    title="Copy checkpoint directory path"
                  >
                    {copiedPath === ckpt.path ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
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
