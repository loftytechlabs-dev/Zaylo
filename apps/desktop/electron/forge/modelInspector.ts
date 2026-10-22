import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type {
  ModelInstallation,
  ForgeModelInspection,
  TrainingBackend,
} from '@local-ai/shared';
import { getDefaultForgeCheckpointsDir } from '@local-ai/shared';
import { PythonDetector } from './pythonDetector.js';

interface KnownModelMapping {
  hfRepo: string;
  architecture: string;
  paramCount: string;
  defaultTargetModules: string[];
}

const KNOWN_MODELS: Record<string, KnownModelMapping> = {
  smollm2: {
    hfRepo: 'HuggingFaceTB/SmolLM2-135M-Instruct',
    architecture: 'LlamaForCausalLM',
    paramCount: '135M',
    defaultTargetModules: ['q_proj', 'v_proj', 'k_proj', 'o_proj'],
  },
  'smollm2-135m': {
    hfRepo: 'HuggingFaceTB/SmolLM2-135M-Instruct',
    architecture: 'LlamaForCausalLM',
    paramCount: '135M',
    defaultTargetModules: ['q_proj', 'v_proj', 'k_proj', 'o_proj'],
  },
  'qwen2.5-0.5b': {
    hfRepo: 'Qwen/Qwen2.5-0.5B-Instruct',
    architecture: 'Qwen2ForCausalLM',
    paramCount: '0.5B',
    defaultTargetModules: ['q_proj', 'v_proj', 'k_proj', 'o_proj'],
  },
  'llama-3.2-1b': {
    hfRepo: 'meta-llama/Llama-3.2-1B-Instruct',
    architecture: 'LlamaForCausalLM',
    paramCount: '1B',
    defaultTargetModules: ['q_proj', 'v_proj', 'k_proj', 'o_proj'],
  },
  'llama-3.2-3b': {
    hfRepo: 'meta-llama/Llama-3.2-3B-Instruct',
    architecture: 'LlamaForCausalLM',
    paramCount: '3B',
    defaultTargetModules: ['q_proj', 'v_proj', 'k_proj', 'o_proj'],
  },
};

export class ModelInspector {
  public static findLocalHfCheckpoint(hfRepo: string): string | null {
    const home = os.homedir();
    const repoFolder = `models--${hfRepo.replace('/', '--')}`;
    const snapshotsDir = path.join(home, '.cache/huggingface/hub', repoFolder, 'snapshots');

    if (fs.existsSync(snapshotsDir)) {
      try {
        const entries = fs.readdirSync(snapshotsDir);
        for (const entry of entries) {
          const snapshotPath = path.join(snapshotsDir, entry);
          if (fs.statSync(snapshotPath).isDirectory()) {
            const hasModel =
              fs.existsSync(path.join(snapshotPath, 'model.safetensors')) ||
              fs.existsSync(path.join(snapshotPath, 'pytorch_model.bin'));
            const hasConfig = fs.existsSync(path.join(snapshotPath, 'config.json'));
            if (hasModel && hasConfig) {
              return snapshotPath;
            }
          }
        }
      } catch {}
    }

    // Also check Zaylo forge checkpoints directory
    const repoBase = hfRepo.split('/')[1] || hfRepo;
    const forgeDir = path.join(getDefaultForgeCheckpointsDir(), repoBase);
    if (fs.existsSync(forgeDir)) {
      const hasModel =
        fs.existsSync(path.join(forgeDir, 'model.safetensors')) ||
        fs.existsSync(path.join(forgeDir, 'pytorch_model.bin'));
      const hasConfig = fs.existsSync(path.join(forgeDir, 'config.json'));
      if (hasModel && hasConfig) {
        return forgeDir;
      }
    }

    return null;
  }

