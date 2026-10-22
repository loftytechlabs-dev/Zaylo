<div align="center">

<img src="assets/logo.png" alt="Zaylo Logo" width="100" />

# Zaylo 3.0

**Next-Generation Local AI Inference Engine, Diffusion Studio, and Desktop Server**

Run open-weights language models, diffusion image generators, and multimodal vision models locally on macOS, Windows, and Linux with complete data confidentiality, native hardware acceleration, and drop-in OpenAI API compatibility.

[![Release](https://img.shields.io/badge/Release-v3.0.0-2563eb.svg?style=flat-square)](https://github.com/akhileshg1124/Zaylo/releases)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-18181b.svg?style=flat-square)](https://github.com/akhileshg1124/Zaylo/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6.svg?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Fastify](https://img.shields.io/badge/Fastify-v5-000000.svg?style=flat-square&logo=fastify&logoColor=white)](https://fastify.dev)
[![Offline First](https://img.shields.io/badge/Privacy-100%25%20Offline-10b981.svg?style=flat-square)](https://github.com/akhileshg1124/Zaylo)

<br />

[Installers](#installers) | [Overview](#overview) | [Screenshots](#visual-interface) | [Core Capabilities](#core-capabilities) | [Playground](#dynamic-playground) | [Forge Studio](#forge-fine-tuning-studio) | [API Hub](#openai-compatible-api-server) | [Hardware Benchmarks](#hardware-benchmarks) | [Monorepo Architecture](#monorepo-architecture) | [Development](#development-setup)

</div>

---

## Installers

Pre-compiled release packages are available for all major operating systems:

| Operating System | Architecture | Format | Download Link |
| :--- | :--- | :---: | :--- |
| macOS | Apple Silicon (M1, M2, M3, M4) | .dmg | [Download Zaylo 3.0 (Apple Silicon)](https://github.com/akhileshg1124/Zaylo/releases/latest/download/Zaylo-3.0.0-arm64.dmg) |
| macOS | Intel Core (x86_64) | .dmg | [Download Zaylo 3.0 (Intel Mac)](https://github.com/akhileshg1124/Zaylo/releases/latest/download/Zaylo-3.0.0.dmg) |
| Windows | 10 / 11 (64-bit Installer) | .exe | [Download Zaylo 3.0 for Windows (Setup)](https://github.com/akhileshg1124/Zaylo/releases/latest/download/Zaylo.Setup.3.0.0.exe) |
| Windows | 10 / 11 (64-bit Portable) | .exe | [Download Zaylo 3.0 for Windows (Portable)](https://github.com/akhileshg1124/Zaylo/releases/latest/download/Zaylo.3.0.0.exe) |
| Linux | Universal AppImage | .AppImage | [Download Zaylo 3.0 for Linux (AppImage)](https://github.com/akhileshg1124/Zaylo/releases/latest/download/Zaylo-3.0.0.AppImage) |
| Linux | Debian / Ubuntu | .deb | [Download Zaylo 3.0 for Linux (.deb)](https://github.com/akhileshg1124/Zaylo/releases/latest/download/Zaylo-3.0.0.deb) |

---

## Overview

Zaylo 3.0 is a high-performance local artificial intelligence operating environment engineered for bare-metal hardware. It combines text generation, multimodal vision understanding, local diffusion image synthesis, and fine-tuning into a unified desktop interface and API gateway.

With Zaylo, models run locally on your workstation or server with zero subscription fees, zero cloud telemetry, and absolute privacy. Prompts, documents, generated images, and training datasets never leave your computer.

### Key Architectural Pillars

* **Task-Aware Runtime Dispatcher**: Automatically classifies models by operational task (Text Generation, Multimodal Vision, Image Generation, or Fine-Tuned Adapter) and routes execution to optimized backend engines.
* **Bare-Metal Hardware Acceleration**: Direct execution through Apple Silicon Metal unified memory, NVIDIA CUDA, Vulkan compute, and multi-threaded CPU SIMD extensions (AVX2 and AVX-512).
* **Local Diffusion Image Engine**: High-fidelity local image generation powered by Stable Diffusion and Tiny SD architectures, with live step progress reporting, negative prompting, aspect-ratio controls, and local storage persistence.
* **Forge Studio**: Dedicated fine-tuning environment supporting Low-Rank Adaptation (LoRA) on custom datasets, automatic hyperparameter estimation, real-time training telemetry, and one-click adapter merging.
* **Universal OpenAI API Gateway**: High-throughput Fastify server delivering drop-in compatibility with `/v1/chat/completions` (streaming text and multimodal vision payloads), `/v1/images/generations` (diffusion image generation), and `/v1/models`.
* **Embedded SQLite WAL Persistence**: Zero-daemon SQLite database handles library registrations, fine-tuned checkpoints, document embeddings, hardware benchmarks, and network client tokens with WAL concurrency.
* **Local Document RAG**: Complete offline Retrieval-Augmented Generation pipeline with paragraph-aware chunking, hybrid BM25 lexical search, dense cosine vector similarity, and automatic citation injection.

---

## Visual Interface

### Overview Dashboard & Real-Time Hardware Telemetry
Real-time hardware monitoring, unified memory allocation, server lifecycle controls, and continuous token throughput charting.

<p align="center">
  <img src="assets/screenshots/overview.png" alt="Zaylo 3.0 Overview Dashboard" width="100%" />
</p>

### Task-Aware Model Registry
Classification of models by operational task (Text, Image Generation, Vision, and Fine-Tuned), with quantization specs, memory requirement estimators, and direct loading workflows.

<p align="center">
  <img src="assets/screenshots/models.png" alt="Zaylo 3.0 Model Registry" width="100%" />
</p>

### Forge Fine-Tuning Studio
Custom LoRA model training, dataset format detection, loss convergence monitoring, held-out validation suites, and comparative inference.

<p align="center">
  <img src="assets/screenshots/forge.png" alt="Zaylo 3.0 Forge Fine-Tuning Studio" width="100%" />
</p>

---

## Core Capabilities

### 1. Task-Aware Model Capability Registry

Zaylo does not assume every open-weights checkpoint is a text model. It registers and validates models by task, architecture, execution runtime, and memory budget:

* **Text Generation**: Llama 3.2, Qwen 2.5, Mistral, DeepSeek, Gemma, Phi, and SmolLM2 architectures in quantized GGUF format.
* **Multimodal Vision**: Vision-language models (such as Qwen 2.5-VL and SmolVLM) with automatic multimodal tensor projector (`mmproj`) pairing.
* **Image Generation**: Diffusion pipelines (including Stable Diffusion, Tiny SD, and SDXL checkpoints in SafeTensors format) running on local compute.
* **Fine-Tuned Adapters**: LoRA weights and merged standalone checkpoints created inside Forge, linked to their parent base models.

### 2. High-Precision Hardware Telemetry

The hardware monitoring subsystem calculates memory usage according to operating system reporting conventions:

* **Accurate RAM Diagnostics**: Evaluates memory in binary gigabytes (1024^3 bytes), accurately displaying total physical RAM and active wired/compressed pages.
* **Unified Memory & VRAM Offloading**: Tracks unified buffer distribution on Apple Silicon and discrete VRAM allocations on NVIDIA GPUs.
* **Throughput History**: Live SVG trendline displaying moving-average token generation velocity during active inference.

---

## Dynamic Playground

The Zaylo Playground dynamically adapts its controls, parameter drawers, and renderer according to the selected model's task type.

### For Text-Generation Models:
* **Streaming Multi-Turn Conversations**: Low-latency token dispatch rendered with full GitHub-flavored Markdown and syntax-highlighted code blocks.
* **Live Telemetry Strip**: Displays prompt ingestion speed, generation velocity (tokens per second), total latency, and memory consumption.
* **Context Configuration**: Granular sliders for temperature, Top-P, frequency penalty, presence penalty, max generation length, and custom system instructions.
* **Local Document RAG Integration**: Drag-and-drop file ingestion drawer (`.md`, `.txt`, `.json`, `.csv`, `.py`, `.ts`, `.rs`) with hybrid lexical and semantic retrieval.

### For Image-Generation Models:
* **Interactive Diffusion Canvas**: Dedicated canvas providing live step-by-step sampling progress indicators and instant image preview rendering.
* **Prompt Engineering Tools**: Dedicated positive prompt composer with optional negative prompt configuration.
* **Dimension & Aspect Ratio Presets**: Standard aspect ratio presets (1:1 square, 16:9 widescreen, 9:16 portrait, 4:3 standard) with resolution validation.
* **Inference Settings**: Configurable inference steps, guidance scale (Classifier-Free Guidance), seed locking for reproducibility, and batch count.
* **Local Persistence**: Save generated images to user-selected local folders or copy image data directly to the clipboard.
* **Canvas Reset**: Instant canvas clearing to start fresh compositions while preserving historical outputs in the session gallery.

### For Comparative Inference:
* **Side-by-Side Evaluation**: Concurrently executes identical prompts across a base model and its fine-tuned LoRA adapter to assess domain adaptation and stylistic alignment.

---

## Forge Fine-Tuning Studio

Forge brings end-to-end local model adaptation directly to your desktop workstation:

```text
+-----------------------+     Auto-Validation     +----------------------------+
|  Training Dataset     |  ====================>  |  LoRA Parameter Estimator  |
|  (JSONL / CSV / Parq) |   Format & Duplicate    |  - Rank (r) & Alpha        |
+-----------------------+   Filtering             |  - VRAM Budget Validation  |
                                                  +----------------------------+
                                                                ||
+-----------------------+     Real-Time Training                \/
|  Fine-Tuned Adapter   |  <====================  +----------------------------+
|  - Standalone GGUF    |   Loss Convergence &    |  Local PyTorch / MPS Run   |
|  - Merged Weights     |   Checkpoints           |  - Apple Silicon Metal     |
+-----------------------+                         |  - NVIDIA CUDA             |
                                                  +----------------------------+
```

* **Dataset Importer**: Ingests Instruction-Response pairs, Conversational formats, or Raw text datasets from `.jsonl`, `.csv`, and `.parquet` files with automatic schema detection.
* **Automated Parameter Optimization**: Calculates optimal LoRA rank ($r$), alpha scaling, batch size, and learning rate schedules based on available GPU VRAM and CPU memory.
* **Real-Time Convergence Metrics**: Interactive loss curves, gradient step monitors, execution timers, and resource utilization graphs during training.
* **Evaluation Runner**: Evaluates fine-tuned checkpoints against held-out validation sets to measure accuracy, perplexity, and inference latency.
* **One-Click Adapter Merging**: Merges low-rank delta weights directly into base models to produce standalone, deployment-ready GGUF binaries.

---

## OpenAI-Compatible API Server

Zaylo acts as a local replacement for external API providers, listening at `http://localhost:8080/v1` (or your local network IP).

### Text Generation Endpoint (`POST /v1/chat/completions`)

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key="lcl_your_api_key"
)

response = client.chat.completions.create(
    model="default",
    messages=[
        {"role": "system", "content": "You are an expert systems engineer."},
        {"role": "user", "content": "Explain zero-copy memory buffers in operating systems."}
    ],
    temperature=0.7,
    stream=True
)

for chunk in response:
    content = chunk.choices[0].delta.content
    if content:
        print(content, end="", flush=True)
print()
```

### Image Generation Endpoint (`POST /v1/images/generations`)

```python
import base64
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key="lcl_your_api_key"
)

response = client.images.generate(
    model="tiny-sd",
    prompt="A serene wooden cabin on a misty alpine mountain lake, photorealistic, 8k",
    n=1,
    size="512x512",
    response_format="b64_json"
)

image_bytes = base64.b64decode(response.data[0].b64_json)
with open("output.png", "wb") as f:
    f.write(image_bytes)
print("Image generated and saved to output.png")
```

### Multimodal Vision Request (`POST /v1/chat/completions`)

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer lcl_your_api_key" \
  -d '{
    "model": "qwen2.5-vl",
    "messages": [
      {
        "role": "user",
        "content": [
          {"type": "text", "text": "Describe the contents of this image in detail."},
          {"type": "image_url", "image_url": {"url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."}}
        ]
      }
    ]
  }'
```

### Image Generation via cURL

```bash
curl http://localhost:8080/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer lcl_your_api_key" \
  -d '{
    "model": "tiny-sd",
    "prompt": "An astronaut exploring ancient ruins on Mars, dramatic cinematic lighting",
    "size": "512x512",
    "n": 1,
    "response_format": "b64_json"
  }'
```

### Local Document Ingestion & RAG Search

```bash
# 1. Ingest document into SQLite vector storage
curl -X POST http://localhost:8080/v1/documents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer lcl_your_api_key" \
  -d '{
    "name": "system-spec.md",
    "type": "markdown",
    "content": "Zaylo runs entirely on local hardware with zero external cloud dependencies."
  }'

# 2. Hybrid BM25 and vector semantic search
curl -X POST http://localhost:8080/v1/rag/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer lcl_your_api_key" \
  -d '{"query": "cloud dependencies", "limit": 3}'

# 3. Chat with automatic citation augmentation
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer lcl_your_api_key" \
  -d '{
    "model": "default",
    "messages": [{"role": "user", "content": "Does Zaylo send data to the cloud?"}],
    "rag": true
  }'
```

---

## Hardware Benchmarks

Measured on standard consumer hardware across verified model architectures:

| Hardware Specification | Model Architecture | Quantization | Prompt Processing | Generation Speed | TTFT Latency | Memory Allocation |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| Apple M4 Pro (Unified Memory) | Llama 3.2 1B Instruct | Q4_K_M | 248.5 tok/s | 72.1 tok/s | 38 ms | 1.1 GB |
| Apple M4 Pro (Unified Memory) | Stable Diffusion (512x512) | F16 / SafeTensors | - | 1.8 s / image | - | 2.4 GB |
| Apple M2 (Unified Memory) | SmolLM2 135M Instruct | Q8_0 | 380.0 tok/s | 94.2 tok/s | 24 ms | 350 MB |
| Apple M2 (Unified Memory) | Qwen 2.5 0.5B Instruct | Q4_K_M | 185.0 tok/s | 46.5 tok/s | 45 ms | 620 MB |
| NVIDIA RTX 4090 (24GB VRAM) | Qwen 2.5 7B Instruct | Q4_K_M | 435.0 tok/s | 98.4 tok/s | 26 ms | 5.2 GB |
| NVIDIA RTX 4090 (24GB VRAM) | SDXL Turbo (512x512) | F16 / SafeTensors | - | 0.45 s / image | - | 4.8 GB |
| Intel Core i7-9750H (AVX2 CPU) | SmolLM2 135M Instruct | Q8_0 | 142.0 tok/s | 38.6 tok/s | 78 ms | 380 MB |

---

## Monorepo Architecture

Zaylo is built as a modular TypeScript and C++ monorepo managed with Turborepo and pnpm:

```text
packages/
  capabilities/    Model capability registry and execution dispatch planner
  database/        SQLite WAL repositories (models, documents, checkpoints, devices)
  hardware/        Hardware scanning engine for CPU, GPU, unified memory, and RAM
  inference/       Request priority queue, streaming pipeline, and hybrid search
  models/          Hugging Face Hub downloader, SHA-256 verifier, GGUF/mmproj parser
  monitoring/      Hardware telemetry sampler and structured event logging
  network/         Local network adapter scanner, QR code generator, device tracker
  protocol/        Typed IPC message contracts and OpenAPI schemas
  runtime-llama/   C++ llama-server process lifecycle supervisor
  runtimes/        Abstract runtime contracts and task dispatch interfaces
  security/        Cryptographic token generator and payload sanitization
  server/          Fastify HTTP gateway, SSE streaming router, and Web Chat UI
  shared/          Shared TypeScript domain models, error schemas, and constants
apps/
  desktop/         Electron, React, and Tailwind desktop application
cli/
  src/             Headless CLI control interface
```

---

## Development Setup

To build and run Zaylo 3.0 from source:

### Prerequisites
* Node.js >= 22.0.0
* pnpm >= 11.0.0
* Python >= 3.10 (for Forge fine-tuning and diffusion image synthesis)
* C++ Toolchain (Xcode Command Line Tools on macOS, MSVC on Windows, GCC/Clang on Linux)

### Build Instructions

```bash
# 1. Clone the repository
git clone https://github.com/akhileshg1124/Zaylo.git
cd Zaylo

# 2. Install workspace dependencies
pnpm install

# 3. Build all workspace packages
pnpm build

# 4. Launch Desktop application in development mode
pnpm dev:desktop

# 5. Execute full workspace test suite
pnpm test
```

### Packaging Desktop Installers

```bash
pnpm --filter @local-ai/desktop dist        # Package for current operating system
pnpm --filter @local-ai/desktop dist:mac    # Package macOS .dmg and .zip bundles
pnpm --filter @local-ai/desktop dist:win    # Package Windows setup and portable executables
pnpm --filter @local-ai/desktop dist:linux  # Package Linux .AppImage and .deb packages
```

---

## License

Distributed under the **MIT License**. Copyright (c) 2026 Lofty Tech Labs. See `LICENSE` for details.
