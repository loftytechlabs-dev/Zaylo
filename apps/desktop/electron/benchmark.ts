import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ChatCompletionResponse } from '@local-ai/shared';

const execFileAsync = promisify(execFile);

async function residentBytes(pid: number): Promise<number | undefined> {
  try {
    if (process.platform === 'linux') {
      const status = await readFile(`/proc/${pid}/status`, 'utf8');
      const kb = status.match(/^VmRSS:\s+(\d+)\s+kB$/m)?.[1];
      return kb ? Number(kb) * 1024 : undefined;
    }
    const { stdout } = process.platform === 'win32'
      ? await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `(Get-Process -Id ${pid} -ErrorAction Stop).WorkingSet64`], { timeout: 2000 })
      : await execFileAsync('ps', ['-o', 'rss=', '-p', String(pid)], { timeout: 2000 });
    const value = Number(stdout.trim());
    return Number.isFinite(value) && value > 0 ? value * (process.platform === 'win32' ? 1 : 1024) : undefined;
  } catch {
    return undefined;
  }
}

export async function measureBenchmark(stream: AsyncIterable<ChatCompletionResponse>, pid?: number) {
  let firstTokenAt: number | undefined;
  let finishedAt = 0;
  let timings: ChatCompletionResponse['timings'];
  let peakMemoryBytes = 0;
  let sampling: Promise<void> | undefined;
  const sample = async () => {
    if (!pid) return;
    const bytes = await residentBytes(pid);
    if (bytes !== undefined) peakMemoryBytes = Math.max(peakMemoryBytes, bytes);
  };
  await sample();
  const start = performance.now();
  const timer = setInterval(() => {
    if (!sampling) sampling = sample().finally(() => { sampling = undefined; });
  }, process.platform === 'win32' ? 1000 : 100);
  try {
    for await (const chunk of stream) {
      if (chunk.choices.some(({ delta }) => delta?.content || delta?.tool_calls?.length)) {
        firstTokenAt ??= performance.now();
      }
      if (chunk.timings) timings = chunk.timings;
    }
    finishedAt = performance.now();
  } finally {
    clearInterval(timer);
    await sampling;
    await sample();
  }
  const totalDurationMs = finishedAt - start;
  if (!timings || ![timings.prompt_n, timings.prompt_ms, timings.predicted_n, timings.predicted_ms].every(Number.isFinite)
      || timings.prompt_n < 0 || timings.predicted_n <= 0 || timings.prompt_ms < 0
      || (timings.prompt_n > 0 && timings.prompt_ms === 0) || timings.predicted_ms <= 0) {
    throw new Error('The runtime did not return native token counts and timings. Update llama-server before benchmarking.');
  }
  return {
    promptTokens: timings.prompt_n,
    completionTokens: timings.predicted_n,
    promptProcessingTokensPerSec: timings.prompt_ms > 0 ? timings.prompt_n * 1000 / timings.prompt_ms : 0,
    generationTokensPerSec: timings.predicted_n * 1000 / timings.predicted_ms,
    timeToFirstTokenMs: firstTokenAt === undefined ? totalDurationMs : firstTokenAt - start,
    totalDurationMs,
    peakMemoryBytes,
    measurementVersion: 2 as const,
    memoryMeasurement: peakMemoryBytes > 0 ? 'process-rss' as const : 'unavailable' as const,
  };
}
