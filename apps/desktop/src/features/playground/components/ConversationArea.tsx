import React, { useRef, useEffect } from 'react';
import {
  Code,
  Database,
  FileText,
  Image as ImageIcon,
  Trash2,
} from 'lucide-react';
import type { ChatMessage } from '@local-ai/shared';
import { MessageBubble } from './MessageBubble';
import type { UnifiedModelOption, InferenceGenerationStats } from '../types';

interface ConversationAreaProps {
  messages: ChatMessage[];
  isGenerating: boolean;
  selectedModel?: UnifiedModelOption;
  generationStats?: InferenceGenerationStats;
  onSelectSuggestion: (prompt: string) => void;
  onRegenerate: () => void;
  onRetry: () => void;
  onClearConversation: () => void;
  onTriggerImageUpload?: () => void;
}

export const ConversationArea: React.FC<ConversationAreaProps> = ({
  messages,
  isGenerating,
  selectedModel,
  generationStats,
  onSelectSuggestion,
  onRegenerate,
  onRetry,
  onClearConversation,
  onTriggerImageUpload,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isGenerating]);

  const handleSuggestionClick = (type: string) => {
    switch (type) {
      case 'code':
        onSelectSuggestion('Write an asynchronous, in-memory cache in TypeScript with sliding TTL expiration and cleanup.');
        break;
      case 'sql':
        onSelectSuggestion('Write an optimized PostgreSQL query using window functions to calculate running monthly revenue by customer tier.');
        break;
      case 'summarize':
        onSelectSuggestion('Summarize the operational and privacy advantages of running local offline LLMs versus cloud AI APIs.');
        break;
      case 'image':
        if (onTriggerImageUpload) {
          onTriggerImageUpload();
        } else {
          onSelectSuggestion('Analyze this visual scene in detail: describe objects, relationships, and structured text.');
        }
        break;
      default:
        break;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 flex flex-col scrollbar-thin">
      {/* Empty State Welcome Screen — The Visual Centerpiece */}
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center max-w-3xl mx-auto text-center space-y-7 my-auto select-none">
          {/* Prominent Clean Heading */}
          <div className="space-y-1.5">
            <h1 className="text-4xl sm:text-5xl font-bold text-[#111111] dark:text-[#f4f4f5] tracking-tight font-sans">
              Zaylo
            </h1>
            <p className="text-base sm:text-lg text-zinc-400 dark:text-zinc-500 font-normal">
              Your Local AI Playground
            </p>
          </div>

          {/* 4 Minimal Suggestion Buttons in a Row */}
          <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-2xl pt-2">
            {/* 1. Write Code */}
            <button
              onClick={() => handleSuggestionClick('code')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-[#15161b] hover:bg-zinc-50 dark:hover:bg-[#1c1e26] border border-[#eaeaea] dark:border-[#272932] hover:border-zinc-400 dark:hover:border-zinc-600 text-xs sm:text-sm font-medium text-[#111111] dark:text-[#f4f4f5] transition-all shadow-xs cursor-pointer"
            >
              <Code className="w-4 h-4 text-[#111111] dark:text-[#f4f4f5]" />
              <span>Write Code</span>
            </button>

            {/* 2. Query SQL */}
            <button
              onClick={() => handleSuggestionClick('sql')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-[#15161b] hover:bg-zinc-50 dark:hover:bg-[#1c1e26] border border-[#eaeaea] dark:border-[#272932] hover:border-zinc-400 dark:hover:border-zinc-600 text-xs sm:text-sm font-medium text-[#111111] dark:text-[#f4f4f5] transition-all shadow-xs cursor-pointer"
            >
              <Database className="w-4 h-4 text-[#111111] dark:text-[#f4f4f5]" />
              <span>Query SQL</span>
            </button>

            {/* 3. Summarize */}
            <button
              onClick={() => handleSuggestionClick('summarize')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-[#15161b] hover:bg-zinc-50 dark:hover:bg-[#1c1e26] border border-[#eaeaea] dark:border-[#272932] hover:border-zinc-400 dark:hover:border-zinc-600 text-xs sm:text-sm font-medium text-[#111111] dark:text-[#f4f4f5] transition-all shadow-xs cursor-pointer"
            >
              <FileText className="w-4 h-4 text-[#111111] dark:text-[#f4f4f5]" />
              <span>Summarize</span>
            </button>

            {/* 4. Analyze Image */}
            <button
              onClick={() => handleSuggestionClick('image')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-[#15161b] hover:bg-zinc-50 dark:hover:bg-[#1c1e26] border border-[#eaeaea] dark:border-[#272932] hover:border-zinc-400 dark:hover:border-zinc-600 text-xs sm:text-sm font-medium text-[#111111] dark:text-[#f4f4f5] transition-all shadow-xs cursor-pointer"
            >
              <ImageIcon className="w-4 h-4 text-[#111111] dark:text-[#f4f4f5]" />
              <span>Analyze Image</span>
            </button>
          </div>
        </div>
      ) : (
        /* Active Conversation Column */
        <div className="space-y-2 max-w-[850px] mx-auto w-full pb-4">
          {/* Subtle Clear Conversation header control */}
          <div className="flex justify-end pb-2 select-none">
            <button
              onClick={onClearConversation}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              title="Clear all messages in this conversation"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear conversation</span>
            </button>
          </div>

          {messages.map((msg, idx) => {
            const isLastAssistant = !isGenerating && idx === messages.length - 1 && msg.role === 'assistant';
            const isCurrentlyStreaming = isGenerating && idx === messages.length - 1 && msg.role === 'assistant';

            return (
              <MessageBubble
                key={idx}
                message={msg}
                index={idx}
                isStreaming={isCurrentlyStreaming}
                modelName={selectedModel?.name}
                stats={isLastAssistant ? generationStats : undefined}
                onRegenerate={isLastAssistant ? onRegenerate : undefined}
                onRetry={isLastAssistant ? onRetry : undefined}
              />
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
};
