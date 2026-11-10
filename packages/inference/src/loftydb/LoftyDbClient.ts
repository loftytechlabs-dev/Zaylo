import type {
  LoftyDbDiffResult,
  LoftyDbDocument,
  LoftyDbHistoryEntry,
  LoftyDbSqlResult,
  LoftyDbStats,
  LoftyDbSubscriptionEvent,
} from '@local-ai/shared';

export interface LoftyDbVectorSearchOptions {
  text?: string;
  vector?: number[];
  limit?: number;
  minSimilarity?: number;
}

export interface LoftyDbVectorSearchResponse<T extends LoftyDbDocument = LoftyDbDocument> {
  queryVector: number[];
  documents: T[];
}

export class LoftyDbError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'LoftyDbError';
  }
}

export function normalizeLoftyDbUrl(url: string): string {
  const trimmed = (url || 'http://127.0.0.1:8090').trim();
  return trimmed.replace(/\/+$/, '');
}

/**
 * Preserves exact 64-bit nanosecond timestamps in JSON payloads where values exceed
 * JS Number.MAX_SAFE_INTEGER by injecting parallel string fields before JSON.parse.
 */
function parseJsonPreservingNanoseconds<T>(rawText: string): T {
  const safeText = rawText
    .replace(/(?<!\\)"timestamp":(\d{16,})([,}])/g, '"timestamp":$1,"timestampNs":"$1"$2')
    .replace(/(?<!\\)"_updated_at":(\d{16,})([,}])/g, '"_updated_at":$1,"updatedAtNs":"$1"$2');
  return JSON.parse(safeText) as T;
}

