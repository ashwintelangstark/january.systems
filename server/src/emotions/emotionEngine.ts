import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type EmotionType = 'joy' | 'curious' | 'empathetic' | 'focused' | 'calm' | 'concerned' | 'neutral';

export interface EmotionResult {
  emotion: EmotionType;
  valence: number;
  arousal: number;
  tone: string;
  pitch: string;
  rate: string;
  color: string;
}

export class EmotionEngine extends EventEmitter {
  private currentEmotion: EmotionResult = {
    emotion: 'curious',
    valence: 0.4,
    arousal: 0.6,
    tone: 'curious',
    pitch: '+2Hz',
    rate: '+2%',
    color: '#00F5FF',
  };

  private scriptPath: string;

  constructor() {
    super();
    this.scriptPath = path.resolve(__dirname, '../../audio_engine/emotion_engine.py');
  }

  public getCurrentEmotion(): EmotionResult {
    return { ...this.currentEmotion };
  }

  /**
   * Analyzes the given text for emotion and sentiment in 0ms (in-memory)
   */
  public async analyzeText(text: string): Promise<EmotionResult> {
    if (!text || !text.trim()) {
      return this.currentEmotion;
    }

    const result = this.localFallback(text);
    this.setEmotion(result);
    return result;
  }

  public setEmotion(result: EmotionResult): void {
    const changed = this.currentEmotion.emotion !== result.emotion;
    this.currentEmotion = result;
    if (changed) {
      this.emit('emotionChange', this.currentEmotion);
    }
  }

  /**
   * Generates tailored prompt instructions based on the current emotion
   */
  public getEmotionalPromptContext(emotion: EmotionType): string {
    switch (emotion) {
      case 'joy':
        return 'The user is joyful and happy! Respond with vibrant warmth, enthusiasm, cheerful smiles in your tone, and celebratory human energy.';
      case 'curious':
        return 'The user is curious and inquisitive! Respond with fascination, intriguing storytelling, intellectual spark, and lively engagement.';
      case 'empathetic':
        return 'The user is feeling down, stressed, or tired. Respond with heartfelt empathy, gentle warmth, caring understanding, and comforting reassurance like a true friend.';
      case 'focused':
        return 'The user is focused on building or solving problems. Respond with sharp, razor-clean technical mastery, high efficiency, and supportive collaboration.';
      case 'concerned':
        return 'The user is facing an issue or error. Respond with calm confidence, reassuring steadiness, and immediate problem-solving focus.';
      case 'calm':
        return 'The mood is calm and peaceful. Respond with gentle, serene, soft-spoken composure.';
      default:
        return 'Respond with natural, expressive human warmth and genuine conversational presence.';
    }
  }

  private localFallback(text: string): EmotionResult {
    const lower = text.toLowerCase();
    if (/\b(sad|depressed|stress|tired|exhaust|hurt|sorry|worry|dukh|dard|ro|pareshan|traas)\b/i.test(lower)) {
      return {
        emotion: 'empathetic',
        valence: -0.5,
        arousal: -0.3,
        tone: 'empathetic',
        pitch: '-2Hz',
        rate: '-5%',
        color: '#10B981',
      };
    }
    if (/\b(error|bug|issue|fail|crash|broke|not working|problem|gadbad)\b/i.test(lower)) {
      return {
        emotion: 'concerned',
        valence: -0.2,
        arousal: 0.5,
        tone: 'concerned',
        pitch: '+0Hz',
        rate: '+0%',
        color: '#EF4444',
      };
    }
    if (/\b(great|awesome|love|happy|yay|hurray|congrat|amazing|khush|badhiya|mast|sundar|shandar)\b/i.test(lower)) {
      return {
        emotion: 'joy',
        valence: 0.8,
        arousal: 0.7,
        tone: 'cheerful',
        pitch: '+4Hz',
        rate: '+5%',
        color: '#F59E0B',
      };
    }
    if (/\b(code|function|class|develop|program|algorithm|calculate|compile|build|script|debug|python|cpp|c\+\+)\b/i.test(lower)) {
      return {
        emotion: 'focused',
        valence: 0.3,
        arousal: 0.5,
        tone: 'focused',
        pitch: '+0Hz',
        rate: '+0%',
        color: '#8B5CF6',
      };
    }
    if (/\b(peace|relax|calm|quiet|sleep|shant|aram)\b/i.test(lower)) {
      return {
        emotion: 'calm',
        valence: 0.5,
        arousal: -0.2,
        tone: 'calm',
        pitch: '-1Hz',
        rate: '-4%',
        color: '#06B6D4',
      };
    }
    return {
      emotion: 'curious',
      valence: 0.4,
      arousal: 0.6,
      tone: 'curious',
      pitch: '+2Hz',
      rate: '+2%',
      color: '#00F5FF',
    };
  }
}
