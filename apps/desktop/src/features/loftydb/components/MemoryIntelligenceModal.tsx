import React, { useState } from 'react';
import {
  X,
  Activity,
  GitMerge,
  AlertTriangle,
  Link2,
  Clock,
  TrendingUp,
  Layers,
  Unlink,
  ArrowUpRight,
  Check,
  Share2,
} from 'lucide-react';
import type {
  KnowledgeNodeKind,
  MemoryIntelligenceReport,
  MemoryRelationshipType,
} from '@local-ai/shared';

interface MemoryIntelligenceModalProps {
  intelligence: MemoryIntelligenceReport;
  onClose: () => void;
  onInspectNode: (nodeId: string) => void;
  onSelectClusterIds: (ids: string[]) => void;
  onAcceptMissingLink: (item: {
    sourceId: string;
    targetId: string;
    sourceKind: KnowledgeNodeKind;
    targetKind: KnowledgeNodeKind;
    type: MemoryRelationshipType;
    confidence: number;
  }) => Promise<void>;
  onConfirmMerge: (primaryId: string, secondaryId: string) => Promise<void>;
  onMarkSupersedes: (newerOrAId: string, olderOrBId: string, edgeId?: string) => Promise<void>;
}

type InsightTab =
  | 'overview'
  | 'duplicates'
  | 'contradictions'
  | 'missing'
  | 'clusters'
  | 'activity';

