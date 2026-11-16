import { describe, expect, it } from 'vitest';
import { measureBenchmark } from '../apps/desktop/electron/benchmark';
import type { ChatCompletionResponse } from '@local-ai/shared';
import { BenchmarkRepository, createDatabaseAsync } from '@local-ai/database';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

async function* chunks(): AsyncIterable<ChatCompletionResponse> {
  yield { id: 'bench', object: 'chat.completion.chunk', created: 1, model: 'test', choices: [{ index: 0, delta: { content: 'Several tokens in one chunk' }, finish_reason: null }] };
  yield { id: 'bench', object: 'chat.completion.chunk', created: 1, model: 'test', choices: [], timings: { prompt_n: 20, prompt_ms: 100, prompt_per_second: 200, predicted_n: 8, predicted_ms: 400, predicted_per_second: 20 } };
}

describe('native benchmark measurements', () => {
  it('uses measured token counts rather than chunk counts or a requested prompt size', async () => {
    expect(await measureBenchmark(chunks())).toMatchObject({ promptTokens: 20, completionTokens: 8, promptProcessingTokensPerSec: 200, generationTokensPerSec: 20, peakMemoryBytes: 0, memoryMeasurement: 'unavailable', measurementVersion: 2 });
  });

  it('rejects missing runtime measurements instead of inventing a result', async () => {
    async function* empty(): AsyncIterable<ChatCompletionResponse> {}
    await expect(measureBenchmark(empty())).rejects.toThrow('native token counts and timings');
  });

  it('persists measured provenance and keeps old estimates distinguishable', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'zaylo-benchmark-'));
    const db = await createDatabaseAsync(path.join(directory, 'benchmark.sqlite'));
    try {
      const repo = new BenchmarkRepository(db.raw);
      const measurements = await measureBenchmark(chunks());
      const result = { id: 'measured', modelId: 'model', variantId: 'q4', modelName: 'Model', timestamp: 1, ...measurements };
      repo.save(result);
      repo.save({ ...result, id: 'legacy', measurementVersion: undefined, memoryMeasurement: undefined });
      expect(repo.getAll().find(({ id }) => id === 'measured')).toMatchObject({ promptTokens: 20, completionTokens: 8, measurementVersion: 2, memoryMeasurement: 'unavailable' });
      expect(repo.getAll().find(({ id }) => id === 'legacy')?.measurementVersion).toBeUndefined();
    } finally {
      db.close();
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
