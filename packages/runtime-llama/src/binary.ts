import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import { AppError } from '@local-ai/shared';

export const LLAMA_VERSION = 'b5200';

type Backend = 'cpu' | 'metal' | 'cuda' | 'vulkan';

export function selectLlamaAssets(platform: string, arch: string, backend: Backend): string[] {
  if (platform === 'darwin' && (arch === 'arm64' || arch === 'x64') && (backend === 'cpu' || backend === 'metal')) {
    return [`llama-${LLAMA_VERSION}-bin-macos-${arch}.zip`];
  }
  if (platform === 'linux' && (arch === 'arm64' || arch === 'x64')) {
    if (backend === 'metal') throw new AppError('Metal is supported only on macOS.');
    if (backend === 'cuda') throw new AppError(`llama.cpp ${LLAMA_VERSION} has no Linux CUDA archive. Install a CUDA-enabled llama-server manually.`);
    if (backend === 'vulkan' && arch !== 'x64') throw new AppError(`llama.cpp ${LLAMA_VERSION} has no Linux ARM64 Vulkan archive.`);
    return [`llama-${LLAMA_VERSION}-bin-ubuntu-${backend === 'vulkan' ? 'vulkan-' : ''}${arch}.zip`];
  }
  if (platform === 'win32' && arch === 'arm64' && backend === 'cpu') return [`llama-${LLAMA_VERSION}-bin-win-msvc-arm64.zip`];
  if (platform === 'win32' && arch === 'x64' && backend !== 'metal') {
    if (backend === 'cuda') return [`llama-${LLAMA_VERSION}-bin-win-cuda-cu12.4-x64.zip`, 'cudart-llama-bin-win-cu12.4-x64.zip'];
    return [`llama-${LLAMA_VERSION}-bin-win-${backend === 'vulkan' ? 'vulkan' : 'noavx'}-x64.zip`];
  }
  throw new AppError(`No compatible llama.cpp ${LLAMA_VERSION} archive for ${platform} ${arch} (${backend}). Install llama-server manually.`);
}

export class LlamaBinaryManager {
  constructor(private runtimeDir: string) {
    fs.mkdirSync(this.runtimeDir, { recursive: true });
  }

  public getCustomBinaryPath(): string {
    return path.join(this.runtimeDir, 'llama', process.platform === 'win32' ? 'llama-server.exe' : 'llama-server');
  }

  private findExtractedBinary(directory: string): string | null {
    if (!fs.existsSync(directory)) return null;
    const name = process.platform === 'win32' ? 'llama-server.exe' : 'llama-server';
    const direct = path.join(directory, name);
    if (fs.existsSync(direct)) return direct;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const found = this.findExtractedBinary(path.join(directory, entry.name));
        if (found) return found;
      }
    }
    return null;
  }

  public async findBinary(): Promise<string | null> {
    const bundled = this.findExtractedBinary(path.join(this.runtimeDir, 'llama', LLAMA_VERSION))
      ?? this.findExtractedBinary(path.join(this.runtimeDir, 'llama'));
    if (bundled) return fs.realpathSync(bundled);
    const candidates = ['llama-server', '/opt/homebrew/bin/llama-server', '/usr/local/bin/llama-server', '/usr/bin/llama-server', path.join(os.homedir(), '.local', 'bin', 'llama-server')];
    for (const candidate of candidates) {
      if (path.isAbsolute(candidate) && fs.existsSync(candidate)) return fs.realpathSync(candidate);
      try {
        const found = execFileSync(process.platform === 'win32' ? 'where' : 'which', [candidate], { encoding: 'utf-8', timeout: 1000 }).trim().split(/\r?\n/)[0];
        if (found && fs.existsSync(found)) return fs.realpathSync(found);
      } catch {}
    }
    return null;
  }

  public async install(): Promise<{ success: boolean; path?: string; error?: string }> {
    const destDir = path.join(this.runtimeDir, 'llama', LLAMA_VERSION);
    fs.mkdirSync(destDir, { recursive: true });
    try {
      let backend: Backend = process.platform === 'darwin' ? 'metal' : 'cpu';
      if (process.platform === 'win32' && process.arch === 'x64') {
        try {
          const driver = execFileSync('nvidia-smi', ['--query-gpu=driver_version', '--format=csv,noheader'], { encoding: 'utf-8', timeout: 3000 });
          if (Number.parseInt(driver, 10) >= 551) backend = 'cuda';
        } catch {}
      }
      if (backend === 'cpu' && process.arch === 'x64') {
        try {
          execFileSync('vulkaninfo', ['--summary'], { stdio: 'ignore', timeout: 3000 });
          backend = 'vulkan';
        } catch {}
      }
      for (const assetName of selectLlamaAssets(process.platform, process.arch, backend)) {
        const response = await fetch(`https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_VERSION}/${assetName}`);
        if (!response.ok) throw new AppError(`Failed to download ${assetName}: HTTP ${response.status}`);
        const zipPath = path.join(destDir, assetName);
        fs.writeFileSync(zipPath, Buffer.from(await response.arrayBuffer()));
        try {
          if (process.platform === 'win32') {
            const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;
            execFileSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath ${literal(zipPath)} -DestinationPath ${literal(destDir)} -Force`]);
          } else {
            execFileSync('unzip', ['-o', zipPath, '-d', destDir]);
          }
        } finally {
          fs.rmSync(zipPath, { force: true });
        }
      }
      const found = this.findExtractedBinary(destDir);
      if (!found) throw new AppError('Installed archive did not contain llama-server');
      const binaryDir = path.dirname(found);
      const copyLibraries = (directory: string) => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
          const file = path.join(directory, entry.name);
          if (entry.isDirectory()) copyLibraries(file);
          else if (/\.(dll|dylib|so(?:\.\d+)*|metallib)$/i.test(entry.name) && directory !== binaryDir) {
            fs.copyFileSync(file, path.join(binaryDir, entry.name));
          }
        }
      };
      copyLibraries(destDir);
      if (process.platform !== 'win32') fs.chmodSync(found, 0o755);
      return { success: true, path: found };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
