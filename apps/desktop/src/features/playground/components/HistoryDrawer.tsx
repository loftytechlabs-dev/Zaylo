import React, { useState } from 'react';
import {
  History,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  MessageSquare,
} from 'lucide-react';
import type { PlaygroundConversation } from '../types';

interface HistoryDrawerProps {
  conversations: PlaygroundConversation[];
  activeId: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onRename: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onRename,
  onDelete,
  onClose,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const startRename = (conv: PlaygroundConversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const saveRename = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      onRename(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const cancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleDelete = (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete conversation "${title}"? This cannot be undone.`)) {
      onDelete(id);
    }
  };

  return (
    <aside className="w-80 border-l border-[#eaeaea] dark:border-[#202227] bg-white dark:bg-[#0c0d10] p-5 space-y-4 select-none overflow-y-auto shrink-0 z-20 flex flex-col justify-between">
      <div className="space-y-4 flex-1">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#eaeaea] dark:border-[#1f2228] pb-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#111111] dark:text-zinc-200">
            <History className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
            <span>Chat History</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-[#1a1d25] transition-colors"
            title="Close History Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* New Chat Button */}
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black font-medium text-xs shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Conversation</span>
        </button>

        {/* Conversations List */}
        <div className="space-y-1.5 pt-1">
          {conversations.length === 0 ? (
            <div className="p-6 rounded-xl bg-zinc-50 dark:bg-[#12141a] border border-[#eaeaea] dark:border-[#20232c] text-center space-y-1.5 text-zinc-400">
              <MessageSquare className="w-6 h-6 mx-auto opacity-40" />
              <p className="text-xs">No saved conversations yet.</p>
              <p className="text-[10px]">Your chats will be automatically preserved here.</p>
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = conv.id === activeId;
              const isEditing = editingId === conv.id;

              return (
                <div
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer group space-y-1.5 ${
                    isActive
                      ? 'bg-zinc-100 dark:bg-[#151720] border-black dark:border-white text-[#111111] dark:text-zinc-100 shadow-xs'
                      : 'bg-white dark:bg-[#101217] border-[#eaeaea] dark:border-[#1d2028] hover:border-zinc-400 dark:hover:border-[#2a2e3a] text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    {isEditing ? (
                      <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="flex-1 bg-white dark:bg-[#1a1d26] border border-black dark:border-white rounded px-2 py-0.5 text-xs text-[#111111] dark:text-zinc-100 focus:outline-none"
                          autoFocus
                        />
                        <button
                          onClick={(e) => saveRename(conv.id, e)}
                          className="p-1 text-emerald-400 hover:text-emerald-300"
                          title="Save title"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={cancelRename}
                          className="p-1 text-zinc-400 hover:text-zinc-200"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs font-semibold truncate flex-1 mr-2 text-zinc-200 group-hover:text-white">
                          {conv.title}
                        </span>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => startRename(conv, e)}
                            className="p-1 rounded hover:bg-[#1f222d] text-zinc-400 hover:text-zinc-200 transition-colors"
                            title="Rename chat"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(conv.id, conv.title, e)}
                            className="p-1 rounded hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 transition-colors"
                            title="Delete chat"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Metadata Row */}
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                    <span className="truncate max-w-[140px]" title={conv.modelName}>
                      {conv.modelName}
                    </span>
                    <span>
                      {new Date(conv.updatedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
};
