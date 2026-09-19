import { config } from '../config.js';
import { executeTool } from '../tools/index.js';
import { delegateCoding, DelegateCodingResult } from '../tools/delegateCoding.js';
import { EmotionEngine, EmotionResult } from '../emotions/emotionEngine.js';

export interface GeminiResponseResult {
  text: string;
  verbalSummary?: string;
  codeSnippet?: string;
  language?: string;
  compilationCommand?: string;
  isCode?: boolean;
  toolCalls?: Array<{ name: string; args: any; result: any }>;
  isError?: boolean;
  error?: string;
  modelUsed?: string;
  emotion?: EmotionResult;
}

/**
 * Detects the language used in the prompt to enforce strict language mirroring
 */
function detectPromptLanguage(prompt: string): { langName: string; scriptGuidance: string } | null {
  const lower = prompt.toLowerCase();

  // Explicit language mentions or phrasing
  if (/\b(hindi|हिंदी)\b/i.test(prompt) || /(?:hindi\s*me|hindi\s*mein|हिंदी\s*में)/i.test(prompt)) {
    return { langName: 'Hindi', scriptGuidance: 'Respond strictly in authentic, conversational Hindi using Devanagari script (हिंदी).' };
  }
  if (/\b(marathi|मराठी)\b/i.test(prompt) || /(?:marathi\s*madhe|marathit|मराठीत|मराठी\s*मध्ये)/i.test(prompt)) {
    return { langName: 'Marathi', scriptGuidance: 'Respond strictly in authentic, fluent Marathi using Devanagari script (मराठी).' };
  }
  if (/\b(bengali|bangla|বাংলা)\b/i.test(prompt) || /(?:bangla\s*y|bangla\s*te|বাংলায়)/i.test(prompt)) {
    return { langName: 'Bengali', scriptGuidance: 'Respond strictly in authentic, fluent Bengali using Bengali script (বাংলা).' };
  }
  if (/\b(gujarati|ગુજરાતી)\b/i.test(prompt) || /(?:gujarati\s*ma|ગુજરાતીમાં)/i.test(prompt)) {
    return { langName: 'Gujarati', scriptGuidance: 'Respond strictly in authentic, fluent Gujarati using Gujarati script (ગુજરાતી).' };
  }
  if (/\b(urdu|اردو)\b/i.test(prompt) || /(?:urdu\s*me|urdu\s*mein|اردو\s*میں)/i.test(prompt)) {
    return { langName: 'Urdu', scriptGuidance: 'Respond strictly in authentic, polite Urdu using Perso-Arabic script (اردو).' };
  }
  if (/\b(kannada|ಕನ್ನಡ)\b/i.test(prompt) || /(?:kannada\s*dalli|ಕನ್ನಡದಲ್ಲಿ)/i.test(prompt)) {
    return { langName: 'Kannada', scriptGuidance: 'Respond strictly in authentic, fluent Kannada using Kannada script (ಕನ್ನಡ).' };
  }
  if (/\b(tamil|தமிழ்)\b/i.test(prompt) || /(?:tamil\s*il|தமிழில்)/i.test(prompt)) {
    return { langName: 'Tamil', scriptGuidance: 'Respond strictly in authentic, fluent Tamil using Tamil script (தமிழ்).' };
  }
  if (/\b(telugu|తెలుగు)\b/i.test(prompt) || /(?:telugu\s*lo|తెలుగులో)/i.test(prompt)) {
    return { langName: 'Telugu', scriptGuidance: 'Respond strictly in authentic, fluent Telugu using Telugu script (తెలుగు).' };
  }
  if (/\b(malayalam|മലയാളം)\b/i.test(prompt) || /(?:malayalam\s*il|മലയാളത്തിൽ)/i.test(prompt)) {
    return { langName: 'Malayalam', scriptGuidance: 'Respond strictly in authentic, fluent Malayalam using Malayalam script (മലയാളം).' };
  }
  if (/\b(punjabi|ਪੰਜਾਬੀ)\b/i.test(prompt) || /(?:punjabi\s*vich|ਪੰਜਾਬੀ\s*ਵਿੱਚ)/i.test(prompt)) {
    return { langName: 'Punjabi', scriptGuidance: 'Respond strictly in authentic, fluent Punjabi using Gurmukhi script (ਪੰਜਾਬੀ).' };
  }
  if (/\b(sanskrit|संस्कृतम्|संस्कृत)\b/i.test(prompt)) {
    return { langName: 'Sanskrit', scriptGuidance: 'Respond strictly in classical Sanskrit using Devanagari script (संस्कृतम्).' };
  }
  if (/\b(nepali|नेपाली)\b/i.test(prompt)) {
    return { langName: 'Nepali', scriptGuidance: 'Respond strictly in authentic, fluent Nepali using Devanagari script (नेपाली).' };
  }
  if (/\b(odia|oriya|ଓଡ଼ିଆ)\b/i.test(prompt)) {
    return { langName: 'Odia', scriptGuidance: 'Respond strictly in authentic, fluent Odia using Odia script (ଓଡ଼ିଆ).' };
  }
  if (/\b(assamese|অসমীয়া)\b/i.test(prompt)) {
    return { langName: 'Assamese', scriptGuidance: 'Respond strictly in authentic Assamese using Assamese script (অসমীয়া).' };
  }

  // Unicode Script inspection for direct native text
  if (/[\u0980-\u09FF]/.test(prompt)) {
    return { langName: 'Bengali/Assamese', scriptGuidance: 'The user wrote in Bengali/Assamese. Respond strictly in Bengali using Bengali script.' };
  }
  if (/[\u0A80-\u0AFF]/.test(prompt)) {
    return { langName: 'Gujarati', scriptGuidance: 'The user wrote in Gujarati. Respond strictly in Gujarati using Gujarati script.' };
  }
  if (/[\u0A00-\u0A7F]/.test(prompt)) {
    return { langName: 'Punjabi', scriptGuidance: 'The user wrote in Gurmukhi. Respond strictly in Punjabi using Gurmukhi script.' };
  }
  if (/[\u0B00-\u0B7F]/.test(prompt)) {
    return { langName: 'Odia', scriptGuidance: 'The user wrote in Odia. Respond strictly in Odia using Odia script.' };
  }
  if (/[\u0600-\u06FF]/.test(prompt)) {
    return { langName: 'Urdu', scriptGuidance: 'The user wrote in Urdu (Perso-Arabic). Respond strictly in Urdu using Perso-Arabic script.' };
  }
  if (/[\u0C80-\u0CFF]/.test(prompt)) {
    return { langName: 'Kannada', scriptGuidance: 'The user wrote in Kannada. Respond strictly in Kannada using Kannada script.' };
  }
  if (/[\u0B80-\u0BFF]/.test(prompt)) {
    return { langName: 'Tamil', scriptGuidance: 'The user wrote in Tamil. Respond strictly in Tamil using Tamil script.' };
  }
  if (/[\u0C00-\u0C7F]/.test(prompt)) {
    return { langName: 'Telugu', scriptGuidance: 'The user wrote in Telugu. Respond strictly in Telugu using Telugu script.' };
  }
  if (/[\u0D00-\u0D7F]/.test(prompt)) {
    return { langName: 'Malayalam', scriptGuidance: 'The user wrote in Malayalam. Respond strictly in Malayalam using Malayalam script.' };
  }
  if (/[\u0900-\u097F]/.test(prompt)) {
    if (/(?:आहे|नाही|काय|तुम्ही|सांगा|कसे|नमस्कार|झाले)/.test(prompt)) {
      return { langName: 'Marathi', scriptGuidance: 'The user wrote in Marathi. Respond strictly in Marathi using Devanagari script.' };
    }
    if (/(?:छ|छैन|गर्ने|हुने|तपाईं|हुन्छ|नेपाल)/.test(prompt)) {
      return { langName: 'Nepali', scriptGuidance: 'The user wrote in Nepali. Respond strictly in Nepali using Devanagari script.' };
    }
    if (/(?:अस्ति|भवति|नमः|स्वाहा|अहम्|सुप्रभातम्)/.test(prompt)) {
      return { langName: 'Sanskrit', scriptGuidance: 'The user wrote in Sanskrit. Respond strictly in Sanskrit using Devanagari script.' };
    }
    return { langName: 'Hindi', scriptGuidance: 'The user wrote in Hindi. Respond strictly in Hindi using Devanagari script.' };
  }

  return null;
}

