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
  private ttsScriptPath: string;

  constructor() {
    super();
    this.ttsScriptPath = path.resolve(__dirname, '../../audio_engine/tts_engine.py');
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
        if (/^(?:import|export|const|let|var|function|class|def|return|public|private)\b/.test(trimmed)) {
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
    this.isSpeaking = true;
    this.emit('start');

    // Tier 1: ElevenLabs High-Fidelity Neural Emotional Voice Engine
    if (config.elevenlabsApiKey && config.useElevenLabs !== false) {
      try {
        const success = await elevenLabsEngine.speak(speechText, {
          emotion: options?.emotion,
          voiceId: config.elevenlabsVoiceId,
          modelId: config.elevenlabsModelId,
        });
        if (success) {
          return;
        }
        console.warn('⚠️ [SystemSpeaker] ElevenLabs synthesis did not complete, falling back to secondary speech tier.');
      } catch (err: any) {
        console.warn('⚠️ [SystemSpeaker] ElevenLabs error, falling back:', err.message);
      }
    }

    const useEdgeTts = process.env.USE_EDGE_TTS === 'true';
    const isDevanagari = /[\u0900-\u097F]/.test(speechText);
    const hasOtherIndianScript = /[\u0980-\u0D7F]/.test(speechText);

    // If native mode (default for real-time responsiveness)
    if (!useEdgeTts && !hasOtherIndianScript) {
      const voice = isDevanagari ? 'Lekha' : (process.env.MACOS_VOICE || 'Samantha');
      const rate = options?.rate?.includes('+') ? '195' : options?.rate?.includes('-') ? '170' : '185';

      console.log(`🔊 [SystemSpeaker:Native] Speaking (${voice}, ${rate} wpm): "${speechText.slice(0, 50)}..."`);

      return new Promise((resolve) => {
        const proc = spawn('say', ['-v', voice, '-r', rate, speechText]);
        this.currentProcess = proc;

        proc.on('close', () => {
          this.currentProcess = null;
          resolve();
        });

        proc.on('error', (err) => {
          console.warn('[SystemSpeaker:Native] say error:', err.message);
          this.currentProcess = null;
          resolve();
        });
      });
    }

    // Neural Edge-TTS Mode via persistent venv
    const pythonPath = fs.existsSync(path.resolve(__dirname, '../../../server/.venv/bin/python3'))
      ? path.resolve(__dirname, '../../../server/.venv/bin/python3')
      : fs.existsSync(path.resolve(__dirname, '../../.venv/bin/python3'))
      ? path.resolve(__dirname, '../../.venv/bin/python3')
      : 'python3';

    const pitch = options?.pitch || '+0Hz';
    const rate = options?.rate || '+0%';

    console.log(`🔊 [SystemSpeaker:Neural] Speaking (pitch: ${pitch}, rate: ${rate}): "${speechText.slice(0, 50)}..."`);

    return new Promise((resolve) => {
      const proc = spawn(
        pythonPath,
        [this.ttsScriptPath, speechText, '--pitch', pitch, '--rate', rate],
        { stdio: ['ignore', 'pipe', 'pipe'] }
      );

      this.currentProcess = proc;

      proc.on('close', () => {
        this.currentProcess = null;
        resolve();
      });

      proc.on('error', (err) => {
        console.warn('[SystemSpeaker] Neural TTS error, falling back to say:', err.message);
        const fallbackVoice = isDevanagari ? 'Lekha' : 'Samantha';
        const sayProc = spawn('say', ['-v', fallbackVoice, speechText]);
        this.currentProcess = sayProc;
        sayProc.on('close', () => {
          this.currentProcess = null;
          resolve();
        });
      });
    });
  }

  /**
   * Play a 24kHz PCM audio chunk received from Gemini Live directly through the speakers
   */
  public playPcmChunk(pcmBase64: string): void {
    try {
      const buffer = Buffer.from(pcmBase64, 'base64');
      const wavHeader = this.createWavHeader(buffer.length, 24000, 1, 16);
      const fullWav = Buffer.concat([wavHeader, buffer]);

      const tempFile = path.join(os.tmpdir(), `january_gemini_${Date.now()}.wav`);
      fs.writeFileSync(tempFile, fullWav);

      const playProc = spawn('afplay', [tempFile]);
      this.currentProcess = playProc;

      playProc.on('close', () => {
        try {
          if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        } catch (e) {}
      });
    } catch (err: any) {
      console.error('[SystemSpeaker] Error playing PCM chunk:', err.message);
    }
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
