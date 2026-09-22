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

  const now = new Date();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  const dateFormatted = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone,
  });
  const timeFormatted = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone,
  });

  // 3. Gemini Multimodal Vision Analysis
  let visionSystemInstruction =
    'You are January, an exceptionally observant, sharp, and charismatic AI companion with real-time camera vision through the laptop webcam.\n\n' +
    `[LIVE LOCAL CONTEXT: Date: ${dateFormatted}, Local Time: ${timeFormatted} (${timeZone}, IST)]\n\n` +
    'REAL-TIME CAMERA PERCEPTION DIRECTIVES:\n' +
    '1. DETECT AND PERCEIVE WITH HIGH FIDELITY:\n' +
    '   • Person & Outfit: Observe what the person is wearing (exact clothing type e.g. t-shirt, shirt, hoodie, jacket; precise colors and patterns; neckwear; glasses/spectacles; style; grooming).\n' +
    '   • Behavior & Actions: Observe active behavior, posture (upright, slouching, leaning), gestures, hand positions (holding a phone, typing, resting chin, gesturing), and facial expression (focused, smiling, tired, relaxed, contemplative).\n' +
    '   • Things & Objects: Observe visible objects in the scene (what is on the desk or table, items in hands, phone, laptop, cups, bottles, stationery, headphones, accessories).\n' +
    '   • Surroundings & Environment: Observe the room setting, background, walls, windows, lighting, furniture, and atmosphere.\n\n' +
    '2. STRICT NAME RESTRICTION: NEVER address or refer to the user by their name ("Ashwin") or start responses with "Hey Ashwin" unless the user explicitly told you to use their name or asked for their name. Speak directly in the natural second person ("You are wearing...", "On your desk, I see...", "In your room...").\n\n' +
    '3. CONVERSATIONAL DIRECTNESS: Answer the user\'s specific query directly, vividly, and accurately in 2-4 sentences. If they asked about their outfit, focus deeply on the clothing and colors; if they asked about surroundings or things, focus on the objects and room; if they asked a general question, provide a sharp, well-rounded observation.\n\n' +
    '4. NO ROBOTIC CLICHES: Never say "As an AI..." or "Based on this image...". Speak naturally and companionably as if you are right there observing the room.';

  if (args.languageGuidance) {
    visionSystemInstruction += `\n\n[MANDATORY LANGUAGE & SCRIPT DIRECTIVE]:\n${args.languageGuidance}`;
  }

  const geminiKeysToTry = [
    { key: config.geminiApiKey, name: 'Primary Gemini' },
    { key: config.geminiFallbackApiKey, name: 'Fallback Gemini' },
  ].filter((item) => !!item.key);

  const candidateVisionModels = [
    'models/gemini-flash-lite-latest',
    'models/gemini-3.5-flash-lite',
    'models/gemini-3-flash-preview',
    'models/gemini-flash-latest',
    'models/gemini-3.5-flash',
  ];

  const userAskedForName = /\b(my\s+name|who\s+am\s+i|call\s+me|name\s+is)\b/i.test(userPrompt);

  const sanitizeNameOutput = (text: string): string => {
    if (userAskedForName) return text;
    return text
      .replace(/^(?:Hey|Hi|Hello|Well|Sure|Okay|Look|Ah),?\s+Ashwin(?:,\s*|\s*[-–—:]\s*|\s+)/i, '')
      .replace(/^Ashwin,\s*/i, '')
      .replace(/,\s*Ashwin([.!?])/gi, '$1')
      .replace(/\bAshwin\b/gi, 'you');
  };

  for (const keyConfig of geminiKeysToTry) {
    for (const model of candidateVisionModels) {
      try {
        console.log(`[VisionTool] Querying ${keyConfig.name} Vision (${model})...`);
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${keyConfig.key}`,
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
          const rawReply = data.candidates[0].content.parts
            .map((p: any) => p.text || '')
            .join('')
            .trim();

          const reply = sanitizeNameOutput(rawReply);

          if (reply) {
            return {
              success: true,
              description: reply,
              verbalSummary: reply,
              hasFace: faceResult.hasFace,
              identifiedUser: faceResult.identifiedUser,
              snapshotPath: snapshot.filePath,
              modelUsed: `${keyConfig.name}: ${model}`,
            };
          }
        }
        console.warn(`[VisionTool] ${keyConfig.name} model ${model} returned status ${response.status}:`, data?.error?.message?.slice(0, 80));
      } catch (e: any) {
        console.warn(`[VisionTool] Network error for ${keyConfig.name} (${model}):`, e.message);
      }
    }
  }

  // 4. OpenAI Vision Fallback: Activated if Gemini is quota-exhausted or unavailable
  if (config.openaiApiKey) {
    const candidateOpenAiVision = ['gpt-4o-mini', 'gpt-4o'];
    for (const model of candidateOpenAiVision) {
      try {
        console.log(`[VisionTool] 🔄 Gemini Vision unavailable. Querying OpenAI Vision fallback (${model})...`);
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.openaiApiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: visionSystemInstruction },
              {
                role: 'user',
                content: [
                  { type: 'text', text: userPrompt },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:image/jpeg;base64,${snapshot.base64}`,
                    },
                  },
                ],
              },
            ],
            max_tokens: 300,
            temperature: 0.7,
          }),
        });

        const data = (await response.json()) as any;
        if (response.ok && data?.choices?.[0]?.message?.content) {
          const rawReply = data.choices[0].message.content.trim();
          const reply = sanitizeNameOutput(rawReply);
          if (reply) {
            console.log(`✅ [VisionTool] Successfully analyzed image via OpenAI Vision (${model})`);
            return {
              success: true,
              description: reply,
              verbalSummary: reply,
              hasFace: faceResult.hasFace,
              identifiedUser: faceResult.identifiedUser,
              snapshotPath: snapshot.filePath,
              modelUsed: `OpenAI: ${model}`,
            };
          }
        }
        console.warn(`[VisionTool] OpenAI Vision ${model} failed (${response.status}):`, data?.error?.message?.slice(0, 80));
      } catch (err: any) {
        console.warn(`[VisionTool] OpenAI Vision network error for ${model}:`, err.message);
      }
    }
  }

  return {
    success: true,
    description: `Snapshot saved. ${faceResult.message}`,
    verbalSummary: faceResult.hasFace ? 'I see you in front of the camera.' : 'I looked through the camera, but cannot reach cloud vision APIs.',
    hasFace: faceResult.hasFace,
    identifiedUser: faceResult.identifiedUser,
    snapshotPath: snapshot.filePath,
  };
}

export { cameraService, faceEngine };
