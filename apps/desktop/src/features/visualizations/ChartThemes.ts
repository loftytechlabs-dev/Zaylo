import type { ChartThemeName } from '@local-ai/shared';

export interface ChartThemeDefinition {
  name: ChartThemeName;
  label: string;
  description: string;
  background: string;
  cardBg: string;
  textColor: string;
  subtextColor: string;
  gridColor: string;
  axisColor: string;
  tooltipBg: string;
  tooltipText: string;
  palette: string[];
}

export const CHART_THEMES: Record<ChartThemeName, ChartThemeDefinition> = {
  'minimal-white': {
    name: 'minimal-white',
    label: 'Minimal White',
    description: 'Pure white canvas with high-contrast neutral blacks and charcoals',
    background: '#FFFFFF',
    cardBg: '#FAFAFA',
    textColor: '#111111',
    subtextColor: '#666666',
    gridColor: '#EAEAEA',
    axisColor: '#CCCCCC',
    tooltipBg: '#111111',
    tooltipText: '#FFFFFF',
    palette: ['#111111', '#555555', '#888888', '#AAAAAA', '#222222', '#666666'],
  },
  'premium-black': {
    name: 'premium-black',
    label: 'Premium Black',
    description: 'Deep #090909 dark surface with crisp bright highlights',
    background: '#090909',
    cardBg: '#141414',
    textColor: '#F5F5F5',
    subtextColor: '#A1A1AA',
    gridColor: '#262626',
    axisColor: '#3F3F46',
    tooltipBg: '#1C1C1E',
    tooltipText: '#FFFFFF',
    palette: ['#FFFFFF', '#10B981', '#06B6D4', '#818CF8', '#F59E0B', '#F43F5E'],
  },
  'apple-inspired': {
    name: 'apple-inspired',
    label: 'Apple-inspired',
    description: 'Vibrant SF-palette accents with soft curves and clean readability',
    background: '#FFFFFF',
    cardBg: '#F8F9FA',
    textColor: '#1D1D1F',
    subtextColor: '#86868B',
    gridColor: '#F0F0F2',
    axisColor: '#D2D2D7',
    tooltipBg: '#1D1D1F',
    tooltipText: '#FFFFFF',
    palette: ['#007AFF', '#34C759', '#AF52DE', '#FF9500', '#5856D6', '#FF2D55'],
  },
  'corporate': {
    name: 'corporate',
    label: 'Corporate',
    description: 'Executive navy, slate blue, and steel tones for business reports',
    background: '#FFFFFF',
    cardBg: '#F8FAFC',
    textColor: '#0F172A',
    subtextColor: '#64748B',
    gridColor: '#E2E8F0',
    axisColor: '#CBD5E1',
    tooltipBg: '#0F172A',
    tooltipText: '#F8FAFC',
    palette: ['#1E3A8A', '#2563EB', '#0284C7', '#0D9488', '#475569', '#64748B'],
  },
  'editorial': {
    name: 'editorial',
    label: 'Editorial',
    description: 'Warm cream, deep ink, and burnt ochre inspired by print publications',
    background: '#FAF8F5',
    cardBg: '#F2EFE9',
    textColor: '#1C1917',
    subtextColor: '#78716C',
    gridColor: '#E7E5E4',
    axisColor: '#D6D3D1',
    tooltipBg: '#1C1917',
    tooltipText: '#FAF8F5',
    palette: ['#1C1917', '#B45309', '#047857', '#9A3412', '#4D7C0F', '#78350F'],
  },
  'financial': {
    name: 'financial',
    label: 'Financial Dashboard',
    description: 'Trading emeralds, alert crimson, and market trend indicators',
    background: '#0B0F19',
    cardBg: '#111827',
    textColor: '#F9FAFB',
    subtextColor: '#9CA3AF',
    gridColor: '#1F2937',
    axisColor: '#374151',
    tooltipBg: '#111827',
    tooltipText: '#F9FAFB',
    palette: ['#10B981', '#EF4444', '#3B82F6', '#F59E0B', '#8B5CF6', '#14B8A6'],
  },
  'scientific': {
    name: 'scientific',
    label: 'Scientific',
    description: 'Colorblind-safe Viridis spectrum designed for quantitative datasets',
    background: '#FFFFFF',
    cardBg: '#F9FAFB',
    textColor: '#111827',
    subtextColor: '#4B5563',
    gridColor: '#E5E7EB',
    axisColor: '#D1D5DB',
    tooltipBg: '#111827',
    tooltipText: '#F9FAFB',
    palette: ['#440154', '#3B528B', '#21908C', '#5DC863', '#FDE725', '#2A788E'],
  },
  'colorful': {
    name: 'colorful',
    label: 'Colorful Modern',
    description: 'Energetic modern hues with rich contrast and visual pop',
    background: '#FFFFFF',
    cardBg: '#F8FAFC',
    textColor: '#0F172A',
    subtextColor: '#64748B',
    gridColor: '#E2E8F0',
    axisColor: '#CBD5E1',
    tooltipBg: '#0F172A',
    tooltipText: '#FFFFFF',
    palette: ['#6366F1', '#EC4899', '#8B5CF6', '#10B981', '#F59E0B', '#06B6D4'],
  },
  'monochrome': {
    name: 'monochrome',
    label: 'Minimal Monochrome',
    description: 'Strict grayscale tonal gradient with stark structural lines',
    background: '#FFFFFF',
    cardBg: '#F4F4F5',
    textColor: '#09090B',
    subtextColor: '#71717A',
    gridColor: '#E4E4E7',
    axisColor: '#D4D4D8',
    tooltipBg: '#09090B',
    tooltipText: '#FAFAFA',
    palette: ['#09090B', '#3F3F46', '#71717A', '#A1A1AA', '#27272A', '#52525B'],
  },
  'custom': {
    name: 'custom',
    label: 'Custom Theme',
    description: 'User-specified colors and parameters',
    background: '#FFFFFF',
    cardBg: '#F4F4F5',
    textColor: '#111111',
    subtextColor: '#666666',
    gridColor: '#E5E5E5',
    axisColor: '#CCCCCC',
    tooltipBg: '#111111',
    tooltipText: '#FFFFFF',
    palette: ['#000000', '#2563EB', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'],
  },
};

export function getChartTheme(themeName: ChartThemeName, custom?: Partial<ChartThemeDefinition>): ChartThemeDefinition {
  const base = CHART_THEMES[themeName] || CHART_THEMES['minimal-white'];
  if (themeName === 'custom' && custom) {
    return {
      ...base,
      ...custom,
      palette: custom.palette && custom.palette.length > 0 ? custom.palette : base.palette,
    };
  }
  return base;
}