export class GeminiService {
  private candidateModels = [
    'models/gemini-3.5-flash-lite',
    'models/gemini-3.6-flash',
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
   * with adaptive emotion awareness, language switching, and Python/C/C++ coding engine integration.
   */
  public async analyzeAndRespond(prompt: string): Promise<GeminiResponseResult> {
    const lower = prompt.toLowerCase();
    const emotionResult = await this.emotionEngine.analyzeText(prompt);
    const emotionPromptContext = this.emotionEngine.getEmotionalPromptContext(emotionResult.emotion);

    // 0. Check for Camera Vision, Object Identification & Facial Recognition
    const isVisionQuery =
      (/\b(look|see|camera|holding|what('s|\s+is)\s+this|what\s+do\s+you\s+see|who\s+am\s+i|recognize\s+me|can\s+you\s+see|my\s+face|posture|read\s+this|examine|surroundings|my\s+room)\b/i.test(lower) ||
       /(?:देखो|पहचानो|क्या\s*दिख\s*रहा|बघा|ओळखतोस)/i.test(prompt)) &&
      !lower.startsWith('search ') && !lower.startsWith('look up ') && !lower.startsWith('find ') && !lower.startsWith('open ') && !lower.includes('code');

    if (isVisionQuery) {
      console.log(`[GeminiService] Activating Camera Eyes & Face Engine for: "${prompt}"...`);
      const visionResult = await executeTool('see_and_analyze', { prompt });
      return {
        text: visionResult.description,
        verbalSummary: visionResult.verbalSummary,
        toolCalls: [{ name: 'see_and_analyze', args: { prompt }, result: visionResult }],
        modelUsed: visionResult.modelUsed || 'Gemini Multimodal Vision',
        emotion: emotionResult,
      };
    }

    // 1. Check for System Resource Opening (IDEs, Softwares, Folders, Videos, Files, Audio)
    const isMultilingualOpen = /(?:खोलो|ओपन\s*करो|चालू\s*करो|चलाओ|उघडा|ओपन\s*करा|प्ले\s*करा|दाखवा)$/i.test(prompt.trim());
    const isEnglishOpen =
      (lower.startsWith('open ') || lower.startsWith('launch ') || lower.startsWith('play ') || lower.startsWith('start ') || lower.startsWith('show ') || lower.startsWith('run ') || lower.startsWith('view ')) &&
      !lower.startsWith('open ai') && !lower.startsWith('open source');

    const isCodingRequest =
      lower.includes('write ') || lower.includes('code ') || lower.includes('implement ') || lower.includes('create script') || lower.includes('algorithm') || lower.includes('program for');

    const isOpenCommand = (isEnglishOpen || isMultilingualOpen) && !isCodingRequest;

    if (isOpenCommand) {
      let target = prompt
        .replace(/^(?:open|launch|play|start|show|run|view)\s+(?:the\s+|my\s+)?/i, '')
        .replace(/\s+(?:खोलो|ओपन\s*करो|चालू\s*करो|चलाओ|उघडा|ओपन\s*करा|प्ले\s*करा|दाखवा)$/i, '')
        .replace(/^(?:folder|directory|video|movie|file|document|app|application|ide|software)\s+/i, '')
        .replace(/\s+(?:app|application|ide|software|folder|directory|video|movie|file|document)$/i, '')
        .trim();

      let resourceType: 'app' | 'folder' | 'video' | 'file' | 'audio' | 'auto' = 'auto';
      if (lower.includes('video') || lower.includes('movie') || lower.includes('clip') || lower.startsWith('play ') || /\.(mp4|mov|mkv|avi|webm)$/i.test(lower)) {
        resourceType = 'video';
      } else if (lower.includes('folder') || lower.includes('directory')) {
        resourceType = 'folder';
      } else if (lower.includes('file') || lower.includes('document') || /\.(pdf|docx|xlsx|pptx|txt|md|json|csv)$/i.test(lower)) {
        resourceType = 'file';
      } else if (lower.includes('app') || lower.includes('application') || lower.includes('ide') || lower.includes('software') || lower.includes('code editor') || /\b(vscode|vs code|cursor|xcode|pycharm|intellij|webstorm|sublime|safari|chrome|brave|vlc|spotify|slack|discord|docker|postman|finder|terminal|iterm)\b/i.test(lower)) {
        resourceType = 'app';
      }

      console.log(`[GeminiService] Executing open_system_resource: "${target}" (type: ${resourceType})`);
      const toolRes = await executeTool('open_system_resource', { query: target, resourceType });
      return {
        text: toolRes.message,
        verbalSummary: toolRes.message,
        toolCalls: [{ name: 'open_system_resource', args: { query: target, resourceType }, result: toolRes }],
        emotion: emotionResult,
      };
    }

    // 2. Check for System File & Video Search
    const isFileSearch =
      /\b(find|search|look\s*for|where\s*is)\b.*?\b(files?|videos?|movies?|folders?|documents?|mp4|pdf|docs?)\b/i.test(lower) ||
      /\b(where\s+is\s+my\s+file|where\s+is\s+the\s+video|search\s+my\s+mac|search\s+my\s+system)\b/i.test(lower);

    if (isFileSearch) {
      const queryTerm = prompt
        .replace(/\b(find|search\s+for|search|look\s+for|where\s+is\s+my|where\s+is\s+the|where\s+is|files?|videos?|movies?|folders?|documents?|on\s+my\s+mac|on\s+the\s+system|in\s+my\s+laptop)\b/gi, '')
        .trim()
        .replace(/^(?:for|the|my|a|an)\s+/i, '')
        .trim() || prompt;
      let fileType: any = 'any';
      if (lower.includes('video') || lower.includes('movie')) fileType = 'video';
      else if (lower.includes('folder')) fileType = 'folder';
      else if (lower.includes('document') || lower.includes('pdf')) fileType = 'document';

      console.log(`[GeminiService] Searching system files: "${queryTerm}" (type: ${fileType})`);
      const searchRes = await executeTool('search_system_files', { query: queryTerm, fileType });
      return {
        text: searchRes.message,
        verbalSummary: searchRes.results?.length ? `I found ${searchRes.results.length} matching items on your Mac.` : `No items found matching ${queryTerm}.`,
        toolCalls: [{ name: 'search_system_files', args: { query: queryTerm, fileType }, result: searchRes }],
        emotion: emotionResult,
      };
    }

    // 3. Check for Folder Listing
    const isListFolder = /\b(list|show|what('s|\s+is)\s+in)\b.*?\b(downloads|desktop|documents|movies|pictures|folder|directory)\b/i.test(lower);
    if (isListFolder) {
      const folderMatch = lower.match(/\b(downloads|desktop|documents|movies|pictures|music|home)\b/i);
      const folderName = folderMatch ? folderMatch[1] : 'Desktop';
      const listRes = await executeTool('list_system_folder', { folderPath: folderName });
      return {
        text: listRes.message,
        verbalSummary: `Here are the contents of your ${folderName} folder.`,
        toolCalls: [{ name: 'list_system_folder', args: { folderPath: folderName }, result: listRes }],
        emotion: emotionResult,
      };
    }

    // 4. Check for WhatsApp Message Automation
    if (lower.includes('whatsapp')) {
      const numberMatch = prompt.match(/(?:\+?\d{8,15})/);
      const number = numberMatch ? numberMatch[0] : '14155552671';
      const toolRes = await executeTool('manage_whatsapp_message', { number, text: prompt });
      return {
        text: toolRes.message,
        verbalSummary: toolRes.message,
        toolCalls: [{ name: 'manage_whatsapp_message', args: { number, text: prompt }, result: toolRes }],
        emotion: emotionResult,
      };
    }

    // 5. Check for Python, C, C++, Algorithms or Systems Coding Tasks
    const isCoding =
      (/(?:python|python3|\bpy\b|c\+\+|cpp|cxx|c\s+program|c\s+code|c\s+language|\bin\s+c\b|stdio\.h|iostream|malloc|quicksort|mergesort|binary\s*search|linked\s*list|fibonacci|pointers?|struct\s+\w+|class\s+\w+|algorithm|data\s*structure)/i.test(lower) ||
       /\b(write|create|generate|build|code|implement|make|solve|debug|optimize)\b.*?\b(code|script|function|program|algorithm|class|python|c\+\+|cpp|c language|c program|struct|queue|stack|tree|graph)\b/i.test(lower) ||
       /\b(how\s+to\s+code|how\s+to\s+write\s+a\s+program)\b/i.test(lower)) &&
      !lower.startsWith('open ') && !lower.startsWith('launch ');

    if (isCoding) {
      console.log(`[GeminiService] Routing programming task to Coding Engine: "${prompt.slice(0, 60)}..."`);
      const codingResult: DelegateCodingResult = await delegateCoding({ prompt });
      return {
        text: codingResult.response,
        verbalSummary: codingResult.verbalSummary || `I've generated the ${(codingResult.language || 'code').toUpperCase()} code for you in your terminal.`,
        codeSnippet: codingResult.codeSnippet,
        language: codingResult.language,
        compilationCommand: codingResult.compilationCommand,
        isCode: true,
        modelUsed: codingResult.model,
        emotion: emotionResult,
      };
    }

    // 6. Check for Live Web Search & Real-Time Weather
    const isWebSearch =
      (/\b(search|look\s*up|google|find\s*online|web\s*search|internet|weather|news|latest|current\s*price|headlines|stock\s*price|scores)\b/i.test(lower) ||
       /\b(what\s+is\s+happening|who\s+won|latest\s+news|how\s+is\s+the\s+weather)\b/i.test(lower) ||
       /https?:\/\/[^\s]+/.test(prompt));

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

    // 3. Language Detection & Strict Mirroring
    const detectedLang = detectPromptLanguage(prompt);
    let languageDirective =
      'CRITICAL LANGUAGE MIRRORING RULE:\n' +
      'Strictly detect the language used in the user\'s prompt. If the user speaks, prompts, or asks in a specific language (Hindi, Marathi, Bengali, Gujarati, Kannada, Tamil, Telugu, Malayalam, Punjabi, Odia, Assamese, Urdu, Sanskrit, Nepali, English, etc.), you MUST reply 100% in THAT EXACT SAME LANGUAGE using its authentic native script.\n' +
      'If the user switches languages from a previous message, you MUST immediately switch your response to match the user\'s new language. Never reply in English when prompted in an Indian language.';

    if (detectedLang) {
      languageDirective += `\n[MANDATORY CURRENT LANGUAGE TARGET: ${detectedLang.langName.toUpperCase()}] -> ${detectedLang.scriptGuidance}`;
    }

    // Try Google Gemini API servers with candidate models
    if (config.geminiApiKey) {
      for (const model of this.candidateModels) {
        try {
          console.log(`[GeminiService] Analyzing question with Gemini API servers (${model}) [Emotion: ${emotionResult.emotion}, Lang: ${detectedLang?.langName || 'English'}]...`);

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
                        '1. ' + languageDirective + '\n' +
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
          prompt: `You are January, a local AI assistant. Answer concisely in the exact language the user used.\nUser: ${prompt}`,
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