export class LoftyDbClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://127.0.0.1:8090') {
    this.baseUrl = normalizeLoftyDbUrl(baseUrl);
  }

  public setBaseUrl(baseUrl: string): void {
    this.baseUrl = normalizeLoftyDbUrl(baseUrl);
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  private async requestJson<T>(
    endpointPath: string,
    init?: RequestInit,
    timeoutMs: number = 8000,
    preserveNs: boolean = false
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}${endpointPath}`, {
        ...init,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers || {}),
        },
      });

      const rawText = await res.text();
      let parsed: any = null;
      if (rawText) {
        try {
          parsed = preserveNs
            ? parseJsonPreservingNanoseconds(rawText)
            : JSON.parse(rawText);
        } catch {
          parsed = null;
        }
      }

      if (!res.ok) {
        const errMsg = parsed?.error || `LoftyDB HTTP ${res.status}: ${res.statusText}`;
        throw new LoftyDbError(errMsg, res.status);
      }

      return parsed as T;
    } catch (err: any) {
      if (err instanceof LoftyDbError) {
        throw err;
      }
      if (err?.name === 'AbortError') {
        throw new LoftyDbError(`LoftyDB request timed out (${endpointPath})`);
      }
      throw new LoftyDbError(err?.message || `Failed to reach LoftyDB at ${this.baseUrl}`);
    } finally {
      clearTimeout(timer);
    }
  }

  public async getStats(): Promise<LoftyDbStats> {
    const stats = await this.requestJson<LoftyDbStats>('/api/stats', { method: 'GET' }, 2500);
    if (
      !stats ||
      typeof stats !== 'object' ||
      typeof stats.col_count !== 'number' ||
      typeof stats.tx_count !== 'number'
    ) {
      throw new LoftyDbError(`Endpoint at ${this.baseUrl} did not return a valid LoftyDB stats payload`);
    }
    return stats;
  }

  public async ping(): Promise<boolean> {
    try {
      await this.getStats();
      return true;
    } catch {
      return false;
    }
  }

  public async listCollections(): Promise<string[]> {
    const data = await this.requestJson<{ collections?: string[] }>('/api/collections', { method: 'GET' });
    return Array.isArray(data?.collections) ? data.collections.sort() : [];
  }

  public async deleteCollection(collection: string): Promise<boolean> {
    const res = await this.requestJson<{ success?: boolean }>(
      `/api/collections/${encodeURIComponent(collection)}`,
      { method: 'DELETE' }
    );
    return Boolean(res?.success);
  }

  public async compactCollection(collection: string): Promise<boolean> {
    const res = await this.requestJson<{ success?: boolean }>(
      `/api/collections/${encodeURIComponent(collection)}/compact`,
      { method: 'POST' }
    );
    return Boolean(res?.success);
  }

  public async upsertDocument<T extends LoftyDbDocument = LoftyDbDocument>(
    collection: string,
    doc: Record<string, unknown>,
    id?: string
  ): Promise<T> {
    const query = id ? `?id=${encodeURIComponent(id)}` : '';
    const payload = id && !doc._id ? { ...doc, _id: id } : doc;
    const res = await this.requestJson<{ success: boolean; document: T }>(
      `/api/collections/${encodeURIComponent(collection)}/documents${query}`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      10000,
      true
    );
    return res.document;
  }

  public async getDocument<T extends LoftyDbDocument = LoftyDbDocument>(
    collection: string,
    id: string,
    asOf?: number | string
  ): Promise<T | null> {
    const query = asOf !== undefined && asOf !== '' ? `?asOf=${encodeURIComponent(String(asOf))}` : '';
    try {
      return await this.requestJson<T>(
        `/api/collections/${encodeURIComponent(collection)}/documents/${encodeURIComponent(id)}${query}`,
        { method: 'GET' },
        8000,
        true
      );
    } catch (err: any) {
      if (err instanceof LoftyDbError && err.statusCode === 404) {
        return null;
      }
      throw err;
    }
  }

  public async deleteDocument(collection: string, id: string): Promise<boolean> {
    try {
      const res = await this.requestJson<{ success?: boolean }>(
        `/api/collections/${encodeURIComponent(collection)}/documents/${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      );
      return Boolean(res?.success);
    } catch (err: any) {
      if (err instanceof LoftyDbError && err.statusCode === 404) {
        return false;
      }
      throw err;
    }
  }

  public async queryDocuments<T extends LoftyDbDocument = LoftyDbDocument>(
    collection: string,
    filter: Record<string, unknown> = {},
    asOf?: number | string
  ): Promise<T[]> {
    const query = asOf !== undefined && asOf !== '' ? `?asOf=${encodeURIComponent(String(asOf))}` : '';
    const res = await this.requestJson<{ documents?: T[] }>(
      `/api/collections/${encodeURIComponent(collection)}/query${query}`,
      {
        method: 'POST',
        body: JSON.stringify(filter),
      },
      10000,
      true
    );
    return Array.isArray(res?.documents) ? res.documents : [];
  }

  public async vectorSearch<T extends LoftyDbDocument = LoftyDbDocument>(
    collection: string,
    options: LoftyDbVectorSearchOptions
  ): Promise<LoftyDbVectorSearchResponse<T>> {
    const payload: Record<string, unknown> = {
      limit: options.limit ?? 10,
      min_similarity: options.minSimilarity ?? 0,
    };
    if (options.text !== undefined) {
      payload.text = options.text;
    }
    if (options.vector !== undefined) {
      payload.vector = options.vector;
    }

    const res = await this.requestJson<{ query_vector?: number[]; documents?: T[] }>(
      `/api/collections/${encodeURIComponent(collection)}/vector-search`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      10000,
      true
    );

    return {
      queryVector: Array.isArray(res?.query_vector) ? res.query_vector : [],
      documents: Array.isArray(res?.documents) ? res.documents : [],
    };
  }

  public async executeSql(query: string, asOf?: number | string): Promise<LoftyDbSqlResult> {
    const cleanQuery = query.trim().replace(/;+\s*$/, '');
    const qs = asOf !== undefined && asOf !== '' ? `?asOf=${encodeURIComponent(String(asOf))}` : '';
    return this.requestJson<LoftyDbSqlResult>(
      `/api/sql${qs}`,
      {
        method: 'POST',
        body: JSON.stringify({ query: cleanQuery }),
      },
      10000,
      true
    );
  }

  public async getHistory(collection: string, id: string): Promise<LoftyDbHistoryEntry[]> {
    try {
      const res = await this.requestJson<{ history?: LoftyDbHistoryEntry[] }>(
        `/api/collections/${encodeURIComponent(collection)}/history/${encodeURIComponent(id)}`,
        { method: 'GET' },
        8000,
        true
      );
      return Array.isArray(res?.history) ? res.history : [];
    } catch (err: any) {
      if (err instanceof LoftyDbError && err.statusCode === 404) {
        return [];
      }
      throw err;
    }
  }

  public async diffVersions(
    collection: string,
    id: string,
    v1: number,
    v2: number
  ): Promise<LoftyDbDiffResult> {
    return this.requestJson<LoftyDbDiffResult>(
      `/api/collections/${encodeURIComponent(collection)}/diff/${encodeURIComponent(id)}?v1=${encodeURIComponent(String(v1))}&v2=${encodeURIComponent(String(v2))}`,
      { method: 'GET' }
    );
  }

  public async rollbackDocument<T extends LoftyDbDocument = LoftyDbDocument>(
    collection: string,
    id: string,
    version: number
  ): Promise<T> {
    const res = await this.requestJson<{ success: boolean; document: T }>(
      `/api/collections/${encodeURIComponent(collection)}/rollback/${encodeURIComponent(id)}`,
      {
        method: 'POST',
        body: JSON.stringify({ version }),
      },
      10000,
      true
    );
    return res.document;
  }

  /**
   * Opens a reactive SSE subscription stream to a LoftyDB collection with an optional JSON filter.
   * Returns an unsubscribe function that aborts the underlying HTTP stream.
   */
  public subscribe(
    collection: string,
    filter: Record<string, unknown>,
    onEvent: (event: LoftyDbSubscriptionEvent) => void
  ): () => void {
    const ac = new AbortController();
    const filterParam = encodeURIComponent(JSON.stringify(filter || {}));
    const url = `${this.baseUrl}/api/collections/${encodeURIComponent(collection)}/subscribe?query=${filterParam}`;

    void (async () => {
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: { Accept: 'text/event-stream' },
          signal: ac.signal,
        });

        if (!res.ok || !res.body) {
          onEvent({
            collection,
            type: 'error',
            timestamp: Date.now(),
            message: `Subscription HTTP error: ${res.status} ${res.statusText}`,
          });
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!ac.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

          let boundary = buffer.indexOf('\n\n');
          while (boundary !== -1) {
            const rawFrame = buffer.slice(0, boundary).trim();
            buffer = buffer.slice(boundary + 2);
            boundary = buffer.indexOf('\n\n');

            if (!rawFrame) continue;
            this.dispatchSseFrame(collection, rawFrame, onEvent);
          }
        }
      } catch (err: any) {
        if (!ac.signal.aborted) {
          onEvent({
            collection,
            type: 'error',
            timestamp: Date.now(),
            message: err?.message || 'LoftyDB subscription disconnected',
          });
        }
      }
    })();

    return () => {
      ac.abort();
    };
  }

  private dispatchSseFrame(
    collection: string,
    rawFrame: string,
    onEvent: (event: LoftyDbSubscriptionEvent) => void
  ): void {
    let eventName = 'message';
    const dataLines: string[] = [];

    for (const line of rawFrame.split('\n')) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim());
      }
    }

    if (eventName === 'heartbeat') {
      return;
    }

    const rawData = dataLines.join('\n');
    let parsed: any = {};
    if (rawData) {
      try {
        parsed = JSON.parse(rawData);
      } catch {
        parsed = {};
      }
    }

    if (eventName === 'connected') {
      onEvent({
        collection,
        type: 'connected',
        subscription_id: parsed?.subscription_id,
        timestamp: Date.now(),
      });
      return;
    }

    if (eventName === 'insert' || eventName === 'update' || eventName === 'delete') {
      onEvent({
        collection,
        type: eventName,
        doc_id: parsed?.doc_id,
        document: parsed?.document,
        timestamp: parsed?.timestamp || Date.now(),
      });
    }
  }
}
