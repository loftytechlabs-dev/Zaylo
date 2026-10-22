import type {
  Model,
  ModelInstallation,
  ModelCapabilityProfile,
  ModelTaskType,
  ImageGenerationParams,
  HardwareProfile,
  ImageResolution,
} from '@local-ai/shared';

export const STANDARD_IMAGE_RESOLUTIONS: ImageResolution[] = [
  { width: 512, height: 512, label: '512 × 512', aspectRatio: '1:1' },
  { width: 768, height: 768, label: '768 × 768', aspectRatio: '1:1 HD' },
  { width: 768, height: 512, label: '768 × 512', aspectRatio: '3:2 Landscape' },
  { width: 512, height: 768, label: '512 × 768', aspectRatio: '2:3 Portrait' },
  { width: 1024, height: 1024, label: '1024 × 1024', aspectRatio: '1:1 Ultra' },
  { width: 1024, height: 576, label: '1024 × 576', aspectRatio: '16:9 Cinema' },
];

export const VERIFIED_CAPABILITY_PROFILES: ModelCapabilityProfile[] = [
  // 1. SD-Turbo (Ultra-fast real-time 1-4 step generation)
  {
    modelId: 'sd-turbo',
    name: 'SD-Turbo',
    taskType: 'image-generation',
    architecture: 'sd-turbo',
    supportedRuntimes: ['diffusers', 'stable-diffusion-cpp'],
    fileFormats: ['safetensors', 'diffusers'],
    supportedPlatforms: ['darwin', 'win32', 'linux'],
    accelerationOptions: ['mps', 'cuda', 'cpu'],
    minMemoryBytes: 4 * 1024 * 1024 * 1024, // 4 GB
    recommendedMemoryBytes: 8 * 1024 * 1024 * 1024, // 8 GB
    minVramBytes: 3 * 1024 * 1024 * 1024,
    recommendedVramBytes: 6 * 1024 * 1024 * 1024,
    imageParameters: {
      supportedResolutions: STANDARD_IMAGE_RESOLUTIONS.slice(0, 4), // 512x512, 768x768, 768x512, 512x768
      supportsNegativePrompt: false, // Distilled turbo uses CFG=0.0 / 1.0 (no negative prompt guidance)
      supportsGuidanceScale: true,
      supportsSteps: true,
      supportsSeed: true,
      supportsBatchCount: true,
      defaultWidth: 512,
      defaultHeight: 512,
      defaultSteps: 4,
      minSteps: 1,
      maxSteps: 10,
      defaultGuidanceScale: 1.0,
      minGuidanceScale: 0.0,
      maxGuidanceScale: 3.0,
    },
    knownLimitations: [
      'Trained specifically for 512x512 resolution and 1 to 4 denoising steps.',
      'High guidance scale (> 3.0) causes oversaturation on distilled models.',
    ],
  },

  // 2. Stable Diffusion v1.5 (Standard 512x512)
  {
    modelId: 'stable-diffusion-v1-5',
    name: 'Stable Diffusion v1.5',
    taskType: 'image-generation',
    architecture: 'stable-diffusion-v1-5',
    supportedRuntimes: ['diffusers', 'stable-diffusion-cpp'],
    fileFormats: ['safetensors', 'diffusers'],
    supportedPlatforms: ['darwin', 'win32', 'linux'],
    accelerationOptions: ['mps', 'cuda', 'cpu'],
    minMemoryBytes: 6 * 1024 * 1024 * 1024, // 6 GB
    recommendedMemoryBytes: 12 * 1024 * 1024 * 1024, // 12 GB
    minVramBytes: 4 * 1024 * 1024 * 1024,
    recommendedVramBytes: 8 * 1024 * 1024 * 1024,
    imageParameters: {
      supportedResolutions: STANDARD_IMAGE_RESOLUTIONS.slice(0, 4),
      supportsNegativePrompt: true,
      supportsGuidanceScale: true,
      supportsSteps: true,
      supportsSeed: true,
      supportsBatchCount: true,
      defaultWidth: 512,
      defaultHeight: 512,
      defaultSteps: 25,
      minSteps: 10,
      maxSteps: 50,
      defaultGuidanceScale: 7.5,
      minGuidanceScale: 1.0,
      maxGuidanceScale: 20.0,
    },
    knownLimitations: [
      'Native resolution is 512x512. Higher resolutions may duplicate subjects.',
      'Requires ~4GB VRAM for single 512x512 batch.',
    ],
  },

  // 3. DreamShaper v8 (Artistic and Photorealistic SD 1.5 fine-tune)
  {
    modelId: 'dreamshaper-8',
    name: 'DreamShaper 8',
    taskType: 'image-generation',
    architecture: 'stable-diffusion-v1-5',
    supportedRuntimes: ['diffusers', 'stable-diffusion-cpp'],
    fileFormats: ['safetensors', 'diffusers'],
    supportedPlatforms: ['darwin', 'win32', 'linux'],
    accelerationOptions: ['mps', 'cuda', 'cpu'],
    minMemoryBytes: 6 * 1024 * 1024 * 1024,
    recommendedMemoryBytes: 12 * 1024 * 1024 * 1024,
    minVramBytes: 4 * 1024 * 1024 * 1024,
    recommendedVramBytes: 8 * 1024 * 1024 * 1024,
    imageParameters: {
      supportedResolutions: STANDARD_IMAGE_RESOLUTIONS.slice(0, 4),
      supportsNegativePrompt: true,
      supportsGuidanceScale: true,
      supportsSteps: true,
      supportsSeed: true,
      supportsBatchCount: true,
      defaultWidth: 512,
      defaultHeight: 512,
      defaultSteps: 25,
      minSteps: 15,
      maxSteps: 40,
      defaultGuidanceScale: 6.0,
      minGuidanceScale: 1.0,
      maxGuidanceScale: 15.0,
    },
    knownLimitations: [
      'Fine-tuned for digital art, portraits, and illustration.',
    ],
  },

  // 4. SDXL-Turbo (High-res 1-step SDXL)
  {
    modelId: 'sdxl-turbo',
    name: 'SDXL-Turbo',
    taskType: 'image-generation',
    architecture: 'sdxl-turbo',
    supportedRuntimes: ['diffusers'],
    fileFormats: ['safetensors', 'diffusers'],
    supportedPlatforms: ['darwin', 'win32', 'linux'],
    accelerationOptions: ['mps', 'cuda'],
    minMemoryBytes: 8 * 1024 * 1024 * 1024,
    recommendedMemoryBytes: 16 * 1024 * 1024 * 1024,
    minVramBytes: 6 * 1024 * 1024 * 1024,
    recommendedVramBytes: 10 * 1024 * 1024 * 1024,
    imageParameters: {
      supportedResolutions: STANDARD_IMAGE_RESOLUTIONS,
      supportsNegativePrompt: false,
      supportsGuidanceScale: true,
      supportsSteps: true,
      supportsSeed: true,
      supportsBatchCount: true,
      defaultWidth: 768,
      defaultHeight: 768,
      defaultSteps: 4,
      minSteps: 1,
      maxSteps: 8,
      defaultGuidanceScale: 1.0,
      minGuidanceScale: 0.0,
      maxGuidanceScale: 2.5,
    },
    knownLimitations: [
      'High memory footprint (requires minimum 8GB unified memory on Mac or 6GB discrete VRAM).',
      'CPU execution is significantly slower due to 3.5B SDXL UNet size.',
    ],
  },

  // 5. Tiny-SD (Ultra-compact test diffusion model)
  {
    modelId: 'tiny-sd',
    name: 'Tiny-SD',
    taskType: 'image-generation',
    architecture: 'tiny-sd',
    supportedRuntimes: ['diffusers'],
    fileFormats: ['safetensors', 'diffusers'],
    supportedPlatforms: ['darwin', 'win32', 'linux'],
    accelerationOptions: ['mps', 'cuda', 'cpu'],
    minMemoryBytes: 2 * 1024 * 1024 * 1024,
    recommendedMemoryBytes: 4 * 1024 * 1024 * 1024,
    minVramBytes: 1 * 1024 * 1024 * 1024,
    recommendedVramBytes: 2 * 1024 * 1024 * 1024,
    imageParameters: {
      supportedResolutions: [
        { width: 256, height: 256, label: '256 × 256 (Fast)', aspectRatio: '1:1' },
        { width: 512, height: 512, label: '512 × 512', aspectRatio: '1:1' },
      ],
      supportsNegativePrompt: true,
      supportsGuidanceScale: true,
      supportsSteps: true,
      supportsSeed: true,
      supportsBatchCount: true,
      defaultWidth: 256,
      defaultHeight: 256,
      defaultSteps: 15,
      minSteps: 5,
      maxSteps: 30,
      defaultGuidanceScale: 5.0,
      minGuidanceScale: 1.0,
      maxGuidanceScale: 12.0,
    },
    knownLimitations: [
      'Low parameter count designed for lightweight testing and rapid iteration.',
    ],
  },

  // 6. Text Models (Llama 3.2, Qwen 2.5, Mistral, SmolLM2, etc.)
  {
    modelId: 'smollm2-135m-instruct',
    name: 'SmolLM2 135M Instruct',
    taskType: 'text-generation',
    architecture: 'llama',
    supportedRuntimes: ['llama-cpp'],
    fileFormats: ['gguf'],
    supportedPlatforms: ['darwin', 'win32', 'linux'],
    accelerationOptions: ['mps', 'cuda', 'vulkan', 'cpu'],
    minMemoryBytes: 512 * 1024 * 1024,
    recommendedMemoryBytes: 1024 * 1024 * 1024,
    knownLimitations: [],
  },
  {
    modelId: 'qwen2.5-0.5b-instruct',
    name: 'Qwen 2.5 0.5B Instruct',
    taskType: 'text-generation',
    architecture: 'qwen2',
    supportedRuntimes: ['llama-cpp'],
    fileFormats: ['gguf'],
    supportedPlatforms: ['darwin', 'win32', 'linux'],
    accelerationOptions: ['mps', 'cuda', 'vulkan', 'cpu'],
    minMemoryBytes: 1024 * 1024 * 1024,
    recommendedMemoryBytes: 2 * 1024 * 1024 * 1024,
    knownLimitations: [],
  },
  {
    modelId: 'llama-3.2-1b-instruct',
    name: 'Llama 3.2 1B Instruct',
    taskType: 'text-generation',
    architecture: 'llama',
    supportedRuntimes: ['llama-cpp'],
    fileFormats: ['gguf'],
    supportedPlatforms: ['darwin', 'win32', 'linux'],
    accelerationOptions: ['mps', 'cuda', 'vulkan', 'cpu'],
    minMemoryBytes: 1500 * 1024 * 1024,
    recommendedMemoryBytes: 3 * 1024 * 1024 * 1024,
    knownLimitations: [],
  },
  {
    modelId: 'llama-3.2-3b-instruct',
    name: 'Llama 3.2 3B Instruct',
    taskType: 'text-generation',
    architecture: 'llama',
    supportedRuntimes: ['llama-cpp'],
    fileFormats: ['gguf'],
    supportedPlatforms: ['darwin', 'win32', 'linux'],
    accelerationOptions: ['mps', 'cuda', 'vulkan', 'cpu'],
    minMemoryBytes: 3 * 1024 * 1024 * 1024,
    recommendedMemoryBytes: 6 * 1024 * 1024 * 1024,
    knownLimitations: [],
  },

  // 7. Vision Models (Qwen2.5-VL, SmolVLM)
  {
    modelId: 'qwen2.5-vl-3b-instruct',
    name: 'Qwen 2.5 VL 3B Instruct (Vision)',
    taskType: 'vision',
    architecture: 'qwen2-vl',
    supportedRuntimes: ['llama-cpp'],
    fileFormats: ['gguf'],
    supportedPlatforms: ['darwin', 'win32', 'linux'],
    accelerationOptions: ['mps', 'cuda', 'vulkan', 'cpu'],
    minMemoryBytes: 4 * 1024 * 1024 * 1024,
    recommendedMemoryBytes: 8 * 1024 * 1024 * 1024,
    knownLimitations: ['Requires mmproj projection weights for image understanding.'],
  },
  {
    modelId: 'smolvlm-500m-instruct',
    name: 'SmolVLM 500M Instruct (Vision)',
    taskType: 'vision',
    architecture: 'smolvlm',
    supportedRuntimes: ['llama-cpp'],
    fileFormats: ['gguf'],
    supportedPlatforms: ['darwin', 'win32', 'linux'],
    accelerationOptions: ['mps', 'cuda', 'vulkan', 'cpu'],
    minMemoryBytes: 1500 * 1024 * 1024,
    recommendedMemoryBytes: 3 * 1024 * 1024 * 1024,
    knownLimitations: ['Requires mmproj projection weights for visual QA.'],
  },
];

