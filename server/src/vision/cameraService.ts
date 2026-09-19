import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface CameraSnapshotResult {
  success: boolean;
  base64?: string;
  filePath?: string;
  byteCount?: number;
  timestamp: number;
  error?: string;
}

export class CameraService {
  private binaryPath: string;
  private capturesDir: string;
  private cachedSnapshot: CameraSnapshotResult | null = null;
  private isCapturing = false;

  constructor() {
    this.binaryPath = path.resolve(__dirname, '../../camera_engine/camera_snap');
    this.capturesDir = path.resolve(__dirname, '../../data/captures');

    if (!fs.existsSync(this.capturesDir)) {
      fs.mkdirSync(this.capturesDir, { recursive: true });
    }
  }

  /**
   * Captures a high-resolution JPEG frame from the Mac's physical camera
   */
  public async captureSnapshot(forceFresh = false): Promise<CameraSnapshotResult> {
    const now = Date.now();

    // Cache hit if captured within 3 seconds and fresh frame not demanded
    if (!forceFresh && this.cachedSnapshot && this.cachedSnapshot.success && now - this.cachedSnapshot.timestamp < 3000) {
      return this.cachedSnapshot;
    }

    if (this.isCapturing) {
      // Wait briefly if capture in progress
      await new Promise((r) => setTimeout(r, 400));
      if (this.cachedSnapshot) return this.cachedSnapshot;
    }

    this.isCapturing = true;
    const outputPath = path.join(this.capturesDir, `frame_${now}.jpg`);
    const latestPath = path.join(this.capturesDir, 'latest.jpg');

    try {
      console.log('[CameraService] Activating system camera for snapshot...');
      await execFileAsync(this.binaryPath, [outputPath]);

      if (!fs.existsSync(outputPath)) {
        throw new Error('Snapshot file not created by camera binary.');
      }

      const imgBuffer = fs.readFileSync(outputPath);
      // Copy to latest.jpg for persistent dashboard/preview access
      fs.copyFileSync(outputPath, latestPath);

      // Clean up frames older than 5 minutes to prevent disk bloat
      this.cleanupOldFrames();

      const result: CameraSnapshotResult = {
        success: true,
        base64: imgBuffer.toString('base64'),
        filePath: latestPath,
        byteCount: imgBuffer.length,
        timestamp: now,
      };

      this.cachedSnapshot = result;
      return result;
    } catch (err: any) {
      console.error('[CameraService] Camera capture error:', err.message);
      return {
        success: false,
        error: `Camera capture failed: ${err.message}`,
        timestamp: now,
      };
    } finally {
      this.isCapturing = false;
    }
  }

  private cleanupOldFrames(): void {
    try {
      const files = fs.readdirSync(this.capturesDir);
      const now = Date.now();
      for (const file of files) {
        if (file.startsWith('frame_') && file.endsWith('.jpg')) {
          const filePath = path.join(this.capturesDir, file);
          const stat = fs.statSync(filePath);
          if (now - stat.mtimeMs > 5 * 60 * 1000) {
            fs.unlinkSync(filePath);
          }
        }
      }
    } catch {
      // Ignore cleanup error
    }
  }
}
