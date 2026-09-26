import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { windowManager } from '../gui/windowManager.js';
import { bmeshLoftingEngine } from './advanced/bmeshLoftingEngine.js';
import { universal3DEngine } from './advanced/universal3DEngine.js';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface Create3DModelOptions {
  prompt: string;
  fileName?: string;
  openInBlender?: boolean;
  openBrowserForImages?: boolean;
  enableWebGrounding?: boolean;
}

export interface Create3DModelResult {
  success: boolean;
  modelName: string;
  blendFilePath: string;
  objFilePath?: string;
  glbFilePath?: string;
  message: string;
  verbalSummary: string;
  error?: string;
  webReferenceOpened?: boolean;
}

export class BlenderBridge {
  private static instance: BlenderBridge;
  private blenderBinPath = '/Applications/Blender.app/Contents/MacOS/Blender';
  private exportsDir: string;

  private constructor() {
    this.exportsDir = path.resolve(__dirname, '../../data/exports/3d');
    if (!fs.existsSync(this.exportsDir)) {
      try {
        fs.mkdirSync(this.exportsDir, { recursive: true });
      } catch {}
    }
  }

  public static getInstance(): BlenderBridge {
    if (!BlenderBridge.instance) {
      BlenderBridge.instance = new BlenderBridge();
    }
    return BlenderBridge.instance;
  }

  public isBlenderInstalled(): boolean {
    return fs.existsSync(this.blenderBinPath);
  }