export class ModelCapabilityRegistry {
  private static profiles = new Map<string, ModelCapabilityProfile>();

  static {
    for (const p of VERIFIED_CAPABILITY_PROFILES) {
      this.profiles.set(p.modelId.toLowerCase(), p);
      if (p.architecture) {
        this.profiles.set(`arch:${p.architecture.toLowerCase()}`, p);
      }
    }
  }

  /**
   * Registers a custom or discovered model capability profile.
   */
  public static registerProfile(profile: ModelCapabilityProfile): void {
    this.profiles.set(profile.modelId.toLowerCase(), profile);
  }

  /**
   * Finds a capability profile by model ID, architecture, or fallback name matching.
   */
  public static getProfile(modelIdOrArch?: string): ModelCapabilityProfile | undefined {
    if (!modelIdOrArch) return undefined;
    const key = modelIdOrArch.toLowerCase().trim();
    if (this.profiles.has(key)) return this.profiles.get(key);

    // Fuzzy matching against known profiles by modelId first
    for (const p of VERIFIED_CAPABILITY_PROFILES) {
      if (key === p.modelId || key.includes(p.modelId)) {
        return p;
      }
    }
    for (const p of VERIFIED_CAPABILITY_PROFILES) {
      if (key === p.architecture) {
        return p;
      }
    }
    return undefined;
  }

