export type SystemPlatform = 'darwin' | 'linux' | 'win32';
export type Architecture = 'x64' | 'arm64' | 'ia32' | 'arm';

export type GPUBackend = 'metal' | 'cuda' | 'rocm' | 'vulkan' | 'directx' | 'cpu';

export interface GPUInfo {
  vendor: string;
  model: string;
  vramBytes?: number;
  driverVersion?: string;
  backend: GPUBackend;
  isIntegrated: boolean;
}

export interface CPUInfo {
  model: string;
  architecture: Architecture;
  physicalCores: number;
  logicalThreads: number;
  baseFrequencyHz?: number;
}

export interface MemoryInfo {
  totalBytes: number;
  availableBytes: number;
  usedBytes: number;
}

export interface DiskInfo {
  mount: string;
  totalBytes: number;
  availableBytes: number;
  usedBytes: number;
}

export interface HardwareProfile {
  platform: SystemPlatform;
  osRelease: string;
  hostname: string;
  cpu: CPUInfo;
  memory: MemoryInfo;
  gpus: GPUInfo[];
  primaryGPU?: GPUInfo;
  disks: DiskInfo[];
  detectedAt: number;
}

export type CompatibilityRating =
  | 'Excellent'
  | 'Good'
  | 'Limited'
  | 'Not recommended'
  | 'Unsupported';

export interface CompatibilityAnalysis {
  rating: CompatibilityRating;
  reason: string;
  estimatedMemoryBytes: number;
  availableMemoryBytes: number;
  canFitInVRAM: boolean;
  recommendedContextLimit: number;
  recommendedGpuLayers: number;
}

export interface CapabilityProfile {
  hardware: HardwareProfile;
  supportedBackends: GPUBackend[];
  maxRecommendedContext: number;
  memoryBudgetBytes: number;
  vramBudgetBytes: number;
  hasHardwareAcceleration: boolean;
  analyzedAt: number;
}

export type ModelFormat = 'gguf' | 'onnx' | 'safetensors';
export type ModelQuantization = 'Q4_K_M' | 'Q4_K_S' | 'Q5_K_M' | 'Q8_0' | 'F16' | 'F32' | 'None';

export type ModelCapability =
  | 'TEXT_GENERATION'
  | 'CHAT'
  | 'EMBEDDINGS'
  | 'VISION'
  | 'AUDIO'
  | 'SPEECH_TO_TEXT'
  | 'SPEECH_RECOGNITION'
  | 'SPEECH_GENERATION'
  | 'IMAGE_GENERATION'
  | 'AUDIO_INPUT'
  | 'AUDIO_OUTPUT'
  | 'REALTIME_AUDIO'
  | 'VOICE_ACTIVITY_DETECTION';

export type ModelTaskType =
  | 'text-generation'
  | 'image-generation'
  | 'vision'
  | 'multimodal'
  | 'speech-recognition'
  | 'speech-generation'
  | 'voice-assistant';

export interface ModelVariant {
  id: string;
  name: string;
  quantization: ModelQuantization;
  format: ModelFormat;
  sizeBytes: number;
  downloadUrl: string;
  sha256?: string;
  contextLength: number;
  estimatedRAMBytes: number;
  estimatedVRAMBytes: number;
  gpuLayers: number;
  mmprojUrl?: string;
  mmprojSizeBytes?: number;
}

export interface Model {
  id: string;
  name: string;
  publisher: string;
  description: string;
  parameterCount: string; // e.g. "135M", "3B", "7B"
  capabilities: ModelCapability[];
  taskType?: ModelTaskType;
  variants: ModelVariant[];
  defaultVariantId: string;
  tags: string[];
}

export interface ModelInstallation {
  id: string;
  modelId: string;
  variantId: string;
  name: string;
  localPath: string;
  sizeBytes: number;
  sha256?: string;
  installedAt: number;
  isLoaded: boolean;
  format: ModelFormat;
  quantization: ModelQuantization;
  contextLength: number;
  mmprojPath?: string;
  taskType?: ModelTaskType;
}

