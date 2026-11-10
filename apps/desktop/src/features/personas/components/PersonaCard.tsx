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
      case 'academic':
      case 'professional':
        return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700';
      case 'creative':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'concise':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      default:
        return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700';
    }
  };

  return (
    <div
      className={`group relative rounded-xl p-5 border transition-all duration-200 flex flex-col justify-between ${
        isActive
          ? 'bg-white dark:bg-[#191919] border-black dark:border-white shadow-xs'
          : 'bg-white dark:bg-[#141414] border-[#eaeaea] dark:border-[#262626] hover:border-zinc-400 dark:hover:border-[#737373]'
      }`}
    >
      <div>
        {/* Top Header: Avatar, Name, Status Badges & Context Menu */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar / Icon Badge */}
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-xs transition-transform duration-200 group-hover:scale-105 ${
                isActive
                  ? 'bg-zinc-100 dark:bg-[#202020] border border-zinc-300 dark:border-[#262626] text-black dark:text-white'
                  : 'bg-zinc-50 dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-zinc-700 dark:text-[#F5F5F5]'
              }`}
            >
              <span>{persona.avatar || '🤖'}</span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-[#111111] dark:text-[#F5F5F5] truncate tracking-tight">
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
              className="p-1 rounded-md text-[#666666] dark:text-[#a1a1aa] hover:text-[#111111] dark:hover:text-white hover:bg-[#f5f5f5] dark:hover:bg-[#202020] transition-colors"
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
                <div className="absolute right-0 mt-1 w-44 rounded-lg bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] shadow-xl py-1 z-30 text-xs">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onActivate();
                    }}
                    className="w-full text-left px-3 py-1.5 text-[#111111] dark:text-[#f5f5f5] hover:bg-[#f5f5f5] dark:hover:bg-[#202020] flex items-center gap-2"
                  >
                    <Zap className="w-3.5 h-3.5 text-[#888888] dark:text-[#737373]" />
                    <span>{isActive ? 'Currently Active' : 'Set as Active'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onSetDefault();
                    }}
                    disabled={isDefault}
                    className="w-full text-left px-3 py-1.5 text-[#111111] dark:text-[#f5f5f5] hover:bg-[#f5f5f5] dark:hover:bg-[#202020] disabled:opacity-40 flex items-center gap-2"
                  >
                    <Star className="w-3.5 h-3.5 text-amber-500" />
                    <span>{isDefault ? 'Default Persona' : 'Set as Default'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onEdit();
                    }}
                    className="w-full text-left px-3 py-1.5 text-[#111111] dark:text-[#f5f5f5] hover:bg-[#f5f5f5] dark:hover:bg-[#202020] flex items-center gap-2"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-[#888888] dark:text-[#737373]" />
                    <span>{persona.isBuiltIn ? 'Inspect / Duplicate' : 'Edit Persona'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDuplicate();
                    }}
                    className="w-full text-left px-3 py-1.5 text-[#111111] dark:text-[#f5f5f5] hover:bg-[#f5f5f5] dark:hover:bg-[#202020] flex items-center gap-2"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#888888] dark:text-[#737373]" />
                    <span>Duplicate as Custom</span>
                  </button>

                  {!persona.isBuiltIn && onDelete && (
                    <div className="border-t border-[#eaeaea] dark:border-[#222222] mt-1 pt-1">
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          onDelete();
                        }}
                        className="w-full text-left px-3 py-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2"
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
            <ul className="text-[11px] text-zinc-500 dark:text-zinc-400 space-y-0.5">
              {persona.behavioralRules.slice(0, 2).map((rule, rIdx) => (
                <li key={rIdx} className="truncate flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-zinc-400 dark:bg-zinc-500 shrink-0" />
                  <span className="truncate">{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Card Footer: Quick Actions */}
      <div className="mt-4 pt-3 border-t border-[#eaeaea] dark:border-[#222222] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          {isActive ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>ACTIVE</span>
            </span>
          ) : (
            <span className="text-zinc-400 dark:text-[#737373] font-mono text-[10px]">STANDBY</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#191919] hover:bg-zinc-50 dark:hover:bg-[#202020] border border-[#eaeaea] dark:border-[#262626] text-xs font-medium text-zinc-700 dark:text-[#A1A1AA] transition-colors"
          >
            {persona.isBuiltIn ? 'View' : 'Edit'}
          </button>

          <button
            onClick={onActivate}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              isActive
                ? 'bg-zinc-100 dark:bg-[#202020] text-zinc-800 dark:text-[#F5F5F5] border border-zinc-200 dark:border-[#262626] cursor-default'
                : 'bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black shadow-xs'
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
