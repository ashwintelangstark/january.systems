#include "AudioController.h"

AudioController::AudioController()
  : isRecording(false),
    isPlaying(false),
    playStartTime(0),
    playDuration(3000) {}

void AudioController::begin() {
  pinMode(ISD_REC_PIN, OUTPUT);
  pinMode(ISD_PLAYE_PIN, OUTPUT);

  digitalWrite(ISD_REC_PIN, LOW);
  digitalWrite(ISD_PLAYE_PIN, LOW);

  Serial.println(F("🎙️ [AudioController] ISD1820 GPIOs initialized (REC: GPIO 4, PLAYE: GPIO 5)"));
}

void AudioController::startRecording() {
  if (isPlaying) {
    digitalWrite(ISD_PLAYE_PIN, LOW);
    isPlaying = false;
  }

  isRecording = true;
  digitalWrite(ISD_REC_PIN, HIGH);
  Serial.println(F("🔴 [ISD1820] RECORDING STARTED (REC Pin HIGH)... Speak into microphone."));
}

void AudioController::stopRecording() {
  if (isRecording) {
    digitalWrite(ISD_REC_PIN, LOW);
    isRecording = false;
    Serial.println(F("⏹️ [ISD1820] RECORDING STOPPED (REC Pin LOW). Audio saved to onboard memory."));
  }
}

void AudioController::playRecording(uint16_t estimatedDurationMs) {
  if (isRecording) {
    stopRecording();
  }

  // Generate clean rising-edge pulse on PLAYE (minimum 50ms)
  digitalWrite(ISD_PLAYE_PIN, LOW);
  delay(10);
  digitalWrite(ISD_PLAYE_PIN, HIGH);
  delay(80);
  digitalWrite(ISD_PLAYE_PIN, LOW);

  isPlaying = true;
  playStartTime = millis();
  playDuration = estimatedDurationMs;

  Serial.println(F("🔊 [ISD1820] PLAYBACK TRIGGERED (PLAYE Edge Pulse Sent). Playing audio through speaker."));
}

void AudioController::update() {
  if (isPlaying) {
    if (millis() - playStartTime >= playDuration) {
      isPlaying = false;
      Serial.println(F("🔈 [ISD1820] Playback duration completed."));
    }
  }
}
