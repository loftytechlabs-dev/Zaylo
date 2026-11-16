# PR 8 runtime verification

Verified on Linux x86_64 on 2026-11-16 using one CPU inference thread. No production services, paid APIs, or large model downloads were used. The reusable Python environment has CPU-only PyTorch. A follow-up used the RTX 4050 through the pinned llama.cpp Vulkan binary; CUDA PyTorch was not installed.

## Regressions found and fixed

- A symlinked llama-server could not find libllama.so. Discovery now resolves the executable before setting library paths.
- b4800 started with --embeddings reported healthy but returned 501 for completions. The managed server now stays in chat mode, reports no embedding capability, and returns 503 EMBEDDINGS_UNAVAILABLE. Document retrieval uses keyword fallback.
- Forge discarded a requested adapter path when it did not exist. Comparison now rejects that request before starting Python.

## Actual model execution

- Reused SmolLM2-135M-Instruct-Q8_0.gguf and llama.cpp b4800. Real HTTP chat through ApiServer returned 200 and "The capital of France is Paris." Usage was 22 prompt tokens and 8 completion tokens. Streaming returned content and [DONE].
- The same API returned 503 for embeddings and for image generation without an engine, and 404 for a nonexistent image. LAN metrics returned 401 without a key and 200 with a valid key.
- Ran the real diffusion worker with diffusers/tiny-stable-diffusion-torch at revision c05d78754bd90a3ffea8fd3a0823ac17329cd1a6, seed 123, CPU, two requested steps, 64x64. Pillow verified the PNG dimensions and nonconstant pixels. File size was 11,449 bytes; SHA-256 was 795e01dded5add0177f25586a52287bae927266e2e84e091f76cd050d17756a8. This tiny testing model proves diffusion execution, not visual quality. The Python worker accepts 64x64 directly; the public API deliberately requires at least 256x256.
- An incompatible Flax diffusion fixture produced an actionable error and no image. The compatible PyTorch fixture above succeeded without changing worker code or synthesizing replacement output.
- Ran train_lora.py with hf-internal-testing/tiny-random-LlamaForCausalLM at revision 9fb191250dd56d0ba7ec9785a025ed29c03d5998. Two distinct examples, 50% validation split, rank 2, one epoch, one optimizer step. Loss was 10.2929 and held-out loss was 10.3180. Saved held-out JSONL, checkpoint, and adapter. Asserted that LoRA B tensors contain a nonzero update.
- Ran evaluate_compare.py on the exact held-out prompt with the real base and adapter, then merge_lora.py. Reloaded both PEFT and merged Safetensors models and compared logits: maximum absolute difference was 5.960464477539063e-08. Random test weights produce meaningless text; no accuracy or quality claim follows from this run.
- Exported with the actual b4800 convert_hf_to_gguf.py and matching gguf-py source. The upstream tiny model has invalid pad_token_id=-1, which the converter rejected safely without publishing a target. In a separate scratch copy, changed that fixture metadata to pad_token_id=0, then produced a 2,790,016-byte F16 GGUF. The exported GGUF then loaded in b4800 and generated text through the committed smoke check. No application code silently repairs model metadata.

## Reproduce chat verification

Build the workspace and supply an installed runtime directory containing llama/llama-server or its nested upstream layout, plus a local GGUF:

```sh
pnpm build --concurrency=1
node tests/smoke_runtime.mjs /path/to/runtime /path/to/model.gguf
```

The smoke check loads real weights, checks health, generates text, asserts the embedding error, and stops its own process. It downloads nothing and uses one CPU thread. Use an external timeout if running unattended.

## Local checks

- pnpm test --maxWorkers=1 --no-file-parallelism: 139 passed across 19 files.
- python3 -m unittest discover -s tests -p 'test_forge_workers.py' -v: 8 passed.
- pnpm build --concurrency=1 --force: 16 tasks passed without cache. Rebuilt affected packages after the final runtime fix.
- pnpm typecheck --concurrency=1 --force: 30 tasks passed without cache.
- The committed real-runtime smoke check passed with the cached SmolLM2 model.

An initial suite run hit the shared /tmp disk quota: 14 suites failed to load and 72 tests passed. The successful rerun used a worktree-local TMPDIR. Initial converter setup also hit that quota; converter dependencies were installed in worktree-local scratch space. These environmental failures were not counted as passing checks.

## Remaining limits

GitHub Validate Zaylo requires maintainer approval before it can execute. Local results do not substitute for that CI run or a maintainer review. CUDA, Metal/MPS, Windows/macOS installers, full-size diffusion quality, and production-model fine-tuning remain unverified. Real image API delivery is verified below. Semantic embeddings are explicitly unavailable with the managed pinned chat runtime.

## Follow-up: image API delivery and Vulkan

