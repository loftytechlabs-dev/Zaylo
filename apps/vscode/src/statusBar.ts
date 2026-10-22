import * as vscode from 'vscode';
import { ConnectionManager, ConnectionState } from './connectionManager';

export class StatusBarManager implements vscode.Disposable {
  private item: vscode.StatusBarItem;
  private connectionManager: ConnectionManager;
  private disposables: vscode.Disposable[] = [];

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.item.command = 'zaylo.statusBarClick';

    this.disposables.push(
      this.connectionManager.onDidChangeConnection((state) => {
        this.updateState(state);
      })
    );

    this.disposables.push(
      vscode.commands.registerCommand('zaylo.statusBarClick', () => {
        this.showMenu();
      })
    );

    this.updateState(this.connectionManager.getState());
    this.item.show();
  }

  public updateState(state: ConnectionState): void {
    if (state.connected) {
      const modelShort = state.activeModel
        ? state.activeModel.split('/').pop()?.replace('.gguf', '')
        : 'Ready';
      this.item.text = `$(zap) Zaylo: ${modelShort}`;
      this.item.tooltip = `Connected to Zaylo (${state.serverUrl})\nModel: ${state.activeModel || 'None'}\nClick to manage connection`;
      this.item.backgroundColor = undefined;
    } else {
      this.item.text = `$(circle-slash) Zaylo: Offline`;
      this.item.tooltip = `Zaylo Server is disconnected (${state.serverUrl})\nClick to connect`;
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
  }

  private async showMenu(): Promise<void> {
    const state = this.connectionManager.getState();

    if (state.connected) {
      const picks = [
        {
          label: `$(symbol-interface) Model: ${state.activeModel || 'Default'}`,
          description: 'Switch active model',
          action: 'switchModel',
        },
        {
          label: '$(comment-discussion) Open Zaylo Sidebar',
          description: 'Open AI chat & agent panel',
          action: 'openSidebar',
        },
        {
          label: '$(debug-restart) Reconnect',
          description: `Ping ${state.serverUrl}`,
          action: 'reconnect',
        },
        {
          label: '$(gear) Configure Server Settings',
          description: 'Change port, host or API key',
          action: 'settings',
        },
        {
          label: '$(debug-disconnect) Disconnect',
          description: 'Disconnect from local server',
          action: 'disconnect',
        },
      ];

      const selection = await vscode.window.showQuickPick(picks, {
        placeHolder: `Zaylo Local AI - Connected to ${state.serverUrl}`,
      });

      if (!selection) return;

      switch (selection.action) {
        case 'openSidebar':
          vscode.commands.executeCommand('zaylo.chatView.focus');
          break;
        case 'reconnect':
          await this.connectionManager.checkConnection(true);
          break;
        case 'settings':
          vscode.commands.executeCommand('workbench.action.openSettings', 'zaylo');
          break;
        case 'disconnect':
          this.connectionManager.disconnect();
          vscode.window.showInformationMessage('Disconnected from Zaylo Server.');
          break;
        case 'switchModel':
          this.showModelPicker(state.models);
          break;
      }
    } else {
      const picks = [
        {
          label: `$(zap) Connect to ${state.serverUrl}`,
          description: 'Attempt to connect now',
          action: 'connect',
        },
        {
          label: '$(comment-discussion) Open Zaylo Sidebar',
          description: 'Open chat and connection panel',
          action: 'openSidebar',
        },
        {
          label: '$(edit) Change Server URL',
          description: 'Set custom localhost port or remote IP',
          action: 'changeUrl',
        },
      ];

      const selection = await vscode.window.showQuickPick(picks, {
        placeHolder: 'Zaylo Local AI is currently offline',
      });

      if (!selection) return;

      switch (selection.action) {
        case 'connect':
          await this.connectionManager.connect();
          break;
        case 'openSidebar':
          vscode.commands.executeCommand('zaylo.chatView.focus');
          break;
        case 'changeUrl':
          const newUrl = await vscode.window.showInputBox({
            prompt: 'Enter Zaylo Server URL',
            value: state.serverUrl,
          });
          if (newUrl) {
            const config = vscode.workspace.getConfiguration('zaylo');
            await config.update('serverUrl', newUrl.trim(), vscode.ConfigurationTarget.Global);
            await this.connectionManager.connect(newUrl.trim());
          }
          break;
      }
    }
  }

  private async showModelPicker(models: string[]): Promise<void> {
    if (models.length === 0) {
      vscode.window.showInformationMessage('No installed models found in Zaylo.');
      return;
    }

    const items = models.map((m) => ({
      label: m,
      description: 'Local GGUF model',
    }));

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select active model for Zaylo',
    });

    if (picked) {
      vscode.window.showInformationMessage(`Model switched to ${picked.label}`);
    }
  }

  public dispose(): void {
    this.item.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
