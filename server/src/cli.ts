#!/usr/bin/env node
/**
 * January AI - Dual-Section Interactive Terminal CLI
 * Powered by Google Gemini API & Anthropic Claude (with automatic Gemini fallback)
 * Specialized in Python, C, and C++ coding, real-time live internet, and multilingual speech.
 * Direct ElevenLabs neural audio playback via host speakers.
 */

import readline from 'readline';
import { WebSocket } from 'ws';
import { SystemSpeaker } from './audio/systemSpeaker.js';
import { GeminiService } from './gemini/geminiService.js';
import { executeTool } from './tools/index.js';
import { config, validateConfig } from './config.js';
import { ClientMessage } from './types.js';
import { brainService } from './brain/index.js';

validateConfig();

// Initialize January Brain SQLite memory unit
brainService.initialize().catch(() => {});

const systemSpeaker = new SystemSpeaker();
const geminiService = new GeminiService();

// Connect to background daemon to coordinate background mic pausing/resuming if running
let daemonSocket: WebSocket | null = null;
let isDaemonConnected = false;

function connectToDaemon(): void {
  try {
    const ws = new WebSocket(`ws://${config.host}:${config.port}`);
    daemonSocket = ws;

    ws.on('open', () => {
      isDaemonConnected = true;
      ws.send(JSON.stringify({ type: 'cli_attach' } satisfies ClientMessage));
    });

    ws.on('close', () => {
      isDaemonConnected = false;
      daemonSocket = null;
    });

    ws.on('error', () => {
      isDaemonConnected = false;
    });
  } catch {
    isDaemonConnected = false;
  }
}

connectToDaemon();

function detachFromDaemon(): void {
  if (daemonSocket && daemonSocket.readyState === WebSocket.OPEN) {
    try {
      daemonSocket.send(JSON.stringify({ type: 'cli_detach' } satisfies ClientMessage));
      daemonSocket.close();
    } catch {}
  }
  try {
    fetch(`http://${config.host}:${config.port}/api/cli/detach`, { method: 'POST' }).catch(() => {});
  } catch {}
}

// Clean exit handlers
function handleExitCleanly(): void {
  detachFromDaemon();
  systemSpeaker.stopPlayback();
}

process.on('SIGINT', () => {
  handleExitCleanly();
  process.exit(0);
});

process.on('SIGTERM', () => {
  handleExitCleanly();
  process.exit(0);
});

process.on('beforeExit', () => {
  handleExitCleanly();
});

// ANSI color styling utilities
const cyan = (text: string) => `\x1b[36m${text}\x1b[0m`;
const brightCyan = (text: string) => `\x1b[96m${text}\x1b[0m`;
const green = (text: string) => `\x1b[32m${text}\x1b[0m`;
const purple = (text: string) => `\x1b[35m${text}\x1b[0m`;
const yellow = (text: string) => `\x1b[33m${text}\x1b[0m`;
const blue = (text: string) => `\x1b[34m${text}\x1b[0m`;
const bold = (text: string) => `\x1b[1m${text}\x1b[0m`;
const dim = (text: string) => `\x1b[2m${text}\x1b[0m`;
const white = (text: string) => `\x1b[37m${text}\x1b[0m`;