  /**
   * Resolves the true operational task type of a model.
   * Ensures image-generating models are never misclassified as vision-understanding models.
   */
  public static resolveTaskType(
    model: {
      id?: string;
      modelId?: string;
      name?: string;
      capabilities?: string[];
      taskType?: ModelTaskType;
      format?: string;
    } | null | undefined
  ): ModelTaskType {
    if (!model) return 'text-generation';

    // 1. Explicit taskType on model
    if (model.taskType) return model.taskType;

    const id = (model.modelId || model.id || '').toLowerCase();
    const name = (model.name || '').toLowerCase();
    const capabilities = model.capabilities || [];

    // 2. Capabilities array check
    if (capabilities.includes('IMAGE_GENERATION')) {
      return 'image-generation';
    }
    if (capabilities.includes('VISION')) {
      return 'vision';
    }

    // 3. Known profile lookup
    const profile = this.getProfile(id) || this.getProfile(name);
    if (profile) return profile.taskType;

    // 4. Strict identification: image generation architectures
    const imageKeywords = ['sd-turbo', 'sdxl-turbo', 'stable-diffusion', 'dreamshaper', 'flux', 'tiny-sd', 'midjourney', 'dall-e'];
    if (imageKeywords.some((k) => id.includes(k) || name.includes(k))) {
      return 'image-generation';
    }

    // 5. Vision / Multimodal understanding (OCR, VQA, image-to-text)
    if (capabilities.includes('VISION')) {
      return 'vision';
    }
    const visionKeywords = ['-vl-', 'vl-3b', 'smolvlm', 'vision', 'llava', 'bakllava'];
    if (visionKeywords.some((k) => id.includes(k) || name.includes(k))) {
      return 'vision';
    }

    return 'text-generation';
  }

