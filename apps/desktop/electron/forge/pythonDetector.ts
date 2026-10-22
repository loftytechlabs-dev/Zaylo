import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface PythonEnvironmentInfo {
  available: boolean;
  pythonPath?: string;
  versions?: {
    torch?: string;
    transformers?: string;
    peft?: string;
  };
  deviceCapabilities?: {
    mpsAvailable: boolean;
    cudaAvailable: boolean;
  };
  error?: string;
}

let cachedInfo: PythonEnvironmentInfo | null = null;

export class PythonDetector {
  public static getCandidates(): string[] {
    const candidates: string[] = [];

    // 1. Pyenv specific versions if present
    const home = os.homedir();
    const pyenv311 = path.join(home, '.pyenv/versions/3.11.9/bin/python3');
    if (fs.existsSync(pyenv311)) candidates.push(pyenv311);

    const pyenvShims = path.join(home, '.pyenv/shims/python3');
    if (fs.existsSync(pyenvShims)) candidates.push(pyenvShims);

    // 2. Standard system paths
    candidates.push('python3');
    candidates.push('python');
    candidates.push('/usr/local/bin/python3');
    candidates.push('/opt/homebrew/bin/python3');
    candidates.push('/usr/bin/python3');

    // 3. Windows specific paths
    if (process.platform === 'win32') {
      candidates.push('py');
      const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
      candidates.push(path.join(localAppData, 'Programs', 'Python', 'Python311', 'python.exe'));
      candidates.push(path.join(localAppData, 'Programs', 'Python', 'Python310', 'python.exe'));
      candidates.push(path.join(localAppData, 'Programs', 'Python', 'Python312', 'python.exe'));
      candidates.push('C:\\Python311\\python.exe');
      candidates.push('C:\\Python310\\python.exe');
    }

    return candidates;
  }

  public static detect(forceRefresh = false): PythonEnvironmentInfo {
    if (cachedInfo && !forceRefresh) {
      return cachedInfo;
    }

    const testSnippet = `
import json, sys
try:
    import torch, transformers, peft
    mps = torch.backends.mps.is_available() if hasattr(torch.backends, 'mps') else False
    cuda = torch.cuda.is_available()
    print(json.dumps({
        "success": True,
        "torch": torch.__version__,
        "transformers": transformers.__version__,
        "peft": peft.__version__,
        "mps": mps,
        "cuda": cuda
    }))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
`;

    const candidates = this.getCandidates();
    let lastError = 'No Python 3 environment found';

    for (const bin of candidates) {
      try {
        const out = execSync(`"${bin}" -c "${testSnippet.replace(/"/g, '\\"')}"`, {
          encoding: 'utf-8',
          timeout: 10000,
          stdio: ['pipe', 'pipe', 'ignore'],
        }).trim();

        const lines = out.split('\n');
        const jsonLine = lines.find((l) => l.startsWith('{') && l.endsWith('}'));
        if (jsonLine) {
          const parsed = JSON.parse(jsonLine);
          if (parsed.success) {
            cachedInfo = {
              available: true,
              pythonPath: bin,
              versions: {
                torch: parsed.torch,
                transformers: parsed.transformers,
                peft: parsed.peft,
              },
              deviceCapabilities: {
                mpsAvailable: parsed.mps,
                cudaAvailable: parsed.cuda,
              },
            };
            return cachedInfo;
          } else {
            lastError = parsed.error;
          }
        }
      } catch (err: any) {
        lastError = err.message || 'Execution failed';
      }
    }

    cachedInfo = {
      available: false,
      error: `PyTorch, Transformers, or PEFT is missing or incompatible: ${lastError}`,
    };
    return cachedInfo;
  }
}
