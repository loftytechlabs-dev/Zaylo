<div align="center">

<img src="assets/logo.png" alt="Zaylo Logo" width="96" />

# Zaylo 3.3

**Local AI Infrastructure: Inference Engine, Diffusion Studio, LoRA Forge, and LoftyDB Knowledge Graph**

Run open-weights language models, multimodal vision models, diffusion pipelines, fine-tuning workflows, and persistent graph memory locally across macOS, Windows, and Linux. Zaylo provides OpenAI-compatible chat completions, embeddings, model listing, and image generation endpoints. Model capabilities and installed runtimes determine which operations are available.

[![Source](https://img.shields.io/badge/Source-v3.3.0-111827.svg?style=flat-square)](https://github.com/loftytechlabs-dev/Zaylo/releases)
[![Memory Engine](https://img.shields.io/badge/Memory-LoftyDB%20v1.3.4-0284c7.svg?style=flat-square)](#loftydb-knowledge-graph-memory)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-18181b.svg?style=flat-square)](#installers)
[![License: MIT](https://img.shields.io/badge/License-MIT-374151.svg?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6.svg?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Go Engine](https://img.shields.io/badge/Engine-Go%201.26-00add8.svg?style=flat-square&logo=go&logoColor=white)](#system-architecture)
[![Fastify](https://img.shields.io/badge/API%20Gateway-Fastify%20v5-000000.svg?style=flat-square&logo=fastify&logoColor=white)](#openai-and-memory-api-server)

<br />

[Installers](#installers) | [Highlights](#whats-new-in-zaylo-33) | [Architecture](#system-architecture) | [LoftyDB Memory Graph](#loftydb-knowledge-graph-memory) | [Visual Interface](#visual-interface) | [Playground & Generative UI](#dynamic-playground-and-generative-ui) | [Forge Studio](#forge-fine-tuning-studio) | [API Reference](#openai-and-memory-api-server) | [Benchmarks](#hardware-benchmarks) | [Development](#cross-platform-build-and-packaging)

</div>

---

## What's New in Zaylo 3.3

- Restore each conversation's text or image model selection without restarting the active inference runtime.
- Require API keys for protected endpoints in LAN mode, including loopback; Referer headers never authorize requests. Local-only loopback access remains keyless.
- Run the complete root test suite with `pnpm test`, with deterministic Forge dependency and checkpoint tests.
- Load runtimes only after their health endpoint confirms model readiness, and stop only the processes Zaylo owns.
- Use real diffusion output or report an error. Image requests never substitute procedural drawings for model inference.
- Preserve chat tool calls, multiple choices, native usage, and runtime timings. Search documents with model embeddings when available, with an explicit keyword fallback otherwise.
- Persist held-out training examples for evaluation, import Parquet datasets, and export merged models as GGUF with an installed llama.cpp converter.

Regression tests cover these reliability changes without loading model weights. They do not establish GPU behavior or model quality. Published installers include changes only after a new release is built.

### Zaylo 3.2 features

| Subsystem | What Shipped |
| :--- | :--- |
| **Bundled LoftyDB Memory Engine** | Embedded, zero-dependency Go temporal vector database bundled per OS (`macOS arm64/x64`, `Windows x64/arm64`, `Linux x64/arm64`) for instant offline startup without global npm dependencies. |
| **Knowledge Graph Explorer** | Interactive high-DPI Canvas explorer with `Network`, `Cluster`, and `Timeline` modes, automated entity extraction, semantic `RELATED_TO` / `BUILT_WITH` / `CONTRADICTS` edge detection, inspector drawer, time-travel diffs, and rollbacks. |
| **Dual Storage Isolation** | Persistent memories, entity graphs, and searchable conversation transcripts live exclusively in LoftyDB (`zaylo_*` collections); model registries, telemetry, API keys, RAG chunks, and checkpoints remain in SQLite WAL. |
| **AI Personas & Themes** | Task-tuned Personas synced cleanly between management panels and Playground, paired with a monochrome high-contrast Light and Dark theme system. |
| **Inline Charts & Presentations** | Rich client-side chart synthesis (`bar`, `line`, `area`, `pie`) and exportable `.pptx` presentation generation rendered inline inside assistant responses. |
| **Forge Studio (Renamed from Library)** | Streamlined LoRA fine-tuning workspace with automated dataset validation, VRAM budget estimation, real-time loss telemetry, and one-click adapter merging. |

---

## Installers

The release workflow builds installers across macOS, Windows, and Linux with LoftyDB bundled. Check the release asset list for the versions and platforms actually published:

| Operating System | Architecture | Package Format | Release Artifact |
| :--- | :--- | :---: | :--- |
| **macOS** | Universal (Apple Silicon + Intel) | `.dmg` / `.zip` | [Releases — macOS Universal](https://github.com/loftytechlabs-dev/Zaylo/releases/latest) |
| **macOS** | Apple Silicon (M1–M4 `arm64`) | `.dmg` | [Releases — macOS arm64](https://github.com/loftytechlabs-dev/Zaylo/releases/latest) |
| **macOS** | Intel (`x86_64`) | `.dmg` | [Releases — macOS x64](https://github.com/loftytechlabs-dev/Zaylo/releases/latest) |
| **Windows** | Windows 10 / 11 (`x64` Setup) | `.exe` | [Zaylo Setup (Windows x64)](https://github.com/loftytechlabs-dev/Zaylo/releases/latest) |
| **Windows** | Windows 10 / 11 (`x64` Portable) | `.exe` | [Zaylo Portable (Windows x64)](https://github.com/loftytechlabs-dev/Zaylo/releases/latest) |
| **Linux** | `x86_64` | `.AppImage` | [Published Linux installers](https://github.com/loftytechlabs-dev/Zaylo/releases/latest) |
| **Linux** | Debian / Ubuntu (`x86_64`) | `.deb` | [Published Debian packages](https://github.com/loftytechlabs-dev/Zaylo/releases/latest) |

---

## System Architecture

Zaylo isolates high-frequency application telemetry from semantic AI memory and chat history across two specialized storage engines running alongside native inference runtimes:

```text
+-----------------------------------------------------------------------------------+
|                        ZAYLO WORKSPACE (Desktop App / CLI / Web)                  |
+-----------------------------------------------------------------------------------+
         |                              |                                |
         v                              v                                v
+------------------+       +-------------------------+       +----------------------+
| Fastify Gateway  |       | InferenceService        |       | LoftyDbProcessMgr    |
| :8080 /v1/*      |------>| - Priority Queue        |       | - Auto-resolves OS   |
| - OpenAI API     |       | - Auto-Recall Prompting |       |   bundled LoftyDB    |
| - Memory Graph   |       | - Hybrid RAG Injection  |       | - Managed / External |
| - LAN & Devices  |       +-------------------------+       +----------------------+
+------------------+          |                   |                      |
                              v                   v                      v
        +--------------------------+     +------------------+   +-------------------+
        | Compute Engines          |     | SQLite WAL Store |   | LoftyDB (Go)      |
        | - llama.cpp (Metal/CUDA/ |     | - Models & Check |   | :8090 /api/*      |
        |   Vulkan/AVX2 CPU)       |     |   points         |   | - zaylo_memories  |
        | - Diffusion Image Engine |     | - API Keys       |   | - zaylo_entities  |
        | - PyTorch LoRA Forge     |     | - Telemetry/Logs |   | - zaylo_relations |
        +--------------------------+     | - RAG Embeddings |   | - zaylo_convs     |
                                         +------------------+   +-------------------+
```

---

## LoftyDB Knowledge Graph Memory

Zaylo pairs `llama.cpp` inference with an embedded, pure-Go LoftyDB engine managed directly by [`LoftyDbProcessManager`](packages/inference/src/loftydb/LoftyDbProcessManager.ts) and orchestrated by [`MemoryEngine`](packages/inference/src/memory/MemoryEngine.ts):

* **Automatic Extraction & Hybrid Recall**: Captures durable preferences, profile facts, project context, and instructions from conversations, recalling top memories via 128-dimensional trigram cosine similarity combined with lexical overlap, importance weights, and pinned-rule boosts.
* **Interactive Knowledge Graph (`Network`, `Cluster`, `Timeline`)**: High-DPI Canvas visualization with physics simulation (`Force-Directed`, `Concentric Hubs`, `Compact Grid`), cluster collapse/expand, chronological timeline scrubbing, multi-select lasso/components, minimap viewport navigation, and keyboard shortcuts (`/`, `F`, `Space`, `1/2/3`, `Cmd/Ctrl+Z`).
* **Graph Intelligence & Hygiene**: Automatically extracts technology, tool, and project entities (`zaylo_entities`), computes semantic (`RELATED_TO`), provenance (`DERIVED_FROM`, `OCCURRED_DURING`), stack (`BUILT_WITH`, `ABOUT`), and conflict (`CONTRADICTS`) links (`zaylo_relationships`), detects near-duplicate memories for confirmed user-approved merges, and surfaces isolated nodes.
* **Temporal Versioning & Rollbacks**: Every memory mutation is recorded transactionally on disk with nanosecond timestamps, letting users inspect field-level version diffs, query historical `AS OF` snapshots, and roll back any memory cleanly.
* **Built-In DB Workbench**: Inspect raw collections, run native SQL (`SELECT ... JOIN ... WHERE`), MongoDB-style NoSQL JSON filters, vector similarity queries, and watch real-time Server-Sent Events (SSE) mutation streams directly inside Zaylo.

---

## Visual Interface

### System Overview & Live Hardware Telemetry
Unified memory distribution, active model status, runtime toggles, and real-time throughput metrics.

<p align="center">
  <img src="assets/screenshots/overview.png" alt="Zaylo Overview Dashboard" width="100%" />
</p>

### Task-Aware Model Registry & LoftyDB Navigation
Capability classification across Text, Vision, Image Generation, and Fine-Tuned LoRA adapters alongside dedicated access to Personas, LoftyDB Knowledge Graph, and Forge.

<p align="center">
  <img src="assets/screenshots/models.png" alt="Zaylo 3.2 Model Registry" width="100%" />
</p>

### Playground with Generative Visualizations, Memory Recall & RAG
Inline chart synthesis, streaming markdown output, token speed telemetry, and per-turn RAG and LoftyDB Memory toggles.

<p align="center">
  <img src="assets/screenshots/playground.png" alt="Zaylo Playground with Chart Rendering and LoftyDB Memory" width="100%" />
</p>

### Forge Fine-Tuning Studio
Dataset ingestion, LoRA parameter estimation, real-time training loss curves, validation checks, and adapter management.

<p align="center">
  <img src="assets/screenshots/forge.png" alt="Zaylo Forge Fine-Tuning Studio" width="100%" />
</p>

### OpenAI-Compatible API Gateway & Mobile LAN Chat
Zero-config local server, QR mobile pairing, scoped API keys, and interactive client snippets for `cURL`, `Python`, and `Node.js`.

<p align="center">
  <img src="assets/screenshots/server.png" alt="Zaylo Server and LAN API Gateway" width="100%" />
</p>

---

## Core Capabilities

### 1. Task-Aware Model Dispatch
* **Text Generation**: Llama 3.2, Qwen 2.5, Mistral, DeepSeek, Gemma, Phi, and SmolLM2 in quantized GGUF format.
* **Multimodal Vision**: Vision-language architectures (`Qwen 2.5-VL`, `SmolVLM`) with automatic `mmproj` pairing.
* **Local Diffusion**: Stable Diffusion, Tiny SD, and SDXL pipelines in SafeTensors with step callbacks and aspect presets.
* **Fine-Tuned Adapters**: LoRA checkpoints trained inside Forge linked cleanly to base models.

### 2. Cross-Platform Acceleration & Diagnostics
* **Native Compute Backends**: Apple Silicon Metal unified memory, NVIDIA CUDA, Vulkan compute, and multi-threaded CPU SIMD (`AVX2` / `AVX-512`).
* **Exact Binary Memory Telemetry**: Reports physical RAM in GiB alongside active wired/compressed memory allocations and GPU VRAM offload metrics.

Automatic llama.cpp installation uses the pinned upstream release's platform assets: Metal on macOS, detected CUDA on Windows, detected Vulkan on supported x64 hosts, and CPU otherwise. Linux CUDA requires a compatible `llama-server` installed on PATH. Unsupported architecture/backend combinations report an installation error. A backend's availability does not guarantee model support or a particular speed.

The managed runtime is pinned to llama.cpp b5200, which fixes the b4800 shutdown abort. Existing b4800 installations must be reinstalled through the runtime installer to receive the corrected binary. The managed b5200 server runs in chat mode. Its exclusive embedding mode disables completions, so `/v1/embeddings` returns `503 EMBEDDINGS_UNAVAILABLE` and document retrieval uses the explicit keyword fallback. Semantic embeddings require a runtime that can provide them without disabling chat.

---

## Dynamic Playground and Generative UI

* **Multi-Turn Streaming & Telemetry**: Live prompt processing throughput, tokens/sec generation speed, TTFT latency, and memory footprint.
* **Generative Charts & Slides**: Structured chart rendering (`pie`, `bar`, `line`, `area`) with theme customization and `.pptx` presentation deck exports.
* **LoftyDB Long-Term Memory + Document RAG**: Toggle long-term memory recall (`zaylo_memories`) and hybrid BM25 + dense vector document retrieval (`local-ai.sqlite`) independently per chat turn.
* **Side-by-Side Comparison**: Benchmark base checkpoints against LoRA adapters on identical prompts.

---

## Forge Fine-Tuning Studio

Training requires local Hugging Face checkpoint weights and Python with PyTorch, Transformers, and PEFT. Parquet import also requires PyArrow in that environment. Set `ZAYLO_PYTHON` to select its interpreter. Held-out validation requires a nonzero validation split and enough examples to keep training and validation separate. Evaluation reports held-out loss when available, normalized exact-match accuracy, and token F1.

GGUF export first merges an adapter, then invokes llama.cpp's `convert_hf_to_gguf.py` with its Python requirements installed in the selected environment. Set `ZAYLO_GGUF_CONVERTER` to that script or `LLAMA_CPP_DIR` to the llama.cpp checkout. Export creates F16 GGUF weights; it does not silently install dependencies or quantize them.

```text
+-----------------------+     Auto-Validation     +----------------------------+
|  Training Dataset     |  ====================>  |  LoRA Parameter Estimator  |
|  (JSONL / CSV / Parq) |   Format & Duplicate    |  - Rank (r) & Alpha        |
+-----------------------+   Filtering             |  - VRAM Budget Validation  |
                                                  +----------------------------+
                                                                |
+-----------------------+     Real-Time Training                v
|  Fine-Tuned Adapter   |  <====================  +----------------------------+
|  - Standalone GGUF    |   Loss Convergence &    |  Local PyTorch / MPS / CUDA|
|  - Merged Weights     |   Checkpoints           |  Training Worker           |
+-----------------------+                         +----------------------------+
```

---

## OpenAI and Memory API Server

Zaylo exposes an OpenAI-compatible HTTP server (`http://127.0.0.1:8080/v1`, or your local LAN IP when LAN sharing is enabled).

The supported OpenAI routes are `/v1/models`, `/v1/chat/completions`, `/v1/embeddings`, and `/v1/images/generations`. Chat supports streamed and non-streamed choices, tool-call messages, and upstream usage. Tool execution belongs to the client. Responses API, Assistants, audio, and other OpenAI services are not implemented. Image generation requires an installed diffusion model and Python dependencies; unavailable engines or models return errors.

Image dimensions must be multiples of 64 from 256 through 1024 pixels on each axis. Unsupported sizes are rejected rather than silently resized.

Local mode binds to loopback. LAN mode requires an API key for protected routes, including requests made from loopback. Zaylo stores inference data locally; downloading model weights, runtimes, or checkpoints requires network access. Select trusted model files and Python model code.

### Chat Completions with Memory & RAG (`POST /v1/chat/completions`)

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key="lcl_your_api_key",
)

response = client.chat.completions.create(
    model="default",
    messages=[
        {"role": "system", "content": "You are an expert systems engineer."},
        {"role": "user", "content": "Explain zero-copy buffers in modern OS kernels."},
    ],
    temperature=0.7,
    stream=True,
    extra_body={"memory": True, "rag": True},
)

for chunk in response:
    delta = chunk.choices[0].delta.content
    if delta:
        print(delta, end="", flush=True)
print()
```

### Knowledge Graph & Long-Term Memory API (`/v1/memories*`)

```bash
# 1. Store a versioned memory (extracts entities & relationships automatically)
curl -X POST http://localhost:8080/v1/memories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer lcl_your_api_key" \
  -d '{
    "content": "Primary API runs on Fastify with TypeScript and LoftyDB.",
    "category": "project",
    "importance": 5,
    "pinned": true
  }'

# 2. Retrieve the full property Knowledge Graph + Intelligence diagnostics
curl http://localhost:8080/v1/memories/graph \
  -H "Authorization: Bearer lcl_your_api_key"

# 3. Semantic hybrid memory recall
curl -X POST http://localhost:8080/v1/memories/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer lcl_your_api_key" \
  -d '{"query": "backend framework and storage", "limit": 5}'
```

### Diffusion Image Generation (`POST /v1/images/generations`)

```bash
curl http://localhost:8080/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer lcl_your_api_key" \
  -d '{
    "model": "tiny-sd",
    "prompt": "Minimalist architectural concrete pavilion at twilight, high detail",
    "size": "512x512",
    "n": 1,
    "response_format": "b64_json"
  }'
```

---

## Hardware Benchmarks

Run the desktop benchmark on the hardware and model you plan to use. A warmup pass precedes the measured request. Prompt and generation rates come from llama.cpp's native evaluated-token counts and durations, not stream chunk counts or an assumed prompt length. First-token latency is measured at the first content or tool-call chunk.

Memory is the peak resident inference-process RAM sampled during the request. GPU VRAM is separate, and unavailable process readings are marked unavailable. Historic results produced by the old estimator remain in storage but are labeled as legacy estimates in the interface.

The previous hardware table had no accompanying raw records and has been removed. No cross-hardware performance guarantee is made. The corrected benchmark requires runtime verification before publishing new measurements.

---

## Monorepo Architecture

```text
apps/
  desktop/
    electron/
      loftydb/     Managed LoftyDB IPC handlers and lifecycle hooks
      forge/       Local Python environment & LoRA training runners
      image/       Desktop import of the shared diffusion engine
    resources/
      loftydb/     Bundled native Go binaries (macOS, Windows, Linux)
    src/features/
      loftydb/     Knowledge Graph Explorer (Network / Cluster / Timeline), DB Workbench
      personas/    AI Persona manager & Playground selector
      presentations/  Interactive slide preview & PPTX export
      visualizations/ Chart engine (Bar, Line, Area, Pie)
  vscode/          Zaylo VS Code IDE extension
cli/               Headless CLI daemon (`zaylo start`, `zaylo status`, `zaylo models`)
packages/
  capabilities/    Model capability classifier and dispatch planner
  database/        SQLite WAL repositories (models, checkpoints, devices, settings)
  hardware/        Cross-OS CPU, GPU, unified memory, and RAM scanner
  inference/
    src/loftydb/   Native HTTP client + cross-OS LoftyDB process supervisor
    src/memory/    Semantic MemoryEngine, entity extractor, and conflict/merge intelligence
    src/image/     Shared desktop/CLI diffusion worker and process manager
  models/          Hugging Face Hub downloader, SHA-256 verifier, GGUF parser
  monitoring/      Telemetry sampler and structured logs
  network/         LAN interface detection, QR pairing, device trust store
  protocol/        End-to-end typed Electron IPC and REST contracts
  runtime-llama/   Managed llama-server runtime supervisor
  runtimes/        Runtime interfaces and task abstractions
  security/        API key generation and secret redaction
  server/          Fastify OpenAI + Memory Graph API gateway
  shared/          Shared types, schemas, and cross-OS path helpers
```

---

## Cross-Platform Build and Packaging

### Prerequisites
* Node.js `>= 22.0.0`
* pnpm `>= 11.24.0`
* Python `>= 3.10` (optional — for Forge LoRA fine-tuning and diffusion image synthesis)
* Native toolchain for Electron native addons if rebuilding from source (`Xcode Command Line Tools` on macOS, `MSVC` on Windows, `build-essential` + `libgbm-dev` + `libarchive-tools` on Ubuntu/Debian)

### Build from Source (macOS / Windows / Linux)

```bash
# 1. Clone Zaylo (includes pre-compiled cross-OS LoftyDB binaries)
git clone https://github.com/loftytechlabs-dev/Zaylo.git
cd Zaylo

# 2. Install dependencies
pnpm install

# 3. Build all 16 workspace packages
pnpm build

# 4. Run the full regression suite and type checks
pnpm test
pnpm typecheck

# Optional: exercise real CPU generation with an installed runtime and local GGUF
node tests/smoke_runtime.mjs /path/to/runtime /path/to/model.gguf

# 5. Launch Desktop in development mode
pnpm dev:desktop
```

### Package Cross-OS Installers

```bash
pnpm --filter @local-ai/desktop dist        # Package for host operating system
pnpm dist:mac                               # Package macOS .dmg and .zip (Universal / arm64 / x64)
pnpm dist:win                               # Package Windows Setup and Portable .exe (x64)
pnpm dist:linux                             # Package Linux .AppImage and .deb (x64)
```

Note on macOS, Windows, and Linux CI releases: pushing a tag matching `v*` triggers `.github/workflows/release.yml` across `macos-latest`, `windows-latest`, and `ubuntu-latest`, running `pnpm build`, automated cross-OS integration checks (`tests/loftydb_memory.test.ts`, `tests/capabilities.test.ts`, `tests/theme.test.ts`, `tests/creations_and_visualizations.test.ts`), and native installer packaging.

---

Runtime verification results and remaining hardware limits are recorded in [PR 8 runtime verification](docs/pr8-runtime-verification.md).

## License

Distributed under the **MIT License**. Copyright (c) 2026 Lofty Tech Labs. See `LICENSE` for details.
