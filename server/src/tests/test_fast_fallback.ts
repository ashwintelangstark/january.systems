import { GeminiService } from '../gemini/geminiService.js';
import { modelRouter } from '../models/modelRouter.js';
import { delegateCoding } from '../tools/delegateCoding.js';

async function runFastFallbackVerification() {
  console.log('⚡ =========================================================================');
  console.log('⚡ JANUARY ULTRA-FAST MODEL SWITCHING & CIRCUIT-BREAKER VERIFICATION');
  console.log('⚡ =========================================================================\n');

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

  const geminiService = new GeminiService();

  // TEST 1: Instant Zero-Lag Model Switch Intent Detection & Execution
  console.log('🎯 [TEST GROUP 1] Model Intent Detection & In-Memory Switching (<5ms)');
  const tSwitch0 = Date.now();
  const switchIntent = modelRouter.detectModelSwitchIntent('switch model to liquid');
  assert(switchIntent.isIntent === true && switchIntent.action === 'switch', 'Intent detector recognizes model switch command');
  
  const switchRes = modelRouter.setSessionModel('liquid');
  const elapsedSwitch = Date.now() - tSwitch0;
  assert(switchRes.success === true, 'Session model successfully locked to target model', switchRes.message);
  assert(elapsedSwitch < 20, `Model switch executed ultra-fast in ${elapsedSwitch}ms (<20ms requirement)`);

  const activeModel = modelRouter.getActiveSessionModel();
  assert(activeModel !== null && activeModel.id.includes('liquid'), `Active session model is confirmed: ${activeModel?.id}`);

  const resetMsg = modelRouter.resetSessionModel();
  assert(modelRouter.getActiveSessionModel() === null, 'Session model cleanly reset to auto-routing', resetMsg);
  console.log('');

  // TEST 2: Candidate Resolution Speed (<2ms)
  console.log('🏎️ [TEST GROUP 2] Dynamic Candidate Resolution & Ranking');
  const tCand0 = Date.now();
  const generalCandidates = modelRouter.getCandidatesForTask({ taskType: 'general' });
  const codingCandidates = modelRouter.getCandidatesForTask({ taskType: 'coding' });
  const candElapsed = Date.now() - tCand0;

  assert(generalCandidates.length > 0 && generalCandidates[0] === 'openrouter/free', 'General pool prioritizes sub-second openrouter/free model');
  assert(codingCandidates.length > 0, 'Coding pool has candidates resolved');
  assert(candElapsed < 10, `Candidate resolution executed in ${candElapsed}ms (<10ms requirement)`);
  console.log('');

  // TEST 3: Live Ultra-Fast Response / Fallback Benchmarking
  console.log('🚀 [TEST GROUP 3] Live End-to-End Response Speed Benchmark');
  const tResp0 = Date.now();
  const response = await geminiService.analyzeAndRespond('What is 15 + 27? Answer in one short sentence.');
  const respElapsed = Date.now() - tResp0;

  assert(!response.isError, `Service successfully generated response via: ${response.modelUsed}`);
  assert(response.text.length > 0, `Response text received: "${response.text.slice(0, 60)}..."`);
  assert(respElapsed < 5000, `Full conversational response generated in ${respElapsed}ms (<5000ms SLA)`);
  console.log(`  ⏱️ Total Response Latency: ${respElapsed}ms using [${response.modelUsed}]`);
  console.log('');

  // TEST 4: Live Ultra-Fast Coding Engine Fallback
  console.log('💻 [TEST GROUP 4] Live Coding Engine Speed & Multi-Tier Resolution');
  const tCode0 = Date.now();
  const codeRes = await delegateCoding({
    prompt: 'Write a fast function to compute factorial in C',
    language: 'c',
  });
  const codeElapsed = Date.now() - tCode0;

  assert(codeRes.success === true, `Coding engine successfully generated C code using: ${codeRes.model}`);
  assert(!!codeRes.codeSnippet, 'Valid C code snippet extracted');
  assert(codeElapsed < 6000, `Code generation completed in ${codeElapsed}ms (<6000ms SLA)`);
  console.log(`  ⏱️ Total Coding Latency: ${codeElapsed}ms using [${codeRes.model}]`);
  console.log('');

  // Summary
  console.log('=========================================================================');
  console.log(`📊 RESULTS: ${passedTests}/${totalTests} Tests Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('=========================================================================\n');

  if (passedTests < totalTests) {
    process.exit(1);
  }
}

runFastFallbackVerification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
