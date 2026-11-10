import React from 'react';
import { Database, Filter, RotateCcw, Layers, X } from 'lucide-react';
import type { KnowledgeGraphPayload } from '@local-ai/shared';
import {
  NODE_CATEGORY_META,
  type GraphFilterState,
  type NodeVisualGroup,
} from '../graph/graphTypes';

interface ExplorerLeftSidebarProps {
  payload: KnowledgeGraphPayload | null;
  selectedCollection: string;
  filters: GraphFilterState;
  visibleNodeCount: number;
  visibleEdgeCount: number;
  onSelectCollection: (collection: string) => void;
  onUpdateFilters: (patch: Partial<GraphFilterState>) => void;
  onResetFilters: () => void;
  onCloseMobile?: () => void;
}

const ORDERED_GROUPS: NodeVisualGroup[] = [
  'fact',
  'preference',
  'instruction',
  'project',
  'episode',
  'context',
  'entity',
  'conversation',
];

export const ExplorerLeftSidebar: React.FC<ExplorerLeftSidebarProps> = ({
  payload,
  selectedCollection,
  filters,
  visibleNodeCount,
  visibleEdgeCount,
  onSelectCollection,
  onUpdateFilters,
  onResetFilters,
  onCloseMobile,
}) => {
  const counts = React.useMemo(() => {
    const map: Record<NodeVisualGroup, number> = {
      fact: 0,
      preference: 0,
      instruction: 0,
      project: 0,
      episode: 0,
      context: 0,
      entity: 0,
      conversation: 0,
    };
    if (!payload) return map;
    for (const m of payload.memories) {
      if (m.category in map) map[m.category]++;
    }
    map.entity = payload.entities.length;
    map.conversation = payload.conversations.length;
    return map;
  }, [payload]);

  const toggleGroup = (group: NodeVisualGroup) => {
    const next = new Set(filters.categories);
    if (next.has(group)) {
      if (next.size > 1) next.delete(group);
    } else {
      next.add(group);
    }
    onUpdateFilters({ categories: next });
  };

  const hasActiveFilter =
    filters.categories.size < ORDERED_GROUPS.length ||
    filters.minImportance > 1 ||
    filters.dateRange !== 'all' ||
    filters.minConnections > 0 ||
    filters.source !== 'all';

  return (
    <aside className="w-64 shrink-0 h-full bg-white dark:bg-[#0e1118] border-r border-slate-200 dark:border-white/10 flex flex-col text-slate-900 dark:text-slate-200 overflow-y-auto">
      <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
          Memory Explorer
        </span>
        <div className="flex items-center gap-1">
          {hasActiveFilter && (
            <button
              type="button"
              onClick={onResetFilters}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-500/10"
              title="Reset all filters"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Reset</span>
            </button>
          )}
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="lg:hidden p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Overview Counts */}
      <div className="p-3.5 border-b border-slate-200 dark:border-white/10 space-y-2">
        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
          Overview
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#141821] border border-slate-200 dark:border-white/10">
            <div className="text-[10px] text-slate-500 dark:text-slate-400">Memories</div>
            <div className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">
              {payload?.memories.length ?? 0}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#141821] border border-slate-200 dark:border-white/10">
            <div className="text-[10px] text-slate-500 dark:text-slate-400">Entities</div>
            <div className="text-sm font-bold font-mono text-cyan-600 dark:text-cyan-400">
              {payload?.entities.length ?? 0}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#141821] border border-slate-200 dark:border-white/10">
            <div className="text-[10px] text-slate-500 dark:text-slate-400">Relationships</div>
            <div className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">
              {payload?.relationships.length ?? 0}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#141821] border border-slate-200 dark:border-white/10">
            <div className="text-[10px] text-slate-500 dark:text-slate-400">Collections</div>
            <div className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">
              {payload?.collections.length ?? 0}
            </div>
          </div>
        </div>
        <div className="text-[10px] font-mono text-slate-500 flex items-center justify-between pt-0.5">
          <span>Visible Canvas:</span>
          <span className="text-slate-700 dark:text-slate-300 font-medium">
            {visibleNodeCount} nodes · {visibleEdgeCount} edges
          </span>
        </div>
      </div>

      {/* Memory Categories */}
      <div className="p-3.5 border-b border-slate-200 dark:border-white/10 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Layers className="w-3 h-3" />
            <span>Categories</span>
          </span>
          <button
            type="button"
            onClick={() => onUpdateFilters({ categories: new Set(ORDERED_GROUPS) })}
            className="text-[10px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white"
          >
            All
          </button>
        </div>

        <div className="space-y-0.5">
          {ORDERED_GROUPS.map((group) => {
            const meta = NODE_CATEGORY_META[group];
            const active = filters.categories.has(group);
            return (
              <button
                key={group}
                type="button"
                onClick={() => toggleGroup(group)}
                onDoubleClick={() => onUpdateFilters({ categories: new Set([group]) })}
                title="Click to toggle · Double-click to isolate"
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors ${
                  active
                    ? 'bg-slate-100 dark:bg-white/[0.06] text-slate-900 dark:text-slate-100 font-medium'
                    : 'text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-white/[0.03] hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 transition-opacity"
                    style={{
                      backgroundColor: meta.color,
                      opacity: active ? 1 : 0.28,
                    }}
                  />
                  <span>{meta.pluralLabel}</span>
                </span>
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  {counts[group]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Collections */}
      <div className="p-3.5 border-b border-slate-200 dark:border-white/10 space-y-2">
        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 flex items-center gap-1">
          <Database className="w-3 h-3" />
          <span>Collections</span>
        </div>
        <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
          {(payload?.collections || ['zaylo_memories']).map((col) => {
            const active = col === selectedCollection;
            return (
              <button
                key={col}
                type="button"
                onClick={() => onSelectCollection(col)}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-[11px] font-mono truncate border transition-colors ${
                  active
                    ? 'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-500/40 font-semibold'
                    : 'bg-slate-50 dark:bg-[#141821] text-slate-700 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-950 dark:hover:text-slate-200'
                }`}
              >
                {col}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="p-3.5 space-y-3">
        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 flex items-center gap-1">
          <Filter className="w-3 h-3" />
          <span>Filters</span>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
            <span>Min Importance</span>
            <span className="font-mono text-slate-900 dark:text-slate-200 font-medium">
              ★{filters.minImportance}+
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={5}
            value={filters.minImportance}
            onChange={(e) => onUpdateFilters({ minImportance: Number(e.target.value) })}
            className="w-full accent-sky-600 dark:accent-sky-400"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
            <span>Min Connections</span>
            <span className="font-mono text-slate-900 dark:text-slate-200 font-medium">
              {filters.minConnections}+
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={5}
            value={filters.minConnections}
            onChange={(e) => onUpdateFilters({ minConnections: Number(e.target.value) })}
            className="w-full accent-sky-600 dark:accent-sky-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-slate-500">Time Field</label>
            <select
              value={filters.dateField}
              onChange={(e) =>
                onUpdateFilters({ dateField: e.target.value as GraphFilterState['dateField'] })
              }
              className="w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-[#161a24] text-slate-900 dark:text-slate-100 px-2 py-1 text-[11px]"
            >
              <option value="updatedAt">Updated</option>
              <option value="createdAt">Created</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-slate-500">Date Range</label>
            <select
              value={filters.dateRange}
              onChange={(e) =>
                onUpdateFilters({ dateRange: e.target.value as GraphFilterState['dateRange'] })
              }
              className="w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-[#161a24] text-slate-900 dark:text-slate-100 px-2 py-1 text-[11px]"
            >
              <option value="all">All Time</option>
              <option value="24h">Last 24h</option>
              <option value="7d">Last 7d</option>
              <option value="30d">Last 30d</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-mono text-slate-500">Source</label>
          <select
            value={filters.source}
            onChange={(e) =>
              onUpdateFilters({ source: e.target.value as GraphFilterState['source'] })
            }
            className="w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-[#161a24] text-slate-900 dark:text-slate-100 px-2 py-1 text-[11px]"
          >
            <option value="all">All Sources</option>
            <option value="manual">Manual</option>
            <option value="auto">Auto-Extracted</option>
            <option value="chat">Saved from Chat</option>
          </select>
        </div>
      </div>
    </aside>
  );
};
