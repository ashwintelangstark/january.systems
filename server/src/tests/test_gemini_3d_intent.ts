import { GeminiService } from '../gemini/geminiService.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testGeminiServiceIntent() {
  console.log('--- Testing GeminiService 3D Intent Routing ---');
  const service = new GeminiService();

  const prompt = 'January, build a 3d model of a low poly sports car in blender';
  console.log(`Prompt: "${prompt}"`);

  const response = await service.analyzeAndRespond(prompt);
  console.log('Response modelUsed:', response.modelUsed);
  console.log('Response verbalSummary:', response.verbalSummary);
  console.log('Response text:', response.text);

  if (response.modelUsed === 'Blender 5.2 Native Engine' && response.toolCalls?.[0]?.name === 'create_3d_model') {
    console.log('✅ [PASS] GeminiService routed 3D modeling intent directly to Blender Engine!');
  } else {
    console.error('❌ [FAIL] GeminiService did not route to Blender Engine:', response);
    process.exit(1);
  }
}

testGeminiServiceIntent().catch((err) => {
  console.error('Error in GeminiService test:', err);
  process.exit(1);
});
