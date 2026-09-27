import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';
import { elevenLabsEngine } from './elevenLabsEngine.js';
import { config } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SystemSpeaker extends EventEmitter {
  private currentProcess: ChildProcess | null = null;
  private isSpeaking = false;
  private isMuted = false;
  private ttsScriptPath: string;

  constructor() {
    super();
    this.ttsScriptPath = path.resolve(__dirname, '../../audio_engine/tts_engine.py');
  }

  public setMute(muted: boolean): void {
    this.isMuted = muted;
    if (muted) {
      this.stopPlayback();
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Sanitize text for speech: Strips code blocks, syntax tokens, HTML tags,
   * and raw filesystem paths so physical speakers speak naturally and never
   * read out long system directory paths or export listings.
   */
  public sanitizeForSpeech(text: string): { speechText: string; hadCode: boolean } {
    if (!text) return { speechText: '', hadCode: false };

    let clean = text;
    let hadCode = false;

    // Check for markdown code blocks (```...```)
    if (/```[\s\S]*?```/.test(clean)) {
      hadCode = true;
      clean = clean.replace(/```(?:[a-zA-Z0-9_-]+)?\n[\s\S]*?```/g, '');
    }

    // Check for inline code (`...`)
    if (/`[^`]+`/.test(clean)) {
      hadCode = true;
      clean = clean.replace(/`([^`]+)`/g, '$1');
    }

    // Strip HTML tags (<...>)
    if (/<[^>]+>/.test(clean)) {
      hadCode = true;
      clean = clean.replace(/<[^>]+>/g, '');
    }

    // Strip emotion metadata tags: e.g. "[Emotion: joy]", "[emotion: calm]", "(Emotion: focused)", "[Feeling: happy]"
    clean = clean.replace(/\[\s*(?:emotion|feeling|mood|tone)\s*:[^\]]+\]/gi, '');
    clean = clean.replace(/\(\s*(?:emotion|feeling|mood|tone)\s*:[^)]+\)/gi, '');
    clean = clean.replace(/(?:^|\s)(?:emotion|feeling|mood|tone)\s*:\s*[a-zA-Z_-]+\b\s*[:.-]?\s*/gi, ' ');
    clean = clean.replace(/^(?:I(?:\s*'?\s*m|\s+am)\s+(?:feeling|in\s+a\s+state\s+of)\s+|Feeling\s+|My\s+current\s+(?:mood|emotion)\s+is\s+|Current\s+emotion:\s*)(?:joyful|joy|curious|empathetic|focused|concerned|calm|neutral)[,.]?\s*/gi, '');

    // Strip lines that are code syntax or file export listings
    clean = clean
      .split('\n')
      .filter((line) => {
        const trimmed = line.trim();
        // If line is a bullet or heading for an exported/saved file (e.g. "- .blend: /...", "- .obj Mesh: /...", "• [FILE] ... (/...)")
        if (
          /^[-*•]?\s*(?:\.(?:blend|obj|mtl|glb|gltf|fbx|stl|dae|py|c|cpp|h|ts|js|json|png|jpg|jpeg|webp|pdf|txt|csv)|\b(?:blend|file|export|output|saved\s+to|path|project|mesh|realtime)\b)/i.test(trimmed) &&
          /(?:\/|\\|\.[a-zA-Z0-9]{2,4}\b)/.test(trimmed)
        ) {
          return false;
        }

        // If line is primarily a filesystem path
        if (/^(?:[-*•]\s*)?(?:[a-zA-Z]:\\|\/|~\/|\.\.?\/)(?:[^\s:]+\/)*[^\s:]+\.[a-zA-Z0-9]+$/i.test(trimmed)) {
          return false;
        }

        // If line looks like code syntax, filter it out
        if (
          /^(?:import\s+.*?from\b|export\s+(?:default\s+)?(?:const|let|var|function|class)\b|const\s+[a-zA-Z_$]\w*\s*=|let\s+[a-zA-Z_$]\w*\s*=|var\s+[a-zA-Z_$]\w*\s*=|function\s+[a-zA-Z_$]\w*\(|def\s+[a-zA-Z_$]\w*\(|class\s+[a-zA-Z_$]\w*[\s:{]|return\s+[a-zA-Z0-9_$'"([{]|public\s+[a-zA-Z_$]|private\s+[a-zA-Z_$])/.test(trimmed)
        ) {
          hadCode = true;
          return false;
        }
        if (/^[{}();<>\[\]=+\-*\/]+$/.test(trimmed)) {
          return false;
        }
        return true;
      })
      .join(' ')
      .trim();

    // Strip parenthesized file paths: e.g. "report.pdf (/Users/.../report.pdf)" -> "report.pdf"
    clean = clean.replace(/\s*\((?:[a-zA-Z]:\\|\/|~\/|\.\.?\/)[^)]+\)/g, '');

    // Strip inline absolute Unix paths: e.g. "/Users/.../file.ext"
    clean = clean.replace(/(?:^|\s)(?:\/(?:Users|home|Volumes|private|tmp|bin|usr|System|Library|var|etc|opt)\/[^\s,;:)]+)/g, ' ');

    // Strip inline Windows paths: e.g. "C:\Users\..."
    clean = clean.replace(/(?:^|\s)(?:[a-zA-Z]:\\[^\s,;:)]+)/g, ' ');

    // Strip relative or project export paths: e.g. "server/data/exports/3d/model.blend"
    clean = clean.replace(/(?:^|\s)(?:(?:\.|\.\.|~)?\/[a-zA-Z0-9_.-]+)+(?:\/[a-zA-Z0-9_.-]+)*\.[a-zA-Z0-9]+/g, ' ');

    // Clean up residual path introductions (e.g. "saved to :", "saved to .", "at /", "saved as :")
    clean = clean.replace(/\b(?:saved\s+(?:to|at)|exported\s+to|file\s+path\s+is)\s*[:.]?/gi, 'saved.');
    clean = clean.replace(/\bto\s+and\b/gi, 'and');
    clean = clean.replace(/\bsaved\s+to\s+and\b/gi, 'saved and');
    clean = clean.replace(/\s*:\s*\./g, '.');

    // Clean up multiple spaces and markdown symbols (#, *, _, >)
    clean = clean
      .replace(/[#*_~>`]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // If text was primarily code and left empty, provide a clean verbal confirmation
    if (hadCode && (!clean || clean.length < 5)) {
      clean = "I've generated the code and loaded the live interactive preview for you on screen.";
    }

    // If text was primarily file paths and left empty, provide a clean verbal confirmation
    if (!clean || clean.length < 3) {
      clean = "I have created and saved the file for you on your system.";
    }

    return { speechText: clean, hadCode };
  }

  private speechQueue: Array<{ text: string; options?: { pitch?: string; rate?: string; emotion?: string }; resolve: () => void }> = [];
  private isProcessingQueue = false;

  /**
   * Enqueue a sentence or text chunk for smooth, sequential out-loud speech
   */
  public async speakText(
    text: string,
    options?: { pitch?: string; rate?: string; emotion?: string }
  ): Promise<void> {
    if (this.isMuted) return;
    if (!text || !text.trim()) return;

    const { speechText } = this.sanitizeForSpeech(text);
    if (!speechText || !speechText.trim()) return;

    return new Promise((resolve) => {
      this.speechQueue.push({ text: speechText, options, resolve });
      if (!this.isProcessingQueue) {
        this.processQueue();
      }
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.speechQueue.length === 0) return;
    this.isProcessingQueue = true;

    while (this.speechQueue.length > 0) {
      const item = this.speechQueue.shift();
      if (!item) break;

      try {
        await this.playSingleUtterance(item.text, item.options);
      } catch (err: any) {
        console.warn('[SystemSpeaker] Utterance playback error:', err.message);
      }
      item.resolve();
    }

    this.isProcessingQueue = false;
    this.isSpeaking = false;
    this.emit('end');
  }

  private async playSingleUtterance(
    speechText: string,
    options?: { pitch?: string; rate?: string; emotion?: string }
  ): Promise<void> {
    if (this.isMuted) return;

    this.isSpeaking = true;
    this.emit('start');

    // Tier 1: ElevenLabs High-Fidelity Neural Emotional Voice Engine
    if (config.elevenlabsApiKey && config.useElevenLabs !== false) {
      try {
        console.log(`🎙️ [SystemSpeaker:ElevenLabs] Synthesizing speech via ElevenLabs...`);
        const audioBuffer = await elevenLabsEngine.synthesize(speechText, {
          emotion: options?.emotion,
          voiceId: config.elevenlabsVoiceId,
          modelId: config.elevenlabsModelId,
        });

        if (audioBuffer && audioBuffer.length > 0) {
          console.log(`📡 [SystemSpeaker] Streaming ElevenLabs audio to frontend (${audioBuffer.length} bytes)...`);
          this.emit('audio_output', {
            data: audioBuffer.toString('base64'),
            mimeType: 'audio/mpeg',
            text: speechText,
          });

          // Allow realistic pacing for the utterance before resolving
          const words = speechText.trim().split(/\s+/).length;
          const estimatedDurationMs = Math.max(1000, Math.min(30000, Math.round((words / 2.7) * 1000)));
          await new Promise((r) => setTimeout(r, estimatedDurationMs));
          return;
        }
        console.warn('⚠️ [SystemSpeaker] ElevenLabs synthesis did not return audio, falling back to secondary speech tier.');
      } catch (err: any) {
        console.warn('⚠️ [SystemSpeaker] ElevenLabs error, falling back:', err.message);
      }
    }

    // Tier 2: Neural Edge-TTS Mode via persistent venv (generates MP3 without local afplay)
    const venvCandidates = [
      path.resolve(process.cwd(), 'server/.venv/bin/python3'),
      path.resolve(process.cwd(), '.venv/bin/python3'),
      path.resolve(__dirname, '../../../server/.venv/bin/python3'),
      path.resolve(__dirname, '../../.venv/bin/python3'),
      path.resolve(__dirname, '../.venv/bin/python3'),
    ];
    let pythonPath = 'python3';
    for (const p of venvCandidates) {
      if (fs.existsSync(p)) {
        pythonPath = p;
        break;
      }
    }

    const ttsScriptCandidates = [
      path.resolve(process.cwd(), 'server/audio_engine/tts_engine.py'),
      path.resolve(process.cwd(), 'audio_engine/tts_engine.py'),
      path.resolve(__dirname, '../../audio_engine/tts_engine.py'),
      path.resolve(__dirname, '../../../server/audio_engine/tts_engine.py'),
    ];
    let ttsScript = this.ttsScriptPath;
    for (const sp of ttsScriptCandidates) {
      if (fs.existsSync(sp)) {
        ttsScript = sp;
        break;
      }
    }

    const pitch = options?.pitch || '+0Hz';
    const rate = options?.rate || '+0%';
    const tempOutput = path.join(os.tmpdir(), `january_edge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.mp3`);

    console.log(`🔊 [SystemSpeaker:Neural] Synthesizing Edge-TTS MP3 (pitch: ${pitch}, rate: ${rate})...`);

    try {
      await new Promise<void>((resolve, reject) => {
        const proc = spawn(
          pythonPath,
          [ttsScript, speechText, '--output', tempOutput, '--pitch', pitch, '--rate', rate],
          { stdio: ['ignore', 'pipe', 'pipe'] }
        );
        this.currentProcess = proc;

        proc.on('close', (code) => {
          this.currentProcess = null;
          if (code === 0 && fs.existsSync(tempOutput)) {
            resolve();
          } else {
            reject(new Error(`Edge-TTS exited with code ${code}`));
          }
        });

        proc.on('error', (err) => {
          this.currentProcess = null;
          reject(err);
        });
      });

      if (fs.existsSync(tempOutput)) {
        const edgeBuffer = fs.readFileSync(tempOutput);
        try { fs.unlinkSync(tempOutput); } catch {}
        if (edgeBuffer.length > 0) {
          console.log(`📡 [SystemSpeaker] Streaming Edge-TTS audio to frontend (${edgeBuffer.length} bytes)...`);
          this.emit('audio_output', {
            data: edgeBuffer.toString('base64'),
            mimeType: 'audio/mpeg',
            text: speechText,
          });

          const words = speechText.trim().split(/\s+/).length;
          const estimatedDurationMs = Math.max(1000, Math.min(30000, Math.round((words / 2.7) * 1000)));
          await new Promise((r) => setTimeout(r, estimatedDurationMs));
          return;
        }
      }
    } catch (err: any) {
      console.warn('[SystemSpeaker] Neural Edge-TTS error, falling back to browser speech:', err.message);
      try { if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput); } catch {}
    }

    // Tier 3: Browser Web Speech API Fallback
    console.log(`🌐 [SystemSpeaker:Browser] Delegating speech synthesis to web browser frontend...`);
    this.emit('browser_speak', {
      text: speechText,
      emotion: options?.emotion,
    });
    const words = speechText.trim().split(/\s+/).length;
    const estimatedDurationMs = Math.max(1000, Math.min(30000, Math.round((words / 2.7) * 1000)));
    await new Promise((r) => setTimeout(r, estimatedDurationMs));
  }

  /**
   * Play a 24kHz PCM audio chunk received from Gemini Live directly through the speakers.
   * Host terminal playback is suppressed; frontend plays audio directly.
   */
  public playPcmChunk(pcmBase64: string): void {
    // Suppressed on terminal host to ensure pure frontend audio
  }

  /**
   * Stop any current audio playback immediately (interruption)
   */
  public stopPlayback(): void {
    // Clear queued sentences
    this.speechQueue.forEach((item) => item.resolve());
    this.speechQueue = [];
    this.isProcessingQueue = false;

    // Stop ElevenLabs if active
    elevenLabsEngine.stopPlayback();

    if (this.currentProcess) {
      console.log('[SystemSpeaker] Stopping current speaker playback.');
      this.currentProcess.kill('SIGTERM');
      this.currentProcess = null;
    }
    this.isSpeaking = false;
    this.emit('end');
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking || elevenLabsEngine.getIsSpeaking();
  }

  private createWavHeader(dataLength: number, sampleRate: number, numChannels: number, bitsPerSample: number): Buffer {
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const buffer = Buffer.alloc(44);

    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataLength, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // SubChunk1Size
    buffer.writeUInt16LE(1, 20);  // AudioFormat (PCM)
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataLength, 40);

    return buffer;
  }
}

export const systemSpeaker = new SystemSpeaker();
