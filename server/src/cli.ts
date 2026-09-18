#!/usr/bin/env node
/**
 * January AI - Dual-Section Interactive Terminal CLI
 * Powered by Google Gemini 3.6 Flash API & Anthropic Claude 3.7 Sonnet API
 * Features 2 distinct interaction sections: [ME] and [JANUARY].
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

console.clear();
console.log(`
${cyan(bold('╔═══════════════════════════════════════════════════════════════════╗'))}
${cyan(bold('║               ⚡ JANUARY AI — DUAL INTERACTIVE CLI                ║'))}
${cyan(bold('╠═══════════════════════════════════════════════════════════════════╣'))}
${cyan(bold('║'))} ${brightCyan(bold(' [ME]      '))} ${white('Ask any question, command, or development task         ')} ${cyan(bold('║'))}
${cyan(bold('║'))} ${purple(bold(' [JANUARY] '))} ${white('Real-time reasoning with Gemini API & Claude 3.7 Sonnet')} ${cyan(bold('║'))}
${cyan(bold('╠═══════════════════════════════════════════════════════════════════╣'))}
${cyan(bold('║'))} ${dim('Hardware Speaker:')} MacBook Physical Audio (${config.geminiVoice} / Edge-TTS)     ${cyan(bold('║'))}
${cyan(bold('║'))} ${dim('Commands:')} ${yellow('clear')} ${dim('to reset screen,')} ${yellow('help')} ${dim('for ideas,')} ${yellow('exit')} ${dim('to quit.           ')} ${cyan(bold('║'))}
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
    console.log(dim('\nClosing January CLI session. Resuming background listener...\n'));
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
    console.log(`\n${purple(bold('┌── [JANUARY : SLEEP MODE] ──────────────────────────────────────────'))}`);
    console.log(`│ ${purple('🌙 Good night. Standing by in sleep mode.')}`);
    console.log(`│ ${dim('Say or type "arise" to wake January back up.')}`);
    console.log(`${purple(bold('└────────────────────────────────────────────────────────────────────'))}`);
    await systemSpeaker.speakText('Good night. Standing by until you say Arise.', { emotion: 'calm', pitch: '-3Hz', rate: '-7%' });
    promptUser();
    return;
  }

  // Wake Word Command
  if (lower === 'arise' || lower === 'wake up' || lower === 'wake') {
    isSleeping = false;
    console.log(`\n${purple(bold('┌── [JANUARY : ACTIVE] ──────────────────────────────────────────────'))}`);
    console.log(`│ ${green('⚡ Arise acknowledged. January is awake and listening!')}`);
    console.log(`${purple(bold('└────────────────────────────────────────────────────────────────────'))}`);
    await systemSpeaker.speakText('I am awake and listening.', { emotion: 'joy', pitch: '+3Hz', rate: '+4%' });
    promptUser();
    return;
  }

  if (isSleeping) {
    console.log(`\n${purple(bold('┌── [JANUARY : SLEEPING] ────────────────────────────────────────────'))}`);
    console.log(`│ ${dim('January is currently in sleep mode. Say or type')} ${yellow('arise')} ${dim('to wake me.')}`);
    console.log(`${purple(bold('└────────────────────────────────────────────────────────────────────'))}`);
    promptUser();
    return;
  }

  if (lower === 'help') {
    console.log(`\n${purple(bold('┌── [JANUARY : SYSTEM GUIDE] ────────────────────────────────────────'))}`);
    console.log(`│ ${bold('Dynamic AI Capabilities (using your API keys):')}`);
    console.log(`│   ${cyan('• Questions & Reasoning:')}   "what is quantum entanglement", "how do neural networks learn"`);
    console.log(`│   ${purple('• Claude 3.7 Development:')}  "make a solar system simulation", "write a debounce function in ts"`);
    console.log(`│   ${purple('• Web App Creation:')}       "build a stopwatch web app with laps", "create a calculator"`);
    console.log(`│   ${green('• Local Tools:')}            "open notes", "launch calculator", "open safari"`);
    console.log(`│   ${yellow('• Sleep / Wake Words:')}     "good night" to sleep, "arise" to wake`);
    console.log(`│   ${green('• WhatsApp Messaging:')}     "send whatsapp to +14155552671 saying Meeting at 4"`);
    console.log(`${purple(bold('└────────────────────────────────────────────────────────────────────'))}`);
    promptUser();
    return;
  }

  // Check for Local System App Launching
  const launchMatch = lower.match(/(?:launch|open)\s+([a-zA-Z0-9\s]+?)(?:\s+(?:app|application))?$/i) ||
                      lower.match(/(?:launch|open)\s+([a-zA-Z0-9]+)/i);

  if ((lower.includes('launch') || lower.includes('open')) && launchMatch && !lower.includes('code') && !lower.includes('claude') && !lower.includes('simulation') && !lower.includes('app for') && !lower.includes('app that')) {
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

  // Check for Development / Code / Simulation -> Delegate to Claude 3.7 Sonnet API
  const isCodingOrSimulation =
    (/\b(claude|simulation|simulate|develop|web\s*app|website|frontend|html|calculator|timer|stopwatch|game|dashboard)\b/i.test(lower) ||
     /\b(write|create|generate|build|code|implement|make)\b.*?\b(code|script|function|component|app|program|algorithm|class|simulation|ui|interface|page)\b/i.test(lower)) &&
    !lower.startsWith('open ') && !lower.startsWith('launch ');

  if (isCodingOrSimulation) {
    console.log(`\n${purple(bold('┌── [JANUARY : CLAUDE 3.7 SONNET] ───────────────────────────────────'))}`);
    console.log(`│ ${dim('⚡ Routing task to Anthropic Claude 3.7 Sonnet API servers...')}`);
    
    const claudeResult = await executeTool('delegate_coding', { prompt: clean });

    if (claudeResult.success) {
      console.log(`│`);
      // Print formatted output lines
      const lines = (claudeResult.response || claudeResult.codeSnippet || '').split('\n');
      for (const line of lines) {
        console.log(`│ ${line}`);
      }
      console.log(`│`);
      if (claudeResult.htmlPreview || claudeResult.isWebApp) {
        console.log(`│ ${green(bold('🌐 [Live Interactive Preview Ready]'))} View in web dashboard at ${cyan('http://localhost:5173')}`);
      }
      console.log(`${purple(bold('└────────────────────────────────────────────────────────────────────'))}`);
      
      const speechConfirmation = (claudeResult.htmlPreview || claudeResult.isWebApp)
        ? "I've generated the simulation and loaded the live interactive preview for you on screen."
        : "I've generated the code for you on screen.";
      await systemSpeaker.speakText(speechConfirmation, { emotion: 'focused', pitch: '+0Hz' });
    } else {
      console.log(`│ ${yellow('⚠ API Response:')} ${claudeResult.response || claudeResult.error}`);
      console.log(`${purple(bold('└────────────────────────────────────────────────────────────────────'))}`);
      await systemSpeaker.speakText(`Claude API status: ${claudeResult.error || 'Check server configuration'}`, { emotion: 'concerned' });
    }

    promptUser();
    return;
  }

  // General Questions / Reasoning -> Analyze dynamically with Google Gemini API
  console.log(`\n${purple(bold('┌── [JANUARY : GEMINI AI] ───────────────────────────────────────────'))}`);
  console.log(`│ ${dim('🧠 Analyzing question with Google Gemini API servers...')}`);

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
