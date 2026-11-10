import React from 'react';
import {
  Trash2,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  BarChart2,
  Table as TableIcon,
  Image as ImageIcon,
  Square,
  Type,
  Sliders,
} from 'lucide-react';
import type {
  SlideSpec,
  SlideVisualElement,
  SlideLayoutType,
  PresentationThemeName,
} from '@local-ai/shared';
import type { SelectionTarget } from '../types';

interface ContextualInspectorProps {
  slide: SlideSpec;
  selection: SelectionTarget;
  themeName?: PresentationThemeName;
  onUpdateSlide: (updates: Partial<SlideSpec>) => void;
  onUpdateElement: (elId: string, updates: Partial<SlideVisualElement>) => void;
  onDeleteElement: (elId: string) => void;
  onOpenChartStudio?: (chartEl: SlideVisualElement) => void;
}

const ALL_LAYOUTS: { type: SlideLayoutType; label: string }[] = [
  { type: 'title', label: 'Title Slide' },
  { type: 'executive-summary', label: 'Executive Summary' },
  { type: 'agenda', label: 'Agenda / TOC' },
  { type: 'columns-3', label: '3-Column Cards' },
  { type: 'columns-2', label: '2-Column Cards' },
  { type: 'columns-4', label: '4-Column Cards' },
  { type: 'metrics-stats', label: 'KPI & Metrics' },
  { type: 'architecture-flow', label: 'Architecture' },
  { type: 'timeline-roadmap', label: 'Timeline / Roadmap' },
  { type: 'process-steps', label: 'Process Steps' },
  { type: 'swot', label: 'SWOT Analysis' },
  { type: 'chart-data', label: 'Data & Chart' },
  { type: 'quote', label: 'Quote / Callout' },
  { type: 'conclusion', label: 'Next Steps' },
];

