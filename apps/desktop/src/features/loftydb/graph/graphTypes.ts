import type {
  KnowledgeNodeKind,
  MemoryCategory,
  MemoryEntity,
  MemoryEntry,
  MemoryRelationshipType,
  StoredConversation,
} from '@local-ai/shared';

export type GraphViewMode = 'network' | 'cluster' | 'timeline';
export type GraphLayoutPreset = 'force' | 'radial' | 'compact';

export type NodeVisualGroup = MemoryCategory | 'entity' | 'conversation';

export interface NodeGroupStyle {
  key: NodeVisualGroup;
  label: string;
  pluralLabel: string;
  color: string;
  surfaceTint: string;
  borderTint: string;
  dotClass: string;
  badgeClass: string;
}

export const NODE_CATEGORY_META: Record<NodeVisualGroup, NodeGroupStyle> = {
  fact: {
    key: 'fact',
    label: 'Fact',
    pluralLabel: 'Facts',
    color: '#3b82f6',
    surfaceTint: 'rgba(59, 130, 246, 0.14)',
    borderTint: 'rgba(59, 130, 246, 0.45)',
    dotClass: 'bg-blue-500',
    badgeClass: 'bg-blue-500/12 text-blue-700 dark:text-blue-300 border-blue-500/35',
  },
  preference: {
    key: 'preference',
    label: 'Preference',
    pluralLabel: 'Preferences',
    color: '#10b981',
    surfaceTint: 'rgba(16, 185, 129, 0.14)',
    borderTint: 'rgba(16, 185, 129, 0.45)',
    dotClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/35',
  },
  instruction: {
    key: 'instruction',
    label: 'Instruction',
    pluralLabel: 'Instructions',
    color: '#f59e0b',
    surfaceTint: 'rgba(245, 158, 11, 0.14)',
    borderTint: 'rgba(245, 158, 11, 0.45)',
    dotClass: 'bg-amber-500',
    badgeClass: 'bg-amber-500/12 text-amber-800 dark:text-amber-300 border-amber-500/35',
  },
  project: {
    key: 'project',
    label: 'Project',
    pluralLabel: 'Projects',
    color: '#ec4899',
    surfaceTint: 'rgba(236, 72, 153, 0.14)',
    borderTint: 'rgba(236, 72, 153, 0.45)',
    dotClass: 'bg-pink-500',
    badgeClass: 'bg-pink-500/12 text-pink-700 dark:text-pink-300 border-pink-500/35',
  },
  episode: {
    key: 'episode',
    label: 'Episode',
    pluralLabel: 'Episodes',
    color: '#8b5cf6',
    surfaceTint: 'rgba(139, 92, 246, 0.14)',
    borderTint: 'rgba(139, 92, 246, 0.45)',
    dotClass: 'bg-violet-500',
    badgeClass: 'bg-violet-500/12 text-violet-700 dark:text-violet-300 border-violet-500/35',
  },
  context: {
    key: 'context',
    label: 'Context',
    pluralLabel: 'Context',
    color: '#f97316',
    surfaceTint: 'rgba(249, 115, 22, 0.14)',
    borderTint: 'rgba(249, 115, 22, 0.45)',
    dotClass: 'bg-orange-500',
    badgeClass: 'bg-orange-500/12 text-orange-700 dark:text-orange-300 border-orange-500/35',
  },
  entity: {
    key: 'entity',
    label: 'Entity',
    pluralLabel: 'Entities',
    color: '#06b6d4',
    surfaceTint: 'rgba(6, 182, 212, 0.14)',
    borderTint: 'rgba(6, 182, 212, 0.45)',
    dotClass: 'bg-cyan-500',
    badgeClass: 'bg-cyan-500/12 text-cyan-700 dark:text-cyan-300 border-cyan-500/35',
  },
  conversation: {
    key: 'conversation',
    label: 'Conversation',
    pluralLabel: 'Conversations',
    color: '#64748b',
    surfaceTint: 'rgba(100, 116, 139, 0.16)',
    borderTint: 'rgba(100, 116, 139, 0.45)',
    dotClass: 'bg-slate-400',
    badgeClass: 'bg-slate-500/12 text-slate-700 dark:text-slate-300 border-slate-500/35',
  },
};

export interface RelationshipStyleMeta {
  type: MemoryRelationshipType;
  label: string;
  color: string;
  dashed: boolean;
  description: string;
}

