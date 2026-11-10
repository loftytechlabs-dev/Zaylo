import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Plus,
  Wand2,
  Activity,
  SlidersHorizontal,
  X,
  PanelLeft,
  Network,
  Boxes,
  CalendarClock,
  AlertCircle,
  Loader2,
  Trash2,
  EyeOff,
  Maximize2,
  Sparkles,
  Share2,
} from 'lucide-react';
import type {
  KnowledgeGraphPayload,
  MemoryCategory,
  MemoryEntry,
  MemoryScope,
} from '@local-ai/shared';
import { LOFTYDB_MEMORY_COLLECTION } from '@local-ai/shared';
import { api } from '../../../api/client';
import { useAppStore } from '../../../stores/useAppStore';
import { MemoryHistoryModal } from './MemoryHistoryModal';
import { GraphCanvas } from '../graph/GraphCanvas';
import { buildGraphModel } from '../graph/graphLayoutEngine';
import {
  ALL_RELATIONSHIP_TYPES,
  NODE_CATEGORY_META,
  RELATIONSHIP_META,
  type GraphDisplaySettings,
  type GraphFilterState,
  type GraphLayoutPreset,
  type GraphNode,
  type GraphViewMode,
  type LayoutPositionMap,
  type NodeVisualGroup,
} from '../graph/graphTypes';
import { ExplorerLeftSidebar } from './ExplorerLeftSidebar';
import { MemoryInspectorPanel } from './MemoryInspectorPanel';
import { MemoryIntelligenceModal } from './MemoryIntelligenceModal';

interface MemoryGraphExplorerProps {
  onOpenSourceConversation?: (conversationId: string) => void;
}

const DEFAULT_GROUPS = new Set<NodeVisualGroup>([
  'fact',
  'preference',
  'instruction',
  'project',
  'episode',
  'context',
  'entity',
  'conversation',
]);

function createDefaultFilters(): GraphFilterState {
  return {
    categories: new Set(DEFAULT_GROUPS),
    minImportance: 1,
    dateRange: 'all',
    dateField: 'updatedAt',
    minConnections: 0,
    source: 'all',
    relationshipTypes: new Set(ALL_RELATIONSHIP_TYPES),
  };
}

