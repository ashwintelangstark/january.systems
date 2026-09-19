import { EventEmitter } from 'events';
import { CameraService } from './cameraService.js';
import { FaceEngine, FaceDetectionResult } from './faceEngine.js';
import { config } from '../config.js';

export interface VisualContextState {
  isPresent: boolean;
  identifiedUser: string;
  faceCount: number;
  posture: 'upright' | 'slouching' | 'leaning_forward' | 'relaxed' | 'unknown';
  activity: string;
  expression: string;
  lastSnapshotPath?: string;
  summary: string;
  lastUpdated: number;
}

export interface ActivityMonitorOptions {
  pollingIntervalMs?: number;
  ambientVisionCadenceMs?: number;
}

export class VisualActivityMonitor extends EventEmitter {
  private cameraService: CameraService;
  private faceEngine: FaceEngine;
  private pollingIntervalMs: number;
  private ambientVisionCadenceMs: number;
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isProcessingTick = false;

  private currentContext: VisualContextState;
  private lastPresenceState = false;
  private lastArrivalTimestamp = 0;
  private lastGeminiPerceptionTimestamp = 0;

  constructor(options: ActivityMonitorOptions = {}) {
    super();
    this.cameraService = new CameraService();
    this.faceEngine = new FaceEngine();
    this.pollingIntervalMs = options.pollingIntervalMs || 4000; // Fast local check every 4s
    this.ambientVisionCadenceMs = options.ambientVisionCadenceMs || 45000; // Gemini multimodal check every 45s

    const enrolled = this.faceEngine.getEnrolledUser();
    this.currentContext = {
      isPresent: false,
      identifiedUser: enrolled.name || 'Ashwin',
      faceCount: 0,
      posture: 'unknown',
      activity: 'Standing by',
      expression: 'Neutral',
      summary: 'Camera monitor initializing...',
      lastUpdated: Date.now(),
    };
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`👁️ [VisualActivityMonitor] Continuous camera monitoring started (Local edge interval: ${this.pollingIntervalMs / 1000}s)...`);
    
