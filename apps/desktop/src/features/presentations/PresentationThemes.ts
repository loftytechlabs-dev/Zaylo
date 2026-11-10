import type { PresentationThemeName, PresentationPalette } from '@local-ai/shared';

export interface PresentationThemeDefinition {
  name: PresentationThemeName;
  label: string;
  description: string;
  fontFamily: string;
  headingFont: string;
  palette: PresentationPalette;
  borderRadius: string;
  isDark: boolean;
}

export const PRESENTATION_THEMES: Record<PresentationThemeName, PresentationThemeDefinition> = {
  'minimal-monochrome': {
    name: 'minimal-monochrome',
    label: 'Minimal Monochrome',
    description: 'Swiss-inspired black & white typography with pristine whitespace',
    fontFamily: 'Inter, -apple-system, sans-serif',
    headingFont: 'Inter, -apple-system, sans-serif',
    borderRadius: '8px',
    isDark: false,
    palette: {
      background: '#FFFFFF',
      cardBackground: '#F7F7F7',
      textPrimary: '#000000',
      textSecondary: '#666666',
      accent: '#000000',
      accentSecondary: '#333333',
      border: '#E5E5E5',
    },
  },
  'midnight-executive': {
    name: 'midnight-executive',
    label: 'Midnight Executive',
    description: 'Deep onyx dark canvas with champagne gold and platinum highlights',
    fontFamily: 'Inter, system-ui, sans-serif',
    headingFont: 'Inter, system-ui, sans-serif',
    borderRadius: '12px',
    isDark: true,
    palette: {
      background: '#090909',
      cardBackground: '#141414',
      textPrimary: '#F5F5F5',
      textSecondary: '#A1A1AA',
      accent: '#D4AF37', // Gold
      accentSecondary: '#E2E8F0',
      border: '#262626',
    },
  },
  'apple-keynote': {
    name: 'apple-keynote',
    label: 'Apple Keynote Minimalist',
    description: 'Ultra-refined light gray cards, SF Pro typography, and airy breathing room',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
    headingFont: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
    borderRadius: '16px',
    isDark: false,
    palette: {
      background: '#FFFFFF',
      cardBackground: '#F5F5F7',
      textPrimary: '#1D1D1F',
      textSecondary: '#86868B',
      accent: '#0071E3',
      accentSecondary: '#34C759',
      border: '#E5E5EA',
    },
  },
  'modern-saas': {
    name: 'modern-saas',
    label: 'Modern SaaS / Tech',
    description: 'High-contrast tech aesthetic with indigo accents and pill badges',
    fontFamily: 'Inter, sans-serif',
    headingFont: 'Inter, sans-serif',
    borderRadius: '10px',
    isDark: false,
    palette: {
      background: '#FFFFFF',
      cardBackground: '#F8FAFC',
      textPrimary: '#0F172A',
      textSecondary: '#64748B',
      accent: '#4F46E5', // Indigo
      accentSecondary: '#06B6D4',
      border: '#E2E8F0',
    },
  },
  'financial-investor': {
    name: 'financial-investor',
    label: 'Financial & Investor',
    description: 'Wall Street navy, structured KPI metrics, and emerald performance badges',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    headingFont: 'system-ui, -apple-system, sans-serif',
    borderRadius: '6px',
    isDark: false,
    palette: {
      background: '#FFFFFF',
      cardBackground: '#F8FAFC',
      textPrimary: '#0F172A',
      textSecondary: '#475569',
      accent: '#0F766E', // Deep Teal / Emerald
      accentSecondary: '#1E3A8A',
      border: '#CBD5E1',
    },
  },
  'consulting-mckinsey': {
    name: 'consulting-mckinsey',
    label: 'Consulting / McKinsey Style',
    description: 'Strict structured takeaway headers, lead-in conclusions, and analysis columns',
    fontFamily: 'Georgia, serif',
    headingFont: 'Arial, sans-serif',
    borderRadius: '4px',
    isDark: false,
    palette: {
      background: '#FFFFFF',
      cardBackground: '#F9FAFB',
      textPrimary: '#111827',
      textSecondary: '#4B5563',
      accent: '#1E3A8A',
      accentSecondary: '#B91C1C',
      border: '#E5E7EB',
    },
  },
  'bold-editorial': {
    name: 'bold-editorial',
    label: 'Bold Editorial',
    description: 'Large high-impact typography with warm cream tone and strong hierarchy',
    fontFamily: 'Charter, Georgia, serif',
    headingFont: 'Charter, Georgia, serif',
    borderRadius: '0px',
    isDark: false,
    palette: {
      background: '#FAF8F5',
      cardBackground: '#F2EFE9',
      textPrimary: '#1C1917',
      textSecondary: '#78716C',
      accent: '#9A3412', // Rust Ochre
      accentSecondary: '#292524',
      border: '#D6D3D1',
    },
  },
  'scientific-research': {
    name: 'scientific-research',
    label: 'Scientific & Academic',
    description: 'Rigorous layout with structured methodology, equations, and citations',
    fontFamily: 'Inter, system-ui, sans-serif',
    headingFont: 'Inter, system-ui, sans-serif',
    borderRadius: '4px',
    isDark: false,
    palette: {
      background: '#FFFFFF',
      cardBackground: '#F9FAFB',
      textPrimary: '#111827',
      textSecondary: '#4B5563',
      accent: '#0369A1', // Sky/Navy
      accentSecondary: '#4338CA',
      border: '#E5E7EB',
    },
  },
  'creative-pitch': {
    name: 'creative-pitch',
    label: 'Creative Pitch Deck',
    description: 'Dynamic layouts, bold headlines, and vibrant creative contrast',
    fontFamily: 'Inter, sans-serif',
    headingFont: 'Inter, sans-serif',
    borderRadius: '16px',
    isDark: true,
    palette: {
      background: '#0D0D11',
      cardBackground: '#16161F',
      textPrimary: '#FFFFFF',
      textSecondary: '#94A3B8',
      accent: '#EC4899', // Pink
      accentSecondary: '#8B5CF6',
      border: '#2A2A38',
    },
  },
  'cyberpunk-dark': {
    name: 'cyberpunk-dark',
    label: 'Developer / Cyberpunk Dark',
    description: 'Terminal monospace fonts, emerald phosphor code frames, and dark mode',
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    headingFont: 'Inter, sans-serif',
    borderRadius: '4px',
    isDark: true,
    palette: {
      background: '#0A0A0A',
      cardBackground: '#121212',
      textPrimary: '#E0E0E0',
      textSecondary: '#888888',
      accent: '#00FF66', // Terminal Green
      accentSecondary: '#00E5FF',
      border: '#222222',
    },
  },
  'clean-corporate': {
    name: 'clean-corporate',
    label: 'Clean Corporate',
    description: 'Standard polished corporate enterprise palette with steel blue accents',
    fontFamily: 'Inter, -apple-system, sans-serif',
    headingFont: 'Inter, -apple-system, sans-serif',
    borderRadius: '8px',
    isDark: false,
    palette: {
      background: '#FFFFFF',
      cardBackground: '#F8FAFC',
      textPrimary: '#0F172A',
      textSecondary: '#64748B',
      accent: '#0284C7',
      accentSecondary: '#0369A1',
      border: '#E2E8F0',
    },
  },
  'custom-brand': {
    name: 'custom-brand',
    label: 'Custom Brand',
    description: 'User-specified corporate identity and color scheme',
    fontFamily: 'Inter, sans-serif',
    headingFont: 'Inter, sans-serif',
    borderRadius: '10px',
    isDark: false,
    palette: {
      background: '#FFFFFF',
      cardBackground: '#F5F5F5',
      textPrimary: '#111111',
      textSecondary: '#666666',
      accent: '#000000',
      accentSecondary: '#333333',
      border: '#EAEAEA',
    },
  },
};

export function getPresentationTheme(
  themeName: PresentationThemeName,
  customPalette?: PresentationPalette
): PresentationThemeDefinition {
  const base = PRESENTATION_THEMES[themeName] || PRESENTATION_THEMES['minimal-monochrome'];
  if (customPalette) {
    return {
      ...base,
      palette: { ...base.palette, ...customPalette },
    };
  }
  return base;
}
