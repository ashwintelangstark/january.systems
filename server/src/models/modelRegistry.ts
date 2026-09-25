import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface OpenRouterModelInfo {
  id: string;
  name: string;
  created?: number;
  description?: string;
  context_length: number;
  modality: string;
  input_modalities: string[];
  output_modalities: string[];
  is_free: boolean;
  pricing: {
    prompt: number;
    completion: number;
    prompt_per_million: number;
    completion_per_million: number;
  };
  supports_vision: boolean;
  supports_tools: boolean;
  categories: Array<'coding' | 'vision' | 'reasoning' | 'fast' | 'general' | 'creative'>;
}

export class ModelRegistry {
  private static instance: ModelRegistry;
  private catalogPath: string;
  private models: Map<string, OpenRouterModelInfo> = new Map();
  private lastFetchedTimestamp = 0;
  private fetchPromise: Promise<number> | null = null;

  private constructor() {
    const dataDir = path.resolve(__dirname, '../../data/models');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch {}
    }
    this.catalogPath = path.join(dataDir, 'catalog.json');
    this.loadFromCache();
  }

  public static getInstance(): ModelRegistry {
    if (!ModelRegistry.instance) {
      ModelRegistry.instance = new ModelRegistry();
    }
    return ModelRegistry.instance;
  }

  /**
   * Loads cached catalog from disk if available
   */
  private loadFromCache(): void {
    try {
      if (fs.existsSync(this.catalogPath)) {
        const raw = fs.readFileSync(this.catalogPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.timestamp && Array.isArray(parsed.models)) {
          this.lastFetchedTimestamp = parsed.timestamp;
          this.models.clear();
          for (const m of parsed.models) {
            this.models.set(m.id, m);
          }
          console.log(`[ModelRegistry] Loaded ${this.models.size} models from disk cache (catalog timestamp: ${new Date(this.lastFetchedTimestamp).toLocaleTimeString()})`);
        }
      }
    } catch (e: any) {
      console.warn('[ModelRegistry] Error loading cache:', e.message);
    }
  }

  /**
   * Refreshes model catalog from OpenRouter/OmniRoute API
   */
  public async refreshCatalog(force = false): Promise<number> {
    const now = Date.now();
    // Cache valid for 24 hours unless forced
    if (!force && this.models.size > 0 && now - this.lastFetchedTimestamp < 24 * 60 * 60 * 1000) {
      return this.models.size;
    }

    if (!config.openrouterApiKey) {
      return this.models.size;
    }

    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    this.fetchPromise = (async () => {
      try {
        console.log('[ModelRegistry] Fetching live model catalog from OpenRouter API...');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const res = await fetch('https://openrouter.ai/api/v1/models', {
          headers: {
            Authorization: `Bearer ${config.openrouterApiKey}`,
            'HTTP-Referer': 'https://january.systems',
            'X-Title': 'January AI',
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const data = (await res.json()) as any;
        const rawList = data?.data || [];
        if (!Array.isArray(rawList) || rawList.length === 0) {
          return this.models.size;
        }

        this.models.clear();
        for (const m of rawList) {
          const isFree = (m.pricing?.prompt === '0' && m.pricing?.completion === '0') || m.id?.endsWith(':free');
          const pPrompt = m.pricing?.prompt ? parseFloat(m.pricing.prompt) : 0;
          const pComp = m.pricing?.completion ? parseFloat(m.pricing.completion) : 0;
          const inMods = m.architecture?.input_modalities || [];
          const supportsVision = inMods.includes('image') || (m.architecture?.modality || '').includes('image');
          const supportsTools = Array.isArray(m.supported_parameters) && m.supported_parameters.includes('tools');

          const categories: Array<'coding' | 'vision' | 'reasoning' | 'fast' | 'general' | 'creative'> = ['general'];

          const textToScan = `${m.id} ${m.name || ''} ${m.description || ''}`.toLowerCase();

          if (/\b(coder?|coding|dev|programming|python|sql|c\+\+|javascript|typescript)\b/i.test(textToScan)) {
            categories.push('coding');
          }
          if (supportsVision) {
            categories.push('vision');
          }
          if (/\b(reasoning|r1|o1|o3|thinking|math|logic|cot)\b/i.test(textToScan)) {
            categories.push('reasoning');
          }
          if (isFree || (m.context_length && m.context_length <= 32768) || /\b(flash|mini|small|lite|instant|lightning|turbo)\b/i.test(textToScan)) {
            categories.push('fast');
          }
          if (/\b(creative|story|writing|roleplay|chat|novel|human)\b/i.test(textToScan)) {
            categories.push('creative');
          }

          const modelInfo: OpenRouterModelInfo = {
            id: m.id,
            name: m.name || m.id,
            created: m.created,
            description: m.description,
            context_length: m.context_length || 4096,
            modality: m.architecture?.modality || 'text->text',
            input_modalities: inMods,
            output_modalities: m.architecture?.output_modalities || ['text'],
            is_free: isFree,
            pricing: {
              prompt: pPrompt,
              completion: pComp,
              prompt_per_million: +(pPrompt * 1000000).toFixed(4),
              completion_per_million: +(pComp * 1000000).toFixed(4),
            },
            supports_vision: supportsVision,
            supports_tools: supportsTools,
            categories,
          };

          this.models.set(modelInfo.id, modelInfo);
        }

        this.lastFetchedTimestamp = Date.now();

        // Persist to disk cache
        try {
          const payload = {
            timestamp: this.lastFetchedTimestamp,
            count: this.models.size,
            models: Array.from(this.models.values()),
          };
          fs.writeFileSync(this.catalogPath, JSON.stringify(payload, null, 2), 'utf8');
          console.log(`✅ [ModelRegistry] Saved ${this.models.size} models to catalog.json`);
        } catch (saveErr: any) {
          console.warn('[ModelRegistry] Could not write cache:', saveErr.message);
        }

        return this.models.size;
      } catch (err: any) {
        console.warn('[ModelRegistry] Failed to fetch live models:', err.message);
        return this.models.size;
      } finally {
        this.fetchPromise = null;
      }
    })();

    return this.fetchPromise;
  }

  public getAllModels(): OpenRouterModelInfo[] {
    return Array.from(this.models.values());
  }

  public getModelById(id: string): OpenRouterModelInfo | undefined {
    return this.models.get(id);
  }

  /**
   * Fuzzy matches a model by user query (e.g. "claude 3.7", "deepseek r1", "liquid", "gpt 4o", "llama 3.3")
   */
  public findModel(query: string): OpenRouterModelInfo | undefined {
    const q = query.toLowerCase().trim().replace(/^models\//, '');
    if (!q) return undefined;

    // 1. Exact ID match
    if (this.models.has(q)) return this.models.get(q);

    // 2. Exact match against end of slug (e.g. "deepseek-r1" matching "deepseek/deepseek-r1")
    for (const [id, m] of this.models.entries()) {
      if (id.toLowerCase() === q || id.toLowerCase().endsWith('/' + q)) {
        return m;
      }
    }

    // 3. Normalized slug comparison (stripping hyphens, colons, slashes)
    const normQ = q.replace(/[^a-z0-9]/g, '');
    for (const [id, m] of this.models.entries()) {
      const normId = id.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normName = m.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normId.includes(normQ) || normName.includes(normQ)) {
        return m;
      }
    }

    // 4. Word-token intersection score (prefer non-batch variants)
    const qTokens = q.split(/[\s\-_/:]+/).filter((t) => t.length > 1);
    let bestMatch: OpenRouterModelInfo | undefined;
    let highestScore = 0;

    for (const m of this.models.values()) {
      const isBatch = m.id.endsWith(':batch');
      const targetStr = `${m.id} ${m.name}`.toLowerCase();
      let matchCount = 0;
      for (const token of qTokens) {
        if (targetStr.includes(token)) matchCount += 2;
      }
      // Penalize batch models when user queries general name
      if (isBatch) matchCount -= 1;

      if (matchCount > highestScore && matchCount >= 1) {
        highestScore = matchCount;
        bestMatch = m;
      }
    }

    return bestMatch;
  }

  /**
   * Filter models by capability category and free-status
   */
  public getModelsByCategory(category: 'coding' | 'vision' | 'reasoning' | 'fast' | 'general' | 'creative' | 'free', freeOnly = false): OpenRouterModelInfo[] {
    return Array.from(this.models.values()).filter((m) => {
      if (freeOnly && !m.is_free) return false;
      if (category === 'free') return m.is_free;
      if (category === 'vision') return m.supports_vision;
      return m.categories.includes(category);
    });
  }
}
