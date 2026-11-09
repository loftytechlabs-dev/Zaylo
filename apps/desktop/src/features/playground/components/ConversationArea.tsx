import React, { useRef, useEffect } from 'react';
import {
  Sparkles,
  Bot,
  Code2,
  Eye,
  Zap,
  ArrowRight,
  Shield,
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
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isGenerating]);

  // Generate contextual suggestions based on model capabilities
  const getSuggestions = () => {
    if (selectedModel?.isVisionSupported) {
      return [
        {
          icon: Eye,
          title: 'Visual Scene Analysis',
          prompt: 'Analyze this image and describe the key objects, actions, and details you observe.',
        },
        {
          icon: Code2,
          title: 'Extract Text or Code',
          prompt: 'Extract all visible text, code snippets, and structured tables from this image.',
        },
        {
          icon: Zap,
          title: 'Diagram Understanding',
          prompt: 'Explain the workflow and relationships depicted in this architectural diagram.',
        },
      ];
    }

    if (selectedModel?.name?.toLowerCase().includes('coder') || selectedModel?.name?.toLowerCase().includes('code')) {
      return [
        {
          icon: Code2,
          title: 'Async HTTP Server',
          prompt: 'Write an asynchronous, high-throughput HTTP server in Rust using Tokio and Axum.',
        },
        {
          icon: Zap,
          title: 'LoRA Implementation',
          prompt: 'Explain how Low-Rank Adaptation (LoRA) decomposes weight updates in PyTorch with sample code.',
        },
        {
          icon: Sparkles,
          title: 'Type-Safe Event Emitter',
          prompt: 'Create a robust, fully generic type-safe event emitter class in TypeScript.',
        },
      ];
    }

    return [
      {
        icon: Sparkles,
        title: 'Explain Sampling Parameters',
        prompt: 'Explain the difference between temperature, top-p (nucleus sampling), and repetition penalties.',
      },
      {
        icon: Shield,
        title: 'Offline AI Privacy',
        prompt: 'How does running offline LLMs with Zaylo preserve enterprise data privacy compared to cloud APIs?',
      },
      {
        icon: Code2,
        title: 'Compare LoRA vs Full Fine-Tuning',
        prompt: 'What are the memory and compute trade-offs between LoRA fine-tuning and full-parameter training?',
      },
    ];
  };

  const suggestions = getSuggestions();

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 flex flex-col">
      {/* Empty State Welcome Screen */}
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto text-center space-y-6 my-auto select-none">
          <div className="space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto shadow-sm">
              <Bot className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-zinc-100 tracking-tight">
              What would you like to explore?
            </h2>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">
              {selectedModel ? (
                <span>
                  Connected to <strong className="text-zinc-200 font-mono">{selectedModel.name}</strong>.
                  All prompt tokens and generation remain 100% private on your machine.
                </span>
              ) : (
                'Select a model above to begin chatting.'
              )}
            </p>
          </div>

          {/* Contextual Suggestions Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full text-left">
            {suggestions.map((s, idx) => {
              const Icon = s.icon;
              return (
                <button
                  key={idx}
                  onClick={() => onSelectSuggestion(s.prompt)}
                  className="p-3.5 rounded-xl bg-[#12141a] hover:bg-[#181a24] border border-[#20232c] hover:border-blue-500/40 transition-all space-y-1.5 group cursor-pointer text-left shadow-sm"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-zinc-200 group-hover:text-blue-400 transition-colors">
                    <div className="flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 text-blue-400" />
                      <span>{s.title}</span>
                    </div>
                    <ArrowRight className="w-3 h-3 text-zinc-500 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                    {s.prompt}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Conversation Message Feed */
        <div className="space-y-4 max-w-3xl mx-auto w-full">
          {/* Clear conversation button at top of stream */}
          <div className="flex justify-end pb-1 select-none">
            <button
              onClick={onClearConversation}
              className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Clear all messages"
            >
              <Trash2 className="w-3 h-3" />
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
