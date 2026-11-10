import type { ChartSpec } from '@local-ai/shared';

export function exportChartAsCsv(spec: ChartSpec, fileName = 'chart-data.csv') {
  const labels = spec.labels && spec.labels.length > 0
    ? spec.labels
    : spec.series[0]?.data.map((_, i) => `Item ${i + 1}`) || [];

  const headers = ['Category', ...spec.series.map((s) => s.name || 'Value')];
  const rows: string[] = [headers.join(',')];

  for (let i = 0; i < labels.length; i++) {
    const row = [
      `"${labels[i].replace(/"/g, '""')}"`,
      ...spec.series.map((s) => {
        const val = s.data[i];
        if (typeof val === 'number') return val.toString();
        if (typeof val === 'object' && val !== null) return (val.value ?? 0).toString();
        return '0';
      }),
    ];
    rows.push(row.join(','));
  }

  const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.join('\n'));
  const link = document.createElement('a');
  link.setAttribute('href', csvContent);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportSvgAsFile(svgElement: SVGSVGElement, fileName = 'chart.svg') {
  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(svgElement);

  // Add namespaces if missing
  if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
    source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportSvgAsPng(
  svgElement: SVGSVGElement,
  fileName = 'chart.png',
  scale = 2,
  bgColor = '#FFFFFF'
) {
  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(svgElement);
  if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
    source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  const image = new Image();

  image.onload = () => {
    const bbox = svgElement.getBoundingClientRect();
    const width = (bbox.width || 800) * scale;
    const height = (bbox.height || 450) * scale;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    ctx.drawImage(image, 0, 0, width, height);
    URL.revokeObjectURL(url);

    const pngUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = pngUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  image.src = url;
}
