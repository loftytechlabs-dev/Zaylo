import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import { ZayloClient } from './zayloClient';
import { ServerHealth } from './types';

export interface ConnectionState {
  connected: boolean;
  serverUrl: string;
  activeModel: string | null;
  models: string[];
  error?: string;
}

export class ConnectionManager implements vscode.Disposable {
  private client: ZayloClient;
  private isConnected = false;
  private activeModel: string | null = null;
  private availableModels: string[] = [];
  private pollTimer: NodeJS.Timeout | null = null;
  private serverUrl: string;
  private apiKey: string;
  private hasNotifiedConnection = false;
  private isUserDisconnected = false;

  private _onDidChangeConnection = new vscode.EventEmitter<ConnectionState>();
  public readonly onDidChangeConnection: vscode.Event<ConnectionState> =
    this._onDidChangeConnection.event;

  constructor() {
    const config = vscode.workspace.getConfiguration('zaylo');
    this.serverUrl = config.get<string>('serverUrl', 'http://127.0.0.1:8080');
    this.apiKey = config.get<string>('apiKey', '');

    if (!this.apiKey) {
      this.apiKey = this.autoDiscoverLocalApiKey() || '';
    }

    this.client = new ZayloClient(this.serverUrl, this.apiKey);

    // Watch for VS Code configuration changes
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('zaylo.serverUrl') || e.affectsConfiguration('zaylo.apiKey')) {
        const updatedConfig = vscode.workspace.getConfiguration('zaylo');
        this.serverUrl = updatedConfig.get<string>('serverUrl', 'http://127.0.0.1:8080');
        this.apiKey = updatedConfig.get<string>('apiKey', '');
        if (!this.apiKey) {
          this.apiKey = this.autoDiscoverLocalApiKey() || '';
        }
        this.client.setBaseUrl(this.serverUrl);
        this.client.setApiKey(this.apiKey);
        this.checkConnection(true);
      }
    });

    this.startPolling();
  }

  public getApiKey(): string {
    return this.apiKey;
  }

  public async setApiKey(key: string, persist = true): Promise<void> {
    this.apiKey = key.trim();
    this.client.setApiKey(this.apiKey);
    if (persist) {
      const config = vscode.workspace.getConfiguration('zaylo');
      await config.update('apiKey', this.apiKey, vscode.ConfigurationTarget.Global);
    }
    await this.checkConnection(false);
  }

  public autoDiscoverLocalApiKey(): string | null {
    try {
      const home = os.homedir();
      let dbPath = '';
      if (process.platform === 'darwin') {
        dbPath = path.join(home, 'Library', 'Application Support', 'LocalAIServer', 'local-ai.sqlite');
      } else if (process.platform === 'win32') {
        dbPath = path.join(home, 'AppData', 'Roaming', 'LocalAIServer', 'local-ai.sqlite');
      } else {
        dbPath = path.join(home, '.local-ai-server', 'local-ai.sqlite');
      }

      if (!fs.existsSync(dbPath)) return null;

      const query = "SELECT raw_key FROM api_keys WHERE is_revoked = 0 AND raw_key IS NOT NULL AND raw_key != '' ORDER BY id DESC LIMIT 1;";
      const stdout = cp.execFileSync('sqlite3', [dbPath, query], { encoding: 'utf-8', timeout: 1500 });
      const foundKey = stdout.trim();
      if (foundKey && foundKey.startsWith('lcl_')) {
        return foundKey;
      }
    } catch {
      // Ignored if sqlite3 CLI is absent or error occurs
    }
    return null;
  }

  public getClient(): ZayloClient {
    return this.client;
  }

  public getState(): ConnectionState {
    return {
      connected: this.isConnected,
      serverUrl: this.serverUrl,
      activeModel: this.activeModel,
      models: this.availableModels,
    };
  }

  public async connect(url?: string, apiKey?: string): Promise<boolean> {
    this.isUserDisconnected = false;
    const config = vscode.workspace.getConfiguration('zaylo');
    if (url) {
      this.serverUrl = this.client.normalizeUrl(url);
      this.client.setBaseUrl(this.serverUrl);
      await config.update('serverUrl', this.serverUrl, vscode.ConfigurationTarget.Global);
    }
    if (apiKey !== undefined && apiKey.trim() !== '') {
      this.apiKey = apiKey.trim();
      this.client.setApiKey(this.apiKey);
      await config.update('apiKey', this.apiKey, vscode.ConfigurationTarget.Global);
    } else if (!this.apiKey) {
      const discovered = this.autoDiscoverLocalApiKey();
      if (discovered) {
        this.apiKey = discovered;
        this.client.setApiKey(discovered);
      }
    }

    return await this.checkConnection(true);
  }

  public disconnect(): void {
    this.isUserDisconnected = true;
    this.isConnected = false;
    this.activeModel = null;
    this.hasNotifiedConnection = false;
    this._onDidChangeConnection.fire(this.getState());
    vscode.window.showInformationMessage('Disconnected from Zaylo Local AI server.');
  }

  public async checkConnection(notifyOnFailure = false): Promise<boolean> {
    try {
      if (!this.apiKey) {
        const discovered = this.autoDiscoverLocalApiKey();
        if (discovered) {
          this.apiKey = discovered;
          this.client.setApiKey(discovered);
        }
      }

      const health = await this.client.checkHealth();
      const models = await this.client.getModels();

      const wasConnected = this.isConnected;
      this.isConnected = true;
      this.activeModel = health.activeModel || (models.length > 0 ? models[0] : null);
      this.availableModels = models;

      this._onDidChangeConnection.fire(this.getState());

      if (!wasConnected && !this.hasNotifiedConnection) {
        this.hasNotifiedConnection = true;
        const modelLabel = this.activeModel ? ` (Model: ${this.activeModel})` : '';
        vscode.window.showInformationMessage(`Connected to Zaylo Local AI${modelLabel}`);
      }

      return true;
    } catch (err: any) {
      const wasConnected = this.isConnected;
      this.isConnected = false;
      this.hasNotifiedConnection = false;
      const errMsg = err?.message || 'Server unreachable';

      this._onDidChangeConnection.fire({
        ...this.getState(),
        error: errMsg,
      });

      if (notifyOnFailure) {
        vscode.window.showWarningMessage(
          `Could not connect to Zaylo at ${this.serverUrl}. Make sure Zaylo Server or Desktop is running.`
        );
      }

      return false;
    }
  }

  private startPolling(): void {
    // Initial check
    this.checkConnection(false);

    // Heartbeat & auto-discovery loop
    this.pollTimer = setInterval(async () => {
      if (this.isUserDisconnected) {
        return;
      }

      const config = vscode.workspace.getConfiguration('zaylo');
      const autoConnect = config.get<boolean>('autoConnect', true);

      if (!autoConnect && !this.isConnected) {
        return;
      }

      await this.checkConnection(false);
    }, 5000);
  }

  public dispose(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this._onDidChangeConnection.dispose();
  }
}
