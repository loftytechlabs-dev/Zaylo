import React, { useState } from 'react';
import {
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Play,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type {
  TrainingJob,
  ModelComparisonRequest,
  ModelComparisonResult,
} from '@local-ai/shared';

interface TrainingResultsScreenProps {
  job: TrainingJob;
  onCompare: (req: ModelComparisonRequest) => Promise<ModelComparisonResult>;
  onOpenLibrary: () => void;
  onOpenPlayground: (modelId: string, adapterPath?: string) => void;
  onBack: () => void;
}

export const TrainingResultsScreen: React.FC<TrainingResultsScreenProps> = ({
  job,
  onCompare,
  onOpenLibrary,
  onOpenPlayground: _onOpenPlayground,
  onBack,
}) => {
  const [testPrompt, setTestPrompt] = useState(
    'Explain the primary advantages of Low-Rank Adaptation (LoRA) for local model specialization.'
  );
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(128);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<ModelComparisonResult | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const formatDuration = (start?: number, end?: number) => {
    if (!start || !end) return '—';
    const sec = Math.round((end - start) / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  const handleRunComparison = async () => {
    if (!testPrompt.trim()) return;
    setIsComparing(true);
    setComparisonError(null);

    try {
      const result = await onCompare({
        baseModelPath: job.checkpointPath,
        adapterPath: job.artifactPath,
        prompt: testPrompt.trim(),
        temperature,
        maxTokens,
      });
      setComparisonResult(result);
    } catch (err: any) {
      setComparisonError(err.message || 'Comparison execution failed');
    } finally {
      setIsComparing(false);
    }
  };

  const samplePrompts = [
    'Explain the primary advantages of Low-Rank Adaptation (LoRA) for local model specialization.',
    'Write a concise summary of how offline AI preserves data privacy.',
    'What is the function of temperature in language model sampling?',
  ];

  return (
    <div className="h-full flex flex-col p-6 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#202227] pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>Training Run Complete</span>
          </div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight mt-0.5">
            Results & Model Evaluation
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Review completed adapter artifacts, metrics, and run side-by-side comparative inference against the base model.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenLibrary}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#14161a] border border-[#202227] text-zinc-300 hover:text-white text-xs font-medium transition-colors"
          >
            <span>Model Library</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#14161a] border border-[#202227] text-zinc-300 hover:text-white text-xs font-medium transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Forge Home</span>
          </button>
        </div>
      </div>

      {/* Completion Metrics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#121418] border border-[#202227] space-y-1">
          <div className="text-[11px] text-zinc-400">Total Duration</div>
          <div className="text-base font-bold font-mono text-zinc-100">
            {formatDuration(job?.startedAt, job?.completedAt)}
          </div>
          <div className="text-xs text-zinc-500 font-mono">
            {job?.totalSteps || 0} steps across {job?.totalEpochs || 0} epochs
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#121418] border border-[#202227] space-y-1">
          <div className="text-[11px] text-zinc-400">Final Training Loss</div>
          <div className="text-base font-bold font-mono text-emerald-400">
            {typeof job?.currentLoss === 'number' && !isNaN(job.currentLoss) ? job.currentLoss.toFixed(4) : '—'}
          </div>
          <div className="text-xs text-zinc-500 font-mono">
            Lowest:{' '}
            {Array.isArray(job?.metricsHistory) && job.metricsHistory.some((m) => typeof m.loss === 'number')
              ? Math.min(
                  ...job.metricsHistory
                    .filter((m): m is typeof m & { loss: number } => typeof m.loss === 'number' && !isNaN(m.loss))
                    .map((m) => m.loss)
                ).toFixed(4)
              : '—'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#121418] border border-[#202227] space-y-1">
          <div className="text-[11px] text-zinc-400">Adapter Artifact Size</div>
          <div className="text-base font-bold font-mono text-blue-400">
            {formatBytes(job?.artifactSizeBytes)}
          </div>
          <div className="text-xs text-zinc-500 font-mono">
            Rank {job?.config?.loraRank || 16} LoRA matrix
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#121418] border border-[#202227] space-y-1">
          <div className="text-[11px] text-zinc-400">Saved Artifact</div>
          <div className="text-xs font-mono text-zinc-200 truncate mt-1">
            {job?.artifactPath || 'output/final_adapter'}
          </div>
          <div className="text-[10px] text-zinc-500 font-mono">Safetensors format</div>
        </div>
      </div>

      {/* Base vs Fine-Tuned Comparison Section */}
      <div className="p-5 rounded-xl bg-[#121418] border border-[#202227] space-y-4">
        <div className="flex items-center justify-between border-b border-[#1f2228] pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-zinc-200">
              Side-by-Side Model Comparison
            </h2>
          </div>
          <div className="text-xs text-zinc-400">
            Base: <span className="text-zinc-200">{job.modelName}</span> vs{' '}
            <span className="text-blue-400 font-medium">Base + LoRA Adapter</span>
          </div>
        </div>

        {/* Prompt Input & Generation Settings */}
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 block mb-1.5 font-medium">
              Evaluation Prompt:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                placeholder="Enter a prompt to compare generation behavior..."
                className="flex-1 bg-[#101216] border border-[#202227] rounded-lg px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-mono"
              />

              <button
                onClick={handleRunComparison}
                disabled={isComparing || !testPrompt.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isComparing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Run Comparison</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Sample Prompts */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-zinc-500">Sample Prompts:</span>
            {samplePrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => setTestPrompt(p)}
                className="px-2 py-0.5 rounded text-[11px] bg-[#171a22] hover:bg-[#1f232d] text-zinc-400 hover:text-zinc-200 border border-[#232732] transition-colors truncate max-w-xs"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Parameters row */}
          <div className="flex items-center gap-6 text-xs text-zinc-400 border-t border-[#1a1c22] pt-2">
            <div className="flex items-center gap-2">
              <span>Temperature:</span>
              <input
                type="number"
                min="0"
                max="1.5"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-16 bg-[#101216] border border-[#202227] rounded px-2 py-0.5 text-xs text-zinc-200 font-mono"
              />
            </div>

            <div className="flex items-center gap-2">
              <span>Max Tokens:</span>
              <input
                type="number"
                min="16"
                max="512"
                step="16"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                className="w-16 bg-[#101216] border border-[#202227] rounded px-2 py-0.5 text-xs text-zinc-200 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Error banner */}
        {comparisonError && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            {comparisonError}
          </div>
        )}

        {/* Comparison Output Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Base Model Output */}
          <div className="p-4 rounded-xl bg-[#0e1013] border border-[#1d2026] space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 border-b border-[#1a1c22] pb-2">
              <span className="text-zinc-300">Base Model (Unadapted)</span>
              {comparisonResult && (
                <span className="font-mono text-[11px] text-zinc-500">
                  {comparisonResult.baseDurationMs} ms
                </span>
              )}
            </div>

            <div className="min-h-36 max-h-72 overflow-y-auto text-xs text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">
              {comparisonResult
                ? comparisonResult.baseResponse
                : isComparing
                ? 'Generating response from base checkpoint...'
                : 'Click "Run Comparison" above to execute both models on the test prompt.'}
            </div>
          </div>

          {/* Fine-Tuned Model Output */}
          <div className="p-4 rounded-xl bg-[#0e1013] border border-blue-500/30 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-blue-400 border-b border-[#1a1c22] pb-2">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Fine-Tuned Model (LoRA Adapter)</span>
              </span>
              {comparisonResult && (
                <span className="font-mono text-[11px] text-blue-400">
                  {comparisonResult.fineTunedDurationMs} ms
                </span>
              )}
            </div>

            <div className="min-h-36 max-h-72 overflow-y-auto text-xs text-zinc-100 font-mono whitespace-pre-wrap leading-relaxed">
              {comparisonResult
                ? comparisonResult.fineTunedResponse
                : isComparing
                ? 'Applying LoRA adapter and generating response...'
                : 'Click "Run Comparison" above to view specialized output.'}
            </div>
          </div>
        </div>

        {/* Honest Evaluation Note */}
        <div className="p-3.5 rounded-lg bg-[#0d0e12] border border-[#1b1e26] text-[11px] text-zinc-400 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Evaluation Insight:</strong> Decreased training loss indicates optimization convergence on your dataset examples. Quality improvements should be verified against held-out prompts and task expectations.
          </p>
        </div>
      </div>
    </div>
  );
};
