import React, { useMemo, useState } from 'react';
import {
  Brain,
  Plus,
  Search,
  Pin,
  History,
  Trash2,
  Edit2,
  Clock,
  Sparkles,
  Check,
  X,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import type {
  MemoryCategory,
  MemoryEntry,
  MemoryRecallResult,
  MemoryScope,
} from '@local-ai/shared';
import { LOFTYDB_MEMORY_COLLECTION } from '@local-ai/shared';
import { useAppStore } from '../../../stores/useAppStore';
import { api } from '../../../api/client';
import { MemoryHistoryModal } from './MemoryHistoryModal';
import { NODE_CATEGORY_META } from '../graph/graphTypes';
import { resolveAsOfNanoseconds } from '../utils/loftyFormatters';

const CATEGORIES: MemoryCategory[] = ['fact', 'preference', 'instruction', 'project', 'episode', 'context'];
const SCOPES: MemoryScope[] = ['global', 'persona', 'conversation'];

export const MemoryStudioTab: React.FC = () => {
  const {
    memories,
    personas,
    activeConvId,
    loftyDbConfig,
    loftyDbStatus,
    memoryEnabled,
    setMemoryEnabled,
    updateLoftyDbConfig,
    fetchMemories,
    saveMemory,
    deleteMemory,
  } = useAppStore();

  const isConnected = Boolean(loftyDbStatus?.connected);

  const [scopeFilter, setScopeFilter] = useState<'all' | MemoryScope>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | MemoryCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [semanticResults, setSemanticResults] = useState<MemoryRecallResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Time-travel snapshot viewer & collapsible filters (zero congestion)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [asOfInput, setAsOfInput] = useState('');
  const [snapshotMemories, setSnapshotMemories] = useState<MemoryEntry[] | null>(null);

  // Add / Edit modal state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<MemoryEntry | null>(null);
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState<MemoryCategory>('fact');
  const [formScope, setFormScope] = useState<MemoryScope>('global');
  const [formPersonaId, setFormPersonaId] = useState<string>('');
  const [formImportance, setFormImportance] = useState<number>(3);
  const [formPinned, setFormPinned] = useState<boolean>(false);
  const [formTags, setFormTags] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // History modal state
  const [historyTarget, setHistoryTarget] = useState<{ id: string; title: string } | null>(null);

  const openNewMemory = () => {
    setEditingMemory(null);
    setFormContent('');
    setFormCategory('fact');
    setFormScope('global');
    setFormPersonaId(personas[0]?.id || '');
    setFormImportance(4);
    setFormPinned(false);
    setFormTags('');
    setIsEditorOpen(true);
  };

  const openEditMemory = (m: MemoryEntry) => {
    setEditingMemory(m);
    setFormContent(m.content);
    setFormCategory(m.category);
    setFormScope(m.scope);
    setFormPersonaId(m.personaId || personas[0]?.id || '');
    setFormImportance(m.importance);
    setFormPinned(m.pinned);
    setFormTags(m.tags.join(', '));
    setIsEditorOpen(true);
  };

  const handleSaveMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formContent.trim()) return;
    setIsSaving(true);
    try {
      await saveMemory({
        id: editingMemory?.id,
        content: formContent.trim(),
        category: formCategory,
        scope: formScope,
        personaId: formScope === 'persona' ? formPersonaId : undefined,
        conversationId: formScope === 'conversation' ? (editingMemory?.conversationId || activeConvId) : undefined,
        importance: formImportance,
        pinned: formPinned,
        tags: formTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        source: 'manual',
      });
      setIsEditorOpen(false);
    } catch (err: any) {
      alert(`Failed to save memory: ${err?.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePin = async (m: MemoryEntry) => {
    await saveMemory({
      id: m.id,
      content: m.content,
      category: m.category,
      scope: m.scope,
      personaId: m.personaId,
      conversationId: m.conversationId,
      importance: m.importance,
      pinned: !m.pinned,
      tags: m.tags,
      source: m.source,
    });
  };

  const handleSemanticSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) {
      setSemanticResults(null);
      return;
    }
    setIsSearching(true);
    try {
      const results = await api.invoke('memory:recall', {
        query: q,
        limit: 15,
        minSimilarity: 0.05,
        scope: scopeFilter,
      });
      setSemanticResults(results || []);
    } catch (err: any) {
      alert(`Semantic recall failed: ${err?.message || err}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleQueryAsOf = async (timestampOrDate: string) => {
    if (!timestampOrDate.trim()) {
      setSnapshotMemories(null);
      return;
    }
    try {
      const asOfNs = resolveAsOfNanoseconds(timestampOrDate);
      if (!asOfNs) {
        setSnapshotMemories(null);
        return;
      }
      const docs = await api.invoke('memory:query-as-of', { asOf: asOfNs });
      setSnapshotMemories(docs || []);
      setAsOfInput(asOfNs);
    } catch (err: any) {
      alert(err?.message || 'Time-travel query failed');
    }
  };

  const displayedMemories = useMemo(() => {
    if (semanticResults) {
      return semanticResults
        .filter((r) => categoryFilter === 'all' || r.memory.category === categoryFilter)
        .map((r) => ({ entry: r.memory, score: r.similarity, matchedBy: r.matchedBy }));
    }
    const baseList = snapshotMemories ?? memories;
    return baseList
      .filter((m) => {
        if (scopeFilter !== 'all' && m.scope !== scopeFilter) return false;
        if (categoryFilter !== 'all' && m.category !== categoryFilter) return false;
        return true;
      })
      .map((entry) => ({ entry, score: undefined as number | undefined, matchedBy: undefined as string | undefined }));
  }, [semanticResults, snapshotMemories, memories, scopeFilter, categoryFilter]);

  const handleToggleGlobalMemory = async () => {
    const next = !memoryEnabled;
    setMemoryEnabled(next);
    if (loftyDbConfig) {
      await updateLoftyDbConfig({ memoryEnabled: next }).catch(() => {});
    }
  };

  const handleToggleAutoExtract = async () => {
    if (!loftyDbConfig) return;
    await updateLoftyDbConfig({ autoExtractMemories: !loftyDbConfig.autoExtractMemories }).catch(() => {});
  };

  if (!isConnected) {
    return (
      <div className="p-8 rounded-xl bg-zinc-50 dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] text-center space-y-2">
        <Brain className="w-8 h-8 mx-auto text-zinc-400" />
        <h3 className="text-sm font-semibold text-[#111111] dark:text-[#F5F5F5]">LoftyDB Engine Offline</h3>
        <p className="text-xs text-zinc-500 dark:text-[#A1A1AA] max-w-md mx-auto">
          Start or connect LoftyDB above to enable persistent semantic memory, time-travel versioning, and automatic chat recall.
        </p>
      </div>
    );
  }

  const activeFilterCount =
    (scopeFilter !== 'all' ? 1 : 0) +
    (categoryFilter !== 'all' ? 1 : 0) +
    (snapshotMemories ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Compact Primary Bar: Search + Toggles + Filters Toggle + Add */}
      <div className="p-3.5 rounded-xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <form onSubmit={handleSemanticSearch} className="flex-1 flex items-center gap-2 max-w-xl">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (!e.target.value.trim()) setSemanticResults(null);
              }}
              placeholder="Semantic recall search across memories..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-xs text-[#111111] dark:text-[#F5F5F5] focus:outline-none focus:border-black dark:focus:border-white"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="px-3 py-1.5 rounded-lg bg-black dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-black text-xs font-medium transition-colors"
          >
            {isSearching ? 'Searching...' : 'Recall'}
          </button>
          {semanticResults && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSemanticResults(null);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-[#eaeaea] dark:border-[#262626] text-xs text-zinc-500 hover:text-[#111111] dark:hover:text-white"
            >
              Clear
            </button>
          )}
        </form>

        <div className="flex flex-wrap items-center gap-3">
          {/* Compact Inline Toggles */}
          <label className="flex items-center gap-2 cursor-pointer text-xs text-[#111111] dark:text-[#F5F5F5]">
            <button
              type="button"
              onClick={handleToggleGlobalMemory}
              className={`w-8 h-4 rounded-full p-0.5 transition-colors ${
                memoryEnabled ? 'bg-black dark:bg-white' : 'bg-zinc-200 dark:bg-[#262626]'
              }`}
              title="Automatically recall & inject matching memories into chat prompts"
            >
              <div
                className={`w-3 h-3 rounded-full transition-transform ${
                  memoryEnabled ? 'translate-x-4 bg-white dark:bg-black' : 'translate-x-0 bg-white dark:bg-[#A1A1AA]'
                }`}
              />
            </button>
            <span className="font-medium">Auto-Recall</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-xs text-[#111111] dark:text-[#F5F5F5]">
            <button
              type="button"
              onClick={handleToggleAutoExtract}
              className={`w-8 h-4 rounded-full p-0.5 transition-colors ${
                loftyDbConfig?.autoExtractMemories ? 'bg-black dark:bg-white' : 'bg-zinc-200 dark:bg-[#262626]'
              }`}
              title="Automatically extract durable facts & preferences from user messages"
            >
              <div
                className={`w-3 h-3 rounded-full transition-transform ${
                  loftyDbConfig?.autoExtractMemories
                    ? 'translate-x-4 bg-white dark:bg-black'
                    : 'translate-x-0 bg-white dark:bg-[#A1A1AA]'
                }`}
              />
            </button>
            <span className="font-medium">Auto-Learn</span>
          </label>

          <button
            type="button"
            onClick={() => setShowAdvancedFilters((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              showAdvancedFilters || activeFilterCount > 0
                ? 'border-black dark:border-white text-[#111111] dark:text-[#F5F5F5]'
                : 'border-[#eaeaea] dark:border-[#262626] text-zinc-600 dark:text-[#A1A1AA]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-black dark:bg-white text-white dark:text-black text-[10px] font-mono">
                {activeFilterCount}
              </span>
            )}
          </button>

          <button
            onClick={openNewMemory}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-black dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-black text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Memory</span>
          </button>
        </div>
      </div>

      {/* Quick Category Pills Bar (Single Clean Row) */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(['all', ...CATEGORIES] as const).map((cat) => {
          const meta = cat === 'all' ? null : NODE_CATEGORY_META[cat];
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono capitalize transition-colors border ${
                categoryFilter === cat
                  ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                  : 'bg-white dark:bg-[#141414] text-zinc-600 dark:text-[#A1A1AA] border-[#eaeaea] dark:border-[#262626] hover:border-zinc-400'
              }`}
            >
              {meta && <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />}
              <span>{cat}</span>
            </button>
          );
        })}
      </div>

      {/* Collapsible Scope + Time Travel Drawer */}
      {showAdvancedFilters && (
        <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase text-zinc-500 mr-1">Scope:</span>
            {(['all', ...SCOPES] as const).map((sc) => (
              <button
                key={sc}
                onClick={() => setScopeFilter(sc)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium capitalize transition-colors border ${
                  scopeFilter === sc
                    ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                    : 'bg-white dark:bg-[#191919] text-zinc-600 dark:text-[#A1A1AA] border-[#eaeaea] dark:border-[#262626] hover:border-zinc-400'
                }`}
              >
                {sc === 'all' ? 'All Scopes' : sc}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Clock className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={asOfInput}
                onChange={(e) => setAsOfInput(e.target.value)}
                placeholder="AS OF timestamp / ISO date"
                className="w-56 pl-8 pr-2.5 py-1.5 rounded-lg bg-white dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-xs font-mono text-[#111111] dark:text-[#F5F5F5]"
              />
            </div>
            <button
              type="button"
              onClick={() => handleQueryAsOf(asOfInput)}
              className="px-3 py-1.5 rounded-lg border border-[#eaeaea] dark:border-[#262626] bg-white dark:bg-[#191919] hover:border-black dark:hover:border-white text-xs font-medium text-[#111111] dark:text-[#F5F5F5]"
            >
              Time Travel
            </button>
            {snapshotMemories && (
              <button
                type="button"
                onClick={() => {
                  setSnapshotMemories(null);
                  setAsOfInput('');
                }}
                className="p-1.5 rounded-lg border border-[#eaeaea] dark:border-[#262626] text-zinc-500 hover:text-black dark:hover:text-white"
                title="Return to present"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {snapshotMemories && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-700 dark:text-amber-300">
          <span>
            Viewing historical Time-Travel snapshot of <code>zaylo_memories</code> AS OF <code>{asOfInput}</code> ({snapshotMemories.length} entries)
          </span>
          <button
            onClick={() => {
              setSnapshotMemories(null);
              setAsOfInput('');
            }}
            className="underline font-medium"
          >
            Exit Time Travel
          </button>
        </div>
      )}

      {/* Memory Cards List */}
      {displayedMemories.length === 0 ? (
        <div className="p-10 rounded-xl bg-zinc-50 dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] text-center space-y-3">
          <Sparkles className="w-7 h-7 mx-auto text-zinc-400" />
          <div className="space-y-1">
            <p className="text-xs font-semibold text-[#111111] dark:text-[#F5F5F5]">
              {semanticResults ? 'No matching memories recalled for this query.' : 'No memories stored yet.'}
            </p>
            <p className="text-[11px] text-zinc-500 dark:text-[#A1A1AA] max-w-md mx-auto">
              Say &quot;Remember that I prefer concise TypeScript examples&quot; in Playground or add a memory manually.
            </p>
          </div>
          {!semanticResults && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={openNewMemory}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-black dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-black text-xs font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add First Memory</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {displayedMemories.map(({ entry: m, score, matchedBy }) => {
            const meta = NODE_CATEGORY_META[m.category] || NODE_CATEGORY_META.fact;
            return (
              <div
                key={m.id}
                className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-colors ${
                  m.pinned
                    ? 'bg-zinc-50 dark:bg-[#191919] border-black/30 dark:border-white/30'
                    : 'bg-white dark:bg-[#141414] border-[#eaeaea] dark:border-[#262626]'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono uppercase border ${meta.badgeClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
                        <span>{m.category}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-100 dark:bg-[#202020] text-zinc-500 dark:text-[#A1A1AA]">
                        {m.scope}
                      </span>
                      {m.version && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-500 dark:text-[#737373] border border-[#eaeaea] dark:border-[#262626]">
                          v{m.version}
                        </span>
                      )}
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-500 dark:text-[#737373]">
                        ★{m.importance}
                      </span>
                      {score !== undefined && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          {(score * 100).toFixed(1)}% {matchedBy || 'match'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleTogglePin(m)}
                        className={`p-1 rounded transition-colors ${
                          m.pinned
                            ? 'text-black dark:text-white bg-zinc-200 dark:bg-[#262626]'
                            : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-white'
                        }`}
                        title={m.pinned ? 'Unpin memory' : 'Pin memory (always recall)'}
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setHistoryTarget({ id: m.id, title: m.content.slice(0, 42) })}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-colors"
                        title="Time-Travel History & Rollback"
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openEditMemory(m)}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-colors"
                        title="Edit memory (creates new version)"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Delete this memory? (Revision history remains accessible via LoftyDB compaction/history)')) {
                            void deleteMemory(m.id);
                          }
                        }}
                        className="p-1 rounded text-zinc-400 hover:text-rose-500 transition-colors"
                        title="Delete memory"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-[#111111] dark:text-[#F5F5F5] leading-relaxed select-text">
                    {m.content}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#eaeaea] dark:border-[#222222] text-[10px] text-zinc-400 dark:text-[#737373] font-mono">
                  <div className="flex items-center gap-1.5 truncate">
                    <span>{m.source}</span>
                    {m.tags.length > 0 && <span>· {m.tags.map((t) => `#${t}`).join(' ')}</span>}
                  </div>
                  <span>{new Date(m.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Memory Create / Edit Modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveMemory}
            className="bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] rounded-xl w-full max-w-lg overflow-hidden shadow-2xl"
          >
            <div className="px-5 py-3.5 border-b border-[#eaeaea] dark:border-[#222222] bg-zinc-50 dark:bg-[#191919] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#111111] dark:text-[#F5F5F5]">
                {editingMemory ? `Edit Memory (v${editingMemory.version || 1} → v${(editingMemory.version || 1) + 1})` : 'Create Long-Term Memory'}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-700 dark:text-[#A1A1AA]">Memory Content</label>
                <textarea
                  rows={3}
                  required
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="e.g., I build backend microservices in Go and prefer concise examples without boilerplate."
                  className="w-full rounded-lg bg-zinc-50 dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] px-3 py-2 text-xs text-[#111111] dark:text-[#F5F5F5] focus:outline-none focus:border-black dark:focus:border-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-700 dark:text-[#A1A1AA]">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as MemoryCategory)}
                    className="w-full rounded-lg bg-zinc-50 dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] px-3 py-2 text-xs text-[#111111] dark:text-[#F5F5F5]"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-700 dark:text-[#A1A1AA]">Scope</label>
                  <select
                    value={formScope}
                    onChange={(e) => setFormScope(e.target.value as MemoryScope)}
                    className="w-full rounded-lg bg-zinc-50 dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] px-3 py-2 text-xs text-[#111111] dark:text-[#F5F5F5]"
                  >
                    {SCOPES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {formScope === 'persona' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-700 dark:text-[#A1A1AA]">Bound Persona</label>
                  <select
                    value={formPersonaId}
                    onChange={(e) => setFormPersonaId(e.target.value)}
                    className="w-full rounded-lg bg-zinc-50 dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] px-3 py-2 text-xs text-[#111111] dark:text-[#F5F5F5]"
                  >
                    {personas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.avatar} {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 items-center">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-700 dark:text-[#A1A1AA]">
                    Importance ({formImportance}/5)
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={formImportance}
                    onChange={(e) => setFormImportance(Number(e.target.value))}
                    className="w-full accent-black dark:accent-white"
                  />
                </div>

                <label className="flex items-center gap-2 pt-4 cursor-pointer text-xs text-[#111111] dark:text-[#F5F5F5]">
                  <input
                    type="checkbox"
                    checked={formPinned}
                    onChange={(e) => setFormPinned(e.target.checked)}
                    className="rounded accent-black dark:accent-white"
                  />
                  <span>Pin (always include in context)</span>
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-700 dark:text-[#A1A1AA]">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="coding, architecture, style"
                  className="w-full rounded-lg bg-zinc-50 dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] px-3 py-2 text-xs text-[#111111] dark:text-[#F5F5F5]"
                />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-[#eaeaea] dark:border-[#222222] bg-zinc-50 dark:bg-[#191919] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-[#eaeaea] dark:border-[#262626] text-xs font-medium text-zinc-600 dark:text-[#A1A1AA]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-black dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-black text-xs font-semibold disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save to LoftyDB'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* History & Time Travel Modal */}
      {historyTarget && (
        <MemoryHistoryModal
          isOpen={true}
          collection={LOFTYDB_MEMORY_COLLECTION}
          docId={historyTarget.id}
          title={historyTarget.title}
          onClose={() => setHistoryTarget(null)}
          onRolledBack={() => void fetchMemories()}
          onTimeTravelAsOf={(tsNs) => void handleQueryAsOf(tsNs)}
        />
      )}
    </div>
  );
};
