import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';
import type { SlideSpec, PresentationThemeName, PresentationPalette } from '@local-ai/shared';
import { getPresentationTheme } from './PresentationThemes';
import { ChartRenderer } from '../visualizations/ChartRenderer';

interface SlideCanvasProps {
  slide: SlideSpec;
  themeName: PresentationThemeName;
  palette?: PresentationPalette;
  slideNumber?: number;
  totalSlides?: number;
  interactive?: boolean;
  className?: string;
}

export const SlideCanvas: React.FC<SlideCanvasProps> = ({
  slide,
  themeName,
  palette,
  slideNumber = 1,
  totalSlides = 1,
  interactive = false,
  className = '',
}) => {
  const theme = getPresentationTheme(themeName, palette);
  const p = theme.palette;

  // Render layout body
  const renderLayoutContent = () => {
    switch (slide.layout) {
      // 1. TITLE SLIDE
      case 'title':
        return (
          <div className="flex-1 flex flex-col justify-center items-center text-center px-12 py-8">
            {slide.kicker && (
              <span
                className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-4 border"
                style={{
                  backgroundColor: p.cardBackground,
                  color: p.accent,
                  borderColor: p.border,
                }}
              >
                {slide.kicker}
              </span>
            )}
            <h1
              className="text-4xl md:text-5xl font-bold tracking-tight max-w-4xl leading-tight"
              style={{ color: p.textPrimary, fontFamily: theme.headingFont }}
            >
              {slide.title}
            </h1>
            {slide.subtitle && (
              <p
                className="text-lg md:text-xl mt-4 max-w-2xl font-normal leading-relaxed"
                style={{ color: p.textSecondary }}
              >
                {slide.subtitle}
              </p>
            )}
            <div className="mt-10 flex items-center gap-4 text-xs" style={{ color: p.textSecondary }}>
              <span className="font-medium">Zaylo Presentation</span>
              <span>•</span>
              <span>CONFIDENTIAL</span>
            </div>
          </div>
        );

      // 2. EXECUTIVE SUMMARY
      case 'executive-summary':
        return (
          <div className="flex-1 flex flex-col gap-6 pt-4">
            {slide.subtitle && (
              <div
                className="p-4 rounded-xl border text-sm font-medium leading-relaxed"
                style={{
                  backgroundColor: p.cardBackground,
                  borderColor: p.border,
                  color: p.textPrimary,
                }}
              >
                <span className="font-bold" style={{ color: p.accent }}>
                  Key Takeaway:{' '}
                </span>
                {slide.subtitle}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
              {(slide.bullets || []).map((bullet, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl border flex items-start gap-3"
                  style={{
                    backgroundColor: p.cardBackground,
                    borderColor: p.border,
                  }}
                >
                  <span
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                    style={{ backgroundColor: p.accent, color: '#FFFFFF' }}
                  >
                    {i + 1}
                  </span>
                  <p className="text-xs leading-relaxed" style={{ color: p.textPrimary }}>
                    {bullet}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );

      // 3. AGENDA / TABLE OF CONTENTS
      case 'agenda':
        return (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            {(slide.bullets || []).map((item, i) => (
              <div
                key={i}
                className="p-4 rounded-xl border flex items-center gap-4 transition-all"
                style={{
                  backgroundColor: p.cardBackground,
                  borderColor: p.border,
                }}
              >
                <span
                  className="text-2xl font-bold font-mono tracking-tighter"
                  style={{ color: p.accent }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-sm font-medium" style={{ color: p.textPrimary }}>
                  {item}
                </span>
              </div>
            ))}
          </div>
        );

      // 4. COLUMNS (2, 3, 4)
      case 'columns-2':
      case 'columns-3':
      case 'columns-4': {
        const colCount = slide.layout === 'columns-2' ? 2 : slide.layout === 'columns-4' ? 4 : 3;
        const cards = slide.cards || [];

        return (
          <div
            className={`flex-1 grid grid-cols-1 md:grid-cols-${colCount} gap-4 pt-4 items-stretch`}
          >
            {cards.map((c, i) => (
              <div
                key={i}
                className="p-5 rounded-xl border flex flex-col justify-between"
                style={{
                  backgroundColor: p.cardBackground,
                  borderColor: p.border,
                }}
              >
                <div>
                  {c.tag && (
                    <span
                      className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider mb-2"
                      style={{
                        backgroundColor: p.accent + '20',
                        color: p.accent,
                      }}
                    >
                      {c.tag}
                    </span>
                  )}
                  <h4
                    className="text-sm font-semibold tracking-tight"
                    style={{ color: p.textPrimary }}
                  >
                    {c.title}
                  </h4>
                  {c.subtitle && (
                    <p className="text-[11px] mt-0.5 font-medium" style={{ color: p.accent }}>
                      {c.subtitle}
                    </p>
                  )}
                  <p
                    className="text-xs mt-2.5 leading-relaxed font-normal"
                    style={{ color: p.textSecondary }}
                  >
                    {c.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        );
      }

      // 5. METRICS & STATISTICS
      case 'metrics-stats': {
        const stats = slide.stats || [];
        return (
          <div className="flex-1 flex flex-col justify-center pt-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.map((s, i) => (
                <div
                  key={i}
                  className="p-5 rounded-xl border flex flex-col items-center text-center justify-center"
                  style={{
                    backgroundColor: p.cardBackground,
                    borderColor: p.border,
                  }}
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
                      {s.trend === 'down' ? (
                        <TrendingDown className="w-3 h-3" />
                      ) : (
                        <TrendingUp className="w-3 h-3" />
                      )}
                      <span>{s.change}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {slide.bullets && slide.bullets.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-3 justify-center">
                {slide.bullets.map((b, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-lg text-xs border"
                    style={{
                      backgroundColor: p.cardBackground,
                      borderColor: p.border,
                      color: p.textSecondary,
                    }}
                  >
                    • {b}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      }

      // 6. ARCHITECTURE / SYSTEM FLOW
      case 'architecture-flow': {
        const nodes = slide.architectureNodes || [];
        return (
          <div className="flex-1 flex flex-col justify-center pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {nodes.map((node, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl border flex flex-col items-center text-center relative"
                  style={{
                    backgroundColor: p.cardBackground,
                    borderColor: p.border,
                  }}
                >
                  <span
                    className="text-[10px] font-mono uppercase tracking-wider mb-1"
                    style={{ color: p.textSecondary }}
                  >
                    {node.layer || `Layer ${i + 1}`}
                  </span>
                  <h5 className="text-xs font-bold" style={{ color: p.textPrimary }}>
                    {node.label}
                  </h5>
                  <p className="text-[10px] mt-1" style={{ color: p.textSecondary }}>
                    {node.role}
                  </p>
                </div>
              ))}
            </div>
            {slide.bullets && (
              <div className="mt-6 space-y-1.5">
                {slide.bullets.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs" style={{ color: p.textPrimary }}>
                    <CheckCircle className="w-3.5 h-3.5 shrink-0" style={{ color: p.accent }} />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }

      // 7. TIMELINE / ROADMAP
      case 'timeline-roadmap': {
        const milestones = slide.milestones || [];
        return (
          <div className="flex-1 flex flex-col justify-center pt-4">
            <div className="relative">
              {/* Connector line */}
              <div
                className="absolute top-5 left-6 right-6 h-0.5 -z-0"
                style={{ backgroundColor: p.border }}
              />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 relative z-10">
                {milestones.map((m, i) => (
                  <div key={i} className="flex flex-col items-center text-center">
                    <div
                      className="w-10 h-10 rounded-full border-2 flex items-center justify-center text-xs font-bold mb-3"
                      style={{
                        backgroundColor: p.background,
                        borderColor: p.accent,
                        color: p.accent,
                      }}
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
          </div>
        );
      }

      // 8. PROCESS / STEP-BY-STEP
      case 'process-steps': {
        const steps = slide.steps || [];
        return (
          <div className="flex-1 flex items-center gap-3 pt-4">
            {steps.map((st, i) => (
              <React.Fragment key={i}>
                <div
                  className="flex-1 p-4 rounded-xl border flex flex-col"
                  style={{
                    backgroundColor: p.cardBackground,
                    borderColor: p.border,
                  }}
                >
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold mb-2"
                    style={{ backgroundColor: p.accent, color: '#FFFFFF' }}
                  >
                    {st.stepNumber || i + 1}
                  </span>
                  <h5 className="text-xs font-bold" style={{ color: p.textPrimary }}>
                    {st.title}
                  </h5>
                  <p className="text-[11px] mt-1 leading-relaxed" style={{ color: p.textSecondary }}>
                    {st.description}
                  </p>
                </div>
                {i < steps.length - 1 && (
                  <ArrowRight
                    className="w-4 h-4 shrink-0"
                    style={{ color: p.textSecondary }}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        );
      }

      // 9. SWOT ANALYSIS
      case 'swot': {
        const swot = slide.swot || {
          strengths: ['High performance', 'Zero latency'],
          weaknesses: ['Resource demands'],
          opportunities: ['Enterprise adoption'],
          threats: ['Fast market shifts'],
        };

        const quadrants = [
          { key: 'S', title: 'Strengths', items: swot.strengths, color: '#10B981' },
          { key: 'W', title: 'Weaknesses', items: swot.weaknesses, color: '#F59E0B' },
          { key: 'O', title: 'Opportunities', items: swot.opportunities, color: '#3B82F6' },
          { key: 'T', title: 'Threats', items: swot.threats, color: '#EF4444' },
        ];

        return (
          <div className="flex-1 grid grid-cols-2 gap-3 pt-3">
            {quadrants.map((q) => (
              <div
                key={q.key}
                className="p-3.5 rounded-xl border flex flex-col"
                style={{
                  backgroundColor: p.cardBackground,
                  borderColor: p.border,
                }}
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
                    <li
                      key={idx}
                      className="text-[11px] leading-tight"
                      style={{ color: p.textSecondary }}
                    >
                      • {it}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        );
      }

      // 10. CHART & DATA
      case 'chart-data':
        return (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-5 pt-2 items-center">
            <div className="md:col-span-2">
              {slide.chart ? (
                <ChartRenderer spec={slide.chart} height={240} interactive={interactive} />
              ) : (
                <div
                  className="h-60 rounded-xl border flex items-center justify-center text-xs"
                  style={{
                    backgroundColor: p.cardBackground,
                    borderColor: p.border,
                    color: p.textSecondary,
                  }}
                >
                  Chart preview area
                </div>
              )}
            </div>
            <div className="space-y-3">
              <span
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: p.accent }}
              >
                Key Takeaways
              </span>
              <div className="space-y-2">
                {(slide.bullets || ['Strong upward trajectory', 'Accelerated adoption']).map(
                  (b, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg border text-xs"
                      style={{
                        backgroundColor: p.cardBackground,
                        borderColor: p.border,
                        color: p.textPrimary,
                      }}
                    >
                      {b}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        );

      // 11. QUOTE
      case 'quote': {
        const q = slide.quote || {
          quote: 'Innovation distinguishes between a leader and a follower.',
          author: 'Steve Jobs',
          role: 'Apple Inc.',
        };
        return (
          <div className="flex-1 flex flex-col justify-center items-center text-center px-8">
            <span
              className="text-6xl font-serif leading-none select-none"
              style={{ color: p.accent }}
            >
              “
            </span>
            <p
              className="text-xl md:text-2xl font-medium max-w-2xl leading-relaxed italic"
              style={{ color: p.textPrimary }}
            >
              {q.quote}
            </p>
            <div className="mt-4">
              <div className="text-sm font-semibold" style={{ color: p.textPrimary }}>
                {q.author}
              </div>
              {q.role && (
                <div className="text-xs" style={{ color: p.textSecondary }}>
                  {q.role}
                </div>
              )}
            </div>
          </div>
        );
      }

      // 12. CONCLUSION / NEXT STEPS
      case 'conclusion':
        return (
          <div className="flex-1 flex flex-col justify-center gap-5 pt-3">
            {slide.subtitle && (
              <div
                className="p-4 rounded-xl border text-sm"
                style={{
                  backgroundColor: p.cardBackground,
                  borderColor: p.border,
                  color: p.textPrimary,
                }}
              >
                {slide.subtitle}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(slide.bullets || ['Finalize specification', 'Begin implementation', 'Deploy to production']).map(
                (act, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl border flex flex-col"
                    style={{
                      backgroundColor: p.cardBackground,
                      borderColor: p.border,
                    }}
                  >
                    <span className="text-[10px] font-mono mb-1" style={{ color: p.accent }}>
                      Action Item {i + 1}
                    </span>
                    <h5 className="text-xs font-semibold" style={{ color: p.textPrimary }}>
                      {act}
                    </h5>
                  </div>
                )
              )}
            </div>
          </div>
        );

      default:
        return (
          <div className="flex-1 flex flex-col justify-center">
            <ul className="space-y-2">
              {(slide.bullets || []).map((b, i) => (
                <li key={i} className="text-sm" style={{ color: p.textPrimary }}>
                  • {b}
                </li>
              ))}
            </ul>
          </div>
        );
    }
  };

  return (
    <div
      className={`aspect-video w-full rounded-xl overflow-hidden border shadow-sm relative flex flex-col select-none transition-all ${className}`}
      style={{
        backgroundColor: p.background,
        borderColor: p.border,
        fontFamily: theme.fontFamily,
      }}
    >
      {/* Slide Header (Except Title Slide) */}
      {slide.layout !== 'title' && (
        <div className="px-8 pt-6 pb-2 shrink-0">
          {slide.kicker && (
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: p.accent }}
            >
              {slide.kicker}
            </span>
          )}
          <h2
            className="text-xl md:text-2xl font-bold tracking-tight mt-0.5"
            style={{ color: p.textPrimary, fontFamily: theme.headingFont }}
          >
            {slide.title}
          </h2>
          {slide.subtitle && slide.layout !== 'executive-summary' && slide.layout !== 'conclusion' && (
            <p className="text-xs mt-1" style={{ color: p.textSecondary }}>
              {slide.subtitle}
            </p>
          )}
        </div>
      )}

      {/* Main Slide Body */}
      <div className="px-8 pb-4 flex-1 flex flex-col overflow-hidden">
        {renderLayoutContent()}
      </div>

      {/* Slide Footer */}
      <div
        className="h-8 px-8 border-t flex items-center justify-between text-[10px] shrink-0"
        style={{
          borderColor: p.border,
          color: p.textSecondary,
        }}
      >
        <span>{slide.footerText || 'Zaylo Local AI Presentation Engine'}</span>
        <span>
          {slideNumber} / {totalSlides}
        </span>
      </div>
    </div>
  );
};
