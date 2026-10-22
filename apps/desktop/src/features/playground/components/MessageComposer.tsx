import React, { useRef, useState, useEffect } from 'react';
import {
  Send,
  Square,
  Image as ImageIcon,
  X,
  BookOpen,
  AlertCircle,
  Play,
  RotateCw,
} from 'lucide-react';
import type { ServerState } from '@local-ai/shared';

interface MessageComposerProps {
  onSendMessage: (text: string) => void;
  onStopGeneration: () => void;
  isGenerating: boolean;
  serverState: ServerState;
  isVisionSupported: boolean;
  pendingImage?: { dataUrl: string; name: string };
  onSetPendingImage: (img?: { dataUrl: string; name: string }) => void;
  ragEnabled: boolean;
  ragDocsCount: number;
  onOpenRagModal: () => void;
  onStartServer: () => void;
  isStartingServer: boolean;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  onSendMessage,
  onStopGeneration,
  isGenerating,
  serverState,
  isVisionSupported,
  pendingImage,
  onSetPendingImage,
  ragEnabled,
  ragDocsCount,
  onOpenRagModal,
  onStartServer,
  isStartingServer,
}) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isServerRunning = serverState === 'RUNNING';

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(160, textareaRef.current.scrollHeight)}px`;
    }
  }, [input]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !pendingImage) || isGenerating || !isServerRunning) return;
    const msg = input;
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    onSendMessage(msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onSetPendingImage({ dataUrl: reader.result, name: file.name });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              onSetPendingImage({
                dataUrl: reader.result,
                name: file.name || 'clipboard-image.png',
              });
            }
          };
          reader.readAsDataURL(file);
          e.preventDefault();
          break;
        }
      }
    }
  };

  return (
    <div className="p-4 border-t border-[#202227] bg-[#0c0d10] select-none shrink-0">
      <div className="max-w-3xl mx-auto space-y-2">
        {/* Server Stopped Warning Banner */}
        {!isServerRunning && (
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Inference server is currently stopped. Start server to chat with this model.</span>
            </div>
            <button
              onClick={onStartServer}
              disabled={isStartingServer}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-[11px] font-semibold transition-colors"
            >
              {isStartingServer ? (
                <>
                  <RotateCw className="w-3 h-3 animate-spin" />
                  <span>Starting...</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" />
                  <span>Start Server</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Pending Image Attachment Pill */}
        {pendingImage && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 p-1.5 pl-2 bg-[#171a22] border border-blue-500/40 rounded-lg">
              <img
                src={pendingImage.dataUrl}
                alt="Upload preview"
                className="w-7 h-7 rounded object-cover border border-zinc-700"
              />
              <span className="text-[11px] text-zinc-200 truncate max-w-[180px]">
                {pendingImage.name}
              </span>
              <button
                type="button"
                onClick={() => onSetPendingImage(undefined)}
                className="p-1 text-zinc-400 hover:text-zinc-100 transition-colors"
                title="Remove image"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {!isVisionSupported && (
              <span className="text-[11px] text-amber-300 bg-amber-950/40 border border-amber-800/50 px-2.5 py-1 rounded-md">
                ⚠️ Active model is text-only. Multimodal images require a vision model (e.g. Qwen 2.5-VL).
              </span>
            )}
          </div>
        )}

        {/* Textarea Input Container */}
        <div className="relative rounded-xl border border-[#232630] focus-within:border-blue-500 bg-[#12141a] transition-all shadow-sm">
          <textarea
            ref={textareaRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={
              !isServerRunning
                ? 'Server stopped. Start server to chat...'
                : ragEnabled
                ? 'Type prompt (RAG active)... Shift+Enter for newline'
                : 'Type prompt... Shift+Enter for newline'
            }
            disabled={!isServerRunning || isGenerating}
            className="w-full bg-transparent pl-4 pr-32 pt-3 pb-3 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none font-sans leading-relaxed select-text"
          />

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />

          {/* Bottom Toolbar inside Composer */}
          <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1.5">
            {/* RAG Knowledge Pill */}
            <button
              type="button"
              onClick={onOpenRagModal}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                ragEnabled
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-[#181a22] border-[#262a34] text-zinc-400 hover:text-zinc-200'
              }`}
              title="Configure Document Knowledge & RAG"
            >
              <BookOpen className="w-3 h-3" />
              <span>RAG</span>
              {ragDocsCount > 0 && (
                <span className="font-mono text-[9px] px-1 rounded bg-zinc-800 text-zinc-300">
                  {ragDocsCount}
                </span>
              )}
            </button>

            {/* Image Attachment Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!isServerRunning || isGenerating}
              className={`p-1.5 rounded-md border transition-colors ${
                pendingImage
                  ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
                  : 'bg-[#181a22] border-[#262a34] text-zinc-400 hover:text-zinc-200'
              }`}
              title={
                isVisionSupported
                  ? 'Attach image for vision model'
                  : 'Attach image (Requires a Vision model)'
              }
            >
              <ImageIcon className="w-3.5 h-3.5" />
            </button>

            {/* Send / Stop Generation Button */}
            {isGenerating ? (
              <button
                type="button"
                onClick={onStopGeneration}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow transition-all animate-pulse"
                title="Stop generation"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={!isServerRunning || (!input.trim() && !pendingImage)}
                className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white shadow transition-colors"
                title="Send message (Enter)"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
