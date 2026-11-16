import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { ModelDownloader } from '@local-ai/models';

const digest = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
let directory: string;
beforeEach(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'zaylo-download-')); });
afterEach(() => { vi.unstubAllGlobals(); fs.rmSync(directory, { recursive: true, force: true }); });
const options = () => ({ id: 'test', modelId: 'm', variantId: 'v', url: 'https://example.com/model.gguf', destPath: path.join(directory, 'model.gguf'), expectedSizeBytes: 3 });

describe('model download integrity', () => {
  it('restarts when a server ignores the requested range', async () => {
    const request = options();
    fs.writeFileSync(`${request.destPath}.downloading`, 'ab');
    const fetcher = vi.fn().mockResolvedValue(new Response('abc', { headers: { 'content-length': '3' } }));
    vi.stubGlobal('fetch', fetcher);
    await new ModelDownloader().download({ ...request, expectedSha256: digest('abc') });
    expect(fs.readFileSync(request.destPath, 'utf8')).toBe('abc');
    expect(fetcher.mock.calls[0][1].headers.Range).toBe('bytes=2-');
  });

  it('promotes a complete partial file after metadata and a range-not-satisfiable response', async () => {
    const request = { ...options(), url: 'https://huggingface.co/org/model/resolve/main/model.gguf' };
    fs.writeFileSync(request.destPath, 'old installation');
    fs.writeFileSync(`${request.destPath}.downloading`, 'abc');
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { 'x-linked-etag': `"${digest('abc')}"` } }))
      .mockResolvedValueOnce(new Response(null, { status: 416, headers: { 'content-range': 'bytes */3' } }));
    vi.stubGlobal('fetch', fetcher);
    const progress = vi.fn();
    await new ModelDownloader().download({ ...request, onProgress: progress });
    expect(fs.readFileSync(request.destPath, 'utf8')).toBe('abc');
    expect(fs.existsSync(`${request.destPath}.downloading`)).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][1].headers.Range).toBe('bytes=3-');
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'completed', downloadedBytes: 3, totalBytes: 3 }));
  });

  it('restarts a corrupt complete partial file after a range-not-satisfiable response', async () => {
    const request = options();
    fs.writeFileSync(request.destPath, 'old installation');
    fs.writeFileSync(`${request.destPath}.downloading`, 'bad');
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 416 }))
      .mockResolvedValueOnce(new Response('abc', { headers: { 'content-length': '3' } }));
    vi.stubGlobal('fetch', fetcher);
    await new ModelDownloader().download({ ...request, expectedSha256: digest('abc') });
    expect(fs.readFileSync(request.destPath, 'utf8')).toBe('abc');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][1].headers.Range).toBeUndefined();
  });

  it('preserves the installed model if the replacement after a 416 fails verification', async () => {
    const request = options();
    fs.writeFileSync(request.destPath, 'old installation');
    fs.writeFileSync(`${request.destPath}.downloading`, 'bad');
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 416 }))
      .mockResolvedValueOnce(new Response('bad', { headers: { 'content-length': '3' } }));
    vi.stubGlobal('fetch', fetcher);
    await expect(new ModelDownloader().download({ ...request, expectedSha256: digest('abc') })).rejects.toThrow('Checksum verification failed');
    expect(fs.readFileSync(request.destPath, 'utf8')).toBe('old installation');
    expect(fs.existsSync(`${request.destPath}.downloading`)).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('resumes a verified partial response', async () => {
    const request = options();
    fs.writeFileSync(`${request.destPath}.downloading`, 'ab');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('c', { status: 206, headers: { 'content-range': 'bytes 2-2/3', 'content-length': '1' } })));
    await new ModelDownloader().download({ ...request, expectedSha256: digest('abc') });
    expect(fs.readFileSync(request.destPath, 'utf8')).toBe('abc');
  });

  it('rejects a mismatched range without changing a good installation', async () => {
    const request = options();
    fs.writeFileSync(request.destPath, 'good');
    fs.writeFileSync(`${request.destPath}.downloading`, 'ab');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('abc', { status: 206, headers: { 'content-range': 'bytes 0-2/3' } })));
    await expect(new ModelDownloader().download({ ...request, expectedSha256: digest('abc') })).rejects.toThrow('invalid download range');
    expect(fs.readFileSync(request.destPath, 'utf8')).toBe('good');
  });

  it('rejects truncated downloads and preserves a good installation', async () => {
    const request = options(); fs.writeFileSync(request.destPath, 'good');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ab', { headers: { 'content-length': '3' } })));
    await expect(new ModelDownloader().download(request)).rejects.toThrow('Incomplete download');
    expect(fs.readFileSync(request.destPath, 'utf8')).toBe('good');
  });

  it('checks Hugging Face linked SHA-256 metadata before promoting a file', async () => {
    const request = { ...options(), url: 'https://huggingface.co/org/model/resolve/main/model.gguf' };
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { 'x-linked-etag': `"${digest('abc')}"` } })).mockResolvedValueOnce(new Response('abd'));
    vi.stubGlobal('fetch', fetcher);
    await expect(new ModelDownloader().download(request)).rejects.toThrow('Checksum verification failed');
    expect(fs.existsSync(request.destPath)).toBe(false);
    expect(fs.existsSync(`${request.destPath}.downloading`)).toBe(false);
    expect(fetcher.mock.calls[0][1].method).toBe('HEAD');
  });

  it('fails clearly if Hugging Face cannot supply its checksum', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 302 })));
    await expect(new ModelDownloader().download({ ...options(), url: 'https://huggingface.co/org/m/resolve/main/m.gguf' })).rejects.toThrow('did not provide a SHA-256 checksum');
  });
});
