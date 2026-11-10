import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Check,
  RotateCw,
  Wand2,
  FileText,
  TrendingUp,
} from 'lucide-react';
import type { SlideSpec } from '@local-ai/shared';

interface AiSlideAssistantModalProps {
  isOpen: boolean;
  slide: SlideSpec;
  selectedText?: string;
  onClose: () => void;
  onApplyChanges: (updatedSlide: SlideSpec) => void;
}

export const AiSlideAssistantModal: React.FC<AiSlideAssistantModalProps> = ({
  isOpen,
  slide,
  selectedText,
  onClose,
  onApplyChanges,
}) => {
  const [prompt, setPrompt] = useState(selectedText ? `Polish: "${selectedText}"` : '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [proposedSlide, setProposedSlide] = useState<SlideSpec | null>(null);

  if (!isOpen) return null;

  const handleRunAiAction = (actionType: string) => {
    setIsProcessing(true);
    setTimeout(() => {
      const cloned: SlideSpec = JSON.parse(JSON.stringify(slide));

      switch (actionType) {
        case 'improve-title':
          cloned.title = cloned.title
            .replace(/^(the|a|an)\s+/i, '')
            .split(' ')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
          if (!cloned.kicker) cloned.kicker = 'EXECUTIVE INSIGHT';
          break;

        case 'make-professional':
          if (cloned.subtitle) {
            cloned.subtitle = `Strategic overview: ${cloned.subtitle}`;
          }
          if (cloned.bullets) {
            cloned.bullets = cloned.bullets.map((b) =>
              b.endsWith('.') ? b : `${b}.`
            );
          }
          break;

        case 'simplify':
          if (cloned.bullets && cloned.bullets.length > 3) {
            cloned.bullets = cloned.bullets.slice(0, 3);
          }
          if (cloned.subtitle && cloned.subtitle.length > 90) {
            cloned.subtitle = cloned.subtitle.slice(0, 85) + '...';
          }
          break;

        case 'add-metrics':
          cloned.layout = 'metrics-stats';
          cloned.stats = [
            { value: '99.9%', label: 'Efficiency Gain', change: '+3.4x', trend: 'up' },
            { value: '0.00 ms', label: 'Local Latency', change: 'Zero Wait', trend: 'up' },
            { value: '4.8 / 5', label: 'Reliability Score', change: '+18%', trend: 'up' },
            { value: '-65%', label: 'Resource Overhead', change: 'Optimized', trend: 'up' },
          ];
          break;

        case 'add-columns':
          cloned.layout = 'columns-3';
          cloned.cards = [
            { title: 'Core Strategy', description: 'Execution architecture and governance.', tag: 'Phase 1' },
            { title: 'Implementation', description: 'High-throughput deployment parameters.', tag: 'Phase 2' },
            { title: 'Measurable ROI', description: 'Operational efficiency and reliability.', tag: 'Phase 3' },
          ];
          break;

        default:
          if (prompt.trim()) {
            cloned.title = prompt.length < 40 ? prompt : cloned.title;
            cloned.subtitle = `Refined: ${prompt}`;
          }
          break;
      }

      setProposedSlide(cloned);
      setIsProcessing(false);
    }, 450);
  };

  const handleApply = () => {
    if (proposedSlide) {
      onApplyChanges(proposedSlide);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="w-full max-w-lg bg-white dark:bg-[#141414] border border-[#EAEAEA] dark:border-[#262626] rounded-2xl shadow-2xl overflow-hidden p-6 text-[#111111] dark:text-[#F5F5F5]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#EAEAEA] dark:border-[#262626]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">AI Slide Assistant</h3>
              <p className="text-xs text-zinc-500 dark:text-[#A1A1AA]">
                Intelligent in-place refinement
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-black dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Actions Grid */}
        <div className="pt-4 space-y-3">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
            Quick Actions
          </span>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleRunAiAction('improve-title')}
              className="p-2.5 rounded-xl border border-[#EAEAEA] dark:border-[#262626] hover:bg-zinc-50 dark:hover:bg-[#1E1E1E] text-left flex items-center gap-2 transition-colors"
            >
              <Wand2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Improve Title</span>
            </button>
            <button
              type="button"
              onClick={() => handleRunAiAction('make-professional')}
              className="p-2.5 rounded-xl border border-[#EAEAEA] dark:border-[#262626] hover:bg-zinc-50 dark:hover:bg-[#1E1E1E] text-left flex items-center gap-2 transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>Make Professional</span>
            </button>
            <button
              type="button"
              onClick={() => handleRunAiAction('simplify')}
              className="p-2.5 rounded-xl border border-[#EAEAEA] dark:border-[#262626] hover:bg-zinc-50 dark:hover:bg-[#1E1E1E] text-left flex items-center gap-2 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Simplify Content</span>
            </button>
            <button
              type="button"
              onClick={() => handleRunAiAction('add-metrics')}
              className="p-2.5 rounded-xl border border-[#EAEAEA] dark:border-[#262626] hover:bg-zinc-50 dark:hover:bg-[#1E1E1E] text-left flex items-center gap-2 transition-colors"
            >
              <TrendingUp className="w-3.5 h-3.5 text-violet-500 shrink-0" />
              <span>Convert to KPI Stats</span>
            </button>
          </div>

          {/* Custom Prompt */}
          <div className="pt-2">
            <label className="block text-zinc-500 font-medium text-xs mb-1">
              Custom Instruction
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Change tone to bold and direct..."
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-[#EAEAEA] dark:border-[#262626] bg-transparent text-[#111111] dark:text-[#F5F5F5] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleRunAiAction('custom')}
                disabled={isProcessing}
                className="px-3.5 py-2 text-xs font-medium rounded-xl bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
              >
                {isProcessing ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : 'Run'}
              </button>
            </div>
          </div>

          {/* Proposed Change Preview */}
          {proposedSlide && (
            <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-xs space-y-1.5 animate-in fade-in">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 block">
                Proposed Changes:
              </span>
              <div className="font-medium text-[#111111] dark:text-[#F5F5F5]">
                {proposedSlide.title}
              </div>
              {proposedSlide.subtitle && (
                <div className="text-zinc-500 dark:text-[#A1A1AA] text-[11px]">
                  {proposedSlide.subtitle}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-5 flex justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-zinc-500 hover:text-black dark:hover:text-white"
          >
            Cancel
          </button>
          {proposedSlide && (
            <button
              type="button"
              onClick={handleApply}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black dark:bg-white text-white dark:text-black font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply Changes</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
