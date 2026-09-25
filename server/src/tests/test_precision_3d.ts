import fs from 'fs';
import { technicalSpecEngine } from '../blender/advanced/technicalSpecEngine.js';
import { bmeshLoftingEngine } from '../blender/advanced/bmeshLoftingEngine.js';
import { blenderBridge } from '../blender/blenderBridge.js';

async function runPrecision3DTests() {
  console.log('====================================================');
  console.log('✈️ TESTING PHASE 1 & 2: HIGH-PRECISION 3D ENGINE');
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

  // --- 1. Test TechnicalSpecEngine Grounding ---
  console.log('--- 1. Testing TechnicalSpecEngine Grounding ---');
  
  const b787Spec = await technicalSpecEngine.resolveSpec('Boeing 787-9 Dreamliner');
  assert(b787Spec.name === 'Boeing 787-9 Dreamliner', 'Resolves exact Boeing 787-9 Dreamliner name');
  assert(b787Spec.dimensions.length > 60 && b787Spec.dimensions.length < 65, `Valid length (${b787Spec.dimensions.length}m)`);
  assert(b787Spec.dimensions.wingspan > 58 && b787Spec.dimensions.wingspan < 62, `Valid wingspan (${b787Spec.dimensions.wingspan}m)`);
  assert(b787Spec.engines.hasChevrons === true, 'Engine has noise-reduction chevrons');
  assert(b787Spec.wings.rakedWingtip === true, 'Wings have raked wingtips');

  const f22Spec = await technicalSpecEngine.resolveSpec('Lockheed F-22 Raptor');
  assert(f22Spec.name === 'Lockheed Martin F-22 Raptor', 'Resolves exact F-22 Raptor name');
  assert(f22Spec.empennage.verticalFin.count === 2, 'F-22 has twin canted vertical fins');
  assert((f22Spec.empennage.verticalFin.cantedAngleDeg || 0) > 20, 'F-22 has canted vertical fins (>20 deg)');

  const genericSpec = await technicalSpecEngine.resolveSpec('build an airplane');
  assert(genericSpec.dimensions.length > 10, `Generic airplane has valid physical dimensions (${genericSpec.dimensions.length}m)`);
  assert(genericSpec.wings.rootChord > genericSpec.wings.tipChord, 'Wings have tapered chord from root to tip');

  // --- 2. Test BMeshLoftingEngine Procedural Construction ---
  console.log('\n--- 2. Testing BMeshLoftingEngine Blender 5.2 Execution ---');
  console.log('Building high-precision 3D Boeing 787-9 Dreamliner in Blender...');
  
  const b787Result = await bmeshLoftingEngine.buildModel('Boeing 787-9 Dreamliner', false);
  assert(b787Result.success === true, 'bmeshLoftingEngine.buildModel returns success');
  assert(fs.existsSync(b787Result.blendFilePath), `Generated .blend exists: ${b787Result.blendFilePath}`);
  
  const blendStats = fs.statSync(b787Result.blendFilePath);
  assert(blendStats.size > 50000, `Valid .blend project file size (${(blendStats.size / 1024).toFixed(1)} KB)`);

  if (b787Result.objFilePath) {
    assert(fs.existsSync(b787Result.objFilePath), `Exported .obj mesh exists (${(fs.statSync(b787Result.objFilePath).size / 1024).toFixed(1)} KB)`);
  }
  if (b787Result.glbFilePath) {
    assert(fs.existsSync(b787Result.glbFilePath), `Exported .glb realtime file exists (${(fs.statSync(b787Result.glbFilePath).size / 1024).toFixed(1)} KB)`);
  }

  // --- 3. Test BlenderBridge Delegation ---
  console.log('\n--- 3. Testing BlenderBridge Routing & Delegation ---');
  const bridgeResult = await blenderBridge.create3DModel({
    prompt: 'make a 3D model of airplane',
    openInBlender: false,
  });

  assert(bridgeResult.success === true, 'blenderBridge delegates airplane prompt to precision engine successfully');
  assert(bridgeResult.blendFilePath.length > 0 && fs.existsSync(bridgeResult.blendFilePath), 'Bridge returned valid .blend file');
  assert(bridgeResult.verbalSummary.includes('precision') || bridgeResult.verbalSummary.includes('specifications') || bridgeResult.verbalSummary.includes('Boeing'), 'Bridge returned engineering verbal summary');

  console.log('\n====================================================');
  console.log(`🏁 TEST RESULTS: ${passed}/${total} TESTS PASSED (${((passed / total) * 100).toFixed(0)}%)`);
  console.log('====================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runPrecision3DTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
