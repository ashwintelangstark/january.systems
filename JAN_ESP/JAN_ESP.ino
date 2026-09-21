/**
 * ============================================================================
 *                ⚡ JANUARY AI — PHYSICAL COMPANION ESP32 FIRMWARE
 * ============================================================================
 * Hardware Setup:
 * 1. ESP32-WROOM DevKit
 * 2. 0.96" I2C OLED Display (SSD1306, 128x64):
 *    - VCC -> Breadboard 5V / 3.3V Rail
 *    - GND -> Breadboard GND Rail
 *    - SCL -> ESP32 GPIO 22
 *    - SDA -> ESP32 GPIO 21
 * 3. ISD1820 Voice Recording & Playback Module:
 *    - VCC -> Breadboard 5V Rail
 *    - GND -> Breadboard GND Rail
 *    - REC -> ESP32 GPIO 4  (HIGH to record audio)
 *    - PLAYE -> ESP32 GPIO 5 (Pulse HIGH for playback)
 * ============================================================================
 */

#include <Arduino.h>
#include "config.h"
#include "DisplayEyes.h"
#include "AudioController.h"
#include "NetworkClient.h"

// Core Hardware Engine Singletons
DisplayEyes displayEyes;
AudioController audioController;
NetworkClient networkClient;

// Serial Command Buffer
String inputCommandBuffer = "";

// ----------------------------------------------------------------------------
// SERVER EVENT HANDLERS (Real-Time WebSocket Sync)
// ----------------------------------------------------------------------------

void onEmotionReceived(const String& emotion) {
  Serial.print(F("✨ [ESP32 Callback] Applying Emotion: "));
  Serial.println(emotion);
  displayEyes.setEmotionByName(emotion);
}

void onStateReceived(const String& state) {
  Serial.print(F("⚡ [ESP32 Callback] Applying State: "));
  Serial.println(state);

  displayEyes.setFaceStateByName(state);

  if (state == "sleeping") {
    displayEyes.setEmotion(EMOTION_SLEEP);
  } else if (state == "speaking") {
    // Trigger ISD1820 playback pulse
    audioController.playRecording(3500);
  } else if (state == "listening") {
    displayEyes.setFaceState(FACE_LISTENING);
  }
}

void onAudioLevelReceived(float level) {
  displayEyes.setAudioLevel(level);
}

void onTranscriptReceived(const String& role, const String& text) {
  if (role == "assistant") {
    displayEyes.setFaceState(FACE_SPEAKING);
    audioController.playRecording(4000);
  }
}

// ----------------------------------------------------------------------------
// SERIAL MONITOR COMMAND PARSER (Direct Testing & Control via USB)
// ----------------------------------------------------------------------------

void printSerialHelp() {
  Serial.println(F("\n=================================================="));
  Serial.println(F("⚡ JANUARY AI ESP32 — SERIAL COMMANDS INTERFACE"));
  Serial.println(F("=================================================="));
  Serial.println(F("EMOTION COMMANDS:"));
  Serial.println(F("  joy       - Happy bouncing crescent eyes"));
  Serial.println(F("  curious   - Inquisitive raised eyebrow"));
  Serial.println(F("  focused   - Intense narrowed coding/thinking eyes"));
  Serial.println(F("  concerned - Empathetic / sad expression"));
  Serial.println(F("  surprised - Wide dilated eyes"));
  Serial.println(F("  sleep     - Closed eyelids with floating Zzz"));
  Serial.println(F("  neutral   - Default open eyes with natural blinks"));
  Serial.println(F(""));
  Serial.println(F("HARDWARE AUDIO COMMANDS:"));
  Serial.println(F("  rec       - Start recording voice onto ISD1820"));
  Serial.println(F("  stop      - Stop recording"));
  Serial.println(F("  play      - Play recorded voice through speaker"));
  Serial.println(F(""));
  Serial.println(F("AI INTERACTION COMMANDS:"));
  Serial.println(F("  ask:<msg> - Send prompt to January Server (e.g. ask:hello)"));
  Serial.println(F("  wake      - Send wake trigger ('Rise') to server"));
  Serial.println(F("  blink     - Trigger immediate eyelid blink"));
  Serial.println(F("==================================================\n"));
}

