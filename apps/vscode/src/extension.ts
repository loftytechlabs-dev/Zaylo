import * as vscode from 'vscode';
import { ConnectionManager } from './connectionManager';
import { StatusBarManager } from './statusBar';
import { ChatViewProvider } from './chatViewProvider';

let connectionManager: ConnectionManager | null = null;
let statusBarManager: StatusBarManager | null = null;
let chatViewProvider: ChatViewProvider | null = null;

export function activate(context: vscode.ExtensionContext): void {
  // 1. Initialize Connection Manager & Auto-Discovery
  connectionManager = new ConnectionManager();
  context.subscriptions.push(connectionManager);

  // 2. Initialize Status Bar Item
  statusBarManager = new StatusBarManager(connectionManager);
  context.subscriptions.push(statusBarManager);

  // 3. Register Sidebar Webview View Provider
  chatViewProvider = new ChatViewProvider(context.extensionUri, connectionManager);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, chatViewProvider, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
    })
  );

  // Automatically focus and move Agent view to the right side (Secondary Side Bar)
  const hasMovedToRight = context.globalState.get<boolean>('zaylo.hasMovedToRight', false);
  setTimeout(async () => {
    try {
      await vscode.commands.executeCommand('zaylo.chatView.focus');
      if (!hasMovedToRight) {
        await vscode.commands.executeCommand('workbench.action.moveViewToSecondarySideBar');
        await vscode.commands.executeCommand('workbench.action.focusAuxiliaryBar');
        await context.globalState.update('zaylo.hasMovedToRight', true);
      }
    } catch {
      // Ignored if layout is already configured
    }
  }, 400);

  // 4. Register Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('zaylo.connect', async () => {
      await connectionManager?.connect();
    }),

    vscode.commands.registerCommand('zaylo.disconnect', () => {
      connectionManager?.disconnect();
    }),

    vscode.commands.registerCommand('zaylo.openChat', () => {
      vscode.commands.executeCommand('zaylo.chatView.focus');
    }),

    vscode.commands.registerCommand('zaylo.moveToRightSide', async () => {
      try {
        await vscode.commands.executeCommand('zaylo.chatView.focus');
        await vscode.commands.executeCommand('workbench.action.moveViewToSecondarySideBar');
        await vscode.commands.executeCommand('workbench.action.focusAuxiliaryBar');
        vscode.window.showInformationMessage('Zaylo moved to the right side (Secondary Side Bar).');
      } catch {
        try {
          const config = vscode.workspace.getConfiguration('workbench');
          await config.update('sideBar.location', 'right', vscode.ConfigurationTarget.Global);
          vscode.window.showInformationMessage('Moved VS Code Side Bar to the right side.');
        } catch {
          vscode.window.showInformationMessage('Drag the Zaylo tab header directly over to the right side of VS Code.');
        }
      }
    }),

    vscode.commands.registerCommand('zaylo.newSession', () => {
      vscode.commands.executeCommand('zaylo.chatView.focus');
    }),

    vscode.commands.registerCommand('zaylo.explainCode', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.selection.isEmpty) {
        vscode.window.showWarningMessage('Please select some code to explain.');
        return;
      }
      vscode.commands.executeCommand('zaylo.chatView.focus');
      chatViewProvider?.sendExternalPrompt('Please explain what this code does and highlight any potential bugs or edge cases.');
    }),

    vscode.commands.registerCommand('zaylo.refactorCode', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.selection.isEmpty) {
        vscode.window.showWarningMessage('Please select some code to refactor.');
        return;
      }
      vscode.commands.executeCommand('zaylo.chatView.focus');
      chatViewProvider?.sendExternalPrompt('Refactor this selected code to improve performance, readability, and maintainability. Provide a diff.');
    }),

    vscode.commands.registerCommand('zaylo.generateTests', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.selection.isEmpty) {
        vscode.window.showWarningMessage('Please select some code to generate tests for.');
        return;
      }
      vscode.commands.executeCommand('zaylo.chatView.focus');
      chatViewProvider?.sendExternalPrompt('Write comprehensive unit tests covering happy paths and edge cases for this selected code.');
    })
  );
}

export function deactivate(): void {
  connectionManager?.dispose();
  statusBarManager?.dispose();
}
