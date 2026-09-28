import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Returns a guaranteed writable directory for runtime data (brain db, captures, uploads, models)
 */
export function getWritableDataDir(subDir?: string): string {
  let baseDir: string;

  if (process.env.JANUARY_DATA_DIR) {
    baseDir = process.env.JANUARY_DATA_DIR;
  } else {
    const isInsideAsar = __dirname.includes('.asar');
    const localData = path.resolve(__dirname, '../../../data');

    // Use local workspace data only if not packaged and workspace exists
    if (!isInsideAsar && fs.existsSync(path.resolve(__dirname, '../../../package.json'))) {
      baseDir = localData;
    } else {
      baseDir = path.join(os.homedir(), 'Library/Application Support/january-ai/data');
    }
  }

  const targetDir = subDir ? path.join(baseDir, subDir) : baseDir;
  if (!fs.existsSync(targetDir)) {
    try {
      fs.mkdirSync(targetDir, { recursive: true });
    } catch (err: any) {
      console.warn(`[Paths] Could not mkdir ${targetDir}:`, err.message);
    }
  }

  return targetDir;
}

/**
 * Returns the best available Python executable path, prioritizing embedded standalone python
 */
export function getPythonExecutablePath(): string {
  const resourcesPath = (process as any).resourcesPath || '';
  const candidates = [
    path.join(resourcesPath, 'server', 'python', 'bin', 'python3'),
    path.join(resourcesPath, 'server', 'python', 'bin', 'python'),
    path.resolve(__dirname, '../../python/bin/python3'),
    path.resolve(__dirname, '../../python/bin/python'),
    path.resolve(__dirname, '../../../server/python/bin/python3'),
    path.resolve(process.cwd(), 'server/python/bin/python3'),
    path.resolve(process.cwd(), 'python/bin/python3'),
    path.resolve(__dirname, '../../audio_engine/.venv_kokoro/bin/python'),
    path.resolve(__dirname, '../../../server/audio_engine/.venv_kokoro/bin/python'),
    path.resolve(process.cwd(), 'server/audio_engine/.venv_kokoro/bin/python'),
    path.join(os.homedir(), 'Library/Application Support/january-ai/python_env/bin/python'),
    '/opt/homebrew/bin/python3',
    '/usr/local/bin/python3',
    '/usr/bin/python3',
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      try {
        fs.chmodSync(c, 0o755);
      } catch {}
      return c;
    }
  }

  return 'python3';
}

/**
 * Returns the best available cliclick executable path, prioritizing bundled standalone binary
 */
export function getCliclickPath(): string {
  const resourcesPath = (process as any).resourcesPath || '';
  const candidates = [
    path.join(resourcesPath, 'server', 'bin', 'cliclick'),
    path.resolve(__dirname, '../../bin/cliclick'),
    path.resolve(__dirname, '../../../server/bin/cliclick'),
    path.resolve(process.cwd(), 'server/bin/cliclick'),
    path.resolve(process.cwd(), 'bin/cliclick'),
    '/opt/homebrew/bin/cliclick',
    '/usr/local/bin/cliclick',
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      try {
        fs.chmodSync(c, 0o755);
      } catch {}
      return c;
    }
  }

  return 'cliclick';
}

/**
 * Returns the best available uv package manager executable path, prioritizing bundled standalone binary
 */
export function getUvPath(): string {
  const resourcesPath = (process as any).resourcesPath || '';
  const candidates = [
    path.join(resourcesPath, 'server', 'bin', 'uv'),
    path.resolve(__dirname, '../../bin/uv'),
    path.resolve(__dirname, '../../../server/bin/uv'),
    path.resolve(process.cwd(), 'server/bin/uv'),
    path.resolve(process.cwd(), 'bin/uv'),
    path.join(os.homedir(), '.local/bin/uv'),
    path.join(os.homedir(), '.cargo/bin/uv'),
    '/opt/homebrew/bin/uv',
    '/usr/local/bin/uv',
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      try {
        fs.chmodSync(c, 0o755);
      } catch {}
      return c;
    }
  }

  return 'uv';
}

