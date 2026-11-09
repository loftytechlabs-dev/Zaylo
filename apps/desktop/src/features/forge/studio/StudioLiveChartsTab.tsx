import React, { useState, useMemo, useRef } from 'react';
import {
  TrendingUp,
  Activity,
  Crosshair,
} from 'lucide-react';
import type { TrainingJob, TrainingMetricSample } from '@local-ai/shared';

interface StudioLiveChartsTabProps {
  job: TrainingJob;
}

type MetricKey = 'loss' | 'evalLoss' | 'learningRate' | 'gradNorm' | 'tokenAccuracy' | 'tokensPerSec';

interface MetricDef {
  key: MetricKey;
  label: string;
  color: string;
  unit?: string;
  format: (val: number) => string;
}

const METRICS: MetricDef[] = [
  {
    key: 'loss',
    label: 'Training Loss',
    color: '#3b82f6', // blue
    format: (v) => (typeof v === 'number' && !isNaN(v) ? v.toFixed(4) : '—'),
  },
  {
    key: 'evalLoss',
    label: 'Validation Loss',
    color: '#f59e0b', // amber
    format: (v) => (typeof v === 'number' && !isNaN(v) ? v.toFixed(4) : '—'),
  },
  {
    key: 'learningRate',
    label: 'Learning Rate',
    color: '#0ea5e9', // sky
    format: (v) =>
      typeof v === 'number' && !isNaN(v)
        ? v < 0.001
          ? v.toExponential(2)
          : v.toFixed(6)
        : '—',
  },
  {
    key: 'gradNorm',
    label: 'Gradient Norm',
    color: '#10b981', // emerald
    format: (v) => (typeof v === 'number' && !isNaN(v) ? v.toFixed(3) : '—'),
  },
  {
    key: 'tokenAccuracy',
    label: 'Token Accuracy',
    color: '#06b6d4', // cyan
    format: (v) => (typeof v === 'number' && !isNaN(v) ? `${(v * 100).toFixed(1)}%` : '—'),
  },
  {
    key: 'tokensPerSec',
    label: 'Throughput',
    color: '#f43f5e', // rose
    unit: 'tok/s',
    format: (v) => (typeof v === 'number' && !isNaN(v) ? `${v.toFixed(1)} tok/s` : '—'),
  },
];

