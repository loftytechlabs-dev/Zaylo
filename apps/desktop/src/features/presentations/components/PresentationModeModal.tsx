import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { PresentationSpec } from '@local-ai/shared';
import { SlideCanvas } from '../SlideCanvas';

interface PresentationModeModalProps {
  isOpen: boolean;
  spec: PresentationSpec;
  initialSlideIndex?: number;
  onClose: () => void;
}

export const PresentationModeModal: React.FC<PresentationModeModalProps> = ({
  isOpen,
  spec,
  initialSlideIndex = 0,
  onClose,
}) => {
  const [slideIdx, setSlideIdx] = useState(initialSlideIndex);
  const total = spec.slides.length || 1;
  const currentSlide = spec.slides[slideIdx] || spec.slides[0];

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        setSlideIdx((prev) => Math.min(total - 1, prev + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        setSlideIdx((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, total, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center select-none overflow-hidden animate-in fade-in duration-200">
      {/* Top Header Controls (Hover to reveal) */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2 opacity-30 hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-colors"
          title="Exit Presentation Mode (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Full-Scale Canvas */}
      <div className="w-full h-full max-w-[94vw] max-h-[92vh] flex items-center justify-center p-4">
        <div className="w-full max-w-6xl aspect-video rounded-2xl overflow-hidden shadow-2xl">
          <SlideCanvas
            slide={currentSlide}
            themeName={spec.theme}
            palette={spec.palette}
            slideNumber={slideIdx + 1}
            totalSlides={total}
            interactive={false}
            className="w-full h-full"
          />
        </div>
      </div>

      {/* Bottom Floating Control Bar */}
      <div className="absolute bottom-6 z-50 flex items-center gap-3 px-4 py-2 rounded-full bg-black/70 border border-white/15 text-white backdrop-blur-md opacity-25 hover:opacity-100 transition-opacity">
        <button
          type="button"
          disabled={slideIdx <= 0}
          onClick={() => setSlideIdx((prev) => Math.max(0, prev - 1))}
          className="p-1 rounded-full hover:bg-white/20 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="text-xs font-mono tracking-wider">
          {slideIdx + 1} / {total}
        </span>

        <button
          type="button"
          disabled={slideIdx >= total - 1}
          onClick={() => setSlideIdx((prev) => Math.min(total - 1, prev + 1))}
          className="p-1 rounded-full hover:bg-white/20 disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-3 bg-white/20 mx-1" />

        <button
          type="button"
          onClick={onClose}
          className="text-xs text-zinc-300 hover:text-white transition-colors"
        >
          Exit
        </button>
      </div>
    </div>
  );
};