  /**
   * Generates a Python script that builds the procedural 3D model in Blender
   */
  private generateBlenderPython(prompt: string, blendPath: string, objPath: string, glbPath: string): string {
    const lower = prompt.toLowerCase();

    // Determine model preset based on user prompt
    let modelType = 'abstract';
    if (lower.includes('sword') || lower.includes('blade') || lower.includes('dagger') || lower.includes('weapon')) {
      modelType = 'sword';
    } else if (lower.includes('cup') || lower.includes('mug') || lower.includes('coffee') || lower.includes('tea')) {
      modelType = 'cup';
    } else if (lower.includes('chair') || lower.includes('stool') || lower.includes('seat')) {
      modelType = 'chair';
    } else if (lower.includes('vase') || lower.includes('pot') || lower.includes('pottery')) {
      modelType = 'vase';
    } else if (lower.includes('car') || lower.includes('vehicle') || lower.includes('rover')) {
      modelType = 'car';
    } else if (lower.includes('monolith') || lower.includes('pillar') || lower.includes('tower')) {
      modelType = 'monolith';
    }

    return `
import bpy
import math

# 1. Reset factory scene to clean slate
bpy.ops.wm.read_factory_settings(use_empty=True)

# Helper function to create materials with Principled BSDF
def create_pbr_material(name, base_color, metallic=0.0, roughness=0.5, emission=None, emission_strength=1.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = base_color
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness
        if emission:
            try:
                bsdf.inputs["Emission Color"].default_value = emission
                bsdf.inputs["Emission Strength"].default_value = emission_strength
            except:
                pass
    return mat

model_type = "${modelType}"

if model_type == "sword":
    # --- Futuristic Cyber-Blade ---
    mat_blade = create_pbr_material("BladeMetal", (0.9, 0.95, 1.0, 1.0), metallic=0.95, roughness=0.15)
    mat_edge = create_pbr_material("PlasmaEdge", (0.0, 0.85, 1.0, 1.0), metallic=0.2, roughness=0.1, emission=(0.0, 0.85, 1.0, 1.0), emission_strength=4.0)
    mat_hilt = create_pbr_material("HiltCarbon", (0.08, 0.08, 0.09, 1.0), metallic=0.4, roughness=0.6)
    
    # Blade
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 1.8))
    blade = bpy.context.active_object
    blade.name = "Blade"
    blade.scale = (0.08, 0.35, 2.5)
    blade.data.materials.append(mat_blade)
    
    # Guard
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.45))
    guard = bpy.context.active_object
    guard.name = "Crossguard"
    guard.scale = (0.25, 1.2, 0.12)
    guard.data.materials.append(mat_hilt)
    
    # Hilt Grip
    bpy.ops.mesh.primitive_cylinder_add(radius=0.1, depth=1.0, location=(0, 0, -0.15))
    hilt = bpy.context.active_object
    hilt.name = "Handle"
    hilt.data.materials.append(mat_hilt)
    
    # Pommel Core
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.18, location=(0, 0, -0.72))
    pommel = bpy.context.active_object
    pommel.name = "EnergyPommel"
    pommel.data.materials.append(mat_edge)

elif model_type == "cup":
    # --- Ceramic Coffee Mug ---
    mat_ceramic = create_pbr_material("CeramicGlaze", (0.1, 0.45, 0.85, 1.0), metallic=0.05, roughness=0.15)
    
    # Cylinder Body
    bpy.ops.mesh.primitive_cylinder_add(radius=1.0, depth=2.0, location=(0, 0, 1.0))
    cup = bpy.context.active_object
    cup.name = "CoffeeMug"
    cup.data.materials.append(mat_ceramic)
    
    # Solidify Modifier to make it hollow
    mod_solid = cup.modifiers.new(name="Solidify", type='SOLIDIFY')
    mod_solid.thickness = 0.12
    
    # Bevel Modifier for smooth lip
    mod_bev = cup.modifiers.new(name="Bevel", type='BEVEL')
    mod_bev.width = 0.04
    mod_bev.segments = 3
    
    # Handle
    bpy.ops.mesh.primitive_torus_add(major_radius=0.7, minor_radius=0.12, location=(1.0, 0, 1.0), rotation=(0, math.radians(90), 0))
    handle = bpy.context.active_object
    handle.name = "MugHandle"
    handle.data.materials.append(mat_ceramic)

elif model_type == "chair":
    # --- Modern Minimalist Chair ---
    mat_wood = create_pbr_material("OakWood", (0.55, 0.38, 0.22, 1.0), metallic=0.0, roughness=0.45)
    mat_metal = create_pbr_material("DarkSteel", (0.12, 0.12, 0.14, 1.0), metallic=0.85, roughness=0.3)
    
    # Seat
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 1.0))
    seat = bpy.context.active_object
    seat.name = "ChairSeat"
    seat.scale = (1.2, 1.2, 0.1)
    seat.data.materials.append(mat_wood)
    
    # Backrest
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.55, 1.8))
    back = bpy.context.active_object
    back.name = "ChairBack"
    back.scale = (1.2, 0.08, 0.8)
    back.data.materials.append(mat_wood)
    
    # 4 Legs
    leg_coords = [(-0.5, -0.5), (0.5, -0.5), (-0.5, 0.5), (0.5, 0.5)]
    for idx, (lx, ly) in enumerate(leg_coords):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.05, depth=1.0, location=(lx, ly, 0.5))
        leg = bpy.context.active_object
        leg.name = f"ChairLeg_{idx+1}"
        leg.data.materials.append(mat_metal)

elif model_type == "vase":
    # --- Terracotta / Porcelain Curved Vase ---
    mat_porcelain = create_pbr_material("Porcelain", (0.92, 0.88, 0.84, 1.0), metallic=0.05, roughness=0.2)
    
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1.2, location=(0, 0, 1.0))
    vase = bpy.context.active_object
    vase.name = "PorcelainVase"
    vase.scale = (1.0, 1.0, 1.6)
    vase.data.materials.append(mat_porcelain)
    
    mod_sub = vase.modifiers.new(name="Subdiv", type='SUBSURF')
    mod_sub.levels = 2

elif model_type == "car":
    # --- Futuristic Low-Poly Vehicle ---
    mat_body = create_pbr_material("CarBodyCyan", (0.0, 0.7, 0.9, 1.0), metallic=0.8, roughness=0.2)
    mat_glass = create_pbr_material("CockpitGlass", (0.05, 0.05, 0.08, 1.0), metallic=0.1, roughness=0.1)
    mat_wheel = create_pbr_material("TireRubber", (0.04, 0.04, 0.04, 1.0), metallic=0.0, roughness=0.8)
    
    # Chassis
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.6))
    chassis = bpy.context.active_object
    chassis.name = "CarChassis"
    chassis.scale = (1.5, 3.2, 0.6)
    chassis.data.materials.append(mat_body)
    
    # Cabin
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.2, 1.1))
    cabin = bpy.context.active_object
    cabin.name = "CarCabin"
    cabin.scale = (1.2, 1.8, 0.5)
    cabin.data.materials.append(mat_glass)
    
    # Wheels
    wheel_coords = [(-0.9, 1.2), (0.9, 1.2), (-0.9, -1.2), (0.9, -1.2)]
    for idx, (wx, wy) in enumerate(wheel_coords):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.4, depth=0.3, location=(wx, wy, 0.4), rotation=(0, math.radians(90), 0))
        wheel = bpy.context.active_object
        wheel.name = f"Wheel_{idx+1}"
        wheel.data.materials.append(mat_wheel)

else:
    # --- Abstract Mathematical Torus Knot / Monolith ---
    mat_holo = create_pbr_material("IridescentKnot", (0.85, 0.25, 0.9, 1.0), metallic=0.9, roughness=0.15)
    bpy.ops.mesh.primitive_torus_add(major_radius=1.5, minor_radius=0.45, location=(0, 0, 1.5))
    torus = bpy.context.active_object
    torus.name = "AbstractSculpture"
    torus.data.materials.append(mat_holo)
    
    mod_sub = torus.modifiers.new(name="Subsurf", type='SUBSURF')
    mod_sub.levels = 2

# 2. Studio Lighting Setup
# Key Light
bpy.ops.object.light_add(type='SUN', location=(5, -5, 10))
sun = bpy.context.active_object
sun.name = "KeySunLight"
sun.data.energy = 4.0

# Rim Light
bpy.ops.object.light_add(type='POINT', location=(-4, 4, 3))
rim = bpy.context.active_object
rim.name = "RimBlueLight"
rim.data.energy = 150.0
rim.data.color = (0.2, 0.7, 1.0)

# 3. Camera Setup
bpy.ops.object.camera_add(location=(4.5, -4.5, 3.5), rotation=(math.radians(65), 0, math.radians(45)))
cam = bpy.context.active_object
cam.name = "StudioCamera"
bpy.context.scene.camera = cam

# 4. Save Main .blend File
bpy.ops.wm.save_as_mainfile(filepath="${blendPath}")
print(f"SUCCESS: Saved main .blend to ${blendPath}")

# 5. Export universal formats
try:
    bpy.ops.wm.obj_export(filepath="${objPath}")
    print(f"SUCCESS: Exported OBJ to ${objPath}")
except Exception as e:
    print(f"OBJ Export note: {e}")

try:
    bpy.ops.export_scene.gltf(filepath="${glbPath}", export_format='GLB')
    print(f"SUCCESS: Exported GLB to ${glbPath}")
except Exception as e:
    print(f"GLB Export note: {e}")
`;
  }

