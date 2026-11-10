import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import childProcess, { type ChildProcess } from 'node:child_process';
import {
  DEFAULT_LOFTYDB_HOST,
  DEFAULT_LOFTYDB_PORT,
  getDefaultLoftyDbDir,
  type LoftyDbConfig,
  type LoftyDbStatus,
} from '@local-ai/shared';
import { LoftyDbClient, normalizeLoftyDbUrl } from './LoftyDbClient.js';

export interface LoftyDbBinaryInfo {
  found: boolean;
  path?: string;
  isJsCli?: boolean;
}

export function getDefaultLoftyDbConfig(): LoftyDbConfig {
  return {
    enabled: true,
    autoStart: true,
    mode: 'managed',
    port: DEFAULT_LOFTYDB_PORT,
    baseUrl: `http://${DEFAULT_LOFTYDB_HOST}:${DEFAULT_LOFTYDB_PORT}`,
    dataDir: getDefaultLoftyDbDir(),
    memoryEnabled: true,
    autoExtractMemories: true,
    recallLimit: 5,
    minSimilarity: 0.15,
  };
}

export function getPlatformBinaryFilenames(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch
): string[] {
  if (platform === 'darwin') {
    return arch === 'arm64'
      ? ['loftyDB-darwin-arm64', 'loftyDB-darwin-amd64']
      : ['loftyDB-darwin-amd64'];
  }
  if (platform === 'win32') {
    return arch === 'arm64'
      ? ['loftyDB-windows-arm64.exe', 'loftyDB-windows-amd64.exe']
      : ['loftyDB-windows-amd64.exe'];
  }
  if (platform === 'linux') {
    return arch === 'arm64'
      ? ['loftyDB-linux-arm64']
      : ['loftyDB-linux-amd64'];
  }
  return [];
}

function getBundledLoftyDbDirs(): string[] {
  const dirs: string[] = [];
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  if (resourcesPath) {
    dirs.push(path.join(resourcesPath, 'loftydb'));
    dirs.push(path.join(resourcesPath, 'app.asar.unpacked', 'resources', 'loftydb'));
  }

  try {
    const urlMod = (globalThis as any).process?.getBuiltinModule?.('node:url');
    if (urlMod?.fileURLToPath) {
      const moduleDir = path.dirname(urlMod.fileURLToPath(import.meta.url));
      dirs.push(path.resolve(moduleDir, '../../../../apps/desktop/resources/loftydb'));
      dirs.push(path.resolve(moduleDir, '../../../apps/desktop/resources/loftydb'));
      dirs.push(path.resolve(moduleDir, '../../../resources/loftydb'));
      dirs.push(path.resolve(moduleDir, '../../resources/loftydb'));
    }
  } catch {
    // Fallback below handles CWD-based discovery
  }

  dirs.push(path.join(process.cwd(), 'apps', 'desktop', 'resources', 'loftydb'));
  dirs.push(path.join(process.cwd(), 'resources', 'loftydb'));
  return Array.from(new Set(dirs));
}

function resolveBinaryFromCliEntry(
  cliPath: string,
  nativeNames: string[] = getPlatformBinaryFilenames()
): LoftyDbBinaryInfo {
  try {
    const resolved = fs.realpathSync(cliPath);
    const binDir = path.dirname(resolved);
    for (const nativeName of nativeNames) {
      const nativeCandidate = path.join(binDir, nativeName);
      if (fs.existsSync(nativeCandidate)) {
        return { found: true, path: nativeCandidate, isJsCli: false };
      }
      // On Windows global npm installs, shims (loftydb.cmd / loftydb.ps1) sit next to node_modules/
      const npmShimNative = path.join(binDir, 'node_modules', 'loftydb', 'bin', nativeName);
      if (fs.existsSync(npmShimNative)) {
        return { found: true, path: npmShimNative, isJsCli: false };
      }
    }
    const localBinaryName = process.platform === 'win32' ? 'loftyDB.exe' : 'loftyDB';
    const rootCandidate = path.resolve(binDir, '..', localBinaryName);
    if (fs.existsSync(rootCandidate)) {
      return { found: true, path: rootCandidate, isJsCli: false };
    }
    const npmShimCli = path.join(binDir, 'node_modules', 'loftydb', 'bin', 'cli.js');
    if (fs.existsSync(npmShimCli)) {
      return { found: true, path: npmShimCli, isJsCli: true };
    }
    const lower = resolved.toLowerCase();
    if (lower.endsWith('.cmd') || lower.endsWith('.bat') || lower.endsWith('.ps1')) {
      return { found: false };
    }
    return {
      found: true,
      path: resolved,
      isJsCli: lower.endsWith('.js') || lower.endsWith('.cjs'),
    };
  } catch {
    return { found: false };
  }
}

