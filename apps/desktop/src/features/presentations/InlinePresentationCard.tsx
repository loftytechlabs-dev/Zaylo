import React, { useState } from 'react';
import {
  Presentation,
  Download,
  Sliders,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { PresentationSpec } from '@local-ai/shared';
import { SlideCanvas } from './SlideCanvas';
import { PRESENTATION_THEMES } from './PresentationThemes';
import { PresentationStudioModal } from './PresentationStudioModal';
import { generatePptx } from './PptxGenerator';

interface InlinePresentationCardProps {
  spec: PresentationSpec;
  onUpdateSpec?: (newSpec: PresentationSpec) => void;
}

export const InlinePresentationCard: React.FC<InlinePresentationCardProps> = ({
  spec: initialSpec,
  onUpdateSpec,
}) => {
  const [currentSpec, setCurrentSpec] = useState<PresentationSpec>(initialSpec);
  const [activeSlideIdx, setActiveSlideIdx] = useState<number>(0);
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const totalSlides = currentSpec.slides.length || 1;
  const currentSlide = currentSpec.slides[activeSlideIdx] || currentSpec.slides[0];

  const handleDownloadPptx = async () => {
    try {
      setIsExporting(true);
      await generatePptx(currentSpec, `${currentSpec.title || 'Presentation'}.pptx`);
    } catch (err) {
      console.error('Failed to export PPTX:', err);
      alert('Error generating PowerPoint file.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSave = (updated: PresentationSpec) => {
    setCurrentSpec(updated);
    onUpdateSpec?.(updated);
  };

  return (
    <div className="my-3.5 rounded-2xl border border-[#EAEAEA] dark:border-[#262626] bg-white dark:bg-[#141414] overflow-hidden shadow-xs select-none">
      {/* Header bar */}
      <div className="h-12 px-4 border-b border-[#EAEAEA] dark:border-[#262626] flex items-center justify-between text-xs bg-zinc-50/60 dark:bg-[#181818]">
        <div className="flex items-center gap-2.5">
          <Presentation className="w-4 h-4 text-zinc-500" />
          <div>
            <div className="font-semibold text-[#111111] dark:text-[#F5F5F5] truncate max-w-[280px]">
              {currentSpec.title}
            </div>
            <div className="text-[10px] text-zinc-500 dark:text-[#A1A1AA]">
              {totalSlides} Slides • {PRESENTATION_THEMES[currentSpec.theme]?.label || currentSpec.theme}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Slide Navigator Controls */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-[#202020] text-zinc-600 dark:text-[#A1A1AA] text-xs font-mono mr-1">
            <button
              type="button"
              disabled={activeSlideIdx <= 0}
              onClick={() => setActiveSlideIdx((prev) => Math.max(0, prev - 1))}
              className="hover:text-black dark:hover:text-white disabled:opacity-30 p-0.5"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span>
              {activeSlideIdx + 1} / {totalSlides}
            </span>
            <button
              type="button"
              disabled={activeSlideIdx >= totalSlides - 1}
              onClick={() => setActiveSlideIdx((prev) => Math.min(totalSlides - 1, prev + 1))}
              className="hover:text-black dark:hover:text-white disabled:opacity-30 p-0.5"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsStudioOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white dark:bg-[#202020] border border-[#EAEAEA] dark:border-[#303030] hover:bg-zinc-50 dark:hover:bg-[#252525] text-[#111111] dark:text-[#F5F5F5] font-medium transition-colors"
          >
            <Sliders className="w-3 h-3" />
            <span>Open Studio</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPptx}
            disabled={isExporting}
            className="flex items-center gap-1 px-3 py-1 rounded-md bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 font-medium transition-colors shadow-xs"
          >
            <Download className="w-3 h-3" />
            <span>{isExporting ? 'Exporting...' : 'Download .pptx'}</span>
          </button>
        </div>
      </div>

      {/* Slide Canvas Live Preview */}
      <div className="p-4 bg-zinc-100/50 dark:bg-[#0A0A0A] flex justify-center">
        <div className="w-full max-w-2xl shadow-md rounded-xl overflow-hidden">
          <SlideCanvas
            slide={currentSlide}
            themeName={currentSpec.theme}
            palette={currentSpec.palette}
            slideNumber={activeSlideIdx + 1}
            totalSlides={totalSlides}
            interactive={true}
          />
        </div>
      </div>

      {/* Slide Studio Modal */}
      {isStudioOpen && (
        <PresentationStudioModal
          isOpen={true}
          initialSpec={currentSpec}
          onClose={() => setIsStudioOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
};
