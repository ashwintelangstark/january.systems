import { modelRouter } from '../models/modelRouter.js';

export interface ManageModelArgs {
  action: 'list' | 'switch' | 'status' | 'reset';
  model?: string;
  category?: 'coding' | 'vision' | 'reasoning' | 'fast' | 'general' | 'creative' | 'free';
  search?: string;
  limit?: number;
}

export interface ManageModelResult {
  success: boolean;
  message: string;
  activeModel?: string | null;
  tierMode?: string;
  models?: Array<{ id: string; name: string; is_free: boolean; context_length: number }>;
}

export async function manageAiModel(args: ManageModelArgs): Promise<ManageModelResult> {
  const registry = modelRouter.getRegistry();

  switch (args.action) {
    case 'switch': {
      if (!args.model) {
        return {
          success: false,
          message: 'Please provide a model name or ID to switch to.',
        };
      }
      const res = modelRouter.setSessionModel(args.model);
      return {
        success: res.success,
        message: res.message,
        activeModel: res.model?.id || null,
        tierMode: modelRouter.getTierMode(),
      };
    }

    case 'reset': {
      const msg = modelRouter.resetSessionModel();
      return {
        success: true,
        message: msg,
        activeModel: null,
        tierMode: modelRouter.getTierMode(),
      };
    }

    case 'status': {
      const active = modelRouter.getActiveSessionModel();
      const allCount = registry.getAllModels().length;
      return {
        success: true,
        message: active
          ? `Current active AI model: **${active.name}** (\`${active.id}\` | Context: ${active.context_length} tokens | Free: ${active.is_free ? 'Yes' : 'No'}). Total available catalog: ${allCount} models.`
          : `Current AI model routing: **Dynamic Auto-Routing** across ${allCount} available models.`,
        activeModel: active?.id || null,
        tierMode: modelRouter.getTierMode(),
      };
    }

    case 'list':
    default: {
      let filtered = registry.getAllModels();

      if (args.category) {
        filtered = registry.getModelsByCategory(args.category);
      }

      if (args.search) {
        const s = args.search.toLowerCase();
        filtered = filtered.filter((m) => m.id.toLowerCase().includes(s) || m.name.toLowerCase().includes(s));
      }

      const limit = args.limit || 15;
      const count = filtered.length;
      const sample = filtered.slice(0, limit).map((m) => ({
        id: m.id,
        name: m.name,
        is_free: m.is_free,
        context_length: m.context_length,
      }));

      const categoryLabel = args.category ? ` in category "${args.category}"` : '';
      const searchLabel = args.search ? ` matching "${args.search}"` : '';

      return {
        success: true,
        message: `Found ${count} models${categoryLabel}${searchLabel}. Displaying top ${Math.min(limit, count)}:`,
        activeModel: modelRouter.getActiveSessionModel()?.id || null,
        tierMode: modelRouter.getTierMode(),
        models: sample,
      };
    }
  }
}
