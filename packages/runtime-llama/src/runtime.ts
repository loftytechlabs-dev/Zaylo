import { spawn, ChildProcess, execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import net from 'node:net';
import {
  AppError,
  RuntimeInstance,
  ChatCompletionRequest,
  ChatCompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
} from '@local-ai/shared';
import {
  InferenceRuntime,
  RuntimeCapabilities,
  RuntimeConfig,
  RuntimeHealth,
  ProcessSupervisor,
} from '@local-ai/runtimes';
import { LLAMA_VERSION, LlamaBinaryManager } from './binary.js';

export class LlamaRuntime implements InferenceRuntime {
  public readonly id = 'llama.cpp';
  public readonly name = 'llama.cpp Native Engine';

  private supervisor: ProcessSupervisor;
  private childProcess?: ChildProcess;
  private binaryPath?: string;
  private currentConfig?: RuntimeConfig;
  private startTime?: number;

  constructor(private runtimeDir: string) {
    this.supervisor = new ProcessSupervisor();
  }

  public getSupervisor(): ProcessSupervisor {
    return this.supervisor;
  }

  public async detectCapabilities(): Promise<RuntimeCapabilities> {
    const binary = await new LlamaBinaryManager(this.runtimeDir).findBinary();
    const files = binary ? fs.readdirSync(path.dirname(binary)) : [];
    const backends = ['cpu'];
    for (const backend of ['metal', 'cuda', 'vulkan']) {
      if (files.some((file) => file.toLowerCase().includes(`ggml-${backend}`))) backends.push(backend);
    }

    return {
      supportedFormats: ['gguf'],
      supportedBackends: backends,
      supportsEmbeddings: false,
      supportsStreaming: true,
      version: LLAMA_VERSION,
    };
  }

  public async isInstalled(): Promise<boolean> {
    const binManager = new LlamaBinaryManager(this.runtimeDir);
    const found = await binManager.findBinary();
    return Boolean(found);
  }

  public async install(): Promise<{ success: boolean; path?: string; error?: string }> {
    const binManager = new LlamaBinaryManager(this.runtimeDir);
    const result = await binManager.install();
    if (result.success) this.binaryPath = undefined;
    return result;
  }

  private static helpTextCache: Map<string, string> = new Map();

  private getHelpText(binaryPath: string): string {
    if (LlamaRuntime.helpTextCache.has(binaryPath)) {
      return LlamaRuntime.helpTextCache.get(binaryPath)!;
    }
    try {
      const output = execFileSync(binaryPath, ['-h'], {
        timeout: 2000,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: this.binaryEnvironment(binaryPath),
      });
      LlamaRuntime.helpTextCache.set(binaryPath, output);
      return output;
    } catch (e: any) {
      const stdout = e.stdout ? String(e.stdout) : '';
      const stderr = e.stderr ? String(e.stderr) : '';
      const combined = stdout + stderr;
      LlamaRuntime.helpTextCache.set(binaryPath, combined);
      return combined;
    }
  }

  private isPortAvailable(port: number, host = '127.0.0.1'): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.unref();
      server.on('error', () => {
        resolve(false);
      });
      server.listen({ port, host, exclusive: true }, () => {
        server.close(() => {
          resolve(true);
        });
      });
    });
  }

  private binaryEnvironment(binaryPath: string): NodeJS.ProcessEnv {
    const directory = path.dirname(binaryPath);
    return {
      ...process.env,
      PATH: `${directory}${path.delimiter}${process.env.PATH || ''}`,
      LD_LIBRARY_PATH: [directory, process.env.LD_LIBRARY_PATH].filter(Boolean).join(path.delimiter),
      DYLD_LIBRARY_PATH: [directory, process.env.DYLD_LIBRARY_PATH].filter(Boolean).join(path.delimiter),
      GGML_METAL_PATH_RESOURCES: directory,
    };
  }

  private async prepareCleanPort(preferredPort: number): Promise<number> {
    for (let port = preferredPort; port <= Math.min(65535, preferredPort + 50); port++) {
      if (await this.isPortAvailable(port)) return port;
    }
    throw new AppError('No available port for llama-server', 'RUNTIME_PORT_UNAVAILABLE');
  }

  public async start(config: RuntimeConfig): Promise<RuntimeInstance> {
    if (!this.binaryPath) {
      const binManager = new LlamaBinaryManager(this.runtimeDir);
      const found = await binManager.findBinary();
      if (!found) {
        throw new AppError('llama-server binary is not installed or could not be found.', 'RUNTIME_NOT_FOUND');
      }
      this.binaryPath = found;
    }

    if (this.childProcess) {
      await this.stop();
    }

    config.port = await this.prepareCleanPort(config.port);
    this.currentConfig = config;
    const contextLength = config.lowMemoryMode
      ? Math.min(config.contextSize || 2048, 2048)
      : (config.contextSize || 4096);

    const resolvedModelPath = path.resolve(config.modelPath);
    const args = [
      '-m', resolvedModelPath,
      '-c', String(contextLength),
      '-ngl', String(config.gpuLayers),
      '-t', String(config.threads),
      '--host', '127.0.0.1',
      '--port', String(config.port),
      '--metrics',
    ];

    const helpText = this.binaryPath ? this.getHelpText(this.binaryPath) : '';
    // The pinned server's --embeddings mode disables completions; keep the managed server in chat mode.
    const supportsFa = helpText ? (helpText.includes('-fa') || helpText.includes('--flash-attn')) : true;
    const faTakesValue = helpText ? (/-fa[^\n]*\[on\|off\|auto\]/i.test(helpText) || /--flash-attn[^\n]*\[on\|off\|auto\]/i.test(helpText)) : true;

    if (config.lowMemoryMode) {
      if (supportsFa) {
        if (faTakesValue) {
          args.push('-fa', 'on');
        } else {
          args.push('-fa');
        }
      }
      if (!helpText || helpText.includes('-ctk')) args.push('-ctk', 'q8_0');
      if (!helpText || helpText.includes('-ctv')) args.push('-ctv', 'q8_0');
    } else if (config.flashAttention !== false) {
      if (supportsFa) {
        if (faTakesValue) {
          args.push('-fa', 'on');
        } else {
          args.push('-fa');
        }
      }
    } else if (supportsFa && faTakesValue) {
      args.push('-fa', 'off');
    }

    if (config.mmprojPath && fs.existsSync(config.mmprojPath)) {
      args.push('--mmproj', path.resolve(config.mmprojPath));
    }

    this.supervisor.setState('STARTING');

    return new Promise<RuntimeInstance>((resolve, reject) => {
      let started = false;
      const recentStderr: string[] = [];

      const timeoutTimer = setTimeout(() => {
        if (!started) {
          started = true;
          void this.stop();
          const detail = recentStderr.slice(-5).join(' ');
          const err = new AppError(`llama-server startup timed out after 30 seconds. ${detail}`, 'RUNTIME_TIMEOUT');
          this.supervisor.setState('ERROR');
          reject(err);
        }
      }, 30000);

      try {
        const binDir = path.dirname(this.binaryPath!);
        const child = spawn(this.binaryPath!, args, {
          cwd: binDir,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            ...this.binaryEnvironment(this.binaryPath!),
            LLAMA_ARG_FLASH_ATTN: config.flashAttention === false ? 'off' : 'on',
          },
        });

        this.childProcess = child;
        this.startTime = Date.now();

        const instance: RuntimeInstance = {
          id: config.instanceId,
          runtimeId: this.id,
          pid: child.pid,
          port: config.port,
          state: 'STARTING',
          modelPath: config.modelPath,
          modelName: config.modelName,
          gpuLayersOffloaded: config.gpuLayers,
          loadedAt: Date.now(),
        };

        child.stdout?.on('data', (data: Buffer) => {
          const text = data.toString('utf-8');
          this.supervisor.emit('log', 'DEBUG', `[llama-server stdout] ${text.trim()}`);
        });

        child.stderr?.on('data', (data: Buffer) => {
          const text = data.toString('utf-8');
          recentStderr.push(text.trim());
          if (recentStderr.length > 20) recentStderr.shift();

          this.supervisor.emit('log', 'INFO', `[llama-server] ${text.trim()}`);
        });

        child.on('error', (err) => {
          clearTimeout(timeoutTimer);
          this.supervisor.emit('log', 'ERROR', `Failed to spawn llama-server: ${err.message}`);
          this.supervisor.setState('ERROR');
          if (!started) {
            started = true;
            reject(err);
          }
        });

        child.on('exit', (code, signal) => {
          clearTimeout(timeoutTimer);
          this.childProcess = undefined;
          this.supervisor.handleProcessExit(code, signal);
          if (!started) {
            started = true;
            const errMsg = recentStderr.slice(-5).join(' ') || `llama-server exited with code ${code}`;
            reject(new AppError(`llama-server process failed to start: ${errMsg}`, 'RUNTIME_START_FAILED'));
          }
        });

        // Listening logs precede model loading; only successful health confirms readiness.
        this.pollHealthUntilReady(child, config.port, 60)
          .then((isReady) => {
            if (isReady && !started) {
              started = true;
              clearTimeout(timeoutTimer);
              instance.state = 'RUNNING';
              this.supervisor.setState('RUNNING', instance);
              resolve(instance);
            }
          })
          .catch(() => {});
      } catch (err: any) {
        clearTimeout(timeoutTimer);
        this.supervisor.setState('ERROR');
        reject(err);
      }
    });
  }

  public async stop(): Promise<void> {
    const child = this.childProcess;
    if (!child || child.exitCode !== null || child.signalCode !== null) {
      this.supervisor.setState('STOPPED');
      return;
    }
    this.supervisor.setState('STOPPING');
    await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        if (this.childProcess === child) this.childProcess = undefined;
        this.supervisor.setState('STOPPED');
        resolve();
      };
      const timer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      }, 2000);
      child.once('exit', done);
      child.kill('SIGTERM');
    });
  }

  public async health(): Promise<RuntimeHealth> {
    const isRunning = this.supervisor.getState() === 'RUNNING';
    if (!isRunning || !this.currentConfig) {
      return {
        isHealthy: false,
        state: this.supervisor.getState(),
        modelLoaded: false,
      };
    }

    try {
      const res = await fetch(`http://127.0.0.1:${this.currentConfig.port}/health`);
      const healthData = (await res.json()) as any;
      const metricsRes = await fetch(`http://127.0.0.1:${this.currentConfig.port}/metrics`).catch(() => null);
      const metricsData = metricsRes ? await metricsRes.json().catch(() => null) : null;

      return {
        isHealthy: res.ok && healthData.status === 'ok',
        state: this.supervisor.getState(),
        modelLoaded: res.ok && healthData.status === 'ok',
        vramUsedBytes: metricsData?.vram_used_bytes,
        ramUsedBytes: metricsData?.ram_used_bytes,
        uptimeSeconds: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
      };
    } catch (err: any) {
      return {
        isHealthy: false,
        state: 'DEGRADED',
        modelLoaded: false,
        error: err.message,
      };
    }
  }

  public async *chatStream(
    request: ChatCompletionRequest,
    signal?: AbortSignal
  ): AsyncIterable<ChatCompletionResponse> {
    if (!this.currentConfig || this.supervisor.getState() !== 'RUNNING') {
      throw new AppError('llama-server is not running or ready', 'RUNTIME_NOT_READY');
    }

    const res = await fetch(`http://127.0.0.1:${this.currentConfig.port}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...request, stream: true }),
      signal,
    });

    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => 'Unknown upstream error');
      throw new AppError(`Upstream llama-server error (${res.status}): ${errText}`, 'UPSTREAM_ERROR');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
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
        if (trimmed === 'data: [DONE]') return;
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.substring(6));
            yield data;
          } catch {}
        }
      }
    }
  }

  public async embeddings(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    if (!this.currentConfig || this.supervisor.getState() !== 'RUNNING') {
      throw new AppError('llama-server is not running or ready', 'RUNTIME_NOT_READY');
    }

    throw new AppError('Embeddings are unavailable in the managed llama.cpp chat runtime. The pinned embedding mode disables chat completions.', 'EMBEDDINGS_UNAVAILABLE', 503);
  }

  private async pollHealthUntilReady(child: ChildProcess, port: number, maxAttempts = 60): Promise<boolean> {
    // Initial settling delay so we don't query a closing or premature socket
    await new Promise((r) => setTimeout(r, 400));
    for (let i = 0; i < maxAttempts; i++) {
      if (this.childProcess !== child || child.exitCode !== null || child.signalCode !== null) {
        return false;
      }
      try {
        const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1000) });
        if (res.ok) {
          const data = (await res.json()) as any;
          if (data.status === 'ok') {
            if (this.childProcess !== child || child.exitCode !== null || child.signalCode !== null) {
              return false;
            }
            return true;
          }
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    return false;
  }
}
