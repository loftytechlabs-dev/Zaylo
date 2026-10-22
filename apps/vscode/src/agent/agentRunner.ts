import * as vscode from 'vscode';
import { AgentTools } from '../tools/agentTools';
import { PermissionRequest, ChatMessage } from '../types';
import { ZayloClient } from '../zayloClient';

export interface ParsedAction {
  tool: 'create_folder' | 'write_file' | 'edit_file' | 'run_command' | 'read_file';
  payload: any;
  rawText: string;
}

export interface AgentRunnerCallbacks {
  onChunk: (delta: string) => void;
  onRequestPermission: (request: PermissionRequest) => Promise<'allow' | 'always' | 'deny'>;
  onToolStart: (toolName: string, description: string) => void;
  onToolFinish: (toolName: string, output: string, error?: string) => void;
  onTerminalOutput?: (command: string, output: string, exitCode: number) => void;
}

export class AgentRunner {
  private client: ZayloClient;
  private autoApprove: boolean;
  private isAborted = false;

  constructor(client: ZayloClient, initialAutoApprove = false) {
    this.client = client;
    this.autoApprove = initialAutoApprove;
  }

  public setAutoApprove(enabled: boolean): void {
    this.autoApprove = enabled;
  }

  public getAutoApprove(): boolean {
    return this.autoApprove;
  }

  public stop(): void {
    this.isAborted = true;
    this.client.stopStream();
  }