void handleSerialCommand(String cmd) {
  cmd.trim();
  if (cmd.length() == 0) return;

  String lower = cmd;
  lower.toLowerCase();

  Serial.print(F("📥 [Serial Command] -> "));
  Serial.println(cmd);

  if (lower == "help") {
    printSerialHelp();
  } else if (lower == "joy" || lower == "happy") {
    displayEyes.setEmotion(EMOTION_JOY);
  } else if (lower == "curious" || lower == "thinking") {
    displayEyes.setEmotion(EMOTION_CURIOUS);
  } else if (lower == "focused" || lower == "working" || lower == "coding") {
    displayEyes.setEmotion(EMOTION_FOCUSED);
  } else if (lower == "concerned" || lower == "sad") {
    displayEyes.setEmotion(EMOTION_CONCERNED);
  } else if (lower == "surprised" || lower == "wide") {
    displayEyes.setEmotion(EMOTION_SURPRISED);
  } else if (lower == "sleep" || lower == "good night") {
    displayEyes.setEmotion(EMOTION_SLEEP);
    networkClient.sendSleepTrigger();
  } else if (lower == "neutral" || lower == "reset") {
    displayEyes.setEmotion(EMOTION_NEUTRAL);
    displayEyes.setFaceState(FACE_IDLE);
  } else if (lower == "blink") {
    displayEyes.triggerBlink();
  } else if (lower == "rec" || lower == "record") {
    displayEyes.setFaceState(FACE_LISTENING);
    audioController.startRecording();
  } else if (lower == "stop") {
    audioController.stopRecording();
    displayEyes.setFaceState(FACE_IDLE);
  } else if (lower == "play") {
    displayEyes.setFaceState(FACE_SPEAKING);
    audioController.playRecording(3500);
  } else if (lower == "wake" || lower == "rise") {
    displayEyes.setEmotion(EMOTION_SURPRISED);
    delay(300);
    displayEyes.setEmotion(EMOTION_NEUTRAL);
    networkClient.sendWakeTrigger();
  } else if (lower.startsWith("ask:")) {
    String prompt = cmd.substring(4);
    prompt.trim();
    Serial.print(F("📤 Sending prompt to January AI: "));
    Serial.println(prompt);
    displayEyes.setFaceState(FACE_THINKING);
    networkClient.sendTextPrompt(prompt);
  } else {
    Serial.println(F("⚠️ Unknown command. Type 'help' to see all supported commands."));
  }
}

// ----------------------------------------------------------------------------
// ARDUINO SETUP & MAIN LOOP
// ----------------------------------------------------------------------------

void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println(F("\n=================================================="));
  Serial.println(F("🚀 JANUARY AI PHYSICAL DESK COMPANION INITIALIZING"));
  Serial.println(F("=================================================="));

  // 1. Initialize 0.96" OLED Vector Eye Engine
  if (!displayEyes.begin()) {
    Serial.println(F("❌ Fatal: OLED initialization failed. Halting."));
    while (1) delay(1000);
  }

  // 2. Initialize ISD1820 Voice Recording & Playback
  audioController.begin();

  // 3. Initialize Wi-Fi & WebSocket Connection
  networkClient.onEmotion(onEmotionReceived);
  networkClient.onState(onStateReceived);
  networkClient.onAudioLevel(onAudioLevelReceived);
  networkClient.onTranscript(onTranscriptReceived);
  networkClient.begin();

  printSerialHelp();
  displayEyes.setEmotion(EMOTION_NEUTRAL);
}

void loop() {
  // 1. Update OLED Vector Eye Animation Frame (40 FPS target)
  displayEyes.update();

  // 2. Update Audio Controller Timers
  audioController.update();

  // 3. Process WebSocket & Wi-Fi Network Events
  networkClient.update();

  // 4. Process Incoming USB Serial Commands
  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (inputCommandBuffer.length() > 0) {
        handleSerialCommand(inputCommandBuffer);
        inputCommandBuffer = "";
      }
    } else {
      inputCommandBuffer += c;
    }
  }
}
