import crypto from 'node:crypto';
import type {
  KnowledgeNodeKind,
  MemoryCategory,
  MemoryEntity,
  MemoryEntry,
  MemoryIntelligenceReport,
  MemoryRelationship,
  MemoryRelationshipType,
} from '@local-ai/shared';

const KNOWN_TECH_ENTITIES: Array<{ canonical: string; aliases: string[]; type: MemoryEntity['entityType'] }> = [
  { canonical: 'TypeScript', aliases: ['typescript', 'ts'], type: 'technology' },
  { canonical: 'JavaScript', aliases: ['javascript', 'js'], type: 'technology' },
  { canonical: 'React', aliases: ['react', 'reactjs'], type: 'technology' },
  { canonical: 'Electron', aliases: ['electron'], type: 'technology' },
  { canonical: 'Fastify', aliases: ['fastify'], type: 'technology' },
  { canonical: 'Node.js', aliases: ['node.js', 'nodejs'], type: 'technology' },
  { canonical: 'Python', aliases: ['python', 'py'], type: 'technology' },
  { canonical: 'Go', aliases: ['golang'], type: 'technology' },
  { canonical: 'Rust', aliases: ['rust'], type: 'technology' },
  { canonical: 'LoftyDB', aliases: ['loftydb'], type: 'tool' },
  { canonical: 'SQLite', aliases: ['sqlite'], type: 'tool' },
  { canonical: 'PostgreSQL', aliases: ['postgresql', 'postgres'], type: 'tool' },
  { canonical: 'Redis', aliases: ['redis'], type: 'tool' },
  { canonical: 'Docker', aliases: ['docker', 'docker compose'], type: 'tool' },
  { canonical: 'Kubernetes', aliases: ['kubernetes', 'k8s'], type: 'tool' },
  { canonical: 'Tailwind CSS', aliases: ['tailwind', 'tailwindcss', 'tailwind css'], type: 'technology' },
  { canonical: 'Vite', aliases: ['vite'], type: 'tool' },
  { canonical: 'Next.js', aliases: ['next.js', 'nextjs'], type: 'technology' },
  { canonical: 'GraphQL', aliases: ['graphql'], type: 'technology' },
  { canonical: 'Vitest', aliases: ['vitest'], type: 'tool' },
  { canonical: 'Zaylo', aliases: ['zaylo'], type: 'project' },
  { canonical: 'CUDA', aliases: ['cuda'], type: 'technology' },
  { canonical: 'Metal', aliases: ['apple metal'], type: 'technology' },
  { canonical: 'llama.cpp', aliases: ['llama.cpp', 'llamacpp'], type: 'tool' },
  { canonical: 'MLX', aliases: ['mlx'], type: 'technology' },
  { canonical: 'PyTorch', aliases: ['pytorch'], type: 'technology' },
];

const OPPOSING_STYLE_PAIRS: Array<[RegExp, RegExp, string]> = [
  [
    /\b(?:concise|brief|terse|short\s+(?:answers?|replies|responses?|explanations?))\b/i,
    /\b(?:verbose|long[- ]form|detailed\s+(?:answers?|explanations?|responses?|examples?)|comprehensive\s+(?:answers?|explanations?|responses?|guides?))\b/i,
    'Conflicting verbosity preference (concise vs detailed)',
  ],
  [
    /\b(?:dark\s+mode|dark\s+theme)\b/i,
    /\b(?:light\s+mode|light\s+theme|white\s+theme)\b/i,
    'Conflicting theme preference (dark vs light)',
  ],
  [
    /\b(?:always\s+use|prefer)\s+([a-z0-9.+-]+)/i,
    /\b(?:never\s+use|avoid|don't\s+use)\s+([a-z0-9.+-]+)/i,
    'Conflicting tool/style directive (always/prefer vs never/avoid)',
  ],
];

export function slugifyEntityId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `ent_${slug || crypto.createHash('md5').update(name).digest('hex').slice(0, 8)}`;
}

export function deriveMemoryTitle(content: string): string {
  const clean = content.replace(/\s+/g, ' ').trim();
  if (!clean) return 'Untitled Memory';
  const firstClause = clean.split(/[.!?\n]/)[0].trim();
  if (firstClause.length <= 46) return firstClause;
  return `${firstClause.slice(0, 43).trimEnd()}...`;
}

