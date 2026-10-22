import type {
  HardwareProfile,
  CapabilityProfile,
  Model,
  ModelInstallation,
  DownloadProgress,
  ServerConfiguration,
  RuntimeInstance,
  ServerState,
  ConnectedDevice,
  PairingTokenInfo,
  APIKeyInfo,
  SystemMetricSample,
  StructuredLog,
  BenchmarkResult,
  ChatCompletionRequest,
  ChatCompletionResponse,
  DocumentInfo,
  DocumentType,
  RagSearchResult,
  ForgeModelInspection,
  DatasetColumnMapping,
  DatasetAnalysis,
  TrainingObjective,
  TrainingConfig,
  HardwareConstraintEstimates,
  PreflightReport,
  TrainingJob,
  TrainingJobStatus,
  TrainingMetricSample,
  FineTunedModelArtifact,
  ModelComparisonRequest,
  ModelComparisonResult,
  DatasetEvaluationReport,
  ImageGenerationParams,
  GeneratedImage,
  ImageGenerationJob,
  ImageGenerationProgress,
  ModelCapabilityProfile,
} from '@local-ai/shared';

export interface IPCChannels {
  // Hardware & Capabilities
  'hardware:get-profile': { request: void; response: HardwareProfile };
  'hardware:get-capabilities': { request: void; response: CapabilityProfile };

  // Models
  'models:list-available': { request: void; response: Model[] };
  'models:list-installed': { request: void; response: ModelInstallation[] };
  'models:search-hf': { request: { query: string; limit?: number }; response: Model[] };
  'models:download': { request: { modelId: string; variantId: string; downloadUrl?: string; name?: string }; response: { downloadId: string } };
  'models:cancel-download': { request: { downloadId: string }; response: boolean };
  'models:delete': { request: { installationId: string }; response: boolean };
  'models:get-downloads': { request: void; response: DownloadProgress[] };
  'models:import-local': { request: { filePath?: string; name?: string }; response: ModelInstallation | null };
  'models:select-file': { request: void; response: string | null };

  // Server & Runtime Lifecycle
  'server:get-config': { request: void; response: ServerConfiguration };
  'server:update-config': { request: Partial<ServerConfiguration>; response: ServerConfiguration };
  'server:get-state': { request: void; response: { state: ServerState; instance?: RuntimeInstance; lanAddress?: string; port: number } };
  'server:start': { request: { modelId?: string; variantId?: string }; response: boolean };
  'server:stop': { request: void; response: boolean };
  'server:restart': { request: void; response: boolean };
  'server:load-model': { request: { modelId: string; variantId?: string }; response: boolean };
  'server:unload-model': { request: void; response: boolean };

  // Runtime Management
  'runtime:check-status': { request: void; response: { installed: boolean; version?: string; path?: string; supportedBackends: string[] } };
  'runtime:install': { request: void; response: { success: boolean; path?: string; error?: string } };

  // Network & Devices
  'network:get-interfaces': { request: void; response: { interfaces: Array<{ name: string; address: string; family: string; type: string }> } };
  'network:get-qr-code': { request: { text: string }; response: { qrDataUrl: string } };
  'devices:list': { request: void; response: ConnectedDevice[] };
  'devices:create-pairing-token': { request: void; response: PairingTokenInfo };
  'devices:revoke': { request: { deviceId: string }; response: boolean };
  'devices:delete': { request: { deviceId: string }; response: boolean };
  'devices:rename': { request: { deviceId: string; name: string }; response: boolean };

  // API Keys
  'keys:list': { request: void; response: APIKeyInfo[] };
  'keys:create': { request: { name: string }; response: { key: APIKeyInfo; rawKey: string } };
  'keys:revoke': { request: { keyId: string }; response: boolean };
  'keys:delete': { request: { keyId: string }; response: boolean };

  // Metrics & Logs
  'metrics:get-current': { request: void; response: SystemMetricSample };
  'metrics:get-history': { request: { limit?: number }; response: SystemMetricSample[] };
  'logs:get-recent': { request: { limit?: number; level?: string; component?: string }; response: StructuredLog[] };
  'logs:clear': { request: void; response: boolean };

  // Inference Playground
  'inference:chat': { request: ChatCompletionRequest; response: ChatCompletionResponse };
  'inference:abort': { request: { requestId: string }; response: boolean };

  // Knowledge & Local Document RAG
  'rag:list-documents': { request: void; response: DocumentInfo[] };
  'rag:add-document': { request: { name: string; content: string; type?: DocumentType }; response: DocumentInfo };
  'rag:delete-document': { request: { id: string }; response: boolean };
  'rag:search': { request: { query: string; limit?: number; documentIds?: string[] }; response: RagSearchResult[] };

