import React from 'react';
import {
  Flame,
  Plus,
  RotateCw,
  Clock,
  HardDrive,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Activity,
  Trash2,
} from 'lucide-react';
import type { TrainingJob, FineTunedModelArtifact } from '@local-ai/shared';

interface ForgeHomeViewProps {
  jobs: TrainingJob[];
  artifacts: FineTunedModelArtifact[];
  onNewJob: () => void;
  onOpenJob: (jobId: string) => void;
  onOpenResults: (jobId: string) => void;
  onOpenLibrary: () => void;
  onDeleteArtifact: (artifactId: string) => void;
  onRefresh: () => void;
}

export const ForgeHomeView: React.FC<ForgeHomeViewProps> = ({
  jobs,
  artifacts,
  onNewJob,
  onOpenJob,
  onOpenResults,
  onOpenLibrary,
  onDeleteArtifact,
  onRefresh,
}) => {
  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const safeArtifacts = Array.isArray(artifacts) ? artifacts : [];

  const activeJobs = safeJobs.filter(
    (j) => j && (j.status === 'INITIALIZING' || j.status === 'TRAINING' || j.status === 'PAUSED' || j.status === 'QUEUED')
  );

  const recentJobs = safeJobs.filter(
    (j) => j && (j.status === 'COMPLETED' || j.status === 'FAILED' || j.status === 'CANCELLED')
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'TRAINING':
        return (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-black dark:bg-white animate-ping" />
            TRAINING
          </span>
        );
      case 'PAUSED':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
            PAUSED
          </span>
        );
      case 'INITIALIZING':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700">
            INITIALIZING
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            COMPLETED
          </span>
        );
      case 'FAILED':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3 h-3" />
            FAILED
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
            <XCircle className="w-3 h-3" />
            CANCELLED
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-800 text-zinc-400">
            {status}
          </span>
        );
    }
  };

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
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="h-full flex flex-col p-6 space-y-6 overflow-y-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-[#eaeaea] dark:border-[#222222] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-500 dark:text-orange-400">
              <Flame className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-[#111111] dark:text-[#f5f5f5] tracking-tight">Forge</h1>
          </div>
          <p className="text-xs text-[#666666] dark:text-[#a1a1aa] mt-1">
            Fine-tune local AI models with your own data.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] text-[#666666] dark:text-[#a1a1aa] hover:text-[#111111] dark:hover:text-[#f5f5f5] hover:bg-[#f5f5f5] dark:hover:bg-[#202020] transition-colors"
            title="Refresh jobs"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={onNewJob}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black dark:bg-white hover:bg-[#222222] dark:hover:bg-[#f0f0f0] text-white dark:text-black text-xs font-medium shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Training Job</span>
          </button>
        </div>
      </div>

      {/* Section 1: Active Training */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#111111] dark:text-[#f5f5f5]" />
            <h2 className="text-sm font-semibold text-[#111111] dark:text-[#f5f5f5]">Active Training</h2>
            {activeJobs.length > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700">
                {activeJobs.length} active
              </span>
            )}
          </div>
        </div>

        {activeJobs.length === 0 ? (
          <div className="p-6 rounded-xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] text-center">
            <Flame className="w-8 h-8 text-[#888888] dark:text-[#737373] mx-auto mb-2 opacity-50" />
            <div className="text-xs font-medium text-[#111111] dark:text-[#f5f5f5]">No active training jobs</div>
            <p className="text-[11px] text-[#666666] dark:text-[#a1a1aa] mt-0.5">
              Launch a fine-tuning job with LoRA to specialize local models on your custom datasets.
            </p>
            <button
              onClick={onNewJob}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f5f5f5] dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-[#111111] dark:text-[#f5f5f5] hover:bg-[#eaeaea] dark:hover:bg-[#202020] text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-[#111111] dark:text-[#f5f5f5]" />
              <span>Configure New Job</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {activeJobs.map((job) => {
              const progressPct =
                job.totalSteps > 0
                  ? Math.min(100, Math.round((job.currentStep / job.totalSteps) * 100))
                  : 0;

              return (
                <div
                  key={job.id}
                  onClick={() => onOpenJob(job.id)}
                  className="p-4 rounded-xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] hover:border-black/30 dark:hover:border-white/30 cursor-pointer transition-all space-y-3 group shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-[#111111] dark:text-[#f5f5f5] group-hover:underline transition-colors">
                          {job.name}
                        </span>
                        {getStatusBadge(job.status)}
                      </div>
                      <div className="text-xs text-[#666666] dark:text-[#a1a1aa] mt-0.5">
                        Base: <span className="text-[#111111] dark:text-[#f5f5f5] font-mono">{job.modelName}</span> • Dataset:{' '}
                        <span className="text-[#111111] dark:text-[#f5f5f5] font-mono">
                          {job.config.datasetName || 'dataset'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-medium text-[#111111] dark:text-[#f5f5f5]">
                        {progressPct}%
                      </span>
                      <ArrowRight className="w-4 h-4 text-[#888888] dark:text-[#737373] group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="h-1.5 w-full bg-[#eaeaea] dark:bg-[#262626] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-black dark:bg-white rounded-full transition-all duration-300"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#666666] dark:text-[#a1a1aa] font-mono">
                      <span>
                        Step {job.currentStep} / {job.totalSteps} (Epoch {job.currentEpoch} /{' '}
                        {job.totalEpochs})
                      </span>
                      {typeof job.currentLoss === 'number' && !isNaN(job.currentLoss) && (
                        <span>
                          Current Loss: <strong className="text-[#111111] dark:text-[#f5f5f5]">{job.currentLoss.toFixed(4)}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: Recent Training Jobs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#666666] dark:text-[#a1a1aa]" />
            <h2 className="text-sm font-semibold text-[#111111] dark:text-[#f5f5f5]">Recent Training Jobs</h2>
          </div>
        </div>

        {recentJobs.length === 0 ? (
          <div className="p-6 rounded-xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] text-center">
            <Clock className="w-7 h-7 text-[#888888] dark:text-[#737373] mx-auto mb-1.5 opacity-50" />
            <div className="text-xs font-medium text-[#111111] dark:text-[#f5f5f5]">No completed jobs yet</div>
            <p className="text-[11px] text-[#666666] dark:text-[#a1a1aa] mt-0.5">
              Completed and stopped fine-tuning runs will be cataloged here with final metrics.
            </p>
          </div>
        ) : (
          <div className="border border-[#eaeaea] dark:border-[#262626] rounded-xl overflow-hidden bg-white dark:bg-[#141414]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#fafafa] dark:bg-[#191919] text-[#666666] dark:text-[#a1a1aa] border-b border-[#eaeaea] dark:border-[#222222] font-medium">
                <tr>
                  <th className="px-4 py-2.5">Job Name & Model</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Progress</th>
                  <th className="px-4 py-2.5">Final Loss</th>
                  <th className="px-4 py-2.5">Last Updated</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eaeaea] dark:divide-[#222222]">
                {recentJobs.slice(0, 8).map((job) => (
                  <tr
                    key={job.id}
                    onClick={() => onOpenJob(job.id)}
                    className="hover:bg-[#fafafa] dark:hover:bg-[#191919] transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#111111] dark:text-[#f5f5f5] group-hover:underline transition-colors">
                        {job.name}
                      </div>
                      <div className="text-[11px] text-[#666666] dark:text-[#a1a1aa] font-mono mt-0.5">
                        {job.modelName} • {job.datasetRecords} records
                      </div>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(job.status)}</td>
                    <td className="px-4 py-3 font-mono text-[#111111] dark:text-[#f5f5f5]">
                      {job.currentStep} / {job.totalSteps} steps
                    </td>
                    <td className="px-4 py-3 font-mono text-[#111111] dark:text-[#f5f5f5]">
                      {typeof job.currentLoss === 'number' && !isNaN(job.currentLoss)
                        ? job.currentLoss.toFixed(4)
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-[#666666] dark:text-[#a1a1aa] text-[11px]">
                      {formatDate(job.updatedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenJob(job.id);
                        }}
                        className="px-2.5 py-1 rounded bg-[#f5f5f5] dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-[#111111] dark:text-[#f5f5f5] hover:bg-[#eaeaea] dark:hover:bg-[#202020] text-[11px] font-medium transition-colors"
                      >
                        {job.status === 'COMPLETED' ? 'Open Studio' : 'Inspect Studio'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 3: Fine-Tuned Models */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            <h2 className="text-sm font-semibold text-[#111111] dark:text-[#f5f5f5]">Fine-Tuned Models</h2>
            {safeArtifacts.length > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {safeArtifacts.length} models
              </span>
            )}
          </div>

          {safeArtifacts.length > 0 && (
            <button
              onClick={onOpenLibrary}
              className="text-xs text-[#111111] dark:text-[#f5f5f5] hover:underline flex items-center gap-1 transition-colors"
            >
              <span>Manage Library</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {safeArtifacts.length === 0 ? (
          <div className="p-6 rounded-xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] text-center">
            <Sparkles className="w-7 h-7 text-[#888888] dark:text-[#737373] mx-auto mb-1.5 opacity-50" />
            <div className="text-xs font-medium text-[#111111] dark:text-[#f5f5f5]">No fine-tuned models created yet</div>
            <p className="text-[11px] text-[#666666] dark:text-[#a1a1aa] mt-0.5">
              Completed training runs produce LoRA adapters that appear here ready for evaluation and inference.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {safeArtifacts.slice(0, 4).map((art) => (
              <div
                key={art.id}
                className="p-4 rounded-xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] hover:border-black/30 dark:hover:border-white/30 transition-all space-y-3 shadow-xs"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-[#111111] dark:text-[#f5f5f5]">{art.name}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        {art.type === 'lora' ? 'LoRA Adapter' : 'Merged Model'}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#666666] dark:text-[#a1a1aa] mt-1">
                      Base Model: <span className="text-[#111111] dark:text-[#f5f5f5]">{art.baseModelName}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteArtifact(art.id)}
                    className="p-1 rounded text-[#888888] dark:text-[#737373] hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                    title="Delete artifact"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#888888] dark:text-[#737373] border-t border-[#eaeaea] dark:border-[#222222] pt-2.5">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-3.5 h-3.5 text-[#888888] dark:text-[#737373]" />
                    <span>{formatBytes(art.sizeBytes)}</span>
                  </div>
                  <div>Created {formatDate(art.createdAt)}</div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => onOpenResults(art.jobId)}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-[#f5f5f5] dark:bg-[#191919] hover:bg-[#eaeaea] dark:hover:bg-[#202020] border border-[#eaeaea] dark:border-[#262626] text-[#111111] dark:text-[#f5f5f5] text-xs font-medium text-center transition-colors"
                  >
                    Compare with Base
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
