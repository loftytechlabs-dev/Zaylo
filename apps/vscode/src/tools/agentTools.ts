import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';

export class AgentTools {
  private static zayloTerminal: vscode.Terminal | null = null;

  public static getOrCreateTerminal(): vscode.Terminal {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const cwd = workspaceFolders && workspaceFolders.length > 0
      ? workspaceFolders[0].uri.fsPath
      : undefined;

    if (!this.zayloTerminal || this.zayloTerminal.exitStatus !== undefined) {
      this.zayloTerminal = vscode.window.createTerminal({
        name: 'Zaylo Terminal',
        cwd: cwd,
      });
    }
    return this.zayloTerminal;
  }

  public static openTerminal(): void {
    const term = this.getOrCreateTerminal();
    term.show(true);
  }

  public static async createDirectory(dirPath: string): Promise<string> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('No workspace folder open');
    }

    const fullPath = path.isAbsolute(dirPath)
      ? dirPath
      : path.join(workspaceFolders[0].uri.fsPath, dirPath);

    const uri = vscode.Uri.file(fullPath);
    await vscode.workspace.fs.createDirectory(uri);
    return `Created directory: ${vscode.workspace.asRelativePath(uri)}`;
  }

  public static async readFile(filePath: string): Promise<string> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('No workspace folder open');
    }

    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(workspaceFolders[0].uri.fsPath, filePath);

    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(fullPath));
    return doc.getText();
  }

  public static async writeFile(filePath: string, content: string): Promise<string> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('No workspace folder open');
    }

    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(workspaceFolders[0].uri.fsPath, filePath);

    // Ensure parent directory exists
    const dir = path.dirname(fullPath);
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(dir));

    const uri = vscode.Uri.file(fullPath);
    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(uri, encoder.encode(content));
    return `Successfully wrote file: ${vscode.workspace.asRelativePath(uri)} (${content.split('\n').length} lines)`;
  }

  public static async previewDiff(filePath: string, modifiedContent: string): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('No workspace folder open');
    }

    const originalUri = path.isAbsolute(filePath)
      ? vscode.Uri.file(filePath)
      : vscode.Uri.file(path.join(workspaceFolders[0].uri.fsPath, filePath));

    // Create an in-memory document for the modified content
    const modifiedUri = originalUri.with({
      scheme: 'untitled',
      path: originalUri.path + ' (Zaylo Suggestion)',
    });

    const doc = await vscode.workspace.openTextDocument(modifiedUri);
    const edit = new vscode.WorkspaceEdit();
    edit.insert(modifiedUri, new vscode.Position(0, 0), modifiedContent);
    await vscode.workspace.applyEdit(edit);

    await vscode.commands.executeCommand(
      'vscode.diff',
      originalUri,
      modifiedUri,
      `${path.basename(filePath)} (Current ↔ Zaylo Proposed)`
    );
  }

  public static async applyDiff(filePath: string, modifiedContent: string): Promise<void> {
    await this.writeFile(filePath, modifiedContent);
    vscode.window.showInformationMessage(`Applied Zaylo changes to ${path.basename(filePath)}`);
  }

  public static async insertAtCursor(code: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor to insert code into.');
      return;
    }

    await editor.edit((editBuilder) => {
      if (editor.selection.isEmpty) {
        editBuilder.insert(editor.selection.active, code);
      } else {
        editBuilder.replace(editor.selection, code);
      }
    });
  }

  public static async searchFiles(pattern: string): Promise<string[]> {
    const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 25);
    return files.map((f) => vscode.workspace.asRelativePath(f));
  }

  public static async listFiles(dirPath = '.'): Promise<string[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return [];
    }

    const fullPath = path.isAbsolute(dirPath)
      ? dirPath
      : path.join(workspaceFolders[0].uri.fsPath, dirPath);

    try {
      const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(fullPath));
      return entries
        .filter(([name]) => !name.startsWith('.') && name !== 'node_modules' && name !== 'dist')
        .map(([name, type]) => (type === vscode.FileType.Directory ? `${name}/` : name));
    } catch {
      return [];
    }
  }

  public static async executeCommand(
    command: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const cwd = workspaceFolders && workspaceFolders.length > 0
      ? workspaceFolders[0].uri.fsPath
      : process.cwd();

    // Show terminal and display command in Zaylo Terminal tab
    const term = this.getOrCreateTerminal();
    term.show(true);
    term.sendText(`echo "\n[Zaylo Agent] Executing: ${command.replace(/"/g, '\\"')}\"`);

    return new Promise((resolve) => {
      cp.exec(command, { cwd, maxBuffer: 10 * 1024 * 1024, timeout: 180000 }, (error, stdout, stderr) => {
        const exitCode = error ? (typeof error.code === 'number' ? error.code : 1) : 0;
        const outStr = stdout.trim();
        const errStr = stderr.trim();

        // Echo completion status into terminal
        if (exitCode === 0) {
          term.sendText(`echo "[SUCCESS] Command completed successfully.\n"`);
        } else {
          term.sendText(`echo "[ERROR] Command failed with exit code ${exitCode}.\n"`);
        }

        resolve({
          stdout: outStr,
          stderr: errStr,
          exitCode,
        });
      });
    });
  }

  public static runTerminalCommand(command: string): void {
    const term = this.getOrCreateTerminal();
    term.show(true);
    term.sendText(command);
  }
}
