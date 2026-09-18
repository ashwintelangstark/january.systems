import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';

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
   * Sanitize text for speech: Strips code blocks, syntax tokens, and HTML tags
   * so physical speakers never read out raw code or programming tokens.
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

    // Strip common programming boilerplate lines if present
    clean = clean
      .split('\n')
      .filter((line) => {
        const trimmed = line.trim();
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

    // Clean up multiple spaces and markdown symbols (#, *, _, >)
    clean = clean
      .replace(/[#*_~>`]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // If text was primarily code and left empty, provide a clean verbal confirmation
    if (hadCode && (!clean || clean.length < 5)) {
      clean = "I've generated the code and loaded the live interactive preview for you on screen.";
    }

    return { speechText: clean, hadCode };
  }

  /**
   * Speak text out loud through the laptop's physical speakers with emotional prosody
   */
  public async speakText(
    text: string,
    options?: { pitch?: string; rate?: string; emotion?: string }
  ): Promise<void> {
    if (!text || !text.trim()) return;

    const { speechText } = this.sanitizeForSpeech(text);
    if (!speechText || !speechText.trim()) return;

    this.stopPlayback(); // Interrupt any ongoing speech
    this.isSpeaking = true;
    this.emit('start');

    const pitch = options?.pitch || '+0Hz';
    const rate = options?.rate || '+0%';

    console.log(`🔊 [SystemSpeaker] Speaking (${options?.emotion || 'natural'}, pitch: ${pitch}, rate: ${rate}): "${speechText.slice(0, 60)}..."`);

    return new Promise((resolve) => {
      // Use uv to execute tts_engine.py with edge-tts
      const uvPath = fs.existsSync('/Users/ashwintelangstark/.local/bin/uv')
        ? '/Users/ashwintelangstark/.local/bin/uv'
        : 'uv';

      const proc = spawn(
        uvPath,
        ['run', '--with', 'edge-tts', 'python3', this.ttsScriptPath, speechText, '--pitch', pitch, '--rate', rate],
        { stdio: ['ignore', 'pipe', 'pipe'] }
      );

      this.currentProcess = proc;

      proc.on('close', () => {
        this.isSpeaking = false;
        this.currentProcess = null;
        this.emit('end');
        resolve();
      });

      proc.on('error', (err) => {
        console.warn('[SystemSpeaker] Error running TTS engine, falling back to native say:', err.message);
        // Fallback to native macOS say command
        const sayProc = spawn('say', ['-v', 'Samantha', speechText]);
        this.currentProcess = sayProc;
        sayProc.on('close', () => {
          this.isSpeaking = false;
          this.currentProcess = null;
          this.emit('end');
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
    if (this.currentProcess) {
      console.log('[SystemSpeaker] Stopping current speaker playback.');
      this.currentProcess.kill('SIGTERM');
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
