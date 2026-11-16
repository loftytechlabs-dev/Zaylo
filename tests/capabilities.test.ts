import { describe, it, expect } from 'vitest';
import { CapabilityEngine, ModelCapabilityRegistry } from '@local-ai/capabilities';
import type { HardwareProfile, ModelVariant, Model, ModelInstallation } from '@local-ai/shared';
import { ImageGenerationRequestSchema } from '@local-ai/shared';

describe('CapabilityEngine', () => {
  const mockHardware: HardwareProfile = {
    platform: 'darwin',
    osRelease: '24.0.0',
    hostname: 'test-mac',
    cpu: {
      model: 'Apple M3 Max',
      architecture: 'arm64',
      physicalCores: 14,
      logicalThreads: 14,
    },
    memory: {
      totalBytes: 36 * 1024 * 1024 * 1024, // 36 GB
      availableBytes: 24 * 1024 * 1024 * 1024, // 24 GB
      usedBytes: 12 * 1024 * 1024 * 1024,
    },
    gpus: [
      {
        vendor: 'Apple',
        model: 'Apple M3 Max',
        vramBytes: 36 * 1024 * 1024 * 1024,
        backend: 'metal',
        isIntegrated: true,
      },
    ],
    disks: [
      {
        mount: '/',
        totalBytes: 1000 * 1024 * 1024 * 1024,
        availableBytes: 500 * 1024 * 1024 * 1024,
        usedBytes: 500 * 1024 * 1024 * 1024,
      },
    ],
    detectedAt: Date.now(),
  };

  it('should analyze hardware and produce high capability profile for 36GB M3', () => {
    const caps = CapabilityEngine.analyzeHardware(mockHardware);

    expect(caps.hasHardwareAcceleration).toBe(true);
    expect(caps.supportedBackends).toContain('metal');
    expect(caps.maxRecommendedContext).toBe(32768);
    expect(caps.memoryBudgetBytes).toBeGreaterThan(30 * 1024 * 1024 * 1024);
  });

  it('should evaluate 3B model as Excellent on 36GB hardware', () => {
    const caps = CapabilityEngine.analyzeHardware(mockHardware);
    const variant: ModelVariant = {
      id: 'llama-3.2-3b-q4',
      name: 'Llama 3B',
      quantization: 'Q4_K_M',
      format: 'gguf',
      sizeBytes: 2 * 1024 * 1024 * 1024,
      downloadUrl: 'https://example.com/model.gguf',
      contextLength: 8192,
      estimatedRAMBytes: 3.2 * 1024 * 1024 * 1024,
      estimatedVRAMBytes: 2.6 * 1024 * 1024 * 1024,
      gpuLayers: 32,
    };

    const analysis = CapabilityEngine.evaluateModelCompatibility(variant, caps);
    expect(analysis.rating).toBe('Excellent');
    expect(analysis.canFitInVRAM).toBe(true);
    expect(analysis.reason).toContain('GPU memory');
  });

  it('should evaluate model exceeding memory as Unsupported', () => {
    const caps = CapabilityEngine.analyzeHardware(mockHardware);
    const hugeVariant: ModelVariant = {
      id: 'huge-70b-f16',
      name: 'Huge 70B F16',
      quantization: 'F16',
      format: 'gguf',
      sizeBytes: 140 * 1024 * 1024 * 1024, // 140 GB
      downloadUrl: 'https://example.com/huge.gguf',
      contextLength: 4096,
      estimatedRAMBytes: 150 * 1024 * 1024 * 1024,
      estimatedVRAMBytes: 140 * 1024 * 1024 * 1024,
      gpuLayers: 80,
    };

    const analysis = CapabilityEngine.evaluateModelCompatibility(hugeVariant, caps);
    expect(analysis.rating).toBe('Unsupported');
    expect(analysis.reason).toContain('exceeds total system memory');
  });

  it('should support 7B model on 8GB machine when Low-Memory Mode is enabled', () => {
    const lowRamHardware: HardwareProfile = {
      ...mockHardware,
      memory: {
        totalBytes: 8 * 1024 * 1024 * 1024, // 8 GB
        availableBytes: 3.5 * 1024 * 1024 * 1024, // 3.5 GB
        usedBytes: 4.5 * 1024 * 1024 * 1024,
      },
      gpus: [
        {
          vendor: 'Apple',
          model: 'Apple M2',
          vramBytes: 8 * 1024 * 1024 * 1024,
          backend: 'metal',
          isIntegrated: true,
        },
      ],
    };

    const caps = CapabilityEngine.analyzeHardware(lowRamHardware);
    const variant7B: ModelVariant = {
      id: 'mistral-7b-q4',
      name: 'Mistral 7B',
      quantization: 'Q4_K_M',
      format: 'gguf',
      sizeBytes: 4.3 * 1024 * 1024 * 1024, // 4.3 GB
      downloadUrl: 'https://example.com/mistral.gguf',
      contextLength: 4096,
      estimatedRAMBytes: 5.5 * 1024 * 1024 * 1024,
      estimatedVRAMBytes: 5.0 * 1024 * 1024 * 1024,
      gpuLayers: 33,
    };

    // Standard mode: Not recommended because 5.5GB exceeds 3.5GB available
    const standardAnalysis = CapabilityEngine.evaluateModelCompatibility(variant7B, caps, { lowMemoryMode: false });
    expect(standardAnalysis.rating).toBe('Not recommended');

    // Low-Memory mode: Supported with Flash Attention
    const lowMemAnalysis = CapabilityEngine.evaluateModelCompatibility(variant7B, caps, { lowMemoryMode: true });
    expect(['Excellent', 'Good']).toContain(lowMemAnalysis.rating);
    expect(lowMemAnalysis.reason).toContain('Low-Memory Mode');

    // 12B Model (7.8 GB size): normally Unsupported on 8GB machine, but supported in Low-Memory mode!
    const variant12B: ModelVariant = {
      id: 'nemotron-12b-q4',
      name: 'Nemotron 12B',
      quantization: 'Q4_K_M',
      format: 'gguf',
      sizeBytes: 7.8 * 1024 * 1024 * 1024,
      downloadUrl: 'https://example.com/nemotron.gguf',
      contextLength: 4096,
      estimatedRAMBytes: 9.2 * 1024 * 1024 * 1024,
      estimatedVRAMBytes: 8.5 * 1024 * 1024 * 1024,
      gpuLayers: 40,
    };

    const std12B = CapabilityEngine.evaluateModelCompatibility(variant12B, caps, { lowMemoryMode: false });
    expect(std12B.rating).toBe('Unsupported');

    const lowMem12B = CapabilityEngine.evaluateModelCompatibility(variant12B, caps, { lowMemoryMode: true });
    expect(lowMem12B.rating).toBe('Good');
    expect(lowMem12B.reason).toContain('Low-Memory Mode');
  });
});

