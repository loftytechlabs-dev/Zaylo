import React, { useState } from 'react';
import {
  Sliders,
  X,
  RotateCcw,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { GenerationSettings } from '../types';

interface SettingsDrawerProps {
  settings: GenerationSettings;
  onChange: (updated: Partial<GenerationSettings>) => void;
  onReset: () => void;
  onClose: () => void;
  contextLimit?: number;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  settings,
  onChange,
  onReset,
  onClose,
  contextLimit = 4096,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [stopInput, setStopInput] = useState(settings.stopSequences.join(', '));

  const handleStopChange = (val: string) => {
    setStopInput(val);
    const parsed = val
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    onChange({ stopSequences: parsed });
  };

  return (
    <aside className="w-80 border-l border-[#202227] bg-[#0c0d10] p-5 space-y-5 select-none overflow-y-auto shrink-0 z-20">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1f2228] pb-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-200">
          <Sliders className="w-4 h-4 text-blue-400" />
          <span>Generation Settings</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-200 transition-colors"
            title="Reset parameters to defaults"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-[#1a1d25] transition-colors"
            title="Close Settings Drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* System Prompt */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <label className="text-zinc-300 font-medium">System Instructions</label>
        </div>
        <textarea
          rows={3}
          value={settings.systemPrompt}
          onChange={(e) => onChange({ systemPrompt: e.target.value })}
          placeholder="You are a helpful local assistant..."
          className="w-full p-2.5 rounded-lg bg-[#12141a] border border-[#22252f] text-xs text-zinc-200 focus:outline-none focus:border-blue-500 font-sans resize-none leading-relaxed select-text"
        />
        <p className="text-[10px] text-zinc-500 leading-normal">
          Defines persona, behavioral guidelines, and formatting style for assistant responses.
        </p>
      </div>

      {/* Primary Parameters */}
      <div className="space-y-4 pt-2">
        {/* Temperature */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-zinc-400">Temperature</span>
            <span className="font-bold text-zinc-200">{settings.temperature.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.5"
            step="0.05"
            value={settings.temperature}
            onChange={(e) => onChange({ temperature: parseFloat(e.target.value) })}
            className="w-full accent-blue-500 bg-zinc-800 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
            <span>0.0 (Deterministic)</span>
            <span>1.5 (Creative)</span>
          </div>
        </div>

        {/* Top P */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-zinc-400">Top-P (Nucleus)</span>
            <span className="font-bold text-zinc-200">{settings.topP.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.05"
            max="1.0"
            step="0.05"
            value={settings.topP}
            onChange={(e) => onChange({ topP: parseFloat(e.target.value) })}
            className="w-full accent-blue-500 bg-zinc-800 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
            <span>0.05 (Focused)</span>
            <span>1.0 (All tokens)</span>
          </div>
        </div>

        {/* Max Output Tokens */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-zinc-400">Max Completion Tokens</span>
            <span className="font-bold text-zinc-200">{settings.maxTokens}</span>
          </div>
          <input
            type="range"
            min="64"
            max={Math.min(4096, contextLimit)}
            step="64"
            value={settings.maxTokens}
            onChange={(e) => onChange({ maxTokens: parseInt(e.target.value, 10) })}
            className="w-full accent-blue-500 bg-zinc-800 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
            <span>64 tokens</span>
            <span>{Math.min(4096, contextLimit)} tokens</span>
          </div>
        </div>
      </div>

      {/* Advanced Parameters Accordion */}
      <div className="pt-2 border-t border-[#1f2228] space-y-3">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
        >
          <span>Advanced Sampling Parameters</span>
          {showAdvanced ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>

        {showAdvanced && (
          <div className="space-y-4 pt-1">
            {/* Frequency Penalty */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400">Frequency Penalty</span>
                <span className="font-bold text-zinc-200">
                  {settings.frequencyPenalty.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="2.0"
                step="0.1"
                value={settings.frequencyPenalty}
                onChange={(e) => onChange({ frequencyPenalty: parseFloat(e.target.value) })}
                className="w-full accent-blue-500 bg-zinc-800 cursor-pointer"
              />
              <p className="text-[10px] text-zinc-500 leading-normal">
                Penalizes tokens based on their existing frequency in the text, reducing verbatim repetition.
              </p>
            </div>

            {/* Presence Penalty */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400">Presence Penalty</span>
                <span className="font-bold text-zinc-200">
                  {settings.presencePenalty.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="2.0"
                step="0.1"
                value={settings.presencePenalty}
                onChange={(e) => onChange({ presencePenalty: parseFloat(e.target.value) })}
                className="w-full accent-blue-500 bg-zinc-800 cursor-pointer"
              />
              <p className="text-[10px] text-zinc-500 leading-normal">
                Encourages introducing new concepts by penalizing repeated tokens regardless of exact count.
              </p>
            </div>

            {/* Stop Sequences */}
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium">Custom Stop Sequences</label>
              <input
                type="text"
                value={stopInput}
                onChange={(e) => handleStopChange(e.target.value)}
                placeholder="###, User:, EndOfText"
                className="w-full p-2 rounded-lg bg-[#12141a] border border-[#22252f] text-xs text-zinc-200 focus:outline-none focus:border-blue-500 font-mono select-text"
              />
              <p className="text-[10px] text-zinc-500">
                Comma-separated strings that will immediately halt generation when emitted.
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
