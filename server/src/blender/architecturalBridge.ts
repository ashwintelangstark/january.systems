import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ArchitecturalBlueprint } from '../vision/planAnalyzer.js';
import { windowManager } from '../gui/windowManager.js';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface BuildArchitectureResult {
  success: boolean;
  projectName: string;
  blendFilePath: string;
  objFilePath?: string;
  glbFilePath?: string;
  message: string;
  verbalSummary: string;
  error?: string;
}

export class ArchitecturalBridge {
  private static instance: ArchitecturalBridge;
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

  public static getInstance(): ArchitecturalBridge {
    if (!ArchitecturalBridge.instance) {
      ArchitecturalBridge.instance = new ArchitecturalBridge();
    }
    return ArchitecturalBridge.instance;
  }

  /**
   * Generates Python code for procedural architectural BIM generation in Blender
   */
  private generateBimPython(
    bp: ArchitecturalBlueprint,
    blendPath: string,
    objPath: string,
    glbPath: string
  ): string {
    const W = bp.dimensions.width;
    const L = bp.dimensions.length;
    const H = bp.dimensions.wallHeight;

    const roomsJson = JSON.stringify(bp.rooms);
    const wallsJson = JSON.stringify(bp.walls);
    const openingsJson = JSON.stringify(bp.openings);

    return `
import bpy
import math
import json

# 1. Reset factory scene
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.unit_settings.system = 'METRIC'
bpy.context.scene.unit_settings.length_unit = 'METERS'

# 2. Material Factory with Principled BSDF
def create_mat(name, color, metallic=0.0, roughness=0.5, transmission=0.0, alpha=1.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness
        if "Transmission Weight" in bsdf.inputs:
            bsdf.inputs["Transmission Weight"].default_value = transmission
        elif "Transmission" in bsdf.inputs:
            bsdf.inputs["Transmission"].default_value = transmission
    return mat

mat_outer = create_mat("Mat_ExteriorWall", (0.92, 0.90, 0.88, 1.0), metallic=0.05, roughness=0.8)
mat_inner = create_mat("Mat_InteriorWall", (0.96, 0.96, 0.95, 1.0), metallic=0.0, roughness=0.65)
mat_hardwood = create_mat("Mat_HardwoodFloor", (0.65, 0.45, 0.28, 1.0), metallic=0.05, roughness=0.35)
mat_tile = create_mat("Mat_TileFloor", (0.35, 0.38, 0.40, 1.0), metallic=0.1, roughness=0.3)
mat_marble = create_mat("Mat_MarbleFloor", (0.90, 0.92, 0.94, 1.0), metallic=0.15, roughness=0.15)
mat_foundation = create_mat("Mat_FoundationSlab", (0.25, 0.25, 0.26, 1.0), metallic=0.0, roughness=0.9)
mat_glass = create_mat("Mat_ArchGlass", (0.85, 0.92, 0.98, 1.0), metallic=0.1, roughness=0.05, transmission=0.92)
mat_frame = create_mat("Mat_MetalFrame", (0.12, 0.12, 0.14, 1.0), metallic=0.85, roughness=0.25)
mat_sofa = create_mat("Mat_SofaFabric", (0.12, 0.22, 0.35, 1.0), metallic=0.0, roughness=0.8)
mat_bed = create_mat("Mat_BedLinen", (0.88, 0.85, 0.80, 1.0), metallic=0.0, roughness=0.9)
mat_counter = create_mat("Mat_KitchenQuartz", (0.85, 0.85, 0.87, 1.0), metallic=0.1, roughness=0.2)

# 3. Foundation Concrete Slab
W = ${W}
L = ${L}
H = ${H}

bpy.ops.mesh.primitive_cube_add(size=1.0, location=(W/2, L/2, -0.15))
slab = bpy.context.active_object
slab.name = "FoundationSlab"
slab.scale = (W + 1.0, L + 1.0, 0.3)
slab.data.materials.append(mat_foundation)

# 4. Room Floors
rooms_data = json.loads('''${roomsJson}''')
for idx, r in enumerate(rooms_data):
    b = r.get("bounds", [0, 0, 1, 1])
    rw = max(0.5, b[2] - b[0])
    rl = max(0.5, b[3] - b[1])
    rx = (b[0] + b[2]) / 2
    ry = (b[1] + b[3]) / 2
    
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(rx, ry, 0.02))
    floor_obj = bpy.context.active_object
    floor_obj.name = f"Floor_{r.get('name', 'Room')}_{idx+1}"
    floor_obj.scale = (rw, rl, 0.04)
    
    rtype = r.get("type", "living")
    if rtype in ["kitchen", "bathroom"]:
        floor_obj.data.materials.append(mat_tile)
    elif rtype == "living":
        floor_obj.data.materials.append(mat_hardwood)
    else:
        floor_obj.data.materials.append(mat_marble)

# 5. Wall Segments Extrusion
walls_data = json.loads('''${wallsJson}''')
for idx, w in enumerate(walls_data):
    x1, y1 = w.get("x1", 0), w.get("y1", 0)
    x2, y2 = w.get("x2", 1), w.get("y2", 0)
    thickness = w.get("thickness", 0.2)
    height = w.get("height", H)
    is_outer = w.get("isOuter", False)
    
    dx = x2 - x1
    dy = y2 - y1
    length = math.hypot(dx, dy)
    if length < 0.1:
        continue
    
    angle = math.atan2(dy, dx)
    mid_x = (x1 + x2) / 2
    mid_y = (y1 + y2) / 2
    
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(mid_x, mid_y, height / 2))
    wall = bpy.context.active_object
    wall.name = f"{'Outer' if is_outer else 'Inner'}Wall_{idx+1}"
    wall.scale = (length, thickness, height)
    wall.rotation_euler = (0, 0, angle)
    wall.data.materials.append(mat_outer if is_outer else mat_inner)

# 6. Door and Window Openings
openings_data = json.loads('''${openingsJson}''')
for idx, op in enumerate(openings_data):
    ox = op.get("x", 0)
    oy = op.get("y", 0)
    ow = op.get("width", 1.0)
    oh = op.get("height", 2.0)
    sill = op.get("sillHeight", 0.0)
    op_type = op.get("type", "door")
    orientation = op.get("orientation", "horizontal")
    
    oz = sill + (oh / 2)
    rot_z = 0 if orientation == "horizontal" else math.radians(90)
    
    # Frame
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(ox, oy, oz))
    frame = bpy.context.active_object
    frame.name = f"Frame_{op_type.capitalize()}_{idx+1}"
    frame.scale = (ow, 0.18, oh)
    frame.rotation_euler = (0, 0, rot_z)
    frame.data.materials.append(mat_frame)
    
    if op_type == "window":
        # Glass Pane
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(ox, oy, oz))
        glass = bpy.context.active_object
        glass.name = f"Glass_{idx+1}"
        glass.scale = (ow - 0.1, 0.04, oh - 0.1)
        glass.rotation_euler = (0, 0, rot_z)
        glass.data.materials.append(mat_glass)

# 7. Stylized Low-Poly Architectural Furniture Placeholders
for idx, r in enumerate(rooms_data):
    rtype = r.get("type", "")
    b = r.get("bounds", [0, 0, 1, 1])
    cx = (b[0] + b[2]) / 2
    cy = (b[1] + b[3]) / 2
    
    if rtype == "living":
        # Modern Sectional Sofa
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(cx, cy, 0.4))
        sofa = bpy.context.active_object
        sofa.name = "Living_Sofa"
        sofa.scale = (2.2, 0.9, 0.8)
        sofa.data.materials.append(mat_sofa)
        
        # Coffee Table
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(cx, cy + 1.2, 0.25))
        table = bpy.context.active_object
        table.name = "CoffeeTable"
        table.scale = (1.4, 0.7, 0.5)
        table.data.materials.append(mat_frame)
        
    elif rtype == "bedroom":
        # Bed Base & Mattress
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(cx, cy, 0.35))
        bed = bpy.context.active_object
        bed.name = f"Bed_{idx+1}"
        bed.scale = (2.0, 1.8, 0.7)
        bed.data.materials.append(mat_bed)
        
    elif rtype == "kitchen":
        # Kitchen Island Counter
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(cx, cy, 0.45))
        counter = bpy.context.active_object
        counter.name = "KitchenIsland"
        counter.scale = (2.4, 0.9, 0.9)
        counter.data.materials.append(mat_counter)

# 8. Studio & Architectural Sun Lighting
bpy.ops.object.light_add(type='SUN', location=(W + 5, -5, H + 10))
sun = bpy.context.active_object
sun.name = "SolarKeyLight"
sun.data.energy = 5.5
sun.data.color = (1.0, 0.95, 0.88)
sun.rotation_euler = (math.radians(45), math.radians(25), math.radians(-35))

bpy.ops.object.light_add(type='POINT', location=(-5, L + 5, H + 6))
sky = bpy.context.active_object
sky.name = "AmbientSkyLight"
sky.data.energy = 220.0
sky.data.color = (0.55, 0.75, 1.0)

# 9. Architectural Perspective Camera
cam_x = W * 1.55
cam_y = -L * 1.25
cam_z = H * 3.6
bpy.ops.object.camera_add(location=(cam_x, cam_y, cam_z))
cam = bpy.context.active_object
cam.name = "ArchitecturalCamera"
cam.rotation_euler = (math.radians(58), 0, math.radians(48))
bpy.context.scene.camera = cam

# 10. Save and Export
bpy.ops.wm.save_as_mainfile(filepath="${blendPath}")
print(f"SUCCESS: Saved architectural .blend to ${blendPath}")

try:
    bpy.ops.wm.obj_export(filepath="${objPath}")
    print(f"SUCCESS: Exported architectural OBJ to ${objPath}")
except Exception as e:
    print(f"OBJ Export note: {e}")

try:
    bpy.ops.export_scene.gltf(filepath="${glbPath}", export_format='GLB')
    print(f"SUCCESS: Exported architectural GLB to ${glbPath}")
except Exception as e:
    print(f"GLB Export note: {e}")
`;
  }

