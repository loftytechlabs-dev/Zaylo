import React, { useState } from 'react';
import {
  X,
  Presentation,
  Sparkles,
} from 'lucide-react';
import type {
  PresentationSpec,
  PresentationThemeName,
  SlideSpec,
} from '@local-ai/shared';
import { PRESENTATION_THEMES } from './PresentationThemes';

interface PresentationPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (spec: PresentationSpec, userPrompt: string) => void;
}

export const PresentationPromptModal: React.FC<PresentationPromptModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
}) => {
  const [topic, setTopic] = useState('High-Performance Local AI Inference Engine');
  const [slideCount, setSlideCount] = useState<number>(6);
  const [theme, setTheme] = useState<PresentationThemeName>('apple-keynote');
  const [targetAudience, setTargetAudience] = useState('Engineering Leaders & Enterprise Architects');
  const [referenceText, setReferenceText] = useState('');
  const [showReferenceInput, setShowReferenceInput] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const slides: SlideSpec[] = [
      {
        id: 'slide-1',
        layout: 'title',
        title: topic,
        subtitle: `Next-Generation Architecture & Strategic Blueprint for ${targetAudience}`,
        kicker: 'Executive Briefing',
        footerText: 'Confidential • Zaylo AI Engine',
      },
      {
        id: 'slide-2',
        layout: 'executive-summary',
        title: 'Executive Summary',
        subtitle: 'Enterprise AI workloads require uncompromising speed, data privacy, and zero external dependency.',
        bullets: [
          'Sub-millisecond token latency using local hardware acceleration (Metal, CUDA, Vulkan).',
          'Strict on-premises data isolation guaranteeing 100% compliance with zero cloud telemetry.',
          'Seamless interoperability across OpenAI-compatible REST APIs and native SDKs.',
          'Over 68% total cost reduction compared to legacy cloud-hosted token API services.',
        ],
      },
      {
        id: 'slide-3',
        layout: 'metrics-stats',
        title: 'Key Performance Milestones',
        subtitle: 'Measurable efficiency advantages across real-world enterprise deployments',
        stats: [
          { value: '145 tok/s', label: 'Peak Inference Speed', change: '+3.2x faster', trend: 'up' },
          { value: '0.00 ms', label: 'Cloud Roundtrip Latency', change: '100% Local', trend: 'up' },
          { value: '99.99%', label: 'Engine Uptime', change: 'Zero Downtime', trend: 'up' },
          { value: '-72%', label: 'Cloud Spend Reduced', change: 'Annual ROI', trend: 'up' },
        ],
        bullets: ['Standardized benchmark against 8B parameter quantized models.'],
      },
      {
        id: 'slide-4',
        layout: 'columns-3',
        title: 'Core Architectural Pillars',
        subtitle: 'Engineered for reliability, modular expansion, and high concurrency',
        cards: [
          {
            title: 'Unified Runtime Engine',
            subtitle: 'Native C++ Execution',
            description: 'Direct GPU kernel dispatch with dynamic memory pooling and tensor parallelism.',
            tag: 'Execution',
          },
          {
            title: 'Adaptive RAG Pipeline',
            subtitle: 'Vector Indexing',
            description: 'In-memory semantic vector store supporting instant retrieval from local document corpora.',
            tag: 'Context',
          },
          {
            title: 'Multi-Persona Layer',
            subtitle: 'Instruction Profiles',
            description: 'Dynamic behavioral adaptation across Developer, Analyst, and Researcher domains without model weight reload.',
            tag: 'Intelligence',
          },
        ],
      },
    ];

    if (slideCount >= 5) {
      slides.push({
        id: 'slide-5',
        layout: 'timeline-roadmap',
        title: 'Execution Roadmap',
        subtitle: 'Strategic milestones across the next four delivery cycles',
        milestones: [
          { date: 'Phase 1', title: 'Core Server Stabilization', description: 'Cross-platform native engine deployment.', status: 'completed' },
          { date: 'Phase 2', title: 'Hardware Acceleration', description: 'Dedicated Metal & CUDA kernel tuning.', status: 'current' },
          { date: 'Phase 3', title: 'Forge LoRA Tuning', description: 'In-situ local parameter-efficient fine tuning.', status: 'upcoming' },
          { date: 'Phase 4', title: 'Autonomous Multi-Agent', description: 'Enterprise agentic workflow orchestration.', status: 'upcoming' },
        ],
      });
    }

    if (slideCount >= 6) {
      slides.push({
        id: 'slide-6',
        layout: 'conclusion',
        title: 'Recommended Next Steps',
        subtitle: 'Immediate technical execution items to initiate implementation',
        bullets: [
          'Deploy local inference engine across primary developer workstations.',
          'Connect internal knowledge documents into the local RAG indexing pipeline.',
          'Schedule technical architecture review with infrastructure stakeholders.',
        ],
      });
    }

    const spec: PresentationSpec = {
      id: `pres-${Date.now()}`,
      title: topic,
      subtitle: `Target: ${targetAudience}`,
      theme,
      slides,
    };

    onGenerate(spec, `Create a ${slideCount}-slide presentation about "${topic}" in ${theme} style.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="w-full max-w-lg bg-white dark:bg-[#141414] border border-[#EAEAEA] dark:border-[#262626] rounded-2xl shadow-2xl overflow-hidden p-6 text-[#111111] dark:text-[#F5F5F5]">
        <div className="flex items-center justify-between pb-4 border-b border-[#EAEAEA] dark:border-[#262626]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-[#1E1E1E] flex items-center justify-center text-black dark:text-white">
              <Presentation className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Generate PowerPoint (.pptx) Deck</h3>
              <p className="text-xs text-zinc-500 dark:text-[#A1A1AA]">
                AI-designed professional presentations
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="pt-4 space-y-4 text-xs">
          <div>
            <label className="block font-medium text-zinc-600 dark:text-[#A1A1AA] mb-1">
              Presentation Topic or Title
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Q4 Business Review & FY26 Projections"
              className="w-full px-3 py-2 rounded-xl border border-[#EAEAEA] dark:border-[#262626] bg-transparent text-[#111111] dark:text-[#F5F5F5] focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-zinc-600 dark:text-[#A1A1AA] mb-1">
                Slide Count
              </label>
              <select
                value={slideCount}
                onChange={(e) => setSlideCount(parseInt(e.target.value, 10))}
                className="w-full px-2.5 py-2 rounded-xl border border-[#EAEAEA] dark:border-[#262626] bg-white dark:bg-[#191919] text-[#111111] dark:text-[#F5F5F5]"
              >
                <option value={4}>4 Slides (Executive Brief)</option>
                <option value={6}>6 Slides (Standard Deck)</option>
                <option value={8}>8 Slides (Detailed Pitch)</option>
                <option value={10}>10 Slides (Comprehensive)</option>
                <option value={15}>15 Slides (Full Master Deck)</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-zinc-600 dark:text-[#A1A1AA] mb-1">
                Design Preset
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as PresentationThemeName)}
                className="w-full px-2.5 py-2 rounded-xl border border-[#EAEAEA] dark:border-[#262626] bg-white dark:bg-[#191919] text-[#111111] dark:text-[#F5F5F5]"
              >
                {Object.values(PRESENTATION_THEMES).map((thm) => (
                  <option key={thm.name} value={thm.name}>
                    {thm.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-medium text-zinc-600 dark:text-[#A1A1AA] mb-1">
              Target Audience
            </label>
            <input
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="e.g. Investors, Board of Directors, Technical Architects"
              className="w-full px-3 py-2 rounded-xl border border-[#EAEAEA] dark:border-[#262626] bg-transparent text-[#111111] dark:text-[#F5F5F5] focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-medium text-zinc-600 dark:text-[#A1A1AA]">
                Reference Material
              </label>
              <button
                type="button"
                onClick={() => setShowReferenceInput(!showReferenceInput)}
                className="text-zinc-500 hover:text-black dark:hover:text-white underline text-[11px]"
              >
                {showReferenceInput ? 'Hide Reference' : '+ Add Reference Document/Notes'}
              </button>
            </div>
            {showReferenceInput && (
              <textarea
                rows={4}
                value={referenceText}
                onChange={(e) => setReferenceText(e.target.value)}
                placeholder="Paste key notes, financial figures, or bullet points to incorporate into slides..."
                className="w-full text-xs font-sans p-2.5 rounded-xl border border-[#EAEAEA] dark:border-[#262626] bg-transparent text-[#111111] dark:text-[#F5F5F5] focus:outline-none"
              />
            )}
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-zinc-500 hover:text-black dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black dark:bg-white text-white dark:text-black font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate Presentation</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
