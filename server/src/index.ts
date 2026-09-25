import express from 'express';
import http from 'http';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { config, validateConfig } from './config.js';
import { GeminiLiveClient } from './gemini/liveClient.js';
import { WakeDetector } from './wake/wakeDetector.js';
import { SystemSpeaker } from './audio/systemSpeaker.js';
import { SystemMicrophone } from './audio/systemMic.js';
import { EmotionEngine } from './emotions/emotionEngine.js';
import { GeminiService } from './gemini/geminiService.js';
import { VisualActivityMonitor } from './vision/activityMonitor.js';
import { AgentState, ClientMessage, ServerMessage } from './types.js';

validateConfig();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// State & Core Singletons
let currentState: AgentState = 'passive';
const geminiClient = new GeminiLiveClient();
const geminiService = new GeminiService();
const wakeDetector = new WakeDetector();
const systemSpeaker = new SystemSpeaker();
const systemMic = new SystemMicrophone();
const emotionEngine = geminiService.getEmotionEngine();
const visualActivityMonitor = new VisualActivityMonitor();

geminiService.setActivityMonitor(visualActivityMonitor);

// Basic health & status endpoint
app.get('/api/health', (req, res) => {
  const profile = geminiService.getLearnedProfileEngine().getProfile();
  res.json({
    status: 'ok',
    agent: 'January',
    geminiModel: config.geminiModel,
    claudeModel: config.claudeModel,
    voice: config.geminiVoice,
    wakePhrase: config.wakePhrase,
    hasGeminiKey: !!config.geminiApiKey,
    hasClaudeKey: !!config.claudeApiKey,
    emotion: emotionEngine.getCurrentEmotion(),
    visualContext: visualActivityMonitor.getCurrentContext(),
    learnedInteractions: profile.totalInteractions,
    preferredLanguages: profile.preferredCodingLanguages,
  });
});

app.get('/api/profile', (req, res) => {
  res.json(geminiService.getLearnedProfileEngine().getProfile());
});

app.post('/api/camera/toggle', (req, res) => {
  const { action, fps } = req.body || {};
  if (action === 'open') {
    visualActivityMonitor.openEyes(fps || 60);
  } else if (action === 'close') {
    visualActivityMonitor.closeEyes();
  } else {
    visualActivityMonitor.toggleEyes();
  }
  res.json({ status: 'ok', ...visualActivityMonitor.getEyesStatus() });
});

emotionEngine.on('emotionChange', (emotion) => {
  broadcast({ type: 'emotion_update', payload: emotion });
});

// Track connected browser clients and CLI sessions
const clients = new Set<WebSocket>();
const activeCliSockets = new Set<WebSocket>();
let isCliActiveHttp = false;

function updateCliMode(): void {
  const isCliAttached = activeCliSockets.size > 0 || isCliActiveHttp;
  if (isCliAttached) {
    console.log('💻 [Coordinator] Terminal CLI session active. Background microphone is PAUSED.');
    systemMic.setMute(true);
    broadcast({
      type: 'system_log',
      message: 'Terminal CLI attached. Background microphone paused.',
      level: 'info',
    });
  } else {
    console.log('🎙️ [Coordinator] Terminal CLI disconnected. Background microphone is ACTIVE and LISTENING.');
    systemMic.setMute(false);
    broadcast({
      type: 'system_log',
      message: 'Terminal CLI detached. Background microphone resumed.',
      level: 'info',
    });
  }
}

// REST endpoints for CLI coordination
app.post('/api/cli/attach', (req, res) => {
  isCliActiveHttp = true;
  updateCliMode();
  res.json({ status: 'ok', cliActive: true, micPaused: true });
});

app.post('/api/cli/detach', (req, res) => {
  isCliActiveHttp = false;
  updateCliMode();
  res.json({ status: 'ok', cliActive: false, micPaused: false });
});

function broadcast(message: ServerMessage): void {
  const json = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  }
}

function setAgentState(newState: AgentState, reason?: string): void {
  if (currentState !== newState) {
    console.log(`[Coordinator] Agent state changed: ${currentState.toUpperCase()} -> ${newState.toUpperCase()} (${reason || 'event'})`);
    currentState = newState;
    broadcast({ type: 'state_change', state: newState, reason });
  }
}

