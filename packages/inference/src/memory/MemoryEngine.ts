import crypto from 'node:crypto';
import {
  LOFTYDB_CONVERSATIONS_COLLECTION,
  LOFTYDB_ENTITIES_COLLECTION,
  LOFTYDB_MEMORY_COLLECTION,
  LOFTYDB_METRICS_COLLECTION,
  LOFTYDB_RELATIONSHIPS_COLLECTION,
  type ChatMessage,
  type KnowledgeGraphPayload,
  type KnowledgeNodeKind,
  type LoftyDbDiffResult,
  type LoftyDbDocument,
  type LoftyDbHistoryEntry,
  type MemoryCategory,
  type MemoryEntity,
  type MemoryEntry,
  type MemoryRecallResult,
  type MemoryRelationship,
  type MemoryRelationshipType,
  type MemoryScope,
  type StoredConversation,
} from '@local-ai/shared';
import { LoftyDbClient } from '../loftydb/LoftyDbClient.js';
import { extractMessageText } from '../service.js';
import {
  buildRelationshipId,
  computeIntelligenceReport,
  cosineSimilarityVectors,
  deriveMemoryTitle,
  detectMemoryConflict,
  extractEntitiesFromMemory,
} from './graphIntelligence.js';

export interface SaveMemoryInput {
  id?: string;
  title?: string;
  content: string;
  category?: MemoryCategory;
  scope?: MemoryScope;
  personaId?: string;
  conversationId?: string;
  importance?: number;
  confidence?: number;
  pinned?: boolean;
  tags?: string[];
  source?: 'auto' | 'manual' | 'chat';
  skipGraphExtraction?: boolean;
}

export interface MemoryFilter {
  scope?: 'all' | MemoryScope;
  personaId?: string;
  conversationId?: string;
  category?: MemoryCategory;
  minImportance?: number;
  pinnedOnly?: boolean;
}

export interface RecallOptions {
  query: string;
  limit?: number;
  minSimilarity?: number;
  scope?: 'all' | MemoryScope;
  personaId?: string;
  conversationId?: string;
}

export interface MemoryEngineOptions {
  autoRecallEnabled?: boolean;
  autoExtractEnabled?: boolean;
  defaultRecallLimit?: number;
  defaultMinSimilarity?: number;
}

