import React, { useEffect, useState } from 'react';
import {
  X,
  Edit2,
  Trash2,
  GitMerge,
  Sparkles,
  Share2,
  ExternalLink,
  History,
  Pin,
  Plus,
  Check,
  ArrowRight,
  ArrowLeft,
  Cpu,
  Copy,
} from 'lucide-react';
import type {
  MemoryCategory,
  MemoryEntry,
  MemoryIntelligenceReport,
  MemoryRelationshipType,
} from '@local-ai/shared';
import {
  ALL_RELATIONSHIP_TYPES,
  NODE_CATEGORY_META,
  RELATIONSHIP_META,
  type GraphEdge,
  type GraphNode,
} from '../graph/graphTypes';

interface MemoryInspectorPanelProps {
  node: GraphNode;
  allNodes: GraphNode[];
  edges: GraphEdge[];
  nodeById: Map<string, GraphNode>;
  similarityScore?: number;
  intelligence: MemoryIntelligenceReport | null;
  onClose: () => void;
  onNavigateToNode: (id: string) => void;
  onEditMemory: (
    id: string,
    patch: { title?: string; content: string; category: MemoryCategory; importance: number; pinned: boolean }
  ) => Promise<void>;
  onDeleteMemory: (id: string) => Promise<void>;
  onTogglePin: (entry: MemoryEntry) => Promise<void>;
  onMergeMemories: (primaryId: string, secondaryId: string, mergedContent: string) => Promise<void>;
  onFindSimilar: (text: string) => void;
  onExpandNeighbors: (nodeId: string) => void;
  onViewSourceConversation: (conversationId: string) => void;
  onViewHistory: (entry: MemoryEntry) => void;
  onCreateRelationship: (input: {
    sourceId: string;
    targetId: string;
    sourceKind: GraphNode['kind'];
    targetKind: GraphNode['kind'];
    type: MemoryRelationshipType;
  }) => Promise<void>;
  onDeleteRelationship: (edgeId: string) => Promise<void>;
}