console.log(`
${cyan(bold('╔═══════════════════════════════════════════════════════════════════╗'))}
${cyan(bold('║               ⚡ JANUARY AI — DUAL INTERACTIVE CLI                ║'))}
${cyan(bold('╠═══════════════════════════════════════════════════════════════════╣'))}
${cyan(bold('║'))} ${brightCyan(bold(' [ME]      '))} ${white('Ask questions, Indian languages, or Python/C/C++ code  ')} ${cyan(bold('║'))}
${cyan(bold('║'))} ${purple(bold(' [JANUARY] '))} ${white('Gemini & Claude Core with ElevenLabs speaker voice     ')} ${cyan(bold('║'))}
${cyan(bold('╠═══════════════════════════════════════════════════════════════════╣'))}
${cyan(bold('║'))} ${dim('Voice Engine:')}    ElevenLabs (${config.elevenlabsVoiceId || 'OZ0L6eISlOejga3XjDFt'}) -> Laptop Speakers ${cyan(bold('║'))}
${cyan(bold('║'))} ${dim('Coding Engine:')}   Python, C, and C++ (Claude with instant Gemini fallback)${cyan(bold('║'))}
${cyan(bold('║'))} ${dim('Brain Database:')}   SQLite Persistent History, Code, Images & 3D Models ${cyan(bold('║'))}
${cyan(bold('║'))} ${dim('Ambient Eyes:')}    Continuous Camera & Face/Posture Monitoring (Local Edge)${cyan(bold('║'))}
${cyan(bold('║'))} ${dim('Adaptive Memory:')} Learned Habits, Daily Rhythms & Personalized Profile  ${cyan(bold('║'))}
${cyan(bold('║'))} ${dim('Chat Commands:')}    ${yellow('chats')}${dim(',')} ${yellow('chat <id>')}${dim(',')} ${yellow('newchat')}${dim(',')} ${yellow('artifacts')}${dim(',')} ${yellow('brain')}         ${cyan(bold('║'))}
${cyan(bold('║'))} ${dim('System Commands:')}  ${yellow('memory')}${dim(',')} ${yellow('eyes')}${dim(',')} ${yellow('clear')}${dim(',')} ${yellow('help')}${dim(',')} ${yellow('exit')}                  ${cyan(bold('║'))}
${cyan(bold('╚═══════════════════════════════════════════════════════════════════╝'))}
`);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: `\n${brightCyan(bold('┌── [ME] ────────────────────────────────────────────────────────────'))}\n${brightCyan(bold('│ '))} `,
});

let isClosed = false;
let isSleeping = false;

rl.on('close', () => {
  isClosed = true;
});

function promptUser() {
  if (!isClosed) {
    try {
      rl.prompt();
    } catch {}
  }
}