interface ExtractedMemoryCandidate {
  content: string;
  category: MemoryCategory;
  scope: MemoryScope;
  importance: number;
  pinned: boolean;
  tags: string[];
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function tokenizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function computeLexicalOverlap(query: string, target: string): number {
  const qTokens = tokenizeWords(query);
  if (qTokens.length === 0) return 0;
  const targetLower = target.toLowerCase();
  let hits = 0;
  for (const token of qTokens) {
    if (targetLower.includes(token)) hits++;
  }
  return hits / qTokens.length;
}

function buildSearchText(fields: {
  content: string;
  category?: string;
  tags?: string[];
}): string {
  const tagsPart = Array.isArray(fields.tags) && fields.tags.length > 0 ? fields.tags.join(' ') : '';
  return [fields.category || '', tagsPart, fields.content].filter(Boolean).join(' ').trim();
}

function buildConversationSearchText(conv: StoredConversation): string {
  const snippet = (conv.messages || [])
    .slice(-12)
    .map(extractMessageText)
    .join(' ')
    .slice(0, 2000);
  return `${conv.title || ''} ${conv.summary || ''} ${snippet}`.trim();
}

function docToMemoryEntry(doc: LoftyDbDocument): MemoryEntry {
  const content = String(doc.content || '');
  const vec = Array.isArray(doc._vector) ? doc._vector : undefined;
  return {
    id: String(doc._id),
    title: typeof doc.title === 'string' && doc.title.trim() ? doc.title.trim() : deriveMemoryTitle(content),
    content,
    category: (doc.category as MemoryCategory) || 'fact',
    scope: (doc.scope as MemoryScope) || 'global',
    personaId: typeof doc.personaId === 'string' && doc.personaId ? doc.personaId : undefined,
    conversationId:
      typeof doc.conversationId === 'string' && doc.conversationId ? doc.conversationId : undefined,
    importance: typeof doc.importance === 'number' ? doc.importance : 3,
    confidence: typeof doc.confidence === 'number' ? doc.confidence : doc.source === 'auto' ? 0.85 : 1.0,
    pinned: Boolean(doc.pinned),
    tags: Array.isArray(doc.tags) ? doc.tags.map(String) : [],
    source: (doc.source as 'auto' | 'manual' | 'chat') || 'manual',
    embeddingModel: typeof doc.embeddingModel === 'string' ? doc.embeddingModel : 'LoftyDB-Semantic-Hash',
    vectorDim: vec ? vec.length : typeof doc.vectorDim === 'number' ? doc.vectorDim : 128,
    createdAt: typeof doc.createdAt === 'number' ? doc.createdAt : Date.now(),
    updatedAt: typeof doc.updatedAt === 'number' ? doc.updatedAt : Date.now(),
    version: typeof doc._version === 'number' ? doc._version : undefined,
    updatedAtNs: typeof doc.updatedAtNs === 'string' ? doc.updatedAtNs : undefined,
    similarity: typeof doc._similarity === 'number' ? doc._similarity : undefined,
  };
}

function docToEntity(doc: LoftyDbDocument): MemoryEntity {
  const vec = Array.isArray(doc._vector) ? doc._vector : undefined;
  return {
    id: String(doc._id),
    name: String(doc.name || doc._id),
    entityType: (doc.entityType as MemoryEntity['entityType']) || 'concept',
    description: typeof doc.description === 'string' ? doc.description : undefined,
    aliases: Array.isArray(doc.aliases) ? doc.aliases.map(String) : [],
    tags: Array.isArray(doc.tags) ? doc.tags.map(String) : [],
    mentionCount: typeof doc.mentionCount === 'number' ? doc.mentionCount : 1,
    importance: typeof doc.importance === 'number' ? doc.importance : 3,
    embeddingModel: typeof doc.embeddingModel === 'string' ? doc.embeddingModel : 'LoftyDB-Semantic-Hash',
    vectorDim: vec ? vec.length : 128,
    createdAt: typeof doc.createdAt === 'number' ? doc.createdAt : Date.now(),
    updatedAt: typeof doc.updatedAt === 'number' ? doc.updatedAt : Date.now(),
    version: typeof doc._version === 'number' ? doc._version : undefined,
  };
}

function docToRelationship(doc: LoftyDbDocument): MemoryRelationship {
  return {
    id: String(doc._id),
    sourceId: String(doc.sourceId || ''),
    targetId: String(doc.targetId || ''),
    sourceKind: (doc.sourceKind as KnowledgeNodeKind) || 'memory',
    targetKind: (doc.targetKind as KnowledgeNodeKind) || 'memory',
    type: (doc.type as MemoryRelationshipType) || 'RELATED_TO',
    strength: typeof doc.strength === 'number' ? doc.strength : 0.75,
    confidence: typeof doc.confidence === 'number' ? doc.confidence : 0.85,
    directed: doc.directed !== false,
    autoGenerated: Boolean(doc.autoGenerated),
    metadata: typeof doc.metadata === 'object' && doc.metadata !== null ? (doc.metadata as Record<string, unknown>) : undefined,
    createdAt: typeof doc.createdAt === 'number' ? doc.createdAt : Date.now(),
    updatedAt: typeof doc.updatedAt === 'number' ? doc.updatedAt : Date.now(),
    version: typeof doc._version === 'number' ? doc._version : undefined,
  };
}

function docToConversation(doc: LoftyDbDocument): StoredConversation {
  return {
    id: String(doc._id),
    title: String(doc.title || 'New Chat'),
    modelId: String(doc.modelId || ''),
    modelName: String(doc.modelName || ''),
    isAdapter: Boolean(doc.isAdapter),
    adapterPath: typeof doc.adapterPath === 'string' ? doc.adapterPath : undefined,
    messages: Array.isArray(doc.messages) ? (doc.messages as ChatMessage[]) : [],
    createdAt: typeof doc.createdAt === 'number' ? doc.createdAt : Date.now(),
    updatedAt: typeof doc.updatedAt === 'number' ? doc.updatedAt : Date.now(),
    lastStats: doc.lastStats as StoredConversation['lastStats'],
    personaId: typeof doc.personaId === 'string' ? doc.personaId : undefined,
    summary: typeof doc.summary === 'string' ? doc.summary : undefined,
    version: typeof doc._version === 'number' ? doc._version : undefined,
  };
}

function matchesScope(
  entry: MemoryEntry,
  scope: 'all' | MemoryScope | undefined,
  personaId?: string,
  conversationId?: string
): boolean {
  if (!scope || scope === 'all') {
    if (entry.scope === 'global') return true;
    if (entry.scope === 'persona') return !personaId || entry.personaId === personaId;
    if (entry.scope === 'conversation') return !conversationId || entry.conversationId === conversationId;
    return true;
  }
  if (scope === 'global') {
    return entry.scope === 'global';
  }
  if (scope === 'persona') {
    return entry.scope === 'global' || (entry.scope === 'persona' && (!personaId || entry.personaId === personaId));
  }
  return (
    entry.scope === 'global' ||
    (entry.scope === 'persona' && (!personaId || entry.personaId === personaId)) ||
    (entry.scope === 'conversation' && (!conversationId || entry.conversationId === conversationId))
  );
}

/**
 * Zaylo's Long-Term Memory & Persistent Chat Engine backed directly by LoftyDB.
 * Stores semantic, temporally-versioned memories in `zaylo_memories` and
 * persistent playground conversations in `zaylo_conversations`.
 */
export class MemoryEngine {
  private autoRecallEnabled: boolean;
  private autoExtractEnabled: boolean;
  private defaultRecallLimit: number;
  private defaultMinSimilarity: number;

  constructor(
    private readonly client: LoftyDbClient,
    options?: MemoryEngineOptions
  ) {
    this.autoRecallEnabled = options?.autoRecallEnabled ?? true;
    this.autoExtractEnabled = options?.autoExtractEnabled ?? true;
    this.defaultRecallLimit = options?.defaultRecallLimit ?? 5;
    this.defaultMinSimilarity = options?.defaultMinSimilarity ?? 0.15;
  }

  public getClient(): LoftyDbClient {
    return this.client;
  }

  public isAutoRecallEnabled(): boolean {
    return this.autoRecallEnabled;
  }

  public isAutoExtractEnabled(): boolean {
    return this.autoExtractEnabled;
  }

  public configure(options: MemoryEngineOptions): void {
    if (options.autoRecallEnabled !== undefined) this.autoRecallEnabled = options.autoRecallEnabled;
    if (options.autoExtractEnabled !== undefined) this.autoExtractEnabled = options.autoExtractEnabled;
    if (options.defaultRecallLimit !== undefined) this.defaultRecallLimit = options.defaultRecallLimit;
    if (options.defaultMinSimilarity !== undefined) this.defaultMinSimilarity = options.defaultMinSimilarity;
  }

  // ==================== LONG-TERM MEMORY OPERATIONS ====================

