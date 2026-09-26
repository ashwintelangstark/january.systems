import { ModelRegistry, OpenRouterModelInfo } from './modelRegistry.js';
import { config } from '../config.js';

export type ModelTierMode = 'auto' | 'free_only' | 'all';

export interface TaskCandidateOptions {
  taskType?: 'coding' | 'vision' | 'reasoning' | 'general';
  prompt?: string;
  requireVision?: boolean;
}

export class DynamicModelRouter {
  private static instance: DynamicModelRouter;
  private registry: ModelRegistry;
  private activeSessionModel: string | null = null;
  private tierMode: ModelTierMode = (process.env.OPENROUTER_TIER_MODE as ModelTierMode) || 'auto';

  private constructor() {
    this.registry = ModelRegistry.getInstance();
    // Warm up the catalog
    this.registry.refreshCatalog().catch(() => {});
  }

  public static getInstance(): DynamicModelRouter {
    if (!DynamicModelRouter.instance) {
      DynamicModelRouter.instance = new DynamicModelRouter();
    }
    return DynamicModelRouter.instance;
  }

  public getRegistry(): ModelRegistry {
    return this.registry;
  }

  public getTierMode(): ModelTierMode {
    return this.tierMode;
  }

  public setTierMode(mode: ModelTierMode): void {
    this.tierMode = mode;
    console.log(`[DynamicModelRouter] Tier mode set to: ${mode}`);
  }

  public getActiveSessionModel(): OpenRouterModelInfo | null {
    if (!this.activeSessionModel) return null;
    return this.registry.getModelById(this.activeSessionModel) || null;
  }

  /**
   * Manually locks conversation to a specific model by name/ID
   */
  public setSessionModel(query: string): { success: boolean; model?: OpenRouterModelInfo; message: string } {
    const matched = this.registry.findModel(query);
    if (!matched) {
      return {
        success: false,
        message: `Could not find any model matching "${query}" in the catalog of ${this.registry.getAllModels().length} available models.`,
      };
    }

    this.activeSessionModel = matched.id;
    console.log(`[DynamicModelRouter] 🔒 Session model locked to: ${matched.name} (${matched.id})`);
    return {
      success: true,
      model: matched,
      message: `Switched active AI model to **${matched.name}** (\`${matched.id}\`).`,
    };
  }

  /**
   * Resets model selection back to dynamic auto-routing
   */
  public resetSessionModel(): string {
    const prev = this.activeSessionModel;
    this.activeSessionModel = null;
    console.log(`[DynamicModelRouter] Session model reset to dynamic auto-routing (was: ${prev || 'none'}).`);
    return 'Reset AI model to dynamic auto-routing. January will automatically select the best model for each task.';
  }

