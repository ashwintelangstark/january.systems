#!/usr/bin/env node
/**
 * January AI - Dual-Section Interactive Terminal CLI
 * Powered by Google Gemini API & Anthropic Claude (with automatic Gemini fallback)
 * Specialized in Python, C, and C++ coding, real-time live internet, and multilingual speech.
 */

import readline from 'readline';
import { WebSocket } from 'ws';
import { SystemSpeaker } from './audio/systemSpeaker.js';
import { GeminiService } from './gemini/geminiService.js';
import { executeTool } from './tools/index.js';
import { config, validateConfig } from './config.js';
import { ClientMessage } from './types.js';

validateConfig();

const systemSpeaker = new SystemSpeaker();
const geminiService = new GeminiService();

// Connect to background daemon to coordinate background mic pausing/resuming
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
  } catch (e) {
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

// Clean exit handlers to guarantee background daemon resumes
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
${cyan(bold('║'))} ${purple(bold(' [JANUARY] '))} ${white('Gemini & Claude Core with out-loud speaker synthesis   ')} ${cyan(bold('║'))}
${cyan(bold('╠═══════════════════════════════════════════════════════════════════╣'))}
${cyan(bold('║'))} ${dim('Coding Engine:')}   Python, C, and C++ (Claude with instant Gemini fallback)${cyan(bold('║'))}
${cyan(bold('║'))} ${dim('Ambient Eyes:')}    Continuous Camera & Face/Posture Monitoring (Local Edge)${cyan(bold('║'))}
${cyan(bold('║'))} ${dim('Adaptive Memory:')} Learned Habits, Daily Rhythms & Personalized Profile  ${cyan(bold('║'))}
${cyan(bold('║'))} ${dim('Hardware Audio:')}  MacBook Physical Speaker (Edge-TTS Neural)          ${cyan(bold('║'))}
${cyan(bold('║'))} ${dim('Commands:')}        ${yellow('memory')}${dim(',')} ${yellow('eyes')}${dim(',')} ${yellow('clear')}${dim(',')} ${yellow('help')}${dim(',')} ${yellow('exit')} ${dim('to quit and resume room mic')}${cyan(bold('║'))}
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

  // CLI Control Commands
  if (lower === 'exit' || lower === 'quit') {
    console.log(dim('\nClosing January CLI session. Resuming background room microphone...\n'));
    handleExitCleanly();
    process.exit(0);
  }

  if (lower === 'clear' || lower === 'cls') {
    console.clear();
    promptUser();
    return;
  }

  // Sleep Word Command
  if (lower === 'good night' || lower === 'goodnight' || lower === 'go to sleep' || lower === 'sleep') {
    isSleeping = true;
    const capWake = config.wakePhrase.charAt(0).toUpperCase() + config.wakePhrase.slice(1);
    console.log(`\n${purple(bold('┌── [JANUARY : SLEEP MODE] ──────────────────────────────────────────'))}`);
    console.log(`│ ${purple('🌙 Good night. Standing by in sleep mode.')}`);
    console.log(`│ ${dim(`Say or type "${config.wakePhrase}" to wake January back up.`)}`);
    console.log(`${purple(bold('└────────────────────────────────────────────────────────────────────'))}`);
    await systemSpeaker.speakText(`Good night. Standing by until you say ${capWake}.`, { emotion: 'calm', pitch: '-3Hz', rate: '-7%' });
    promptUser();
    return;
  }

  // Wake Word Command
  if (lower === 'rise' || lower === 'arise' || lower === 'wake up' || lower === 'wake') {
    isSleeping = false;
    const capWake = config.wakePhrase.charAt(0).toUpperCase() + config.wakePhrase.slice(1);
    console.log(`\n${purple(bold('┌── [JANUARY : ACTIVE] ──────────────────────────────────────────────'))}`);
    console.log(`│ ${green(`⚡ ${capWake} acknowledged. January is awake and listening!`)}`);
    console.log(`${purple(bold('└────────────────────────────────────────────────────────────────────'))}`);
    await systemSpeaker.speakText('I am awake and listening.', { emotion: 'joy', pitch: '+3Hz', rate: '+4%' });
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

  if (lower === 'profile' || lower === 'memory' || lower === 'stats') {
    const profile = geminiService.getLearnedProfileEngine().getProfile();
    const topCoding = Object.entries(profile.preferredCodingLanguages)
      .sort((a, b) => b[1] - a[1])
      .map(([l, c]) => `${cyan(l)}: ${c}`)
      .join(', ') || 'C++: 1, Python: 1, C: 1';
    const topSpoken = Object.entries(profile.preferredSpokenLanguages)
      .sort((a, b) => b[1] - a[1])
      .map(([l, c]) => `${purple(l)}: ${c}`)
      .join(', ') || 'English, Hindi, Marathi';

    console.log(`\n${purple(bold('┌── [JANUARY : ADAPTIVE LEARNED MEMORY PROFILE] ─────────────────────'))}`);
    console.log(`│ ${bold('User:')} ${brightCyan(profile.userName)}   ${dim('| Total Interactions Recorded:')} ${yellow(profile.totalInteractions.toString())}`);
    console.log(`│ ${bold('Preferred Coding Languages:')} ${topCoding}`);
    console.log(`│ ${bold('Preferred Spoken Languages:')} ${topSpoken}`);
    console.log(`│ ${dim('Learned Coding Style:')}`);
    for (const style of profile.codingStylePreferences) {
      console.log(`│   ${green('•')} ${dim(style)}`);
    }
    console.log(`│ ${dim('Learned Tone & Style:')}`);
    for (const pref of profile.communicationStylePreferences) {
      console.log(`│   ${purple('•')} ${dim(pref)}`);
    }
    console.log(`│ ${dim('Observed Habits:')}`);
    for (const habit of profile.observedHabits) {
      console.log(`│   ${yellow('•')} ${dim(habit)}`);
    }
    console.log(`│ ${dim('Storage:')} ${cyan('server/data/memory/learned_profile.json')}`);
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
        console.log(`\n${yellow('Ambient visual monitor is running in background daemon.')}`);
      }
    } catch {
      console.log(`\n${dim('Ambient camera monitoring is managed by the background daemon (npm run dev / npm start).')}`);
    }
    promptUser();
    return;
  }

  if (lower === 'help') {
    console.log(`\n${purple(bold('┌── [JANUARY : SYSTEM GUIDE] ────────────────────────────────────────'))}`);
    console.log(`│ ${bold('Core Capabilities & Example Voice / Text Commands:')}`);
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
    console.log(`│   ${yellow('• Sleep / Wake Words:')}     "good night" to sleep, "${config.wakePhrase}" to wake`);
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
    await systemSpeaker.speakText(geminiResult.text, {
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
