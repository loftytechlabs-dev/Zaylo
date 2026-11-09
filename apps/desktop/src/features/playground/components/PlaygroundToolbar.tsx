import React from 'react';
import {
  Plus,
  History,
  Activity,
  Sliders,
  Scale,
  ChevronDown,
  RotateCw,
  Eye,
  Sparkles,
} from 'lucide-react';
import type { UnifiedModelOption } from '../types';
import type { ServerState, Persona } from '@local-ai/shared';
import { PlaygroundPersonaSelector } from '../../personas/components/PlaygroundPersonaSelector';

interface PlaygroundToolbarProps {
  models: UnifiedModelOption[];
  selectedModelId: string;
  onSelectModel: (id: string) => void;
  serverState: ServerState;
  isLoadingModel: boolean;
  isGeneratingImage?: boolean;
  onNewChat: () => void;
  onToggleHistory: () => void;
  onTogglePerformance: () => void;
  onToggleSettings: () => void;
  onToggleCompare: () => void;
  isHistoryOpen: boolean;
  isPerformanceOpen: boolean;
  isSettingsOpen: boolean;
  isCompareMode: boolean;
  conversationCount: number;
  activePersona?: Persona;
  personas?: Persona[];
  onSelectPersona?: (personaId: string) => void;
  onOpenPersonaManagement?: () => void;
  onCreatePersona?: () => void;
}

