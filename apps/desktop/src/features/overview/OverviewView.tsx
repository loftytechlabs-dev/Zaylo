import React, { useMemo } from 'react';
import {
  Cpu,
  HardDrive,
  Zap,
  Activity,
  Layers,
  Flame,
  MessageSquare,
  Terminal,
  ArrowRight,
  Shield,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

/**
 * ThroughputTrendChart
 * Renders an elegant SVG trendline using actual historical inference throughput samples.
 * If inference is idle or no non-zero metrics have been recorded, displays a clean baseline
 * with an informative empty state without fabricating curves.
 */
interface ThroughputChartProps {
  samples: number[];
  serverRunning: boolean;
}

const ThroughputTrendChart: React.FC<ThroughputChartProps> = ({ samples, serverRunning }) => {
  const hasThroughput = samples.some((v) => v > 0);

  // If we have actual throughput, find the scale maximum (at least 10 tok/s for good proportion)
  const maxTps = hasThroughput ? Math.max(12, ...samples) * 1.15 : 20;

  const width = 500;
  const height = 120;
  const padTop = 14;
  const padBottom = 24;
  const padLeft = 46;
  const padRight = 14;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  // Gridline Y positions
  const yZero = padTop + chartH;
  const yMid = padTop + chartH / 2;
  const yTop = padTop;

  // Compute points
  const points = useMemo(() => {
    if (samples.length === 0) return [];
    return samples.map((val, idx) => {
      const x = padLeft + (idx / Math.max(1, samples.length - 1)) * chartW;
      const y = yZero - (Math.min(val, maxTps) / maxTps) * chartH;
      return { x, y, val };
    });
  }, [samples, maxTps, chartW, chartH, padLeft, yZero]);

  const linePath = useMemo(() => {
    if (points.length === 0) return '';
    return points.reduce((acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`), '');
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return '';
    return `${linePath} L ${points[points.length - 1].x} ${yZero} L ${points[0].x} ${yZero} Z`;
  }, [linePath, points, yZero]);

  return (
    <div className="overview-chart-box relative w-full rounded-md bg-[#0a0c0f] border border-[#181a20] p-3 overflow-hidden select-none">
      <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 mb-2">
        <span className="flex items-center gap-1.5 uppercase tracking-wider">
          <Activity className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
          Throughput History (tok/s)
        </span>
        <span className="text-zinc-500 font-sans text-[11px]">
          {hasThroughput ? 'Live Generation Stream' : serverRunning ? 'Idle Baseline' : 'Engine Offline'}
        </span>
      </div>

      <div className="relative h-28 w-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
          <defs>
            <linearGradient id="overviewTpsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.32" />
              <stop offset="85%" stopColor="#2563eb" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Horizontal gridlines */}
          <line
            x1={padLeft}
            y1={yTop}
            x2={width - padRight}
            y2={yTop}
            stroke="#1d212b"
            strokeDasharray="3 3"
            strokeWidth="1"
          />
          <line
            x1={padLeft}
            y1={yMid}
            x2={width - padRight}
            y2={yMid}
            stroke="#1d212b"
            strokeDasharray="3 3"
            strokeWidth="1"
          />
          <line
            x1={padLeft}
            y1={yZero}
            x2={width - padRight}
            y2={yZero}
            stroke="#262a36"
            strokeWidth="1"
          />

          {/* Gridline Y labels */}
          <text x={padLeft - 8} y={yTop + 4} textAnchor="end" className="text-[10px] fill-zinc-500 font-mono">
            {maxTps.toFixed(0)}
          </text>
          <text x={padLeft - 8} y={yMid + 4} textAnchor="end" className="text-[10px] fill-zinc-600 font-mono">
            {(maxTps / 2).toFixed(0)}
          </text>
          <text x={padLeft - 8} y={yZero + 3} textAnchor="end" className="text-[10px] fill-zinc-600 font-mono">
            0
          </text>

          {/* Area & Stroke for active throughput */}
          {hasThroughput && areaPath && (
            <path d={areaPath} fill="url(#overviewTpsFill)" />
          )}
          {hasThroughput && linePath && (
            <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          )}

          {/* Endpoint highlight */}
          {hasThroughput && points.length > 0 && (
            <circle
              cx={points[points.length - 1].x}
              cy={points[points.length - 1].y}
              r="3.5"
              className="fill-blue-400 stroke-[#0a0c0f] stroke-2"
            />
          )}

          {/* Time axis labels */}
          <text x={padLeft} y={height - 4} textAnchor="start" className="text-[10px] fill-zinc-600 font-mono">
            ~60s ago
          </text>
          <text x={width - padRight} y={height - 4} textAnchor="end" className="text-[10px] fill-zinc-600 font-mono">
            Live
          </text>
        </svg>

        {/* Empty / Idle State Overlay */}
        {!hasThroughput && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-4">
            <span className="text-xs font-medium text-zinc-400">
              {serverRunning ? 'Inference Engine Idle' : 'Server Stopped'}
            </span>
            <span className="text-[11px] text-zinc-500 mt-0.5">
              {serverRunning
                ? 'Throughput curves display here during active token generation'
                : 'Start inference server to stream live token throughput'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export const OverviewView: React.FC = () => {
  const {
    serverState,
    serverInstance,
    serverConfig,
    lanAddress,
    hardware,
    currentMetric,
    metricHistory,
    installedModels,
    devices,
    logs,
    setActiveTab,
  } = useAppStore();

  // Resource Calculations with real hardware and telemetry (binary GiB for standard OS memory reporting)
  const GIB = 1024 * 1024 * 1024;
  const rawTotalGb = hardware ? hardware.memory.totalBytes / GIB : 16;
  const totalRamGb = Math.abs(rawTotalGb - Math.round(rawTotalGb)) < 0.15
    ? Math.round(rawTotalGb).toString()
    : rawTotalGb.toFixed(1);
  const usedRamGb = currentMetric
    ? (currentMetric.memoryUsedBytes / GIB).toFixed(1)
    : hardware
    ? (hardware.memory.usedBytes / GIB).toFixed(1)
    : '0.0';
  const availableRamGb = hardware ? (hardware.memory.availableBytes / GIB).toFixed(1) : '—';
  const ramPercent = hardware && hardware.memory.totalBytes > 0
    ? Math.min(
        100,
        Math.max(
          0,
          ((currentMetric ? currentMetric.memoryUsedBytes : hardware.memory.usedBytes) /
            hardware.memory.totalBytes) *
            100
        )
      )
    : 0;

  const cpuPercent = currentMetric ? currentMetric.cpuPercent : 0;
  const cpuDisplay = currentMetric ? `${cpuPercent.toFixed(1)}%` : '—';
  const cpuModel = hardware?.cpu?.model || 'Multi-Core Host Processor';
  const cpuCoresLabel = hardware?.cpu?.physicalCores
    ? `${hardware.cpu.physicalCores} Cores · ${hardware.cpu.logicalThreads} Threads`
    : 'Host CPU';

  const primaryGpu = hardware?.primaryGPU;
  const gpuBackend = primaryGpu?.backend ? primaryGpu.backend.toUpperCase() : 'METAL';
  const gpuModel = primaryGpu?.model || 'Apple Neural & Graphics Engine';

  // Primary Disk Information
  const primaryDisk = hardware?.disks?.[0];
  const totalDiskGb = primaryDisk ? (primaryDisk.totalBytes / 1e9).toFixed(0) : '—';
  const freeDiskGb = primaryDisk ? (primaryDisk.availableBytes / 1e9).toFixed(1) : '—';
  const usedDiskGb = primaryDisk
    ? ((primaryDisk.totalBytes - primaryDisk.availableBytes) / 1e9).toFixed(1)
    : '—';
  const diskPercent = primaryDisk
    ? Math.min(
        100,
        Math.max(
          0,
          ((primaryDisk.totalBytes - primaryDisk.availableBytes) / (primaryDisk.totalBytes || 1)) * 100
        )
      )
    : 0;

  // Performance Telemetry
  const isServerRunning = serverState === 'RUNNING';
  const tokPerSec = currentMetric ? currentMetric.tokensPerSecond : 0;
  const tokPerSecDisplay =
    tokPerSec > 0 ? tokPerSec.toFixed(1) : isServerRunning ? '0.0' : '—';

  const latencyMs = currentMetric ? currentMetric.latencyMs : 0;
  const latencyDisplay = latencyMs > 0 ? `${latencyMs}` : isServerRunning ? '0' : '—';

  const activeRequests = currentMetric ? currentMetric.activeRequests : 0;
  const concurrencyLimit = serverConfig?.maxConcurrentRequests || 4;

  // Collect historical throughput samples (last 24 measurements)
  const throughputSamples = useMemo(() => {
    if (!metricHistory || metricHistory.length === 0) {
      return currentMetric ? [currentMetric.tokensPerSecond] : [];
    }
    return metricHistory.slice(-24).map((s) => s.tokensPerSecond);
  }, [metricHistory, currentMetric]);

  // Connected Devices Count
  const onlineDevicesCount = useMemo(() => {
    const threshold = 60000; // 60 seconds
    const now = Date.now();
    return devices.filter((d) => !d.isRevoked && now - d.lastRequestAt < threshold).length;
  }, [devices]);

  // Curated meaningful recent activity
  const curatedLogs = useMemo(() => {
    const isRawLlamaNoise = (msg: string) => {
      const lower = msg.toLowerCase();
      return (
        lower.startsWith('llama_') ||
        lower.startsWith('ggml_') ||
        lower.startsWith('slot ') ||
        lower.startsWith('main: ') ||
        lower.startsWith('srv ') ||
        lower.includes('print_timings') ||
        lower.includes('load time =') ||
        lower.includes('prompt eval time =') ||
        /0x[0-9a-f]{6,}/i.test(msg)
      );
    };

    return logs
      .filter((l) => {
        if (isRawLlamaNoise(l.message)) return false;
        if (l.level === 'ERROR' || l.level === 'WARN') return true;

        const comp = (l.component || '').toLowerCase();
        const msg = l.message.toLowerCase();

        const isKnownComp = ['server', 'runtime', 'inference', 'security', 'system', 'network'].includes(
          comp
        );
        const hasKeyword =
          msg.includes('start') ||
          msg.includes('stop') ||
          msg.includes('load') ||
          msg.includes('device') ||
          msg.includes('key') ||
          msg.includes('ready') ||
          msg.includes('connect') ||
          msg.includes('forge') ||
          msg.includes('training') ||
          msg.includes('eval');

        return isKnownComp && hasKeyword;
      })
      .slice(0, 5);
  }, [logs]);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto overflow-y-auto h-[calc(100vh-4rem)]">
      {/* 1. First Section — Runtime Status Summary */}
      <section className="rounded-xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] p-5 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#eaeaea] dark:divide-[#222222]">
          {/* Inference Server Group */}
          <div className="pb-4 md:pb-0 md:pr-6 flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-mono tracking-wider text-zinc-500 uppercase font-semibold">
                Inference Server
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    serverState === 'RUNNING'
                      ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                      : serverState === 'STARTING'
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-zinc-400'
                  }`}
                />
                <span className="text-base font-semibold text-[#111111] dark:text-zinc-100 tracking-tight">
                  {serverState === 'RUNNING'
                    ? 'Server Active'
                    : serverState === 'STARTING'
                    ? 'Starting Engine...'
                    : 'Server Stopped'}
                </span>
              </div>
            </div>
            <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
              <span className="font-mono text-zinc-600 dark:text-zinc-400">Port {serverConfig?.port || 8080}</span>
              <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                {serverConfig?.lanEnabled && lanAddress ? `${lanAddress} (LAN)` : '127.0.0.1 (Local)'}
              </span>
            </div>
          </div>

          {/* Active Model Group */}
          <div className="py-4 md:py-0 md:px-6 flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-mono tracking-wider text-zinc-500 uppercase font-semibold">
                Active Model
              </div>
              <div className="text-base font-semibold text-[#111111] dark:text-zinc-100 tracking-tight mt-2 truncate">
                {serverInstance?.modelName || (
                  <span className="text-zinc-500 font-normal">
                    {serverState === 'STARTING' ? 'Loading model...' : 'No model loaded'}
                  </span>
                )}
              </div>
            </div>
            <div className="mt-3 text-xs flex items-center justify-between">
              <span className="text-zinc-500 truncate">
                {serverInstance
                  ? `${serverInstance.gpuLayersOffloaded} GPU layers offloaded`
                  : `${installedModels.length} installed model${installedModels.length === 1 ? '' : 's'}`}
              </span>
              <button
                onClick={() => setActiveTab('models')}
                className="text-xs text-zinc-900 dark:text-zinc-100 hover:underline transition-colors font-medium ml-2 shrink-0"
              >
                Models →
              </button>
            </div>
          </div>

          {/* Connected Devices Group */}
          <div className="pt-4 md:pt-0 md:pl-6 flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-mono tracking-wider text-zinc-400 uppercase font-semibold">
                Connected Devices
              </div>
              <div className="text-base font-semibold text-zinc-100 tracking-tight mt-2 flex items-baseline gap-2">
                <span>{onlineDevicesCount}</span>
                <span className="text-xs font-normal text-zinc-400 font-sans">
                  {onlineDevicesCount === 1 ? 'device online' : 'devices online'}
                </span>
              </div>
            </div>
            <div className="mt-3 text-xs flex items-center justify-between">
              <span className="text-zinc-500">
                {serverConfig?.lanEnabled ? 'LAN access enabled' : 'Localhost only'}
              </span>
              <button
                onClick={() => setActiveTab('devices')}
                className="text-xs text-zinc-900 dark:text-zinc-100 hover:underline transition-colors font-medium ml-2 shrink-0"
              >
                Devices →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Second Section — Two-Column Monitoring Area */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Left Column: System Resources */}
        <div className="rounded-xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] p-5 flex flex-col justify-between shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-[#eaeaea] dark:border-[#222222] pb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-700 dark:text-zinc-300 font-semibold">
                System Resources
              </h2>
            </div>
            <span className="text-[11px] font-mono text-zinc-500">Live Hardware Telemetry</span>
          </div>

          <div className="space-y-4">
            {/* Host CPU Row */}
            <div>
              <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                <span className="text-zinc-300 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-zinc-400" />
                  Host CPU
                </span>
                <span className="text-zinc-100 font-bold">{cpuDisplay}</span>
              </div>
              <div className="h-1.5 w-full bg-[#181a20] rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    cpuPercent > 85 ? 'bg-amber-500' : 'bg-black dark:bg-white'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, cpuPercent))}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500 font-sans">
                <span className="truncate max-w-[240px]">{cpuModel}</span>
                <span className="font-mono">{cpuCoresLabel}</span>
              </div>
            </div>

            {/* System Memory (RAM) Row */}
            <div>
              <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                <span className="text-zinc-300 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
                  System Memory (RAM)
                </span>
                <span className="text-zinc-100 font-bold">
                  {usedRamGb} / {totalRamGb} GB
                </span>
              </div>
              <div className="h-1.5 w-full bg-[#181a20] rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    ramPercent > 85 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${ramPercent}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500 font-sans">
                <span>{availableRamGb} GB available for models</span>
                <span className="font-mono">{ramPercent.toFixed(0)}% allocated</span>
              </div>
            </div>

            {/* GPU / Accelerator Row */}
            <div>
              <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                <span className="text-zinc-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  GPU Accelerator
                </span>
                <span className="text-zinc-100 font-bold font-mono">{gpuBackend}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500 font-sans">
                <span className="truncate max-w-[260px]">{gpuModel}</span>
                <span className="font-mono text-emerald-400 text-[10px]">Active Engine</span>
              </div>
            </div>

            {/* VRAM / Accelerator Memory Row */}
            <div>
              <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                <span className="text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-zinc-500" />
                  VRAM Allocation
                </span>
                <span className="text-zinc-100 font-bold font-mono">
                  {primaryGpu?.vramBytes
                    ? `${(primaryGpu.vramBytes / GIB).toFixed(1)} GB (Unified)`
                    : `Unified Host Memory (${totalRamGb} GB)`}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500 font-sans">
                <span>
                  {serverInstance
                    ? `${serverInstance.gpuLayersOffloaded} layers offloaded to GPU`
                    : 'Zero-copy high throughput unified bus'}
                </span>
                <span className="font-mono text-zinc-500">
                  {serverInstance ? 'Offload Active' : 'Idle'}
                </span>
              </div>
            </div>

            {/* Model Storage Disk Row */}
            <div>
              <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                <span className="text-zinc-300 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-zinc-400" />
                  Model Storage Disk
                </span>
                <span className="text-zinc-100 font-bold font-mono">
                  {freeDiskGb} GB free / {totalDiskGb} GB
                </span>
              </div>
              <div className="h-1.5 w-full bg-[#181a20] rounded-full overflow-hidden">
                <div
                  className="h-full bg-zinc-500 transition-all duration-500"
                  style={{ width: `${diskPercent}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500 font-sans">
                <span>Local models & checkpoints store</span>
                <span className="font-mono">{usedDiskGb} GB used</span>
              </div>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-zinc-500 font-mono border-t border-[#181a20]">
            Architecture: {hardware?.cpu.architecture || 'ARM64'} · Platform: {hardware?.platform || 'Darwin'}
          </div>
        </div>

        {/* Right Column: Inference Performance */}
        <div className="rounded-xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] p-5 flex flex-col justify-between shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-[#eaeaea] dark:border-[#222222] pb-3">
            <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-700 dark:text-[#A1A1AA] font-semibold">
              Inference Performance
            </h2>
            <span className="text-[11px] font-mono text-zinc-500">Real-Time Metrics</span>
          </div>

          {/* Scannable Metrics Grid using compact typography & whitespace */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-1">
            {/* 1. Generation Speed */}
            <div>
              <div className="text-[10px] font-mono uppercase text-zinc-400 tracking-wider">Speed</div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono text-zinc-100">{tokPerSecDisplay}</span>
                <span className="text-[11px] text-zinc-400 font-mono">tok/s</span>
              </div>
            </div>

            {/* 2. Latency (TTFT) */}
            <div>
              <div className="text-[10px] font-mono uppercase text-zinc-400 tracking-wider">TTFT</div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono text-zinc-100">{latencyDisplay}</span>
                <span className="text-[11px] text-zinc-400 font-mono">ms</span>
              </div>
            </div>

            {/* 3. Active Requests */}
            <div>
              <div className="text-[10px] font-mono uppercase text-zinc-400 tracking-wider">Active</div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono text-zinc-100">{activeRequests}</span>
                <span className="text-[11px] text-zinc-400 font-mono">req</span>
              </div>
            </div>

            {/* 4. Concurrency Limit */}
            <div>
              <div className="text-[10px] font-mono uppercase text-zinc-400 tracking-wider">Concurrency</div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono text-zinc-100">{concurrencyLimit}</span>
                <span className="text-[11px] text-zinc-400 font-mono">max</span>
              </div>
            </div>
          </div>

          {/* Throughput Trendline Chart */}
          <ThroughputTrendChart samples={throughputSamples} serverRunning={isServerRunning} />

          {/* Primary Action Button */}
          <div className="pt-2 flex items-center justify-between border-t border-[#181a20]">
            <span className="text-[11px] text-zinc-500 font-sans">
              Test streaming generation and model responses
            </span>
            <button
              onClick={() => setActiveTab('playground')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black text-xs font-medium transition-colors shadow-sm"
            >
              <span>Open Playground</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* 3. Third Section — Recent Activity */}
      <section className="rounded-xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-[#eaeaea] dark:border-[#222222] pb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-700 dark:text-zinc-300 font-semibold">
              Recent Activity
            </h2>
          </div>
          <button
            onClick={() => setActiveTab('logs')}
            className="text-xs text-zinc-900 dark:text-zinc-100 hover:underline font-medium transition-colors inline-flex items-center gap-1"
          >
            <span>View All Activity</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {curatedLogs.length === 0 ? (
          <div className="py-8 text-center space-y-1">
            <p className="text-xs text-zinc-400 font-medium">No operational events recorded yet</p>
            <p className="text-[11px] text-zinc-500">
              System events will appear here as the inference server runs and queries are executed.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#161820]">
            {curatedLogs.map((log) => {
              const isError = log.level === 'ERROR';
              const isWarn = log.level === 'WARN';

              return (
                <div key={log.id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        isError ? 'bg-rose-400' : isWarn ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                    />
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-[#14161d] text-zinc-400 border border-[#20232c] shrink-0">
                      {log.component || 'SYSTEM'}
                    </span>
                    <span className="text-zinc-300 truncate font-sans">{log.message}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-mono text-zinc-500 shrink-0">
                    <Clock className="w-3 h-3 text-zinc-600" />
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. Fourth Section — Contextual Quick Actions */}
      <footer className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border-t border-[#181a20]">
        <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
          Quick Shortcuts
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab('playground')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-[#111317] hover:bg-zinc-200 dark:hover:bg-[#181b22] border border-zinc-200 dark:border-[#20232b] text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
            <span>Playground</span>
          </button>
          <button
            onClick={() => setActiveTab('models')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-[#111317] hover:bg-zinc-200 dark:hover:bg-[#181b22] border border-zinc-200 dark:border-[#20232b] text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-500" />
            <span>Models</span>
          </button>
          <button
            onClick={() => setActiveTab('forge')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-[#111317] hover:bg-zinc-200 dark:hover:bg-[#181b22] border border-zinc-200 dark:border-[#20232b] text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white transition-colors"
          >
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>Forge</span>
          </button>
          <button
            onClick={() => setActiveTab('server')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-[#111317] hover:bg-zinc-200 dark:hover:bg-[#181b22] border border-zinc-200 dark:border-[#20232b] text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white transition-colors"
          >
            <Terminal className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
            <span>Server & API</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
