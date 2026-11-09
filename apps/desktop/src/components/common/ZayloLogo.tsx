import React from 'react';
import logoUrl from '../../assets/logo.png';

interface ZayloLogoProps {
  className?: string;
  size?: number;
  glow?: boolean;
}

export const ZayloLogo: React.FC<ZayloLogoProps> = ({ className = 'w-7 h-7', size, glow = true }) => {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${glow ? 'group' : ''}`}>
      {glow && (
        <div className="absolute -inset-1 rounded-xl bg-zinc-500/10 dark:bg-white/5 blur-md opacity-40 group-hover:opacity-75 transition-opacity" />
      )}
      <div
        className={`brand-logo-tile relative rounded-xl bg-gradient-to-b from-[#181c26] to-[#0f121a] border border-[#232938] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_2px_8px_rgba(0,0,0,0.4)] flex items-center justify-center p-1.5 shrink-0 ${className}`}
        style={size ? { width: size, height: size } : undefined}
      >
        <img
          src={logoUrl}
          alt="Zaylo"
          className="w-full h-full object-contain"
        />
      </div>
    </div>
  );
};
