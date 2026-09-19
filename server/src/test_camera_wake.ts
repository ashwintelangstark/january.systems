import { config } from './config.js';
import { VisualActivityMonitor } from './vision/activityMonitor.js';

async function testCameraWakeConfigAndLifecycle() {
  console.log('🧪 [TEST] Verifying Camera Wake & Sleep Configuration & Engine Lifecycle...\n');

  // 1. Verify Config
  console.log('1. Checking config variables:');
  console.log(`   - WAKE_PHRASE:        "${config.wakePhrase}"`);
  console.log(`   - SLEEP_PHRASE:       "${config.sleepPhrase}"`);
  console.log(`   - CAMERA_WAKE_PHRASE:  "${config.cameraWakePhrase}"`);
  console.log(`   - CAMERA_SLEEP_PHRASE: "${config.cameraSleepPhrase}"`);

  if (config.cameraWakePhrase !== 'eyes open') {
    throw new Error(`Expected cameraWakePhrase to be "eyes open", got "${config.cameraWakePhrase}"`);
  }
  if (config.cameraSleepPhrase !== 'eyes closed') {
    throw new Error(`Expected cameraSleepPhrase to be "eyes closed", got "${config.cameraSleepPhrase}"`);
  }
  console.log('   ✅ Config validation passed!\n');

  // 2. Test VisualActivityMonitor Continuous Stream Lifecycle
  console.log('2. Testing VisualActivityMonitor streaming lifecycle:');
  const monitor = new VisualActivityMonitor();

  console.log(`   - Initial State: isEyesOpen=${monitor.getEyesStatus().isEyesOpen}, isStreaming=${monitor.getEyesStatus().isStreaming}`);
  if (monitor.getEyesStatus().isEyesOpen !== false) {
    throw new Error('Expected camera eyes to be closed by default');
  }

  console.log('   - Activating "eyes open" (60 FPS)...');
  monitor.openEyes(60);
  console.log(`   - After openEyes(60): isEyesOpen=${monitor.getEyesStatus().isEyesOpen}, fps=${monitor.getEyesStatus().fps}, isStreaming=${monitor.getEyesStatus().isStreaming}`);

  if (monitor.getEyesStatus().isEyesOpen !== true) {
    throw new Error('Expected isEyesOpen to be true after openEyes');
  }
  if (monitor.getEyesStatus().isStreaming !== true) {
    throw new Error('Expected isStreaming to be true after openEyes');
  }

  // Hold stream open for 2 seconds to simulate continuous recording
  console.log('   - Holding continuous stream active for 2 seconds...');
  await new Promise((r) => setTimeout(r, 2000));

  console.log(`   - Mid-stream status: isEyesOpen=${monitor.getEyesStatus().isEyesOpen}, isStreaming=${monitor.getEyesStatus().isStreaming}`);
  if (!monitor.getEyesStatus().isStreaming) {
    throw new Error('Expected stream to remain continuously active');
  }

  // Close eyes
  console.log('   - Activating "eyes closed"...');
  monitor.closeEyes();
  console.log(`   - After closeEyes(): isEyesOpen=${monitor.getEyesStatus().isEyesOpen}, isStreaming=${monitor.getEyesStatus().isStreaming}`);

  if (monitor.getEyesStatus().isEyesOpen !== false) {
    throw new Error('Expected isEyesOpen to be false after closeEyes');
  }

  console.log('   ✅ Camera streaming lifecycle test passed!\n');

  // 3. Test Punctuation-stripped Matching Logic
  console.log('3. Testing wake word regex normalization:');
  const testUtterances = [
    { input: 'Eyes open.', expectedWake: true },
    { input: 'eyes open!', expectedWake: true },
    { input: 'Eyes Open', expectedWake: true },
    { input: 'Open eyes.', expectedWake: true },
    { input: 'eyes closed.', expectedSleep: true },
    { input: 'Eyes Closed!', expectedSleep: true },
    { input: 'Close eyes.', expectedSleep: true },
  ];

  for (const t of testUtterances) {
    const stripped = t.input.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const isCamWake =
      stripped === config.cameraWakePhrase ||
      ['eyes open', 'open eyes', 'camera open', 'open camera', 'eyes on', 'turn on camera', 'enable camera'].includes(stripped) ||
      (/\b(eyes open|open eyes|camera open|open camera|eyes on|turn on camera|enable camera)\b/i.test(stripped) && stripped.length < 35);

    const isCamSleep =
      stripped === config.cameraSleepPhrase ||
      ['eyes closed', 'close eyes', 'camera closed', 'close camera', 'eyes off', 'turn off camera', 'disable camera'].includes(stripped) ||
      (/\b(eyes closed|close eyes|camera closed|close camera|eyes off|turn off camera|disable camera)\b/i.test(stripped) && stripped.length < 35);

    if (t.expectedWake && !isCamWake) {
      throw new Error(`Failed to recognize camera wake word in "${t.input}" (normalized: "${stripped}")`);
    }
    if (t.expectedSleep && !isCamSleep) {
      throw new Error(`Failed to recognize camera sleep word in "${t.input}" (normalized: "${stripped}")`);
    }
    console.log(`   - "${t.input}" -> normalized: "${stripped}" (Wake: ${isCamWake}, Sleep: ${isCamSleep}) ✅`);
  }

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

testCameraWakeConfigAndLifecycle().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
