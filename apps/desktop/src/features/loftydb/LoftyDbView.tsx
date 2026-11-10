import React, { useEffect, useState } from 'react';
import {
  Brain,
  Database,
  Play,
  Square,
  RefreshCw,
  MessageSquare,
  Network,
  Wrench,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { MemoryGraphExplorer } from './components/MemoryGraphExplorer';
import { MemoryStudioTab } from './components/MemoryStudioTab';
import { ConversationsMemoryTab } from './components/ConversationsMemoryTab';
import { DatabaseWorkbenchTab } from './components/DatabaseWorkbenchTab';
import { formatBytes } from './utils/loftyFormatters';

type LoftyDbSubTab = 'graph' | 'memories' | 'conversations' | 'workbench';

export const LoftyDbView: React.FC = () => {
  const {
    loftyDbStatus,
    memories,
    conversations,
    fetchLoftyDbState,
    startLoftyDb,
    stopLoftyDb,
    fetchMemories,
    selectChat,
  } = useAppStore();

  const [subTab, setSubTab] = useState<LoftyDbSubTab>('graph');
  const [busyAction, setBusyAction] = useState(false);

  useEffect(() => {
    void fetchLoftyDbState();
  }, [fetchLoftyDbState]);

  const isConnected = Boolean(loftyDbStatus?.connected);
  const stats = loftyDbStatus?.stats;

  const handleToggleEngine = async () => {
    setBusyAction(true);
    try {
      if (loftyDbStatus?.runningManaged || isConnected) {
        await stopLoftyDb();
      } else {
        await startLoftyDb();
      }
    } catch (err: any) {
      alert(`LoftyDB action failed: ${err?.message || err}`);
    } finally {
      setBusyAction(false);
    }
  };

  const handleRefresh = async () => {
    setBusyAction(true);
    try {
      await fetchLoftyDbState();
      await fetchMemories();
    } finally {
      setBusyAction(false);
    }
  };

  const tabs: {
    id: LoftyDbSubTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'graph', label: 'Knowledge Graph', icon: Network },
    { id: 'memories', label: `Memories (${memories.length})`, icon: Brain },
    { id: 'conversations', label: `Conversations (${conversations.length})`, icon: MessageSquare },
    { id: 'workbench', label: 'DB Workbench', icon: Wrench },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-3.5 max-w-[1600px] mx-auto overflow-y-auto h-[calc(100vh-4rem)] select-none">
      {/* Compact Infrastructure Header + Navigation Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#111111] dark:text-[#F5F5F5]" />
            <h2 className="text-sm font-bold tracking-tight text-[#111111] dark:text-[#F5F5F5]">
              LoftyDB Memory Infrastructure
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                isConnected
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-zinc-100 dark:bg-[#191919] text-zinc-500 dark:text-[#A1A1AA] border-[#eaeaea] dark:border-[#262626]'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-zinc-400'}`}
              />
              <span>{isConnected ? 'CONNECTED' : 'OFFLINE'}</span>
            </span>
          </div>

          <div className="hidden xl:flex items-center gap-2 pl-2 border-l border-[#eaeaea] dark:border-[#262626] text-[11px] font-mono text-zinc-500 dark:text-[#A1A1AA]">
            <span>{stats?.col_count ?? 0} cols</span>
            <span>·</span>
            <span>{stats?.tx_count ?? 0} tx</span>
            <span>·</span>
            <span>{formatBytes(stats?.total_size ?? 0)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Sub-View Switcher */}
          <div className="flex flex-wrap items-center gap-1 mr-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = subTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSubTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    active
                      ? 'bg-black dark:bg-white text-white dark:text-black shadow-xs'
                      : 'bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] text-zinc-600 dark:text-[#A1A1AA] hover:border-zinc-400 hover:text-[#111111] dark:hover:text-[#F5F5F5]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleRefresh}
            disabled={busyAction}
            className="p-1.5 rounded-lg border border-[#eaeaea] dark:border-[#262626] bg-white dark:bg-[#141414] text-zinc-600 dark:text-[#A1A1AA] hover:text-black dark:hover:text-white transition-colors"
            title="Refresh LoftyDB status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${busyAction ? 'animate-spin' : ''}`} />
          </button>

          {loftyDbStatus?.runningManaged ? (
            <button
              onClick={handleToggleEngine}
              disabled={busyAction}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 hover:bg-rose-100 disabled:opacity-50"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Stop</span>
            </button>
          ) : isConnected ? (
            <span className="px-2 py-1 rounded-lg text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              External
            </span>
          ) : (
            <button
              onClick={handleToggleEngine}
              disabled={busyAction}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-50"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Start LoftyDB</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Workspace */}
      <div>
        {subTab === 'graph' && (
          <MemoryGraphExplorer
            onOpenSourceConversation={(convId) => {
              selectChat(convId);
            }}
          />
        )}
        {subTab === 'memories' && <MemoryStudioTab />}
        {subTab === 'conversations' && <ConversationsMemoryTab />}
        {subTab === 'workbench' && <DatabaseWorkbenchTab />}
      </div>
    </div>
  );
};
