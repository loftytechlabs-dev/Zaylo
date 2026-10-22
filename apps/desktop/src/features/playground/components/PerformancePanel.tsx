import React from 'react';
import {
  Activity,
  X,
  Sparkles,
} from 'lucide-react';
import type { SystemMetricSample, GeneratedImage } from '@local-ai/shared';
import type { InferenceGenerationStats } from '../types';

interface PerformancePanelProps {
  stats?: InferenceGenerationStats;
  liveStats?: InferenceGenerationStats;
  systemMetric?: SystemMetricSample;
  contextLimit?: number;
  isGenerating: boolean;
  onClose: () => void;
  accelerationEngine?: string;
  isImageModel?: boolean;
  lastGeneratedImage?: GeneratedImage;
}

export const PerformancePanel: React.FC<PerformancePanelProps> = ({
  stats,
  liveStats,
  systemMetric,
  contextLimit = 4096,
  isGenerating,
  onClose,
  accelerationEngine = 'MPS (Metal)',
  isImageModel,
  lastGeneratedImage,
}) => {
  // Use active live stats during streaming, or fallback to retained completed stats
  const activeStats = isGenerating ? liveStats : stats || liveStats;

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '—';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(0)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const formatNumber = (num?: number, decimals = 1, suffix = '') => {
    if (num === undefined || num === null || !Number.isFinite(num)) return '—';
    return `${num.toFixed(decimals)}${suffix}`;
  };

  // Context usage calculation
  const totalTokens = (activeStats?.promptTokens || 0) + (activeStats?.tokenCount || 0);
  const contextPct = contextLimit > 0 ? Math.min(100, Math.round((totalTokens / contextLimit) * 100)) : 0;

  return (
    <aside className="w-80 border-l border-[#202227] bg-[#0c0d10] p-5 space-y-5 select-none overflow-y-auto shrink-0 z-20">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1f2228] pb-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-200">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span>Inference Performance</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-[#1a1d25] transition-colors"
          title="Close Performance Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {isImageModel ? (
        /* Image Generation Telemetry Card */
        <div className="p-4 rounded-xl bg-[#12141a] border border-[#20232c] space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase text-zinc-400">Diffusion Inference</span>
            {isGenerating && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-blue-400 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                SAMPLING
              </span>
            )}
          </div>

          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-2xl font-bold font-mono text-zinc-100">
                {lastGeneratedImage ? `${(lastGeneratedImage.durationMs / 1000).toFixed(2)}s` : isGenerating ? 'Running...' : '—'}
              </div>
              <div className="text-[11px] text-zinc-400">Total Generation Duration</div>
            </div>
            <Sparkles className="w-5 h-5 text-blue-400" />
          </div>

          {lastGeneratedImage && (
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-2 border-t border-[#1e212b]">
              <div>
                <span className="text-zinc-500 block text-[10px]">Sampling Steps</span>
                <span className="text-zinc-200 font-semibold">{lastGeneratedImage.steps} steps</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px]">Resolution</span>
                <span className="text-zinc-200 font-semibold">{lastGeneratedImage.width} × {lastGeneratedImage.height}</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px]">CFG Guidance</span>
                <span className="text-zinc-200 font-semibold">{lastGeneratedImage.guidanceScale}</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px]">Device</span>
                <span className="text-blue-400 font-semibold uppercase">{lastGeneratedImage.device || 'MPS'}</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Text Generation Live Inference Telemetry Card */
        <div className="p-4 rounded-xl bg-[#12141a] border border-[#20232c] space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase text-zinc-400">Response Speed</span>
            {isGenerating && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                LIVE
              </span>
            )}
          </div>

          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-2xl font-bold font-mono text-zinc-100">
                {typeof activeStats?.tokensPerSec === 'number' && !isNaN(activeStats.tokensPerSec)
                  ? activeStats.tokensPerSec.toFixed(1)
                  : '—'}
              </div>
              <div className="text-[11px] text-zinc-400">tokens / second</div>
            </div>
            <Activity className="w-5 h-5 text-emerald-400" />
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-2 border-t border-[#1e212b]">
            <div>
              <span className="text-zinc-500 block text-[10px]">TTFT</span>
              <span className="text-zinc-200">
                {formatNumber(activeStats?.timeToFirstTokenMs, 0, ' ms')}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[10px]">Generated Tokens</span>
              <span className="text-zinc-200">
                {activeStats?.tokenCount || 0}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Context Usage Gauge (for text models) */}
      {!isImageModel && (
        <div className="p-4 rounded-xl bg-[#12141a] border border-[#20232c] space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 font-medium">Context Window</span>
            <span className="font-mono text-zinc-300 font-semibold">
              {totalTokens} / {contextLimit}
            </span>
          </div>
          <div className="h-1.5 w-full bg-[#1b1e26] rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                contextPct > 90 ? 'bg-rose-500' : contextPct > 75 ? 'bg-amber-500' : 'bg-blue-500'
              }`}
              style={{ width: `${contextPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
            <span>Utilization</span>
            <span>{contextPct}% utilized</span>
          </div>
        </div>
      )}

      {/* System Hardware Resource Meters */}
      <div className="p-4 rounded-xl bg-[#12141a] border border-[#20232c] space-y-3.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-300 font-semibold">Runtime Host Telemetry</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
            {accelerationEngine}
          </span>
        </div>

        {/* CPU */}
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Host CPU Compute</span>
            <span className="font-mono font-semibold text-zinc-200">
              {formatNumber(systemMetric?.cpuPercent, 1, '%')}
            </span>
          </div>
          <div className="h-1.5 w-full bg-[#1b1e24] rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, systemMetric?.cpuPercent || 15)}%` }}
            />
          </div>
        </div>

        {/* RAM */}
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Memory (RAM)</span>
            <span className="font-mono font-semibold text-zinc-200">
              {systemMetric?.memoryUsedBytes ? formatBytes(systemMetric.memoryUsedBytes) : '—'}
            </span>
          </div>
          <div className="h-1.5 w-full bg-[#1b1e24] rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(
                  100,
                  Math.round(
                    ((systemMetric?.memoryUsedBytes || 0) /
                      (systemMetric?.memoryTotalBytes || 16 * 1024 * 1024 * 1024)) *
                      100
                  )
                )}%`,
              }}
            />
          </div>
        </div>

        {/* GPU / VRAM */}
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">GPU / Metal Unified</span>
            <span className="font-mono font-semibold text-zinc-200">
              {typeof systemMetric?.gpuPercent === 'number' && !isNaN(systemMetric.gpuPercent)
                ? `${systemMetric.gpuPercent.toFixed(1)}%`
                : systemMetric?.vramUsedBytes
                ? formatBytes(systemMetric.vramUsedBytes)
                : 'Accelerated'}
            </span>
          </div>
          <div className="h-1.5 w-full bg-[#1b1e24] rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, systemMetric?.gpuPercent || 30)}%` }}
            />
          </div>
        </div>

        {/* Active Requests */}
        <div className="flex items-center justify-between pt-2 border-t border-[#1b1e25] text-xs">
          <span className="text-zinc-400">Concurrent Requests</span>
          <span className="font-mono font-semibold text-zinc-200">
            {systemMetric?.activeRequests ?? (isGenerating ? 1 : 0)} active
          </span>
        </div>
      </div>
    </aside>
  );
};
