import React, { useState } from 'react';
import {
  Copy,
  Check,
  RotateCw,
  Clock,
  Zap,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  BookmarkPlus,
} from 'lucide-react';
import type { ChatMessage, ChatMessageContentPart, ChartSpec, PresentationSpec } from '@local-ai/shared';
import { MarkdownRenderer } from '../utils/markdown';
import { parseMessageSpecs } from '../utils/specParser';
import { InlineChartCard } from '../../visualizations/InlineChartCard';
import { InlinePresentationCard } from '../../presentations/InlinePresentationCard';
import { PresentationStudioModal } from '../../presentations/PresentationStudioModal';
import { createPresentationFromChart } from '../../presentations/ReferenceParser';
import type { InferenceGenerationStats } from '../types';

interface MessageBubbleProps {
  message: ChatMessage;
  index: number;
  isStreaming?: boolean;
  modelName?: string;
  stats?: InferenceGenerationStats;
  onRegenerate?: () => void;
  onRetry?: () => void;
  onOpenPresentationStudio?: (spec: PresentationSpec) => void;
  onSaveToMemory?: (text: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isStreaming,
  modelName,
  stats,
  onRegenerate,
  onOpenPresentationStudio,
  onSaveToMemory,
}) => {
  const [copied, setCopied] = useState(false);
  const [savedMem, setSavedMem] = useState(false);
  const [feedback, setFeedback] = useState<'liked' | 'disliked' | null>(null);
  const [generatedDeck, setGeneratedDeck] = useState<PresentationSpec | null>(null);
  const isUser = message.role === 'user';

  const extractRawText = (content: string | ChatMessageContentPart[]): string => {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .map((p) => (p.type === 'text' ? p.text : ''))
        .filter(Boolean)
        .join('\n');
    }
    return '';
  };

  const rawText = extractRawText(message.content);
  const parsed = parseMessageSpecs(rawText);

  const handleCopy = () => {
    navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreatePresentationFromChart = (chart: ChartSpec) => {
    const deck = createPresentationFromChart(chart);
    if (onOpenPresentationStudio) {
      onOpenPresentationStudio(deck);
    } else {
      setGeneratedDeck(deck);
    }
  };

  if (isUser) {
    return (
      <div className="flex justify-end w-full py-2">
        <div className="max-w-[80%] rounded-2xl px-4 py-2.5 bg-[#f5f5f5] dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-[#111111] dark:text-[#F5F5F5] text-sm leading-relaxed break-words shadow-xs select-text">
          {typeof message.content === 'string' ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : Array.isArray(message.content) ? (
            <div className="space-y-2">
              {message.content.map((part, pIdx) => {
                if (part.type === 'image_url') {
                  return (
                    <div key={pIdx} className="rounded-xl overflow-hidden max-w-sm my-1 border border-zinc-200 dark:border-[#262626]">
                      <img src={part.image_url.url} alt="Attachment" className="max-h-60 w-auto object-contain rounded" />
                    </div>
                  );
                }
                if (part.type === 'text') {
                  return <p key={pIdx} className="whitespace-pre-wrap">{part.text}</p>;
                }
                return null;
              })}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // AI Response: Clean Document Style
  return (
    <div className="w-full py-4 text-sm select-text group">
      {/* Model Name Indicator */}
      {modelName && (
        <div className="text-[11px] font-mono text-zinc-400 dark:text-[#737373] mb-2 flex items-center gap-1.5 select-none">
          <Sparkles className="w-3 h-3 text-zinc-400 dark:text-[#737373]" />
          <span>{modelName}</span>
        </div>
      )}

      {/* Content Rendering */}
      <div className="prose dark:prose-invert max-w-none text-[#111111] dark:text-[#F5F5F5] leading-relaxed break-words">
        {typeof message.content === 'string' ? (
          <div>
            {parsed.cleanContent && <MarkdownRenderer content={parsed.cleanContent} />}
            {isStreaming && (
              <span className="inline-block w-1.5 h-4 ml-1 bg-zinc-900 dark:bg-white animate-pulse align-middle" />
            )}
          </div>
        ) : Array.isArray(message.content) ? (
          <div className="space-y-2">
            {message.content.map((part, pIdx) => {
              if (part.type === 'image_url') {
                return (
                  <div key={pIdx} className="rounded-xl overflow-hidden max-w-sm my-2 border border-zinc-200 dark:border-[#262626]">
                    <img src={part.image_url.url} alt="Output visual" className="max-h-64 w-auto object-contain" />
                  </div>
                );
              }
              if (part.type === 'text') {
                const subParsed = parseMessageSpecs(part.text);
                return subParsed.cleanContent ? <MarkdownRenderer key={pIdx} content={subParsed.cleanContent} /> : null;
              }
              return null;
            })}
          </div>
        ) : null}

        {/* Embedded Charts (if any detected) */}
        {!isStreaming && parsed.charts.length > 0 && (
          <div className="space-y-3 my-2 not-prose">
            {parsed.charts.map((chart, cIdx) => (
              <InlineChartCard
                key={chart.id || cIdx}
                spec={chart}
                onCreatePresentation={handleCreatePresentationFromChart}
              />
            ))}
          </div>
        )}

        {/* Embedded Presentations (if any detected) */}
        {!isStreaming && parsed.presentations.length > 0 && (
          <div className="space-y-3 my-2 not-prose">
            {parsed.presentations.map((pres, pIdx) => (
              <InlinePresentationCard
                key={pres.id || pIdx}
                spec={pres}
              />
            ))}
          </div>
        )}
      </div>

      {/* Active Studio Modal if user created deck from inline chart */}
      {generatedDeck && (
        <PresentationStudioModal
          isOpen={true}
          initialSpec={generatedDeck}
          onClose={() => setGeneratedDeck(null)}
        />
      )}


      {/* AI Response Actions Row */}
      {!isStreaming && rawText && (
        <div className="mt-3.5 flex items-center justify-between text-xs text-zinc-400 dark:text-[#737373] select-none">
          <div className="flex items-center gap-1">
            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-[#202020] text-zinc-400 dark:text-[#A1A1AA] hover:text-zinc-800 dark:hover:text-[#F5F5F5] transition-colors"
              title="Copy response"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {/* Regenerate Button */}
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-[#202020] text-zinc-400 dark:text-[#A1A1AA] hover:text-zinc-800 dark:hover:text-[#F5F5F5] transition-colors"
                title="Regenerate response"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Like */}
            <button
              onClick={() => setFeedback(feedback === 'liked' ? null : 'liked')}
              className={`p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-[#202020] transition-colors ${
                feedback === 'liked' ? 'text-black dark:text-white' : 'text-zinc-400 dark:text-[#A1A1AA] hover:text-zinc-800 dark:hover:text-[#F5F5F5]'
              }`}
              title="Good response"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>

            {/* Dislike */}
            <button
              onClick={() => setFeedback(feedback === 'disliked' ? null : 'disliked')}
              className={`p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-[#202020] transition-colors ${
                feedback === 'disliked' ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-400 dark:text-[#A1A1AA] hover:text-zinc-800 dark:hover:text-[#F5F5F5]'
              }`}
              title="Bad response"
            >
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>

            {onSaveToMemory && (
              <button
                onClick={() => {
                  onSaveToMemory(rawText);
                  setSavedMem(true);
                  setTimeout(() => setSavedMem(false), 2000);
                }}
                className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-[#202020] text-zinc-400 dark:text-[#A1A1AA] hover:text-zinc-800 dark:hover:text-[#F5F5F5] transition-colors"
                title="Save to LoftyDB Memory"
              >
                {savedMem ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <BookmarkPlus className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>

          {/* Performance Stats Pill */}
          {stats && (
            <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400 dark:text-[#737373]">
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-emerald-500" />
                {stats.tokensPerSec} tok/s
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {stats.latencyMs} ms
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