  /**
   * Detects if user prompt is a model management or switching command
   */
  public detectModelSwitchIntent(prompt: string): {
    isIntent: boolean;
    action?: 'switch' | 'reset' | 'status' | 'list';
    targetModelQuery?: string;
    category?: string;
  } {
    const lower = prompt.toLowerCase().trim();

    // 1. Reset / Auto commands
    if (
      /\b(reset\s+model|default\s+model|auto\s+model|clear\s+model|automatic\s+model\s+routing)\b/i.test(lower) ||
      /^(?:use\s+default\s+model|switch\s+to\s+default|switch\s+to\s+auto)$/i.test(lower)
    ) {
      return { isIntent: true, action: 'reset' };
    }

    // 2. Status / Info commands
    if (
      /\b(what\s+model\s+are\s+you\s+using|current\s+model|which\s+model\s+is\s+active|show\s+active\s+model|model\s+status)\b/i.test(lower) ||
      /^(?:model\s+info|active\s+model)$/i.test(lower)
    ) {
      return { isIntent: true, action: 'status' };
    }

    // 3. List models command
    if (
      /\b(list\s+(?:all\s+)?models|show\s+(?:all\s+)?models|what\s+models\s+(?:do\s+you\s+have|are\s+available))\b/i.test(lower)
    ) {
      let category: string | undefined;
      if (lower.includes('free')) category = 'free';
      else if (lower.includes('coding') || lower.includes('code')) category = 'coding';
      else if (lower.includes('vision') || lower.includes('image')) category = 'vision';
      else if (lower.includes('reasoning')) category = 'reasoning';
      return { isIntent: true, action: 'list', category };
    }

    // 4. Switch model commands
    // e.g. "switch model to deepseek-r1", "change model to claude 3.7", "use model gpt-4o", "set model to llama 3"
    const switchMatch = lower.match(/(?:switch|change|set|select|use)\s+(?:model\s+(?:to\s+)?|to\s+model\s+|to\s+)?([a-z0-9\-_./: ]+?)(?:\s+model|\s+for\s+this|\s+now)?$/i);
    if (
      (lower.startsWith('switch model') ||
       lower.startsWith('change model') ||
       lower.startsWith('set model') ||
       lower.startsWith('use model ') ||
       lower.startsWith('switch to ') ||
       lower.startsWith('change to ')) &&
      switchMatch &&
      switchMatch[1]
    ) {
      const candidateName = switchMatch[1].replace(/^(?:the|to|model)\s+/i, '').trim();
      if (candidateName && candidateName.length > 2 && !candidateName.includes('camera') && !candidateName.includes('hindi') && !candidateName.includes('english')) {
        return { isIntent: true, action: 'switch', targetModelQuery: candidateName };
      }
    }

    return { isIntent: false };
  }

  /**
   * Dynamically resolves the best candidate models for the task,
   * factoring in user-locked model, task category, and tier constraints.
   */
  public getCandidatesForTask(options: TaskCandidateOptions = {}): string[] {
    const candidates: string[] = [];

    // 1. If user explicitly locked a session model, place it first
    if (this.activeSessionModel) {
      const lockedModel = this.registry.getModelById(this.activeSessionModel);
      if (lockedModel) {
        if (!options.requireVision || lockedModel.supports_vision) {
          candidates.push(lockedModel.id);
        }
      }
    }

    const freeOnly = this.tierMode === 'free_only';

    // 2. Select category-specific candidates (ultra-fast verified models prioritized first)
    if (options.taskType === 'vision' || options.requireVision) {
      const visionPool = [
        'openrouter/auto',
        'openrouter/free',
        'meta-llama/llama-3.2-11b-vision-instruct:free',
      ];
      for (const m of visionPool) {
        if (!candidates.includes(m)) candidates.push(m);
      }
    } else if (options.taskType === 'coding') {
      const codingPool = freeOnly
        ? [
            'openrouter/free',
            'cohere/north-mini-code:free',
            'liquid/lfm-2.5-2.6b:free',
            'openrouter/auto',
          ]
        : [
            'openrouter/free',
            'qwen/qwen-2.5-coder-32b-instruct',
            'cohere/north-mini-code:free',
            'liquid/lfm-2.5-2.6b:free',
            'openrouter/auto',
          ];
      for (const m of codingPool) {
        if (!candidates.includes(m)) candidates.push(m);
      }
    } else if (options.taskType === 'reasoning') {
      const reasoningPool = [
        'openrouter/free',
        'deepseek/deepseek-r1',
        'liquid/lfm-2.5-2.6b:free',
        'openrouter/auto',
      ];
      for (const m of reasoningPool) {
        if (!candidates.includes(m)) candidates.push(m);
      }
    } else {
      // General conversational chat: openrouter/free (~500ms) and openrouter/auto
      const generalPool = [
        'openrouter/free',
        'openrouter/auto',
        'liquid/lfm-2.5-2.6b:free',
        'cohere/north-mini-code:free',
      ];
      for (const m of generalPool) {
        if (!candidates.includes(m)) candidates.push(m);
      }
    }

    return candidates;
  }
}

export const modelRouter = DynamicModelRouter.getInstance();
