import { CameraService } from '../vision/cameraService.js';
import { FaceEngine } from '../vision/faceEngine.js';
import { config } from '../config.js';

const cameraService = new CameraService();
const faceEngine = new FaceEngine();

export interface SeeAndAnalyzeArgs {
  prompt?: string;
  focus?: 'general' | 'face' | 'text' | 'object' | 'posture';
  languageGuidance?: string;
}

export interface VisionToolResult {
  success: boolean;
  description: string;
  verbalSummary: string;
  hasFace?: boolean;
  identifiedUser?: string;
  snapshotPath?: string;
  modelUsed?: string;
  error?: string;
}

export async function seeAndAnalyze(args: SeeAndAnalyzeArgs = {}): Promise<VisionToolResult> {
  const userPrompt = args.prompt || 'Describe in detail what you see in front of the camera, including any people, objects, and surroundings.';

  console.log(`[VisionTool] Capturing frame and analyzing: "${userPrompt}"...`);

  // 1. Capture snapshot via native camera (zero-lag frame if stream active)
  const snapshot = await cameraService.getLatestFrame();
  if (!snapshot.success || !snapshot.base64 || !snapshot.filePath) {
    return {
      success: false,
      description: snapshot.error || 'Failed to capture camera snapshot.',
      verbalSummary: 'I could not access the camera. Please check camera permissions in macOS System Settings.',
      error: snapshot.error,
    };
  }

  // 2. Local Face & Presence Detection
  const faceResult = await faceEngine.detectFaces(snapshot.filePath);
  const enrolledUser = faceEngine.getEnrolledUser();

  console.log(`[VisionTool] Face detection result: ${faceResult.message}`);

  // 3. Gemini Multimodal Vision Analysis
  let visionSystemInstruction =
    'You are January, an intelligent AI operating system assistant with live camera vision.\n' +
    `The primary user and owner of this computer is ${enrolledUser.name}.\n` +
    (faceResult.hasFace
      ? `[LOCAL VISION TELEMETRY: Exactly ${faceResult.count} human face(s) are detected in this frame, identified as ${enrolledUser.name}.]\n`
      : '[LOCAL VISION TELEMETRY: No human face is detected in the immediate foreground.]\n') +
    'Provide a direct, perceptive, and natural analysis of what you see through the laptop camera.\n' +
    'Always address or acknowledge the user warmly if they appear in the frame. Keep responses direct, engaging, and suitable for spoken conversation (2-3 sentences max).';

  if (args.languageGuidance) {
    visionSystemInstruction += `\n\n[MANDATORY LANGUAGE & SCRIPT DIRECTIVE]:\n${args.languageGuidance}`;
  }

  const candidateVisionModels = [
    'models/gemini-3.5-flash-lite',
    'models/gemini-2.0-flash',
    'models/gemini-3.1-flash-lite',
  ];

  if (!config.geminiApiKey) {
    return {
      success: true,
      description: `Camera snapshot captured. Face detector: ${faceResult.message}`,
      verbalSummary: faceResult.hasFace ? `I see you, ${enrolledUser.name}.` : 'I took a photo, but no face was detected.',
      hasFace: faceResult.hasFace,
      identifiedUser: faceResult.identifiedUser,
      snapshotPath: snapshot.filePath,
    };
  }

  for (const model of candidateVisionModels) {
    try {
      console.log(`[VisionTool] Querying Gemini Vision model (${model})...`);
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
                  { text: userPrompt },
                  {
                    inlineData: {
                      mimeType: 'image/jpeg',
                      data: snapshot.base64,
                    },
                  },
                ],
              },
            ],
            systemInstruction: {
              parts: [{ text: visionSystemInstruction }],
            },
          }),
        }
      );

      const data = (await response.json()) as any;
      if (response.ok && data?.candidates?.[0]?.content?.parts) {
        const reply = data.candidates[0].content.parts
          .map((p: any) => p.text || '')
          .join('')
          .trim();

        if (reply) {
          return {
            success: true,
            description: reply,
            verbalSummary: reply,
            hasFace: faceResult.hasFace,
            identifiedUser: faceResult.identifiedUser,
            snapshotPath: snapshot.filePath,
            modelUsed: model,
          };
        }
      }
      console.warn(`[VisionTool] Model ${model} returned status ${response.status}:`, data?.error?.message?.slice(0, 80));
    } catch (e: any) {
      console.warn(`[VisionTool] Network error for ${model}:`, e.message);
    }
  }

  return {
    success: true,
    description: `Snapshot saved. ${faceResult.message}`,
    verbalSummary: faceResult.hasFace ? `Hello ${enrolledUser.name}, I see you!` : 'I looked through the camera, but cannot reach the vision API.',
    hasFace: faceResult.hasFace,
    identifiedUser: faceResult.identifiedUser,
    snapshotPath: snapshot.filePath,
  };
}

export { cameraService, faceEngine };
