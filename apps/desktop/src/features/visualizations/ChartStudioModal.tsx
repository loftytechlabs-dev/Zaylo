import React, { useState, useRef } from 'react';
import {
  X,
  Download,
  FileSpreadsheet,
  BarChart2,
  Plus,
  Trash2,
  Presentation,
  Check,
} from 'lucide-react';
import type { ChartSpec, ChartType } from '@local-ai/shared';
import { ChartRenderer } from './ChartRenderer';
import { CHART_THEMES } from './ChartThemes';
import { exportChartAsCsv, exportSvgAsPng, exportSvgAsFile } from './exportUtils';

interface ChartStudioModalProps {
  isOpen: boolean;
  initialSpec: ChartSpec;
  onClose: () => void;
  onSave?: (updatedSpec: ChartSpec) => void;
  onCreatePresentationFromChart?: (spec: ChartSpec) => void;
}

const ALL_CHART_TYPES: { type: ChartType; label: string }[] = [
  { type: 'bar', label: 'Bar' },
  { type: 'horizontal-bar', label: 'Horizontal Bar' },
  { type: 'line', label: 'Line' },
  { type: 'area', label: 'Area' },
  { type: 'pie', label: 'Pie' },
  { type: 'donut', label: 'Donut' },
  { type: 'stacked-bar', label: 'Stacked Bar' },
  { type: 'grouped-bar', label: 'Grouped Bar' },
  { type: 'combo', label: 'Combo (Bar+Line)' },
  { type: 'scatter', label: 'Scatter' },
  { type: 'bubble', label: 'Bubble' },
  { type: 'radar', label: 'Radar' },
  { type: 'histogram', label: 'Histogram' },
  { type: 'heatmap', label: 'Heatmap' },
  { type: 'waterfall', label: 'Waterfall' },
  { type: 'funnel', label: 'Funnel' },
  { type: 'treemap', label: 'Treemap' },
];

