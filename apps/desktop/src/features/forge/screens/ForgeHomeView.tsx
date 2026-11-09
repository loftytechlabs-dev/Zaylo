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
      <div className="flex items-center justify-between border-b border-[#202227] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400">
              <Flame className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Forge</h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Fine-tune local AI models with your own data.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg bg-[#14161a] border border-[#202227] text-zinc-400 hover:text-zinc-200 hover:bg-[#1b1e24] transition-colors"
            title="Refresh jobs"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={onNewJob}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black text-xs font-medium shadow-sm transition-colors"
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
            <Activity className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
            <h2 className="text-sm font-semibold text-zinc-200">Active Training</h2>
            {activeJobs.length > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700">
                {activeJobs.length} active
              </span>
            )}
          </div>
        </div>

        {activeJobs.length === 0 ? (
          <div className="p-6 rounded-xl bg-[#101216] border border-[#1f2228] text-center">
            <Flame className="w-8 h-8 text-zinc-600 mx-auto mb-2 opacity-50" />
            <div className="text-xs font-medium text-zinc-400">No active training jobs</div>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Launch a fine-tuning job with LoRA to specialize local models on your custom datasets.
            </p>
            <button
              onClick={onNewJob}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1b1e24] border border-[#2e323b] text-zinc-300 hover:text-zinc-100 hover:bg-[#252830] text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
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
                  className="p-4 rounded-xl bg-[#121418] border border-[#eaeaea] dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 cursor-pointer transition-all space-y-3 group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-zinc-100 group-hover:text-black dark:group-hover:text-white transition-colors">
                          {job.name}
                        </span>
                        {getStatusBadge(job.status)}
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        Base: <span className="text-zinc-300 font-mono">{job.modelName}</span> • Dataset:{' '}
                        <span className="text-zinc-300 font-mono">
                          {job.config.datasetName || 'dataset'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100">
                        {progressPct}%
                      </span>
                      <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="h-1.5 w-full bg-[#1e2128] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-black dark:bg-white rounded-full transition-all duration-300"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                      <span>
                        Step {job.currentStep} / {job.totalSteps} (Epoch {job.currentEpoch} /{' '}
                        {job.totalEpochs})
                      </span>
                      {typeof job.currentLoss === 'number' && !isNaN(job.currentLoss) && (
                        <span>
                          Current Loss: <strong className="text-zinc-200">{job.currentLoss.toFixed(4)}</strong>
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
            <Clock className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-200">Recent Training Jobs</h2>
          </div>
        </div>

        {recentJobs.length === 0 ? (
          <div className="p-6 rounded-xl bg-[#101216] border border-[#1f2228] text-center">
            <Clock className="w-7 h-7 text-zinc-600 mx-auto mb-1.5 opacity-50" />
            <div className="text-xs font-medium text-zinc-400">No completed jobs yet</div>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Completed and stopped fine-tuning runs will be cataloged here with final metrics.
            </p>
          </div>
        ) : (
          <div className="border border-[#1f2228] rounded-xl overflow-hidden bg-[#101216]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#14161b] text-zinc-400 border-b border-[#1f2228] font-medium">
                <tr>
                  <th className="px-4 py-2.5">Job Name & Model</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Progress</th>
                  <th className="px-4 py-2.5">Final Loss</th>
                  <th className="px-4 py-2.5">Last Updated</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1b1e24]">
                {recentJobs.slice(0, 8).map((job) => (
                  <tr
                    key={job.id}
                    onClick={() => onOpenJob(job.id)}
                    className="hover:bg-[#15171d] transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-200 group-hover:text-black dark:group-hover:text-white transition-colors">
                        {job.name}
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                        {job.modelName} • {job.datasetRecords} records
                      </div>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(job.status)}</td>
                    <td className="px-4 py-3 font-mono text-zinc-300">
                      {job.currentStep} / {job.totalSteps} steps
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-300">
                      {typeof job.currentLoss === 'number' && !isNaN(job.currentLoss)
                        ? job.currentLoss.toFixed(4)
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-[11px]">
                      {formatDate(job.updatedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenJob(job.id);
                        }}
                        className="px-2.5 py-1 rounded bg-[#1b1e24] border border-[#2e323b] text-zinc-200 hover:text-white dark:hover:text-black hover:bg-black dark:hover:bg-white hover:border-black dark:hover:border-white text-[11px] font-medium transition-colors"
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
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-zinc-200">Fine-Tuned Models</h2>
            {safeArtifacts.length > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {safeArtifacts.length} models
              </span>
            )}
          </div>

          {safeArtifacts.length > 0 && (
            <button
              onClick={onOpenLibrary}
              className="text-xs text-zinc-900 dark:text-zinc-100 hover:underline flex items-center gap-1 transition-colors"
            >
              <span>Manage Library</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {safeArtifacts.length === 0 ? (
          <div className="p-6 rounded-xl bg-[#101216] border border-[#1f2228] text-center">
            <Sparkles className="w-7 h-7 text-zinc-600 mx-auto mb-1.5 opacity-50" />
            <div className="text-xs font-medium text-zinc-400">No fine-tuned models created yet</div>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Completed training runs produce LoRA adapters that appear here ready for evaluation and inference.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {safeArtifacts.slice(0, 4).map((art) => (
              <div
                key={art.id}
                className="p-4 rounded-xl bg-[#121418] border border-[#202227] hover:border-[#2e323b] transition-all space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-zinc-100">{art.name}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {art.type === 'lora' ? 'LoRA Adapter' : 'Merged Model'}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-1">
                      Base Model: <span className="text-zinc-300">{art.baseModelName}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteArtifact(art.id)}
                    className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Delete artifact"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-500 border-t border-[#1a1c22] pt-2.5">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{formatBytes(art.sizeBytes)}</span>
                  </div>
                  <div>Created {formatDate(art.createdAt)}</div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => onOpenResults(art.jobId)}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-[#1b1e24] hover:bg-[#252830] border border-[#2e323b] text-zinc-200 text-xs font-medium text-center transition-colors"
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
