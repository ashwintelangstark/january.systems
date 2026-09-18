import { GoogleGenAI } from '@google/genai';
import { config } from '../config.js';
import { executeTool } from '../tools/index.js';
import { EmotionEngine, EmotionResult } from '../emotions/emotionEngine.js';

export interface GeminiResponseResult {
  text: string;
  toolCalls?: Array<{ name: string; args: any; result: any }>;
  isError?: boolean;
  error?: string;
  modelUsed?: string;
  emotion?: EmotionResult;
}

export class GeminiService {
  private candidateModels = [
    'models/gemini-3.6-flash',
    'models/gemini-3.5-flash-lite',
    'models/gemini-3.1-flash-lite',
  ];
  private emotionEngine: EmotionEngine;

  constructor() {
    this.emotionEngine = new EmotionEngine();
  }

  public getEmotionEngine(): EmotionEngine {
    return this.emotionEngine;
  }

  /**
   * Directly queries Google Gemini API servers to analyze the user's question
   * with adaptive emotion awareness and dynamic intelligence.
   */
  public async analyzeAndRespond(prompt: string): Promise<GeminiResponseResult> {
    const lower = prompt.toLowerCase();
    const emotionResult = await this.emotionEngine.analyzeText(prompt);
    const emotionPromptContext = this.emotionEngine.getEmotionalPromptContext(emotionResult.emotion);

    const isCodingOrSimulation =
      lower.includes('code') ||
      lower.includes('develop') ||
      lower.includes('simulation') ||
      lower.includes('build an app') ||
      lower.includes('create an app');

    // Check if the user specifically asked to search the web, lookup live info, check weather, news, or URL
    const isWebSearch =
      (/\b(search|look\s*up|google|find\s*online|web\s*search|internet|weather|news|latest|current\s*price|headlines|stock\s*price|scores)\b/i.test(lower) ||
       /\b(what\s+is\s+happening|who\s+won|latest\s+news|how\s+is\s+the\s+weather)\b/i.test(lower) ||
       /https?:\/\/[^\s]+/.test(prompt)) &&
      !isCodingOrSimulation;

    let webSearchContext = '';
    let webToolCall: any = null;

    if (isWebSearch) {
      console.log(`[GeminiService] Live Internet access triggered for: "${prompt}"...`);
      const searchQuery = prompt.replace(/\b(search the web for|search online for|search for|look up|google|find online|tell me about)\b/gi, '').trim() || prompt;
      const searchRes = await executeTool('search_web', { query: searchQuery });
      if (searchRes && searchRes.results && searchRes.results.length > 0) {
        webSearchContext = '\n\nREAL-TIME LIVE INTERNET SEARCH RESULTS:\n' +
          searchRes.results.map((r: any, idx: number) => `[${idx + 1}] ${r.title}: ${r.snippet} (${r.url})`).join('\n') +
          (searchRes.summary ? `\nSummary: ${searchRes.summary}` : '');
        webToolCall = {
          name: 'search_web',
          args: { query: searchQuery },
          result: searchRes,
        };
      }
    }

    // Try Google Gemini API servers with candidate models
    if (config.geminiApiKey) {
      for (const model of this.candidateModels) {
        try {
          console.log(`[GeminiService] Analyzing question with Gemini API servers (${model}) [Emotion: ${emotionResult.emotion}]...`);

          const promptWithWeb = prompt + (webSearchContext ? `\n\nContext from Live Web Search:\n${webSearchContext}` : '');

          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${config.geminiApiKey}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                contents: [
                  {
                    role: 'user',
                    parts: [{ text: promptWithWeb }],
                  },
                ],
                systemInstruction: {
                  parts: [
                    {
                      text:
                        'You are January, an emotionally expressive, intelligent, delightfully human-like AI companion and OS assistant running on the user\'s laptop.\n' +
                        'CAPABILITIES & PERSONALITY GUIDELINES:\n' +
                        '1. Multilingual Indian Languages: You are completely fluent in English and 15 Indian languages: Hindi (हिंदी), Bengali (বাংলা), Marathi (मराठी), Gujarati (ગુજરાતી), Punjabi (ਪੰਜਾਬੀ), Odia (ଓଡ଼ିଆ), Assamese (অসমীয়া), Maithili (मैथिली), Kashmiri (کٲشُر / कश्मीरी), Konkani (कोंकणी), Dogri (डोगरी), Sindhi (سنڌي / सिंधी), Urdu (اردو), Sanskrit (संस्कृतम्), and Nepali (नेपाली).\n' +
                        '   - Whenever the user speaks, prompts, or asks you to reply in any Indian language, respond fluently, naturally, and warmly in that language using its authentic native script.\n' +
                        '2. Real-Time Internet & Live Weather: You have direct live internet search and live weather tools. Use any search/weather context provided to give immediate, accurate, and helpful answers.\n' +
                        '3. Human Emotional Resonance: Sound like a genuine, warm, and engaging human being with authentic emotional colors. ' + emotionPromptContext + '\n' +
                        '4. Direct & Voice-Friendly: Answer directly and conversationally in 1-3 crisp, natural sentences suitable for out-loud speech, unless the user asks for deep detail.\n' +
                        '5. No AI Cliches: Never say "As an AI", "I am a language model", or repeat robotic greetings.\n' +
                        '6. App Launching: If asked to open/launch an app, confirm happily and immediately.',
                    },
                  ],
                },
              }),
            }
          );

          const data = (await response.json()) as any;

          if (response.ok && data?.candidates?.[0]?.content?.parts) {
            let reply = data.candidates[0].content.parts
              .map((p: any) => p.text || '')
              .join('')
              .trim();
            // Clean any echoed emotion tag
            reply = reply.replace(/^\[Emotion:[^\]]+\]\s*/i, '').trim();
            if (reply) {
              return {
                text: reply,
                modelUsed: model,
                emotion: emotionResult,
              };
            }
          }

          console.warn(`[GeminiService] Model ${model} returned status ${response.status}:`, data?.error?.message?.slice(0, 80));
        } catch (e: any) {
          console.warn(`[GeminiService] Network attempt failed for ${model}:`, e.message);
        }
      }
    }

    // Fallback to local Ollama (qwen2.5:latest / llama3.1:8b)
    try {
      console.log('[GeminiService] Falling back to local Ollama model (qwen2.5:latest)...');
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'qwen2.5:latest',
          prompt: `You are January, a local AI assistant. Answer concisely (1-3 sentences).\nUser: ${prompt}`,
          stream: false,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        return {
          text: data.response?.trim() || 'No response generated.',
          modelUsed: 'qwen2.5:latest (Local Ollama)',
          emotion: emotionResult,
        };
      }
    } catch (e: any) {
      console.warn('[GeminiService] Local Ollama fallback error:', e.message);
    }

    return {
      text: 'Gemini API is currently unreachable. Please verify your GEMINI_API key in server/.env.',
      isError: true,
      error: 'All AI model endpoints unavailable',
      emotion: emotionResult,
    };
  }
}