export function cosineSimilarityVectors(a?: number[], b?: number[]): number {
  if (!a || !b || a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom > 1e-8 ? Math.max(0, Math.min(1, dot / denom)) : 0;
}

function jaccardSimilarity(aText: string, bText: string): number {
  const tokenize = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2)
    );
  const a = tokenize(aText);
  const b = tokenize(bText);
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) {
    if (b.has(t)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export function inferEntityEdgeType(
  memory: MemoryEntry,
  entity: { canonical: string; type: MemoryEntity['entityType'] }
): MemoryRelationshipType {
  const lower = memory.content.toLowerCase();
  if (/\b(?:created\s+by|authored\s+by|made\s+by|owned\s+by)\b/i.test(lower)) {
    return 'CREATED_BY';
  }
  if (/\b(?:depends\s+on|requires|relies\s+on|needs)\b/i.test(lower)) {
    return 'DEPENDS_ON';
  }
  if (/\b(?:part\s+of|belongs\s+to|inside|submodule\s+of)\b/i.test(lower)) {
    return 'PART_OF';
  }
  if (
    entity.type === 'technology' ||
    entity.type === 'tool'
  ) {
    if (
      memory.category === 'project' ||
      /\b(?:built\s+with|uses|using|runs\s+on|powered\s+by|written\s+in|stack|framework|backend|frontend)\b/i.test(lower)
    ) {
      return 'BUILT_WITH';
    }
  }
  return 'ABOUT';
}

export function extractEntitiesFromMemory(memory: MemoryEntry): Array<{
  id: string;
  name: string;
  entityType: MemoryEntity['entityType'];
  aliases: string[];
  edgeType: MemoryRelationshipType;
}> {
  const found = new Map<
    string,
    {
      id: string;
      name: string;
      entityType: MemoryEntity['entityType'];
      aliases: string[];
      edgeType: MemoryRelationshipType;
    }
  >();

  const lower = memory.content.toLowerCase();

  for (const tech of KNOWN_TECH_ENTITIES) {
    const matched = tech.aliases.some((alias) => {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i').test(lower);
    });
    if (matched) {
      const id = slugifyEntityId(tech.canonical);
      found.set(id, {
        id,
        name: tech.canonical,
        entityType: tech.type,
        aliases: tech.aliases,
        edgeType: inferEntityEdgeType(memory, { canonical: tech.canonical, type: tech.type }),
      });
    }
  }

  // Also check explicit "Go" uppercase word (avoid matching lowercase verb "go")
  if (/\bGo\b/.test(memory.content)) {
    const id = slugifyEntityId('Go');
    if (!found.has(id)) {
      found.set(id, {
        id,
        name: 'Go',
        entityType: 'technology',
        aliases: ['golang', 'go'],
        edgeType: inferEntityEdgeType(memory, { canonical: 'Go', type: 'technology' }),
      });
    }
  }

  // Recognize explicit "project <Name>" or "my name is <Name>"
  const nameMatch = memory.content.match(/\b(?:my\s+name\s+is|call\s+me)\s+([A-Z][a-z]{1,24}(?:\s+[A-Z][a-z]{1,24})?)/);
  if (nameMatch?.[1]) {
    const personName = nameMatch[1].trim();
    const id = slugifyEntityId(personName);
    found.set(id, {
      id,
      name: personName,
      entityType: 'person',
      aliases: [personName.toLowerCase()],
      edgeType: 'ABOUT',
    });
  }

  return Array.from(found.values());
}

export function detectMemoryConflict(a: MemoryEntry, b: MemoryEntry): string | null {
  if (a.id === b.id) return null;

  for (const [patA, patB, desc] of OPPOSING_STYLE_PAIRS) {
    const aMatchesFirst = patA.exec(a.content);
    const bMatchesSecond = patB.exec(b.content);
    if (aMatchesFirst && bMatchesSecond) {
      // If regex captured an object group, require overlapping subject when possible
      if (aMatchesFirst[1] && bMatchesSecond[1]) {
        if (aMatchesFirst[1].toLowerCase() === bMatchesSecond[1].toLowerCase()) {
          return `${desc} (${aMatchesFirst[1]})`;
        }
      } else {
        return desc;
      }
    }
    const bMatchesFirst = patA.exec(b.content);
    const aMatchesSecond = patB.exec(a.content);
    if (bMatchesFirst && aMatchesSecond) {
      if (bMatchesFirst[1] && aMatchesSecond[1]) {
        if (bMatchesFirst[1].toLowerCase() === aMatchesSecond[1].toLowerCase()) {
          return `${desc} (${bMatchesFirst[1]})`;
        }
      } else {
        return desc;
      }
    }
  }

  return null;
}

export function buildRelationshipId(
  sourceId: string,
  targetId: string,
  type: MemoryRelationshipType,
  directed: boolean = true
): string {
  const [a, b] =
    !directed && sourceId > targetId ? [targetId, sourceId] : [sourceId, targetId];
  const hash = crypto
    .createHash('sha1')
    .update(`${a}::${type}::${b}`)
    .digest('hex')
    .slice(0, 14);
  return `rel_${hash}`;
}

export function computeIntelligenceReport(params: {
  memories: MemoryEntry[];
  entities: MemoryEntity[];
  relationships: MemoryRelationship[];
  vectorsById: Map<string, number[]>;
}): MemoryIntelligenceReport {
  const { memories, entities, relationships, vectorsById } = params;

  const titleById = new Map<string, { title: string; kind: KnowledgeNodeKind; category?: string }>();
  for (const m of memories) {
    titleById.set(m.id, {
      title: m.title || deriveMemoryTitle(m.content),
      kind: 'memory',
      category: m.category,
    });
  }
  for (const e of entities) {
    titleById.set(e.id, {
      title: e.name,
      kind: 'entity',
      category: e.entityType,
    });
  }

  // Degree calculation & direct neighbor pair lookup
  const degreeMap = new Map<string, number>();
  const connectedPairs = new Set<string>();
  for (const m of memories) degreeMap.set(m.id, 0);
  for (const e of entities) degreeMap.set(e.id, 0);

  for (const rel of relationships) {
    degreeMap.set(rel.sourceId, (degreeMap.get(rel.sourceId) || 0) + 1);
    degreeMap.set(rel.targetId, (degreeMap.get(rel.targetId) || 0) + 1);
    const pairKey = rel.sourceId < rel.targetId ? `${rel.sourceId}|${rel.targetId}` : `${rel.targetId}|${rel.sourceId}`;
    connectedPairs.add(pairKey);
  }

  const highlyConnected = Array.from(degreeMap.entries())
    .filter(([id, deg]) => deg >= 2 && titleById.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([nodeId, degree]) => {
      const info = titleById.get(nodeId)!;
      return { nodeId, title: info.title, kind: info.kind, category: info.category, degree };
    });

  const isolated = memories
    .filter((m) => (degreeMap.get(m.id) || 0) === 0)
    .slice(0, 15)
    .map((m) => ({
      nodeId: m.id,
      title: m.title || deriveMemoryTitle(m.content),
      kind: 'memory' as const,
      category: m.category,
    }));

  const similarDuplicates: MemoryIntelligenceReport['similarDuplicates'] = [];
  const contradictions: MemoryIntelligenceReport['contradictions'] = [];
  const missingRelationships: MemoryIntelligenceReport['missingRelationships'] = [];

  // Record existing explicit CONTRADICTS edges first
  for (const rel of relationships) {
    if (rel.type !== 'CONTRADICTS') continue;
    const aInfo = titleById.get(rel.sourceId);
    const bInfo = titleById.get(rel.targetId);
    if (!aInfo || !bInfo) continue;
    contradictions.push({
      aId: rel.sourceId,
      bId: rel.targetId,
      aTitle: aInfo.title,
      bTitle: bInfo.title,
      reason: String(rel.metadata?.reason || 'Stored contradiction relationship'),
      edgeId: rel.id,
    });
  }

  // Pairwise analysis over recent memories (capped at 180 nodes for fast deterministic latency)
  const sample = memories.slice(0, 180);
  for (let i = 0; i < sample.length; i++) {
    const a = sample[i];
    const vecA = vectorsById.get(a.id);
    for (let j = i + 1; j < sample.length; j++) {
      const b = sample[j];
      const vecB = vectorsById.get(b.id);
      const pairKey = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
      const isAlreadyLinked = connectedPairs.has(pairKey);

      const conflictReason = detectMemoryConflict(a, b);
      if (conflictReason && !contradictions.some((c) => (c.aId === a.id && c.bId === b.id) || (c.aId === b.id && c.bId === a.id))) {
        contradictions.push({
          aId: a.id,
          bId: b.id,
          aTitle: a.title || deriveMemoryTitle(a.content),
          bTitle: b.title || deriveMemoryTitle(b.content),
          reason: conflictReason,
        });
      }

      const vecSim = cosineSimilarityVectors(vecA, vecB);
      const lexSim = jaccardSimilarity(a.content, b.content);
      const bestSim = Math.max(vecSim, lexSim);

      if (bestSim >= 0.72 && !conflictReason && similarDuplicates.length < 10) {
        similarDuplicates.push({
          aId: a.id,
          bId: b.id,
          aTitle: a.title || deriveMemoryTitle(a.content),
          bTitle: b.title || deriveMemoryTitle(b.content),
          similarity: parseFloat(bestSim.toFixed(3)),
          reason:
            vecSim >= 0.72
              ? `${Math.round(vecSim * 100)}% LoftyDB vector overlap`
              : `${Math.round(lexSim * 100)}% lexical term overlap`,
        });
      } else if (!isAlreadyLinked && bestSim >= 0.45 && missingRelationships.length < 12) {
        const sharedTag = a.tags.find((t) => b.tags.includes(t));
        missingRelationships.push({
          sourceId: a.id,
          targetId: b.id,
          sourceKind: 'memory',
          targetKind: 'memory',
          sourceTitle: a.title || deriveMemoryTitle(a.content),
          targetTitle: b.title || deriveMemoryTitle(b.content),
          suggestedType: a.category === 'instruction' && b.category === 'instruction' ? 'SUPERSEDES' : 'RELATED_TO',
          confidence: parseFloat(bestSim.toFixed(3)),
          reason: sharedTag
            ? `Unlinked pair sharing #${sharedTag} (${Math.round(bestSim * 100)}% similarity)`
            : `${Math.round(bestSim * 100)}% unlinked semantic similarity`,
        });
      }
    }
  }

  const recentlyUpdated = [...memories]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 8)
    .map((m) => ({
      nodeId: m.id,
      title: m.title || deriveMemoryTitle(m.content),
      updatedAt: m.updatedAt,
      version: m.version || 1,
      category: m.category,
    }));

  const frequentlyRetrieved = memories
    .filter((m) => (m.accessCount || 0) > 0)
    .sort((a, b) => (b.accessCount || 0) - (a.accessCount || 0))
    .slice(0, 8)
    .map((m) => ({
      nodeId: m.id,
      title: m.title || deriveMemoryTitle(m.content),
      accessCount: m.accessCount || 0,
      lastAccessedAt: m.lastAccessedAt,
    }));

  // Cluster summary by Category & Top Entities
  const catGroups = new Map<MemoryCategory, MemoryEntry[]>();
  for (const m of memories) {
    const arr = catGroups.get(m.category) || [];
    arr.push(m);
    catGroups.set(m.category, arr);
  }
  const importantClusters: MemoryIntelligenceReport['importantClusters'] = [];
  for (const [cat, list] of catGroups.entries()) {
    const avgImp = list.reduce((s, x) => s + (x.importance || 3), 0) / list.length;
    importantClusters.push({
      name: `${cat[0].toUpperCase()}${cat.slice(1)} Knowledge`,
      kind: cat,
      count: list.length,
      avgImportance: parseFloat(avgImp.toFixed(2)),
      memberIds: list.map((x) => x.id),
    });
  }
  importantClusters.sort((a, b) => b.avgImportance * b.count - a.avgImportance * a.count);

  return {
    highlyConnected,
    isolated,
    similarDuplicates,
    contradictions,
    recentlyUpdated,
    frequentlyRetrieved,
    importantClusters,
    missingRelationships,
  };
}
