import * as vscode from 'vscode';

export function getWebviewContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  initialState: {
    connected: boolean;
    serverUrl: string;
    activeModel: string | null;
    models: string[];
  }
): string {
  const nonce = getNonce();

  const ICONS = {
    disconnect: `<svg class="icon-svg" width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M12.854 2.146a.5.5 0 0 1 0 .708l-1.293 1.293.707.707a1.5 1.5 0 0 1 0 2.122l-1.768 1.767a1.5 1.5 0 0 1-2.121 0l-.707-.707-1.415 1.414.708.707a2.5 2.5 0 0 1 0 3.536l-.708.707a.5.5 0 0 1-.707 0l-3.535-3.536a.5.5 0 0 1 0-.707l.707-.707a2.5 2.5 0 0 1 3.536 0l.707.707 1.414-1.414-.707-.707a1.5 1.5 0 0 1 0-2.122l1.768-1.767a1.5 1.5 0 0 1 2.121 0l.707.707 1.293-1.293a.5.5 0 0 1 .708 0z"/><path d="M1.5 1.5L14.5 14.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
    key: `<svg class="icon-svg" width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M11.5 1a3.5 3.5 0 0 0-3.35 4.51L1.29 12.36a1 1 0 0 0-.29.71V15h2v-1h1v-1h1v-1h1.5l1.86-1.86A3.5 3.5 0 1 0 11.5 1zm0 2a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/></svg>`,
    terminal: `<svg class="icon-svg" width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M1 3.5A1.5 1.5 0 0 1 2.5 2h11A1.5 1.5 0 0 1 15 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9zM2.5 3a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-11zm2.15 2.15a.5.5 0 0 1 .7 0l2.5 2.5a.5.5 0 0 1 0 .7l-2.5 2.5a.5.5 0 1 1-.7-.7L6.79 8 4.65 5.85a.5.5 0 0 1 0-.7zM8.5 10.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1 0-1z"/></svg>`,
    moveRight: `<svg class="icon-svg" width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M1 3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3zm10 1v8h3V4h-3zM9 4H2v8h7V4z"/></svg>`,
    plus: `<svg class="icon-svg" width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2z"/></svg>`,
    zap: `<svg class="icon-svg" width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M9.5 1.5a.5.5 0 0 0-.85-.35l-6 7a.5.5 0 0 0 .38.85H7v5.5a.5.5 0 0 0 .85.35l6-7a.5.5 0 0 0-.38-.85H9.5V1.5z"/></svg>`,
    zapLarge: `<svg class="icon-svg" width="26" height="26" viewBox="0 0 16 16" fill="#3b82f6"><path d="M9.5 1.5a.5.5 0 0 0-.85-.35l-6 7a.5.5 0 0 0 .38.85H7v5.5a.5.5 0 0 0 .85.35l6-7a.5.5 0 0 0-.38-.85H9.5V1.5z"/></svg>`,
    chat: `<svg class="icon-svg" width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M2.5 2A1.5 1.5 0 0 0 1 3.5v7A1.5 1.5 0 0 0 2.5 12h1v2.5a.5.5 0 0 0 .8.4L7.5 12h6a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 13.5 2h-11zm0 1h11a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5h-6.2a.5.5 0 0 0-.3.1L4.5 13.2V11.5a.5.5 0 0 0-.5-.5h-1.5a.5.5 0 0 1-.5-.5v-7a.5.5 0 0 1 .5-.5z"/></svg>`,
    shield: `<svg class="icon-svg" width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M8 1.5l5.5 2.2v4.8c0 3.3-2.3 6.1-5.5 7-3.2-.9-5.5-3.7-5.5-7V3.7L8 1.5zm0 1.1L3.5 4.4v4.1c0 2.7 1.9 5.1 4.5 5.9 2.6-.8 4.5-3.2 4.5-5.9V4.4L8 2.6z"/></svg>`,
    send: `<svg class="icon-svg" width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1.5 1.5a.5.5 0 0 0-.7.65l2.4 5.35H8a.5.5 0 0 1 0 1H3.2l-2.4 5.35a.5.5 0 0 0 .7.65l13.5-6.5a.5.5 0 0 0 0-.9l-13.5-6.5z"/></svg>`,
    stop: `<svg class="icon-svg" width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="3" width="10" height="10" rx="1.5"/></svg>`,
    file: `<svg class="icon-svg" width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M3 2a1 1 0 0 1 1-1h5.5L13 4.5V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2zm6 0v3h3L9 2zM4 2v12h8V6H8.5A.5.5 0 0 1 8 5.5V2H4z"/></svg>`,
    check: `<svg class="icon-svg" width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M13.85 3.65a.5.5 0 0 1 0 .7l-7.5 7.5a.5.5 0 0 1-.7 0l-3.5-3.5a.5.5 0 1 1 .7-.7L6 11.29l7.15-7.14a.5.5 0 0 1 .7 0z"/></svg>`,
    close: `<svg class="icon-svg" width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M3.15 3.15a.5.5 0 0 1 .7 0L8 7.29l4.15-4.14a.5.5 0 1 1 .7.7L8.71 8l4.14 4.15a.5.5 0 0 1-.7.7L8 8.71l-4.15 4.14a.5.5 0 0 1-.7-.7L7.29 8 3.15 3.85a.5.5 0 0 1 0-.7z"/></svg>`,
    copy: `<svg class="icon-svg" width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M4 4h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm0 1v8h8V5H4zm-2-3h8a1 1 0 0 1 1 1v1H10V3H3v8h1v1H2a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/></svg>`,
    diff: `<svg class="icon-svg" width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M1 2a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2zm7 1H2v10h6V3zm1 10h5V3H9v10z"/></svg>`,
    insert: `<svg class="icon-svg" width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M8 1a.5.5 0 0 1 .5.5v10.79l3.15-3.14a.5.5 0 0 1 .7.7l-4 4a.5.5 0 0 1-.7 0l-4-4a.5.5 0 1 1 .7-.7L7.5 12.29V1.5A.5.5 0 0 1 8 1zM2 14.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z"/></svg>`,
    folder: `<svg class="icon-svg" width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M1.5 3A1.5 1.5 0 0 0 0 4.5v7A1.5 1.5 0 0 0 1.5 13h13a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 14.5 4h-6L7.2 3H1.5zm0 1h5.3l1.3 1H14.5a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5v-7a.5.5 0 0 1 .5-.5z"/></svg>`,
    search: `<svg class="icon-svg" width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M11.5 7a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0zm-.82 4.39a6 6 0 1 0-.71.71l3.85 3.85a.5.5 0 0 0 .71-.71l-3.85-3.85z"/></svg>`,
    edit: `<svg class="icon-svg" width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M13.23 1h-1.46L3.52 9.25l-.16.22L2 13.5l4.03-1.36.22-.16L14.5 3.73V2.27L13.23 1zM4.74 10.3l7.13-7.14 1.1 1.1-7.14 7.14-1.09-1.1zm-.77 1.05l.82.82-1.99.67.67-1.99.5.5z"/></svg>`
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline'; script-src * 'unsafe-inline' 'unsafe-eval'; img-src * data: blob:;">
  <title>Zaylo AI</title>
  <style>
    :root {
      --bg: var(--vscode-sideBar-background, var(--vscode-editor-background, #1e1e1e));
      --fg: var(--vscode-sideBar-foreground, var(--vscode-editor-foreground, #cccccc));
      --input-bg: var(--vscode-input-background, #252526);
      --input-fg: var(--vscode-input-foreground, #cccccc);
      --input-border: var(--vscode-input-border, #3c3c3c);
      --focus-border: var(--vscode-focusBorder, #007fd4);
      --btn-bg: var(--vscode-button-background, #0e639c);
      --btn-fg: var(--vscode-button-foreground, #ffffff);
      --btn-hover: var(--vscode-button-hoverBackground, #1177bb);
      --card-bg: var(--vscode-editorWidget-background, #252526);
      --code-bg: var(--vscode-textCodeBlock-background, #181818);
      --border: var(--vscode-widget-border, var(--vscode-sideBar-border, #333333));
      --badge-bg: var(--vscode-badge-background, #4d4d4d);
      --badge-fg: var(--vscode-badge-foreground, #ffffff);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif);
      font-size: var(--vscode-font-size, 13px);
    }

    body {
      background-color: var(--bg);
      color: var(--fg);
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }

    .icon-svg {
      display: inline-block;
      vertical-align: middle;
      flex-shrink: 0;
    }

    /* Top Sub-Header */
    .top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 12px;
      border-bottom: 1px solid var(--border);
      background-color: var(--card-bg);
      gap: 8px;
    }

    .status-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
      font-size: 11px;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: #6b7280;
    }

    .status-dot.connected {
      background-color: #10b981;
      box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
    }

    .status-dot.disconnected {
      background-color: #ef4444;
    }

    .top-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .icon-btn {
      background: none;
      border: 1px solid transparent;
      color: var(--fg);
      cursor: pointer;
      padding: 4px 6px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.8;
      transition: opacity 0.15s, background-color 0.15s, color 0.15s;
    }

    .icon-btn:hover {
      opacity: 1;
      background-color: var(--badge-bg);
    }

    .icon-btn.disconnect-btn:hover {
      color: #ef4444;
      background-color: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.3);
      opacity: 1;
    }

    /* Disconnected State Panel */
    .connection-panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      padding: 24px 20px;
      text-align: center;
      gap: 16px;
    }

    .connection-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      width: 100%;
      max-width: 320px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    }

    .logo-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .brand-title {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.3px;
    }

    .field-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
      text-align: left;
    }

    .field-group label {
      font-size: 11px;
      opacity: 0.8;
      font-weight: 500;
    }

    .input-field {
      background: var(--input-bg);
      color: var(--input-fg);
      border: 1px solid var(--input-border);
      border-radius: 6px;
      padding: 6px 8px;
      outline: none;
    }

    .input-field:focus {
      border-color: var(--focus-border);
    }

    .btn-primary {
      background-color: var(--btn-bg);
      color: var(--btn-fg);
      border: none;
      border-radius: 6px;
      padding: 8px 12px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: background-color 0.15s;
    }

    .btn-primary:hover {
      background-color: var(--btn-hover);
    }

    /* Connected State Main Layout (Antigravity Style) */
    .chat-container {
      display: flex;
      flex-direction: column;
      flex: 1;
      height: 100%;
      overflow: hidden;
      position: relative;
    }

    /* Welcome Hero (Centered layout when starting empty session) */
    .welcome-hero {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin: auto 0;
      padding: 30px 16px;
      text-align: center;
      gap: 8px;
    }

    .hero-logo-box {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: rgba(59, 130, 246, 0.12);
      border: 1px solid rgba(59, 130, 246, 0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 2px;
    }

    .hero-title {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.4px;
      color: var(--fg);
    }

    .hero-subtitle {
      font-size: 12px;
      opacity: 0.65;
    }

    /* Messages Stream Area */
    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .message {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-width: 100%;
    }

    .message-role {
      font-size: 11px;
      font-weight: 600;
      opacity: 0.7;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .message-content {
      line-height: 1.5;
      word-break: break-word;
    }

    .message.user .message-content {
      background: var(--card-bg);
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid var(--border);
    }

    .message.assistant .message-content {
      padding: 4px 0;
    }

    /* Code blocks */
    .code-block-wrapper {
      margin: 8px 0;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--code-bg);
      overflow: hidden;
    }

    .code-block-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 8px;
      background: var(--card-bg);
      border-bottom: 1px solid var(--border);
      font-size: 11px;
    }

    .code-block-lang {
      font-family: monospace;
      opacity: 0.8;
      font-size: 10px;
      text-transform: uppercase;
    }

    .code-actions {
      display: flex;
      gap: 4px;
    }

    .code-action-btn {
      background: none;
      border: 1px solid var(--border);
      color: var(--fg);
      padding: 2px 6px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 10px;
      opacity: 0.85;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .code-action-btn:hover {
      opacity: 1;
      background: var(--badge-bg);
    }

    .code-action-btn.apply-btn {
      background: rgba(16, 185, 129, 0.15);
      border-color: rgba(16, 185, 129, 0.4);
      color: #10b981;
      font-weight: 600;
    }

    .code-action-btn.apply-btn:hover {
      background: rgba(16, 185, 129, 0.3);
      color: #ffffff;
    }

    pre code {
      display: block;
      padding: 10px;
      font-family: var(--vscode-editor-font-family, Consolas, 'Courier New', monospace);
      font-size: 12px;
      overflow-x: auto;
      white-space: pre;
    }

    /* Security Permission Card */
    .permission-card {
      background: rgba(245, 158, 11, 0.08);
      border: 1px solid rgba(245, 158, 11, 0.4);
      border-radius: 8px;
      padding: 10px 12px;
      margin: 8px 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .permission-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-weight: 600;
      font-size: 11px;
      color: #f59e0b;
    }

    .permission-title {
      font-weight: 600;
      font-size: 12px;
    }

    .permission-desc {
      font-size: 11px;
      opacity: 0.9;
      font-family: monospace;
      background: var(--code-bg);
      padding: 4px 6px;
      border-radius: 4px;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .permission-code-preview {
      max-height: 120px;
      overflow-y: auto;
      font-family: monospace;
      font-size: 11px;
      background: var(--code-bg);
      padding: 6px;
      border-radius: 4px;
      white-space: pre;
    }

    .permission-actions {
      display: flex;
      gap: 6px;
      margin-top: 4px;
      flex-wrap: wrap;
    }

    .btn-perm-allow {
      background: #10b981;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .btn-perm-always {
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .btn-perm-deny {
      background: #ef4444;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .terminal-log-card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 6px;
      padding: 8px 10px;
      margin: 6px 0;
      font-family: monospace;
      font-size: 11px;
    }

    .terminal-log-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: #38bdf8;
      margin-bottom: 4px;
      font-weight: 600;
    }

    .terminal-log-body {
      color: #94a3b8;
      max-height: 140px;
      overflow-y: auto;
      white-space: pre-wrap;
      line-height: 1.4;
    }

    /* Antigravity Style Floating Input Capsule */
    .input-section {
      padding: 8px 12px 6px 12px;
      background: var(--bg);
      display: flex;
      flex-direction: column;
      gap: 4px;
      border-top: 1px solid var(--border);
    }

    .input-capsule {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 10px 12px 8px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      transition: border-color 0.15s, box-shadow 0.15s;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
    }

    .input-capsule:focus-within {
      border-color: var(--focus-border);
      box-shadow: 0 0 0 1px var(--focus-border);
    }

    .prompt-textarea {
      background: transparent;
      border: none;
      outline: none;
      color: var(--fg);
      font-size: 13px;
      line-height: 1.45;
      min-height: 44px;
      max-height: 160px;
      resize: none;
      width: 100%;
      font-family: inherit;
    }

    .prompt-textarea::placeholder {
      opacity: 0.55;
    }

    .capsule-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      padding-top: 4px;
    }

    .capsule-chips {
      display: flex;
      align-items: center;
      gap: 5px;
      flex-wrap: wrap;
    }

    .capsule-chip {
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      color: var(--fg);
      border-radius: 6px;
      padding: 3px 7px;
      font-size: 11px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      opacity: 0.85;
      transition: opacity 0.15s, background-color 0.15s;
      max-width: 150px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .capsule-chip:hover {
      opacity: 1;
      background: var(--badge-bg);
    }

    .chip-toggle {
      display: flex;
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      border-radius: 6px;
      overflow: hidden;
    }

    .chip-btn {
      padding: 3px 7px;
      background: none;
      border: none;
      color: var(--fg);
      cursor: pointer;
      font-size: 11px;
      opacity: 0.7;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .chip-btn.active {
      background: var(--btn-bg);
      color: var(--btn-fg);
      opacity: 1;
      font-weight: 600;
    }

    .chip-select {
      background: var(--input-bg);
      color: var(--fg);
      border: 1px solid var(--input-border);
      border-radius: 6px;
      padding: 3px 6px;
      font-size: 11px;
      outline: none;
      max-width: 130px;
      text-overflow: ellipsis;
      cursor: pointer;
    }

    .send-circle-btn {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background-color: var(--btn-bg);
      color: var(--btn-fg);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.1s, background-color 0.15s;
      flex-shrink: 0;
    }

    .send-circle-btn:hover {
      background-color: var(--btn-hover);
      transform: scale(1.05);
    }

    .footer-disclaimer {
      font-size: 10.5px;
      opacity: 0.5;
      text-align: center;
      padding: 4px 6px 6px 6px;
      line-height: 1.3;
    }

    .hidden {
      display: none !important;
    }
  </style>
</head>
<body>
  <!-- Top Sub-Header Bar -->
  <div class="top-bar">
    <div class="status-badge">
      <div id="statusDot" class="status-dot ${initialState.connected ? 'connected' : 'disconnected'}"></div>
      <span id="statusText">${initialState.connected ? 'Zaylo Connected' : 'Zaylo Offline'}</span>
    </div>

    <div class="top-actions">
      <button id="apiKeyBtn" class="icon-btn ${initialState.connected ? '' : 'hidden'}" title="API Key Settings">${ICONS.key}</button>
      <button id="terminalBtn" class="icon-btn ${initialState.connected ? '' : 'hidden'}" title="Open Zaylo Dedicated Terminal">${ICONS.terminal}</button>
      <button id="newChatBtn" class="icon-btn ${initialState.connected ? '' : 'hidden'}" title="New Chat Session">${ICONS.plus}</button>
      <button id="disconnectBtn" class="icon-btn disconnect-btn ${initialState.connected ? '' : 'hidden'}" title="Disconnect from Zaylo Server">${ICONS.disconnect}</button>
    </div>
  </div>

  <!-- Disconnected State Card -->
  <div id="connectionPanel" class="connection-panel ${initialState.connected ? 'hidden' : ''}">
    <div class="connection-card">
      <div class="logo-container">
        ${ICONS.zapLarge}
        <span class="brand-title">Zaylo</span>
      </div>
      <p style="font-size: 11px; opacity: 0.8; line-height: 1.4;">
        Connect to your local Zaylo inference server to start pairing on your codebase.
      </p>

      <div class="field-group">
        <label for="serverUrlInput">Server Endpoint</label>
        <input id="serverUrlInput" class="input-field" type="text" value="${initialState.serverUrl}" placeholder="http://127.0.0.1:8080" />
      </div>

      <div class="field-group">
        <label for="apiKeyInput">Local API Key (Optional)</label>
        <input id="apiKeyInput" class="input-field" type="password" placeholder="Leave empty for local default" />
      </div>

      <button id="connectBtn" class="btn-primary">
        ${ICONS.zap}
        <span>Connect to Zaylo</span>
      </button>

      <p id="connectError" style="font-size: 11px; color: #ef4444;" class="hidden"></p>
    </div>
  </div>

  <!-- Connected State Layout (Antigravity Style) -->
  <div id="chatContainer" class="chat-container ${initialState.connected ? '' : 'hidden'}">
    <!-- Messages Container -->
    <div id="chatMessages" class="chat-messages">
      <!-- Centered Hero for Empty State -->
      <div id="welcomeHero" class="welcome-hero">
        <div class="hero-logo-box">
          ${ICONS.zapLarge}
        </div>
        <h1 class="hero-title">Zaylo</h1>
        <p class="hero-subtitle">Your local AI pair programmer</p>
      </div>
    </div>

    <!-- Floating Input Capsule Section -->
    <div class="input-section">
      <div class="input-capsule">
        <textarea
          id="promptInput"
          class="prompt-textarea"
          placeholder="Ask anything, @ to mention, / for workflows..."
          rows="1"
        ></textarea>

        <div class="capsule-toolbar">
          <div class="capsule-chips">
            <button id="contextPillBtn" class="capsule-chip" title="Active Editor Context">
              ${ICONS.file}
              <span id="activeContextPill">No active file</span>
            </button>

            <div class="chip-toggle">
              <button id="modeAgent" class="chip-btn active" title="Autonomous tools (File read/write, Terminal)">
                ${ICONS.zap} <span>Agent</span>
              </button>
              <button id="modeChat" class="chip-btn" title="Pure Q&A and code advice">
                ${ICONS.chat} <span>Chat</span>
              </button>
            </div>

            <select id="modelSelect" class="chip-select" title="Active Model">
              ${
                initialState.models.length > 0
                  ? initialState.models.map((m) => `<option value="${m}" ${m === initialState.activeModel ? 'selected' : ''}>${m}</option>`).join('')
                  : '<option value="">Default Model</option>'
              }
            </select>

            <button id="safeModeBtn" class="capsule-chip" title="Toggle security auto-approval">
              ${ICONS.shield} <span>Safe</span>
            </button>
          </div>

          <button id="sendBtn" class="send-circle-btn" title="Send (Enter)">
            ${ICONS.send}
          </button>
        </div>
      </div>

      <div class="footer-disclaimer">
        Zaylo runs 100% locally. Double-check all generated code.
      </div>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    const ICONS = {
      send: '${ICONS.send}',
      stop: '${ICONS.stop}',
      shield: '${ICONS.shield}',
      zap: '${ICONS.zap}',
      zapLarge: '${ICONS.zapLarge}',
      check: '${ICONS.check}',
      close: '${ICONS.close}',
      file: '${ICONS.file}',
      terminal: '${ICONS.terminal}',
      edit: '${ICONS.edit}',
      folder: '${ICONS.folder}',
      search: '${ICONS.search}',
      key: '${ICONS.key}',
      copy: '${ICONS.copy}',
      diff: '${ICONS.diff}',
      insert: '${ICONS.insert}'
    };

    // DOM Elements
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const modelSelect = document.getElementById('modelSelect');
    const apiKeyBtn = document.getElementById('apiKeyBtn');
    const terminalBtn = document.getElementById('terminalBtn');
    const newChatBtn = document.getElementById('newChatBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');

    const connectionPanel = document.getElementById('connectionPanel');
    const serverUrlInput = document.getElementById('serverUrlInput');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const connectBtn = document.getElementById('connectBtn');
    const connectError = document.getElementById('connectError');

    const chatContainer = document.getElementById('chatContainer');
    const welcomeHero = document.getElementById('welcomeHero');
    const activeContextPill = document.getElementById('activeContextPill');
    const chatMessages = document.getElementById('chatMessages');
    const modeAgent = document.getElementById('modeAgent');
    const modeChat = document.getElementById('modeChat');
    const safeModeBtn = document.getElementById('safeModeBtn');
    const promptInput = document.getElementById('promptInput');
    const sendBtn = document.getElementById('sendBtn');

    let currentMode = 'agent';
    let currentAssistantMessageDiv = null;
    let isStreaming = false;
    let isAutoApprove = false;

    // Auto-grow textarea
    promptInput.addEventListener('input', () => {
      promptInput.style.height = 'auto';
      promptInput.style.height = Math.min(promptInput.scrollHeight, 160) + 'px';
    });

    function updateSafeModeBtn() {
      if (!safeModeBtn) return;
      if (isAutoApprove) {
        safeModeBtn.innerHTML = ICONS.zap + ' <span>Auto-Approve ON</span>';
        safeModeBtn.title = 'Actions run automatically without security prompts';
      } else {
        safeModeBtn.innerHTML = ICONS.shield + ' <span>Safe</span>';
        safeModeBtn.title = 'Every file write and command asks for confirmation';
      }
    }

    if (safeModeBtn) {
      safeModeBtn.addEventListener('click', () => {
        isAutoApprove = !isAutoApprove;
        updateSafeModeBtn();
        vscode.postMessage({
          type: 'toggleAutoApprove',
          enabled: isAutoApprove,
        });
      });
    }

    if (terminalBtn) {
      terminalBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'openTerminal' });
      });
    }

    window.respondPermission = function(id, decision) {
      vscode.postMessage({
        type: 'permissionResponse',
        id: id,
        decision: decision,
      });
    };

    // Mode Toggle
    modeAgent.addEventListener('click', () => {
      currentMode = 'agent';
      modeAgent.classList.add('active');
      modeChat.classList.remove('active');
    });

    modeChat.addEventListener('click', () => {
      currentMode = 'chat';
      modeChat.classList.add('active');
      modeAgent.classList.remove('active');
    });

    // Global Click Delegation for Action Buttons & Permissions
    document.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest ? e.target.closest('button') : null;
      if (!btn) return;

      const action = btn.getAttribute('data-action');
      if (action === 'applyDiffSnippet') {
        applyDiffSnippet(btn);
        return;
      }
      if (action === 'copySnippet') {
        copySnippet(btn);
        return;
      }
      if (action === 'insertSnippet') {
        insertSnippet(btn);
        return;
      }
      if (action === 'previewDiffSnippet') {
        previewDiffSnippet(btn);
        return;
      }
      if (action === 'openApiKeyPrompt') {
        vscode.postMessage({ type: 'openApiKeyPrompt' });
        return;
      }

      const permId = btn.getAttribute('data-perm-id');
      const decision = btn.getAttribute('data-decision');
      if (permId && decision) {
        respondPermission(permId, decision);
        return;
      }
    });

    // Connection Click
    function triggerConnect() {
      connectError.classList.add('hidden');
      connectBtn.innerText = 'Connecting...';
      const rawUrl = serverUrlInput.value.trim() || 'http://127.0.0.1:8080';
      const cleanUrl = rawUrl.startsWith('http') ? rawUrl : 'http://' + rawUrl;
      vscode.postMessage({
        type: 'connect',
        url: cleanUrl,
        apiKey: apiKeyInput.value.trim(),
      });
    }

    connectBtn.addEventListener('click', triggerConnect);
    serverUrlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') triggerConnect();
    });
    apiKeyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') triggerConnect();
    });

    apiKeyBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'openApiKeyPrompt' });
    });

    disconnectBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'disconnect' });
    });

    newChatBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'newSession' });
      chatMessages.innerHTML = \`
        <div id="welcomeHero" class="welcome-hero">
          <div class="hero-logo-box">\${ICONS.zapLarge}</div>
          <h1 class="hero-title">Zaylo</h1>
          <p class="hero-subtitle">Your local AI pair programmer</p>
        </div>
      \`;
      promptInput.value = '';
      promptInput.style.height = '44px';
    });

    modelSelect.addEventListener('change', () => {
      vscode.postMessage({
        type: 'switchModel',
        model: modelSelect.value,
      });
    });

    // Send Message / Stop Streaming
    function handleSend() {
      if (isStreaming) {
        vscode.postMessage({ type: 'stopStream' });
        isStreaming = false;
        sendBtn.innerHTML = ICONS.send;
        return;
      }

      const prompt = promptInput.value.trim();
      if (!prompt) return;

      const hero = document.getElementById('welcomeHero');
      if (hero) hero.classList.add('hidden');

      appendUserMessage(prompt);
      promptInput.value = '';
      promptInput.style.height = '44px';

      vscode.postMessage({
        type: 'sendMessage',
        prompt: prompt,
        mode: currentMode,
      });

      prepareAssistantMessage();
    }

    sendBtn.addEventListener('click', handleSend);
    promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    function appendUserMessage(text) {
      const msgDiv = document.createElement('div');
      msgDiv.className = 'message user';
      msgDiv.innerHTML = \`
        <div class="message-role">You</div>
        <div class="message-content">\${escapeHtml(text)}</div>
      \`;
      chatMessages.appendChild(msgDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function prepareAssistantMessage() {
      isStreaming = true;
      sendBtn.innerHTML = ICONS.stop;

      const msgDiv = document.createElement('div');
      msgDiv.className = 'message assistant';
      msgDiv.innerHTML = \`
        <div class="message-role">Zaylo</div>
        <div class="message-content" id="streamTarget"></div>
      \`;
      chatMessages.appendChild(msgDiv);
      currentAssistantMessageDiv = msgDiv.querySelector('#streamTarget');
      currentAssistantMessageDiv.dataset.raw = '';
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Format & Render Markdown / Codeblocks
    function renderMarkdown(rawText) {
      const codeBlockRegex = /\\\`\\\`\\\`([a-zA-Z0-9_-]*)\\n([\\s\\S]*?)\\\`\\\`\\\`/g;
      let html = rawText.replace(codeBlockRegex, (match, lang, code) => {
        const escapedCode = escapeHtml(code.trim());
        const language = lang || 'code';
        return \`
          <div class="code-block-wrapper">
            <div class="code-block-header">
              <span class="code-block-lang">\${language}</span>
              <div class="code-actions">
                <button class="code-action-btn apply-btn" data-action="applyDiffSnippet">\${ICONS.check} Apply to File</button>
                <button class="code-action-btn" data-action="previewDiffSnippet">\${ICONS.diff} Preview Diff</button>
                <button class="code-action-btn" data-action="insertSnippet">\${ICONS.insert} Insert</button>
                <button class="code-action-btn" data-action="copySnippet">\${ICONS.copy} Copy</button>
              </div>
            </div>
            <pre><code data-raw="\${escapeAttribute(code.trim())}">\${escapedCode}</code></pre>
          </div>
        \`;
      });

      // Inline code
      html = html.replace(/\\\`([^\\\`]+)\\\`/g, '<code style="background:var(--code-bg);padding:2px 4px;border-radius:3px;">$1</code>');

      // Paragraph newlines
      html = html.replace(/\\n/g, '<br/>');

      return html;
    }

    window.copySnippet = function(btn) {
      const code = btn.closest('.code-block-wrapper').querySelector('code').dataset.raw;
      navigator.clipboard.writeText(code);
      btn.innerHTML = ICONS.check + ' Copied!';
      setTimeout(() => btn.innerHTML = ICONS.copy + ' Copy', 1500);
    };

    window.insertSnippet = function(btn) {
      const code = btn.closest('.code-block-wrapper').querySelector('code').dataset.raw;
      vscode.postMessage({ type: 'insertCode', code: code });
    };

    window.applyDiffSnippet = function(btn) {
      const code = btn.closest('.code-block-wrapper').querySelector('code').dataset.raw;
      vscode.postMessage({
        type: 'applyDiff',
        modified: code,
        file: activeContextPill.dataset.file || ''
      });
      btn.innerHTML = ICONS.check + ' Applied!';
      setTimeout(() => btn.innerHTML = ICONS.check + ' Apply to File', 2000);
    };

    window.previewDiffSnippet = function(btn) {
      const code = btn.closest('.code-block-wrapper').querySelector('code').dataset.raw;
      vscode.postMessage({ type: 'previewDiff', modified: code, file: activeContextPill.dataset.file || '' });
    };

    function escapeHtml(text) {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function escapeAttribute(text) {
      return text.replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    // Message receiver from Extension Host
    window.addEventListener('message', (event) => {
      const message = event.data;

      switch (message.type) {
        case 'connectionState':
          if (message.connected) {
            statusDot.className = 'status-dot connected';
            statusText.innerText = 'Zaylo Connected';
            connectionPanel.classList.add('hidden');
            chatContainer.classList.remove('hidden');
            apiKeyBtn.classList.remove('hidden');
            if (terminalBtn) terminalBtn.classList.remove('hidden');
            newChatBtn.classList.remove('hidden');
            disconnectBtn.classList.remove('hidden');

            if (message.models && message.models.length > 0) {
              modelSelect.innerHTML = message.models
                .map((m) => '<option value="' + m + '" ' + (m === message.activeModel ? 'selected' : '') + '>' + m + '</option>')
                .join('');
            }
          } else {
            statusDot.className = 'status-dot disconnected';
            statusText.innerText = 'Zaylo Offline';
            connectionPanel.classList.remove('hidden');
            chatContainer.classList.add('hidden');
            apiKeyBtn.classList.add('hidden');
            if (terminalBtn) terminalBtn.classList.add('hidden');
            newChatBtn.classList.add('hidden');
            disconnectBtn.classList.add('hidden');
            connectBtn.innerHTML = ICONS.zap + ' <span>Connect to Zaylo</span>';

            if (message.error) {
              connectError.innerText = message.error;
              connectError.classList.remove('hidden');
            }
          }
          break;

        case 'activeEditorContext':
          if (message.file) {
            activeContextPill.dataset.file = message.file;
            activeContextPill.innerText = message.file + (message.lineRange ? ' ' + message.lineRange : '');
          } else {
            activeContextPill.dataset.file = '';
            activeContextPill.innerText = 'No active file';
          }
          break;

        case 'streamChunk':
          if (currentAssistantMessageDiv) {
            currentAssistantMessageDiv.dataset.raw += message.chunk;
            currentAssistantMessageDiv.innerHTML = renderMarkdown(currentAssistantMessageDiv.dataset.raw);
            chatMessages.scrollTop = chatMessages.scrollHeight;
          }

          if (message.isDone) {
            isStreaming = false;
            sendBtn.innerHTML = ICONS.send;
            currentAssistantMessageDiv = null;
          }
          break;

        case 'agentAction':
          const actionDiv = document.createElement('div');
          actionDiv.className = 'agent-step';
          actionDiv.innerHTML =
            '<span>' + ICONS.zap + ' [Tool: ' + escapeHtml(message.toolName) + ']</span> ' +
            '<span>' + escapeHtml(message.description) + '</span>';
          chatMessages.appendChild(actionDiv);
          chatMessages.scrollTop = chatMessages.scrollHeight;
          break;

        case 'permissionRequest':
          const permReq = message.request;
          const permDiv = document.createElement('div');
          permDiv.className = 'permission-card';
          permDiv.id = 'perm-card-' + permReq.id;

          let toolIcon = ICONS.edit;
          if (permReq.tool === 'run_command') toolIcon = ICONS.terminal;
          if (permReq.tool === 'create_folder') toolIcon = ICONS.folder;
          if (permReq.tool === 'read_file') toolIcon = ICONS.search;

          let detailsHtml = '';
          if (permReq.command) {
            detailsHtml = '<div class="permission-desc">$ ' + escapeHtml(permReq.command) + '</div>';
          } else if (permReq.target) {
            detailsHtml = '<div class="permission-desc">Target: ' + escapeHtml(permReq.target) + '</div>';
          }

          if (permReq.codePreview) {
            detailsHtml += '<pre class="permission-code-preview"><code>' + escapeHtml(permReq.codePreview) + '</code></pre>';
          }

          permDiv.innerHTML =
            '<div class="permission-header">' +
              '<span style="display:flex;align-items:center;gap:4px;">' + toolIcon + ' Security Permission Required</span>' +
              '<span class="perm-status-badge" style="font-size:10px;background:#f59e0b;color:#000;padding:1px 5px;border-radius:3px;">Pending</span>' +
            '</div>' +
            '<div class="permission-title">' + escapeHtml(permReq.title) + '</div>' +
            detailsHtml +
            '<div class="permission-actions" id="perm-actions-' + permReq.id + '">' +
              '<button class="btn-perm-allow" data-perm-id="' + permReq.id + '" data-decision="allow">' + ICONS.check + ' Allow Once</button>' +
              '<button class="btn-perm-always" data-perm-id="' + permReq.id + '" data-decision="always">' + ICONS.zap + ' Always Allow</button>' +
              '<button class="btn-perm-deny" data-perm-id="' + permReq.id + '" data-decision="deny">' + ICONS.close + ' Deny</button>' +
            '</div>';

          chatMessages.appendChild(permDiv);
          chatMessages.scrollTop = chatMessages.scrollHeight;
          break;

        case 'permissionResolved':
          const permCard = document.getElementById('perm-card-' + message.id);
          if (permCard) {
            const badge = permCard.querySelector('.perm-status-badge');
            const actions = document.getElementById('perm-actions-' + message.id);
            if (actions) {
              if (message.decision === 'allow' || message.decision === 'always') {
                actions.innerHTML = '<span style="color:#10b981;font-size:11px;font-weight:600;display:inline-flex;align-items:center;gap:4px;">' + ICONS.check + ' Permission Granted (' + message.decision + ')</span>';
                if (badge) {
                  badge.innerText = 'Approved';
                  badge.style.background = '#10b981';
                  badge.style.color = '#fff';
                }
              } else {
                actions.innerHTML = '<span style="color:#ef4444;font-size:11px;font-weight:600;display:inline-flex;align-items:center;gap:4px;">' + ICONS.close + ' Permission Denied</span>';
                if (badge) {
                  badge.innerText = 'Denied';
                  badge.style.background = '#ef4444';
                  badge.style.color = '#fff';
                }
              }
            }
          }
          break;

        case 'terminalOutput':
          const termDiv = document.createElement('div');
          termDiv.className = 'terminal-log-card';
          const isSuccess = message.exitCode === 0;
          termDiv.innerHTML =
            '<div class="terminal-log-header">' +
              '<span style="display:flex;align-items:center;gap:4px;">' + ICONS.terminal + ' Zaylo Terminal: ' + escapeHtml(message.command) + '</span>' +
              '<span style="color:' + (isSuccess ? '#10b981' : '#ef4444') + '">' + (isSuccess ? 'Exit 0' : 'Exit ' + message.exitCode) + '</span>' +
            '</div>' +
            '<div class="terminal-log-body">' + escapeHtml(message.output || '(No output recorded)') + '</div>';
          chatMessages.appendChild(termDiv);
          chatMessages.scrollTop = chatMessages.scrollHeight;
          break;

        case 'autoApproveState':
          isAutoApprove = message.enabled;
          updateSafeModeBtn();
          break;

        case 'error':
          isStreaming = false;
          sendBtn.innerHTML = ICONS.send;
          const isAuthErr = message.message && (message.message.includes('Authentication') || message.message.includes('API key') || message.message.includes('401'));
          const authBtnHtml = isAuthErr
            ? '<div style="margin-top: 8px;"><button class="btn-primary" style="padding: 4px 8px; font-size: 11px; display:inline-flex; align-items:center; gap:4px;" data-action="openApiKeyPrompt">' + ICONS.key + ' Enter API Key</button></div>'
            : '';
          const errDiv = document.createElement('div');
          errDiv.className = 'message assistant';
          errDiv.innerHTML = '<div class="message-content" style="color: #ef4444;">Error: ' + escapeHtml(message.message) + authBtnHtml + '</div>';
          chatMessages.appendChild(errDiv);
          chatMessages.scrollTop = chatMessages.scrollHeight;
          break;
      }
    });

    // Notify extension host that webview is ready
    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