export const ContextualInspector: React.FC<ContextualInspectorProps> = ({
  slide,
  selection,
  onUpdateSlide,
  onUpdateElement,
  onDeleteElement,
  onOpenChartStudio,
}) => {
  const customElements = slide.customElements || [];
  const selectedElement =
    selection.type === 'custom'
      ? customElements.find((e) => e.id === selection.elementId)
      : undefined;

  // 1. SLIDE-LEVEL INSPECTOR (When nothing or slide is selected)
  if (selection.type === 'none' || selection.type === 'slide') {
    return (
      <div className="flex flex-col h-full text-xs select-none">
        <div className="h-10 px-4 border-b border-[#E5E7EB] dark:border-[#292929] flex items-center justify-between shrink-0 bg-zinc-50/50 dark:bg-[#141414]">
          <span className="font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5" />
            Slide Settings
          </span>
          <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase">
            {slide.layout}
          </span>
        </div>

        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {/* Layout Switcher */}
          <div>
            <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
              Slide Layout
            </label>
            <select
              value={slide.layout}
              onChange={(e) => onUpdateSlide({ layout: e.target.value as SlideLayoutType })}
              className="w-full h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#191919] text-zinc-900 dark:text-zinc-100 text-xs focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition-all"
            >
              {ALL_LAYOUTS.map((lo) => (
                <option key={lo.type} value={lo.type}>
                  {lo.label}
                </option>
              ))}
            </select>
          </div>

          {/* Background Color */}
          <div>
            <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
              Slide Background
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={slide.backgroundColor || '#FFFFFF'}
                onChange={(e) => onUpdateSlide({ backgroundColor: e.target.value })}
                className="w-8 h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 cursor-pointer p-0.5 bg-white dark:bg-[#191919]"
              />
              <input
                type="text"
                value={slide.backgroundColor || '#FFFFFF'}
                onChange={(e) => onUpdateSlide({ backgroundColor: e.target.value })}
                className="flex-1 h-8 px-2.5 rounded-lg font-mono text-xs border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#191919] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                placeholder="#FFFFFF"
              />
            </div>
          </div>

          {/* Title & Subtitle Direct inputs */}
          <div className="space-y-3 pt-3 border-t border-[#E5E7EB] dark:border-[#292929]">
            <div>
              <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                Slide Title
              </label>
              <input
                type="text"
                value={slide.title}
                onChange={(e) => onUpdateSlide({ title: e.target.value })}
                className="w-full h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#191919] text-zinc-900 dark:text-zinc-100 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                placeholder="Slide Title"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                Subtitle
              </label>
              <textarea
                rows={2}
                value={slide.subtitle || ''}
                onChange={(e) => onUpdateSlide({ subtitle: e.target.value })}
                className="w-full p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#191919] text-zinc-900 dark:text-zinc-100 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                placeholder="Optional subtitle context..."
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                Kicker Badge
              </label>
              <input
                type="text"
                value={slide.kicker || ''}
                onChange={(e) => onUpdateSlide({ kicker: e.target.value })}
                className="w-full h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#191919] text-zinc-900 dark:text-zinc-100 text-xs focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                placeholder="e.g. STRATEGIC OVERVIEW"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                Footer Text
              </label>
              <input
                type="text"
                value={slide.footerText || ''}
                onChange={(e) => onUpdateSlide({ footerText: e.target.value })}
                className="w-full h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#191919] text-zinc-900 dark:text-zinc-100 text-xs focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                placeholder="Confidential • Zaylo Presentation"
              />
            </div>
          </div>

          {/* Speaker Notes */}
          <div className="pt-3 border-t border-[#E5E7EB] dark:border-[#292929]">
            <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
              Speaker Notes
            </label>
            <textarea
              rows={4}
              value={slide.notes || ''}
              onChange={(e) => onUpdateSlide({ notes: e.target.value })}
              placeholder="Private presenter notes for this slide..."
              className="w-full p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#191919] text-zinc-900 dark:text-zinc-100 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white leading-relaxed"
            />
          </div>
        </div>
      </div>
    );
  }

  // 2. CUSTOM ELEMENT INSPECTOR
  if (selectedElement) {
    const transform = selectedElement.transform;

    return (
      <div className="flex flex-col h-full text-xs select-none">
        <div className="h-10 px-4 border-b border-[#E5E7EB] dark:border-[#292929] flex items-center justify-between shrink-0 bg-zinc-50/50 dark:bg-[#141414]">
          <div className="flex items-center gap-2">
            {selectedElement.type === 'text' && <Type className="w-3.5 h-3.5 text-zinc-500" />}
            {selectedElement.type === 'shape' && <Square className="w-3.5 h-3.5 text-zinc-500" />}
            {selectedElement.type === 'chart' && <BarChart2 className="w-3.5 h-3.5 text-zinc-500" />}
            {selectedElement.type === 'table' && <TableIcon className="w-3.5 h-3.5 text-zinc-500" />}
            {selectedElement.type === 'image' && <ImageIcon className="w-3.5 h-3.5 text-zinc-500" />}
            <span className="font-semibold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider text-[11px]">
              {selectedElement.type} Properties
            </span>
          </div>
          <button
            type="button"
            onClick={() => onDeleteElement(selectedElement.id)}
            className="p-1 rounded-md text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Delete element (Backspace/Delete)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {/* Element Name */}
          <div>
            <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
              Layer Name
            </label>
            <input
              type="text"
              value={selectedElement.name || ''}
              onChange={(e) => onUpdateElement(selectedElement.id, { name: e.target.value })}
              className="w-full h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#191919] text-zinc-900 dark:text-zinc-100 text-xs focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
            />
          </div>

          {/* Position & Size 2x2 Grid */}
          <div>
            <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
              Geometry & Transform
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-zinc-400 uppercase font-mono mb-1">X (%)</label>
                <input
                  type="number"
                  value={Math.round(transform.x)}
                  onChange={(e) =>
                    onUpdateElement(selectedElement.id, {
                      transform: { ...transform, x: parseFloat(e.target.value) || 0 },
                    })
                  }
                  className="w-full h-8 px-2.5 rounded-lg font-mono text-xs border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#191919] text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 uppercase font-mono mb-1">Y (%)</label>
                <input
                  type="number"
                  value={Math.round(transform.y)}
                  onChange={(e) =>
                    onUpdateElement(selectedElement.id, {
                      transform: { ...transform, y: parseFloat(e.target.value) || 0 },
                    })
                  }
                  className="w-full h-8 px-2.5 rounded-lg font-mono text-xs border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#191919] text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 uppercase font-mono mb-1">Width (%)</label>
                <input
                  type="number"
                  value={Math.round(transform.width)}
                  onChange={(e) =>
                    onUpdateElement(selectedElement.id, {
                      transform: { ...transform, width: Math.max(5, parseFloat(e.target.value) || 10) },
                    })
                  }
                  className="w-full h-8 px-2.5 rounded-lg font-mono text-xs border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#191919] text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 uppercase font-mono mb-1">Height (%)</label>
                <input
                  type="number"
                  value={Math.round(transform.height)}
                  onChange={(e) =>
                    onUpdateElement(selectedElement.id, {
                      transform: { ...transform, height: Math.max(3, parseFloat(e.target.value) || 10) },
                    })
                  }
                  className="w-full h-8 px-2.5 rounded-lg font-mono text-xs border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#191919] text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>
          </div>

          {/* SPECIFIC TYPE CONTROLS */}
          {/* TEXT CONTROLS */}
          {selectedElement.type === 'text' && selectedElement.text && (
            <div className="space-y-3 pt-3 border-t border-[#E5E7EB] dark:border-[#292929]">
              <div>
                <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Content
                </label>
                <textarea
                  rows={3}
                  value={selectedElement.text.content}
                  onChange={(e) =>
                    onUpdateElement(selectedElement.id, {
                      text: { ...selectedElement.text!, content: e.target.value },
                    })
                  }
                  className="w-full p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#191919] text-zinc-900 dark:text-zinc-100 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                />
              </div>

              {/* Font styling tools */}
              <div>
                <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Typography Style
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateElement(selectedElement.id, {
                        text: {
                          ...selectedElement.text!,
                          style: {
                            ...selectedElement.text?.style,
                            bold: !selectedElement.text?.style?.bold,
                          },
                        },
                      })
                    }
                    className={`h-8 w-8 rounded-lg flex items-center justify-center border transition-colors ${
                      selectedElement.text.style?.bold
                        ? 'bg-black text-white dark:bg-white dark:text-black border-transparent'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                    title="Bold"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onUpdateElement(selectedElement.id, {
                        text: {
                          ...selectedElement.text!,
                          style: {
                            ...selectedElement.text?.style,
                            italic: !selectedElement.text?.style?.italic,
                          },
                        },
                      })
                    }
                    className={`h-8 w-8 rounded-lg flex items-center justify-center border transition-colors ${
                      selectedElement.text.style?.italic
                        ? 'bg-black text-white dark:bg-white dark:text-black border-transparent'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                    title="Italic"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onUpdateElement(selectedElement.id, {
                        text: {
                          ...selectedElement.text!,
                          style: {
                            ...selectedElement.text?.style,
                            underline: !selectedElement.text?.style?.underline,
                          },
                        },
                      })
                    }
                    className={`h-8 w-8 rounded-lg flex items-center justify-center border transition-colors ${
                      selectedElement.text.style?.underline
                        ? 'bg-black text-white dark:bg-white dark:text-black border-transparent'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                    title="Underline"
                  >
                    <Underline className="w-3.5 h-3.5" />
                  </button>

                  <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />

                  <button
                    type="button"
                    onClick={() =>
                      onUpdateElement(selectedElement.id, {
                        text: {
                          ...selectedElement.text!,
                          style: { ...selectedElement.text?.style, align: 'left' },
                        },
                      })
                    }
                    className={`h-8 w-8 rounded-lg flex items-center justify-center border transition-colors ${
                      (selectedElement.text.style?.align || 'left') === 'left'
                        ? 'bg-black text-white dark:bg-white dark:text-black border-transparent'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                    title="Align Left"
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onUpdateElement(selectedElement.id, {
                        text: {
                          ...selectedElement.text!,
                          style: { ...selectedElement.text?.style, align: 'center' },
                        },
                      })
                    }
                    className={`h-8 w-8 rounded-lg flex items-center justify-center border transition-colors ${
                      selectedElement.text.style?.align === 'center'
                        ? 'bg-black text-white dark:bg-white dark:text-black border-transparent'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                    title="Align Center"
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onUpdateElement(selectedElement.id, {
                        text: {
                          ...selectedElement.text!,
                          style: { ...selectedElement.text?.style, align: 'right' },
                        },
                      })
                    }
                    className={`h-8 w-8 rounded-lg flex items-center justify-center border transition-colors ${
                      selectedElement.text.style?.align === 'right'
                        ? 'bg-black text-white dark:bg-white dark:text-black border-transparent'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                    title="Align Right"
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Font Size & Color */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                    Font Size
                  </label>
                  <input
                    type="number"
                    value={selectedElement.text.style?.fontSize || 16}
                    onChange={(e) =>
                      onUpdateElement(selectedElement.id, {
                        text: {
                          ...selectedElement.text!,
                          style: {
                            ...selectedElement.text?.style,
                            fontSize: parseInt(e.target.value, 10) || 16,
                          },
                        },
                      })
                    }
                    className="w-full h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#191919] text-zinc-900 dark:text-zinc-100 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                    Color
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={selectedElement.text.style?.color || '#111111'}
                      onChange={(e) =>
                        onUpdateElement(selectedElement.id, {
                          text: {
                            ...selectedElement.text!,
                            style: { ...selectedElement.text?.style, color: e.target.value },
                          },
                        })
                      }
                      className="w-8 h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 cursor-pointer p-0.5 bg-white dark:bg-[#191919]"
                    />
                    <input
                      type="text"
                      value={selectedElement.text.style?.color || '#111111'}
                      onChange={(e) =>
                        onUpdateElement(selectedElement.id, {
                          text: {
                            ...selectedElement.text!,
                            style: { ...selectedElement.text?.style, color: e.target.value },
                          },
                        })
                      }
                      className="flex-1 h-8 px-2 font-mono text-[11px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#191919] text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SHAPE CONTROLS */}
          {selectedElement.type === 'shape' && selectedElement.shape && (
            <div className="space-y-3 pt-3 border-t border-[#E5E7EB] dark:border-[#292929]">
              <div>
                <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Shape Type
                </label>
                <select
                  value={selectedElement.shape.shapeType}
                  onChange={(e) =>
                    onUpdateElement(selectedElement.id, {
                      shape: { ...selectedElement.shape!, shapeType: e.target.value as any },
                    })
                  }
                  className="w-full h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#191919] text-zinc-900 dark:text-zinc-100 text-xs"
                >
                  <option value="rect">Rectangle</option>
                  <option value="roundRect">Rounded Rectangle</option>
                  <option value="circle">Circle / Oval</option>
                  <option value="line">Divider Line</option>
                  <option value="arrow">Arrow</option>
                  <option value="callout">Callout Box</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Fill Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={selectedElement.shape.fillColor || '#E5E7EB'}
                    onChange={(e) =>
                      onUpdateElement(selectedElement.id, {
                        shape: { ...selectedElement.shape!, fillColor: e.target.value },
                      })
                    }
                    className="w-8 h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 cursor-pointer p-0.5 bg-white dark:bg-[#191919]"
                  />
                  <input
                    type="text"
                    value={selectedElement.shape.fillColor || '#E5E7EB'}
                    onChange={(e) =>
                      onUpdateElement(selectedElement.id, {
                        shape: { ...selectedElement.shape!, fillColor: e.target.value },
                      })
                    }
                    className="flex-1 h-8 px-2.5 font-mono text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#191919] text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Border Color & Width
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={selectedElement.shape.borderColor || '#000000'}
                    onChange={(e) =>
                      onUpdateElement(selectedElement.id, {
                        shape: { ...selectedElement.shape!, borderColor: e.target.value },
                      })
                    }
                    className="w-8 h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 cursor-pointer p-0.5 bg-white dark:bg-[#191919]"
                  />
                  <input
                    type="number"
                    min="0"
                    max="16"
                    value={selectedElement.shape.borderWidth || 1}
                    onChange={(e) =>
                      onUpdateElement(selectedElement.id, {
                        shape: {
                          ...selectedElement.shape!,
                          borderWidth: parseInt(e.target.value, 10) || 0,
                        },
                      })
                    }
                    className="w-20 h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#191919] text-zinc-900 dark:text-zinc-100 font-mono text-xs"
                    placeholder="px"
                  />
                </div>
              </div>
            </div>
          )}

          {/* IMAGE CONTROLS */}
          {selectedElement.type === 'image' && selectedElement.image && (
            <div className="space-y-3 pt-3 border-t border-[#E5E7EB] dark:border-[#292929]">
              <div className="w-full aspect-video rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-[#191919]">
                <img
                  src={selectedElement.image.url}
                  alt={selectedElement.image.alt || 'Slide image'}
                  className="w-full h-full object-cover"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Fit Mode
                </label>
                <select
                  value={selectedElement.image.fit || 'cover'}
                  onChange={(e) =>
                    onUpdateElement(selectedElement.id, {
                      image: { ...selectedElement.image!, fit: e.target.value as any },
                    })
                  }
                  className="w-full h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#191919] text-zinc-900 dark:text-zinc-100 text-xs"
                >
                  <option value="cover">Cover (Crop to Fit)</option>
                  <option value="contain">Contain (Full Aspect)</option>
                  <option value="fill">Fill (Stretch)</option>
                </select>
              </div>
            </div>
          )}

          {/* CHART CONTROLS */}
          {selectedElement.type === 'chart' && selectedElement.chart && (
            <div className="space-y-3 pt-3 border-t border-[#E5E7EB] dark:border-[#292929]">
              <div>
                <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Chart Title
                </label>
                <input
                  type="text"
                  value={selectedElement.chart.title}
                  onChange={(e) =>
                    onUpdateElement(selectedElement.id, {
                      chart: { ...selectedElement.chart!, title: e.target.value },
                    })
                  }
                  className="w-full h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#191919] text-zinc-900 dark:text-zinc-100 text-xs"
                />
              </div>

              <button
                type="button"
                onClick={() => onOpenChartStudio?.(selectedElement)}
                className="w-full h-9 rounded-lg bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 font-medium text-xs transition-colors flex items-center justify-center gap-2 shadow-xs"
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Open Chart Studio</span>
              </button>
            </div>
          )}

          {/* TABLE CONTROLS */}
          {selectedElement.type === 'table' && selectedElement.table && (
            <div className="space-y-3 pt-3 border-t border-[#E5E7EB] dark:border-[#292929]">
              <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
                Table Structure
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const table = selectedElement.table!;
                    const newRow = table.headers ? table.headers.map(() => 'Item') : ['A', 'B'];
                    onUpdateElement(selectedElement.id, {
                      table: { ...table, rows: [...table.rows, newRow] },
                    });
                  }}
                  className="flex-1 h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#191919] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-200 transition-colors"
                >
                  + Add Row
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const table = selectedElement.table!;
                    if (table.rows.length <= 1) return;
                    onUpdateElement(selectedElement.id, {
                      table: { ...table, rows: table.rows.slice(0, -1) },
                    });
                  }}
                  className="flex-1 h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#191919] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-200 transition-colors"
                >
                  - Remove Row
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};
