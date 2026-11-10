import React, { useState, useEffect } from 'react';
import {
  Gauge,
  Play,
  RotateCw,
  CheckCircle2,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { api } from '../../api/client';
import type { BenchmarkResult } from '@local-ai/shared';

export const BenchmarkView: React.FC = () => {
  const { installedModels, fetchServerState, fetchModels } = useAppStore();
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [currentResult, setCurrentResult] = useState<BenchmarkResult | null>(null);
  const [history, setHistory] = useState<BenchmarkResult[]>([]);

  useEffect(() => {
    if (installedModels.length > 0 && !selectedModelId) {
      setSelectedModelId(installedModels[0].modelId);
    }
    loadHistory();
  }, [installedModels]);

  const loadHistory = async () => {
    try {
      const hist = await api.invoke('benchmark:get-history', undefined);
      setHistory(hist || []);
    } catch (err) {
      console.error('Failed to load benchmark history:', err);
    }
  };

  const handleRunBenchmark = async () => {
    if (!selectedModelId || isRunning) return;
    setIsRunning(true);
    setCurrentResult(null);

    try {
      const result = await api.invoke('benchmark:run', {
        modelId: selectedModelId,
        promptTokens: 50,
        genTokens: 100,
      });
      setCurrentResult(result);
      await Promise.all([loadHistory(), fetchServerState(), fetchModels()]);
    } catch (err: any) {
      alert(`Benchmark failed: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto overflow-y-auto h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="border-b border-[#eaeaea] dark:border-[#222222] pb-4">
        <h2 className="text-sm font-semibold text-[#111111] dark:text-[#f5f5f5] flex items-center gap-2">
          <Gauge className="w-4 h-4 text-[#666666] dark:text-[#a1a1aa]" />
          Hardware & Model Inference Benchmark
        </h2>
        <p className="text-xs text-[#666666] dark:text-[#a1a1aa] mt-0.5">
          Execute real automated benchmark passes measuring true prompt ingestion speed, token generation throughput, and first-token latency on your host machine.
        </p>
      </div>

      {/* Benchmark Control Card */}
      <div className="p-6 rounded-lg bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] space-y-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <label className="text-xs font-mono text-[#666666] dark:text-[#a1a1aa]">SELECT MODEL TO TEST</label>
            <select
              value={selectedModelId}
              onChange={(e) => setSelectedModelId(e.target.value)}
              disabled={isRunning || installedModels.length === 0}
              className="bg-[#fafafa] dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] rounded px-3 py-2 text-xs font-mono text-[#111111] dark:text-[#f5f5f5] focus:outline-none block w-64"
            >
              {installedModels.length === 0 ? (
                <option value="">No models installed</option>
              ) : (
                installedModels.map((m) => (
                  <option key={m.id} value={m.modelId}>
                    {m.name} ({m.quantization})
                  </option>
                ))
              )}
            </select>
          </div>

          <button
            onClick={handleRunBenchmark}
            disabled={isRunning || installedModels.length === 0}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-black dark:bg-white hover:bg-[#222222] dark:hover:bg-[#f0f0f0] text-white dark:text-black text-xs font-medium transition-colors disabled:opacity-50 shadow-xs"
          >
            {isRunning ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin" />
                <span>Benchmarking Ingestion & Generation...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Run Benchmark Pass</span>
              </>
            )}
          </button>
        </div>

        {isRunning && (
          <div className="p-4 rounded-lg bg-[#fafafa] dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-xs text-[#111111] dark:text-[#f5f5f5] flex items-center gap-3">
            <RotateCw className="w-4 h-4 animate-spin shrink-0 text-[#666666] dark:text-[#a1a1aa]" />
            <div>
              <span className="font-semibold block">Executing real multi-stage benchmark:</span>
              1. Warmup pass → 2. Prompt processing token ingestion → 3. Generation throughput timing
            </div>
          </div>
        )}
      </div>

      {/* Latest Benchmark Result */}
      {currentResult && (
        <div className="p-6 rounded-lg bg-white dark:bg-[#141414] border border-emerald-500/40 space-y-6">
          <div className="flex items-center justify-between border-b border-[#eaeaea] dark:border-[#222222] pb-3">
            <h3 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Benchmark Results: {currentResult.modelName}
            </h3>
            <span className="text-[11px] font-mono text-[#888888] dark:text-[#737373]">
              {new Date(currentResult.timestamp).toLocaleTimeString()}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded bg-[#fafafa] dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626]">
              <div className="text-[#888888] dark:text-[#737373] text-[11px] font-mono">GENERATION SPEED</div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                {currentResult.generationTokensPerSec}{' '}
                <span className="text-xs text-[#666666] dark:text-[#a1a1aa] font-normal">tok/s</span>
              </div>
            </div>

            <div className="p-4 rounded bg-[#fafafa] dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626]">
              <div className="text-[#888888] dark:text-[#737373] text-[11px] font-mono">FIRST-TOKEN LATENCY</div>
              <div className="text-2xl font-bold text-[#111111] dark:text-[#f5f5f5] font-mono mt-1">
                {currentResult.timeToFirstTokenMs} <span className="text-xs text-[#666666] dark:text-[#a1a1aa] font-normal">ms</span>
              </div>
            </div>

            <div className="p-4 rounded bg-[#fafafa] dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626]">
              <div className="text-[#888888] dark:text-[#737373] text-[11px] font-mono">PROMPT INGESTION</div>
              <div className="text-2xl font-bold text-[#111111] dark:text-[#f5f5f5] font-mono mt-1">
                {currentResult.promptProcessingTokensPerSec}{' '}
                <span className="text-xs text-[#666666] dark:text-[#a1a1aa] font-normal">tok/s</span>
              </div>
            </div>

            <div className="p-4 rounded bg-[#fafafa] dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626]">
              <div className="text-[#888888] dark:text-[#737373] text-[11px] font-mono">TOTAL DURATION</div>
              <div className="text-2xl font-bold text-[#111111] dark:text-[#f5f5f5] font-mono mt-1">
                {(currentResult.totalDurationMs / 1000).toFixed(2)}{' '}
                <span className="text-xs text-[#666666] dark:text-[#a1a1aa] font-normal">sec</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Historical Results Table */}
      <div className="p-6 rounded-lg bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] space-y-4">
        <h3 className="text-xs font-mono uppercase tracking-wider text-[#666666] dark:text-[#a1a1aa]">Benchmark History</h3>

        <div className="border border-[#eaeaea] dark:border-[#262626] rounded-md overflow-hidden font-mono text-xs">
          <table className="w-full text-left">
            <thead className="bg-[#fafafa] dark:bg-[#191919] text-[#666666] dark:text-[#a1a1aa] text-[11px] border-b border-[#eaeaea] dark:border-[#222222]">
              <tr>
                <th className="py-2.5 px-4">MODEL</th>
                <th className="py-2.5 px-4">GENERATION SPEED</th>
                <th className="py-2.5 px-4">PROMPT SPEED</th>
                <th className="py-2.5 px-4">TTFT</th>
                <th className="py-2.5 px-4">TIMESTAMP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eaeaea] dark:divide-[#222222] text-[#111111] dark:text-[#f5f5f5]">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#888888] dark:text-[#737373] font-sans">
                    No benchmark history recorded yet. Run a benchmark pass to record performance.
                  </td>
                </tr>
              ) : (
                history.map((h) => (
                  <tr key={h.id} className="hover:bg-[#fafafa] dark:hover:bg-[#191919]">
                    <td className="py-3 px-4 font-sans font-medium text-[#111111] dark:text-[#f5f5f5]">{h.modelName}</td>
                    <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">{h.generationTokensPerSec} tok/s</td>
                    <td className="py-3 px-4 text-[#666666] dark:text-[#a1a1aa]">{h.promptProcessingTokensPerSec} tok/s</td>
                    <td className="py-3 px-4 text-[#666666] dark:text-[#a1a1aa]">{h.timeToFirstTokenMs} ms</td>
                    <td className="py-3 px-4 text-[#888888] dark:text-[#737373]">{new Date(h.timestamp).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
