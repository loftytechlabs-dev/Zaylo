import {
  ServerHealth,
  ServerInfo,
  ModelInfo,
  ChatMessage,
  ChatCompletionChunk,
} from './types';

export class ZayloClient {
  private baseUrl: string;
  private apiKey: string;
  private currentAbortController: AbortController | null = null;

  constructor(baseUrl = 'http://127.0.0.1:8080', apiKey = '') {
    this.baseUrl = this.normalizeUrl(baseUrl);
    this.apiKey = apiKey ? apiKey.trim() : '';
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = this.normalizeUrl(url);
  }

  public normalizeUrl(url: string): string {
    let clean = (url || 'http://127.0.0.1:8080').trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'http://' + clean;
    }
    return clean.replace(/\/v1\/?$/, '').replace(/\/+$/, '');
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public setApiKey(key: string): void {
    this.apiKey = (key || '').trim();
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
      headers['x-api-key'] = this.apiKey;
    }
    return headers;
  }

  public async checkHealth(): Promise<ServerHealth> {
    const response = await fetch(`${this.baseUrl}/health`, {
      method: 'GET',
      headers: this.getHeaders(),
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}: ${response.statusText}`);
    }

    return (await response.json()) as ServerHealth;
  }

  public async getServerInfo(): Promise<ServerInfo> {
    const response = await fetch(`${this.baseUrl}/server`, {
      method: 'GET',
      headers: this.getHeaders(),
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      throw new Error(`Server info request failed: HTTP ${response.status}`);
    }

    return (await response.json()) as ServerInfo;
  }

  public async getModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) {
        return [];
      }

      const json = (await response.json()) as { data?: ModelInfo[] };
      if (Array.isArray(json.data)) {
        return json.data.map((m) => m.id);
      }
      return [];
    } catch {
      return [];
    }
  }

  public stopStream(): void {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
  }

  public async streamChat(params: {
    messages: ChatMessage[];
    model?: string;
    temperature?: number;
    maxTokens?: number;
    onChunk: (delta: string) => void;
    onDone: () => void;
    onError: (error: Error) => void;
  }): Promise<void> {
    this.stopStream();
    this.currentAbortController = new AbortController();

    try {
      const payload: any = {
        model: params.model || 'default',
        messages: params.messages,
        stream: true,
        temperature: params.temperature ?? 0.2,
      };

      if (params.maxTokens) {
        payload.max_tokens = params.maxTokens;
      }

      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
        signal: this.currentAbortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errMsg = `Inference failed (HTTP ${response.status})`;
        try {
          const errObj = JSON.parse(errorText);
          if (errObj.error?.message) {
            errMsg = errObj.error.message;
          }
        } catch {
          if (errorText) errMsg = errorText;
        }
        throw new Error(errMsg);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;

          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6).trim();
            if (dataStr === '[DONE]') {
              params.onDone();
              return;
            }

            try {
              const chunk = JSON.parse(dataStr) as ChatCompletionChunk;
              const contentDelta = chunk.choices?.[0]?.delta?.content;
              if (contentDelta) {
                params.onChunk(contentDelta);
              }
            } catch {
              // Ignore non-json or incomplete SSE frames
            }
          }
        }
      }

      params.onDone();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        params.onDone();
        return;
      }
      params.onError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      this.currentAbortController = null;
    }
  }
}