describe('ModelCapabilityRegistry & Image Generation Support', () => {
  it('correctly classifies image generation models vs vision understanding models', () => {
    // Image Generation Models
    const sdTurboModel: Partial<Model> = {
      id: 'sd-turbo',
      name: 'SD-Turbo',
      capabilities: ['IMAGE_GENERATION'],
    };
    expect(ModelCapabilityRegistry.resolveTaskType(sdTurboModel as Model)).toBe('image-generation');
    expect(ModelCapabilityRegistry.isImageGenerationModel(sdTurboModel as Model)).toBe(true);

    const sd15Installation: Partial<ModelInstallation> = {
      modelId: 'stable-diffusion-v1-5',
      name: 'Stable Diffusion v1.5',
      capabilities: ['IMAGE_GENERATION'],
    };
    expect(ModelCapabilityRegistry.resolveTaskType(sd15Installation as ModelInstallation)).toBe('image-generation');
    expect(ModelCapabilityRegistry.isImageGenerationModel(sd15Installation as ModelInstallation)).toBe(true);

    // Vision Understanding Model (Qwen 2.5 VL, LLaVA) - Must NEVER be classified as image-generation
    const visionModel: Partial<Model> = {
      id: 'qwen2.5-vl-7b',
      name: 'Qwen 2.5 VL 7B Instruct',
      capabilities: ['VISION'],
    };
    expect(ModelCapabilityRegistry.resolveTaskType(visionModel as Model)).toBe('vision');
    expect(ModelCapabilityRegistry.isImageGenerationModel(visionModel as Model)).toBe(false);

    // Text Generation Model
    const textModel: Partial<Model> = {
      id: 'llama-3.2-3b-instruct',
      name: 'Llama 3.2 3B Instruct',
      capabilities: ['CHAT', 'TEXT_GENERATION'],
    };
    expect(ModelCapabilityRegistry.resolveTaskType(textModel as Model)).toBe('text-generation');
    expect(ModelCapabilityRegistry.isImageGenerationModel(textModel as Model)).toBe(false);
  });

  it('provides verified capability profiles with parameters and runtime adapters', () => {
    const profile = ModelCapabilityRegistry.getProfile('sd-turbo');
    expect(profile).toBeDefined();
    expect(profile?.taskType).toBe('image-generation');
    expect(profile?.supportedRuntimes).toContain('diffusers');
    expect(profile?.supportedPlatforms).toContain('darwin');
    expect(profile?.accelerationOptions).toContain('mps');
    expect(profile?.imageParameters?.minSteps).toBe(1);
    expect(profile?.imageParameters?.defaultSteps).toBe(4);
    expect(profile?.imageParameters?.defaultGuidanceScale).toBe(1.0);
  });

  it('rejects unsupported dimensions without silently resizing them', () => {
    const res = ModelCapabilityRegistry.validateImageParameters('sd-turbo', {
      prompt: 'a majestic mountain landscape',
      width: 500,
      height: 700,
      steps: 100, // Exceeds max for sd-turbo (maxSteps: 10)
      guidanceScale: 15,
      seed: -5,
    });

    expect(res.valid).toBe(false);
    expect(res.sanitized.prompt).toBe('a majestic mountain landscape');
    expect(res.sanitized.width).toBe(500);
    expect(res.sanitized.height).toBe(700);
    expect(res.sanitized.steps).toBeLessThanOrEqual(10);
    expect(res.sanitized.seed).toBeGreaterThanOrEqual(0);
  });

  it('uses the same dimension limits at the API and engine boundaries', () => {
    for (const [width, height, accepted] of [[512, 768, true], [256, 1024, true], [2048, 2048, false], [64, 64, false], [264, 512, false], [0, 512, false]] as const) {
      expect(ImageGenerationRequestSchema.safeParse({ prompt: 'An apple', size: `${width}x${height}` }).success).toBe(accepted);
      const result = ModelCapabilityRegistry.validateImageParameters('tiny-sd', { prompt: 'An apple', width, height });
      expect(result.valid).toBe(accepted);
      expect(result.sanitized).toMatchObject({ width, height });
    }
  });

  it('estimates resource requirements accurately for diffusion architectures', () => {
    const turboResources = ModelCapabilityRegistry.estimateImageResources('sd-turbo', { width: 512, height: 512 });
    expect(turboResources.estimatedVRAMBytes).toBeGreaterThan(0);
    expect(turboResources.estimatedRAMBytes).toBeGreaterThan(0);

    const sdxlResources = ModelCapabilityRegistry.estimateImageResources('sdxl-turbo', { width: 1024, height: 1024 });
    expect(sdxlResources.estimatedVRAMBytes).toBeGreaterThan(turboResources.estimatedVRAMBytes);
  });
});
