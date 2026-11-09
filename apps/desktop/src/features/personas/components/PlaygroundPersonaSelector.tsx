import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Check,
  Plus,
  Users,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  User,
} from 'lucide-react';
import type { Persona } from '@local-ai/shared';

interface PlaygroundPersonaSelectorProps {
  activePersona: Persona;
  personas: Persona[];
  onSelectPersona: (personaId: string) => void;
  onOpenManagement: () => void;
  onCreatePersona: () => void;
}

export const PlaygroundPersonaSelector: React.FC<PlaygroundPersonaSelectorProps> = ({
  activePersona,
  personas,
  onSelectPersona,
  onOpenManagement,
  onCreatePersona,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const builtIns = personas.filter((p) => p.isBuiltIn);
  const customs = personas.filter((p) => !p.isBuiltIn);

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Compact Trigger Pill Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white dark:bg-[#15161b] hover:bg-zinc-50 dark:hover:bg-[#1c1e26] border border-[#eaeaea] dark:border-[#272932] text-xs font-medium text-[#111111] dark:text-[#f4f4f5] transition-colors shadow-xs select-none"
        title={`Active Persona: ${activePersona?.name || 'Persona'}`}
      >
        <User className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400 shrink-0" />
        <span className="truncate max-w-[110px] sm:max-w-[130px] font-sans">
          {activePersona?.name || 'Persona'}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-150 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Popup */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-64 rounded-xl bg-white dark:bg-[#12141a] border border-[#eaeaea] dark:border-[#262934] shadow-xl py-1.5 z-50 text-xs overflow-hidden select-none animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1.5 border-b border-[#eaeaea] dark:border-[#1c1f28] flex items-center justify-between">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
              Select Persona
            </span>
            <span className="text-[10px] font-mono text-black dark:text-white">
              {personas.length} Available
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto py-1 space-y-0.5 scrollbar-thin">
            {/* Built-in Section */}
            <div className="px-3 py-1 text-[10px] font-mono text-zinc-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-zinc-400" />
              <span>PRESETS</span>
            </div>
            {builtIns.map((p) => {
              const isSelected = p.id === activePersona?.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    onSelectPersona(p.id);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-1.5 text-left flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#181a22]'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-sm shrink-0">{p.avatar || '🤖'}</span>
                    <div className="truncate">
                      <span className="truncate block leading-tight">{p.name}</span>
                      <span className="text-[10px] text-zinc-400 font-mono leading-none">
                        {p.communicationStyle}
                      </span>
                    </div>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-black dark:text-white shrink-0" />}
                </button>
              );
            })}

            {/* Custom Personas Section */}
            {customs.length > 0 && (
              <>
                <div className="px-3 pt-2 pb-1 text-[10px] font-mono text-zinc-400 flex items-center gap-1 border-t border-[#eaeaea] dark:border-[#1c1f28] mt-1">
                  <Sparkles className="w-3 h-3 text-sky-500" />
                  <span>CUSTOM</span>
                </div>
                {customs.map((p) => {
                  const isSelected = p.id === activePersona?.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        onSelectPersona(p.id);
                        setIsOpen(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left flex items-center justify-between transition-colors ${
                        isSelected
                          ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#181a22]'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-sm shrink-0">{p.avatar || '✨'}</span>
                        <div className="truncate">
                          <span className="truncate block leading-tight">{p.name}</span>
                          <span className="text-[10px] text-zinc-400 font-mono leading-none">
                            {p.communicationStyle}
                          </span>
                        </div>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-black dark:text-white shrink-0" />}
                    </button>
                  );
                })}
              </>
            )}
          </div>

          {/* Quick Action Footer */}
          <div className="border-t border-[#eaeaea] dark:border-[#1c1f28] pt-1 mt-1 space-y-0.5 bg-zinc-50/50 dark:bg-[#0e1014]">
            {activePersona?.id !== 'persona_general' && (
              <button
                type="button"
                onClick={() => {
                  onSelectPersona('persona_general');
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-[#181a22] flex items-center gap-2 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                <span>Return to General Assistant</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onCreatePersona();
              }}
              className="w-full text-left px-3 py-1.5 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#181a22] flex items-center gap-2 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-black dark:text-white" />
              <span>Create New Persona</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenManagement();
              }}
              className="w-full text-left px-3 py-1.5 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#181a22] flex items-center gap-2 transition-colors"
            >
              <Users className="w-3.5 h-3.5 text-zinc-500" />
              <span>Manage Personas...</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