  /**
   * Executes procedural 3D model generation and launches Blender
   */
  public async create3DModel(options: Create3DModelOptions): Promise<Create3DModelResult> {
    if (!this.isBlenderInstalled()) {
      return {
        success: false,
        modelName: '',
        blendFilePath: '',
        message: 'Blender is not installed at /Applications/Blender.app.',
        verbalSummary: 'I could not find Blender in your Applications folder.',
        error: 'Blender application not found',
      };
    }

    const lower = options.prompt.toLowerCase();
    const isAerodynamicOrPrecision =
      lower.includes('airplane') ||
      lower.includes('aeroplane') ||
      lower.includes('plane') ||
      lower.includes('aircraft') ||
      lower.includes('jet') ||
      lower.includes('fighter') ||
      lower.includes('boeing') ||
      lower.includes('airbus') ||
      lower.includes('raptor') ||
      lower.includes('concorde') ||
      lower.includes('spitfire') ||
      lower.includes('cessna') ||
      lower.includes('skyhawk') ||
      lower.includes('supersonic') ||
      lower.includes('dreamliner') ||
      lower.includes('stealth') ||
      lower.includes('flight');

    if (isAerodynamicOrPrecision) {
      console.log(`[BlenderBridge] ✈️ Delegating to BMeshLoftingEngine for high-precision aerodynamic model: "${options.prompt}"...`);
      const precisionResult = await bmeshLoftingEngine.buildModel(options.prompt, options.openInBlender !== false);
      return {
        success: precisionResult.success,
        modelName: precisionResult.spec.name,
        blendFilePath: precisionResult.blendFilePath,
        objFilePath: precisionResult.objFilePath,
        glbFilePath: precisionResult.glbFilePath,
        message: precisionResult.message,
        verbalSummary: precisionResult.verbalSummary,
        error: precisionResult.error,
      };
    }

    // Delegate ANY other object to Universal3DEngine (AI-synthesized multi-part 3D model)
    console.log(`[BlenderBridge] 🌌 Delegating to Universal3DEngine for universal object synthesis: "${options.prompt}"...`);
    const universalResult = await universal3DEngine.generateAny3DModel(options.prompt, {
      openInBlender: options.openInBlender !== false,
      openBrowserForImages: options.openBrowserForImages,
      enableWebGrounding: options.enableWebGrounding !== false,
    });
    if (universalResult.success) {
      return {
        success: true,
        modelName: universalResult.modelName,
        blendFilePath: universalResult.blendFilePath,
        objFilePath: universalResult.objFilePath,
        glbFilePath: universalResult.glbFilePath,
        message: universalResult.message,
        verbalSummary: universalResult.verbalSummary,
        webReferenceOpened: universalResult.webReferenceOpened,
      };
    }
    console.warn(`[BlenderBridge] Universal3DEngine failed, falling back to local procedural script: "${options.prompt}"`);

    const rawName = options.fileName || options.prompt.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30).replace(/^_+|_+$/g, '');
    const cleanName = rawName || 'january_model';
    const timestamp = Date.now();
    const modelBaseName = `${cleanName}_${timestamp}`;

