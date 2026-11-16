import { spawn, ChildProcess, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  TrainingConfig,
  TrainingJob,
  TrainingMetricSample,
  TrainingJobStatus,
  FineTunedModelArtifact,
  ModelComparisonRequest,
  ModelComparisonResult,
  DatasetEvaluationReport,
  DatasetEvaluationSample,
} from '@local-ai/shared';
import type { TrainingJobRepository, FineTunedModelRepository } from '@local-ai/database';
import { PythonDetector } from './pythonDetector.js';
import { scoreResponse } from './evaluation.js';
import { resolvePythonScript } from '../utils/scriptResolver.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ForgeTrainingEngine {
  private activeProcesses = new Map<string, ChildProcess>();
  private onMetricCallback?: (jobId: string, sample: TrainingMetricSample) => void;
  private onLogCallback?: (jobId: string, log: string) => void;
  private onStatusCallback?: (jobId: string, status: TrainingJobStatus, error?: string) => void;

  constructor(
    private jobRepo: TrainingJobRepository,
    private artifactRepo: FineTunedModelRepository
  ) {
    // Recover any jobs interrupted during previous crash or restart
    this.jobRepo.recoverInterruptedJobs();
  }

  public setEventCallbacks(callbacks: {
    onMetric: (jobId: string, sample: TrainingMetricSample) => void;
    onLog: (jobId: string, log: string) => void;
    onStatus: (jobId: string, status: TrainingJobStatus, error?: string) => void;
  }): void {
    this.onMetricCallback = callbacks.onMetric;
    this.onLogCallback = callbacks.onLog;
    this.onStatusCallback = callbacks.onStatus;
  }

  private getScriptPath(scriptName: string): string {
    const candidates = [
      path.join(__dirname, 'scripts', scriptName),
      path.join(__dirname, '../forge/scripts', scriptName),
      path.resolve(process.cwd(), 'apps/desktop/electron/forge/scripts', scriptName),
      path.resolve(process.cwd(), 'electron/forge/scripts', scriptName),
      path.join(process.resourcesPath || '', 'scripts', scriptName),
      path.join(process.resourcesPath || '', 'electron/forge/scripts', scriptName),
      path.join(process.resourcesPath || '', 'app.asar.unpacked/dist-electron/main/scripts', scriptName),
      path.join(process.resourcesPath || '', 'app.asar.unpacked/dist-electron/forge/scripts', scriptName),
    ];
    return resolvePythonScript(scriptName, candidates);
  }

  public async startTraining(
    config: TrainingConfig,
    modelName: string,
    recordsCount: number
  ): Promise<{ jobId: string; started: boolean }> {
    const pyInfo = PythonDetector.detect();
    if (!pyInfo.available || !pyInfo.pythonPath) {
      throw new Error(`Cannot start training: ${pyInfo.error || 'Python 3 not found'}`);
    }

    const outputDir = config.outputDir;
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const configFilePath = path.join(outputDir, 'training_config.json');
    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), 'utf-8');

    const job: TrainingJob = {
      id: config.jobId,
      name: config.jobName,
      modelId: config.modelId,
      modelName,
      checkpointPath: config.checkpointPath,
      datasetPath: config.datasetPath,
      datasetRecords: recordsCount,
      status: 'INITIALIZING',
      config,
      estimates: {
        estimatedMemoryBytes: 600 * 1024 * 1024,
        availableMemoryBytes: 8 * 1024 * 1024 * 1024,
        estimatedDiskBytes: 50 * 1024 * 1024,
        availableDiskBytes: 20 * 1024 * 1024 * 1024,
        isFeasible: true,
        warnings: [],
        acceleration: 'cpu',
      },
      currentStep: 0,
      totalSteps: 0,
      currentEpoch: 0,
      totalEpochs: config.epochs,
      metricsHistory: [],
      recentLogs: [`[INIT] Job created. Initializing background fine-tuning process...`],
      checkpoints: [],
      outputDir,
      createdAt: Date.now(),
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.jobRepo.createJob(job);
    this.onStatusCallback?.(job.id, 'INITIALIZING');

    // Spawn isolated Python trainer
    this.getScriptPath('dataset_io.py');
    const trainScript = this.getScriptPath('train_lora.py');
    const child = spawn(pyInfo.pythonPath, [trainScript, '--config', configFilePath], {
      cwd: outputDir,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        TOKENIZERS_PARALLELISM: 'false',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.activeProcesses.set(job.id, child);

    this.jobRepo.updateJob({ id: job.id, status: 'TRAINING' });
    this.onStatusCallback?.(job.id, 'TRAINING');

    this.setupChildStreams(job, child, modelName, config);

    return { jobId: job.id, started: true };
  }

  private setupChildStreams(
    job: TrainingJob,
    child: ChildProcess,
    modelName: string,
    config: TrainingConfig
  ) {
    let buffer = '';
    let lastErrorMessage: string | undefined;
    let lastStderr = '';

    child.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf-8');
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          try {
            const data = JSON.parse(trimmed);

            if (data.type === 'metric') {
              const sample: TrainingMetricSample = {
                step: data.step,
                totalSteps: data.totalSteps,
                epoch: data.epoch,
                totalEpochs: data.totalEpochs,
                loss: data.loss,
                evalLoss: data.evalLoss,
                learningRate: data.learningRate,
                gradNorm: data.gradNorm,
                tokenAccuracy: data.tokenAccuracy,
                tokensPerSec: data.tokensPerSec,
                elapsedSeconds: data.elapsedSeconds,
                estimatedRemainingSeconds: data.estimatedRemainingSeconds,
                cpuPercent: data.cpuPercent,
                memoryBytes: data.memoryBytes,
                gpuMemoryBytes: data.gpuMemoryBytes,
                timestamp: Date.now(),
              };

              const currentJob = this.jobRepo.getJob(job.id);
              if (currentJob) {
                currentJob.currentStep = sample.step;
                currentJob.totalSteps = sample.totalSteps;
                currentJob.currentEpoch = sample.epoch;
                currentJob.currentLoss = sample.loss;
                const history = Array.isArray(currentJob.metricsHistory) ? currentJob.metricsHistory : [];
                history.push(sample);
                currentJob.metricsHistory = history.length > 500 ? history.slice(-500) : history;

                this.jobRepo.updateJob({
                  id: job.id,
                  currentStep: sample.step,
                  totalSteps: sample.totalSteps,
                  currentEpoch: sample.epoch,
                  currentLoss: sample.loss,
                  metricsHistory: currentJob.metricsHistory,
                });
              }

              this.onMetricCallback?.(job.id, sample);
            } else if (data.type === 'checkpoint') {
              const currentJob = this.jobRepo.getJob(job.id);
              if (currentJob) {
                const ckpts = Array.isArray(currentJob.checkpoints) ? currentJob.checkpoints : [];
                ckpts.push({
                  step: data.step,
                  path: data.path,
                  loss: data.loss,
                  sizeBytes: data.sizeBytes,
                  recoverable: data.recoverable !== false,
                  createdAt: Date.now(),
                });
                currentJob.checkpoints = ckpts;
                this.jobRepo.updateJob({
                  id: job.id,
                  checkpoints: currentJob.checkpoints,
                });
              }
              const logMsg = `[CHECKPOINT] Saved checkpoint at step ${data.step} (loss: ${data.loss})`;
              this.onLogCallback?.(job.id, logMsg);
            } else if (data.type === 'log') {
              const logMsg = `[${data.level || 'INFO'}] ${data.message}`;
              this.appendLog(job.id, logMsg);
              this.onLogCallback?.(job.id, logMsg);
            } else if (data.type === 'error') {
              lastErrorMessage = data.message;
              const logMsg = `[ERROR] ${data.message}`;
              this.appendLog(job.id, logMsg);
              this.onLogCallback?.(job.id, logMsg);
            } else if (data.type === 'completed') {
              const isCompleted = data.status === 'COMPLETED';
              const finalStatus: TrainingJobStatus = isCompleted ? 'COMPLETED' : 'CANCELLED';

              const currentJob = this.jobRepo.getJob(job.id);
              const durationSec = data.durationSeconds || Math.round((Date.now() - (job.startedAt || Date.now())) / 1000);

              this.jobRepo.updateJob({
                id: job.id,
                status: finalStatus,
                artifactPath: data.artifactPath,
                artifactType: 'lora_adapter',
                artifactSizeBytes: data.artifactSize,
                completedAt: Date.now(),
              });

              if (isCompleted && data.artifactPath) {
                const artifact: FineTunedModelArtifact = {
                  id: `ft_${Date.now()}`,
                  jobId: job.id,
                  name: `${modelName} LoRA (${path.basename(config.datasetPath)})`,
                  baseModelId: config.modelId,
                  baseModelName: modelName,
                  type: 'lora',
                  artifactPath: data.artifactPath,
                  sizeBytes: data.artifactSize || 0,
                  format: 'safetensors',
                  compatibilityStatus: 'ready',
                  finalLoss: currentJob?.currentLoss,
                  trainingDurationSeconds: durationSec,
                  createdAt: Date.now(),
                };
                this.artifactRepo.registerModel(artifact);
              }

              this.onStatusCallback?.(job.id, finalStatus);
            }
          } catch {
            this.appendLog(job.id, trimmed);
            this.onLogCallback?.(job.id, trimmed);
          }
        } else {
          this.appendLog(job.id, trimmed);
          this.onLogCallback?.(job.id, trimmed);
        }
      }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8').trim();
      if (text) {
        lastStderr = text.split('\n').filter(Boolean).slice(-3).join(' ');
        this.appendLog(job.id, `[STDERR] ${text}`);
        this.onLogCallback?.(job.id, `[STDERR] ${text}`);
      }
    });

    child.on('close', (code) => {
      this.activeProcesses.delete(job.id);
      const currentJob = this.jobRepo.getJob(job.id);
      if (currentJob && currentJob.status === 'TRAINING') {
        const finalStatus = code === 0 ? 'COMPLETED' : 'FAILED';
        const errorMsg = code === 0
          ? undefined
          : (lastErrorMessage || (lastStderr ? `Error: ${lastStderr}` : `Process exited with error code ${code}`));
        this.jobRepo.updateJob({
          id: job.id,
          status: finalStatus,
          error: errorMsg,
          completedAt: Date.now(),
        });
        this.onStatusCallback?.(job.id, finalStatus, errorMsg);
      }
    });
  }

  private appendLog(jobId: string, logMsg: string) {
    const job = this.jobRepo.getJob(jobId);
    if (!job) return;
    job.recentLogs.push(logMsg);
    if (job.recentLogs.length > 200) {
      job.recentLogs = job.recentLogs.slice(-200);
    }
    this.jobRepo.updateJob({ id: jobId, recentLogs: job.recentLogs });
  }

  public cancelTraining(jobId: string): boolean {
    const child = this.activeProcesses.get(jobId);
    if (child && !child.killed) {
      child.kill('SIGTERM');
      this.activeProcesses.delete(jobId);
      this.jobRepo.updateJob({
        id: jobId,
        status: 'CANCELLED',
        completedAt: Date.now(),
      });
      this.onStatusCallback?.(jobId, 'CANCELLED');
      return true;
    }
    return false;
  }

  public pauseTraining(jobId: string): boolean {
    const child = this.activeProcesses.get(jobId);
    if (child && !child.killed) {
      child.kill('SIGSTOP');
      this.jobRepo.updateJob({ id: jobId, status: 'PAUSED' });
      this.onStatusCallback?.(jobId, 'PAUSED');
      return true;
    }
    return false;
  }

  public resumeTraining(jobId: string): boolean {
    const child = this.activeProcesses.get(jobId);
    if (child && !child.killed) {
      child.kill('SIGCONT');
      this.jobRepo.updateJob({ id: jobId, status: 'TRAINING' });
      this.onStatusCallback?.(jobId, 'TRAINING');
      return true;
    }
    return false;
  }

  public async resumeFromCheckpoint(
    jobId: string,
    checkpointStep: number
  ): Promise<{ success: boolean; error?: string }> {
    const job = this.jobRepo.getJob(jobId);
    if (!job) return { success: false, error: 'Job not found' };

    const ckpt = job.checkpoints.find((c) => c.step === checkpointStep);
    if (!ckpt || !fs.existsSync(ckpt.path)) {
      return { success: false, error: `Checkpoint for step ${checkpointStep} not found on disk` };
    }

    const hasAdapter =
      fs.existsSync(path.join(ckpt.path, 'adapter_model.safetensors')) ||
      fs.existsSync(path.join(ckpt.path, 'adapter_model.bin'));
    if (!hasAdapter) {
      return { success: false, error: 'Checkpoint directory is missing trained adapter weights' };
    }

    const pyInfo = PythonDetector.detect();
    if (!pyInfo.available || !pyInfo.pythonPath) {
      return { success: false, error: pyInfo.error || 'Python environment unavailable' };
    }

    // Update config to continue from checkpoint
    const updatedConfig: TrainingConfig = {
      ...job.config,
      resumeFromCheckpoint: ckpt.path,
    };

    const configFilePath = path.join(job.outputDir, 'training_config.json');
    fs.writeFileSync(configFilePath, JSON.stringify(updatedConfig, null, 2), 'utf-8');

    this.getScriptPath('dataset_io.py');
    const trainScript = this.getScriptPath('train_lora.py');
    const child = spawn(
      pyInfo.pythonPath,
      [trainScript, '--config', configFilePath, '--resume-checkpoint', ckpt.path],
      {
        cwd: job.outputDir,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
          TOKENIZERS_PARALLELISM: 'false',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    this.activeProcesses.set(job.id, child);
    this.appendLog(job.id, `[RESUME] Resuming training process from Step ${checkpointStep} checkpoint.`);
    this.jobRepo.updateJob({ id: job.id, status: 'TRAINING', config: updatedConfig });
    this.onStatusCallback?.(job.id, 'TRAINING');

    this.setupChildStreams(job, child, job.modelName, updatedConfig);
    return { success: true };
  }

  public async evaluateDataset(
    jobId: string,
    numExamples: number = 5
  ): Promise<DatasetEvaluationReport> {
    const job = this.jobRepo.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    if (!job.artifactPath || !fs.existsSync(job.artifactPath)) throw new Error('A saved trained adapter is required for held-out evaluation.');
    const heldOutPath = path.join(job.outputDir, 'validation_records.jsonl');
    if (!fs.existsSync(heldOutPath) || fs.statSync(heldOutPath).size === 0) {
      throw new Error('No held-out validation records exist for this run. Train with a nonzero validation split and at least two distinct examples before evaluating.');
    }
    const testExamples = fs.readFileSync(heldOutPath, 'utf-8').split(/\r?\n/).filter(line => line.trim()).slice(0, Math.max(1, numExamples)).map(line => {
      const record: unknown = JSON.parse(line);
      if (!record || typeof record !== 'object' || !('formattedPrompt' in record) || !('expectedResponse' in record)
        || typeof record.formattedPrompt !== 'string' || !record.formattedPrompt.trim() || typeof record.expectedResponse !== 'string') {
        throw new Error('This run has no saved training-formatted validation prompts. Retrain before evaluating; preview text cannot reproduce the training input.');
      }
      return { prompt: record.formattedPrompt, response: record.expectedResponse };
    });
    if (testExamples.length === 0) throw new Error('The held-out validation file contains no valid examples.');
    let exactMatches = 0;
    const samples: DatasetEvaluationSample[] = [];

    const startTime = Date.now();
    for (const ex of testExamples) {
      try {
        const res = await this.compareModels({
          baseModelPath: job.checkpointPath,
          adapterPath: job.artifactPath,
          prompt: ex.prompt,
          temperature: 0,
          maxTokens: 128,
        }, true);

        const score = scoreResponse(ex.response, res.fineTunedResponse);
        exactMatches += score.exactMatch;
        samples.push({
          prompt: ex.prompt,
          expected: ex.response,
          baseOutput: res.baseResponse,
          ftOutput: res.fineTunedResponse,
          latencyBaseMs: res.baseDurationMs,
          latencyFtMs: res.fineTunedDurationMs,
          scoreMatch: score.tokenF1,
        });
      } catch (error) {
        throw new Error(`Held-out evaluation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const durationSeconds = Math.round((Date.now() - startTime) / 1000);
    const avgScore = samples.reduce((acc, s) => acc + (s.scoreMatch || 0), 0) / Math.max(1, samples.length);

    return {
      jobId,
      samples,
      metrics: {
        valLoss: [...job.metricsHistory].reverse().find(sample => typeof sample.evalLoss === 'number' && Number.isFinite(sample.evalLoss))?.evalLoss,
        tokenF1Score: parseFloat(avgScore.toFixed(2)),
        accuracyScore: exactMatches / samples.length,
      },
      durationSeconds,
    };
  }

  public async compareModels(req: ModelComparisonRequest, formattedPrompt = false): Promise<ModelComparisonResult> {
    if (req.adapterPath && !fs.existsSync(req.adapterPath)) throw new Error(`Adapter path not found: ${req.adapterPath}`);
    const pyInfo = PythonDetector.detect();
    if (!pyInfo.available || !pyInfo.pythonPath) {
      throw new Error(`Python training environment not available: ${pyInfo.error}`);
    }

    const scriptPath = this.getScriptPath('evaluate_compare.py');
    const args = [
      scriptPath,
      '--base-model', req.baseModelPath,
      '--prompt', req.prompt,
      '--temperature', String(req.temperature ?? 0.7),
      '--max-tokens', String(req.maxTokens ?? 128),
    ];

    if (formattedPrompt) args.push('--formatted-prompt');

    if (req.adapterPath) {
      args.push('--adapter', req.adapterPath);
    }

    return new Promise((resolve, reject) => {
      const child = spawn(pyInfo.pythonPath!, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.once('error', reject);
      child.stdout.on('data', (d) => (stdout += d.toString()));
      child.stderr.on('data', (d) => (stderr += d.toString()));

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Comparison failed (code ${code}): ${stderr || stdout}`));
          return;
        }

        try {
          const lines = stdout.trim().split('\n');
          const jsonLine = lines.reverse().find((l) => l.startsWith('{') && l.endsWith('}'));
          if (jsonLine) {
            resolve(JSON.parse(jsonLine));
          } else {
            reject(new Error(`Failed to parse comparison output: ${stdout}`));
          }
        } catch (err: any) {
          reject(new Error(`Failed to parse comparator JSON: ${err.message}`));
        }
      });
    });
  }

  public async mergeAdapter(artifactId: string): Promise<{ success: boolean; outputPath?: string; error?: string }> {
    const artifact = this.artifactRepo.getModel(artifactId);
    if (!artifact) {
      throw new Error(`Artifact ${artifactId} not found`);
    }

    const job = this.jobRepo.getJob(artifact.jobId);
    if (!job) {
      throw new Error(`Training job ${artifact.jobId} not found`);
    }

    const baseModelPath = job.checkpointPath;
    const pyInfo = PythonDetector.detect();
    if (!pyInfo.available || !pyInfo.pythonPath) {
      return { success: false, error: pyInfo.error || 'Python environment not found' };
    }

    const scriptPath = this.getScriptPath('merge_lora.py');
    const outputDir = fs.mkdtempSync(path.join(job.outputDir, 'merged_model_'));
    try {
      const out = execFileSync(pyInfo.pythonPath, [
        scriptPath, '--base-model', baseModelPath, '--adapter', artifact.artifactPath, '--output-dir', outputDir,
      ], { encoding: 'utf-8', timeout: 300000, maxBuffer: 10 * 1024 * 1024 });

      const lines = out.trim().split('\n');
      const jsonLine = lines.reverse().find((l) => l.startsWith('{') && l.endsWith('}'));
      if (jsonLine) {
        const parsed = JSON.parse(jsonLine);
        if (parsed.success === true && typeof parsed.outputPath === 'string' && fs.existsSync(path.join(parsed.outputPath, 'config.json'))) {
          // Register merged model artifact
          const mergedArtifact: FineTunedModelArtifact = {
            id: `ft_merged_${Date.now()}`,
            jobId: job.id,
            name: `${artifact.name} (Merged Standalone)`,
            baseModelId: artifact.baseModelId,
            baseModelName: artifact.baseModelName,
            type: 'merged',
            artifactPath: outputDir,
            sizeBytes: parsed.sizeBytes || 0,
            format: 'safetensors',
            compatibilityStatus: 'ready',
            trainingDurationSeconds: artifact.trainingDurationSeconds,
            finalLoss: artifact.finalLoss,
            createdAt: Date.now(),
          };
          this.artifactRepo.registerModel(mergedArtifact);
          return { success: true, outputPath: outputDir };
        }
      }
      return { success: false, error: 'Merge script completed without reporting success.' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public async exportArtifact(
    artifactId: string,
    destinationDir: string,
    format: 'adapter' | 'gguf' = 'adapter'
  ): Promise<{ success: boolean; exportPath?: string; error?: string }> {
    const artifact = this.artifactRepo.getModel(artifactId);
    if (!artifact) throw new Error(`Artifact ${artifactId} not found`);

    if (!fs.existsSync(destinationDir)) {
      fs.mkdirSync(destinationDir, { recursive: true });
    }

    try {
      if (format === 'gguf') {
        const python = PythonDetector.detect();
        if (!python.available || !python.pythonPath) throw new Error(python.error || 'Python is required for GGUF export.');
        let modelPath = artifact.artifactPath;
        if (artifact.type === 'lora') {
          const merged = await this.mergeAdapter(artifactId);
          if (!merged.success || !merged.outputPath) throw new Error(merged.error || 'Adapter merge failed.');
          modelPath = merged.outputPath;
        }
        const exportPath = path.join(destinationDir, `${artifact.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.gguf`);
        execFileSync(python.pythonPath, [this.getScriptPath('export_gguf.py'), '--model', modelPath, '--output', exportPath], {
          encoding: 'utf-8', timeout: 600000, maxBuffer: 10 * 1024 * 1024,
        });
        return { success: true, exportPath };
      }
      const exportPath = path.join(destinationDir, path.basename(artifact.artifactPath));
      fs.cpSync(artifact.artifactPath, exportPath, { recursive: true, force: false, errorOnExist: true });
      return { success: true, exportPath };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  public deleteArtifact(artifactId: string): boolean {
    const artifact = this.artifactRepo.getModel(artifactId);
    if (!artifact) return false;

    if (fs.existsSync(artifact.artifactPath)) {
      try {
        fs.rmSync(artifact.artifactPath, { recursive: true, force: true });
      } catch (err: any) {
        console.warn('Failed to delete artifact directory:', err.message);
      }
    }

    return this.artifactRepo.deleteModel(artifactId);
  }

  public async fetchCheckpoint(
    hfRepoId: string
  ): Promise<{ success: boolean; checkpointPath?: string; error?: string }> {
    const pyInfo = PythonDetector.detect();
    if (!pyInfo.available || !pyInfo.pythonPath) {
      return { success: false, error: 'Python environment missing' };
    }

    const downloadScript = `
import json, sys
from huggingface_hub import snapshot_download
try:
    path = snapshot_download(
        sys.argv[1],
        allow_patterns=["*.safetensors", "*.json", "*.txt"],
        ignore_patterns=["onnx/*", "*.onnx", "*.pt", "*.bin"]
    )
    print(json.dumps({"success": True, "path": path}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
`;

    try {
      const out = execFileSync(pyInfo.pythonPath, ['-c', downloadScript, hfRepoId], {
        encoding: 'utf-8',
        timeout: 600000, // 10 minutes
      });

      const lines = out.trim().split('\n');
      const jsonLine = lines.reverse().find((l) => l.startsWith('{') && l.endsWith('}'));
      if (jsonLine) {
        const parsed = JSON.parse(jsonLine);
        if (parsed.success) {
          return { success: true, checkpointPath: parsed.path };
        } else {
          return { success: false, error: parsed.error };
        }
      }
      return { success: false, error: 'Checkpoint download returned invalid response.' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
