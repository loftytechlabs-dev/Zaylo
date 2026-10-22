import React from 'react';
import {
  X,
  Download,
  FolderOpen,
  Copy,
  RotateCw,
  Sparkles,
  Check,
} from 'lucide-react';
import type { GeneratedImage } from '@local-ai/shared';

interface ImageLightboxModalProps {
  image: GeneratedImage | null;
  onClose: () => void;
  onSaveAs: (imagePath: string, name?: string) => Promise<any>;
  onOpenFolder: (imagePath: string) => Promise<any>;
  onRegenerate: (image: GeneratedImage) => void;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  image,
  onClose,
  onSaveAs,
  onOpenFolder,
  onRegenerate,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!image) return null;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(image.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-6 select-none animate-in fade-in duration-200">
      <div className="relative max-w-5xl w-full max-h-[92vh] flex flex-col md:flex-row bg-[#101217] border border-[#272b36] rounded-2xl overflow-hidden shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 z-20 p-2 rounded-full bg-black/60 hover:bg-black text-zinc-300 hover:text-white border border-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left: Image Canvas */}
        <div className="flex-1 bg-[#090a0d] flex items-center justify-center p-4 min-h-[350px] max-h-[580px] md:max-h-[85vh] overflow-hidden">
          <img
            src={image.base64Data || `file://${image.localPath}`}
            alt={image.prompt}
            className="max-h-full max-w-full object-contain rounded-lg shadow-lg"
          />
        </div>

        {/* Right: Metadata & Actions Sidebar */}
        <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-[#20232c] p-5 flex flex-col justify-between bg-[#12141a] overflow-y-auto max-h-[40vh] md:max-h-[85vh] space-y-5">
          <div className="space-y-4">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-blue-400 font-semibold mb-1 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                <span>Generated Image</span>
              </div>
              <p className="text-xs text-zinc-200 leading-relaxed font-sans select-text">
                "{image.prompt}"
              </p>
            </div>

            {image.negativePrompt && (
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold mb-1">
                  Negative Prompt
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed font-sans select-text">
                  {image.negativePrompt}
                </p>
              </div>
            )}

            {/* Spec Matrix */}
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-2 border-t border-[#1e222b]">
              <div className="p-2 rounded bg-[#161820] border border-[#242733]">
                <div className="text-zinc-500 text-[10px]">Dimensions</div>
                <div className="text-zinc-200 font-semibold mt-0.5">
                  {image.width} × {image.height}
                </div>
              </div>

              <div className="p-2 rounded bg-[#161820] border border-[#242733]">
                <div className="text-zinc-500 text-[10px]">Steps / CFG</div>
                <div className="text-zinc-200 font-semibold mt-0.5">
                  {image.steps} st / {image.guidanceScale} cfg
                </div>
              </div>

              <div className="p-2 rounded bg-[#161820] border border-[#242733]">
                <div className="text-zinc-500 text-[10px]">Seed</div>
                <div className="text-zinc-200 font-semibold mt-0.5 truncate" title={String(image.seed)}>
                  {image.seed}
                </div>
              </div>

              <div className="p-2 rounded bg-[#161820] border border-[#242733]">
                <div className="text-zinc-500 text-[10px]">Duration</div>
                <div className="text-emerald-400 font-semibold mt-0.5">
                  {(image.durationMs / 1000).toFixed(2)}s
                </div>
              </div>
            </div>

            {/* Device & Model */}
            <div className="text-[11px] text-zinc-400 space-y-1 font-mono pt-2 border-t border-[#1e222b]">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Model:</span>
                <span className="text-zinc-300 truncate max-w-[150px]">{image.modelName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Device:</span>
                <span className="text-blue-400 uppercase">{image.device || 'MPS (Metal)'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">File Size:</span>
                <span>{(image.fileSizeBytes / 1024).toFixed(1)} KB</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-3 border-t border-[#1e222b]">
            <button
              onClick={() => onSaveAs(image.localPath, `zaylo_${image.seed}.png`)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save Image As...</span>
            </button>

            <button
              onClick={() => onOpenFolder(image.localPath)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#181a22] hover:bg-[#20232e] text-zinc-300 hover:text-white border border-[#272b38] text-xs font-medium transition-colors"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Show in Folder</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCopyPrompt}
                className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#161820] hover:bg-[#1e212b] text-zinc-400 hover:text-zinc-200 border border-[#242733] text-xs transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Prompt'}</span>
              </button>

              <button
                onClick={() => {
                  onRegenerate(image);
                  onClose();
                }}
                className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#161820] hover:bg-[#1e212b] text-zinc-400 hover:text-zinc-200 border border-[#242733] text-xs transition-colors"
              >
                <RotateCw className="w-3 h-3" />
                <span>Regenerate</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
