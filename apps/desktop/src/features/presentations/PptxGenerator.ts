import PptxGenJS from 'pptxgenjs';
import type { PresentationSpec } from '@local-ai/shared';
import { getPresentationTheme } from './PresentationThemes';

function cleanHex(color: string): string {
  return color.replace('#', '').trim();
}

export function buildPptx(spec: PresentationSpec): PptxGenJS {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = spec.author || 'Zaylo AI Engine';
  pptx.title = spec.title || 'Presentation';

  const theme = getPresentationTheme(spec.theme, spec.palette);
  const p = theme.palette;

  const bgHex = cleanHex(p.background);
  const cardHex = cleanHex(p.cardBackground);
  const textPrimaryHex = cleanHex(p.textPrimary);
  const textSecondaryHex = cleanHex(p.textSecondary);
  const accentHex = cleanHex(p.accent);
  const borderHex = cleanHex(p.border);

  // Iterate slides
  for (let idx = 0; idx < spec.slides.length; idx++) {
    const s = spec.slides[idx];
    const slide = pptx.addSlide();

    // Background color
    slide.background = { color: bgHex };

    // Standard footer
    slide.addText(
      [
        { text: s.footerText || 'Zaylo AI Presentation Engine • Confidential', options: { fontSize: 9, color: textSecondaryHex } },
      ],
      { x: 0.8, y: 7.0, w: 8.5, h: 0.3 }
    );
    slide.addText(
      [
        { text: `${idx + 1} / ${spec.slides.length}`, options: { fontSize: 9, color: textSecondaryHex, align: 'right' } },
      ],
      { x: 11.5, y: 7.0, w: 1.0, h: 0.3 }
    );

    // Standard Slide Header (unless Title slide)
    if (s.layout !== 'title') {
      if (s.kicker) {
        slide.addText(s.kicker.toUpperCase(), {
          x: 0.8,
          y: 0.5,
          w: 11.5,
          h: 0.25,
          fontSize: 10,
          bold: true,
          color: accentHex,
        });
      }

      slide.addText(s.title, {
        x: 0.8,
        y: s.kicker ? 0.75 : 0.6,
        w: 11.5,
        h: 0.6,
        fontSize: 22,
        bold: true,
        color: textPrimaryHex,
      });

      if (s.subtitle && s.layout !== 'executive-summary') {
        slide.addText(s.subtitle, {
          x: 0.8,
          y: s.kicker ? 1.35 : 1.2,
          w: 11.5,
          h: 0.35,
          fontSize: 12,
          color: textSecondaryHex,
        });
      }
    }

    // Slide Body by Layout
    switch (s.layout) {
      // 1. TITLE SLIDE
      case 'title': {
        if (s.kicker) {
          slide.addText(s.kicker.toUpperCase(), {
            x: 1.5,
            y: 1.8,
            w: 10.3,
            h: 0.4,
            fontSize: 12,
            bold: true,
            color: accentHex,
            align: 'center',
          });
        }

        slide.addText(s.title, {
          x: 1.5,
          y: 2.3,
          w: 10.3,
          h: 1.8,
          fontSize: 40,
          bold: true,
          color: textPrimaryHex,
          align: 'center',
        });

        if (s.subtitle) {
          slide.addText(s.subtitle, {
            x: 2.0,
            y: 4.2,
            w: 9.3,
            h: 1.0,
            fontSize: 18,
            color: textSecondaryHex,
            align: 'center',
          });
        }
        break;
      }

      // 2. EXECUTIVE SUMMARY
      case 'executive-summary': {
        if (s.subtitle) {
          slide.addShape(pptx.ShapeType.roundRect, {
            x: 0.8,
            y: 1.5,
            w: 11.7,
            h: 0.8,
            fill: { color: cardHex },
            line: { color: borderHex, width: 1 },
          });
          slide.addText(
            [
              { text: 'Key Takeaway: ', options: { bold: true, color: accentHex } },
              { text: s.subtitle, options: { color: textPrimaryHex } },
            ],
            { x: 1.0, y: 1.5, w: 11.3, h: 0.8, fontSize: 13 }
          );
        }

        const bullets = s.bullets || [];
        const startY = s.subtitle ? 2.5 : 1.8;
        bullets.forEach((b, bIdx) => {
          const col = bIdx % 2;
          const row = Math.floor(bIdx / 2);
          const bx = 0.8 + col * 6.0;
          const by = startY + row * 1.4;

          slide.addShape(pptx.ShapeType.roundRect, {
            x: bx,
            y: by,
            w: 5.7,
            h: 1.2,
            fill: { color: cardHex },
            line: { color: borderHex, width: 1 },
          });

          slide.addText(
            [
              { text: `0${bIdx + 1}  `, options: { bold: true, color: accentHex, fontSize: 14 } },
              { text: b, options: { color: textPrimaryHex, fontSize: 11 } },
            ],
            { x: bx + 0.2, y: by + 0.1, w: 5.3, h: 1.0 }
          );
        });
        break;
      }

      // 3. AGENDA
      case 'agenda': {
        const items = s.bullets || [];
        items.forEach((item, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const x = 0.8 + col * 6.0;
          const y = 1.8 + row * 1.2;

          slide.addShape(pptx.ShapeType.roundRect, {
            x,
            y,
            w: 5.7,
            h: 1.0,
            fill: { color: cardHex },
            line: { color: borderHex, width: 1 },
          });

          slide.addText(
            [
              { text: String(i + 1).padStart(2, '0') + '  ', options: { bold: true, color: accentHex, fontSize: 18 } },
              { text: item, options: { bold: true, color: textPrimaryHex, fontSize: 13 } },
            ],
            { x: x + 0.2, y: y + 0.1, w: 5.3, h: 0.8 }
          );
        });
        break;
      }

      // 4. COLUMNS (2, 3, 4)
      case 'columns-2':
      case 'columns-3':
      case 'columns-4': {
        const colCount = s.layout === 'columns-2' ? 2 : s.layout === 'columns-4' ? 4 : 3;
        const cards = s.cards || [];
        const cardW = (11.7 - (colCount - 1) * 0.3) / colCount;

        cards.slice(0, colCount).forEach((card, cIdx) => {
          const cx = 0.8 + cIdx * (cardW + 0.3);

          slide.addShape(pptx.ShapeType.roundRect, {
            x: cx,
            y: 1.8,
            w: cardW,
            h: 4.8,
            fill: { color: cardHex },
            line: { color: borderHex, width: 1 },
          });

          const runs: any[] = [];
          if (card.tag) {
            runs.push({ text: card.tag.toUpperCase() + '\n', options: { fontSize: 9, bold: true, color: accentHex } });
          }
          runs.push({ text: card.title + '\n', options: { fontSize: 14, bold: true, color: textPrimaryHex } });
          if (card.subtitle) {
            runs.push({ text: card.subtitle + '\n\n', options: { fontSize: 11, color: accentHex } });
          } else {
            runs.push({ text: '\n', options: {} });
          }
          runs.push({ text: card.description, options: { fontSize: 11, color: textSecondaryHex } });

          slide.addText(runs, { x: cx + 0.25, y: 2.0, w: cardW - 0.5, h: 4.4 });
        });
        break;
      }

      // 5. METRICS & STATS
      case 'metrics-stats': {
        const stats = s.stats || [];
        const count = Math.min(stats.length, 4) || 1;
        const boxW = (11.7 - (count - 1) * 0.3) / count;

        stats.slice(0, 4).forEach((stat, stIdx) => {
          const sx = 0.8 + stIdx * (boxW + 0.3);

          slide.addShape(pptx.ShapeType.roundRect, {
            x: sx,
            y: 2.2,
            w: boxW,
            h: 3.2,
            fill: { color: cardHex },
            line: { color: borderHex, width: 1 },
          });

          slide.addText(
            [
              { text: stat.value + '\n', options: { fontSize: 32, bold: true, color: accentHex } },
              { text: stat.label.toUpperCase() + '\n', options: { fontSize: 11, bold: true, color: textPrimaryHex } },
              { text: stat.change ? `(${stat.change})` : '', options: { fontSize: 10, color: textSecondaryHex } },
            ],
            { x: sx + 0.1, y: 2.5, w: boxW - 0.2, h: 2.6, align: 'center' }
          );
        });
        break;
      }

      // 6. PROCESS STEPS
      case 'process-steps': {
        const steps = s.steps || [];
        const count = Math.min(steps.length, 4) || 1;
        const stepW = (11.7 - (count - 1) * 0.3) / count;

        steps.slice(0, 4).forEach((st, stIdx) => {
          const sx = 0.8 + stIdx * (stepW + 0.3);

          slide.addShape(pptx.ShapeType.roundRect, {
            x: sx,
            y: 2.2,
            w: stepW,
            h: 3.8,
            fill: { color: cardHex },
            line: { color: borderHex, width: 1 },
          });

          slide.addText(
            [
              { text: `STEP 0${st.stepNumber || stIdx + 1}\n\n`, options: { fontSize: 10, bold: true, color: accentHex } },
              { text: st.title + '\n\n', options: { fontSize: 13, bold: true, color: textPrimaryHex } },
              { text: st.description, options: { fontSize: 11, color: textSecondaryHex } },
            ],
            { x: sx + 0.2, y: 2.4, w: stepW - 0.4, h: 3.4 }
          );
        });
        break;
      }

      // 7. SWOT
      case 'swot': {
        const swot = s.swot || {
          strengths: ['High performance'],
          weaknesses: ['Resource demands'],
          opportunities: ['Market adoption'],
          threats: ['Fast market shifts'],
        };

        const quads = [
          { title: 'Strengths (S)', items: swot.strengths, color: '10B981', x: 0.8, y: 1.8 },
          { title: 'Weaknesses (W)', items: swot.weaknesses, color: 'F59E0B', x: 6.8, y: 1.8 },
          { title: 'Opportunities (O)', items: swot.opportunities, color: '3B82F6', x: 0.8, y: 4.4 },
          { title: 'Threats (T)', items: swot.threats, color: 'EF4444', x: 6.8, y: 4.4 },
        ];

        quads.forEach((q) => {
          slide.addShape(pptx.ShapeType.roundRect, {
            x: q.x,
            y: q.y,
            w: 5.7,
            h: 2.3,
            fill: { color: cardHex },
            line: { color: borderHex, width: 1 },
          });

          const bulletTexts = q.items.map((it) => ({
            text: `• ${it}\n`,
            options: { fontSize: 11, color: textSecondaryHex },
          }));

          slide.addText(
            [
              { text: q.title + '\n', options: { fontSize: 12, bold: true, color: q.color } },
              ...bulletTexts,
            ],
            { x: q.x + 0.2, y: q.y + 0.15, w: 5.3, h: 2.0 }
          );
        });
        break;
      }

      // 8. CHART SLIDE (Native PPTX Chart!)
      case 'chart-data': {
        if (s.chart) {
          const chartData = s.chart.series.map((ser) => ({
            name: ser.name,
            labels: s.chart?.labels || ser.data.map((_, i) => `Item ${i + 1}`),
            values: ser.data.map((d) => (typeof d === 'number' ? d : d.value || 0)),
          }));

          let pptxChartType = pptx.ChartType.bar;
          if (s.chart.type === 'line' || s.chart.type === 'area') pptxChartType = pptx.ChartType.line;
          else if (s.chart.type === 'pie') pptxChartType = pptx.ChartType.pie;
          else if (s.chart.type === 'donut') pptxChartType = pptx.ChartType.doughnut;
          else if (s.chart.type === 'radar') pptxChartType = pptx.ChartType.radar;

          slide.addChart(pptxChartType, chartData, {
            x: 0.8,
            y: 1.8,
            w: 7.5,
            h: 4.8,
            showTitle: false,
            showLegend: true,
            chartColors: [accentHex, '10B981', '06B6D4', 'F59E0B'],
          });

          // Key takeaways side card
          slide.addShape(pptx.ShapeType.roundRect, {
            x: 8.6,
            y: 1.8,
            w: 3.9,
            h: 4.8,
            fill: { color: cardHex },
            line: { color: borderHex, width: 1 },
          });

          const takeaways = (s.bullets || ['Strong growth observed', 'Clear margin expansion']).map((b) => ({
            text: `• ${b}\n\n`,
            options: { fontSize: 11, color: textPrimaryHex },
          }));

          slide.addText(
            [
              { text: 'KEY TAKEAWAYS\n\n', options: { fontSize: 11, bold: true, color: accentHex } },
              ...takeaways,
            ],
            { x: 8.8, y: 2.0, w: 3.5, h: 4.4 }
          );
        }
        break;
      }

      // 9. QUOTE
      case 'quote': {
        const q = s.quote || {
          quote: 'Innovation distinguishes between a leader and a follower.',
          author: 'Steve Jobs',
          role: 'Apple Inc.',
        };

        slide.addText('“', {
          x: 2.0,
          y: 1.8,
          w: 9.3,
          h: 0.8,
          fontSize: 60,
          bold: true,
          color: accentHex,
          align: 'center',
        });

        slide.addText(`"${q.quote}"`, {
          x: 2.0,
          y: 2.8,
          w: 9.3,
          h: 2.0,
          fontSize: 22,
          italic: true,
          color: textPrimaryHex,
          align: 'center',
        });

        slide.addText(`${q.author}${q.role ? ' — ' + q.role : ''}`, {
          x: 2.0,
          y: 5.0,
          w: 9.3,
          h: 0.6,
          fontSize: 14,
          bold: true,
          color: accentHex,
          align: 'center',
        });
        break;
      }

      // 10. CONCLUSION / NEXT STEPS
      case 'conclusion': {
        if (s.subtitle) {
          slide.addText(s.subtitle, {
            x: 0.8,
            y: 1.8,
            w: 11.7,
            h: 0.8,
            fontSize: 14,
            color: textPrimaryHex,
          });
        }

        const actions = s.bullets || ['Finalize requirements', 'Deploy MVP', 'Collect feedback'];
        actions.forEach((act, idx) => {
          const ax = 0.8 + idx * 4.0;
          slide.addShape(pptx.ShapeType.roundRect, {
            x: ax,
            y: 2.8,
            w: 3.7,
            h: 3.2,
            fill: { color: cardHex },
            line: { color: borderHex, width: 1 },
          });

          slide.addText(
            [
              { text: `ACTION 0${idx + 1}\n\n`, options: { fontSize: 10, bold: true, color: accentHex } },
              { text: act, options: { fontSize: 13, bold: true, color: textPrimaryHex } },
            ],
            { x: ax + 0.2, y: 3.0, w: 3.3, h: 2.8 }
          );
        });
        break;
      }

      default: {
        const bullets = (s.bullets || []).map((b) => ({
          text: `• ${b}\n\n`,
          options: { fontSize: 13, color: textPrimaryHex },
        }));
        slide.addText(bullets, { x: 1.0, y: 2.0, w: 11.3, h: 4.5 });
        break;
      }
    }

    // Export any added Custom Visual Elements (Shapes, Textboxes, Images, Tables, Charts)
    if (s.customElements && s.customElements.length > 0) {
      for (const el of s.customElements) {
        if (el.hidden) continue;
        const t = el.transform;
        const elX = (t.x / 100) * 13.33;
        const elY = (t.y / 100) * 7.5;
        const elW = (t.width / 100) * 13.33;
        const elH = (t.height / 100) * 7.5;

        if (el.type === 'text' && el.text) {
          slide.addText(el.text.content, {
            x: elX,
            y: elY,
            w: elW,
            h: elH,
            fontSize: el.text.style?.fontSize ? Math.round(el.text.style.fontSize * 0.75) : 12,
            bold: el.text.style?.bold,
            italic: el.text.style?.italic,
            underline: el.text.style?.underline ? { style: 'sng' } : undefined,
            color: el.text.style?.color ? cleanHex(el.text.style.color) : textPrimaryHex,
            align: el.text.style?.align || 'left',
          });
        } else if (el.type === 'shape' && el.shape) {
          const shapeType = el.shape.shapeType === 'circle' ? pptx.ShapeType.ellipse : pptx.ShapeType.roundRect;
          slide.addShape(shapeType, {
            x: elX,
            y: elY,
            w: elW,
            h: elH,
            fill: { color: el.shape.fillColor ? cleanHex(el.shape.fillColor) : cardHex },
            line: {
              color: el.shape.borderColor ? cleanHex(el.shape.borderColor) : accentHex,
              width: el.shape.borderWidth || 1,
            },
          });
        } else if (el.type === 'image' && el.image && el.image.url.startsWith('data:')) {
          slide.addImage({
            data: el.image.url,
            x: elX,
            y: elY,
            w: elW,
            h: elH,
          });
        } else if (el.type === 'table' && el.table) {
          const rows: any[][] = [];
          if (el.table.headers) {
            rows.push(el.table.headers.map((h) => ({ text: h, options: { bold: true, fill: cardHex } })));
          }
          for (const r of el.table.rows) {
            rows.push(r.map((c) => ({ text: c })));
          }
          slide.addTable(rows, {
            x: elX,
            y: elY,
            w: elW,
            h: elH,
            border: { pt: 1, color: borderHex },
          });
        }
      }
    }
  }

  return pptx;
}

export async function generatePptx(
  spec: PresentationSpec,
  fileName?: string
): Promise<void> {
  const pptx = buildPptx(spec);
  // Write and trigger download
  const outName = (fileName || spec.title || 'Zaylo_Presentation').replace(/[/\\?%*:|"<>]/g, '_') + '.pptx';
  await pptx.writeFile({ fileName: outName });
}
