import fs from 'fs';
import { universal3DEngine } from '../blender/advanced/universal3DEngine.js';
import { blenderBridge } from '../blender/blenderBridge.js';

async function testUniversal3DEngine() {
  console.log('====================================================');
  console.log('🌌 TESTING UNIVERSAL 3D GENERATION ENGINE');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, desc: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${desc}`);
    }
  }

  // --- Test 1: Arbitrary Scientific/Mechanical Object (Vintage Microscope) ---
  console.log('--- 1. Testing Universal Object: Vintage Brass Microscope ---');
  const prompt1 = 'vintage brass microscope with dual objective lenses and glass eyepiece';
  const result1 = await universal3DEngine.generateAny3DModel(prompt1, false);

  assert(result1.success === true, `Universal3DEngine generated 3D model for: "${prompt1}"`);
  assert(fs.existsSync(result1.blendFilePath), `Generated .blend project exists: ${result1.blendFilePath}`);
  assert(fs.statSync(result1.blendFilePath).size > 20000, `Valid file size (${(fs.statSync(result1.blendFilePath).size / 1024).toFixed(1)} KB)`);
  if (result1.objFilePath) {
    assert(fs.existsSync(result1.objFilePath), `Exported .obj file exists (${(fs.statSync(result1.objFilePath).size / 1024).toFixed(1)} KB)`);
  }

  // --- Test 2: Arbitrary Electronic/Aeronautic Gadget (Surveillance Quadcopter Drone) ---
  console.log('\n--- 2. Testing Universal Object via BlenderBridge: Quadcopter Drone ---');
  const prompt2 = 'high tech surveillance quadcopter drone with 4 carbon propellers and camera gimbal';
  const result2 = await blenderBridge.create3DModel({
    prompt: prompt2,
    openInBlender: false,
  });

  assert(result2.success === true, `BlenderBridge delegated and built universal model for: "${prompt2}"`);
  assert(fs.existsSync(result2.blendFilePath), `Generated .blend exists: ${result2.blendFilePath}`);
  assert(fs.statSync(result2.blendFilePath).size > 20000, `Valid drone .blend size (${(fs.statSync(result2.blendFilePath).size / 1024).toFixed(1)} KB)`);

  // --- Test 3: Musical Instrument (Electric Guitar) ---
  console.log('\n--- 3. Testing Universal Object via BlenderBridge: Electric Guitar ---');
  const prompt3 = 'electric guitar with contoured wooden body, pickups, and volume knobs';
  const result3 = await blenderBridge.create3DModel({
    prompt: prompt3,
    openInBlender: false,
  });

  assert(result3.success === true, `BlenderBridge successfully generated: "${prompt3}"`);
  assert(fs.existsSync(result3.blendFilePath), `Generated .blend exists: ${result3.blendFilePath}`);

  console.log('\n====================================================');
  console.log(`🏁 TEST RESULTS: ${passed}/${total} TESTS PASSED (${((passed / total) * 100).toFixed(0)}%)`);
  console.log('====================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

testUniversal3DEngine().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