// ----------------------------------------------------
// Gemini Live Client Event Wiring
// ----------------------------------------------------
geminiClient.on('ready', () => {
  broadcast({ type: 'system_log', message: 'Gemini Live Multimodal session ready', level: 'info' });
});

geminiClient.on('audio', (pcmChunkBase64: string, mimeType: string) => {
  setAgentState('speaking', 'Gemini speaking audio stream');
  broadcast({
    type: 'audio_output',
    data: pcmChunkBase64,
    mimeType,
  });
  // Output directly through laptop's physical speakers
  systemSpeaker.playPcmChunk(pcmChunkBase64);
});

geminiClient.on('transcript', (role: 'user' | 'assistant', text: string, isFinal?: boolean) => {
  broadcast({
    type: 'transcript',
    payload: {
      role,
      text,
      isFinal,
      timestamp: Date.now(),
    },
  });

  // Speak assistant response out loud through system speakers if not using raw PCM stream
  if (role === 'assistant' && isFinal && text.trim()) {
    setAgentState('speaking', 'System speaker response');
    const curEmotion = emotionEngine.getCurrentEmotion();
    systemSpeaker.speakText(text, {
      pitch: curEmotion.pitch,
      rate: curEmotion.rate,
      emotion: curEmotion.emotion,
    }).then(() => {
      setAgentState('passive', 'Speech completed');
    });
  }
});

geminiClient.on('toolCall', (payload) => {
  setAgentState('working', `Tool call: ${payload.name}`);
  broadcast({
    type: 'tool_call',
    payload,
  });
});

geminiClient.on('toolResult', (payload) => {
  broadcast({
    type: 'tool_result',
    payload,
  });

  if (payload.name === 'delegate_coding' && payload.result?.success) {
    const r = payload.result;
    console.log(`\n\x1b[36m\x1b[1m╔═══════════════════════════════════════════════════════════════════╗\x1b[0m`);
    console.log(`\x1b[36m\x1b[1m║ 💻 [CODE GENERATED IN TERMINAL: ${(r.language || 'CODE').toUpperCase()}] — ${(r.model || 'Gemini/Claude')}\x1b[0m`);
    console.log(`\x1b[36m\x1b[1m╠═══════════════════════════════════════════════════════════════════╣\x1b[0m`);
    const lines = (r.response || r.codeSnippet || '').split('\n');
    for (const l of lines) {
      console.log(`\x1b[36m\x1b[1m║\x1b[0m ${l}`);
    }
    if (r.compilationCommand) {
      console.log(`\x1b[36m\x1b[1m╠═══════════════════════════════════════════════════════════════════╣\x1b[0m`);
      console.log(`\x1b[36m\x1b[1m║\x1b[0m \x1b[33m\x1b[1m▶ Run Command:\x1b[0m \x1b[96m${r.compilationCommand}\x1b[0m`);
    }
    console.log(`\x1b[36m\x1b[1m╚═══════════════════════════════════════════════════════════════════╝\x1b[0m\n`);
  }
});

geminiClient.on('interrupt', () => {
  console.log('[Coordinator] User interrupted.');
  systemSpeaker.stopPlayback();
  setAgentState('listening', 'User interrupt');
  broadcast({ type: 'interrupt' });
});

geminiClient.on('stateChange', (state: AgentState, reason?: string) => {
  setAgentState(state, reason);
});

geminiClient.on('error', (err: Error) => {
  broadcast({
    type: 'system_log',
    message: `Gemini Live error: ${err.message}`,
    level: 'error',
  });
});

// ----------------------------------------------------
// System Physical Microphone & Speaker Echo Cancellation Wiring
// ----------------------------------------------------
systemSpeaker.on('start', () => {
  systemMic.setMute(true);
});

systemSpeaker.on('end', () => {
  systemMic.setMute(false);
});

systemMic.on('ready', () => {
  broadcast({
    type: 'system_log',
    message: 'System physical microphone & Faster-Whisper ready',
    level: 'info',
  });
});

systemMic.on('wake', (data) => {
  console.log(`🌟 [Coordinator] PHYSICAL MIC WAKE WORD HEARD ("${config.wakePhrase.toUpperCase()}")!`);
  setAgentState('listening', `Physical microphone wake phrase recognized`);
  broadcast({
    type: 'system_log',
    message: `Physical Mic: "${config.wakePhrase}" recognized`,
    level: 'info',
  });
});

