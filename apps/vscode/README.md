# Zaylo AI - VS Code Extension

**Autonomous Local AI Pair Programmer & Codebase Assistant**

Connects VS Code directly to your local **Zaylo** inference engine (`http://127.0.0.1:8080`). Experience an Antigravity & Codex-like coding agent with 100% data privacy and zero cloud telemetry.

---

## Features

* **⚡ Auto-Discovery & Connection**:
  * Automatically detects running Zaylo local servers on startup.
  * Real-time status indicator on the VS Code status bar (🟢 `Zaylo: Ready (Qwen 2.5 Coder)`).
  * Quick-switch model picker and server settings from the status bar menu.

* **💬 Sidebar Chat & Agent Interface**:
  * Dedicated Activity Bar icon with primary sidebar panel.
  * **Agent Mode**: Autonomous codebase agent that reads files, generates diffs, and executes tests in the integrated terminal.
  * **Chat Mode**: Real-time code explanations, documentation, and architecture questions.
  * **Streamed Responses**: Sub-50ms token generation streamed directly from Zaylo's local engine.

* **📎 Active Editor & Codebase Context**:
  * Automatically binds active file, line ranges, and selection into prompts.
  * Syntax highlighted code blocks with **Copy**, **Insert at Cursor**, and **Preview Diff** actions.

* **🛠 Code Actions**:
  * Right-click editor context menu:
    * `Zaylo: Explain Selected Code`
    * `Zaylo: Refactor Code`
    * `Zaylo: Generate Unit Tests`

---

## Configuration Settings

In VS Code `Settings` (`Cmd+,` or `Ctrl+,`):

| Setting | Default | Description |
| :--- | :--- | :--- |
| `zaylo.serverUrl` | `http://127.0.0.1:8080` | Local Zaylo inference server base URL |
| `zaylo.autoConnect` | `true` | Automatically detect and connect to Zaylo on startup |
| `zaylo.apiKey` | `""` | Local API key (if authentication is enabled) |
| `zaylo.agentMode` | `true` | Enable autonomous file reading, editing, and terminal tools |

---

## Development & Debugging

1. Build the extension:
   ```bash
   pnpm build:vscode
   ```
2. Watch for changes during development:
   ```bash
   pnpm watch:vscode
   ```
3. Press **F5** in VS Code to launch the **Extension Development Host** with the Zaylo AI extension loaded.
