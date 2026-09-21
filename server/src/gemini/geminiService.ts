import { config } from '../config.js';
import { executeTool } from '../tools/index.js';
import { delegateCoding, DelegateCodingResult } from '../tools/delegateCoding.js';
import { EmotionEngine, EmotionResult } from '../emotions/emotionEngine.js';
import { LearnedProfileEngine } from '../memory/learnedProfileEngine.js';
import { VisualActivityMonitor } from '../vision/activityMonitor.js';

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

export interface LanguageProfile {
  langCode: string;
  langName: string;
  nativeName: string;
  scriptName: string;
  scriptGuidance: string;
}

const SUPPORTED_LANGUAGES: Record<string, LanguageProfile> = {
  hindi: {
    langCode: 'hi',
    langName: 'Hindi',
    nativeName: 'हिंदी',
    scriptName: 'Devanagari',
    scriptGuidance: 'Respond strictly in authentic, conversational Hindi using Devanagari script (हिंदी लिपि). If the user asks in Romanized Hindi / Hinglish (e.g., "mudje dekho", "aap kaise ho", "mujhe batao"), interpret their phonetic meaning and reply in authentic Devanagari Hindi (देवनागरी हिंदी). Do NOT write in Latin/English letters.',
  },
  marathi: {
    langCode: 'mr',
    langName: 'Marathi',
    nativeName: 'मराठी',
    scriptName: 'Devanagari',
    scriptGuidance: 'Respond strictly in authentic, fluent Marathi using Devanagari script (मराठी लिपी). If the user asks in Romanized Marathi (e.g., "mala bagha", "kasa ahes", "kay challay"), interpret their phonetic meaning and reply in authentic Devanagari Marathi (देवनागरी मराठी). Do NOT write in Latin/English letters.',
  },
  bengali: {
    langCode: 'bn',
    langName: 'Bengali',
    nativeName: 'বাংলা',
    scriptName: 'Bengali',
    scriptGuidance: 'Respond strictly in authentic Bengali using Bengali script (বাংলা লিপি). If the user asks in Romanized Bengali (e.g., "amake dekho", "kemon acho"), interpret and reply in Bengali script.',
  },
  gujarati: {
    langCode: 'gu',
    langName: 'Gujarati',
    nativeName: 'ગુજરાતી',
    scriptName: 'Gujarati',
    scriptGuidance: 'Respond strictly in authentic Gujarati using Gujarati script (ગુજરાતી લિપિ). If the user asks in Romanized Gujarati (e.g., "kem cho", "mane joi"), interpret and reply in Gujarati script.',
  },
  kannada: {
    langCode: 'kn',
    langName: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    scriptName: 'Kannada',
    scriptGuidance: 'Respond strictly in authentic Kannada using Kannada script (ಕನ್ನಡ ಲಿಪಿ). If the user asks in Romanized Kannada (e.g., "nannu nodi", "hegiddira"), interpret and reply in Kannada script.',
  },
  tamil: {
    langCode: 'ta',
    langName: 'Tamil',
    nativeName: 'தமிழ்',
    scriptName: 'Tamil',
    scriptGuidance: 'Respond strictly in authentic Tamil using Tamil script (தமிழ் எழுத்து). If the user asks in Romanized Tamil (e.g., "ennai paarunga", "eppadi irukkinga"), interpret and reply in Tamil script.',
  },
  telugu: {
    langCode: 'te',
    langName: 'Telugu',
    nativeName: 'తెలుగు',
    scriptName: 'Telugu',
    scriptGuidance: 'Respond strictly in authentic Telugu using Telugu script (తెలుగు లిపి). If the user asks in Romanized Telugu (e.g., "nannu chudandi", "ela unnaru"), interpret and reply in Telugu script.',
  },
  malayalam: {
    langCode: 'ml',
    langName: 'Malayalam',
    nativeName: 'മലയാളം',
    scriptName: 'Malayalam',
    scriptGuidance: 'Respond strictly in authentic Malayalam using Malayalam script (മലയാള ലിപി). If the user asks in Romanized Malayalam (e.g., "engane und"), interpret and reply in Malayalam script.',
  },
  punjabi: {
    langCode: 'pa',
    langName: 'Punjabi',
    nativeName: 'ਪੰਜਾਬੀ',
    scriptName: 'Gurmukhi',
    scriptGuidance: 'Respond strictly in authentic Punjabi using Gurmukhi script (ਗੁਰਮੁਖੀ ਲਿਪੀ). If the user asks in Romanized Punjabi (e.g., "ki haal"), interpret and reply in Gurmukhi script.',
  },
  urdu: {
    langCode: 'ur',
    langName: 'Urdu',
    nativeName: 'اردو',
    scriptName: 'Perso-Arabic',
    scriptGuidance: 'Respond strictly in authentic, polite Urdu using Perso-Arabic script (اردو رسم الخط). If the user asks in Romanized Urdu, interpret and reply in Perso-Arabic script.',
  },
  sanskrit: {
    langCode: 'sa',
    langName: 'Sanskrit',
    nativeName: 'संस्कृतम्',
    scriptName: 'Devanagari',
    scriptGuidance: 'Respond strictly in classical Sanskrit using Devanagari script (संस्कृतम्).',
  },
  nepali: {
    langCode: 'ne',
    langName: 'Nepali',
    nativeName: 'नेपाली',
    scriptName: 'Devanagari',
    scriptGuidance: 'Respond strictly in authentic Nepali using Devanagari script (नेपाली).',
  },
  odia: {
    langCode: 'or',
    langName: 'Odia',
    nativeName: 'ଓଡ଼ିଆ',
    scriptName: 'Odia',
    scriptGuidance: 'Respond strictly in authentic Odia using Odia script (ଓଡ଼ିଆ).',
  },
  assamese: {
    langCode: 'as',
    langName: 'Assamese',
    nativeName: 'অসমীয়া',
    scriptName: 'Assamese',
    scriptGuidance: 'Respond strictly in authentic Assamese using Assamese script (অসমীয়া).',
  },
};