systemMic.on('sleep', (data) => {
  console.log(`🌙 [Coordinator] PHYSICAL MIC SLEEP WORD HEARD ("${config.sleepPhrase.toUpperCase()}")!`);
  systemSpeaker.stopPlayback();
  setAgentState('sleeping', `Physical microphone sleep phrase recognized`);
  const capWake = config.wakePhrase.charAt(0).toUpperCase() + config.wakePhrase.slice(1);
  const sleepMsg = `Good night. Standing by until you say ${capWake}.`;
  systemSpeaker.speakText(sleepMsg);
  broadcast({
    type: 'transcript',
    payload: {
      role: 'assistant',
      text: sleepMsg,
      isFinal: true,
      timestamp: Date.now(),
    },
  });
  broadcast({
    type: 'system_log',
    message: `Physical Mic: Sleep word "${config.sleepPhrase}" recognized`,
    level: 'info',
  });
});

systemMic.on('camera_wake', async (data) => {
  console.log(`👁️ [Coordinator] PHYSICAL MIC CAMERA WAKE WORD HEARD ("${config.cameraWakePhrase.toUpperCase()}")!`);
  visualActivityMonitor.openEyes(60);
  const msg = 'Eyes open. Real-time 60 FPS camera vision activated.';
  broadcast({
    type: 'transcript',
    payload: { role: 'assistant', text: msg, isFinal: true, timestamp: Date.now() },
  });
  broadcast({
    type: 'system_log',
    message: `Physical Mic: Camera wake phrase "${config.cameraWakePhrase}" recognized`,
    level: 'info',
  });
  setAgentState('speaking', 'Camera eyes opened');
  await systemSpeaker.speakText(msg, { emotion: 'joy' });
  setAgentState('passive', 'Speech completed');
});

systemMic.on('camera_sleep', async (data) => {
  console.log(`🌙 [Coordinator] PHYSICAL MIC CAMERA SLEEP WORD HEARD ("${config.cameraSleepPhrase.toUpperCase()}")!`);
  visualActivityMonitor.closeEyes();
  const msg = 'Eyes closed. Camera monitoring paused and hardware turned off.';
  broadcast({
    type: 'transcript',
    payload: { role: 'assistant', text: msg, isFinal: true, timestamp: Date.now() },
  });
  broadcast({
    type: 'system_log',
    message: `Physical Mic: Camera sleep phrase "${config.cameraSleepPhrase}" recognized`,
    level: 'info',
  });
  setAgentState('speaking', 'Camera eyes closed');
  await systemSpeaker.speakText(msg, { emotion: 'calm' });
  setAgentState('passive', 'Speech completed');
});