export const ChartStudioModal: React.FC<ChartStudioModalProps> = ({
  isOpen,
  initialSpec,
  onClose,
  onSave,
  onCreatePresentationFromChart,
}) => {
  const [spec, setSpec] = useState<ChartSpec>(() => JSON.parse(JSON.stringify(initialSpec)));
  const [activeTab, setActiveTab] = useState<'type' | 'theme' | 'data' | 'options'>('type');
  const [csvRawText, setCsvRawText] = useState<string>('');
  const [isCsvMode, setIsCsvMode] = useState<boolean>(false);
  const chartWrapperRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const labels = spec.labels || [];
  const primarySeries = spec.series[0] || { name: 'Series 1', data: [] };

  // Data table row edit
  const handleUpdateDataPoint = (index: number, newLabel: string, newValue: number) => {
    const newLabels = [...labels];
    newLabels[index] = newLabel;

    const newSeries = spec.series.map((s) => {
      const data = [...s.data];
      if (typeof data[index] === 'object' && data[index] !== null) {
        data[index] = { ...data[index], label: newLabel, value: newValue };
      } else {
        data[index] = newValue;
      }
      return { ...s, data };
    });

    setSpec({ ...spec, labels: newLabels, series: newSeries });
  };

  const handleAddRow = () => {
    const nextIdx = labels.length + 1;
    const newLabels = [...labels, `Item ${nextIdx}`];
    const newSeries = spec.series.map((s) => ({
      ...s,
      data: [...s.data, 50],
    }));
    setSpec({ ...spec, labels: newLabels, series: newSeries });
  };

  const handleDeleteRow = (index: number) => {
    if (labels.length <= 1) return;
    const newLabels = labels.filter((_, i) => i !== index);
    const newSeries = spec.series.map((s) => ({
      ...s,
      data: s.data.filter((_, i) => i !== index),
    }));
    setSpec({ ...spec, labels: newLabels, series: newSeries });
  };

  const handleApplyCsv = () => {
    const lines = csvRawText.trim().split('\n');
    if (lines.length < 2) return;
    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    const parsedLabels: string[] = [];
    const seriesData: number[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      if (cols.length >= 2) {
        parsedLabels.push(cols[0]);
        seriesData.push(parseFloat(cols[1]) || 0);
      }
    }

    if (parsedLabels.length > 0) {
      setSpec({
        ...spec,
        labels: parsedLabels,
        series: [{ name: headers[1] || 'Metric', data: seriesData }],
      });
      setIsCsvMode(false);
    }
  };

  const handleExportPng = () => {
    const svg = chartWrapperRef.current?.querySelector('svg');
    if (svg) {
      exportSvgAsPng(svg as SVGSVGElement, `${spec.title || 'chart'}.png`);
    }
  };

  const handleExportSvg = () => {
    const svg = chartWrapperRef.current?.querySelector('svg');
    if (svg) {
      exportSvgAsFile(svg as SVGSVGElement, `${spec.title || 'chart'}.svg`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-5xl h-[88vh] bg-white dark:bg-[#0D0D0D] border border-[#EAEAEA] dark:border-[#262626] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="h-14 px-6 border-b border-[#EAEAEA] dark:border-[#262626] flex items-center justify-between shrink-0 bg-white dark:bg-[#0D0D0D]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-[#1E1E1E] flex items-center justify-center text-zinc-900 dark:text-[#F5F5F5]">
              <BarChart2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#111111] dark:text-[#F5F5F5]">
                Chart Studio & Data Editor
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-[#A1A1AA]">
                Interactive visualization customization and export
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onCreatePresentationFromChart && (
              <button
                type="button"
                onClick={() => {
                  onCreatePresentationFromChart(spec);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-100 dark:bg-[#191919] hover:bg-zinc-200 dark:hover:bg-[#222222] text-[#111111] dark:text-[#F5F5F5] transition-colors"
                title="Create a presentation deck featuring this chart"
              >
                <Presentation className="w-3.5 h-3.5" />
                <span>Create Presentation</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportPng}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-100 dark:bg-[#191919] hover:bg-zinc-200 dark:hover:bg-[#222222] text-[#111111] dark:text-[#F5F5F5] transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PNG</span>
            </button>

            <button
              type="button"
              onClick={handleExportSvg}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-100 dark:bg-[#191919] hover:bg-zinc-200 dark:hover:bg-[#222222] text-[#111111] dark:text-[#F5F5F5] transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>SVG</span>
            </button>

            <button
              type="button"
              onClick={() => exportChartAsCsv(spec, `${spec.title || 'chart'}.csv`)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-100 dark:bg-[#191919] hover:bg-zinc-200 dark:hover:bg-[#222222] text-[#111111] dark:text-[#F5F5F5] transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onSave?.(spec);
                onClose();
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply Changes</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 ml-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-[#F5F5F5] rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Studio Body: Left Preview, Right Controls */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Chart Canvas Area */}
          <div className="flex-1 p-6 flex flex-col items-center justify-center bg-zinc-50 dark:bg-[#090909] overflow-auto">
            <div
              ref={chartWrapperRef}
              className="w-full max-w-3xl bg-white dark:bg-[#141414] border border-[#EAEAEA] dark:border-[#262626] rounded-2xl p-5 shadow-sm"
            >
              <ChartRenderer spec={spec} height={380} interactive={true} />
            </div>
          </div>

          {/* Right Configuration Inspector */}
          <div className="w-96 border-l border-[#EAEAEA] dark:border-[#262626] bg-white dark:bg-[#0D0D0D] flex flex-col shrink-0">
            {/* Inspector Navigation Tabs */}
            <div className="flex border-b border-[#EAEAEA] dark:border-[#262626] text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab('type')}
                className={`flex-1 py-3 text-center border-b-2 transition-colors ${
                  activeTab === 'type'
                    ? 'border-black dark:border-white text-[#111111] dark:text-[#F5F5F5]'
                    : 'border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-[#A1A1AA]'
                }`}
              >
                Type
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('theme')}
                className={`flex-1 py-3 text-center border-b-2 transition-colors ${
                  activeTab === 'theme'
                    ? 'border-black dark:border-white text-[#111111] dark:text-[#F5F5F5]'
                    : 'border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-[#A1A1AA]'
                }`}
              >
                Theme
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('data')}
                className={`flex-1 py-3 text-center border-b-2 transition-colors ${
                  activeTab === 'data'
                    ? 'border-black dark:border-white text-[#111111] dark:text-[#F5F5F5]'
                    : 'border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-[#A1A1AA]'
                }`}
              >
                Data
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('options')}
                className={`flex-1 py-3 text-center border-b-2 transition-colors ${
                  activeTab === 'options'
                    ? 'border-black dark:border-white text-[#111111] dark:text-[#F5F5F5]'
                    : 'border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-[#A1A1AA]'
                }`}
              >
                Options
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {/* TAB: TYPE */}
              {activeTab === 'type' && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Select Visualization Type
                  </span>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {ALL_CHART_TYPES.map(({ type, label }) => {
                      const isSelected = spec.type === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setSpec({ ...spec, type })}
                          className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                            isSelected
                              ? 'border-black dark:border-white bg-zinc-100 dark:bg-[#1E1E1E] text-black dark:text-white font-medium shadow-xs'
                              : 'border-[#EAEAEA] dark:border-[#262626] hover:bg-zinc-50 dark:hover:bg-[#141414] text-zinc-600 dark:text-[#A1A1AA]'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB: THEME */}
              {activeTab === 'theme' && (
                <div className="space-y-3">
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    10 Built-in Visual Themes
                  </span>
                  <div className="space-y-2 pt-1">
                    {Object.values(CHART_THEMES).map((thm) => {
                      const isSelected = spec.theme === thm.name;
                      return (
                        <button
                          key={thm.name}
                          type="button"
                          onClick={() => setSpec({ ...spec, theme: thm.name })}
                          className={`w-full p-2.5 rounded-xl border text-left text-xs transition-all flex items-center justify-between ${
                            isSelected
                              ? 'border-black dark:border-white bg-zinc-100 dark:bg-[#1E1E1E]'
                              : 'border-[#EAEAEA] dark:border-[#262626] hover:bg-zinc-50 dark:hover:bg-[#141414]'
                          }`}
                        >
                          <div>
                            <div className="font-medium text-[#111111] dark:text-[#F5F5F5]">
                              {thm.label}
                            </div>
                            <div className="text-[10px] text-zinc-400 mt-0.5 truncate max-w-[200px]">
                              {thm.description}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {thm.palette.slice(0, 4).map((c, i) => (
                              <span
                                key={i}
                                className="w-2.5 h-2.5 rounded-full inline-block border border-black/10"
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB: DATA */}
              {activeTab === 'data' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      Dataset Grid
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCsvMode(!isCsvMode)}
                      className="text-xs text-zinc-500 hover:text-black dark:hover:text-white underline"
                    >
                      {isCsvMode ? 'Table Mode' : 'Paste CSV'}
                    </button>
                  </div>

                  {isCsvMode ? (
                    <div className="space-y-2">
                      <textarea
                        rows={8}
                        value={csvRawText}
                        onChange={(e) => setCsvRawText(e.target.value)}
                        placeholder="Month,Revenue&#10;Jan,1200&#10;Feb,1900&#10;Mar,3000"
                        className="w-full text-xs font-mono p-2.5 rounded-xl border border-[#EAEAEA] dark:border-[#262626] bg-transparent text-[#111111] dark:text-[#F5F5F5] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCsv}
                        className="w-full py-1.5 rounded-lg bg-black dark:bg-white text-white dark:text-black text-xs font-medium"
                      >
                        Apply CSV Dataset
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
                        {labels.map((lbl, i) => {
                          const val = primarySeries.data[i];
                          const numVal =
                            typeof val === 'number'
                              ? val
                              : typeof val === 'object' && val !== null
                              ? val.value || 0
                              : 0;

                          return (
                            <div key={i} className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={lbl}
                                onChange={(e) => handleUpdateDataPoint(i, e.target.value, numVal)}
                                className="flex-1 px-2 py-1 text-xs rounded-lg border border-[#EAEAEA] dark:border-[#262626] bg-transparent text-[#111111] dark:text-[#F5F5F5]"
                              />
                              <input
                                type="number"
                                value={numVal}
                                onChange={(e) =>
                                  handleUpdateDataPoint(i, lbl, parseFloat(e.target.value) || 0)
                                }
                                className="w-20 px-2 py-1 text-xs font-mono rounded-lg border border-[#EAEAEA] dark:border-[#262626] bg-transparent text-[#111111] dark:text-[#F5F5F5]"
                              />
                              <button
                                type="button"
                                onClick={() => handleDeleteRow(i)}
                                className="p-1 text-zinc-400 hover:text-rose-500 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={handleAddRow}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg border border-dashed border-[#EAEAEA] dark:border-[#262626] hover:bg-zinc-50 dark:hover:bg-[#191919] text-zinc-600 dark:text-[#A1A1AA] transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Data Row</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: OPTIONS */}
              {activeTab === 'options' && (
                <div className="space-y-3.5 text-xs">
                  <div>
                    <label className="block text-zinc-500 font-medium mb-1">Chart Title</label>
                    <input
                      type="text"
                      value={spec.title}
                      onChange={(e) => setSpec({ ...spec, title: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-[#EAEAEA] dark:border-[#262626] bg-transparent text-[#111111] dark:text-[#F5F5F5]"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-500 font-medium mb-1">Subtitle</label>
                    <input
                      type="text"
                      value={spec.subtitle || ''}
                      onChange={(e) => setSpec({ ...spec, subtitle: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-[#EAEAEA] dark:border-[#262626] bg-transparent text-[#111111] dark:text-[#F5F5F5]"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-500 font-medium mb-1">Y-Axis Number Format</label>
                    <select
                      value={spec.yAxis?.format || 'number'}
                      onChange={(e) =>
                        setSpec({
                          ...spec,
                          yAxis: { ...spec.yAxis, format: e.target.value as any },
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-[#EAEAEA] dark:border-[#262626] bg-white dark:bg-[#141414] text-[#111111] dark:text-[#F5F5F5]"
                    >
                      <option value="number">Standard Number (1,234)</option>
                      <option value="currency">Currency ($1,234)</option>
                      <option value="percent">Percentage (25%)</option>
                    </select>
                  </div>

                  <div className="pt-2 space-y-2 border-t border-[#EAEAEA] dark:border-[#262626]">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={spec.showGrid ?? true}
                        onChange={(e) => setSpec({ ...spec, showGrid: e.target.checked })}
                        className="rounded accent-black dark:accent-white"
                      />
                      <span>Show Gridlines</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={spec.showLegend ?? true}
                        onChange={(e) => setSpec({ ...spec, showLegend: e.target.checked })}
                        className="rounded accent-black dark:accent-white"
                      />
                      <span>Show Legend</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={spec.showValues ?? false}
                        onChange={(e) => setSpec({ ...spec, showValues: e.target.checked })}
                        className="rounded accent-black dark:accent-white"
                      />
                      <span>Display Data Values on Bars</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
