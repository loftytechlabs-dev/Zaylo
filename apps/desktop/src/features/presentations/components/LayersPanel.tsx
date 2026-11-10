import React from 'react';
import {
  Layers,
  Type,
  Square,
  Image as ImageIcon,
  BarChart2,
  Table as TableIcon,
  Star,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ChevronUp,
  ChevronDown,
  Trash2,
} from 'lucide-react';
import type { SlideSpec, SlideVisualElement } from '@local-ai/shared';
import type { SelectionTarget } from '../types';

interface LayersPanelProps {
  slide: SlideSpec;
  selection: SelectionTarget;
  onSelect: (target: SelectionTarget) => void;
  onUpdateElement: (elId: string, updates: Partial<SlideVisualElement>) => void;
  onDeleteElement: (elId: string) => void;
  onReorderElement: (elId: string, direction: 'up' | 'down') => void;
}

export const LayersPanel: React.FC<LayersPanelProps> = ({
  slide,
  selection,
  onSelect,
  onUpdateElement,
  onDeleteElement,
  onReorderElement,
}) => {
  const customElements = slide.customElements || [];

  const getElementIcon = (type: string) => {
    switch (type) {
      case 'text':
        return <Type className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />;
      case 'shape':
        return <Square className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />;
      case 'image':
        return <ImageIcon className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />;
      case 'chart':
        return <BarChart2 className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />;
      case 'table':
        return <TableIcon className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />;
      case 'icon':
        return <Star className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />;
      default:
        return <Layers className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  const totalItems = customElements.length + (slide.title ? 1 : 0) + (slide.subtitle ? 1 : 0);

  return (
    <div className="flex flex-col h-full text-xs select-none">
      <div className="h-10 px-4 border-b border-[#E5E7EB] dark:border-[#292929] flex items-center justify-between shrink-0 bg-zinc-50/50 dark:bg-[#141414]">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-zinc-500" />
          <span className="font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider text-[11px]">
            Slide Layers
          </span>
        </div>
        <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 font-medium">
          {totalItems} items
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* Built-in Structural Layers */}
        {slide.title && (
          <div
            onClick={() => onSelect({ type: 'title' })}
            className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              selection.type === 'title'
                ? 'bg-black text-white dark:bg-white dark:text-black font-medium shadow-xs'
                : 'hover:bg-zinc-100 dark:hover:bg-[#1E1E1E] text-zinc-700 dark:text-zinc-300'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <Type className="w-3.5 h-3.5 opacity-70" />
              <span className="truncate">Title: {slide.title}</span>
            </div>
            <span className="text-[9px] font-mono opacity-60 uppercase">Base</span>
          </div>
        )}

        {slide.subtitle && (
          <div
            onClick={() => onSelect({ type: 'subtitle' })}
            className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              selection.type === 'subtitle'
                ? 'bg-black text-white dark:bg-white dark:text-black font-medium shadow-xs'
                : 'hover:bg-zinc-100 dark:hover:bg-[#1E1E1E] text-zinc-700 dark:text-zinc-300'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <Type className="w-3.5 h-3.5 opacity-70" />
              <span className="truncate">Subtitle: {slide.subtitle}</span>
            </div>
            <span className="text-[9px] font-mono opacity-60 uppercase">Base</span>
          </div>
        )}

        {/* Custom Visual Elements */}
        {customElements.map((el, idx) => {
          const isSelected = selection.type === 'custom' && selection.elementId === el.id;

          return (
            <div
              key={el.id}
              onClick={() => onSelect({ type: 'custom', elementId: el.id })}
              className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-black text-white dark:bg-white dark:text-black font-medium shadow-xs'
                  : 'hover:bg-zinc-100 dark:hover:bg-[#1E1E1E] text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <div className="flex items-center gap-2 truncate flex-1 mr-2">
                {getElementIcon(el.type)}
                <span className="truncate font-mono text-[11px]">
                  {el.name || `${el.type} ${idx + 1}`}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 opacity-75 group-hover:opacity-100">
                {/* Lock / Unlock */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateElement(el.id, { locked: !el.locked });
                  }}
                  className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  title={el.locked ? 'Unlock element' : 'Lock element'}
                >
                  {el.locked ? (
                    <Lock className="w-3 h-3 text-amber-500" />
                  ) : (
                    <Unlock className="w-3 h-3 opacity-60" />
                  )}
                </button>

                {/* Hide / Show */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateElement(el.id, { hidden: !el.hidden });
                  }}
                  className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  title={el.hidden ? 'Show element' : 'Hide element'}
                >
                  {el.hidden ? (
                    <EyeOff className="w-3 h-3 text-zinc-400" />
                  ) : (
                    <Eye className="w-3 h-3 opacity-60" />
                  )}
                </button>

                {/* Reorder Up */}
                {idx > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReorderElement(el.id, 'up');
                    }}
                    className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                    title="Bring forward"
                  >
                    <ChevronUp className="w-3 h-3 opacity-60" />
                  </button>
                )}

                {/* Reorder Down */}
                {idx < customElements.length - 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReorderElement(el.id, 'down');
                    }}
                    className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                    title="Send backward"
                  >
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>
                )}

                {/* Delete */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteElement(el.id);
                  }}
                  className="p-1 rounded hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                  title="Delete layer"
                >
                  <Trash2 className="w-3 h-3 opacity-60" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
