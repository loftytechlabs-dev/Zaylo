import React, { useEffect, useState } from 'react';
import {
  FolderOpen,
  Plus,
  Trash2,
  History,
  Minimize2,
  Edit2,
  RefreshCw,
  Check,
  X,
  Database,
  Clock,
} from 'lucide-react';
import type { LoftyDbDocument } from '@local-ai/shared';
import { api } from '../../../api/client';
import { useAppStore } from '../../../stores/useAppStore';
import { MemoryHistoryModal } from './MemoryHistoryModal';
import { stripDocumentMeta } from '../utils/loftyFormatters';

export const CollectionsExplorerTab: React.FC = () => {
  const { loftyDbStatus, fetchLoftyDbState } = useAppStore();
  const isConnected = Boolean(loftyDbStatus?.connected);

  const [collections, setCollections] = useState<string[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [documents, setDocuments] = useState<LoftyDbDocument[]>([]);
  const [filterInput, setFilterInput] = useState('{}');
  const [asOfInput, setAsOfInput] = useState('');
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Document Editor Modal
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [docJsonText, setDocJsonText] = useState('{\n  "_id": "",\n  "_vector_source": "text",\n  "text": ""\n}');
  const [docError, setDocError] = useState<string | null>(null);

  // New Collection Modal
  const [newCollectionName, setNewCollectionName] = useState('');
  const [showNewColInput, setShowNewColInput] = useState(false);

  // History Modal
  const [historyDocId, setHistoryDocId] = useState<string | null>(null);

  const loadCollections = async () => {
    if (!isConnected) return;
    try {
      const list = await api.invoke('loftydb:list-collections', undefined);
      setCollections(list || []);
      if (list && list.length > 0 && (!selectedCollection || !list.includes(selectedCollection))) {
        setSelectedCollection(list[0]);
      }
    } catch (err) {
      console.error('Failed to list LoftyDB collections:', err);
    }
  };

  const loadDocuments = async (colName: string, filterStr = filterInput, asOf = asOfInput) => {
    if (!colName || !isConnected) return;
    setLoadingDocs(true);
    try {
      let parsedFilter: Record<string, unknown> = {};
      if (filterStr.trim()) {
        parsedFilter = JSON.parse(filterStr);
      }
      const docs = await api.invoke('loftydb:query-documents', {
        collection: colName,
        filter: parsedFilter,
        asOf: asOf.trim() || undefined,
      });
      setDocuments(docs || []);
    } catch (err: any) {
      alert(`Query failed: ${err?.message || err}`);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    void loadCollections();
  }, [isConnected]);

  useEffect(() => {
    if (selectedCollection && isConnected) {
      void loadDocuments(selectedCollection, '{}', '');
      setFilterInput('{}');
      setAsOfInput('');
    } else {
      setDocuments([]);
    }
  }, [selectedCollection, isConnected]);

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newCollectionName.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!clean) return;
    try {
      await api.invoke('loftydb:upsert-document', {
        collection: clean,
        document: {
          _id: `init_${Date.now()}`,
          _vector_source: 'note',
          note: `Initialized collection ${clean}`,
        },
      });
      setNewCollectionName('');
      setShowNewColInput(false);
      await loadCollections();
      setSelectedCollection(clean);
      await fetchLoftyDbState();
    } catch (err: any) {
      alert(`Failed to create collection: ${err?.message || err}`);
    }
  };

  const handleDropCollection = async (colName: string) => {
    if (!confirm(`Drop entire collection "${colName}" and delete its .db file?`)) return;
    try {
      await api.invoke('loftydb:delete-collection', { collection: colName });
      await loadCollections();
      await fetchLoftyDbState();
    } catch (err: any) {
      alert(`Failed to drop collection: ${err?.message || err}`);
    }
  };

  const handleCompact = async () => {
    if (!selectedCollection) return;
    try {
      await api.invoke('loftydb:compact-collection', { collection: selectedCollection });
      await fetchLoftyDbState();
      await loadDocuments(selectedCollection);
      alert(`Compacted "${selectedCollection}" successfully.`);
    } catch (err: any) {
      alert(`Compaction failed: ${err?.message || err}`);
    }
  };

  const openInsertDoc = () => {
    setEditingDocId(null);
    setDocError(null);
    setDocJsonText('{\n  "_vector_source": "text",\n  "text": "Sample document with auto-vectorization"\n}');
    setIsDocModalOpen(true);
  };

  const openEditDoc = (doc: LoftyDbDocument) => {
    const clean = stripDocumentMeta(doc, ['_version', '_updated_at', 'updatedAtNs']);
    setEditingDocId(doc._id);
    setDocError(null);
    setDocJsonText(JSON.stringify(clean, null, 2));
    setIsDocModalOpen(true);
  };

  const handleSaveDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCollection) return;
    setDocError(null);
    try {
      const parsed = JSON.parse(docJsonText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setDocError('Document must be a JSON object.');
        return;
      }
      await api.invoke('loftydb:upsert-document', {
        collection: selectedCollection,
        document: parsed,
        id: editingDocId || (typeof parsed._id === 'string' && parsed._id ? parsed._id : undefined),
      });
      setIsDocModalOpen(false);
      await loadDocuments(selectedCollection);
      await fetchLoftyDbState();
    } catch (err: any) {
      setDocError(err?.message || 'Invalid JSON or save error');
    }
  };

  const handleDeleteDoc = async (id: string) => {
    if (!selectedCollection || !confirm(`Delete document "${id}"?`)) return;
    try {
      await api.invoke('loftydb:delete-document', { collection: selectedCollection, id });
      await loadDocuments(selectedCollection);
      await fetchLoftyDbState();
    } catch (err: any) {
      alert(`Delete failed: ${err?.message || err}`);
    }
  };

  if (!isConnected) {
    return (
      <div className="p-8 rounded-xl bg-zinc-50 dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] text-center text-xs text-zinc-500">
        Connect or start LoftyDB above to browse collections and documents.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
      {/* Left Rail: Collections List */}
      <div className="lg:col-span-1 space-y-3">
        <div className="p-4 rounded-xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#111111] dark:text-[#F5F5F5] flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-zinc-500" />
              Collections ({collections.length})
            </span>
            <button
              onClick={() => setShowNewColInput(!showNewColInput)}
              className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-[#202020] text-zinc-600 dark:text-[#A1A1AA]"
              title="New Collection"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {showNewColInput && (
            <form onSubmit={handleCreateCollection} className="flex items-center gap-1.5">
              <input
                type="text"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="collection_name"
                className="flex-1 min-w-0 rounded-lg bg-zinc-50 dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] px-2.5 py-1.5 text-xs font-mono text-[#111111] dark:text-[#F5F5F5]"
              />
              <button
                type="submit"
                className="px-2.5 py-1.5 rounded-lg bg-black dark:bg-white text-white dark:text-black text-xs font-medium"
              >
                Add
              </button>
            </form>
          )}

          <div className="space-y-1 max-h-96 overflow-y-auto">
            {collections.length === 0 ? (
              <p className="text-[11px] text-zinc-500 py-3 text-center">No collections yet.</p>
            ) : (
              collections.map((col) => {
                const sizeBytes = loftyDbStatus?.stats?.cols?.[col] || 0;
                const isSelected = col === selectedCollection;
                return (
                  <div
                    key={col}
                    onClick={() => setSelectedCollection(col)}
                    className={`group px-3 py-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-black dark:bg-white text-white dark:text-black font-medium'
                        : 'hover:bg-zinc-50 dark:hover:bg-[#202020] text-zinc-700 dark:text-[#A1A1AA]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Database className="w-3.5 h-3.5 shrink-0 opacity-70" />
                      <span className="truncate font-mono">{col}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[10px] font-mono ${isSelected ? 'opacity-80' : 'text-zinc-400'}`}>
                        {(sizeBytes / 1024).toFixed(1)}K
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDropCollection(col);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-rose-500 transition-opacity"
                        title="Drop Collection"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Main Pane: Documents Browser */}
      <div className="lg:col-span-3 space-y-4">
        {selectedCollection ? (
          <>
            <div className="p-4 rounded-xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-mono font-bold text-[#111111] dark:text-[#F5F5F5]">
                    {selectedCollection}
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    {documents.length} document(s) loaded {asOfInput ? `(AS OF ${asOfInput})` : ''}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => void loadDocuments(selectedCollection)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#eaeaea] dark:border-[#262626] text-xs text-zinc-600 dark:text-[#A1A1AA] hover:text-black dark:hover:text-white"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingDocs ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                  <button
                    onClick={handleCompact}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#eaeaea] dark:border-[#262626] text-xs text-zinc-600 dark:text-[#A1A1AA] hover:text-black dark:hover:text-white"
                    title="Compact old revisions into latest versions to free disk space"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                    <span>Compact</span>
                  </button>
                  <button
                    onClick={openInsertDoc}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-black dark:bg-white text-white dark:text-black text-xs font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Insert Document</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={filterInput}
                  onChange={(e) => setFilterInput(e.target.value)}
                  placeholder='Filter JSON e.g. {"category": "fact"}'
                  className="md:col-span-2 rounded-lg bg-zinc-50 dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] px-3 py-1.5 text-xs font-mono text-[#111111] dark:text-[#F5F5F5]"
                />
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <Clock className="w-3 h-3 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={asOfInput}
                      onChange={(e) => setAsOfInput(e.target.value)}
                      placeholder="asOf ns timestamp"
                      className="w-full pl-7 pr-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-xs font-mono text-[#111111] dark:text-[#F5F5F5]"
                    />
                  </div>
                  <button
                    onClick={() => void loadDocuments(selectedCollection, filterInput, asOfInput)}
                    className="px-3 py-1.5 rounded-lg bg-black dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-black text-xs font-medium transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {documents.map((doc) => {
                const displayDoc: Record<string, unknown> = { ...doc };
                const hasVector = Array.isArray(displayDoc._vector);
                if (hasVector) {
                  displayDoc._vector = `[${(displayDoc._vector as unknown[]).length}-dim auto-vector]`;
                }
                return (
                  <div
                    key={doc._id}
                    className="p-4 rounded-xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-mono font-semibold text-[#111111] dark:text-[#F5F5F5] truncate">
                          {doc._id}
                        </span>
                        {doc._version && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-100 dark:bg-[#202020] text-zinc-600 dark:text-[#A1A1AA]">
                            v{doc._version}
                          </span>
                        )}
                        {hasVector && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            vectorized
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setHistoryDocId(doc._id)}
                          className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-[#202020] text-zinc-500 hover:text-black dark:hover:text-white"
                          title="History & Time Travel"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditDoc(doc)}
                          className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-[#202020] text-zinc-500 hover:text-black dark:hover:text-white"
                          title="Edit Document"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => void handleDeleteDoc(doc._id)}
                          className="p-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 text-zinc-500 hover:text-rose-500"
                          title="Delete Document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <pre className="p-3 rounded-lg bg-zinc-50 dark:bg-[#0D0D0D] border border-[#eaeaea] dark:border-[#222222] text-[11px] font-mono text-zinc-700 dark:text-zinc-300 overflow-x-auto max-h-52 select-text">
                      {JSON.stringify(displayDoc, null, 2)}
                    </pre>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="p-10 rounded-xl bg-zinc-50 dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] text-center text-xs text-zinc-500">
            Select or create a collection on the left to inspect documents.
          </div>
        )}
      </div>

      {/* Document JSON Editor Modal */}
      {isDocModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveDoc}
            className="bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] rounded-xl w-full max-w-xl overflow-hidden shadow-2xl"
          >
            <div className="px-5 py-3.5 border-b border-[#eaeaea] dark:border-[#222222] bg-zinc-50 dark:bg-[#191919] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#111111] dark:text-[#F5F5F5]">
                {editingDocId ? `Edit Document (${editingDocId})` : `Insert Document into ${selectedCollection}`}
              </h3>
              <button type="button" onClick={() => setIsDocModalOpen(false)} className="p-1 text-zinc-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {docError && (
                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 text-xs text-rose-600 dark:text-rose-300">
                  {docError}
                </div>
              )}
              <p className="text-[11px] text-zinc-500">
                Tip: Include <code>"_vector_source": "fieldName"</code> so LoftyDB auto-vectorizes that text field on write.
              </p>
              <textarea
                rows={12}
                value={docJsonText}
                onChange={(e) => setDocJsonText(e.target.value)}
                className="w-full rounded-lg bg-zinc-50 dark:bg-[#0D0D0D] border border-[#eaeaea] dark:border-[#262626] p-3 text-xs font-mono text-[#111111] dark:text-[#F5F5F5] focus:outline-none"
              />
            </div>
            <div className="px-5 py-3 border-t border-[#eaeaea] dark:border-[#222222] bg-zinc-50 dark:bg-[#191919] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDocModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-[#eaeaea] dark:border-[#262626] text-xs text-zinc-600 dark:text-[#A1A1AA]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-black dark:bg-white text-white dark:text-black text-xs font-semibold"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Document</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {historyDocId && selectedCollection && (
        <MemoryHistoryModal
          isOpen={true}
          collection={selectedCollection}
          docId={historyDocId}
          onClose={() => setHistoryDocId(null)}
          onRolledBack={() => void loadDocuments(selectedCollection)}
          onTimeTravelAsOf={(tsNs) => {
            setAsOfInput(tsNs);
            void loadDocuments(selectedCollection, filterInput, tsNs);
          }}
        />
      )}
    </div>
  );
};
