import * as vscode from 'vscode';
import * as path from 'path';
import { ConnectionManager, ConnectionState } from './connectionManager';
import { getWebviewContent } from './webview/getWebviewContent';
import { AgentTools } from './tools/agentTools';
import { AgentRunner } from './agent/agentRunner';
import { ChatMessage, WebviewMessage, PermissionRequest } from './types';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'zaylo.chatView';

  private view?: vscode.WebviewView;
  private connectionManager: ConnectionManager;
  private extensionUri: vscode.Uri;
  private agentRunner: AgentRunner;
  private pendingPermissions = new Map<string, (decision: 'allow' | 'always' | 'deny') => void>();
  private conversationHistory: ChatMessage[] = [];
  private activeEditorContext: {
    file: string | null;
    selection: string | null;
    language: string | null;
    lineRange: string | null;
  } = { file: null, selection: null, language: null, lineRange: null };

  constructor(extensionUri: vscode.Uri, connectionManager: ConnectionManager) {
    this.extensionUri = extensionUri;
    this.connectionManager = connectionManager;
    this.agentRunner = new AgentRunner(this.connectionManager.getClient(), false);

    // Listen for connection changes and update webview
    this.connectionManager.onDidChangeConnection((state) => {
      this.sendConnectionState(state);
    });

    // Listen to active text editor changes
    vscode.window.onDidChangeActiveTextEditor(() => this.updateEditorContext());
    vscode.window.onDidChangeTextEditorSelection(() => this.updateEditorContext());
    this.updateEditorContext();
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    const state = this.connectionManager.getState();
    webviewView.webview.html = getWebviewContent(
      webviewView.webview,
      this.extensionUri,
      state
    );

    webviewView.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      await this.handleWebviewMessage(message);
    });

    this.sendConnectionState(state);
    this.sendEditorContext();
  }

  public sendExternalPrompt(prompt: string): void {
    if (this.view) {
      this.view.show(true);
      this.handleUserPrompt(prompt, 'chat');
    }
  }

  private sendConnectionState(state: ConnectionState): void {
    if (!this.view) return;
    this.view.webview.postMessage({
      type: 'connectionState',
      connected: state.connected,
      serverUrl: state.serverUrl,
      activeModel: state.activeModel,
      models: state.models,
      error: state.error,
    });
  }

  private updateEditorContext(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.activeEditorContext = { file: null, selection: null, language: null, lineRange: null };
    } else {
      const doc = editor.document;
      const relPath = vscode.workspace.asRelativePath(doc.uri);
      const sel = editor.selection;
      let selectionText: string | null = null;
      let lineRange: string | null = null;

      if (!sel.isEmpty) {
        selectionText = doc.getText(sel);
        lineRange = `(L${sel.start.line + 1}-L${sel.end.line + 1})`;
      } else {
        lineRange = `(${doc.lineCount} lines)`;
      }

      this.activeEditorContext = {
        file: relPath,
        selection: selectionText,
        language: doc.languageId,
        lineRange,
      };
    }

    this.sendEditorContext();
  }

  private sendEditorContext(): void {
    if (!this.view) return;
    this.view.webview.postMessage({
      type: 'activeEditorContext',
      ...this.activeEditorContext,
    });
  }

  private async handleWebviewMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'ready':
        this.sendConnectionState(this.connectionManager.getState());
        this.sendEditorContext();
        break;

      case 'connect':
        await this.connectionManager.connect(message.url, message.apiKey);
        break;

      case 'disconnect':
        this.connectionManager.disconnect();
        break;

      case 'newSession':
        this.conversationHistory = [];
        break;

      case 'insertCode':
        await AgentTools.insertAtCursor(message.code);
        break;

      case 'previewDiff':
        const targetFile = message.file || this.activeEditorContext.file;
        if (targetFile) {
          await AgentTools.previewDiff(targetFile, message.modified);
        } else {
          vscode.window.showWarningMessage('No file specified to preview diff against.');
        }
        break;

      case 'applyDiff':
        let fileToApply: string | undefined = message.file || this.activeEditorContext.file || undefined;
        if (!fileToApply) {
          const files = await AgentTools.listFiles('.');
          if (files.length > 0) {
            fileToApply = await vscode.window.showQuickPick(files, {
              placeHolder: 'Select file to apply changes to',
            });
          }
        }
        if (fileToApply) {
          await AgentTools.applyDiff(fileToApply, message.modified);
        } else {
          vscode.window.showWarningMessage('No file specified to apply changes to.');
        }
        break;

      case 'sendMessage':
        await this.handleUserPrompt(message.prompt, message.mode);
        break;

      case 'permissionResponse':
        const resolver = this.pendingPermissions.get(message.id);
        if (resolver) {
          resolver(message.decision);
          this.pendingPermissions.delete(message.id);
          this.view?.webview.postMessage({
            type: 'permissionResolved',
            id: message.id,
            decision: message.decision,
          });
          if (message.decision === 'always') {
            this.agentRunner.setAutoApprove(true);
            this.view?.webview.postMessage({
              type: 'autoApproveState',
              enabled: true,
            });
          }
        }
        break;

      case 'toggleAutoApprove':
        this.agentRunner.setAutoApprove(message.enabled);
        this.view?.webview.postMessage({
          type: 'autoApproveState',
          enabled: message.enabled,
        });
        break;

      case 'openTerminal':
        AgentTools.openTerminal();
        break;

      case 'moveToRightSide':
        try {
          await vscode.commands.executeCommand('zaylo.chatView.focus');
          await vscode.commands.executeCommand('workbench.action.moveViewToSecondarySideBar');
          await vscode.commands.executeCommand('workbench.action.focusAuxiliaryBar');
        } catch {
          try {
            const config = vscode.workspace.getConfiguration('workbench');
            await config.update('sideBar.location', 'right', vscode.ConfigurationTarget.Global);
          } catch {
            vscode.window.showInformationMessage('Drag the Zaylo tab header directly over to the right side of VS Code.');
          }
        }
        break;

      case 'openApiKeyPrompt':
        const currentKey = this.connectionManager.getApiKey();
        const inputKey = await vscode.window.showInputBox({
          prompt: 'Enter your Zaylo Local API Key (found in Zaylo Desktop > Server & API)',
          value: currentKey,
          password: true,
          placeHolder: 'lcl_...',
        });
        if (inputKey !== undefined) {
          await this.connectionManager.setApiKey(inputKey);
          vscode.window.showInformationMessage('Zaylo API Key updated.');
        }
        break;

      case 'setApiKey':
        await this.connectionManager.setApiKey(message.apiKey);
        break;

      case 'stopStream':
        this.agentRunner.stop();
        this.connectionManager.getClient().stopStream();
        for (const [, resolver] of this.pendingPermissions.entries()) {
          resolver('deny');
        }
        this.pendingPermissions.clear();
        this.view?.webview.postMessage({
          type: 'streamChunk',
          chunk: '',
          isDone: true,
          messageId: 'assistant-latest',
        });
        break;
    }
  }

  private async handleUserPrompt(userPrompt: string, mode: 'chat' | 'agent'): Promise<void> {
    if (!this.view) return;

    // Build context-aware prompt
    let contextualPrompt = userPrompt;
    if (this.activeEditorContext.file) {
      let fileContent = '';
      try {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document) {
          fileContent = editor.document.getText();
        }
      } catch {
        fileContent = '';
      }

      if (this.activeEditorContext.selection) {
        contextualPrompt = `[Context: Active file "${this.activeEditorContext.file}" selected lines:\n\`\`\`${this.activeEditorContext.language || ''}\n${this.activeEditorContext.selection}\n\`\`\`]\n\n${userPrompt}`;
      } else if (fileContent && fileContent.length < 8000) {
        contextualPrompt = `[Context: Active file "${this.activeEditorContext.file}":\n\`\`\`${this.activeEditorContext.language || ''}\n${fileContent}\n\`\`\`]\n\n${userPrompt}`;
      } else {
        contextualPrompt = `[Context: Active file "${this.activeEditorContext.file}"]\n\n${userPrompt}`;
      }
    }

    this.conversationHistory.push({ role: 'user', content: contextualPrompt });

    if (mode === 'agent') {
      const systemPrompt = `You are Zaylo, an autonomous local AI coding partner and expert software engineer.
You are running directly on the developer's machine with full local privacy.
You have the power to create folders, write complete code files, edit existing files, inspect the codebase, and run terminal commands to install packages and build projects.

When the user asks you to edit or write a file, you MUST use the write_file tool action so your edits are automatically applied to their workspace:

<zaylo_action tool="write_file" path="path/to/file.ext">
complete updated file contents here
</zaylo_action>

Other available tools:
<zaylo_action tool="create_folder" path="dir/name"></zaylo_action>
<zaylo_action tool="run_command" command="npm install ..."></zaylo_action>
<zaylo_action tool="read_file" path="file/path.ext"></zaylo_action>

Rules:
1. When asked to edit or write code, always provide the complete file content in a write_file action block.
2. Every file write, folder creation, and terminal command is protected by the user's security permissions before being applied.
3. Be direct, accurate, and output production-ready code.`;

      const messagesToSend: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...this.conversationHistory.slice(-8),
      ];

      try {
        await this.agentRunner.runTurn(
          messagesToSend,
          this.connectionManager.getState().activeModel || undefined,
          {
            onChunk: (delta) => {
              this.view?.webview.postMessage({
                type: 'streamChunk',
                chunk: delta,
                isDone: false,
                messageId: 'assistant-latest',
              });
            },
            onRequestPermission: async (request: PermissionRequest) => {
              this.view?.webview.postMessage({
                type: 'permissionRequest',
                request,
              });

              return new Promise<'allow' | 'always' | 'deny'>((resolve) => {
                this.pendingPermissions.set(request.id, resolve);
              });
            },
            onToolStart: (toolName, description) => {
              this.view?.webview.postMessage({
                type: 'agentAction',
                actionType: 'start',
                toolName,
                description,
              });
            },
            onToolFinish: (toolName, output, error) => {
              this.view?.webview.postMessage({
                type: 'agentAction',
                actionType: error ? 'error' : 'finish',
                toolName,
                description: error ? `Error: ${error}` : `Done: ${output}`,
                output,
              });
            },
            onTerminalOutput: (command, output, exitCode) => {
              this.view?.webview.postMessage({
                type: 'terminalOutput',
                command,
                output,
                exitCode,
              });
            },
          }
        );

        this.view?.webview.postMessage({
          type: 'streamChunk',
          chunk: '',
          isDone: true,
          messageId: 'assistant-latest',
        });
      } catch (err: any) {
        this.view?.webview.postMessage({
          type: 'error',
          message: err?.message || String(err),
        });
      }
    } else {
      // Standard Chat Mode
      const systemPrompt = `You are Zaylo, an expert local AI pair programmer. You provide clear, concise explanations and code examples.`;

      const messagesToSend: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...this.conversationHistory.slice(-8),
      ];

      let fullResponse = '';

      await this.connectionManager.getClient().streamChat({
        messages: messagesToSend,
        model: this.connectionManager.getState().activeModel || undefined,
        onChunk: (delta) => {
          fullResponse += delta;
          this.view?.webview.postMessage({
            type: 'streamChunk',
            chunk: delta,
            isDone: false,
            messageId: 'assistant-latest',
          });
        },
        onDone: () => {
          this.conversationHistory.push({ role: 'assistant', content: fullResponse });
          this.view?.webview.postMessage({
            type: 'streamChunk',
            chunk: '',
            isDone: true,
            messageId: 'assistant-latest',
          });
        },
        onError: (err) => {
          this.view?.webview.postMessage({
            type: 'error',
            message: err.message,
          });
        },
      });
    }
  }
}