  public async saveMemory(input: SaveMemoryInput): Promise<MemoryEntry> {
    const now = Date.now();
    const id = input.id || `mem_${crypto.randomBytes(8).toString('hex')}`;
    const existing = input.id
      ? await this.client.getDocument(LOFTYDB_MEMORY_COLLECTION, input.id).catch(() => null)
      : null;

    const category = input.category || (existing?.category as MemoryCategory) || 'fact';
    const scope = input.scope || (existing?.scope as MemoryScope) || 'global';
    const tags = Array.isArray(input.tags)
      ? input.tags.map((t) => t.trim()).filter(Boolean)
      : Array.isArray(existing?.tags)
      ? existing.tags.map(String)
      : [];
    const content = input.content.trim();
    const title = (input.title || (typeof existing?.title === 'string' ? existing.title : '')).trim() || deriveMemoryTitle(content);
    const source = input.source || (existing?.source as any) || 'manual';
    const confidence =
      input.confidence ??
      (typeof existing?.confidence === 'number'
        ? existing.confidence
        : source === 'auto'
        ? 0.85
        : 1.0);

    const docPayload: Record<string, unknown> = {
      _id: id,
      title,
      content,
      _vector_source: 'searchText',
      searchText: buildSearchText({ content, category, tags }),
      category,
      scope,
      personaId: input.personaId ?? existing?.personaId ?? null,
      conversationId: input.conversationId ?? existing?.conversationId ?? null,
      importance: Math.min(5, Math.max(1, input.importance ?? (typeof existing?.importance === 'number' ? existing.importance : 3))),
      confidence,
      pinned: input.pinned ?? Boolean(existing?.pinned),
      tags,
      source,
      embeddingModel: 'LoftyDB-Semantic-Hash',
      createdAt: typeof existing?.createdAt === 'number' ? existing.createdAt : now,
      updatedAt: now,
    };

    const saved = await this.client.upsertDocument(LOFTYDB_MEMORY_COLLECTION, docPayload, id);
    const entry = docToMemoryEntry(saved);

    if (!input.skipGraphExtraction) {
      await this.indexMemoryGraphNodes(entry, Array.isArray(saved._vector) ? saved._vector : undefined).catch(
        () => {}
      );
    }

    return entry;
  }

