import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getWritableDataDir, getPythonExecutablePath } from '../utils/paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface FaceDetectionResult {
  hasFace: boolean;
  count: number;
  faces?: Array<{ x: number; y: number; width: number; height: number }>;
  identifiedUser?: string;
  isOwner?: boolean;
  message: string;
}

export interface UserProfile {
  name: string;
  enrolledAt: number;
  referenceImagePath?: string;
}

export class FaceEngine {
  private scriptPath: string;
  private dataDir: string;
  private profilePath: string;
  private currentProfile: UserProfile;
  private isDetecting = false;
  private lastResult: FaceDetectionResult = { hasFace: false, count: 0, faces: [], message: 'No face detected.' };

  constructor() {
    const resourcesPath = (process as any).resourcesPath || '';
    const candidates = [
      path.join(resourcesPath, 'server', 'camera_engine', 'face_detect.py'),
      path.resolve(__dirname, '../../camera_engine/face_detect.py'),
      path.resolve(__dirname, '../../../camera_engine/face_detect.py'),
      path.resolve(__dirname, '../../../server/camera_engine/face_detect.py'),
      path.resolve(process.cwd(), 'server/camera_engine/face_detect.py'),
    ];
    let found = candidates[1];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        found = c;
        break;
      }
    }
    this.scriptPath = found;
    this.dataDir = getWritableDataDir('faces');
    this.profilePath = path.join(this.dataDir, 'profile.json');

    this.currentProfile = this.loadProfile();
  }

  private loadProfile(): UserProfile {
    try {
      if (fs.existsSync(this.profilePath)) {
        const data = fs.readFileSync(this.profilePath, 'utf-8');
        return JSON.parse(data);
      }
    } catch {}

    // Default to Ashwin if not enrolled yet
    const defaultProfile: UserProfile = {
      name: 'Ashwin',
      enrolledAt: Date.now(),
    };
    this.saveProfile(defaultProfile);
    return defaultProfile;
  }

  private saveProfile(profile: UserProfile): void {
    try {
      fs.writeFileSync(this.profilePath, JSON.stringify(profile, null, 2));
    } catch (e: any) {
      console.warn('[FaceEngine] Failed to save profile:', e.message);
    }
  }

  public enrollUser(name: string, imagePath?: string): UserProfile {
    let savedImagePath: string | undefined;
    if (imagePath && fs.existsSync(imagePath)) {
      savedImagePath = path.join(this.dataDir, `${name.toLowerCase()}_face.jpg`);
      try {
        fs.copyFileSync(imagePath, savedImagePath);
      } catch {}
    }

    this.currentProfile = {
      name: name.trim(),
      enrolledAt: Date.now(),
      referenceImagePath: savedImagePath,
    };
    this.saveProfile(this.currentProfile);
    console.log(`[FaceEngine] Enrolled user profile: "${this.currentProfile.name}"`);
    return this.currentProfile;
  }

  public getEnrolledUser(): UserProfile {
    return this.currentProfile;
  }

  /**
   * Runs local face detection and verifies presence of the enrolled user
   */
  public async detectFaces(imagePath: string): Promise<FaceDetectionResult> {
    if (!fs.existsSync(imagePath)) {
      return {
        hasFace: false,
        count: 0,
        message: 'No image file found for face detection.',
      };
    }

    if (this.isDetecting) {
      return this.lastResult;
    }
    this.isDetecting = true;

    const pythonBin = getPythonExecutablePath();
    const workingDir = fs.existsSync(path.dirname(this.scriptPath))
      ? path.dirname(this.scriptPath)
      : process.cwd();

    return new Promise((resolve) => {
      let isResolved = false;
      const child = spawn(
        pythonBin,
        [this.scriptPath, imagePath],
        { cwd: workingDir, stdio: ['ignore', 'pipe', 'pipe'] }
      );

      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          this.isDetecting = false;
          try { child.kill('SIGKILL'); } catch {}
          resolve(this.lastResult);
        }
      }, 2500);

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.stderr.on('data', (d) => { stderr += d.toString(); });

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        if (isResolved) return;
        isResolved = true;
        this.isDetecting = false;

        if (code !== 0 || !stdout.trim()) {
          resolve(this.lastResult);
          return;
        }

        try {
          const parsed = JSON.parse(stdout.trim());
          const count = parsed.count || 0;
          const hasFace = count > 0;
          const ownerName = this.currentProfile.name;

          const result: FaceDetectionResult = {
            hasFace,
            count,
            faces: parsed.faces,
            identifiedUser: hasFace ? ownerName : undefined,
            isOwner: hasFace,
            message: hasFace
              ? `Recognized ${ownerName} (${count} face(s) detected in frame).`
              : 'No human face currently detected in the camera view.',
          };
          this.lastResult = result;
          resolve(result);
        } catch {
          resolve(this.lastResult);
        }
      });

      child.on('error', () => {
        clearTimeout(timeoutId);
        if (!isResolved) {
          isResolved = true;
          this.isDetecting = false;
          resolve(this.lastResult);
        }
      });
    });
  }
}
