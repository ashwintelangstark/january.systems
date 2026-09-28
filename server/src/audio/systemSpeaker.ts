import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';
import { getPythonExecutablePath } from '../utils/paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SpeechQueueItem {
  text: string;
  options?: { pitch?: string; rate?: string; emotion?: string };
  audioPromise?: Promise<string | null>;
  resolve: () => void;
}

export class SystemSpeaker extends EventEmitter {
  private currentProcess: ChildProcess | null = null;
  private daemonProcess: ChildProcess | null = null;
  private daemonReady = false;
  private daemonStdoutBuffer = '';
  private pendingRequests = new Map<string, (audioPath: string | null) => void>();
  private speechQueue: SpeechQueueItem[] = [];
  private isProcessingQueue = false;
  private isSpeaking = false;
  private isMuted = false;
  private ttsScriptPath: string;
  private respawnTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
    const resourcesPath = (process as any).resourcesPath || '';
    const scriptCandidates = [
      path.join(resourcesPath, 'server', 'audio_engine', 'tts_engine.py'),
      path.resolve(__dirname, '../../audio_engine/tts_engine.py'),
      path.resolve(__dirname, '../../../audio_engine/tts_engine.py'),
      path.resolve(__dirname, '../../../server/audio_engine/tts_engine.py'),
      path.resolve(process.cwd(), 'server/audio_engine/tts_engine.py'),
      path.resolve(process.cwd(), 'audio_engine/tts_engine.py'),
    ];
    let found = scriptCandidates[0];
    for (const p of scriptCandidates) {
      if (fs.existsSync(p)) {
        found = p;
        break;
      }
    }
    this.ttsScriptPath = found;