  public async listMemories(filter?: MemoryFilter): Promise<MemoryEntry[]> {
    const query: Record<string, unknown> = {};
    if (filter?.category) query.category = filter.category;
    if (filter?.pinnedOnly) query.pinned = true;
    if (filter?.minImportance) query.importance = { $gte: filter.minImportance };

    const docs = await this.client.queryDocuments(LOFTYDB_MEMORY_COLLECTION, query);
    return docs
      .map(docToMemoryEntry)
      .filter((m) => matchesScope(m, filter?.scope, filter?.personaId, filter?.conversationId))
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if (a.importance !== b.importance) return b.importance - a.importance;
        return b.updatedAt - a.updatedAt;
      });
  }

  public async deleteMemory(id: string): Promise<boolean> {
    const ok = await this.client.deleteDocument(LOFTYDB_MEMORY_COLLECTION, id);
    if (ok) {
      // Remove orphaned relationships referencing deleted memory node
      const rels = await this.listRelationships().catch(() => []);
      for (const rel of rels) {
        if (rel.sourceId === id || rel.targetId === id) {
          await this.client.deleteDocument(LOFTYDB_RELATIONSHIPS_COLLECTION, rel.id).catch(() => {});
        }
      }
    }
    return ok;
  }

  public async getMemoryHistory(id: string): Promise<LoftyDbHistoryEntry[]> {
    return this.client.getHistory(LOFTYDB_MEMORY_COLLECTION, id);
  }

  public async diffMemoryVersions(id: string, v1: number, v2: number): Promise<LoftyDbDiffResult> {
    return this.client.diffVersions(LOFTYDB_MEMORY_COLLECTION, id, v1, v2);
  }

  public async rollbackMemory(id: string, version: number): Promise<MemoryEntry> {
    const doc = await this.client.rollbackDocument(LOFTYDB_MEMORY_COLLECTION, id, version);
    return docToMemoryEntry(doc);
  }

  public async queryMemoriesAsOf(
    asOfNs: number | string,
    filter: Record<string, unknown> = {}
  ): Promise<MemoryEntry[]> {
    const docs = await this.client.queryDocuments(LOFTYDB_MEMORY_COLLECTION, filter, asOfNs);
    return docs.map(docToMemoryEntry).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Recalls top relevant memories using LoftyDB native vector search + pinned boosts + scope filtering.
   */
  public async recall(options: RecallOptions): Promise<MemoryRecallResult[]> {
    const limit = options.limit ?? this.defaultRecallLimit;
    const minSim = options.minSimilarity ?? this.defaultMinSimilarity;
    const cleanQuery = options.query.trim();
    if (!cleanQuery) return [];

    const [vectorRes, pinnedDocs] = await Promise.all([
      this.client
        .vectorSearch(LOFTYDB_MEMORY_COLLECTION, {
          text: cleanQuery,
          limit: Math.max(limit * 4, 20),
          minSimilarity: 0,
        })
        .catch(() => ({ queryVector: [], documents: [] })),
      this.client
        .queryDocuments(LOFTYDB_MEMORY_COLLECTION, { pinned: true })
        .catch(() => []),
    ]);

    const byId = new Map<string, { entry: MemoryEntry; sim: number; pinnedHit: boolean }>();

    for (const doc of vectorRes.documents) {
      const entry = docToMemoryEntry(doc);
      if (!matchesScope(entry, options.scope, options.personaId, options.conversationId)) continue;
      byId.set(entry.id, {
        entry,
        sim: typeof doc._similarity === 'number' ? doc._similarity : 0,
        pinnedHit: Boolean(entry.pinned),
      });
    }

    for (const doc of pinnedDocs) {
      const entry = docToMemoryEntry(doc);
      if (!matchesScope(entry, options.scope, options.personaId, options.conversationId)) continue;
      const existing = byId.get(entry.id);
      if (existing) {
        existing.pinnedHit = true;
      } else {
        byId.set(entry.id, { entry, sim: 0, pinnedHit: true });
      }
    }

    const results: MemoryRecallResult[] = [];
    for (const item of byId.values()) {
      const lexical = computeLexicalOverlap(cleanQuery, item.entry.content);
      const importanceBoost = (item.entry.importance / 5) * 0.12;
      const pinnedBoost = item.pinnedHit ? 0.25 : 0;
      const combinedScore = item.sim * 0.65 + lexical * 0.25 + importanceBoost + pinnedBoost;

      const passesThreshold =
        item.pinnedHit || item.sim >= minSim || lexical >= 0.25;

      if (!passesThreshold) continue;

      results.push({
        memory: item.entry,
        similarity: parseFloat(item.sim.toFixed(4)),
        score: parseFloat(combinedScore.toFixed(4)),
        matchedBy: item.pinnedHit && item.sim < minSim ? 'pinned' : lexical > 0 ? 'hybrid' : 'vector',
      });
    }

    const finalResults = results.sort((a, b) => b.score - a.score).slice(0, limit);
    if (finalResults.length > 0) {
      void this.recordRecallAccess(finalResults.map((r) => r.memory.id)).catch(() => {});
    }
    return finalResults;
  }

  /**
   * Injects recalled LoftyDB memories cleanly into chat messages without overwriting existing system prompts.
   */
  public augmentMessages(messages: ChatMessage[], recalled: MemoryRecallResult[]): ChatMessage[] {
    if (recalled.length === 0) return messages;

    const memoryLines = recalled.map((r, i) => {
      const m = r.memory;
      const meta = [m.category.toUpperCase(), m.scope];
      if (m.pinned) meta.push('PINNED');
      return `[Memory ${i + 1} (${meta.join(' · ')})]: ${m.content}`;
    });

    const memoryPrompt =
      `You have persistent long-term memory retrieved from LoftyDB. Use these remembered facts and preferences naturally when relevant without inventing details not present here.\n\n` +
      `=== LONG-TERM MEMORY ===\n${memoryLines.join('\n')}\n=== END MEMORY ===`;

    const hasSystemMsg = messages.some((m) => m.role === 'system');
    if (!hasSystemMsg) {
      return [{ role: 'system', content: memoryPrompt }, ...messages];
    }

    return messages.map((m) => {
      if (m.role !== 'system') return m;
      const existing = typeof m.content === 'string' ? m.content : '';
      return {
        ...m,
        content: existing ? `${existing}\n\n${memoryPrompt}` : memoryPrompt,
      };
    });
  }

  /**
   * Deterministically extracts durable user facts, preferences, and instructions from a user turn.
   */
  public extractMemoryCandidates(
    userText: string,
    ctx: { personaId?: string; conversationId?: string } = {}
  ): ExtractedMemoryCandidate[] {
    const trimmed = userText.trim();
    if (!trimmed || trimmed.length < 8 || trimmed.length > 1500) {
      return [];
    }

    const candidates: ExtractedMemoryCandidate[] = [];
    const seen = new Set<string>();

    const pushCandidate = (candidate: ExtractedMemoryCandidate) => {
      const norm = normalizeText(candidate.content);
      if (norm.length < 6 || seen.has(norm)) return;
      seen.add(norm);
      candidates.push(candidate);
    };

    // 1. Explicit "remember that..." / "don't forget..." directives
    const explicitMatch = trimmed.match(
      /^(?:please\s+)?(?:remember(?:\s+that)?|don'?t\s+forget(?:\s+that)?|keep\s+in\s+mind(?:\s+that)?|note\s+that|save\s+(?:this\s+)?to\s+memory:?)\s+(.+)/i
    );
    if (explicitMatch?.[1]) {
      const fact = explicitMatch[1].trim().replace(/[.]+$/, '');
      if (fact.length >= 6 && fact.length <= 400) {
        pushCandidate({
          content: fact,
          category: 'instruction',
          scope: ctx.personaId && ctx.personaId !== 'persona_general' ? 'persona' : 'global',
          importance: 5,
          pinned: true,
          tags: ['explicit'],
        });
        return candidates;
      }
    }

    // 2. Sentence-level pattern scan for user preferences, identity, and project stack
    const sentences = trimmed.split(/(?<=[.!?\n])\s+/);
    for (const sentence of sentences) {
      const s = sentence.trim();
      if (s.length < 10 || s.length > 260) continue;

      if (
        /\b(?:i\s+(?:really\s+)?prefer|my\s+preferred|always\s+(?:use|respond|reply|format|explain)|never\s+(?:use|include)|i\s+like\s+(?:it\s+)?when\s+you)\b/i.test(
          s
        )
      ) {
        pushCandidate({
          content: s,
          category: 'preference',
          scope: 'global',
          importance: 4,
          pinned: false,
          tags: ['preference'],
        });
        continue;
      }

      if (
        /\b(?:my\s+name\s+is|call\s+me|i(?:'m|\s+am)\s+(?:a|an)\s+[a-z]|i\s+work\s+(?:as|at|on|with))\b/i.test(
          s
        )
      ) {
        pushCandidate({
          content: s,
          category: 'fact',
          scope: 'global',
          importance: 4,
          pinned: false,
          tags: ['profile'],
        });
        continue;
      }

      if (
        /\b(?:my\s+project|our\s+(?:project|app|stack|tech\s+stack|database|backend)|i(?:'m|\s+am)\s+(?:building|working\s+on|using))\b/i.test(
          s
        )
      ) {
        pushCandidate({
          content: s,
          category: 'project',
          scope: 'global',
          importance: 4,
          pinned: false,
          tags: ['project'],
        });
      }
    }

    return candidates.slice(0, 3);
  }

  /**
   * Extracts durable memories from a user message and deduplicates/versions them in LoftyDB.
   */
  public async extractAndPersistFromUserMessage(
    userText: string,
    ctx: { personaId?: string; conversationId?: string } = {}
  ): Promise<MemoryEntry[]> {
    const candidates = this.extractMemoryCandidates(userText, ctx);
    if (candidates.length === 0) return [];

    const savedEntries: MemoryEntry[] = [];
    for (const candidate of candidates) {
      // Check if a very similar memory already exists so we create a clean version instead of duplicates
      const existingMatches = await this.client
        .vectorSearch(LOFTYDB_MEMORY_COLLECTION, {
          text: candidate.content,
          limit: 3,
          minSimilarity: 0.78,
        })
        .catch(() => ({ queryVector: [], documents: [] }));

      const normCandidate = normalizeText(candidate.content);
      const matchingDoc = existingMatches.documents.find((doc) => {
        const existingText = normalizeText(String(doc.content || ''));
        return (
          existingText === normCandidate ||
          (typeof doc._similarity === 'number' && doc._similarity >= 0.85 && doc.category === candidate.category)
        );
      });

      const saved = await this.saveMemory({
        id: matchingDoc ? String(matchingDoc._id) : undefined,
        content: candidate.content,
        category: candidate.category,
        scope: candidate.scope,
        personaId: candidate.scope === 'persona' ? ctx.personaId : undefined,
        conversationId: ctx.conversationId,
        importance: candidate.importance,
        pinned: candidate.pinned,
        tags: candidate.tags,
        source: 'auto',
      });
      savedEntries.push(saved);
    }

    return savedEntries;
  }

  /**
   * Scans stored LoftyDB conversations for durable user statements and saves any newly extracted memories.
   */
  public async extractMemoriesFromConversations(conversationId?: string): Promise<{
    scannedConversations: number;
    scannedMessages: number;
    extracted: MemoryEntry[];
  }> {
    const targets: StoredConversation[] = [];
    if (conversationId) {
      const single = await this.getConversation(conversationId);
      if (single) targets.push(single);
    } else {
      const all = await this.listConversations();
      targets.push(...all);
    }

    let scannedMessages = 0;
    const extractedById = new Map<string, MemoryEntry>();

    for (const conv of targets) {
      for (const msg of conv.messages || []) {
        if (msg.role !== 'user') continue;
        const text = extractMessageText(msg);
        if (!text.trim()) continue;
        scannedMessages++;
        const saved = await this.extractAndPersistFromUserMessage(text, {
          personaId: conv.personaId,
          conversationId: conv.id,
        });
        for (const entry of saved) {
          extractedById.set(entry.id, entry);
        }
      }
    }

    return {
      scannedConversations: targets.length,
      scannedMessages,
      extracted: Array.from(extractedById.values()),
    };
  }

  // ==================== CONVERSATION PERSISTENCE ====================

  public async listConversations(): Promise<StoredConversation[]> {
    const docs = await this.client.queryDocuments(LOFTYDB_CONVERSATIONS_COLLECTION, {});
    return docs.map(docToConversation).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public async getConversation(id: string): Promise<StoredConversation | null> {
    const doc = await this.client.getDocument(LOFTYDB_CONVERSATIONS_COLLECTION, id);
    return doc ? docToConversation(doc) : null;
  }

  public async saveConversation(conv: StoredConversation): Promise<StoredConversation> {
    const docPayload: Record<string, unknown> = {
      _id: conv.id,
      title: conv.title || 'New Chat',
      modelId: conv.modelId || '',
      modelName: conv.modelName || '',
      isAdapter: Boolean(conv.isAdapter),
      adapterPath: conv.adapterPath || null,
      personaId: conv.personaId || null,
      messages: conv.messages || [],
      lastStats: conv.lastStats || null,
      summary: conv.summary || null,
      _vector_source: 'searchText',
      searchText: buildConversationSearchText(conv),
      createdAt: conv.createdAt || Date.now(),
      updatedAt: conv.updatedAt || Date.now(),
    };

    const saved = await this.client.upsertDocument(LOFTYDB_CONVERSATIONS_COLLECTION, docPayload, conv.id);
    return docToConversation(saved);
  }

  public async deleteConversation(id: string): Promise<boolean> {
    return this.client.deleteDocument(LOFTYDB_CONVERSATIONS_COLLECTION, id);
  }

  public async searchConversations(query: string, limit: number = 10): Promise<StoredConversation[]> {
    const trimmed = query.trim();
    if (!trimmed) return this.listConversations();

    const vectorRes = await this.client.vectorSearch(LOFTYDB_CONVERSATIONS_COLLECTION, {
      text: trimmed,
      limit,
      minSimilarity: 0.05,
    });
    return vectorRes.documents.map(docToConversation);
  }

  /**
   * Merges local conversations with LoftyDB conversations, preferring the most recently updated
   * snapshot for each conversation ID and persisting unsynced local chats into LoftyDB.
   */
  public async syncConversations(localConvs: StoredConversation[]): Promise<StoredConversation[]> {
    const remoteConvs = await this.listConversations();
    const byId = new Map<string, StoredConversation>();

    for (const rc of remoteConvs) {
      byId.set(rc.id, rc);
    }

    for (const lc of localConvs) {
      const existing = byId.get(lc.id);
      if (!existing || lc.updatedAt > existing.updatedAt) {
        const saved = await this.saveConversation(lc);
        byId.set(saved.id, saved);
      }
    }

    return Array.from(byId.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  // ==================== KNOWLEDGE GRAPH & INTELLIGENCE OPERATIONS ====================

  public async listEntities(): Promise<MemoryEntity[]> {
    const docs = await this.client.queryDocuments(LOFTYDB_ENTITIES_COLLECTION, {}).catch(() => []);
    return docs.map(docToEntity).sort((a, b) => b.mentionCount - a.mentionCount);
  }

  public async listRelationships(): Promise<MemoryRelationship[]> {
    const docs = await this.client.queryDocuments(LOFTYDB_RELATIONSHIPS_COLLECTION, {}).catch(() => []);
    return docs.map(docToRelationship).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public async createRelationship(input: {
    sourceId: string;
    targetId: string;
    sourceKind: KnowledgeNodeKind;
    targetKind: KnowledgeNodeKind;
    type: MemoryRelationshipType;
    strength?: number;
    confidence?: number;
    directed?: boolean;
    autoGenerated?: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<MemoryRelationship> {
    const now = Date.now();
    const directed = input.directed ?? true;
    const [canonicalSource, canonicalTarget] =
      !directed && input.sourceId > input.targetId
        ? [input.targetId, input.sourceId]
        : [input.sourceId, input.targetId];
    const [canonicalSourceKind, canonicalTargetKind] =
      !directed && input.sourceId > input.targetId
        ? [input.targetKind, input.sourceKind]
        : [input.sourceKind, input.targetKind];

    const id = buildRelationshipId(canonicalSource, canonicalTarget, input.type, directed);
    const existing = await this.client
      .getDocument(LOFTYDB_RELATIONSHIPS_COLLECTION, id)
      .catch(() => null);

    const payload: Record<string, unknown> = {
      _id: id,
      sourceId: canonicalSource,
      targetId: canonicalTarget,
      sourceKind: canonicalSourceKind,
      targetKind: canonicalTargetKind,
      type: input.type,
      strength: Math.min(1, Math.max(0.05, input.strength ?? 0.8)),
      confidence: Math.min(1, Math.max(0.05, input.confidence ?? 0.9)),
      directed,
      autoGenerated: Boolean(input.autoGenerated),
      metadata: input.metadata || existing?.metadata || {},
      createdAt: typeof existing?.createdAt === 'number' ? existing.createdAt : now,
      updatedAt: now,
    };

    const saved = await this.client.upsertDocument(LOFTYDB_RELATIONSHIPS_COLLECTION, payload, id);
    return docToRelationship(saved);
  }

  public async deleteRelationship(id: string): Promise<boolean> {
    return this.client.deleteDocument(LOFTYDB_RELATIONSHIPS_COLLECTION, id).catch(() => false);
  }

  /**
   * Indexes extracted entities, source conversation lineage, semantic links, and conflicts
   * into real LoftyDB entity & relationship collections.
   */
  public async indexMemoryGraphNodes(memory: MemoryEntry, memoryVector?: number[]): Promise<void> {
    const now = Date.now();
    const entities = extractEntitiesFromMemory(memory);

    for (const ent of entities) {
      const existingEnt = await this.client
        .getDocument(LOFTYDB_ENTITIES_COLLECTION, ent.id)
        .catch(() => null);
      const prevMentions = typeof existingEnt?.mentionCount === 'number' ? existingEnt.mentionCount : 0;

      await this.client
        .upsertDocument(
          LOFTYDB_ENTITIES_COLLECTION,
          {
            _id: ent.id,
            name: ent.name,
            entityType: ent.entityType,
            description:
              typeof existingEnt?.description === 'string' && existingEnt.description
                ? existingEnt.description
                : `${ent.entityType} entity referenced in LoftyDB memory`,
            _vector_source: 'searchText',
            searchText: `${ent.name} ${ent.entityType} ${ent.aliases.join(' ')}`,
            aliases: ent.aliases,
            tags: [ent.entityType],
            mentionCount: existingEnt ? prevMentions + 1 : 1,
            importance: Math.max(
              typeof existingEnt?.importance === 'number' ? existingEnt.importance : 3,
              Math.min(5, Math.max(3, Math.ceil((prevMentions + 1) / 2) + 2))
            ),
            embeddingModel: 'LoftyDB-Semantic-Hash',
            createdAt: typeof existingEnt?.createdAt === 'number' ? existingEnt.createdAt : now,
            updatedAt: now,
          },
          ent.id
        )
        .catch(() => {});

      await this.createRelationship({
        sourceId: memory.id,
        targetId: ent.id,
        sourceKind: 'memory',
        targetKind: 'entity',
        type: ent.edgeType,
        strength: 0.85,
        confidence: 0.9,
        directed: true,
        autoGenerated: true,
        metadata: { extractedFrom: 'entity_matcher' },
      }).catch(() => {});
    }

    // Source conversation edge (DERIVED_FROM or OCCURRED_DURING for episodic events)
    if (memory.conversationId) {
      const convExists = await this.client
        .getDocument(LOFTYDB_CONVERSATIONS_COLLECTION, memory.conversationId)
        .catch(() => null);
      if (convExists) {
        await this.createRelationship({
          sourceId: memory.id,
          targetId: memory.conversationId,
          sourceKind: 'memory',
          targetKind: 'conversation',
          type: memory.category === 'episode' ? 'OCCURRED_DURING' : 'DERIVED_FROM',
          strength: 0.82,
          confidence: 0.95,
          directed: true,
          autoGenerated: true,
          metadata: { conversationTitle: convExists.title || '' },
        }).catch(() => {});
      }
    }

    // Check existing memories for strong semantic peers & explicit contradictions
    const peerDocs = await this.client.queryDocuments(LOFTYDB_MEMORY_COLLECTION, {}).catch(() => []);
    let semanticCount = 0;
    for (const peerDoc of peerDocs) {
      if (String(peerDoc._id) === memory.id) continue;
      const peer = docToMemoryEntry(peerDoc);
      const conflictReason = detectMemoryConflict(memory, peer);
      if (conflictReason) {
        await this.createRelationship({
          sourceId: memory.id,
          targetId: peer.id,
          sourceKind: 'memory',
          targetKind: 'memory',
          type: 'CONTRADICTS',
          strength: 0.9,
          confidence: 0.85,
          directed: false,
          autoGenerated: true,
          metadata: { reason: conflictReason },
        }).catch(() => {});
        continue;
      }

      if (semanticCount < 3 && memoryVector && Array.isArray(peerDoc._vector)) {
        const sim = cosineSimilarityVectors(memoryVector, peerDoc._vector as number[]);
        if (sim >= 0.56) {
          semanticCount++;
          await this.createRelationship({
            sourceId: memory.id,
            targetId: peer.id,
            sourceKind: 'memory',
            targetKind: 'memory',
            type: 'RELATED_TO',
            strength: parseFloat(sim.toFixed(3)),
            confidence: parseFloat(sim.toFixed(3)),
            directed: false,
            autoGenerated: true,
            metadata: { similarity: parseFloat(sim.toFixed(3)) },
          }).catch(() => {});
        }
      }
    }
  }

  /**
   * Confirmed manual merge of two duplicate or similar memories without dropping provenance edges.
   */
  public async mergeMemories(
    primaryId: string,
    secondaryId: string,
    mergedContent?: string
  ): Promise<MemoryEntry> {
    const primary = await this.client.getDocument(LOFTYDB_MEMORY_COLLECTION, primaryId);
    const secondary = await this.client.getDocument(LOFTYDB_MEMORY_COLLECTION, secondaryId);
    if (!primary || !secondary) {
      throw new Error('Cannot merge: one or both memories do not exist.');
    }

    const pEntry = docToMemoryEntry(primary);
    const sEntry = docToMemoryEntry(secondary);
    const nextContent = (mergedContent?.trim() || pEntry.content).trim();
    const mergedTags = Array.from(new Set([...pEntry.tags, ...sEntry.tags]));

    const updated = await this.saveMemory({
      id: pEntry.id,
      content: nextContent,
      category: pEntry.category,
      scope: pEntry.scope,
      personaId: pEntry.personaId,
      conversationId: pEntry.conversationId || sEntry.conversationId,
      importance: Math.max(pEntry.importance, sEntry.importance),
      pinned: pEntry.pinned || sEntry.pinned,
      tags: mergedTags,
      source: pEntry.source,
    });

    // Rewire secondary relationships onto primary before removing secondary
    const rels = await this.listRelationships().catch(() => []);
    for (const rel of rels) {
      if (rel.sourceId !== secondaryId && rel.targetId !== secondaryId) continue;
      const newSource = rel.sourceId === secondaryId ? primaryId : rel.sourceId;
      const newTarget = rel.targetId === secondaryId ? primaryId : rel.targetId;
      if (newSource !== newTarget) {
        await this.createRelationship({
          sourceId: newSource,
          targetId: newTarget,
          sourceKind: rel.sourceKind,
          targetKind: rel.targetKind,
          type: rel.type,
          strength: rel.strength,
          confidence: rel.confidence,
          directed: rel.directed,
          autoGenerated: rel.autoGenerated,
          metadata: { ...(rel.metadata || {}), mergedFrom: secondaryId },
        }).catch(() => {});
      }
      await this.deleteRelationship(rel.id).catch(() => {});
    }

    await this.client.deleteDocument(LOFTYDB_MEMORY_COLLECTION, secondaryId).catch(() => {});
    return updated;
  }

  private async getRecallTelemetry(): Promise<Record<string, { count: number; lastAccessedAt: number }>> {
    const doc = await this.client
      .getDocument(LOFTYDB_METRICS_COLLECTION, 'recall_stats')
      .catch(() => null);
    if (!doc || typeof doc.counts !== 'object' || doc.counts === null) {
      return {};
    }
    return doc.counts as Record<string, { count: number; lastAccessedAt: number }>;
  }

  private async recordRecallAccess(memoryIds: string[]): Promise<void> {
    if (memoryIds.length === 0) return;
    const now = Date.now();
    const counts = { ...(await this.getRecallTelemetry()) };
    for (const id of memoryIds) {
      const prev = counts[id] || { count: 0, lastAccessedAt: 0 };
      counts[id] = {
        count: prev.count + 1,
        lastAccessedAt: now,
      };
    }
    await this.client.upsertDocument(
      LOFTYDB_METRICS_COLLECTION,
      { _id: 'recall_stats', counts, updatedAt: now },
      'recall_stats'
    );
  }

  public async getKnowledgeGraph(requestedCollection?: string): Promise<KnowledgeGraphPayload> {
    const targetCollection = requestedCollection || LOFTYDB_MEMORY_COLLECTION;
    const allCols = await this.client.listCollections().catch(() => []);
    const collections = allCols.filter((c) => c !== LOFTYDB_METRICS_COLLECTION);
    if (!collections.includes(LOFTYDB_MEMORY_COLLECTION)) {
      collections.unshift(LOFTYDB_MEMORY_COLLECTION);
    }

    const telemetry = await this.getRecallTelemetry().catch(() => ({} as Record<string, { count: number; lastAccessedAt: number }>));
    const vectorsById = new Map<string, number[]>();

    let memories: MemoryEntry[] = [];
    if (targetCollection === LOFTYDB_MEMORY_COLLECTION) {
      const memDocs = await this.client.queryDocuments(LOFTYDB_MEMORY_COLLECTION, {}).catch(() => []);
      memories = memDocs.map((doc) => {
        if (Array.isArray(doc._vector)) {
          vectorsById.set(String(doc._id), doc._vector as number[]);
        }
        const entry = docToMemoryEntry(doc);
        const stat = telemetry[entry.id];
        return {
          ...entry,
          collection: LOFTYDB_MEMORY_COLLECTION,
          accessCount: stat?.count ?? 0,
          lastAccessedAt: stat?.lastAccessedAt,
        };
      });
    } else {
      // Custom collection inspection mapped cleanly into graph nodes
      const rawDocs = await this.client.queryDocuments(targetCollection, {}).catch(() => []);
      memories = rawDocs.map((doc) => {
        if (Array.isArray(doc._vector)) {
          vectorsById.set(String(doc._id), doc._vector as number[]);
        }
        const rawText =
          typeof doc.content === 'string'
            ? doc.content
            : typeof doc.title === 'string'
            ? doc.title
            : typeof doc.name === 'string'
            ? doc.name
            : JSON.stringify(doc).slice(0, 240);
        return {
          id: String(doc._id),
          title:
            typeof doc.title === 'string'
              ? doc.title
              : typeof doc.name === 'string'
              ? doc.name
              : deriveMemoryTitle(rawText),
          content: rawText,
          category: (doc.category as MemoryCategory) || 'context',
          scope: 'global',
          importance: typeof doc.importance === 'number' ? doc.importance : 3,
          confidence: 1,
          pinned: Boolean(doc.pinned),
          tags: Array.isArray(doc.tags) ? doc.tags.map(String) : [targetCollection],
          source: 'manual',
          collection: targetCollection,
          embeddingModel: 'LoftyDB-Semantic-Hash',
          vectorDim: Array.isArray(doc._vector) ? doc._vector.length : 128,
          createdAt: typeof doc.createdAt === 'number' ? doc.createdAt : Date.now(),
          updatedAt: typeof doc.updatedAt === 'number' ? doc.updatedAt : Date.now(),
          version: typeof doc._version === 'number' ? doc._version : 1,
        };
      });
    }

    let entities = targetCollection === LOFTYDB_MEMORY_COLLECTION ? await this.listEntities() : [];
    let relationships = targetCollection === LOFTYDB_MEMORY_COLLECTION ? await this.listRelationships() : [];
    const conversations = await this.listConversations().catch(() => []);

    // One-time lazy backfill for memories created before entities/relationships existed
    if (
      targetCollection === LOFTYDB_MEMORY_COLLECTION &&
      memories.length > 0 &&
      entities.length === 0 &&
      relationships.length === 0
    ) {
      for (const mem of memories) {
        await this.indexMemoryGraphNodes(mem, vectorsById.get(mem.id)).catch(() => {});
      }
      entities = await this.listEntities();
      relationships = await this.listRelationships();
    }

    // Deduplicate reversed undirected auto-edges and clean stale false-positive CONTRADICTS rules
    if (targetCollection === LOFTYDB_MEMORY_COLLECTION && relationships.length > 0) {
      const memById = new Map(memories.map((m) => [m.id, m]));
      const seenUndirected = new Set<string>();
      const cleaned: MemoryRelationship[] = [];
      const staleDeletions: Promise<boolean>[] = [];

      for (const rel of relationships) {
        if (rel.autoGenerated && rel.type === 'CONTRADICTS') {
          const mA = memById.get(rel.sourceId);
          const mB = memById.get(rel.targetId);
          if (!mA || !mB || !detectMemoryConflict(mA, mB)) {
            staleDeletions.push(this.deleteRelationship(rel.id).catch(() => false));
            continue;
          }
        }
        if (!rel.directed) {
          const pairKey =
            rel.sourceId < rel.targetId
              ? `${rel.type}:${rel.sourceId}:${rel.targetId}`
              : `${rel.type}:${rel.targetId}:${rel.sourceId}`;
          if (seenUndirected.has(pairKey)) {
            if (rel.autoGenerated) {
              staleDeletions.push(this.deleteRelationship(rel.id).catch(() => false));
            }
            continue;
          }
          seenUndirected.add(pairKey);
        }
        cleaned.push(rel);
      }
      if (staleDeletions.length > 0) {
        await Promise.all(staleDeletions);
      }
      relationships = cleaned;
    }

    // For custom collections without explicit stored relationships, compute live similarity edges safely
    if (targetCollection !== LOFTYDB_MEMORY_COLLECTION && memories.length > 1) {
      const sample = memories.slice(0, 80);
      for (let i = 0; i < sample.length; i++) {
        const vecA = vectorsById.get(sample[i].id);
        for (let j = i + 1; j < sample.length; j++) {
          const vecB = vectorsById.get(sample[j].id);
          const sim = cosineSimilarityVectors(vecA, vecB);
          if (sim >= 0.5) {
            relationships.push({
              id: buildRelationshipId(sample[i].id, sample[j].id, 'RELATED_TO'),
              sourceId: sample[i].id,
              targetId: sample[j].id,
              sourceKind: 'memory',
              targetKind: 'memory',
              type: 'RELATED_TO',
              strength: parseFloat(sim.toFixed(3)),
              confidence: parseFloat(sim.toFixed(3)),
              directed: false,
              autoGenerated: true,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
          }
        }
      }
    }

    const intelligence = computeIntelligenceReport({
      memories,
      entities,
      relationships,
      vectorsById,
    });

    return {
      collection: targetCollection,
      collections,
      memories,
      entities,
      relationships,
      conversations,
      intelligence,
    };
  }
}