async function handleUnifiedPrompt(text: string, source: 'voice' | 'text' = 'voice'): Promise<void> {
  const clean = text.trim();
  if (!clean) return;

  // Interrupt previous audio immediately on fresh input
  systemSpeaker.stopPlayback();

  // If active CLI is attached in a separate terminal process, suppress background voice to prevent collisions
  if (activeCliSockets.size > 0 && source === 'voice') {
    console.log('[Coordinator] Terminal CLI session is active. Voice prompt ignored.');
    return;
  }

  console.log(`\n🎙️ [Coordinator] Processing ${source.toUpperCase()} prompt: "${clean}"`);
  broadcast({
    type: 'transcript',
    payload: {
      role: 'user',
      text: clean,
      isFinal: true,
      timestamp: Date.now(),
    },
  });

  // Strip punctuation and extra whitespace for robust phrase detection
  const strippedPrompt = clean.toLowerCase().replace(/[^\w\s]/g, '').trim();

  // Camera Eyes Wake Command
  const isCamWakeCommand =
    strippedPrompt === config.cameraWakePhrase ||
    ['eyes open', 'open eyes', 'camera open', 'open camera', 'eyes on', 'turn on camera', 'enable camera'].includes(strippedPrompt) ||
    (/\b(eyes open|open eyes|camera open|open camera|eyes on|turn on camera|enable camera)\b/i.test(strippedPrompt) && strippedPrompt.length < 35);

  if (isCamWakeCommand) {
    visualActivityMonitor.openEyes(60);
    const msg = 'Eyes open. Real-time 60 FPS camera vision activated.';
    console.log(`👁️ [Coordinator] Camera wake word recognized: EYES OPEN (60 FPS Stream).`);
    broadcast({
      type: 'transcript',
      payload: { role: 'assistant', text: msg, isFinal: true, timestamp: Date.now() },
    });
    broadcast({
      type: 'system_log',
      message: `Camera Eyes Activated: 60 FPS continuous hardware stream running`,
      level: 'info',
    });
    setAgentState('speaking', 'Camera eyes opened');
    await systemSpeaker.speakText(msg, { emotion: 'joy' });
    setAgentState('passive', 'Speech completed');
    return;
  }

  // Camera Eyes Sleep Command
  const isCamSleepCommand =
    strippedPrompt === config.cameraSleepPhrase ||
    ['eyes closed', 'close eyes', 'camera closed', 'close camera', 'eyes off', 'turn off camera', 'disable camera'].includes(strippedPrompt) ||
    (/\b(eyes closed|close eyes|camera closed|close camera|eyes off|turn off camera|disable camera)\b/i.test(strippedPrompt) && strippedPrompt.length < 35);

  if (isCamSleepCommand) {
    visualActivityMonitor.closeEyes();
    const msg = 'Eyes closed. Camera monitoring paused and hardware turned off.';
    console.log(`🌙 [Coordinator] Camera sleep word recognized: EYES CLOSED.`);
    broadcast({
      type: 'transcript',
      payload: { role: 'assistant', text: msg, isFinal: true, timestamp: Date.now() },
    });
    broadcast({
      type: 'system_log',
      message: `Camera Eyes Deactivated: Hardware process terminated (LED off, 0% CPU)`,
      level: 'info',
    });
    setAgentState('speaking', 'Camera eyes closed');
    await systemSpeaker.speakText(msg, { emotion: 'calm' });
    setAgentState('passive', 'Speech completed');
    return;
  }

  // System Sleep Command
  const isSystemSleepCommand =
    strippedPrompt === config.sleepPhrase ||
    ['good night', 'goodnight', 'go to sleep', 'sleep'].includes(strippedPrompt) ||
    (/\b(good night|goodnight|go to sleep)\b/i.test(strippedPrompt) && strippedPrompt.length < 25);

  if (isSystemSleepCommand) {
    console.log(`🌙 [Coordinator] Sleep phrase recognized: "${clean}"`);
    systemSpeaker.stopPlayback();
    setAgentState('sleeping', 'Sleep phrase spoken');
    const capWake = config.wakePhrase.charAt(0).toUpperCase() + config.wakePhrase.slice(1);
    const sleepMsg = `Good night. Standing by until you say ${capWake}.`;
    broadcast({
      type: 'transcript',
      payload: { role: 'assistant', text: sleepMsg, isFinal: true, timestamp: Date.now() },
    });
    await systemSpeaker.speakText(sleepMsg, { emotion: 'calm' });
    return;
  }

  // System Wake Command
  const isSystemWakeCommand =
    strippedPrompt === config.wakePhrase ||
    ['rise', 'arise', 'a rise', 'wake up', 'wake'].includes(strippedPrompt) ||
    (/\b(rise|arise|wake up)\b/i.test(strippedPrompt) && strippedPrompt.length < 25);

  if (isSystemWakeCommand) {
    console.log(`⚡ [Coordinator] Wake phrase recognized: "${clean}"`);
    setAgentState('listening', 'Wake phrase received');
    const wakeMsg = 'I am awake and listening.';
    broadcast({
      type: 'transcript',
      payload: { role: 'assistant', text: wakeMsg, isFinal: true, timestamp: Date.now() },
    });
    await systemSpeaker.speakText(wakeMsg, { emotion: 'joy' });
    return;
  }

  setAgentState('working', `Processing ${source} command`);

  try {
    const result = await geminiService.analyzeAndRespond(clean);

    // 1. Broadcast tool calls & results if any system actions occurred
    if (result.toolCalls && result.toolCalls.length > 0) {
      for (const tc of result.toolCalls) {
        broadcast({
          type: 'tool_call',
          payload: { id: Math.random().toString(36).substring(2, 9), name: tc.name, args: tc.args },
        });
        broadcast({
          type: 'tool_result',
          payload: { id: Math.random().toString(36).substring(2, 9), name: tc.name, result: tc.result },
        });
      }
    }

    // 2. Code Generation (Python / C / C++)
    if (result.isCode) {
      console.log(`\n\x1b[36m\x1b[1m╔═══════════════════════════════════════════════════════════════════╗\x1b[0m`);
      console.log(`\x1b[36m\x1b[1m║ 💻 [CODE GENERATED IN TERMINAL: ${(result.language || 'CODE').toUpperCase()}] — ${(result.modelUsed || 'Coding Engine')}\x1b[0m`);
      console.log(`\x1b[36m\x1b[1m╠═══════════════════════════════════════════════════════════════════╣\x1b[0m`);
      const lines = (result.text || result.codeSnippet || '').split('\n');
      for (const l of lines) {
        console.log(`\x1b[36m\x1b[1m║\x1b[0m ${l}`);
      }
      if (result.compilationCommand) {
        console.log(`\x1b[36m\x1b[1m╠═══════════════════════════════════════════════════════════════════╣\x1b[0m`);
        console.log(`\x1b[36m\x1b[1m║\x1b[0m \x1b[33m\x1b[1m▶ Run Command:\x1b[0m \x1b[96m${result.compilationCommand}\x1b[0m`);
      }
      console.log(`\x1b[36m\x1b[1m╚═══════════════════════════════════════════════════════════════════╝\x1b[0m\n`);

      const speechSummary = result.verbalSummary || `I've generated the ${(result.language || 'code').toUpperCase()} code for you in your terminal.`;
      broadcast({
        type: 'transcript',
        payload: {
          role: 'assistant',
          text: result.text,
          isFinal: true,
          timestamp: Date.now(),
        },
      });

      setAgentState('speaking', 'Speaking code summary');
      await systemSpeaker.speakText(speechSummary, {
        emotion: result.emotion?.emotion || 'focused',
        pitch: result.emotion?.pitch || '+0Hz',
        rate: result.emotion?.rate || '+0%',
      });
      setAgentState('passive', 'Speech completed');
      return;
    }

    // 3. Regular Voice/Text Response (System Apps/Files/Videos, Live Web Search, Multilingual Indian Languages)
    console.log(`\x1b[32m[January]\x1b[0m ${result.text}`);
    broadcast({
      type: 'transcript',
      payload: {
        role: 'assistant',
        text: result.text,
        isFinal: true,
        timestamp: Date.now(),
      },
    });

    const spokenText = result.verbalSummary || result.text;
    setAgentState('speaking', 'Speaking voice response');
    await systemSpeaker.speakText(spokenText, {
      pitch: result.emotion?.pitch,
      rate: result.emotion?.rate,
      emotion: result.emotion?.emotion,
    });
    setAgentState('passive', 'Response completed');
  } catch (err: any) {
    console.error('[Coordinator] Error in handleUnifiedPrompt:', err.message);
    const errorMsg = `Sorry, an error occurred: ${err.message}`;
    broadcast({
      type: 'transcript',
      payload: { role: 'assistant', text: errorMsg, isFinal: true, timestamp: Date.now() },
    });
    await systemSpeaker.speakText(errorMsg, { emotion: 'concerned' });
    setAgentState('passive', 'Recovered');
  }
}