    // Initial quick snapshot
    this.tick();
    this.timer = setInterval(() => this.tick(), this.pollingIntervalMs);
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log('👁️ [VisualActivityMonitor] Continuous camera monitoring stopped.');
  }

  public getCurrentContext(): VisualContextState {
    return this.currentContext;
  }

  public getFormattedVisualSummary(): string {
    if (!this.currentContext.isPresent) {
      return `User is not in front of the laptop camera.`;
    }
    return (
      `User ${this.currentContext.identifiedUser} is currently present in front of the laptop.\n` +
      `Activity: ${this.currentContext.activity}. Posture: ${this.currentContext.posture}. Expression: ${this.currentContext.expression}.\n` +
      `Context: ${this.currentContext.summary}`
    );
  }

  private async tick(): Promise<void> {
    if (this.isProcessingTick) return;
    this.isProcessingTick = true;

    try {
      // 1. Capture snapshot from native camera
      const snapshot = await this.cameraService.captureSnapshot();
      if (!snapshot.success || !snapshot.filePath || !snapshot.base64) {
        return;
      }

      // 2. Fast local OpenCV Face Detection (<20ms)
      const faceResult: FaceDetectionResult = await this.faceEngine.detectFaces(snapshot.filePath);
      const isNowPresent = faceResult.hasFace;
      const enrolledUser = this.faceEngine.getEnrolledUser();
      const now = Date.now();

      this.currentContext.isPresent = isNowPresent;
      this.currentContext.faceCount = faceResult.count;
      this.currentContext.lastSnapshotPath = snapshot.filePath;
      this.currentContext.lastUpdated = now;

      // 3. State Transition: User Arrival (0 faces -> 1+ face)
      if (!this.lastPresenceState && isNowPresent) {
        this.lastPresenceState = true;
        this.lastArrivalTimestamp = now;
        console.log(`🌟 [VisualActivityMonitor] USER ARRIVAL DETECTED! ${enrolledUser.name} is now at the desk.`);

        this.currentContext.activity = 'Arrived at desk';
        this.currentContext.summary = `${enrolledUser.name} just sat down at the laptop.`;

        // Trigger immediate arrival multimodal vision analysis
        await this.runAmbientMultimodalAnalysis(snapshot.base64, 'arrival');
        this.emit('userArrival', {
          user: enrolledUser.name,
          context: this.currentContext,
          timestamp: now,
        });
      }
      // 4. State Transition: User Departure (1+ face -> 0 faces)
      else if (this.lastPresenceState && !isNowPresent) {
        this.lastPresenceState = false;
        console.log(`👋 [VisualActivityMonitor] USER DEPARTURE: ${enrolledUser.name} stepped away from the desk.`);
        this.currentContext.activity = 'Away from desk';
        this.currentContext.posture = 'unknown';
        this.currentContext.expression = 'None';
        this.currentContext.summary = `${enrolledUser.name} stepped away.`;
        this.emit('userDeparture', {
          user: enrolledUser.name,
          timestamp: now,
        });
      }
      // 5. Periodic Ambient Multimodal Perception while User is Present
      else if (isNowPresent && now - this.lastGeminiPerceptionTimestamp > this.ambientVisionCadenceMs) {
        await this.runAmbientMultimodalAnalysis(snapshot.base64, 'periodic');
      }
    } catch (err: any) {
      // Non-fatal, retry on next tick
    } finally {
      this.isProcessingTick = false;
    }
  }

  /**
   * Queries Gemini Vision in the background to inspect activity, posture, and facial expressions
   */
  private async runAmbientMultimodalAnalysis(base64Image: string, reason: 'arrival' | 'periodic'): Promise<void> {
    if (!config.geminiApiKey) return;
    this.lastGeminiPerceptionTimestamp = Date.now();

    const enrolledUser = this.faceEngine.getEnrolledUser();
    const prompt =
      'You are January\'s visual cortex observing the user through the laptop camera.\n' +
      `The user is ${enrolledUser.name}.\n` +
      'Briefly describe their current posture (upright/slouching/relaxed), primary activity (coding, reading, writing, gesturing, looking at screen, holding an object, drinking coffee), and facial expression (focused, smiling, tired, curious).\n' +
      'Format output strictly as JSON with keys: "posture", "activity", "expression", "briefSummary", "isWaving".';

    const candidateModels = [
      'models/gemini-3.5-flash-lite',
      'models/gemini-2.0-flash',
      'models/gemini-3.1-flash-lite',
    ];

    for (const model of candidateModels) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${config.geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    { text: prompt },
                    {
                      inlineData: {
                        mimeType: 'image/jpeg',
                        data: base64Image,
                      },
                    },
                  ],
                },
              ],
            }),
          }
        );

        const data = (await response.json()) as any;
        if (response.ok && data?.candidates?.[0]?.content?.parts) {
          const text = data.candidates[0].content.parts.map((p: any) => p.text || '').join('').trim();
          const cleanJson = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
          try {
            const parsed = JSON.parse(cleanJson);
            if (parsed.posture) this.currentContext.posture = parsed.posture;
            if (parsed.activity) this.currentContext.activity = parsed.activity;
            if (parsed.expression) this.currentContext.expression = parsed.expression;
            if (parsed.briefSummary) this.currentContext.summary = parsed.briefSummary;

            console.log(`👁️ [VisualActivityMonitor] Visual Context: [Activity: ${this.currentContext.activity} | Posture: ${this.currentContext.posture} | Mood: ${this.currentContext.expression}]`);

            if (parsed.isWaving) {
              this.emit('gesture', { type: 'wave', user: enrolledUser.name });
            }

            this.emit('activityUpdate', this.currentContext);
            return;
          } catch {
            // If raw text returned
            this.currentContext.summary = text.slice(0, 150);
            return;
          }
        }
      } catch {
        // Fallback to next candidate model
      }
    }
  }
}
