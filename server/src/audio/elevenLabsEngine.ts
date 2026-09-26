import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { EventEmitter } from 'events';
import { config } from '../config.js';

export interface ElevenLabsVoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

export class ElevenLabsEngine extends EventEmitter {
  private currentProcess: ChildProcess | null = null;
  private isSpeaking = false;

  /**
   * Maps January's 7 Emotional Archetypes directly to ElevenLabs Voice Parameters
   */
  public getEmotionalVoiceSettings(emotion?: string): ElevenLabsVoiceSettings {
    const norm = (emotion || '').toLowerCase().trim();

    switch (norm) {
      case 'joy':
        // Lively, dynamic, expressive with higher pitch variety
        return {
          stability: 0.35,
          similarity_boost: 0.82,
          style: 0.45,
          use_speaker_boost: true,
        };

      case 'curious':
        // Inquisitive, exploratory intonation
        return {
          stability: 0.45,
          similarity_boost: 0.85,
          style: 0.30,
          use_speaker_boost: true,
        };

      case 'empathetic':
        // Warm, gentle, caring and reassuring
        return {
          stability: 0.58,
          similarity_boost: 0.88,
          style: 0.35,
          use_speaker_boost: true,
        };

      case 'focused':
        // Crisp, precise, articulate, and technical
        return {
          stability: 0.68,
          similarity_boost: 0.85,
          style: 0.15,
          use_speaker_boost: true,
        };

      case 'calm':
        // Steady, relaxed, peaceful, and grounded
        return {
          stability: 0.75,
          similarity_boost: 0.85,
          style: 0.10,
          use_speaker_boost: true,
        };

      case 'concerned':
        // Careful, hesitant, alert, and serious
        return {
          stability: 0.40,
          similarity_boost: 0.80,
          style: 0.35,
          use_speaker_boost: true,
        };

      case 'neutral':
      default:
        // Balanced conversational naturalism
        return {
          stability: 0.50,
          similarity_boost: 0.85,
          style: 0.20,
          use_speaker_boost: true,
        };
    }
  }

  /**
   * Synthesizes audio using ElevenLabs API with emotional voice parameter modulation
   */
  public async synthesize(
    text: string,
    options?: { emotion?: string; voiceId?: string; modelId?: string }
  ): Promise<Buffer | null> {
    const apiKey = config.elevenlabsApiKey;
    if (!apiKey) {
      return null;
    }

    const voiceId = options?.voiceId || config.elevenlabsVoiceId || '2zRM7PkgwBPiau2jvVXc';
    const modelId = options?.modelId || config.elevenlabsModelId || 'eleven_turbo_v2_5';
    const voiceSettings = this.getEmotionalVoiceSettings(options?.emotion);

    const makeRequest = async (targetVoice: string) => {
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${targetVoice}/stream?optimize_streaming_latency=3`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 14000);

      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: voiceSettings,
        }),
      });

      clearTimeout(timeout);
      return response;
    };

    try {
      let response = await makeRequest(voiceId);

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[ElevenLabs] API returned ${response.status} for voice "${voiceId}": ${errText.slice(0, 160)}`);

        // If library voice requires paid plan on ElevenLabs, seamlessly fallback to premier high-fidelity neural voice
        if (response.status === 402 || errText.includes('paid_plan_required')) {
          console.log(`ℹ️ [ElevenLabs] Library voice "${voiceId}" requires a paid tier. Falling back to premier realistic neural voice "Sarah" (EXAVITQu4vr4xnSDxMaL).`);
          response = await makeRequest('EXAVITQu4vr4xnSDxMaL');
        }

        if (!response.ok) {
          return null;
        }
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err: any) {
      console.warn(`[ElevenLabs] Synthesis error: ${err.message}`);
      return null;
    }
  }

  /**
   * Synthesizes and immediately plays the voice through macOS afplay
   */
  public async speak(
    text: string,
    options?: { emotion?: string; voiceId?: string; modelId?: string }
  ): Promise<boolean> {
    const emotionName = options?.emotion || 'natural';
    const settings = this.getEmotionalVoiceSettings(emotionName);
    console.log(`🎙️ [ElevenLabs] Synthesizing with Voice: ${config.elevenlabsVoiceId || '2zRM7PkgwBPiau2jvVXc'} [Emotion: ${emotionName.toUpperCase()} | Stability: ${settings.stability}, Style: ${settings.style}]`);

    const audioBuffer = await this.synthesize(text, options);
    if (!audioBuffer || audioBuffer.length === 0) {
      return false;
    }

    const tempFile = path.join(os.tmpdir(), `january_elevenlabs_${Date.now()}.mp3`);
    fs.writeFileSync(tempFile, audioBuffer);

    this.isSpeaking = true;
    this.emit('start');

    return new Promise((resolve) => {
      const proc = spawn('afplay', [tempFile]);
      this.currentProcess = proc;

      proc.on('close', () => {
        this.currentProcess = null;
        this.isSpeaking = false;
        try {
          if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        } catch {}
        this.emit('end');
        resolve(true);
      });

      proc.on('error', (err) => {
        console.warn('[ElevenLabs] afplay playback error:', err.message);
        this.currentProcess = null;
        this.isSpeaking = false;
        try {
          if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        } catch {}
        this.emit('end');
        resolve(false);
      });
    });
  }

  /**
   * Stops current playback immediately
   */
  public stopPlayback(): void {
    if (this.currentProcess) {
      console.log('[ElevenLabs] Stopping current speaker playback.');
      this.currentProcess.kill('SIGTERM');
      this.currentProcess = null;
    }
    this.isSpeaking = false;
    this.emit('end');
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking;
  }
}

export const elevenLabsEngine = new ElevenLabsEngine();