    // Start background Kokoro TTS daemon worker for instant sub-second responses
    this.initDaemon();
  }

  private getPythonPath(): string {
    return getPythonExecutablePath();
  }

  private initDaemon(): void {
    if (this.daemonProcess) return;

    const pythonPath = this.getPythonPath();
    if (!fs.existsSync(this.ttsScriptPath)) {
      console.warn(`[SystemSpeaker] TTS script not found at ${this.ttsScriptPath}`);
      return;
    }

    try {
      console.log(`🎙️ [SystemSpeaker] Launching Kokoro realistic female voice daemon with ${pythonPath}...`);
      this.daemonProcess = spawn(
        pythonPath,
        [this.ttsScriptPath, '--daemon'],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            HF_HUB_OFFLINE: '1',
            TRANSFORMERS_OFFLINE: '1',
            TOKENIZERS_PARALLELISM: 'false',
          },
        }
      );

      this.daemonProcess.stdout?.on('data', (data: Buffer) => {
        this.daemonStdoutBuffer += data.toString();
        const lines = this.daemonStdoutBuffer.split('\n');
        this.daemonStdoutBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const parsed = JSON.parse(trimmed);
            if (parsed.ready) {
              this.daemonReady = true;
              console.log('✨ [SystemSpeaker] Kokoro realistic female voice (af_heart) daemon ready!');
            } else if (parsed.id && this.pendingRequests.has(parsed.id)) {
              const resolver = this.pendingRequests.get(parsed.id);
              this.pendingRequests.delete(parsed.id);
              if (resolver) {
                resolver(parsed.success && parsed.audio_path ? parsed.audio_path : null);
              }
            }
          } catch {
            // Non-JSON output filtered out
          }
        }
      });

      this.daemonProcess.stderr?.on('data', (data: Buffer) => {
        const msg = data.toString().trim();
        if (msg.includes('Warming up') || msg.includes('ready')) {
          console.log(`[SystemSpeaker:Kokoro] ${msg}`);
        }
      });

      this.daemonProcess.on('close', (code) => {
        console.warn(`[SystemSpeaker] Kokoro daemon exited with code ${code}. Auto-restarting in 1.5s...`);
        this.daemonProcess = null;
        this.daemonReady = false;
        for (const [, resolver] of this.pendingRequests.entries()) {
          resolver(null);
        }
        this.pendingRequests.clear();

        if (this.respawnTimer) clearTimeout(this.respawnTimer);
        this.respawnTimer = setTimeout(() => {
          this.initDaemon();
        }, 1500);
      });

      this.daemonProcess.on('error', (err) => {
        console.warn('[SystemSpeaker] Kokoro daemon error:', err.message);
        this.daemonProcess = null;
        this.daemonReady = false;
      });
    } catch (err: any) {
      console.warn('[SystemSpeaker] Failed to start Kokoro daemon:', err.message);
    }
  }

  public async waitForDaemonReady(maxWaitMs = 5000): Promise<boolean> {
    if (this.daemonReady && this.daemonProcess) return true;
    if (!this.daemonProcess) {
      this.initDaemon();
    }
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      if (this.daemonReady && this.daemonProcess) return true;
      await new Promise((r) => setTimeout(r, 60));
    }
    return this.daemonReady;
  }

  private async synthesizeWithDaemon(
    text: string,
    emotion: string,
    outPath: string
  ): Promise<string | null> {
    const isReady = await this.waitForDaemonReady(5000);
    if (!isReady || !this.daemonProcess) {
      return null;
    }

    const reqId = `tts_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const payload = JSON.stringify({
      id: reqId,
      text,
      emotion,
      out: outPath,
      voice: 'af_heart',
    }) + '\n';

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(reqId)) {
          this.pendingRequests.delete(reqId);
          console.warn('[SystemSpeaker] Daemon synthesis timed out, using instant fallback.');
          resolve(null);
        }
      }, 7000);

      this.pendingRequests.set(reqId, (resultPath) => {
        clearTimeout(timeout);
        resolve(resultPath);
      });

      try {
        this.daemonProcess?.stdin?.write(payload);
      } catch {
        clearTimeout(timeout);
        this.pendingRequests.delete(reqId);
        resolve(null);
      }
    });
  }

  private async synthesizeSpeech(text: string, emotion: string): Promise<string | null> {
    const tempAudioPath = path.join(
      os.tmpdir(),
      `january_voice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.wav`
    );

    // 1. Primary Engine: Kokoro Neural Female Voice Daemon (~150-350ms)
    try {
      const kokoroPath = await this.synthesizeWithDaemon(text, emotion, tempAudioPath);
      if (kokoroPath && fs.existsSync(kokoroPath) && fs.statSync(kokoroPath).size > 100) {
        return kokoroPath;
      }
    } catch (err: any) {
      console.warn('[SystemSpeaker] Kokoro synthesis notice:', err.message);
    }

    // 2. Instant Zero-Lag Fallback: macOS CoreAudio native say (~50ms)
    try {
      const fallbackFile = path.join(
        os.tmpdir(),
        `january_say_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.aiff`
      );
      const isDevanagari = /[\u0900-\u097F]/.test(text);
      const voice = isDevanagari ? 'Lekha' : 'Samantha';
      await new Promise<void>((resolve) => {
        const proc = spawn('say', ['-v', voice, '-o', fallbackFile, text]);
        proc.on('close', () => resolve());
        proc.on('error', () => resolve());
      });
      if (fs.existsSync(fallbackFile) && fs.statSync(fallbackFile).size > 100) {
        return fallbackFile;
      }
    } catch (e: any) {
      console.warn('[SystemSpeaker] Fallback say notice:', e.message);
    }

    return null;
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
   * emojis, and raw filesystem paths so physical speakers speak naturally.
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

    // Strip emotion metadata tags
    clean = clean.replace(/\[\s*(?:emotion|feeling|mood|tone)\s*:[^\]]+\]/gi, '');
    clean = clean.replace(/\(\s*(?:emotion|feeling|mood|tone)\s*:[^)]+\)/gi, '');
    clean = clean.replace(/(?:^|\s)(?:emotion|feeling|mood|tone)\s*:\s*[a-zA-Z_-]+\b\s*[:.-]?\s*/gi, ' ');
    clean = clean.replace(/^(?:I(?:\s*'?\s*m|\s+am)\s+(?:feeling|in\s+a\s+state\s+of)\s+|Feeling\s+|My\s+current\s+(?:mood|emotion)\s+is\s+|Current\s+emotion:\s*)(?:joyful|joy|curious|empathetic|focused|concerned|calm|neutral)[,.]?\s*/gi, '');

    // Strip code syntax or file export listings
    clean = clean
      .split('\n')
      .filter((line) => {
        const trimmed = line.trim();
        if (
          /^[-*•]?\s*(?:\.(?:blend|obj|mtl|glb|gltf|fbx|stl|dae|py|c|cpp|h|ts|js|json|png|jpg|jpeg|webp|pdf|txt|csv)|\b(?:blend|file|export|output|saved\s+to|path|project|mesh|realtime)\b)/i.test(trimmed) &&
          /(?:\/|\\|\.[a-zA-Z0-9]{2,4}\b)/.test(trimmed)
        ) {
          return false;
        }

        if (/^(?:[-*•]\s*)?(?:[a-zA-Z]:\\|\/|~\/|\.\.?\/)(?:[^\s:]+\/)*[^\s:]+\.[a-zA-Z0-9]+$/i.test(trimmed)) {
          return false;
        }

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

    clean = clean.replace(/\s*\((?:[a-zA-Z]:\\|\/|~\/|\.\.?\/)[^)]+\)/g, '');
    clean = clean.replace(/(?:^|\s)(?:\/(?:Users|home|Volumes|private|tmp|bin|usr|System|Library|var|etc|opt)\/[^\s,;:)]+)/g, ' ');
    clean = clean.replace(/(?:^|\s)(?:[a-zA-Z]:\\[^\s,;:)]+)/g, ' ');
    clean = clean.replace(/(?:^|\s)(?:(?:\.|\.\.|~)?\/[a-zA-Z0-9_.-]+)+(?:\/[a-zA-Z0-9_.-]+)*\.[a-zA-Z0-9]+/g, ' ');

    clean = clean.replace(/\b(?:saved\s+(?:to|at)|exported\s+to|file\s+path\s+is)\s*[:.]?/gi, 'saved.');
    clean = clean.replace(/\bto\s+and\b/gi, 'and');
    clean = clean.replace(/\bsaved\s+to\s+and\b/gi, 'saved and');
    clean = clean.replace(/\s*:\s*\./g, '.');

    // Strip markdown formatting symbols and emojis
    clean = clean
      .replace(/[#*_~>`]/g, '')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (hadCode && (!clean || clean.length < 5)) {
      clean = "I've generated the code and loaded the live interactive preview for you on screen.";
    }

    if (!clean || clean.length < 3) {
      clean = "I have created and saved the file for you on your system.";
    }

    return { speechText: clean, hadCode };
  }

  /**
   * Natural utterance preparation: Preserves single sentences and cohesive thoughts
   * as a single continuous speech unit, eliminating artificial fragmentation and robotic stutter.
   */
  private splitIntoSentences(text: string): string[] {
    const raw = text.trim();
    if (!raw) return [];
    if (raw.length <= 250) return [raw];

    // For longer multi-sentence paragraphs, split ONLY at true sentence boundaries
    // (. ! ? followed by space and capital letter or end-of-string).
    // Never split on numbers (e.g. 3.10), abbreviations, or intra-sentence punctuation (commas, semicolons, dashes).
    const sentences = raw
      .split(/(?<=[.!?])\s+(?=[A-Z\u0900-\u097F"'])/g)
      .map((s) => s.trim())
      .filter(Boolean);

    if (sentences.length <= 1) return [raw];

    // Group short adjacent sentences so each utterance is a complete, natural thought
    // (minimum ~120 characters per chunk unless it's the final sentence).
    const merged: string[] = [];
    let current = '';

    for (const sent of sentences) {
      if (!current) {
        current = sent;
      } else if (current.length + sent.length < 200) {
        current = `${current} ${sent}`;
      } else {
        merged.push(current);
        current = sent;
      }
    }
    if (current) {
      merged.push(current);
    }

    return merged.length > 0 ? merged : [raw];
  }

  /**
   * Enqueue sentences for immediate streaming speech playback with ultra-low latency (<250ms)
   */
  public async speakText(
    text: string,
    options?: { pitch?: string; rate?: string; emotion?: string }
  ): Promise<void> {
    if (this.isMuted) return;
    if (!text || !text.trim()) return;

    const { speechText } = this.sanitizeForSpeech(text);
    if (!speechText || !speechText.trim()) return;

    // Immediately alert coordinator so physical microphone mutes before sound plays
    this.emit('will_speak', { text: speechText });
    this.isSpeaking = true;

    const sentences = this.splitIntoSentences(speechText);
    const emotion = options?.emotion || 'neutral';

    return new Promise((resolve) => {
      let remaining = sentences.length;
      const newItems: SpeechQueueItem[] = [];

      for (const sent of sentences) {
        const item: SpeechQueueItem = {
          text: sent,
          options,
          resolve: () => {
            remaining--;
            if (remaining <= 0) {
              resolve();
            }
          },
        };
        newItems.push(item);
        this.speechQueue.push(item);
      }

      // Pre-fetch synthesis for the first item immediately
      if (newItems.length > 0 && !newItems[0].audioPromise) {
        newItems[0].audioPromise = this.synthesizeSpeech(newItems[0].text, emotion);
      }

      if (!this.isProcessingQueue) {
        this.processQueue();
      }
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.speechQueue.length === 0) return;
    this.isProcessingQueue = true;

    while (this.speechQueue.length > 0) {
      const current = this.speechQueue.shift();
      if (!current) break;

      const emotion = current.options?.emotion || 'neutral';

      // Concurrently pre-fetch the next item in the queue while this chunk prepares/plays
      const next = this.speechQueue[0];
      if (next && !next.audioPromise) {
        next.audioPromise = this.synthesizeSpeech(next.text, next.options?.emotion || emotion);
      }

      try {
        console.log(`🎙️ [SystemSpeaker:Kokoro] Speaking (emotion: ${emotion}): "${current.text.slice(0, 50)}..."`);
        this.isSpeaking = true;
        this.emit('start');

        const audioPath = await (current.audioPromise || this.synthesizeSpeech(current.text, emotion));

        if (audioPath && fs.existsSync(audioPath)) {
          this.broadcastAudio(audioPath, current.text);
          await this.playAudioFile(audioPath);
        } else {
          // Emergency direct voice output if file synthesis failed
          await this.playDirectSay(current.text);
        }
      } catch (err: any) {
        console.warn('[SystemSpeaker] Utterance playback error:', err.message);
      }

      current.resolve();
    }

    this.isProcessingQueue = false;
    this.isSpeaking = false;
    this.emit('end');
  }

  private broadcastAudio(audioPath: string, text: string): void {
    try {
      const audioBuffer = fs.readFileSync(audioPath);
      if (audioBuffer && audioBuffer.length > 50) {
        const mimeType = audioPath.endsWith('.mp3') ? 'audio/mp3' : audioPath.endsWith('.aiff') ? 'audio/aiff' : 'audio/wav';
        this.emit('audio_output', {
          data: audioBuffer.toString('base64'),
          mimeType,
          text,
        });
      }
    } catch (e: any) {
      console.warn('[SystemSpeaker] Error broadcasting audio chunk:', e.message);
    }
  }

  private playAudioFile(audioPath: string): Promise<void> {
    return new Promise((resolve) => {
      const afplayProc = spawn('afplay', [audioPath]);
      this.currentProcess = afplayProc;

      const cleanup = () => {
        this.currentProcess = null;
        try {
          if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
        } catch {}
        resolve();
      };

      afplayProc.on('close', cleanup);
      afplayProc.on('error', (err) => {
        console.warn('[SystemSpeaker] afplay error:', err.message);
        cleanup();
      });
    });
  }

  private playDirectSay(text: string): Promise<void> {
    return new Promise((resolve) => {
      const isDevanagari = /[\u0900-\u097F]/.test(text);
      const voice = isDevanagari ? 'Lekha' : 'Samantha';
      const sayProc = spawn('say', ['-v', voice, text]);
      this.currentProcess = sayProc;

      const finish = () => {
        this.currentProcess = null;
        resolve();
      };

      sayProc.on('close', finish);
      sayProc.on('error', finish);
    });
  }

  /**
   * Play a 24kHz PCM audio chunk received from Gemini Live directly through the speakers
   */
  public playPcmChunk(pcmBase64: string): void {
    if (this.isMuted) return;
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
        } catch {}
      });
    } catch (err: any) {
      console.error('[SystemSpeaker] Error playing PCM chunk:', err.message);
    }
  }

  /**
   * Stop any current audio playback immediately (interruption)
   */
  public stopPlayback(): void {
    this.speechQueue.forEach((item) => item.resolve());
    this.speechQueue = [];
    this.isProcessingQueue = false;

    if (this.currentProcess) {
      console.log('[SystemSpeaker] Stopping current speaker playback.');
      try {
        this.currentProcess.kill('SIGTERM');
      } catch {}
      this.currentProcess = null;
    }
    this.isSpeaking = false;
    this.emit('end');
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  private createWavHeader(dataLength: number, sampleRate: number, numChannels: number, bitsPerSample: number): Buffer {
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const buffer = Buffer.alloc(44);

    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataLength, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
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
