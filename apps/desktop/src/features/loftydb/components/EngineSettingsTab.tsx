import React, { useEffect, useState } from 'react';
import { Folder, Save, Check, PlugZap, Terminal } from 'lucide-react';
import type { LoftyDbConnectionMode } from '@local-ai/shared';
import { api } from '../../../api/client';
import { useAppStore } from '../../../stores/useAppStore';

export const EngineSettingsTab: React.FC = () => {
  const { loftyDbConfig, loftyDbStatus, loftyDbLogs, updateLoftyDbConfig } = useAppStore();

  const [enabled, setEnabled] = useState(loftyDbConfig?.enabled ?? true);
  const [autoStart, setAutoStart] = useState(loftyDbConfig?.autoStart ?? true);
  const [mode, setMode] = useState<LoftyDbConnectionMode>(loftyDbConfig?.mode ?? 'managed');
  const [port, setPort] = useState(loftyDbConfig?.port ?? 8090);
  const [baseUrl, setBaseUrl] = useState(loftyDbConfig?.baseUrl ?? 'http://127.0.0.1:8090');
  const [dataDir, setDataDir] = useState(loftyDbConfig?.dataDir ?? '');
  const [binaryPath, setBinaryPath] = useState(loftyDbConfig?.binaryPath ?? '');
  const [memoryEnabled, setMemoryEnabled] = useState(loftyDbConfig?.memoryEnabled ?? true);
  const [autoExtractMemories, setAutoExtractMemories] = useState(loftyDbConfig?.autoExtractMemories ?? true);
  const [recallLimit, setRecallLimit] = useState(loftyDbConfig?.recallLimit ?? 5);
  const [minSimilarity, setMinSimilarity] = useState(loftyDbConfig?.minSimilarity ?? 0.15);

  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (!loftyDbConfig) return;
    setEnabled(loftyDbConfig.enabled);
    setAutoStart(loftyDbConfig.autoStart);
    setMode(loftyDbConfig.mode);
    setPort(loftyDbConfig.port);
    setBaseUrl(loftyDbConfig.baseUrl);
    setDataDir(loftyDbConfig.dataDir);
    setBinaryPath(loftyDbConfig.binaryPath || '');
    setMemoryEnabled(loftyDbConfig.memoryEnabled);
    setAutoExtractMemories(loftyDbConfig.autoExtractMemories);
    setRecallLimit(loftyDbConfig.recallLimit);
    setMinSimilarity(loftyDbConfig.minSimilarity);
  }, [loftyDbConfig]);

  const handleBrowseDataDir = async () => {
    const dir = await api.invoke('app:select-directory', { defaultPath: dataDir });
    if (dir) setDataDir(dir);
  };

  const handleTestConnection = async () => {
    const targetUrl = mode === 'external' ? baseUrl : `http://127.0.0.1:${port}`;
    setTestResult('Testing...');
    const res = await api.invoke('loftydb:test-connection', { baseUrl: targetUrl });
    if (res.ok && res.stats) {
      setTestResult(
        `Connected ✓ (${res.stats.col_count} collections, ${res.stats.doc_count} docs, tx #${res.stats.tx_count})`
      );
    } else {
      setTestResult(`Failed: ${res.error || 'Unreachable'}`);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateLoftyDbConfig({
      enabled,
      autoStart,
      mode,
      port,
      baseUrl: mode === 'managed' ? `http://127.0.0.1:${port}` : baseUrl,
      dataDir,
      binaryPath: binaryPath.trim() || undefined,
      memoryEnabled,
      autoExtractMemories,
      recallLimit,
      minSimilarity,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSave} className="space-y-5">
        {/* Connection Mode & Endpoint */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-[#111111] dark:text-[#F5F5F5]">
                LoftyDB Direct Engine Configuration
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-[#A1A1AA]">
                Zaylo connects directly to the native Go LoftyDB engine. Default port is 8090 so it never collides with Zaylo API (8080).
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-[#191919] text-zinc-600 dark:text-[#A1A1AA] border border-[#eaeaea] dark:border-[#262626]">
              {loftyDbStatus?.binaryFound ? 'Binary Detected' : 'Binary Not Found'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode('managed')}
              className={`p-3.5 rounded-xl border text-left transition-colors ${
                mode === 'managed'
                  ? 'border-black dark:border-white bg-zinc-50 dark:bg-[#202020]'
                  : 'border-[#eaeaea] dark:border-[#262626]'
              }`}
            >
              <div className="text-xs font-semibold text-[#111111] dark:text-[#F5F5F5]">Managed Local Binary</div>
              <div className="text-[11px] text-zinc-500 dark:text-[#A1A1AA] mt-0.5">
                Zaylo launches & manages the installed <code>loftydb</code> binary directly.
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMode('external')}
              className={`p-3.5 rounded-xl border text-left transition-colors ${
                mode === 'external'
                  ? 'border-black dark:border-white bg-zinc-50 dark:bg-[#202020]'
                  : 'border-[#eaeaea] dark:border-[#262626]'
              }`}
            >
              <div className="text-xs font-semibold text-[#111111] dark:text-[#F5F5F5]">External LoftyDB Server</div>
              <div className="text-[11px] text-zinc-500 dark:text-[#A1A1AA] mt-0.5">
                Connect directly to an already-running LoftyDB URL (e.g. from CLI).
              </div>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mode === 'managed' ? (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-700 dark:text-[#A1A1AA]">Engine Port</label>
                  <input
                    type="number"
                    min={1024}
                    max={65535}
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value))}
                    className="w-full rounded-lg bg-zinc-50 dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] px-3 py-2 text-xs font-mono text-[#111111] dark:text-[#F5F5F5]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-700 dark:text-[#A1A1AA]">Data Directory</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={dataDir}
                      onChange={(e) => setDataDir(e.target.value)}
                      className="flex-1 rounded-lg bg-zinc-50 dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] px-3 py-2 text-xs font-mono text-[#111111] dark:text-[#F5F5F5]"
                    />
                    <button
                      type="button"
                      onClick={handleBrowseDataDir}
                      className="px-3 py-2 rounded-lg border border-[#eaeaea] dark:border-[#262626] bg-zinc-50 dark:bg-[#191919] text-xs text-zinc-600 dark:text-[#A1A1AA] hover:text-black dark:hover:text-white"
                    >
                      <Folder className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-medium text-zinc-700 dark:text-[#A1A1AA]">
                    Binary Path Override (optional — auto-detected: <code className="text-[11px]">{loftyDbStatus?.binaryPath || 'none'}</code>)
                  </label>
                  <input
                    type="text"
                    value={binaryPath}
                    onChange={(e) => setBinaryPath(e.target.value)}
                    placeholder="Leave empty to use auto-detected loftydb binary"
                    className="w-full rounded-lg bg-zinc-50 dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] px-3 py-2 text-xs font-mono text-[#111111] dark:text-[#F5F5F5]"
                  />
                </div>
              </>
            ) : (
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-medium text-zinc-700 dark:text-[#A1A1AA]">External LoftyDB Base URL</label>
                <input
                  type="url"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="http://127.0.0.1:8090"
                  className="w-full rounded-lg bg-zinc-50 dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] px-3 py-2 text-xs font-mono text-[#111111] dark:text-[#F5F5F5]"
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-6 pt-1">
            <label className="flex items-center gap-2 text-xs text-[#111111] dark:text-[#F5F5F5] cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded accent-black dark:accent-white"
              />
              <span>Enable LoftyDB Integration</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-[#111111] dark:text-[#F5F5F5] cursor-pointer">
              <input
                type="checkbox"
                checked={autoStart}
                onChange={(e) => setAutoStart(e.target.checked)}
                className="rounded accent-black dark:accent-white"
              />
              <span>Auto-Start / Connect on App Launch</span>
            </label>
          </div>
        </div>

        {/* Memory Tuning */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] space-y-4">
          <h3 className="text-xs font-bold text-[#111111] dark:text-[#F5F5F5]">Memory Recall Tuning</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-700 dark:text-[#A1A1AA]">
                Max Recalled Memories per Prompt ({recallLimit})
              </label>
              <input
                type="range"
                min={1}
                max={20}
                value={recallLimit}
                onChange={(e) => setRecallLimit(Number(e.target.value))}
                className="w-full accent-black dark:accent-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-700 dark:text-[#A1A1AA]">
                Minimum Vector Similarity ({minSimilarity.toFixed(2)})
              </label>
              <input
                type="range"
                min={0}
                max={0.8}
                step={0.05}
                value={minSimilarity}
                onChange={(e) => setMinSimilarity(Number(e.target.value))}
                className="w-full accent-black dark:accent-white"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleTestConnection}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#eaeaea] dark:border-[#262626] text-xs font-medium text-[#111111] dark:text-[#F5F5F5] hover:border-black dark:hover:border-white"
              >
                <PlugZap className="w-3.5 h-3.5" />
                <span>Test Connection</span>
              </button>
              {testResult && <span className="text-xs font-mono text-zinc-600 dark:text-[#A1A1AA]">{testResult}</span>}
            </div>

            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-black dark:bg-white text-white dark:text-black text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-200"
            >
              {saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              <span>{saved ? 'Saved ✓' : 'Save Configuration'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Engine Console Logs */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#111111] dark:text-[#F5F5F5]">
          <Terminal className="w-3.5 h-3.5 text-zinc-500" />
          <span>LoftyDB Engine Output</span>
        </div>
        <div className="p-3 rounded-lg bg-zinc-50 dark:bg-[#0D0D0D] border border-[#eaeaea] dark:border-[#222222] max-h-48 overflow-y-auto font-mono text-[11px] text-zinc-600 dark:text-zinc-300 space-y-1 select-text">
          {loftyDbLogs.length === 0 ? (
            <span className="text-zinc-400">No engine logs captured yet.</span>
          ) : (
            loftyDbLogs.map((line, i) => <div key={i}>{line}</div>)
          )}
        </div>
      </div>
    </div>
  );
};
