import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Download,
  Plus,
  Trash2,
  Copy,
  ChevronDown,
  Check,
  Presentation,
  Printer,
  Undo2,
  Redo2,
  Sparkles,
  Layers,
  Sliders,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  Palette,
  GripVertical,
} from 'lucide-react';
import type {
  PresentationSpec,
  SlideSpec,
  SlideLayoutType,
  PresentationThemeName,
  SlideVisualElement,
} from '@local-ai/shared';
import { SlideCanvas } from './SlideCanvas';
import { PRESENTATION_THEMES } from './PresentationThemes';
import { generatePptx } from './PptxGenerator';
import { ChartStudioModal } from '../visualizations/ChartStudioModal';
import { SlideInteractiveCanvas } from './components/SlideInteractiveCanvas';
import { ContextualInspector } from './components/ContextualInspector';
import { LayersPanel } from './components/LayersPanel';
import { InsertMenu } from './components/InsertMenu';
import { PresentationModeModal } from './components/PresentationModeModal';
import { AiSlideAssistantModal } from './components/AiSlideAssistantModal';
import type { SelectionTarget } from './types';

interface PresentationStudioModalProps {
  isOpen: boolean;
  initialSpec: PresentationSpec;
  onClose: () => void;
  onSave?: (spec: PresentationSpec) => void;
}

const ALL_LAYOUTS: { type: SlideLayoutType; label: string; icon: string }[] = [
  { type: 'title', label: 'Title Slide', icon: 'T' },
  { type: 'executive-summary', label: 'Executive Summary', icon: 'ES' },
  { type: 'agenda', label: 'Agenda / TOC', icon: 'AG' },
  { type: 'columns-3', label: '3-Column Cards', icon: 'C3' },
  { type: 'columns-2', label: '2-Column Cards', icon: 'C2' },
  { type: 'columns-4', label: '4-Column Cards', icon: 'C4' },
  { type: 'metrics-stats', label: 'KPI & Metrics', icon: 'KPI' },
  { type: 'architecture-flow', label: 'Architecture', icon: 'AF' },
  { type: 'timeline-roadmap', label: 'Timeline / Roadmap', icon: 'TL' },
  { type: 'process-steps', label: 'Process Steps', icon: 'PS' },
  { type: 'swot', label: 'SWOT Analysis', icon: 'SW' },
  { type: 'chart-data', label: 'Data & Chart', icon: 'CH' },
  { type: 'quote', label: 'Quote / Callout', icon: 'QT' },
  { type: 'conclusion', label: 'Next Steps', icon: 'NS' },
];