export const MemoryIntelligenceModal: React.FC<MemoryIntelligenceModalProps> = ({
  intelligence,
  onClose,
  onInspectNode,
  onSelectClusterIds,
  onAcceptMissingLink,
  onConfirmMerge,
  onMarkSupersedes,
}) => {
  const [tab, setTab] = useState<InsightTab>('overview');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [pendingMerge, setPendingMerge] = useState<{
    aId: string;
    bId: string;
    aTitle: string;
    bTitle: string;
    similarity: number;
  } | null>(null);

  const tabs: { id: InsightTab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'contradictions', label: 'Contradictions', count: intelligence.contradictions.length },
    { id: 'duplicates', label: 'Similar / Duplicates', count: intelligence.similarDuplicates.length },
    { id: 'missing', label: 'Missing Links', count: intelligence.missingRelationships.length },
    { id: 'clusters', label: 'Clusters', count: intelligence.importantClusters.length },
    { id: 'activity', label: 'Recalls & Edits' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[85vh] rounded-2xl bg-white dark:bg-[#0e1118] border border-slate-200 dark:border-white/15 shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-slate-200">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Activity className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <div>
              <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
                Memory Intelligence &amp; Health
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Real structural, temporal, and semantic analysis computed from LoftyDB collections
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-nav */}
        <div className="px-5 py-2 border-b border-slate-200 dark:border-white/10 flex flex-wrap items-center gap-1.5 bg-slate-50 dark:bg-[#0b0e14]">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 border ${
                tab === t.id
                  ? 'bg-sky-50 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-500/35'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 border-transparent'
              }`}
            >
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span className="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-white/10 text-[10px] font-mono text-slate-800 dark:text-slate-200">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {tab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Highly Connected */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#131722] border border-slate-200 dark:border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-950 dark:text-white flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" /> Highly Connected Hubs
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {intelligence.highlyConnected.length} found
                  </span>
                </div>
                {intelligence.highlyConnected.length === 0 ? (
                  <p className="text-xs text-slate-500">No multi-link hub nodes yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {intelligence.highlyConnected.map((h) => (
                      <button
                        key={h.nodeId}
                        type="button"
                        onClick={() => {
                          onInspectNode(h.nodeId);
                          onClose();
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0e1118] hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/5 text-left text-xs"
                      >
                        <span className="truncate text-slate-800 dark:text-slate-200 pr-2">{h.title}</span>
                        <span className="font-mono text-[10px] text-cyan-700 dark:text-cyan-300 font-semibold shrink-0">
                          {h.degree} links
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Isolated Nodes */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#131722] border border-slate-200 dark:border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-950 dark:text-white flex items-center gap-1.5">
                    <Unlink className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Isolated Memories</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {intelligence.isolated.length} unlinked
                  </span>
                </div>
                {intelligence.isolated.length === 0 ? (
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    All stored memories are connected into the graph.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    {intelligence.isolated.map((iso) => (
                      <button
                        key={iso.nodeId}
                        type="button"
                        onClick={() => {
                          onInspectNode(iso.nodeId);
                          onClose();
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0e1118] hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/5 text-left text-xs"
                      >
                        <span className="truncate text-slate-800 dark:text-slate-200 pr-2">{iso.title}</span>
                        <ArrowUpRight className="w-3 h-3 text-slate-500 dark:text-slate-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'contradictions' && (
            <div className="space-y-3">
              {intelligence.contradictions.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-[#131722] border border-slate-200 dark:border-white/10 text-xs text-emerald-700 dark:text-emerald-400">
                  No contradictory instructions or conflicting preferences detected.
                </div>
              ) : (
                intelligence.contradictions.map((c, idx) => (
                  <div
                    key={`${c.aId}-${c.bId}-${idx}`}
                    className="p-4 rounded-xl bg-rose-50/70 dark:bg-[#131722] border border-rose-300 dark:border-rose-500/30 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{c.reason}</span>
                      </span>
                      <button
                        type="button"
                        disabled={busyKey === `sup_${c.aId}_${c.bId}`}
                        onClick={async () => {
                          setBusyKey(`sup_${c.aId}_${c.bId}`);
                          try {
                            await onMarkSupersedes(c.bId, c.aId, c.edgeId);
                          } finally {
                            setBusyKey(null);
                          }
                        }}
                        className="px-2.5 py-1 rounded-md bg-amber-100 dark:bg-amber-500/20 hover:bg-amber-200 dark:hover:bg-amber-500/30 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/35 text-[11px] font-medium"
                      >
                        Mark Newer SUPERSEDES
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          onInspectNode(c.aId);
                          onClose();
                        }}
                        className="p-2.5 rounded-lg bg-white dark:bg-[#0e1118] border border-slate-200 dark:border-white/10 hover:border-slate-400 dark:hover:border-white/30 text-left text-xs text-slate-800 dark:text-slate-200"
                      >
                        <div className="text-[10px] font-mono text-slate-500 mb-0.5">MEMORY A</div>
                        {c.aTitle}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onInspectNode(c.bId);
                          onClose();
                        }}
                        className="p-2.5 rounded-lg bg-white dark:bg-[#0e1118] border border-slate-200 dark:border-white/10 hover:border-slate-400 dark:hover:border-white/30 text-left text-xs text-slate-800 dark:text-slate-200"
                      >
                        <div className="text-[10px] font-mono text-slate-500 mb-0.5">MEMORY B</div>
                        {c.bTitle}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'duplicates' && (
            <div className="space-y-3">
              {pendingMerge && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/40 space-y-2.5">
                  <div className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                    Confirm Merge ({Math.round(pendingMerge.similarity * 100)}% overlap)
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    Keep <strong>{pendingMerge.aTitle}</strong> and absorb <strong>{pendingMerge.bTitle}</strong> (its tags &amp; relationships will transfer automatically before removal).
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setPendingMerge(null)}
                      className="px-3 py-1 rounded text-xs text-slate-600 dark:text-slate-400"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={busyKey === 'merge'}
                      onClick={async () => {
                        setBusyKey('merge');
                        try {
                          await onConfirmMerge(pendingMerge.aId, pendingMerge.bId);
                          setPendingMerge(null);
                        } finally {
                          setBusyKey(null);
                        }
                      }}
                      className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold"
                    >
                      Confirm Merge
                    </button>
                  </div>
                </div>
              )}

              {intelligence.similarDuplicates.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-[#131722] border border-slate-200 dark:border-white/10 text-xs text-emerald-700 dark:text-emerald-400">
                  No duplicate or near-duplicate memories detected.
                </div>
              ) : (
                intelligence.similarDuplicates.map((dup, idx) => (
                  <div
                    key={`${dup.aId}-${dup.bId}-${idx}`}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-[#131722] border border-slate-200 dark:border-white/10 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
                        {dup.reason} ({Math.round(dup.similarity * 100)}%)
                      </span>
                      <button
                        type="button"
                        onClick={() => setPendingMerge(dup)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/15 border border-slate-200 dark:border-transparent text-xs text-slate-900 dark:text-white font-medium"
                      >
                        <GitMerge className="w-3 h-3" />
                        <span>Review Merge</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onInspectNode(dup.aId);
                          onClose();
                        }}
                        className="p-2 rounded bg-white dark:bg-[#0e1118] border border-slate-200 dark:border-white/10 text-left text-xs text-slate-800 dark:text-slate-200 hover:border-slate-400 dark:hover:border-white/25"
                      >
                        {dup.aTitle}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onInspectNode(dup.bId);
                          onClose();
                        }}
                        className="p-2 rounded bg-white dark:bg-[#0e1118] border border-slate-200 dark:border-white/10 text-left text-xs text-slate-800 dark:text-slate-200 hover:border-slate-400 dark:hover:border-white/25"
                      >
                        {dup.bTitle}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'missing' && (
            <div className="space-y-2.5">
              {intelligence.missingRelationships.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-[#131722] border border-slate-200 dark:border-white/10 text-xs text-slate-500 dark:text-slate-400">
                  No unlinked high-similarity memory pairs waiting for connections.
                </div>
              ) : (
                intelligence.missingRelationships.map((mr) => {
                  const key = `${mr.sourceId}-${mr.targetId}`;
                  return (
                    <div
                      key={key}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#131722] border border-slate-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-sky-700 dark:text-sky-300">
                          <Link2 className="w-3 h-3" />
                          <span>Suggested: {mr.suggestedType}</span>
                          <span className="text-slate-500">· {mr.reason}</span>
                        </div>
                        <div className="text-xs text-slate-800 dark:text-slate-200 truncate">
                          {mr.sourceTitle} ↔ {mr.targetTitle}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={busyKey === key}
                        onClick={async () => {
                          setBusyKey(key);
                          try {
                            await onAcceptMissingLink({
                              sourceId: mr.sourceId,
                              targetId: mr.targetId,
                              sourceKind: mr.sourceKind,
                              targetKind: mr.targetKind,
                              type: mr.suggestedType,
                              confidence: mr.confidence,
                            });
                          } finally {
                            setBusyKey(null);
                          }
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shrink-0"
                      >
                        <Check className="w-3 h-3" />
                        <span>{busyKey === key ? 'Linking...' : 'Accept Link'}</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === 'clusters' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {intelligence.importantClusters.map((cl) => (
                <button
                  key={cl.name}
                  type="button"
                  onClick={() => {
                    onSelectClusterIds(cl.memberIds);
                    onClose();
                  }}
                  className="p-4 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#131722] dark:hover:bg-[#181e2c] border border-slate-200 dark:border-white/10 text-left space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-950 dark:text-white flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                      <span>{cl.name}</span>
                    </span>
                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {cl.count} nodes · avg ★{cl.avgImportance}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Click to select &amp; isolate this cluster inside the graph canvas.
                  </p>
                </button>
              ))}
            </div>
          )}

          {tab === 'activity' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#131722] border border-slate-200 dark:border-white/10 space-y-2.5">
                <div className="text-xs font-semibold text-slate-950 dark:text-white flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Frequently Retrieved Memories</span>
                </div>
                {intelligence.frequentlyRetrieved.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No recall hits recorded yet. Recall simulation or Playground chat increments real retrieval metrics.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {intelligence.frequentlyRetrieved.map((fr) => (
                      <button
                        key={fr.nodeId}
                        type="button"
                        onClick={() => {
                          onInspectNode(fr.nodeId);
                          onClose();
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-white dark:bg-[#0e1118] border border-slate-200 dark:border-white/5 text-xs text-left"
                      >
                        <span className="truncate text-slate-800 dark:text-slate-200 pr-2">{fr.title}</span>
                        <span className="font-mono text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold shrink-0">
                          {fr.accessCount} recalls
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#131722] border border-slate-200 dark:border-white/10 space-y-2.5">
                <div className="text-xs font-semibold text-slate-950 dark:text-white flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  <span>Recently Updated Memories</span>
                </div>
                {intelligence.recentlyUpdated.length === 0 ? (
                  <p className="text-xs text-slate-500">No memories stored yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {intelligence.recentlyUpdated.map((ru) => (
                      <button
                        key={ru.nodeId}
                        type="button"
                        onClick={() => {
                          onInspectNode(ru.nodeId);
                          onClose();
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-white dark:bg-[#0e1118] border border-slate-200 dark:border-white/5 text-xs text-left"
                      >
                        <span className="truncate text-slate-800 dark:text-slate-200 pr-2">{ru.title}</span>
                        <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
                          v{ru.version} · {new Date(ru.updatedAt).toLocaleDateString()}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
