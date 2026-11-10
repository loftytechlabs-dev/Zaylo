import React from 'react';
import {
  Activity,
  Zap,
  Clock,
  Cpu,
  HardDrive,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

export const PerformanceView: React.FC = () => {
  const { metricHistory, currentMetric, hardware } = useAppStore();

  const GIB = 1024 * 1024 * 1024;
  const rawTotalGb = hardware ? hardware.memory.totalBytes / GIB : 16;
  const totalRamGb = Math.abs(rawTotalGb - Math.round(rawTotalGb)) < 0.15
    ? Math.round(rawTotalGb).toString()
    : rawTotalGb.toFixed(1);
  const cpuPercent = currentMetric ? currentMetric.cpuPercent.toFixed(1) : '0.0';
  const usedRamGb = currentMetric ? (currentMetric.memoryUsedBytes / GIB).toFixed(1) : '0.0';
  const tokPerSec = currentMetric ? currentMetric.tokensPerSecond.toFixed(1) : '0.0';
  const latencyMs = currentMetric ? currentMetric.latencyMs : 0;

  // Simple pure SVG Sparkline / Bar chart
  const renderSparkline = (values: number[], color: string, maxVal: number = 100) => {
    if (values.length < 2) {
      return <div className="h-16 flex items-center justify-center text-xs text-zinc-600">Collecting metrics...</div>;
    }

    const width = 400;
    const height = 70;
    const padding = 6;
    const step = (width - padding * 2) / (values.length - 1);

    const points = values.map((val, idx) => {
      const x = padding + idx * step;
      const normalized = Math.min(1, Math.max(0, val / maxVal));
      const y = height - padding - normalized * (height - padding * 2);
      return `${x},${y}`;
    });

    return (
      <div className="w-full h-20 overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points.join(' ')}
          />
        </svg>
      </div>
    );
  };

  const cpuSeries = metricHistory.map((s) => s.cpuPercent);
  const ramSeries = metricHistory.map((s) => s.memoryUsedBytes / GIB);
  const tokSeries = metricHistory.map((s) => s.tokensPerSecond);
  const latSeries = metricHistory.map((s) => s.latencyMs);

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto overflow-y-auto h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="border-b border-[#eaeaea] dark:border-[#222222] pb-4">
        <h2 className="text-sm font-semibold text-[#111111] dark:text-[#f5f5f5] flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#666666] dark:text-[#a1a1aa]" />
          Real-Time Performance & Telemetry
        </h2>
        <p className="text-xs text-[#666666] dark:text-[#a1a1aa] mt-0.5">
          Live streaming hardware utilization and inference engine throughput updated every second.
        </p>
      </div>

      {/* 4 Performance Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 1. CPU Utilization */}
        <div className="p-5 rounded-lg bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono text-[#666666] dark:text-[#a1a1aa]">
              <Cpu className="w-4 h-4 text-[#666666] dark:text-[#a1a1aa]" />
              <span>CPU UTILIZATION</span>
            </div>
            <span className="text-sm font-mono font-bold text-[#111111] dark:text-[#f5f5f5]">{cpuPercent}%</span>
          </div>
          {renderSparkline(cpuSeries, '#3b82f6', 100)}
          <div className="text-[11px] text-[#888888] dark:text-[#737373] font-mono text-right">Last 60 seconds</div>
        </div>

        {/* 2. Memory Utilization */}
        <div className="p-5 rounded-lg bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono text-[#666666] dark:text-[#a1a1aa]">
              <HardDrive className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              <span>SYSTEM MEMORY (RAM)</span>
            </div>
            <span className="text-sm font-mono font-bold text-[#111111] dark:text-[#f5f5f5]">
              {usedRamGb} / {totalRamGb} GB
            </span>
          </div>
          {renderSparkline(ramSeries, '#10b981', parseFloat(totalRamGb) || 16)}
          <div className="text-[11px] text-[#888888] dark:text-[#737373] font-mono text-right">Last 60 seconds</div>
        </div>

        {/* 3. Tokens Per Second */}
        <div className="p-5 rounded-lg bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono text-[#666666] dark:text-[#a1a1aa]">
              <Zap className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              <span>GENERATION THROUGHPUT</span>
            </div>
            <span className="text-sm font-mono font-bold text-[#111111] dark:text-[#f5f5f5]">{tokPerSec} tok/s</span>
          </div>
          {renderSparkline(tokSeries, '#f59e0b', 50)}
          <div className="text-[11px] text-[#888888] dark:text-[#737373] font-mono text-right">Last 60 seconds</div>
        </div>

        {/* 4. Inference Latency */}
        <div className="p-5 rounded-lg bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono text-[#666666] dark:text-[#a1a1aa]">
              <Clock className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
              <span>INFERENCE LATENCY</span>
            </div>
            <span className="text-sm font-mono font-bold text-[#111111] dark:text-[#f5f5f5]">{latencyMs} ms</span>
          </div>
          {renderSparkline(latSeries, '#06b6d4', 1000)}
          <div className="text-[11px] text-[#888888] dark:text-[#737373] font-mono text-right">Last 60 seconds</div>
        </div>
      </div>
    </div>
  );
};
