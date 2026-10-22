export interface ServerHealth {
  status: 'ok' | 'degraded';
  server: 'running' | 'stopped';
  modelLoaded: boolean;
  activeModel: string | null;
  uptime?: number;
}

export interface ServerInfo {
  name: string;
  port: number;
  host: string;
  lanEnabled: boolean;
  activeModel: string | null;
  maxConcurrentRequests: number;
  contextLimit: number;
}

export interface ModelInfo {
  id: string;
  name?: string;
  object?: string;
  created?: number;
  owned_by?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }>;
}

export interface PermissionRequest {
  id: string;
  tool: 'create_folder' | 'write_file' | 'edit_file' | 'run_command' | 'delete_file' | 'read_file';
  title: string;
  description: string;
  target?: string;
  command?: string;
  codePreview?: string;
}

export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'connect'; url?: string; apiKey?: string }
  | { type: 'disconnect' }
  | { type: 'sendMessage'; prompt: string; mode: 'chat' | 'agent' }
  | { type: 'stopStream' }
  | { type: 'switchModel'; model: string }
  | { type: 'newSession' }
  | { type: 'insertCode'; code: string }
  | { type: 'applyDiff'; file: string; original: string; modified: string }
  | { type: 'previewDiff'; file: string; original: string; modified: string }
  | { type: 'openApiKeyPrompt' }
  | { type: 'setApiKey'; apiKey: string }
  | { type: 'permissionResponse'; id: string; decision: 'allow' | 'always' | 'deny' }
  | { type: 'toggleAutoApprove'; enabled: boolean }
  | { type: 'openTerminal' }
  | { type: 'moveToRightSide' };

export type ExtensionMessage =
  | {
      type: 'connectionState';
      connected: boolean;
      serverUrl: string;
      activeModel: string | null;
      models: string[];
      error?: string;
    }
  | {
      type: 'streamChunk';
      chunk: string;
      isDone: boolean;
      messageId: string;
    }
  | {
      type: 'activeEditorContext';
      file: string | null;
      selection: string | null;
      language: string | null;
      lineRange: string | null;
    }
  | {
      type: 'agentAction';
      actionType: 'start' | 'progress' | 'finish' | 'error';
      toolName: string;
      description: string;
      output?: string;
    }
  | {
      type: 'permissionRequest';
      request: PermissionRequest;
    }
  | {
      type: 'permissionResolved';
      id: string;
      decision: 'allow' | 'always' | 'deny';
    }
  | {
      type: 'autoApproveState';
      enabled: boolean;
    }
  | {
      type: 'terminalOutput';
      command: string;
      output: string;
      exitCode: number;
    }
  | {
      type: 'error';
      message: string;
    };
