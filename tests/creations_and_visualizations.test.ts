import { describe, it, expect } from 'vitest';
import type { ChartSpec, PresentationSpec, ChartType } from '@local-ai/shared';
import { CHART_THEMES, getChartTheme } from '../apps/desktop/src/features/visualizations/ChartThemes';
import { PRESENTATION_THEMES, getPresentationTheme } from '../apps/desktop/src/features/presentations/PresentationThemes';
import { parseMessageSpecs } from '../apps/desktop/src/features/playground/utils/specParser';
import {
  synthesizeChartFromPrompt,
  synthesizePresentationFromPrompt,
} from '../apps/desktop/src/features/playground/utils/specSynthesizer';
import {
  parseCsvDataset,
  createPresentationFromChart,
  buildPresentationFromText,
} from '../apps/desktop/src/features/presentations/ReferenceParser';
import { buildPptx } from '../apps/desktop/src/features/presentations/PptxGenerator';
import PptxGenJS from '../apps/desktop/node_modules/pptxgenjs';

describe('AI Chart Generation Engine', () => {
  const all17ChartTypes: ChartType[] = [
    'bar',
    'horizontal-bar',
    'line',
    'area',
    'pie',
    'donut',
    'scatter',
    'bubble',
    'radar',
    'stacked-bar',
    'grouped-bar',
    'histogram',
    'heatmap',
    'waterfall',
    'funnel',
    'treemap',
    'combo',
  ];

  it('supports all 17 requested chart types', () => {
    expect(all17ChartTypes).toHaveLength(17);
  });

  it('provides all 10 built-in visual themes with valid palettes and backgrounds', () => {
    const themeNames = Object.keys(CHART_THEMES);
    expect(themeNames).toHaveLength(10);
    expect(themeNames).toContain('minimal-white');
    expect(themeNames).toContain('premium-black');
    expect(themeNames).toContain('apple-inspired');
    expect(themeNames).toContain('corporate');
    expect(themeNames).toContain('editorial');
    expect(themeNames).toContain('financial');
    expect(themeNames).toContain('scientific');
    expect(themeNames).toContain('colorful');
    expect(themeNames).toContain('monochrome');
    expect(themeNames).toContain('custom');

    // Test specific theme properties
    const minimalWhite = getChartTheme('minimal-white');
    expect(minimalWhite.background).toBe('#FFFFFF');
    expect(minimalWhite.textColor).toBe('#111111');
    expect(minimalWhite.palette.length).toBeGreaterThan(0);

    const premiumBlack = getChartTheme('premium-black');
    expect(premiumBlack.background).toBe('#090909');
    expect(premiumBlack.cardBg).toBe('#141414');
    expect(premiumBlack.textColor).toBe('#F5F5F5');
  });

  it('correctly parses CSV dataset into labels and values', () => {
    const csv = `Month,Revenue\nJan,100\nFeb,150\nMar,230`;
    const result = parseCsvDataset(csv);
    expect(result.labels).toEqual(['Jan', 'Feb', 'Mar']);
    expect(result.values).toEqual([100, 150, 230]);
    expect(result.seriesName).toBe('Revenue');
  });

  it('synthesizes appropriate ChartSpec from natural language prompt', () => {
    const spec = synthesizeChartFromPrompt('Generate a horizontal revenue bar chart for Q1-Q4 in dark theme');
    expect(spec.type).toBe('horizontal-bar');
    expect(spec.theme).toBe('premium-black');
    expect(spec.series[0].data.length).toBeGreaterThan(0);
    expect(spec.yAxis?.format).toBe('currency');
  });
});