The real ApiServer and ImageEngine loaded the cached PyTorch Diffusers fixture and returned both OpenAI image response formats over loopback HTTP. Two separate requests used 256x256, two steps, guidance 1, seed 123. Both produced the same 180,783-byte PNG with SHA-256 240440cb7a717e1f082d976a3da0844e90af7ae1249f6c3ed03b1312e4c77484. Assertions checked HTTP 200, image count, PNG signature and dimensions, equality with the real worker file, deterministic bytes across requests, URL origin, image/png content type, completed job state, and 404 for an unregistered image. No worker, model, process, or engine was stubbed.

Reproduce after building, with a cached Diffusers repository and complete Python environment:

```sh
ZAYLO_PYTHON=/path/to/python node tests/smoke_image_api.mjs diffusers/tiny-stable-diffusion-torch /disk/backed/scratch
```

The smoke check disables network model lookup, uses one CPU thread, deletes only its own generated images, and leaves its SQLite/history scratch records. The first attempt failed safely with HTTP 500 because the old scratch environment contained an incomplete SentencePiece installation from the earlier quota failure. The successful run supplied the complete disk-backed dependency directory through PYTHONPATH. No application change was needed for image delivery.

Downloaded only the 32 MB pinned Vulkan runtime archive, reusing the existing SmolLM2 GGUF. On the RTX 4050, native logs confirmed Vulkan0, 31/31 layers offloaded, a 136.40 MiB model buffer, and 11.25 MiB KV buffer. Real generation returned the capital of France correctly. The managed embedding endpoint remained explicitly unavailable. The reusable runtime smoke accepts an optional GPU layer count:

```sh
ulimit -c 0
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json node tests/smoke_runtime.mjs /path/to/vulkan-runtime /path/to/model.gguf 999
```

CPU and Vulkan generation passed, but orderly upstream shutdown did not on either backend: the pinned native binary printed "terminate called without an active exception" and exited with SIGABRT after the application sent SIGTERM. The owned process exited and released its port. The b4800 server source leaves its HTTP thread unjoined at shutdown; SIGINT uses the same handler. This is recorded as an upstream runtime limitation, not a clean GPU lifecycle pass. Resolving it requires a separately validated patched or newer native runtime; changing the pinned release across platforms is outside this focused fix.

Review of Forge failure behavior found an unhandled Python spawn error. A regression reproduced it before the fix; comparison now rejects its promise on the child error event. Missing requested adapters are checked before dependency detection and again by the actual Python comparator before importing model dependencies. The comparator no longer silently switches to base-only output if a supplied adapter disappears. Both boundary tests passed, and real held-out base/adapter evaluation was rerun successfully after the change.

Fresh permission inspection reports upstream pull=true and push/maintain/admin=false. The account cannot approve the action-required fork workflow. A subsequent GraphQL read briefly returned HTTP 401; REST inspection and fork ref reads still worked, without changing credentials. A maintainer must approve Validate Zaylo and review the PR. No approval bypass was attempted.


## Shutdown defect fixed with b5200

The managed installer is now pinned to [llama.cpp b5200](https://github.com/ggml-org/llama.cpp/releases/tag/b5200). The b4800 smoke reproduced `terminate called without an active exception` and exit `{code: null, signal: "SIGABRT"}` after successful chat. Its server returns with an unjoined HTTP thread. [b5200 server cleanup](https://github.com/ggml-org/llama.cpp/blob/b5200/examples/server/server.cpp) joins that thread before returning.

- The committed smoke now asserts exit code 0 with no signal, verifies the listener is gone, repeats stop safely, and performs a second start/chat/stop cycle in the same runtime instance. The old CPU binary fails the exit assertion.
- Actual official b5200 Linux CPU and Vulkan binaries both passed two cycles, with exit `{code: 0, signal: null}` every time. Vulkan used the RTX 4050 with 31/31 layers offloaded. No forced kill or abort suppression was added.
- A real installer/extractor run using the downloaded official release ZIP upgraded a scratch legacy installation. Versioned installation and lookup prefer b5200 over stale root binaries/symlinks. The upgraded installation then passed both CPU chat/shutdown cycles. Release asset names were checked against the official b5200 release for all supported platform/backend selections.
- Final checks: 140 TypeScript tests passed across 19 files; runtime package build/typecheck and whitespace checks passed.
- Existing installations need to rerun the runtime installer; discovery still accepts manually installed or legacy binaries. Successful reinstall clears the runtime's cached executable path before its next start.
- Initial verification hit the existing `/tmp` quota; successful tests used a worktree-local TMPDIR. An attempted immediate port rebind hit normal socket reuse state; the smoke checks `ECONNREFUSED` after shutdown instead, which directly proves the server is no longer listening.

Windows/macOS native execution, CUDA and Metal remain unverified. The release upgrade does not add semantic embeddings; the managed chat runtime still reports them unavailable. Earlier b4800 results above are historical; their shutdown limitation is superseded for b5200 installations.
