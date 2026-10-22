import path from 'node:path';
import type {
  HardwareProfile,
  CapabilityProfile,
  ForgeModelInspection,
  DatasetAnalysis,
  TrainingObjective,
  TrainingConfig,
  HardwareConstraintEstimates,
  TrainingBackend,
} from '@local-ai/shared';
import { getDefaultForgeDir } from '@local-ai/shared';

export class AutoConfigurator {
  public static generateConfig(params: {
    model: ForgeModelInspection;
    dataset: DatasetAnalysis;
    objective?: TrainingObjective;
    hwProfile: HardwareProfile;
    capabilities?: CapabilityProfile;
    columnMapping?: import('@local-ai/shared').DatasetColumnMapping;
  }): {
    config: TrainingConfig;
    estimates: HardwareConstraintEstimates;
  } {
    const { model, dataset, hwProfile } = params;
    const objective: TrainingObjective =
      params.objective ||
      (dataset.detectedFormat === 'conversational' ? 'conversational' : 'instruction');

    const availableMemBytes = hwProfile.memory.availableBytes || 4 * 1024 * 1024 * 1024;
    const totalMemBytes = hwProfile.memory.totalBytes || 16 * 1024 * 1024 * 1024;

    const isAppleSilicon = hwProfile.platform === 'darwin' && hwProfile.cpu.architecture === 'arm64';
    const backend: TrainingBackend = isAppleSilicon ? 'peft' : 'peft';

    // Sequence length: adapt to dataset p95 + cushion
    const rawSeq = Math.max(128, dataset.tokenLengthDistribution.p95 + 32);
    const maxSeqLength = Math.min(rawSeq, availableMemBytes < 6 * 1024 * 1024 * 1024 ? 256 : 512);

    // Batch size & gradient accumulation
    const batchSize = 1;
    const gradientAccumulationSteps = 4;

    // Rank & Alpha
    const loraRank = totalMemBytes >= 16 * 1024 * 1024 * 1024 ? 16 : 8;
    const loraAlpha = loraRank * 2;
    const loraDropout = 0.05;

    // Target modules
    const targetModules = ['q_proj', 'v_proj'];

    // Learning rate & Epochs
    const learningRate = 2e-4;
    const epochs = dataset.validRecords > 100 ? 2 : 3;

    // Precision
    let precision: 'float32' | 'float16' | 'bfloat16' = 'float32';
    if (hwProfile.primaryGPU && hwProfile.primaryGPU.backend === 'cuda') {
      precision = 'float16';
    }

    const stepsPerEpoch = Math.max(1, Math.ceil(dataset.validRecords / (batchSize * gradientAccumulationSteps)));
    const totalSteps = stepsPerEpoch * epochs;
    const saveSteps = Math.max(5, Math.floor(totalSteps / 4));

    const trainValSplit = dataset.validRecords >= 10 ? 0.1 : 0.0;
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const outputDir = path.join(getDefaultForgeDir(), 'jobs', jobId);

    const config: TrainingConfig = {
      jobId,
      jobName: `${model.name} LoRA (${dataset.fileName})`,
      modelId: model.modelId,
      modelName: model.name,
      checkpointPath: model.checkpointPath || model.localPath,
      datasetPath: dataset.filePath,
      datasetName: dataset.fileName,
      objective,
      method: 'lora',
      backend,
      learningRate,
      loraRank,
      loraAlpha,
      loraDropout,
      targetModules,
      batchSize,
      gradientAccumulationSteps,
      maxSeqLength,
      epochs,
      optimizer: 'AdamW',
      precision,
      warmupRatio: 0.05,
      weightDecay: 0.01,
      saveSteps,
      trainValSplit,
      outputDir,
      columnMapping: params.columnMapping,
    };

    // Hardware feasibility estimates
    const estimates = this.evaluateHardwareFeasibility(config, model, dataset, hwProfile);

    return { config, estimates };
  }

  public static evaluateHardwareFeasibility(
    config: TrainingConfig,
    model: ForgeModelInspection,
    dataset: DatasetAnalysis,
    hwProfile: HardwareProfile
  ): HardwareConstraintEstimates {
    const availableMemBytes = hwProfile.memory.availableBytes || 4 * 1024 * 1024 * 1024;
    const primaryDisk = hwProfile.disks[0];
    const availableDiskBytes = primaryDisk ? primaryDisk.availableBytes : 20 * 1024 * 1024 * 1024;

    // Memory estimation:
    // 1. Base weights in RAM
    const modelBytes = model.sizeBytes > 0 ? model.sizeBytes * 1.5 : 400_000_000;
    // 2. LoRA weights & Optimizer (AdamW ~4MB for rank 8)
    const loraAndOptimizerBytes = config.loraRank * 1024 * 1024;
    // 3. Activations: batch * seq * layers * hidden
    const activationBytes = config.batchSize * config.maxSeqLength * 32 * 2048 * 4;
    // 4. Working buffer
    const bufferBytes = 256 * 1024 * 1024;

    const estimatedMemoryBytes = Math.round(modelBytes + loraAndOptimizerBytes + activationBytes + bufferBytes);

    // Disk estimation: checkpoints (each ~20MB for LoRA) + final adapter (~20MB) + buffer
    const numCheckpoints = Math.ceil(
      (Math.ceil(dataset.validRecords / (config.batchSize * config.gradientAccumulationSteps)) * config.epochs) /
        config.saveSteps
    );
    const estimatedDiskBytes = Math.round((numCheckpoints + 2) * 25 * 1024 * 1024);

    const warnings: string[] = [];
    let isFeasible = true;

    if (estimatedMemoryBytes > availableMemBytes * 0.95) {
      warnings.push(
        `Estimated memory (${Math.round(estimatedMemoryBytes / (1024 * 1024))} MB) is close to or exceeds available RAM (${Math.round(availableMemBytes / (1024 * 1024))} MB). Consider reducing sequence length.`
      );
      if (estimatedMemoryBytes > availableMemBytes * 1.5) {
        isFeasible = false;
      }
    }

    if (estimatedDiskBytes > availableDiskBytes) {
      warnings.push('Insufficient disk space in output storage directory.');
      isFeasible = false;
    }

    // Duration estimation
    const stepsPerEpoch = Math.max(1, Math.ceil(dataset.validRecords / (config.batchSize * config.gradientAccumulationSteps)));
    const totalSteps = stepsPerEpoch * config.epochs;
    // Estimated ~1.2s per step on modern CPU for small models
    const estimatedDurationSeconds = Math.round(totalSteps * 1.2);

    const acceleration: 'mps' | 'cuda' | 'cpu' =
      hwProfile.primaryGPU?.backend === 'cuda' ? 'cuda' : 'cpu';

    return {
      estimatedMemoryBytes,
      availableMemoryBytes: availableMemBytes,
      estimatedDiskBytes,
      availableDiskBytes,
      estimatedDurationSeconds,
      isFeasible,
      warnings,
      acceleration,
    };
  }
}
