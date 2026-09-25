import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { planAnalyzer } from '../vision/planAnalyzer.js';
import { architecturalBridge } from '../blender/architecturalBridge.js';
import { executeTool } from '../tools/index.js';
import { GeminiService } from '../gemini/geminiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function runPlanTo3DTests() {
  console.log('====================================================');
  console.log('🏛️ TESTING 2D BUILDING PLAN TO 3D BLENDER ENGINE');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(name: string, condition: boolean, detail?: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${name}${detail ? ` (${detail})` : ''}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  // --- 1. Test PlanAnalyzer Blueprint Specification ---
  console.log('--- 1. Testing Architectural Blueprint Specification ---');
  try {
    const blueprint = planAnalyzer.generateFallbackBlueprint('Test Luxury Villa');
    assert('Blueprint has project name', blueprint.projectName === 'Test Luxury Villa');
    assert('Blueprint dimensions defined', blueprint.dimensions.width > 0 && blueprint.dimensions.length > 0 && blueprint.dimensions.wallHeight > 0);
    assert('Blueprint has multiple rooms', blueprint.rooms.length >= 4, `${blueprint.rooms.length} rooms`);
    assert('Blueprint has outer and inner walls', blueprint.walls.length >= 4, `${blueprint.walls.length} walls`);
    assert('Blueprint has door and window openings', blueprint.openings.length >= 4, `${blueprint.openings.length} openings`);
  } catch (e: any) {
    assert('PlanAnalyzer blueprint test', false, e.message);
  }

  // --- 2. Test ArchitecturalBridge 3D Generation & Blender Launch ---
  console.log('\n--- 2. Testing ArchitecturalBridge Procedural BIM Construction ---');
  try {
    const bp = planAnalyzer.generateFallbackBlueprint('Modern Glass Villa');
    console.log(`Building 3D model for "${bp.projectName}"...`);
    const buildRes = await architecturalBridge.buildArchitecture(bp, true); // true to launch GUI!

    assert('ArchitecturalBridge build succeeds', buildRes.success, buildRes.message);
    assert('Valid .blend file generated on disk', fs.existsSync(buildRes.blendFilePath) && fs.statSync(buildRes.blendFilePath).size > 10000, buildRes.blendFilePath);
    if (buildRes.objFilePath) {
      assert('Valid .obj mesh file generated', fs.existsSync(buildRes.objFilePath) && fs.statSync(buildRes.objFilePath).size > 100, buildRes.objFilePath);
    }
    if (buildRes.glbFilePath) {
      assert('Valid .glb realtime model generated', fs.existsSync(buildRes.glbFilePath) && fs.statSync(buildRes.glbFilePath).size > 100, buildRes.glbFilePath);
    }
  } catch (e: any) {
    assert('ArchitecturalBridge test', false, e.message);
  }

  // --- 3. Test Tools Dispatcher Integration ---
  console.log('\n--- 3. Testing Tools Dispatcher "convert_floorplan_to_3d" ---');
  try {
    const toolRes = await executeTool('convert_floorplan_to_3d', {
      userPrompt: 'Contemporary 2BHK Apartment Floor Plan',
      openInBlender: false, // background mode test
    });
    assert('executeTool("convert_floorplan_to_3d") succeeds', toolRes.success, toolRes.projectName);
    assert('Tool generated .blend exists', fs.existsSync(toolRes.blendFilePath));
  } catch (e: any) {
    assert('Tools Dispatcher test', false, e.message);
  }

  // --- 4. Test Conversational Routing in GeminiService ---
  console.log('\n--- 4. Testing Conversational Intent in GeminiService ---');
  try {
    const gemini = new GeminiService();
    const prompt = 'January, look at this building plan and convert it into a 3d model in blender';
    console.log(`Prompt: "${prompt}"`);

    const response = await gemini.analyzeAndRespond(prompt);
    console.log('Model Used:', response.modelUsed);
    console.log('Verbal Summary:', response.verbalSummary);

    assert('GeminiService routes to Blender 5.2 BIM Engine', response.modelUsed === 'Blender 5.2 BIM Engine');
    assert('GeminiService called convert_floorplan_to_3d tool', response.toolCalls?.[0]?.name === 'convert_floorplan_to_3d');
    assert('GeminiService verbal summary returned', !!response.verbalSummary);
  } catch (e: any) {
    assert('GeminiService floorplan intent test', false, e.message);
  }

  console.log('\n====================================================');
  console.log(`🏁 TEST RESULTS: ${passed}/${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('====================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runPlanTo3DTests().catch((err) => {
  console.error('Fatal error in tests:', err);
  process.exit(1);
});
