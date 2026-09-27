import { EventEmitter } from 'events';
import { config } from '../config.js';

export interface ElevenLabsVoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

export const ELEVENLABS_FEMALE_VOICES = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice' },
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica' },
  { id: 'hpp4J3VqNfWAUOO0d1Us', name: 'Bella' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura' },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda' },
  { id: 'gJx1vCzNCD1EQHT212Ls', name: 'Ava' },
];

export class ElevenLabsEngine extends EventEmitter {
  private isSpeaking = false;
  private quotaExceededUntil = 0;

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
   * and automatic fallback across free female voicepacks
   */
  public async synthesize(
    text: string,
    options?: { emotion?: string; voiceId?: string; modelId?: string }
  ): Promise<Buffer | null> {
    const apiKey = config.elevenlabsApiKey;
    if (!apiKey) {
      return null;
    }

    // Circuit breaker: If free quota was exhausted within last 5 minutes, skip in 0ms
    if (Date.now() < this.quotaExceededUntil) {
      return null;
    }

    const primaryVoiceId = options?.voiceId || config.elevenlabsVoiceId || 'OZ0L6eISlOejga3XjDFt';
    const modelId = options?.modelId || config.elevenlabsModelId || 'eleven_turbo_v2_5';
    const voiceSettings = this.getEmotionalVoiceSettings(options?.emotion);

    // List of candidate free female voices in fallback order with user's voice ID first
    const candidateVoices = [
      primaryVoiceId,
      'OZ0L6eISlOejga3XjDFt',
      'EXAVITQu4vr4xnSDxMaL', // Sarah
      '21m00Tcm4TlvDq8ikWAM', // Rachel
      'Xb7hH8MSUJpSbSDYk0k2', // Alice
      'cgSgspJ2msm6clMCkdW9', // Jessica
      'hpp4J3VqNfWAUOO0d1Us', // Bella
    ].filter((v, i, self) => self.indexOf(v) === i); // unique

    const makeRequest = async (targetVoice: string) => {
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${targetVoice}/stream?optimize_streaming_latency=3`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      try {
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
      } catch (e) {
        clearTimeout(timeout);
        throw e;
      }
    };

    for (const voiceId of candidateVoices) {
      try {
        const response = await makeRequest(voiceId);

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`[ElevenLabs] API returned ${response.status} for voice "${voiceId}": ${errText.slice(0, 160)}`);

          // Check for quota exhaustion
          if (errText.includes('quota_exceeded') || errText.includes('exceeds your quota') || response.status === 429) {
            console.log(`ℹ️ [ElevenLabs] Character quota exhausted. Activating in-browser female voice fallback.`);
            this.quotaExceededUntil = Date.now() + 5 * 60 * 1000; // 5 min cooldown
            return null;
          }

          // If paid plan required, continue loop to next free female voicepack
          if (response.status === 402 || errText.includes('paid_plan_required')) {
            console.log(`ℹ️ [ElevenLabs] Voice "${voiceId}" requires paid tier. Trying next free female voicepack...`);
            continue;
          }

          // If 400 invalid voice, try next
          if (response.status === 400 && errText.includes('voice_id')) {
            continue;
          }

          return null;
        }

        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > 0) {
          return Buffer.from(arrayBuffer);
        }
      } catch (err: any) {
        console.warn(`[ElevenLabs] Synthesis error with voice "${voiceId}": ${err.message}`);
      }
    }

    return null;
  }

  /**
   * Synthesizes audio buffer via ElevenLabs
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

    this.emit('audio_buffer', audioBuffer);
    return true;
  }

  /**
   * Stops current playback immediately
   */
  public stopPlayback(): void {
    this.isSpeaking = false;
    this.emit('end');
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking;
  }
}

export const elevenLabsEngine = new ElevenLabsEngine();
