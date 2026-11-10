import React, { useState } from 'react';
import {
  Scale,
  Send,
  Loader2,
  Clock,
  Sparkles,
  Bot,
  Copy,
  Check,
} from 'lucide-react';
import type { CompareRunResult, UnifiedModelOption } from '../types';
import { MarkdownRenderer } from '../utils/markdown';

interface CompareViewProps {
  baseModel?: UnifiedModelOption;
  fineTunedModel?: UnifiedModelOption;
  onRunComparison: (prompt: string) => Promise<void>;
  isComparing: boolean;
  history: CompareRunResult[];
}

export const CompareView: React.FC<CompareViewProps> = ({
  baseModel,
  fineTunedModel,
  onRunComparison,
  isComparing,
  history,
}) => {
  const [prompt, setPrompt] = useState('');
  const [copiedBase, setCopiedBase] = useState(false);
  const [copiedFt, setCopiedFt] = useState(false);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!prompt.trim() || isComparing) return;
    const p = prompt.trim();
    setPrompt('');
    onRunComparison(p);
  };

  const latestResult = history.length > 0 ? history[0] : null;

  return (
    <div className="flex-1 flex flex-col justify-between overflow-hidden p-6 space-y-4">
      {/* Top Info Banner */}
      <div className="p-3.5 rounded-xl bg-[#fafafa] dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] flex items-center justify-between text-xs text-[#111111] dark:text-[#f5f5f5] select-none shrink-0">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-[#666666] dark:text-[#a1a1aa] shrink-0" />
          <span>
            <strong>Comparative Inference Mode:</strong> Evaluating{' '}
            <strong className="text-black dark:text-white">{baseModel?.name || 'Base Model'}</strong> vs.{' '}
            <strong className="text-black dark:text-white font-semibold">{fineTunedModel?.name || 'Fine-Tuned Adapter'}</strong>{' '}
            with equivalent generation parameters.
          </span>
        </div>
      </div>

      {/* Main Dual Output Canvas */}
      <div className="flex-1 overflow-y-auto">
        {latestResult ? (
          <div className="space-y-4 max-w-5xl mx-auto">
            {/* Prompt Card */}
            <div className="p-3.5 rounded-xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] text-xs">
              <span className="text-[10px] text-[#888888] dark:text-[#737373] font-semibold uppercase tracking-wider block mb-1">
                Evaluated Prompt
              </span>
              <p className="text-[#111111] dark:text-[#f5f5f5] select-text leading-relaxed font-sans">{latestResult.prompt}</p>
            </div>

            {/* Dual Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Base Model Output Column */}
              <div className="p-4 rounded-xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] space-y-3 flex flex-col justify-between shadow-xs">
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-[#eaeaea] dark:border-[#222222] pb-2">
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-[#666666] dark:text-[#a1a1aa]" />
                      <span className="text-xs font-semibold text-[#111111] dark:text-[#f5f5f5]">
                        {baseModel?.name || 'Base Model'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#666666] dark:text-[#a1a1aa]">
                      <Clock className="w-3 h-3 text-[#888888] dark:text-[#737373]" />
                      <span>{latestResult.baseLatencyMs} ms</span>
                    </div>
                  </div>

                  <div className="text-[10px] font-mono text-[#888888] dark:text-[#737373]">
                    Pre-trained base weights (no LoRA adapter)
                  </div>

                  <div className="text-xs text-[#111111] dark:text-[#f5f5f5] leading-relaxed font-sans min-h-[160px] whitespace-pre-wrap select-text">
                    <MarkdownRenderer content={latestResult.baseResponse} />
                  </div>
                </div>

                <div className="pt-2 border-t border-[#eaeaea] dark:border-[#222222] flex justify-end">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(latestResult.baseResponse);
                      setCopiedBase(true);
                      setTimeout(() => setCopiedBase(false), 2000);
                    }}
                    className="p-1.5 rounded hover:bg-[#f5f5f5] dark:hover:bg-[#202020] text-[#666666] dark:text-[#a1a1aa] hover:text-[#111111] dark:hover:text-white transition-colors"
                    title="Copy base response"
                  >
                    {copiedBase ? <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Fine-Tuned Model Output Column */}
              <div className="p-4 rounded-xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] space-y-3 flex flex-col justify-between shadow-xs">
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-[#eaeaea] dark:border-[#222222] pb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#666666] dark:text-[#a1a1aa]" />
                      <span className="text-xs font-semibold text-[#111111] dark:text-[#f5f5f5]">
                        {fineTunedModel?.name || 'Fine-Tuned Adapter'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#666666] dark:text-[#a1a1aa]">
                      <Clock className="w-3 h-3 text-[#888888] dark:text-[#737373]" />
                      <span>{latestResult.ftLatencyMs} ms</span>
                    </div>
                  </div>

                  <div className="text-[10px] font-mono text-[#888888] dark:text-[#737373]">
                    LoRA adapter specialization
                  </div>

                  <div className="text-xs text-[#111111] dark:text-[#f5f5f5] leading-relaxed font-sans min-h-[160px] whitespace-pre-wrap select-text">
                    <MarkdownRenderer content={latestResult.ftResponse} />
                  </div>
                </div>

                <div className="pt-2 border-t border-[#eaeaea] dark:border-[#222222] flex justify-end">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(latestResult.ftResponse);
                      setCopiedFt(true);
                      setTimeout(() => setCopiedFt(false), 2000);
                    }}
                    className="p-1.5 rounded hover:bg-[#f5f5f5] dark:hover:bg-[#202020] text-[#666666] dark:text-[#a1a1aa] hover:text-[#111111] dark:hover:text-white transition-colors"
                    title="Copy fine-tuned response"
                  >
                    {copiedFt ? <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center max-w-md mx-auto text-center space-y-3 text-[#666666] dark:text-[#a1a1aa] select-none">
            <Scale className="w-10 h-10 opacity-30" />
            <h3 className="text-sm font-semibold text-[#111111] dark:text-[#f5f5f5]">No Comparison Run Yet</h3>
            <p className="text-xs">
              Enter a prompt below to execute inference concurrently across both models and compare
              stylistic adaptation, task alignment, and generation latency.
            </p>
          </div>
        )}
      </div>

      {/* Comparison Composer */}
      <form onSubmit={handleSubmit} className="max-w-5xl mx-auto w-full relative">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter a prompt to compare base model vs fine-tuned responses..."
          disabled={isComparing}
          className="w-full bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] rounded-xl pl-4 pr-24 py-3 text-xs text-[#111111] dark:text-[#f5f5f5] placeholder-[#888888] dark:placeholder-[#737373] focus:outline-none focus:border-black dark:focus:border-white font-sans shadow-xs"
        />

        <button
          type="submit"
          disabled={isComparing || !prompt.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black dark:bg-white hover:bg-[#222222] dark:hover:bg-[#f0f0f0] disabled:opacity-40 text-white dark:text-black text-xs font-semibold shadow-xs transition-colors"
        >
          {isComparing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Comparing...</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>Compare</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
