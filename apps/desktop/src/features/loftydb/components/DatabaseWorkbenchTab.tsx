import React, { useState } from 'react';
import { FolderOpen, Search, Radio, Settings } from 'lucide-react';
import { CollectionsExplorerTab } from './CollectionsExplorerTab';
import { QueryStudioTab } from './QueryStudioTab';
import { LiveStreamsTab } from './LiveStreamsTab';
import { EngineSettingsTab } from './EngineSettingsTab';

type WorkbenchTool = 'explorer' | 'query' | 'streams' | 'settings';

export const DatabaseWorkbenchTab: React.FC = () => {
  const [tool, setTool] = useState<WorkbenchTool>('explorer');

  const tools: {
    id: WorkbenchTool;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      id: 'explorer',
      label: 'Collections & Docs',
      description: 'Browse raw JSON documents, compact collections, and inspect document versions',
      icon: FolderOpen,
    },
    {
      id: 'query',
      label: 'SQL / NoSQL / Vector',
      description: 'Execute native LoftyDB SQL JOINs, JSON filters, or cosine vector queries',
      icon: Search,
    },
    {
      id: 'streams',
      label: 'Live Streams (SSE)',
      description: 'Watch real-time change events as memories and conversations mutate',
      icon: Radio,
    },
    {
      id: 'settings',
      label: 'Engine & Logs',
      description: 'Configure managed vs external LoftyDB engine port, recall parameters, and logs',
      icon: Settings,
    },
  ];

  const activeTool = tools.find((t) => t.id === tool)!;

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {tools.map((item) => {
            const Icon = item.icon;
            const active = tool === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTool(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  active
                    ? 'bg-black dark:bg-white text-white dark:text-black'
                    : 'text-zinc-600 dark:text-[#A1A1AA] hover:bg-zinc-100 dark:hover:bg-[#191919] hover:text-[#111111] dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <span className="text-[11px] text-zinc-500 dark:text-[#A1A1AA]">
          {activeTool.description}
        </span>
      </div>

      <div>
        {tool === 'explorer' && <CollectionsExplorerTab />}
        {tool === 'query' && <QueryStudioTab />}
        {tool === 'streams' && <LiveStreamsTab />}
        {tool === 'settings' && <EngineSettingsTab />}
      </div>
    </div>
  );
};
