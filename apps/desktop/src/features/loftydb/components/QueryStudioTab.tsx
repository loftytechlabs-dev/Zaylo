import React, { useEffect, useState } from 'react';
import { Play, Code2, Database, Sparkles, Clock } from 'lucide-react';
import { LOFTYDB_MEMORY_COLLECTION, LOFTYDB_CONVERSATIONS_COLLECTION } from '@local-ai/shared';
import { api } from '../../../api/client';
import { useAppStore } from '../../../stores/useAppStore';
import { resolveAsOfNanoseconds } from '../utils/loftyFormatters';

type QueryMode = 'sql' | 'nosql' | 'vector';

export const QueryStudioTab: React.FC = () => {
  const { loftyDbStatus } = useAppStore();
  const isConnected = Boolean(loftyDbStatus?.connected);

  const [collections, setCollections] = useState<string[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>(LOFTYDB_MEMORY_COLLECTION);
  const [mode, setMode] = useState<QueryMode>('sql');

  const [sqlText, setSqlText] = useState(
    `SELECT _id, content, category, importance FROM ${LOFTYDB_MEMORY_COLLECTION} WHERE importance >= 3 LIMIT 20`
  );
  const [nosqlText, setNosqlText] = useState('{\n  "importance": { "$gte": 3 }\n}');
  const [vectorText, setVectorText] = useState('');
  const [vectorMinSim, setVectorMinSim] = useState(0.1);
  const [vectorLimit, setVectorLimit] = useState(10);
  const [asOfInput, setAsOfInput] = useState('');

  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outputDocs, setOutputDocs] = useState<any[]>([]);
  const [lastMeta, setLastMeta] = useState<string>('');

  useEffect(() => {
    if (!isConnected) return;
    void api.invoke('loftydb:list-collections', undefined).then((cols) => {
      const list = cols || [];
      setCollections(list);
      if (list.length > 0 && !list.includes(selectedCollection)) {
        setSelectedCollection(list[0]);
      }
    });
  }, [isConnected]);

  const handleRun = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!isConnected) return;
    setIsRunning(true);
    setError(null);

    try {
      const asOf = resolveAsOfNanoseconds(asOfInput);

      if (mode === 'sql') {
        const res = await api.invoke('loftydb:execute-sql', {
          query: sqlText,
          asOf,
        });
        setOutputDocs(res.documents || []);
        setLastMeta(`SQL (${res.collection}) • ${res.documents?.length || 0} row(s)`);
      } else if (mode === 'nosql') {
        const filter = nosqlText.trim() ? JSON.parse(nosqlText) : {};
        const docs = await api.invoke('loftydb:query-documents', {
          collection: selectedCollection,
          filter,
          asOf,
        });
        setOutputDocs(docs || []);
        setLastMeta(`NoSQL (${selectedCollection}) • ${docs?.length || 0} document(s)`);
      } else {
        if (!vectorText.trim()) {
          throw new Error('Enter search text for cosine similarity vector search.');
        }
        const res = await api.invoke('loftydb:vector-search', {
          collection: selectedCollection,
          text: vectorText.trim(),
          minSimilarity: vectorMinSim,
          limit: vectorLimit,
        });
        setOutputDocs(res.documents || []);
        setLastMeta(`Vector Search (${selectedCollection}) • ${res.documents?.length || 0} match(es)`);
      }
    } catch (err: any) {
      setError(err?.message || 'Query execution failed');
    } finally {
      setIsRunning(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="p-8 rounded-xl bg-zinc-50 dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] text-center text-xs text-zinc-500">
        Connect or start LoftyDB above to run SQL, NoSQL, Time-Travel, and Vector queries.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Mode Switcher + Collection & AS OF Bar */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-[#191919] p-1 rounded-lg border border-[#eaeaea] dark:border-[#262626]">
          <button
            onClick={() => setMode('sql')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              mode === 'sql'
                ? 'bg-black dark:bg-white text-white dark:text-black shadow-xs'
                : 'text-zinc-600 dark:text-[#A1A1AA]'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>SQL Engine</span>
          </button>
          <button
            onClick={() => setMode('nosql')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              mode === 'nosql'
                ? 'bg-black dark:bg-white text-white dark:text-black shadow-xs'
                : 'text-zinc-600 dark:text-[#A1A1AA]'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>NoSQL JSON</span>
          </button>
          <button
            onClick={() => setMode('vector')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              mode === 'vector'
                ? 'bg-black dark:bg-white text-white dark:text-black shadow-xs'
                : 'text-zinc-600 dark:text-[#A1A1AA]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Vector Search</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {mode !== 'sql' && (
            <select
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              className="rounded-lg bg-zinc-50 dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] px-3 py-1.5 text-xs font-mono text-[#111111] dark:text-[#F5F5F5]"
            >
              {collections.length === 0 && <option value={LOFTYDB_MEMORY_COLLECTION}>{LOFTYDB_MEMORY_COLLECTION}</option>}
              {collections.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          {mode !== 'vector' && (
            <div className="relative">
              <Clock className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={asOfInput}
                onChange={(e) => setAsOfInput(e.target.value)}
                placeholder="Optional AS OF timestamp"
                className="pl-8 pr-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-xs font-mono text-[#111111] dark:text-[#F5F5F5] w-52"
              />
            </div>
          )}
        </div>
      </div>

      {/* Query Input Editor */}
      <form
        onSubmit={handleRun}
        className="p-5 rounded-xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] space-y-4"
      >
        {mode === 'sql' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-zinc-600 dark:text-[#A1A1AA]">
                Supports <code>SELECT</code>, <code>INNER/LEFT/RIGHT/FULL JOIN</code>, <code>WHERE</code> (<code>=</code>, <code>!=</code>, <code>&gt;</code>, <code>&lt;</code>, <code>LIKE</code>, <code>IN</code>, <code>AND</code>), <code>LIMIT</code>
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setSqlText(
                      `SELECT _id, content, category, importance FROM ${LOFTYDB_MEMORY_COLLECTION} WHERE importance >= 3 LIMIT 20`
                    )
                  }
                  className="px-2 py-1 rounded bg-zinc-100 dark:bg-[#191919] text-[10px] font-mono text-zinc-600 dark:text-[#A1A1AA] hover:text-black dark:hover:text-white"
                >
                  Memories
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSqlText(
                      `SELECT ${LOFTYDB_MEMORY_COLLECTION}.content, ${LOFTYDB_CONVERSATIONS_COLLECTION}.title FROM ${LOFTYDB_MEMORY_COLLECTION} INNER JOIN ${LOFTYDB_CONVERSATIONS_COLLECTION} ON ${LOFTYDB_MEMORY_COLLECTION}.conversationId = ${LOFTYDB_CONVERSATIONS_COLLECTION}._id LIMIT 20`
                    )
                  }
                  className="px-2 py-1 rounded bg-zinc-100 dark:bg-[#191919] text-[10px] font-mono text-zinc-600 dark:text-[#A1A1AA] hover:text-black dark:hover:text-white"
                >
                  JOIN Memories + Chats
                </button>
              </div>
            </div>
            <textarea
              rows={4}
              value={sqlText}
              onChange={(e) => setSqlText(e.target.value)}
              className="w-full rounded-lg bg-zinc-50 dark:bg-[#0D0D0D] border border-[#eaeaea] dark:border-[#262626] p-3 text-xs font-mono text-[#111111] dark:text-[#F5F5F5] focus:outline-none focus:border-black dark:focus:border-white"
            />
          </div>
        )}

        {mode === 'nosql' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-zinc-600 dark:text-[#A1A1AA]">
                MongoDB-style JSON filter (<code>$eq</code>, <code>$ne</code>, <code>$gt</code>, <code>$gte</code>, <code>$lt</code>, <code>$lte</code>, <code>$in</code>, <code>$nin</code>, <code>$regex</code>)
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setNosqlText('{\n  "pinned": true\n}')}
                  className="px-2 py-1 rounded bg-zinc-100 dark:bg-[#191919] text-[10px] font-mono text-zinc-600 dark:text-[#A1A1AA]"
                >
                  Pinned
                </button>
                <button
                  type="button"
                  onClick={() => setNosqlText('{\n  "category": { "$in": ["preference", "instruction"] }\n}')}
                  className="px-2 py-1 rounded bg-zinc-100 dark:bg-[#191919] text-[10px] font-mono text-zinc-600 dark:text-[#A1A1AA]"
                >
                  Preferences
                </button>
              </div>
            </div>
            <textarea
              rows={5}
              value={nosqlText}
              onChange={(e) => setNosqlText(e.target.value)}
              className="w-full rounded-lg bg-zinc-50 dark:bg-[#0D0D0D] border border-[#eaeaea] dark:border-[#262626] p-3 text-xs font-mono text-[#111111] dark:text-[#F5F5F5] focus:outline-none focus:border-black dark:focus:border-white"
            />
          </div>
        )}

        {mode === 'vector' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-zinc-700 dark:text-[#A1A1AA]">Semantic Query Text</label>
              <input
                type="text"
                value={vectorText}
                onChange={(e) => setVectorText(e.target.value)}
                placeholder="e.g., preferred programming language or database architecture"
                className="w-full rounded-lg bg-zinc-50 dark:bg-[#0D0D0D] border border-[#eaeaea] dark:border-[#262626] px-3 py-2 text-xs text-[#111111] dark:text-[#F5F5F5]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-700 dark:text-[#A1A1AA]">
                Min Similarity ({vectorMinSim.toFixed(2)})
              </label>
              <input
                type="range"
                min={0}
                max={0.95}
                step={0.05}
                value={vectorMinSim}
                onChange={(e) => setVectorMinSim(Number(e.target.value))}
                className="w-full accent-black dark:accent-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-700 dark:text-[#A1A1AA]">Limit</label>
              <input
                type="number"
                min={1}
                max={50}
                value={vectorLimit}
                onChange={(e) => setVectorLimit(Number(e.target.value))}
                className="w-full rounded-lg bg-zinc-50 dark:bg-[#0D0D0D] border border-[#eaeaea] dark:border-[#262626] px-3 py-2 text-xs font-mono text-[#111111] dark:text-[#F5F5F5]"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono text-zinc-500">{lastMeta}</span>
          <button
            type="submit"
            disabled={isRunning}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-black dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-black text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isRunning ? 'Executing...' : 'Run Query'}</span>
          </button>
        </div>
      </form>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 text-xs text-rose-600 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Results Output */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#111111] dark:text-[#F5F5F5]">
            Query Results ({outputDocs.length})
          </span>
        </div>

        {mode === 'vector' && outputDocs.length > 0 ? (
          <div className="space-y-2.5">
            {outputDocs.map((doc, idx) => {
              const clean = { ...doc };
              delete clean._vector;
              const sim = typeof doc._similarity === 'number' ? doc._similarity : 0;
              return (
                <div
                  key={doc._id || idx}
                  className="p-3.5 rounded-lg bg-zinc-50 dark:bg-[#0D0D0D] border border-[#eaeaea] dark:border-[#222222] space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold text-[#111111] dark:text-[#F5F5F5]">
                      {doc._id || `#${idx + 1}`}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      {(sim * 100).toFixed(1)}% Similarity
                    </span>
                  </div>
                  <pre className="text-[11px] font-mono text-zinc-700 dark:text-zinc-300 overflow-x-auto select-text">
                    {JSON.stringify(clean, null, 2)}
                  </pre>
                </div>
              );
            })}
          </div>
        ) : (
          <pre className="p-3.5 rounded-lg bg-zinc-50 dark:bg-[#0D0D0D] border border-[#eaeaea] dark:border-[#222222] text-[11px] font-mono text-zinc-700 dark:text-zinc-300 overflow-x-auto max-h-96 select-text">
            {JSON.stringify(
              outputDocs.map((d) => {
                if (!d || typeof d !== 'object') return d;
                const copy = { ...d };
                delete copy._vector;
                return copy;
              }),
              null,
              2
            )}
          </pre>
        )}
      </div>
    </div>
  );
};
