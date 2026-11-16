import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { DownloadProgress } from '@local-ai/shared';
import { InsufficientResourcesError, AppError } from '@local-ai/shared';

export interface DownloadOptions {
  id: string;
  modelId: string;
  variantId: string;
  url: string;
  destPath: string;
  expectedSizeBytes: number;
  expectedSha256?: string;
  onProgress?: (progress: DownloadProgress) => void;
}

export class ModelDownloader {
  private activeTasks = new Map<string, { abortController: AbortController; isCancelled: boolean }>();

  public async download(options: DownloadOptions): Promise<string> {
    const { id, modelId, variantId, url, destPath, expectedSizeBytes, onProgress } = options;
    let expectedSha256 = options.expectedSha256;

    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 1. Check disk space before download
    this.verifyDiskSpace(dir, expectedSizeBytes);

    const tempPath = `${destPath}.downloading`;
    let startByte = 0;
    if (fs.existsSync(tempPath)) {
      const stat = fs.statSync(tempPath);
      startByte = stat.size;
    }

    const abortController = new AbortController();
    this.activeTasks.set(id, { abortController, isCancelled: false });

    const filename = path.basename(destPath);
    let downloadedBytes = startByte;
    let totalBytes = expectedSizeBytes;
    const startedAt = Date.now();
    let lastSampleTime = startedAt;
    let lastSampleBytes = downloadedBytes;
    let lastNotifyTime = 0;
    let bytesPerSecond = 0;

    const notifyProgress = (status: DownloadProgress['status'], error?: string, force = false) => {
      const now = Date.now();
      if (!force && status === 'downloading' && now - lastNotifyTime < 200) {
        return;
      }
      lastNotifyTime = now;

      const timeDelta = (now - lastSampleTime) / 1000;
      if (timeDelta >= 0.5) {
        const bytesDelta = downloadedBytes - lastSampleBytes;
        bytesPerSecond = bytesDelta / timeDelta;
        lastSampleTime = now;
        lastSampleBytes = downloadedBytes;
      }

      const remainingBytes = Math.max(0, totalBytes - downloadedBytes);
      const estimatedSecondsRemaining = bytesPerSecond > 0 ? Math.round(remainingBytes / bytesPerSecond) : undefined;

      const progress: DownloadProgress = {
        id,
        modelId,
        variantId,
        filename,
        status,
        downloadedBytes,
        totalBytes,
        bytesPerSecond,
        estimatedSecondsRemaining,
        error,
        startedAt,
        updatedAt: now,
      };

      onProgress?.(progress);
    };

    notifyProgress('downloading', undefined, true);

    try {
      if (expectedSha256 && !/^[a-f0-9]{64}$/i.test(expectedSha256)) {
        throw new AppError('Expected SHA-256 must contain 64 hexadecimal characters', 'INVALID_CHECKSUM');
      }
      const source = new URL(url);
      if (!expectedSha256 && source.hostname === 'huggingface.co' && source.pathname.includes('/resolve/')) {
        const metadata = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: abortController.signal });
        const linkedHash = metadata.headers.get('x-linked-etag')?.replace(/^"|"$/g, '');
        if (!linkedHash || !/^[a-f0-9]{64}$/i.test(linkedHash)) {
          throw new AppError('Hugging Face did not provide a SHA-256 checksum. Supply a verified checksum before downloading.', 'CHECKSUM_UNAVAILABLE');
        }
        expectedSha256 = linkedHash;
      }
      // Without a trusted checksum, restart partial files rather than combine unverified versions.
      if (!expectedSha256) startByte = 0;
      downloadedBytes = startByte;
      lastSampleBytes = startByte;
      const headers: Record<string, string> = {
        'User-Agent': 'LocalAI-Downloader/1.0',
        'Accept-Encoding': 'identity',
      };

      if (startByte > 0) {
        headers['Range'] = `bytes=${startByte}-`;
      }

      let response = await fetch(url, {
        headers,
        signal: abortController.signal,
      });

      if (response.status === 416 && startByte > 0 && expectedSha256) {
        await response.body?.cancel();
        const actualHash = await this.computeSha256(tempPath);
        abortController.signal.throwIfAborted();
        if (actualHash.toLowerCase() === expectedSha256.toLowerCase()) {
          fs.renameSync(tempPath, destPath);
          totalBytes = downloadedBytes;
          notifyProgress('completed', undefined, true);
          this.activeTasks.delete(id);
          return destPath;
        }
        // A full partial file may survive a crash before promotion; corrupt files restart once.
        startByte = 0;
        downloadedBytes = 0;
        lastSampleBytes = 0;
        delete headers.Range;
        response = await fetch(url, { headers, signal: abortController.signal });
      }

