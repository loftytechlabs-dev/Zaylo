import React, { useState, useId } from 'react';
import type { ChartSpec, ChartDataPoint } from '@local-ai/shared';
import { getChartTheme } from './ChartThemes';

interface ChartRendererProps {
  spec: ChartSpec;
  width?: number | string;
  height?: number;
  interactive?: boolean;
  onPointClick?: (point: ChartDataPoint, seriesIndex: number) => void;
  className?: string;
}

interface HoverInfo {
  x: number;
  y: number;
  title: string;
  value: string;
  sub?: string;
  color?: string;
}

export const ChartRenderer: React.FC<ChartRendererProps> = ({
  spec,
  height = 340,
  interactive = true,
  onPointClick,
  className = '',
}) => {
  const chartId = useId();
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const theme = getChartTheme(spec.theme, spec.customTheme as any);

  // Parse labels and series
  const labels: string[] = spec.labels && spec.labels.length > 0
    ? spec.labels
    : spec.series[0]?.data.map((d, i) =>
        typeof d === 'object' && d !== null ? d.label || `Item ${i + 1}` : `Item ${i + 1}`
      ) || [];

  // Flatten numeric values helper
  const getNumericValue = (d: number | ChartDataPoint): number => {
    if (typeof d === 'number') return d;
    if (typeof d === 'object' && d !== null) return Number(d.value) || 0;
    return 0;
  };

  const formatVal = (v: number): string => {
    const fmt = spec.yAxis?.format;
    const unit = spec.yAxis?.unit || '';
    if (fmt === 'currency') return `$${v.toLocaleString()}`;
    if (fmt === 'percent') return `${v.toLocaleString()}%`;
    return `${v.toLocaleString()}${unit ? ' ' + unit : ''}`;
  };

  const svgWidth = 720;
  const svgHeight = height;
  const padding = {
    top: 40,
    right: 32,
    bottom: 50,
    left: spec.type === 'horizontal-bar' ? 100 : 64,
  };

  const plotW = Math.max(100, svgWidth - padding.left - padding.right);
  const plotH = Math.max(80, svgHeight - padding.top - padding.bottom);

  // Compute global min / max for axes
  let allVals: number[] = [];
  if (spec.series && spec.series.length > 0) {
    for (const s of spec.series) {
      for (const d of s.data) {
        allVals.push(getNumericValue(d));
      }
    }
  }
  if (allVals.length === 0) allVals = [0, 10];

  let minVal = spec.yAxis?.min ?? Math.min(0, ...allVals);
  let maxVal = spec.yAxis?.max ?? Math.max(10, ...allVals);
  if (minVal === maxVal) maxVal = minVal + 10;
  if (minVal > 0) minVal = 0; // standard zero baseline

  const valRange = maxVal - minVal || 1;
  const getY = (val: number) => padding.top + plotH - ((val - minVal) / valRange) * plotH;

  // Grid steps (4 steps)
  const gridSteps = 4;
  const yTicks = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const val = minVal + (valRange / gridSteps) * i;
    return { val, y: getY(val) };
  });

  // Series colors
  const getSeriesColor = (idx: number, customColor?: string) => {
    if (customColor) return customColor;
    return theme.palette[idx % theme.palette.length];
  };

  // Render by Type
  const renderChartContent = () => {
    switch (spec.type) {
      // 1. VERTICAL BAR
      case 'bar': {
        const series = spec.series[0];
        if (!series) return null;
        const count = series.data.length;
        const barWidth = Math.max(8, Math.min(48, (plotW / count) * 0.65));
        const step = plotW / count;
        const color = getSeriesColor(0, series.color);

        return (
          <g>
            {series.data.map((d, i) => {
              const val = getNumericValue(d);
              const x = padding.left + i * step + (step - barWidth) / 2;
              const y = getY(val);
              const barH = Math.max(2, padding.top + plotH - y);
              const pointLabel = labels[i] || `Item ${i + 1}`;
              const barColor = (typeof d === 'object' && d.color) ? d.color : color;

              return (
                <g
                  key={i}
                  className="cursor-pointer transition-all duration-150"
                  onMouseEnter={() =>
                    setHoverInfo({
                      x: x + barWidth / 2,
                      y,
                      title: pointLabel,
                      value: formatVal(val),
                      color: barColor,
                    })
                  }
                  onMouseLeave={() => setHoverInfo(null)}
                  onClick={() => onPointClick?.(typeof d === 'object' ? d : { label: pointLabel, value: val }, 0)}
                >
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barH}
                    fill={barColor}
                    rx={4}
                    className="hover:opacity-85 transition-opacity"
                  />
                  {spec.showValues && (
                    <text
                      x={x + barWidth / 2}
                      y={y - 6}
                      textAnchor="middle"
                      fill={theme.textColor}
                      fontSize={10}
                      fontWeight={500}
                    >
                      {formatVal(val)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        );
      }

      // 2. HORIZONTAL BAR
      case 'horizontal-bar': {
        const series = spec.series[0];
        if (!series) return null;
        const count = series.data.length;
        const barH = Math.max(8, Math.min(32, (plotH / count) * 0.65));
        const step = plotH / count;
        const color = getSeriesColor(0, series.color);

        return (
          <g>
            {series.data.map((d, i) => {
              const val = getNumericValue(d);
              const y = padding.top + i * step + (step - barH) / 2;
              const barW = Math.max(4, (val / maxVal) * plotW);
              const pointLabel = labels[i] || `Item ${i + 1}`;
              const barColor = (typeof d === 'object' && d.color) ? d.color : color;

              return (
                <g
                  key={i}
                  className="cursor-pointer"
                  onMouseEnter={() =>
                    setHoverInfo({
                      x: padding.left + barW,
                      y: y + barH / 2,
                      title: pointLabel,
                      value: formatVal(val),
                      color: barColor,
                    })
                  }
                  onMouseLeave={() => setHoverInfo(null)}
                  onClick={() => onPointClick?.(typeof d === 'object' ? d : { label: pointLabel, value: val }, 0)}
                >
                  <text
                    x={padding.left - 10}
                    y={y + barH / 2 + 4}
                    textAnchor="end"
                    fill={theme.subtextColor}
                    fontSize={11}
                  >
                    {pointLabel}
                  </text>
                  <rect
                    x={padding.left}
                    y={y}
                    width={barW}
                    height={barH}
                    fill={barColor}
                    rx={3}
                    className="hover:opacity-85 transition-opacity"
                  />
                  {spec.showValues && (
                    <text
                      x={padding.left + barW + 8}
                      y={y + barH / 2 + 4}
                      fill={theme.textColor}
                      fontSize={10}
                      fontWeight={500}
                    >
                      {formatVal(val)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        );
      }

      // 3. GROUPED BAR
      case 'grouped-bar': {
        const numGroups = labels.length || spec.series[0]?.data.length || 1;
        const numSeries = spec.series.length;
        const groupWidth = plotW / numGroups;
        const barWidth = Math.max(6, Math.min(32, (groupWidth * 0.75) / numSeries));

        return (
          <g>
            {labels.map((grpLabel, gIdx) => {
              const grpX = padding.left + gIdx * groupWidth;
              const seriesOffset = (groupWidth - numSeries * barWidth) / 2;

              return (
                <g key={gIdx}>
                  {spec.series.map((s, sIdx) => {
                    const d = s.data[gIdx];
                    if (d === undefined) return null;
                    const val = getNumericValue(d);
                    const bx = grpX + seriesOffset + sIdx * barWidth;
                    const by = getY(val);
                    const bh = Math.max(2, padding.top + plotH - by);
                    const color = getSeriesColor(sIdx, s.color);

                    return (
                      <rect
                        key={sIdx}
                        x={bx}
                        y={by}
                        width={barWidth - 2}
                        height={bh}
                        fill={color}
                        rx={3}
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        onMouseEnter={() =>
                          setHoverInfo({
                            x: bx + barWidth / 2,
                            y: by,
                            title: `${grpLabel} · ${s.name}`,
                            value: formatVal(val),
                            color,
                          })
                        }
                        onMouseLeave={() => setHoverInfo(null)}
                      />
                    );
                  })}
                </g>
              );
            })}
          </g>
        );
      }

      // 4. STACKED BAR
      case 'stacked-bar': {
        const numGroups = labels.length || spec.series[0]?.data.length || 1;
        const groupStep = plotW / numGroups;
        const barW = Math.max(12, Math.min(48, groupStep * 0.6));

        return (
          <g>
            {labels.map((grpLabel, gIdx) => {
              const bx = padding.left + gIdx * groupStep + (groupStep - barW) / 2;
              let accumulatedVal = 0;

              return (
                <g key={gIdx}>
                  {spec.series.map((s, sIdx) => {
                    const d = s.data[gIdx];
                    if (d === undefined) return null;
                    const val = getNumericValue(d);
                    const currentBottom = accumulatedVal;
                    accumulatedVal += val;

                    const yTop = getY(accumulatedVal);
                    const yBottom = getY(currentBottom);
                    const segH = Math.max(2, yBottom - yTop);
                    const color = getSeriesColor(sIdx, s.color);

                    return (
                      <rect
                        key={sIdx}
                        x={bx}
                        y={yTop}
                        width={barW}
                        height={segH}
                        fill={color}
                        rx={sIdx === spec.series.length - 1 ? 3 : 0}
                        className="cursor-pointer hover:opacity-85 transition-opacity"
                        onMouseEnter={() =>
                          setHoverInfo({
                            x: bx + barW / 2,
                            y: yTop,
                            title: `${grpLabel} · ${s.name}`,
                            value: formatVal(val),
                            color,
                          })
                        }
                        onMouseLeave={() => setHoverInfo(null)}
                      />
                    );
                  })}
                </g>
              );
            })}
          </g>
        );
      }

      // 5. LINE & 6. AREA & 17. COMBO
      case 'line':
      case 'area':
      case 'combo': {
        const numPoints = labels.length || spec.series[0]?.data.length || 1;
        const stepX = numPoints > 1 ? plotW / (numPoints - 1) : plotW;

        return (
          <g>
            {spec.series.map((s, sIdx) => {
              const color = getSeriesColor(sIdx, s.color);
              const isBarInCombo = spec.type === 'combo' && (s.type === 'bar' || sIdx === 0);

              if (isBarInCombo) {
                const barWidth = Math.max(8, (plotW / numPoints) * 0.5);
                return (
                  <g key={`bar-${sIdx}`}>
                    {s.data.map((d, i) => {
                      const val = getNumericValue(d);
                      const bx = padding.left + i * (plotW / numPoints) + ((plotW / numPoints) - barWidth) / 2;
                      const by = getY(val);
                      const bh = Math.max(2, padding.top + plotH - by);
                      return (
                        <rect
                          key={i}
                          x={bx}
                          y={by}
                          width={barWidth}
                          height={bh}
                          fill={color}
                          opacity={0.7}
                          rx={3}
                          onMouseEnter={() =>
                            setHoverInfo({
                              x: bx + barWidth / 2,
                              y: by,
                              title: `${labels[i]} · ${s.name}`,
                              value: formatVal(val),
                              color,
                            })
                          }
                          onMouseLeave={() => setHoverInfo(null)}
                        />
                      );
                    })}
                  </g>
                );
              }

              const pts = s.data.map((d, i) => {
                const val = getNumericValue(d);
                const x = padding.left + i * stepX;
                const y = getY(val);
                return { x, y, val, label: labels[i] || `Item ${i + 1}` };
              });

              if (pts.length === 0) return null;

              const pathD = pts.reduce(
                (acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
                ''
              );

              const areaD = `${pathD} L ${pts[pts.length - 1].x} ${padding.top + plotH} L ${pts[0].x} ${
                padding.top + plotH
              } Z`;

              const showArea = spec.type === 'area' || s.type === 'area';
              const gradId = `${chartId}-grad-${sIdx}`;

              return (
                <g key={sIdx}>
                  {showArea && (
                    <>
                      <defs>
                        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
                          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <path d={areaD} fill={`url(#${gradId})`} />
                    </>
                  )}

                  {/* The Line */}
                  <path d={pathD} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" />

                  {/* Points */}
                  {pts.map((pt, pIdx) => (
                    <circle
                      key={pIdx}
                      cx={pt.x}
                      cy={pt.y}
                      r={4.5}
                      fill={theme.background}
                      stroke={color}
                      strokeWidth={2.5}
                      className="cursor-pointer hover:scale-150 transition-transform"
                      onMouseEnter={() =>
                        setHoverInfo({
                          x: pt.x,
                          y: pt.y,
                          title: `${pt.label} · ${s.name}`,
                          value: formatVal(pt.val),
                          color,
                        })
                      }
                      onMouseLeave={() => setHoverInfo(null)}
                    />
                  ))}
                </g>
              );
            })}
          </g>
        );
      }

      // 7. PIE & 8. DONUT
      case 'pie':
      case 'donut': {
        const series = spec.series[0];
        if (!series) return null;
        const total = series.data.reduce<number>((acc, d) => acc + getNumericValue(d), 0) || 1;
        const cx = svgWidth / 2;
        const cy = padding.top + plotH / 2;
        const radius = Math.min(plotW, plotH) / 2 - 10;
        const innerRadius = spec.type === 'donut' ? radius * 0.6 : 0;

        let curAngle = -Math.PI / 2;

        return (
          <g>
            {series.data.map((d, i) => {
              const val = getNumericValue(d);
              const sliceAngle = (val / total) * 2 * Math.PI;
              const startA = curAngle;
              const endA = curAngle + sliceAngle;
              curAngle = endA;

              const x1 = cx + radius * Math.cos(startA);
              const y1 = cy + radius * Math.sin(startA);
              const x2 = cx + radius * Math.cos(endA);
              const y2 = cy + radius * Math.sin(endA);

              const largeArc = sliceAngle > Math.PI ? 1 : 0;
              const color = getSeriesColor(i, typeof d === 'object' ? d.color : undefined);

              let pathD = '';
              if (innerRadius > 0) {
                const ix1 = cx + innerRadius * Math.cos(endA);
                const iy1 = cy + innerRadius * Math.sin(endA);
                const ix2 = cx + innerRadius * Math.cos(startA);
                const iy2 = cy + innerRadius * Math.sin(startA);
                pathD = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2} Z`;
              } else {
                pathD = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
              }

              const midAngle = startA + sliceAngle / 2;
              const midX = cx + (radius * 0.7) * Math.cos(midAngle);
              const midY = cy + (radius * 0.7) * Math.sin(midAngle);
              const pct = Math.round((val / total) * 100);
              const pointLabel = labels[i] || `Item ${i + 1}`;

              return (
                <g key={i}>
                  <path
                    d={pathD}
                    fill={color}
                    stroke={theme.cardBg}
                    strokeWidth={2}
                    className="cursor-pointer hover:opacity-85 transition-opacity"
                    onMouseEnter={() =>
                      setHoverInfo({
                        x: midX,
                        y: midY,
                        title: pointLabel,
                        value: `${formatVal(val)} (${pct}%)`,
                        color,
                      })
                    }
                    onMouseLeave={() => setHoverInfo(null)}
                  />
                  {pct >= 5 && (
                    <text
                      x={midX}
                      y={midY + 4}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize={11}
                      fontWeight={600}
                      className="pointer-events-none select-none"
                    >
                      {pct}%
                    </text>
                  )}
                </g>
              );
            })}

            {spec.type === 'donut' && (
              <g className="pointer-events-none select-none">
                <text
                  x={cx}
                  y={cy - 4}
                  textAnchor="middle"
                  fill={theme.subtextColor}
                  fontSize={11}
                  fontWeight={500}
                >
                  TOTAL
                </text>
                <text
                  x={cx}
                  y={cy + 16}
                  textAnchor="middle"
                  fill={theme.textColor}
                  fontSize={18}
                  fontWeight={700}
                >
                  {formatVal(total)}
                </text>
              </g>
            )}
          </g>
        );
      }

      // 9. SCATTER & 10. BUBBLE
      case 'scatter':
      case 'bubble': {
        const series = spec.series[0];
        if (!series) return null;
        const color = getSeriesColor(0, series.color);

        return (
          <g>
            {series.data.map((d, i) => {
              const val = getNumericValue(d);
              const xVal = typeof d === 'object' && d.x !== undefined ? d.x : i;
              const yVal = typeof d === 'object' && d.y !== undefined ? d.y : val;
              const size = typeof d === 'object' && d.size !== undefined ? Math.max(4, Math.min(24, d.size)) : 6;

              const px = padding.left + (xVal / (series.data.length - 1 || 1)) * plotW;
              const py = getY(yVal);
              const ptColor = typeof d === 'object' && d.color ? d.color : color;
              const pointLabel = labels[i] || `Point ${i + 1}`;

              return (
                <circle
                  key={i}
                  cx={px}
                  cy={py}
                  r={spec.type === 'bubble' ? size : 5}
                  fill={ptColor}
                  fillOpacity={0.75}
                  stroke={ptColor}
                  strokeWidth={1.5}
                  className="cursor-pointer hover:scale-125 transition-transform"
                  onMouseEnter={() =>
                    setHoverInfo({
                      x: px,
                      y: py,
                      title: pointLabel,
                      value: `X: ${xVal}, Y: ${formatVal(yVal)}`,
                      color: ptColor,
                    })
                  }
                  onMouseLeave={() => setHoverInfo(null)}
                />
              );
            })}
          </g>
        );
      }

      // 11. RADAR
      case 'radar': {
        const count = labels.length || 5;
        const cx = svgWidth / 2;
        const cy = padding.top + plotH / 2;
        const maxR = Math.min(plotW, plotH) / 2 - 20;

        // Radar grid webs
        const webs = [0.25, 0.5, 0.75, 1];

        return (
          <g>
            {webs.map((w, wIdx) => {
              const r = maxR * w;
              const webPts = Array.from({ length: count }, (_, i) => {
                const angle = -Math.PI / 2 + (i / count) * 2 * Math.PI;
                return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
              }).join(' ');
              return <polygon key={wIdx} points={webPts} fill="none" stroke={theme.gridColor} strokeWidth={1} />;
            })}

            {/* Radar axis spokes and labels */}
            {labels.map((lbl, i) => {
              const angle = -Math.PI / 2 + (i / count) * 2 * Math.PI;
              const sx = cx + maxR * Math.cos(angle);
              const sy = cy + maxR * Math.sin(angle);
              const lx = cx + (maxR + 16) * Math.cos(angle);
              const ly = cy + (maxR + 16) * Math.sin(angle);

              return (
                <g key={i}>
                  <line x1={cx} y1={cy} x2={sx} y2={sy} stroke={theme.gridColor} strokeWidth={1} />
                  <text
                    x={lx}
                    y={ly + 4}
                    textAnchor="middle"
                    fill={theme.subtextColor}
                    fontSize={10}
                  >
                    {lbl}
                  </text>
                </g>
              );
            })}

            {/* Series Polygons */}
            {spec.series.map((s, sIdx) => {
              const color = getSeriesColor(sIdx, s.color);
              const polyPts = s.data.map((d, i) => {
                const val = getNumericValue(d);
                const r = (val / maxVal) * maxR;
                const angle = -Math.PI / 2 + (i / count) * 2 * Math.PI;
                return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
              }).join(' ');

              return (
                <polygon
                  key={sIdx}
                  points={polyPts}
                  fill={color}
                  fillOpacity={0.25}
                  stroke={color}
                  strokeWidth={2}
                />
              );
            })}
          </g>
        );
      }

      // 12. HISTOGRAM
      case 'histogram': {
        const series = spec.series[0];
        if (!series) return null;
        const count = series.data.length;
        const step = plotW / count;
        const color = getSeriesColor(0, series.color);

        return (
          <g>
            {series.data.map((d, i) => {
              const val = getNumericValue(d);
              const x = padding.left + i * step;
              const y = getY(val);
              const bh = Math.max(2, padding.top + plotH - y);

              return (
                <rect
                  key={i}
                  x={x}
                  y={y}
                  width={step - 1}
                  height={bh}
                  fill={color}
                  className="cursor-pointer hover:opacity-85 transition-opacity"
                  onMouseEnter={() =>
                    setHoverInfo({
                      x: x + step / 2,
                      y,
                      title: labels[i] || `Bin ${i + 1}`,
                      value: `Freq: ${formatVal(val)}`,
                      color,
                    })
                  }
                  onMouseLeave={() => setHoverInfo(null)}
                />
              );
            })}
          </g>
        );
      }

      // 13. HEATMAP
      case 'heatmap': {
        const series = spec.series;
        const rows = series.length || 1;
        const cols = labels.length || series[0]?.data.length || 1;
        const cellW = plotW / cols;
        const cellH = plotH / rows;

        return (
          <g>
            {series.map((s, rIdx) => {
              return s.data.map((d, cIdx) => {
                const val = getNumericValue(d);
                const norm = Math.max(0, Math.min(1, val / maxVal));
                const x = padding.left + cIdx * cellW;
                const y = padding.top + rIdx * cellH;
                const baseColor = theme.palette[0] || '#2563EB';

                return (
                  <g key={`${rIdx}-${cIdx}`}>
                    <rect
                      x={x + 1}
                      y={y + 1}
                      width={cellW - 2}
                      height={cellH - 2}
                      fill={baseColor}
                      fillOpacity={Math.max(0.12, norm)}
                      rx={2}
                      className="cursor-pointer hover:stroke-black dark:hover:stroke-white transition-all"
                      strokeWidth={1}
                      onMouseEnter={() =>
                        setHoverInfo({
                          x: x + cellW / 2,
                          y: y + cellH / 2,
                          title: `${s.name} × ${labels[cIdx]}`,
                          value: formatVal(val),
                        })
                      }
                      onMouseLeave={() => setHoverInfo(null)}
                    />
                    <text
                      x={x + cellW / 2}
                      y={y + cellH / 2 + 4}
                      textAnchor="middle"
                      fill={norm > 0.55 ? '#FFFFFF' : theme.textColor}
                      fontSize={10}
                      fontWeight={500}
                    >
                      {val}
                    </text>
                  </g>
                );
              });
            })}
          </g>
        );
      }

      // 14. WATERFALL
      case 'waterfall': {
        const series = spec.series[0];
        if (!series) return null;
        const count = series.data.length;
        const barW = Math.max(12, Math.min(44, (plotW / count) * 0.65));
        const step = plotW / count;
        let cumulative = 0;

        return (
          <g>
            {series.data.map((d, i) => {
              const val = getNumericValue(d);
              const isTotal = i === count - 1;
              const isPos = val >= 0;
              const prev = cumulative;
              if (isTotal) {
                cumulative = val;
              } else {
                cumulative += val;
              }

              const topVal = isTotal ? Math.max(0, val) : Math.max(prev, cumulative);
              const botVal = isTotal ? Math.min(0, val) : Math.min(prev, cumulative);

              const yTop = getY(topVal);
              const yBot = getY(botVal);
              const bh = Math.max(3, yBot - yTop);
              const x = padding.left + i * step + (step - barW) / 2;

              const color = isTotal ? theme.palette[0] : isPos ? '#10B981' : '#EF4444';

              return (
                <g key={i}>
                  <rect
                    x={x}
                    y={yTop}
                    width={barW}
                    height={bh}
                    fill={color}
                    rx={3}
                    className="cursor-pointer hover:opacity-85"
                    onMouseEnter={() =>
                      setHoverInfo({
                        x: x + barW / 2,
                        y: yTop,
                        title: labels[i] || `Step ${i + 1}`,
                        value: `${isPos ? '+' : ''}${formatVal(val)} (Total: ${formatVal(cumulative)})`,
                        color,
                      })
                    }
                    onMouseLeave={() => setHoverInfo(null)}
                  />
                  {/* Connector dotted line */}
                  {i < count - 1 && (
                    <line
                      x1={x + barW}
                      y1={getY(cumulative)}
                      x2={x + step}
                      y2={getY(cumulative)}
                      stroke={theme.axisColor}
                      strokeDasharray="2 2"
                      strokeWidth={1}
                    />
                  )}
                </g>
              );
            })}
          </g>
        );
      }

      // 15. FUNNEL
      case 'funnel': {
        const series = spec.series[0];
        if (!series) return null;
        const count = series.data.length;
        const rowH = plotH / count;
        const maxVal = getNumericValue(series.data[0]) || 1;

        return (
          <g>
            {series.data.map((d, i) => {
              const val = getNumericValue(d);
              const w = Math.max(40, (val / maxVal) * plotW * 0.85);
              const x = padding.left + (plotW - w) / 2;
              const y = padding.top + i * rowH;
              const h = rowH * 0.7;
              const pct = Math.round((val / maxVal) * 100);
              const color = getSeriesColor(i);

              return (
                <g key={i}>
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    fill={color}
                    rx={4}
                    className="cursor-pointer hover:opacity-85 transition-opacity"
                    onMouseEnter={() =>
                      setHoverInfo({
                        x: x + w / 2,
                        y,
                        title: labels[i] || `Stage ${i + 1}`,
                        value: `${formatVal(val)} (${pct}%)`,
                        color,
                      })
                    }
                    onMouseLeave={() => setHoverInfo(null)}
                  />
                  <text
                    x={x + w / 2}
                    y={y + h / 2 + 4}
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize={11}
                    fontWeight={600}
                  >
                    {labels[i]}: {pct}% ({formatVal(val)})
                  </text>
                </g>
              );
            })}
          </g>
        );
      }

      // 16. TREEMAP
      case 'treemap': {
        const series = spec.series[0];
        if (!series) return null;
        const total = series.data.reduce<number>((acc, d) => acc + getNumericValue(d), 0) || 1;
        let runningX = padding.left;

        return (
          <g>
            {series.data.map((d, i) => {
              const val = getNumericValue(d);
              const frac = val / total;
              const tileW = Math.max(30, frac * plotW);
              const x = runningX;
              runningX += tileW;
              const color = getSeriesColor(i);
              const pct = Math.round(frac * 100);

              return (
                <g key={i}>
                  <rect
                    x={x}
                    y={padding.top}
                    width={tileW - 2}
                    height={plotH}
                    fill={color}
                    rx={3}
                    className="cursor-pointer hover:opacity-85 transition-opacity"
                    onMouseEnter={() =>
                      setHoverInfo({
                        x: x + tileW / 2,
                        y: padding.top + plotH / 2,
                        title: labels[i] || `Tile ${i + 1}`,
                        value: `${formatVal(val)} (${pct}%)`,
                        color,
                      })
                    }
                    onMouseLeave={() => setHoverInfo(null)}
                  />
                  {tileW > 50 && (
                    <text
                      x={x + tileW / 2}
                      y={padding.top + plotH / 2}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize={11}
                      fontWeight={600}
                    >
                      {labels[i]}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        );
      }

      default:
        return null;
    }
  };

  const showStandardAxes = ![
    'pie',
    'donut',
    'radar',
    'treemap',
    'funnel',
    'heatmap',
    'horizontal-bar',
  ].includes(spec.type);

  return (
    <div
      className={`relative select-none rounded-xl overflow-hidden ${className}`}
      style={{ backgroundColor: theme.cardBg }}
    >
      {/* Header: Title and Subtitle */}
      {(spec.title || spec.subtitle) && (
        <div className="px-5 pt-4 pb-1">
          {spec.title && (
            <h4 className="text-sm font-semibold tracking-tight" style={{ color: theme.textColor }}>
              {spec.title}
            </h4>
          )}
          {spec.subtitle && (
            <p className="text-xs mt-0.5" style={{ color: theme.subtextColor }}>
              {spec.subtitle}
            </p>
          )}
        </div>
      )}

      {/* SVG Container */}
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto block"
          style={{ maxHeight: height }}
        >
          {/* Grid lines */}
          {showStandardAxes && (spec.showGrid ?? true) && (
            <g>
              {yTicks.map((tick, i) => (
                <g key={i}>
                  <line
                    x1={padding.left}
                    y1={tick.y}
                    x2={padding.left + plotW}
                    y2={tick.y}
                    stroke={theme.gridColor}
                    strokeWidth={1}
                    strokeDasharray={i === 0 ? undefined : '3 3'}
                  />
                  <text
                    x={padding.left - 8}
                    y={tick.y + 3}
                    textAnchor="end"
                    fill={theme.subtextColor}
                    fontSize={10}
                    fontFamily="monospace"
                  >
                    {formatVal(tick.val)}
                  </text>
                </g>
              ))}
            </g>
          )}

          {/* Standard X-Axis Categories */}
          {showStandardAxes && (
            <g>
              {labels.map((lbl, i) => {
                const count = labels.length;
                const step = plotW / (count > 1 ? count - 1 : 1);
                const x =
                  spec.type === 'bar' || spec.type === 'stacked-bar' || spec.type === 'grouped-bar' || spec.type === 'waterfall'
                    ? padding.left + i * (plotW / count) + (plotW / count) / 2
                    : padding.left + i * step;

                return (
                  <text
                    key={i}
                    x={x}
                    y={padding.top + plotH + 18}
                    textAnchor="middle"
                    fill={theme.subtextColor}
                    fontSize={10}
                    className="truncate"
                  >
                    {lbl}
                  </text>
                );
              })}
            </g>
          )}

          {/* Render Active Chart Content */}
          {renderChartContent()}

          {/* Annotations */}
          {spec.annotations?.map((ann, i) => {
            const ptIdx = ann.pointIndex ?? 0;
            const step = plotW / (labels.length > 1 ? labels.length - 1 : 1);
            const x = padding.left + ptIdx * step;
            const y = ann.value !== undefined ? getY(ann.value) : padding.top + 20;

            return (
              <g key={i} className="pointer-events-none select-none">
                <circle cx={x} cy={y} r={4} fill="#EF4444" />
                <rect
                  x={x - 40}
                  y={y - 24}
                  width={80}
                  height={18}
                  rx={4}
                  fill={theme.tooltipBg}
                />
                <text
                  x={x}
                  y={y - 12}
                  textAnchor="middle"
                  fill={theme.tooltipText}
                  fontSize={9}
                  fontWeight={600}
                >
                  {ann.text}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {interactive && hoverInfo && (
          <div
            className="absolute pointer-events-none z-30 px-2.5 py-1.5 rounded-lg shadow-lg text-xs transition-transform"
            style={{
              left: `${(hoverInfo.x / svgWidth) * 100}%`,
              top: `${(hoverInfo.y / svgHeight) * 100}%`,
              transform: 'translate(-50%, -120%)',
              backgroundColor: theme.tooltipBg,
              color: theme.tooltipText,
            }}
          >
            <div className="font-semibold flex items-center gap-1.5">
              {hoverInfo.color && (
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ backgroundColor: hoverInfo.color }}
                />
              )}
              <span>{hoverInfo.title}</span>
            </div>
            <div className="font-mono text-[11px] opacity-90">{hoverInfo.value}</div>
          </div>
        )}
      </div>

      {/* Legend & Footer */}
      <div className="px-5 pb-3 pt-1 flex flex-wrap items-center justify-between text-xs gap-3">
        {(spec.showLegend ?? true) && spec.series.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            {spec.type === 'pie' || spec.type === 'donut'
              ? labels.slice(0, 6).map((lbl, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: getSeriesColor(i) }}
                    />
                    <span style={{ color: theme.subtextColor }}>{lbl}</span>
                  </div>
                ))
              : spec.series.map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: getSeriesColor(i, s.color) }}
                    />
                    <span style={{ color: theme.subtextColor }}>{s.name}</span>
                  </div>
                ))}
          </div>
        )}

        {spec.source && (
          <span className="text-[10px] italic ml-auto" style={{ color: theme.subtextColor }}>
            Source: {spec.source}
          </span>
        )}
      </div>
    </div>
  );
};
