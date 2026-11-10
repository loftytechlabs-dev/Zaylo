import type { ChartSpec, PresentationSpec } from '@local-ai/shared';

export interface ParsedSpecs {
  cleanContent: string;
  charts: ChartSpec[];
  presentations: PresentationSpec[];
}

export function parseMessageSpecs(content: string): ParsedSpecs {
  if (!content) {
    return { cleanContent: '', charts: [], presentations: [] };
  }

  const charts: ChartSpec[] = [];
  const presentations: PresentationSpec[] = [];

  // Match code blocks like ```json:chart-spec, ```chart, ```json:presentation-spec, ```presentation, or ```json
  const blockRegex = /```(?:json:(?:chart-spec|presentation-spec)|chart|presentation|json)?\s*([\s\S]*?)```/g;

  let cleanContent = content;

  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(content)) !== null) {
    const rawBlock = match[1]?.trim();
    if (!rawBlock) continue;

    try {
      const parsed = JSON.parse(rawBlock);

      // Check if it's a PresentationSpec
      if (
        parsed &&
        typeof parsed === 'object' &&
        Array.isArray(parsed.slides) &&
        parsed.slides.length > 0
      ) {
        presentations.push(parsed as PresentationSpec);
        cleanContent = cleanContent.replace(match[0], '').trim();
      }
      // Check if it's a ChartSpec
      else if (
        parsed &&
        typeof parsed === 'object' &&
        typeof parsed.type === 'string' &&
        Array.isArray(parsed.series) &&
        parsed.title
      ) {
        charts.push(parsed as ChartSpec);
        cleanContent = cleanContent.replace(match[0], '').trim();
      }
    } catch {
      // Not valid JSON, leave as normal markdown
    }
  }

  return {
    cleanContent,
    charts,
    presentations,
  };
}
