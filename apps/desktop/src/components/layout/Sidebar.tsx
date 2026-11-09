import React, { useState } from 'react';
import {
  Play,
  Layers,
  Users,
  LayoutGrid,
  Plus,
  MessageSquare,
  CircleDot,
  Settings,
  PanelLeftClose,
  PanelLeft,
  MoreHorizontal,
  Trash2,
  Edit2,
  Check,
  X,
  LayoutDashboard,
  Server,
  Smartphone,
  Activity,
  Terminal,
  Gauge,
} from 'lucide-react';
import { useAppStore, NavTab } from '../../stores/useAppStore';

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    serverState,
    conversations,
    activeConvId,
    selectChat,
    createNewChat,
    deleteChat,
    renameChat,
    isSidebarCollapsed,
    toggleSidebar,
    installedModels,
  } = useAppStore();

  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const primaryNav: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
    { id: 'playground', label: 'Playground', icon: Play },
    { id: 'models', label: 'Models', icon: Layers, badge: installedModels.length },
    { id: 'personas', label: 'Personas', icon: Users },
    { id: 'forge', label: 'Library', icon: LayoutGrid },
  ];

  const secondaryNav: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'server', label: 'Server & API', icon: Server },
    { id: 'devices', label: 'Connected Devices', icon: Smartphone },
    { id: 'performance', label: 'Performance', icon: Activity },
    { id: 'logs', label: 'Terminal Logs', icon: Terminal },
    { id: 'benchmark', label: 'Hardware Benchmark', icon: Gauge },
  ];

  const handleStartRename = (e: React.MouseEvent, id: string, currentTitle: string) => {
    e.stopPropagation();
    setEditingChatId(id);
    setEditingTitle(currentTitle);
  };

  const handleSaveRename = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (editingTitle.trim()) {
      renameChat(id, editingTitle.trim());
    }
    setEditingChatId(null);
  };

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(null);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteChat(id);
  };

  return (
    <aside
      className={`bg-white dark:bg-[#0c0d10] border-r border-[#eaeaea] dark:border-[#202227] flex flex-col justify-between select-none shrink-0 h-screen transition-all duration-200 ${
        isSidebarCollapsed ? 'w-[68px]' : 'w-[280px]'
      }`}
    >
      <div className="flex flex-col min-h-0 flex-1">
        {/* macOS Traffic Lights Header & Drag Spacer */}
        <div className="h-7 shrink-0 w-full [-webkit-app-region:drag]" />

        {/* Brand Header */}
        <div className={`px-4 pb-3 pt-1 flex items-center justify-between ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}>
          <div
            onClick={() => setActiveTab('playground')}
            className="flex items-center gap-2.5 cursor-pointer group"
            title="Zaylo AI Studio"
          >
            {/* Z Logo Badge */}
            <div className="w-7 h-7 rounded-lg bg-black text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-sm shrink-0 transition-transform group-hover:scale-105">
              <span>Z</span>
            </div>

            {!isSidebarCollapsed && (
              <span className="font-semibold text-base text-[#111111] dark:text-[#f4f4f5] tracking-tight">
                Zaylo
              </span>
            )}
          </div>

          <button
            onClick={toggleSidebar}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? (
              <PanelLeft className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Primary Navigation */}
        <nav className="px-3 pt-2 space-y-1 shrink-0">
          {primaryNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsMoreOpen(false);
                }}
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3'
                } py-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-[#f5f5f5] dark:bg-[#1a1c22] text-[#111111] dark:text-[#f4f4f5]'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-[#fafafa] dark:hover:bg-[#14151a]'
                }`}
                title={item.label}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#111111] dark:text-[#f4f4f5]' : 'text-zinc-500'}`} />
                  {!isSidebarCollapsed && <span>{item.label}</span>}
                </div>
                {!isSidebarCollapsed && typeof item.badge === 'number' && item.badge > 0 && (
                  <span className="px-1.5 py-0.2 text-[10px] font-mono rounded bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Secondary Tools Menu Trigger */}
          <div className="relative">
            <button
              onClick={() => setIsMoreOpen(!isMoreOpen)}
              className={`w-full flex items-center ${
                isSidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3'
              } py-2 rounded-lg text-xs font-medium transition-colors ${
                secondaryNav.some((s) => s.id === activeTab)
                  ? 'bg-[#f5f5f5] dark:bg-[#1a1c22] text-[#111111] dark:text-[#f4f4f5]'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-[#fafafa] dark:hover:bg-[#14151a]'
              }`}
              title="More workspace tools"
            >
              <div className="flex items-center gap-2.5">
                <MoreHorizontal className="w-4 h-4 shrink-0 text-zinc-500" />
                {!isSidebarCollapsed && <span>More Tools</span>}
              </div>
            </button>

            {isMoreOpen && (
              <div className="absolute left-full ml-1.5 top-0 w-52 rounded-xl bg-white dark:bg-[#14161c] border border-[#eaeaea] dark:border-[#272932] shadow-xl py-1.5 z-50 text-xs">
                <div className="px-3 py-1 text-[10px] font-mono text-zinc-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800">
                  Workspace Tools
                </div>
                {secondaryNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsMoreOpen(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left flex items-center gap-2.5 transition-colors ${
                        isActive
                          ? 'bg-[#f5f5f5] dark:bg-[#1e2028] text-[#111111] dark:text-[#f4f4f5] font-semibold'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1c24]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Divider */}
        {!isSidebarCollapsed && (
          <div className="border-t border-[#eaeaea] dark:border-[#202227] mx-3 my-3" />
        )}

        {/* Chats History Section */}
        {!isSidebarCollapsed && (
          <div className="flex-1 flex flex-col min-h-0 px-3">
            <div className="flex items-center justify-between pb-1.5 px-2">
              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                Chats
              </span>
              <button
                onClick={() => createNewChat()}
                className="p-1 rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title="New Chat"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto space-y-0.5 pr-0.5 scrollbar-thin">
              {conversations.map((conv) => {
                const isActive = activeConvId === conv.id && activeTab === 'playground';
                const isEditing = editingChatId === conv.id;

                if (isEditing) {
                  return (
                    <div
                      key={conv.id}
                      className="px-2 py-1 rounded-lg bg-[#f5f5f5] dark:bg-[#1a1c22] flex items-center gap-1.5 text-xs"
                    >
                      <input
                        type="text"
                        autoFocus
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(e as any, conv.id);
                          if (e.key === 'Escape') handleCancelRename(e as any);
                        }}
                        className="flex-1 bg-transparent border-none text-xs text-[#111111] dark:text-[#f4f4f5] focus:outline-none"
                      />
                      <button
                        onClick={(e) => handleSaveRename(e, conv.id)}
                        className="p-0.5 text-emerald-600 hover:text-emerald-700"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={handleCancelRename}
                        className="p-0.5 text-zinc-400 hover:text-zinc-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={conv.id}
                    onClick={() => selectChat(conv.id)}
                    className={`w-full group px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-[#f5f5f5] dark:bg-[#1a1c22] text-[#111111] dark:text-[#f4f4f5] font-medium'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-[#fafafa] dark:hover:bg-[#14151a] hover:text-[#111111] dark:hover:text-[#f4f4f5]'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {isActive ? (
                        <MessageSquare className="w-3.5 h-3.5 shrink-0 text-[#111111] dark:text-[#f4f4f5]" />
                      ) : (
                        <CircleDot className="w-3.5 h-3.5 shrink-0 text-zinc-400 dark:text-zinc-500" />
                      )}
                      <span className="truncate">{conv.title || 'New Chat'}</span>
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 ml-1 transition-opacity">
                      <button
                        onClick={(e) => handleStartRename(e, conv.id, conv.title)}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-700"
                        title="Rename chat"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, conv.id)}
                        className="p-1 rounded text-zinc-400 hover:text-rose-600 hover:bg-zinc-200/60 dark:hover:bg-zinc-700"
                        title="Delete chat"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="border-t border-[#eaeaea] dark:border-[#202227] p-3 flex items-center justify-between select-none shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              serverState === 'RUNNING'
                ? 'bg-emerald-500 animate-pulse'
                : serverState === 'STARTING'
                ? 'bg-amber-400 animate-pulse'
                : 'bg-zinc-400'
            }`}
          />
          {!isSidebarCollapsed && (
            <span className="text-xs text-zinc-700 dark:text-zinc-300 font-medium truncate">
              Local AI Engine
            </span>
          )}
        </div>

        <button
          onClick={() => setActiveTab('settings')}
          className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          title="Settings & Appearance"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
