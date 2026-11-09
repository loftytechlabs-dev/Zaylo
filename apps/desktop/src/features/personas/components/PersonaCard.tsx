import React, { useState } from 'react';
import {
  Check,
  Copy,
  Edit2,
  Trash2,
  Star,
  ShieldCheck,
  Sparkles,
  MoreVertical,
  Zap,
} from 'lucide-react';
import type { Persona } from '@local-ai/shared';

interface PersonaCardProps {
  persona: Persona;
  isActive: boolean;
  isDefault: boolean;
  onActivate: () => void;
  onSetDefault: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete?: () => void;
}

export const PersonaCard: React.FC<PersonaCardProps> = ({
  persona,
  isActive,
  isDefault,
  onActivate,
  onSetDefault,
  onEdit,
  onDuplicate,
  onDelete,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const getStyleBadgeColor = (style: string) => {
    switch (style.toLowerCase()) {
      case 'technical':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'academic':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'creative':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'concise':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'professional':
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700/50';
    }
  };

  return (
    <div
      className={`group relative rounded-xl p-5 border transition-all duration-200 flex flex-col justify-between ${
        isActive
          ? 'bg-[#12151d] border-blue-500/60 shadow-[0_0_16px_rgba(37,99,235,0.12)]'
          : 'bg-[#111317] border-[#22252c] hover:border-[#333742]'
      }`}
    >
      <div>
        {/* Top Header: Avatar, Name, Status Badges & Context Menu */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar / Icon Badge */}
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-sm transition-transform duration-200 group-hover:scale-105 ${
                isActive
                  ? 'bg-blue-600/20 border border-blue-500/40 text-blue-400'
                  : 'bg-[#171922] border border-[#262934] text-zinc-200'
              }`}
            >
              <span>{persona.avatar || '🤖'}</span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-zinc-100 truncate tracking-tight">
                  {persona.name}
                </h3>

                {isDefault && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30"
                    title="Default system persona"
                  >
                    <Star className="w-2.5 h-2.5 fill-current" />
                    <span>DEFAULT</span>
                  </span>
                )}

                {persona.isBuiltIn ? (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700/40"
                    title="Protected built-in preset"
                  >
                    <ShieldCheck className="w-2.5 h-2.5" />
                    <span>PRESET</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/30">
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>CUSTOM</span>
                  </span>
                )}
              </div>

              {/* Personality / Style Badge */}
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono border ${getStyleBadgeColor(
                    persona.communicationStyle
                  )}`}
                >
                  {persona.communicationStyle}
                </span>
                {persona.personalityTraits.slice(0, 2).map((t, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] text-zinc-500 font-sans hidden sm:inline"
                  >
                    • {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Context Action Menu */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-[#1a1d26] transition-colors"
              title="Persona options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 mt-1 w-44 rounded-lg bg-[#14161c] border border-[#262934] shadow-xl py-1 z-30 text-xs">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onActivate();
                    }}
                    className="w-full text-left px-3 py-1.5 text-zinc-300 hover:bg-[#1f222d] flex items-center gap-2"
                  >
                    <Zap className="w-3.5 h-3.5 text-blue-400" />
                    <span>{isActive ? 'Currently Active' : 'Set as Active'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onSetDefault();
                    }}
                    disabled={isDefault}
                    className="w-full text-left px-3 py-1.5 text-zinc-300 hover:bg-[#1f222d] disabled:opacity-40 flex items-center gap-2"
                  >
                    <Star className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isDefault ? 'Default Persona' : 'Set as Default'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onEdit();
                    }}
                    className="w-full text-left px-3 py-1.5 text-zinc-300 hover:bg-[#1f222d] flex items-center gap-2"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{persona.isBuiltIn ? 'Inspect / Duplicate' : 'Edit Persona'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDuplicate();
                    }}
                    className="w-full text-left px-3 py-1.5 text-zinc-300 hover:bg-[#1f222d] flex items-center gap-2"
                  >
                    <Copy className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Duplicate as Custom</span>
                  </button>

                  {!persona.isBuiltIn && onDelete && (
                    <div className="border-t border-[#22252e] mt-1 pt-1">
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          onDelete();
                        }}
                        className="w-full text-left px-3 py-1.5 text-rose-400 hover:bg-rose-950/30 flex items-center gap-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Persona</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-zinc-400 mt-3 line-clamp-2 leading-relaxed">
          {persona.description || 'No description provided.'}
        </p>

        {/* Behavioral Rules Preview */}
        {persona.behavioralRules && persona.behavioralRules.length > 0 && (
          <div className="mt-3.5 pt-3 border-t border-[#1d2027] space-y-1">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
              Core Directives
            </span>
            <ul className="text-[11px] text-zinc-400 space-y-0.5">
              {persona.behavioralRules.slice(0, 2).map((rule, rIdx) => (
                <li key={rIdx} className="truncate flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-blue-500/60 shrink-0" />
                  <span className="truncate">{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Card Footer: Quick Actions */}
      <div className="mt-4 pt-3 border-t border-[#1d2027] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          {isActive ? (
            <span className="inline-flex items-center gap-1 text-emerald-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>ACTIVE</span>
            </span>
          ) : (
            <span className="text-zinc-500 font-mono text-[10px]">STANDBY</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="px-2.5 py-1 rounded-md bg-[#16181f] hover:bg-[#1f222d] border border-[#252834] text-xs font-medium text-zinc-300 transition-colors"
          >
            {persona.isBuiltIn ? 'View' : 'Edit'}
          </button>

          <button
            onClick={onActivate}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
              isActive
                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40 cursor-default'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
            }`}
          >
            {isActive ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Active</span>
              </>
            ) : (
              <span>Activate</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
