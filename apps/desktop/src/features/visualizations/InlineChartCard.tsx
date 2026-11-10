import React, { useState, useRef } from 'react';
import {
  BarChart2,
  Sliders,
  Download,
  FileSpreadsheet,
  Presentation,
  FileCode,
} from 'lucide-react';
import type { ChartSpec } from '@local-ai/shared';
import { ChartRenderer } from './ChartRenderer';
import { ChartStudioModal } from './ChartStudioModal';
import { exportChartAsCsv, exportSvgAsPng, exportSvgAsFile } from './exportUtils';

interface InlineChartCardProps {
  spec: ChartSpec;
  onUpdateSpec?: (newSpec: ChartSpec) => void;
  onCreatePresentation?: (spec: ChartSpec) => void;
}

export const InlineChartCard: React.FC<InlineChartCardProps> = ({
  spec: initialSpec,
  onUpdateSpec,
  onCreatePresentation,
}) => {
  const [currentSpec, setCurrentSpec] = useState<ChartSpec>(initialSpec);
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleExportPng = () => {
    const svg = cardRef.current?.querySelector('svg');
    if (svg) {
      exportSvgAsPng(svg as SVGSVGElement, `${currentSpec.title || 'chart'}.png`);
    }
  };

  const handleExportSvg = () => {
    const svg = cardRef.current?.querySelector('svg');
    if (svg) {
      exportSvgAsFile(svg as SVGSVGElement, `${currentSpec.title || 'chart'}.svg`);
    }
  };

  const handleSave = (updated: ChartSpec) => {
    setCurrentSpec(updated);
    onUpdateSpec?.(updated);
  };

  return (
    <div
      ref={cardRef}
      className="my-3.5 rounded-2xl border border-[#EAEAEA] dark:border-[#262626] bg-white dark:bg-[#141414] overflow-hidden shadow-xs select-none"
    >
      {/* Top action bar */}
      <div className="h-11 px-4 border-b border-[#EAEAEA] dark:border-[#262626] flex items-center justify-between text-xs bg-zinc-50/60 dark:bg-[#181818]">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-3.5 h-3.5 text-zinc-500" />
          <span className="font-semibold text-[#111111] dark:text-[#F5F5F5]">
            {currentSpec.title || 'Data Visualization'}
          </span>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-[#262626] text-zinc-600 dark:text-[#A1A1AA]">
            {currentSpec.type}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsStudioOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white dark:bg-[#202020] border border-[#EAEAEA] dark:border-[#303030] hover:bg-zinc-50 dark:hover:bg-[#252525] text-[#111111] dark:text-[#F5F5F5] font-medium transition-colors"
          >
            <Sliders className="w-3 h-3" />
            <span>Customize</span>
          </button>

          <button
            type="button"
            onClick={handleExportPng}
            className="p-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-[#262626] text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
            title="Download PNG image"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleExportSvg}
            className="p-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-[#262626] text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
            title="Download SVG vector"
          >
            <FileCode className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => exportChartAsCsv(currentSpec, `${currentSpec.title || 'chart'}.csv`)}
            className="p-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-[#262626] text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
            title="Download CSV dataset"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
          </button>

          {onCreatePresentation && (
            <button
              type="button"
              onClick={() => onCreatePresentation(currentSpec)}
              className="p-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-[#262626] text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
              title="Generate Presentation Deck from this chart"
            >
              <Presentation className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Live SVG Chart rendering */}
      <div className="p-3">
        <ChartRenderer spec={currentSpec} height={280} interactive={true} />
      </div>

      {/* Chart Studio Modal */}
      {isStudioOpen && (
        <ChartStudioModal
          isOpen={true}
          initialSpec={currentSpec}
          onClose={() => setIsStudioOpen(false)}
          onSave={handleSave}
          onCreatePresentationFromChart={onCreatePresentation}
        />
      )}
    </div>
  );
};
