import { blenderBridge, Create3DModelOptions, Create3DModelResult } from '../blender/blenderBridge.js';

export async function create3DModelTool(args: Create3DModelOptions): Promise<Create3DModelResult> {
  return await blenderBridge.create3DModel(args);
}
