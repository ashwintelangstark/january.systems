import { EventEmitter } from 'events';
import { CameraService } from './cameraService.js';
import { FaceEngine, FaceDetectionResult } from './faceEngine.js';
import { config } from '../config.js';
import { modelRouter } from '../models/modelRouter.js';

export interface VisualContextState {
  isEyesOpen: boolean;
  isPresent: boolean;
  identifiedUser: string;
  faceCount: number;
  posture: 'upright' | 'slouching' | 'leaning_forward' | 'relaxed' | 'unknown';
  activity: string;
  expression: string;
  lastSnapshotPath?: string;
  summary: string;
  lastUpdated: number;
  fps: number;
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
  private isEyesOpen = false;

  private currentContext: VisualContextState;
  private lastPresenceState = false;
  private lastArrivalTimestamp = 0;
  private lastPresenceCheckTimestamp = 0;
  private lastGeminiPerceptionTimestamp = 0;

  constructor(options: ActivityMonitorOptions = {}) {
    super();
    this.cameraService = new CameraService();
    this.faceEngine = new FaceEngine();
    this.pollingIntervalMs = options.pollingIntervalMs || 1000; // 1s high-speed local check when eyes open
    this.ambientVisionCadenceMs = options.ambientVisionCadenceMs || 30000; // Gemini check every 30s when active

    const enrolled = this.faceEngine.getEnrolledUser();
    this.currentContext = {
      isEyesOpen: false,
      isPresent: false,
      identifiedUser: enrolled.name || 'Ashwin',
      faceCount: 0,
      posture: 'unknown',
      activity: 'Standing by',
      expression: 'Neutral',
      summary: 'Camera eyes are closed.',
      lastUpdated: Date.now(),
      fps: 0,
    };
  }

  public openEyes(targetFps = 60): void {
    if (this.isEyesOpen) return;
    this.isEyesOpen = true;
    this.currentContext.isEyesOpen = true;
    this.currentContext.fps = targetFps;
    this.currentContext.summary = 'Camera eyes open. Real-time 60 FPS video stream active.';

    console.log(`👁️ [VisualActivityMonitor] EYES OPEN: Activating continuous ${targetFps} FPS camera hardware stream...`);
    this.cameraService.startStreaming(targetFps);
    this.start();
    this.emit('eyesStateChange', { isEyesOpen: true, fps: targetFps });
  }

  public closeEyes(): void {
    if (!this.isEyesOpen) return;
    this.isEyesOpen = false;
    this.currentContext.isEyesOpen = false;
    this.currentContext.isPresent = false;
    this.currentContext.fps = 0;
    this.currentContext.activity = 'Camera Off';
    this.currentContext.summary = 'Camera eyes are closed.';
    this.lastPresenceState = false;

    console.log('🌙 [VisualActivityMonitor] EYES CLOSED: Stopping camera stream & releasing hardware (LED off)...');
    this.cameraService.stopStreaming();
    this.stop();
    this.emit('eyesStateChange', { isEyesOpen: false, fps: 0 });
  }

  public toggleEyes(): boolean {
    if (this.isEyesOpen) {
      this.closeEyes();
      return false;
    } else {
      this.openEyes(60);
      return true;
    }
  }

