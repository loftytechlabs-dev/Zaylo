import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn, type ChildProcess } from 'node:child_process';
import type {
  ImageGenerationJob,
  ImageGenerationParams,
  GeneratedImage,
  ImageGenerationProgress,
} from '@local-ai/shared';
import { PythonDetector } from '../forge/pythonDetector.js';
import { ModelCapabilityRegistry } from '@local-ai/capabilities';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type ImageStatusCallback = (jobId: string, status: ImageGenerationJob['status'], message?: string) => void;
export type ImageProgressCallback = (jobId: string, progress: ImageGenerationProgress) => void;
export type ImageCompletedCallback = (jobId: string, images: GeneratedImage[]) => void;
export type ImageErrorCallback = (jobId: string, error: string) => void;

export class ImageEngine {
  private activeProcesses = new Map<string, ChildProcess>();
  private activeJobs = new Map<string, ImageGenerationJob>();
  private imageHistory: GeneratedImage[] = [];
  private historyFilePath: string;
  private defaultOutputDir: string;

  private onStatusCallback?: ImageStatusCallback;
  private onProgressCallback?: ImageProgressCallback;
  private onCompletedCallback?: ImageCompletedCallback;
  private onErrorCallback?: ImageErrorCallback;

  constructor(appDataDir?: string) {
    const baseDir = appDataDir || path.join(os.homedir(), 'Library', 'Application Support', 'LocalAIServer');
    const imagesDir = path.join(baseDir, 'images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    this.historyFilePath = path.join(imagesDir, 'generation_history.json');
    this.defaultOutputDir = path.join(os.homedir(), 'Pictures', 'Zaylo', 'Generated');
    if (!fs.existsSync(this.defaultOutputDir)) {
      try {
        fs.mkdirSync(this.defaultOutputDir, { recursive: true });
      } catch {
        this.defaultOutputDir = imagesDir;
      }
    }

    this.loadHistory();
  }

  private loadHistory() {
    try {
      if (fs.existsSync(this.historyFilePath)) {
        const raw = fs.readFileSync(this.historyFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.imageHistory = parsed;
        }
      }
    } catch (err) {
      console.warn('Failed to load image generation history:', err);
      this.imageHistory = [];
    }
  }

  private persistHistory() {
    try {
      fs.writeFileSync(this.historyFilePath, JSON.stringify(this.imageHistory.slice(0, 500), null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist image generation history:', err);
    }
  }

  public setCallbacks(callbacks: {
    onStatus?: ImageStatusCallback;
    onProgress?: ImageProgressCallback;
    onCompleted?: ImageCompletedCallback;
    onError?: ImageErrorCallback;
  }) {
    this.onStatusCallback = callbacks.onStatus;
    this.onProgressCallback = callbacks.onProgress;
    this.onCompletedCallback = callbacks.onCompleted;
    this.onErrorCallback = callbacks.onError;
  }

  public getHistory(): GeneratedImage[] {
    return [...this.imageHistory];
  }

  public deleteImage(imageId: string): boolean {
    const idx = this.imageHistory.findIndex((img) => img.id === imageId);
    if (idx !== -1) {
      const img = this.imageHistory[idx];
      try {
        if (fs.existsSync(img.localPath)) {
          fs.unlinkSync(img.localPath);
        }
      } catch (err) {
        console.warn('Failed to delete image file:', err);
      }
      this.imageHistory.splice(idx, 1);
      this.persistHistory();
      return true;
    }
    return false;
  }

  public getJob(jobId: string): ImageGenerationJob | undefined {
    return this.activeJobs.get(jobId);
  }

  public async startGeneration(params: {
    modelId: string;
    modelName?: string;
    modelPath?: string;
    generationParams: Partial<ImageGenerationParams>;
    outputDir?: string;
    device?: 'auto' | 'mps' | 'cuda' | 'cpu';
  }): Promise<{ jobId: string }> {
    const validation = ModelCapabilityRegistry.validateImageParameters(
      params.modelId,
      params.generationParams
    );
    if (!validation.valid) {
      throw new Error(`Invalid generation parameters: ${validation.errors.join(', ')}`);
    }

    const sanitizedParams = validation.sanitized;
    const jobId = `img_job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const outputDir = params.outputDir || this.defaultOutputDir;
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const job: ImageGenerationJob = {
      id: jobId,
      modelId: params.modelId,
      modelName: params.modelName || params.modelId,
      status: 'PENDING',
      params: sanitizedParams,
      progress: {
        step: 0,
        totalSteps: sanitizedParams.steps,
        percentage: 0,
        elapsedSeconds: 0,
      },
      images: [],
      startedAt: Date.now(),
    };

    this.activeJobs.set(jobId, job);
    this.onStatusCallback?.(jobId, 'PENDING', 'Queued image generation job...');

    // Detect python
    const pythonStatus = await PythonDetector.detect();
    if (!pythonStatus.available || !pythonStatus.pythonPath) {
      const err = 'Python 3 runtime is required for local diffusion models. Install Python 3.10+ with PyTorch and Diffusers.';
      job.status = 'FAILED';
      job.error = err;
      this.onErrorCallback?.(jobId, err);
      throw new Error(err);
    }

    const candidates = [
      path.resolve(process.cwd(), 'electron/image/scripts/generate_image.py'),
      path.resolve(process.cwd(), 'apps/desktop/electron/image/scripts/generate_image.py'),
      path.join(__dirname, 'scripts', 'generate_image.py'),
      path.join(__dirname, '../image/scripts', 'generate_image.py'),
      path.join(__dirname, '../../electron/image/scripts', 'generate_image.py'),
      path.resolve(__dirname, '../../../../electron/image/scripts/generate_image.py'),
      path.join(process.resourcesPath || '', 'scripts', 'generate_image.py'),
      path.join(process.resourcesPath || '', 'electron/image/scripts', 'generate_image.py'),
    ];
    const resolvedScript = candidates.find((c) => fs.existsSync(c)) || candidates[0];

    if (!fs.existsSync(resolvedScript)) {
      const err = `Image worker script not found at ${resolvedScript}`;
      job.status = 'FAILED';
      job.error = err;
      this.onErrorCallback?.(jobId, err);
      throw new Error(err);
    }

    // Prepare temp config file
    const configData = {
      jobId,
      modelId: params.modelId,
      modelName: job.modelName,
      modelPath: params.modelPath || '',
      prompt: sanitizedParams.prompt,
      negativePrompt: sanitizedParams.negativePrompt || '',
      width: sanitizedParams.width,
      height: sanitizedParams.height,
      steps: sanitizedParams.steps,
      guidanceScale: sanitizedParams.guidanceScale,
      seed: sanitizedParams.seed,
      batchSize: sanitizedParams.batchSize || 1,
      outputDir,
      device: params.device || 'auto',
    };

    const tempConfigPath = path.join(outputDir, `config_${jobId}.json`);
    fs.writeFileSync(tempConfigPath, JSON.stringify(configData, null, 2), 'utf-8');

    job.status = 'LOADING';
    this.onStatusCallback?.(jobId, 'LOADING', 'Launching local image diffusion process...');

    const child = spawn(pythonStatus.pythonPath, [resolvedScript, '--config', tempConfigPath], {
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        TOKENIZERS_PARALLELISM: 'false',
      },
    });

    this.activeProcesses.set(jobId, child);

    let stdoutBuffer = '';
    let lastStderr = '';
    let lastErrorMsg: string | undefined;

    child.stdout?.on('data', (chunk: Buffer) => {
      stdoutBuffer += chunk.toString('utf-8');
      const clean = stdoutBuffer.replace(/\r/g, '\n');
      const lines = clean.split('\n');
      stdoutBuffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const startIdx = trimmed.indexOf('{');
        const endIdx = trimmed.lastIndexOf('}');
        if (startIdx !== -1 && endIdx > startIdx) {
          try {
            const jsonStr = trimmed.substring(startIdx, endIdx + 1);
            const data = JSON.parse(jsonStr);
            if (data.type === 'status') {
              if (data.stage === 'loading_model') {
                job.status = 'LOADING';
              } else if (data.stage === 'generating') {
                job.status = 'GENERATING';
              }
              if (data.device) {
                job.device = data.device;
              }
              this.onStatusCallback?.(jobId, job.status, data.message);
            } else if (data.type === 'progress') {
              job.status = 'GENERATING';
              job.progress = {
                step: data.step,
                totalSteps: data.totalSteps,
                percentage: data.percentage,
                elapsedSeconds: data.elapsedSeconds,
                statusMessage: `Denoising step ${data.step} / ${data.totalSteps}`,
              };
              this.onProgressCallback?.(jobId, job.progress);
            } else if (data.type === 'completed') {
              job.status = 'COMPLETED';
              job.images = data.images || [];
              job.completedAt = Date.now();
              job.device = data.device || job.device;

              // Attach base64 previews for instant rendering in desktop UI
              for (const img of job.images) {
                try {
                  if (fs.existsSync(img.localPath)) {
                    const imgBytes = fs.readFileSync(img.localPath);
                    img.base64Data = `data:image/png;base64,${imgBytes.toString('base64')}`;
                  }
                } catch {
                  // Ignored
                }
                this.imageHistory.unshift(img);
              }
              this.persistHistory();
              this.onCompletedCallback?.(jobId, job.images);
            } else if (data.type === 'error') {
              lastErrorMsg = data.message;
              job.status = 'FAILED';
              job.error = data.message;
              this.onErrorCallback?.(jobId, data.message);
            }
          } catch {
            // Non-JSON logging
          }
        }
      }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8').trim();
      if (text) {
        lastStderr = text;
      }
    });

    child.on('close', (code) => {
      this.activeProcesses.delete(jobId);
      try {
        if (fs.existsSync(tempConfigPath)) {
          fs.unlinkSync(tempConfigPath);
        }
      } catch {
        // Ignored
      }

      if (job.status !== 'COMPLETED' && job.status !== 'CANCELLED') {
        const finalStatus = code === 0 ? 'COMPLETED' : 'FAILED';
        job.status = finalStatus;
        if (finalStatus === 'FAILED') {
          const errMsg = lastErrorMsg || (lastStderr ? `Error: ${lastStderr}` : `Process exited with code ${code}`);
          job.error = errMsg;
          this.onErrorCallback?.(jobId, errMsg);
        }
      }
    });

    return { jobId };
  }

  public cancelGeneration(jobId: string): boolean {
    const child = this.activeProcesses.get(jobId);
    if (child && !child.killed) {
      child.kill('SIGTERM');
      this.activeProcesses.delete(jobId);
      const job = this.activeJobs.get(jobId);
      if (job) {
        job.status = 'CANCELLED';
        this.onStatusCallback?.(jobId, 'CANCELLED', 'Generation was cancelled by the user.');
      }
      return true;
    }
    return false;
  }
}