export const PresentationStudioModal: React.FC<PresentationStudioModalProps> = ({
  isOpen,
  initialSpec,
  onClose,
  onSave,
}) => {
  const [spec, setSpec] = useState<PresentationSpec>(() => JSON.parse(JSON.stringify(initialSpec)));
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);
  const [selection, setSelection] = useState<SelectionTarget>({ type: 'none' });
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [isNavigatorCollapsed, setIsNavigatorCollapsed] = useState<boolean>(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState<boolean>(false);
  const [rightPanelTab, setRightPanelTab] = useState<'inspector' | 'layers'>('inspector');
  const [isDistractionFree, setIsDistractionFree] = useState<boolean>(false);
  const [isPresenting, setIsPresenting] = useState<boolean>(false);
  const [showAiAssistant, setShowAiAssistant] = useState<boolean>(false);
  const [showAddSlideMenu, setShowAddSlideMenu] = useState<boolean>(false);
  const [showThemeMenu, setShowThemeMenu] = useState<boolean>(false);
  const [editingChartElement, setEditingChartElement] = useState<SlideVisualElement | null>(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  // History Stack for Undo/Redo
  const [undoStack, setUndoStack] = useState<PresentationSpec[]>([]);
  const [redoStack, setRedoStack] = useState<PresentationSpec[]>([]);

  // Drag and drop slide state
  const [draggedSlideIdx, setDraggedSlideIdx] = useState<number | null>(null);
  const [dragOverSlideIdx, setDragOverSlideIdx] = useState<number | null>(null);

  // Viewport tracking for dynamic canvas scale
  const canvasViewportRef = useRef<HTMLDivElement>(null);
  const [viewportDims, setViewportDims] = useState<{ width: number; height: number }>({
    width: 1200,
    height: 700,
  });

  const addSlideMenuRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  // Sync initialSpec when opened
  useEffect(() => {
    if (isOpen) {
      setSpec(JSON.parse(JSON.stringify(initialSpec)));
      setActiveSlideIndex(0);
      setSelection({ type: 'none' });
      setUndoStack([]);
      setRedoStack([]);
      setZoomScale(1);
    }
  }, [isOpen, initialSpec]);

  // Dynamic canvas viewport measurement
  useEffect(() => {
    if (!isOpen) return;
    const el = canvasViewportRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 50 && rect.height > 50) {
        setViewportDims({ width: rect.width, height: rect.height });
      }
    };

    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    window.addEventListener('resize', measure);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [isOpen, isNavigatorCollapsed, isInspectorCollapsed, isDistractionFree]);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (addSlideMenuRef.current && !addSlideMenuRef.current.contains(e.target as Node)) {
        setShowAddSlideMenu(false);
      }
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setShowThemeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Push state to undo history
  const pushState = useCallback((newSpec: PresentationSpec) => {
    setUndoStack((prev) => [...prev.slice(-30), JSON.parse(JSON.stringify(spec))]);
    setRedoStack([]);
    setSpec(newSpec);
  }, [spec]);

  // Undo / Redo handlers
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, prev.length - 1));
    setRedoStack((prev) => [JSON.parse(JSON.stringify(spec)), ...prev]);
    setSpec(previous);
    setSelection({ type: 'none' });
  }, [undoStack, spec]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setRedoStack((prev) => prev.slice(1));
    setUndoStack((prev) => [...prev, JSON.parse(JSON.stringify(spec))]);
    setSpec(next);
    setSelection({ type: 'none' });
  }, [redoStack, spec]);

  // Safe current slide getter
  const currentSlide = spec.slides[activeSlideIndex] || spec.slides[0] || {
    id: 's-fallback',
    layout: 'title',
    title: 'Untitled Slide',
  };

  // Keyboard shortcut listener
  useEffect(() => {
    if (!isOpen || isPresenting) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput =
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        (document.activeElement as HTMLElement)?.isContentEditable;

      // Undo / Redo
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Duplicate element (Cmd+D / Ctrl+D)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd' && !isInput) {
        if (selection.type === 'custom' && selection.elementId) {
          e.preventDefault();
          const targetEl = (currentSlide.customElements || []).find((el) => el.id === selection.elementId);
          if (targetEl) {
            const duplicated: SlideVisualElement = {
              ...JSON.parse(JSON.stringify(targetEl)),
              id: `el-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              transform: {
                ...targetEl.transform,
                x: Math.min(85, targetEl.transform.x + 3),
                y: Math.min(85, targetEl.transform.y + 3),
              },
            };
            const updatedCustom = [...(currentSlide.customElements || []), duplicated];
            const updatedSlides = [...spec.slides];
            updatedSlides[activeSlideIndex] = { ...currentSlide, customElements: updatedCustom };
            pushState({ ...spec, slides: updatedSlides });
            setSelection({ type: 'custom', elementId: duplicated.id });
          }
        }
        return;
      }

      // Delete selected element
      if ((e.key === 'Backspace' || e.key === 'Delete') && !isInput) {
        if (selection.type === 'custom' && selection.elementId) {
          e.preventDefault();
          const updatedCustom = (currentSlide.customElements || []).filter((el) => el.id !== selection.elementId);
          const updatedSlides = [...spec.slides];
          updatedSlides[activeSlideIndex] = { ...currentSlide, customElements: updatedCustom };
          pushState({ ...spec, slides: updatedSlides });
          setSelection({ type: 'none' });
        }
        return;
      }

      // Escape key
      if (e.key === 'Escape') {
        if (selection.type !== 'none') {
          setSelection({ type: 'none' });
        } else if (isDistractionFree) {
          setIsDistractionFree(false);
        }
        return;
      }

      // Present shortcut: F5 or Cmd+Enter
      if (e.key === 'F5' || ((e.metaKey || e.ctrlKey) && e.key === 'Enter')) {
        e.preventDefault();
        setIsPresenting(true);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    isPresenting,
    handleUndo,
    handleRedo,
    selection,
    currentSlide,
    spec,
    activeSlideIndex,
    pushState,
    isDistractionFree,
  ]);

  // Update slide helper
  const handleUpdateCurrentSlide = (updates: Partial<SlideSpec>) => {
    const updatedSlide: SlideSpec = { ...currentSlide, ...updates };
    const updatedSlides = [...spec.slides];
    updatedSlides[activeSlideIndex] = updatedSlide;
    pushState({ ...spec, slides: updatedSlides });
  };

  // Update element helper
  const handleUpdateElement = (elId: string, updates: Partial<SlideVisualElement>) => {
    const currentCustom = currentSlide.customElements || [];
    const updatedCustom = currentCustom.map((el) => (el.id === elId ? { ...el, ...updates } : el));
    handleUpdateCurrentSlide({ customElements: updatedCustom });
  };

  // Delete element helper
  const handleDeleteElement = (elId: string) => {
    const currentCustom = currentSlide.customElements || [];
    const updatedCustom = currentCustom.filter((el) => el.id !== elId);
    handleUpdateCurrentSlide({ customElements: updatedCustom });
    if (selection.elementId === elId) {
      setSelection({ type: 'none' });
    }
  };

  // Reorder element (z-index)
  const handleReorderElement = (elId: string, direction: 'up' | 'down') => {
    const currentCustom = [...(currentSlide.customElements || [])];
    const idx = currentCustom.findIndex((el) => el.id === elId);
    if (idx < 0) return;

    if (direction === 'up' && idx < currentCustom.length - 1) {
      const temp = currentCustom[idx];
      currentCustom[idx] = currentCustom[idx + 1];
      currentCustom[idx + 1] = temp;
      handleUpdateCurrentSlide({ customElements: currentCustom });
    } else if (direction === 'down' && idx > 0) {
      const temp = currentCustom[idx];
      currentCustom[idx] = currentCustom[idx - 1];
      currentCustom[idx - 1] = temp;
      handleUpdateCurrentSlide({ customElements: currentCustom });
    }
  };

  // Insert element
  const handleInsertElement = (element: SlideVisualElement) => {
    const currentCustom = currentSlide.customElements || [];
    const updatedCustom = [...currentCustom, element];
    handleUpdateCurrentSlide({ customElements: updatedCustom });
    setSelection({ type: 'custom', elementId: element.id });
    if (isInspectorCollapsed) {
      setIsInspectorCollapsed(false);
    }
  };

  // Add slide
  const handleAddSlide = (layout: SlideLayoutType) => {
    const newSlideId = `s-${Date.now()}`;
    let newSlide: SlideSpec;

    switch (layout) {
      case 'title':
        newSlide = {
          id: newSlideId,
          layout: 'title',
          kicker: 'Keynote Overview',
          title: 'Strategic Architecture & Objectives',
          subtitle: 'A high-impact perspective on forward delivery',
        };
        break;
      case 'columns-3':
        newSlide = {
          id: newSlideId,
          layout: 'columns-3',
          kicker: 'Key Pillars',
          title: 'Core Architecture Strata',
          subtitle: 'Distributed execution across foundational systems',
          cards: [
            { title: 'Core Model Plane', description: 'Zero-latency on-device inference with strict local privacy.', tag: 'Phase 1' },
            { title: 'RAG Knowledge Mesh', description: 'Contextual retrieval indexed directly into embedded vectors.', tag: 'Phase 2' },
            { title: 'Agent Automation', description: 'Self-correcting workflows executing end-to-end tooling.', tag: 'Phase 3' },
          ],
        };
        break;
      case 'metrics-stats':
        newSlide = {
          id: newSlideId,
          layout: 'metrics-stats',
          kicker: 'Performance & Velocity',
          title: 'Key Operational Metrics',
          subtitle: 'Verified empirical breakthroughs across production nodes',
          stats: [
            { value: '4.8x', label: 'Inference Speedup', change: '+380%', trend: 'up' },
            { value: '100%', label: 'Local Airgap Privacy', change: 'Strict', trend: 'up' },
            { value: '<12ms', label: 'First Token Latency', change: '-82%', trend: 'up' },
          ],
        };
        break;
      case 'chart-data':
        newSlide = {
          id: newSlideId,
          layout: 'chart-data',
          kicker: 'Analytics',
          title: 'Quarterly Trajectory & Expansion',
          chart: {
            title: 'Quarterly Trajectory',
            type: 'bar',
            theme: 'premium-black',
            series: [
              {
                name: 'Growth',
                data: [
                  { label: 'Q1', value: 45 },
                  { label: 'Q2', value: 68 },
                  { label: 'Q3', value: 92 },
                  { label: 'Q4', value: 140 },
                ],
              },
            ],
          },
        };
        break;
      default:
        newSlide = {
          id: newSlideId,
          layout,
          kicker: 'Overview',
          title: `${layout.charAt(0).toUpperCase() + layout.slice(1)} Slide`,
          subtitle: 'Add supporting details and bullet points',
          bullets: ['Key strategic observation or deliverable', 'Secondary supporting insight and timeline milestone'],
        };
    }

    const nextSlides = [...spec.slides];
    const insertIndex = activeSlideIndex + 1;
    nextSlides.splice(insertIndex, 0, newSlide);
    pushState({ ...spec, slides: nextSlides });
    setActiveSlideIndex(insertIndex);
    setShowAddSlideMenu(false);
  };

  const handleDuplicateSlide = (index: number) => {
    const target = spec.slides[index];
    if (!target) return;
    const duplicated: SlideSpec = {
      ...JSON.parse(JSON.stringify(target)),
      id: `s-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: `${target.title} (Copy)`,
    };
    const nextSlides = [...spec.slides];
    nextSlides.splice(index + 1, 0, duplicated);
    pushState({ ...spec, slides: nextSlides });
    setActiveSlideIndex(index + 1);
  };

  const handleDeleteSlide = (index: number) => {
    if (spec.slides.length <= 1) return;
    const nextSlides = spec.slides.filter((_, i) => i !== index);
    pushState({ ...spec, slides: nextSlides });
    setActiveSlideIndex(Math.max(0, Math.min(index, nextSlides.length - 1)));
    setDeleteConfirmIndex(null);
  };

  const handleReorderSlide = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || toIndex >= spec.slides.length) return;
    const nextSlides = [...spec.slides];
    const [moved] = nextSlides.splice(fromIndex, 1);
    nextSlides.splice(toIndex, 0, moved);
    pushState({ ...spec, slides: nextSlides });
    setActiveSlideIndex(toIndex);
  };

  // Export handlers
  const handleExportPptx = async () => {
    setIsExporting(true);
    setExportFeedback('Exporting OpenXML PPTX presentation...');
    try {
      await generatePptx(spec);
      setExportFeedback('Presentation exported successfully!');
      setTimeout(() => setExportFeedback(null), 3000);
    } catch (err: unknown) {
      console.error('Failed to export PPTX:', err);
      setExportFeedback(err instanceof Error ? err.message : 'Export failed');
      setTimeout(() => setExportFeedback(null), 4000);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  // Zoom controls
  const handleZoomIn = () => setZoomScale((prev) => Math.min(2.0, Math.round((prev + 0.1) * 10) / 10));
  const handleZoomOut = () => setZoomScale((prev) => Math.max(0.4, Math.round((prev - 0.1) * 10) / 10));
  const handleResetZoom = () => setZoomScale(1);

  if (!isOpen) return null;

  // Exact dynamic scaling calculations
  const PADDING = 48; // 24px padding on each side
  const availW = Math.max(320, viewportDims.width - PADDING);
  const availH = Math.max(220, viewportDims.height - PADDING);
  const baseFitScale = Math.min(availW / 1280, availH / 720);
  const clampedFitScale = Math.min(1.25, Math.max(0.2, baseFitScale));
  const renderedScale = Math.max(0.15, clampedFitScale * zoomScale);

  return (
    <div className="fixed inset-0 z-50 bg-[#FFFFFF] dark:bg-[#090909] text-[#111111] dark:text-[#FFFFFF] flex flex-col select-none font-sans overflow-hidden">
      {/* 1. TOP MINIMAL TOOLBAR (Height: 56px / h-14) */}
      <header className="h-14 border-b border-[#E5E7EB] dark:border-[#292929] bg-[#FFFFFF] dark:bg-[#141414] px-4 flex items-center justify-between shrink-0 z-30">
        {/* LEFT GROUP: Logo/Title & History */}
        <div className="flex items-center gap-2">
          {/* Presentation icon badge */}
          <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white flex items-center justify-center shrink-0">
            <Presentation className="w-4 h-4" />
          </div>

          {/* Presentation Title Input */}
          <input
            type="text"
            value={spec.title}
            onChange={(e) => pushState({ ...spec, title: e.target.value })}
            className="h-8 px-2 text-sm font-semibold rounded-md border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 focus:border-black dark:focus:border-white focus:bg-white dark:focus:bg-[#191919] bg-transparent text-zinc-900 dark:text-zinc-100 max-w-[200px] lg:max-w-[260px] truncate transition-all"
            placeholder="Presentation Title"
          />

          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 shrink-0" />

          {/* Undo / Redo */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="h-8 w-8 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center justify-center"
              title="Undo (Cmd+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="h-8 w-8 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center justify-center"
              title="Redo (Cmd+Shift+Z)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* CENTER GROUP: Insert, AI Polish, Theme, Zoom */}
        <div className="flex items-center gap-2">
          {/* Insert Element Menu */}
          <InsertMenu
            onInsertElement={handleInsertElement}
            accentColor={PRESENTATION_THEMES[spec.theme]?.palette.accent || '#000000'}
          />

          {/* AI Polish Assistant */}
          <button
            type="button"
            onClick={() => setShowAiAssistant(true)}
            className="h-8 px-2.5 rounded-lg border border-purple-200 dark:border-purple-900/50 bg-purple-50 dark:bg-purple-950/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium transition-all flex items-center gap-1.5"
            title="Open AI Slide Assistant"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
            <span>AI Polish</span>
          </button>

          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 shrink-0" />

          {/* Theme Selector Dropdown */}
          <div className="relative" ref={themeMenuRef}>
            <button
              type="button"
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#181818] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 font-medium transition-colors flex items-center gap-2"
            >
              <Palette className="w-3.5 h-3.5 text-zinc-500" />
              <span>{PRESENTATION_THEMES[spec.theme]?.label || 'Minimal Monochrome'}</span>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </button>

            {showThemeMenu && (
              <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 w-64 bg-white dark:bg-[#191919] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl py-1.5 z-40 max-h-80 overflow-y-auto">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Theme Palette
                </div>
                {Object.entries(PRESENTATION_THEMES).map(([themeKey, themeData]) => (
                  <button
                    key={themeKey}
                    type="button"
                    onClick={() => {
                      pushState({ ...spec, theme: themeKey as PresentationThemeName });
                      setShowThemeMenu(false);
                    }}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs hover:bg-zinc-100 dark:hover:bg-[#252528] transition-colors ${
                      spec.theme === themeKey
                        ? 'text-zinc-900 dark:text-white font-semibold bg-zinc-100 dark:bg-zinc-800'
                        : 'text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-black/20 dark:border-white/20"
                        style={{ backgroundColor: themeData.palette.accent }}
                      />
                      <span>{themeData.label}</span>
                    </div>
                    {spec.theme === themeKey && <Check className="w-3.5 h-3.5 text-black dark:text-white" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 shrink-0" />

          {/* Zoom Controls */}
          <div className="h-8 px-1 flex items-center gap-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#181818]">
            <button
              type="button"
              onClick={handleZoomOut}
              className="w-6 h-6 rounded flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              className="px-1.5 text-xs font-mono font-medium text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white transition-colors"
              title="Reset Zoom to 100% Fit"
            >
              {Math.round(zoomScale * 100)}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              className="w-6 h-6 rounded flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* RIGHT GROUP: Panels, Present, PPTX, Close */}
        <div className="flex items-center gap-2">
          {/* Navigator toggle */}
          <button
            type="button"
            onClick={() => setIsNavigatorCollapsed(!isNavigatorCollapsed)}
            className={`h-8 w-8 rounded-lg border flex items-center justify-center transition-colors ${
              !isNavigatorCollapsed
                ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-black dark:text-white'
                : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
            title={isNavigatorCollapsed ? 'Show Slide Navigator' : 'Hide Slide Navigator'}
          >
            {isNavigatorCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>

          {/* Inspector toggle */}
          <button
            type="button"
            onClick={() => {
              if (isInspectorCollapsed) {
                setIsInspectorCollapsed(false);
                setRightPanelTab('inspector');
              } else if (rightPanelTab === 'inspector') {
                setIsInspectorCollapsed(true);
              } else {
                setRightPanelTab('inspector');
              }
            }}
            className={`h-8 w-8 rounded-lg border flex items-center justify-center transition-colors ${
              !isInspectorCollapsed && rightPanelTab === 'inspector'
                ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-black dark:text-white'
                : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
            title="Slide & Element Properties Inspector"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* Layers toggle */}
          <button
            type="button"
            onClick={() => {
              if (isInspectorCollapsed) {
                setIsInspectorCollapsed(false);
                setRightPanelTab('layers');
              } else if (rightPanelTab === 'layers') {
                setIsInspectorCollapsed(true);
              } else {
                setRightPanelTab('layers');
              }
            }}
            className={`h-8 w-8 rounded-lg border flex items-center justify-center transition-colors ${
              !isInspectorCollapsed && rightPanelTab === 'layers'
                ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-black dark:text-white'
                : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
            title="Slide Layers Panel"
          >
            <Layers className="w-4 h-4" />
          </button>

          {/* Distraction-Free Toggle */}
          <button
            type="button"
            onClick={() => setIsDistractionFree(!isDistractionFree)}
            className={`h-8 w-8 rounded-lg border flex items-center justify-center transition-colors ${
              isDistractionFree
                ? 'bg-black text-white dark:bg-white dark:text-black border-transparent'
                : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
            title={isDistractionFree ? 'Exit Canvas Focus' : 'Focus Canvas (Hide Panels)'}
          >
            {isDistractionFree ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 shrink-0" />

          {/* Present Button (Primary Action) */}
          <button
            type="button"
            onClick={() => setIsPresenting(true)}
            className="h-8 px-3 rounded-lg bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
            title="Present Fullscreen (F5)"
          >
            <Presentation className="w-3.5 h-3.5" />
            <span>Present</span>
          </button>

          {/* PPTX Export Button */}
          <button
            type="button"
            onClick={handleExportPptx}
            disabled={isExporting}
            className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#181818] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
            title="Export as OpenXML PowerPoint (.pptx)"
          >
            <Download className="w-3.5 h-3.5 text-zinc-500" />
            <span>{isExporting ? 'Exporting...' : 'PPTX'}</span>
          </button>

          {/* PDF / Print */}
          <button
            type="button"
            onClick={handlePrintPdf}
            className="h-8 w-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#181818] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors flex items-center justify-center"
            title="Print or Save as PDF"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>

          {/* Save Button if handler provided */}
          {onSave && (
            <button
              type="button"
              onClick={() => onSave(spec)}
              className="h-8 px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>
          )}

          {/* Close Editor */}
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-colors flex items-center justify-center ml-0.5"
            title="Close Editor"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* FEEDBACK BANNER */}
      {exportFeedback && (
        <div className="bg-black text-white dark:bg-white dark:text-black text-xs px-4 py-1.5 flex items-center justify-between shrink-0 z-20 font-medium">
          <span>{exportFeedback}</span>
          <button type="button" onClick={() => setExportFeedback(null)} className="opacity-70 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. MAIN 3-PANE WORKSPACE */}
      <div className="flex-1 flex overflow-hidden relative min-h-0 min-w-0">
        {/* LEFT SLIDE NAVIGATOR */}
        {!isDistractionFree && (
          <aside
            className={`border-r border-[#E5E7EB] dark:border-[#292929] bg-[#FAFAFA] dark:bg-[#0E0E0E] flex flex-col shrink-0 z-10 transition-all duration-200 overflow-hidden ${
              isNavigatorCollapsed ? 'w-0 border-r-0' : 'w-[260px]'
            }`}
          >
            {/* Slide Navigator Header */}
            <div className="h-10 px-3 border-b border-[#E5E7EB] dark:border-[#292929] flex items-center justify-between shrink-0 bg-[#FFFFFF] dark:bg-[#141414]">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Slides</span>
                <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1.5 py-0.5 rounded-full font-mono font-medium">
                  {spec.slides.length}
                </span>
              </div>

              <div className="flex items-center gap-1">
                {/* Add Slide Dropdown */}
                <div className="relative" ref={addSlideMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowAddSlideMenu(!showAddSlideMenu)}
                    className="h-7 px-2 rounded-md bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-xs font-medium flex items-center gap-1 transition-colors"
                    title="Add New Slide"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Slide</span>
                  </button>

                  {showAddSlideMenu && (
                    <div className="absolute top-full left-0 mt-1.5 w-64 bg-white dark:bg-[#191919] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl py-1.5 z-40 max-h-80 overflow-y-auto">
                      <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                        Choose Slide Layout
                      </div>
                      {ALL_LAYOUTS.map((layout) => (
                        <button
                          key={layout.type}
                          type="button"
                          onClick={() => handleAddSlide(layout.type)}
                          className="w-full px-3 py-2 text-left flex items-center gap-2.5 hover:bg-zinc-100 dark:hover:bg-[#252528] text-xs text-zinc-900 dark:text-zinc-100 transition-colors"
                        >
                          <span className="w-6 h-6 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono font-bold flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                            {layout.icon}
                          </span>
                          <span className="font-medium">{layout.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Collapse Navigator */}
                <button
                  type="button"
                  onClick={() => setIsNavigatorCollapsed(true)}
                  className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Collapse Navigator"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Slide Thumbnails List */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
              {spec.slides.map((slide, sIdx) => {
                const isActive = sIdx === activeSlideIndex;
                const isDragging = draggedSlideIdx === sIdx;
                const isDragOver = dragOverSlideIdx === sIdx;

                return (
                  <div
                    key={slide.id || sIdx}
                    draggable
                    onDragStart={() => setDraggedSlideIdx(sIdx)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverSlideIdx(sIdx);
                    }}
                    onDragEnd={() => {
                      if (draggedSlideIdx !== null && dragOverSlideIdx !== null) {
                        handleReorderSlide(draggedSlideIdx, dragOverSlideIdx);
                      }
                      setDraggedSlideIdx(null);
                      setDragOverSlideIdx(null);
                    }}
                    onClick={() => {
                      setActiveSlideIndex(sIdx);
                      setSelection({ type: 'none' });
                    }}
                    className={`group relative rounded-xl p-2 cursor-pointer transition-all border ${
                      isActive
                        ? 'border-black ring-1 ring-black dark:border-white dark:ring-1 dark:ring-white bg-white dark:bg-[#191919] shadow-sm'
                        : isDragOver
                        ? 'border-blue-500 bg-blue-50/20'
                        : 'border-[#E5E7EB] dark:border-[#262626] bg-white dark:bg-[#141414] hover:border-zinc-400 dark:hover:border-zinc-700'
                    } ${isDragging ? 'opacity-40' : ''}`}
                  >
                    {/* Header Row: Index, Title, Actions */}
                    <div className="flex items-center justify-between text-xs mb-1.5 px-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <GripVertical className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100 cursor-grab shrink-0 transition-opacity" />
                        <span
                          className={`font-mono text-[10px] px-1 py-0.2 rounded font-semibold shrink-0 ${
                            isActive
                              ? 'bg-black text-white dark:bg-white dark:text-black'
                              : 'text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800'
                          }`}
                        >
                          {sIdx + 1}
                        </span>
                        <span
                          className={`truncate text-xs ${
                            isActive
                              ? 'text-zinc-900 dark:text-white font-semibold'
                              : 'text-zinc-600 dark:text-zinc-300'
                          }`}
                        >
                          {slide.title || 'Untitled Slide'}
                        </span>
                      </div>

                      {/* Hover action buttons */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateSlide(sIdx);
                          }}
                          className="p-1 rounded-md text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                          title="Duplicate Slide"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        {spec.slides.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmIndex(sIdx);
                            }}
                            className="p-1 rounded-md text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                            title="Delete Slide"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Miniature Proportional Slide Preview (16:9) */}
                    <div className="relative w-full aspect-video rounded-md overflow-hidden bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800 pointer-events-none">
                      <div
                        className="origin-top-left pointer-events-none select-none"
                        style={{
                          width: 1280,
                          height: 720,
                          transform: 'scale(0.174)',
                        }}
                      >
                        <SlideCanvas
                          slide={slide}
                          themeName={spec.theme}
                          slideNumber={sIdx + 1}
                          totalSlides={spec.slides.length}
                        />
                      </div>
                    </div>

                    {/* Delete Confirmation Overlay */}
                    {deleteConfirmIndex === sIdx && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute inset-0 bg-white/95 dark:bg-[#161616]/95 backdrop-blur-xs rounded-xl p-3 flex flex-col items-center justify-center text-center z-20 animate-in fade-in duration-100"
                      >
                        <span className="text-xs font-semibold text-zinc-900 dark:text-white mb-2">
                          Delete slide {sIdx + 1}?
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleDeleteSlide(sIdx)}
                            className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-semibold transition-colors shadow-xs"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmIndex(null)}
                            className="px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] font-medium transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>
        )}

        {/* CENTER PRESENTATION WORKSPACE & CANVAS */}
        <main className="flex-1 flex flex-col bg-[#F5F5F5] dark:bg-[#111111] overflow-hidden relative min-w-0 min-h-0">
          {/* Canvas Viewport Area */}
          <div
            ref={canvasViewportRef}
            className="flex-1 overflow-auto flex items-center justify-center p-6 lg:p-8 min-w-0 min-h-0 select-none relative"
            style={{
              cursor: zoomScale > 1.2 ? 'grab' : 'default',
            }}
          >
            {/* Outer Box Sized to Rendered Scaled Dimensions to avoid accidental overflow */}
            <div
              className="relative shrink-0 shadow-[0_12px_45px_rgba(0,0,0,0.08)] dark:shadow-[0_16px_50px_rgba(0,0,0,0.6)] rounded-2xl overflow-hidden transition-transform duration-100 ease-out"
              style={{
                width: Math.round(1280 * renderedScale),
                height: Math.round(720 * renderedScale),
              }}
            >
              {/* Inner Virtual Canvas (1280x720) Scaled from Top-Left */}
              <div
                style={{
                  width: 1280,
                  height: 720,
                  transform: `scale(${renderedScale})`,
                  transformOrigin: 'top left',
                }}
              >
                <SlideInteractiveCanvas
                  slide={currentSlide}
                  themeName={spec.theme}
                  palette={PRESENTATION_THEMES[spec.theme]?.palette}
                  slideNumber={activeSlideIndex + 1}
                  totalSlides={spec.slides.length}
                  selection={selection}
                  onSelect={setSelection}
                  onUpdateSlide={handleUpdateCurrentSlide}
                  onUpdateElement={handleUpdateElement}
                  onDeleteElement={handleDeleteElement}
                  onAiRewrite={() => setShowAiAssistant(true)}
                />
              </div>
            </div>
          </div>

          {/* BOTTOM CONTEXTUAL STATUS BAR (Height: 36px / h-9) */}
          <footer className="h-9 border-t border-[#E5E7EB] dark:border-[#292929] bg-[#FFFFFF] dark:bg-[#141414] px-4 flex items-center justify-between text-xs text-zinc-500 dark:text-[#A1A1AA] shrink-0 z-20">
            <div className="flex items-center gap-3">
              <span>
                Slide <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">{activeSlideIndex + 1}</strong> of {spec.slides.length}
              </span>
              <span className="h-3 w-px bg-zinc-200 dark:bg-zinc-800" />
              <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono text-[10px] uppercase">
                {currentSlide.layout}
              </span>
              {selection.type !== 'none' && (
                <>
                  <span className="h-3 w-px bg-zinc-200 dark:bg-zinc-800" />
                  <span className="flex items-center gap-1 text-zinc-700 dark:text-zinc-300">
                    Selection: <strong className="text-zinc-900 dark:text-white capitalize">{selection.type}</strong>
                    {selection.elementId && ` (${selection.elementId.slice(0, 10)})`}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden md:inline text-zinc-400 dark:text-zinc-500">
                Click canvas to select &middot; Drag handles to resize &middot; Double-click text to edit
              </span>
              <span className="h-3 w-px bg-zinc-200 dark:bg-zinc-800 hidden md:inline" />
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-zinc-700 dark:text-zinc-300">
                  {Math.round(zoomScale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={handleResetZoom}
                  className="font-medium text-zinc-800 dark:text-zinc-200 hover:text-black dark:hover:text-white underline underline-offset-2 transition-colors ml-1"
                >
                  Fit Canvas
                </button>
              </div>
            </div>
          </footer>
        </main>

        {/* RIGHT CONTEXTUAL PROPERTIES INSPECTOR / LAYERS PANEL */}
        {!isDistractionFree && (
          <aside
            className={`border-l border-[#E5E7EB] dark:border-[#292929] bg-[#FFFFFF] dark:bg-[#141414] flex flex-col shrink-0 z-10 transition-all duration-200 overflow-hidden ${
              isInspectorCollapsed ? 'w-0 border-l-0' : 'w-[320px]'
            }`}
          >
            {/* Inspector Header with Tab Switcher */}
            <div className="h-10 px-3 border-b border-[#E5E7EB] dark:border-[#292929] flex items-center justify-between shrink-0 bg-[#FFFFFF] dark:bg-[#141414]">
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                <button
                  type="button"
                  onClick={() => setRightPanelTab('inspector')}
                  className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${
                    rightPanelTab === 'inspector'
                      ? 'bg-white dark:bg-[#1E1E1E] text-zinc-900 dark:text-white shadow-xs font-semibold'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  Inspector
                </button>
                <button
                  type="button"
                  onClick={() => setRightPanelTab('layers')}
                  className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${
                    rightPanelTab === 'layers'
                      ? 'bg-white dark:bg-[#1E1E1E] text-zinc-900 dark:text-white shadow-xs font-semibold'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  Layers ({currentSlide.customElements?.length || 0})
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsInspectorCollapsed(true)}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title="Collapse Inspector"
              >
                <PanelRightClose className="w-4 h-4" />
              </button>
            </div>

            {/* Inspector or Layers Body */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {rightPanelTab === 'inspector' ? (
                <ContextualInspector
                  slide={currentSlide}
                  selection={selection}
                  themeName={spec.theme}
                  onUpdateSlide={handleUpdateCurrentSlide}
                  onUpdateElement={handleUpdateElement}
                  onDeleteElement={handleDeleteElement}
                  onOpenChartStudio={(chartEl) => setEditingChartElement(chartEl)}
                />
              ) : (
                <LayersPanel
                  slide={currentSlide}
                  selection={selection}
                  onSelect={setSelection}
                  onUpdateElement={handleUpdateElement}
                  onDeleteElement={handleDeleteElement}
                  onReorderElement={handleReorderElement}
                />
              )}
            </div>
          </aside>
        )}
      </div>

      {/* FULLSCREEN PRESENTATION MODE MODAL */}
      {isPresenting && (
        <PresentationModeModal
          isOpen={true}
          spec={spec}
          initialSlideIndex={activeSlideIndex}
          onClose={() => setIsPresenting(false)}
        />
      )}

      {/* AI SLIDE ASSISTANT MODAL */}
      {showAiAssistant && (
        <AiSlideAssistantModal
          isOpen={true}
          slide={currentSlide}
          onClose={() => setShowAiAssistant(false)}
          onApplyChanges={(updatedSlide) => {
            handleUpdateCurrentSlide(updatedSlide);
            setShowAiAssistant(false);
          }}
        />
      )}

      {/* CHART STUDIO EMBEDDED MODAL */}
      {editingChartElement && editingChartElement.chart && (
        <ChartStudioModal
          isOpen={true}
          initialSpec={editingChartElement.chart}
          onClose={() => setEditingChartElement(null)}
          onSave={(updatedChart) => {
            handleUpdateElement(editingChartElement.id, { chart: updatedChart });
            setEditingChartElement(null);
          }}
        />
      )}
    </div>
  );
};
