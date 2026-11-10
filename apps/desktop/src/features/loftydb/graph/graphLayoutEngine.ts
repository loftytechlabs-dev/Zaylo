import type { KnowledgeGraphPayload } from '@local-ai/shared';
import {
  NODE_CATEGORY_META,
  RELATIONSHIP_META,
  type ClusterRegion,
  type GraphEdge,
  type GraphFilterState,
  type GraphLayoutPreset,
  type GraphNode,
  type GraphViewMode,
  type LayoutPositionMap,
  type NodeVisualGroup,
} from './graphTypes';

function hashAngle(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) / 4294967295) * Math.PI * 2;
}

function getClusterDefinition(node: {
  kind: GraphNode['kind'];
  category: NodeVisualGroup;
  subType?: string;
}): { key: string; label: string } {
  if (node.kind === 'entity') {
    if (node.subType === 'technology' || node.subType === 'tool') {
      return { key: 'technologies', label: 'Technologies & Tools' };
    }
    return { key: 'entities', label: 'Entities & Concepts' };
  }
  if (node.kind === 'conversation') {
    return { key: 'conversations', label: 'Conversations' };
  }
  const map: Record<string, { key: string; label: string }> = {
    project: { key: 'projects', label: 'Projects' },
    fact: { key: 'facts', label: 'Facts' },
    preference: { key: 'preferences', label: 'Personal Preferences' },
    instruction: { key: 'instructions', label: 'Instructions & Rules' },
    episode: { key: 'episodes', label: 'Episodes' },
    context: { key: 'context', label: 'Context' },
  };
  return map[node.category] || { key: 'facts', label: 'Facts' };
}

const CLUSTER_SEED_CENTERS: Record<string, { x: number; y: number }> = {
  projects: { x: -240, y: -150 },
  technologies: { x: 240, y: -150 },
  facts: { x: -240, y: 120 },
  preferences: { x: 220, y: 140 },
  instructions: { x: 0, y: -220 },
  episodes: { x: -40, y: 230 },
  context: { x: 320, y: 0 },
  entities: { x: 140, y: -20 },
  conversations: { x: -340, y: -10 },
};

export interface TimelineTick {
  x: number;
  label: string;
}

export interface BuiltGraphModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
  nodeById: Map<string, GraphNode>;
  clusterRegions: ClusterRegion[];
  timelineTicks: TimelineTick[];
  timelineMinMs: number;
  timelineMaxMs: number;
}

