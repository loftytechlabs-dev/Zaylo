import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  XCircle,
  Terminal,
  Sliders,
  HardDrive,
  ArrowRight,
  ArrowLeft,
  RotateCw,
} from 'lucide-react';
import type { TrainingJob, TrainingMetricSample } from '@local-ai/shared';

interface LiveTrainingMonitorScreenProps {
  job: TrainingJob;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  onCancel: () => Promise<void>;
  onViewResults: () => void;
  onBack: () => void;
  onRefresh: () => void;
}

export const LiveTrainingMonitorScreen: React.FC<LiveTrainingMonitorScreenProps> = ({
  job,
  onPause,
  onResume,
  onCancel,
  onViewResults,
  onBack,
  onRefresh,
}) => {
  const [showConfigModal, setShowConfigModal] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const metricsHistory = Array.isArray(job?.metricsHistory) ? job.metricsHistory : [];
  const recentLogs = Array.isArray(job?.recentLogs) ? job.recentLogs : [];
  const checkpoints = Array.isArray(job?.checkpoints) ? job.checkpoints : [];
  const config = job?.config || ({} as any);

  // Auto-scroll logs safely
  useEffect(() => {
    try {
      logsEndRef.current?.scrollIntoView({ behavior: 'auto' });
    } catch {
      // Ignored
    }
  }, [recentLogs.length]);

  const progressPct =
    (job?.totalSteps || 0) > 0
      ? Math.min(100, Math.round(((job?.currentStep || 0) / job.totalSteps) * 100))
      : 0;

  const latestSample: TrainingMetricSample | undefined =
    metricsHistory.length > 0
      ? metricsHistory[metricsHistory.length - 1]
      : undefined;

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '—';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(0)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const formatSeconds = (sec?: number) => {
    if (sec === undefined || sec === null || !Number.isFinite(sec)) return '—';
    if (sec < 60) return `${Math.round(sec)}s`;
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}m ${s}s`;
  };

  // Render SVG Loss Chart with numerical safety
  const renderLossChart = () => {
    const validSamples = metricsHistory.filter((s) => s && typeof s.loss === 'number' && Number.isFinite(s.loss));
    if (validSamples.length < 2) {
      return (
        <div className="h-44 flex items-center justify-center text-xs text-zinc-500 bg-[#0c0d10] rounded-xl border border-[#1b1d24]">
          Gathering initial training step loss telemetry...
        </div>
      );
    }

    const width = 600;
    const height = 170;
    const padding = 35;

    const losses = validSamples.map((s) => s.loss);
    const rawMin = Math.min(...losses);
    const rawMax = Math.max(...losses);
    const range = rawMax - rawMin;
    const minLoss = Math.max(0, rawMin - (range > 0 ? range * 0.1 : 0.1));
    const maxLoss = rawMax + (range > 0 ? range * 0.1 : 0.1);
    const denominator = maxLoss - minLoss > 0.0001 ? maxLoss - minLoss : 1;

    const points = validSamples.map((s, idx) => {
      const x = padding + (idx / Math.max(1, validSamples.length - 1)) * (width - padding * 2);
      const y = height - padding - ((s.loss - minLoss) / denominator) * (height - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    return (
      <div className="bg-[#0c0d10] p-4 rounded-xl border border-[#1b1d24] space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-zinc-300 font-medium">Training Loss Curve</span>
          </div>
          <div className="text-zinc-500 font-mono text-[11px]">
            Min: {typeof rawMin === 'number' && !isNaN(rawMin) ? rawMin.toFixed(4) : '—'} • Current:{' '}
            {typeof job?.currentLoss === 'number' && !isNaN(job.currentLoss) ? job.currentLoss.toFixed(4) : '—'}
          </div>
        </div>

        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44 overflow-visible">
          {/* Grid lines */}
          <line
            x1={padding}
            y1={padding}
            x2={width - padding}
            y2={padding}
            stroke="#1f222a"
            strokeDasharray="4"
          />
          <line
            x1={padding}
            y1={height - padding}
            x2={width - padding}
            y2={height - padding}
            stroke="#20242e"
          />

          {/* Area fill */}
          <polygon
            points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`}
            fill="rgba(59, 130, 246, 0.08)"
          />

          {/* Polyline */}
          <polyline
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />
        </svg>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col p-6 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#202227] pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
            <span>Job ID: {job.id}</span>
            <span>•</span>
            <span className="text-zinc-300">{job.modelName}</span>
          </div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight mt-0.5">
            {job.name}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg bg-[#14161a] border border-[#202227] text-zinc-400 hover:text-zinc-200"
            title="Refresh status"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowConfigModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14161a] border border-[#202227] text-zinc-300 hover:text-zinc-100 text-xs transition-colors"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Config</span>
          </button>

          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#14161a] border border-[#202227] text-zinc-300 hover:text-white text-xs transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Forge Home</span>
          </button>
        </div>
      </div>

      {/* Primary Status Banner & Progress */}
      <div className="p-5 rounded-xl bg-[#121418] border border-[#202227] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-md text-xs font-mono font-semibold tracking-wide ${
                job.status === 'TRAINING'
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30 animate-pulse'
                  : job.status === 'COMPLETED'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : job.status === 'PAUSED'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : job.status === 'INITIALIZING'
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
              }`}
            >
              {job.status}
            </span>

            <span className="text-xs text-zinc-400 font-mono">
              Epoch {job.currentEpoch} / {job.totalEpochs} • Step {job.currentStep} / {job.totalSteps}
            </span>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2">
            {job.status === 'TRAINING' && (
              <button
                onClick={onPause}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-medium transition-colors"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>Pause</span>
              </button>
            )}

            {job.status === 'PAUSED' && (
              <button
                onClick={onResume}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-medium transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Resume</span>
              </button>
            )}

            {(job.status === 'TRAINING' || job.status === 'PAUSED' || job.status === 'INITIALIZING') && (
              <button
                onClick={onCancel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Cancel Training</span>
              </button>
            )}

            {job.status === 'COMPLETED' && (
              <button
                onClick={onViewResults}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors shadow-sm"
              >
                <span>View Results & Compare</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Big Progress Bar */}
        <div className="space-y-1.5">
          <div className="h-2 w-full bg-[#1b1e24] rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                job.status === 'COMPLETED'
                  ? 'bg-emerald-500'
                  : job.status === 'FAILED'
                  ? 'bg-rose-500'
                  : 'bg-blue-500'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
            <span>Overall Progress: {progressPct}%</span>
            <span>
              Elapsed: {formatSeconds(latestSample?.elapsedSeconds)} • Remaining:{' '}
              {formatSeconds(latestSample?.estimatedRemainingSeconds)}
            </span>
          </div>
        </div>
      </div>

      {/* Telemetry Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-[#121418] border border-[#202227] space-y-1">
          <div className="text-[11px] text-zinc-400">Training Loss</div>
          <div className="text-lg font-bold font-mono text-zinc-100">
            {typeof job.currentLoss === 'number' && !isNaN(job.currentLoss) ? job.currentLoss.toFixed(4) : '—'}
          </div>
          {typeof latestSample?.evalLoss === 'number' && !isNaN(latestSample.evalLoss) && (
            <div className="text-xs text-blue-400 font-mono">
              Val Loss: {latestSample.evalLoss.toFixed(4)}
            </div>
          )}
        </div>

        <div className="p-4 rounded-xl bg-[#121418] border border-[#202227] space-y-1">
          <div className="text-[11px] text-zinc-400">Learning Rate</div>
          <div className="text-lg font-bold font-mono text-blue-400">
            {latestSample?.learningRate ? latestSample.learningRate.toExponential(2) : '—'}
          </div>
          <div className="text-xs text-zinc-500 font-mono">Warmup + Cosine Decay</div>
        </div>

        <div className="p-4 rounded-xl bg-[#121418] border border-[#202227] space-y-1">
          <div className="text-[11px] text-zinc-400">Throughput</div>
          <div className="text-lg font-bold font-mono text-emerald-400">
            {latestSample?.tokensPerSec ? `${latestSample.tokensPerSec} tok/s` : '—'}
          </div>
          <div className="text-xs text-zinc-500 font-mono">Tokens / second</div>
        </div>

        <div className="p-4 rounded-xl bg-[#121418] border border-[#202227] space-y-1">
          <div className="text-[11px] text-zinc-400">Memory & CPU</div>
          <div className="text-lg font-bold font-mono text-zinc-100">
            {formatBytes(latestSample?.memoryBytes)}
          </div>
          <div className="text-xs text-zinc-500 font-mono">
            CPU: {latestSample?.cpuPercent ?? '—'}%
          </div>
        </div>
      </div>

      {/* Real-time Loss Graph */}
      {renderLossChart()}

      {/* Bottom split: Checkpoints & Live Terminal Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Checkpoints List */}
        <div className="p-4 rounded-xl bg-[#121418] border border-[#202227] space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-200">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-blue-400" />
              <span>Saved Checkpoints ({checkpoints.length})</span>
            </div>
          </div>

          {checkpoints.length === 0 ? (
            <div className="text-xs text-zinc-500 py-6 text-center">
              Checkpoints are created automatically every {config?.saveSteps || 10} steps.
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {checkpoints.map((cp, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-lg bg-[#0c0d10] border border-[#1b1d24] flex items-center justify-between text-xs"
                >
                  <div className="font-mono text-zinc-300">Step {cp.step}</div>
                  <div className="text-zinc-400 font-mono text-[11px]">
                    Loss: {typeof cp.loss === 'number' && !isNaN(cp.loss) ? cp.loss.toFixed(4) : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Logs Terminal */}
        <div className="lg:col-span-2 p-4 rounded-xl bg-[#121418] border border-[#202227] space-y-2 flex flex-col h-72">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-200">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-zinc-400" />
              <span>Training Process Logs</span>
            </div>
            <span className="text-[11px] text-zinc-500 font-mono">
              {recentLogs.length} events
            </span>
          </div>

          <div className="flex-1 bg-[#090a0c] p-3 rounded-lg border border-[#181a20] font-mono text-[11px] text-zinc-300 overflow-y-auto space-y-1">
            {recentLogs.map((log, idx) => (
              <div key={idx} className="leading-relaxed">
                {log}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>

      {/* Config Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#121418] border border-[#252832] rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-100">Job Configuration</h3>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                ✕
              </button>
            </div>
            <pre className="p-3 rounded-lg bg-[#090a0c] border border-[#181a20] text-xs font-mono text-zinc-300 overflow-x-auto max-h-80">
              {JSON.stringify(job.config, null, 2)}
            </pre>
            <button
              onClick={() => setShowConfigModal(false)}
              className="w-full py-2 bg-[#1b1e24] hover:bg-[#252830] text-zinc-200 rounded-lg text-xs font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
