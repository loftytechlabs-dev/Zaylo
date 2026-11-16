import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getDefaultAppDataDir } from '@local-ai/shared';

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

const cachedInfo = new Map<string, PythonEnvironmentInfo>();

export class PythonDetector {
  public static getCandidates(): string[] {
    const candidates: string[] = [];
    if (process.env.ZAYLO_PYTHON) candidates.push(process.env.ZAYLO_PYTHON);
    if (process.env.VIRTUAL_ENV) candidates.push(path.join(process.env.VIRTUAL_ENV, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'));

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

  public static detect(forceRefresh = false, requirements: 'training' | 'image' = 'training'): PythonEnvironmentInfo {
    const cached = cachedInfo.get(requirements);
    if (cached && !forceRefresh) return cached;

    const testSnippet = `
import json, sys
try:
    import torch
    ${requirements === 'image' ? 'import diffusers, PIL, transformers' : 'import transformers, peft'}
    mps = torch.backends.mps.is_available() if hasattr(torch.backends, 'mps') else False
    cuda = torch.cuda.is_available()
    print(json.dumps({
        "success": True,
        "torch": torch.__version__,
        "transformers": transformers.__version__,
        "peft": ${requirements === 'training' ? 'peft.__version__' : 'None'},
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
        const out = execFileSync(bin, ['-c', testSnippet], {
          encoding: 'utf-8',
          timeout: 10000,
          stdio: ['pipe', 'pipe', 'ignore'],
        }).trim();

        const lines = out.split('\n');
        const jsonLine = lines.find((l) => l.startsWith('{') && l.endsWith('}'));
        if (jsonLine) {
          const parsed = JSON.parse(jsonLine);
          if (parsed.success) {
            const info: PythonEnvironmentInfo = {
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
            cachedInfo.set(requirements, info);
            return info;
          } else {
            lastError = parsed.error;
          }
        }
      } catch (err: any) {
        lastError = err.message || 'Execution failed';
      }
    }

    const info: PythonEnvironmentInfo = {
      available: false,
      error: `Python ${requirements} dependencies are missing or incompatible: ${lastError}`,
    };
    cachedInfo.set(requirements, info);
    return info;
  }
}

/**
 * Resolves an executable script path (e.g. Python worker script) that can be
 * safely executed by external OS processes (like python3).
 *
 * External OS processes cannot execute files directly inside Electron's app.asar
 * archive because asar is a virtual filesystem handled only by Node.js/Electron APIs.
 * Passing an app.asar path to Python results in:
 * [Errno 20] Not a directory
 *
 * This function resolves candidates in order:
 * 1. A physical file on disk (development mode, non-asar path)
 * 2. An unpacked file in app.asar.unpacked (packaged mode with asarUnpack)
 * 3. Extracts the file from app.asar into the app's data directory so external
 *    binaries can run it without [Errno 20] Not a directory.
 */
export function resolvePythonScript(scriptName: string, candidatePaths: string[]): string {
  // 1. Direct filesystem check for non-asar candidates (e.g. during local dev)
  for (const p of candidatePaths) {
    if (!p.includes('app.asar') && fs.existsSync(p)) {
      return p;
    }
  }

  // 2. Check if electron-builder unpacked it to app.asar.unpacked
  for (const p of candidatePaths) {
    if (p.includes('app.asar')) {
      const unpacked = p.replace(/\bapp\.asar\b/, 'app.asar.unpacked');
      if (fs.existsSync(unpacked)) {
        return unpacked;
      }
    }
  }

  // 3. Fallback: extract script from app.asar to app data directory
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const scriptsDir = path.join(getDefaultAppDataDir(), 'scripts');
        if (!fs.existsSync(scriptsDir)) {
          fs.mkdirSync(scriptsDir, { recursive: true });
        }
        const targetPath = path.join(scriptsDir, scriptName);
        const content = fs.readFileSync(p);

        let needsWrite = true;
        if (fs.existsSync(targetPath)) {
          try {
            const existing = fs.readFileSync(targetPath);
            if (existing.equals(content)) {
              needsWrite = false;
            }
          } catch {
            // ignore and overwrite
          }
        }

        if (needsWrite) {
          fs.writeFileSync(targetPath, content);
          try {
            fs.chmodSync(targetPath, 0o755);
          } catch {}
        }

        return targetPath;
      } catch (err) {
        console.warn(`[ScriptResolver] Failed to extract ${scriptName} from ${p}:`, err);
      }
    }
  }

  // Fallback to first candidate if nothing was found
  return candidatePaths[0];
}
