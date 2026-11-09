import React, { useState } from 'react';
import {
  Bot,
  User,
  Copy,
  Check,
  RotateCw,
  Clock,
  Zap,
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
  onRetry,
}) => {
  const [copied, setCopied] = useState(false);
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
  const isError = !isUser && (rawText.startsWith('[Error:') || rawText.includes('⚠️ **Vision Projector Required**'));

  const handleCopy = () => {
    navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex gap-3.5 group ${isUser ? 'justify-end' : 'justify-start'} w-full`}>
      {/* Assistant Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-lg bg-blue-950/80 border border-blue-800/40 flex items-center justify-center text-blue-400 shrink-0 mt-0.5 shadow-sm">
          <Bot className="w-4 h-4" />
        </div>
      )}

      {/* Message Body Container */}
      <div
        className={`relative max-w-[85%] sm:max-w-[82%] rounded-xl px-4 py-3 text-xs leading-relaxed break-words ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-none shadow-sm'
            : isError
            ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-bl-none'
            : 'bg-[#12141a] border border-[#20232c] text-zinc-200 rounded-bl-none shadow-sm'
        }`}
      >
        {/* Model Badge for Assistant */}
        {!isUser && modelName && (
          <div className="text-[10px] font-mono text-zinc-500 mb-1.5 flex items-center gap-1.5 select-none">
            <Sparkles className="w-3 h-3 text-blue-400" />
            <span>{modelName}</span>
          </div>
        )}

        {/* Content Rendering */}
        {typeof message.content === 'string' ? (
          <div>
            <MarkdownRenderer content={message.content} />
            {isStreaming && (
              <span className="inline-block w-1.5 h-3.5 ml-1 bg-blue-400 animate-pulse align-middle" />
            )}
          </div>
        ) : Array.isArray(message.content) ? (
          <div className="space-y-2">
            {message.content.map((part, pIdx) => {
              if (part.type === 'image_url') {
                return (
                  <div
                    key={pIdx}
                    className="rounded-lg overflow-hidden border border-zinc-700/60 max-w-sm my-1.5 bg-black/40"
                  >
                    <img
                      src={part.image_url.url}
                      alt="Uploaded visual input"
                      className="max-h-64 w-auto object-contain rounded"
                    />
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

        {/* Bottom Actions & Stats Bar */}
        {!isUser && !isStreaming && rawText && (
          <div className="mt-2.5 pt-2 border-t border-[#1b1e25] flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-500 select-none">
            {/* Stats */}
            {stats ? (
              <div className="flex items-center gap-2.5 font-mono">
                <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                  <Zap className="w-2.5 h-2.5" />
                  {stats.tokensPerSec} tok/s
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-zinc-400">
                  <Clock className="w-2.5 h-2.5" />
                  {stats.latencyMs} ms
                </span>
                <span>•</span>
                <span className="text-zinc-400">{stats.tokenCount} tokens</span>
                {stats.timeToFirstTokenMs !== undefined && (
                  <>
                    <span>•</span>
                    <span className="text-blue-400">TTFT: {stats.timeToFirstTokenMs}ms</span>
                  </>
                )}
              </div>
            ) : (
              <span />
            )}

            {/* Quick Actions: Copy, Regenerate, Retry */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 p-1 rounded hover:bg-[#1a1d25] text-zinc-400 hover:text-zinc-200 transition-colors"
                title="Copy response"
              >
                {copied ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>

              {onRegenerate && !isError && (
                <button
                  onClick={onRegenerate}
                  className="flex items-center gap-1 p-1 rounded hover:bg-[#1a1d25] text-zinc-400 hover:text-zinc-200 transition-colors"
                  title="Regenerate response"
                >
                  <RotateCw className="w-3 h-3" />
                </button>
              )}

              {onRetry && isError && (
                <button
                  onClick={onRetry}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-medium transition-colors"
                  title="Retry prompt"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 shrink-0 mt-0.5 shadow-sm">
          <User className="w-4 h-4" />
        </div>
      )}
    </div>
  );
};
