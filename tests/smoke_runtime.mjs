// Run after pnpm build: node tests/smoke_runtime.mjs <runtime-directory> <model.gguf> [gpu-layers]
import assert from 'node:assert/strict';
import net from 'node:net';
import { LlamaRuntime } from '../packages/runtime-llama/dist/index.js';

const [runtimeDir, modelPath, layers = '0'] = process.argv.slice(2);
const gpuLayers = Number(layers);
assert.ok(Number.isInteger(gpuLayers) && gpuLayers >= 0, 'GPU layers must be a nonnegative integer.');
assert.ok(runtimeDir && modelPath, 'Supply an installed runtime directory and a local GGUF model. Nothing is downloaded.');
const listener = net.createServer();
await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
const port = listener.address().port;
await new Promise(resolve => listener.close(resolve));
const runtime = new LlamaRuntime(runtimeDir);
let runtimeExit;
runtime.getSupervisor().on('log', (_level, message) => {
  for (const line of message.split('\n')) {
    if (/NVIDIA|offloaded|terminate called/.test(line)) process.stderr.write(`${line}\n`);
  }
});
for (let cycle = 0; cycle < 2; cycle++) {
  let stoppedPort = port;
  runtimeExit = undefined;
  try {
    const instance = await runtime.start({
      instanceId: 'live-smoke', modelPath, modelName: 'live-smoke', runtimeDir,
      port, host: '127.0.0.1', contextSize: 512, gpuLayers, threads: 1,
      flashAttention: false,
    });
    stoppedPort = instance.port;
    runtimeExit = new Promise(resolve => runtime.childProcess.once('exit', (code, signal) => {
      console.log(JSON.stringify({ runtimeExit: { code, signal } }));
      resolve({ code, signal });
    }));
    assert.equal((await runtime.health()).modelLoaded, true);
    let content = '';
    for await (const chunk of runtime.chatStream({
      model: 'default', messages: [{ role: 'user', content: 'What is the capital of France?' }],
      max_tokens: 24, temperature: 0,
    }, AbortSignal.timeout(30000))) {
      content += chunk.choices[0]?.delta?.content || '';
    }
    assert.ok(content.trim(), 'The healthy runtime must actually generate text.');
    assert.equal((await runtime.detectCapabilities()).supportsEmbeddings, false);
    await assert.rejects(runtime.embeddings({ model: 'default', input: 'Hello' }), {
      code: 'EMBEDDINGS_UNAVAILABLE', statusCode: 503,
    });
    console.log(JSON.stringify({ chat: content, embeddings: 'explicitly unavailable', gpuLayersRequested: gpuLayers, threads: 1 }));
  } finally {
    await runtime.stop();
    if (runtimeExit) assert.deepEqual(await runtimeExit, { code: 0, signal: null }, 'Runtime must shut down cleanly without aborting or being killed.');
    await runtime.stop();
    await new Promise((resolve, reject) => {
      const socket = net.connect(stoppedPort, '127.0.0.1');
      socket.once('connect', () => { socket.destroy(); reject(new Error('Runtime port is still listening after stop.')); });
      socket.once('error', error => {
        try { assert.equal(error.code, 'ECONNREFUSED'); resolve(); } catch (failure) { reject(failure); }
      });
      socket.setTimeout(1000, () => { socket.destroy(); reject(new Error('Runtime port check timed out.')); });
    });
  }
}
