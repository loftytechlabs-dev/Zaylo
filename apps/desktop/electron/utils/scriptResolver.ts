import fs from 'node:fs';
import path from 'node:path';
import { getDefaultAppDataDir } from '@local-ai/shared';

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