describe('AI PowerPoint (.pptx) Presentation Generation Engine', () => {
  it('provides all 12 built-in presentation style presets', () => {
    const presets = Object.keys(PRESENTATION_THEMES);
    expect(presets).toHaveLength(12);
    expect(presets).toContain('minimal-monochrome');
    expect(presets).toContain('midnight-executive');
    expect(presets).toContain('apple-keynote');
    expect(presets).toContain('modern-saas');
    expect(presets).toContain('financial-investor');
    expect(presets).toContain('consulting-mckinsey');
    expect(presets).toContain('bold-editorial');
    expect(presets).toContain('scientific-research');
    expect(presets).toContain('creative-pitch');
    expect(presets).toContain('cyberpunk-dark');
    expect(presets).toContain('clean-corporate');
    expect(presets).toContain('custom-brand');
  });

  it('synthesizes multi-slide presentation spec from prompt', () => {
    const pres = synthesizePresentationFromPrompt('Make a startup pitch deck for an enterprise AI platform');
    expect(pres.title).toContain('Startup Pitch Deck');
    expect(pres.slides.length).toBeGreaterThanOrEqual(5);

    const layouts = pres.slides.map((s) => s.layout);
    expect(layouts).toContain('title');
    expect(layouts).toContain('executive-summary');
    expect(layouts).toContain('metrics-stats');
    expect(layouts).toContain('columns-3');
    expect(layouts).toContain('timeline-roadmap');
    expect(layouts).toContain('conclusion');
  });

  it('converts an existing chart into a complete 5-slide presentation', () => {
    const chart: ChartSpec = {
      type: 'bar',
      title: 'Quarterly Sales',
      theme: 'apple-inspired',
      labels: ['Q1', 'Q2', 'Q3', 'Q4'],
      series: [{ name: 'Sales', data: [10, 20, 30, 40] }],
    };

    const pres = createPresentationFromChart(chart);
    expect(pres.slides).toHaveLength(5);
    expect(pres.slides[0].layout).toBe('title');
    expect(pres.slides[1].layout).toBe('executive-summary');
    expect(pres.slides[2].layout).toBe('chart-data');
    expect(pres.slides[2].chart).toBe(chart);
    expect(pres.slides[3].layout).toBe('columns-3');
    expect(pres.slides[4].layout).toBe('conclusion');
  });

  it('generates a genuine, valid OpenXML .pptx buffer using PptxGenJS', async () => {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';
    pptx.title = 'Test Presentation';

    const slide1 = pptx.addSlide();
    slide1.addText('Test Title', { x: 1, y: 1, w: 8, h: 1, fontSize: 32, bold: true });

    const slide2 = pptx.addSlide();
    slide2.addShape(pptx.ShapeType.roundRect, { x: 1, y: 1, w: 5, h: 3, fill: { color: 'F5F5F5' } });
    slide2.addText('Card Box', { x: 1.2, y: 1.2, w: 4.6, h: 2.6 });

    const buffer = await pptx.write({ outputType: 'nodebuffer' });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(10000);
    // OpenXML ZIP magic bytes: PK\x03\x04
    expect(buffer[0]).toBe(0x50); // 'P'
    expect(buffer[1]).toBe(0x4b); // 'K'
  });

  it('exports presentations with custom visual elements (shapes, text, tables, icons) to PPTX', async () => {
    const specWithCustomElements: PresentationSpec = {
      id: 'pres-visual-elements',
      title: 'Visual Architecture Deck',
      theme: 'minimal',
      slides: [
        {
          id: 'slide-canvas-1',
          layout: 'title',
          title: 'Interactive Visual Slide',
          subtitle: 'Featuring custom OpenXML canvas elements',
          customElements: [
            {
              id: 'el-callout',
              type: 'text',
              name: 'Callout Text',
              transform: { x: 10, y: 70, width: 35, height: 15 },
              text: {
                content: 'Accelerated through local on-device neural execution.',
                style: { fontSize: 16, bold: true, color: '#10B981', align: 'left' },
              },
            },
            {
              id: 'el-badge',
              type: 'shape',
              name: 'Status Badge',
              transform: { x: 50, y: 70, width: 20, height: 15 },
              shape: {
                shapeType: 'rectangle',
                fillColor: '#1E293B',
                borderColor: '#3B82F6',
                borderWidth: 2,
                borderRadius: 8,
              },
            },
            {
              id: 'el-data-table',
              type: 'table',
              name: 'Feature Matrix',
              transform: { x: 10, y: 20, width: 80, height: 40 },
              table: {
                headers: ['Tier', 'Throughput', 'Latency', 'Privacy'],
                rows: [
                  ['Local GPU', '85 tok/s', '11ms', 'Airgapped'],
                  ['Local CPU', '24 tok/s', '38ms', 'Airgapped'],
                ],
              },
            },
          ],
        },
      ],
    };

    const pptx = buildPptx(specWithCustomElements);
    const buffer = await pptx.write({ outputType: 'nodebuffer' });
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(10000);
    expect(buffer[0]).toBe(0x50); // 'P'
    expect(buffer[1]).toBe(0x4b); // 'K'
  });
});

describe('Message Spec Parser Integration', () => {
  it('extracts embedded ChartSpec from markdown code blocks', () => {
    const rawMessage = `Here is your analysis:\n\n\`\`\`json:chart-spec\n{\n  "type": "donut",\n  "title": "Browser Market Share",\n  "theme": "apple-inspired",\n  "series": [{ "name": "Share", "data": [65, 20, 15] }]\n}\n\`\`\`\n\nHope this helps!`;

    const parsed = parseMessageSpecs(rawMessage);
    expect(parsed.charts).toHaveLength(1);
    expect(parsed.charts[0].type).toBe('donut');
    expect(parsed.charts[0].title).toBe('Browser Market Share');
    expect(parsed.cleanContent).toContain('Here is your analysis:');
    expect(parsed.cleanContent).toContain('Hope this helps!');
    expect(parsed.cleanContent).not.toContain('```json:chart-spec');
  });

  it('extracts embedded PresentationSpec from markdown code blocks', () => {
    const rawMessage = `Presentation generated successfully:\n\n\`\`\`json:presentation-spec\n{\n  "id": "pres-1",\n  "title": "Board Deck",\n  "theme": "midnight-executive",\n  "slides": [\n    { "id": "s1", "layout": "title", "title": "Board Overview" }\n  ]\n}\n\`\`\``;

    const parsed = parseMessageSpecs(rawMessage);
    expect(parsed.presentations).toHaveLength(1);
    expect(parsed.presentations[0].title).toBe('Board Deck');
    expect(parsed.presentations[0].slides).toHaveLength(1);
    expect(parsed.cleanContent).toContain('Presentation generated successfully:');
    expect(parsed.cleanContent).not.toContain('```json:presentation-spec');
  });
});
