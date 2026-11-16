import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PassThrough } from 'node:stream';
import path from 'node:path';
import { ChildProcess, execFileSync, spawn } from 'node:child_process';
import { LlamaBinaryManager, LlamaRuntime } from '@local-ai/runtime-llama';

vi.mock('node:child_process', async () => ({ ...await vi.importActual<typeof import('node:child_process')>('node:child_process'), execFileSync: vi.fn(), spawn: vi.fn() }));
const ports = vi.hoisted(() => ({ busy: new Set<number>() }));
vi.mock('node:net', () => ({ default: { createServer: () => {
  let onError = () => {};
  return { unref() {}, on(_event: string, callback: () => void) { onError = callback; }, listen(options: { port: number }, callback: () => void) { if (ports.busy.has(options.port)) onError(); else callback(); }, close(callback: () => void) { callback(); } };
} } }));

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); ports.busy.clear(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function setup() {
  const child = new ChildProcess();
  Object.defineProperties(child, { pid: { value: 12345 }, stdout: { value: new PassThrough() }, stderr: { value: new PassThrough() } });
  vi.spyOn(child, 'kill').mockImplementation(() => { child.emit('exit', 0, null); return true; });
  vi.mocked(spawn).mockReturnValue(child);
  vi.mocked(execFileSync).mockReturnValue('--embeddings --pooling --flash-attn [on|off|auto]');
  const binary = path.resolve('/fixtures/llama/build/bin/llama-server');
  vi.spyOn(LlamaBinaryManager.prototype, 'findBinary').mockResolvedValue(binary);
  const runtime = new LlamaRuntime('/tmp/zaylo-runtime-lifecycle');
  const config = { instanceId: 'test', modelPath: '/fixture.gguf', modelName: 'fixture', port: 18081, host: '127.0.0.1', contextSize: 512, gpuLayers: 0, threads: 1, runtimeDir: '/tmp/zaylo-runtime-lifecycle' };
  return { runtime, child, config, binary };
}

describe('runtime lifecycle', () => {
  it('waits for health and keeps chat enabled when the binary advertises embedding mode', async () => {
    const { runtime, child, config, binary } = setup();
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('{"status":"loading model"}', { status: 503 })).mockResolvedValue(new Response('{"status":"ok"}'));
    vi.stubGlobal('fetch', fetcher);
    let resolved = false;
    const pending = runtime.start(config).then((instance) => { resolved = true; return instance; });
    await vi.advanceTimersByTimeAsync(0);
    child.stdout?.emit('data', Buffer.from('HTTP server is listening; model loaded'));
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(400);
    expect(resolved).toBe(false);
    expect(runtime.getSupervisor().getState()).toBe('STARTING');
    await vi.advanceTimersByTimeAsync(500);
    expect((await pending).state).toBe('RUNNING');
    expect(spawn).toHaveBeenCalledWith(binary, expect.not.arrayContaining(['--embeddings']), expect.objectContaining({ env: expect.objectContaining({ LD_LIBRARY_PATH: expect.stringContaining(path.dirname(binary)) }) }));
    await expect(runtime.embeddings({ model: 'fixture', input: 'Hello' })).rejects.toMatchObject({ code: 'EMBEDDINGS_UNAVAILABLE', statusCode: 503 });
    await runtime.stop();
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(execFileSync).not.toHaveBeenCalledWith('pkill', expect.anything(), expect.anything());
    await runtime.stop();
    expect(child.kill).toHaveBeenCalledTimes(1);
  });

  it('uses the upgraded binary after reinstalling in the same runtime instance', async () => {
    const { runtime, config } = setup();
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response('{"status":"ok"}'))));
    const first = runtime.start(config); await vi.advanceTimersByTimeAsync(400); await first;
    await runtime.stop();
    const upgraded = path.resolve('/fixtures/llama/b5200/build/bin/llama-server');
    vi.spyOn(LlamaBinaryManager.prototype, 'install').mockResolvedValue({ success: true, path: upgraded });
    await runtime.install();
    vi.mocked(LlamaBinaryManager.prototype.findBinary).mockResolvedValue(upgraded);
    const second = runtime.start(config); await vi.advanceTimersByTimeAsync(400); await second;
    expect(spawn).toHaveBeenLastCalledWith(upgraded, expect.any(Array), expect.any(Object));
    await runtime.stop();
  });

  it('leaves a busy port and unrelated processes alone', async () => {
    const { runtime, child, config, binary } = setup();
    ports.busy.add(config.port);
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response('{"status":"ok"}'))));
    const pending = runtime.start(config); await vi.advanceTimersByTimeAsync(400);
    expect((await pending).port).toBe(18082);
    expect(spawn).toHaveBeenCalledWith(binary, expect.arrayContaining(['--port', '18082']), expect.anything());
    expect(child.kill).not.toHaveBeenCalled();
    await runtime.stop();
  });

  it('does not report a loading model as healthy or loaded', async () => {
    const { runtime, config } = setup();
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(url.endsWith('/health') ? '{"status":"ok"}' : '{}'))));
    const pending = runtime.start(config); await vi.advanceTimersByTimeAsync(400); await pending;
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(url.endsWith('/health') ? '{"status":"loading model"}' : '{}', { status: 503 }))));
    expect(await runtime.health()).toMatchObject({ isHealthy: false, modelLoaded: false });
    await runtime.stop();
  });
});
