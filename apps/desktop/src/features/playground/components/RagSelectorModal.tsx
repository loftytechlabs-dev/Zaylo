import React, { useRef, useState } from 'react';
import {
  BookOpen,
  X,
  UploadCloud,
  FileText,
  Trash2,
  Loader2,
  Check,
} from 'lucide-react';
import type { DocumentInfo, DocumentType } from '@local-ai/shared';

interface RagSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  ragEnabled: boolean;
  onToggleRag: (enabled: boolean) => void;
  documents: DocumentInfo[];
  selectedDocIds: string[];
  onToggleDocSelect: (id: string) => void;
  onSelectAllDocs: () => void;
  onAddDocument: (name: string, content: string, type?: DocumentType) => Promise<DocumentInfo>;
  onDeleteDocument: (id: string) => Promise<void>;
}

export const RagSelectorModal: React.FC<RagSelectorModalProps> = ({
  isOpen,
  onClose,
  ragEnabled,
  onToggleRag,
  documents,
  selectedDocIds,
  onToggleDocSelect,
  onSelectAllDocs,
  onAddDocument,
  onDeleteDocument,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const content = await file.text();
        const ext = file.name.split('.').pop()?.toLowerCase() || 'txt';
        await onAddDocument(file.name, content, ext as any);
      }
    } catch (err: any) {
      alert(`Failed to ingest document: ${err.message}`);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-[#101217] border border-[#282b36] rounded-xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#20232c] flex items-center justify-between bg-[#14161d]">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Local Document Knowledge & RAG</h3>
              <p className="text-[11px] text-zinc-400">
                Index private text files and code for offline semantic search
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Main RAG Toggle */}
          <div className="p-3.5 rounded-xl bg-[#171922] border border-[#252834] flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-zinc-200">
                Augment Conversation with Documents
              </div>
              <div className="text-[11px] text-zinc-400">
                Retrieves top relevant passages and inserts citations into your local prompts.
              </div>
            </div>
            <button
              onClick={() => onToggleRag(!ragEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                ragEnabled ? 'bg-emerald-600' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  ragEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Upload Drop Zone */}
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              multiple
              accept=".txt,.md,.markdown,.json,.csv,.ts,.js,.py,.html,.css"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full border-2 border-dashed border-[#2b2f3e] hover:border-emerald-500/60 rounded-xl p-5 flex flex-col items-center justify-center gap-2 bg-[#14161f]/60 hover:bg-[#14161f] transition-all cursor-pointer group"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
                  <span className="text-xs text-zinc-300">Chunking & embedding passages...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-6 h-6 text-zinc-400 group-hover:text-emerald-400 transition-colors" />
                  <div className="text-xs font-semibold text-zinc-300">
                    Upload documents or codebase files
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    Markdown (.md), Text (.txt), JSON, CSV, Source Code (.ts, .py, .js)
                  </div>
                </>
              )}
            </button>
          </div>

          {/* Documents Selection List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
              <span>INDEXED DOCUMENTS ({documents.length})</span>
              {documents.length > 0 && (
                <button
                  onClick={onSelectAllDocs}
                  className="text-[11px] text-blue-400 hover:text-blue-300 font-sans"
                >
                  {selectedDocIds.length === documents.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            {documents.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#14161e] border border-[#20232e] text-center text-xs text-zinc-500">
                No documents indexed yet. Upload documents above to chat with them.
              </div>
            ) : (
              <div className="divide-y divide-[#1e212b] border border-[#222532] rounded-xl overflow-hidden bg-[#12141a]">
                {documents.map((doc) => {
                  const isSelected = selectedDocIds.includes(doc.id);

                  return (
                    <div
                      key={doc.id}
                      onClick={() => onToggleDocSelect(doc.id)}
                      className={`p-3 flex items-center justify-between hover:bg-[#181a24] transition-colors cursor-pointer ${
                        isSelected ? 'bg-emerald-950/15' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center ${
                            isSelected
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : 'border-zinc-600 bg-zinc-800'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>

                        <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-zinc-200 truncate">{doc.name}</div>
                          <div className="text-[10px] text-zinc-500 flex items-center gap-2">
                            <span>{(doc.sizeBytes / 1024).toFixed(1)} KB</span>
                            <span>•</span>
                            <span>{doc.chunkCount} passages</span>
                            <span>•</span>
                            <span className="uppercase text-[9px] px-1 rounded bg-zinc-800 text-zinc-300">
                              {doc.type}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteDocument(doc.id);
                        }}
                        className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 rounded transition-colors"
                        title="Delete document and chunks"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#20232c] bg-[#14161d] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