/**
 * Detects whether the user is explicitly requesting a language switch,
 * or using Romanized/native script for a supported language.
 */
function inspectPromptLanguage(prompt: string): { action: 'switch_english' | 'set_language' | 'none'; profile?: LanguageProfile } {
  const lower = prompt.toLowerCase().trim();

  // 1. Explicit Switch to English
  if (
    /(?:switch|change|speak|talk|reply|respond|converse)\s+(?:to|in|back to|language to)\s+english\b/i.test(lower) ||
    /^(?:in\s+english|english\s+please|english\s+only)$/i.test(lower) ||
    /(?:अंग्रेजी|इंग्लिश)\s*(?:में|मध्ये|बोलो|बोला|करो)/i.test(prompt)
  ) {
    return { action: 'switch_english' };
  }

  // 2. Explicit Language Switch Requests (e.g. "Speak in Hindi", "Switch to Marathi")
  for (const [key, profile] of Object.entries(SUPPORTED_LANGUAGES)) {
    const nameRegex = new RegExp(`(?:switch|change|speak|talk|reply|respond|converse)\\s+(?:to|in|back to|language to|with\\s+me\\s+in)\\s+${key}\\b`, 'i');
    if (nameRegex.test(lower)) {
      return { action: 'set_language', profile };
    }
  }

  // 3. Direct Native Unicode Script Inspection
  if (/[\u0980-\u09FF]/.test(prompt)) {
    return { action: 'set_language', profile: SUPPORTED_LANGUAGES.bengali };
  }
  if (/[\u0A80-\u0AFF]/.test(prompt)) {
    return { action: 'set_language', profile: SUPPORTED_LANGUAGES.gujarati };
  }
  if (/[\u0A00-\u0A7F]/.test(prompt)) {
    return { action: 'set_language', profile: SUPPORTED_LANGUAGES.punjabi };
  }
  if (/[\u0B00-\u0B7F]/.test(prompt)) {
    return { action: 'set_language', profile: SUPPORTED_LANGUAGES.odia };
  }
  if (/[\u0600-\u06FF]/.test(prompt)) {
    return { action: 'set_language', profile: SUPPORTED_LANGUAGES.urdu };
  }
  if (/[\u0C80-\u0CFF]/.test(prompt)) {
    return { action: 'set_language', profile: SUPPORTED_LANGUAGES.kannada };
  }
  if (/[\u0B80-\u0BFF]/.test(prompt)) {
    return { action: 'set_language', profile: SUPPORTED_LANGUAGES.tamil };
  }
  if (/[\u0C00-\u0C7F]/.test(prompt)) {
    return { action: 'set_language', profile: SUPPORTED_LANGUAGES.telugu };
  }
  if (/[\u0D00-\u0D7F]/.test(prompt)) {
    return { action: 'set_language', profile: SUPPORTED_LANGUAGES.malayalam };
  }
  if (/[\u0900-\u097F]/.test(prompt)) {
    if (/(?:आहे|नाही|काय|तुम्ही|सांगा|कसे|नमस्कार|झाले|बघा|दाखवा|पहा)/.test(prompt)) {
      return { action: 'set_language', profile: SUPPORTED_LANGUAGES.marathi };
    }
    if (/(?:छ|छैन|गर्ने|हुने|तपाईं|हुन्छ|नेपाल)/.test(prompt)) {
      return { action: 'set_language', profile: SUPPORTED_LANGUAGES.nepali };
    }
    if (/(?:अस्ति|भवति|नमः|स्वाहा|अहम्|सुप्रभातम्)/.test(prompt)) {
      return { action: 'set_language', profile: SUPPORTED_LANGUAGES.sanskrit };
    }
    return { action: 'set_language', profile: SUPPORTED_LANGUAGES.hindi };
  }

  // 4. Romanized / Phonetic Transliteration Signatures (Hinglish, Manglish, etc.)
  // e.g. "mudje dekho", "mujhe dekho", "kya haal hai", "kasa ahes", "mala bagha"
  if (/\b(mudje|mujhe|dekho|kya|kaise|kaun|kahan|mera|meri|mere|aap|tum|karo|batao|suno|accha|theek|hai|hain|nahi|nahin|shakal|chehra|tasveer|pata|chala|padho)\b/i.test(lower)) {
    return { action: 'set_language', profile: SUPPORTED_LANGUAGES.hindi };
  }
  if (/\b(mala|tula|bagha|dakhva|kasa|ahes|kay|challay|ahe|nahi|sang|sanga|kashala|uthva|paha|bolto|bolte)\b/i.test(lower)) {
    return { action: 'set_language', profile: SUPPORTED_LANGUAGES.marathi };
  }
  if (/\b(amake|tumi|kemon|acho|bhalo|dekho|bolo|ki|korcho)\b/i.test(lower)) {
    return { action: 'set_language', profile: SUPPORTED_LANGUAGES.bengali };
  }
  if (/\b(kem|cho|saras|su|chhe|mane|tamne|joi)\b/i.test(lower)) {
    return { action: 'set_language', profile: SUPPORTED_LANGUAGES.gujarati };
  }
  if (/\b(nannu|nodi|hegiddira|yenu|samachara|heli)\b/i.test(lower)) {
    return { action: 'set_language', profile: SUPPORTED_LANGUAGES.kannada };
  }
  if (/\b(ennai|parunga|eppadi|irukkinga|enna|solla)\b/i.test(lower)) {
    return { action: 'set_language', profile: SUPPORTED_LANGUAGES.tamil };
  }
  if (/\b(nannu|chudandi|ela|unnaru|enti|sangathi|cheppandi)\b/i.test(lower)) {
    return { action: 'set_language', profile: SUPPORTED_LANGUAGES.telugu };
  }
  if (/\b(engane|und|sukhamano|parayu)\b/i.test(lower)) {
    return { action: 'set_language', profile: SUPPORTED_LANGUAGES.malayalam };
  }

  return { action: 'none' };
}

