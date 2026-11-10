import React, { useState } from 'react';
import {
  Settings,
  Folder,
  Save,
  Check,
  Layers,
  Zap,
  HardDrive,
  Sun,
  Moon,
  Laptop,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { api } from '../../api/client';

export const SettingsView: React.FC = () => {
  const { serverConfig, updateServerConfig, theme, themePreference, setThemePreference } = useAppStore();

  const [port, setPort] = useState(serverConfig?.port || 8080);
  const [maxConcurrency, setMaxConcurrency] = useState(serverConfig?.maxConcurrentRequests || 4);
  const [contextLimit, setContextLimit] = useState(serverConfig?.contextLimit || 4096);
  const [gpuLayers, setGpuLayers] = useState(serverConfig?.gpuLayers ?? 99);
  const [threads, setThreads] = useState(serverConfig?.threads || 6);
  const [lowMemoryMode, setLowMemoryMode] = useState(serverConfig?.lowMemoryMode || false);
  const [flashAttention, setFlashAttention] = useState(serverConfig?.flashAttention ?? true);
  const [modelsDir, setModelsDir] = useState(serverConfig?.modelsDirectory || '');
  const [runtimeDir, setRuntimeDir] = useState(serverConfig?.runtimeDirectory || '');
  const [saved, setSaved] = useState(false);

  const handleSelectModelsDir = async () => {
    const dir = await api.invoke('app:select-directory', { defaultPath: modelsDir });
    if (dir) setModelsDir(dir);
  };

  const handleSelectRuntimeDir = async () => {
    const dir = await api.invoke('app:select-directory', { defaultPath: runtimeDir });
    if (dir) setRuntimeDir(dir);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateServerConfig({
        port,
        maxConcurrentRequests: maxConcurrency,
        contextLimit,
        gpuLayers,
        threads,
        lowMemoryMode,
        flashAttention,
        modelsDirectory: modelsDir,
        runtimeDirectory: runtimeDir,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      alert(`Failed to save settings: ${err.message}`);
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-4xl mx-auto overflow-y-auto h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#202227] pb-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Settings className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
            Server & Runtime Configuration
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Configure system ports, memory streaming modes, thread concurrency, and storage paths.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black text-xs font-medium transition-colors shadow-sm"
        >
          {saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
          <span>{saved ? 'Saved ✓' : 'Save Changes'}</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Appearance & Theme Selector */}
        <div className="p-6 rounded-xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#111111] dark:text-[#F5F5F5] flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-500" />
                Appearance & Theme
              </h3>
              <p className="text-xs text-zinc-500 dark:text-[#A1A1AA] mt-0.5">
                Customize your interface with high-contrast Dark theme or clean White theme.
              </p>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-100 dark:bg-[#191919] text-zinc-900 dark:text-[#F5F5F5] border border-zinc-200 dark:border-[#262626] uppercase">
              {theme} mode
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            {/* Dark Theme Option */}
            <button
              type="button"
              onClick={() => setThemePreference('dark')}
              className={`p-4 rounded-lg border text-left transition-all flex items-start gap-3.5 ${
                themePreference === 'dark'
                  ? 'border-black dark:border-white bg-zinc-50 dark:bg-[#202020] ring-1 ring-black/20 dark:ring-white/20'
                  : 'border-[#eaeaea] dark:border-[#262626] bg-white dark:bg-[#141414] hover:border-zinc-400 dark:hover:border-[#737373]'
              }`}
            >
              <div className="p-2 rounded bg-zinc-100 dark:bg-[#191919] border border-zinc-200 dark:border-[#262626] text-zinc-900 dark:text-[#F5F5F5] shrink-0">
                <Moon className="w-4 h-4 text-zinc-900 dark:text-[#F5F5F5]" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#111111] dark:text-[#F5F5F5]">Dark Theme</span>
                  {themePreference === 'dark' && <Check className="w-3.5 h-3.5 text-black dark:text-white" />}
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-[#A1A1AA] leading-tight">
                  High-contrast dark palette (#090909) designed for low-light environments.
                </p>
              </div>
            </button>

            {/* White / Light Theme Option */}
            <button
              type="button"
              onClick={() => setThemePreference('light')}
              className={`p-4 rounded-lg border text-left transition-all flex items-start gap-3.5 ${
                themePreference === 'light'
                  ? 'border-black dark:border-white bg-zinc-50 dark:bg-[#202020] ring-1 ring-black/20 dark:ring-white/20'
                  : 'border-[#eaeaea] dark:border-[#262626] bg-white dark:bg-[#141414] hover:border-zinc-400 dark:hover:border-[#737373]'
              }`}
            >
              <div className="p-2 rounded bg-zinc-100 dark:bg-[#191919] border border-zinc-200 dark:border-[#262626] text-zinc-900 dark:text-[#F5F5F5] shrink-0">
                <Sun className="w-4 h-4 text-amber-500" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#111111] dark:text-[#F5F5F5]">Clean White Theme</span>
                  {themePreference === 'light' && <Check className="w-3.5 h-3.5 text-black dark:text-white" />}
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-[#A1A1AA] leading-tight">
                  Crisp pure white surfaces with minimalist monochrome design.
                </p>
              </div>
            </button>

            {/* System / Auto Option */}
            <button
              type="button"
              onClick={() => setThemePreference('system')}
              className={`p-4 rounded-lg border text-left transition-all flex items-start gap-3.5 ${
                themePreference === 'system'
                  ? 'border-black dark:border-white bg-zinc-50 dark:bg-[#202020] ring-1 ring-black/20 dark:ring-white/20'
                  : 'border-[#eaeaea] dark:border-[#262626] bg-white dark:bg-[#141414] hover:border-zinc-400 dark:hover:border-[#737373]'
              }`}
            >
              <div className="p-2 rounded bg-zinc-100 dark:bg-[#191919] border border-zinc-200 dark:border-[#262626] text-zinc-900 dark:text-[#F5F5F5] shrink-0">
                <Laptop className="w-4 h-4 text-zinc-900 dark:text-[#F5F5F5]" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#111111] dark:text-[#F5F5F5]">System (Auto)</span>
                  {themePreference === 'system' && <Check className="w-3.5 h-3.5 text-black dark:text-white" />}
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-[#A1A1AA] leading-tight">
                  Automatically sync appearance with your macOS / system dark mode.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* 1. Low-Memory Layer Streaming Mode Card */}
        <div className="p-6 rounded-xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] space-y-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-zinc-900 dark:text-[#F5F5F5]" />
                <h3 className="text-sm font-bold text-[#111111] dark:text-[#F5F5F5]">Low-Memory Layer Streaming Mode</h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                  lowMemoryMode ? 'bg-black dark:bg-white text-white dark:text-black border border-black dark:border-white' : 'bg-zinc-100 dark:bg-[#191919] text-zinc-600 dark:text-[#A1A1AA]'
                }`}>
                  {lowMemoryMode ? 'ACTIVE' : 'STANDARD'}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-[#A1A1AA] leading-relaxed max-w-xl">
                Enables 8-bit quantized key-value tensor caching (<code className="font-mono text-zinc-700 dark:text-[#F5F5F5]">-ctk q8_0 -ctv q8_0</code>) and Flash Attention. Allows running larger <strong>7B, 8B, 12B, and 14B models</strong> on machines with low physical RAM (e.g. 8GB RAM) with minimal memory footprint.
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
              <input
                type="checkbox"
                checked={lowMemoryMode}
                onChange={(e) => setLowMemoryMode(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-200 dark:bg-[#262626] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black dark:peer-checked:bg-white"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs font-mono">
            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] space-y-1">
              <span className="text-zinc-500 dark:text-[#737373] text-[10px] block">ACTIVE RAM SAVINGS</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">~60% to 70% Less Working RAM</span>
              <p className="text-[11px] text-zinc-500 dark:text-[#A1A1AA] font-sans mt-0.5">
                Sequential forward pass reads layer weights on-demand from disk.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] space-y-1">
              <span className="text-zinc-500 dark:text-[#737373] text-[10px] block">SPEED CHARACTERISTICS</span>
              <span className="text-zinc-800 dark:text-[#F5F5F5] font-semibold">Fast on NVMe / Apple Unified Memory</span>
              <p className="text-[11px] text-zinc-500 dark:text-[#A1A1AA] font-sans mt-0.5">
                Yields 8–25+ tok/s while preventing out-of-memory crashes.
              </p>
            </div>
          </div>
        </div>

        {/* 2. Compute & Acceleration */}
        <div className="p-6 rounded-lg bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] space-y-4">
          <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-700 dark:text-[#A1A1AA] flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            Compute & Hardware Acceleration
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-700 dark:text-[#A1A1AA] font-medium">GPU Offload Layers</label>
              <input
                type="number"
                min="0"
                max="999"
                value={gpuLayers}
                onChange={(e) => setGpuLayers(parseInt(e.target.value, 10))}
                className="w-full bg-zinc-50 dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] rounded px-3 py-2 text-xs font-mono text-[#111111] dark:text-[#F5F5F5] focus:outline-none focus:border-black dark:focus:border-white"
              />
              <span className="text-[11px] text-zinc-500">99 = Offload all layers to GPU</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-700 dark:text-[#A1A1AA] font-medium">CPU Threads</label>
              <input
                type="number"
                min="1"
                max="64"
                value={threads}
                onChange={(e) => setThreads(parseInt(e.target.value, 10))}
                className="w-full bg-zinc-50 dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] rounded px-3 py-2 text-xs font-mono text-[#111111] dark:text-[#F5F5F5] focus:outline-none focus:border-black dark:focus:border-white"
              />
              <span className="text-[11px] text-zinc-500">Physical cores allocation</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-700 dark:text-[#A1A1AA] font-medium">Default Context Limit</label>
              <input
                type="number"
                min="512"
                max="131072"
                step="512"
                value={contextLimit}
                onChange={(e) => setContextLimit(parseInt(e.target.value, 10))}
                className="w-full bg-zinc-50 dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] rounded px-3 py-2 text-xs font-mono text-[#111111] dark:text-[#F5F5F5] focus:outline-none focus:border-black dark:focus:border-white"
              />
              <span className="text-[11px] text-zinc-500">Tokens in context window</span>
            </div>
          </div>

          {/* Flash Attention Toggle */}
          <div className="pt-2 border-t border-[#eaeaea] dark:border-[#222222] flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-[#111111] dark:text-[#F5F5F5] flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-amber-500" />
                Flash Attention Kernel
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-[#A1A1AA]">
                Reduces KV cache memory footprint by 50% using optimized tiled matrix kernels.
              </p>
            </div>
            <input
              type="checkbox"
              checked={flashAttention}
              onChange={(e) => setFlashAttention(e.target.checked)}
              className="rounded border-[#eaeaea] dark:border-[#262626] bg-white dark:bg-[#191919] accent-black dark:accent-white"
            />
          </div>
        </div>

        {/* 3. Network & Concurrency */}
        <div className="p-6 rounded-lg bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] space-y-4">
          <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-700 dark:text-[#A1A1AA]">Networking & Queue</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-700 dark:text-[#A1A1AA] font-medium">Server Port</label>
              <input
                type="number"
                min="1024"
                max="65535"
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value, 10))}
                className="w-full bg-zinc-50 dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] rounded px-3 py-2 text-xs font-mono text-[#111111] dark:text-[#F5F5F5] focus:outline-none focus:border-black dark:focus:border-white"
              />
              <span className="text-[11px] text-zinc-500">Default: 8080 (Inference API: /v1)</span>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-700 dark:text-[#A1A1AA] font-medium">Max Concurrent Requests</label>
              <input
                type="number"
                min="1"
                max="32"
                value={maxConcurrency}
                onChange={(e) => setMaxConcurrency(parseInt(e.target.value, 10))}
                className="w-full bg-zinc-50 dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] rounded px-3 py-2 text-xs font-mono text-[#111111] dark:text-[#F5F5F5] focus:outline-none focus:border-black dark:focus:border-white"
              />
              <span className="text-[11px] text-zinc-500">Limits concurrency to prevent memory spikes</span>
            </div>
          </div>
        </div>

        {/* 4. File Storage Paths */}
        <div className="p-6 rounded-lg bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] space-y-4">
          <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-700 dark:text-[#A1A1AA] flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
            File Storage Locations
          </h3>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-700 dark:text-[#A1A1AA] font-medium">Models Storage Directory</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={modelsDir}
                  onChange={(e) => setModelsDir(e.target.value)}
                  className="flex-1 bg-zinc-50 dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] rounded px-3 py-2 text-xs font-mono text-[#111111] dark:text-[#F5F5F5] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSelectModelsDir}
                  className="px-3 py-2 bg-zinc-100 dark:bg-[#191919] hover:bg-zinc-200 dark:hover:bg-[#202020] border border-zinc-200 dark:border-[#262626] rounded text-xs text-zinc-700 dark:text-[#F5F5F5] flex items-center gap-1.5 transition-colors"
                >
                  <Folder className="w-3.5 h-3.5" />
                  <span>Browse</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-700 dark:text-[#A1A1AA] font-medium">Runtime Binaries Directory</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={runtimeDir}
                  onChange={(e) => setRuntimeDir(e.target.value)}
                  className="flex-1 bg-zinc-50 dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] rounded px-3 py-2 text-xs font-mono text-[#111111] dark:text-[#F5F5F5] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSelectRuntimeDir}
                  className="px-3 py-2 bg-zinc-100 dark:bg-[#191919] hover:bg-zinc-200 dark:hover:bg-[#202020] border border-zinc-200 dark:border-[#262626] rounded text-xs text-zinc-700 dark:text-[#F5F5F5] flex items-center gap-1.5 transition-colors"
                >
                  <Folder className="w-3.5 h-3.5" />
                  <span>Browse</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