systemMic.on('speech', async (text: string) => {
  const stripped = text.toLowerCase().replace(/[^\w\s]/g, '').trim();

  // If agent is sleeping, only wake phrases awaken it
  if (currentState === 'sleeping') {
    const isWake =
      stripped === config.wakePhrase ||
      ['rise', 'arise', 'wake up', 'wake'].includes(stripped) ||
      /\b(rise|arise|wake up)\b/i.test(stripped);

    if (isWake) {
      console.log(`⚡ [Coordinator] Wake word spoken during sleep: "${text}"`);
      setAgentState('listening', 'Wake word received from sleep');
      await systemSpeaker.speakText('I am awake and listening.');
      return;
    }
    console.log(`[Coordinator] Agent is sleeping. Ignoring non-wake speech: "${text}"`);
    return;
  }

  await handleUnifiedPrompt(text, 'voice');
});

systemMic.on('level', (level: number) => {
  broadcast({
    type: 'audio_level',
    level,
  });
});

// ----------------------------------------------------
// Wake Word Detector (Dual-stream worker) Event Wiring
// ----------------------------------------------------
wakeDetector.on('wake', (data) => {
  console.log(`🌟 [Coordinator] WAKE TRIGGERED ("${config.wakePhrase.toUpperCase()}") via ${data.source}!`);
  setAgentState('listening', `Wake word "${config.wakePhrase}" detected`);
  broadcast({
    type: 'system_log',
    message: `Activated: "${config.wakePhrase}" recognized (${data.source})`,
    level: 'info',
  });
});