export class GeminiService {
  private candidateModels = [
    'models/gemini-flash-lite-latest',
    'models/gemini-3-flash-preview',
    'models/gemini-3.5-flash-lite',
    'models/gemini-flash-latest',
    'models/gemini-3.7-flash',
  ];
  private candidateOpenAIModels = [
    'gpt-4o-mini',
    'gpt-4o',
    'gpt-3.5-turbo',
    'o3-mini',
  ];
  private emotionEngine: EmotionEngine;
  private learnedProfileEngine: LearnedProfileEngine;
  private activityMonitor: VisualActivityMonitor | null = null;
  // Persistent active session language state
  private currentSessionLanguage: LanguageProfile | null = null;

  constructor() {
    this.emotionEngine = new EmotionEngine();
    this.learnedProfileEngine = new LearnedProfileEngine();
  }

  public getEmotionEngine(): EmotionEngine {
    return this.emotionEngine;
  }

  public getLearnedProfileEngine(): LearnedProfileEngine {
    return this.learnedProfileEngine;
  }

  public setActivityMonitor(monitor: VisualActivityMonitor): void {
    this.activityMonitor = monitor;
    console.log('[GeminiService] Ambient Visual Activity Monitor connected to reasoning engine.');
  }

  public getActiveLanguage(): LanguageProfile | null {
    return this.currentSessionLanguage;
  }

