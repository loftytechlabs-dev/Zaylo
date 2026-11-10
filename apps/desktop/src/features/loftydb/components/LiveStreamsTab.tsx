import React, { useEffect, useState } from 'react';
import { Radio, Square, Trash2 } from 'lucide-react';
import {
  LOFTYDB_MEMORY_COLLECTION,
  type LoftyDbSubscriptionEvent,
} from '@local-ai/shared';
import { api } from '../../../api/client';
import { useAppStore } from '../../../stores/useAppStore';
import { stripDocumentMeta } from '../utils/loftyFormatters';

export const LiveStreamsTab: React.FC = () => {
  const { loftyDbStatus } = useAppStore();
  const isConnected = Boolean(loftyDbStatus?.connected);

  const [collections, setCollections] = useState<string[]>([]);
  const [collection, setCollection] = useState<string>(LOFTYDB_MEMORY_COLLECTION);
  const [filterJson, setFilterJson] = useState('{}');
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [events, setEvents] = useState<LoftyDbSubscriptionEvent[]>([]);

  useEffect(() => {
    if (!isConnected) return;
    void api.invoke('loftydb:list-collections', undefined).then((cols) => {
      const list = cols || [];
      setCollections(list);
      if (list.length > 0 && !list.includes(collection)) {
        setCollection(list[0]);
      }
    });
  }, [isConnected]);

  useEffect(() => {
    const unsub = api.on('loftydb:subscription-event', (ev) => {
      if (subscriptionId && ev.subscriptionId === subscriptionId) {
        setEvents((prev) => [ev, ...prev].slice(0, 100));
      }
    });
    return () => {
      unsub?.();
    };
  }, [subscriptionId]);

  useEffect(() => {
    return () => {
      if (subscriptionId) {
        void api.invoke('loftydb:unsubscribe', { subscriptionId }).catch(() => {});
      }
    };
  }, [subscriptionId]);

  const handleToggleSubscribe = async () => {
    if (subscriptionId) {
      await api.invoke('loftydb:unsubscribe', { subscriptionId });
      setSubscriptionId(null);
      return;
    }

    let parsedFilter: Record<string, unknown> = {};
    if (filterJson.trim()) {
      try {
        parsedFilter = JSON.parse(filterJson);
      } catch {
        alert('Filter query must be valid JSON.');
        return;
      }
    }

    const res = await api.invoke('loftydb:subscribe', {
      collection,
      filter: parsedFilter,
    });
    setSubscriptionId(res.subscriptionId);
  };

  if (!isConnected) {
    return (
      <div className="p-8 rounded-xl bg-zinc-50 dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] text-center text-xs text-zinc-500">
        Connect or start LoftyDB above to subscribe to live Server-Sent Events (SSE).
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-semibold text-[#111111] dark:text-[#F5F5F5]">
              Reactive SSE Collection Stream
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-[#A1A1AA]">
              Watch real-time insert, update, and delete mutations pushed directly from LoftyDB.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                subscriptionId
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-zinc-100 dark:bg-[#191919] text-zinc-500 border-[#eaeaea] dark:border-[#262626]'
              }`}
            >
              {subscriptionId ? 'STREAMING LIVE' : 'IDLE'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
          <select
            value={collection}
            disabled={Boolean(subscriptionId)}
            onChange={(e) => setCollection(e.target.value)}
            className="rounded-lg bg-zinc-50 dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] px-3 py-2 text-xs font-mono text-[#111111] dark:text-[#F5F5F5]"
          >
            {collections.length === 0 && <option value={LOFTYDB_MEMORY_COLLECTION}>{LOFTYDB_MEMORY_COLLECTION}</option>}
            {collections.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={filterJson}
            disabled={Boolean(subscriptionId)}
            onChange={(e) => setFilterJson(e.target.value)}
            placeholder='Filter e.g. {"importance": {"$gte": 4}}'
            className="md:col-span-2 rounded-lg bg-zinc-50 dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] px-3 py-2 text-xs font-mono text-[#111111] dark:text-[#F5F5F5]"
          />

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleSubscribe}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                subscriptionId
                  ? 'bg-rose-600 text-white hover:bg-rose-700'
                  : 'bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200'
              }`}
            >
              {subscriptionId ? <Square className="w-3.5 h-3.5 fill-current" /> : <Radio className="w-3.5 h-3.5" />}
              <span>{subscriptionId ? 'Disconnect' : 'Subscribe'}</span>
            </button>
            <button
              onClick={() => setEvents([])}
              className="p-2 rounded-lg border border-[#eaeaea] dark:border-[#262626] text-zinc-500 hover:text-black dark:hover:text-white"
              title="Clear event log"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Live Stream Log */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] space-y-2.5 max-h-[460px] overflow-y-auto">
        {events.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-500">
            {subscriptionId
              ? 'Connected. Waiting for mutations on this collection...'
              : 'Click Subscribe to start streaming live events.'}
          </div>
        ) : (
          events.map((ev, idx) => {
            const cleanDoc = ev.document ? stripDocumentMeta(ev.document) : undefined;
            return (
              <div
                key={idx}
                className="p-3 rounded-lg bg-zinc-50 dark:bg-[#0D0D0D] border border-[#eaeaea] dark:border-[#222222] space-y-1.5"
              >
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded uppercase text-[10px] font-semibold ${
                        ev.type === 'insert'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : ev.type === 'update'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : ev.type === 'delete' || ev.type === 'error'
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          : 'bg-zinc-200 dark:bg-[#202020] text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      {ev.type}
                    </span>
                    {ev.doc_id && <span className="text-[#111111] dark:text-[#F5F5F5]">{ev.doc_id}</span>}
                    {ev.message && <span className="text-zinc-500">{ev.message}</span>}
                  </div>
                  <span className="text-zinc-400">{new Date().toLocaleTimeString()}</span>
                </div>
                {cleanDoc && (
                  <pre className="text-[11px] font-mono text-zinc-600 dark:text-zinc-300 overflow-x-auto select-text">
                    {JSON.stringify(cleanDoc, null, 2)}
                  </pre>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
