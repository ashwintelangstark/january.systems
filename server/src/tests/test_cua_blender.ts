import path from 'path';
import fs from 'fs';
import { SafetyInterlock } from '../cua/safetyInterlock.js';
import { mouseController } from '../cua/mouseController.js';
import { keyboardController } from '../cua/keyboardController.js';
import { windowManager } from '../gui/windowManager.js';
import { blenderBridge } from '../blender/blenderBridge.js';
import { executeTool } from '../tools/index.js';

async function runTests() {
  console.log('====================================================');
  console.log('🚀 STARTING COMPREHENSIVE PHASE 1 & 2 VERIFICATION');
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

  // --- 1. Test SafetyInterlock ---
  console.log('--- 1. Testing CUA Safety Interlock ---');
  try {
    const valid = SafetyInterlock.validateCoordinates(500, 400);
    assert('Coordinates validation within bounds', valid.x === 500 && valid.y === 400);

    const clamped = SafetyInterlock.validateCoordinates(5000, 3000);
    assert('Coordinates clamped to max bounds', clamped.x <= 3840 && clamped.y <= 2160);

    let caughtEmergency = false;
    try {
      SafetyInterlock.validateCoordinates(5, 5);
    } catch {
      caughtEmergency = true;
    }
    assert('Emergency halt triggers at top-left corner (5,5)', caughtEmergency);
    assert('SafetyInterlock state is halted', SafetyInterlock.checkHalt());

    SafetyInterlock.resume();
    assert('SafetyInterlock successfully resumes', !SafetyInterlock.checkHalt());
  } catch (e: any) {
    assert('SafetyInterlock test suite', false, e.message);
  }

  // --- 2. Test MouseController ---
  console.log('\n--- 2. Testing CUA Mouse Controller ---');
  try {
    const initialPos = await mouseController.getPosition();
    assert('MouseController retrieves physical cursor position', typeof initialPos.x === 'number' && typeof initialPos.y === 'number', `x=${initialPos.x}, y=${initialPos.y}`);

    // Move slightly relative to current position to verify movement safely
    const targetX = Math.max(100, Math.min(1200, initialPos.x + 30));
    const targetY = Math.max(100, Math.min(800, initialPos.y + 30));
    await mouseController.moveTo(targetX, targetY, true);
    const newPos = await mouseController.getPosition();
    const moved = Math.hypot(newPos.x - targetX, newPos.y - targetY) < 15;
    assert('MouseController smoothly moves cursor to target', moved, `target=(${targetX},${targetY}), actual=(${newPos.x},${newPos.y})`);
  } catch (e: any) {
    assert('MouseController test suite', false, e.message);
  }

  // --- 3. Test WindowManager ---
  console.log('\n--- 3. Testing Window Manager ---');
  try {
    const bounds = await windowManager.getScreenBounds();
    assert('WindowManager retrieves screen bounds', bounds.width > 0 && bounds.height > 0, `${bounds.width}x${bounds.height}`);
    const isFinderRunning = await windowManager.isAppRunning('Finder');
    assert('WindowManager inspects running apps', isFinderRunning, 'Finder is running');
  } catch (e: any) {
    assert('WindowManager test suite', false, e.message);
  }

  // --- 4. Test Blender Installation & 3D Bridge ---
  console.log('\n--- 4. Testing Blender Bridge & 3D Generation ---');
  try {
    const isInstalled = blenderBridge.isBlenderInstalled();
    assert('Blender is installed at /Applications/Blender.app', isInstalled);

    if (isInstalled) {
      console.log('Generating 3D model: "cyber sword"...');
      const result = await blenderBridge.create3DModel({
        prompt: 'futuristic cyber sword',
        fileName: 'test_cyber_sword',
        openInBlender: true, // test opening in Blender!
      });

      assert('Blender 3D model creation succeeds', result.success, result.message);
      assert('Valid .blend file generated', fs.existsSync(result.blendFilePath) && fs.statSync(result.blendFilePath).size > 1000, result.blendFilePath);
      if (result.objFilePath) {
        assert('Valid .obj file generated', fs.existsSync(result.objFilePath) && fs.statSync(result.objFilePath).size > 100, result.objFilePath);
      }
      if (result.glbFilePath) {
        assert('Valid .glb file generated', fs.existsSync(result.glbFilePath) && fs.statSync(result.glbFilePath).size > 100, result.glbFilePath);
      }
    }
  } catch (e: any) {
    assert('BlenderBridge test suite', false, e.message);
  }

  // --- 5. Test Tools Dispatcher for CUA and Blender ---
  console.log('\n--- 5. Testing Tools Dispatcher Integration ---');
  try {
    const cuaPosResult = await executeTool('execute_cua_action', { action: 'position' });
    assert('executeTool("execute_cua_action") returns position', cuaPosResult.success && !!cuaPosResult.position);

    // Test creating another model (e.g. coffee cup) through the tool dispatcher
    console.log('Creating second model via executeTool("create_3d_model")...');
    const modelToolResult = await executeTool('create_3d_model', {
      prompt: 'ceramic coffee cup',
      fileName: 'test_coffee_cup',
      openInBlender: false, // background test
    });
    assert('executeTool("create_3d_model") succeeds', modelToolResult.success, modelToolResult.blendFilePath);
    assert('Coffee cup .blend file exists', fs.existsSync(modelToolResult.blendFilePath));
  } catch (e: any) {
    assert('Tools Dispatcher test suite', false, e.message);
  }

  console.log('\n====================================================');
  console.log(`🏁 TEST RESULTS: ${passed}/${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('====================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