      if (response.status !== 200 && response.status !== 206) {
        throw new AppError(`HTTP download failed with status ${response.status}: ${response.statusText}`, 'DOWNLOAD_FAILED');
      }

      if (response.status === 200 && startByte > 0) {
        startByte = 0;
        downloadedBytes = 0;
        lastSampleBytes = 0;
      }
      let expectedFinalBytes: number | undefined;
      if (response.status === 206) {
        const range = response.headers.get('content-range')?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
        if (!range || Number(range[1]) !== startByte || Number(range[2]) + 1 !== Number(range[3])) {
          throw new AppError('Server returned an invalid download range', 'DOWNLOAD_RANGE_INVALID');
        }
        expectedFinalBytes = Number(range[3]);
      } else {
        const length = response.headers.get('content-length');
        if (length && /^\d+$/.test(length)) expectedFinalBytes = Number(length);
      }
      totalBytes = expectedFinalBytes ?? expectedSizeBytes;
      if (!response.body) throw new AppError('Download response body is empty', 'DOWNLOAD_EMPTY');
      const reader = response.body.getReader();
      async function* chunks() {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            downloadedBytes += value.length;
            notifyProgress('downloading');
            yield value;
          }
        } finally {
          await reader.cancel().catch(() => {});
          reader.releaseLock();
        }
      }
      await pipeline(Readable.from(chunks()), fs.createWriteStream(tempPath, { flags: startByte > 0 ? 'a' : 'w' }), { signal: abortController.signal });
      if (expectedFinalBytes !== undefined && downloadedBytes !== expectedFinalBytes) {
        throw new AppError(`Incomplete download: expected ${expectedFinalBytes} bytes, received ${downloadedBytes}`, 'DOWNLOAD_INCOMPLETE');
      }

      // Verification: Checksum if provided
      if (expectedSha256) {
        const actualHash = await this.computeSha256(tempPath);
        if (actualHash.toLowerCase() !== expectedSha256.toLowerCase()) {
          fs.unlinkSync(tempPath);
          throw new AppError(`Checksum verification failed. Expected ${expectedSha256}, got ${actualHash}`, 'CHECKSUM_MISMATCH');
        }
      }

      // Rename temp file to final destination
      fs.renameSync(tempPath, destPath);

      notifyProgress('completed', undefined, true);
      this.activeTasks.delete(id);
      return destPath;
    } catch (err: any) {
      this.activeTasks.delete(id);
      if (abortController.signal.aborted) {
        if (fs.existsSync(tempPath)) {
          try {
            fs.unlinkSync(tempPath);
          } catch {}
        }
        notifyProgress('cancelled', undefined, true);
        throw new AppError('Download was cancelled by user', 'DOWNLOAD_CANCELLED');
      }

      const errorMessage = err?.message || 'Download failed';
      notifyProgress('failed', errorMessage, true);
      throw err;
    }
  }

  public cancel(id: string): boolean {
    const task = this.activeTasks.get(id);
    if (task) {
      task.isCancelled = true;
      task.abortController.abort();
      this.activeTasks.delete(id);
      return true;
    }
    return false;
  }

  private verifyDiskSpace(dir: string, requiredBytes: number): void {
    try {
      if (fs.statfsSync) {
        const stat = fs.statfsSync(dir);
        const freeBytes = stat.bavail * stat.bsize;
        const safetyMargin = 500 * 1024 * 1024; // 500 MB buffer
        if (freeBytes < requiredBytes + safetyMargin) {
          const reqGB = (requiredBytes / (1024 * 1024 * 1024)).toFixed(1);
          const availGB = (freeBytes / (1024 * 1024 * 1024)).toFixed(1);
          throw new InsufficientResourcesError(
            `Not enough storage space. Required: ${reqGB} GB, Available: ${availGB} GB.`
          );
        }
      }
    } catch (err) {
      if (err instanceof InsufficientResourcesError) throw err;
      // If statfs is not supported on this platform/FS, proceed
    }
  }

  private computeSha256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err) => reject(err));
    });
  }
}
