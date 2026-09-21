import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface LearnedUserProfile {
  userName: string;
  totalInteractions: number;
  preferredCodingLanguages: Record<string, number>;
  preferredSpokenLanguages: Record<string, number>;
  codingStylePreferences: string[];
  communicationStylePreferences: string[];
  workPatterns: {
    hourlyActivity: Record<number, number>; // Hour 0-23 -> count
    totalSessions: number;
    lastActiveTimestamp: number;
  };
  observedHabits: string[];
  lastInteractionTimestamp: number;
  updatedAt: number;
}

export interface InteractionRecord {
  timestamp: number;
  prompt: string;
  responsePreview: string;
  isCode?: boolean;
  codingLanguage?: string;
  spokenLanguage?: string;
  visualContext?: string;
}

export class LearnedProfileEngine {
  private dataDir: string;
  private profileFile: string;
  private logFile: string;
  private profile: LearnedUserProfile;

  constructor() {
    this.dataDir = path.resolve(__dirname, '../../data/memory');
    this.profileFile = path.join(this.dataDir, 'learned_profile.json');
    this.logFile = path.join(this.dataDir, 'interactions.jsonl');

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    this.profile = this.loadProfile();
  }

  private loadProfile(): LearnedUserProfile {
    try {
      if (fs.existsSync(this.profileFile)) {
        const raw = fs.readFileSync(this.profileFile, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err: any) {
      console.warn('[LearnedProfileEngine] Error loading profile, creating fresh profile:', err.message);
    }

    const initialProfile: LearnedUserProfile = {
      userName: 'Ashwin',
      totalInteractions: 0,
      preferredCodingLanguages: {
        'C++': 1,
        'Python': 1,
        'C': 1,
      },
      preferredSpokenLanguages: {
        'English': 1,
        'Hindi': 1,
        'Marathi': 1,
      },
      codingStylePreferences: [
        'Modern C++20 with smart pointers and RAII',
        'Python 3.10+ with type hints and concise main blocks',
        'Show clean code in terminal with exact compilation command',
        'Never read code syntax aloud over speakers',
      ],
      communicationStylePreferences: [
        'Crisp, direct 1-3 sentence conversational replies',
        'Warm, authentic emotional attunement without robotic phrases',
        'Respect persistent session language until explicitly changed',
      ],
      workPatterns: {
        hourlyActivity: {},
        totalSessions: 1,
        lastActiveTimestamp: Date.now(),
      },
      observedHabits: [
        'Works directly on macOS via terminal CLI and background daemon',
        'Monitors posture and surroundings using laptop camera eyes',
        'Values local edge privacy and zero cloud image leaks',
      ],
      lastInteractionTimestamp: Date.now(),
      updatedAt: Date.now(),
    };

    this.saveProfile(initialProfile);
    return initialProfile;
  }

  private saveProfile(profile: LearnedUserProfile): void {
    try {
      fs.writeFileSync(this.profileFile, JSON.stringify(profile, null, 2), 'utf-8');
    } catch (err: any) {
      console.error('[LearnedProfileEngine] Failed to save profile:', err.message);
    }
  }

  /**
   * Records a user interaction and incrementally adapts the learned profile
   */
  public recordInteraction(
    prompt: string,
    response: string,
    metadata?: {
      isCode?: boolean;
      codingLanguage?: string;
      spokenLanguage?: string;
      visualContext?: string;
    }
  ): void {
    const now = Date.now();
    const currentHour = new Date(now).getHours();

    this.profile.totalInteractions += 1;
    this.profile.lastInteractionTimestamp = now;
    this.profile.updatedAt = now;

    // Track hourly activity rhythm
    this.profile.workPatterns.hourlyActivity[currentHour] =
      (this.profile.workPatterns.hourlyActivity[currentHour] || 0) + 1;
    this.profile.workPatterns.lastActiveTimestamp = now;

    const normalizeLang = (l: string): string => {
      const upper = l.toUpperCase().trim();
      if (upper === 'CPP' || upper === 'C++') return 'C++';
      if (upper === 'PYTHON' || upper === 'PY') return 'Python';
      if (upper === 'C') return 'C';
      return l.charAt(0).toUpperCase() + l.slice(1).toLowerCase();
    };

    // Track coding language preferences
    if (metadata?.isCode && metadata.codingLanguage) {
      const lang = normalizeLang(metadata.codingLanguage);
      this.profile.preferredCodingLanguages[lang] =
        (this.profile.preferredCodingLanguages[lang] || 0) + 1;
    }

    // Track spoken/requested natural languages
    if (metadata?.spokenLanguage) {
      const sLang = metadata.spokenLanguage;
      this.profile.preferredSpokenLanguages[sLang] =
        (this.profile.preferredSpokenLanguages[sLang] || 0) + 1;
    }

    // Detect user preferences from prompt keywords
    const lower = prompt.toLowerCase();
    if (lower.includes('c++') || lower.includes('cpp')) {
      this.profile.preferredCodingLanguages['C++'] = (this.profile.preferredCodingLanguages['C++'] || 0) + 1;
    } else if (lower.includes('python')) {
      this.profile.preferredCodingLanguages['Python'] = (this.profile.preferredCodingLanguages['Python'] || 0) + 1;
    } else if (lower.includes(' in c ') || lower.endsWith(' in c') || lower.includes('c program')) {
      this.profile.preferredCodingLanguages['C'] = (this.profile.preferredCodingLanguages['C'] || 0) + 1;
    }

    // Append to interaction log
    const logRecord: InteractionRecord = {
      timestamp: now,
      prompt,
      responsePreview: response.slice(0, 120),
      isCode: metadata?.isCode,
      codingLanguage: metadata?.codingLanguage,
      spokenLanguage: metadata?.spokenLanguage,
      visualContext: metadata?.visualContext,
    };

    try {
      fs.appendFileSync(this.logFile, JSON.stringify(logRecord) + '\n', 'utf-8');
    } catch {}

    // Persist updated profile
    this.saveProfile(this.profile);
  }

  public getProfile(): LearnedUserProfile {
    return this.profile;
  }

  /**
   * Generates dynamic prompt context to inject into Gemini for personalized responses
   */
  public getSystemPromptContext(): string {
    const topCodingLangs = Object.entries(this.profile.preferredCodingLanguages)
      .sort((a, b) => b[1] - a[1])
      .map(([lang, count]) => `${lang} (${count})`)
      .slice(0, 3)
      .join(', ');

    const topSpokenLangs = Object.entries(this.profile.preferredSpokenLanguages)
      .sort((a, b) => b[1] - a[1])
      .map(([lang]) => lang)
      .slice(0, 3)
      .join(', ');

    return (
      `\n[ADAPTIVE LEARNED USER PREFERENCES & MEMORY]:\n` +
      `• Preferred Programming Languages: ${topCodingLangs || 'C++, Python, C'}\n` +
      `• Preferred Communication Languages: ${topSpokenLangs || 'English, Hindi, Marathi'}\n` +
      `• Learned Coding Preferences: ${this.profile.codingStylePreferences.join('; ')}\n` +
      `• Learned Tone & Interaction Style: ${this.profile.communicationStylePreferences.join('; ')}\n` +
      `• Observed Work Habits: ${this.profile.observedHabits.join('; ')}\n` +
      `• STRICT NAME USAGE: The user's name is ${this.profile.userName}, but you must NEVER address or call the user by their name ("${this.profile.userName}") unless the user explicitly commands you to use their name or asks for their name. Always address them directly in the natural second person ("you", "your").\n` +
      `Use these learned preferences to personalize all responses, code generations, and interactions.`
    );
  }
}
