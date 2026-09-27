export class AudioOutputManager {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private onLevelUpdate: (level: number) => void;
  private currentSource: AudioBufferSourceNode | null = null;
  private currentHtmlAudio: HTMLAudioElement | null = null;
  private isMuted: boolean = false;
  private playingCount: number = 0;
  private animFrameId: number | null = null;

  constructor(onLevelUpdate: (level: number) => void) {
    this.onLevelUpdate = onLevelUpdate;

    const unlock = () => {
      this.initContext();
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', unlock, { once: true });
      window.addEventListener('keydown', unlock, { once: true });
    }
  }

  private initContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.connect(this.audioCtx.destination);
      this.analyser.connect(this.gainNode);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  private startLevelMeter() {
    if (this.animFrameId) return;

    const update = () => {
      if (!this.analyser || this.playingCount === 0 || this.isMuted) {
        this.onLevelUpdate(0);
        this.animFrameId = null;
        return;
      }

      const data = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(data);

      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        sum += data[i];
      }
      const avg = sum / data.length;
      // Normalizes 0..128 frequency range into a smooth 0..1 scale for the 20,000 particle cosmic orb
      const level = Math.min(1.0, (avg / 120.0) * 1.5);
      this.onLevelUpdate(level);

      this.animFrameId = requestAnimationFrame(update);
    };

    this.animFrameId = requestAnimationFrame(update);
  }

  private stopLevelMeter() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.onLevelUpdate(0);
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    if (this.gainNode) {
      this.gainNode.gain.value = muted ? 0 : 1;
    }
    if (muted) {
      this.flush();
    }
  }

  public isPlaying(): boolean {
    return this.playingCount > 0;
  }

  public async playChunk(base64Data: string, mimeType?: string): Promise<void> {
    if (this.isMuted || !base64Data) return;

    try {
      this.initContext();
      if (!this.audioCtx) return;

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume().catch(() => {});
      }

      const binary = atob(base64Data);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      // Check if MP3 or compressed format
      const isMpeg =
        !mimeType ||
        mimeType.includes('mpeg') ||
        mimeType.includes('mp3') ||
        (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || // 'ID3' header
        (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0); // MP3 frame sync

      if (isMpeg) {
        try {
          // Native browser Web Audio MP3 decoding
          const audioBuffer = await this.audioCtx.decodeAudioData(bytes.buffer.slice(0));
          const source = this.audioCtx.createBufferSource();
          source.buffer = audioBuffer;

          if (this.analyser) {
            source.connect(this.analyser);
          } else {
            source.connect(this.audioCtx.destination);
          }

          this.playingCount++;
          this.startLevelMeter();

          source.onended = () => {
            this.playingCount = Math.max(0, this.playingCount - 1);
            if (this.playingCount === 0) {
              this.stopLevelMeter();
            }
          };

          source.start(0);
          this.currentSource = source;
          return;
        } catch (decodeErr: any) {
          console.warn('[AudioOutputManager] decodeAudioData fallback to HTML5 Audio:', decodeErr.message);

          // Fallback to HTML5 Audio element
          const audio = new Audio(`data:audio/mpeg;base64,${base64Data}`);
          this.currentHtmlAudio = audio;
          this.playingCount++;
          this.onLevelUpdate(0.65);

          audio.onended = () => {
            this.playingCount = Math.max(0, this.playingCount - 1);
            if (this.playingCount === 0) {
              this.onLevelUpdate(0);
            }
          };

          await audio.play().catch((err) => console.warn('HTML5 Audio play error:', err.message));
          return;
        }
      }

      // Raw 16-bit PCM (e.g., from Gemini Live 24kHz)
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);

      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
      }

      const buffer = this.audioCtx.createBuffer(1, float32.length, 24000);
      buffer.getChannelData(0).set(float32);

      const source = this.audioCtx.createBufferSource();
      source.buffer = buffer;

      if (this.analyser) {
        source.connect(this.analyser);
      } else {
        source.connect(this.audioCtx.destination);
      }

      this.playingCount++;
      this.startLevelMeter();

      source.onended = () => {
        this.playingCount = Math.max(0, this.playingCount - 1);
        if (this.playingCount === 0) {
          this.stopLevelMeter();
        }
      };

      source.start();
      this.currentSource = source;
    } catch (err: any) {
      console.warn('[AudioOutputManager] Error playing audio chunk:', err.message);
    }
  }

  public speakSynthesizedText(text: string, emotion?: string): void {
    if (this.isMuted || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = emotion === 'joy' ? 1.15 : emotion === 'concerned' ? 0.92 : 1.0;

    let voices = window.speechSynthesis.getVoices();
    const findFemaleVoice = (list: SpeechSynthesisVoice[]) => {
      return (
        list.find((v) => /samantha/i.test(v.name)) ||
        list.find((v) => /victoria/i.test(v.name)) ||
        list.find((v) => /karen/i.test(v.name)) ||
        list.find((v) => /female/i.test(v.name)) ||
        list.find((v) => /zira/i.test(v.name)) ||
        list.find((v) => /moira/i.test(v.name)) ||
        list.find((v) => /tessa/i.test(v.name)) ||
        list.find((v) => /fiona/i.test(v.name)) ||
        list.find((v) => /google uk english female/i.test(v.name)) ||
        list.find((v) => v.lang.startsWith('en')) ||
        list[0]
      );
    };

    let preferredVoice = findFemaleVoice(voices);
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        voices = window.speechSynthesis.getVoices();
        const v = findFemaleVoice(voices);
        if (v) utterance.voice = v;
      };
    }

    utterance.onstart = () => {
      this.playingCount++;
      this.onLevelUpdate(0.65);
    };

    utterance.onend = () => {
      this.playingCount = Math.max(0, this.playingCount - 1);
      this.onLevelUpdate(0);
    };

    utterance.onerror = () => {
      this.playingCount = Math.max(0, this.playingCount - 1);
      this.onLevelUpdate(0);
    };

    window.speechSynthesis.speak(utterance);
  }

  public flush(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch (e) {}
      this.currentSource = null;
    }
    if (this.currentHtmlAudio) {
      try {
        this.currentHtmlAudio.pause();
      } catch (e) {}
      this.currentHtmlAudio = null;
    }
    this.playingCount = 0;
    this.stopLevelMeter();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}
