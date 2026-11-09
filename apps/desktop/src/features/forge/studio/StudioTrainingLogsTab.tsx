import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Terminal,
  Search,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  ArrowDownCircle,
} from 'lucide-react';
import type { TrainingJob } from '@local-ai/shared';

interface StudioTrainingLogsTabProps {
  job: TrainingJob;
}

type SeverityLevel = 'ALL' | 'INFO' | 'WARN' | 'ERROR' | 'CHECKPOINT' | 'METRIC';

interface ParsedLogLine {
  id: string;
  raw: string;
  message: string;
  severity: 'INFO' | 'WARN' | 'ERROR' | 'CHECKPOINT' | 'METRIC';
  category: string;
  timestamp: string;
  isTraceback?: boolean;
}

export const StudioTrainingLogsTab: React.FC<StudioTrainingLogsTabProps> = ({ job }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<SeverityLevel>('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [expandedTracebacks, setExpandedTracebacks] = useState<Record<string, boolean>>({});

  const logsEndRef = useRef<HTMLDivElement>(null);
  const rawLogs = Array.isArray(job.recentLogs) ? job.recentLogs : [];

  // Parse raw log lines with timestamp and severity tagging
  const parsedLogs = useMemo(() => {
    return rawLogs.map((log, idx): ParsedLogLine => {
      const lower = log.toLowerCase();
      let severity: ParsedLogLine['severity'] = 'INFO';
      let category = 'System';
      let isTraceback = false;

      // Detect traceback
      if (
        lower.includes('traceback (most recent call last)') ||
        lower.includes('file "/') ||
        lower.includes('raise ') ||
        (lower.includes('error:') && lower.includes('.py'))
      ) {
        severity = 'ERROR';
        category = 'Traceback';
        isTraceback = true;
      } else if (lower.includes('error') || lower.includes('failed') || lower.includes('exception')) {
        severity = 'ERROR';
        category = 'Error';
      } else if (lower.includes('warn') || lower.includes('warning') || lower.includes('fallback')) {
        severity = 'WARN';
        category = 'Warning';
      } else if (lower.includes('checkpoint') || lower.includes('saving adapter') || lower.includes('saved model')) {
        severity = 'CHECKPOINT';
        category = 'Checkpoint';
      } else if (lower.includes('step ') || lower.includes('loss=') || lower.includes('loss:') || lower.includes('epoch ')) {
        severity = 'METRIC';
        category = 'Step';
      } else if (lower.includes('model') || lower.includes('safetensors') || lower.includes('tokenizer')) {
        category = 'Model';
      } else if (lower.includes('dataset') || lower.includes('records') || lower.includes('tokeniz')) {
        category = 'Dataset';
      }

      // Extract timestamp or construct from job update time
      let timestamp = '';
      const timeMatch = log.match(/\[(\d{2}:\d{2}:\d{2})\]/);
      if (timeMatch) {
        timestamp = timeMatch[1];
      } else {
        timestamp = new Date(job.updatedAt - (rawLogs.length - idx) * 1000).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
      }

      return {
        id: `log_${idx}`,
        raw: log,
        message: log.replace(/^\[.*?\]\s*/, ''),
        severity,
        category,
        timestamp,
        isTraceback,
      };
    });
  }, [rawLogs, job.updatedAt]);

  // Counts for severity pills
  const counts = useMemo(() => {
    const res: Record<SeverityLevel, number> = {
      ALL: parsedLogs.length,
      INFO: 0,
      WARN: 0,
      ERROR: 0,
      CHECKPOINT: 0,
      METRIC: 0,
    };
    for (const l of parsedLogs) {
      res[l.severity]++;
    }
    return res;
  }, [parsedLogs]);

  // Filter logs by search and severity
  const filteredLogs = useMemo(() => {
    return parsedLogs.filter((item) => {
      if (selectedSeverity !== 'ALL' && item.severity !== selectedSeverity) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.raw.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.timestamp.includes(q)
        );
      }
      return true;
    });
  }, [parsedLogs, selectedSeverity, searchQuery]);

  // Auto-scroll to bottom when new logs arrive if autoScroll is enabled
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredLogs.length, autoScroll]);

  const handleCopyLogs = async () => {
    try {
      const text = filteredLogs.map((l) => `[${l.timestamp}] [${l.severity}] ${l.raw}`).join('\n');
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignored
    }
  };

  const toggleTraceback = (id: string) => {
    setExpandedTracebacks((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const getSeverityBadge = (sev: ParsedLogLine['severity']) => {
    switch (sev) {
      case 'ERROR':
        return (
          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20">
            ERR
          </span>
        );
      case 'WARN':
        return (
          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
            WARN
          </span>
        );
      case 'CHECKPOINT':
        return (
          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            CKPT
          </span>
        );
      case 'METRIC':
        return (
          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700">
            STEP
          </span>
        );
      default:
        return (
          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-800 text-zinc-400">
            INFO
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 flex flex-col h-[650px]">
      {/* Controls Header */}
      <div className="p-4 rounded-xl bg-[#101216] border border-[#1e2128] space-y-3 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs by keyword, step, error, or timestamp..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#14161b] border border-[#20232a] text-zinc-200 text-xs placeholder-zinc-500 focus:outline-none focus:border-black dark:focus:border-white font-sans"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 text-xs">
            {/* Auto-scroll toggle */}
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors ${
                autoScroll
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-black dark:border-white'
                  : 'bg-[#14161b] text-zinc-400 border-[#20232a] hover:text-zinc-200'
              }`}
            >
              <ArrowDownCircle className="w-3.5 h-3.5" />
              <span>Auto-scroll: {autoScroll ? 'ON' : 'OFF'}</span>
            </button>

            {/* Copy button */}
            <button
              onClick={handleCopyLogs}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#14161b] border border-[#20232a] text-zinc-300 hover:text-white hover:bg-[#1b1e25] transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Severity Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#1b1e24]">
          <span className="text-[11px] text-zinc-500 font-medium mr-1">Severity:</span>
          {(['ALL', 'INFO', 'METRIC', 'CHECKPOINT', 'WARN', 'ERROR'] as SeverityLevel[]).map((sev) => {
            const count = counts[sev];
            const isSelected = selectedSeverity === sev;
            return (
              <button
                key={sev}
                onClick={() => setSelectedSeverity(sev)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono transition-colors border ${
                  isSelected
                    ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white font-semibold shadow-sm'
                    : 'bg-[#14161b] text-zinc-400 border-[#20232a] hover:text-zinc-200'
                }`}
              >
                <span>{sev}</span>
                <span className="text-[10px] opacity-75">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Logs View Window */}
      <div className="flex-1 rounded-xl bg-[#0a0b0e] border border-[#1e2128] overflow-y-auto p-4 font-mono text-[11px] space-y-1.5 select-text shadow-inner">
        {filteredLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-2">
            <Terminal className="w-8 h-8 opacity-40" />
            <p className="text-xs">
              {rawLogs.length === 0
                ? 'No console log output emitted yet.'
                : 'No log lines matched the active search or severity filter.'}
            </p>
          </div>
        ) : (
          filteredLogs.map((item, idx) => {
            const isExpanded = expandedTracebacks[item.id] || false;

            return (
              <div
                key={item.id}
                className={`flex items-start gap-2.5 px-2 py-1 rounded transition-colors group ${
                  item.severity === 'ERROR'
                    ? 'bg-rose-500/10 border-l-2 border-rose-500 text-rose-300'
                    : item.severity === 'WARN'
                    ? 'bg-amber-500/5 text-amber-300'
                    : item.severity === 'CHECKPOINT'
                    ? 'bg-emerald-500/5 text-emerald-300'
                    : 'hover:bg-[#12141a] text-zinc-300'
                }`}
              >
                {/* Line number */}
                <span className="text-zinc-600 select-none w-8 text-right shrink-0">
                  {idx + 1}
                </span>

                {/* Timestamp */}
                <span className="text-zinc-500 shrink-0 select-none">[{item.timestamp}]</span>

                {/* Severity Badge */}
                <div className="shrink-0">{getSeverityBadge(item.severity)}</div>

                {/* Category tag */}
                <span className="text-zinc-500 font-semibold shrink-0 select-none">
                  [{item.category}]
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <span className="break-all">{item.message}</span>

                  {/* Expandable Traceback View for Errors */}
                  {item.isTraceback && (
                    <div className="mt-2 pl-2 border-l border-rose-500/30">
                      <button
                        onClick={() => toggleTraceback(item.id)}
                        className="inline-flex items-center gap-1 text-[10px] text-rose-400 hover:text-rose-300 font-sans font-semibold underline underline-offset-2"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronDown className="w-3 h-3" />
                            <span>Hide Technical Traceback</span>
                          </>
                        ) : (
                          <>
                            <ChevronRight className="w-3 h-3" />
                            <span>Expand Raw Technical Traceback</span>
                          </>
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-1.5 p-3 rounded bg-[#101216] border border-rose-500/20 text-rose-200 text-[10px] overflow-x-auto whitespace-pre font-mono">
                          {item.raw}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};
