import fs from 'fs';
import { universal3DEngine } from '../blender/advanced/universal3DEngine.js';
import { blenderBridge } from '../blender/blenderBridge.js';

async function testAstra3DUniversal() {
  console.log('================================================================');
  console.log('🚀 TESTING OPENROUTER ASTRA GPT-6 UNIVERSAL 3D ENGINE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, desc: string, extra?: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${desc}${extra ? ` (${extra})` : ''}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${desc}${extra ? ` (${extra})` : ''}`);
    }
  }

  // --- Test 1: Web Visual Grounding & Reference Engine ---
  console.log('--- 1. Testing Web Visual Grounding & Dimensional Search ---');
  const grounding = await universal3DEngine.fetchWebVisualGrounding('Breville Barista Espresso Machine', false);
  assert(
    grounding.referencesFound === true && grounding.summary.length > 50,
    'Web visual grounding retrieved real-world technical specifications',
    `${grounding.summary.length} chars`
  );

  // --- Test 2: Electrical Appliance 3D Generation ---
  console.log('\n--- 2. Testing Electrical Appliance Generation (Retro Electric Toaster) ---');
  const promptAppliance = 'retro electric toaster with dual bread slots, chrome lever, and heat dial';
  const resAppliance = await universal3DEngine.generateAny3DModel(promptAppliance, {
    openInBlender: false,
    enableWebGrounding: true,
  });

  assert(resAppliance.success === true, `Generated 3D model for appliance: "${promptAppliance}"`);
  assert(fs.existsSync(resAppliance.blendFilePath), `Output .blend exists: ${resAppliance.blendFilePath}`);
  const applianceSize = fs.existsSync(resAppliance.blendFilePath) ? fs.statSync(resAppliance.blendFilePath).size : 0;
  assert(applianceSize > 15000, `Valid .blend project size`, `${(applianceSize / 1024).toFixed(1)} KB`);

  // --- Test 3: House / Architectural BIM Structure ---
  console.log('\n--- 3. Testing House & Architectural Structure (Modern Minimalist Villa) ---');
  const promptHouse = 'modern minimalist villa house with glass curtain walls, cantilever roof, and entrance patio';
  const resHouse = await blenderBridge.create3DModel({
    prompt: promptHouse,
    openInBlender: false,
    enableWebGrounding: true,
  });

  assert(resHouse.success === true, `Generated 3D model for architectural structure: "${promptHouse}"`);
  assert(fs.existsSync(resHouse.blendFilePath), `Output .blend exists: ${resHouse.blendFilePath}`);
  const houseSize = fs.existsSync(resHouse.blendFilePath) ? fs.statSync(resHouse.blendFilePath).size : 0;
  assert(houseSize > 15000, `Valid .blend project size`, `${(houseSize / 1024).toFixed(1)} KB`);

  // --- Test 4: Vehicle & Transport 3D Generation ---
  console.log('\n--- 4. Testing Vehicle Generation (Cyberpunk Electric Sports Car) ---');
  const promptVehicle = 'cyberpunk electric sports car with alloy rims and aerodynamic spoiler';
  const resVehicle = await blenderBridge.create3DModel({
    prompt: promptVehicle,
    openInBlender: false,
    enableWebGrounding: true,
  });

  assert(resVehicle.success === true, `Generated 3D model for vehicle: "${promptVehicle}"`);
  assert(fs.existsSync(resVehicle.blendFilePath), `Output .blend exists: ${resVehicle.blendFilePath}`);
  const vehicleSize = fs.existsSync(resVehicle.blendFilePath) ? fs.statSync(resVehicle.blendFilePath).size : 0;
  assert(vehicleSize > 15000, `Valid .blend project size`, `${(vehicleSize / 1024).toFixed(1)} KB`);

  // --- Test 5: Live Verification in Blender GUI ---
  console.log('\n--- 5. Testing Live Blender GUI Launch Verification ---');
  const livePrompt = 'compact desktop audio monitor speaker with volume knob and acoustic cone';
  const resLive = await universal3DEngine.generateAny3DModel(livePrompt, {
    openInBlender: true,
    enableWebGrounding: true,
  });

  assert(resLive.success === true, `Live model generated: "${livePrompt}"`);
  assert(fs.existsSync(resLive.blendFilePath), `Verified file exists for Blender GUI opening`);

  console.log('\n================================================================');
  console.log(`🏁 TEST RESULTS: ${passed}/${total} TESTS PASSED (${((passed / total) * 100).toFixed(0)}%)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

testAstra3DUniversal().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
