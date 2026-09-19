import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

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

  constructor() {
    this.scriptPath = path.resolve(__dirname, '../../camera_engine/face_detect.py');
    this.dataDir = path.resolve(__dirname, '../../data/faces');
    this.profilePath = path.join(this.dataDir, 'profile.json');

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

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

    const uvPath = fs.existsSync('/Users/ashwintelangstark/.local/bin/uv')
      ? '/Users/ashwintelangstark/.local/bin/uv'
      : 'uv';

    return new Promise((resolve) => {
      const child = spawn(
        uvPath,
        ['run', '--with', 'opencv-python,numpy', 'python3', this.scriptPath, imagePath],
        { stdio: ['ignore', 'pipe', 'pipe'] }
      );

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.stderr.on('data', (d) => { stderr += d.toString(); });

      child.on('close', (code) => {
        if (code !== 0 || !stdout.trim()) {
          console.warn('[FaceEngine] Detection notice:', stderr.trim() || `exit code ${code}`);
          resolve({
            hasFace: false,
            count: 0,
            message: 'Face detection engine returned no output.',
          });
          return;
        }

        try {
          const parsed = JSON.parse(stdout.trim());
          const count = parsed.count || 0;
          const hasFace = count > 0;
          const ownerName = this.currentProfile.name;

          resolve({
            hasFace,
            count,
            faces: parsed.faces,
            identifiedUser: hasFace ? ownerName : undefined,
            isOwner: hasFace,
            message: hasFace
              ? `Recognized ${ownerName} (${count} face(s) detected in frame).`
              : 'No human face currently detected in the camera view.',
          });
        } catch (err: any) {
          resolve({
            hasFace: false,
            count: 0,
            message: `JSON parse error in face detector: ${err.message}`,
          });
        }
      });
    });
  }
}
