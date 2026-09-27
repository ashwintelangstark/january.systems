import { systemSpeaker } from '../audio/systemSpeaker.js';

console.log('🧪 Starting test of SystemSpeaker WebSocket audio streaming...');

systemSpeaker.on('audio_output', (data) => {
  console.log(`✅ [SUCCESS] Received 'audio_output' event!`);
  console.log(`   MimeType: ${data.mimeType}`);
  console.log(`   Base64 length: ${data.data.length} characters`);
  console.log(`   Text: "${data.text}"`);
  process.exit(0);
});

systemSpeaker.on('browser_speak', (data) => {
  console.log(`✅ [SUCCESS] Received 'browser_speak' event!`);
  console.log(`   Text: "${data.text}"`);
  process.exit(0);
});

async function main() {
  console.log('📢 Invoking systemSpeaker.speakText...');
  await systemSpeaker.speakText('Hello Ashwin, testing frontend audio output stream.');
}

main().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
