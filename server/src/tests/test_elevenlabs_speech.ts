import { elevenLabsEngine } from '../audio/elevenLabsEngine.js';
import { systemSpeaker } from '../audio/systemSpeaker.js';
import { config } from '../config.js';

async function runElevenLabsVerification() {
  console.log('🧪 =========================================================================');
  console.log('🧪 JANUARY ELEVENLABS REALISTIC NEURAL VOICE & EMOTION ENGINE VERIFICATION');
  console.log('🧪 =========================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}${details ? ` -> ${details}` : ''}`);
    }
  }

  // TEST 1: Config & Credential Inspection
  console.log('🔍 [TEST GROUP 1] Configuration & Credentials');
  assert(!!config.elevenlabsApiKey, 'ElevenLabs API Key is loaded from .env', `Key exists: ${!!config.elevenlabsApiKey}`);
  assert(config.elevenlabsVoiceId === '2zRM7PkgwBPiau2jvVXc', 'Voice ID matches configured target: 2zRM7PkgwBPiau2jvVXc', `Actual: ${config.elevenlabsVoiceId}`);
  assert(config.useElevenLabs === true, 'ElevenLabs Tier is active and enabled (useElevenLabs=true)');
  console.log('');

  // TEST 2: Emotion Engine Mapping Parameter Validation
  console.log('🎭 [TEST GROUP 2] 7-Archetype Emotion Engine Modulation Mapping');
  const emotions = ['joy', 'curious', 'empathetic', 'focused', 'calm', 'concerned', 'neutral'] as const;
  
  for (const emotion of emotions) {
    const settings = elevenLabsEngine.getEmotionalVoiceSettings(emotion);
    const valid = 
      typeof settings.stability === 'number' &&
      typeof settings.similarity_boost === 'number' &&
      typeof settings.style === 'number' &&
      settings.use_speaker_boost === true &&
      settings.stability >= 0 && settings.stability <= 1 &&
      settings.style >= 0 && settings.style <= 1;
    
    assert(valid, `Emotion Archetype '${emotion.toUpperCase()}' modulates [Stability: ${settings.stability}, Style: ${settings.style}, Similarity: ${settings.similarity_boost}]`);
  }
  console.log('');

  // TEST 3: Path Sanitization Integration in Speech Pipeline
  console.log('🛡️ [TEST GROUP 3] Speech Sanitization of File Paths & Code');
  const rawSpokenInput = "Model generated successfully. Output saved to /Users/ashwintelangstark/Desktop/january-ai/model.blend and ready.";
  const { speechText } = systemSpeaker.sanitizeForSpeech(rawSpokenInput);
  assert(!speechText.includes('/Users/ashwintelangstark'), 'Speech sanitization filters raw filesystem paths', `Cleaned: "${speechText}"`);
  console.log('');

  // TEST 4: ElevenLabs Live API Synthesis Test
  console.log('🔊 [TEST GROUP 4] Live ElevenLabs API Audio Synthesis');
  try {
    const testPhrase = "Hello Ashwin, this is January. My realistic neural voice and emotion engine are fully operational.";
    console.log(`  📡 Requesting synthesis for Voice ID: ${config.elevenlabsVoiceId}...`);
    const audioBuffer = await elevenLabsEngine.synthesize(testPhrase, { emotion: 'joy' });

    assert(audioBuffer !== null && audioBuffer.length > 1024, 'API successfully returned valid MP3 audio stream', `Buffer size: ${audioBuffer?.length || 0} bytes`);
    
    if (audioBuffer && audioBuffer.length > 0) {
      console.log(`  🎵 Received ${audioBuffer.length} bytes of high-fidelity 44.1kHz audio stream from ElevenLabs.`);
    }
  } catch (err: any) {
    assert(false, 'Live ElevenLabs API Audio Synthesis', err.message);
  }
  console.log('');

  // Summary
  console.log('=========================================================================');
  console.log(`📊 RESULTS: ${passedTests}/${totalTests} Tests Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('=========================================================================\n');

  if (passedTests < totalTests) {
    process.exit(1);
  }
}

runElevenLabsVerification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