export const MemoryGraphExplorer: React.FC<MemoryGraphExplorerProps> = ({
  onOpenSourceConversation,
}) => {
  const {
    theme,
    loftyDbStatus,
    memories,
    fetchMemories,
    fetchLoftyDbState,
    saveMemory,
    deleteMemory,
    selectChat,
  } = useAppStore();

  const isConnected = Boolean(loftyDbStatus?.connected);

  // Graph data & incremental refresh state
  const [selectedCollection, setSelectedCollection] = useState<string>(LOFTYDB_MEMORY_COLLECTION);
  const [payload, setPayload] = useState<KnowledgeGraphPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Visualization Modes, Layout, Filters, Display Settings
  const [mode, setMode] = useState<GraphViewMode>('network');
  const [layoutPreset, setLayoutPreset] = useState<GraphLayoutPreset>('force');
  const [filters, setFilters] = useState<GraphFilterState>(createDefaultFilters);
  const [display, setDisplay] = useState<GraphDisplaySettings>({
    showRelationships: true,
    showLabels: true,
    showMinimap: true,
    physicsRunning: true,
    repulsion: 18000,
    linkDistance: 190,
    canvasTheme: 'auto',
  });

  const isDarkCanvas =
    display.canvasTheme === 'dark'
      ? true
      : display.canvasTheme === 'light'
      ? false
      : theme === 'dark';

  // Explorer / Inspector / Modal visibility
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showGraphSettings, setShowGraphSettings] = useState(false);
  const [showIntelligence, setShowIntelligence] = useState(false);

  // Selection, search highlights, hidden & collapsed state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [primarySelectedId, setPrimarySelectedId] = useState<string | null>(null);
  const [hiddenNodeIds, setHiddenNodeIds] = useState<Set<string>>(new Set());
  const [collapsedClusters, setCollapsedClusters] = useState<Set<string>>(new Set());
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [fitTrigger, setFitTrigger] = useState(0);

  // Position history (preserving positions across incremental reloads + Undo/Redo manual drag)
  const positionsRef = useRef<LayoutPositionMap>({});
  const undoStackRef = useRef<Array<{ before: LayoutPositionMap; after: LayoutPositionMap }>>([]);
  const redoStackRef = useRef<Array<{ before: LayoutPositionMap; after: LayoutPositionMap }>>([]);
  const [undoDepth, setUndoDepth] = useState({ undo: 0, redo: 0 });

  // Natural-language Semantic Search & Recall
  const [searchQuery, setSearchQuery] = useState('');
  const [isRecalling, setIsRecalling] = useState(false);
  const [matchedIds, setMatchedIds] = useState<Set<string> | null>(null);
  const [recallScores, setRecallScores] = useState<Map<string, number>>(new Map());
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Modals & notifications
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addContent, setAddContent] = useState('');
  const [addCategory, setAddCategory] = useState<MemoryCategory>('fact');
  const [addScope, setAddScope] = useState<MemoryScope>('global');
  const [addImportance, setAddImportance] = useState(4);
  const [addPinned, setAddPinned] = useState(false);
  const [addTags, setAddTags] = useState('');
  const [busySave, setBusySave] = useState(false);
  const [busyScan, setBusyScan] = useState(false);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  const [historyEntry, setHistoryEntry] = useState<MemoryEntry | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    node: GraphNode | null;
    x: number;
    y: number;
  } | null>(null);

  // Load Knowledge Graph from LoftyDB backend
  const loadGraph = useCallback(async () => {
    if (!isConnected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.invoke('memory:get-graph', { collection: selectedCollection });
      setPayload(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load LoftyDB Knowledge Graph');
    } finally {
      setLoading(false);
    }
  }, [isConnected, selectedCollection]);

  useEffect(() => {
    void loadGraph();
  }, [loadGraph, memories]);

  // Build reactive filtered graph model (preserving node positions across updates)
  const graphModel = useMemo(
    () =>
      buildGraphModel({
        payload,
        filters,
        mode,
        layoutPreset,
        hiddenNodeIds,
        collapsedClusters,
        prevPositions: positionsRef.current,
      }),
    [payload, filters, mode, layoutPreset, hiddenNodeIds, collapsedClusters]
  );

  useEffect(() => {
    for (const n of graphModel.nodes) {
      if (!n.isClusterProxy) {
        positionsRef.current[n.id] = { x: n.x, y: n.y };
      }
    }
  }, [graphModel]);

  // Debounced live client-side search filter before full vector recall
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      setMatchedIds(null);
      setRecallScores(new Map());
      return;
    }
    const timer = setTimeout(() => {
      const hits = new Set<string>();
      for (const n of graphModel.nodes) {
        if (
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q))
        ) {
          hits.add(n.id);
        }
      }
      setMatchedIds(hits);
    }, 180);
    return () => clearTimeout(timer);
  }, [searchQuery, graphModel.nodes]);

  // Explicit LoftyDB Semantic Recall trigger
  const runSemanticRecall = useCallback(
    async (customQuery?: string) => {
      const q = (customQuery ?? searchQuery).trim();
      if (!q) {
        setMatchedIds(null);
        setRecallScores(new Map());
        return;
      }
      setIsRecalling(true);
      try {
        const res = await api.invoke('memory:recall', {
          query: q,
          limit: 12,
          minSimilarity: 0.05,
        });
        const hits = new Set<string>();
        const scoreMap = new Map<string, number>();
        for (const r of res || []) {
          hits.add(r.memory.id);
          scoreMap.set(r.memory.id, r.similarity);
        }
        const qLower = q.toLowerCase();
        for (const n of graphModel.nodes) {
          if (n.kind !== 'memory' && (n.title.toLowerCase().includes(qLower) || n.content.toLowerCase().includes(qLower))) {
            hits.add(n.id);
          }
        }
        setMatchedIds(hits);
        setRecallScores(scoreMap);
        if (res && res.length > 0) {
          const firstId = res[0].memory.id;
          setSelectedIds(new Set([firstId]));
          setPrimarySelectedId(firstId);
          setFocusNodeId(firstId);
        }
        void loadGraph();
      } catch (err: any) {
        setBannerMsg(`Semantic recall failed: ${err?.message || err}`);
      } finally {
        setIsRecalling(false);
      }
    },
    [searchQuery, graphModel.nodes, loadGraph]
  );

  const selectConnectedComponent = useCallback(
    (seedId: string) => {
      const visited = new Set<string>([seedId]);
      const queue = [seedId];
      while (queue.length > 0) {
        const cur = queue.shift()!;
        for (const edge of graphModel.edges) {
          const nextId =
            edge.source === cur ? edge.target : edge.target === cur ? edge.source : null;
          if (nextId && !visited.has(nextId)) {
            visited.add(nextId);
            queue.push(nextId);
          }
        }
      }
      setSelectedIds(visited);
      setPrimarySelectedId(seedId);
      setFocusNodeId(seedId);
    },
    [graphModel.edges]
  );

  const expandOneHopNeighbors = useCallback(
    (seedId: string) => {
      const group = new Set<string>([seedId]);
      for (const edge of graphModel.edges) {
        if (edge.source === seedId) group.add(edge.target);
        if (edge.target === seedId) group.add(edge.source);
      }
      setSelectedIds(group);
      setPrimarySelectedId(seedId);
      setFocusNodeId(seedId);
    },
    [graphModel.edges]
  );

  const handlePositionsCommit = useCallback(
    (before: LayoutPositionMap, after: LayoutPositionMap) => {
      for (const [id, pos] of Object.entries(after)) {
        positionsRef.current[id] = pos;
      }
      undoStackRef.current.push({ before, after });
      if (undoStackRef.current.length > 30) undoStackRef.current.shift();
      redoStackRef.current = [];
      setUndoDepth({ undo: undoStackRef.current.length, redo: 0 });
    },
    []
  );

  const handleUndo = useCallback(() => {
    const step = undoStackRef.current.pop();
    if (!step) return;
    for (const [id, pos] of Object.entries(step.before)) {
      const n = graphModel.nodeById.get(id);
      if (n) {
        n.x = pos.x;
        n.y = pos.y;
        n.fx = pos.x;
        n.fy = pos.y;
      }
      positionsRef.current[id] = pos;
    }
    redoStackRef.current.push(step);
    setUndoDepth({ undo: undoStackRef.current.length, redo: redoStackRef.current.length });
  }, [graphModel.nodeById]);

  const handleRedo = useCallback(() => {
    const step = redoStackRef.current.pop();
    if (!step) return;
    for (const [id, pos] of Object.entries(step.after)) {
      const n = graphModel.nodeById.get(id);
      if (n) {
        n.x = pos.x;
        n.y = pos.y;
        n.fx = pos.x;
        n.fy = pos.y;
      }
      positionsRef.current[id] = pos;
    }
    undoStackRef.current.push(step);
    setUndoDepth({ undo: undoStackRef.current.length, redo: redoStackRef.current.length });
  }, [graphModel.nodeById]);

  const handleResetLayout = useCallback(() => {
    positionsRef.current = {};
    undoStackRef.current = [];
    redoStackRef.current = [];
    setUndoDepth({ undo: 0, redo: 0 });
    setCollapsedClusters(new Set());
    setLayoutPreset('force');
    setDisplay((d) => ({ ...d, physicsRunning: true }));
    void loadGraph();
    setTimeout(() => setFitTrigger((t) => t + 1), 120);
  }, [loadGraph]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (!typing) {
          e.preventDefault();
          if (e.shiftKey) handleRedo();
          else handleUndo();
        }
        return;
      }

      if (e.key === 'Escape') {
        setContextMenu(null);
        setShowGraphSettings(false);
        if (!typing) {
          setSelectedIds(new Set());
          setPrimarySelectedId(null);
        }
        return;
      }

      if (typing) return;

      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setFitTrigger((t) => t + 1);
      } else if (e.key === ' ') {
        e.preventDefault();
        setDisplay((d) => ({ ...d, physicsRunning: !d.physicsRunning }));
      } else if (e.key === '1') {
        setMode('network');
      } else if (e.key === '2') {
        setMode('cluster');
      } else if (e.key === '3') {
        setMode('timeline');
      } else if (e.key.toLowerCase() === 'h' && selectedIds.size > 0) {
        setHiddenNodeIds((prev) => new Set([...prev, ...selectedIds]));
        setSelectedIds(new Set());
        setPrimarySelectedId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo, selectedIds]);

  const handleScanChats = async () => {
    setBusyScan(true);
    setBannerMsg(null);
    try {
      const res = await api.invoke('memory:extract-from-conversations', {});
      if (res.extracted.length > 0) {
        await fetchMemories();
        await fetchLoftyDbState();
        setBannerMsg(
          `Extracted ${res.extracted.length} memor${res.extracted.length === 1 ? 'y' : 'ies'} and indexed entity links from ${res.scannedConversations} chat(s).`
        );
      } else {
        setBannerMsg(
          `Scanned ${res.scannedMessages} message(s) across ${res.scannedConversations} chat(s) — no explicit facts or rules found to extract.`
        );
      }
    } catch (err: any) {
      setBannerMsg(`Chat scan failed: ${err?.message || err}`);
    } finally {
      setBusyScan(false);
    }
  };

  const handleCreateMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addContent.trim()) return;
    setBusySave(true);
    try {
      const created = await saveMemory({
        title: addTitle.trim() || undefined,
        content: addContent.trim(),
        category: addCategory,
        scope: addScope,
        importance: addImportance,
        pinned: addPinned,
        tags: addTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        source: 'manual',
      });
      setAddTitle('');
      setAddContent('');
      setAddTags('');
      setAddPinned(false);
      setIsAddModalOpen(false);
      setSelectedIds(new Set([created.id]));
      setPrimarySelectedId(created.id);
      setFocusNodeId(created.id);
    } finally {
      setBusySave(false);
    }
  };

  const inspectedNode = useMemo(
    () => (primarySelectedId ? graphModel.nodeById.get(primarySelectedId) || null : null),
    [primarySelectedId, graphModel.nodeById]
  );

  const intelligenceCount = useMemo(() => {
    if (!payload?.intelligence) return 0;
    const intel = payload.intelligence;
    return (
      intel.contradictions.length +
      intel.similarDuplicates.length +
      intel.missingRelationships.length
    );
  }, [payload]);

  if (!isConnected) {
    return (
      <div className="rounded-xl bg-white dark:bg-[#090b10] border border-slate-200 dark:border-white/10 p-12 text-center text-slate-900 dark:text-slate-200 space-y-3">
        <Network className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
          LoftyDB Knowledge Engine Offline
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          Start LoftyDB above to initialize the live Knowledge Graph Explorer, semantic retrieval, and memory intelligence.
        </p>
      </div>
    );
  }

  return (
    <div
      className="relative flex flex-col h-[calc(100vh-11.5rem)] min-h-[540px] rounded-xl bg-slate-50 dark:bg-[#090b10] border border-slate-200 dark:border-white/12 overflow-hidden text-slate-900 dark:text-slate-200 shadow-sm dark:shadow-xl"
      onClick={() => contextMenu && setContextMenu(null)}
    >
      {/* TOP TOOLBAR */}
      <header className="px-3 py-2 bg-white dark:bg-[#0e1118] border-b border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-2 shrink-0 z-20">
        {/* Left: Explorer toggle + Semantic Search & Recall */}
        <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-xl">
          <button
            type="button"
            onClick={() => setShowLeftSidebar((s) => !s)}
            className={`p-1.5 rounded-lg border transition-colors ${
              showLeftSidebar
                ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white border-slate-300 dark:border-white/20'
                : 'bg-white dark:bg-[#141821] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Toggle Memory Explorer sidebar"
          >
            <PanelLeft className="w-4 h-4" />
          </button>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runSemanticRecall();
            }}
            className="flex items-center gap-1.5 flex-1"
          >
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search or query memories... (Press /)"
                className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#161a24] text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-sky-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setMatchedIds(null);
                    setRecallScores(new Map());
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={isRecalling}
              className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors shrink-0 disabled:opacity-50"
            >
              {isRecalling ? 'Recalling...' : 'Recall'}
            </button>
          </form>
        </div>

        {/* Center: Mode Switcher */}
        <div className="hidden md:flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-[#141821] border border-slate-200 dark:border-white/10">
          {(
            [
              { id: 'network', label: 'Network', icon: Network },
              { id: 'cluster', label: 'Cluster', icon: Boxes },
              { id: 'timeline', label: 'Timeline', icon: CalendarClock },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setMode(item.id);
                  setTimeout(() => setFitTrigger((t) => t + 1), 60);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  active
                    ? 'bg-white dark:bg-white/15 text-slate-950 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5">
          {mode === 'network' && (
            <select
              value={layoutPreset}
              onChange={(e) => {
                setLayoutPreset(e.target.value as GraphLayoutPreset);
                setTimeout(() => setFitTrigger((t) => t + 1), 60);
              }}
              className="hidden xl:block rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#141821] text-slate-900 dark:text-slate-100 px-2 py-1.5 text-xs"
              title="Graph layout algorithm"
            >
              <option value="force">Force-Directed</option>
              <option value="radial">Concentric Hubs</option>
              <option value="compact">Compact Grid</option>
            </select>
          )}

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-200 text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Memory</span>
          </button>

          <button
            type="button"
            onClick={handleScanChats}
            disabled={busyScan}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#141821] hover:bg-slate-100 dark:hover:bg-[#1c2231] border border-slate-200 dark:border-white/10 text-xs text-slate-800 dark:text-slate-200 font-medium transition-colors disabled:opacity-50"
            title="Scan stored conversations for facts, preferences, and instructions"
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="hidden sm:inline">{busyScan ? 'Scanning...' : 'Scan Chats'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowIntelligence(true)}
            className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#141821] hover:bg-slate-100 dark:hover:bg-[#1c2231] border border-slate-200 dark:border-white/10 text-xs text-slate-800 dark:text-slate-200 font-medium transition-colors"
            title="Open Memory Intelligence & Insights"
          >
            <Activity className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span className="hidden lg:inline">Intelligence</span>
            {intelligenceCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-600 text-white dark:bg-amber-500/25 dark:text-amber-200 border border-amber-700/20 dark:border-amber-500/40 text-[10px] font-mono font-semibold">
                {intelligenceCount}
              </span>
            )}
          </button>

          {/* Graph Settings Popover Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowGraphSettings((s) => !s)}
              className={`p-1.5 rounded-lg border transition-colors ${
                showGraphSettings
                  ? 'bg-slate-100 dark:bg-white/12 text-slate-950 dark:text-white border-slate-300 dark:border-white/25'
                  : 'bg-white dark:bg-[#141821] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:text-slate-950 dark:hover:text-white'
              }`}
              title="Graph physics & relationship settings"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>

            {showGraphSettings && (
              <div className="absolute right-0 mt-2 w-72 rounded-xl bg-white dark:bg-[#10131b] border border-slate-200 dark:border-white/15 shadow-2xl p-4 z-40 space-y-3.5 text-xs text-slate-900 dark:text-slate-200">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-950 dark:text-white">Graph Engine Settings</span>
                  <button
                    type="button"
                    onClick={() => setShowGraphSettings(false)}
                    className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] text-slate-600 dark:text-slate-400">Canvas Backdrop</div>
                  <div className="grid grid-cols-3 gap-1">
                    {(['auto', 'light', 'dark'] as const).map((ct) => (
                      <button
                        key={ct}
                        type="button"
                        onClick={() => setDisplay((d) => ({ ...d, canvasTheme: ct }))}
                        className={`py-1 rounded border text-[11px] capitalize ${
                          display.canvasTheme === ct
                            ? 'bg-sky-50 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-500/40 font-semibold'
                            : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {ct}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400">
                    <span>Node Repulsion</span>
                    <span className="font-mono text-slate-900 dark:text-slate-200">{display.repulsion}</span>
                  </div>
                  <input
                    type="range"
                    min={4000}
                    max={36000}
                    step={500}
                    value={display.repulsion}
                    onChange={(e) =>
                      setDisplay((d) => ({ ...d, repulsion: Number(e.target.value) }))
                    }
                    className="w-full accent-sky-600 dark:accent-sky-400"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400">
                    <span>Edge Distance</span>
                    <span className="font-mono text-slate-900 dark:text-slate-200">{display.linkDistance}px</span>
                  </div>
                  <input
                    type="range"
                    min={100}
                    max={320}
                    step={10}
                    value={display.linkDistance}
                    onChange={(e) =>
                      setDisplay((d) => ({ ...d, linkDistance: Number(e.target.value) }))
                    }
                    className="w-full accent-sky-600 dark:accent-sky-400"
                  />
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-white/10">
                  <div className="text-[10px] font-mono uppercase text-slate-500">
                    Visible Relationship Types
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {ALL_RELATIONSHIP_TYPES.map((rt) => {
                      const active = filters.relationshipTypes.has(rt);
                      return (
                        <button
                          key={rt}
                          type="button"
                          onClick={() => {
                            const next = new Set(filters.relationshipTypes);
                            if (active && next.size > 1) next.delete(rt);
                            else next.add(rt);
                            setFilters((f) => ({ ...f, relationshipTypes: next }));
                          }}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition-colors ${
                            active
                              ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-white/20'
                              : 'text-slate-400 dark:text-slate-500 border-slate-200 dark:border-white/5'
                          }`}
                          title={RELATIONSHIP_META[rt].description}
                        >
                          {rt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Optional Info/Action Banner */}
      {bannerMsg && (
        <div className="px-4 py-1.5 bg-sky-50 dark:bg-[#121622] border-b border-slate-200 dark:border-white/10 flex items-center justify-between text-[11px] text-sky-800 dark:text-sky-300 shrink-0">
          <span>{bannerMsg}</span>
          <button type="button" onClick={() => setBannerMsg(null)} className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* MAIN 3-PANE KNOWLEDGE EXPLORER BODY */}
      <div className="relative flex-1 flex min-h-0 overflow-hidden">
        {showLeftSidebar && (
          <div className="absolute lg:static inset-y-0 left-0 z-30 h-full shadow-2xl lg:shadow-none">
            <ExplorerLeftSidebar
              payload={payload}
              selectedCollection={selectedCollection}
              filters={filters}
              visibleNodeCount={graphModel.nodes.length}
              visibleEdgeCount={graphModel.edges.length}
              onSelectCollection={(col) => {
                setSelectedCollection(col);
                setSelectedIds(new Set());
                setPrimarySelectedId(null);
              }}
              onUpdateFilters={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
              onResetFilters={() => {
                setFilters(createDefaultFilters());
                setSearchQuery('');
                setMatchedIds(null);
                setRecallScores(new Map());
              }}
              onCloseMobile={() => setShowLeftSidebar(false)}
            />
          </div>
        )}

        <div className="relative flex-1 min-w-0 h-full">
          {loading && !payload && (
            <div className="absolute inset-0 z-20 bg-white/85 dark:bg-[#090b10]/85 flex flex-col items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-sky-600 dark:text-sky-400" />
              <span>Indexing LoftyDB knowledge graph...</span>
            </div>
          )}

          {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/90 border border-rose-300 dark:border-rose-500/40 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <GraphCanvas
            nodes={graphModel.nodes}
            edges={graphModel.edges}
            nodeById={graphModel.nodeById}
            clusterRegions={graphModel.clusterRegions}
            timelineTicks={graphModel.timelineTicks}
            mode={mode}
            display={display}
            selectedIds={selectedIds}
            matchedIds={matchedIds}
            hiddenCount={hiddenNodeIds.size}
            canUndo={undoDepth.undo > 0}
            canRedo={undoDepth.redo > 0}
            fitTrigger={fitTrigger}
            focusNodeId={focusNodeId}
            isDarkCanvas={isDarkCanvas}
            onSelectNodes={(ids, primaryId) => {
              setSelectedIds(ids);
              setPrimarySelectedId(primaryId);
            }}
            onDoubleClickNode={(node) => {
              expandOneHopNeighbors(node.id);
            }}
            onToggleClusterCollapse={(clusterKey) => {
              setCollapsedClusters((prev) => {
                const next = new Set(prev);
                if (next.has(clusterKey)) next.delete(clusterKey);
                else next.add(clusterKey);
                return next;
              });
            }}
            onPositionsCommit={handlePositionsCommit}
            onContextMenuRequest={(node, clientX, clientY) => {
              setContextMenu({ node, x: clientX, y: clientY });
            }}
            onUpdateDisplay={(patch) => setDisplay((d) => ({ ...d, ...patch }))}
            onResetLayout={handleResetLayout}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onUnhideAll={() => setHiddenNodeIds(new Set())}
          />

          {/* Honest Empty State */}
          {!loading && payload && graphModel.nodes.length === 0 && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
              <div className="pointer-events-auto max-w-md w-full p-5 rounded-xl bg-white/95 dark:bg-[#0e1118]/95 border border-slate-200 dark:border-white/12 text-center space-y-3 shadow-2xl">
                <Sparkles className="w-6 h-6 mx-auto text-sky-600 dark:text-sky-400" />
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-slate-950 dark:text-white">
                    {payload.memories.length === 0
                      ? 'No Memories Stored in LoftyDB Yet'
                      : 'No Nodes Match Current Filters'}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {payload.memories.length === 0
                      ? 'Add a memory directly, scan existing conversations for durable facts, or chat in Playground using phrases like "Remember that..." or "I prefer...".'
                      : 'Adjust or reset your category, importance, date, or degree filters in the Memory Explorer.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-200"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Memory</span>
                  </button>
                  {payload.conversations.length > 0 && (
                    <button
                      type="button"
                      onClick={handleScanChats}
                      disabled={busyScan}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#161a24] border border-slate-200 dark:border-white/15 text-xs text-slate-800 dark:text-slate-200 hover:border-slate-400 dark:hover:border-white/35"
                    >
                      <Wand2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Scan {payload.conversations.length} Chat(s)</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar Inspector */}
        {inspectedNode && (
          <div className="absolute lg:static inset-x-0 bottom-0 top-auto h-[62%] lg:h-full lg:inset-y-0 lg:right-0 lg:left-auto z-30 rounded-t-2xl lg:rounded-none border-t lg:border-t-0 border-slate-200 dark:border-white/15 shadow-2xl lg:shadow-none overflow-hidden">
            <MemoryInspectorPanel
              node={inspectedNode}
              allNodes={graphModel.nodes}
              edges={graphModel.edges}
              nodeById={graphModel.nodeById}
              similarityScore={recallScores.get(inspectedNode.id)}
              intelligence={payload?.intelligence || null}
              onClose={() => {
                setSelectedIds(new Set());
                setPrimarySelectedId(null);
              }}
              onNavigateToNode={(id) => {
                setSelectedIds(new Set([id]));
                setPrimarySelectedId(id);
                setFocusNodeId(id);
              }}
              onEditMemory={async (id, patch) => {
                await saveMemory({ id, ...patch });
              }}
              onDeleteMemory={async (id) => {
                if (!confirm('Delete this memory and detach its graph edges?')) return;
                await deleteMemory(id);
                setSelectedIds(new Set());
                setPrimarySelectedId(null);
              }}
              onTogglePin={async (entry) => {
                await saveMemory({
                  id: entry.id,
                  content: entry.content,
                  category: entry.category,
                  scope: entry.scope,
                  personaId: entry.personaId,
                  conversationId: entry.conversationId,
                  importance: entry.importance,
                  pinned: !entry.pinned,
                  tags: entry.tags,
                  source: entry.source,
                });
              }}
              onMergeMemories={async (primaryId, secondaryId, mergedContent) => {
                await api.invoke('memory:merge', { primaryId, secondaryId, mergedContent });
                await fetchMemories();
                setSelectedIds(new Set([primaryId]));
                setPrimarySelectedId(primaryId);
              }}
              onFindSimilar={(text) => {
                setSearchQuery(text);
                void runSemanticRecall(text);
              }}
              onExpandNeighbors={expandOneHopNeighbors}
              onViewSourceConversation={(convId) => {
                if (onOpenSourceConversation) {
                  onOpenSourceConversation(convId);
                } else {
                  selectChat(convId);
                }
              }}
              onViewHistory={(entry) => setHistoryEntry(entry)}
              onCreateRelationship={async (input) => {
                await api.invoke('memory:create-relationship', input);
                await loadGraph();
              }}
              onDeleteRelationship={async (edgeId) => {
                await api.invoke('memory:delete-relationship', { id: edgeId });
                await loadGraph();
              }}
            />
          </div>
        )}
      </div>

      {/* MOBILE MODE NAVIGATION BAR */}
      <div className="md:hidden px-3 py-1.5 bg-white dark:bg-[#0e1118] border-t border-slate-200 dark:border-white/10 flex items-center justify-around shrink-0">
        {(
          [
            { id: 'network', label: 'Network', icon: Network },
            { id: 'cluster', label: 'Clusters', icon: Boxes },
            { id: 'timeline', label: 'Timeline', icon: CalendarClock },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = mode === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setMode(item.id);
                setTimeout(() => setFitTrigger((t) => t + 1), 60);
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium ${
                active
                  ? 'bg-slate-900 dark:bg-white/15 text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* RIGHT-CLICK CONTEXT MENU */}
      {contextMenu && (
        <div
          className="fixed z-50 w-52 rounded-xl bg-white dark:bg-[#10131b] border border-slate-200 dark:border-white/15 shadow-2xl py-1 text-xs text-slate-800 dark:text-slate-200"
          style={{
            left: Math.min(window.innerWidth - 220, contextMenu.x),
            top: Math.min(window.innerHeight - 250, contextMenu.y),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.node ? (
            <>
              <div className="px-3 py-1.5 text-[10px] font-mono text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10 truncate">
                {contextMenu.node.title}
              </div>
              <button
                type="button"
                onClick={() => {
                  expandOneHopNeighbors(contextMenu.node!.id);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-white/10 flex items-center gap-2"
              >
                <Share2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>Expand 1-Hop Neighbors</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  selectConnectedComponent(contextMenu.node!.id);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-white/10 flex items-center gap-2"
              >
                <Boxes className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>Select Connected Component</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFocusNodeId(contextMenu.node!.id);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-white/10 flex items-center gap-2"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Focus Node</span>
              </button>
              {contextMenu.node.kind === 'memory' && (
                <button
                  type="button"
                  onClick={() => {
                    const txt = contextMenu.node!.content;
                    setSearchQuery(txt);
                    void runSemanticRecall(txt);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-white/10 flex items-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Find Similar Memories</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const targets = selectedIds.size > 0 ? selectedIds : new Set([contextMenu.node!.id]);
                  setHiddenNodeIds((prev) => new Set([...prev, ...targets]));
                  setSelectedIds(new Set());
                  setPrimarySelectedId(null);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-white/10 flex items-center gap-2"
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>Hide Selected ({Math.max(1, selectedIds.size)})</span>
              </button>
              {contextMenu.node.kind === 'memory' && (
                <button
                  type="button"
                  onClick={async () => {
                    const id = contextMenu.node!.id;
                    setContextMenu(null);
                    if (confirm('Delete this memory?')) {
                      await deleteMemory(id);
                      setSelectedIds(new Set());
                      setPrimarySelectedId(null);
                    }
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-rose-50 dark:hover:bg-rose-500/15 text-rose-700 dark:text-rose-300 flex items-center gap-2 border-t border-slate-200 dark:border-white/10 mt-1 pt-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Memory</span>
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setFitTrigger((t) => t + 1);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-white/10"
              >
                Fit Graph to Screen
              </button>
              <button
                type="button"
                onClick={() => {
                  setHiddenNodeIds(new Set());
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-white/10"
              >
                Show All Hidden Nodes
              </button>
              <button
                type="button"
                onClick={() => {
                  handleResetLayout();
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-white/10"
              >
                Reset Layout
              </button>
            </>
          )}
        </div>
      )}

      {/* Add Memory Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0e1118] border border-slate-200 dark:border-white/15 shadow-2xl overflow-hidden text-slate-900 dark:text-slate-200">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-950 dark:text-white">
                Create Knowledge Memory
              </span>
              <button type="button" onClick={() => setIsAddModalOpen(false)} className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateMemory} className="p-5 space-y-3.5">
              <input
                type="text"
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                placeholder="Optional short title (auto-generated if blank)"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#161a24] text-slate-900 dark:text-slate-100 text-xs"
              />
              <textarea
                rows={3}
                required
                value={addContent}
                onChange={(e) => setAddContent(e.target.value)}
                placeholder="e.g., Zaylo backend runs on Fastify with TypeScript and LoftyDB for memory storage."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#161a24] text-slate-900 dark:text-slate-100 text-xs"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={addCategory}
                  onChange={(e) => setAddCategory(e.target.value as MemoryCategory)}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#161a24] text-slate-900 dark:text-slate-100 text-xs"
                >
                  {(['fact', 'preference', 'instruction', 'project', 'episode', 'context'] as MemoryCategory[]).map((cat) => (
                    <option key={cat} value={cat}>
                      {NODE_CATEGORY_META[cat].label}
                    </option>
                  ))}
                </select>
                <select
                  value={addScope}
                  onChange={(e) => setAddScope(e.target.value as MemoryScope)}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#161a24] text-slate-900 dark:text-slate-100 text-xs"
                >
                  <option value="global">Global (All Chats)</option>
                  <option value="persona">Persona Scoped</option>
                  <option value="conversation">Current Chat</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3 items-center">
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400">
                    <span>Importance</span>
                    <span className="font-mono text-slate-900 dark:text-white font-semibold">★{addImportance}/5</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={addImportance}
                    onChange={(e) => setAddImportance(Number(e.target.value))}
                    className="w-full accent-sky-600 dark:accent-sky-400"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 pt-3">
                  <input
                    type="checkbox"
                    checked={addPinned}
                    onChange={(e) => setAddPinned(e.target.checked)}
                  />
                  <span>Pin rule</span>
                </label>
              </div>
              <input
                type="text"
                value={addTags}
                onChange={(e) => setAddTags(e.target.value)}
                placeholder="Tags (comma-separated, e.g., typescript, api)"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#161a24] text-slate-900 dark:text-slate-100 text-xs"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busySave}
                  className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold"
                >
                  {busySave ? 'Indexing...' : 'Save & Index'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Intelligence Modal */}
      {showIntelligence && payload?.intelligence && (
        <MemoryIntelligenceModal
          intelligence={payload.intelligence}
          onClose={() => setShowIntelligence(false)}
          onInspectNode={(id) => {
            setSelectedIds(new Set([id]));
            setPrimarySelectedId(id);
            setFocusNodeId(id);
          }}
          onSelectClusterIds={(ids) => {
            setSelectedIds(new Set(ids));
            setPrimarySelectedId(ids[0] || null);
            if (ids[0]) setFocusNodeId(ids[0]);
          }}
          onAcceptMissingLink={async (item) => {
            await api.invoke('memory:create-relationship', {
              sourceId: item.sourceId,
              targetId: item.targetId,
              sourceKind: item.sourceKind,
              targetKind: item.targetKind,
              type: item.type,
              strength: item.confidence,
              confidence: item.confidence,
              directed: true,
            });
            await loadGraph();
          }}
          onConfirmMerge={async (primaryId, secondaryId) => {
            await api.invoke('memory:merge', { primaryId, secondaryId });
            await fetchMemories();
            setSelectedIds(new Set([primaryId]));
            setPrimarySelectedId(primaryId);
          }}
          onMarkSupersedes={async (sourceId, targetId, edgeId) => {
            if (edgeId) {
              await api.invoke('memory:delete-relationship', { id: edgeId });
            }
            await api.invoke('memory:create-relationship', {
              sourceId,
              targetId,
              sourceKind: 'memory',
              targetKind: 'memory',
              type: 'SUPERSEDES',
              strength: 0.9,
              confidence: 0.9,
              directed: true,
            });
            await loadGraph();
          }}
        />
      )}

      {/* Version History & Time-Travel Modal */}
      {historyEntry && (
        <MemoryHistoryModal
          isOpen={true}
          collection={LOFTYDB_MEMORY_COLLECTION}
          docId={historyEntry.id}
          title={historyEntry.title || historyEntry.content.slice(0, 42)}
          onClose={() => setHistoryEntry(null)}
          onRolledBack={() => {
            void fetchMemories();
            void loadGraph();
          }}
        />
      )}
    </div>
  );
};