export const PlaygroundToolbar: React.FC<PlaygroundToolbarProps> = ({
  models,
  selectedModelId,
  onSelectModel,
  serverState,
  isLoadingModel,
  isGeneratingImage,
  onNewChat,
  onToggleHistory,
  onTogglePerformance,
  onToggleSettings,
  onToggleCompare,
  isHistoryOpen,
  isPerformanceOpen,
  isSettingsOpen,
  isCompareMode,
  conversationCount,
  activePersona,
  personas,
  onSelectPersona,
  onOpenPersonaManagement,
  onCreatePersona,
}) => {
  const selectedModel = models.find((m) => m.id === selectedModelId) || models[0];

  const getStatusBadge = () => {
    if (selectedModel?.isImageModel || selectedModel?.taskType === 'image-generation') {
      if (isGeneratingImage) {
        return (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span>GENERATING</span>
          </span>
        );
      }
      if (selectedModel.rawInstallation || selectedModel.localPath) {
        return (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>READY (ON-DEMAND)</span>
          </span>
        );
      }
      return (
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span>NOT DOWNLOADED</span>
        </span>
      );
    }

    if (isLoadingModel || serverState === 'STARTING') {
      return (
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/30">
          <RotateCw className="w-3 h-3 animate-spin" />
          <span>Loading...</span>
        </span>
      );
    }

    if (serverState === 'RUNNING') {
      return (
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>RUNNING</span>
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        <span>STOPPED</span>
      </span>
    );
  };

  return (
    <div className="h-14 border-b border-[#202227] px-4 sm:px-6 flex items-center justify-between gap-3 bg-[#0d0e12] select-none shrink-0 relative z-10">
      {/* Left: Title & Model Selector */}
      <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-bold text-zinc-100 tracking-tight">Playground</span>
        </div>

        {/* Model Selector Dropdown */}
        <div className="relative flex items-center min-w-0">
          <select
            value={selectedModelId}
            onChange={(e) => onSelectModel(e.target.value)}
            disabled={isLoadingModel}
            className="appearance-none pl-3 pr-8 py-1.5 rounded-lg bg-[#14161c] border border-[#262934] hover:border-[#383d4e] text-xs font-mono text-zinc-200 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer w-full max-w-[160px] sm:max-w-[210px] md:max-w-[260px] lg:max-w-[300px] truncate"
          >
            {models.length === 0 ? (
              <option value="">No models installed</option>
            ) : (
              models.map((m) => {
                let prefix = '📦 [Text]';
                if (m.isImageModel || m.taskType === 'image-generation') {
                  prefix = '🎨 [Image]';
                } else if (m.isVisionSupported || m.taskType === 'vision') {
                  prefix = '👁️ [Vision]';
                } else if (m.type === 'adapter') {
                  prefix = '⚡ [LoRA]';
                }
                return (
                  <option key={m.id} value={m.id}>
                    {prefix} {m.name}
                    {m.quantization ? ` (${m.quantization})` : ''}
                  </option>
                );
              })
            )}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute right-2.5 pointer-events-none shrink-0" />
        </div>

        {/* Compact Persona Selector for Text & Multimodal Chat */}
        {!selectedModel?.isImageModel && activePersona && personas && onSelectPersona && (
          <PlaygroundPersonaSelector
            activePersona={activePersona}
            personas={personas}
            onSelectPersona={onSelectPersona}
            onOpenManagement={onOpenPersonaManagement || (() => {})}
            onCreatePersona={onCreatePersona || (() => {})}
          />
        )}

        {/* Task / Capability pill */}
        {selectedModel?.isImageModel || selectedModel?.taskType === 'image-generation' ? (
          <span className="hidden md:flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0">
            <Sparkles className="w-3 h-3" />
            <span>IMAGE GEN</span>
          </span>
        ) : selectedModel?.isVisionSupported || selectedModel?.taskType === 'vision' ? (
          <span className="hidden md:flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-300 border border-blue-500/20 shrink-0">
            <Eye className="w-3 h-3" />
            <span>VISION</span>
          </span>
        ) : (
          <span className="hidden md:flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700/40 shrink-0">
            <span>TEXT</span>
          </span>
        )}

        {/* Status Badge */}
        <div className="shrink-0">
          {getStatusBadge()}
        </div>
      </div>

      {/* Right: Actions and Drawer Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2 text-xs shrink-0">
        {/* New Chat / Canvas Button */}
        <button
          onClick={onNewChat}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-sm transition-colors shrink-0"
          title={selectedModel?.isImageModel ? 'New Canvas' : 'New Chat'}
        >
          <Plus className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">{selectedModel?.isImageModel ? 'New Canvas' : 'New Chat'}</span>
        </button>

        {/* Compare Models Toggle (for text models) */}
        {!selectedModel?.isImageModel && (
          <button
            onClick={onToggleCompare}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors shrink-0 ${
              isCompareMode
                ? 'bg-blue-600/15 border-blue-500/40 text-blue-300'
                : 'bg-[#14161c] border-[#22252e] text-zinc-400 hover:text-zinc-200'
            }`}
            title="Compare Base Model vs. Fine-Tuned Model side-by-side"
          >
            <Scale className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden md:inline">Compare</span>
          </button>
        )}

        {/* History Drawer Toggle */}
        <button
          onClick={onToggleHistory}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors shrink-0 ${
            isHistoryOpen
              ? 'bg-blue-600/15 border-blue-500/40 text-blue-400'
              : 'bg-[#14161c] border-[#22252e] text-zinc-400 hover:text-zinc-200'
          }`}
          title="Conversation history"
        >
          <History className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden lg:inline">History</span>
          {conversationCount > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400">
              {conversationCount}
            </span>
          )}
        </button>

        {/* Performance Drawer Toggle */}
        <button
          onClick={onTogglePerformance}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors shrink-0 ${
            isPerformanceOpen
              ? 'bg-emerald-600/15 border-emerald-500/40 text-emerald-300'
              : 'bg-[#14161c] border-[#22252e] text-zinc-400 hover:text-zinc-200'
          }`}
          title="Live inference performance metrics"
        >
          <Activity className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden xl:inline">Performance</span>
        </button>

        {/* Settings Drawer Toggle */}
        <button
          onClick={onToggleSettings}
          className={`p-1.5 rounded-lg border transition-colors shrink-0 ${
            isSettingsOpen
              ? 'bg-[#22252e] text-blue-400 border-[#2f3342]'
              : 'bg-[#14161c] border-[#22252e] text-zinc-400 hover:text-zinc-200'
          }`}
          title="Generation settings"
        >
          <Sliders className="w-4 h-4 shrink-0" />
        </button>
      </div>
    </div>
  );
};
