// Run after pnpm build with ZAYLO_PYTHON set. Uses a cached Diffusers repository, never downloads weights.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createDatabaseAsync, ServerRepository, ModelRepository, APIKeyRepository, DeviceRepository, MetricsRepository, LogsRepository } from '../packages/database/dist/index.js';
import { ModelManager } from '../packages/models/dist/index.js';
import { KeyManager } from '../packages/security/dist/index.js';
import { DevicePairingManager } from '../packages/network/dist/index.js';
import { ImageEngine, InferenceService } from '../packages/inference/dist/index.js';
import { ApiServer } from '../packages/server/dist/index.js';

const [model, scratch] = process.argv.slice(2);
assert.ok(model && scratch && process.env.ZAYLO_PYTHON, 'Supply a cached Diffusers repository ID, disk-backed scratch directory, and ZAYLO_PYTHON.');
process.env.HF_HUB_OFFLINE = '1';
process.env.TRANSFORMERS_OFFLINE = '1';
process.env.OMP_NUM_THREADS = '1';
process.env.MKL_NUM_THREADS = '1';
fs.mkdirSync(scratch, { recursive: true });
const directory = fs.mkdtempSync(path.join(path.resolve(scratch), 'image-api-'));
const db = await createDatabaseAsync(path.join(directory, 'test.sqlite'));
const deviceRepo = new DeviceRepository(db.raw);
const keyManager = new KeyManager(new APIKeyRepository(db.raw));
const engine = new ImageEngine(directory);
const server = new ApiServer({
  config: { ...new ServerRepository(db.raw).getConfig(), port: 0, lanEnabled: false },
  inferenceService: new InferenceService(new MetricsRepository(db.raw), new LogsRepository(db.raw), 1),
  modelManager: new ModelManager(new ModelRepository(db.raw), directory),
  keyManager, deviceRepo, pairingManager: new DevicePairingManager(keyManager, deviceRepo), imageEngine: engine,
});
const results = [];
try {
  await server.fastify.listen({ port: 0, host: '127.0.0.1' });
  const origin = `http://127.0.0.1:${server.fastify.server.address().port}`;
  for (const response_format of ['b64_json', 'url']) {
    const response = await fetch(`${origin}/v1/images/generations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(150000),
      body: JSON.stringify({ model, prompt: 'A red apple on a wooden table', size: '256x256', steps: 2, guidance_scale: 1, seed: 123, response_format }),
    });
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.data.length, 1);
    let bytes;
    if (response_format === 'url') {
      assert.equal(new URL(body.data[0].url).origin, origin);
      const image = await fetch(body.data[0].url);
      assert.equal(image.status, 200);
      assert.equal(image.headers.get('content-type'), 'image/png');
      bytes = Buffer.from(await image.arrayBuffer());
    } else {
      bytes = Buffer.from(body.data[0].b64_json, 'base64');
    }
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16), 256);
    assert.equal(bytes.readUInt32BE(20), 256);
    const generated = engine.getHistory()[0];
    assert.equal(engine.getJob(generated.jobId).status, 'COMPLETED');
    assert.deepEqual(bytes, fs.readFileSync(generated.localPath));
    results.push({ response_format, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), device: generated.device });
  }
  assert.equal(results[0].sha256, results[1].sha256, 'The same seed must reproduce the same pixels.');
  assert.equal((await fetch(`${origin}/v1/images/file/unregistered.png`)).status, 404);
  console.log(JSON.stringify(results));
} finally {
  for (const image of engine.getHistory()) fs.rmSync(image.localPath, { force: true });
  await server.fastify.close();
  db.close();
}
