import { z } from 'zod';

export const ChatMessageContentPartSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    text: z.string(),
  }),
  z.object({
    type: z.literal('image_url'),
    image_url: z.object({
      url: z.string(),
      detail: z.enum(['auto', 'low', 'high']).optional(),
    }),
  }),
]);

export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'developer', 'user', 'assistant', 'tool', 'function']),
  content: z.union([z.string(), z.array(ChatMessageContentPartSchema), z.null()]),
  name: z.string().optional(),
  tool_call_id: z.string().optional(),
  tool_calls: z.array(z.object({
    id: z.string(), type: z.literal('function'),
    function: z.object({ name: z.string(), arguments: z.string() }),
  })).optional(),
  function_call: z.object({ name: z.string(), arguments: z.string() }).optional(),
  refusal: z.string().nullable().optional(),
}).superRefine((message, ctx) => {
  if (message.role === 'tool' && !message.tool_call_id) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Tool messages require tool_call_id', path: ['tool_call_id'] });
  if (message.content === null && message.role !== 'assistant') ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Only assistant messages can have null content', path: ['content'] });
});

export const PersonaSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string(),
  avatar: z.string(),
  systemInstructions: z.string(),
  personalityTraits: z.array(z.string()),
  communicationStyle: z.enum([
    'Professional',
    'Casual',
    'Technical',
    'Concise',
    'Detailed',
    'Friendly',
    'Academic',
    'Creative',
  ]),
  responsePreferences: z.object({
    codeFormatting: z.string().optional(),
    reasoningStyle: z.string().optional(),
    formatPreference: z.string().optional(),
  }).optional(),
  behavioralRules: z.array(z.string()),
  responseStructure: z.string(),
  greetingMessage: z.string().optional(),
  isBuiltIn: z.boolean(),
  isDefault: z.boolean().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const ChatCompletionRequestSchema = z.object({
  model: z.string().min(1).optional().default('default'),
  messages: z.array(ChatMessageSchema).min(1),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  top_p: z.number().min(0).max(1).optional().default(0.9),
  max_tokens: z.number().int().positive().optional(),
  max_completion_tokens: z.number().int().positive().optional(),
  n: z.number().int().min(1).max(16).optional(),
  tools: z.array(z.object({
    type: z.literal('function'),
    function: z.object({ name: z.string().min(1), description: z.string().optional(), parameters: z.record(z.unknown()).optional(), strict: z.boolean().optional() }),
  })).optional(),
  tool_choice: z.union([z.enum(['none', 'auto', 'required']), z.object({ type: z.literal('function'), function: z.object({ name: z.string() }) })]).optional(),
  parallel_tool_calls: z.boolean().optional(),
  functions: z.array(z.object({ name: z.string().min(1), description: z.string().optional(), parameters: z.record(z.unknown()).optional() })).optional(),
  function_call: z.union([z.enum(['none', 'auto']), z.object({ name: z.string() })]).optional(),
  response_format: z.object({ type: z.enum(['text', 'json_object', 'json_schema']), json_schema: z.record(z.unknown()).optional() }).optional(),
  seed: z.number().int().optional(),
  logprobs: z.boolean().optional(),
  top_logprobs: z.number().int().min(0).max(20).optional(),
  cache_prompt: z.boolean().optional(),
  stream_options: z.object({ include_usage: z.boolean().optional() }).optional(),
  stream: z.boolean().optional().default(false),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  user: z.string().optional(),
  rag: z.boolean().optional().default(false),
  ragDocumentIds: z.array(z.string()).optional(),
  memory: z.boolean().optional(),
  memoryScope: z.enum(['all', 'global', 'persona', 'conversation']).optional(),
  conversationId: z.string().optional(),
  personaId: z.string().optional(),
  personaInstructions: z.string().optional(),
}).passthrough();

export const DocumentIngestRequestSchema = z.object({
  name: z.string().trim().min(1),
  content: z.string().min(1),
  type: z.enum(['pdf', 'md', 'txt', 'code', 'json', 'csv', 'other']).default('txt'),
});

export const RagSearchRequestSchema = z.object({
  query: z.string().trim().min(1),
  limit: z.number().int().min(1).max(100).default(4),
  documentIds: z.array(z.string().min(1)).optional(),
});

export const ImageGenerationRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(32000),
  model: z.string().min(1).default('tiny-sd'),
  n: z.number().int().min(1).max(4).default(1),
  size: z.string().regex(/^\d+x\d+$/).default('512x512'),
  response_format: z.enum(['url', 'b64_json']).default('url'),
  seed: z.number().int().min(0).max(2147483647).optional(),
  steps: z.number().int().min(1).max(100).default(20),
  guidance_scale: z.number().min(0).max(30).default(7.5),
  negative_prompt: z.string().optional(),
}).refine((value) => value.size.split('x').map(Number).every((size) => size >= 256 && size <= 1024 && size % 64 === 0), {
  message: 'Image dimensions must be multiples of 64 between 256 and 1024', path: ['size'],
});

export const LoftyDbConfigSchema = z.object({
  enabled: z.boolean().default(true),
  autoStart: z.boolean().default(true),
  mode: z.enum(['managed', 'external']).default('managed'),
  port: z.number().int().min(1024).max(65535).default(8090),
  baseUrl: z.string().url().default('http://127.0.0.1:8090'),
  dataDir: z.string().min(1),
  binaryPath: z.string().optional(),
  memoryEnabled: z.boolean().default(true),
  autoExtractMemories: z.boolean().default(true),
  recallLimit: z.number().int().min(1).max(20).default(5),
  minSimilarity: z.number().min(0).max(1).default(0.15),
});

export const MemoryEntryInputSchema = z.object({
  id: z.string().optional(),
  content: z.string().min(1),
  category: z.enum(['fact', 'preference', 'instruction', 'project', 'episode', 'context']).default('fact'),
  scope: z.enum(['global', 'persona', 'conversation']).default('global'),
  personaId: z.string().optional(),
  conversationId: z.string().optional(),
  importance: z.number().int().min(1).max(5).default(3),
  pinned: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  source: z.enum(['auto', 'manual', 'chat']).default('manual'),
});

export const EmbeddingRequestSchema = z.object({
  model: z.string().min(1).optional().default('default'),
  input: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  encoding_format: z.enum(['float', 'base64']).optional(),
  dimensions: z.number().int().positive().optional(),
  user: z.string().optional(),
});

export const ServerConfigurationSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  port: z.number().int().min(1024).max(65535),
  host: z.string(),
  lanEnabled: z.boolean(),
  activeModelId: z.string().optional(),
  activeVariantId: z.string().optional(),
  maxConcurrentRequests: z.number().int().min(1).max(64),
  contextLimit: z.number().int().min(512).max(131072),
  gpuLayers: z.number().int().min(0).max(999),
  threads: z.number().int().min(1).max(128),
  temperature: z.number().min(0).max(2),
  topP: z.number().min(0).max(1),
  autoStartOnBoot: z.boolean(),
  autoLoadModel: z.boolean(),
  lowMemoryMode: z.boolean().default(false),
  flashAttention: z.boolean().default(true),
  modelsDirectory: z.string(),
  runtimeDirectory: z.string(),
});

export const CreateAPIKeySchema = z.object({
  name: z.string().min(1).max(64),
});

export const PairDeviceRequestSchema = z.object({
  pairingToken: z.string().min(1),
  deviceName: z.string().min(1).max(64),
});
