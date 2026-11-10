import React, { useState } from 'react';
import {
  X,
  BarChart2,
  Sparkles,
} from 'lucide-react';
import type { ChartSpec, ChartType, ChartThemeName } from '@local-ai/shared';

interface ChartPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (spec: ChartSpec, userPrompt: string) => void;
}

export const ChartPromptModal: React.FC<ChartPromptModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
}) => {
  const [topic, setTopic] = useState('Quarterly Revenue Growth & Projections');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [theme, setTheme] = useState<ChartThemeName>('apple-inspired');
  const [csvData, setCsvData] = useState('');
  const [isCsvInput, setIsCsvInput] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let labels = ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025', 'Q1 2026 (Est)'];
    let values = [120, 185, 240, 310, 420];

    if (csvData.trim()) {
      const lines = csvData.trim().split('\n');
      if (lines.length >= 2) {
        labels = [];
        values = [];
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
          if (parts.length >= 2) {
            labels.push(parts[0]);
            values.push(parseFloat(parts[1]) || 0);
          }
        }
      }
    }

    const spec: ChartSpec = {
      id: `chart-${Date.now()}`,
      type: chartType,
      title: topic,
      subtitle: `Visualized with Zaylo Local AI Engine (${chartType.toUpperCase()})`,
      theme,
      labels,
      series: [
        {
          name: 'Performance Metric',
          data: values,
        },
      ],
      showGrid: true,
      showLegend: true,
      showValues: true,
      yAxis: {
        format: topic.toLowerCase().includes('revenue') || topic.toLowerCase().includes('sales') ? 'currency' : 'number',
      },
    };

    onGenerate(spec, `Generate a ${chartType} chart for "${topic}"`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="w-full max-w-lg bg-white dark:bg-[#141414] border border-[#EAEAEA] dark:border-[#262626] rounded-2xl shadow-2xl overflow-hidden p-6 text-[#111111] dark:text-[#F5F5F5]">
        <div className="flex items-center justify-between pb-4 border-b border-[#EAEAEA] dark:border-[#262626]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-[#1E1E1E] flex items-center justify-center text-black dark:text-white">
              <BarChart2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Generate AI Chart</h3>
              <p className="text-xs text-zinc-500 dark:text-[#A1A1AA]">
                Natural-language data visualization
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
              What would you like to visualize?
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Monthly Active Users across 2025"
              className="w-full px-3 py-2 rounded-xl border border-[#EAEAEA] dark:border-[#262626] bg-transparent text-[#111111] dark:text-[#F5F5F5] focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-zinc-600 dark:text-[#A1A1AA] mb-1">
                Chart Type
              </label>
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value as ChartType)}
                className="w-full px-2.5 py-2 rounded-xl border border-[#EAEAEA] dark:border-[#262626] bg-white dark:bg-[#191919] text-[#111111] dark:text-[#F5F5F5]"
              >
                <option value="bar">Bar Chart</option>
                <option value="horizontal-bar">Horizontal Bar</option>
                <option value="line">Line Chart</option>
                <option value="area">Area Chart</option>
                <option value="pie">Pie Chart</option>
                <option value="donut">Donut Chart</option>
                <option value="stacked-bar">Stacked Bar</option>
                <option value="grouped-bar">Grouped Bar</option>
                <option value="combo">Combo (Bar + Line)</option>
                <option value="radar">Radar Chart</option>
                <option value="funnel">Conversion Funnel</option>
                <option value="waterfall">Waterfall</option>
                <option value="heatmap">Heatmap</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-zinc-600 dark:text-[#A1A1AA] mb-1">
                Visual Theme
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as ChartThemeName)}
                className="w-full px-2.5 py-2 rounded-xl border border-[#EAEAEA] dark:border-[#262626] bg-white dark:bg-[#191919] text-[#111111] dark:text-[#F5F5F5]"
              >
                <option value="apple-inspired">Apple-inspired</option>
                <option value="minimal-white">Minimal White</option>
                <option value="premium-black">Premium Black</option>
                <option value="corporate">Corporate</option>
                <option value="editorial">Editorial</option>
                <option value="financial">Financial Dashboard</option>
                <option value="scientific">Scientific</option>
                <option value="colorful">Colorful Modern</option>
                <option value="monochrome">Minimal Monochrome</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-medium text-zinc-600 dark:text-[#A1A1AA]">
                Dataset Source
              </label>
              <button
                type="button"
                onClick={() => setIsCsvInput(!isCsvInput)}
                className="text-zinc-500 hover:text-black dark:hover:text-white underline text-[11px]"
              >
                {isCsvInput ? 'Use Auto-Generated Demo Data' : '+ Paste Custom CSV'}
              </button>
            </div>
            {isCsvInput && (
              <textarea
                rows={4}
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
                placeholder="Category,Value&#10;Product A,140&#10;Product B,210&#10;Product C,380"
                className="w-full text-xs font-mono p-2.5 rounded-xl border border-[#EAEAEA] dark:border-[#262626] bg-transparent text-[#111111] dark:text-[#F5F5F5] focus:outline-none"
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
              <span>Create Visualization</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