export function buildGraphModel(params: {
  payload: KnowledgeGraphPayload | null;
  filters: GraphFilterState;
  mode: GraphViewMode;
  layoutPreset: GraphLayoutPreset;
  hiddenNodeIds: Set<string>;
  collapsedClusters: Set<string>;
  prevPositions: LayoutPositionMap;
  limitNodes?: number;
}): BuiltGraphModel {
  const {
    payload,
    filters,
    mode,
    layoutPreset,
    hiddenNodeIds,
    collapsedClusters,
    prevPositions,
    limitNodes = 2500,
  } = params;

  if (!payload) {
    return {
      nodes: [],
      edges: [],
      nodeById: new Map(),
      clusterRegions: [],
      timelineTicks: [],
      timelineMinMs: Date.now() - 86400000,
      timelineMaxMs: Date.now(),
    };
  }

  const now = Date.now();
  const rangeCutoffMs =
    filters.dateRange === '24h'
      ? now - 24 * 3600 * 1000
      : filters.dateRange === '7d'
      ? now - 7 * 24 * 3600 * 1000
      : filters.dateRange === '30d'
      ? now - 30 * 24 * 3600 * 1000
      : 0;

  // Build candidate raw nodes
  const rawNodes: GraphNode[] = [];

  for (const m of payload.memories) {
    if (hiddenNodeIds.has(m.id)) continue;
    if (!filters.categories.has(m.category)) continue;
    if (m.importance < filters.minImportance) continue;
    if (filters.source !== 'all' && m.source !== filters.source) continue;
    const ts = filters.dateField === 'createdAt' ? m.createdAt : m.updatedAt;
    if (rangeCutoffMs > 0 && ts < rangeCutoffMs) continue;

    const style = NODE_CATEGORY_META[m.category] || NODE_CATEGORY_META.fact;
    const cluster = getClusterDefinition({ kind: 'memory', category: m.category });
    const prev = prevPositions[m.id];
    const seed = CLUSTER_SEED_CENTERS[cluster.key] || { x: 0, y: 0 };
    const ang = hashAngle(m.id);

    rawNodes.push({
      id: m.id,
      kind: 'memory',
      title: m.title || m.content.slice(0, 44),
      content: m.content,
      category: m.category,
      clusterKey: cluster.key,
      clusterLabel: cluster.label,
      importance: m.importance || 3,
      confidence: m.confidence ?? 1,
      accessCount: m.accessCount ?? 0,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      pinned: m.pinned,
      source: m.source,
      tags: m.tags || [],
      version: m.version || 1,
      collection: m.collection || payload.collection,
      degree: 0,
      radius: 12,
      color: style.color,
      x: prev ? prev.x : seed.x * 1.35 + Math.cos(ang) * 125,
      y: prev ? prev.y : seed.y * 1.35 + Math.sin(ang) * 125,
      vx: 0,
      vy: 0,
      memory: m,
    });
  }

  if (filters.categories.has('entity')) {
    for (const ent of payload.entities) {
      if (hiddenNodeIds.has(ent.id)) continue;
      if (ent.importance < filters.minImportance) continue;
      const ts = filters.dateField === 'createdAt' ? ent.createdAt : ent.updatedAt;
      if (rangeCutoffMs > 0 && ts < rangeCutoffMs) continue;

      const style = NODE_CATEGORY_META.entity;
      const cluster = getClusterDefinition({
        kind: 'entity',
        category: 'entity',
        subType: ent.entityType,
      });
      const prev = prevPositions[ent.id];
      const seed = CLUSTER_SEED_CENTERS[cluster.key] || { x: 140, y: -40 };
      const ang = hashAngle(ent.id);

      rawNodes.push({
        id: ent.id,
        kind: 'entity',
        title: ent.name,
        content: ent.description || `${ent.entityType} entity mentioned ${ent.mentionCount} time(s)`,
        category: 'entity',
        clusterKey: cluster.key,
        clusterLabel: cluster.label,
        importance: ent.importance || 3,
        confidence: 1,
        accessCount: ent.mentionCount || 1,
        createdAt: ent.createdAt,
        updatedAt: ent.updatedAt,
        pinned: false,
        source: 'auto',
        tags: ent.tags || [],
        version: ent.version || 1,
        collection: 'zaylo_entities',
        degree: 0,
        radius: 12,
        color: style.color,
        x: prev ? prev.x : seed.x * 1.35 + Math.cos(ang) * 115,
        y: prev ? prev.y : seed.y * 1.35 + Math.sin(ang) * 115,
        vx: 0,
        vy: 0,
        entity: ent,
      });
    }
  }

  if (filters.categories.has('conversation')) {
    for (const conv of payload.conversations) {
      if (hiddenNodeIds.has(conv.id)) continue;
      const ts = filters.dateField === 'createdAt' ? conv.createdAt : conv.updatedAt;
      if (rangeCutoffMs > 0 && ts < rangeCutoffMs) continue;

      const style = NODE_CATEGORY_META.conversation;
      const cluster = getClusterDefinition({ kind: 'conversation', category: 'conversation' });
      const prev = prevPositions[conv.id];
      const seed = CLUSTER_SEED_CENTERS.conversations;
      const ang = hashAngle(conv.id);

      rawNodes.push({
        id: conv.id,
        kind: 'conversation',
        title: conv.title || 'Conversation',
        content: `${conv.messages.length} messages · ${conv.modelName || 'Local Model'}`,
        category: 'conversation',
        clusterKey: cluster.key,
        clusterLabel: cluster.label,
        importance: 3,
        confidence: 1,
        accessCount: conv.messages.length,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        pinned: false,
        source: 'chat',
        tags: [],
        version: conv.version || 1,
        collection: 'zaylo_conversations',
        degree: 0,
        radius: 8.5,
        color: style.color,
        x: prev ? prev.x : seed.x + Math.cos(ang) * 70,
        y: prev ? prev.y : seed.y + Math.sin(ang) * 70,
        vx: 0,
        vy: 0,
        conversation: conv,
      });
    }
  }

  // Progressive cap for huge collections
  const cappedNodes = rawNodes.slice(0, limitNodes);
  const rawById = new Map<string, GraphNode>();
  for (const n of cappedNodes) rawById.set(n.id, n);

  // Filter relationships whose endpoints remain visible
  const validRelationships = payload.relationships.filter(
    (rel) =>
      filters.relationshipTypes.has(rel.type) &&
      rawById.has(rel.sourceId) &&
      rawById.has(rel.targetId) &&
      rel.sourceId !== rel.targetId
  );

  // Compute node degree & apply minConnections filter
  for (const rel of validRelationships) {
    const src = rawById.get(rel.sourceId);
    const tgt = rawById.get(rel.targetId);
    if (src) src.degree++;
    if (tgt) tgt.degree++;
  }

  const degreeFilteredNodes = cappedNodes.filter((n) => n.degree >= filters.minConnections);
  const activeById = new Map<string, GraphNode>();
  for (const n of degreeFilteredNodes) {
    n.radius = Math.min(24, Math.max(11, 10 + n.importance * 1.35 + Math.sqrt(n.degree) * 2.0));
    activeById.set(n.id, n);
  }

  const activeRelationships = validRelationships.filter(
    (rel) => activeById.has(rel.sourceId) && activeById.has(rel.targetId)
  );

  // Cluster collapse/region transformation (Cluster mode)
  let finalNodes = degreeFilteredNodes;
  let finalEdgesRaw = activeRelationships;
  const clusterRegions: ClusterRegion[] = [];

  if (mode === 'cluster') {
    const groups = new Map<string, GraphNode[]>();
    for (const node of degreeFilteredNodes) {
      const list = groups.get(node.clusterKey) || [];
      list.push(node);
      groups.set(node.clusterKey, list);
    }

    const orderedKeys = Array.from(groups.keys()).sort();
    const cols = Math.max(1, Math.min(3, orderedKeys.length));
    const cellW = 340;
    const cellH = 260;
    const startX = -((cols - 1) * cellW) / 2 - cellW / 2;
    const rows = Math.ceil(orderedKeys.length / cols);
    const startY = -((rows - 1) * cellH) / 2 - cellH / 2;

    const proxyMap = new Map<string, GraphNode>();
    const keptNodes: GraphNode[] = [];

    orderedKeys.forEach((key, idx) => {
      const members = groups.get(key)!;
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const rx = startX + col * cellW + 14;
      const ry = startY + row * cellH + 14;
      const rw = cellW - 28;
      const rh = cellH - 28;
      const cx = rx + rw / 2;
      const cy = ry + rh / 2;
      const isCollapsed = collapsedClusters.has(key);
      const avgImp =
        members.reduce((sum, n) => sum + n.importance, 0) / Math.max(1, members.length);

      clusterRegions.push({
        key,
        title: members[0].clusterLabel,
        color: members[0].color,
        count: members.length,
        avgImportance: parseFloat(avgImp.toFixed(1)),
        collapsed: isCollapsed,
        x: rx,
        y: ry,
        width: rw,
        height: rh,
        memberIds: members.map((m) => m.id),
      });

      if (isCollapsed) {
        const proxyId = `cluster::${key}`;
        const proxy: GraphNode = {
          id: proxyId,
          kind: members[0].kind,
          title: `${members[0].clusterLabel} (${members.length})`,
          content: `Collapsed cluster containing ${members.length} nodes`,
          category: members[0].category,
          clusterKey: key,
          clusterLabel: members[0].clusterLabel,
          importance: Math.round(avgImp),
          confidence: 1,
          accessCount: members.length,
          createdAt: members[0].createdAt,
          updatedAt: members[0].updatedAt,
          pinned: false,
          source: 'cluster',
          tags: [],
          version: 1,
          collection: payload.collection,
          degree: members.reduce((s, m) => s + m.degree, 0),
          radius: Math.min(26, 13 + Math.sqrt(members.length) * 2.2),
          color: members[0].color,
          x: cx,
          y: cy,
          vx: 0,
          vy: 0,
          fx: cx,
          fy: cy,
          isClusterProxy: true,
          collapsedCount: members.length,
        };
        keptNodes.push(proxy);
        for (const m of members) proxyMap.set(m.id, proxy);
      } else {
        // Place cluster members neatly inside their organized region grid
        const innerCols = Math.max(1, Math.ceil(Math.sqrt(members.length)));
        const innerRows = Math.max(1, Math.ceil(members.length / innerCols));
        const padX = 48;
        const padTop = 54;
        const availW = rw - padX * 2;
        const availH = rh - padTop - 28;

        members.forEach((m, mi) => {
          const ic = mi % innerCols;
          const ir = Math.floor(mi / innerCols);
          const tx =
            innerCols === 1 ? cx : rx + padX + (ic / (innerCols - 1)) * availW;
          const ty =
            innerRows === 1 ? cy + 8 : ry + padTop + (ir / (innerRows - 1)) * availH;
          m.x = prevPositions[m.id]?.x ?? tx;
          m.y = prevPositions[m.id]?.y ?? ty;
          m.fx = undefined;
          m.fy = undefined;
          keptNodes.push(m);
        });
      }
    });

    finalNodes = keptNodes;
    // Remap edges connected to collapsed proxy nodes
    const remapped = new Map<string, (typeof activeRelationships)[number]>();
    for (const rel of activeRelationships) {
      const sNode = proxyMap.get(rel.sourceId)?.id ?? rel.sourceId;
      const tNode = proxyMap.get(rel.targetId)?.id ?? rel.targetId;
      if (sNode === tNode) continue;
      const dedupeKey = sNode < tNode ? `${rel.type}:${sNode}:${tNode}` : `${rel.type}:${tNode}:${sNode}`;
      if (!remapped.has(dedupeKey)) {
        remapped.set(dedupeKey, { ...rel, sourceId: sNode, targetId: tNode });
      }
    }
    finalEdgesRaw = Array.from(remapped.values());
  }

  // Timeline mode deterministic chronological swimlane layout
  const timelineTicks: TimelineTick[] = [];
  let minMs = now - 86400000;
  let maxMs = now;

  if (mode === 'timeline' && finalNodes.length > 0) {
    const timestamps = finalNodes.map((n) =>
      filters.dateField === 'createdAt' ? n.createdAt : n.updatedAt
    );
    minMs = Math.min(...timestamps);
    maxMs = Math.max(...timestamps);
    if (maxMs - minMs < 60_000) {
      minMs -= 3600_000;
      maxMs += 3600_000;
    }

    const spanW = 860;
    const leftX = -spanW / 2;
    const laneCategories = Array.from(new Set(finalNodes.map((n) => n.category))).sort();
    const laneGap = 78;
    const topY = -((laneCategories.length - 1) * laneGap) / 2;

    // Group near-simultaneous timestamps within the same lane to avoid overlap
    const slotCounters = new Map<string, number>();
    for (const n of finalNodes) {
      const ts = filters.dateField === 'createdAt' ? n.createdAt : n.updatedAt;
      const tNorm = (ts - minMs) / Math.max(1, maxMs - minMs);
      const laneIdx = Math.max(0, laneCategories.indexOf(n.category));
      const xBucket = Math.round(tNorm * 24);
      const slotKey = `${laneIdx}:${xBucket}`;
      const slotOrder = slotCounters.get(slotKey) ?? 0;
      slotCounters.set(slotKey, slotOrder + 1);

      const xPos = leftX + tNorm * spanW + (slotOrder % 2 === 0 ? 1 : -1) * Math.floor(slotOrder / 2) * 14;
      const yPos = topY + laneIdx * laneGap + ((slotOrder % 3) - 1) * 18;
      n.x = xPos;
      n.y = yPos;
      n.fx = xPos;
      n.fy = yPos;
    }

    const tickCount = 5;
    for (let i = 0; i < tickCount; i++) {
      const ratio = i / (tickCount - 1);
      const tickMs = minMs + (maxMs - minMs) * ratio;
      const d = new Date(tickMs);
      const sameDay = maxMs - minMs < 36 * 3600 * 1000;
      timelineTicks.push({
        x: leftX + ratio * spanW,
        label: sameDay
          ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      });
    }
  } else if (mode === 'network' && layoutPreset !== 'force') {
    applyStaticLayoutPreset(finalNodes, layoutPreset);
  }

  // Build final deduplicated parallel-offset edges
  const pairGroups = new Map<string, typeof finalEdgesRaw>();
  for (const rel of finalEdgesRaw) {
    const key = rel.sourceId < rel.targetId ? `${rel.sourceId}::${rel.targetId}` : `${rel.targetId}::${rel.sourceId}`;
    const arr = pairGroups.get(key) || [];
    arr.push(rel);
    pairGroups.set(key, arr);
  }

  const edges: GraphEdge[] = [];
  for (const group of pairGroups.values()) {
    const total = group.length;
    group.forEach((rel, idx) => {
      const meta = RELATIONSHIP_META[rel.type] || RELATIONSHIP_META.RELATED_TO;
      const offset = total === 1 ? 0 : (idx - (total - 1) / 2) * 18;
      edges.push({
        id: rel.id,
        source: rel.sourceId,
        target: rel.targetId,
        type: rel.type,
        strength: rel.strength,
        confidence: rel.confidence,
        directed: rel.directed,
        autoGenerated: rel.autoGenerated,
        metadata: rel.metadata,
        color: meta.color,
        dashed: meta.dashed,
        parallelOffset: offset,
      });
    });
  }

  const nodeById = new Map<string, GraphNode>();
  for (const n of finalNodes) nodeById.set(n.id, n);

  // Pre-settle initial layout when nodes have no saved coordinates so first paint is balanced and airy
  if (mode !== 'timeline' && !(mode === 'network' && layoutPreset !== 'force')) {
    const hasMissingPositions = finalNodes.some((n) => !prevPositions[n.id] && n.fx === undefined);
    if (hasMissingPositions) {
      for (let step = 0; step < 55; step++) {
        stepForceSimulation({
          nodes: finalNodes,
          edges,
          nodeById,
          mode,
          clusterRegions,
          repulsion: 18000,
          linkDistance: 190,
          alpha: 0.45,
        });
      }
      for (const n of finalNodes) {
        n.vx = 0;
        n.vy = 0;
      }
    }
  }

  return {
    nodes: finalNodes,
    edges,
    nodeById,
    clusterRegions,
    timelineTicks,
    timelineMinMs: minMs,
    timelineMaxMs: maxMs,
  };
}

