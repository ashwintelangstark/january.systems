import { execFile, spawn, ChildProcess } from 'child_process';
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
  private streamChildProcess: ChildProcess | null = null;
  private latestFramePath: string;

  constructor() {
    this.binaryPath = path.resolve(__dirname, '../../camera_engine/camera_snap');
    this.capturesDir = path.resolve(__dirname, '../../data/captures');
    this.latestFramePath = path.join(this.capturesDir, 'latest.jpg');

    if (!fs.existsSync(this.capturesDir)) {
      fs.mkdirSync(this.capturesDir, { recursive: true });
    }
  }

  /**
   * Starts a continuous, real-time 60 FPS hardware video stream process
   */
  public startStreaming(targetFps = 60): void {
    if (this.streamChildProcess) return;

    console.log(`📷 [CameraService] Launching continuous ${targetFps} FPS hardware camera stream...`);
    const child = spawn(this.binaryPath, ['--stream', this.latestFramePath, targetFps.toString()]);
    this.streamChildProcess = child;

    child.stdout?.on('data', (chunk: Buffer) => {
      const msg = chunk.toString().trim();
      if (msg.startsWith('OK:STREAMING_ACTIVE')) {
        console.log(`⚡ [CameraService] Hardware camera stream ACTIVE (${targetFps} FPS zero-lag stream).`);
      }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      const errStr = chunk.toString().trim();
      if (errStr.startsWith('STREAM_FPS:')) {
        // Telemetry frame rate logging
      }
    });

    child.on('exit', () => {
      console.log('📷 [CameraService] Native hardware camera stream process exited.');
      this.streamChildProcess = null;
    });
  }

  /**
   * Stops the continuous video stream process and releases camera hardware
   */
  public stopStreaming(): void {
    if (!this.streamChildProcess) return;

    console.log('📷 [CameraService] Terminating hardware video stream process (camera LED off)...');
    try {
      this.streamChildProcess.kill('SIGTERM');
    } catch {}
    this.streamChildProcess = null;
  }

  public isStreaming(): boolean {
    return this.streamChildProcess !== null;
  }

  /**
   * Instantly retrieves the latest frame with zero delay (<5ms)
   */
  public async getLatestFrame(): Promise<CameraSnapshotResult> {
    const now = Date.now();

    // If active 60 FPS stream is running, read latest frame directly from memory-synced file
    if (this.isStreaming() && fs.existsSync(this.latestFramePath)) {
      try {
        const imgBuffer = fs.readFileSync(this.latestFramePath);
        if (imgBuffer.length > 0) {
          const res: CameraSnapshotResult = {
            success: true,
            base64: imgBuffer.toString('base64'),
            filePath: this.latestFramePath,
            byteCount: imgBuffer.length,
            timestamp: now,
          };
          this.cachedSnapshot = res;
          return res;
        }
      } catch {}
    }

    // Fall back to one-shot capture if streaming is off
    return this.captureSnapshot(true);
  }

  /**
   * Captures a high-resolution JPEG frame from the Mac's physical camera
   */
  public async captureSnapshot(forceFresh = false): Promise<CameraSnapshotResult> {
    const now = Date.now();

    if (this.isStreaming() && fs.existsSync(this.latestFramePath)) {
      return this.getLatestFrame();
    }

    // Cache hit if captured within 3 seconds and fresh frame not demanded
    if (!forceFresh && this.cachedSnapshot && this.cachedSnapshot.success && now - this.cachedSnapshot.timestamp < 3000) {
      return this.cachedSnapshot;
    }

    if (this.isCapturing) {
      await new Promise((r) => setTimeout(r, 200));
      if (this.cachedSnapshot) return this.cachedSnapshot;
    }

    this.isCapturing = true;
    const outputPath = path.join(this.capturesDir, `frame_${now}.jpg`);

    try {
      await execFileAsync(this.binaryPath, ['--oneshot', outputPath]);

      if (!fs.existsSync(outputPath)) {
        throw new Error('Snapshot file not created by camera binary.');
      }

      const imgBuffer = fs.readFileSync(outputPath);
      fs.copyFileSync(outputPath, this.latestFramePath);
      this.cleanupOldFrames();

      const result: CameraSnapshotResult = {
        success: true,
        base64: imgBuffer.toString('base64'),
        filePath: this.latestFramePath,
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
    } catch {}
  }
}

