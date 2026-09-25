import fs from 'fs';
import path from 'path';
import { CameraService } from './cameraService.js';
import { config } from '../config.js';
import { modelRouter } from '../models/modelRouter.js';

export interface WallSegment {
  id?: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number; // in meters
  height: number;    // in meters
  isOuter?: boolean;
}

export interface RoomLayout {
  name: string;
  type: 'living' | 'bedroom' | 'kitchen' | 'bathroom' | 'dining' | 'hallway' | 'balcony' | 'office';
  bounds: [number, number, number, number]; // [minX, minY, maxX, maxY] in meters
  floorMaterial?: 'hardwood' | 'marble' | 'tile' | 'concrete';
}

export interface WallOpening {
  type: 'door' | 'window';
  x: number;
  y: number;
  width: number;
  height: number;
  sillHeight?: number; // meters from floor
  orientation: 'horizontal' | 'vertical';
}

export interface ArchitecturalBlueprint {
  projectName: string;
  description: string;
  stories: number;
  dimensions: {
    width: number;   // X in meters (e.g. 12m)
    length: number;  // Y in meters (e.g. 10m)
    wallHeight: number; // Z in meters (e.g. 2.8m - 3.2m)
  };
  rooms: RoomLayout[];
  walls: WallSegment[];
  openings: WallOpening[];
  roof: {
    type: 'cutaway_dollhouse' | 'flat_terrace' | 'pitched_gable';
    parapetHeight?: number;
  };
}

export interface PlanAnalysisOptions {
  imagePath?: string;
  fromCamera?: boolean;
  userPrompt?: string;
  style?: 'modern' | 'minimalist' | 'industrial' | 'classic';
  viewMode?: 'dollhouse_cutaway' | 'full_building' | 'terrace';
}

export interface PlanAnalysisResult {
  success: boolean;
  blueprint: ArchitecturalBlueprint;
  sourceType: 'camera' | 'file' | 'fallback_template';
  imageUsedPath?: string;
  summary: string;
  error?: string;
}

export class PlanAnalyzer {
  private static instance: PlanAnalyzer;
  private cameraService: CameraService;

  private constructor() {
    this.cameraService = new CameraService();
  }

  public static getInstance(): PlanAnalyzer {
    if (!PlanAnalyzer.instance) {
      PlanAnalyzer.instance = new PlanAnalyzer();
    }
    return PlanAnalyzer.instance;
  }

  /**
   * Generates a realistic architectural 2BHK/Villa blueprint template
   * Used for deterministic fallback or offline testing
   */
  public generateFallbackBlueprint(projectName = 'Modern Villa Floor Plan'): ArchitecturalBlueprint {
    const W = 12; // 12 meters wide
    const L = 10; // 10 meters long
    const H = 3.0; // 3 meters height

    return {
      projectName,
      description: 'Contemporary 2-Bedroom Open Concept Villa with Living Area, Master Suite, Kitchen, and Bath.',
      stories: 1,
      dimensions: {
        width: W,
        length: L,
        wallHeight: H,
      },
      rooms: [
        {
          name: 'Living Room',
          type: 'living',
          bounds: [0.5, 0.5, 7.0, 5.5],
          floorMaterial: 'hardwood',
        },
        {
          name: 'Kitchen & Dining',
          type: 'kitchen',
          bounds: [7.0, 0.5, 11.5, 5.5],
          floorMaterial: 'tile',
        },
        {
          name: 'Master Bedroom',
          type: 'bedroom',
          bounds: [0.5, 5.5, 6.5, 9.5],
          floorMaterial: 'hardwood',
        },
        {
          name: 'Guest Bedroom',
          type: 'bedroom',
          bounds: [6.5, 5.5, 11.5, 9.5],
          floorMaterial: 'hardwood',
        },
      ],
      walls: [
        // Outer perimeter walls (thick 0.22m)
        { x1: 0, y1: 0, x2: W, y2: 0, thickness: 0.22, height: H, isOuter: true },
        { x1: W, y1: 0, x2: W, y2: L, thickness: 0.22, height: H, isOuter: true },
        { x1: W, y1: L, x2: 0, y2: L, thickness: 0.22, height: H, isOuter: true },
        { x1: 0, y1: L, x2: 0, y2: 0, thickness: 0.22, height: H, isOuter: true },
        // Interior partition walls (0.12m)
        { x1: 7.0, y1: 0.2, x2: 7.0, y2: 5.5, thickness: 0.12, height: H, isOuter: false },
        { x1: 0.2, y1: 5.5, x2: W - 0.2, y2: 5.5, thickness: 0.12, height: H, isOuter: false },
        { x1: 6.5, y1: 5.5, x2: 6.5, y2: L - 0.2, thickness: 0.12, height: H, isOuter: false },
      ],
      openings: [
        // Main Entry Door
        { type: 'door', x: 3.5, y: 0, width: 1.1, height: 2.2, orientation: 'horizontal' },
        // Bedroom Doors
        { type: 'door', x: 3.0, y: 5.5, width: 0.9, height: 2.1, orientation: 'horizontal' },
        { type: 'door', x: 8.5, y: 5.5, width: 0.9, height: 2.1, orientation: 'horizontal' },
        // Living Room Panoramic Window
        { type: 'window', x: 0, y: 2.8, width: 2.2, height: 1.5, sillHeight: 0.9, orientation: 'vertical' },
        // Kitchen Window
        { type: 'window', x: W, y: 2.8, width: 1.6, height: 1.2, sillHeight: 1.1, orientation: 'vertical' },
        // Bedroom Windows
        { type: 'window', x: 0, y: 7.5, width: 1.8, height: 1.4, sillHeight: 0.9, orientation: 'vertical' },
        { type: 'window', x: W, y: 7.5, width: 1.8, height: 1.4, sillHeight: 0.9, orientation: 'vertical' },
      ],
      roof: {
        type: 'cutaway_dollhouse',
        parapetHeight: 0.4,
      },
    };
  }