export interface ImageResolution {
  width: number;
  height: number;
  label: string;
  aspectRatio: string;
}

export interface ImageGenerationParams {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  steps: number;
  guidanceScale: number;
  seed?: number;
  batchSize?: number;
  scheduler?: string;
}

export interface GeneratedImage {
  id: string;
  jobId: string;
  localPath: string;
  base64Data?: string;
  width: number;
  height: number;
  seed: number;
  prompt: string;
  negativePrompt?: string;
  steps: number;
  guidanceScale: number;
  modelId: string;
  modelName: string;
  createdAt: number;
  durationMs: number;
  fileSizeBytes: number;
  device?: string;
}

export interface ImageGenerationProgress {
  step: number;
  totalSteps: number;
  percentage: number;
  elapsedSeconds: number;
  etaSeconds?: number;
  statusMessage?: string;
}

export interface ImageGenerationJob {
  id: string;
  modelId: string;
  modelName: string;
  status: 'PENDING' | 'LOADING' | 'GENERATING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  params: ImageGenerationParams;
  progress: ImageGenerationProgress;
  images: GeneratedImage[];
  error?: string;
  startedAt: number;
  completedAt?: number;
  device?: string;
}

export interface ModelCapabilityProfile {
  modelId: string;
  name: string;
  taskType: ModelTaskType;
  architecture: string;
  supportedRuntimes: (
    | 'llama-cpp'
    | 'diffusers'
    | 'stable-diffusion-cpp'
    | 'mlx'
    | 'whisper-local'
    | 'transformers'
    | 'native-tts'
    | 'speech-dispatcher'
    | 'sapi'
  )[];
  fileFormats: ('gguf' | 'safetensors' | 'onnx' | 'diffusers' | 'bin')[];
  supportedPlatforms: ('darwin' | 'win32' | 'linux')[];
  accelerationOptions: ('mps' | 'cuda' | 'vulkan' | 'cpu')[];
  minMemoryBytes: number;
  recommendedMemoryBytes: number;
  minVramBytes?: number;
  recommendedVramBytes?: number;
  imageParameters?: {
    supportedResolutions: ImageResolution[];
    supportsNegativePrompt: boolean;
    supportsGuidanceScale: boolean;
    supportsSteps: boolean;
    supportsSeed: boolean;
    supportsBatchCount: boolean;
    defaultWidth: number;
    defaultHeight: number;
    defaultSteps: number;
    minSteps: number;
    maxSteps: number;
    defaultGuidanceScale: number;
    minGuidanceScale: number;
    maxGuidanceScale: number;
  };
  knownLimitations: string[];
}

export type DownloadStatus = 'pending' | 'downloading' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface DownloadProgress {
  id: string;
  modelId: string;
  variantId: string;
  filename: string;
  status: DownloadStatus;
  downloadedBytes: number;
  totalBytes: number;
  bytesPerSecond: number;
  estimatedSecondsRemaining?: number;
  error?: string;
  startedAt: number;
  updatedAt: number;
}

export type ServerState =
  | 'STOPPED'
  | 'STARTING'
  | 'RUNNING'
  | 'DEGRADED'
  | 'STOPPING'
  | 'CRASHED'
  | 'ERROR';

export interface ServerConfiguration {
  id: string;
  name: string;
  port: number;
  host: string;
  lanEnabled: boolean;
  activeModelId?: string;
  activeVariantId?: string;
  maxConcurrentRequests: number;
  contextLimit: number;
  gpuLayers: number;
  threads: number;
  temperature: number;
  topP: number;
  autoStartOnBoot: boolean;
  autoLoadModel: boolean;
  lowMemoryMode: boolean;
  flashAttention: boolean;
  modelsDirectory: string;
  runtimeDirectory: string;
}

