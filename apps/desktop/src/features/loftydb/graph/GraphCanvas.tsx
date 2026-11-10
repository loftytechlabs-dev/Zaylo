import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  Share2,
  Tag,
  Map as MapIcon,
  Undo2,
  Redo2,
  Eye,
} from 'lucide-react';
import {
  NODE_CATEGORY_META,
  type ClusterRegion,
  type GraphDisplaySettings,
  type GraphEdge,
  type GraphNode,
  type GraphViewMode,
  type LayoutPositionMap,
} from './graphTypes';
import { stepForceSimulation, type TimelineTick } from './graphLayoutEngine';

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  nodeById: Map<string, GraphNode>;
  clusterRegions: ClusterRegion[];
  timelineTicks: TimelineTick[];
  mode: GraphViewMode;
  display: GraphDisplaySettings;
  selectedIds: Set<string>;
  matchedIds: Set<string> | null;
  hiddenCount: number;
  canUndo: boolean;
  canRedo: boolean;
  fitTrigger: number;
  focusNodeId: string | null;
  isDarkCanvas: boolean;
  onSelectNodes: (ids: Set<string>, primaryId: string | null) => void;
  onDoubleClickNode: (node: GraphNode) => void;
  onToggleClusterCollapse: (clusterKey: string) => void;
  onPositionsCommit: (before: LayoutPositionMap, after: LayoutPositionMap) => void;
  onContextMenuRequest: (node: GraphNode | null, clientX: number, clientY: number) => void;
  onUpdateDisplay: (patch: Partial<GraphDisplaySettings>) => void;
  onResetLayout: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onUnhideAll: () => void;
}

interface HoveredEdgeInfo {
  edge: GraphEdge;
  sourceTitle: string;
  targetTitle: string;
  x: number;
  y: number;
}

const CATEGORY_SHORT_GLYPH: Record<string, string> = {
  fact: 'F',
  preference: 'P',
  instruction: 'I',
  project: 'Pr',
  episode: 'Ep',
  context: 'Cx',
  entity: '#',
  conversation: 'Chat',
};

function computeMinimapTransform(nodes: GraphNode[], mw: number, mh: number) {
  if (nodes.length === 0) {
    return { scale: 0.2, ox: mw / 2, oy: mh / 2 };
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x - n.radius - 30);
    maxX = Math.max(maxX, n.x + n.radius + 30);
    minY = Math.min(minY, n.y - n.radius - 30);
    maxY = Math.max(maxY, n.y + n.radius + 30);
  }
  const spanW = Math.max(220, maxX - minX);
  const spanH = Math.max(160, maxY - minY);
  const scale = Math.min((mw - 16) / spanW, (mh - 16) / spanH);
  const ox = mw / 2 - ((minX + maxX) / 2) * scale;
  const oy = mh / 2 - ((minY + maxY) / 2) * scale;
  return { scale, ox, oy };
}

function pointToQuadCurveDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  cx: number,
  cy: number,
  x2: number,
  y2: number
): number {
  let minD = Infinity;
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const inv = 1 - t;
    const qx = inv * inv * x1 + 2 * inv * t * cx + t * t * x2;
    const qy = inv * inv * y1 + 2 * inv * t * cy + t * t * y2;
    const d = Math.hypot(px - qx, py - qy);
    if (d < minD) minD = d;
  }
  return minD;
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  nodes,
  edges,
  nodeById,
  clusterRegions,
  timelineTicks,
  mode,
  display,
  selectedIds,
  matchedIds,
  hiddenCount,
  canUndo,
  canRedo,
  fitTrigger,
  focusNodeId,
  isDarkCanvas,
  onSelectNodes,
  onDoubleClickNode,
  onToggleClusterCollapse,
  onPositionsCommit,
  onContextMenuRequest,
  onUpdateDisplay,
  onResetLayout,
  onUndo,
  onRedo,
  onUnhideAll,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const minimapRef = useRef<HTMLCanvasElement | null>(null);

  const sizeRef = useRef<{ width: number; height: number }>({ width: 900, height: 600 });
  const cameraRef = useRef<{ x: number; y: number; zoom: number }>({ x: 0, y: 0, zoom: 1 });
  const targetCamRef = useRef<{ x: number; y: number; zoom: number } | null>(null);
  const energyRef = useRef<number>(100);
  const hasAutoFittedRef = useRef<boolean>(false);
  const tickRenderRef = useRef<() => void>(() => {});

  const [hoveredNode, setHoveredNode] = useState<{ node: GraphNode; x: number; y: number } | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<HoveredEdgeInfo | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  const interactionRef = useRef<{
    type: 'none' | 'pan' | 'drag-node' | 'marquee';
    startX: number;
    startY: number;
    moved: boolean;
    camX: number;
    camY: number;
    draggedIds: string[];
    beforePositions: LayoutPositionMap;
    pinchDist: number | null;
  }>({
    type: 'none',
    startX: 0,
    startY: 0,
    moved: false,
    camX: 0,
    camY: 0,
    draggedIds: [],
    beforePositions: {},
    pinchDist: null,
  });

  // Reset wake energy whenever graph structure or mode changes
  useEffect(() => {
    energyRef.current = 120;
    tickRenderRef.current();
  }, [nodes, edges, mode, display.physicsRunning, display.repulsion, display.linkDistance]);

  // Adjacency quick lookup for instant focus highlighting
  const directNeighborMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const e of edges) {
      if (!map.has(e.source)) map.set(e.source, new Set());
      if (!map.has(e.target)) map.set(e.target, new Set());
      map.get(e.source)!.add(e.target);
      map.get(e.target)!.add(e.source);
    }
    return map;
  }, [edges]);

  // Camera fit-to-graph helper
  const fitGraphToView = useCallback(() => {
    if (nodes.length === 0) {
      targetCamRef.current = { x: 0, y: 0, zoom: 1 };
      tickRenderRef.current();
      return;
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x - n.radius);
      maxX = Math.max(maxX, n.x + n.radius);
      minY = Math.min(minY, n.y - n.radius);
      maxY = Math.max(maxY, n.y + n.radius);
    }
    for (const r of clusterRegions) {
      minX = Math.min(minX, r.x);
      maxX = Math.max(maxX, r.x + r.width);
      minY = Math.min(minY, r.y);
      maxY = Math.max(maxY, r.y + r.height);
    }
    const { width, height } = sizeRef.current;
    const spanW = Math.max(220, maxX - minX + 120);
    const spanH = Math.max(220, maxY - minY + 120);
    const zoom = Math.min(1.6, Math.max(0.28, Math.min(width / spanW, height / spanH) * 0.88));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    targetCamRef.current = { x: -cx * zoom, y: -cy * zoom, zoom };
    tickRenderRef.current();
  }, [nodes, clusterRegions]);

  useEffect(() => {
    if (fitTrigger > 0) fitGraphToView();
  }, [fitTrigger, fitGraphToView]);

  // Automatically fit the graph gracefully into viewport on first load when nodes exist
  useEffect(() => {
    if (nodes.length > 0 && !hasAutoFittedRef.current) {
      hasAutoFittedRef.current = true;
      const timer = setTimeout(() => {
        fitGraphToView();
      }, 90);
      return () => clearTimeout(timer);
    }
    if (nodes.length === 0) {
      hasAutoFittedRef.current = false;
    }
  }, [nodes.length, fitGraphToView]);

  // Smooth pan to focused node
  useEffect(() => {
    if (!focusNodeId) return;
    const n = nodeById.get(focusNodeId);
    if (!n) return;
    const zoom = Math.max(1.05, Math.min(1.8, cameraRef.current.zoom));
    targetCamRef.current = { x: -n.x * zoom, y: -n.y * zoom, zoom };
    tickRenderRef.current();
  }, [focusNodeId, nodeById]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      sizeRef.current = {
        width: Math.max(300, rect.width),
        height: Math.max(340, rect.height),
      };
      tickRenderRef.current();
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Main render & physics animation loop (auto-sleeps when physics settles & no camera glide)
  useEffect(() => {
    let rafId = 0;
    let active = true;

    const renderMinimap = () => {
      const mini = minimapRef.current;
      if (!mini || !display.showMinimap) return;
      const mctx = mini.getContext('2d');
      if (!mctx) return;

      const mw = 160;
      const mh = 104;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (mini.width !== mw * dpr || mini.height !== mh * dpr) {
        mini.width = mw * dpr;
        mini.height = mh * dpr;
      }

      mctx.save();
      mctx.scale(dpr, dpr);
      mctx.fillStyle = isDarkCanvas ? '#0c0f16' : '#f8fafc';
      mctx.fillRect(0, 0, mw, mh);

      const { scale, ox, oy } = computeMinimapTransform(nodes, mw, mh);

      for (const n of nodes) {
        mctx.fillStyle = selectedIds.has(n.id) ? (isDarkCanvas ? '#ffffff' : '#0f172a') : n.color;
        mctx.globalAlpha = selectedIds.has(n.id) ? 1 : 0.88;
        mctx.beginPath();
        mctx.arc(n.x * scale + ox, n.y * scale + oy, Math.max(2.6, Math.min(5, n.radius * scale * 1.1)), 0, Math.PI * 2);
        mctx.fill();
      }

      // Draw current viewport bounding box
      const cam = cameraRef.current;
      const { width, height } = sizeRef.current;
      const vx1 = ((-width / 2 - cam.x) / cam.zoom) * scale + ox;
      const vy1 = ((-height / 2 - cam.y) / cam.zoom) * scale + oy;
      const vw = (width / cam.zoom) * scale;
      const vh = (height / cam.zoom) * scale;
      mctx.globalAlpha = 1;
      mctx.strokeStyle = isDarkCanvas ? 'rgba(226, 232, 240, 0.55)' : 'rgba(15, 23, 42, 0.45)';
      mctx.lineWidth = 1;
      mctx.strokeRect(vx1, vy1, vw, vh);
      mctx.restore();
    };

    const drawFrame = () => {
      if (!active) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { width, height } = sizeRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }

      // Step camera glide smoothly
      let animatingCamera = false;
      if (targetCamRef.current) {
        const tgt = targetCamRef.current;
        const cam = cameraRef.current;
        cam.x += (tgt.x - cam.x) * 0.2;
        cam.y += (tgt.y - cam.y) * 0.2;
        cam.zoom += (tgt.zoom - cam.zoom) * 0.2;
        if (
          Math.abs(tgt.x - cam.x) < 0.6 &&
          Math.abs(tgt.y - cam.y) < 0.6 &&
          Math.abs(tgt.zoom - cam.zoom) < 0.005
        ) {
          cam.x = tgt.x;
          cam.y = tgt.y;
          cam.zoom = tgt.zoom;
          targetCamRef.current = null;
        } else {
          animatingCamera = true;
        }
      }

      // Step physics if active & energy remains
      let runningPhysics = false;
      if (
        display.physicsRunning &&
        mode !== 'timeline' &&
        energyRef.current > 0.04 &&
        interactionRef.current.type !== 'drag-node'
      ) {
        const kinetic = stepForceSimulation({
          nodes,
          edges,
          nodeById,
          mode,
          clusterRegions,
          repulsion: display.repulsion,
          linkDistance: display.linkDistance,
        });
        energyRef.current = kinetic;
        runningPhysics = kinetic > 0.04;
      }

      const cam = cameraRef.current;
      const viewLeft = (-width / 2 - cam.x) / cam.zoom - 60;
      const viewRight = (width / 2 - cam.x) / cam.zoom + 60;
      const viewTop = (-height / 2 - cam.y) / cam.zoom - 60;
      const viewBottom = (height / 2 - cam.y) / cam.zoom + 60;

      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Clean Charcoal or Slate-White Architectural Canvas Backdrop
      ctx.fillStyle = isDarkCanvas ? '#090b10' : '#f8fafc';
      ctx.fillRect(0, 0, width, height);

      // Subtle architectural dot grid
      ctx.save();
      ctx.translate(width / 2 + cam.x, height / 2 + cam.y);
      ctx.scale(cam.zoom, cam.zoom);

      if (cam.zoom >= 0.45) {
        const gridStep = 48;
        const gxStart = Math.floor(viewLeft / gridStep) * gridStep;
        const gyStart = Math.floor(viewTop / gridStep) * gridStep;
        ctx.fillStyle = isDarkCanvas ? 'rgba(148, 163, 184, 0.09)' : 'rgba(100, 116, 139, 0.16)';
        for (let gx = gxStart; gx <= viewRight; gx += gridStep) {
          for (let gy = gyStart; gy <= viewBottom; gy += gridStep) {
            ctx.fillRect(gx - 0.6, gy - 0.6, 1.2, 1.2);
          }
        }
      }

      // 2. Mode-Specific Structural Regions
      if (mode === 'cluster') {
        for (const reg of clusterRegions) {
          if (reg.collapsed) continue;
          ctx.save();
          ctx.fillStyle = isDarkCanvas ? 'rgba(17, 21, 30, 0.65)' : 'rgba(255, 255, 255, 0.85)';
          ctx.strokeStyle = isDarkCanvas ? 'rgba(148, 163, 184, 0.16)' : '#cbd5e1';
          ctx.lineWidth = 1.1 / cam.zoom;
          ctx.beginPath();
          ctx.roundRect(reg.x, reg.y, reg.width, reg.height, 10);
          ctx.fill();
          ctx.stroke();

          // Clean region title header
          ctx.fillStyle = reg.color;
          ctx.beginPath();
          ctx.arc(reg.x + 16, reg.y + 18, 3.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = '600 11px -apple-system, BlinkMacSystemFont, Inter, sans-serif';
          ctx.fillStyle = isDarkCanvas ? '#e2e8f0' : '#0f172a';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${reg.title} · ${reg.count}`, reg.x + 26, reg.y + 18);

          // Collapse affordance hint
          ctx.font = '500 10px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.fillStyle = isDarkCanvas ? '#94a3b8' : '#475569';
          ctx.textAlign = 'right';
          ctx.fillText('[−]', reg.x + reg.width - 12, reg.y + 18);
          ctx.restore();
        }
      } else if (mode === 'timeline') {
        // Horizontal time axis ticks & category lane guides
        const laneCategories = Array.from(new Set(nodes.map((n) => n.category))).sort();
        const laneGap = 78;
        const topY = -((laneCategories.length - 1) * laneGap) / 2;

        ctx.save();
        laneCategories.forEach((cat, idx) => {
          const ly = topY + idx * laneGap;
          ctx.strokeStyle = isDarkCanvas ? 'rgba(148, 163, 184, 0.1)' : 'rgba(100, 116, 139, 0.2)';
          ctx.lineWidth = 1 / cam.zoom;
          ctx.beginPath();
          ctx.moveTo(-480, ly);
          ctx.lineTo(480, ly);
          ctx.stroke();

          ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.fillStyle = NODE_CATEGORY_META[cat].color;
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(NODE_CATEGORY_META[cat].pluralLabel.toUpperCase(), -455, ly);
        });

        const axisY = topY - 46;
        ctx.strokeStyle = isDarkCanvas ? 'rgba(148, 163, 184, 0.22)' : 'rgba(100, 116, 139, 0.35)';
        ctx.lineWidth = 1 / cam.zoom;
        ctx.beginPath();
        ctx.moveTo(-445, axisY);
        ctx.lineTo(445, axisY);
        ctx.stroke();

        for (const tick of timelineTicks) {
          ctx.beginPath();
          ctx.moveTo(tick.x, axisY - 4);
          ctx.lineTo(tick.x, axisY + 4);
          ctx.stroke();
          ctx.font = '500 10px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.fillStyle = isDarkCanvas ? '#94a3b8' : '#475569';
          ctx.textAlign = 'center';
          ctx.fillText(tick.label, tick.x, axisY - 12);
        }
        ctx.restore();
      }

      // Highlight / Focus resolution
      const focusSet = new Set<string>();
      const primaryActive = hoveredNode?.node.id || (selectedIds.size === 1 ? Array.from(selectedIds)[0] : null);
      if (primaryActive) {
        focusSet.add(primaryActive);
        for (const nb of directNeighborMap.get(primaryActive) || []) focusSet.add(nb);
      } else if (selectedIds.size > 1) {
        for (const sid of selectedIds) {
          focusSet.add(sid);
          for (const nb of directNeighborMap.get(sid) || []) focusSet.add(nb);
        }
      }

      const searchMatchActive = Boolean(matchedIds && matchedIds.size > 0);
      const searchNeighborhood = new Set<string>();
      if (matchedIds) {
        for (const mid of matchedIds) {
          searchNeighborhood.add(mid);
          for (const nb of directNeighborMap.get(mid) || []) searchNeighborhood.add(nb);
        }
      }

      // 3. Draw Relationship Edges (Viewport Culled)
      if (display.showRelationships) {
        for (const edge of edges) {
          const s = nodeById.get(edge.source);
          const t = nodeById.get(edge.target);
          if (!s || !t) continue;
          if (
            Math.max(s.x, t.x) < viewLeft ||
            Math.min(s.x, t.x) > viewRight ||
            Math.max(s.y, t.y) < viewTop ||
            Math.min(s.y, t.y) > viewBottom
          ) {
            continue;
          }

          const isEdgeHovered = hoveredEdge?.edge.id === edge.id;
          const isFocusConnected =
            focusSet.size > 0 &&
            ((primaryActive ? edge.source === primaryActive || edge.target === primaryActive : selectedIds.has(edge.source) || selectedIds.has(edge.target)));
          const isSearchEdge =
            searchMatchActive && (matchedIds!.has(edge.source) || matchedIds!.has(edge.target));

          let alpha = isDarkCanvas ? 0.34 : 0.52;
          if (isEdgeHovered || isFocusConnected) {
            alpha = 0.95;
          } else if (focusSet.size > 0) {
            alpha = isDarkCanvas ? 0.06 : 0.1;
          } else if (searchMatchActive) {
            alpha = isSearchEdge ? 0.85 : isDarkCanvas ? 0.06 : 0.1;
          }

          const dx = t.x - s.x;
          const dy = t.y - s.y;
          const dist = Math.hypot(dx, dy) || 1;
          const nx = -dy / dist;
          const ny = dx / dist;
          const curveAmt = edge.parallelOffset + (mode === 'timeline' ? -22 : 0);
          const cx = (s.x + t.x) / 2 + nx * curveAmt;
          const cy = (s.y + t.y) / 2 + ny * curveAmt;

          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.strokeStyle =
            isEdgeHovered || isFocusConnected
              ? edge.color
              : edge.type === 'CONTRADICTS'
              ? '#ef4444'
              : isDarkCanvas
              ? '#64748b'
              : '#94a3b8';
          ctx.lineWidth = ((isEdgeHovered ? 2.2 : isFocusConnected ? 1.7 : 0.9 + edge.strength * 0.6)) / Math.sqrt(cam.zoom);
          if (edge.dashed) {
            ctx.setLineDash([4 / cam.zoom, 3 / cam.zoom]);
          }

          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.quadraticCurveTo(cx, cy, t.x, t.y);
          ctx.stroke();
          ctx.setLineDash([]);

          // Crisp Directional Arrowhead at target perimeter when directed & readable
          if (edge.directed && cam.zoom >= 0.45 && dist > t.radius + s.radius + 8) {
            const txDir = t.x - cx;
            const tyDir = t.y - cy;
            const tLen = Math.hypot(txDir, tyDir) || 1;
            const angle = Math.atan2(tyDir / tLen, txDir / tLen);
            const tipX = t.x - Math.cos(angle) * (t.radius + 3);
            const tipY = t.y - Math.sin(angle) * (t.radius + 3);
            const arrowSize = (isEdgeHovered || isFocusConnected ? 7.5 : 5.5) / Math.sqrt(cam.zoom);

            ctx.fillStyle = ctx.strokeStyle;
            ctx.beginPath();
            ctx.moveTo(tipX, tipY);
            ctx.lineTo(
              tipX - arrowSize * Math.cos(angle - Math.PI / 6),
              tipY - arrowSize * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
              tipX - arrowSize * Math.cos(angle + Math.PI / 6),
              tipY - arrowSize * Math.sin(angle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fill();
          }

          // Subtle inline relationship badge along curve midpoint when readable
          const midX = 0.25 * s.x + 0.5 * cx + 0.25 * t.x;
          const midY = 0.25 * s.y + 0.5 * cy + 0.25 * t.y;
          const showEdgeTag =
            isEdgeHovered ||
            isFocusConnected ||
            (display.showLabels && nodes.length <= 36 && dist * cam.zoom >= 115 && alpha >= 0.35);

          if (showEdgeTag) {
            const label = edge.type;
            const eFontSize = Math.max(8, 9 / Math.sqrt(cam.zoom));
            ctx.font = `600 ${eFontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
            const etw = ctx.measureText(label).width;
            const padX = 4 / Math.sqrt(cam.zoom);
            const boxH = eFontSize + 5 / Math.sqrt(cam.zoom);

            ctx.fillStyle = isDarkCanvas ? 'rgba(9, 11, 16, 0.88)' : 'rgba(248, 250, 252, 0.94)';
            ctx.beginPath();
            ctx.roundRect(midX - etw / 2 - padX, midY - boxH / 2, etw + padX * 2, boxH, 3);
            ctx.fill();

            ctx.fillStyle =
              isEdgeHovered || isFocusConnected
                ? edge.color
                : isDarkCanvas
                ? '#94a3b8'
                : '#475569';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, midX, midY);
          }

          ctx.restore();
        }
      }

      // 4. Draw Nodes (Viewport Culled & Clean Infrastructure Geometry)
      const placedLabels: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
      const sortedForDraw = [...nodes].sort((a, b) => {
        const aFocus = selectedIds.has(a.id) || hoveredNode?.node.id === a.id ? 1 : 0;
        const bFocus = selectedIds.has(b.id) || hoveredNode?.node.id === b.id ? 1 : 0;
        return aFocus - bFocus || a.degree - b.degree;
      });

      for (const node of sortedForDraw) {
        if (
          node.x + node.radius < viewLeft ||
          node.x - node.radius > viewRight ||
          node.y + node.radius < viewTop ||
          node.y - node.radius > viewBottom
        ) {
          continue;
        }

        const isSelected = selectedIds.has(node.id);
        const isHovered = hoveredNode?.node.id === node.id;
        const isMatched = Boolean(matchedIds && matchedIds.has(node.id));
        const inFocus = focusSet.size === 0 || focusSet.has(node.id);
        const inSearch = !searchMatchActive || searchNeighborhood.has(node.id);

        let alpha = 1;
        if (focusSet.size > 0 && !inFocus) alpha = 0.14;
        else if (searchMatchActive && !inSearch) alpha = 0.15;

        ctx.save();
        ctx.globalAlpha = alpha;

        // Selection or Search ring
        if (isSelected || isHovered || isMatched) {
          ctx.strokeStyle =
            isMatched && !isSelected
              ? '#0284c7'
              : isDarkCanvas
              ? '#f8fafc'
              : '#0f172a';
          ctx.lineWidth = (isSelected ? 2.2 : 1.6) / Math.sqrt(cam.zoom);
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 4.2, 0, Math.PI * 2);
          ctx.stroke();
        }

        if (node.isClusterProxy) {
          // Cluster aggregate badge node
          ctx.fillStyle = isDarkCanvas ? '#151924' : '#ffffff';
          ctx.strokeStyle = node.color;
          ctx.lineWidth = 2 / Math.sqrt(cam.zoom);
          ctx.beginPath();
          ctx.roundRect(node.x - node.radius, node.y - node.radius * 0.8, node.radius * 2, node.radius * 1.6, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = isDarkCanvas ? '#f8fafc' : '#0f172a';
          ctx.font = '700 10px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`+${node.collapsedCount || 0}`, node.x, node.y);
        } else if (node.kind === 'entity') {
          // Entity: Crisp diamond / hexagon node
          ctx.fillStyle = isDarkCanvas ? '#0f1722' : '#ecfeff';
          ctx.strokeStyle = node.color;
          ctx.lineWidth = 2 / Math.sqrt(cam.zoom);
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const ang = (i * Math.PI) / 3 - Math.PI / 6;
            const px = node.x + Math.cos(ang) * node.radius;
            const py = node.y + Math.sin(ang) * node.radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = isDarkCanvas ? '#67e8f9' : '#0e7490';
          ctx.font = `700 ${Math.max(8.5, node.radius * 0.65)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('#', node.x, node.y + 0.5);
        } else if (node.kind === 'conversation') {
          // Conversation: Clean slate rounded square with chat glyph
          const s = node.radius * 0.88;
          ctx.fillStyle = isDarkCanvas ? '#131722' : '#eef2ff';
          ctx.strokeStyle = node.color;
          ctx.lineWidth = 1.8 / Math.sqrt(cam.zoom);
          ctx.beginPath();
          ctx.roundRect(node.x - s, node.y - s, s * 2, s * 2, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = isDarkCanvas ? '#cbd5e1' : '#334155';
          ctx.font = `700 ${Math.max(7.5, node.radius * 0.5)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('MSG', node.x, node.y + 0.5);
        } else {
          // Memory: Crisp solid circle with subtle white/dark outline & category glyph
          ctx.fillStyle = node.color;
          ctx.strokeStyle = isDarkCanvas ? '#090b10' : '#ffffff';
          ctx.lineWidth = 2 / Math.sqrt(cam.zoom);
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          const glyph = CATEGORY_SHORT_GLYPH[node.category] || 'M';
          ctx.fillStyle = '#ffffff';
          ctx.font = `700 ${Math.max(8, node.radius * 0.65)}px -apple-system, BlinkMacSystemFont, Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(glyph, node.x, node.y + 0.5);

          if (node.pinned) {
            ctx.fillStyle = isDarkCanvas ? '#fef08a' : '#f59e0b';
            ctx.strokeStyle = isDarkCanvas ? '#090b10' : '#ffffff';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(node.x + node.radius * 0.72, node.y - node.radius * 0.72, 3.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
        }

        // Level-of-Detail & Collision-Free Halo Label Rendering (Obsidian/Neo4j style — no heavy white boxes!)
        const mustShowLabel = isSelected || isHovered || isMatched || node.isClusterProxy;
        const canShowLabel =
          display.showLabels &&
          alpha > 0.35 &&
          (mustShowLabel || cam.zoom >= 0.65 || node.degree >= 2 || nodes.length <= 50);

        if (canShowLabel) {
          const text = node.title.length > 26 ? `${node.title.slice(0, 24)}…` : node.title;
          const fontSize = Math.max(9.5, 11.5 / Math.sqrt(cam.zoom));
          ctx.font = `${mustShowLabel ? '600' : '500'} ${fontSize}px -apple-system, BlinkMacSystemFont, Inter, sans-serif`;
          const tw = ctx.measureText(text).width;
          const lx = node.x;
          const offsets = [
            node.y + node.radius + 11 / Math.sqrt(cam.zoom),
            node.y - node.radius - 11 / Math.sqrt(cam.zoom),
          ];

          for (let oi = 0; oi < offsets.length; oi++) {
            const ly = offsets[oi];
            const box = {
              x1: lx - tw / 2 - 4,
              y1: ly - fontSize / 2 - 2,
              x2: lx + tw / 2 + 4,
              y2: ly + fontSize / 2 + 2,
            };

            const collides =
              !mustShowLabel &&
              placedLabels.some(
                (b) => !(box.x2 < b.x1 || box.x1 > b.x2 || box.y2 < b.y1 || box.y1 > b.y2)
              );

            if (!collides || oi === offsets.length - 1 && nodes.length <= 24) {
              placedLabels.push(box);
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.lineJoin = 'round';
              ctx.lineWidth = 3.6 / Math.sqrt(cam.zoom);
              ctx.strokeStyle = isDarkCanvas ? 'rgba(9, 11, 16, 0.94)' : 'rgba(248, 250, 252, 0.96)';
              ctx.strokeText(text, lx, ly);

              ctx.fillStyle = isDarkCanvas
                ? isSelected || isHovered || isMatched
                  ? '#f8fafc'
                  : '#e2e8f0'
                : '#0f172a';
              ctx.fillText(text, lx, ly);
              break;
            }
          }
        }

        ctx.restore();
      }

      ctx.restore();
      ctx.restore();

      renderMinimap();

      if (animatingCamera || runningPhysics) {
        rafId = requestAnimationFrame(drawFrame);
      } else {
        rafId = 0;
      }
    };

    tickRenderRef.current = () => {
      if (!rafId && active) {
        rafId = requestAnimationFrame(drawFrame);
      }
    };

    rafId = requestAnimationFrame(drawFrame);
    return () => {
      active = false;
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [
    nodes,
    edges,
    nodeById,
    clusterRegions,
    timelineTicks,
    mode,
    display,
    selectedIds,
    matchedIds,
    hoveredNode,
    hoveredEdge,
    directNeighborMap,
    isDarkCanvas,
  ]);

  const clientToWorld = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { sx: 0, sy: 0, wx: 0, wy: 0 };
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const { width, height } = sizeRef.current;
    const cam = cameraRef.current;
    return {
      sx,
      sy,
      wx: (sx - width / 2 - cam.x) / cam.zoom,
      wy: (sy - height / 2 - cam.y) / cam.zoom,
    };
  }, []);

  const hitTestNode = useCallback(
    (wx: number, wy: number): GraphNode | null => {
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        const pad = Math.max(10, n.radius + 5);
        if (Math.hypot(wx - n.x, wy - n.y) <= pad) {
          return n;
        }
      }
      return null;
    },
    [nodes]
  );

  const hitTestEdge = useCallback(
    (wx: number, wy: number): GraphEdge | null => {
      if (!display.showRelationships) return null;
      let closest: GraphEdge | null = null;
      let minDist = 7 / cameraRef.current.zoom;
      for (const edge of edges) {
        const s = nodeById.get(edge.source);
        const t = nodeById.get(edge.target);
        if (!s || !t) continue;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = -dy / dist;
        const ny = dx / dist;
        const curveAmt = edge.parallelOffset + (mode === 'timeline' ? -22 : 0);
        const cx = (s.x + t.x) / 2 + nx * curveAmt;
        const cy = (s.y + t.y) / 2 + ny * curveAmt;
        const d = pointToQuadCurveDistance(wx, wy, s.x, s.y, cx, cy, t.x, t.y);
        if (d < minDist) {
          minDist = d;
          closest = edge;
        }
      }
      return closest;
    },
    [edges, nodeById, display.showRelationships, mode]
  );

  const hitTestClusterHeader = useCallback(
    (wx: number, wy: number): ClusterRegion | null => {
      if (mode !== 'cluster') return null;
      for (const reg of clusterRegions) {
        if (reg.collapsed) continue;
        if (wx >= reg.x && wx <= reg.x + reg.width && wy >= reg.y && wy <= reg.y + 32) {
          return reg;
        }
      }
      return null;
    },
    [clusterRegions, mode]
  );

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    targetCamRef.current = null;
    const { sx, sy, wx, wy } = clientToWorld(e.clientX, e.clientY);

    if (e.button === 2) {
      return; // handled in onContextMenu
    }

    const hitCluster = hitTestClusterHeader(wx, wy);
    if (hitCluster) {
      onToggleClusterCollapse(hitCluster.key);
      return;
    }

    const hit = hitTestNode(wx, wy);
    if (hit) {
      const draggedIds = selectedIds.has(hit.id) ? Array.from(selectedIds) : [hit.id];
      const beforePositions: LayoutPositionMap = {};
      for (const id of draggedIds) {
        const dn = nodeById.get(id);
        if (dn) beforePositions[id] = { x: dn.x, y: dn.y };
      }
      interactionRef.current = {
        type: 'drag-node',
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        camX: cameraRef.current.x,
        camY: cameraRef.current.y,
        draggedIds,
        beforePositions,
        pinchDist: null,
      };
      return;
    }

    if (e.shiftKey) {
      interactionRef.current = {
        type: 'marquee',
        startX: sx,
        startY: sy,
        moved: false,
        camX: cameraRef.current.x,
        camY: cameraRef.current.y,
        draggedIds: [],
        beforePositions: {},
        pinchDist: null,
      };
      setMarqueeRect({ x1: sx, y1: sy, x2: sx, y2: sy });
      return;
    }

    interactionRef.current = {
      type: 'pan',
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      camX: cameraRef.current.x,
      camY: cameraRef.current.y,
      draggedIds: [],
      beforePositions: {},
      pinchDist: null,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const state = interactionRef.current;
    const { sx, sy, wx, wy } = clientToWorld(e.clientX, e.clientY);

    if (state.type === 'pan') {
      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;
      if (Math.hypot(dx, dy) > 3) state.moved = true;
      cameraRef.current.x = state.camX + dx;
      cameraRef.current.y = state.camY + dy;
      tickRenderRef.current();
      return;
    }

    if (state.type === 'drag-node') {
      const dx = (e.clientX - state.startX) / cameraRef.current.zoom;
      const dy = (e.clientY - state.startY) / cameraRef.current.zoom;
      if (Math.hypot(e.clientX - state.startX, e.clientY - state.startY) > 3) {
        state.moved = true;
      }
      for (const id of state.draggedIds) {
        const dn = nodeById.get(id);
        const startPos = state.beforePositions[id];
        if (dn && startPos) {
          dn.x = startPos.x + dx;
          dn.y = startPos.y + dy;
          dn.fx = dn.x;
          dn.fy = dn.y;
          dn.vx = 0;
          dn.vy = 0;
        }
      }
      tickRenderRef.current();
      return;
    }

    if (state.type === 'marquee') {
      state.moved = true;
      setMarqueeRect({ x1: state.startX, y1: state.startY, x2: sx, y2: sy });
      return;
    }

    // Hover detection
    const node = hitTestNode(wx, wy);
    if (node) {
      setHoveredNode({ node, x: sx, y: sy });
      setHoveredEdge(null);
      return;
    }
    setHoveredNode(null);

    const edge = hitTestEdge(wx, wy);
    if (edge) {
      const sNode = nodeById.get(edge.source);
      const tNode = nodeById.get(edge.target);
      setHoveredEdge({
        edge,
        sourceTitle: sNode?.title || edge.source,
        targetTitle: tNode?.title || edge.target,
        x: sx,
        y: sy,
      });
    } else {
      setHoveredEdge(null);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const state = interactionRef.current;

    if (state.type === 'drag-node') {
      if (state.moved) {
        const after: LayoutPositionMap = {};
        for (const id of state.draggedIds) {
          const dn = nodeById.get(id);
          if (dn) after[id] = { x: dn.x, y: dn.y };
        }
        onPositionsCommit(state.beforePositions, after);
        energyRef.current = Math.max(energyRef.current, 15);
      } else if (state.draggedIds[0]) {
        const clicked = nodeById.get(state.draggedIds[0]);
        if (clicked) {
          if (clicked.isClusterProxy) {
            onToggleClusterCollapse(clicked.clusterKey);
          } else if (e.shiftKey) {
            const next = new Set(selectedIds);
            if (next.has(clicked.id)) next.delete(clicked.id);
            else next.add(clicked.id);
            onSelectNodes(next, clicked.id);
          } else {
            onSelectNodes(new Set([clicked.id]), clicked.id);
          }
        }
      }
    } else if (state.type === 'pan' && !state.moved) {
      if (!e.shiftKey) {
        onSelectNodes(new Set(), null);
      }
    } else if (state.type === 'marquee' && marqueeRect) {
      const xMin = Math.min(marqueeRect.x1, marqueeRect.x2);
      const xMax = Math.max(marqueeRect.x1, marqueeRect.x2);
      const yMin = Math.min(marqueeRect.y1, marqueeRect.y2);
      const yMax = Math.max(marqueeRect.y1, marqueeRect.y2);
      const { width, height } = sizeRef.current;
      const cam = cameraRef.current;

      const selected = new Set<string>(selectedIds);
      let firstId: string | null = null;
      for (const n of nodes) {
        const sx = n.x * cam.zoom + width / 2 + cam.x;
        const sy = n.y * cam.zoom + height / 2 + cam.y;
        if (sx >= xMin && sx <= xMax && sy >= yMin && sy <= yMax) {
          selected.add(n.id);
          if (!firstId) firstId = n.id;
        }
      }
      onSelectNodes(selected, firstId || (selected.size > 0 ? Array.from(selected)[0] : null));
      setMarqueeRect(null);
    }

    interactionRef.current.type = 'none';
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { wx, wy } = clientToWorld(e.clientX, e.clientY);
    const hit = hitTestNode(wx, wy);
    if (!hit) return;
    if (hit.isClusterProxy) {
      onToggleClusterCollapse(hit.clusterKey);
      return;
    }
    onDoubleClickNode(hit);
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const { wx, wy } = clientToWorld(e.clientX, e.clientY);
    const hit = hitTestNode(wx, wy);
    if (hit && !selectedIds.has(hit.id)) {
      onSelectNodes(new Set([hit.id]), hit.id);
    }
    onContextMenuRequest(hit, e.clientX, e.clientY);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    targetCamRef.current = null;
    const { sx, sy, wx, wy } = clientToWorld(e.clientX, e.clientY);
    const { width, height } = sizeRef.current;
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    const nextZoom = Math.min(3.4, Math.max(0.25, cameraRef.current.zoom * factor));
    cameraRef.current.zoom = nextZoom;
    // Zoom anchored around pointer
    cameraRef.current.x = sx - width / 2 - wx * nextZoom;
    cameraRef.current.y = sy - height / 2 - wy * nextZoom;
    tickRenderRef.current();
  };

  // Touch pan & two-finger pinch zoom for tablet / mobile
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    targetCamRef.current = null;
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const { wx, wy } = clientToWorld(t.clientX, t.clientY);
      const hit = hitTestNode(wx, wy);
      interactionRef.current = {
        type: hit ? 'drag-node' : 'pan',
        startX: t.clientX,
        startY: t.clientY,
        moved: false,
        camX: cameraRef.current.x,
        camY: cameraRef.current.y,
        draggedIds: hit ? [hit.id] : [],
        beforePositions: hit ? { [hit.id]: { x: hit.x, y: hit.y } } : {},
        pinchDist: null,
      };
    } else if (e.touches.length === 2) {
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      interactionRef.current.pinchDist = d;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2 && interactionRef.current.pinchDist) {
      const nextDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = nextDist / interactionRef.current.pinchDist;
      cameraRef.current.zoom = Math.min(3.4, Math.max(0.25, cameraRef.current.zoom * ratio));
      interactionRef.current.pinchDist = nextDist;
      tickRenderRef.current();
      return;
    }
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const state = interactionRef.current;
      const dx = t.clientX - state.startX;
      const dy = t.clientY - state.startY;
      if (Math.hypot(dx, dy) > 4) state.moved = true;
      if (state.type === 'pan') {
        cameraRef.current.x = state.camX + dx;
        cameraRef.current.y = state.camY + dy;
        tickRenderRef.current();
      } else if (state.type === 'drag-node' && state.draggedIds[0]) {
        const dn = nodeById.get(state.draggedIds[0]);
        const bp = state.beforePositions[state.draggedIds[0]];
        if (dn && bp) {
          dn.x = bp.x + dx / cameraRef.current.zoom;
          dn.y = bp.y + dy / cameraRef.current.zoom;
          dn.fx = dn.x;
          dn.fy = dn.y;
          tickRenderRef.current();
        }
      }
    }
  };

  const handleTouchEnd = () => {
    const state = interactionRef.current;
    if (state.type === 'drag-node' && !state.moved && state.draggedIds[0]) {
      const hit = nodeById.get(state.draggedIds[0]);
      if (hit) {
        if (hit.isClusterProxy) onToggleClusterCollapse(hit.clusterKey);
        else onSelectNodes(new Set([hit.id]), hit.id);
      }
    } else if (state.type === 'pan' && !state.moved) {
      onSelectNodes(new Set(), null);
    }
    interactionRef.current.type = 'none';
    interactionRef.current.pinchDist = null;
  };

  const handleMinimapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const mw = 160;
    const mh = 104;
    const { scale, ox, oy } = computeMinimapTransform(nodes, mw, mh);

    const worldX = (mx - ox) / scale;
    const worldY = (my - oy) / scale;
    targetCamRef.current = {
      x: -worldX * cameraRef.current.zoom,
      y: -worldY * cameraRef.current.zoom,
      zoom: cameraRef.current.zoom,
    };
    tickRenderRef.current();
  };

  const stepZoom = (factor: number) => {
    targetCamRef.current = {
      ...cameraRef.current,
      zoom: Math.min(3.4, Math.max(0.25, cameraRef.current.zoom * factor)),
    };
    tickRenderRef.current();
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none ${
        isDarkCanvas ? 'bg-[#090b10]' : 'bg-[#f8fafc]'
      }`}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          interactionRef.current.type = 'none';
          setHoveredNode(null);
          setHoveredEdge(null);
          setMarqueeRect(null);
        }}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="w-full h-full block cursor-grab active:cursor-grabbing touch-none"
      />

      {/* Shift+Drag Marquee Box Overlay */}
      {marqueeRect && (
        <div
          className="pointer-events-none absolute border border-sky-500/80 bg-sky-500/10 rounded-xs"
          style={{
            left: Math.min(marqueeRect.x1, marqueeRect.x2),
            top: Math.min(marqueeRect.y1, marqueeRect.y2),
            width: Math.abs(marqueeRect.x2 - marqueeRect.x1),
            height: Math.abs(marqueeRect.y2 - marqueeRect.y1),
          }}
        />
      )}

      {/* Node Hover Tooltip */}
      {hoveredNode && !hoveredNode.node.isClusterProxy && (
        <div
          className="pointer-events-none absolute z-20 max-w-xs px-3 py-2 rounded-lg bg-white/95 dark:bg-[#10131b]/95 border border-slate-200 dark:border-white/15 shadow-xl backdrop-blur-sm space-y-1"
          style={{
            left: Math.min(sizeRef.current.width - 250, Math.max(12, hoveredNode.x + 14)),
            top: Math.min(sizeRef.current.height - 110, Math.max(12, hoveredNode.y + 14)),
          }}
        >
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-slate-600 dark:text-slate-400">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: hoveredNode.node.color }}
            />
            <span>{NODE_CATEGORY_META[hoveredNode.node.category]?.label || hoveredNode.node.kind}</span>
            <span>· ★{hoveredNode.node.importance}</span>
            <span>· {hoveredNode.node.degree} links</span>
          </div>
          <div className="text-xs font-semibold text-slate-950 dark:text-slate-100 leading-snug">
            {hoveredNode.node.title}
          </div>
          <div className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2">
            {hoveredNode.node.content}
          </div>
        </div>
      )}

      {/* Edge Hover Tooltip */}
      {hoveredEdge && (
        <div
          className="pointer-events-none absolute z-20 max-w-xs px-2.5 py-1.5 rounded-lg bg-white/95 dark:bg-[#10131b]/95 border border-slate-200 dark:border-white/15 shadow-xl text-[11px] backdrop-blur-sm space-y-0.5"
          style={{
            left: Math.min(sizeRef.current.width - 260, Math.max(12, hoveredEdge.x + 12)),
            top: Math.min(sizeRef.current.height - 75, Math.max(12, hoveredEdge.y + 12)),
          }}
        >
          <div className="flex items-center gap-1.5 font-mono text-[10px]">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: hoveredEdge.edge.color }}
            />
            <span className="font-semibold text-slate-950 dark:text-slate-100">
              {hoveredEdge.edge.type}
            </span>
            <span className="text-slate-600 dark:text-slate-400">
              · {Math.round(hoveredEdge.edge.strength * 100)}% strength
            </span>
          </div>
          <div className="text-[11px] text-slate-700 dark:text-slate-300 truncate">
            {hoveredEdge.sourceTitle} {hoveredEdge.edge.directed ? '→' : '↔'} {hoveredEdge.targetTitle}
          </div>
        </div>
      )}

      {/* Compact Floating Bottom Control Bar */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-0.5 px-1.5 py-1 rounded-xl bg-white/95 dark:bg-[#10131b]/92 border border-slate-200 dark:border-white/10 shadow-xl backdrop-blur-md">
        <button
          type="button"
          onClick={() => stepZoom(1.22)}
          className="p-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          title="Zoom in (+)"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => stepZoom(0.82)}
          className="p-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          title="Zoom out (-)"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={fitGraphToView}
          className="p-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          title="Fit graph to screen (F)"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        <span className="w-px h-4 bg-slate-200 dark:bg-white/10 mx-0.5" />

        <button
          type="button"
          onClick={() => onUpdateDisplay({ physicsRunning: !display.physicsRunning })}
          className={`p-1.5 rounded-lg transition-colors ${
            display.physicsRunning
              ? 'text-emerald-600 dark:text-emerald-400 hover:bg-slate-100 dark:hover:bg-white/10'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10'
          }`}
          title={display.physicsRunning ? 'Pause simulation (Space)' : 'Resume simulation (Space)'}
        >
          {display.physicsRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
        <button
          type="button"
          onClick={onResetLayout}
          className="p-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          title="Reset layout"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <span className="w-px h-4 bg-slate-200 dark:bg-white/10 mx-0.5" />

        <button
          type="button"
          onClick={() => onUpdateDisplay({ showRelationships: !display.showRelationships })}
          className={`p-1.5 rounded-lg transition-colors ${
            display.showRelationships
              ? 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
          }`}
          title="Toggle relationship edges"
        >
          <Share2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onUpdateDisplay({ showLabels: !display.showLabels })}
          className={`p-1.5 rounded-lg transition-colors ${
            display.showLabels
              ? 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
          }`}
          title="Toggle node labels"
        >
          <Tag className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onUpdateDisplay({ showMinimap: !display.showMinimap })}
          className={`hidden sm:inline-flex p-1.5 rounded-lg transition-colors ${
            display.showMinimap
              ? 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
          }`}
          title="Toggle minimap"
        >
          <MapIcon className="w-3.5 h-3.5" />
        </button>

        {(canUndo || canRedo) && (
          <>
            <span className="w-px h-4 bg-slate-200 dark:bg-white/10 mx-0.5" />
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className="p-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-30"
              title="Undo layout change (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              className="p-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-30"
              title="Redo layout change (Ctrl+Shift+Z)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}

        {hiddenCount > 0 && (
          <>
            <span className="w-px h-4 bg-slate-200 dark:bg-white/10 mx-0.5" />
            <button
              type="button"
              onClick={onUnhideAll}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 text-[10px] font-mono hover:bg-amber-200 dark:hover:bg-amber-500/25"
              title="Restore hidden nodes"
            >
              <Eye className="w-3 h-3" />
              <span>Show {hiddenCount}</span>
            </button>
          </>
        )}
      </div>

      {/* Bottom-Right Live Minimap */}
      {display.showMinimap && nodes.length > 0 && (
        <div className="hidden md:block absolute bottom-3 right-3 z-10 rounded-lg border border-slate-200 dark:border-white/15 bg-white/95 dark:bg-[#0c0f16]/90 shadow-xl overflow-hidden">
          <canvas
            ref={minimapRef}
            onClick={handleMinimapClick}
            className="w-40 h-[104px] block cursor-crosshair"
            title="Click to jump viewport"
          />
        </div>
      )}
    </div>
  );
};