  /**
   * Builds the 3D architectural model from the Blueprint and launches Blender
   */
  public async buildArchitecture(
    blueprint: ArchitecturalBlueprint,
    openInBlender = true
  ): Promise<BuildArchitectureResult> {
    if (!fs.existsSync(this.blenderBinPath)) {
      return {
        success: false,
        projectName: blueprint.projectName,
        blendFilePath: '',
        message: 'Blender 5.2 application not found at /Applications/Blender.app.',
        verbalSummary: 'I could not find Blender in your Applications folder to build the 3D model.',
        error: 'Blender not installed',
      };
    }

    const cleanName =
      blueprint.projectName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .slice(0, 30)
        .replace(/^_+|_+$/g, '') || 'architectural_model';

    const timestamp = Date.now();
    const modelBaseName = `${cleanName}_${timestamp}`;

    const blendFilePath = path.join(this.exportsDir, `${modelBaseName}.blend`);
    const objFilePath = path.join(this.exportsDir, `${modelBaseName}.obj`);
    const glbFilePath = path.join(this.exportsDir, `${modelBaseName}.glb`);

    const pythonScript = this.generateBimPython(blueprint, blendFilePath, objFilePath, glbFilePath);
    const tempPyPath = path.join(this.exportsDir, `_bim_${modelBaseName}.py`);

    try {
      fs.writeFileSync(tempPyPath, pythonScript, 'utf8');

      console.log(`[ArchitecturalBridge] Building 3D Architectural Model for "${blueprint.projectName}"...`);
      const { stdout, stderr } = await execAsync(
        `"${this.blenderBinPath}" --background --python "${tempPyPath}"`
      );

      try {
        fs.unlinkSync(tempPyPath);
      } catch {}

      if (!fs.existsSync(blendFilePath)) {
        throw new Error(`Blender failed to save ${blendFilePath}.\nSTDOUT: ${stdout}\nSTDERR: ${stderr}`);
      }

      console.log(`✅ [ArchitecturalBridge] Successfully built 3D Building Model: ${blendFilePath}`);

      // Open visibly in Blender
      if (openInBlender) {
        console.log(`[ArchitecturalBridge] Launching Blender GUI with ${blendFilePath}...`);
        await execAsync(`open -a Blender "${blendFilePath}"`);
        await windowManager.activateApp('Blender');
      }

      const verbalSummary = `I've analyzed your building plan and converted it into a 3D architectural model named ${blueprint.projectName}. It is now open in Blender on your screen.`;

      const roomNames = blueprint.rooms.map((r) => r.name).join(', ');

      return {
        success: true,
        projectName: blueprint.projectName,
        blendFilePath,
        objFilePath: fs.existsSync(objFilePath) ? objFilePath : undefined,
        glbFilePath: fs.existsSync(glbFilePath) ? glbFilePath : undefined,
        message: `Successfully converted 2D Building Plan into 3D Model in Blender!\n- Project: **${blueprint.projectName}** (${blueprint.dimensions.width}m x ${blueprint.dimensions.length}m, ${blueprint.rooms.length} zones: ${roomNames})\n- .blend File: \`${blendFilePath}\`\n- .obj Mesh: \`${objFilePath}\`\n- .glb Realtime: \`${glbFilePath}\``,
        verbalSummary,
      };
    } catch (err: any) {
      console.error('[ArchitecturalBridge] Error building 3D architecture:', err.message);
      return {
        success: false,
        projectName: blueprint.projectName,
        blendFilePath: '',
        message: `Failed to build 3D architecture in Blender: ${err.message}`,
        verbalSummary: 'I encountered an issue converting the floor plan into a 3D model in Blender.',
        error: err.message,
      };
    }
  }
}

export const architecturalBridge = ArchitecturalBridge.getInstance();
