import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MessageSquare,
  Search,
  Wand2,
  ArrowUpRight,
  Trash2,
  Brain,
  Sparkles,
  X,
} from 'lucide-react';
import type { ChatMessage, StoredConversation } from '@local-ai/shared';
import { api } from '../../../api/client';
import { useAppStore } from '../../../stores/useAppStore';
import { NODE_CATEGORY_META } from '../graph/graphTypes';

function extractMessageText(content: ChatMessage['content']): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (part.type === 'text' ? part.text || '' : part.type === 'image_url' ? '[Image]' : ''))
      .filter(Boolean)
      .join(' ');
  }
  return '';
}

export const ConversationsMemoryTab: React.FC = () => {
  const {
    loftyDbStatus,
    memories,
    fetchMemories,
    selectChat,
    deleteChat,
    syncConversationsWithLoftyDb,
  } = useAppStore();

  const isConnected = Boolean(loftyDbStatus?.connected);

  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyExtract, setBusyExtract] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadConversations = useCallback(async (query?: string) => {
    if (!isConnected) return;
    setIsLoading(true);
    try {
      const list = query?.trim()
        ? await api.invoke('memory:search-conversations', { query: query.trim(), limit: 30 })
        : await api.invoke('memory:list-conversations', undefined);
      const safe = Array.isArray(list) ? list : [];
      setConversations(safe);
      setSelectedId((prev) => (prev && safe.some((c) => c.id === prev) ? prev : safe[0]?.id || null));
    } catch (err) {
      console.error('Failed to load LoftyDB conversations:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  const memoriesByConv = useMemo(() => {
    const map = new Map<string, typeof memories>();
    for (const m of memories) {
      if (!m.conversationId) continue;
      const list = map.get(m.conversationId) || [];
      list.push(m);
      map.set(m.conversationId, list);
    }
    return map;
  }, [memories]);

  const selectedConv = useMemo(
    () => conversations.find((c) => c.id === selectedId) || null,
    [conversations, selectedId]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void loadConversations(searchQuery);
  };

  const handleExtract = async (convId?: string) => {
    setBusyExtract(true);
    setNotice(null);
    try {
      const res = await api.invoke('memory:extract-from-conversations', { conversationId: convId });
      await fetchMemories();
      if (res.extracted.length > 0) {
        setNotice(
          `Extracted ${res.extracted.length} durable memor${res.extracted.length === 1 ? 'y' : 'ies'} into zaylo_memories.`
        );
      } else {
        setNotice(
          `Scanned ${res.scannedMessages} message(s) — no explicit facts or preferences matched ("Remember that...", "I prefer...", "My project...").`
        );
      }
    } finally {
      setBusyExtract(false);
    }
  };

  const handleDelete = async (conv: StoredConversation) => {
    if (!confirm(`Delete "${conv.title}" from Playground & LoftyDB?`)) return;
    await api.invoke('memory:delete-conversation', { id: conv.id });
    deleteChat(conv.id);
    await syncConversationsWithLoftyDb();
    await loadConversations(searchQuery);
  };

  if (!isConnected) {
    return (
      <div className="p-10 rounded-2xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] text-center space-y-2">
        <MessageSquare className="w-8 h-8 mx-auto text-zinc-400" />
        <p className="text-sm font-semibold text-[#111111] dark:text-[#F5F5F5]">LoftyDB Offline</p>
        <p className="text-xs text-zinc-500 dark:text-[#A1A1AA]">
          Start LoftyDB above to browse and search persisted Playground conversations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Clean Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2 max-w-xl">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (!e.target.value.trim()) void loadConversations('');
              }}
              placeholder="Semantic vector search across stored chats..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] text-xs text-[#111111] dark:text-[#F5F5F5] focus:outline-none focus:border-black dark:focus:border-white"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="px-3.5 py-2 rounded-lg bg-black dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-black text-xs font-medium transition-colors"
          >
            {isLoading ? 'Searching...' : 'Search'}
          </button>
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                void loadConversations('');
              }}
              className="px-2.5 py-2 rounded-lg border border-[#eaeaea] dark:border-[#262626] text-xs text-zinc-500"
            >
              Clear
            </button>
          )}
        </form>

        <button
          type="button"
          onClick={() => handleExtract(undefined)}
          disabled={busyExtract || conversations.length === 0}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#eaeaea] dark:border-[#262626] bg-white dark:bg-[#141414] hover:border-black dark:hover:border-white text-xs font-medium text-[#111111] dark:text-[#F5F5F5] transition-colors disabled:opacity-50"
        >
          <Wand2 className="w-3.5 h-3.5" />
          <span>{busyExtract ? 'Scanning Chats...' : 'Extract Memories from All Chats'}</span>
        </button>
      </div>

      {notice && (
        <div className="px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] flex items-center justify-between text-xs text-[#111111] dark:text-[#F5F5F5]">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-zinc-400 hover:text-black dark:hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {conversations.length === 0 ? (
        <div className="p-10 rounded-2xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] text-center space-y-2">
          <Sparkles className="w-7 h-7 mx-auto text-zinc-400" />
          <p className="text-xs font-semibold text-[#111111] dark:text-[#F5F5F5]">
            {searchQuery ? 'No conversations match that semantic query.' : 'No conversations stored in LoftyDB yet.'}
          </p>
          <p className="text-[11px] text-zinc-500 dark:text-[#A1A1AA]">
            Chats you run in Playground sync automatically into <code className="font-mono">zaylo_conversations</code>.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Master List */}
          <div className="lg:col-span-5 space-y-2 max-h-[540px] overflow-y-auto pr-1">
            {conversations.map((conv) => {
              const linkedCount = memoriesByConv.get(conv.id)?.length || 0;
              const active = conv.id === selectedId;
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => setSelectedId(conv.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-colors space-y-1.5 ${
                    active
                      ? 'bg-zinc-50 dark:bg-[#1a1a1a] border-black dark:border-white'
                      : 'bg-white dark:bg-[#141414] border-[#eaeaea] dark:border-[#262626] hover:border-zinc-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-[#111111] dark:text-[#F5F5F5] line-clamp-1">
                      {conv.title || 'New Chat'}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                      {new Date(conv.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-zinc-500 dark:text-[#A1A1AA]">
                    <span>{conv.messages.length} msgs</span>
                    {conv.modelName && <span>· {conv.modelName}</span>}
                    {linkedCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                        {linkedCount} memor{linkedCount === 1 ? 'y' : 'ies'}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Conversation Transcript & Linked Memories */}
          <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] flex flex-col max-h-[540px] overflow-hidden">
            {selectedConv ? (
              <>
                <div className="p-4 border-b border-[#eaeaea] dark:border-[#262626] flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[#111111] dark:text-[#F5F5F5] truncate">
                      {selectedConv.title || 'New Chat'}
                    </h3>
                    <div className="text-[11px] font-mono text-zinc-500 dark:text-[#737373]">
                      ID: {selectedConv.id} · {selectedConv.messages.length} messages
                      {selectedConv.version ? ` · v${selectedConv.version}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleExtract(selectedConv.id)}
                      disabled={busyExtract}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#eaeaea] dark:border-[#262626] text-xs font-medium text-[#111111] dark:text-[#F5F5F5] hover:border-black dark:hover:border-white transition-colors"
                      title="Scan this chat for remember/prefer/project facts"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      <span>Extract</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => selectChat(selectedConv.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-black dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-black text-xs font-medium transition-colors"
                    >
                      <span>Open in Chat</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(selectedConv)}
                      className="p-1.5 rounded-lg border border-[#eaeaea] dark:border-[#262626] text-zinc-400 hover:text-rose-500 transition-colors"
                      title="Delete conversation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Linked Memories Banner if any */}
                {(memoriesByConv.get(selectedConv.id)?.length || 0) > 0 && (
                  <div className="px-4 py-2.5 bg-zinc-50 dark:bg-[#191919] border-b border-[#eaeaea] dark:border-[#262626] space-y-1.5">
                    <div className="text-[10px] font-mono uppercase text-zinc-500 flex items-center gap-1">
                      <Brain className="w-3 h-3" />
                      <span>Distilled Memories Linked to This Chat</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(memoriesByConv.get(selectedConv.id) || []).map((mem) => {
                        const meta = NODE_CATEGORY_META[mem.category] || NODE_CATEGORY_META.fact;
                        return (
                          <span
                            key={mem.id}
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] border ${meta.badgeClass}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
                            <span className="truncate max-w-xs">{mem.content}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Clean Message Reader */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {selectedConv.messages.length === 0 ? (
                    <div className="text-xs text-zinc-400 text-center py-10">
                      This conversation thread has no messages yet.
                    </div>
                  ) : (
                    selectedConv.messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl text-xs leading-relaxed border select-text ${
                          msg.role === 'user'
                            ? 'bg-zinc-50 dark:bg-[#191919] border-[#eaeaea] dark:border-[#262626]'
                            : 'bg-white dark:bg-[#111111] border-[#eaeaea] dark:border-[#222222]'
                        }`}
                      >
                        <div className="text-[10px] font-mono uppercase text-zinc-400 mb-1">
                          {msg.role}
                        </div>
                        <div className="text-[#111111] dark:text-[#F5F5F5] whitespace-pre-wrap break-words">
                          {extractMessageText(msg.content) || '[Empty]'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-xs text-zinc-400">
                Select a conversation on the left to inspect its transcript and linked memories.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
