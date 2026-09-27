export class AudioOutputManager {
  private audioCtx: AudioContext | null = null;
  private onLevelUpdate: (level: number) => void;
  private currentSource: AudioBufferSourceNode | null = null;
  private isMuted: boolean = false;
  private playingCount: number = 0;

  constructor(onLevelUpdate: (level: number) => void) {
    this.onLevelUpdate = onLevelUpdate;
  }

  private initContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass({ sampleRate: 24000 });
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.flush();
    }
  }

  public isPlaying(): boolean {
    return this.playingCount > 0;
  }

  public playChunk(base64Pcm: string) {
    if (this.isMuted) return;

    try {
      this.initContext();
      if (!this.audioCtx) return;

      const binary = atob(base64Pcm);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      // Convert 16-bit PCM to float audio buffer
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      let sumSquares = 0;

      for (let i = 0; i < int16.length; i++) {
        const sample = int16[i] / 32768.0;
        float32[i] = sample;
        sumSquares += sample * sample;
      }

      // Compute RMS audio level
      const rms = Math.sqrt(sumSquares / int16.length);
      this.onLevelUpdate(Math.min(rms * 4.0, 1.0));

      const buffer = this.audioCtx.createBuffer(1, float32.length, 24000);
      buffer.getChannelData(0).set(float32);

      const source = this.audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioCtx.destination);

      this.playingCount++;
      source.onended = () => {
        this.playingCount = Math.max(0, this.playingCount - 1);
        if (this.playingCount === 0) {
          this.onLevelUpdate(0);
        }
      };

      source.start();
      this.currentSource = source;
    } catch (err: any) {
      console.warn('[AudioOutputManager] Failed to decode audio chunk:', err.message);
    }
  }

  public speakSynthesizedText(text: string, emotion?: string) {
    if (this.isMuted || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = emotion === 'joy' ? 1.2 : emotion === 'concerned' ? 0.9 : 1.0;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice =
      voices.find((v) => v.name.includes('Samantha') || v.name.includes('Victoria')) || voices[0];
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onstart = () => {
      this.playingCount++;
      this.onLevelUpdate(0.65);
    };

    utterance.onend = () => {
      this.playingCount = Math.max(0, this.playingCount - 1);
      this.onLevelUpdate(0);
    };

    window.speechSynthesis.speak(utterance);
  }

  public flush() {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch (e) {}
      this.currentSource = null;
    }
    this.playingCount = 0;
    this.onLevelUpdate(0);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}