  public static isImageGenerationModel(model: any): boolean {
    return this.resolveTaskType(model) === 'image-generation';
  }

  public static isVisionModel(model: any): boolean {
    return this.resolveTaskType(model) === 'vision';
  }

  public static isTextModel(model: any): boolean {
    return this.resolveTaskType(model) === 'text-generation';
  }

  /**
   * Validates and sanitizes image generation parameters according to the model's profile.
   */
  public static validateImageParameters(
    modelId: string,
    params: Partial<ImageGenerationParams>
  ): {
    valid: boolean;
    errors: string[];
    sanitized: ImageGenerationParams;
  } {
    const profile = this.getProfile(modelId) || VERIFIED_CAPABILITY_PROFILES[0];
    const imageMeta = profile.imageParameters || {
      supportedResolutions: STANDARD_IMAGE_RESOLUTIONS,
      supportsNegativePrompt: true,
      supportsGuidanceScale: true,
      supportsSteps: true,
      supportsSeed: true,
      supportsBatchCount: true,
      defaultWidth: 512,
      defaultHeight: 512,
      defaultSteps: 20,
      minSteps: 1,
      maxSteps: 50,
      defaultGuidanceScale: 7.0,
      minGuidanceScale: 0.0,
      maxGuidanceScale: 20.0,
    };

    const errors: string[] = [];

    // Prompt validation
    const prompt = (params.prompt || '').trim();
    if (!prompt) {
      errors.push('Prompt cannot be empty.');
    }

    // Dimensions validation
    let width = params.width || imageMeta.defaultWidth;
    let height = params.height || imageMeta.defaultHeight;

    // Check if resolution is in supported list, or snap to nearest multiple of 64
    if (width % 64 !== 0 || height % 64 !== 0) {
      width = Math.max(256, Math.round(width / 64) * 64);
      height = Math.max(256, Math.round(height / 64) * 64);
    }
    width = Math.min(1024, Math.max(256, width));
    height = Math.min(1024, Math.max(256, height));

    // Steps validation
    let steps = params.steps ?? imageMeta.defaultSteps;
    if (steps < imageMeta.minSteps) {
      steps = imageMeta.minSteps;
    } else if (steps > imageMeta.maxSteps) {
      steps = imageMeta.maxSteps;
    }

    // Guidance scale validation
    let guidanceScale = params.guidanceScale ?? imageMeta.defaultGuidanceScale;
    if (guidanceScale < imageMeta.minGuidanceScale) {
      guidanceScale = imageMeta.minGuidanceScale;
    } else if (guidanceScale > imageMeta.maxGuidanceScale) {
      guidanceScale = imageMeta.maxGuidanceScale;
    }

    // Batch count validation
    const batchSize = Math.min(4, Math.max(1, params.batchSize || 1));

    // Seed
    const seed =
      typeof params.seed === 'number' && Number.isFinite(params.seed) && params.seed >= 0
        ? Math.floor(params.seed)
        : Math.floor(Math.random() * 2147483647);

    // Negative prompt
    const negativePrompt = imageMeta.supportsNegativePrompt ? params.negativePrompt?.trim() : undefined;

    return {
      valid: errors.length === 0,
      errors,
      sanitized: {
        prompt,
        negativePrompt,
        width,
        height,
        steps,
        guidanceScale,
        seed,
        batchSize,
        scheduler: params.scheduler || 'euler_a',
      },
    };
  }

