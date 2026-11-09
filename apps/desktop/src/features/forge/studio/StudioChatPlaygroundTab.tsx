import React, { useState } from 'react';
import {
  MessageSquare,
  Loader2,
  AlertTriangle,
  Pause,
  Sparkles,
  Bot,
  Send,
  Clock,
} from 'lucide-react';
import type {
  TrainingJob,
  ModelComparisonRequest,
  ModelComparisonResult,
} from '@local-ai/shared';

interface StudioChatPlaygroundTabProps {
  job: TrainingJob;
  onCompare: (req: ModelComparisonRequest) => Promise<ModelComparisonResult>;
  onPauseTraining?: () => Promise<void>;
}

interface TestHistoryEntry {
  id: string;
  timestamp: number;
  prompt: string;
  result: ModelComparisonResult;
  adapterLabel: string;
}

export const StudioChatPlaygroundTab: React.FC<StudioChatPlaygroundTabProps> = ({
  job,
  onCompare,
  onPauseTraining,
}) => {
  const checkpoints = Array.isArray(job.checkpoints) ? job.checkpoints : [];
  const latestCheckpoint = checkpoints.length > 0 ? checkpoints[checkpoints.length - 1] : undefined;

  // Selected adapter path: default to final artifactPath, or latest checkpoint
  const defaultAdapter = job.artifactPath || latestCheckpoint?.path || '';
  const [selectedAdapterPath, setSelectedAdapterPath] = useState<string>(defaultAdapter);

  const [prompt, setPrompt] = useState<string>(
    'How do I run a model completely offline in Zaylo?'
  );
  const [temperature, setTemperature] = useState<number>(0.7);
  const [maxTokens, setMaxTokens] = useState<number>(128);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPausing, setIsPausing] = useState<boolean>(false);
  const [currentResult, setCurrentResult] = useState<ModelComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<TestHistoryEntry[]>([]);

  const isTrainingActive = job.status === 'TRAINING' || job.status === 'INITIALIZING';

  const handlePause = async () => {
    if (!onPauseTraining) return;
    setIsPausing(true);
    try {
      await onPauseTraining();
    } catch (err: any) {
      setError(`Failed to pause training: ${err.message}`);
    } finally {
      setIsPausing(false);
    }
  };

  const handleRunTest = async () => {
    if (!prompt.trim()) return;
    if (isTrainingActive) {
      setError(
        'Concurrent inference is blocked while training backpropagation is actively computing.'
      );
      return;
    }

    setIsLoading(true);
    setError(null);

    const adapterToUse = selectedAdapterPath || job.artifactPath || latestCheckpoint?.path;

    try {
      const result = await onCompare({
        baseModelPath: job.checkpointPath,
        adapterPath: adapterToUse || undefined,
        prompt: prompt.trim(),
        temperature,
        maxTokens,
      });

      setCurrentResult(result);

      // Determine label for history
      let adapterLabel = 'Base Weights (No adapter)';
      if (adapterToUse) {
        if (adapterToUse === job.artifactPath) {
          adapterLabel = 'Final Trained LoRA';
        } else {
          const matchCkpt = checkpoints.find((c) => c.path === adapterToUse);
          adapterLabel = matchCkpt ? `Checkpoint ${matchCkpt.step}` : 'LoRA Adapter';
        }
      }

      setHistory((prev) => [
        {
          id: `test_${Date.now()}`,
          timestamp: Date.now(),
          prompt: prompt.trim(),
          result,
          adapterLabel,
        },
        ...prev.slice(0, 9),
      ]);
    } catch (err: any) {
      setError(err.message || 'Comparison inference failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const samplePrompts = [
    'How do I run a model completely offline in Zaylo?',
    'Can I connect my mobile phone to my desktop Zaylo server?',
    'What are the key benefits of Low-Rank Adaptation (LoRA) for local fine-tuning?',
    'Summarize best practices for ensuring private data stays local.',
  ];

  return (
    <div className="space-y-6">
      {/* Concurrency Safety Lock Notice */}
      {isTrainingActive && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                Safe Concurrency Lock Active
              </h4>
              <p className="text-xs text-amber-200/90 leading-relaxed">
                Backpropagation is actively utilizing GPU/CPU compute threads. To prevent
                memory exhaustion (OOM) or process contention, model inference is safely disabled
                during active training. Testing is available immediately once training is paused or
                completed.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1 pl-8">
            <button
              onClick={handlePause}
              disabled={isPausing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-medium transition-colors"
            >
              {isPausing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Pause className="w-3.5 h-3.5" />
              )}
              <span>Pause Training to Test Model</span>
            </button>
            <span className="text-[11px] text-amber-400/80">
              Training state will be preserved and can be resumed at any time.
            </span>
          </div>
        </div>
      )}

      {/* Interactive Testing Controls Card */}
      <div className="p-5 rounded-xl bg-[#101216] border border-[#1e2128] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
            <h3 className="text-sm font-semibold text-zinc-100">Side-by-Side Prompt Tester</h3>
          </div>

          {/* Adapter Selection Dropdown */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-400">Target Adapter:</span>
            <select
              value={selectedAdapterPath}
              onChange={(e) => setSelectedAdapterPath(e.target.value)}
              disabled={isTrainingActive}
              className="px-2.5 py-1 rounded-lg bg-[#15171d] border border-[#262a34] text-zinc-200 font-mono text-xs focus:outline-none focus:border-black dark:focus:border-white"
            >
              {job.artifactPath && (
                <option value={job.artifactPath}>Final Adapter (Trained)</option>
              )}
              {checkpoints.map((c) => (
                <option key={c.path} value={c.path}>
                  Checkpoint Step {c.step} ({typeof c.loss === 'number' && !isNaN(c.loss) ? `Loss ${c.loss.toFixed(4)}` : 'Saved'})
                </option>
              ))}
              {!job.artifactPath && checkpoints.length === 0 && (
                <option value="">Base Model Only (Untrained)</option>
              )}
            </select>
          </div>
        </div>

        {/* Input Prompt Box */}
        <div className="space-y-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isTrainingActive || isLoading}
            placeholder="Enter a prompt to evaluate base vs fine-tuned responses side-by-side..."
            rows={3}
            className="w-full p-3 rounded-lg bg-[#14161b] border border-[#20232a] text-zinc-100 text-xs placeholder-zinc-500 focus:outline-none focus:border-black dark:focus:border-white resize-none font-sans"
          />

          {/* Preset Prompts */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-zinc-500 mr-1">Sample prompts:</span>
            {samplePrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => setPrompt(p)}
                disabled={isTrainingActive || isLoading}
                className="text-[11px] px-2 py-0.5 rounded bg-[#15171d] hover:bg-[#1f2229] border border-[#20242e] text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                {p.slice(0, 36)}...
              </button>
            ))}
          </div>
        </div>

        {/* Sliders & Action Button */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[#1b1e24]">
          <div className="flex items-center gap-6 text-xs">
            {/* Temperature */}
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">Temperature:</span>
              <input
                type="range"
                min="0.0"
                max="1.5"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                disabled={isTrainingActive || isLoading}
                className="w-24 accent-black dark:accent-white cursor-pointer"
              />
              <span className="font-mono text-zinc-300 w-8 text-right font-medium">
                {temperature.toFixed(1)}
              </span>
            </div>

            {/* Max Tokens */}
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">Max Tokens:</span>
              <input
                type="range"
                min="32"
                max="512"
                step="32"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value, 10))}
                disabled={isTrainingActive || isLoading}
                className="w-24 accent-black dark:accent-white cursor-pointer"
              />
              <span className="font-mono text-zinc-300 w-10 text-right font-medium">
                {maxTokens}
              </span>
            </div>
          </div>

          <button
            onClick={handleRunTest}
            disabled={isTrainingActive || isLoading || !prompt.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500 text-white dark:text-black text-xs font-semibold shadow transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Generating Dual Responses...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Test Side-by-Side</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {error}
          </div>
        )}
      </div>

      {/* Side-by-Side Results Display */}
      {currentResult && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Base Model Column */}
          <div className="p-4 rounded-xl bg-[#101216] border border-[#1e2128] space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-[#1b1e24] pb-2">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-200">Base Model (Untuned)</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
                  <Clock className="w-3 h-3 text-zinc-500" />
                  <span>{currentResult.baseDurationMs} ms</span>
                </div>
              </div>

              <div className="text-[11px] text-zinc-400 font-mono">
                Model: <span className="text-zinc-300">{job.modelName}</span>
              </div>

              <div className="p-3 rounded-lg bg-[#14161b] border border-[#20232a] text-xs text-zinc-200 leading-relaxed font-sans whitespace-pre-wrap min-h-[140px]">
                {currentResult.baseResponse || '(No response received)'}
              </div>
            </div>

            <div className="text-[10px] text-zinc-500 font-mono pt-1">
              Standard pre-trained checkpoint weights without adapter modifications.
            </div>
          </div>

          {/* Fine-Tuned Model Column */}
          <div className="p-4 rounded-xl bg-[#101216] border border-[#eaeaea] dark:border-zinc-800 space-y-3 flex flex-col justify-between shadow-sm">
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-[#1b1e24] pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Fine-Tuned Model (LoRA)
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-900 dark:text-zinc-100">
                  <Clock className="w-3 h-3 text-zinc-900 dark:text-zinc-100" />
                  <span>{currentResult.fineTunedDurationMs} ms</span>
                </div>
              </div>

              <div className="text-[11px] text-zinc-400 font-mono">
                Adapter: <span className="text-zinc-900 dark:text-zinc-100 font-semibold">{job.name}</span>
              </div>

              <div className="p-3 rounded-lg bg-[#14161b] border border-[#eaeaea] dark:border-zinc-800 text-xs text-zinc-100 leading-relaxed font-sans whitespace-pre-wrap min-h-[140px]">
                {currentResult.fineTunedResponse || '(No response received)'}
              </div>
            </div>

            <div className="text-[10px] text-zinc-500 font-mono pt-1">
              Active LoRA rank adaptation applied to attention projections.
            </div>
          </div>
        </div>
      )}

      {/* History of Prompt Runs */}
      {history.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Previous Playground Runs ({history.length})
          </h4>

          <div className="space-y-2">
            {history.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-lg bg-[#101216] border border-[#1e2128] space-y-2 text-xs"
              >
                <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                  <span className="font-semibold text-zinc-300">Prompt: "{item.prompt}"</span>
                  <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                  <div className="p-2 rounded bg-[#14161b] border border-[#20232a] text-zinc-300">
                    <span className="text-zinc-500 block mb-1">Base:</span>
                    {item.result.baseResponse}
                  </div>
                  <div className="p-2 rounded bg-[#14161b] border border-[#eaeaea] dark:border-zinc-800 text-zinc-200">
                    <span className="text-zinc-900 dark:text-zinc-100 block mb-1">Fine-Tuned ({item.adapterLabel}):</span>
                    {item.result.fineTunedResponse}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