wakeDetector.on('sleep', (data) => {
  console.log(`🌙 [Coordinator] SLEEP TRIGGERED ("${config.sleepPhrase.toUpperCase()}") via ${data.source}!`);
  systemSpeaker.stopPlayback();
  setAgentState('sleeping', `Sleep word "${config.sleepPhrase}" detected`);
  const capWake = config.wakePhrase.charAt(0).toUpperCase() + config.wakePhrase.slice(1);
  const sleepMsg = `Good night. Standing by until you say ${capWake}.`;
  systemSpeaker.speakText(sleepMsg);
  broadcast({
    type: 'system_log',
    message: `Sleep mode: "${config.sleepPhrase}" recognized (${data.source})`,
    level: 'info',
  });
});

wakeDetector.on('status', (status) => {
  if (status.message) {
    broadcast({
      type: 'system_log',
      message: `Wake Engine: ${status.message}`,
      level: 'info',
    });
  }
});

// ----------------------------------------------------
// Ambient Camera Visual Activity Monitor Wiring
// ----------------------------------------------------
let lastArrivalGreetingTimestamp = 0;
const ARRIVAL_GREETING_COOLDOWN_MS = 8 * 60 * 1000; // Minimum 8 minutes between unsolicited greetings

visualActivityMonitor.on('userArrival', async (event) => {
  console.log(`👁️ [Coordinator] USER ARRIVAL DETECTED: ${event.user}`);
  broadcast({
    type: 'system_log',
    message: `Visual Perception: ${event.user} arrived at desk`,
    level: 'info',
  });

  const now = Date.now();
  if (currentState === 'sleeping') {
    console.log('[Coordinator] User arrived, but agent is in sleep mode. Keeping silent.');
    return;
  }

  // Enforce intelligent cooldown between unsolicited proactive greetings
  if (now - lastArrivalGreetingTimestamp < ARRIVAL_GREETING_COOLDOWN_MS) {
    const elapsedSec = Math.round((now - lastArrivalGreetingTimestamp) / 1000);
    console.log(`[Coordinator] Arrival greeting suppressed by cooldown (${elapsedSec}s < 480s).`);
    return;
  }

  lastArrivalGreetingTimestamp = now;
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const greeting = `Good ${timeOfDay}, ${event.user}! Good to see you back. What are we building today?`;

  setAgentState('speaking', 'Proactive arrival greeting');
  broadcast({
    type: 'transcript',
    payload: {
      role: 'assistant',
      text: greeting,
      isFinal: true,
      timestamp: now,
    },
  });

  await systemSpeaker.speakText(greeting, { emotion: 'focused' });
  setAgentState('passive', 'Speech completed');
});

visualActivityMonitor.on('userDeparture', (event) => {
  console.log(`👋 [Coordinator] USER DEPARTURE: ${event.user}`);
  broadcast({
    type: 'system_log',
    message: `Visual Perception: ${event.user} stepped away from desk`,
    level: 'info',
  });
});

visualActivityMonitor.on('gesture', async (event) => {
  console.log(`👋 [Coordinator] Gesture recognized: ${event.type} from ${event.user}`);
  if (currentState === 'sleeping') return;

  if (event.type === 'wave') {
    const waveReply = `Hey ${event.user}, I saw you wave! What can I help you with?`;
    setAgentState('speaking', 'Wave acknowledged');
    broadcast({
      type: 'transcript',
      payload: {
        role: 'assistant',
        text: waveReply,
        isFinal: true,
        timestamp: Date.now(),
      },
    });
    await systemSpeaker.speakText(waveReply, { emotion: 'joy' });
    setAgentState('passive', 'Speech completed');
  }
});

visualActivityMonitor.on('activityUpdate', (context) => {
  broadcast({
    type: 'system_log',
    message: `Visual Perception: ${context.identifiedUser} is ${context.activity} (posture: ${context.posture}, mood: ${context.expression})`,
    level: 'info',
  });
});

