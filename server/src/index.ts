import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
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
import { brainService } from './brain/index.js';
import { getWritableDataDir } from './utils/paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

validateConfig();

// Initialize January Brain SQLite Memory Unit
brainService.initialize().catch((err) => {
  console.error('[Coordinator] Failed to initialize Brain database:', err.message);
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
  const brainStats = brainService.getStats();
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
    brain: {
      activeSessionId: brainService.getActiveSessionId(),
      totalSessions: brainStats.totalSessions,
      totalMessages: brainStats.totalMessages,
      totalArtifacts: brainStats.totalArtifacts,
    },
  });
});

app.get('/api/profile', (req, res) => {
  res.json(geminiService.getLearnedProfileEngine().getProfile());
});

// ==========================================
// Brain Persistent Memory Unit Endpoints
// ==========================================

// Brain Statistics
app.get('/api/brain/stats', (req, res) => {
  try {
    const stats = brainService.getStats();
    res.json({ status: 'ok', stats });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// List Chat Sessions
app.get('/api/brain/sessions', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;
    const search = req.query.search as string | undefined;
    const archived = req.query.archived !== undefined ? req.query.archived === 'true' : undefined;

    const sessions = brainService.listSessions({ limit, offset, search, archived });
    res.json({ status: 'ok', sessions, activeSessionId: brainService.getActiveSessionId() });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Create Chat Session
app.post('/api/brain/sessions', (req, res) => {
  try {
    const { title, activeModel, summary, metadata } = req.body || {};
    const session = brainService.createSession({ title, activeModel, summary, metadata });
    res.json({ status: 'ok', session });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Get Specific Session
app.get('/api/brain/sessions/:id', (req, res) => {
  try {
    const session = brainService.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ status: 'error', message: 'Session not found' });
    }
    res.json({ status: 'ok', session });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Update Session (rename, pin, archive)
app.patch('/api/brain/sessions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { title, isPinned, isArchived } = req.body || {};
    if (title !== undefined) {
      brainService.renameSession(id, title);
    }
    if (isPinned !== undefined) {
      brainService.togglePinSession(id, isPinned);
    }
    if (isArchived !== undefined) {
      brainService.archiveSession(id, isArchived);
    }
    const session = brainService.getSession(id);
    res.json({ status: 'ok', session });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Delete Single Session from DB
app.delete('/api/brain/sessions/:id', (req, res) => {
  try {
    const success = brainService.deleteSession(req.params.id);
    res.json({ status: 'ok', success });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.delete('/api/sessions/:id', (req, res) => {
  try {
    const success = brainService.deleteSession(req.params.id);
    res.json({ status: 'ok', success });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Clear All Sessions, Messages, and Artifacts from DB
app.post('/api/brain/clear-all', (req, res) => {
  try {
    brainService.clearAll();
    res.json({ status: 'ok', message: 'All conversations and messages cleared from database' });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Resume Past Session - Reopens discussion days later with full context
app.post('/api/brain/sessions/:id/resume', (req, res) => {
  try {
    const maxMessages = req.body?.maxMessages ? parseInt(req.body.maxMessages) : 50;
    const context = brainService.resumeSession(req.params.id, maxMessages);
    res.json({ status: 'ok', context });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Get Conversation Context for Session (Messages + Artifacts + LLM history)
app.get('/api/brain/sessions/:id/context', (req, res) => {
  try {
    const maxMessages = req.query.maxMessages ? parseInt(req.query.maxMessages as string) : 40;
    const context = brainService.getConversationContext(req.params.id, maxMessages);
    if (!context) {
      return res.status(404).json({ status: 'error', message: 'Session not found' });
    }
    res.json({ status: 'ok', context });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Get Messages for a Session
app.get('/api/brain/sessions/:id/messages', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const messages = brainService.getMessages(req.params.id, limit);
    res.json({ status: 'ok', messages });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Add Message to a Session
app.post('/api/brain/sessions/:id/messages', (req, res) => {
  try {
    const { role, content, verbalSummary, emotion, modelName, tokensUsed, metadata, artifacts } = req.body || {};
    if (!content) {
      return res.status(400).json({ status: 'error', message: 'Message content is required' });
    }
    const message = role === 'assistant'
      ? brainService.recordAssistantMessage(content, {
          sessionId: req.params.id,
          verbalSummary,
          emotion,
          modelName,
          tokensUsed,
          metadata,
          artifacts,
        })
      : brainService.recordUserMessage(content, {
          sessionId: req.params.id,
          metadata,
        });
    res.json({ status: 'ok', message });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Get Artifacts for a Session (Images, Code, 3D Models)
app.get('/api/brain/sessions/:id/artifacts', (req, res) => {
  try {
    const type = req.query.type as any;
    const artifacts = brainService.listArtifactsForSession(req.params.id, type);
    res.json({ status: 'ok', artifacts });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Save an Artifact linked to a Session
app.post('/api/brain/sessions/:id/artifacts', (req, res) => {
  try {
    const { type, name, filePath, content, metadata } = req.body || {};
    let artifact;
    switch (type) {
      case 'image_uploaded':
        artifact = brainService.recordUploadedImage(name, filePath, { sessionId: req.params.id, metadata });
        break;
      case 'image_created':
        artifact = brainService.recordCreatedImage(name, filePath, metadata?.prompt, { sessionId: req.params.id, metadata });
        break;
      case 'code_created':
        artifact = brainService.recordCreatedCode(name, content || '', metadata?.language || 'python', { sessionId: req.params.id, filePath, metadata });
        break;
      case '3d_model_created':
        artifact = brainService.recordCreated3DModel(name, filePath, metadata?.format || 'blend', metadata?.prompt, { sessionId: req.params.id, metadata });
        break;
      case '3d_model_uploaded':
        artifact = brainService.recordUploaded3DModel(name, filePath, metadata?.format || 'cad', { sessionId: req.params.id, metadata });
        break;
      default:
        artifact = brainService.recordUploadedImage(name, filePath, { sessionId: req.params.id, metadata });
    }
    res.json({ status: 'ok', artifact });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// List Recent Artifacts Across All Sessions
app.get('/api/brain/artifacts', (req, res) => {
  try {
    const type = req.query.type as any;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const artifacts = brainService.listRecentArtifacts(type, limit);
    res.json({ status: 'ok', artifacts });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Get Single Artifact
app.get('/api/brain/artifacts/:id', (req, res) => {
  try {
    const artifact = brainService.getArtifact(req.params.id);
    if (!artifact) {
      return res.status(404).json({ status: 'error', message: 'Artifact not found' });
    }
    res.json({ status: 'ok', artifact });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Delete Single Artifact
app.delete('/api/brain/artifacts/:id', (req, res) => {
  try {
    const success = brainService.deleteArtifact(req.params.id);
    res.json({ status: 'ok', success });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// File Attachment & Upload Endpoint (supports PDF, DOCX, TXT, Images, CAD/3D, Code)
app.post('/api/brain/upload', (req, res) => {
  try {
    const { name, mimeType, data, sessionId } = req.body || {};
    if (!name || !data) {
      return res.status(400).json({ status: 'error', message: 'Missing file name or data' });
    }

    const uploadsDir = getWritableDataDir('uploads');

    const safeName = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueName = `${Date.now()}_${safeName}`;
    const targetPath = path.join(uploadsDir, uniqueName);

    // Data can be base64 (data URL or raw base64) or string
    let buffer: Buffer;
    if (typeof data === 'string' && data.includes(';base64,')) {
      buffer = Buffer.from(data.split(';base64,')[1], 'base64');
    } else if (typeof data === 'string') {
      try {
        buffer = Buffer.from(data, 'base64');
      } catch {
        buffer = Buffer.from(data, 'utf-8');
      }
    } else {
      buffer = Buffer.from(data);
    }

    fs.writeFileSync(targetPath, buffer);

    const targetSessionId = sessionId || brainService.getActiveSessionId();
    let type: any = 'file_uploaded';
    if (mimeType?.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(name)) {
      type = 'image_uploaded';
    } else if (/\.(blend|obj|glb|gltf|fbx|stl|step|stp)$/i.test(name)) {
      type = '3d_model_uploaded';
    } else if (/\.(ts|js|py|cpp|c|h|rs|go|html|css|json|md|txt)$/i.test(name)) {
      type = 'code_created';
    }

    const artifact = brainService.getArtifactManager().saveArtifact({
      sessionId: targetSessionId,
      type,
      name,
      filePath: targetPath,
      fileSize: buffer.length,
      mimeType: mimeType || 'application/octet-stream',
      metadata: { originalName: name, uploadedAt: Date.now() },
    });

    res.json({
      status: 'ok',
      artifact,
      file: {
        id: artifact.id,
        name,
        size: buffer.length,
        path: targetPath,
        mimeType: mimeType || 'application/octet-stream',
      },
    });
  } catch (err: any) {
    console.error('[Brain Upload Error]', err);
    res.status(500).json({ status: 'error', error: err.message });
  }
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

app.get('/api/camera/status', (req, res) => {
  res.json({
    status: 'ok',
    ...visualActivityMonitor.getEyesStatus(),
    context: visualActivityMonitor.getCurrentContext(),
  });
});

app.get('/api/camera/frame', (req, res) => {
  const context = visualActivityMonitor.getCurrentContext();
  if (context.lastSnapshotPath && fs.existsSync(context.lastSnapshotPath)) {
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    return fs.createReadStream(context.lastSnapshotPath).pipe(res);
  }
  res.status(404).json({ error: 'No camera frame available' });
});

emotionEngine.on('emotionChange', (emotion) => {
  broadcast({ type: 'emotion_update', payload: emotion });
});

// Track connected browser clients
const clients = new Set<WebSocket>();
let isSpeakerMuted = false;
let isMicMuted = false;
let micUnmuteTimeout: NodeJS.Timeout | null = null;

// Stop Speech REST endpoint
app.post('/api/voice/stop', (req, res) => {
  geminiClient.emit('interrupt');
  systemSpeaker.stopPlayback();
  setAgentState('passive', 'User stopped speech via UI');
  broadcast({ type: 'interrupt' });
  broadcast({ type: 'state_change', state: 'passive', reason: 'User stopped speech via UI' });
  res.json({ status: 'ok', stopped: true });
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
  // If ElevenLabs or Edge-TTS is configured, suppress Gemini Live raw audio to avoid interfering voice packs and dual responses
  if (config.useElevenLabs !== false || config.useEdgeTts) {
    return;
  }
  setAgentState('speaking', 'Gemini speaking audio stream');
  broadcast({
    type: 'audio_output',
    data: pcmChunkBase64,
    mimeType,
  });
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
  systemSpeaker.stopPlayback();
  setAgentState('passive', 'User interrupted speech');
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
// System Speaker Event Handlers -> Frontend WebSocket Streaming
// ----------------------------------------------------
systemSpeaker.on('audio_output', (payload: { data: string; mimeType: string; text?: string }) => {
  broadcast({
    type: 'audio_output',
    data: payload.data,
    mimeType: payload.mimeType || 'audio/mpeg',
  });
});

systemSpeaker.on('browser_speak', (payload: { text: string; emotion?: string }) => {
  broadcast({
    type: 'browser_speak',
    text: payload.text,
    emotion: payload.emotion,
  });
});

systemSpeaker.on('start', () => {
  if (micUnmuteTimeout) {
    clearTimeout(micUnmuteTimeout);
    micUnmuteTimeout = null;
  }
  systemMic.setMute(true);
});

systemSpeaker.on('end', () => {
  if (micUnmuteTimeout) {
    clearTimeout(micUnmuteTimeout);
  }
  // Debounce unmute by 700ms to allow acoustic decay in the room, and only unmute if not muted by UI
  micUnmuteTimeout = setTimeout(() => {
    micUnmuteTimeout = null;
    if (!isMicMuted) {
      systemMic.setMute(false);
    }
  }, 700);
});

systemMic.on('ready', () => {
  broadcast({
    type: 'system_log',
    message: 'System physical microphone & Faster-Whisper ready',
    level: 'info',
  });
});

systemMic.on('wake', (data) => {
  setAgentState('listening', `Physical microphone wake phrase recognized`);
  broadcast({
    type: 'system_log',
    message: `Physical Mic: "${config.wakePhrase}" recognized`,
    level: 'info',
  });
});

systemMic.on('sleep', (data) => {
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
});

// Wire WakeDetector events
wakeDetector.on('wake', (data) => {
  setAgentState('listening', 'Wake trigger received (Rise)');
  systemMic.setMute(false);
  const wakeMsg = 'I am awake and listening. How can I help you?';
  broadcast({
    type: 'transcript',
    payload: {
      role: 'assistant',
      text: wakeMsg,
      isFinal: true,
      timestamp: Date.now(),
    },
  });
  setAgentState('speaking', 'Wake confirmation speech');
  systemSpeaker.speakText(wakeMsg, { emotion: 'joy' }).then(() => {
    setAgentState('listening', 'Listening for prompt');
  });
});

wakeDetector.on('sleep', (data) => {
  systemSpeaker.stopPlayback();
  setAgentState('sleeping', 'Sleep trigger received (Good Night)');
  systemMic.setMute(true);
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
});

visualActivityMonitor.on('eyesStateChange', ({ isEyesOpen, fps }) => {
  broadcast({ type: 'camera_state', isEyesOpen, fps });
});

systemMic.on('camera_wake', async (data) => {
  visualActivityMonitor.openEyes(60);
  const msg = 'Eyes open. Real-time 60 FPS camera vision activated.';
  broadcast({
    type: 'transcript',
    payload: { role: 'assistant', text: msg, isFinal: true, timestamp: Date.now() },
  });
  setAgentState('speaking', 'Camera eyes opened');
  await systemSpeaker.speakText(msg, { emotion: 'joy' });
  setAgentState('passive', 'Speech completed');
});

systemMic.on('camera_sleep', async (data) => {
  visualActivityMonitor.closeEyes();
  const msg = 'Eyes closed. Camera monitoring paused and hardware turned off.';
  broadcast({
    type: 'transcript',
    payload: { role: 'assistant', text: msg, isFinal: true, timestamp: Date.now() },
  });
  setAgentState('speaking', 'Camera eyes closed');
  await systemSpeaker.speakText(msg, { emotion: 'calm' });
  setAgentState('passive', 'Speech completed');
});

async function handleUnifiedPrompt(text: string, source: 'voice' | 'text' = 'voice', sessionId?: string): Promise<void> {
  const clean = text.trim();
  if (!clean) return;

  // Interrupt previous audio immediately on fresh input
  systemSpeaker.stopPlayback();


  console.log(`\n🎙️ [Coordinator] Processing ${source.toUpperCase()} prompt: "${clean}"`);
  broadcast({
    type: 'transcript',
    payload: {
      role: 'user',
      text: clean,
      source,
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

  // Persist user prompt into SQLite Brain memory under the active session
  brainService.recordUserMessage(clean, { sessionId, metadata: { source } });

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
      console.log(`[Coordinator] 💻 Generated ${(result.language || 'code').toUpperCase()} via ${result.modelUsed || 'Coding Engine'} (delivered to UI)`);

      const speechSummary = result.verbalSummary || `I've generated the ${(result.language || 'code').toUpperCase()} code for you on screen.`;
      
      // Persist assistant code message and code artifact into Brain
      brainService.recordAssistantMessage(result.text, {
        sessionId,
        verbalSummary: speechSummary,
        emotion: result.emotion?.emotion,
        modelName: result.modelUsed || 'Coding Engine',
        artifacts: [
          {
            type: 'code_created',
            name: `${result.language || 'code'}_script_${Date.now()}`,
            content: result.text,
            metadata: {
              language: result.language,
              compilationCommand: result.compilationCommand,
              model: result.modelUsed,
            },
          },
        ],
      });

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

    // 3. Regular Voice/Text Response (System Apps/Files/Videos, Live Web Search, 3D Models, Multilingual)
    console.log(`\x1b[32m[January]\x1b[0m ${result.text}`);

    // Check if 3D model creation tool was executed
    const created3DTool = result.toolCalls?.find(
      (tc: any) => tc.name === 'create_3d_model' || tc.name === 'convert_floorplan_to_3d'
    );
    const artifacts: any[] = [];
    if (created3DTool && created3DTool.result) {
      const res3d = created3DTool.result;
      artifacts.push({
        type: '3d_model_created',
        name: res3d.modelName || 'january_3d_model',
        filePath: res3d.blendFilePath || res3d.glbFilePath || res3d.objFilePath,
        metadata: {
          blendFilePath: res3d.blendFilePath,
          objFilePath: res3d.objFilePath,
          glbFilePath: res3d.glbFilePath,
          verbalSummary: res3d.verbalSummary,
        },
      });
    }

    // Persist assistant message and any 3D/multimodal artifacts into Brain
    brainService.recordAssistantMessage(result.text, {
      sessionId,
      verbalSummary: result.verbalSummary || result.text,
      emotion: result.emotion?.emotion,
      modelName: result.modelUsed || 'Gemini',
      artifacts: artifacts.length > 0 ? artifacts : undefined,
    });

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
    type: 'camera_state',
    isEyesOpen: visualActivityMonitor.getEyesStatus().isEyesOpen,
    fps: visualActivityMonitor.getEyesStatus().fps,
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
          await handleUnifiedPrompt(msg.text.trim(), 'text', msg.sessionId);
          break;
        }

        case 'set_camera_eyes': {
          if (msg.open) {
            visualActivityMonitor.openEyes(msg.fps || 60);
          } else {
            visualActivityMonitor.closeEyes();
          }
          break;
        }

        case 'set_state': {
          setAgentState(msg.state, 'Client manual override');
          break;
        }

        case 'interrupt': {
          geminiClient.emit('interrupt');
          systemSpeaker.stopPlayback();
          setAgentState('passive', 'User stopped speech via UI');
          broadcast({ type: 'interrupt' });
          broadcast({ type: 'state_change', state: 'passive', reason: 'User stopped speech via UI' });
          break;
        }

        case 'set_mic_mute': {
          isMicMuted = !!msg.muted;
          systemMic.setMute(isMicMuted);
          try {
            const vol = isMicMuted ? 0 : 75;
            exec(`osascript -e "set volume input volume ${vol}"`);
          } catch {}
          broadcast({
            type: 'system_log',
            message: `Hardware microphone ${isMicMuted ? 'muted' : 'unmuted'} by UI`,
            level: 'info',
          });
          break;
        }

        case 'set_speaker_mute': {
          isSpeakerMuted = !!msg.muted;
          systemSpeaker.setMute(isSpeakerMuted);
          if (isSpeakerMuted) {
            systemSpeaker.stopPlayback();
          }
          try {
            exec(`osascript -e "set volume output muted ${isSpeakerMuted}"`);
          } catch {}
          broadcast({
            type: 'system_log',
            message: `Speaker output ${isSpeakerMuted ? 'muted' : 'unmuted'} by UI`,
            level: 'info',
          });
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
    clients.delete(ws);
  });

  ws.on('error', (err) => {
    clients.delete(ws);
  });
});


// Start server and connect engines
server.listen(config.port, config.host, () => {
  console.log(`⚡ [January Core] Server running on http://${config.host}:${config.port}`);

  // Start Gemini Live connection
  geminiClient.connect();

  // Initialize Wake-Word engine
  wakeDetector.start();
});


// Graceful cleanup on server termination
function handleShutdown(): void {
  console.log('\n[Coordinator] Shutting down January AI Core...');
  visualActivityMonitor.closeEyes();
  systemSpeaker.stopPlayback();
  process.exit(0);
}

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
