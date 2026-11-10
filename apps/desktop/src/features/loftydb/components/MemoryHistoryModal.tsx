import React, { useEffect, useState } from 'react';
import {
  History,
  X,
  RotateCcw,
  GitCompare,
  Clock,
  Loader2,
  Trash2,
} from 'lucide-react';
import type { LoftyDbDiffResult, LoftyDbHistoryEntry } from '@local-ai/shared';
import { api } from '../../../api/client';
import { stripDocumentMeta } from '../utils/loftyFormatters';

interface MemoryHistoryModalProps {
  isOpen: boolean;
  collection: string;
  docId: string;
  title?: string;
  onClose: () => void;
  onRolledBack?: () => void;
  onTimeTravelAsOf?: (timestampNs: string) => void;
}

export const MemoryHistoryModal: React.FC<MemoryHistoryModalProps> = ({
  isOpen,
  collection,
  docId,
  title,
  onClose,
  onRolledBack,
  onTimeTravelAsOf,
}) => {
  const [history, setHistory] = useState<LoftyDbHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [v1, setV1] = useState<number>(1);
  const [v2, setV2] = useState<number>(1);
  const [diff, setDiff] = useState<LoftyDbDiffResult | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [rollingBackVersion, setRollingBackVersion] = useState<number | null>(null);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    setDiff(null);
    try {
      const entries = await api.invoke('loftydb:get-history', { collection, id: docId });
      const sorted = [...(entries || [])].sort((a, b) => b.version - a.version);
      setHistory(sorted);
      if (sorted.length >= 2) {
        setV2(sorted[0].version);
        setV1(sorted[1].version);
      } else if (sorted.length === 1) {
        setV1(sorted[0].version);
        setV2(sorted[0].version);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load version history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && collection && docId) {
      void loadHistory();
    }
  }, [isOpen, collection, docId]);

  if (!isOpen) return null;

  const formatNsTimestamp = (entry: LoftyDbHistoryEntry): string => {
    const ms = entry.timestampNs
      ? Number(BigInt(entry.timestampNs) / 1_000_000n)
      : Math.floor(entry.timestamp / 1_000_000);
    return Number.isFinite(ms) && ms > 0 ? new Date(ms).toLocaleString() : String(entry.timestamp);
  };

  const handleComputeDiff = async () => {
    if (v1 === v2) {
      setDiff({ added: {}, removed: {}, changed: {} });
      return;
    }
    setDiffLoading(true);
    setError(null);
    try {
      const res = await api.invoke('loftydb:diff-versions', { collection, id: docId, v1, v2 });
      setDiff(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to diff versions');
    } finally {
      setDiffLoading(false);
    }
  };

  const handleRollback = async (version: number) => {
    if (!confirm(`Roll back "${docId}" to version v${version}? This creates a new latest transaction.`)) {
      return;
    }
    setRollingBackVersion(version);
    setError(null);
    try {
      await api.invoke('loftydb:rollback', { collection, id: docId, version });
      await loadHistory();
      onRolledBack?.();
    } catch (err: any) {
      setError(err?.message || 'Rollback failed');
    } finally {
      setRollingBackVersion(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#eaeaea] dark:border-[#222222] bg-zinc-50 dark:bg-[#191919] flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <History className="w-5 h-5 text-zinc-700 dark:text-[#F5F5F5] shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[#111111] dark:text-[#F5F5F5] truncate">
                Time Travel & Revision History
              </h3>
              <p className="text-[11px] font-mono text-zinc-500 dark:text-[#A1A1AA] truncate">
                {collection} / {title || docId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-[#F5F5F5] hover:bg-zinc-200/50 dark:hover:bg-[#202020] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 text-xs text-rose-600 dark:text-rose-300">
              {error}
            </div>
          )}

          {/* Diff Controls */}
          {history.length >= 2 && (
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#111111] dark:text-[#F5F5F5]">
                  <GitCompare className="w-4 h-4 text-zinc-500" />
                  <span>Compare Revisions</span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={v1}
                    onChange={(e) => setV1(Number(e.target.value))}
                    className="bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] rounded-lg px-2.5 py-1 text-xs font-mono text-[#111111] dark:text-[#F5F5F5]"
                  >
                    {history.map((h) => (
                      <option key={`v1-${h.version}`} value={h.version}>
                        v{h.version}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-zinc-400">vs</span>
                  <select
                    value={v2}
                    onChange={(e) => setV2(Number(e.target.value))}
                    className="bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] rounded-lg px-2.5 py-1 text-xs font-mono text-[#111111] dark:text-[#F5F5F5]"
                  >
                    {history.map((h) => (
                      <option key={`v2-${h.version}`} value={h.version}>
                        v{h.version}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleComputeDiff}
                    disabled={diffLoading}
                    className="px-3 py-1 rounded-lg bg-black dark:bg-white text-white dark:text-black text-xs font-medium hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors disabled:opacity-50"
                  >
                    {diffLoading ? 'Comparing...' : 'Diff'}
                  </button>
                </div>
              </div>

              {diff && (
                <div className="p-3 rounded-lg bg-white dark:bg-[#0D0D0D] border border-[#eaeaea] dark:border-[#262626] text-xs font-mono space-y-2 max-h-48 overflow-y-auto select-text">
                  {Object.keys(diff.added || {}).length === 0 &&
                  Object.keys(diff.removed || {}).length === 0 &&
                  Object.keys(diff.changed || {}).length === 0 ? (
                    <span className="text-zinc-500">No field differences between v{v1} and v{v2}.</span>
                  ) : (
                    <>
                      {Object.entries(diff.added || {}).map(([k, val]) => (
                        <div key={`add-${k}`} className="text-emerald-600 dark:text-emerald-400">
                          + {k}: {JSON.stringify(val)}
                        </div>
                      ))}
                      {Object.entries(diff.removed || {}).map(([k, val]) => (
                        <div key={`rem-${k}`} className="text-rose-600 dark:text-rose-400">
                          - {k}: {JSON.stringify(val)}
                        </div>
                      ))}
                      {Object.entries(diff.changed || {}).map(([k, ch]) => (
                        <div key={`chg-${k}`} className="text-amber-600 dark:text-amber-400">
                          ~ {k}: {JSON.stringify(ch.from)} → {JSON.stringify(ch.to)}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Revisions Timeline */}
          {loading ? (
            <div className="py-12 flex items-center justify-center gap-2 text-xs text-zinc-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading temporal revisions...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="p-8 rounded-xl bg-zinc-50 dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-center text-xs text-zinc-500">
              No historical revisions recorded for this document.
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((entry, idx) => {
                const isLatest = idx === 0;
                const tsNs = entry.timestampNs || String(entry.timestamp);
                const sanitizedPayload = stripDocumentMeta(entry.payload || {});

                return (
                  <div
                    key={entry.version}
                    className={`p-4 rounded-xl border space-y-2.5 ${
                      isLatest
                        ? 'bg-zinc-50 dark:bg-[#191919] border-black/30 dark:border-white/30'
                        : 'bg-white dark:bg-[#141414] border-[#eaeaea] dark:border-[#262626]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-black dark:bg-white text-white dark:text-black text-[11px] font-mono font-semibold">
                          v{entry.version}
                        </span>
                        <span className="text-[11px] font-mono text-zinc-500 dark:text-[#A1A1AA]">
                          tx #{entry.tx_id}
                        </span>
                        {isLatest && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            CURRENT
                          </span>
                        )}
                        {entry.is_deleted && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                            <Trash2 className="w-2.5 h-2.5" />
                            TOMBSTONE
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-zinc-500 dark:text-[#737373] flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatNsTimestamp(entry)}
                        </span>

                        {onTimeTravelAsOf && (
                          <button
                            onClick={() => {
                              onTimeTravelAsOf(tsNs);
                              onClose();
                            }}
                            className="px-2.5 py-1 rounded-lg border border-[#eaeaea] dark:border-[#262626] hover:border-black dark:hover:border-white text-[11px] font-medium text-zinc-700 dark:text-[#F5F5F5] transition-colors"
                            title="Inspect collection AS OF this timestamp"
                          >
                            AS OF
                          </button>
                        )}

                        {!isLatest && (
                          <button
                            onClick={() => handleRollback(entry.version)}
                            disabled={rollingBackVersion === entry.version}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black dark:bg-white text-white dark:text-black text-[11px] font-medium hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors disabled:opacity-50"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>{rollingBackVersion === entry.version ? 'Rolling back...' : 'Rollback'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <pre className="p-3 rounded-lg bg-zinc-50 dark:bg-[#0D0D0D] border border-[#eaeaea] dark:border-[#222222] text-[11px] font-mono text-zinc-700 dark:text-zinc-300 overflow-x-auto max-h-40 select-text">
                      {JSON.stringify(sanitizedPayload, null, 2)}
                    </pre>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#eaeaea] dark:border-[#222222] bg-zinc-50 dark:bg-[#191919] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-black dark:bg-white text-white dark:text-black text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
