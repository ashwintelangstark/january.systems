import { systemSpeaker } from '../audio/systemSpeaker.js';

function runSpeechSanitizationTests() {
  console.log('====================================================');
  console.log('🔊 TESTING SPEECH SANITIZATION (NO FILE PATHS SPOKEN)');
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

  // --- Test 1: Multi-line 3D Model Export Message ---
  console.log('--- 1. 3D Model Export Message ---');
  const model3dMessage = `Successfully created realistic 3D model "vintage brass microscope" in Blender!
- .blend Project: /Users/ashwintelangstark/Desktop/dot.files/PVT.PROJECTS/JANUARY/january-ai/server/data/exports/3d/vintage_brass_microscope_1790359718679.blend
- .obj Mesh: /Users/ashwintelangstark/Desktop/dot.files/PVT.PROJECTS/JANUARY/january-ai/server/data/exports/3d/vintage_brass_microscope_1790359718679.obj
- .glb Realtime: /Users/ashwintelangstark/Desktop/dot.files/PVT.PROJECTS/JANUARY/january-ai/server/data/exports/3d/vintage_brass_microscope_1790359718679.glb`;

  const res1 = systemSpeaker.sanitizeForSpeech(model3dMessage);
  console.log('Sanitized speech output:\n', `"${res1.speechText}"`);
  assert(!res1.speechText.includes('/Users/'), 'Does not contain Unix path /Users/');
  assert(!res1.speechText.includes('.blend'), 'Does not contain .blend path');
  assert(!res1.speechText.includes('.obj'), 'Does not contain .obj path');
  assert(!res1.speechText.includes('.glb'), 'Does not contain .glb path');
  assert(res1.speechText.includes('Successfully created realistic 3D model "vintage brass microscope" in Blender!'), 'Retains clean confirmation sentence');

  // --- Test 2: Inline File Path in Sentence ---
  console.log('\n--- 2. Inline File Path in Sentence ---');
  const inlinePathMessage = 'I have saved the 3D model to /Users/ashwintelangstark/Desktop/dot.files/PVT.PROJECTS/JANUARY/january-ai/server/data/exports/3d/drone.blend and opened Blender.';
  const res2 = systemSpeaker.sanitizeForSpeech(inlinePathMessage);
  console.log('Sanitized speech output:\n', `"${res2.speechText}"`);
  assert(!res2.speechText.includes('/Users/'), 'Inline Unix path removed from speech');
  assert(!res2.speechText.includes('drone.blend'), 'Inline filename removed from speech');
  assert(res2.speechText.includes('Blender'), 'Retains conversational sentence context');

  // --- Test 3: Spotlight Search Results with Parenthesized Paths ---
  console.log('\n--- 3. Search Results with Parenthesized Paths ---');
  const searchMessage = `Found 2 item(s) matching "floorplan":
• [FILE] modern_villa.png (/Users/ashwintelangstark/Desktop/blueprints/modern_villa.png)
• [FILE] floorplan.dxf (/Users/ashwintelangstark/Documents/CAD/floorplan.dxf)`;
  const res3 = systemSpeaker.sanitizeForSpeech(searchMessage);
  console.log('Sanitized speech output:\n', `"${res3.speechText}"`);
  assert(!res3.speechText.includes('/Users/'), 'Parenthesized paths removed from speech');
  assert(!res3.speechText.includes('Desktop/blueprints'), 'Directory segments removed');

  // --- Test 4: Pure File Paths Only ---
  console.log('\n--- 4. Pure File Paths Only ---');
  const purePathsMessage = `- .blend: /Users/ashwintelangstark/model.blend
- .obj: /Users/ashwintelangstark/model.obj`;
  const res4 = systemSpeaker.sanitizeForSpeech(purePathsMessage);
  console.log('Sanitized speech output:\n', `"${res4.speechText}"`);
  assert(!res4.speechText.includes('/Users/'), 'Pure paths completely omitted');
  assert(res4.speechText.length > 0, 'Clean fallback verbal confirmation provided');

  // --- Test 5: Normal Speech Preserved ---
  console.log('\n--- 5. Normal Speech Preserved ---');
  const normalMessage = 'I have engineered a realistic 3D model of vintage brass microscope with full component geometry and PBR materials. It is now open in Blender on your screen.';
  const res5 = systemSpeaker.sanitizeForSpeech(normalMessage);
  console.log('Sanitized speech output:\n', `"${res5.speechText}"`);
  assert(res5.speechText === normalMessage, 'Normal conversational speech without file paths is preserved 100%');

  console.log('\n====================================================');
  console.log(`🏁 TEST RESULTS: ${passed}/${total} TESTS PASSED (${((passed / total) * 100).toFixed(0)}%)`);
  console.log('====================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runSpeechSanitizationTests();
