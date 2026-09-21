#ifndef DISPLAY_EYES_H
#define DISPLAY_EYES_H

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "config.h"

// January Emotion Types
enum EyeEmotion {
  EMOTION_NEUTRAL,   // Normal open eyes, natural blinking & looking around
  EMOTION_JOY,       // Happy smiling crescent arcs
  EMOTION_CURIOUS,   // Asymmetric raised brow / inquisitive gaze
  EMOTION_FOCUSED,   // Narrowed slit eyes for intense coding/thinking
  EMOTION_CONCERNED, // Inverted empathetic / sad expression
  EMOTION_SURPRISED, // Wide circular dilated eyes
  EMOTION_SLEEP      // Flat closed eyelids with animated Zzz
};

// January Interaction States
enum AgentFaceState {
  FACE_IDLE,
  FACE_LISTENING,
  FACE_THINKING,
  FACE_SPEAKING
};

class DisplayEyes {
public:
  DisplayEyes();
  bool begin();
  void update();
  
  // Setters
  void setEmotion(EyeEmotion emotion);
  void setEmotionByName(const String& emotionName);
  void setFaceState(AgentFaceState state);
  void setFaceStateByName(const String& stateName);
  void setAudioLevel(float level); // 0.0 to 1.0 for dynamic mouth/waveform
  
  // Direct triggers
  void triggerBlink();
  void lookAt(int8_t offsetX, int8_t offsetY); // -10 to +10 range
  void showMessage(const String& title, const String& subtitle, uint16_t durationMs = 2000);

  EyeEmotion getCurrentEmotion() const { return currentEmotion; }
  AgentFaceState getCurrentState() const { return currentState; }

private:
  Adafruit_SSD1306 display;

  EyeEmotion currentEmotion;
  EyeEmotion targetEmotion;
  AgentFaceState currentState;

  // Eye Geometry & Animation State
  int16_t leftEyeCenterX;
  int16_t rightEyeCenterX;
  int16_t eyeCenterY;

  int16_t eyeWidth;
  int16_t eyeHeight;
  int16_t cornerRadius;

  // Real-time animation coordinates
  float currentEyeHeightL;
  float currentEyeHeightR;
  float targetEyeHeight;

  int8_t pupilOffsetX;
  int8_t pupilOffsetY;
  int8_t targetPupilX;
  int8_t targetPupilY;

  // Blinking State Machine
  bool isBlinking;
  uint8_t blinkStep; // 0 = idle, 1 = closing, 2 = opening
  unsigned long lastBlinkTime;
  unsigned long nextBlinkInterval;

  // Saccade / Look around timer
  unsigned long lastSaccadeTime;
  unsigned long nextSaccadeInterval;

  // Frame timing
  unsigned long lastFrameTime;

  // Speaking mouth wave animation
  float currentAudioLevel;
  uint8_t mouthAnimPhase;

  // Message overlay
  String messageTitle;
  String messageSubtitle;
  unsigned long messageExpiryTime;

  // Internal Draw Routines
  void drawNeutralEyes();
  void drawJoyEyes();
  void drawCuriousEyes();
  void drawFocusedEyes();
  void drawConcernedEyes();
  void drawSurprisedEyes();
  void drawSleepEyes();
  void drawMouthOrStatus();
  void drawMessageOverlay();

  void drawRoundedEye(int16_t x, int16_t y, int16_t w, int16_t h, int16_t r, int8_t pX, int8_t pY);
  void drawCrescentEye(int16_t x, int16_t y, int16_t w, int16_t h);
};

#endif // DISPLAY_EYES_H