export function applyStaticLayoutPreset(nodes: GraphNode[], preset: GraphLayoutPreset): void {
  if (nodes.length === 0) return;
  if (preset === 'radial') {
    // Hub-and-spoke concentric ordering by degree descending (NO giant central node)
    const sorted = [...nodes].sort((a, b) => b.degree - a.degree || b.importance - a.importance);
    const rings = [
      { max: 1, r: 0 },
      { max: 8, r: 120 },
      { max: 24, r: 240 },
      { max: Infinity, r: 360 },
    ];
    let ringIdx = 0;
    let ringStart = 0;
    for (let i = 0; i < sorted.length; i++) {
      while (i >= rings[ringIdx].max && ringIdx < rings.length - 1) {
        ringIdx++;
        ringStart = i;
      }
      const nextCap = Math.min(sorted.length, rings[ringIdx].max);
      const countInRing = Math.max(1, nextCap - ringStart);
      const posInRing = i - ringStart;
      const angle = (posInRing / countInRing) * Math.PI * 2 - Math.PI / 2;
      const radius = countInRing === 1 && ringIdx === 0 ? 0 : rings[ringIdx].r;
      sorted[i].x = Math.cos(angle) * radius;
      sorted[i].y = Math.sin(angle) * radius;
      sorted[i].vx = 0;
      sorted[i].vy = 0;
    }
  } else if (preset === 'compact') {
    const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
    const gap = 88;
    const sorted = [...nodes].sort((a, b) => a.clusterKey.localeCompare(b.clusterKey));
    sorted.forEach((n, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      n.x = (col - (cols - 1) / 2) * gap;
      n.y = (row - (Math.ceil(sorted.length / cols) - 1) / 2) * gap;
      n.vx = 0;
      n.vy = 0;
    });
  }
}

