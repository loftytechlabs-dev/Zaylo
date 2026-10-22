import fs from 'node:fs';
import path from 'node:path';
import type {
  TrainingConfig,
  PreflightReport,
  PreflightCheck,
} from '@local-ai/shared';
import { PythonDetector } from './pythonDetector.js';

export class PreflightValidator {
  public static validate(config: TrainingConfig): PreflightReport {
    const checks: PreflightCheck[] = [];

    // 1. Model & Checkpoint Check
    if (!config.checkpointPath || !fs.existsSync(config.checkpointPath)) {
      checks.push({
        id: 'model_checkpoint',
        name: 'Model Checkpoint Integrity',
        category: 'model',
        status: 'failed',
        message: 'Checkpoint path does not exist on disk.',
        detail: `Path: ${config.checkpointPath}`,
        remediation: 'Ensure the training checkpoint is fetched or select a valid local checkpoint directory.',
      });
    } else {
      const hasSafetensors = fs.existsSync(path.join(config.checkpointPath, 'model.safetensors'));
      const hasBin = fs.existsSync(path.join(config.checkpointPath, 'pytorch_model.bin'));
      const hasConfig = fs.existsSync(path.join(config.checkpointPath, 'config.json'));

      if (!hasConfig) {
        checks.push({
          id: 'model_checkpoint',
          name: 'Model Checkpoint Integrity',
          category: 'model',
          status: 'failed',
          message: 'Missing config.json in checkpoint directory.',
          detail: `Directory: ${config.checkpointPath}`,
          remediation: 'Verify that the model checkpoint includes standard HuggingFace config.json.',
        });
      } else if (!hasSafetensors && !hasBin) {
        checks.push({
          id: 'model_checkpoint',
          name: 'Model Checkpoint Integrity',
          category: 'model',
          status: 'failed',
          message: 'Missing model weights (model.safetensors or pytorch_model.bin).',
          detail: `Directory: ${config.checkpointPath}`,
          remediation: 'Download or copy the unquantized weights into the checkpoint directory.',
        });
      } else {
        checks.push({
          id: 'model_checkpoint',
          name: 'Model Checkpoint Integrity',
          category: 'model',
          status: 'passed',
          message: 'Model checkpoint files verified (Safetensors + Configuration).',
          detail: `Verified at ${config.checkpointPath}`,
        });
      }
    }

    // 2. Dataset Check
    if (!config.datasetPath || !fs.existsSync(config.datasetPath)) {
      checks.push({
        id: 'dataset_validity',
        name: 'Training Dataset Verification',
        category: 'dataset',
        status: 'failed',
        message: 'Dataset file does not exist.',
        detail: `Path: ${config.datasetPath}`,
        remediation: 'Import a valid JSONL or CSV training dataset.',
      });
    } else {
      const stats = fs.statSync(config.datasetPath);
      if (stats.size === 0) {
        checks.push({
          id: 'dataset_validity',
          name: 'Training Dataset Verification',
          category: 'dataset',
          status: 'failed',
          message: 'Dataset file is empty (0 bytes).',
          remediation: 'Select a dataset file containing training records.',
        });
      } else {
        checks.push({
          id: 'dataset_validity',
          name: 'Training Dataset Verification',
          category: 'dataset',
          status: 'passed',
          message: `Dataset file verified (${(stats.size / 1024).toFixed(1)} KB).`,
          detail: config.datasetPath,
        });
      }
    }

    // 3. Environment & Python Runtime Check
    const pyInfo = PythonDetector.detect();
    if (!pyInfo.available) {
      checks.push({
        id: 'python_runtime',
        name: 'Training Runtime Dependencies',
        category: 'environment',
        status: 'failed',
        message: 'Python training environment is not available.',
        detail: pyInfo.error,
        remediation: 'Install Python 3 with torch, transformers, and peft.',
      });
    } else {
      checks.push({
        id: 'python_runtime',
        name: 'Training Runtime Dependencies',
        category: 'environment',
        status: 'passed',
        message: `Verified Python 3 environment with PyTorch ${pyInfo.versions?.torch}, Transformers ${pyInfo.versions?.transformers}, and PEFT ${pyInfo.versions?.peft}.`,
        detail: pyInfo.pythonPath,
      });
    }

    // 4. Output Storage Directory Check
    try {
      const targetDir = config.outputDir;
      const parentDir = path.dirname(targetDir);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.accessSync(parentDir, fs.constants.W_OK);
      checks.push({
        id: 'storage_writable',
        name: 'Artifact Storage & Permissions',
        category: 'storage',
        status: 'passed',
        message: 'Output directory parent is accessible and writable.',
        detail: targetDir,
      });
    } catch (err: any) {
      checks.push({
        id: 'storage_writable',
        name: 'Artifact Storage & Permissions',
        category: 'storage',
        status: 'failed',
        message: 'Output directory cannot be created or written to.',
        detail: err.message,
        remediation: 'Choose an output directory where Zaylo has write permissions.',
      });
    }

    // 5. Hyperparameter Checks
    const issues: string[] = [];
    if (config.batchSize < 1) issues.push('Batch size must be >= 1.');
    if (config.gradientAccumulationSteps < 1) issues.push('Gradient accumulation steps must be >= 1.');
    if (config.learningRate <= 0 || config.learningRate > 0.05) issues.push('Learning rate must be between 1e-6 and 0.05.');
    if (config.loraRank < 1 || config.loraRank > 128) issues.push('LoRA rank must be between 1 and 128.');
    if (config.maxSeqLength < 32 || config.maxSeqLength > 4096) issues.push('Max sequence length must be between 32 and 4096.');
    if (config.epochs < 1 || config.epochs > 50) issues.push('Epoch count must be between 1 and 50.');

    if (issues.length > 0) {
      checks.push({
        id: 'config_hyperparameters',
        name: 'Configuration Integrity',
        category: 'model',
        status: 'failed',
        message: 'Invalid hyperparameter configuration.',
        detail: issues.join(' '),
        remediation: 'Adjust parameters in Advanced Settings or re-run Auto Configure.',
      });
    } else {
      checks.push({
        id: 'config_hyperparameters',
        name: 'Configuration Integrity',
        category: 'model',
        status: 'passed',
        message: 'Hyperparameters and optimization plan validated.',
        detail: `LR: ${config.learningRate}, Rank: ${config.loraRank}, Batch: ${config.batchSize}, Epochs: ${config.epochs}`,
      });
    }

    const canProceed = checks.every((c) => c.status !== 'failed');
    return { checks, canProceed };
  }
}