export const ALL_RELATIONSHIP_TYPES: MemoryRelationshipType[] = [
  'RELATED_TO',
  'ABOUT',
  'BUILT_WITH',
  'PART_OF',
  'DEPENDS_ON',
  'CREATED_BY',
  'OCCURRED_DURING',
  'SUPERSEDES',
  'CONTRADICTS',
  'DERIVED_FROM',
];

export const RELATIONSHIP_META: Record<MemoryRelationshipType, RelationshipStyleMeta> = {
  RELATED_TO: {
    type: 'RELATED_TO',
    label: 'RELATED_TO',
    color: '#94a3b8',
    dashed: false,
    description: 'Semantically related memory or concept',
  },
  ABOUT: {
    type: 'ABOUT',
    label: 'ABOUT',
    color: '#38bdf8',
    dashed: false,
    description: 'Memory describes or references target entity',
  },
  BUILT_WITH: {
    type: 'BUILT_WITH',
    label: 'BUILT_WITH',
    color: '#22d3ee',
    dashed: false,
    description: 'Project or system utilizes target technology/tool',
  },
  PART_OF: {
    type: 'PART_OF',
    label: 'PART_OF',
    color: '#a78bfa',
    dashed: false,
    description: 'Component or detail belonging to larger module',
  },
  DEPENDS_ON: {
    type: 'DEPENDS_ON',
    label: 'DEPENDS_ON',
    color: '#f472b6',
    dashed: false,
    description: 'Explicit runtime, library, or workflow dependency',
  },
  CREATED_BY: {
    type: 'CREATED_BY',
    label: 'CREATED_BY',
    color: '#34d399',
    dashed: false,
    description: 'Authored, owned, or initiated by entity',
  },
  OCCURRED_DURING: {
    type: 'OCCURRED_DURING',
    label: 'OCCURRED_DURING',
    color: '#818cf8',
    dashed: true,
    description: 'Episodic event captured during a conversation or timeframe',
  },
  SUPERSEDES: {
    type: 'SUPERSEDES',
    label: 'SUPERSEDES',
    color: '#fbbf24',
    dashed: true,
    description: 'Newer instruction or fact replaces an older entry',
  },
  CONTRADICTS: {
    type: 'CONTRADICTS',
    label: 'CONTRADICTS',
    color: '#ef4444',
    dashed: true,
    description: 'Conflicting rule, fact, or preference requiring review',
  },
  DERIVED_FROM: {
    type: 'DERIVED_FROM',
    label: 'DERIVED_FROM',
    color: '#64748b',
    dashed: true,
    description: 'Memory distilled directly from source chat or document',
  },
};

export interface GraphNode {
  id: string;
  kind: KnowledgeNodeKind;
  title: string;
  content: string;
  category: NodeVisualGroup;
  clusterKey: string;
  clusterLabel: string;
  importance: number;
  confidence: number;
  accessCount: number;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  source: string;
  tags: string[];
  version: number;
  collection: string;
  degree: number;
  radius: number;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number;
  fy?: number;
  isClusterProxy?: boolean;
  collapsedCount?: number;
  memory?: MemoryEntry;
  entity?: MemoryEntity;
  conversation?: StoredConversation;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: MemoryRelationshipType;
  strength: number;
  confidence: number;
  directed: boolean;
  autoGenerated: boolean;
  metadata?: Record<string, unknown>;
  color: string;
  dashed: boolean;
  parallelOffset: number;
}

export interface ClusterRegion {
  key: string;
  title: string;
  color: string;
  count: number;
  avgImportance: number;
  collapsed: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  memberIds: string[];
}

export interface GraphFilterState {
  categories: Set<NodeVisualGroup>;
  minImportance: number;
  dateRange: 'all' | '24h' | '7d' | '30d';
  dateField: 'createdAt' | 'updatedAt';
  minConnections: number;
  source: 'all' | 'manual' | 'auto' | 'chat';
  relationshipTypes: Set<MemoryRelationshipType>;
}

export interface GraphDisplaySettings {
  showRelationships: boolean;
  showLabels: boolean;
  showMinimap: boolean;
  physicsRunning: boolean;
  repulsion: number;
  linkDistance: number;
  canvasTheme?: 'auto' | 'dark' | 'light';
}

export type LayoutPositionMap = Record<string, { x: number; y: number }>;
