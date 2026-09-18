/**
 * AudioOutputManager
 * Receives 24kHz mono 16-bit PCM chunks from Gemini Live API over WebSockets,
 * decodes and schedules seamless low-latency playback via Web Audio API,
 * with jitter buffer compensation and immediate interruption flushing.
 */
export class AudioOutputManager {
  private audioContext: AudioContext | null = null;
  private nextPlayTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private onLevelCallback: ((level: number) => void) | null = null;
  private analyser: AnalyserNode | null = null;
  private isMuted = false;

  constructor(onLevel?: (level: number) => void) {
    this.onLevelCallback = onLevel || null;
  }

  private initContext(): void {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000, // Native Gemini Live audio output frequency
      });

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.connect(this.audioContext.destination);

      if (this.onLevelCallback) {
        this.startLevelMonitor();
      }
    }

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  /**
   * Queue and seamlessly schedule an incoming 24kHz PCM base64 chunk
   */
  public playChunk(base64Data: string): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.audioContext) return;

    try {
      // Decode Base64 string to ArrayBuffer
      const binaryString = window.atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert Int16 little-endian bytes to Float32Array
      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      // Create Web Audio Buffer
      const sampleRate = 24000;
      const audioBuffer = this.audioContext.createBuffer(1, float32Array.length, sampleRate);
      audioBuffer.copyToChannel(float32Array, 0);

      // Create BufferSourceNode
      const sourceNode = this.audioContext.createBufferSource();
      sourceNode.buffer = audioBuffer;

      // Connect to analyser and speakers
      if (this.analyser) {
        sourceNode.connect(this.analyser);
      } else {
        sourceNode.connect(this.audioContext.destination);
      }

      // Schedule seamless continuous playback
      const currentTime = this.audioContext.currentTime;
      if (this.nextPlayTime < currentTime) {
        // Small initial buffer to absorb network jitter (~30ms)
        this.nextPlayTime = currentTime + 0.03;
      }

      sourceNode.start(this.nextPlayTime);
      this.activeSources.push(sourceNode);

      sourceNode.onended = () => {
        const index = this.activeSources.indexOf(sourceNode);
        if (index > -1) {
          this.activeSources.splice(index, 1);
        }
      };

      // Advance schedule cursor
      this.nextPlayTime += audioBuffer.duration;
    } catch (err: any) {
      console.error('[AudioOutputManager] Failed to decode and schedule audio chunk:', err);
    }
  }

  /**
   * Stop all playing audio immediately and reset buffer (called on user interrupt)
   */
  public flush(): void {
    console.log('[AudioOutputManager] Flushing audio playback queue.');
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Source might have already ended
      }
    }
    this.activeSources = [];
    if (this.audioContext) {
      this.nextPlayTime = this.audioContext.currentTime;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * Speak text out loud via browser SpeechSynthesis with emotional prosody
   */
  public speakSynthesizedText(text: string, emotion?: string): void {
    if (this.isMuted || !('speechSynthesis' in window) || !text.trim()) return;

    // Sanitize code blocks
    let clean = text
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]+`/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/[#*_~>`]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!clean || clean.length < 2) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);

    // Detect language script for Web Speech API
    let detectedLang = 'en-US';
    if (/[\u0900-\u097F]/.test(clean)) {
      if (/आहे|नाही|काय|मी|तुम्ही|करणार|झाले|कसे|आणि/.test(clean)) {
        detectedLang = 'mr-IN';
      } else if (/छ|छैन|गर्ने|हुने|भयो|तपाईं|हामी/.test(clean)) {
        detectedLang = 'ne-NP';
      } else {
        detectedLang = 'hi-IN';
      }
    } else if (/[\u0980-\u09FF]/.test(clean)) {
      detectedLang = 'bn-IN';
    } else if (/[\u0A80-\u0AFF]/.test(clean)) {
      detectedLang = 'gu-IN';
    } else if (/[\u0A00-\u0A7F]/.test(clean)) {
      detectedLang = 'pa-IN';
    } else if (/[\u0B00-\u0B7F]/.test(clean)) {
      detectedLang = 'or-IN';
    } else if (/[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(clean)) {
      detectedLang = 'ur-IN';
    } else if (/[\u0C80-\u0CFF]/.test(clean)) {
      detectedLang = 'kn-IN';
    } else if (/[\u0B80-\u0BFF]/.test(clean)) {
      detectedLang = 'ta-IN';
    } else if (/[\u0C00-\u0C7F]/.test(clean)) {
      detectedLang = 'te-IN';
    } else if (/[\u0D00-\u0D7F]/.test(clean)) {
      detectedLang = 'ml-IN';
    }

    utterance.lang = detectedLang;

    // Emotional prosody for browser speech
    if (emotion === 'joy') {
      utterance.pitch = 1.15;
      utterance.rate = 1.05;
    } else if (emotion === 'empathetic') {
      utterance.pitch = 0.9;
      utterance.rate = 0.92;
    } else if (emotion === 'curious') {
      utterance.pitch = 1.08;
      utterance.rate = 1.0;
    } else if (emotion === 'calm') {
      utterance.pitch = 0.85;
      utterance.rate = 0.88;
    } else {
      utterance.pitch = 1.0;
      utterance.rate = 1.0;
    }

    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find((v) =>
      v.lang.startsWith(detectedLang.split('-')[0]) ||
      (detectedLang === 'en-US' && (v.name.includes('Samantha') || v.name.includes('Victoria') || v.name.includes('Google US')))
    );
    if (preferred) utterance.voice = preferred;

    window.speechSynthesis.speak(utterance);
  }

  public setMute(muted: boolean): void {
    this.isMuted = muted;
    if (muted) {
      this.flush();
    }
  }

  public isPlaying(): boolean {
    return this.activeSources.length > 0;
  }

  private startLevelMonitor(): void {
    const dataArray = new Uint8Array(this.analyser!.frequencyBinCount);

    const update = () => {
      if (this.analyser && this.activeSources.length > 0) {
        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length / 255;
        if (this.onLevelCallback) {
          this.onLevelCallback(avg);
        }
      } else if (this.onLevelCallback && this.activeSources.length === 0) {
        this.onLevelCallback(0);
      }

      requestAnimationFrame(update);
    };

    requestAnimationFrame(update);
  }
}
