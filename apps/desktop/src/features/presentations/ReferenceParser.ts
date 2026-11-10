import type { PresentationPalette, ChartSpec, PresentationSpec, SlideSpec } from '@local-ai/shared';

export interface ExtractedDesignReference {
  palette?: Partial<PresentationPalette>;
  suggestedTheme?: string;
  headings?: string[];
  dataPoints?: { label: string; value: number }[];
}

/**
 * Extract dominant colors from an image dataUrl using a canvas sampler
 */
export async function extractPaletteFromImage(dataUrl: string): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(['#111111', '#2563EB', '#10B981', '#F59E0B']);
        return;
      }

      // Sample a small 64x64 thumbnail
      canvas.width = 64;
      canvas.height = 64;
      ctx.drawImage(img, 0, 0, 64, 64);
      const imgData = ctx.getImageData(0, 0, 64, 64).data;

      // Color frequency buckets
      const colorMap: Record<string, number> = {};
      for (let i = 0; i < imgData.length; i += 16) {
        const r = Math.round(imgData[i] / 32) * 32;
        const g = Math.round(imgData[i + 1] / 32) * 32;
        const b = Math.round(imgData[i + 2] / 32) * 32;
        const a = imgData[i + 3];

        // Skip fully transparent
        if (a < 128) continue;

        // Skip pure whites and pure blacks for accent colors
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        if (brightness > 240 || brightness < 15) continue;

        const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
        colorMap[hex] = (colorMap[hex] || 0) + 1;
      }

      // Sort by frequency
      const sorted = Object.entries(colorMap)
        .sort((a, b) => b[1] - a[1])
        .map(([hex]) => hex);

      const dominant = sorted.slice(0, 5);
      if (dominant.length === 0) {
        dominant.push('#2563EB', '#10B981', '#06B6D4');
      }
      resolve(dominant);
    };

    img.onerror = () => {
      resolve(['#111111', '#2563EB', '#10B981']);
    };

    img.src = dataUrl;
  });
}

/**
 * Parse CSV or TSV string into structured labels and numeric series
 */
export function parseCsvDataset(csvText: string): { labels: string[]; values: number[]; seriesName: string } {
  const lines = csvText.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { labels: ['A', 'B', 'C'], values: [10, 20, 30], seriesName: 'Data' };
  }

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^"|"$/g, ''));
  const labels: string[] = [];
  const values: number[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cols.length >= 2) {
      labels.push(cols[0]);
      values.push(parseFloat(cols[1]) || 0);
    }
  }

  return {
    labels,
    values,
    seriesName: headers[1] || 'Value',
  };
}

/**
 * Generate a presentation outline from text / document content
 */
export function buildPresentationFromText(title: string, content: string): PresentationSpec {
  const paragraphs = content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const slides: SlideSpec[] = [
    {
      id: 'slide-1',
      layout: 'title',
      title: title || 'Executive Briefing',
      subtitle: paragraphs[0]?.slice(0, 160) || 'Synthesized from uploaded reference documents',
      kicker: 'AI Analysis',
    },
    {
      id: 'slide-2',
      layout: 'executive-summary',
      title: 'Executive Summary',
      subtitle: 'Core findings and critical takeaways from source analysis',
      bullets: paragraphs.slice(0, 4).map((p) => p.slice(0, 140)),
    },
  ];

  if (paragraphs.length > 4) {
    slides.push({
      id: 'slide-3',
      layout: 'columns-3',
      title: 'Strategic Pillars',
      subtitle: 'Key thematic areas identified across documentation',
      cards: [
        {
          title: 'Foundation',
          subtitle: 'Core Capabilities',
          description: paragraphs[4]?.slice(0, 120) || 'Foundational architectural structures.',
          tag: 'Analysis',
        },
        {
          title: 'Execution',
          subtitle: 'Operational Flow',
          description: paragraphs[5]?.slice(0, 120) || 'Practical operational implementation.',
          tag: 'Operations',
        },
        {
          title: 'Impact',
          subtitle: 'Measurable Outcomes',
          description: paragraphs[6]?.slice(0, 120) || 'Projected organizational improvements.',
          tag: 'Outcome',
        },
      ],
    });
  }

  slides.push({
    id: 'slide-conclusion',
    layout: 'conclusion',
    title: 'Recommended Next Steps',
    subtitle: 'Immediate actions based on synthesis',
    bullets: [
      'Validate key assumptions with stakeholders',
      'Establish technical benchmark requirements',
      'Begin phase 1 execution milestone',
    ],
  });

  return {
    id: `pres-${Date.now()}`,
    title: title || 'Executive Presentation',
    subtitle: 'Generated with Zaylo Local AI Presentation Engine',
    theme: 'minimal-monochrome',
    slides,
  };
}

/**
 * Automatically create a presentation deck that features an existing ChartSpec
 */
export function createPresentationFromChart(chart: ChartSpec): PresentationSpec {
  return {
    id: `pres-${Date.now()}`,
    title: chart.title || 'Data Analysis Presentation',
    subtitle: chart.subtitle || 'Generated from Zaylo Chart Visualization',
    theme: 'apple-keynote',
    slides: [
      {
        id: 'slide-1',
        layout: 'title',
        title: chart.title || 'Data Analysis Briefing',
        subtitle: chart.subtitle || 'Key Trends, Performance Indicators & Strategic Takeaways',
        kicker: 'Visual Analytics',
      },
      {
        id: 'slide-2',
        layout: 'executive-summary',
        title: 'Executive Summary',
        subtitle: 'Data-driven overview of performance indicators and trends',
        bullets: [
          'Comprehensive performance metrics tracked across all categories.',
          'Strongest performance concentrated in highest-volume periods.',
          'Measurable efficiency gains demonstrated in visual analysis.',
        ],
      },
      {
        id: 'slide-3',
        layout: 'chart-data',
        title: chart.title || 'Performance Visualization',
        subtitle: 'Core dataset trends and distribution',
        chart: chart,
        bullets: [
          'Direct correlation between active inputs and output milestones.',
          'Sustained positive variance above standard historical thresholds.',
        ],
      },
      {
        id: 'slide-4',
        layout: 'columns-3',
        title: 'Strategic Priorities',
        subtitle: 'Immediate actions informed by quantitative findings',
        cards: [
          {
            title: 'Scale Strengths',
            subtitle: 'Growth Lever',
            description: 'Double down on top-performing segments identified in the dataset.',
            tag: 'Growth',
          },
          {
            title: 'Mitigate Variance',
            subtitle: 'Risk Control',
            description: 'Address cyclical dips through proactive operational adjustments.',
            tag: 'Operations',
          },
          {
            title: 'Target Objectives',
            subtitle: 'Milestones',
            description: 'Establish automated tracking dashboards for ongoing performance.',
            tag: 'Metrics',
          },
        ],
      },
      {
        id: 'slide-5',
        layout: 'conclusion',
        title: 'Conclusion & Next Steps',
        subtitle: 'Recommended follow-ups based on this visualization',
        bullets: [
          'Distribute PowerPoint deck to key operational stakeholders.',
          'Refine forecast models based on validated metric patterns.',
        ],
      },
    ],
  };
}