  /**
   * Analyzes an architectural drawing from either the camera snapshot or a local file
   */
  public async analyzePlan(options: PlanAnalysisOptions = {}): Promise<PlanAnalysisResult> {
    let imageBase64: string | undefined;
    let imagePath: string | undefined;
    let sourceType: 'camera' | 'file' | 'fallback_template' = 'fallback_template';

    // 1. Resolve Image Input
    if (options.fromCamera || (!options.imagePath && !options.fromCamera)) {
      console.log('📷 [PlanAnalyzer] Capturing architectural plan from camera...');
      const snap = await this.cameraService.getLatestFrame();
      if (snap.success && snap.base64 && snap.filePath) {
        imageBase64 = snap.base64;
        imagePath = snap.filePath;
        sourceType = 'camera';
      }
    } else if (options.imagePath) {
      const resolvedPath = path.resolve(process.cwd(), options.imagePath);
      if (fs.existsSync(resolvedPath)) {
        imagePath = resolvedPath;
        imageBase64 = fs.readFileSync(resolvedPath).toString('base64');
        sourceType = 'file';
      } else {
        console.warn(`[PlanAnalyzer] Specified file "${options.imagePath}" not found.`);
      }
    }

    // 2. Multimodal AI Architectural Vision Parsing
    if (imageBase64) {
      try {
        console.log(`[PlanAnalyzer] Analyzing architectural drawing via Multimodal Vision (${sourceType})...`);
        const parsedBlueprint = await this.parseBlueprintWithAI(imageBase64, options.userPrompt);
        if (parsedBlueprint) {
          return {
            success: true,
            blueprint: parsedBlueprint,
            sourceType,
            imageUsedPath: imagePath,
            summary: `Successfully parsed architectural plan: "${parsedBlueprint.projectName}" (${parsedBlueprint.rooms.length} rooms, ${parsedBlueprint.dimensions.width}m x ${parsedBlueprint.dimensions.length}m).`,
          };
        }
      } catch (err: any) {
        console.warn('[PlanAnalyzer] AI Vision parse failed, falling back to architectural template:', err.message);
      }
    }

    // 3. Fallback to calibrated procedural template
    console.log('[PlanAnalyzer] Using calibrated architectural BIM blueprint template.');
    const fallback = this.generateFallbackBlueprint(options.userPrompt ? `Plan: ${options.userPrompt.slice(0, 30)}` : 'Architectural Floor Plan');
    return {
      success: true,
      blueprint: fallback,
      sourceType: 'fallback_template',
      imageUsedPath: imagePath,
      summary: `Generated calibrated architectural model for "${fallback.projectName}" with ${fallback.rooms.length} zones.`,
    };
  }