export function findLoftyDbBinary(customPath?: string): LoftyDbBinaryInfo {
  const candidates: string[] = [];
  const nativeNames = getPlatformBinaryFilenames();

  if (customPath && customPath.trim()) {
    candidates.push(customPath.trim());
  }
  if (process.env.LOFTYDB_BINARY) {
    candidates.push(process.env.LOFTYDB_BINARY);
  }

  // 1. Bundled platform binaries shipped with Zaylo Desktop / workspace resources
  for (const dir of getBundledLoftyDbDirs()) {
    for (const nativeName of nativeNames) {
      candidates.push(path.join(dir, nativeName));
    }
  }

  // 2. Check if loftydb is resolvable in local node_modules or via Node module resolution
  try {
    const nodeMod = (globalThis as any).process?.getBuiltinModule?.('node:module');
    const req = nodeMod?.createRequire?.(import.meta.url);
    if (req) {
      const pkgPath = req.resolve('loftydb/package.json');
      const pkgDir = path.dirname(pkgPath);
      for (const nativeName of nativeNames) {
        candidates.push(path.join(pkgDir, 'bin', nativeName));
      }
      candidates.push(path.join(pkgDir, 'bin', 'cli.js'));
    }
  } catch {
    // Optional dependency lookup
  }

  const cwdNodeModulesBin = path.join(process.cwd(), 'node_modules', 'loftydb', 'bin');
  for (const nativeName of nativeNames) {
    candidates.push(path.join(cwdNodeModulesBin, nativeName));
  }
  candidates.push(path.join(cwdNodeModulesBin, 'cli.js'));

  // 3. Check standard global npm / Homebrew / Windows install locations
  const globalDirs = [
    '/usr/local/lib/node_modules/loftydb/bin',
    '/opt/homebrew/lib/node_modules/loftydb/bin',
    '/home/linuxbrew/.linuxbrew/lib/node_modules/loftydb/bin',
    path.join(os.homedir(), '.npm-global', 'lib', 'node_modules', 'loftydb', 'bin'),
    path.join(os.homedir(), '.local', 'lib', 'node_modules', 'loftydb', 'bin'),
  ];
  if (process.env.APPDATA) {
    globalDirs.push(path.join(process.env.APPDATA, 'npm', 'node_modules', 'loftydb', 'bin'));
  }
  if (process.env.LOCALAPPDATA) {
    globalDirs.push(path.join(process.env.LOCALAPPDATA, 'npm', 'node_modules', 'loftydb', 'bin'));
  }
  if (process.env.ProgramFiles) {
    globalDirs.push(path.join(process.env.ProgramFiles, 'nodejs', 'node_modules', 'loftydb', 'bin'));
  }

  for (const dir of globalDirs) {
    for (const nativeName of nativeNames) {
      candidates.push(path.join(dir, nativeName));
    }
    candidates.push(path.join(dir, 'cli.js'));
  }

  // 4. Check PATH executables directly
  const pathCmd = process.platform === 'win32' ? 'where' : 'which';
  try {
    const out = childProcess
      .execFileSync(pathCmd, ['loftydb'], { encoding: 'utf8', timeout: 1500, windowsHide: true })
      .trim();
    for (const line of out.split(/\r?\n/)) {
      const hit = line.trim();
      if (hit) candidates.push(hit);
    }
  } catch {
    // Not on PATH
  }

  for (const candidate of candidates) {
    if (!candidate || !fs.existsSync(candidate)) continue;
    const lower = candidate.toLowerCase();
    if (
      lower.endsWith('.js') ||
      lower.endsWith('.cjs') ||
      lower.endsWith('.cmd') ||
      lower.endsWith('.bat') ||
      lower.endsWith('.ps1') ||
      (process.platform === 'win32' && !lower.endsWith('.exe'))
    ) {
      const resolved = resolveBinaryFromCliEntry(candidate, nativeNames);
      if (resolved.found) return resolved;
      continue;
    }
    const stat = fs.statSync(candidate);
    if (stat.isFile()) {
      return { found: true, path: candidate, isJsCli: false };
    }
  }

  return { found: false };
}

export class LoftyDbProcessManager {
  private child: ChildProcess | null = null;
  private logs: string[] = [];
  private logListeners = new Set<(line: string) => void>();
  private lastError?: string;

  constructor(private readonly client: LoftyDbClient) {}

  public onLog(listener: (line: string) => void): () => void {
    this.logListeners.add(listener);
    return () => {
      this.logListeners.delete(listener);
    };
  }

  private pushLog(line: string): void {
    const clean = line.trim();
    if (!clean) return;
    this.logs.push(clean);
    if (this.logs.length > 200) {
      this.logs.shift();
    }
    for (const listener of this.logListeners) {
      try {
        listener(clean);
      } catch {
        // Ignored
      }
    }
  }

  public resolveTargetUrl(config: LoftyDbConfig): string {
    if (config.mode === 'external') {
      return normalizeLoftyDbUrl(config.baseUrl);
    }
    return `http://${DEFAULT_LOFTYDB_HOST}:${config.port || DEFAULT_LOFTYDB_PORT}`;
  }

