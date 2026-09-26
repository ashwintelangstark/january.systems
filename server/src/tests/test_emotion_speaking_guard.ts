import { SystemSpeaker } from '../audio/systemSpeaker.js';
import { GeminiService } from '../gemini/geminiService.js';

async function testEmotionSpeakingGuard() {
  console.log('================================================================');
  console.log('🧪 TESTING EMOTION SPEAKING GUARD & SANITIZATION');
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

  const speaker = new SystemSpeaker();
  const gemini = new GeminiService();

  // Test 1: SystemSpeaker strips [Emotion: ...] tag
  const s1 = speaker.sanitizeForSpeech('[Emotion: joy] The current weather in Mumbai is 29°C and clear.');
  assert(
    !s1.speechText.includes('Emotion') && !s1.speechText.includes('joy') && s1.speechText.includes('The current weather in Mumbai'),
    'SystemSpeaker stripped [Emotion: joy] tag',
    `"${s1.speechText}"`
  );

  // Test 2: SystemSpeaker strips inline parenthesized emotion tag
  const s2 = speaker.sanitizeForSpeech('Hello! (Emotion: calm) How can I help you today?');
  assert(
    !s2.speechText.includes('Emotion') && !s2.speechText.includes('calm') && s2.speechText.includes('Hello!') && s2.speechText.includes('How can I help you today?'),
    'SystemSpeaker stripped (Emotion: calm) tag',
    `"${s2.speechText}"`
  );

  // Test 3: SystemSpeaker strips conversational preamble "I am feeling joyful,"
  const s3 = speaker.sanitizeForSpeech('I am feeling joyful, let me open Spotify for you.');
  assert(
    !s3.speechText.toLowerCase().includes('feeling joyful') && s3.speechText.includes('let me open Spotify for you'),
    'SystemSpeaker stripped "I am feeling joyful," opening preamble',
    `"${s3.speechText}"`
  );

  // Test 4: SystemSpeaker strips "Feeling curious, " preamble
  const s4 = speaker.sanitizeForSpeech('Feeling curious, what would you like to explore?');
  assert(
    !s4.speechText.toLowerCase().includes('feeling curious') && s4.speechText.includes('what would you like to explore'),
    'SystemSpeaker stripped "Feeling curious," opening preamble',
    `"${s4.speechText}"`
  );

  // Test 5: GeminiService sanitizeEmotionOutput
  const defaultEmotion = gemini.getEmotionEngine().createEmotionResult('curious');
  const sampleRawLLM = '[Emotion: joy] I am feeling joyful. Here is the breakdown of the solar system.';
  const res = (gemini as any).sanitizeEmotionOutput(sampleRawLLM, defaultEmotion, false);
  
  assert(
    res.activeEmotion.emotion === 'joy',
    'GeminiService detected and extracted emotion for internal vocal tuning',
    `Emotion: ${res.activeEmotion.emotion}`
  );
  assert(
    !res.reply.includes('[Emotion') && !res.reply.toLowerCase().includes('feeling joyful') && res.reply.includes('Here is the breakdown'),
    'GeminiService cleanly stripped emotion tag and verbal declaration from reply text',
    `"${res.reply}"`
  );

  console.log('\n================================================================');
  console.log(`🏁 TEST RESULTS: ${passed}/${total} TESTS PASSED (${((passed / total) * 100).toFixed(0)}%)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

testEmotionSpeakingGuard().catch((err) => {
  console.error('Test failure:', err);
  process.exit(1);
});