export interface RuntimeInstance {
  id: string;
  runtimeId: string;
  pid?: number;
  port: number;
  state: ServerState;
  modelPath: string;
  modelName: string;
  loadedAt?: number;
  gpuLayersOffloaded: number;
  allocatedVRAMBytes?: number;
  allocatedRAMBytes?: number;
  error?: string;
}

export interface ChatMessageTextContentPart {
  type: 'text';
  text: string;
}

export interface ChatMessageImageContentPart {
  type: 'image_url';
  image_url: {
    url: string; // Base64 data URL (e.g. data:image/jpeg;base64,...) or image URL
  };
}

export type ChatMessageContentPart = ChatMessageTextContentPart | ChatMessageImageContentPart;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ChatMessageContentPart[];
  name?: string;
}

export type PersonaCommunicationStyle =
  | 'Professional'
  | 'Casual'
  | 'Technical'
  | 'Concise'
  | 'Detailed'
  | 'Friendly'
  | 'Academic'
  | 'Creative';

export interface PersonaResponsePreferences {
  codeFormatting?: string;
  reasoningStyle?: string;
  formatPreference?: string;
}

export interface Persona {
  id: string;
  name: string;
  description: string;
  avatar: string;
  systemInstructions: string;
  personalityTraits: string[];
  communicationStyle: PersonaCommunicationStyle;
  responsePreferences?: PersonaResponsePreferences;
  behavioralRules: string[];
  responseStructure: string;
  greetingMessage?: string;
  isBuiltIn: boolean;
  isDefault?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  user?: string;
  rag?: boolean;
  ragDocumentIds?: string[];
  personaId?: string;
  personaInstructions?: string;
}

export type DocumentType = 'pdf' | 'md' | 'txt' | 'code' | 'json' | 'csv' | 'other';

export interface DocumentInfo {
  id: string;
  name: string;
  type: DocumentType;
  sizeBytes: number;
  chunkCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  embedding?: number[];
  tokenCount: number;
}

export interface RagSearchResult {
  chunkId: string;
  documentId: string;
  documentName: string;
  content: string;
  score: number;
  chunkIndex: number;
}

export interface ChatCompletionChoice {
  index: number;
  message?: ChatMessage;
  delta?: {
    role?: string;
    content?: string;
  };
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
}

export interface ChatCompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion' | 'chat.completion.chunk';
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: ChatCompletionUsage;
}

export interface EmbeddingRequest {
  model: string;
  input: string | string[];
  user?: string;
}

export interface EmbeddingData {
  object: 'embedding';
  index: number;
  embedding: number[];
}

