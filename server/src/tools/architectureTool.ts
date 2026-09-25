import { planAnalyzer, PlanAnalysisOptions } from '../vision/planAnalyzer.js';
import { architecturalBridge, BuildArchitectureResult } from '../blender/architecturalBridge.js';

export interface ConvertPlanTo3DArgs extends PlanAnalysisOptions {
  openInBlender?: boolean;
}

export async function convertPlanTo3D(args: ConvertPlanTo3DArgs = {}): Promise<BuildArchitectureResult> {
  console.log('[ArchitectureTool] Starting 2D Floor Plan to 3D Blender pipeline...');

  // 1. Analyze 2D Plan (Camera snapshot or local file)
  const analysis = await planAnalyzer.analyzePlan({
    imagePath: args.imagePath,
    fromCamera: args.fromCamera,
    userPrompt: args.userPrompt,
    style: args.style,
    viewMode: args.viewMode,
  });

  if (!analysis.success || !analysis.blueprint) {
    return {
      success: false,
      projectName: 'Unknown Plan',
      blendFilePath: '',
      message: analysis.error || 'Failed to analyze architectural floor plan.',
      verbalSummary: 'I could not parse the architectural drawing to create the 3D model.',
      error: analysis.error,
    };
  }

  // 2. Build 3D Model in Blender & Launch GUI
  const shouldOpen = args.openInBlender !== false;
  return await architecturalBridge.buildArchitecture(analysis.blueprint, shouldOpen);
}