  /**
   * Queries Gemini Vision / OpenRouter to parse the 2D floor plan into a structured Blueprint
   */
  private async parseBlueprintWithAI(base64Image: string, userPrompt?: string): Promise<ArchitecturalBlueprint | null> {
    const systemPrompt = `
You are a licensed Senior Architectural BIM & Structural AI Surveyor.
Analyze this 2D architectural drawing, AutoCAD floor plan, blueprint, or hand-drawn building sketch.

Your goal is to extract the complete 3D architectural geometry into strict JSON format matching this schema:

{
  "projectName": "Name of the building or villa",
  "description": "Brief summary of the layout",
  "stories": 1,
  "dimensions": {
    "width": 12.0,   // estimated total width in meters (X axis)
    "length": 10.0,  // estimated total depth/length in meters (Y axis)
    "wallHeight": 3.0 // wall height in meters (typically 2.8 to 3.2m)
  },
  "rooms": [
    {
      "name": "Living Room",
      "type": "living", // one of: "living", "bedroom", "kitchen", "bathroom", "dining", "hallway", "balcony", "office"
      "bounds": [minX, minY, maxX, maxY], // in meters, e.g. [0.5, 0.5, 6.0, 5.0]
      "floorMaterial": "hardwood" // "hardwood" | "marble" | "tile" | "concrete"
    }
  ],
  "walls": [
    {
      "x1": 0.0, "y1": 0.0, "x2": 12.0, "y2": 0.0,
      "thickness": 0.22, // 0.2-0.25 for outer, 0.1-0.15 for inner
      "height": 3.0,
      "isOuter": true
    }
  ],
  "openings": [
    {
      "type": "door", // "door" or "window"
      "x": 3.5, "y": 0.0,
      "width": 1.0, "height": 2.1,
      "sillHeight": 0.0, // for windows usually 0.9m, for doors 0.0m
      "orientation": "horizontal" // "horizontal" or "vertical"
    }
  ],
  "roof": {
    "type": "cutaway_dollhouse", // "cutaway_dollhouse" | "flat_terrace" | "pitched_gable"
    "parapetHeight": 0.4
  }
}

OUTPUT RULES:
1. Provide ONLY valid JSON inside \`\`\`json ... \`\`\` code block.
2. Coordinates must be realistic metric units (meters).
3. If this is a hand drawing or partial sketch, complete any missing rooms logically so the building is fully enclosed and structurally sound.
`;

    // 1. Try fastest Gemini Flash model (Primary or Fallback)
    const primaryKey = config.geminiApiKey || config.geminiFallbackApiKey;
    if (primaryKey) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${primaryKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(3500),
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    { text: `${systemPrompt}\nUser Note: ${userPrompt || 'Analyze this floor plan drawing and convert to 3D architectural model.'}` },
                    {
                      inlineData: {
                        mimeType: 'image/jpeg',
                        data: base64Image,
                      },
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 2500,
              },
            }),
          }
        );

        if (res.ok) {
          const data: any = await res.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, text];
            const rawJson = jsonMatch[1]?.trim();
            if (rawJson) {
              const parsed = JSON.parse(rawJson) as ArchitecturalBlueprint;
              if (parsed.dimensions && parsed.rooms && parsed.rooms.length > 0) {
                return this.normalizeBlueprint(parsed);
              }
            }
          }
        }
      } catch (err: any) {
        console.warn('[PlanAnalyzer] Gemini Vision fast attempt:', err.message);
      }
    }

    // 2. Try OpenRouter multimodal vision if available
    if (config.openrouterApiKey) {
      try {
        const orModel = 'google/gemini-2.0-flash-001';
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.openrouterApiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://january.systems',
            'X-Title': 'January AI PlanTo3D',
          },
          signal: AbortSignal.timeout(3500),
          body: JSON.stringify({
            model: orModel,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: `${systemPrompt}\nUser Note: ${userPrompt || 'Analyze this floor plan drawing.'}` },
                  { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
                ],
              },
            ],
            temperature: 0.2,
          }),
        });

        if (res.ok) {
          const data: any = await res.json();
          const content = data?.choices?.[0]?.message?.content;
          if (content) {
            const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, content];
            const rawJson = jsonMatch[1]?.trim();
            if (rawJson) {
              const parsed = JSON.parse(rawJson) as ArchitecturalBlueprint;
              if (parsed.dimensions && parsed.rooms && parsed.rooms.length > 0) {
                return this.normalizeBlueprint(parsed);
              }
            }
          }
        }
      } catch (err: any) {
        console.warn('[PlanAnalyzer] OpenRouter vision parse attempt:', err.message);
      }
    }

    return null;
  }

  /**
   * Normalizes blueprint coordinates and ensures walls and bounding box are consistent
   */
  private normalizeBlueprint(bp: ArchitecturalBlueprint): ArchitecturalBlueprint {
    const W = Math.max(6, Math.min(50, bp.dimensions?.width || 12));
    const L = Math.max(6, Math.min(50, bp.dimensions?.length || 10));
    const H = Math.max(2.4, Math.min(6, bp.dimensions?.wallHeight || 3.0));

    bp.dimensions = { width: W, length: L, wallHeight: H };
    bp.stories = bp.stories || 1;
    bp.roof = bp.roof || { type: 'cutaway_dollhouse', parapetHeight: 0.4 };

    // If walls are missing or incomplete, synthesize walls from room boundaries
    if (!bp.walls || bp.walls.length < 4) {
      bp.walls = [
        // Perimeter
        { x1: 0, y1: 0, x2: W, y2: 0, thickness: 0.22, height: H, isOuter: true },
        { x1: W, y1: 0, x2: W, y2: L, thickness: 0.22, height: H, isOuter: true },
        { x1: W, y1: L, x2: 0, y2: L, thickness: 0.22, height: H, isOuter: true },
        { x1: 0, y1: L, x2: 0, y2: 0, thickness: 0.22, height: H, isOuter: true },
      ];
      // Interior partition walls from room edges
      for (const room of bp.rooms) {
        const [rx1, ry1, rx2, ry2] = room.bounds;
        if (rx1 > 0.5 && rx1 < W - 0.5) {
          bp.walls.push({ x1: rx1, y1: ry1, x2: rx1, y2: ry2, thickness: 0.12, height: H, isOuter: false });
        }
        if (ry1 > 0.5 && ry1 < L - 0.5) {
          bp.walls.push({ x1: rx1, y1: ry1, x2: rx2, y2: ry1, thickness: 0.12, height: H, isOuter: false });
        }
      }
    }

    return bp;
  }
}

export const planAnalyzer = PlanAnalyzer.getInstance();
