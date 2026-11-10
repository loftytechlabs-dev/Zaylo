import React, { useState, useRef, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Star,
  Shield,
  Zap,
  Users,
  Target,
  Rocket,
  Award,
  Sparkles,
} from 'lucide-react';
import type {
  SlideSpec,
  SlideVisualElement,
  PresentationThemeName,
  PresentationPalette,
} from '@local-ai/shared';
import type { SelectionTarget, DragOperation, ResizeOperation } from '../types';
import { getPresentationTheme } from '../PresentationThemes';
import { ChartRenderer } from '../../visualizations/ChartRenderer';
import { FloatingTextToolbar } from './FloatingTextToolbar';

interface SlideInteractiveCanvasProps {
  slide: SlideSpec;
  themeName: PresentationThemeName;
  palette?: PresentationPalette;
  slideNumber?: number;
  totalSlides?: number;
  zoomScale?: number;
  selection: SelectionTarget;
  onSelect: (target: SelectionTarget) => void;
  onUpdateSlide: (updates: Partial<SlideSpec>) => void;
  onUpdateElement: (elId: string, updates: Partial<SlideVisualElement>) => void;
  onDeleteElement: (elId: string) => void;
  onAiRewrite?: (text: string) => void;
  className?: string;
}

export const SlideInteractiveCanvas: React.FC<SlideInteractiveCanvasProps> = ({
  slide,
  themeName,
  palette,
  slideNumber = 1,
  totalSlides = 1,
  zoomScale: _zoomScale = 1,
  selection,
  onSelect,
  onUpdateSlide,
  onUpdateElement,
  onDeleteElement,
  onAiRewrite,
  className = '',
}) => {
  const theme = getPresentationTheme(themeName, palette);
  const p = theme.palette;

  // Inline editing state: which field is actively being typed into
  const [editingField, setEditingField] = useState<string | null>(null);
  const [floatingPos, setFloatingPos] = useState<{ x: number; y: number } | null>(null);

  // Dragging and Resizing
  const [dragOp, setDragOp] = useState<DragOperation | null>(null);
  const [resizeOp, setResizeOp] = useState<ResizeOperation | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const customElements = slide.customElements || [];

  // Global mouse move and mouse up for drag / resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const currentXPercent = ((e.clientX - rect.left) / rect.width) * 100;
      const currentYPercent = ((e.clientY - rect.top) / rect.height) * 100;

      if (dragOp) {
        const deltaX = currentXPercent - dragOp.startX;
        const deltaY = currentYPercent - dragOp.startY;
        const newX = Math.max(0, Math.min(95, dragOp.initialX + deltaX));
        const newY = Math.max(0, Math.min(95, dragOp.initialY + deltaY));

        const targetEl = customElements.find((el) => el.id === dragOp.elementId);
        if (targetEl && !targetEl.locked) {
          onUpdateElement(dragOp.elementId, {
            transform: { ...targetEl.transform, x: newX, y: newY },
          });
        }
      } else if (resizeOp) {
        const deltaX = currentXPercent - resizeOp.startX;
        const deltaY = currentYPercent - resizeOp.startY;
        const targetEl = customElements.find((el) => el.id === resizeOp.elementId);
        if (targetEl && !targetEl.locked) {
          let newW = resizeOp.initialW;
          let newH = resizeOp.initialH;
          let newX = resizeOp.initialX;
          let newY = resizeOp.initialY;

          if (resizeOp.handle.includes('e')) newW = Math.max(5, resizeOp.initialW + deltaX);
          if (resizeOp.handle.includes('s')) newH = Math.max(3, resizeOp.initialH + deltaY);
          if (resizeOp.handle.includes('w')) {
            newW = Math.max(5, resizeOp.initialW - deltaX);
            newX = resizeOp.initialX + deltaX;
          }
          if (resizeOp.handle.includes('n')) {
            newH = Math.max(3, resizeOp.initialH - deltaY);
            newY = resizeOp.initialY + deltaY;
          }

          onUpdateElement(resizeOp.elementId, {
            transform: { ...targetEl.transform, x: newX, y: newY, width: newW, height: newH },
          });
        }
      }
    };

    const handleMouseUp = () => {
      setDragOp(null);
      setResizeOp(null);
    };

    if (dragOp || resizeOp) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragOp, resizeOp, customElements, onUpdateElement]);

  // Keyboard navigation for selected custom element
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingField) return; // Don't move while actively typing text

      if (selection.type === 'custom' && selection.elementId) {
        const targetEl = customElements.find((el) => el.id === selection.elementId);
        if (!targetEl || targetEl.locked) return;

        const step = e.shiftKey ? 4 : 1;
        let dx = 0;
        let dy = 0;

        if (e.key === 'ArrowLeft') dx = -step;
        else if (e.key === 'ArrowRight') dx = step;
        else if (e.key === 'ArrowUp') dy = -step;
        else if (e.key === 'ArrowDown') dy = step;
        else if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          onDeleteElement(targetEl.id);
          onSelect({ type: 'none' });
          return;
        }

        if (dx !== 0 || dy !== 0) {
          e.preventDefault();
          onUpdateElement(targetEl.id, {
            transform: {
              ...targetEl.transform,
              x: Math.max(0, Math.min(95, targetEl.transform.x + dx)),
              y: Math.max(0, Math.min(95, targetEl.transform.y + dy)),
            },
          });
        }
      } else if (e.key === 'Escape') {
        setEditingField(null);
        setFloatingPos(null);
        onSelect({ type: 'none' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selection, customElements, editingField, onDeleteElement, onUpdateElement, onSelect]);

  // Click handler to select and position floating toolbar
  const handleElementClick = (
    e: React.MouseEvent,
    target: SelectionTarget,
    posElement?: HTMLElement | null
  ) => {
    e.stopPropagation();
    onSelect(target);

    if (canvasRef.current && posElement) {
      const cRect = canvasRef.current.getBoundingClientRect();
      const elRect = posElement.getBoundingClientRect();
      setFloatingPos({
        x: elRect.left - cRect.left + elRect.width / 2,
        y: elRect.top - cRect.top,
      });
    } else {
      setFloatingPos(null);
    }
  };

  // Helper icon component resolver
  const renderIcon = (name: string, color: string, size = 32) => {
    const iconProps = { style: { color, width: size, height: size } };
    switch (name) {
      case 'Star': return <Star {...iconProps} />;
      case 'Shield': return <Shield {...iconProps} />;
      case 'Zap': return <Zap {...iconProps} />;
      case 'TrendingUp': return <TrendingUp {...iconProps} />;
      case 'Users': return <Users {...iconProps} />;
      case 'Target': return <Target {...iconProps} />;
      case 'Rocket': return <Rocket {...iconProps} />;
      case 'Award': return <Award {...iconProps} />;
      default: return <Sparkles {...iconProps} />;
    }
  };

  return (
    <div
      ref={canvasRef}
      onClick={() => {
        onSelect({ type: 'slide' });
        setEditingField(null);
        setFloatingPos(null);
      }}
      className={`w-[1280px] h-[720px] shrink-0 rounded-2xl overflow-hidden border relative flex flex-col select-none ${className}`}
      style={{
        backgroundColor: slide.backgroundColor || p.background,
        borderColor: p.border,
        fontFamily: theme.fontFamily,
      }}
    >
      {/* Floating Toolbar on Text Selection */}
      {floatingPos && (selection.type === 'title' || selection.type === 'subtitle' || selection.type === 'kicker' || selection.type === 'custom') && (
        <FloatingTextToolbar
          position={floatingPos}
          onUpdateStyle={(updates) => {
            if (selection.type === 'custom' && selection.elementId) {
              const el = customElements.find((e) => e.id === selection.elementId);
              if (el && el.text) {
                onUpdateElement(el.id, {
                  text: { ...el.text, style: { ...el.text.style, ...updates } },
                });
              }
            }
          }}
          onAiRewrite={() => {
            const txt = selection.type === 'title' ? slide.title : slide.subtitle || '';
            onAiRewrite?.(txt);
          }}
          onDelete={
            selection.type === 'custom' && selection.elementId
              ? () => {
                  onDeleteElement(selection.elementId!);
                  setFloatingPos(null);
                }
              : undefined
          }
        />
      )}

      {/* Slide Header (Title, Subtitle, Kicker) */}
      {slide.layout !== 'title' && (
        <div className="px-10 pt-8 pb-3 shrink-0 relative z-10">
          {/* Kicker Badge */}
          {slide.kicker && (
            <div
              onClick={(e) => handleElementClick(e, { type: 'kicker' }, e.currentTarget)}
              className={`inline-block cursor-pointer px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider mb-1 border ${
                selection.type === 'kicker' ? 'ring-2 ring-black dark:ring-white border-transparent' : 'border-transparent'
              }`}
              style={{ color: p.accent }}
            >
              {editingField === 'kicker' ? (
                <input
                  type="text"
                  autoFocus
                  value={slide.kicker}
                  onChange={(e) => onUpdateSlide({ kicker: e.target.value })}
                  onBlur={() => setEditingField(null)}
                  className="bg-transparent text-[11px] font-semibold focus:outline-none"
                />
              ) : (
                <span onDoubleClick={() => setEditingField('kicker')}>{slide.kicker}</span>
              )}
            </div>
          )}

          {/* Title */}
          <div
            onClick={(e) => handleElementClick(e, { type: 'title' }, e.currentTarget)}
            className={`cursor-pointer rounded-lg px-2 py-0.5 -ml-2 transition-all ${
              selection.type === 'title' ? 'ring-2 ring-black dark:ring-white bg-black/5 dark:bg-white/5' : ''
            }`}
          >
            {editingField === 'title' ? (
              <textarea
                autoFocus
                rows={1}
                value={slide.title}
                onChange={(e) => onUpdateSlide({ title: e.target.value })}
                onBlur={() => setEditingField(null)}
                className="w-full text-2xl md:text-3xl font-bold bg-transparent focus:outline-none resize-none"
                style={{ color: p.textPrimary, fontFamily: theme.headingFont }}
              />
            ) : (
              <h2
                onDoubleClick={() => setEditingField('title')}
                className="text-2xl md:text-3xl font-bold tracking-tight"
                style={{ color: p.textPrimary, fontFamily: theme.headingFont }}
              >
                {slide.title}
              </h2>
            )}
          </div>

          {/* Subtitle */}
          {slide.subtitle && (
            <div
              onClick={(e) => handleElementClick(e, { type: 'subtitle' }, e.currentTarget)}
              className={`cursor-pointer rounded-lg px-2 py-0.5 -ml-2 mt-0.5 transition-all ${
                selection.type === 'subtitle' ? 'ring-2 ring-black dark:ring-white bg-black/5 dark:bg-white/5' : ''
              }`}
            >
              {editingField === 'subtitle' ? (
                <textarea
                  autoFocus
                  rows={2}
                  value={slide.subtitle}
                  onChange={(e) => onUpdateSlide({ subtitle: e.target.value })}
                  onBlur={() => setEditingField(null)}
                  className="w-full text-xs md:text-sm bg-transparent focus:outline-none resize-none"
                  style={{ color: p.textSecondary }}
                />
              ) : (
                <p
                  onDoubleClick={() => setEditingField('subtitle')}
                  className="text-xs md:text-sm leading-relaxed"
                  style={{ color: p.textSecondary }}
                >
                  {slide.subtitle}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Slide Layout Body */}
      <div className="px-10 pb-6 flex-1 flex flex-col overflow-hidden relative z-10">
        {/* TITLE SLIDE LAYOUT */}
        {slide.layout === 'title' && (
          <div className="flex-1 flex flex-col justify-center items-center text-center px-12 py-8">
            {slide.kicker && (
              <span
                onClick={(e) => handleElementClick(e, { type: 'kicker' }, e.currentTarget)}
                onDoubleClick={() => setEditingField('title-kicker')}
                className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-4 border cursor-pointer"
                style={{ backgroundColor: p.cardBackground, color: p.accent, borderColor: p.border }}
              >
                {slide.kicker}
              </span>
            )}
            <h1
              onClick={(e) => handleElementClick(e, { type: 'title' }, e.currentTarget)}
              onDoubleClick={() => setEditingField('title-main')}
              className="text-4xl md:text-5xl font-extrabold tracking-tight max-w-4xl leading-tight cursor-pointer"
              style={{ color: p.textPrimary, fontFamily: theme.headingFont }}
            >
              {slide.title}
            </h1>
            {slide.subtitle && (
              <p
                onClick={(e) => handleElementClick(e, { type: 'subtitle' }, e.currentTarget)}
                onDoubleClick={() => setEditingField('title-sub')}
                className="text-lg md:text-xl mt-4 max-w-2xl font-normal leading-relaxed cursor-pointer"
                style={{ color: p.textSecondary }}
              >
                {slide.subtitle}
              </p>
            )}
          </div>
        )}

        {/* 2 / 3 / 4 COLUMNS LAYOUT */}
        {(slide.layout === 'columns-2' || slide.layout === 'columns-3' || slide.layout === 'columns-4') && (
          <div
            className={`flex-1 grid grid-cols-1 md:grid-cols-${
              slide.layout === 'columns-2' ? 2 : slide.layout === 'columns-4' ? 4 : 3
            } gap-4 pt-3 items-stretch`}
          >
            {(slide.cards || []).map((c, i) => (
              <div
                key={i}
                onClick={(e) => handleElementClick(e, { type: 'card', subIndex: i }, e.currentTarget)}
                className={`p-5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
                  selection.type === 'card' && selection.subIndex === i
                    ? 'ring-2 ring-black dark:ring-white border-transparent'
                    : ''
                }`}
                style={{ backgroundColor: p.cardBackground, borderColor: p.border }}
              >
                <div>
                  {c.tag && (
                    <span
                      className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider mb-2"
                      style={{ backgroundColor: p.accent + '20', color: p.accent }}
                    >
                      {c.tag}
                    </span>
                  )}
                  <h4 className="text-sm font-semibold tracking-tight" style={{ color: p.textPrimary }}>
                    {c.title}
                  </h4>
                  {c.subtitle && (
                    <p className="text-[11px] mt-0.5 font-medium" style={{ color: p.accent }}>
                      {c.subtitle}
                    </p>
                  )}
                  <p className="text-xs mt-2.5 leading-relaxed font-normal" style={{ color: p.textSecondary }}>
                    {c.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* METRICS & STATS LAYOUT */}
        {slide.layout === 'metrics-stats' && (
          <div className="flex-1 flex flex-col justify-center pt-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(slide.stats || []).map((s, i) => (
                <div
                  key={i}
                  onClick={(e) => handleElementClick(e, { type: 'stat', subIndex: i }, e.currentTarget)}
                  className={`p-5 rounded-xl border flex flex-col items-center text-center justify-center cursor-pointer transition-all ${
                    selection.type === 'stat' && selection.subIndex === i
                      ? 'ring-2 ring-black dark:ring-white border-transparent'
                      : ''
                  }`}
                  style={{ backgroundColor: p.cardBackground, borderColor: p.border }}
                >
                  <span
                    className="text-3xl md:text-4xl font-extrabold tracking-tight font-mono"
                    style={{ color: p.accent }}
                  >
                    {s.value}
                  </span>
                  <span
                    className="text-xs font-semibold mt-2 tracking-wide uppercase"
                    style={{ color: p.textPrimary }}
                  >
                    {s.label}
                  </span>
                  {s.change && (
                    <div
                      className={`flex items-center gap-1 text-[11px] font-semibold mt-1.5 ${
                        s.trend === 'down' ? 'text-rose-500' : 'text-emerald-500'
                      }`}
                    >
                      {s.trend === 'down' ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                      <span>{s.change}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CHART DATA LAYOUT */}
        {slide.layout === 'chart-data' && (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-5 pt-2 items-center">
            <div className="md:col-span-2">
              {slide.chart ? (
                <ChartRenderer spec={slide.chart} height={250} interactive={true} />
              ) : (
                <div
                  className="h-60 rounded-xl border flex items-center justify-center text-xs"
                  style={{ backgroundColor: p.cardBackground, borderColor: p.border, color: p.textSecondary }}
                >
                  Insert or edit chart
                </div>
              )}
            </div>
            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: p.accent }}>
                Key Takeaways
              </span>
              <div className="space-y-2">
                {(slide.bullets || ['Strong upward trajectory', 'Accelerated adoption']).map((b, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg border text-xs"
                    style={{ backgroundColor: p.cardBackground, borderColor: p.border, color: p.textPrimary }}
                  >
                    {b}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SWOT LAYOUT */}
        {slide.layout === 'swot' && (
          <div className="flex-1 grid grid-cols-2 gap-3 pt-3">
            {[
              { key: 'S', title: 'Strengths', items: slide.swot?.strengths || ['High performance'], color: '#10B981' },
              { key: 'W', title: 'Weaknesses', items: slide.swot?.weaknesses || ['Resource demands'], color: '#F59E0B' },
              { key: 'O', title: 'Opportunities', items: slide.swot?.opportunities || ['Enterprise adoption'], color: '#3B82F6' },
              { key: 'T', title: 'Threats', items: slide.swot?.threats || ['Fast market shifts'], color: '#EF4444' },
            ].map((q) => (
              <div
                key={q.key}
                className="p-3.5 rounded-xl border flex flex-col"
                style={{ backgroundColor: p.cardBackground, borderColor: p.border }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ backgroundColor: q.color }}
                  >
                    {q.key}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: p.textPrimary }}>
                    {q.title}
                  </span>
                </div>
                <ul className="space-y-1">
                  {q.items.map((it, idx) => (
                    <li key={idx} className="text-[11px] leading-tight" style={{ color: p.textSecondary }}>
                      • {it}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* TIMELINE / ROADMAP LAYOUT */}
        {slide.layout === 'timeline-roadmap' && (
          <div className="flex-1 flex flex-col justify-center pt-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 relative z-10">
              {(slide.milestones || []).map((m, i) => (
                <div key={i} className="flex flex-col items-center text-center">
                  <div
                    className="w-9 h-9 rounded-full border-2 flex items-center justify-center text-xs font-bold mb-2.5"
                    style={{ backgroundColor: p.background, borderColor: p.accent, color: p.accent }}
                  >
                    {i + 1}
                  </div>
                  <span className="text-[10px] font-mono font-semibold" style={{ color: p.accent }}>
                    {m.date}
                  </span>
                  <h5 className="text-xs font-bold mt-0.5" style={{ color: p.textPrimary }}>
                    {m.title}
                  </h5>
                  <p className="text-[11px] mt-1 leading-snug" style={{ color: p.textSecondary }}>
                    {m.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CONCLUSION LAYOUT */}
        {slide.layout === 'conclusion' && (
          <div className="flex-1 flex flex-col justify-center gap-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(slide.bullets || ['Deploy locally', 'Validate benchmarks', 'Scale to production']).map((act, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl border flex flex-col"
                  style={{ backgroundColor: p.cardBackground, borderColor: p.border }}
                >
                  <span className="text-[10px] font-mono mb-1" style={{ color: p.accent }}>
                    Action 0{i + 1}
                  </span>
                  <h5 className="text-xs font-semibold" style={{ color: p.textPrimary }}>
                    {act}
                  </h5>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CUSTOM OVERLAY VISUAL ELEMENTS (Freely positioned & resizable) */}
      {customElements.map((el) => {
        if (el.hidden) return null;
        const isSelected = selection.type === 'custom' && selection.elementId === el.id;
        const t = el.transform;

        return (
          <div
            key={el.id}
            onClick={(e) => handleElementClick(e, { type: 'custom', elementId: el.id }, e.currentTarget)}
            onMouseDown={(e) => {
              if (el.locked) return;
              e.stopPropagation();
              onSelect({ type: 'custom', elementId: el.id });
              if (!canvasRef.current) return;
              const rect = canvasRef.current.getBoundingClientRect();
              const startX = ((e.clientX - rect.left) / rect.width) * 100;
              const startY = ((e.clientY - rect.top) / rect.height) * 100;
              setDragOp({
                elementId: el.id,
                startX,
                startY,
                initialX: t.x,
                initialY: t.y,
              });
            }}
            className={`absolute select-none group cursor-move ${
              isSelected ? 'ring-2 ring-black dark:ring-white ring-offset-2' : ''
            }`}
            style={{
              left: `${t.x}%`,
              top: `${t.y}%`,
              width: `${t.width}%`,
              height: `${t.height}%`,
              transform: t.rotation ? `rotate(${t.rotation}deg)` : undefined,
              zIndex: t.zIndex || 20,
            }}
          >
            {/* 1. TEXT ELEMENT */}
            {el.type === 'text' && el.text && (
              <div
                className="w-full h-full p-2 overflow-hidden flex flex-col justify-center"
                style={{
                  color: el.text.style?.color || p.textPrimary,
                  fontSize: `${el.text.style?.fontSize || 16}px`,
                  fontWeight: el.text.style?.bold ? 'bold' : 'normal',
                  fontStyle: el.text.style?.italic ? 'italic' : 'normal',
                  textDecoration: el.text.style?.underline ? 'underline' : 'none',
                  textAlign: el.text.style?.align || 'left',
                }}
              >
                {editingField === el.id ? (
                  <textarea
                    autoFocus
                    value={el.text.content}
                    onChange={(e) =>
                      onUpdateElement(el.id, {
                        text: { ...el.text!, content: e.target.value },
                      })
                    }
                    onBlur={() => setEditingField(null)}
                    className="w-full h-full bg-transparent focus:outline-none resize-none"
                  />
                ) : (
                  <div
                    onDoubleClick={() => setEditingField(el.id)}
                    className="w-full h-full break-words"
                  >
                    {el.text.content}
                  </div>
                )}
              </div>
            )}

            {/* 2. SHAPE ELEMENT */}
            {el.type === 'shape' && el.shape && (
              <div
                className="w-full h-full"
                style={{
                  backgroundColor: el.shape.fillColor || p.accent + '20',
                  borderColor: el.shape.borderColor || p.accent,
                  borderWidth: `${el.shape.borderWidth ?? 2}px`,
                  borderRadius:
                    el.shape.shapeType === 'circle'
                      ? '9999px'
                      : el.shape.shapeType === 'roundRect'
                      ? `${el.shape.borderRadius || 12}px`
                      : '0px',
                }}
              />
            )}

            {/* 3. IMAGE ELEMENT */}
            {el.type === 'image' && el.image && (
              <div className="w-full h-full rounded-xl overflow-hidden shadow-sm">
                <img
                  src={el.image.url}
                  alt={el.image.alt || 'Slide asset'}
                  className="w-full h-full pointer-events-none"
                  style={{ objectFit: el.image.fit || 'cover' }}
                />
              </div>
            )}

            {/* 4. ICON ELEMENT */}
            {el.type === 'icon' && el.icon && (
              <div className="w-full h-full flex items-center justify-center">
                {renderIcon(el.icon.name, el.icon.color || p.accent, el.icon.size || 36)}
              </div>
            )}

            {/* 5. CHART ELEMENT */}
            {el.type === 'chart' && el.chart && (
              <div className="w-full h-full rounded-xl overflow-hidden bg-white dark:bg-[#141414] border border-[#EAEAEA] dark:border-[#262626] p-2 shadow-xs">
                <ChartRenderer spec={el.chart} height={200} interactive={false} />
              </div>
            )}

            {/* 6. TABLE ELEMENT */}
            {el.type === 'table' && el.table && (
              <div className="w-full h-full rounded-xl overflow-hidden border border-[#EAEAEA] dark:border-[#262626] bg-white dark:bg-[#141414]">
                <table className="w-full h-full text-[11px] border-collapse">
                  {el.table.headers && (
                    <thead>
                      <tr className="bg-zinc-100 dark:bg-[#202020] border-b border-[#EAEAEA] dark:border-[#262626]">
                        {el.table.headers.map((h, hIdx) => (
                          <th key={hIdx} className="p-1.5 font-bold text-left border-r last:border-r-0">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {el.table.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="border-b last:border-b-0 border-[#EAEAEA] dark:border-[#262626]">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="p-1.5 border-r last:border-r-0">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 8 RESIZE HANDLES (When Selected & Not Locked) */}
            {isSelected && !el.locked && (
              <>
                {([
                  { handle: 'nw', cls: '-top-1.5 -left-1.5 cursor-nwse-resize' },
                  { handle: 'n', cls: '-top-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize' },
                  { handle: 'ne', cls: '-top-1.5 -right-1.5 cursor-nesw-resize' },
                  { handle: 'e', cls: 'top-1/2 -right-1.5 -translate-y-1/2 cursor-ew-resize' },
                  { handle: 'se', cls: '-bottom-1.5 -right-1.5 cursor-nwse-resize' },
                  { handle: 's', cls: '-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize' },
                  { handle: 'sw', cls: '-bottom-1.5 -left-1.5 cursor-nesw-resize' },
                  { handle: 'w', cls: 'top-1/2 -left-1.5 -translate-y-1/2 cursor-ew-resize' },
                ] as const).map(({ handle, cls }) => (
                  <div
                    key={handle}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      if (!canvasRef.current) return;
                      const rect = canvasRef.current.getBoundingClientRect();
                      const startX = ((e.clientX - rect.left) / rect.width) * 100;
                      const startY = ((e.clientY - rect.top) / rect.height) * 100;
                      setResizeOp({
                        elementId: el.id,
                        handle,
                        startX,
                        startY,
                        initialX: t.x,
                        initialY: t.y,
                        initialW: t.width,
                        initialH: t.height,
                      });
                    }}
                    className={`absolute w-2.5 h-2.5 bg-white border-2 border-black dark:border-white rounded-full z-30 shadow-xs ${cls}`}
                  />
                ))}
              </>
            )}
          </div>
        );
      })}

      {/* Slide Footer */}
      <div
        className="h-8 px-10 border-t flex items-center justify-between text-[10px] shrink-0 relative z-10"
        style={{ borderColor: p.border, color: p.textSecondary }}
      >
        <span>{slide.footerText || 'Zaylo Presentation Engine • Confidential'}</span>
        <span>
          {slideNumber} / {totalSlides}
        </span>
      </div>
    </div>
  );
};