async function handleUserInput(text: string) {
  const clean = text.trim();
  if (!clean) {
    promptUser();
    return;
  }

  const lower = clean.toLowerCase();
  const stripped = lower.replace(/[^\w\s]/g, '').trim();

  // CLI Control Commands
  if (stripped === 'exit' || stripped === 'quit') {
    console.log(dim('\nClosing January CLI session.\n'));
    handleExitCleanly();
    process.exit(0);
  }

  if (stripped === 'clear' || stripped === 'cls') {
    console.clear();
    promptUser();
    return;
  }

  // Sleep Word Command
  const isSleepCommand =
    stripped === config.sleepPhrase ||
    ['good night', 'goodnight', 'go to sleep', 'sleep'].includes(stripped) ||
    (/\b(good night|goodnight|go to sleep)\b/i.test(stripped) && stripped.length < 25);

  if (isSleepCommand) {
    isSleeping = true;
    console.log(`\n${purple(bold('┌── [JANUARY : SLEEP MODE] ──────────────────────────────────────────'))}`);
    console.log(`│ ${purple('🌙 Good night. Standing by in sleep mode.')}`);
    console.log(`│ ${dim(`Say or type "${config.wakePhrase}" to wake January back up.`)}`);
    console.log(`${purple(bold('└────────────────────────────────────────────────────────────────────'))}`);
    promptUser();
    return;
  }

  // Wake Word Command
  const isWakeCommand =
    stripped === config.wakePhrase ||
    ['rise', 'arise', 'a rise', 'wake up', 'wake'].includes(stripped) ||
    (/\b(rise|arise|wake up)\b/i.test(stripped) && stripped.length < 25);

  if (isWakeCommand) {
    isSleeping = false;
    const capWake = config.wakePhrase.charAt(0).toUpperCase() + config.wakePhrase.slice(1);
    console.log(`\n${purple(bold('┌── [JANUARY : ACTIVE] ──────────────────────────────────────────────'))}`);
    console.log(`│ ${green(`⚡ ${capWake} acknowledged. January is awake and listening!`)}`);
    console.log(`${purple(bold('└────────────────────────────────────────────────────────────────────'))}`);
    promptUser();
    return;
  }

  if (isSleeping) {
    console.log(`\n${purple(bold('┌── [JANUARY : SLEEPING] ────────────────────────────────────────────'))}`);
    console.log(`│ ${dim('January is currently in sleep mode. Say or type')} ${yellow(config.wakePhrase)} ${dim('to wake me.')}`);
    console.log(`${purple(bold('└────────────────────────────────────────────────────────────────────'))}`);
    promptUser();
    return;
  }

  // Camera Eyes Wake Command
  const isCamWakeCommand =
    stripped === config.cameraWakePhrase ||
    ['eyes open', 'open eyes', 'camera open', 'open camera', 'eyes on', 'turn on camera', 'enable camera'].includes(stripped) ||
    (/\b(eyes open|open eyes|camera open|open camera|eyes on|turn on camera|enable camera)\b/i.test(stripped) && stripped.length < 35);

  if (isCamWakeCommand) {
    try {
      await fetch(`http://${config.host}:${config.port}/api/camera/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'open', fps: 60 }),
      });
    } catch {}
    console.log(`\n${yellow(bold('┌── [JANUARY : CAMERA CORTEX] ───────────────────────────────────────'))}`);
    console.log(`│ ${green('👁️ EYES OPEN:')} ${white('Continuous 60 FPS hardware video stream activated.')}`);
    console.log(`│ ${dim('Real-time vision tracking is active.')}`);
    console.log(`${yellow(bold('└────────────────────────────────────────────────────────────────────'))}`);
    promptUser();
    return;
  }

  // Camera Eyes Sleep Command
  const isCamSleepCommand =
    stripped === config.cameraSleepPhrase ||
    ['eyes closed', 'close eyes', 'camera closed', 'close camera', 'eyes off', 'turn off camera', 'disable camera'].includes(stripped) ||
    (/\b(eyes closed|close eyes|camera closed|close camera|eyes off|turn off camera|disable camera)\b/i.test(stripped) && stripped.length < 35);

  if (isCamSleepCommand) {
    try {
      await fetch(`http://${config.host}:${config.port}/api/camera/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close' }),
      });
    } catch {}
    console.log(`\n${yellow(bold('┌── [JANUARY : CAMERA CORTEX] ───────────────────────────────────────'))}`);
    console.log(`│ ${purple('🌙 EYES CLOSED:')} ${white('Camera hardware process terminated (LED off, 0% CPU).')}`);
    console.log(`│ ${dim('Camera eyes will remain completely off until commanded to open.')}`);
    console.log(`${yellow(bold('└────────────────────────────────────────────────────────────────────'))}`);
    promptUser();
    return;
  }

  // ----------------------------------------------------
  // Brain Memory Unit: Chat Sessions & Continuity
  // ----------------------------------------------------
  if (lower === 'chats' || lower === 'sessions') {
    const sessions = brainService.listSessions({ limit: 12 });
    const activeId = brainService.getActiveSessionId();
    console.log(`\n${purple(bold('┌── [JANUARY BRAIN : SAVED CONVERSATION THREADS] ───────────────────'))}`);
    if (sessions.length === 0) {
      console.log(`│ ${dim('No saved conversations found yet. Start chatting to auto-save!')}`);
    } else {
      for (const s of sessions) {
        const isActive = s.id === activeId;
        const marker = isActive ? green('● [ACTIVE]') : dim('○         ');
        const dateStr = new Date(s.updatedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        const titleTrim = (s.title.length > 32 ? s.title.slice(0, 30) + '..' : s.title).padEnd(32);
        console.log(`│ ${marker} ${bold(titleTrim)} ${cyan(s.id.slice(0, 8))} ${dim(`(${s.messageCount || 0} msgs, ${s.artifactCount || 0} files) • ${dateStr}`)}`);
      }
    }
    console.log(`│`);
    console.log(`│ ${dim('To resume any past chat days later, type:')} ${yellow('chat <id>')} ${dim('or')} ${yellow('resume <id>')}`);
    console.log(`│ ${dim('To start a clean new chat thread, type:')}   ${yellow('newchat')}`);
    console.log(`${purple(bold('└────────────────────────────────────────────────────────────────────'))}`);
    promptUser();
    return;
  }

  const chatMatch = lower.match(/^(?:chat|session|resume)\s+([a-zA-Z0-9_-]+)/i);
  if (chatMatch) {
    const query = chatMatch[1].trim();
    const allSessions = brainService.listSessions();
    const matched = allSessions.find(
      (s) => s.id === query || s.id.startsWith(query) || s.title.toLowerCase().includes(query.toLowerCase())
    );
    if (!matched) {
      console.log(`\n${yellow(`⚠ Conversation "${query}" not found. Type "chats" to view all saved sessions.`)}`);
    } else {
      const context = brainService.resumeSession(matched.id);
      console.log(`\n${green(bold('┌── [JANUARY BRAIN : RESUMED PAST CONVERSATION] ─────────────────────'))}`);
      console.log(`│ ${bold('Session Title:')} ${brightCyan(context.session.title)} ${dim(`(ID: ${context.session.id})`)}`);
      console.log(`│ ${bold('Messages Saved:')} ${yellow(context.messages.length.toString())} | ${bold('Files/Artifacts Saved:')} ${yellow(context.artifacts.length.toString())}`);
      console.log(`│`);
      console.log(`│ ${dim('--- Recent Discussion History ---')}`);
      const recent = context.messages.slice(-5);
      for (const m of recent) {
        const prefix = m.role === 'user' ? brightCyan('[ME]:') : purple('[JANUARY]:');
        const snippet = m.content.replace(/\n/g, ' ').slice(0, 75);
        console.log(`│ ${prefix} ${snippet}${m.content.length > 75 ? '...' : ''}`);
      }
      if (context.artifacts.length > 0) {
        console.log(`│`);
        console.log(`│ ${dim('--- Associated Files & Artifacts ---')}`);
        for (const a of context.artifacts) {
          console.log(`│ ${yellow('•')} ${bold(a.name)} ${dim(`(${a.type})`)}: ${white(a.filePath || a.content?.slice(0, 40) || '')}`);
        }
      }
      console.log(`${green(bold('└────────────────────────────────────────────────────────────────────'))}`);
    }
    promptUser();
    return;
  }

  if (lower === 'newchat' || lower === 'new session' || lower === 'clear chat') {
    const newSession = brainService.createSession({ title: 'New Conversation' });
    console.log(`\n${green(bold('┌── [JANUARY BRAIN : NEW CONVERSATION INITIALIZED] ──────────────────'))}`);
    console.log(`│ ${green('✔')} Created fresh conversation thread with zero context contamination.`);
    console.log(`│ ${dim('Thread ID:')} ${cyan(newSession.id)}`);
    console.log(`${green(bold('└────────────────────────────────────────────────────────────────────'))}`);
    promptUser();
    return;
  }

  if (lower === 'artifacts' || lower === 'files' || lower === 'assets') {
    const artifacts = brainService.listRecentArtifacts(undefined, 10);
    console.log(`\n${yellow(bold('┌── [JANUARY BRAIN : RECENT ARTIFACTS & GENERATED FILES] ────────────'))}`);
    if (artifacts.length === 0) {
      console.log(`│ ${dim('No generated files or artifacts in Brain yet.')}`);
    } else {
      for (const a of artifacts) {
        const dateStr = new Date(a.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        console.log(`│ ${brightCyan(bold(a.name.padEnd(28)))} ${yellow(`[${a.type}]`)} ${dim(dateStr)}`);
        if (a.filePath) console.log(`│   ${dim('Location:')} ${white(a.filePath)}`);
      }
    }
    console.log(`${yellow(bold('└────────────────────────────────────────────────────────────────────'))}`);
    promptUser();
    return;
  }

  if (lower === 'brain' || lower === 'stats' || lower === 'db') {
    const stats = brainService.getStats();
    console.log(`\n${purple(bold('┌── [JANUARY BRAIN : PERSISTENT DATABASE HEALTH] ────────────────────'))}`);
    console.log(`│ ${bold('Database Engine:')}  ${green('SQLite 3.x with WAL (Write-Ahead Logging)')}`);
    console.log(`│ ${bold('Total Sessions:')}   ${yellow(stats.totalSessions.toString())} saved conversation threads`);
    console.log(`│ ${bold('Total Messages:')}   ${yellow(stats.totalMessages.toString())} persistent dialogue turns`);
    console.log(`│ ${bold('Total Artifacts:')}  ${yellow(stats.totalArtifacts.toString())} files (Code, Images & 3D models)`);
    console.log(`│ ${bold('Storage Path:')}     ${dim(stats.dbPath)}`);
    console.log(`${purple(bold('└────────────────────────────────────────────────────────────────────'))}`);
    promptUser();
    return;
  }

  // ----------------------------------------------------
  // Cognitive & System Status Checks
  // ----------------------------------------------------
  if (lower === 'memory' || lower === 'profile' || lower === 'habits') {
    const profile = geminiService.getLearnedProfileEngine().getProfile();
    const codingLangs = Object.keys(profile.preferredCodingLanguages).join(', ') || 'Python, C, C++';
    const spokenLangs = Object.keys(profile.preferredSpokenLanguages).join(', ') || 'English, Hindi';
    console.log(`\n${purple(bold('┌── [JANUARY : ADAPTIVE MEMORY & USER PROFILE] ──────────────────────'))}`);
    console.log(`│ ${bold('User Name:')}         ${yellow(profile.userName || 'Ashwin')}`);
    console.log(`│ ${bold('Interactions:')}      ${yellow(profile.totalInteractions.toString())} turns learned`);
    console.log(`│ ${bold('Coding Stack:')}      ${cyan(codingLangs)}`);
    console.log(`│ ${bold('Languages:')}         ${white(spokenLangs)}`);
    console.log(`│ ${bold('Total Sessions:')}    ${profile.workPatterns.totalSessions}`);
    console.log(`│ ${bold('Observed Habits:')}   ${profile.observedHabits.join(', ') || 'Regular workflow'}`);
    console.log(`${purple(bold('└────────────────────────────────────────────────────────────────────'))}`);
    promptUser();
    return;
  }

  if (lower === 'vision' || lower === 'eyes' || lower === 'camera status') {
    try {
      const res = await fetch(`http://${config.host}:${config.port}/api/health`);
      if (res.ok) {
        const data = (await res.json()) as any;
        const vc = data.visualContext;
        console.log(`\n${yellow(bold('┌── [JANUARY : AMBIENT VISUAL CORTEX STATUS] ────────────────────────'))}`);
        console.log(`│ ${bold('Presence:')}   ${vc?.isPresent ? green('● USER DETECTED (' + (vc.identifiedUser || 'Ashwin') + ')') : dim('○ No user in front of laptop')}`);
        console.log(`│ ${bold('Activity:')}   ${cyan(vc?.activity || 'Standing by')}`);
        console.log(`│ ${bold('Posture:')}    ${white(vc?.posture || 'unknown')}`);
        console.log(`│ ${bold('Mood/Face:')}  ${purple(vc?.expression || 'Neutral')} (Faces in frame: ${vc?.faceCount ?? 0})`);
        console.log(`│ ${bold('Context:')}    ${dim(vc?.summary || 'Ambient camera monitoring active')}`);
        console.log(`${yellow(bold('└────────────────────────────────────────────────────────────────────'))}`);
      } else {
        console.log(`\n${yellow('Ambient visual monitor is running in background.')}`);
      }
    } catch {
      console.log(`\n${dim('Ambient camera monitoring is available when daemon or server is active.')}`);
    }
    promptUser();
    return;
  }

  if (lower === 'help') {
    console.log(`\n${purple(bold('┌── [JANUARY : SYSTEM GUIDE] ────────────────────────────────────────'))}`);
    console.log(`│ ${bold('Core Capabilities & Voice / Text Commands:')}`);
    console.log(`│   ${yellow('• Adaptive Memory:')}        "memory" or "profile" to view your learned habits & stats`);
    console.log(`│   ${yellow('• Ambient Eyes Status:')}     "eyes" or "vision" to see real-time camera perceptions`);
    console.log(`│   ${cyan('• Python Coding:')}          "write a python script to calculate fibonacci numbers"`);
    console.log(`│   ${cyan('• C Programming:')}          "write a linked list implementation with malloc in C"`);
    console.log(`│   ${cyan('• C++ Engineering:')}        "code a thread-safe queue in modern C++ with templates"`);
    console.log(`│   ${purple('• Indian Languages:')}       "हिंदी में बताओ आज का मौसम कैसा है" or "मराठीत बोला"`);
    console.log(`│   ${yellow('• Camera Eyes & Vision:')}  "what do you see?", "who am I?", "look at what I'm holding"`);
    console.log(`│   ${green('• Open Apps & Tools:')}      "open notes", "open safari", "launch terminal", "open vs code"`);
    console.log(`│   ${green('• Open Folders & Files:')}   "open downloads folder", "open documents", "open pressora"`);
    console.log(`│   ${green('• Open & Play Videos:')}    "open video sample.mp4", "play video intro", "open patient videos"`);
    console.log(`│   ${green('• Search Files & Media:')}   "search files for report", "find video on my mac"`);
    console.log(`│   ${green('• Real-Time Search:')}       "whats the live weather in hubli", "latest news"`);
    console.log(`│   ${yellow('• Sleep / Wake Words:')}     "${config.sleepPhrase}" to sleep, "${config.wakePhrase}" to wake`);
    console.log(`│   ${green('• WhatsApp Messaging:')}     "send whatsapp to +14155552671 saying Meeting at 4"`);
    console.log(`${purple(bold('└────────────────────────────────────────────────────────────────────'))}`);
    promptUser();
    return;
  }

  // Check for Local System App Launching
  const launchMatch = lower.match(/(?:launch|open)\s+([a-zA-Z0-9\s]+?)(?:\s+(?:app|application))?$/i) ||
                      lower.match(/(?:launch|open)\s+([a-zA-Z0-9]+)/i);

  if ((lower.includes('launch') || lower.includes('open')) && launchMatch && !lower.includes('code') && !lower.includes('python') && !lower.includes('c++') && !lower.includes('cpp')) {
    const appName = launchMatch[1].trim();
    console.log(`\n${purple(bold('┌── [JANUARY : LOCAL TOOL] ──────────────────────────────────────────'))}`);
    console.log(`│ ${dim('Executing tool:')} ${yellow(`launch_app("${appName}")`)}`);
    const toolResult = await executeTool('launch_app', { appName });
    console.log(`│ ${green('✔')} ${toolResult.message}`);
    console.log(`${purple(bold('└────────────────────────────────────────────────────────────────────'))}`);
    await systemSpeaker.speakText(toolResult.message, { emotion: 'joy', pitch: '+2Hz' });
    promptUser();
    return;
  }

  // Check for WhatsApp Message Automation
  if (lower.includes('whatsapp')) {
    const numberMatch = clean.match(/(?:\+?\d{8,15})/);
    const number = numberMatch ? numberMatch[0] : '14155552671';
    console.log(`\n${purple(bold('┌── [JANUARY : WHATSAPP TOOL] ───────────────────────────────────────'))}`);
    console.log(`│ ${dim('Executing tool:')} ${yellow(`manage_whatsapp_message("${number}")`)}`);
    const toolResult = await executeTool('manage_whatsapp_message', { number, text: clean });
    console.log(`│ ${green('✔')} ${toolResult.message}`);
    console.log(`${purple(bold('└────────────────────────────────────────────────────────────────────'))}`);
    await systemSpeaker.speakText(toolResult.message, { emotion: 'joy', pitch: '+2Hz' });
    promptUser();
    return;
  }

  // Check for Python, C, C++, Algorithms & Systems Coding
  const isCoding =
    (/(?:python|python3|\bpy\b|c\+\+|cpp|cxx|c\s+program|c\s+code|c\s+language|\bin\s+c\b|stdio\.h|iostream|malloc|quicksort|mergesort|binary\s*search|linked\s*list|fibonacci|pointers?|struct\s+\w+|class\s+\w+|algorithm|data\s*structure)/i.test(lower) ||
     /\b(write|create|generate|build|code|implement|make|solve|debug|optimize)\b.*?\b(code|script|function|program|algorithm|class|python|c\+\+|cpp|c language|c program|struct|queue|stack|tree|graph)\b/i.test(lower) ||
     /\b(how\s+to\s+code|how\s+to\s+write\s+a\s+program)\b/i.test(lower)) &&
    !lower.startsWith('open ') && !lower.startsWith('launch ');

  if (isCoding) {
    console.log(`\n${purple(bold('┌── [JANUARY : CODING ENGINE (Python / C / C++)] ─────────────────────'))}`);
    console.log(`│ ${dim('⚡ Routing task to Coding Engine (Claude -> Gemini Fallback)...')}`);
    
    // Save user message to Brain
    brainService.recordUserMessage(clean);

    const codingResult = await executeTool('delegate_coding', { prompt: clean });

    if (codingResult.success) {
      const langBadge = (codingResult.language || 'Code').toUpperCase();
      console.log(`│ ${brightCyan(bold(`[${langBadge}]`))} ${dim('Synthesized by:')} ${green(bold(codingResult.model))}`);
      console.log(`│`);
      
      const lines = (codingResult.response || codingResult.codeSnippet || '').split('\n');
      for (const line of lines) {
        console.log(`│ ${line}`);
      }
      console.log(`│`);
      if (codingResult.compilationCommand) {
        console.log(`│ ${yellow(bold('▶ Run Command:'))} ${brightCyan(codingResult.compilationCommand)}`);
      }
      console.log(`${purple(bold('└────────────────────────────────────────────────────────────────────'))}`);
      
      // Voice: Crisp verbal confirmation (never recites raw code lines aloud)
      const verbal = codingResult.verbalSummary || `I've generated the ${langBadge} code for you on screen.`;
      
      // Save code to Brain database
      brainService.recordAssistantMessage(codingResult.response || '', {
        verbalSummary: verbal,
        modelName: codingResult.model,
        artifacts: [
          {
            type: 'code_created',
            name: `${codingResult.language || 'code'}_script_${Date.now()}`,
            content: codingResult.codeSnippet || codingResult.response || '',
            metadata: {
              language: codingResult.language,
              compilationCommand: codingResult.compilationCommand,
              model: codingResult.model,
            },
          },
        ],
      });

      await systemSpeaker.speakText(verbal, { emotion: 'focused', pitch: '+0Hz' });
    } else {
      console.log(`│ ${yellow('⚠ Coding Engine Notice:')} ${codingResult.response || codingResult.error}`);
      console.log(`${purple(bold('└────────────────────────────────────────────────────────────────────'))}`);
      await systemSpeaker.speakText(`Coding engine status: ${codingResult.error || 'Please check server configuration.'}`, { emotion: 'concerned' });
    }

    promptUser();
    return;
  }

  // General Questions / Multilingual / Live Search -> Google Gemini API
  console.log(`\n${purple(bold('┌── [JANUARY : INTELLIGENCE CORE] ───────────────────────────────────'))}`);
  console.log(`│ ${dim('🧠 Reasoning with Google Gemini API & Emotion Attunement...')}`);

  // Save user message to Brain
  brainService.recordUserMessage(clean);

  const geminiResult = await geminiService.analyzeAndRespond(clean);
  const emotion = geminiResult.emotion;
  const emotionLabel = (() => {
    switch (emotion?.emotion) {
      case 'joy': return yellow('✨ Joyful');
      case 'curious': return cyan('💡 Curious');
      case 'empathetic': return green('🤝 Empathetic');
      case 'focused': return purple('⚡ Focused');
      case 'concerned': return yellow('⚠ Concerned');
      case 'calm': return blue('🧘 Calm');
      default: return dim('💬 Natural');
    }
  })();

  if (geminiResult.isError) {
    console.log(`│ ${yellow('⚠ Gemini API Notice:')} ${geminiResult.text}`);
    console.log(`${purple(bold('└────────────────────────────────────────────────────────────────────'))}`);
    await systemSpeaker.speakText(`Gemini API: ${geminiResult.error || geminiResult.text}`, { emotion: 'concerned' });
  } else if (geminiResult.isCode) {
    const langBadge = (geminiResult.language || 'Code').toUpperCase();
    console.log(`│ ${brightCyan(bold(`[${langBadge}]`))} ${dim('Synthesized by:')} ${green(bold(geminiResult.modelUsed || 'Coding Engine'))}`);
    console.log(`│`);
    const lines = (geminiResult.text || geminiResult.codeSnippet || '').split('\n');
    for (const line of lines) {
      console.log(`│ ${line}`);
    }
    console.log(`│`);
    if (geminiResult.compilationCommand) {
      console.log(`│ ${yellow(bold('▶ Run Command:'))} ${brightCyan(geminiResult.compilationCommand)}`);
    }
    console.log(`${purple(bold('└────────────────────────────────────────────────────────────────────'))}`);
    const verbal = geminiResult.verbalSummary || `I've generated the ${langBadge} code for you in your terminal.`;

    brainService.recordAssistantMessage(geminiResult.text, {
      verbalSummary: verbal,
      emotion: geminiResult.emotion?.emotion,
      modelName: geminiResult.modelUsed,
      artifacts: [
        {
          type: 'code_created',
          name: `${geminiResult.language || 'code'}_script_${Date.now()}`,
          content: geminiResult.text,
          metadata: {
            language: geminiResult.language,
            compilationCommand: geminiResult.compilationCommand,
            model: geminiResult.modelUsed,
          },
        },
      ],
    });

    await systemSpeaker.speakText(verbal, { emotion: 'focused', pitch: '+0Hz' });
  } else {
    console.log(`│ ${dim('Mood Attunement:')} ${emotionLabel} ${dim(`(Pitch: ${emotion?.pitch || '+0Hz'}, Rate: ${emotion?.rate || '+0%'})`)}`);
    console.log(`│`);
    const lines = geminiResult.text.split('\n');
    for (const line of lines) {
      console.log(`│ ${white(line)}`);
    }
    console.log(`│`);
    console.log(`${purple(bold('└────────────────────────────────────────────────────────────────────'))}`);
    const spokenText = geminiResult.verbalSummary || geminiResult.text;

    brainService.recordAssistantMessage(geminiResult.text, {
      verbalSummary: spokenText,
      emotion: geminiResult.emotion?.emotion,
      modelName: geminiResult.modelUsed || 'Gemini',
    });

    await systemSpeaker.speakText(spokenText, {
      pitch: emotion?.pitch,
      rate: emotion?.rate,
      emotion: emotion?.emotion,
    });
  }

  promptUser();
}

rl.on('line', async (line) => {
  await handleUserInput(line);
});

promptUser();