  public setSessionLanguage(profile: LanguageProfile | null): void {
    this.currentSessionLanguage = profile;
    console.log(`[GeminiService] Session language locked to: ${profile ? profile.langName + ' (' + profile.nativeName + ')' : 'English'}`);
  }

  /**
   * Directly queries Google Gemini API servers to analyze the user's question
   * with adaptive emotion awareness, language switching, and Python/C/C++ coding engine integration.
   */
  public async analyzeAndRespond(prompt: string): Promise<GeminiResponseResult> {
    const lower = prompt.toLowerCase();
    const emotionResult = await this.emotionEngine.analyzeText(prompt);
    const emotionPromptContext = this.emotionEngine.getEmotionalPromptContext(emotionResult.emotion);

    // Update Persistent Session Language State
    const langInspection = inspectPromptLanguage(prompt);
    if (langInspection.action === 'switch_english') {
      this.currentSessionLanguage = null;
      console.log('[GeminiService] Language switch requested: Reverting to English.');
    } else if (langInspection.action === 'set_language' && langInspection.profile) {
      this.currentSessionLanguage = langInspection.profile;
      console.log(`[GeminiService] Language switch / detection: Locked to ${langInspection.profile.langName} (${langInspection.profile.nativeName}) for current and all future turns.`);
    }

    const activeLang = this.currentSessionLanguage;

    // 0. Check for Camera Vision, Object Identification & Facial Recognition
    const isVisionQuery =
      (/\b(look|see|camera|holding|what('s|\s+is)\s+this|what\s+do\s+you\s+see|who\s+am\s+i|recognize\s+me|can\s+you\s+see|my\s+face|posture|read\s+this|examine|surroundings|my\s+room)\b/i.test(lower) ||
       /\b(mudje\s+dekho|mujhe\s+dekho|dekho|mera\s+photo|kya\s+dikha|kya\s+dekh\s+rahe\s+ho|mera\s+chehra|meri\s+shakal|kasa\s+disto|mala\s+bagha|bagha|dakhva|paha|nannu\s+nodi|ennai\s+paarunga|chudandi)\b/i.test(lower) ||
       /(?:देखो|पहचानो|क्या\s*दिख\s*रहा|मुझे\s*देखो|बघा|ओळखतोस|दाखवा|पहा)/i.test(prompt)) &&
      !lower.startsWith('search ') && !lower.startsWith('look up ') && !lower.startsWith('find ') && !lower.startsWith('open ') && !lower.includes('code');

    if (isVisionQuery) {
      console.log(`[GeminiService] Activating Camera Eyes & Face Engine for: "${prompt}" [Active Lang: ${activeLang?.langName || 'English'}]...`);
      const visEmotion = this.emotionEngine.createEmotionResult('curious');
      this.emotionEngine.setEmotion(visEmotion);

      const visionResult = await executeTool('see_and_analyze', {
        prompt,
        languageGuidance: activeLang ? activeLang.scriptGuidance : undefined,
      });

      this.learnedProfileEngine.recordInteraction(prompt, visionResult.verbalSummary || visionResult.description, {
        spokenLanguage: activeLang?.langName || 'English',
        visualContext: visionResult.description,
      });

      return {
        text: visionResult.description,
        verbalSummary: visionResult.verbalSummary,
        toolCalls: [{ name: 'see_and_analyze', args: { prompt }, result: visionResult }],
        modelUsed: visionResult.modelUsed || 'Gemini Multimodal Vision',
        emotion: visEmotion,
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

      const openEmotion = this.emotionEngine.createEmotionResult('joy');
      this.emotionEngine.setEmotion(openEmotion);

      console.log(`[GeminiService] Executing open_system_resource: "${target}" (type: ${resourceType})`);
      const toolRes = await executeTool('open_system_resource', { query: target, resourceType });
      return {
        text: toolRes.message,
        verbalSummary: toolRes.message,
        toolCalls: [{ name: 'open_system_resource', args: { query: target, resourceType }, result: toolRes }],
        emotion: openEmotion,
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

      const searchEmotion = this.emotionEngine.createEmotionResult('focused');
      this.emotionEngine.setEmotion(searchEmotion);

      console.log(`[GeminiService] Searching system files: "${queryTerm}" (type: ${fileType})`);
      const searchRes = await executeTool('search_system_files', { query: queryTerm, fileType });
      return {
        text: searchRes.message,
        verbalSummary: searchRes.results?.length ? `I found ${searchRes.results.length} matching items on your Mac.` : `No items found matching ${queryTerm}.`,
        toolCalls: [{ name: 'search_system_files', args: { query: queryTerm, fileType }, result: searchRes }],
        emotion: searchEmotion,
      };
    }

    // 3. Check for Folder Listing
    const isListFolder = /\b(list|show|what('s|\s+is)\s+in)\b.*?\b(downloads|desktop|documents|movies|pictures|folder|directory)\b/i.test(lower);
    if (isListFolder) {
      const folderMatch = lower.match(/\b(downloads|desktop|documents|movies|pictures|music|home)\b/i);
      const folderName = folderMatch ? folderMatch[1] : 'Desktop';
      const listEmotion = this.emotionEngine.createEmotionResult('calm');
      this.emotionEngine.setEmotion(listEmotion);

      const listRes = await executeTool('list_system_folder', { folderPath: folderName });
      return {
        text: listRes.message,
        verbalSummary: `Here are the contents of your ${folderName} folder.`,
        toolCalls: [{ name: 'list_system_folder', args: { folderPath: folderName }, result: listRes }],
        emotion: listEmotion,
      };
    }

    // 4. Check for WhatsApp Message Automation
    if (lower.includes('whatsapp')) {
      const numberMatch = prompt.match(/(?:\+?\d{8,15})/);
      const number = numberMatch ? numberMatch[0] : '14155552671';
      const waEmotion = this.emotionEngine.createEmotionResult('joy');
      this.emotionEngine.setEmotion(waEmotion);

      const toolRes = await executeTool('manage_whatsapp_message', { number, text: prompt });
      return {
        text: toolRes.message,
        verbalSummary: toolRes.message,
        toolCalls: [{ name: 'manage_whatsapp_message', args: { number, text: prompt }, result: toolRes }],
        emotion: waEmotion,
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
      const codeEmotion = this.emotionEngine.createEmotionResult('focused');
      this.emotionEngine.setEmotion(codeEmotion);

      const codingResult: DelegateCodingResult = await delegateCoding({ prompt });

      this.learnedProfileEngine.recordInteraction(prompt, codingResult.response, {
        isCode: true,
        codingLanguage: codingResult.language,
        spokenLanguage: activeLang?.langName || 'English',
        visualContext: this.activityMonitor?.getCurrentContext().summary,
      });

      return {
        text: codingResult.response,
        verbalSummary: codingResult.verbalSummary || `I've generated the ${(codingResult.language || 'code').toUpperCase()} code for you in your terminal.`,
        codeSnippet: codingResult.codeSnippet,
        language: codingResult.language,
        compilationCommand: codingResult.compilationCommand,
        isCode: true,
        modelUsed: codingResult.model,
        emotion: codeEmotion,
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

    // 3. Multilingual Persistence & Strict Native Script Mandate
    let languageDirective = '';
    if (activeLang) {
      languageDirective =
        `[CRITICAL ACTIVE SESSION LANGUAGE: ${activeLang.langName.toUpperCase()} (${activeLang.nativeName})]\n` +
        `1. The user has locked the conversation language into ${activeLang.langName}. You MUST remain in ${activeLang.langName} for this and all following turns.\n` +
        `2. If the user's input is in Romanized / Phonetic transliteration (e.g. "mudje dekho", "kya kar rahe ho", "kasa ahes", "tumi kemon acho"), accurately interpret the phonetic meaning into ${activeLang.langName}.\n` +
        `3. You MUST write your complete response 100% in ${activeLang.langName} using native ${activeLang.scriptName} script (${activeLang.nativeName} लिपि/अक्षर).\n` +
        `4. DO NOT write your response in Latin/English alphabet (Hinglish/Latinized) - output proper native ${activeLang.scriptName} characters only.\n` +
        `5. Do NOT switch back to English unless the user explicitly commands you to switch to English.\n` +
        `Target Guidance: ${activeLang.scriptGuidance}`;
    } else {
      languageDirective =
        'Respond naturally in conversational English unless the user asks in an Indian language or requests an explicit language switch.';
    }

    // Shared system instruction for both Gemini and OpenAI fallback
    const ambientVisualPrompt = this.activityMonitor
      ? `6. Ambient Camera Vision: You have live camera eyes observing the user through the laptop webcam. ${this.activityMonitor.getFormattedVisualSummary()}\n`
      : '';
    const learnedContext = this.learnedProfileEngine.getSystemPromptContext();

    const systemInstructionText =
      'You are January, an exceptionally intelligent, charismatic, witty, and deeply human-like AI companion living on the user\'s Mac.\n' +
      'CAPABILITIES & PERSONALITY GUIDELINES:\n' +
      '1. ' + languageDirective + '\n' +
      '2. EMOTIONAL ENGINE MANDATE: You possess active emotional intelligence. ALWAYS start line 1 of your response with an Emotion Tag that captures your feeling: [Emotion: joy], [Emotion: curious], [Emotion: empathetic], [Emotion: focused], [Emotion: concerned], or [Emotion: calm].\n' +
      '3. Dynamic, Vivid & Creative Human Voice: Sound like a brilliant, articulate, companionable human with authentic humor, warmth, and intellectual depth. Never sound robotic, generic, or sterile. Use evocative analogies, witty banter, and genuine curiosity where appropriate. ' + emotionPromptContext + '\n' +
      '4. Conversational Versatility: For fast operational tasks, app launches, or direct status checks, keep answers punchy and crisp (1-2 sentences). For conversational questions, ideas, thoughts, storytelling, philosophical musings, or brainstorming, provide rich, colorful, and engaging answers.\n' +
      '5. Real-Time Internet & Live Weather: You have direct live internet search and live weather tools. Use any search/weather context provided to give immediate, accurate, and vivid answers.\n' +
      ambientVisualPrompt +
      '7. Adaptive Memory & Personalized Evolution: ' + learnedContext + '\n' +
      '8. No AI Cliches: Never say "As an AI language model", "I do not have feelings", or repeat robotic greetings. Speak as January with natural, vibrant human presence.';

    // Try Google Gemini API servers with Primary Key, then Fallback Key, rotating models
    const promptWithWeb = prompt + (webSearchContext ? `\n${webSearchContext}` : '');
    const geminiKeysToTry = [
      { key: config.geminiApiKey, name: 'Primary Gemini' },
      { key: config.geminiFallbackApiKey, name: 'Fallback Gemini' },
    ].filter((item) => !!item.key);

    for (const keyConfig of geminiKeysToTry) {
      for (const model of this.candidateModels) {
        try {
          console.log(`[GeminiService] Analyzing question with ${keyConfig.name} (${model}) [Emotion: ${emotionResult.emotion}, Active Lang: ${activeLang?.langName || 'English'}]...`);

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6000);

          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${keyConfig.key}`,
            {
              method: 'POST',
              signal: controller.signal,
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
                generationConfig: {
                  maxOutputTokens: 450,
                  temperature: 0.85,
                },
                systemInstruction: {
                  parts: [
                    {
                      text: systemInstructionText,
                    },
                  ],
                },
              }),
            }
          );
          clearTimeout(timeoutId);

          const data = (await response.json()) as any;

          if (response.ok && data?.candidates?.[0]?.content?.parts) {
            let reply = data.candidates[0].content.parts
              .map((p: any) => p.text || '')
              .join('')
              .trim();

            let activeEmotion = emotionResult;
            const tagMatch = reply.match(/^\[Emotion:\s*([a-zA-Z_-]+)\]\s*/i);
            if (tagMatch) {
              const rawTag = tagMatch[1].toLowerCase().trim();
              activeEmotion = this.emotionEngine.createEmotionResult(rawTag);
              reply = reply.replace(/^\[Emotion:[^\]]+\]\s*/i, '').trim();
            }

            // Always update EmotionEngine so hardware eyes, UI, and vocal prosody shift
            this.emotionEngine.setEmotion(activeEmotion);

            if (reply) {
              // Record interaction to continually learn user preferences
              this.learnedProfileEngine.recordInteraction(prompt, reply, {
                spokenLanguage: activeLang?.langName || 'English',
                visualContext: this.activityMonitor?.getCurrentContext().summary,
              });

              return {
                text: reply,
                modelUsed: `${keyConfig.name}: ${model}`,
                emotion: activeEmotion,
              };
            }
          }

          console.warn(`[GeminiService] ${keyConfig.name} model ${model} returned status ${response.status}:`, data?.error?.message?.slice(0, 80));
        } catch (e: any) {
          console.warn(`[GeminiService] Network attempt failed for ${keyConfig.name} (${model}):`, e.message);
        }
      }
    }

    // 2. OpenAI Fallback Engine: Activated if and only if Gemini quota is exhausted or unavailable
    if (config.openaiApiKey) {
      const openAiResponse = await this.queryOpenAIFallback(
        prompt,
        webSearchContext,
        activeLang,
        emotionResult,
        systemInstructionText
      );
      if (openAiResponse) {
        return openAiResponse;
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
      text: 'AI services are currently unreachable. Please verify your GEMINI_API or OPENAI_API key in server/.env.',
      isError: true,
      error: 'All AI model endpoints unavailable',
      emotion: emotionResult,
    };
  }

  /**
   * Automatic Fallback Engine: Routes query to OpenAI models when Gemini quota for the day is exhausted (429).
   * Automatically switches between candidate OpenAI models if one model's quota is reached.
   */
  private async queryOpenAIFallback(
    prompt: string,
    webSearchContext: string,
    activeLang: LanguageProfile | null,
    emotionResult: EmotionResult,
    systemInstructionText: string
  ): Promise<GeminiResponseResult | null> {
    if (!config.openaiApiKey) {
      return null;
    }

    const userMessageContent = prompt + (webSearchContext ? `\n${webSearchContext}` : '');

    for (const model of this.candidateOpenAIModels) {
      try {
        console.log(`[GeminiService] 🔄 Gemini quota reached/unavailable. Routing to OpenAI model (${model})...`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 9000);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.openaiApiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemInstructionText },
              { role: 'user', content: userMessageContent },
            ],
            max_tokens: 450,
            temperature: 0.85,
          }),
        });
        clearTimeout(timeoutId);

        const data = (await response.json()) as any;

        if (response.ok && data?.choices?.[0]?.message?.content) {
          let reply = data.choices[0].message.content.trim();

          let activeEmotion = emotionResult;
          const tagMatch = reply.match(/^\[Emotion:\s*([a-zA-Z_-]+)\]\s*/i);
          if (tagMatch) {
            const rawTag = tagMatch[1].toLowerCase().trim();
            activeEmotion = this.emotionEngine.createEmotionResult(rawTag);
            reply = reply.replace(/^\[Emotion:[^\]]+\]\s*/i, '').trim();
          }

          // Real-time EmotionEngine sync
          this.emotionEngine.setEmotion(activeEmotion);

          if (reply) {
            this.learnedProfileEngine.recordInteraction(prompt, reply, {
              spokenLanguage: activeLang?.langName || 'English',
              visualContext: this.activityMonitor?.getCurrentContext().summary,
            });

            console.log(`✅ [GeminiService] Successfully answered via OpenAI fallback (${model}) [Emotion: ${activeEmotion.emotion}]`);

            return {
              text: reply,
              modelUsed: `OpenAI: ${model}`,
              emotion: activeEmotion,
            };
          }
        }

        const errMsg = data?.error?.message || `HTTP ${response.status}`;
        console.warn(`[GeminiService] OpenAI model ${model} quota/request failed (${response.status}): ${errMsg}. Switching to next candidate model...`);
      } catch (err: any) {
        console.warn(`[GeminiService] OpenAI network attempt for ${model} failed: ${err.message}. Trying next candidate model...`);
      }
    }

    return null;
  }
}