/**
 * Spatial-grid accelerated force-directed layout step.
 * Scales smoothly to thousands of nodes without O(N^2) stalls.
 */
export function stepForceSimulation(params: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  nodeById: Map<string, GraphNode>;
  mode: GraphViewMode;
  clusterRegions: ClusterRegion[];
  repulsion: number;
  linkDistance: number;
  alpha?: number;
}): number {
  const {
    nodes,
    edges,
    nodeById,
    mode,
    clusterRegions,
    repulsion,
    linkDistance,
    alpha = 0.28,
  } = params;

  if (mode === 'timeline' || nodes.length === 0) return 0;

  const regionByKey = new Map<string, ClusterRegion>();
  if (mode === 'cluster') {
    for (const r of clusterRegions) regionByKey.set(r.key, r);
  }

  // 1. Repulsion: exact pairwise for N <= 350 (accurate & wide spacing), spatial grid for larger graphs
  const minSepBase = mode === 'cluster' ? 54 : 92;
  if (nodes.length <= 350) {
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x || 0.5;
        const dy = a.y - b.y || 0.5;
        const distSq = dx * dx + dy * dy + 1;
        const dist = Math.sqrt(distSq);
        const minSep = a.radius + b.radius + minSepBase;
        let force = (repulsion / distSq) * alpha * 0.45;
        if (dist < minSep) {
          force += ((minSep - dist) / minSep) * 2.4;
        }
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (a.fx === undefined && a.fy === undefined) {
          a.vx += fx;
          a.vy += fy;
        }
        if (b.fx === undefined && b.fy === undefined) {
          b.vx -= fx;
          b.vy -= fy;
        }
      }
    }
  } else {
    const cellSize = 180;
    const grid = new Map<string, GraphNode[]>();
    for (const n of nodes) {
      const cx = Math.floor(n.x / cellSize);
      const cy = Math.floor(n.y / cellSize);
      const key = `${cx},${cy}`;
      const bucket = grid.get(key) || [];
      bucket.push(n);
      grid.set(key, bucket);
    }

    for (const n of nodes) {
      if (n.fx !== undefined && n.fy !== undefined) continue;
      const cx = Math.floor(n.x / cellSize);
      const cy = Math.floor(n.y / cellSize);

      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const neighbors = grid.get(`${cx + ox},${cy + oy}`);
          if (!neighbors) continue;
          for (const other of neighbors) {
            if (other.id === n.id) continue;
            const dx = n.x - other.x;
            const dy = n.y - other.y;
            const distSq = dx * dx + dy * dy + 1;
            const dist = Math.sqrt(distSq);
            const minSep = n.radius + other.radius + minSepBase;
            let force = (repulsion / distSq) * alpha * 0.45;
            if (dist < minSep) {
              force += ((minSep - dist) / minSep) * 2.4;
            }
            n.vx += (dx / dist) * force;
            n.vy += (dy / dist) * force;
          }
        }
      }
    }
  }

  // 2. Link springs pulling strongly related memories into coherent clusters without cramping
  for (const edge of edges) {
    const s = nodeById.get(edge.source);
    const t = nodeById.get(edge.target);
    if (!s || !t) continue;
    const dx = t.x - s.x;
    const dy = t.y - s.y;
    const dist = Math.hypot(dx, dy) || 0.1;
    const targetDist = linkDistance * (1.2 - edge.strength * 0.35);
    const pull = ((dist - targetDist) / dist) * (0.045 + edge.strength * 0.03) * alpha;

    if (s.fx === undefined) {
      s.vx += dx * pull;
      s.vy += dy * pull;
    }
    if (t.fx === undefined) {
      t.vx -= dx * pull;
      t.vy -= dy * pull;
    }
  }

  // 3. Gentle centering / cluster region containment
  for (const n of nodes) {
    if (n.fx !== undefined && n.fy !== undefined) {
      n.x = n.fx;
      n.y = n.fy;
      n.vx = 0;
      n.vy = 0;
      continue;
    }

    if (mode === 'cluster') {
      const reg = regionByKey.get(n.clusterKey);
      if (reg && !reg.collapsed) {
        const rcx = reg.x + reg.width / 2;
        const rcy = reg.y + reg.height / 2 + 12;
        n.vx += (rcx - n.x) * 0.03;
        n.vy += (rcy - n.y) * 0.03;
      }
    } else {
      n.vx += -n.x * 0.0022;
      n.vy += -n.y * 0.0022;
    }
  }

  // 4. Integrate with damping & clamp velocities for smoothness
  let totalEnergy = 0;
  for (const n of nodes) {
    if (n.fx !== undefined && n.fy !== undefined) continue;
    n.vx *= 0.82;
    n.vy *= 0.82;
    const speed = Math.hypot(n.vx, n.vy);
    if (speed > 14) {
      n.vx = (n.vx / speed) * 14;
      n.vy = (n.vy / speed) * 14;
    }
    n.x += n.vx;
    n.y += n.vy;

    // Clamp cleanly inside Cluster box if in Cluster mode
    if (mode === 'cluster') {
      const reg = regionByKey.get(n.clusterKey);
      if (reg && !reg.collapsed) {
        const pad = n.radius + 16;
        n.x = Math.min(reg.x + reg.width - pad, Math.max(reg.x + pad, n.x));
        n.y = Math.min(reg.y + reg.height - pad, Math.max(reg.y + 42 + n.radius, n.y));
      }
    }

    totalEnergy += n.vx * n.vx + n.vy * n.vy;
  }

  return totalEnergy;
}
