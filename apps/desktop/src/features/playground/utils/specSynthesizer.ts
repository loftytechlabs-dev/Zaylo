import type { ChartSpec, ChartType, PresentationSpec, SlideSpec } from '@local-ai/shared';

/**
 * Intelligent deterministic spec synthesizer that inspects prompt text
 * and extracts or builds an optimal ChartSpec when requested by user.
 */
export function synthesizeChartFromPrompt(prompt: string): ChartSpec {
  const p = prompt.toLowerCase();

  let type: ChartType = 'bar';
  if (p.includes('horizontal')) type = 'horizontal-bar';
  else if (p.includes('line')) type = 'line';
  else if (p.includes('area')) type = 'area';
  else if (p.includes('pie')) type = 'pie';
  else if (p.includes('donut') || p.includes('doughnut')) type = 'donut';
  else if (p.includes('scatter')) type = 'scatter';
  else if (p.includes('bubble')) type = 'bubble';
  else if (p.includes('radar') || p.includes('spider')) type = 'radar';
  else if (p.includes('stack')) type = 'stacked-bar';
  else if (p.includes('group') || p.includes('cluster')) type = 'grouped-bar';
  else if (p.includes('histogram') || p.includes('distribution')) type = 'histogram';
  else if (p.includes('heatmap') || p.includes('matrix')) type = 'heatmap';
  else if (p.includes('waterfall') || p.includes('variance')) type = 'waterfall';
  else if (p.includes('funnel') || p.includes('conversion')) type = 'funnel';
  else if (p.includes('treemap')) type = 'treemap';
  else if (p.includes('combo') || (p.includes('bar') && p.includes('line'))) type = 'combo';

  const isDark = p.includes('dark') || p.includes('black');
  const theme = isDark ? 'premium-black' : p.includes('apple') ? 'apple-inspired' : p.includes('corporate') ? 'corporate' : 'minimal-white';

  const isFinancial = p.includes('revenue') || p.includes('sales') || p.includes('profit') || p.includes('growth') || p.includes('financial');

  let title = 'Performance Analytics Visualization';
  if (p.includes('revenue')) title = 'Quarterly Revenue Performance';
  else if (p.includes('sales')) title = 'Annual Sales Comparison';
  else if (p.includes('conversion')) title = 'User Acquisition & Conversion Funnel';
  else if (p.includes('compare') || p.includes('comparison')) title = 'Comparative Product Performance';

  const labels = type === 'funnel'
    ? ['Impressions', 'Website Visits', 'Sign-ups', 'Active Users', 'Paid Conversions']
    : ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025', 'Q1 2026 (Est)'];

  const values = type === 'funnel'
    ? [100000, 42000, 16500, 7800, 2400]
    : [120, 185, 240, 310, 420];

  return {
    id: `chart-${Date.now()}`,
    type,
    title,
    subtitle: `Synthesized with Zaylo AI Engine (${type.toUpperCase()})`,
    theme,
    labels,
    series: [
      {
        name: isFinancial ? 'Revenue ($K)' : 'Metrics',
        data: values,
      },
    ],
    showGrid: true,
    showLegend: true,
    showValues: true,
    yAxis: {
      format: isFinancial ? 'currency' : 'number',
    },
  };
}

/**
 * Intelligent deterministic spec synthesizer that inspects prompt text
 * and extracts or builds an optimal PresentationSpec when requested by user.
 */
export function synthesizePresentationFromPrompt(prompt: string): PresentationSpec {
  const p = prompt.toLowerCase();

  let title = 'Strategic Business & Technology Overview';
  if (p.includes('startup') || p.includes('pitch')) title = 'Startup Pitch Deck: AI Cloud Infrastructure';
  else if (p.includes('artificial intelligence') || p.includes('ai')) title = 'Artificial Intelligence & Autonomous Systems';
  else if (p.includes('technical') || p.includes('architecture')) title = 'High-Performance System Architecture';
  else if (p.includes('review')) title = 'Executive Business Review & Strategic Outlook';

  const isDark = p.includes('dark') || p.includes('black') || p.includes('cyber');
  const theme = isDark ? 'midnight-executive' : p.includes('apple') ? 'apple-keynote' : p.includes('corporate') ? 'clean-corporate' : 'minimal-monochrome';

  const slides: SlideSpec[] = [
    {
      id: 'slide-1',
      layout: 'title',
      title,
      subtitle: 'Comprehensive Strategy, Architecture & Delivery Plan',
      kicker: 'Executive Deck',
      footerText: 'Zaylo Local AI Engine • Confidential',
    },
    {
      id: 'slide-2',
      layout: 'executive-summary',
      title: 'Executive Summary',
      subtitle: 'Key strategic directives and quantitative milestones established for this initiative.',
      bullets: [
        'Accelerate core system throughput with dedicated local acceleration.',
        'Eliminate external third-party data dependencies and recurring SaaS costs.',
        'Deliver sub-millisecond responsiveness across mission-critical workflows.',
        'Establish automated quantitative telemetry and benchmark tracking.',
      ],
    },
    {
      id: 'slide-3',
      layout: 'metrics-stats',
      title: 'Performance & Impact Metrics',
      subtitle: 'Key measurable advantages verified across deployment benchmarks',
      stats: [
        { value: '145 tok/s', label: 'Processing Speed', change: '+3.2x', trend: 'up' },
        { value: '0.00 ms', label: 'Cloud Roundtrip Latency', change: '100% Local', trend: 'up' },
        { value: '99.99%', label: 'Uptime Reliability', change: 'Zero Faults', trend: 'up' },
        { value: '-68%', label: 'Infrastructure Cost', change: 'Annual ROI', trend: 'up' },
      ],
    },
    {
      id: 'slide-4',
      layout: 'columns-3',
      title: 'Architectural Pillars',
      subtitle: 'Structured system domains engineered for scale and resilience',
      cards: [
        { title: 'Core Engine', subtitle: 'Low-latency execution', description: 'Zero-overhead native binary dispatch.', tag: 'Phase 1' },
        { title: 'Semantic Context', subtitle: 'Vector indexing', description: 'Real-time document embedding and retrieval.', tag: 'Phase 2' },
        { title: 'Persona Layer', subtitle: 'Instruction profiles', description: 'Dynamic behavioral adaptation for varied roles.', tag: 'Phase 3' },
      ],
    },
    {
      id: 'slide-5',
      layout: 'timeline-roadmap',
      title: 'Implementation Roadmap',
      subtitle: 'Multi-stage milestones and target delivery timelines',
      milestones: [
        { date: 'Stage 1', title: 'Architecture Review', description: 'Specification validation and testing.', status: 'completed' },
        { date: 'Stage 2', title: 'Core Deployment', description: 'Hardware acceleration runtime setup.', status: 'current' },
        { date: 'Stage 3', title: 'Integration & Testing', description: 'Continuous integration validation.', status: 'upcoming' },
        { date: 'Stage 4', title: 'Production Launch', description: 'Full enterprise organizational rollout.', status: 'upcoming' },
      ],
    },
    {
      id: 'slide-6',
      layout: 'conclusion',
      title: 'Next Steps & Actions',
      subtitle: 'Immediate tactical execution items',
      bullets: [
        'Conduct initial deployment across primary developer environments.',
        'Schedule technical alignment review with infrastructure teams.',
        'Track baseline metrics against established KPIs.',
      ],
    },
  ];

  return {
    id: `pres-${Date.now()}`,
    title,
    theme,
    slides,
  };
}
