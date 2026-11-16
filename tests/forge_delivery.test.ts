import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import { PassThrough } from 'node:stream';
import os from 'node:os';
import path from 'node:path';
import { ChildProcess, execFileSync, spawn } from 'node:child_process';
import { createDatabaseAsync, TrainingJobRepository, FineTunedModelRepository } from '@local-ai/database';
import type { TrainingConfig, TrainingJob, FineTunedModelArtifact } from '@local-ai/shared';
import { ForgeTrainingEngine } from '../apps/desktop/electron/forge/trainingEngine.js';
import { PythonDetector } from '../apps/desktop/electron/forge/pythonDetector.js';
import { scoreResponse } from '../apps/desktop/electron/forge/evaluation.js';

vi.mock('node:child_process', async importOriginal => ({
  ...await importOriginal<typeof import('node:child_process')>(),
  execFileSync: vi.fn(),
  spawn: vi.fn(),
}));

describe('Forge delivery', () => {
  let directory: string;
  let connection: Awaited<ReturnType<typeof createDatabaseAsync>>;
  let jobs: TrainingJobRepository;
  let artifacts: FineTunedModelRepository;
  let engine: ForgeTrainingEngine;
  let job: TrainingJob;
  let artifact: FineTunedModelArtifact;

  beforeEach(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-delivery-'));
    connection = await createDatabaseAsync(path.join(directory, 'test.sqlite'));
    jobs = new TrainingJobRepository(connection.raw);
    artifacts = new FineTunedModelRepository(connection.raw);
    engine = new ForgeTrainingEngine(jobs, artifacts);
    const config: TrainingConfig = {
      jobId: 'job-delivery', jobName: 'Delivery', modelId: 'tiny', modelName: 'Tiny',
      checkpointPath: path.join(directory, 'base'), datasetPath: path.join(directory, 'training.jsonl'), datasetName: 'training.jsonl',
      objective: 'instruction', method: 'lora', backend: 'peft', learningRate: 0.001,
      loraRank: 2, loraAlpha: 4, loraDropout: 0, targetModules: ['q_proj', 'v_proj'],
      batchSize: 1, gradientAccumulationSteps: 1, maxSeqLength: 64, epochs: 1,
      optimizer: 'AdamW', precision: 'float32', warmupRatio: 0, weightDecay: 0,
      saveSteps: 1, trainValSplit: 0.5, outputDir: directory,
    };
    const artifactPath = path.join(directory, 'adapter');
    fs.mkdirSync(artifactPath);
    job = {
      id: config.jobId, name: config.jobName, modelId: config.modelId, modelName: config.modelName,
      checkpointPath: config.checkpointPath, datasetPath: config.datasetPath, datasetRecords: 2,
      status: 'COMPLETED', config, estimates: { estimatedMemoryBytes: 1, availableMemoryBytes: 2, estimatedDiskBytes: 1, availableDiskBytes: 2, isFeasible: true, warnings: [], acceleration: 'cpu' },
      currentStep: 1, totalSteps: 1, currentEpoch: 1, totalEpochs: 1, currentLoss: 0.1,
      metricsHistory: [{ step: 1, totalSteps: 1, epoch: 1, totalEpochs: 1, loss: 0.1, evalLoss: 2.5, elapsedSeconds: 1, timestamp: Date.now() }],
      recentLogs: [], checkpoints: [], outputDir: directory, artifactPath,
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    artifact = { id: 'adapter-delivery', jobId: job.id, name: 'Adapter', baseModelId: 'tiny', baseModelName: 'Tiny', type: 'lora', artifactPath, sizeBytes: 1, format: 'safetensors', compatibilityStatus: 'base_required', trainingDurationSeconds: 1, createdAt: Date.now() };
    jobs.createJob(job);
    artifacts.registerModel(artifact);
    vi.spyOn(PythonDetector, 'detect').mockReturnValue({ available: true, pythonPath: '/python with spaces' });
  });

  afterEach(() => {
    connection.close();
    vi.restoreAllMocks();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('registers a successful merge after JSON progress logs', async () => {
    vi.mocked(execFileSync).mockImplementation((_executable, args) => {
      const outputIndex = args?.indexOf('--output-dir') ?? -1;
      const outputDir = args?.[outputIndex + 1];
      if (!outputDir) throw new Error('Missing output directory');
      fs.writeFileSync(path.join(outputDir, 'config.json'), '{}');
      return JSON.stringify({ type: 'log', message: 'Loading base model' }) + '\n' + JSON.stringify({ success: true, outputPath: outputDir, sizeBytes: 123 });
    });
    const result = await engine.mergeAdapter(artifact.id);
    expect(result.success).toBe(true);
    expect(artifacts.getAllModels().find(item => item.type === 'merged')).toMatchObject({ artifactPath: result.outputPath, sizeBytes: 123 });
    expect(execFileSync).toHaveBeenCalledWith('/python with spaces', expect.arrayContaining(['--adapter', artifact.artifactPath]), expect.any(Object));
  });

  it('rejects a missing requested adapter instead of comparing only the base model', async () => {
    await expect(engine.compareModels({
      baseModelPath: job.checkpointPath,
      adapterPath: path.join(directory, 'missing-adapter'),
      prompt: 'Hello',
    })).rejects.toThrow('Adapter path not found');
    expect(spawn).not.toHaveBeenCalled();
  });

  it('rejects when the detected Python executable fails to spawn', async () => {
    const child = new ChildProcess();
    Object.defineProperties(child, {
      stdout: { value: new PassThrough() }, stderr: { value: new PassThrough() },
    });
    vi.mocked(spawn).mockReturnValue(child);
    const pending = engine.compareModels({ baseModelPath: job.checkpointPath, adapterPath: artifact.artifactPath, prompt: 'Hello' });
    const rejected = expect(pending).rejects.toThrow('spawn ENOENT');
    child.emit('error', new Error('spawn ENOENT'));
    await rejected;
  });

  it('uses only persisted held-out records and separates exact match, F1 and validation loss', async () => {
    fs.writeFileSync(job.datasetPath, JSON.stringify({ instruction: 'Training-only prompt', output: 'Training answer' }) + '\n');
    fs.writeFileSync(path.join(directory, 'validation_records.jsonl'), JSON.stringify({ formattedPrompt: '### Instruction:\nHeld-out prompt\n\n### Response:\n', expectedResponse: 'red red apple' }) + '\n');
    const compare = vi.spyOn(engine, 'compareModels').mockResolvedValue({ prompt: 'Held-out prompt', baseResponse: 'pear', fineTunedResponse: 'red apple', baseDurationMs: 1, fineTunedDurationMs: 1 });
    const result = await engine.evaluateDataset(job.id);
    expect(compare).toHaveBeenCalledWith(expect.objectContaining({ prompt: '### Instruction:\nHeld-out prompt\n\n### Response:\n', temperature: 0 }), true);
    expect(result.metrics).toEqual({ valLoss: 2.5, tokenF1Score: 0.8, accuracyScore: 0 });
    expect(result.samples[0].expected).toBe('red red apple');
  });

  it('passes persisted native multi-turn formatting verbatim to the comparator', async () => {
    const prompt = '<native><user>My name is Ada.</user><assistant>Hello Ada.</assistant><user>What is my name?</user><assistant>';
    fs.writeFileSync(path.join(directory, 'validation_records.jsonl'), JSON.stringify({ formattedPrompt: prompt, expectedResponse: 'Ada.' }) + '\n');
    const compare = vi.spyOn(engine, 'compareModels').mockResolvedValue({ prompt, baseResponse: 'Unknown', fineTunedResponse: 'Ada.', baseDurationMs: 1, fineTunedDurationMs: 1 });
    const result = await engine.evaluateDataset(job.id);
    expect(compare).toHaveBeenCalledWith(expect.objectContaining({ prompt }), true);
    expect(result.samples[0]).toMatchObject({ prompt, expected: 'Ada.' });
    expect(result.metrics.accuracyScore).toBe(1);
  });

  it('rejects legacy preview-only validation files rather than silently changing the input', async () => {
    fs.writeFileSync(path.join(directory, 'validation_records.jsonl'), JSON.stringify({ instruction: 'Translate', input: 'Good morning', output: 'Bonjour' }) + '\n');
    const compare = vi.spyOn(engine, 'compareModels');
    await expect(engine.evaluateDataset(job.id)).rejects.toThrow('no saved training-formatted validation prompts');
    expect(compare).not.toHaveBeenCalled();
  });

  it('refuses to score training examples when a held-out split is missing', async () => {
    await expect(engine.evaluateDataset(job.id)).rejects.toThrow('No held-out validation records');
  });

  it('reports the multiset token F1 rather than Jaccard or substring scores', () => {
    expect(scoreResponse('red red apple', 'red apple')).toEqual({ exactMatch: 0, tokenF1: 0.8 });
    expect(scoreResponse('The apple', ' the   apple ')).toEqual({ exactMatch: 1, tokenF1: 1 });
    expect(scoreResponse('red apple', '')).toEqual({ exactMatch: 0, tokenF1: 0 });
  });
});