// ----------------------------------------------------
// Browser WebSocket Connection Management
// ----------------------------------------------------
wss.on('connection', (ws: WebSocket) => {
  console.log('[Coordinator] New client connected to January WebSocket.');
  clients.add(ws);

  // Send current state, emotion, and readiness to newly connected client
  ws.send(JSON.stringify({
    type: 'state_change',
    state: currentState,
    reason: 'Initial connection sync',
  } satisfies ServerMessage));

  ws.send(JSON.stringify({
    type: 'emotion_update',
    payload: emotionEngine.getCurrentEmotion(),
  } satisfies ServerMessage));

  ws.send(JSON.stringify({
    type: 'system_log',
    message: `Connected to January Core. Current mode: ${currentState} | Emotion: ${emotionEngine.getCurrentEmotion().emotion}`,
    level: 'info',
  } satisfies ServerMessage));

  ws.on('message', async (raw: Buffer) => {
    try {
      const msg: ClientMessage = JSON.parse(raw.toString());

      switch (msg.type) {
        case 'cli_attach': {
          activeCliSockets.add(ws);
          updateCliMode();
          break;
        }

        case 'cli_detach': {
          activeCliSockets.delete(ws);
          updateCliMode();
          break;
        }

        case 'wake_trigger': {
          wakeDetector.triggerWake(msg.source || 'voice');
          break;
        }

        case 'sleep_trigger': {
          wakeDetector.triggerSleep(msg.source || 'voice');
          break;
        }

        case 'audio_input': {
          // Stream raw 16kHz PCM audio chunk to Gemini
          if (currentState === 'speaking') {
            // Echo cancellation: ignore mic input when agent is already speaking
            return;
          }

          if (currentState === 'passive') {
            // User started speaking while passive, auto-transition to listening
            setAgentState('listening', 'Microphone audio activity received');
          }

          if (msg.data) {
            geminiClient.sendRealtimeAudio(msg.data);
          }
          break;
        }

        case 'text_input': {
          if (!msg.text.trim()) return;
          await handleUnifiedPrompt(msg.text.trim(), 'text');
          break;
        }

        case 'set_state': {
          setAgentState(msg.state, 'Client manual override');
          break;
        }

        case 'interrupt': {
          geminiClient.emit('interrupt');
          systemSpeaker.stopPlayback();
          break;
        }

        case 'ping': {
          ws.send(JSON.stringify({ type: 'pong' } satisfies ServerMessage));
          break;
        }
      }
    } catch (err: any) {
      console.error('[Coordinator] Error handling client message:', err.message);
    }
  });

  ws.on('close', () => {
    console.log('[Coordinator] Client disconnected.');
    clients.delete(ws);
    if (activeCliSockets.has(ws)) {
      activeCliSockets.delete(ws);
      updateCliMode();
    }
  });

  ws.on('error', (err) => {
    console.error('[Coordinator] Client WebSocket error:', err.message);
    clients.delete(ws);
    if (activeCliSockets.has(ws)) {
      activeCliSockets.delete(ws);
      updateCliMode();
    }
  });
});

// Start server and connect engines
server.listen(config.port, config.host, () => {
  console.log(`
=====================================================
🚀 JANUARY AI AGENT CORE RUNNING
=====================================================
Port:             ${config.port}
Host:             ${config.host}
Gemini Model:     ${config.geminiModel}
Gemini Voice:     ${config.geminiVoice}
Claude Model:     ${config.claudeModel}
Wake Phrase:      "${config.wakePhrase.toUpperCase()}"
System Mic:       Faster-Whisper (tiny.en via sounddevice)
System Speaker:   Edge-TTS / macOS afplay
=====================================================
`);

  // Start Gemini Live connection
  geminiClient.connect();

  // Start Wake-Word listener
  wakeDetector.start();

  // Start Physical Laptop Microphone & STT Engine
  systemMic.start();

  // Ambient Camera Eyes starts in CLOSED state (LED off) until commanded with "eyes open"
  console.log('👁️ [Coordinator] Camera eyes are CLOSED by default (LED off). Say or type "eyes open" to activate 60 FPS live video tracking.');
});

// Graceful cleanup on server termination
function handleShutdown(): void {
  console.log('\n[Coordinator] Shutting down January AI Core...');
  visualActivityMonitor.closeEyes();
  systemMic.stop();
  systemSpeaker.stopPlayback();
  process.exit(0);
}

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