export const StudioLiveChartsTab: React.FC<StudioLiveChartsTabProps> = ({ job }) => {
  const [activeMetrics, setActiveMetrics] = useState<Record<MetricKey, boolean>>({
    loss: true,
    evalLoss: true,
    learningRate: true,
    gradNorm: true,
    tokenAccuracy: true,
    tokensPerSec: false,
  });

  const [axisMode, setAxisMode] = useState<'step' | 'time'>('step');
  const [rangeFilter, setRangeFilter] = useState<'all' | '50' | '100'>('all');
  const [viewMode, setViewMode] = useState<'combined' | 'split'>('combined');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const rawHistory = Array.isArray(job.metricsHistory) ? job.metricsHistory : [];

  // Filter samples based on range selector
  const samples = useMemo(() => {
    if (rangeFilter === '50') return rawHistory.slice(-50);
    if (rangeFilter === '100') return rawHistory.slice(-100);
    return rawHistory;
  }, [rawHistory, rangeFilter]);

  const toggleMetric = (key: MetricKey) => {
    setActiveMetrics((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const formatSeconds = (sec?: number) => {
    if (sec === undefined || sec === null || !Number.isFinite(sec)) return '0s';
    if (sec < 60) return `${Math.round(sec)}s`;
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}m ${s}s`;
  };

  // Check if any metric actually has reported numbers in this run
  const availableMetrics = useMemo(() => {
    const counts: Record<MetricKey, number> = {
      loss: 0,
      evalLoss: 0,
      learningRate: 0,
      gradNorm: 0,
      tokenAccuracy: 0,
      tokensPerSec: 0,
    };
    for (const s of rawHistory) {
      if (typeof s.loss === 'number' && Number.isFinite(s.loss)) counts.loss++;
      if (typeof s.evalLoss === 'number' && Number.isFinite(s.evalLoss)) counts.evalLoss++;
      if (typeof s.learningRate === 'number' && Number.isFinite(s.learningRate)) counts.learningRate++;
      if (typeof s.gradNorm === 'number' && Number.isFinite(s.gradNorm)) counts.gradNorm++;
      if (typeof s.tokenAccuracy === 'number' && Number.isFinite(s.tokenAccuracy)) counts.tokenAccuracy++;
      if (typeof s.tokensPerSec === 'number' && Number.isFinite(s.tokensPerSec)) counts.tokensPerSec++;
    }
    return counts;
  }, [rawHistory]);

  const latestSample = rawHistory.length > 0 ? rawHistory[rawHistory.length - 1] : undefined;

  // Handle Mouse Hover on SVG
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>, sampleCount: number) => {
    if (!svgRef.current || sampleCount < 2) return;
    const rect = svgRef.current.getBoundingClientRect();
    const padding = 50;
    const chartWidth = rect.width;
    const innerWidth = chartWidth - padding * 2;
    const mouseX = e.clientX - rect.left - padding;
    const clampedX = Math.max(0, Math.min(innerWidth, mouseX));
    const ratio = clampedX / innerWidth;
    const index = Math.round(ratio * (sampleCount - 1));
    setHoveredIdx(index);
  };

  const handleMouseLeave = () => {
    setHoveredIdx(null);
  };

  // Render Single Metric Dedicated SVG
  const renderSingleChart = (metricDef: MetricDef, sampleList: TrainingMetricSample[]) => {
    const key = metricDef.key;
    const valid = sampleList
      .map((s, idx) => ({ s, originalIdx: idx, val: (s as any)[key] }))
      .filter((item) => typeof item.val === 'number' && Number.isFinite(item.val));

    if (valid.length < 2) {
      return (
        <div className="h-44 flex flex-col items-center justify-center text-xs text-zinc-500 bg-[#0d0e12] rounded-xl border border-[#1b1e24] p-4 text-center">
          <span>Awaiting additional telemetry data for {metricDef.label}...</span>
          <span className="text-[11px] text-zinc-600 mt-1">
            {valid.length === 1 ? '1 data point collected so far' : 'No samples recorded yet'}
          </span>
        </div>
      );
    }

    const width = 600;
    const height = 180;
    const padX = 45;
    const padY = 25;

    const values = valid.map((v) => v.val);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal;
    const chartMin = minVal - (range > 0 ? range * 0.08 : minVal * 0.05);
    const chartMax = maxVal + (range > 0 ? range * 0.08 : 0.05);
    const denom = chartMax - chartMin > 0 ? chartMax - chartMin : 1;

    const points = valid
      .map((v) => {
        const x = padX + (v.originalIdx / (sampleList.length - 1)) * (width - padX * 2);
        const y = height - padY - ((v.val - chartMin) / denom) * (height - padY * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    const lastVal = valid[valid.length - 1].val;

    return (
      <div className="p-4 rounded-xl bg-[#101216] border border-[#1e2128] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: metricDef.color }} />
            <span className="text-xs font-semibold text-zinc-200">{metricDef.label}</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="text-zinc-500">Min: {metricDef.format(minVal)}</span>
            <span className="text-zinc-500">Max: {metricDef.format(maxVal)}</span>
            <span className="font-semibold text-zinc-200">
              Current: {metricDef.format(lastVal)}
            </span>
          </div>
        </div>

        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40 overflow-visible">
          {/* Grid lines */}
          <line
            x1={padX}
            y1={padY}
            x2={width - padX}
            y2={padY}
            stroke="#1b1d24"
            strokeDasharray="4"
          />
          <line
            x1={padX}
            y1={height / 2}
            x2={width - padX}
            y2={height / 2}
            stroke="#1b1d24"
            strokeDasharray="4"
          />
          <line
            x1={padX}
            y1={height - padY}
            x2={width - padX}
            y2={height - padY}
            stroke="#20242e"
          />

          {/* Area fill */}
          <polygon
            points={`${padX},${height - padY} ${points} ${width - padX},${height - padY}`}
            fill={metricDef.color}
            fillOpacity="0.08"
          />

          {/* Polyline */}
          <polyline
            fill="none"
            stroke={metricDef.color}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />

          {/* Y Axis Labels */}
          <text x={padX - 8} y={padY + 4} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">
            {metricDef.format(chartMax)}
          </text>
          <text x={padX - 8} y={height - padY} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">
            {metricDef.format(chartMin)}
          </text>

          {/* X Axis Labels */}
          <text x={padX} y={height - 8} fill="#64748b" fontSize="9" textAnchor="start" fontFamily="monospace">
            {axisMode === 'step' ? `Step ${sampleList[0]?.step ?? 1}` : '0s'}
          </text>
          <text x={width - padX} y={height - 8} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">
            {axisMode === 'step'
              ? `Step ${sampleList[sampleList.length - 1]?.step ?? sampleList.length}`
              : formatSeconds(sampleList[sampleList.length - 1]?.elapsedSeconds)}
          </text>
        </svg>
      </div>
    );
  };

  // Render Combined Multi-Metric Interactive SVG Chart
  const renderCombinedChart = () => {
    const width = 850;
    const height = 300;
    const padX = 55;
    const padY = 30;

    // Filter active metrics that actually have values in current sample window
    const activeDefs = METRICS.filter(
      (m) => activeMetrics[m.key] && availableMetrics[m.key] > 0
    );

    const hoveredSample =
      hoveredIdx !== null && hoveredIdx >= 0 && hoveredIdx < samples.length
        ? samples[hoveredIdx]
        : null;

    return (
      <div className="p-5 rounded-xl bg-[#101216] border border-[#1e2128] space-y-4">
        {/* Chart Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1b1e24] pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
            <h3 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider">
              Real-Time Telemetry Curve
            </h3>
            <span className="text-[11px] text-zinc-500 font-mono">
              ({samples.length} step points)
            </span>
          </div>

          {/* Hover Telemetry Readout */}
          {hoveredSample ? (
            <div className="flex items-center gap-3 text-[11px] font-mono bg-[#161820] px-3 py-1 rounded-lg border border-[#272b36]">
              <span className="text-zinc-900 dark:text-zinc-100 font-semibold">
                Step {hoveredSample.step} (Epoch {hoveredSample.epoch})
              </span>
              <span className="text-zinc-500">•</span>
              <span className="text-zinc-400">
                Time: {formatSeconds(hoveredSample.elapsedSeconds)}
              </span>
            </div>
          ) : (
            <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
              <Crosshair className="w-3.5 h-3.5 text-zinc-500" />
              <span>Hover anywhere on the chart to inspect step metrics</span>
            </div>
          )}
        </div>

        {/* SVG Container */}
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-72 cursor-crosshair overflow-visible select-none"
            onMouseMove={(e) => handleMouseMove(e, samples.length)}
            onMouseLeave={handleMouseLeave}
          >
            {/* Horizontal Grid lines */}
            <line x1={padX} y1={padY} x2={width - padX} y2={padY} stroke="#1b1e25" strokeDasharray="3 3" />
            <line x1={padX} y1={padY + (height - padY * 2) * 0.25} x2={width - padX} y2={padY + (height - padY * 2) * 0.25} stroke="#1b1e25" strokeDasharray="3 3" />
            <line x1={padX} y1={padY + (height - padY * 2) * 0.5} x2={width - padX} y2={padY + (height - padY * 2) * 0.5} stroke="#1b1e25" strokeDasharray="3 3" />
            <line x1={padX} y1={padY + (height - padY * 2) * 0.75} x2={width - padX} y2={padY + (height - padY * 2) * 0.75} stroke="#1b1e25" strokeDasharray="3 3" />
            <line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} stroke="#222631" />

            {/* Vertical grid lines at intervals */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
              const x = padX + pct * (width - padX * 2);
              return (
                <line
                  key={i}
                  x1={x}
                  y1={padY}
                  x2={x}
                  y2={height - padY}
                  stroke="#161820"
                  strokeDasharray="2 2"
                />
              );
            })}

            {/* Plot each active metric */}
            {activeDefs.map((def) => {
              const valid = samples
                .map((s, idx) => ({ s, originalIdx: idx, val: (s as any)[def.key] }))
                .filter((item) => typeof item.val === 'number' && Number.isFinite(item.val));

              if (valid.length < 2) return null;

              const values = valid.map((v) => v.val);
              const minVal = Math.min(...values);
              const maxVal = Math.max(...values);
              const range = maxVal - minVal;
              const chartMin = minVal - (range > 0 ? range * 0.08 : minVal * 0.05);
              const chartMax = maxVal + (range > 0 ? range * 0.08 : 0.05);
              const denom = chartMax - chartMin > 0 ? chartMax - chartMin : 1;

              const points = valid
                .map((v) => {
                  const x = padX + (v.originalIdx / (samples.length - 1)) * (width - padX * 2);
                  const y = height - padY - ((v.val - chartMin) / denom) * (height - padY * 2);
                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                })
                .join(' ');

              return (
                <g key={def.key}>
                  {/* Subtle glow/shadow polyline */}
                  <polyline
                    fill="none"
                    stroke={def.color}
                    strokeWidth="3.5"
                    strokeOpacity="0.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={points}
                  />
                  {/* Main polyline */}
                  <polyline
                    fill="none"
                    stroke={def.color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={points}
                  />

                  {/* Draw points if small sample count */}
                  {valid.length <= 40 &&
                    valid.map((v, i) => {
                      const x = padX + (v.originalIdx / (samples.length - 1)) * (width - padX * 2);
                      const y = height - padY - ((v.val - chartMin) / denom) * (height - padY * 2);
                      return (
                        <circle
                          key={i}
                          cx={x}
                          cy={y}
                          r={hoveredIdx === v.originalIdx ? 4.5 : 2.5}
                          fill={def.color}
                          stroke="#101216"
                          strokeWidth="1.5"
                        />
                      );
                    })}
                </g>
              );
            })}

            {/* Hover Crosshair Vertical Line */}
            {hoveredIdx !== null && hoveredIdx >= 0 && hoveredIdx < samples.length && (
              <g>
                <line
                  x1={padX + (hoveredIdx / (samples.length - 1)) * (width - padX * 2)}
                  y1={padY}
                  x2={padX + (hoveredIdx / (samples.length - 1)) * (width - padX * 2)}
                  y2={height - padY}
                  stroke="#60a5fa"
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                />
              </g>
            )}

            {/* X Axis Bottom Labels */}
            <text x={padX} y={height - 10} fill="#64748b" fontSize="10" textAnchor="start" fontFamily="monospace">
              {axisMode === 'step' ? `Step ${samples[0]?.step ?? 1}` : '0s'}
            </text>
            <text x={width / 2} y={height - 10} fill="#475569" fontSize="10" textAnchor="middle" fontFamily="monospace">
              {axisMode === 'step'
                ? `Step ${samples[Math.floor(samples.length / 2)]?.step ?? Math.floor(samples.length / 2)}`
                : formatSeconds(samples[Math.floor(samples.length / 2)]?.elapsedSeconds)}
            </text>
            <text x={width - padX} y={height - 10} fill="#64748b" fontSize="10" textAnchor="end" fontFamily="monospace">
              {axisMode === 'step'
                ? `Step ${samples[samples.length - 1]?.step ?? samples.length}`
                : formatSeconds(samples[samples.length - 1]?.elapsedSeconds)}
            </text>
          </svg>

          {/* Floating Hover Card Detail */}
          {hoveredSample && (
            <div className="absolute top-2 right-4 p-3 rounded-lg bg-[#0e1014]/95 border border-[#292d38] shadow-2xl backdrop-blur-md pointer-events-none text-xs space-y-1.5 z-10 min-w-[210px]">
              <div className="text-[11px] font-semibold text-zinc-300 border-b border-[#20232c] pb-1 flex justify-between">
                <span>Step {hoveredSample.step}</span>
                <span className="text-zinc-500 font-mono">
                  {formatSeconds(hoveredSample.elapsedSeconds)}
                </span>
              </div>
              <div className="space-y-1 font-mono text-[11px]">
                {METRICS.map((m) => {
                  const val = (hoveredSample as any)[m.key];
                  const hasVal = typeof val === 'number' && Number.isFinite(val);
                  return (
                    <div key={m.key} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                        <span className="text-zinc-400">{m.label}:</span>
                      </div>
                      <span className="font-semibold" style={{ color: hasVal ? m.color : '#64748b' }}>
                        {hasVal ? m.format(val) : 'N/A'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Legend with Live Values */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#1b1e24]">
          {METRICS.map((m) => {
            const hasData = availableMetrics[m.key] > 0;
            const isToggled = activeMetrics[m.key];
            const currentVal = latestSample ? (latestSample as any)[m.key] : undefined;
            const hasVal = typeof currentVal === 'number' && Number.isFinite(currentVal);

            return (
              <button
                key={m.key}
                onClick={() => toggleMetric(m.key)}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
                  isToggled
                    ? 'bg-[#15171e] border-[#292c36] text-zinc-200'
                    : 'bg-[#101216] border-transparent text-zinc-600 opacity-60 hover:opacity-100'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    backgroundColor: isToggled ? m.color : '#475569',
                  }}
                />
                <span className="font-medium">{m.label}</span>
                {hasData && (
                  <span className="font-mono text-[11px] font-semibold text-zinc-300">
                    {hasVal ? m.format(currentVal) : '—'}
                  </span>
                )}
                {!hasData && (
                  <span className="text-[10px] text-zinc-600 font-mono">pending</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Filter & View Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-[#101216] border border-[#1e2128]">
        {/* Metric Selection Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500 font-medium mr-1">Metrics:</span>
          {METRICS.map((m) => {
            const active = activeMetrics[m.key];
            const count = availableMetrics[m.key];
            return (
              <button
                key={m.key}
                onClick={() => toggleMetric(m.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                  active
                    ? 'bg-zinc-800 text-zinc-100 border-zinc-700 shadow-sm'
                    : 'bg-[#14161b] text-zinc-500 border-[#1f2228] hover:text-zinc-300'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: active ? m.color : '#52525b' }}
                />
                <span>{m.label}</span>
                {count > 0 && (
                  <span className="text-[10px] font-mono text-zinc-400">({count})</span>
                )}
              </button>
            );
          })}
        </div>

        {/* View Controls: Axis toggle, Range, and Grid/Combined */}
        <div className="flex items-center gap-2.5 text-xs">
          {/* Axis Mode */}
          <div className="flex items-center bg-[#14161b] p-0.5 rounded-lg border border-[#20232a]">
            <button
              onClick={() => setAxisMode('step')}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                axisMode === 'step'
                  ? 'bg-black dark:bg-white text-white dark:text-black font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Step Axis
            </button>
            <button
              onClick={() => setAxisMode('time')}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                axisMode === 'time'
                  ? 'bg-black dark:bg-white text-white dark:text-black font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Time Axis
            </button>
          </div>

          {/* Range Filter */}
          <div className="flex items-center bg-[#14161b] p-0.5 rounded-lg border border-[#20232a]">
            {(['all', '50', '100'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRangeFilter(r)}
                className={`px-2 py-1 rounded text-xs uppercase font-mono transition-colors ${
                  rangeFilter === r
                    ? 'bg-zinc-800 text-zinc-100 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {r === 'all' ? 'All' : `${r} pts`}
              </button>
            ))}
          </div>

          {/* Combined vs Split Grid */}
          <div className="flex items-center bg-[#14161b] p-0.5 rounded-lg border border-[#20232a]">
            <button
              onClick={() => setViewMode('combined')}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                viewMode === 'combined'
                  ? 'bg-zinc-800 text-zinc-100 font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Combined view"
            >
              Combined
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                viewMode === 'split'
                  ? 'bg-zinc-800 text-zinc-100 font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Split view"
            >
              Grid
            </button>
          </div>
        </div>
      </div>

      {/* Main Chart Body */}
      {samples.length < 2 ? (
        <div className="p-12 rounded-xl bg-[#101216] border border-[#1e2128] text-center space-y-3">
          <Activity className="w-10 h-10 text-zinc-600 mx-auto opacity-60 animate-pulse" />
          <h4 className="text-sm font-semibold text-zinc-200">
            {samples.length === 1
              ? 'Gathering additional training step telemetry...'
              : 'Waiting for initial training step telemetry'}
          </h4>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            The background training worker reports real-time loss, gradient norm ($\|\nabla\|_2$),
            learning rate, and token accuracy at each step interval. Telemetry curves will render
            automatically as steps progress.
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#161820] border border-[#242833] text-[11px] font-mono text-zinc-400">
            <span>Current Step: {job.currentStep}</span> • <span>Status: {job.status}</span>
          </div>
        </div>
      ) : viewMode === 'combined' ? (
        renderCombinedChart()
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {METRICS.filter((m) => activeMetrics[m.key]).map((m) => (
            <div key={m.key}>{renderSingleChart(m, samples)}</div>
          ))}
        </div>
      )}
    </div>
  );
};