  public static parseActionBlocks(text: string): ParsedAction[] {
    const actions: ParsedAction[] = [];

    // 1. Check for XML tag format with path/command attributes or inner body:
    // e.g. <zaylo_action tool="write_file" path="...">code</zaylo_action>
    // or <write_file path="...">code</write_file>
    // or <edit_file path="...">code</edit_file>
    const tagRegex = /<(zaylo_action|write_file|edit_file|read_file|create_folder|run_command)(?:\s+tool=["']([^"']+)["'])?(?:\s+path=["']([^"']+)["'])?(?:\s+command=["']([^"']+)["'])?>([\s\S]*?)<\/\1>/gi;
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(text)) !== null) {
      let toolName = (match[2] || match[1]).toLowerCase();
      if (toolName === 'zaylo_action' && match[2]) {
        toolName = match[2].toLowerCase();
      }
      const pathAttr = match[3];
      const cmdAttr = match[4];
      const body = match[5].trim();

      let tool: ParsedAction['tool'] = 'write_file';
      if (toolName.includes('command') || toolName.includes('terminal')) tool = 'run_command';
      else if (toolName.includes('folder') || toolName.includes('dir')) tool = 'create_folder';
      else if (toolName.includes('read')) tool = 'read_file';
      else if (toolName.includes('edit')) tool = 'edit_file';
      else tool = 'write_file';

      let payload: any = {};

      if (pathAttr) {
        payload = { path: pathAttr, content: body };
      } else if (cmdAttr) {
        payload = { command: cmdAttr };
      } else {
        try {
          payload = JSON.parse(body);
        } catch {
          // Resilient fallback for broken JSON with unescaped strings
          if (tool === 'write_file' || tool === 'edit_file') {
            const pathMatch = /"path"\s*:\s*"([^"]+)"/i.exec(body);
            if (pathMatch) {
              const contentIdx = body.indexOf('"content"');
              let content = '';
              if (contentIdx !== -1) {
                content = body.substring(contentIdx + 9).replace(/^[\s:]+"?/, '').replace(/"?\s*}?\s*$/, '');
              } else {
                content = body;
              }
              payload = { path: pathMatch[1], content };
            } else {
              const lines = body.split('\n');
              const firstLine = lines[0].trim();
              if (firstLine.toLowerCase().startsWith('path:')) {
                payload = {
                  path: firstLine.substring(5).trim(),
                  content: lines.slice(1).join('\n').trim(),
                };
              }
            }
          } else if (tool === 'run_command') {
            const cmdMatch = /"command"\s*:\s*"([^"]+)"/i.exec(body);
            payload = { command: cmdMatch ? cmdMatch[1] : body.replace(/^[{"]+|["}]+$/g, '') };
          } else if (tool === 'create_folder' || tool === 'read_file') {
            const pathMatch = /"path"\s*:\s*"([^"]+)"/i.exec(body);
            payload = { path: pathMatch ? pathMatch[1] : body.replace(/^[{"]+|["}]+$/g, '') };
          }
        }
      }

      if (payload && (payload.path || payload.command)) {
        actions.push({ tool, payload, rawText: match[0] });
      }
    }

    // 2. Check for markdown tool blocks: ```write_file:path or ```tool:write_file
    if (actions.length === 0) {
      const toolBlockRegex = /```(?:tool:)?(write_file|edit_file|run_command|create_folder|read_file)(?::([^\n]+))?\s*([\s\S]*?)```/gi;
      while ((match = toolBlockRegex.exec(text)) !== null) {
        const toolName = match[1].toLowerCase();
        const targetPath = (match[2] || '').trim();
        const body = match[3].trim();

        let tool: ParsedAction['tool'] = 'write_file';
        if (toolName.includes('command')) tool = 'run_command';
        else if (toolName.includes('folder')) tool = 'create_folder';
        else if (toolName.includes('read')) tool = 'read_file';
        else if (toolName.includes('edit')) tool = 'edit_file';

        let payload: any = {};
        if (targetPath) {
          if (tool === 'run_command') payload = { command: body || targetPath };
          else payload = { path: targetPath, content: body };
        } else {
          try {
            payload = JSON.parse(body);
          } catch {
            if (tool === 'run_command') payload = { command: body };
            else if (tool === 'create_folder' || tool === 'read_file') payload = { path: body };
          }
        }

        if (payload && (payload.path || payload.command)) {
          actions.push({ tool, payload, rawText: match[0] });
        }
      }
    }

    return actions;
  }

  public async runTurn(
    conversation: ChatMessage[],
    activeModel: string | undefined,
    callbacks: AgentRunnerCallbacks,
    maxSteps = 5
  ): Promise<string> {
    this.isAborted = false;
    let currentStep = 0;
    let finalAssistantText = '';

    while (currentStep < maxSteps && !this.isAborted) {
      currentStep++;
      let assistantResponse = '';

      try {
        await new Promise<void>((resolve, reject) => {
          this.client.streamChat({
            messages: conversation,
            model: activeModel,
            onChunk: (delta) => {
              if (this.isAborted) return;
              assistantResponse += delta;
              callbacks.onChunk(delta);
            },
            onDone: () => resolve(),
            onError: (err) => {
              if (this.isAborted) resolve();
              else reject(err);
            },
          });
        });
      } catch (err) {
        if (this.isAborted) break;
        throw err;
      }

      if (this.isAborted) break;

      conversation.push({ role: 'assistant', content: assistantResponse });
      finalAssistantText = assistantResponse;

      // Parse any action blocks
      const actions = AgentRunner.parseActionBlocks(assistantResponse);
      if (actions.length === 0 || this.isAborted) {
        break;
      }

      // Execute each action with security checks
      const results: string[] = [];

      for (const action of actions) {
        if (this.isAborted) break;

        const permRequest = this.createPermissionRequest(action);
        let decision: 'allow' | 'always' | 'deny' = 'allow';

        if (!this.autoApprove) {
          decision = await callbacks.onRequestPermission(permRequest);
          if (decision === 'always') {
            this.autoApprove = true;
          }
        }

        if (decision === 'deny') {
          callbacks.onToolFinish(action.tool, '', 'Permission denied by user');
          results.push(`<tool_result tool="${action.tool}" status="denied">User denied permission to execute this action.</tool_result>`);
          continue;
        }

        if (this.isAborted) break;

        // Execute action
        callbacks.onToolStart(action.tool, permRequest.description);

        try {
          const output = await this.executeAction(action, callbacks);
          callbacks.onToolFinish(action.tool, output);
          results.push(`<tool_result tool="${action.tool}" status="success">\n${output}\n</tool_result>`);
        } catch (err: any) {
          const errMsg = err?.message || String(err);
          callbacks.onToolFinish(action.tool, '', errMsg);
          results.push(`<tool_result tool="${action.tool}" status="error">\n${errMsg}\n</tool_result>`);
        }
      }

      if (this.isAborted) break;

      // Feed results back into conversation for the next step
      const toolResultsPrompt = `Tool Execution Results:\n${results.join('\n\n')}\n\nPlease proceed with the next step or summarize your work if finished.`;
      conversation.push({ role: 'user', content: toolResultsPrompt });
    }

    return finalAssistantText;
  }

  private createPermissionRequest(action: ParsedAction): PermissionRequest {
    const id = `perm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    switch (action.tool) {
      case 'create_folder':
        return {
          id,
          tool: 'create_folder',
          title: `Create Folder: ${action.payload.path || 'Unknown'}`,
          description: `Create new folder directory: ${action.payload.path || ''}`,
          target: action.payload.path,
        };

      case 'write_file':
      case 'edit_file':
        const filePath = action.payload.path || 'unknown.txt';
        const lines = (action.payload.content || '').split('\n').length;
        return {
          id,
          tool: 'write_file',
          title: `Write File: ${filePath}`,
          description: `Create / write file: ${filePath} (${lines} lines)`,
          target: filePath,
          codePreview: (action.payload.content || '').substring(0, 500),
        };

      case 'run_command':
        return {
          id,
          tool: 'run_command',
          title: `Run Terminal Command: ${action.payload.command || ''}`,
          description: `Execute in Zaylo Terminal: ${action.payload.command || ''}`,
          command: action.payload.command,
        };

      case 'read_file':
        return {
          id,
          tool: 'read_file',
          title: `Read File: ${action.payload.path || ''}`,
          description: `Read file contents: ${action.payload.path || ''}`,
          target: action.payload.path,
        };

      default:
        return {
          id,
          tool: action.tool,
          title: `Action: ${action.tool}`,
          description: `Execute tool: ${action.tool}`,
        };
    }
  }

  private async executeAction(action: ParsedAction, callbacks: AgentRunnerCallbacks): Promise<string> {
    switch (action.tool) {
      case 'create_folder': {
        const folderPath = action.payload.path;
        if (!folderPath) throw new Error('Missing "path" parameter in create_folder');
        return await AgentTools.createDirectory(folderPath);
      }

      case 'write_file':
      case 'edit_file': {
        const filePath = action.payload.path;
        const content = action.payload.content ?? '';
        if (!filePath) throw new Error('Missing "path" parameter in write_file');
        return await AgentTools.writeFile(filePath, content);
      }

      case 'read_file': {
        const filePath = action.payload.path;
        if (!filePath) throw new Error('Missing "path" parameter in read_file');
        return await AgentTools.readFile(filePath);
      }

      case 'run_command': {
        const command = action.payload.command;
        if (!command) throw new Error('Missing "command" parameter in run_command');
        const res = await AgentTools.executeCommand(command);

        if (callbacks.onTerminalOutput) {
          const combined = res.stdout + (res.stderr ? `\nSTDERR:\n${res.stderr}` : '');
          callbacks.onTerminalOutput(command, combined, res.exitCode);
        }

        if (res.exitCode === 0) {
          return `Command succeeded (exit code 0):\n${res.stdout || '(no output)'}`;
        } else {
          throw new Error(`Command failed (exit code ${res.exitCode}):\n${res.stderr || res.stdout}`);
        }
      }

      default:
        throw new Error(`Unsupported tool action: ${action.tool}`);
    }
  }
}
