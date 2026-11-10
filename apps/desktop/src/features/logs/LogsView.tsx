import React, { useState } from 'react';
import {
  Terminal,
  Trash2,
  Download,
  Search,
  Check,
  Copy,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

export const LogsView: React.FC = () => {
  const { logs, clearLogs } = useAppStore();
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [selectedComponent, setSelectedComponent] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const filteredLogs = logs.filter((l) => {
    if (selectedLevel !== 'ALL' && l.level !== selectedLevel) return false;
    if (selectedComponent !== 'ALL' && l.component !== selectedComponent) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        l.message.toLowerCase().includes(q) ||
        l.event.toLowerCase().includes(q) ||
        l.component.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleCopyLogs = () => {
    const text = filteredLogs
      .map(
        (l) =>
          `[${new Date(l.timestamp).toISOString()}] [${l.level}] [${l.component}] ${l.message}`
      )
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportLogs = () => {
    const text = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `local-ai-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto overflow-y-auto h-[calc(100vh-4rem)]">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#eaeaea] dark:border-[#222222] pb-4">
        <div>
          <h2 className="text-sm font-semibold text-[#111111] dark:text-[#f5f5f5] flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#666666] dark:text-[#a1a1aa]" />
            Structured System & Inference Logs
          </h2>
          <p className="text-xs text-[#666666] dark:text-[#a1a1aa] mt-0.5">
            Real-time logs with automated secret redaction for API keys and auth headers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLogs}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white dark:bg-[#141414] hover:bg-[#f5f5f5] dark:hover:bg-[#202020] border border-[#eaeaea] dark:border-[#262626] text-[#111111] dark:text-[#f5f5f5] text-xs transition-colors"
            title="Copy filtered logs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>Copy</span>
          </button>

          <button
            onClick={handleExportLogs}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white dark:bg-[#141414] hover:bg-[#f5f5f5] dark:hover:bg-[#202020] border border-[#eaeaea] dark:border-[#262626] text-[#111111] dark:text-[#f5f5f5] text-xs transition-colors"
            title="Export JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>

          <button
            onClick={clearLogs}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white dark:bg-[#141414] hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-[#eaeaea] dark:border-[#262626] text-[#666666] dark:text-[#a1a1aa] hover:text-rose-600 dark:hover:text-rose-400 text-xs transition-colors"
            title="Clear all logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#888888] dark:text-[#737373] absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search log messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] rounded-md pl-8 pr-3 py-1.5 text-xs text-[#111111] dark:text-[#f5f5f5] placeholder-[#888888] dark:placeholder-[#737373] font-mono focus:outline-none focus:border-black dark:focus:border-white"
          />
        </div>

        {/* Level filter */}
        <select
          value={selectedLevel}
          onChange={(e) => setSelectedLevel(e.target.value)}
          className="bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] rounded-md px-3 py-1.5 text-xs text-[#111111] dark:text-[#f5f5f5] font-mono focus:outline-none"
        >
          <option value="ALL">All Severity Levels</option>
          <option value="INFO">INFO</option>
          <option value="WARN">WARN</option>
          <option value="ERROR">ERROR</option>
          <option value="DEBUG">DEBUG</option>
        </select>

        {/* Component filter */}
        <select
          value={selectedComponent}
          onChange={(e) => setSelectedComponent(e.target.value)}
          className="bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] rounded-md px-3 py-1.5 text-xs text-[#111111] dark:text-[#f5f5f5] font-mono focus:outline-none"
        >
          <option value="ALL">All Components</option>
          <option value="SERVER">SERVER</option>
          <option value="RUNTIME">RUNTIME</option>
          <option value="INFERENCE">INFERENCE</option>
          <option value="NETWORK">NETWORK</option>
          <option value="SYSTEM">SYSTEM</option>
          <option value="SECURITY">SECURITY</option>
        </select>
      </div>

      {/* Logs Console Table */}
      <div className="border border-[#eaeaea] dark:border-[#262626] rounded-lg bg-[#fafafa] dark:bg-[#0c0d10] font-mono text-xs overflow-hidden">
        <div className="p-3 border-b border-[#eaeaea] dark:border-[#222222] bg-[#f0f0f0] dark:bg-[#0f1115] text-[11px] text-[#666666] dark:text-[#737373] flex justify-between">
          <span>{filteredLogs.length} Events Displayed</span>
          <span>Redaction Active (lcl_••••••••••••)</span>
        </div>

        <div className="max-h-[500px] overflow-y-auto divide-y divide-[#eaeaea] dark:divide-[#17191f] p-2 space-y-1">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-[#888888] dark:text-[#737373] font-sans">No matching logs found.</div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="p-2 rounded hover:bg-white dark:hover:bg-[#13151b] flex items-start gap-3 text-xs leading-relaxed">
                <span className="text-[#888888] dark:text-[#737373] shrink-0 text-[11px]">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${
                    log.level === 'ERROR'
                      ? 'bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40'
                      : log.level === 'WARN'
                      ? 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40'
                      : log.level === 'DEBUG'
                      ? 'bg-[#eaeaea] dark:bg-zinc-800 text-[#666666] dark:text-zinc-400'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700'
                  }`}
                >
                  {log.level}
                </span>
                <span className="text-[#666666] dark:text-zinc-500 text-[11px] shrink-0 font-medium">[{log.component}]</span>
                <span className="text-[#111111] dark:text-[#f5f5f5] flex-1 break-all select-text">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
