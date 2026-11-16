import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChildProcess, spawn } from 'node:child_process';
import { PassThrough } from 'node:stream';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ImageEngine } from '../packages/inference/src/image/imageEngine.js';
import { PythonDetector } from '../packages/inference/src/python.js';

vi.mock('node:child_process', async importOriginal => ({
  ...await importOriginal<typeof import('node:child_process')>(),
  spawn: vi.fn(),
}));

describe('Image worker completion', () => {
  let directory: string;
  let engine: ImageEngine;
  let child: ChildProcess;
  let output: PassThrough;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'zaylo-image-test-'));
    vi.spyOn(os, 'homedir').mockReturnValue(directory);
    vi.spyOn(PythonDetector, 'detect').mockReturnValue({ available: true, pythonPath: '/test/python' });
    child = new ChildProcess();
    output = new PassThrough();
    Object.defineProperty(child, 'stdout', { value: output });
    Object.defineProperty(child, 'stderr', { value: new PassThrough() });
    vi.mocked(spawn).mockReturnValue(child);
    engine = new ImageEngine(directory);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  async function generate() {
    return engine.startGeneration({ modelId: 'tiny-sd', generationParams: { prompt: 'A red apple' }, outputDir: directory });
  }

  it('fails when the worker exits successfully without returning images', async () => {
    const { jobId } = await generate();
    child.emit('close', 0);
    expect(engine.getJob(jobId)).toMatchObject({ status: 'FAILED', images: [] });
    expect(engine.getJob(jobId)?.error).toContain('without returning generated images');
    expect(engine.getHistory()).toEqual([]);
  });

  it('preserves an actionable pipeline error after worker exit', async () => {
    const { jobId } = await generate();
    output.write(JSON.stringify({ type: 'error', message: 'No diffusion pipeline could be loaded. Download the model first.' }) + '\n');
    child.emit('close', 1);
    expect(engine.getJob(jobId)).toMatchObject({ status: 'FAILED', error: 'No diffusion pipeline could be loaded. Download the model first.' });
    expect(engine.getHistory()).toEqual([]);
  });
});