  /**
   * Estimates resource requirements for generating an image.
   */
  public static estimateImageResources(
    modelId: string,
    params: { width: number; height: number; batchSize?: number },
    hardware?: HardwareProfile
  ): {
    estimatedRAMBytes: number;
    estimatedVRAMBytes: number;
    fitsInMemory: boolean;
    recommendedDevice: 'mps' | 'cuda' | 'cpu';
    warning?: string;
  } {
    const profile = this.getProfile(modelId);
    const baseRam = profile?.minMemoryBytes || 4 * 1024 * 1024 * 1024;
    const baseVram = profile?.minVramBytes || 3 * 1024 * 1024 * 1024;

    const pixelFactor = (params.width * params.height) / (512 * 512);
    const batchFactor = Math.max(1, params.batchSize || 1);

    const estimatedRAMBytes = Math.round(baseRam * (1 + (pixelFactor - 1) * 0.4) * batchFactor);
    const estimatedVRAMBytes = Math.round(baseVram * (1 + (pixelFactor - 1) * 0.5) * batchFactor);

    let recommendedDevice: 'mps' | 'cuda' | 'cpu' = 'cpu';
    let fitsInMemory = true;
    let warning: string | undefined;

    if (hardware && typeof hardware === 'object' && hardware.platform && hardware.cpu) {
      const isAppleSilicon =
        hardware.platform === 'darwin' && hardware.cpu.architecture?.toLowerCase().includes('arm');
      const hasCuda = Array.isArray(hardware.gpus) && hardware.gpus.some((g) => g.backend === 'cuda');
      const totalSystemMem = hardware.memory?.totalBytes || 16 * 1024 * 1024 * 1024;

      if (isAppleSilicon) {
        recommendedDevice = 'mps';
        if (estimatedRAMBytes > totalSystemMem * 0.85) {
          fitsInMemory = false;
          warning = `Estimated memory usage (${(estimatedRAMBytes / 1024 / 1024 / 1024).toFixed(1)} GB) exceeds available Apple Silicon unified memory.`;
        }
      } else if (hasCuda) {
        recommendedDevice = 'cuda';
        const bestGpu = hardware.gpus?.find((g) => g.backend === 'cuda');
        if (bestGpu && bestGpu.vramBytes && bestGpu.vramBytes < estimatedVRAMBytes) {
          warning = `GPU VRAM (${(bestGpu.vramBytes / 1024 / 1024 / 1024).toFixed(1)} GB) may be tight for ${params.width}x${params.height}.`;
        }
      } else {
        recommendedDevice = 'cpu';
        warning = 'No GPU acceleration detected. Image generation will run on CPU multi-threading.';
      }
    }

    return {
      estimatedRAMBytes,
      estimatedVRAMBytes,
      fitsInMemory,
      recommendedDevice,
      warning,
    };
  }

  public static listAllProfiles(): ModelCapabilityProfile[] {
    return VERIFIED_CAPABILITY_PROFILES;
  }
}