  // Benchmark
  'benchmark:run': { request: { modelId?: string; variantId?: string; promptTokens?: number; genTokens?: number }; response: BenchmarkResult };
  'benchmark:get-history': { request: void; response: BenchmarkResult[] };

  // Forge Fine-Tuning Studio
  'forge:list-models': { request: void; response: ForgeModelInspection[] };
  'forge:inspect-model': { request: { modelId: string }; response: ForgeModelInspection };
  'forge:fetch-checkpoint': { request: { modelId: string; hfRepoId?: string }; response: { success: boolean; checkpointPath?: string; error?: string } };
  'forge:parse-dataset': { request: { filePath: string; columnMapping?: DatasetColumnMapping; maxPreview?: number }; response: DatasetAnalysis };
  'forge:select-dataset-file': { request: void; response: string | null };
  'forge:load-sample-dataset': { request: { type: 'instruction' | 'conversational' }; response: { filePath: string; analysis: DatasetAnalysis } };
  'forge:auto-configure': { request: { modelId: string; datasetPath: string; objective?: TrainingObjective; columnMapping?: DatasetColumnMapping }; response: { config: TrainingConfig; estimates: HardwareConstraintEstimates } };
  'forge:validate-config': { request: { config: TrainingConfig }; response: { valid: boolean; estimates: HardwareConstraintEstimates; errors: string[] } };
  'forge:run-preflight': { request: { config: TrainingConfig }; response: PreflightReport };
  'forge:start-training': { request: { config: TrainingConfig }; response: { jobId: string; started: boolean } };
  'forge:pause-training': { request: { jobId: string }; response: boolean };
  'forge:resume-training': { request: { jobId: string }; response: boolean };
  'forge:cancel-training': { request: { jobId: string }; response: boolean };
  'forge:get-job': { request: { jobId: string }; response: TrainingJob | null };
  'forge:list-jobs': { request: void; response: TrainingJob[] };
  'forge:list-fine-tuned-models': { request: void; response: FineTunedModelArtifact[] };
  'forge:compare-models': { request: ModelComparisonRequest; response: ModelComparisonResult };
  'forge:merge-adapter': { request: { artifactId: string }; response: { success: boolean; outputPath?: string; error?: string } };
  'forge:export-artifact': { request: { artifactId: string; destinationDir: string }; response: { success: boolean; exportPath?: string; error?: string } };
  'forge:delete-artifact': { request: { artifactId: string }; response: boolean };
  'forge:resume-from-checkpoint': { request: { jobId: string; checkpointStep: number }; response: { success: boolean; error?: string } };
  'forge:evaluate-dataset': { request: { jobId: string; numExamples?: number }; response: DatasetEvaluationReport };

  // Image Generation
  'image:generate': {
    request: {
      modelId: string;
      modelName?: string;
      modelPath?: string;
      params: Partial<ImageGenerationParams>;
      outputDir?: string;
      device?: 'auto' | 'mps' | 'cuda' | 'cpu';
    };
    response: { jobId: string };
  };
  'image:cancel': { request: { jobId: string }; response: boolean };
  'image:get-job': { request: { jobId: string }; response: ImageGenerationJob | null };
  'image:list-history': { request: void; response: GeneratedImage[] };
  'image:delete': { request: { imageId: string }; response: boolean };
  'image:save-as': { request: { imagePath: string; defaultName?: string }; response: string | null };
  'image:open-folder': { request: { imagePath: string }; response: void };

  // Model Capabilities
  'capabilities:get-model-profile': { request: { modelId: string }; response: ModelCapabilityProfile | null };
  'capabilities:list-profiles': { request: void; response: ModelCapabilityProfile[] };

  // App & System
  'app:get-version': { request: void; response: string };
  'app:select-directory': { request: { defaultPath?: string }; response: string | null };
  'app:open-external': { request: { url: string }; response: void };
}

export interface IPCEvents {
  'metrics:update': SystemMetricSample;
  'logs:new': StructuredLog;
  'server:state-changed': { state: ServerState; instance?: RuntimeInstance };
  'download:progress': DownloadProgress;
  'inference:chunk': { requestId: string; chunk: ChatCompletionResponse };
  'forge:training-metric': { jobId: string; sample: TrainingMetricSample };
  'forge:training-log': { jobId: string; log: string };
  'forge:training-status': { jobId: string; status: TrainingJobStatus; error?: string };
  'image:status': { jobId: string; status: string; message?: string };
  'image:progress': { jobId: string; progress: ImageGenerationProgress };
  'image:completed': { jobId: string; images: GeneratedImage[] };
  'image:error': { jobId: string; error: string };
  'models:updated': void;
}
