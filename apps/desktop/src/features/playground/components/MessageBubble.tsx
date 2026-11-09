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
} from 'lucide-react';
import type { ChatMessage, ChatMessageContentPart } from '@local-ai/shared';
import { MarkdownRenderer } from '../utils/markdown';
import type { InferenceGenerationStats } from '../types';

interface MessageBubbleProps {
  message: ChatMessage;
  index: number;
  isStreaming?: boolean;
  modelName?: string;
  stats?: InferenceGenerationStats;
  onRegenerate?: () => void;
  onRetry?: () => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isStreaming,
  modelName,
  stats,
  onRegenerate,
}) => {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'liked' | 'disliked' | null>(null);
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

  const handleCopy = () => {
    navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isUser) {
    return (
      <div className="flex justify-end w-full py-2">
        <div className="max-w-[80%] rounded-2xl px-4 py-2.5 bg-[#f4f4f5] dark:bg-[#1e2026] text-[#111111] dark:text-[#f4f4f5] text-sm leading-relaxed break-words shadow-xs select-text">
          {typeof message.content === 'string' ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : Array.isArray(message.content) ? (
            <div className="space-y-2">
              {message.content.map((part, pIdx) => {
                if (part.type === 'image_url') {
                  return (
                    <div key={pIdx} className="rounded-xl overflow-hidden max-w-sm my-1 border border-zinc-200 dark:border-zinc-700">
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
        <div className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 mb-2 flex items-center gap-1.5 select-none">
          <Sparkles className="w-3 h-3 text-zinc-400" />
          <span>{modelName}</span>
        </div>
      )}

      {/* Content Rendering */}
      <div className="prose dark:prose-invert max-w-none text-[#111111] dark:text-[#f4f4f5] leading-relaxed break-words">
        {typeof message.content === 'string' ? (
          <div>
            <MarkdownRenderer content={message.content} />
            {isStreaming && (
              <span className="inline-block w-1.5 h-4 ml-1 bg-zinc-900 dark:bg-zinc-100 animate-pulse align-middle" />
            )}
          </div>
        ) : Array.isArray(message.content) ? (
          <div className="space-y-2">
            {message.content.map((part, pIdx) => {
              if (part.type === 'image_url') {
                return (
                  <div key={pIdx} className="rounded-xl overflow-hidden max-w-sm my-2 border border-zinc-200 dark:border-zinc-800">
                    <img src={part.image_url.url} alt="Output visual" className="max-h-64 w-auto object-contain" />
                  </div>
                );
              }
              if (part.type === 'text') {
                return <MarkdownRenderer key={pIdx} content={part.text} />;
              }
              return null;
            })}
          </div>
        ) : null}
      </div>

      {/* AI Response Actions Row */}
      {!isStreaming && rawText && (
        <div className="mt-3.5 flex items-center justify-between text-xs text-zinc-400 select-none">
          <div className="flex items-center gap-1">
            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
              title="Copy response"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {/* Regenerate Button */}
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                title="Regenerate response"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Like */}
            <button
              onClick={() => setFeedback(feedback === 'liked' ? null : 'liked')}
              className={`p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${
                feedback === 'liked' ? 'text-black dark:text-white' : 'text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
              title="Good response"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>

            {/* Dislike */}
            <button
              onClick={() => setFeedback(feedback === 'disliked' ? null : 'disliked')}
              className={`p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${
                feedback === 'disliked' ? 'text-rose-600' : 'text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
              title="Bad response"
            >
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Performance Stats Pill */}
          {stats && (
            <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400">
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