  public getEyesStatus(): { isEyesOpen: boolean; fps: number; isStreaming: boolean } {
    return {
      isEyesOpen: this.isEyesOpen,
      fps: this.currentContext.fps,
      isStreaming: this.cameraService.isStreaming(),
    };
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`👁️ [VisualActivityMonitor] Vision Cortex loop started...`);
    
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
    console.log('👁️ [VisualActivityMonitor] Vision Cortex loop stopped.');
  }

  public getCurrentContext(): VisualContextState {
    return this.currentContext;
  }

  public getFormattedVisualSummary(): string {
    if (!this.isEyesOpen) {
      return `Camera eyes are on standby and activate on-demand whenever visual analysis is needed.`;
    }
    if (!this.currentContext.isPresent) {
      return `Camera eyes are actively streaming (60 FPS). The user is currently not in front of the laptop.`;
    }
    return (
      `The user is currently present in front of the laptop.\n` +
      `Activity: ${this.currentContext.activity}. Posture: ${this.currentContext.posture}. Expression: ${this.currentContext.expression}.\n` +
      `Context: ${this.currentContext.summary}`
    );
  }

  private async tick(): Promise<void> {
    if (!this.isEyesOpen) return;
    if (this.isProcessingTick) return;
    this.isProcessingTick = true;

    try {
      // 1. Fetch zero-lag 60 FPS frame directly from hardware camera stream
      const snapshot = await this.cameraService.getLatestFrame();
      if (!snapshot.success || !snapshot.filePath || !snapshot.base64) {
        return;
      }

      // 2. Fast local OpenCV Face Detection (<20ms)
      const faceResult: FaceDetectionResult = await this.faceEngine.detectFaces(snapshot.filePath);
      const isNowPresent = faceResult.hasFace;
      const now = Date.now();

      this.currentContext.isPresent = isNowPresent;
      this.currentContext.faceCount = faceResult.count;
      this.currentContext.lastSnapshotPath = snapshot.filePath;
      this.currentContext.lastUpdated = now;

      // 3. State Transition: User Arrival (0 faces -> 1+ face)
      if (!this.lastPresenceState && isNowPresent) {
        this.lastPresenceState = true;
        this.lastArrivalTimestamp = now;
        console.log(`🌟 [VisualActivityMonitor] USER ARRIVAL DETECTED! The user is now at the desk.`);

        this.currentContext.activity = 'Arrived at desk';
        this.currentContext.summary = `User just sat down at the laptop.`;

        // Trigger immediate arrival multimodal vision analysis
        await this.runAmbientMultimodalAnalysis(snapshot.base64, 'arrival');
        this.emit('userArrival', {
          timestamp: now,
          context: this.currentContext,
        });
      }
      // 4. State Transition: User Departure (1+ face -> 0 faces for >8s)
      else if (this.lastPresenceState && !isNowPresent) {
        if (now - this.lastPresenceCheckTimestamp > 8000) {
          this.lastPresenceState = false;
          console.log('🚶 [VisualActivityMonitor] USER DEPARTURE DETECTED: Desk is empty.');
          this.currentContext.activity = 'Away from desk';
          this.currentContext.summary = 'User stepped away from desk.';
          this.emit('userDeparture', { timestamp: now });
        }
      }

      if (isNowPresent) {
        this.lastPresenceCheckTimestamp = now;

        // Periodic ambient multimodal update (every 45s if user is continuously active)
        if (now - this.lastGeminiPerceptionTimestamp > 45000) {
          await this.runAmbientMultimodalAnalysis(snapshot.base64, 'periodic');
        }
      }
    } catch (err: any) {
      console.warn('[VisualActivityMonitor] Tick error:', err.message);
    } finally {
      this.isProcessingTick = false;
    }
  }

  /**
   * Queries Gemini Vision in the background to inspect activity, posture, and facial expressions
   */
  private async runAmbientMultimodalAnalysis(base64Image: string, reason: 'arrival' | 'periodic'): Promise<void> {
    if (!config.geminiApiKey && !config.geminiFallbackApiKey && !config.openrouterApiKey && !config.openaiApiKey) return;
    this.lastGeminiPerceptionTimestamp = Date.now();

    const enrolledUser = this.faceEngine.getEnrolledUser();
    const prompt =
      'You are January\'s visual cortex observing the user through the laptop camera.\n' +
      'Briefly describe their current posture (upright/slouching/relaxed), primary activity (coding, reading, writing, gesturing, looking at screen, holding an object, drinking coffee), and facial expression (focused, smiling, tired, curious).\n' +
      'Format output strictly as JSON with keys: "posture", "activity", "expression", "briefSummary", "isWaving".';

    const geminiKeysToTry = [
      { key: config.geminiApiKey, name: 'Primary Gemini' },
      { key: config.geminiFallbackApiKey, name: 'Fallback Gemini' },
    ].filter((item) => !!item.key);

    const candidateModels = [
      'models/gemini-flash-lite-latest',
      'models/gemini-flash-latest',
    ];

    for (const keyConfig of geminiKeysToTry) {
      for (const model of candidateModels) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3500);

          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${keyConfig.key}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: controller.signal,
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

          clearTimeout(timeout);

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

          if (response.status === 429 || response.status === 400 || response.status === 403) {
            break; // Immediately exit model loop for dead key
          }
        } catch {
          // Fallback to next candidate model
        }
      }
    }

    // 2. OpenRouter / OmniRoute Multimodal Vision Fallback (Tier 3)
    if (config.openrouterApiKey) {
      const candidateOpenRouterVision = modelRouter.getCandidatesForTask({ taskType: 'vision', requireVision: true });
      for (const model of candidateOpenRouterVision) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 9000);

          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${config.openrouterApiKey}`,
              'HTTP-Referer': 'https://january.systems',
              'X-Title': 'January AI',
            },
            body: JSON.stringify({
              model,
              messages: [
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: prompt },
                    {
                      type: 'image_url',
                      image_url: {
                        url: `data:image/jpeg;base64,${base64Image}`,
                      },
                    },
                  ],
                },
              ],
              max_tokens: 250,
              temperature: 0.3,
            }),
          });
          clearTimeout(timeoutId);

          const data = (await response.json()) as any;
          if (response.ok && data?.choices?.[0]?.message?.content) {
            const text = data.choices[0].message.content.trim();
            const cleanJson = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
            try {
              const parsed = JSON.parse(cleanJson);
              if (parsed.posture) this.currentContext.posture = parsed.posture;
              if (parsed.activity) this.currentContext.activity = parsed.activity;
              if (parsed.expression) this.currentContext.expression = parsed.expression;
              if (parsed.briefSummary) this.currentContext.summary = parsed.briefSummary;

              console.log(`👁️ [VisualActivityMonitor:OpenRouter] Visual Context: [Activity: ${this.currentContext.activity} | Posture: ${this.currentContext.posture} | Mood: ${this.currentContext.expression}]`);

              if (parsed.isWaving) {
                this.emit('gesture', { type: 'wave', user: enrolledUser.name });
              }

              this.emit('activityUpdate', this.currentContext);
              return;
            } catch {
              this.currentContext.summary = text.slice(0, 150);
              return;
            }
          }
        } catch {
          // Fallback to next candidate model
        }
      }
    }

    // 3. OpenAI Multimodal Vision Fallback: Activated if Gemini & OpenRouter are unavailable
    if (config.openaiApiKey) {
      const candidateOpenAiVision = ['gpt-4o-mini', 'gpt-4o'];
      for (const model of candidateOpenAiVision) {
        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${config.openaiApiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: prompt },
                    {
                      type: 'image_url',
                      image_url: {
                        url: `data:image/jpeg;base64,${base64Image}`,
                      },
                    },
                  ],
                },
              ],
              max_tokens: 250,
              temperature: 0.3,
            }),
          });

          const data = (await response.json()) as any;
          if (response.ok && data?.choices?.[0]?.message?.content) {
            const text = data.choices[0].message.content.trim();
            const cleanJson = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
            try {
              const parsed = JSON.parse(cleanJson);
              if (parsed.posture) this.currentContext.posture = parsed.posture;
              if (parsed.activity) this.currentContext.activity = parsed.activity;
              if (parsed.expression) this.currentContext.expression = parsed.expression;
              if (parsed.briefSummary) this.currentContext.summary = parsed.briefSummary;

              console.log(`👁️ [VisualActivityMonitor:OpenAI] Visual Context: [Activity: ${this.currentContext.activity} | Posture: ${this.currentContext.posture} | Mood: ${this.currentContext.expression}]`);

              if (parsed.isWaving) {
                this.emit('gesture', { type: 'wave', user: enrolledUser.name });
              }

              this.emit('activityUpdate', this.currentContext);
              return;
            } catch {
              this.currentContext.summary = text.slice(0, 150);
              return;
            }
          }
        } catch {
          // Fallback to next OpenAI model
        }
      }
    }
  }
}
