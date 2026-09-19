import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env comprehensively prioritizing server/.env
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env'), override: true });
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });
dotenv.config({ path: path.resolve(__dirname, '../../server/.env'), override: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  geminiApiKey: (process.env.GEMINI_API || process.env.GEMINI_API_KEY || '').replace(/^["']|["']$/g, '').trim(),
  geminiModel: process.env.GEMINI_MODEL || 'models/gemini-3.6-flash',
  geminiVoice: process.env.GEMINI_VOICE || 'Aoede', // Aoede, Puck, Charon, Kore, Fenrir
  claudeApiKey: (process.env.CLAUDE_CODE_API || process.env.ANTHROPIC_API_KEY || '').replace(/^["']|["']$/g, '').trim(),
  claudeModel: process.env.CLAUDE_MODEL || 'claude-3-7-sonnet-20250219',
  claudeProxyUrl: process.env.CLAUDE_PROXY_URL || 'http://127.0.0.1:8082',
  wakePhrase: (process.env.WAKE_PHRASE || 'rise').replace(/^["'\s]+|["'\s]+$/g, '').toLowerCase(),
  sleepPhrase: (process.env.SLEEP_PHRASE || 'good night').replace(/^["'\s]+|["'\s]+$/g, '').toLowerCase(),
  cameraWakePhrase: (process.env.CAMERA_WAKE_PHRASE || 'eyes open').replace(/^["'\s]+|["'\s]+$/g, '').toLowerCase(),
  cameraSleepPhrase: (process.env.CAMERA_SLEEP_PHRASE || 'eyes closed').replace(/^["'\s]+|["'\s]+$/g, '').toLowerCase(),
};

export function validateConfig() {
  const warnings: string[] = [];
  if (!config.geminiApiKey) {
    warnings.push('GEMINI_API or GEMINI_API_KEY is not set. Gemini Live WebSocket will fail to connect.');
  }
  if (!config.claudeApiKey) {
    warnings.push('CLAUDE_CODE_API or ANTHROPIC_API_KEY is not set. delegate_coding tool will fail.');
  }
  if (warnings.length > 0) {
    console.warn('\n⚠️  Config Warnings:');
    warnings.forEach((w) => console.warn(`   - ${w}`));
    console.warn('');
  }
}
