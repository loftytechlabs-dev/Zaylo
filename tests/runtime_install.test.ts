import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { LlamaBinaryManager, selectLlamaAssets } from '@local-ai/runtime-llama';

vi.mock('node:child_process', () => ({ execFileSync: vi.fn(), spawn: vi.fn() }));
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe('runtime installation', () => {
  it('selects compatible architecture and accelerated release assets', () => {
    expect(selectLlamaAssets('linux', 'arm64', 'cpu')).toEqual(['llama-b5200-bin-ubuntu-arm64.zip']);
    expect(selectLlamaAssets('linux', 'x64', 'vulkan')).toEqual(['llama-b5200-bin-ubuntu-vulkan-x64.zip']);
    expect(selectLlamaAssets('win32', 'x64', 'cuda')).toEqual(['llama-b5200-bin-win-cuda-cu12.4-x64.zip', 'cudart-llama-bin-win-cu12.4-x64.zip']);
    expect(selectLlamaAssets('win32', 'arm64', 'cpu')).toEqual(['llama-b5200-bin-win-msvc-arm64.zip']);
    expect(() => selectLlamaAssets('linux', 'x64', 'cuda')).toThrow('no Linux CUDA archive');
    expect(() => selectLlamaAssets('linux', 'arm64', 'vulkan')).toThrow('no Linux ARM64 Vulkan archive');
    expect(() => selectLlamaAssets('linux', 'ia32', 'cpu')).toThrow('No compatible');
  });

  it.skipIf(process.platform === 'win32')('keeps extracted libraries beside the nested executable', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'zaylo-runtime-install-'));
    const nested = path.join(directory, 'llama', 'b5200', 'build', 'bin');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('zip fixture')));
    vi.mocked(execFileSync).mockImplementation((command, args) => {
      if (command === 'unzip') {
        fs.mkdirSync(nested, { recursive: true });
        fs.writeFileSync(path.join(nested, 'llama-server'), 'binary fixture');
        fs.writeFileSync(path.join(directory, 'llama', 'b5200', 'libllama.so'), 'library fixture');
        return '';
      }
      throw new Error('tool unavailable');
    });
    try {
      fs.mkdirSync(path.join(directory, 'llama'), { recursive: true });
      fs.writeFileSync(path.join(directory, 'llama', 'llama-server'), 'old runtime fixture');
      expect(await new LlamaBinaryManager(directory).install()).toEqual({ success: true, path: path.join(nested, 'llama-server') });
      expect(fs.readFileSync(path.join(nested, 'libllama.so'), 'utf8')).toBe('library fixture');
      expect(await new LlamaBinaryManager(directory).findBinary()).toBe(path.join(nested, 'llama-server'));
      expect(fetch).toHaveBeenCalledWith(`https://github.com/ggml-org/llama.cpp/releases/download/b5200/${selectLlamaAssets(process.platform, process.arch, process.platform === 'darwin' ? 'metal' : 'cpu')[0]}`);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });

  it.skipIf(process.platform === 'win32')('resolves a server symlink so adjacent shared libraries are found', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'zaylo-runtime-link-'));
    try {
      const nested = path.join(directory, 'llama', 'build', 'bin');
      fs.mkdirSync(nested, { recursive: true });
      const binary = path.join(nested, 'llama-server');
      fs.writeFileSync(binary, 'fixture');
      fs.symlinkSync(binary, path.join(directory, 'llama', 'llama-server'));
      expect(await new LlamaBinaryManager(directory).findBinary()).toBe(binary);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });

  it('discovers a server in the upstream build/bin archive layout', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'zaylo-runtime-'));
    try {
      const nested = path.join(directory, 'llama', 'build', 'bin'); fs.mkdirSync(nested, { recursive: true });
      const binary = path.join(nested, process.platform === 'win32' ? 'llama-server.exe' : 'llama-server'); fs.writeFileSync(binary, 'fixture');
      expect(await new LlamaBinaryManager(directory).findBinary()).toBe(binary);
      expect(execFileSync).not.toHaveBeenCalled();
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });
});
