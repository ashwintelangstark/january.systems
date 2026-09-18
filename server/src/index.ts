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
import { AgentState, ClientMessage, ServerMessage } from './types.js';

validateConfig();

const app = express();
app.use(cors());
app.use(express.json());

// Basic health & status endpoint
app.get('/api/health', (req, res) => {
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
  });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// State & Core Singletons
let currentState: AgentState = 'passive';
const geminiClient = new GeminiLiveClient();
const wakeDetector = new WakeDetector();
const systemSpeaker = new SystemSpeaker();
const systemMic = new SystemMicrophone();
const emotionEngine = new EmotionEngine();

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
  const sleepMsg = 'Good night. Standing by until you say Arise.';
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

systemMic.on('speech', (text: string) => {
  const lower = text.toLowerCase().trim();
  if (lower === 'good night' || lower === 'goodnight' || lower === 'go to sleep' || lower === 'sleep') {
    console.log(`🌙 [Coordinator] Sleep phrase spoken: "${text}"`);
    systemSpeaker.stopPlayback();
    setAgentState('sleeping', 'Sleep phrase spoken');
    const sleepMsg = 'Good night. Standing by until you say Arise.';
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
    return;
  }

  if (currentState === 'sleeping') {
    if (lower.includes('arise') || lower.includes('wake')) {
      console.log(`⚡ [Coordinator] Wake word spoken during sleep: "${text}"`);
      setAgentState('listening', 'Wake word received from sleep');
      systemSpeaker.speakText('I am awake and listening.');
      return;
    }
    console.log(`[Coordinator] Agent is sleeping. Ignoring non-wake speech: "${text}"`);
    return;
  }

  console.log(`🗣️ [Coordinator] Spoken prompt received from system microphone: "${text}"`);
  setAgentState('working', 'Processing voice prompt');
  geminiClient.sendClientText(text);
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
  const sleepMsg = 'Good night. Standing by until you say Arise.';
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
          console.log(`[Coordinator] Received text prompt from client: "${msg.text}"`);

          // Analyze emotion in real-time
          emotionEngine.analyzeText(msg.text.trim()).catch(() => {});

          // Seamlessly interweave text into Gemini Live conversation
          setAgentState('working', 'Processing text prompt');
          geminiClient.sendClientText(msg.text.trim());
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
});