  public async getStatus(config: LoftyDbConfig): Promise<LoftyDbStatus> {
    const targetUrl = this.resolveTargetUrl(config);
    this.client.setBaseUrl(targetUrl);
    const binInfo = findLoftyDbBinary(config.binaryPath);

    try {
      const stats = await this.client.getStats();
      this.lastError = undefined;
      return {
        connected: true,
        runningManaged: Boolean(this.child && this.child.exitCode === null),
        managedPid: this.child && this.child.exitCode === null ? this.child.pid : undefined,
        binaryFound: binInfo.found,
        binaryPath: binInfo.path,
        baseUrl: targetUrl,
        port: config.port,
        dataDir: config.dataDir,
        stats,
        logs: [...this.logs],
      };
    } catch (err: any) {
      return {
        connected: false,
        runningManaged: Boolean(this.child && this.child.exitCode === null),
        managedPid: this.child && this.child.exitCode === null ? this.child.pid : undefined,
        binaryFound: binInfo.found,
        binaryPath: binInfo.path,
        baseUrl: targetUrl,
        port: config.port,
        dataDir: config.dataDir,
        error: this.lastError || err?.message,
        logs: [...this.logs],
      };
    }
  }

  public async start(config: LoftyDbConfig): Promise<LoftyDbStatus> {
    const targetUrl = this.resolveTargetUrl(config);
    this.client.setBaseUrl(targetUrl);
    this.lastError = undefined;

    // 1. Check if a healthy LoftyDB server is already listening on targetUrl
    try {
      await this.client.getStats();
      this.pushLog(`[LoftyDB] Connected to active LoftyDB instance at ${targetUrl}`);
      return this.getStatus(config);
    } catch {
      // Not reachable yet
    }

    if (config.mode === 'external') {
      const msg = `No LoftyDB server reachable at ${targetUrl}. Start LoftyDB externally or switch to Managed mode.`;
      this.lastError = msg;
      this.pushLog(`[LoftyDB] ${msg}`);
      return this.getStatus(config);
    }

    // 2. Managed mode: spawn local LoftyDB binary directly
    const binInfo = findLoftyDbBinary(config.binaryPath);
    if (!binInfo.found || !binInfo.path) {
      const msg =
        'LoftyDB binary not found. Install it globally via `npm install -g loftydb` or specify the binary path.';
      this.lastError = msg;
      this.pushLog(`[LoftyDB] ${msg}`);
      return this.getStatus(config);
    }

    // Stop stale managed child if port/dir changed
    if (this.child && this.child.exitCode === null) {
      await this.stop();
    }

    const dataDir = config.dataDir || getDefaultLoftyDbDir();
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    if (process.platform !== 'win32' && !binInfo.isJsCli) {
      try {
        fs.chmodSync(binInfo.path, 0o755);
      } catch {
        // Ignore if read-only
      }
    }

    const args = ['-port', String(config.port || DEFAULT_LOFTYDB_PORT), '-dir', dataDir, 'server'];
    const spawnCmd = binInfo.isJsCli ? process.execPath : binInfo.path;
    const spawnArgs = binInfo.isJsCli ? [binInfo.path, ...args] : args;
    const spawnEnv = binInfo.isJsCli
      ? { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
      : process.env;

    this.pushLog(`[LoftyDB] Launching ${binInfo.path} on port ${config.port} (dir: ${dataDir})`);

    const child = childProcess.spawn(spawnCmd, spawnArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: spawnEnv,
      windowsHide: true,
    });
    this.child = child;

    const handleOutput = (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      for (const line of text.split(/\r?\n/)) {
        if (line.trim()) this.pushLog(line);
      }
    };

    child.stdout?.on('data', handleOutput);
    child.stderr?.on('data', handleOutput);

    child.on('error', (err) => {
      this.lastError = err.message;
      this.pushLog(`[LoftyDB] Process error: ${err.message}`);
    });

    child.on('exit', (code, signal) => {
      this.pushLog(`[LoftyDB] Process exited (code=${code ?? 'null'}, signal=${signal ?? 'none'})`);
      if (this.child === child) {
        this.child = null;
      }
    });

    // Wait up to 6s for LoftyDB HTTP server to become healthy
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        this.lastError = `LoftyDB exited prematurely with code ${child.exitCode}`;
        break;
      }
      if (await this.client.ping()) {
        this.pushLog(`[LoftyDB] Engine ready at ${targetUrl}`);
        break;
      }
      await new Promise((r) => setTimeout(r, 150));
    }

    return this.getStatus(config);
  }

  public async stop(): Promise<void> {
    const child = this.child;
    if (!child || child.exitCode !== null) {
      this.child = null;
      return;
    }

    this.pushLog(`[LoftyDB] Stopping managed LoftyDB process (PID ${child.pid})...`);

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(killTimer);
        resolve();
      };

      child.once('exit', finish);
      const killTimer = setTimeout(() => {
        try {
          if (process.platform === 'win32' && child.pid) {
            childProcess.execFile(
              'taskkill',
              ['/pid', String(child.pid), '/T', '/F'],
              { windowsHide: true },
              () => finish()
            );
            return;
          }
          child.kill('SIGKILL');
        } catch {
          // Ignored
        }
        finish();
      }, 2500);

      try {
        if (process.platform === 'win32') {
          child.kill();
        } else {
          child.kill('SIGTERM');
        }
      } catch {
        finish();
      }
    });

    if (this.child === child) {
      this.child = null;
    }
  }
}
