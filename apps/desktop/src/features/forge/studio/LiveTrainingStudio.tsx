import React, { useState } from 'react';
import {
  ArrowLeft,
  LayoutDashboard,
  TrendingUp,
  MessageSquare,
  Terminal,
  Bookmark,
  Scale,
  Play,
  Pause,
  XCircle,
  RotateCw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type {
  TrainingJob,
  ModelComparisonRequest,
  ModelComparisonResult,
  LiveStudioTab,
} from '@local-ai/shared';
import { StudioOverviewTab } from './StudioOverviewTab';
import { StudioLiveChartsTab } from './StudioLiveChartsTab';
import { StudioChatPlaygroundTab } from './StudioChatPlaygroundTab';
import { StudioTrainingLogsTab } from './StudioTrainingLogsTab';
import { StudioCheckpointsTab } from './StudioCheckpointsTab';
import { StudioEvaluationTab } from './StudioEvaluationTab';

interface LiveTrainingStudioProps {
  job: TrainingJob;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  onCancel: () => Promise<void>;
  onResumeFromCheckpoint: (step: number) => Promise<void>;
  onCompare: (req: ModelComparisonRequest) => Promise<ModelComparisonResult>;
  onBack: () => void;
  onRefresh: () => void;
  onOpenLibrary?: () => void;
}

export const LiveTrainingStudio: React.FC<LiveTrainingStudioProps> = ({
  job,
  onPause,
  onResume,
  onCancel,
  onResumeFromCheckpoint,
  onCompare,
  onBack,
  onRefresh,
  onOpenLibrary,
}) => {
  const [activeTab, setActiveTab] = useState<LiveStudioTab>('overview');
  const [isActionLoading, setIsActionLoading] = useState(false);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'TRAINING':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-black dark:bg-white animate-ping" />
            TRAINING
          </span>
        );
      case 'PAUSED':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Pause className="w-3 h-3" />
            PAUSED
          </span>
        );
      case 'INITIALIZING':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700">
            <RotateCw className="w-3 h-3 animate-spin" />
            INITIALIZING
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            COMPLETED
          </span>
        );
      case 'FAILED':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            FAILED
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-zinc-500/10 text-zinc-400 border border-zinc-500/30">
            <XCircle className="w-3.5 h-3.5" />
            CANCELLED
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-zinc-800 text-zinc-400">
            {status}
          </span>
        );
    }
  };

  const handlePause = async () => {
    setIsActionLoading(true);
    try {
      await onPause();
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleResume = async () => {
    setIsActionLoading(true);
    try {
      await onResume();
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCancel = async () => {
    setIsActionLoading(true);
    try {
      await onCancel();
    } finally {
      setIsActionLoading(false);
    }
  };

  const tabs: { id: LiveStudioTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'charts', label: 'Live Charts', icon: TrendingUp },
    { id: 'playground', label: 'Chat Playground', icon: MessageSquare },
    { id: 'logs', label: 'Training Logs', icon: Terminal },
    { id: 'checkpoints', label: 'Checkpoints', icon: Bookmark },
    { id: 'evaluation', label: 'Evaluation', icon: Scale },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#090a0b] text-zinc-100">
      {/* Studio Header Bar */}
      <div className="border-b border-[#1e2128] bg-[#0d0e12] px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0">
        {/* Left: Back button & Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg bg-[#14161b] hover:bg-[#1f2229] border border-[#20242e] text-zinc-400 hover:text-zinc-100 transition-colors"
            title="Return to Forge Home"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-bold text-zinc-100 tracking-tight">
                {job.name}
              </h2>
              {getStatusBadge(job.status)}
            </div>
            <div className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5">
              <span>Base Model:</span>
              <span className="font-mono text-zinc-300 font-medium">{job.modelName}</span>
              <span className="text-zinc-600">•</span>
              <span>Dataset:</span>
              <span className="font-mono text-zinc-300">
                {job.config.datasetName || 'dataset'} ({job.datasetRecords.toLocaleString()} records)
              </span>
            </div>
          </div>
        </div>

        {/* Right: Studio Process Controls */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg bg-[#14161b] border border-[#20232a] text-zinc-400 hover:text-zinc-200 hover:bg-[#1b1e25] transition-colors"
            title="Refresh Studio state"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Pause / Resume Controls */}
          {job.status === 'TRAINING' && (
            <button
              onClick={handlePause}
              disabled={isActionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium transition-colors"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause Training</span>
            </button>
          )}

          {job.status === 'PAUSED' && (
            <button
              onClick={handleResume}
              disabled={isActionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black font-medium shadow transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Resume Training</span>
            </button>
          )}

          {/* Cancel Control */}
          {(job.status === 'TRAINING' || job.status === 'PAUSED') && (
            <button
              onClick={handleCancel}
              disabled={isActionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-medium transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Cancel Job</span>
            </button>
          )}

          {/* View in library when completed */}
          {job.status === 'COMPLETED' && onOpenLibrary && (
            <button
              onClick={onOpenLibrary}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 font-medium transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>View in Model Library</span>
            </button>
          )}
        </div>
      </div>

      {/* Six Tabs Navigation Header */}
      <div className="border-b border-[#1e2128] bg-[#0c0d11] px-6 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-black dark:border-white text-zinc-900 dark:text-zinc-100 bg-zinc-100/50 dark:bg-zinc-800/40'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500'}`} />
                <span>{tab.label}</span>
                {tab.id === 'checkpoints' && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400">
                    {job.checkpoints?.length || 0}
                  </span>
                )}
                {tab.id === 'charts' && job.metricsHistory?.length > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-black dark:bg-white" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'overview' && <StudioOverviewTab job={job} />}

        {activeTab === 'charts' && <StudioLiveChartsTab job={job} />}

        {activeTab === 'playground' && (
          <StudioChatPlaygroundTab
            job={job}
            onCompare={onCompare}
            onPauseTraining={onPause}
          />
        )}

        {activeTab === 'logs' && <StudioTrainingLogsTab job={job} />}

        {activeTab === 'checkpoints' && (
          <StudioCheckpointsTab
            job={job}
            onResumeFromCheckpoint={onResumeFromCheckpoint}
            onRefresh={onRefresh}
          />
        )}

        {activeTab === 'evaluation' && <StudioEvaluationTab job={job} />}
      </div>
    </div>
  );
};
