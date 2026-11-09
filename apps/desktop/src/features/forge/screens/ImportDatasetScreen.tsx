import React, { useState } from 'react';
import {
  Upload,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Table,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import type {
  DatasetAnalysis,
  DatasetColumnMapping,
  TrainingObjective,
} from '@local-ai/shared';

interface ImportDatasetScreenProps {
  dataset: DatasetAnalysis | null;
  objective: TrainingObjective;
  trainValSplit: number;
  onSelectFile: () => Promise<void>;
  onLoadSample: (type: 'instruction' | 'conversational') => Promise<void>;
  onObjectiveChange: (obj: TrainingObjective) => void;
  onTrainValSplitChange: (split: number) => void;
  onColumnMappingChange: (mapping: DatasetColumnMapping) => void;
  onBack: () => void;
  onContinue: () => void;
}

export const ImportDatasetScreen: React.FC<ImportDatasetScreenProps> = ({
  dataset,
  objective,
  trainValSplit,
  onSelectFile,
  onLoadSample,
  onObjectiveChange,
  onTrainValSplitChange,
  onColumnMappingChange,
  onBack,
  onContinue,
}) => {
  const [exampleIndex, setExampleIndex] = useState(0);
  const [showMapping, setShowMapping] = useState(false);
  const [mapping, setMapping] = useState<DatasetColumnMapping>({});

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  const handleApplyMapping = () => {
    onColumnMappingChange(mapping);
  };

  const canProceed = dataset !== null && dataset.validRecords > 0;

  return (
    <div className="h-full flex flex-col p-6 space-y-6 overflow-y-auto">
      {/* Wizard Header */}
      <div className="flex items-center justify-between border-b border-[#202227] pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-900 dark:text-zinc-100">
            <span>Step 2 of 4</span>
            <span>•</span>
            <span>Dataset Preparation</span>
          </div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight mt-0.5">
            Import & Validate Dataset
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Provide instruction or conversational training data in JSONL or CSV format.
          </p>
        </div>

        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#14161a] border border-[#202227] text-zinc-300 hover:text-white hover:bg-[#1b1e24] text-xs font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Models</span>
        </button>
      </div>

      {/* Dataset Picker & Sample Loaders */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* File Picker Box */}
        <div
          onClick={onSelectFile}
          className="md:col-span-2 p-6 rounded-xl border border-dashed border-[#2e323b] hover:border-zinc-400 dark:hover:border-zinc-500 bg-[#101216] hover:bg-[#13161c] transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-2 group"
        >
          <div className="p-3 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 group-hover:scale-110 transition-transform">
            <Upload className="w-6 h-6" />
          </div>
          <div className="text-sm font-semibold text-zinc-200">
            {dataset ? 'Change Dataset File...' : 'Select Local Training Dataset'}
          </div>
          <p className="text-xs text-zinc-400 max-w-sm">
            Supports JSONL (instruction, prompt/completion, conversational messages) and CSV files.
          </p>
          <button className="mt-2 px-3.5 py-1.5 rounded-lg bg-[#1b1e24] border border-[#2e323b] text-zinc-200 text-xs font-medium group-hover:bg-[#252830]">
            Browse Files
          </button>
        </div>

        {/* Built-in Sample Datasets */}
        <div className="p-5 rounded-xl bg-[#121418] border border-[#202227] space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Use Verified Sample Data</span>
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Test Forge instantly without preparing a custom file using pre-validated datasets:
          </p>

          <div className="space-y-2 pt-1">
            <button
              onClick={() => onLoadSample('instruction')}
              className="w-full text-left p-2.5 rounded-lg bg-[#16181f] hover:bg-[#1e222a] border border-[#22252e] hover:border-zinc-400 dark:hover:border-zinc-600 text-xs transition-colors"
            >
              <div className="font-medium text-zinc-200">System Instruction Tuning</div>
              <div className="text-[11px] text-zinc-400 font-mono mt-0.5">5 instruction / output pairs</div>
            </button>

            <button
              onClick={() => onLoadSample('conversational')}
              className="w-full text-left p-2.5 rounded-lg bg-[#16181f] hover:bg-[#1e222a] border border-[#22252e] hover:border-zinc-400 dark:hover:border-zinc-600 text-xs transition-colors"
            >
              <div className="font-medium text-zinc-200">Customer Support Turns</div>
              <div className="text-[11px] text-zinc-400 font-mono mt-0.5">5 multi-turn dialogues</div>
            </button>
          </div>
        </div>
      </div>

      {/* Dataset Inspection Results */}
      {dataset ? (
        <div className="space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-[#121418] border border-[#202227] space-y-1">
              <div className="text-[11px] text-zinc-400">File & Size</div>
              <div className="font-semibold text-sm text-zinc-100 truncate">{dataset.fileName}</div>
              <div className="text-xs text-zinc-400 font-mono">{formatBytes(dataset.fileSizeBytes)}</div>
            </div>

            <div className="p-4 rounded-xl bg-[#121418] border border-[#202227] space-y-1">
              <div className="text-[11px] text-zinc-400">Valid Records</div>
              <div className="font-semibold text-sm text-emerald-400 font-mono">
                {dataset.validRecords} / {dataset.totalRecords}
              </div>
              <div className="text-xs text-zinc-500">
                {dataset.invalidRecords > 0 ? `${dataset.invalidRecords} invalid rows` : '100% valid'}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#121418] border border-[#202227] space-y-1">
              <div className="text-[11px] text-zinc-400">Detected Format</div>
              <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 font-mono capitalize">
                {dataset.detectedFormat.replace('_', ' ')}
              </div>
              <div className="text-xs text-zinc-500 font-mono">
                {dataset.duplicateRecords} duplicates filtered
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#121418] border border-[#202227] space-y-1">
              <div className="text-[11px] text-zinc-400">Token Distribution (p95)</div>
              <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 font-mono">
                ~{dataset.tokenLengthDistribution.p95} tokens
              </div>
              <div className="text-xs text-zinc-500 font-mono">
                avg: {dataset.tokenLengthDistribution.mean} • max: {dataset.tokenLengthDistribution.max}
              </div>
            </div>
          </div>

          {/* Invalid Records Warning if any */}
          {dataset.invalidSampleErrors.length > 0 && (
            <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-rose-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Data Quality Warnings ({dataset.invalidRecords} records skipped)</span>
              </div>
              <ul className="text-xs text-zinc-300 space-y-1 list-disc list-inside font-mono text-[11px]">
                {dataset.invalidSampleErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Column Mapping (if CSV or requested) */}
          {dataset.columns && dataset.columns.length > 0 && (
            <div className="p-4 rounded-xl bg-[#121418] border border-[#202227] space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-zinc-200">
                  CSV Column Mapping ({dataset.columns.length} columns detected)
                </div>
                <button
                  onClick={() => setShowMapping(!showMapping)}
                  className="text-xs text-zinc-900 dark:text-zinc-100 hover:underline font-medium"
                >
                  {showMapping ? 'Hide Mapping' : 'Configure Columns'}
                </button>
              </div>

              {showMapping && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#1d2026]">
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Prompt / Instruction Column</label>
                    <select
                      value={mapping.instructionColumn || mapping.promptColumn || ''}
                      onChange={(e) =>
                        setMapping({ ...mapping, instructionColumn: e.target.value, promptColumn: e.target.value })
                      }
                      className="w-full bg-[#101216] border border-[#202227] rounded-lg p-2 text-xs text-zinc-200"
                    >
                      <option value="">Auto-detect</option>
                      {dataset.columns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Response / Output Column</label>
                    <select
                      value={mapping.outputColumn || mapping.completionColumn || ''}
                      onChange={(e) =>
                        setMapping({ ...mapping, outputColumn: e.target.value, completionColumn: e.target.value })
                      }
                      className="w-full bg-[#101216] border border-[#202227] rounded-lg p-2 text-xs text-zinc-200"
                    >
                      <option value="">Auto-detect</option>
                      {dataset.columns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2 flex justify-end">
                    <button
                      onClick={handleApplyMapping}
                      className="px-3 py-1.5 rounded-lg bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black text-xs font-medium transition-colors"
                    >
                      Apply Column Mapping
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Example Records Preview Carousel */}
          {dataset.exampleRecords.length > 0 && (
            <div className="p-5 rounded-xl bg-[#121418] border border-[#202227] space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                  <Table className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
                  <span>
                    Example Record Preview ({exampleIndex + 1} of {dataset.exampleRecords.length})
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setExampleIndex(Math.max(0, exampleIndex - 1))}
                    disabled={exampleIndex === 0}
                    className="p-1.5 rounded bg-[#1b1e24] border border-[#2e323b] text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      setExampleIndex(Math.min(dataset.exampleRecords.length - 1, exampleIndex + 1))
                    }
                    disabled={exampleIndex === dataset.exampleRecords.length - 1}
                    className="p-1.5 rounded bg-[#1b1e24] border border-[#2e323b] text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="text-[11px] font-mono text-zinc-500">PROMPT / INPUT:</div>
                  <div className="p-3 rounded-lg bg-[#0c0d10] border border-[#1b1d24] text-xs text-zinc-200 font-mono whitespace-pre-wrap max-h-36 overflow-y-auto">
                    {dataset.exampleRecords[exampleIndex]?.prompt}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] font-mono text-zinc-500">EXPECTED COMPLETION / RESPONSE:</div>
                  <div className="p-3 rounded-lg bg-[#0c0d10] border border-[#1b1d24] text-xs text-emerald-300 font-mono whitespace-pre-wrap max-h-36 overflow-y-auto">
                    {dataset.exampleRecords[exampleIndex]?.response}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Training Objective & Train/Validation Split */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Objective Selector */}
            <div className="p-5 rounded-xl bg-[#121418] border border-[#202227] space-y-3">
              <div className="text-xs font-semibold text-zinc-200">Training Objective</div>
              <div className="space-y-2">
                <label
                  onClick={() => onObjectiveChange('instruction')}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    objective === 'instruction'
                      ? 'bg-[#171a22] border-black dark:border-white text-zinc-100'
                      : 'bg-[#101216] border-[#202227] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="objective"
                    checked={objective === 'instruction'}
                    onChange={() => onObjectiveChange('instruction')}
                    className="mt-0.5 accent-black dark:accent-white"
                  />
                  <div>
                    <div className="text-xs font-medium">Instruction Fine-Tuning</div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Trains the model to follow prompt directions and produce tailored responses.
                    </p>
                  </div>
                </label>

                <label
                  onClick={() => onObjectiveChange('conversational')}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    objective === 'conversational'
                      ? 'bg-[#171a22] border-black dark:border-white text-zinc-100'
                      : 'bg-[#101216] border-[#202227] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="objective"
                    checked={objective === 'conversational'}
                    onChange={() => onObjectiveChange('conversational')}
                    className="mt-0.5 accent-black dark:accent-white"
                  />
                  <div>
                    <div className="text-xs font-medium">Conversational Fine-Tuning</div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Preserves multi-turn dialogue context and system role prompts.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Train/Val Split Slider */}
            <div className="p-5 rounded-xl bg-[#121418] border border-[#202227] space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-zinc-200">Validation Split</div>
                <div className="text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100">
                  {Math.round((1 - trainValSplit) * 100)}% Train / {Math.round(trainValSplit * 100)}% Val
                </div>
              </div>

              <input
                type="range"
                min="0"
                max="0.3"
                step="0.05"
                value={trainValSplit}
                onChange={(e) => onTrainValSplitChange(parseFloat(e.target.value))}
                className="w-full accent-black dark:accent-white cursor-pointer"
              />

              <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                <span>
                  Training: {Math.max(1, Math.round(dataset.validRecords * (1 - trainValSplit)))} records
                </span>
                <span>
                  Validation: {Math.round(dataset.validRecords * trainValSplit)} records
                </span>
              </div>

              <p className="text-[11px] text-zinc-500 leading-relaxed border-t border-[#1d2026] pt-3">
                Held-out validation examples evaluate loss during training to check for overfitting without being trained on directly.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Navigation Footer */}
      <div className="border-t border-[#202227] pt-4 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#14161a] border border-[#202227] text-zinc-300 hover:text-white hover:bg-[#1b1e24] text-xs font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <button
          onClick={onContinue}
          disabled={!canProceed}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black font-medium text-xs shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span>Continue to Auto Configuration</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
