import React from 'react';
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { SlideTextStyle } from '@local-ai/shared';

interface FloatingTextToolbarProps {
  position: { x: number; y: number };
  currentStyle?: SlideTextStyle;
  onUpdateStyle: (updates: Partial<SlideTextStyle>) => void;
  onAiRewrite?: () => void;
  onDelete?: () => void;
}

const COLOR_SWATCHES = [
  '#000000',
  '#FFFFFF',
  '#2563EB',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#64748B',
];

export const FloatingTextToolbar: React.FC<FloatingTextToolbarProps> = ({
  position,
  currentStyle = {},
  onUpdateStyle,
  onAiRewrite,
  onDelete,
}) => {
  const currentSize = currentStyle.fontSize || 16;

  return (
    <div
      className="absolute z-40 flex items-center gap-1 p-1 bg-white dark:bg-[#1C1C1E] border border-[#EAEAEA] dark:border-[#333333] rounded-xl shadow-xl text-xs text-[#111111] dark:text-[#F5F5F5] select-none transition-all duration-150 animate-in fade-in zoom-in-95"
      style={{
        left: `${position.x}px`,
        top: `${Math.max(10, position.y - 48)}px`,
        transform: 'translateX(-50%)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Font Size controls */}
      <div className="flex items-center gap-0.5 px-1 py-0.5 rounded-lg bg-zinc-100 dark:bg-[#2A2A2E]">
        <button
          type="button"
          onClick={() => onUpdateStyle({ fontSize: Math.max(10, currentSize - 2) })}
          className="px-1 text-[11px] font-mono hover:text-black dark:hover:text-white"
          title="Decrease font size"
        >
          -
        </button>
        <span className="text-[11px] font-mono font-medium px-1 min-w-[20px] text-center">
          {currentSize}
        </span>
        <button
          type="button"
          onClick={() => onUpdateStyle({ fontSize: Math.min(96, currentSize + 2) })}
          className="px-1 text-[11px] font-mono hover:text-black dark:hover:text-white"
          title="Increase font size"
        >
          +
        </button>
      </div>

      <div className="w-[1px] h-4 bg-zinc-200 dark:bg-[#333333] mx-0.5" />

      {/* Bold */}
      <button
        type="button"
        onClick={() => onUpdateStyle({ bold: !currentStyle.bold })}
        className={`p-1.5 rounded-lg transition-colors ${
          currentStyle.bold
            ? 'bg-zinc-200 dark:bg-[#3A3A3E] font-bold text-black dark:text-white'
            : 'hover:bg-zinc-100 dark:hover:bg-[#2A2A2E] text-zinc-600 dark:text-zinc-300'
        }`}
        title="Bold"
      >
        <Bold className="w-3.5 h-3.5" />
      </button>

      {/* Italic */}
      <button
        type="button"
        onClick={() => onUpdateStyle({ italic: !currentStyle.italic })}
        className={`p-1.5 rounded-lg transition-colors ${
          currentStyle.italic
            ? 'bg-zinc-200 dark:bg-[#3A3A3E] text-black dark:text-white'
            : 'hover:bg-zinc-100 dark:hover:bg-[#2A2A2E] text-zinc-600 dark:text-zinc-300'
        }`}
        title="Italic"
      >
        <Italic className="w-3.5 h-3.5" />
      </button>

      {/* Underline */}
      <button
        type="button"
        onClick={() => onUpdateStyle({ underline: !currentStyle.underline })}
        className={`p-1.5 rounded-lg transition-colors ${
          currentStyle.underline
            ? 'bg-zinc-200 dark:bg-[#3A3A3E] text-black dark:text-white'
            : 'hover:bg-zinc-100 dark:hover:bg-[#2A2A2E] text-zinc-600 dark:text-zinc-300'
        }`}
        title="Underline"
      >
        <Underline className="w-3.5 h-3.5" />
      </button>

      <div className="w-[1px] h-4 bg-zinc-200 dark:bg-[#333333] mx-0.5" />

      {/* Alignment */}
      <button
        type="button"
        onClick={() => onUpdateStyle({ align: 'left' })}
        className={`p-1.5 rounded-lg ${
          (currentStyle.align || 'left') === 'left'
            ? 'bg-zinc-200 dark:bg-[#3A3A3E] text-black dark:text-white'
            : 'hover:bg-zinc-100 dark:hover:bg-[#2A2A2E] text-zinc-600 dark:text-zinc-300'
        }`}
        title="Align Left"
      >
        <AlignLeft className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onUpdateStyle({ align: 'center' })}
        className={`p-1.5 rounded-lg ${
          currentStyle.align === 'center'
            ? 'bg-zinc-200 dark:bg-[#3A3A3E] text-black dark:text-white'
            : 'hover:bg-zinc-100 dark:hover:bg-[#2A2A2E] text-zinc-600 dark:text-zinc-300'
        }`}
        title="Align Center"
      >
        <AlignCenter className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onUpdateStyle({ align: 'right' })}
        className={`p-1.5 rounded-lg ${
          currentStyle.align === 'right'
            ? 'bg-zinc-200 dark:bg-[#3A3A3E] text-black dark:text-white'
            : 'hover:bg-zinc-100 dark:hover:bg-[#2A2A2E] text-zinc-600 dark:text-zinc-300'
        }`}
        title="Align Right"
      >
        <AlignRight className="w-3.5 h-3.5" />
      </button>

      <div className="w-[1px] h-4 bg-zinc-200 dark:bg-[#333333] mx-0.5" />

      {/* Quick Color Swatches */}
      <div className="flex items-center gap-1 px-1">
        {COLOR_SWATCHES.map((hex) => (
          <button
            key={hex}
            type="button"
            onClick={() => onUpdateStyle({ color: hex })}
            className="w-3.5 h-3.5 rounded-full border border-black/20 dark:border-white/20 hover:scale-125 transition-transform"
            style={{ backgroundColor: hex }}
            title={`Set color ${hex}`}
          />
        ))}
      </div>

      {onAiRewrite && (
        <>
          <div className="w-[1px] h-4 bg-zinc-200 dark:bg-[#333333] mx-0.5" />
          <button
            type="button"
            onClick={onAiRewrite}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-100 dark:bg-[#2A2A2E] hover:bg-zinc-200 dark:hover:bg-[#353539] text-[11px] font-medium text-black dark:text-white transition-colors"
            title="AI Polish & Rewrite"
          >
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>AI Polish</span>
          </button>
        </>
      )}

      {onDelete && (
        <>
          <div className="w-[1px] h-4 bg-zinc-200 dark:bg-[#333333] mx-0.5" />
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
            title="Delete element"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  );
};