    const blendFilePath = path.join(this.exportsDir, `${modelBaseName}.blend`);
    const objFilePath = path.join(this.exportsDir, `${modelBaseName}.obj`);
    const glbFilePath = path.join(this.exportsDir, `${modelBaseName}.glb`);

    const pythonScript = this.generateBlenderPython(options.prompt, blendFilePath, objFilePath, glbFilePath);
    const tempPyPath = path.join(this.exportsDir, `_script_${modelBaseName}.py`);

    try {
      fs.writeFileSync(tempPyPath, pythonScript, 'utf8');

      console.log(`[BlenderBridge] Executing Blender 3D generation: "${options.prompt}" -> ${modelBaseName}.blend...`);
      const { stdout, stderr } = await execAsync(
        `"${this.blenderBinPath}" --background --python "${tempPyPath}"`
      );

      // Clean up temp python script
      try {
        fs.unlinkSync(tempPyPath);
      } catch {}

      if (!fs.existsSync(blendFilePath)) {
        throw new Error(`Blender process completed but failed to write ${blendFilePath}. Log: ${stdout.slice(-200)}`);
      }

      console.log(`✅ [BlenderBridge] Successfully built 3D model: ${blendFilePath}`);

      // Open in Blender GUI visibly if requested
      const shouldOpen = options.openInBlender !== false;
      if (shouldOpen) {
        console.log(`[BlenderBridge] Launching Blender GUI with ${blendFilePath}...`);
        await execAsync(`open -a Blender "${blendFilePath}"`);
        await windowManager.activateApp('Blender');
      }

      const verbalSummary = `I've created your 3D model of ${options.prompt} and saved it as ${cleanName}. It is now open in Blender on your screen.`;

      return {
        success: true,
        modelName: cleanName,
        blendFilePath,
        objFilePath: fs.existsSync(objFilePath) ? objFilePath : undefined,
        glbFilePath: fs.existsSync(glbFilePath) ? glbFilePath : undefined,
        message: `Successfully created 3D model "${cleanName}" in Blender!\n- .blend Project: ${blendFilePath}\n- .obj Mesh: ${objFilePath}\n- .glb Realtime: ${glbFilePath}`,
        verbalSummary,
      };
    } catch (err: any) {
      console.error('[BlenderBridge] Error creating 3D model in Blender:', err.message);
      return {
        success: false,
        modelName: cleanName,
        blendFilePath: '',
        message: `Failed to create 3D model in Blender: ${err.message}`,
        verbalSummary: 'I ran into an issue while generating the 3D model in Blender.',
        error: err.message,
      };
    }
  }
}

export const blenderBridge = BlenderBridge.getInstance();