export const MemoryInspectorPanel: React.FC<MemoryInspectorPanelProps> = ({
  node,
  allNodes,
  edges,
  nodeById,
  similarityScore,
  intelligence,
  onClose,
  onNavigateToNode,
  onEditMemory,
  onDeleteMemory,
  onTogglePin,
  onMergeMemories,
  onFindSimilar,
  onExpandNeighbors,
  onViewSourceConversation,
  onViewHistory,
  onCreateRelationship,
  onDeleteRelationship,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(node.title);
  const [editContent, setEditContent] = useState(node.content);
  const [editCategory, setEditCategory] = useState<MemoryCategory>(
    (node.memory?.category as MemoryCategory) || 'fact'
  );
  const [editImportance, setEditImportance] = useState(node.importance);
  const [editPinned, setEditPinned] = useState(node.pinned);
  const [busy, setBusy] = useState(false);

  // Merge panel state
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergeContent, setMergeContent] = useState('');

  // Inline Create Relationship state
  const [isAddRelOpen, setIsAddRelOpen] = useState(false);
  const [relTargetId, setRelTargetId] = useState('');
  const [relType, setRelType] = useState<MemoryRelationshipType>('RELATED_TO');
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    setIsEditing(false);
    setIsMergeOpen(false);
    setIsAddRelOpen(false);
    setEditTitle(node.title);
    setEditContent(node.content);
    setEditCategory((node.memory?.category as MemoryCategory) || 'fact');
    setEditImportance(node.importance);
    setEditPinned(node.pinned);
  }, [node.id, node.title, node.content, node.importance, node.pinned, node.memory?.category]);

  const connections = React.useMemo(() => {
    const outgoing: Array<{ edge: GraphEdge; peer: GraphNode }> = [];
    const incoming: Array<{ edge: GraphEdge; peer: GraphNode }> = [];
    for (const edge of edges) {
      if (edge.source === node.id) {
        const peer = nodeById.get(edge.target);
        if (peer) outgoing.push({ edge, peer });
      } else if (edge.target === node.id) {
        const peer = nodeById.get(edge.source);
        if (peer) incoming.push({ edge, peer });
      }
    }
    return { outgoing, incoming, total: outgoing.length + incoming.length };
  }, [edges, node.id, nodeById]);

  const mergeCandidates = React.useMemo(() => {
    const others = allNodes.filter((n) => n.kind === 'memory' && n.id !== node.id);
    if (!intelligence) return others.slice(0, 15);
    const ranked = new Set<string>();
    for (const dup of intelligence.similarDuplicates) {
      if (dup.aId === node.id) ranked.add(dup.bId);
      if (dup.bId === node.id) ranked.add(dup.aId);
    }
    return others.sort((a, b) => (ranked.has(b.id) ? 1 : 0) - (ranked.has(a.id) ? 1 : 0)).slice(0, 20);
  }, [allNodes, node.id, intelligence]);

  const relCandidates = React.useMemo(
    () => allNodes.filter((n) => n.id !== node.id && !n.isClusterProxy).slice(0, 40),
    [allNodes, node.id]
  );

  const openMergePanel = () => {
    const first = mergeCandidates[0];
    setMergeTargetId(first?.id || '');
    setMergeContent(node.content);
    setIsMergeOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!node.memory || !editContent.trim()) return;
    setBusy(true);
    try {
      await onEditMemory(node.id, {
        title: editTitle.trim(),
        content: editContent.trim(),
        category: editCategory,
        importance: editImportance,
        pinned: editPinned,
      });
      setIsEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmMerge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mergeTargetId || !mergeContent.trim()) return;
    setBusy(true);
    try {
      await onMergeMemories(node.id, mergeTargetId, mergeContent.trim());
      setIsMergeOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleAddRel = async (e: React.FormEvent) => {
    e.preventDefault();
    const tgt = relTargetId ? nodeById.get(relTargetId) : relCandidates[0];
    if (!tgt) return;
    setBusy(true);
    try {
      await onCreateRelationship({
        sourceId: node.id,
        targetId: tgt.id,
        sourceKind: node.kind,
        targetKind: tgt.kind,
        type: relType,
      });
      setIsAddRelOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const catMeta = NODE_CATEGORY_META[node.category] || NODE_CATEGORY_META.fact;

  return (
    <aside className="w-full lg:w-80 shrink-0 h-full bg-white dark:bg-[#0e1118] border-l border-slate-200 dark:border-white/10 flex flex-col text-slate-900 dark:text-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: node.color }}
          />
          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
            {catMeta.label} Inspector
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10"
          title="Close inspector (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Inspector Sections */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* 1. Primary Information */}
        {!isEditing ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase border ${catMeta.badgeClass}`}>
                {catMeta.label}
              </span>
              {node.memory?.scope && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10">
                  {node.memory.scope}
                </span>
              )}
              {node.pinned && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/35">
                  PINNED
                </span>
              )}
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10">
                ★{node.importance}/5
              </span>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-slate-950 dark:text-white leading-snug">
                {node.title}
              </h3>
              <p className="text-xs text-slate-800 dark:text-slate-300 leading-relaxed select-text bg-slate-50 dark:bg-[#141821] p-3 rounded-lg border border-slate-200 dark:border-white/10 whitespace-pre-wrap break-words">
                {node.content}
              </p>
            </div>

            {node.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {node.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-[#161a24] text-slate-700 dark:text-slate-400 border border-slate-200 dark:border-white/5"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 dark:bg-[#12161f] p-2.5 rounded-lg border border-slate-200 dark:border-white/10">
              <div>
                <div className="text-[10px] font-mono text-slate-500">ID</div>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(node.id);
                    setCopiedId(true);
                    setTimeout(() => setCopiedId(false), 1200);
                  }}
                  className="flex items-center gap-1 font-mono text-slate-800 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white truncate max-w-full"
                  title={node.id}
                >
                  <span className="truncate">{node.id}</span>
                  <Copy className="w-2.5 h-2.5 shrink-0 text-slate-400" />
                </button>
                {copiedId && <span className="text-[9px] text-emerald-600 dark:text-emerald-400">Copied</span>}
              </div>
              <div>
                <div className="text-[10px] font-mono text-slate-500">CONFIDENCE / RECALLS</div>
                <div className="font-mono text-slate-800 dark:text-slate-300">
                  {Math.round(node.confidence * 100)}% · {node.accessCount} hits
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-slate-500">CREATED</div>
                <div className="font-mono text-slate-800 dark:text-slate-300">
                  {new Date(node.createdAt).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-slate-500">UPDATED</div>
                <div className="font-mono text-slate-800 dark:text-slate-300">
                  {new Date(node.updatedAt).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
              <div className="col-span-2 flex items-center justify-between pt-1.5 border-t border-slate-200 dark:border-white/5">
                <span className="text-[10px] font-mono text-slate-500">
                  SOURCE: <span className="text-slate-800 dark:text-slate-300">{node.source}</span> · {node.collection}
                </span>
                {node.memory?.conversationId && (
                  <button
                    type="button"
                    onClick={() => onViewSourceConversation(node.memory!.conversationId!)}
                    className="inline-flex items-center gap-1 text-[10px] font-mono text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    <span>Source Chat</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Inline Edit Form */
          <form onSubmit={handleSaveEdit} className="space-y-3 bg-slate-50 dark:bg-[#12161f] p-3 rounded-lg border border-slate-200 dark:border-white/10">
            <div className="text-xs font-semibold text-slate-900 dark:text-white">
              Edit Memory (v{node.version} → v{node.version + 1})
            </div>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Short title"
              className="w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-[#161a24] text-slate-900 dark:text-slate-100 px-2.5 py-1.5 text-xs"
            />
            <textarea
              rows={3}
              required
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-[#161a24] text-slate-900 dark:text-slate-100 px-2.5 py-1.5 text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value as MemoryCategory)}
                className="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-[#161a24] text-slate-900 dark:text-slate-100 px-2 py-1 text-xs"
              >
                {(['fact', 'preference', 'instruction', 'project', 'episode', 'context'] as MemoryCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={editImportance}
                onChange={(e) => setEditImportance(Number(e.target.value))}
                className="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-[#161a24] text-slate-900 dark:text-slate-100 px-2 py-1 text-xs"
              >
                {[1, 2, 3, 4, 5].map((imp) => (
                  <option key={imp} value={imp}>
                    Importance ★{imp}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={editPinned}
                onChange={(e) => setEditPinned(e.target.checked)}
              />
              <span>Pin memory (always injected)</span>
            </label>
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-2.5 py-1 rounded text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-1 px-3 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold"
              >
                <Check className="w-3 h-3" />
                <span>{busy ? 'Saving...' : 'Save Version'}</span>
              </button>
            </div>
          </form>
        )}

        {/* 2. Vector & Embedding Telemetry */}
        <div className="space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Cpu className="w-3 h-3" />
            <span>Vector Telemetry</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-[11px] bg-slate-50 dark:bg-[#12161f] p-2.5 rounded-lg border border-slate-200 dark:border-white/10">
            <div>
              <div className="text-[9px] font-mono text-slate-500">MODEL</div>
              <div className="font-mono text-slate-800 dark:text-slate-300 truncate" title={node.memory?.embeddingModel || 'LoftyDB-Semantic-Hash'}>
                Hash-BoW
              </div>
            </div>
            <div>
              <div className="text-[9px] font-mono text-slate-500">DIMENSIONS</div>
              <div className="font-mono text-cyan-700 dark:text-cyan-300 font-semibold">
                {node.memory?.vectorDim || node.entity?.vectorDim || 128}d
              </div>
            </div>
            <div>
              <div className="text-[9px] font-mono text-slate-500">VERSION</div>
              <div className="font-mono text-slate-800 dark:text-slate-300">v{node.version}</div>
            </div>
            {similarityScore !== undefined && (
              <div className="col-span-3 pt-1.5 border-t border-slate-200 dark:border-white/5 flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-500">Query Cosine Match</span>
                <span className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                  {(similarityScore * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 3. Actions */}
        <div className="space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
            Actions
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {node.kind === 'memory' && node.memory && (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-[#151924] dark:hover:bg-[#1c2231] border border-slate-200 dark:border-white/10 text-xs text-slate-800 dark:text-slate-200 font-medium"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => onTogglePin(node.memory!)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-[#151924] dark:hover:bg-[#1c2231] border border-slate-200 dark:border-white/10 text-xs text-slate-800 dark:text-slate-200 font-medium"
                >
                  <Pin className="w-3 h-3" />
                  <span>{node.pinned ? 'Unpin' : 'Pin'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onFindSimilar(node.content)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-[#151924] dark:hover:bg-[#1c2231] border border-slate-200 dark:border-white/10 text-xs text-slate-800 dark:text-slate-200 font-medium"
                >
                  <Sparkles className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                  <span>Find Similar</span>
                </button>
                <button
                  type="button"
                  onClick={openMergePanel}
                  disabled={mergeCandidates.length === 0}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-[#151924] dark:hover:bg-[#1c2231] border border-slate-200 dark:border-white/10 text-xs text-slate-800 dark:text-slate-200 font-medium disabled:opacity-40"
                >
                  <GitMerge className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  <span>Merge</span>
                </button>
                <button
                  type="button"
                  onClick={() => onViewHistory(node.memory!)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-[#151924] dark:hover:bg-[#1c2231] border border-slate-200 dark:border-white/10 text-xs text-slate-800 dark:text-slate-200 font-medium"
                >
                  <History className="w-3 h-3" />
                  <span>History</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteMemory(node.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-[#151924] dark:hover:bg-rose-500/15 border border-rose-200 dark:border-white/10 dark:hover:border-rose-500/35 text-xs text-rose-700 dark:text-rose-300 font-medium"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => onExpandNeighbors(node.id)}
              className="col-span-2 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 dark:bg-sky-500/15 dark:hover:bg-sky-500/25 border border-sky-200 dark:border-sky-500/35 text-xs font-medium text-sky-700 dark:text-sky-300"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Expand Connected Neighborhood</span>
            </button>

            {node.kind === 'conversation' && (
              <button
                type="button"
                onClick={() => onViewSourceConversation(node.id)}
                className="col-span-2 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-[#151924] dark:hover:bg-[#1c2231] border border-slate-200 dark:border-white/10 text-xs text-slate-800 dark:text-slate-200 font-medium"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Conversation in Playground</span>
              </button>
            )}
          </div>
        </div>

        {/* Confirmed Merge Dialog */}
        {isMergeOpen && mergeCandidates.length > 0 && (
          <form onSubmit={handleConfirmMerge} className="space-y-2.5 p-3 rounded-lg bg-amber-50 dark:bg-[#12161f] border border-amber-300 dark:border-amber-500/35">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">Confirm Memory Merge</span>
              <button type="button" onClick={() => setIsMergeOpen(false)} className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-slate-600 dark:text-slate-400">Merge &amp; Absorb Secondary Memory:</label>
              <select
                value={mergeTargetId}
                onChange={(e) => setMergeTargetId(e.target.value)}
                className="w-full rounded border px-2 py-1 text-xs"
              >
                {mergeCandidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-slate-600 dark:text-slate-400">Resulting Merged Content:</label>
              <textarea
                rows={3}
                value={mergeContent}
                onChange={(e) => setMergeContent(e.target.value)}
                className="w-full rounded border px-2 py-1 text-xs"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold"
            >
              {busy ? 'Merging...' : 'Confirm Merge'}
            </button>
          </form>
        )}

        {/* 4. Relationships */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
              Relationships ({connections.total})
            </span>
            <button
              type="button"
              onClick={() => {
                setRelTargetId(relCandidates[0]?.id || '');
                setIsAddRelOpen((v) => !v);
              }}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-500/10"
            >
              <Plus className="w-3 h-3" />
              <span>Link</span>
            </button>
          </div>

          {isAddRelOpen && relCandidates.length > 0 && (
            <form onSubmit={handleAddRel} className="space-y-2 p-2.5 rounded-lg bg-slate-50 dark:bg-[#12161f] border border-slate-200 dark:border-white/10">
              <select
                value={relType}
                onChange={(e) => setRelType(e.target.value as MemoryRelationshipType)}
                className="w-full rounded border px-2 py-1 text-[11px] font-mono"
              >
                {ALL_RELATIONSHIP_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select
                value={relTargetId}
                onChange={(e) => setRelTargetId(e.target.value)}
                className="w-full rounded border px-2 py-1 text-xs"
              >
                {relCandidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    [{c.kind}] {c.title}
                  </option>
                ))}
              </select>
              <div className="flex justify-end gap-1.5">
                <button type="button" onClick={() => setIsAddRelOpen(false)} className="text-[11px] text-slate-500 dark:text-slate-400">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-2.5 py-1 rounded bg-sky-600 text-white text-[11px] font-semibold"
                >
                  Create Edge
                </button>
              </div>
            </form>
          )}

          {connections.total === 0 ? (
            <div className="text-[11px] text-slate-500 italic bg-slate-50 dark:bg-[#12161f] p-3 rounded-lg border border-slate-200 dark:border-white/10">
              No stored relationships yet. Click Link above or check Memory Intelligence for suggested connections.
            </div>
          ) : (
            <div className="space-y-1.5">
              {connections.outgoing.map(({ edge, peer }) => {
                const rm = RELATIONSHIP_META[edge.type];
                return (
                  <div
                    key={edge.id}
                    className="group p-2 rounded-lg bg-slate-50 dark:bg-[#12161f] border border-slate-200 dark:border-white/10 hover:border-slate-400 dark:hover:border-white/25 transition-colors flex items-center justify-between gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => onNavigateToNode(peer.id)}
                      className="min-w-0 flex-1 text-left space-y-0.5"
                    >
                      <div className="flex items-center gap-1.5 text-[10px] font-mono">
                        <ArrowRight className="w-3 h-3 text-slate-500 dark:text-slate-400 shrink-0" />
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: rm.color }}
                        />
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {edge.type}
                        </span>
                        <span className="text-slate-500">· {Math.round(edge.strength * 100)}%</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-900 dark:text-slate-200 truncate">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: peer.color }}
                        />
                        <span className="truncate">{peer.title}</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteRelationship(edge.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                      title="Delete relationship"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}

              {connections.incoming.map(({ edge, peer }) => {
                const rm = RELATIONSHIP_META[edge.type];
                return (
                  <div
                    key={edge.id}
                    className="group p-2 rounded-lg bg-slate-50 dark:bg-[#12161f] border border-slate-200 dark:border-white/10 hover:border-slate-400 dark:hover:border-white/25 transition-colors flex items-center justify-between gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => onNavigateToNode(peer.id)}
                      className="min-w-0 flex-1 text-left space-y-0.5"
                    >
                      <div className="flex items-center gap-1.5 text-[10px] font-mono">
                        <ArrowLeft className="w-3 h-3 text-slate-500 dark:text-slate-400 shrink-0" />
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: rm.color }}
                        />
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {edge.type}
                        </span>
                        <span className="text-slate-500">· {Math.round(edge.strength * 100)}%</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-900 dark:text-slate-200 truncate">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: peer.color }}
                        />
                        <span className="truncate">{peer.title}</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteRelationship(edge.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                      title="Delete relationship"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
