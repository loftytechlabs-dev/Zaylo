export interface ZayloModel {
  id: string;
  name: string;
  publisher: string;
  description: string;
  parameterCount: string;
  quantization: string;
  sizeMb: number;
  contextLength: number;
  downloadUrl: string;
  isInstalled: boolean;
  capabilities: string[];
}

export const ZAYLO_MODELS: ZayloModel[] = [
  {
    id: 'smollm2-135m-instruct',
    name: 'SmolLM2 135M Instruct',
    publisher: 'HuggingFaceTB',
    description: 'Compact 135M model engineered for lightning-fast testing and low-memory mobile execution.',
    parameterCount: '135M',
    quantization: 'Q8_0',
    sizeMb: 144,
    contextLength: 2048,
    downloadUrl: 'https://huggingface.co/bartowski/SmolLM2-135M-Instruct-GGUF/resolve/main/SmolLM2-135M-Instruct-Q8_0.gguf',
    isInstalled: false,
    capabilities: ['TESTING', 'CHAT'],
  },
  {
    id: 'qwen2.5-0.5b-instruct',
    name: 'Qwen 2.5 0.5B Instruct',
    publisher: 'Qwen',
    description: 'Compact multilingual model with outstanding reasoning capabilities for mobile processors.',
    parameterCount: '0.5B',
    quantization: 'Q4_K_M',
    sizeMb: 491,
    contextLength: 4096,
    downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
    isInstalled: false,
    capabilities: ['CHAT', 'MULTILINGUAL'],
  },
  {
    id: 'llama-3.2-1b-instruct',
    name: 'Llama 3.2 1B Instruct',
    publisher: 'Meta',
    description: 'Ultra-fast lightweight model optimized for chat, code assistance, and on-device inference.',
    parameterCount: '1B',
    quantization: 'Q4_K_M',
    sizeMb: 808,
    contextLength: 8192,
    downloadUrl: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    isInstalled: false,
    capabilities: ['CHAT', 'TEXT_GENERATION'],
  },
  {
    id: 'llama-3.2-3b-instruct',
    name: 'Llama 3.2 3B Instruct',
    publisher: 'Meta',
    description: 'High-capability reasoning model with virtual memory paging for complex mobile multi-turn chats.',
    parameterCount: '3B',
    quantization: 'Q4_K_M',
    sizeMb: 2020,
    contextLength: 8192,
    downloadUrl: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    isInstalled: false,
    capabilities: ['CHAT', 'REASONING'],
  },
  {
    id: 'phi-3.5-mini-instruct',
    name: 'Phi-3.5 Mini Instruct',
    publisher: 'Microsoft',
    description: 'Microsoft 3.8B parameter model featuring exceptional mathematical and logic reasoning.',
    parameterCount: '3.8B',
    quantization: 'Q4_K_M',
    sizeMb: 2390,
    contextLength: 4096,
    downloadUrl: 'https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF/resolve/main/Phi-3.5-mini-instruct-Q4_K_M.gguf',
    isInstalled: false,
    capabilities: ['MATH', 'REASONING'],
  },
  {
    id: 'mistral-7b-instruct-v0.3',
    name: 'Mistral 7B Instruct v0.3',
    publisher: 'Mistral AI',
    description: 'Industry-standard 7B parameter workhorse with high accuracy and extended context.',
    parameterCount: '7B',
    quantization: 'Q4_K_M',
    sizeMb: 4370,
    contextLength: 8192,
    downloadUrl: 'https://huggingface.co/bartowski/Mistral-7B-Instruct-v0.3-GGUF/resolve/main/Mistral-7B-Instruct-v0.3-Q4_K_M.gguf',
    isInstalled: false,
    capabilities: ['PRODUCTION', 'CHAT'],
  },
  {
    id: 'deepseek-r1-distill-qwen-7b',
    name: 'DeepSeek R1 Distill Qwen 7B',
    publisher: 'DeepSeek',
    description: 'State-of-the-art distilled reasoning model with advanced chain-of-thought capabilities.',
    parameterCount: '7B',
    quantization: 'Q4_K_M',
    sizeMb: 4680,
    contextLength: 8192,
    downloadUrl: 'https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf',
    isInstalled: false,
    capabilities: ['CHAIN_OF_THOUGHT', 'REASONING'],
  },
];