export interface EmbeddingResponse {
  object: 'list';
  data: EmbeddingData[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface NetworkInterfaceInfo {
  name: string;
  address: string;
  family: 'IPv4' | 'IPv6';
  internal: boolean;
  type: 'wifi' | 'ethernet' | 'loopback' | 'other';
  mac?: string;
}

export interface ConnectedDevice {
  id: string;
  ipAddress: string;
  userAgent?: string;
  deviceName: string;
  pairedAt: number;
  lastRequestAt: number;
  requestCount: number;
  isRevoked: boolean;
}

export interface PairingTokenInfo {
  token: string;
  serverUrl: string;
  serverName: string;
  expiresAt: number;
  qrDataUrl: string;
}

export interface APIKeyInfo {
  id: string;
  name: string;
  prefix: string; // e.g. "lcl_3a9f..."
  rawKey?: string; // full raw key for user convenience on local server
  createdAt: number;
  lastUsedAt?: number;
  isRevoked: boolean;
}

export interface SystemMetricSample {
  timestamp: number;
  cpuPercent: number;
  memoryUsedBytes: number;
  memoryTotalBytes: number;
  gpuPercent?: number;
  vramUsedBytes?: number;
  vramTotalBytes?: number;
  activeRequests: number;
  tokensPerSecond: number;
  latencyMs: number;
}

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
export type LogComponent = 'SERVER' | 'RUNTIME' | 'INFERENCE' | 'NETWORK' | 'SYSTEM' | 'SECURITY';

export interface StructuredLog {
  id: string;
  timestamp: number;
  level: LogLevel;
  component: LogComponent;
  event: string;
  message: string;
  requestId?: string;
  modelId?: string;
  meta?: Record<string, unknown>;
}

export interface BenchmarkResult {
  id: string;
  modelId: string;
  variantId: string;
  modelName: string;
  timestamp: number;
  promptTokens: number;
  completionTokens: number;
  promptProcessingTokensPerSec: number;
  generationTokensPerSec: number;
  timeToFirstTokenMs: number;
  totalDurationMs: number;
  peakMemoryBytes: number;
}

// ==================== FORGE FINE-TUNING STUDIO TYPES ====================

export type ForgeModelStatus = 'READY' | 'REQUIRES_CHECKPOINT' | 'UNSUPPORTED' | 'MISSING_DEPENDENCIES';

export interface ForgeModelInspection {
  modelId: string;
  variantId: string;
  name: string;
  architecture?: string;
  parameterCount?: string;
  format: ModelFormat;
  quantization: ModelQuantization;
  sizeBytes: number;
  localPath: string;
  status: ForgeModelStatus;
  statusReason?: string;
  recommendedResolution?: string;
  checkpointPath?: string;
  hfRepoId?: string;
  tokenizerPath?: string;
  supportedBackends: TrainingBackend[];
}

export type DatasetFormat = 'instruction' | 'conversational' | 'prompt_completion' | 'csv' | 'unknown';

export interface DatasetColumnMapping {
  promptColumn?: string;
  completionColumn?: string;
  responseColumn?: string;
  instructionColumn?: string;
  inputColumn?: string;
  outputColumn?: string;
  systemColumn?: string;
}

export interface DatasetAnalysis {
  filePath: string;
  fileName: string;
  fileSizeBytes: number;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  duplicateRecords: number;
  detectedFormat: DatasetFormat;
  columns?: string[];
  columnMapping?: DatasetColumnMapping;
  exampleRecords: any[];
  invalidSampleErrors: string[];
  tokenLengthDistribution: {
    min: number;
    max: number;
    mean: number;
    p50: number;
    p95: number;
  };
}

export type TrainingObjective = 'instruction' | 'conversational' | 'completion';
export type TrainingBackend = 'peft' | 'mlx';
export type FineTuningMethod = 'lora' | 'full';

export interface TrainingConfig {
  jobId: string;
  jobName: string;
  modelId: string;
  modelName: string;
  checkpointPath: string;
  datasetPath: string;
  datasetName: string;
  objective: TrainingObjective;
  method: FineTuningMethod;
  backend: TrainingBackend;
  learningRate: number;
  loraRank: number;
  loraAlpha: number;
  loraDropout: number;
  targetModules: string[];
  batchSize: number;
  gradientAccumulationSteps: number;
  maxSeqLength: number;
  epochs: number;
  optimizer: string;
  precision: 'float32' | 'float16' | 'bfloat16';
  warmupRatio: number;
  weightDecay: number;
  saveSteps: number;
  trainValSplit: number;
  outputDir: string;
  resumeFromCheckpoint?: string;
  columnMapping?: DatasetColumnMapping;
}

export interface HardwareConstraintEstimates {
  estimatedMemoryBytes: number;
  availableMemoryBytes: number;
  estimatedDiskBytes: number;
  availableDiskBytes: number;
  estimatedDurationSeconds?: number;
  isFeasible: boolean;
  warnings: string[];
  acceleration: 'mps' | 'cuda' | 'cpu';
}

export interface PreflightCheck {
  id: string;
  name: string;
  category: 'model' | 'dataset' | 'hardware' | 'environment' | 'storage';
  status: 'passed' | 'warning' | 'failed';
  message: string;
  detail?: string;
  remediation?: string;
}

export interface PreflightReport {
  checks: PreflightCheck[];
  canProceed: boolean;
}

export type TrainingJobStatus =
  | 'QUEUED'
  | 'INITIALIZING'
  | 'TRAINING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface TrainingMetricSample {
  step: number;
  totalSteps: number;
  epoch: number;
  totalEpochs: number;
  loss: number;
  evalLoss?: number;
  learningRate?: number;
  gradNorm?: number;
  tokenAccuracy?: number;
  tokensPerSec?: number;
  elapsedSeconds: number;
  estimatedRemainingSeconds?: number;
  cpuPercent?: number;
  memoryBytes?: number;
  gpuMemoryBytes?: number;
  timestamp: number;
}

export interface TrainingCheckpoint {
  step: number;
  path: string;
  loss?: number;
  sizeBytes?: number;
  createdAt: number;
  recoverable?: boolean;
}

export interface TrainingJob {
  id: string;
  name: string;
  modelId: string;
  modelName: string;
  checkpointPath: string;
  datasetPath: string;
  datasetRecords: number;
  status: TrainingJobStatus;
  config: TrainingConfig;
  estimates: HardwareConstraintEstimates;
  currentStep: number;
  totalSteps: number;
  currentEpoch: number;
  totalEpochs: number;
  currentLoss?: number;
  metricsHistory: TrainingMetricSample[];
  recentLogs: string[];
  checkpoints: TrainingCheckpoint[];
  outputDir: string;
  artifactPath?: string;
  artifactType?: 'lora_adapter' | 'merged_model';
  artifactSizeBytes?: number;
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  updatedAt: number;
}

export interface FineTunedModelArtifact {
  id: string;
  jobId: string;
  name: string;
  baseModelId: string;
  baseModelName: string;
  type: 'lora' | 'merged' | 'standalone';
  artifactPath: string;
  sizeBytes: number;
  format: string;
  compatibilityStatus: 'ready' | 'base_required' | 'incompatible';
  statusReason?: string;
  finalLoss?: number;
  trainingDurationSeconds: number;
  createdAt: number;
}

export interface ModelComparisonRequest {
  baseModelPath: string;
  adapterPath?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ModelComparisonResult {
  prompt: string;
  baseResponse: string;
  fineTunedResponse: string;
  baseDurationMs: number;
  fineTunedDurationMs: number;
}

export interface DatasetEvaluationSample {
  prompt: string;
  expected: string;
  baseOutput: string;
  ftOutput: string;
  latencyBaseMs: number;
  latencyFtMs: number;
  scoreMatch?: number;
}

export interface DatasetEvaluationReport {
  jobId: string;
  samples: DatasetEvaluationSample[];
  metrics: {
    valLoss?: number;
    tokenF1Score?: number;
    accuracyScore?: number;
  };
  durationSeconds: number;
}

export type LiveStudioTab =
  | 'overview'
  | 'charts'
  | 'playground'
  | 'logs'
  | 'checkpoints'
  | 'evaluation';

// Zaylo Voice Architecture Types
export type VoiceState =
  | 'idle'
  | 'requesting_permission'
  | 'loading_model'
  | 'listening'
  | 'processing'
  | 'thinking'
  | 'speaking'
  | 'interrupted'
  | 'error';

export interface VoiceProfile {
  id: string;
  name: string;
  lang: string;
  gender?: string;
  provider?: string;
  description?: string;
}

export interface VoiceConfig {
  assistantName: string;
  systemPersonality: string;
  responseStyle: 'concise' | 'balanced' | 'detailed';
  selectedLanguageModel: string;
  selectedAsrModel: string;
  selectedTtsModel: string;
  voiceId: string;
  speakingRate: number;
  pitch: number;
  language: string;
  silenceTimeoutMs: number;
  autoListen: boolean;
  audioInputDeviceId?: string;
  audioOutputDeviceId?: string;
}

export interface VoiceTranscriptTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  durationMs?: number;
}

export interface VoiceStatus {
  ready: boolean;
  micPermission: boolean;
  asrReady: boolean;
  llmReady: boolean;
  ttsReady: boolean;
  activeModel?: string;
  availableVoices: VoiceProfile[];
  installedModels: string[];
  missingComponents: string[];
}


