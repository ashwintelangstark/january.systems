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