  public static inspectModel(installation: ModelInstallation): ForgeModelInspection {
    const pyInfo = PythonDetector.detect();
    const isAppleSilicon = process.platform === 'darwin' && process.arch === 'arm64';
    const supportedBackends: TrainingBackend[] = isAppleSilicon ? ['peft', 'mlx'] : ['peft'];

    // Identify known mapping from model name or id
    const lowerName = (installation.name + ' ' + installation.modelId).toLowerCase();
    let matchedKey: string | null = null;
    for (const key of Object.keys(KNOWN_MODELS)) {
      if (lowerName.includes(key)) {
        matchedKey = key;
        break;
      }
    }

    const mapping = matchedKey ? KNOWN_MODELS[matchedKey] : null;
    const architecture = mapping?.architecture || 'TransformerDecoder';
    const paramCount = mapping?.paramCount || (installation.sizeBytes < 500_000_000 ? '< 500M' : '1B - 3B');

    // 1. Check Python dependencies first
    if (!pyInfo.available) {
      return {
        modelId: installation.modelId,
        variantId: installation.variantId,
        name: installation.name,
        architecture,
        parameterCount: paramCount,
        format: installation.format,
        quantization: installation.quantization,
        sizeBytes: installation.sizeBytes,
        localPath: installation.localPath,
        status: 'MISSING_DEPENDENCIES',
        statusReason: pyInfo.error || 'Python 3 with PyTorch and PEFT is required for training.',
        recommendedResolution: 'Install Python dependencies (pip install torch transformers peft) to enable Forge.',
        supportedBackends,
      };
    }

    // 2. Check if localPath itself is a safetensors/checkpoint directory
    if (fs.existsSync(installation.localPath) && fs.statSync(installation.localPath).isDirectory()) {
      const hasModel =
        fs.existsSync(path.join(installation.localPath, 'model.safetensors')) ||
        fs.existsSync(path.join(installation.localPath, 'pytorch_model.bin'));
      const hasConfig = fs.existsSync(path.join(installation.localPath, 'config.json'));

      if (hasModel && hasConfig) {
        return {
          modelId: installation.modelId,
          variantId: installation.variantId,
          name: installation.name,
          architecture,
          parameterCount: paramCount,
          format: installation.format,
          quantization: installation.quantization,
          sizeBytes: installation.sizeBytes,
          localPath: installation.localPath,
          status: 'READY',
          statusReason: 'Native Safetensors checkpoint found and ready for fine-tuning.',
          checkpointPath: installation.localPath,
          tokenizerPath: installation.localPath,
          supportedBackends,
        };
      }
    }

    // 3. If model is GGUF, check for associated base checkpoint
    if (installation.format === 'gguf' || installation.localPath.endsWith('.gguf')) {
      if (mapping?.hfRepo) {
        const localCheckpoint = this.findLocalHfCheckpoint(mapping.hfRepo);
        if (localCheckpoint) {
          return {
            modelId: installation.modelId,
            variantId: installation.variantId,
            name: installation.name,
            architecture,
            parameterCount: paramCount,
            format: installation.format,
            quantization: installation.quantization,
            sizeBytes: installation.sizeBytes,
            localPath: installation.localPath,
            status: 'READY',
            statusReason: `Compatible Safetensors training checkpoint verified (${mapping.hfRepo}).`,
            checkpointPath: localCheckpoint,
            hfRepoId: mapping.hfRepo,
            tokenizerPath: localCheckpoint,
            supportedBackends,
          };
        }

        return {
          modelId: installation.modelId,
          variantId: installation.variantId,
          name: installation.name,
          architecture,
          parameterCount: paramCount,
          format: installation.format,
          quantization: installation.quantization,
          sizeBytes: installation.sizeBytes,
          localPath: installation.localPath,
          status: 'REQUIRES_CHECKPOINT',
          statusReason: `The installed model is in quantized GGUF format (${installation.quantization}), optimized for fast inference. Fine-tuning with backpropagation requires the unquantized Safetensors checkpoint.`,
          recommendedResolution: `Click "Fetch Training Checkpoint" to retrieve the required Safetensors checkpoint (${mapping.hfRepo}), or provide a local checkpoint path.`,
          hfRepoId: mapping.hfRepo,
          supportedBackends,
        };
      }

      return {
        modelId: installation.modelId,
        variantId: installation.variantId,
        name: installation.name,
        architecture,
        parameterCount: paramCount,
        format: installation.format,
        quantization: installation.quantization,
        sizeBytes: installation.sizeBytes,
        localPath: installation.localPath,
        status: 'REQUIRES_CHECKPOINT',
        statusReason: 'Inference GGUF model detected. LoRA fine-tuning requires an unquantized Safetensors checkpoint.',
        recommendedResolution: 'Select or specify a local directory containing the model.safetensors and config.json for this architecture.',
        supportedBackends,
      };
    }

    return {
      modelId: installation.modelId,
      variantId: installation.variantId,
      name: installation.name,
      architecture,
      parameterCount: paramCount,
      format: installation.format,
      quantization: installation.quantization,
      sizeBytes: installation.sizeBytes,
      localPath: installation.localPath,
      status: 'UNSUPPORTED',
      statusReason: `Model format '${installation.format}' cannot be trained directly with the active backends.`,
      recommendedResolution: 'Import a model with Safetensors weights or download a supported open architecture (e.g. SmolLM2, Qwen2.5, Llama-3.2).',
      supportedBackends,
    };
  }
}
