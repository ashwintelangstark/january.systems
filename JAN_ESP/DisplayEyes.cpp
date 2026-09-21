#include "DisplayEyes.h"

DisplayEyes::DisplayEyes()
  : display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET_PIN),
    currentEmotion(EMOTION_NEUTRAL),
    targetEmotion(EMOTION_NEUTRAL),
    currentState(FACE_IDLE),
    leftEyeCenterX(38),
    rightEyeCenterX(90),
    eyeCenterY(30),
    eyeWidth(26),
    eyeHeight(34),
    cornerRadius(8),
    currentEyeHeightL(34.0f),
    currentEyeHeightR(34.0f),
    targetEyeHeight(34.0f),
    pupilOffsetX(0),
    pupilOffsetY(0),
    targetPupilX(0),
    targetPupilY(0),
    isBlinking(false),
    blinkStep(0),
    lastBlinkTime(0),
    nextBlinkInterval(4000),
    lastSaccadeTime(0),
    nextSaccadeInterval(3500),
    lastFrameTime(0),
    currentAudioLevel(0.0f),
    mouthAnimPhase(0),
    messageExpiryTime(0) {}

bool DisplayEyes::begin() {
  Wire.begin(OLED_SDA_PIN, OLED_SCL_PIN);
  Wire.setClock(100000); // 100kHz standard mode for breadboard jumper wire stability

  // Scan & test common OLED I2C addresses (0x3C and 0x3D)
  uint8_t foundAddr = 0;
  uint8_t probeAddrs[] = {0x3C, 0x3D};
  
  for (uint8_t addr : probeAddrs) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      foundAddr = addr;
      Serial.print(F("🔍 [Display] I2C device detected at address 0x"));
      Serial.println(addr, HEX);
      break;
    }
  }

  uint8_t targetAddr = (foundAddr != 0) ? foundAddr : OLED_I2C_ADDR;

  if (!display.begin(SSD1306_SWITCHCAPVCC, targetAddr)) {
    // Retry alternative address
    uint8_t altAddr = (targetAddr == 0x3C) ? 0x3D : 0x3C;
    if (!display.begin(SSD1306_SWITCHCAPVCC, altAddr)) {
      Serial.println(F("❌ [Display] SSD1306 OLED initialization failed at 0x3C and 0x3D!"));
      Serial.println(F("   💡 Check: 1) VCC connected to 5V / 3.3V, 2) GND connected, 3) SDA=GPIO 21, SCL=GPIO 22"));
      return false;
    }
  }

  display.dim(false); // Maximize display brightness
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);

  // Splash Screen
  display.drawRoundRect(10, 10, 108, 44, 6, SSD1306_WHITE);
  display.setCursor(26, 20);
  display.print(F("JANUARY AI"));
  display.setCursor(20, 36);
  display.print(F("INITIALIZING..."));
  display.display();
  delay(800);

  lastBlinkTime = millis();
  lastSaccadeTime = millis();
  return true;
}

void DisplayEyes::setEmotion(EyeEmotion emotion) {
  currentEmotion = emotion;
  targetEmotion = emotion;
  
  if (emotion == EMOTION_SLEEP) {
    targetEyeHeight = 2.0f;
  } else if (emotion == EMOTION_FOCUSED) {
    targetEyeHeight = 16.0f;
  } else if (emotion == EMOTION_SURPRISED) {
    targetEyeHeight = 38.0f;
  } else {
    targetEyeHeight = 34.0f;
  }
}

void DisplayEyes::setEmotionByName(const String& name) {
  String lower = name;
  lower.toLowerCase();
  lower.trim();

  if (lower == "joy" || lower == "happy") {
    setEmotion(EMOTION_JOY);
  } else if (lower == "curious" || lower == "thinking") {
    setEmotion(EMOTION_CURIOUS);
  } else if (lower == "focused" || lower == "working" || lower == "coding") {
    setEmotion(EMOTION_FOCUSED);
  } else if (lower == "concerned" || lower == "empathetic" || lower == "sad") {
    setEmotion(EMOTION_CONCERNED);
  } else if (lower == "surprised" || lower == "wake") {
    setEmotion(EMOTION_SURPRISED);
  } else if (lower == "sleep" || lower == "sleeping" || lower == "good night") {
    setEmotion(EMOTION_SLEEP);
  } else {
    setEmotion(EMOTION_NEUTRAL);
  }
}

void DisplayEyes::setFaceState(AgentFaceState state) {
  currentState = state;
}

void DisplayEyes::setFaceStateByName(const String& stateName) {
  String lower = stateName;
  lower.toLowerCase();
  lower.trim();

  if (lower == "listening") {
    setFaceState(FACE_LISTENING);
  } else if (lower == "speaking") {
    setFaceState(FACE_SPEAKING);
  } else if (lower == "working" || lower == "thinking") {
    setFaceState(FACE_THINKING);
  } else {
    setFaceState(FACE_IDLE);
  }
}

void DisplayEyes::setAudioLevel(float level) {
  currentAudioLevel = constrain(level, 0.0f, 1.0f);
}

void DisplayEyes::triggerBlink() {
  if (currentEmotion != EMOTION_SLEEP) {
    isBlinking = true;
    blinkStep = 1;
  }
}

void DisplayEyes::lookAt(int8_t offsetX, int8_t offsetY) {
  targetPupilX = constrain(offsetX, -8, 8);
  targetPupilY = constrain(offsetY, -6, 6);
}

void DisplayEyes::showMessage(const String& title, const String& subtitle, uint16_t durationMs) {
  messageTitle = title;
  messageSubtitle = subtitle;
  messageExpiryTime = millis() + durationMs;
}

void DisplayEyes::update() {
  unsigned long now = millis();

  // Enforce target frame rate (e.g. 40 FPS -> 25ms per frame)
  if (now - lastFrameTime < (1000 / ANIMATION_FPS)) {
    return;
  }
  lastFrameTime = now;

  // 1. Natural Saccadic Gaze Shifts (Looking around naturally)
  if (currentEmotion != EMOTION_SLEEP && !isBlinking) {
    if (now - lastSaccadeTime > nextSaccadeInterval) {
      lastSaccadeTime = now;
      nextSaccadeInterval = random(2500, 6000);
      
      uint8_t randGaze = random(0, 100);
      if (randGaze < 45) {
        // Look center
        lookAt(0, 0);
      } else if (randGaze < 65) {
        // Look slightly left or right
        lookAt(random(0, 2) == 0 ? -6 : 6, random(-2, 3));
      } else if (randGaze < 85) {
        // Look up or down
        lookAt(random(-3, 4), random(0, 2) == 0 ? -4 : 4);
      } else {
        // Corner glance
        lookAt(random(-5, 6), random(-4, 5));
      }
    }
  }

  // Smooth pupil interpolation (Low-pass filter for organic acceleration)
  pupilOffsetX += (targetPupilX - pupilOffsetX) * 0.35f;
  pupilOffsetY += (targetPupilY - pupilOffsetY) * 0.35f;

  // 2. Automatic Periodic Natural Blinking
  if (currentEmotion != EMOTION_SLEEP) {
    if (!isBlinking && (now - lastBlinkTime > nextBlinkInterval)) {
      isBlinking = true;
      blinkStep = 1;
      lastBlinkTime = now;
      nextBlinkInterval = random(BLINK_INTERVAL_MIN, BLINK_INTERVAL_MAX);
    }

    if (isBlinking) {
      if (blinkStep == 1) {
        // Closing eyelids fast (down to 2px slit)
        currentEyeHeightL -= 9.0f;
        currentEyeHeightR -= 9.0f;
        if (currentEyeHeightL <= 2.0f) {
          currentEyeHeightL = 2.0f;
          currentEyeHeightR = 2.0f;
          blinkStep = 2; // Start opening
        }
      } else if (blinkStep == 2) {
        // Opening eyelids smoothly
        currentEyeHeightL += 7.0f;
        currentEyeHeightR += 7.0f;
        if (currentEyeHeightL >= targetEyeHeight) {
          currentEyeHeightL = targetEyeHeight;
          currentEyeHeightR = targetEyeHeight;
          isBlinking = false;
          blinkStep = 0;
        }
      }
    } else {
      // Smooth height interpolation toward target emotion height
      currentEyeHeightL += (targetEyeHeight - currentEyeHeightL) * 0.25f;
      currentEyeHeightR += (targetEyeHeight - currentEyeHeightR) * 0.25f;
    }
  } else {
    // Sleeping mode: maintain closed eye slit
    currentEyeHeightL = 2.0f;
    currentEyeHeightR = 2.0f;
  }

  // 3. Clear Screen Buffer
  display.clearDisplay();

  // 4. Render Message Overlay (if active)
  if (now < messageExpiryTime) {
    drawMessageOverlay();
    display.display();
    return;
  }

  // 5. Render Eyes Based on Emotion
  switch (currentEmotion) {
    case EMOTION_JOY:
      drawJoyEyes();
      break;
    case EMOTION_CURIOUS:
      drawCuriousEyes();
      break;
    case EMOTION_FOCUSED:
      drawFocusedEyes();
      break;
    case EMOTION_CONCERNED:
      drawConcernedEyes();
      break;
    case EMOTION_SURPRISED:
      drawSurprisedEyes();
      break;
    case EMOTION_SLEEP:
      drawSleepEyes();
      break;
    case EMOTION_NEUTRAL:
    default:
      drawNeutralEyes();
      break;
  }

  // 6. Render Mouth / Activity Telemetry
  drawMouthOrStatus();

  // 7. Push Buffer to OLED
  display.display();
}

// ----------------------------------------------------------------------------
// DRAWING ROUTINES FOR EMOTIONS
// ----------------------------------------------------------------------------

void DisplayEyes::drawRoundedEye(int16_t x, int16_t y, int16_t w, int16_t h, int16_t r, int8_t pX, int8_t pY) {
  if (h < 3) {
    // Flat line (closed eye)
    display.drawFastHLine(x - w / 2, y, w, SSD1306_WHITE);
    display.drawFastHLine(x - w / 2, y + 1, w, SSD1306_WHITE);
    return;
  }

  int16_t top = y - (h / 2);
  int16_t left = x - (w / 2);
  int16_t radius = min((int16_t)r, (int16_t)(h / 2));

  // Solid white eye contour
  display.fillRoundRect(left, top, w, h, radius, SSD1306_WHITE);

  // Black pupil inset for directional gaze
  int16_t pupilRadius = 4;
  int16_t pupilX = x + pX;
  int16_t pupilY = y + pY;

  // Constrain pupil inside eye contour
  pupilX = constrain(pupilX, left + pupilRadius + 2, left + w - pupilRadius - 2);
  pupilY = constrain(pupilY, top + pupilRadius + 2, top + h - pupilRadius - 2);

  display.fillCircle(pupilX, pupilY, pupilRadius, SSD1306_BLACK);

  // Catchlight (White sparkle glint inside pupil)
  display.drawPixel(pupilX - 1, pupilY - 1, SSD1306_WHITE);
}

void DisplayEyes::drawCrescentEye(int16_t x, int16_t y, int16_t w, int16_t h) {
  // Joyful inverted crescent smiling eyes ( ^ ^ )
  int16_t top = y - (h / 2);
  int16_t left = x - (w / 2);

  // Draw 3 concentric arcs for bold look
  for (int8_t thickness = 0; thickness < 3; thickness++) {
    display.drawCircleHelper(x, top + 10 + thickness, w / 2, 0x1 | 0x2, SSD1306_WHITE);
  }
}

void DisplayEyes::drawNeutralEyes() {
  drawRoundedEye(leftEyeCenterX, eyeCenterY, eyeWidth, (int16_t)currentEyeHeightL, cornerRadius, pupilOffsetX, pupilOffsetY);
  drawRoundedEye(rightEyeCenterX, eyeCenterY, eyeWidth, (int16_t)currentEyeHeightR, cornerRadius, pupilOffsetX, pupilOffsetY);
}

void DisplayEyes::drawJoyEyes() {
  // Bouncing cheerful crescent eyes
  int16_t bounceY = (millis() / 150) % 2;
  drawCrescentEye(leftEyeCenterX, eyeCenterY + bounceY, eyeWidth, eyeHeight);
  drawCrescentEye(rightEyeCenterX, eyeCenterY + bounceY, eyeWidth, eyeHeight);

  // Cute blushing cheeks dots
  display.fillCircle(leftEyeCenterX - 14, eyeCenterY + 14, 2, SSD1306_WHITE);
  display.fillCircle(rightEyeCenterX + 14, eyeCenterY + 14, 2, SSD1306_WHITE);
}

void DisplayEyes::drawCuriousEyes() {
  // Asymmetrical eyes: Left eye raised & wide, right eye tilted / narrower
  int16_t leftH = constrain((int16_t)currentEyeHeightL + 4, 4, 38);
  int16_t rightH = constrain((int16_t)currentEyeHeightR - 6, 4, 26);

  drawRoundedEye(leftEyeCenterX, eyeCenterY - 3, eyeWidth + 2, leftH, cornerRadius, pupilOffsetX + 4, pupilOffsetY - 3);
  drawRoundedEye(rightEyeCenterX, eyeCenterY + 2, eyeWidth - 2, rightH, cornerRadius - 2, pupilOffsetX + 4, pupilOffsetY - 3);

  // Raised curious eyebrow above left eye
  display.drawLine(leftEyeCenterX - 14, eyeCenterY - 24, leftEyeCenterX + 12, eyeCenterY - 26, SSD1306_WHITE);
}

void DisplayEyes::drawFocusedEyes() {
  // Intense narrowed slit eyes
  int16_t focusedH = max((int16_t)currentEyeHeightL, (int16_t)14);

  drawRoundedEye(leftEyeCenterX, eyeCenterY, eyeWidth + 4, focusedH, 4, pupilOffsetX, 0);
  drawRoundedEye(rightEyeCenterX, eyeCenterY, eyeWidth + 4, focusedH, 4, pupilOffsetX, 0);

  // Downward focused eyebrows
  display.drawLine(leftEyeCenterX - 14, eyeCenterY - 14, leftEyeCenterX + 12, eyeCenterY - 9, SSD1306_WHITE);
  display.drawLine(rightEyeCenterX - 12, eyeCenterY - 9, rightEyeCenterX + 14, eyeCenterY - 14, SSD1306_WHITE);
}

void DisplayEyes::drawConcernedEyes() {
  int16_t h = max((int16_t)currentEyeHeightL, (int16_t)24);
  drawRoundedEye(leftEyeCenterX, eyeCenterY, eyeWidth, h, cornerRadius, 0, 4);
  drawRoundedEye(rightEyeCenterX, eyeCenterY, eyeWidth, h, cornerRadius, 0, 4);

  // Upward slanted sympathetic eyebrows
  display.drawLine(leftEyeCenterX - 12, eyeCenterY - 12, leftEyeCenterX + 12, eyeCenterY - 17, SSD1306_WHITE);
  display.drawLine(rightEyeCenterX - 12, eyeCenterY - 17, rightEyeCenterX + 12, eyeCenterY - 12, SSD1306_WHITE);
}

void DisplayEyes::drawSurprisedEyes() {
  // Large circular eyes
  display.fillCircle(leftEyeCenterX, eyeCenterY, 17, SSD1306_WHITE);
  display.fillCircle(rightEyeCenterX, eyeCenterY, 17, SSD1306_WHITE);

  display.fillCircle(leftEyeCenterX + pupilOffsetX, eyeCenterY + pupilOffsetY, 5, SSD1306_BLACK);
  display.fillCircle(rightEyeCenterX + pupilOffsetX, eyeCenterY + pupilOffsetY, 5, SSD1306_BLACK);

  display.drawPixel(leftEyeCenterX + pupilOffsetX - 1, eyeCenterY + pupilOffsetY - 1, SSD1306_WHITE);
  display.drawPixel(rightEyeCenterX + pupilOffsetX - 1, eyeCenterY + pupilOffsetY - 1, SSD1306_WHITE);
}

void DisplayEyes::drawSleepEyes() {
  // Closed sleeping eyelids (- -)
  display.drawFastHLine(leftEyeCenterX - 12, eyeCenterY + 2, 24, SSD1306_WHITE);
  display.drawFastHLine(leftEyeCenterX - 10, eyeCenterY + 3, 20, SSD1306_WHITE);

  display.drawFastHLine(rightEyeCenterX - 12, eyeCenterY + 2, 24, SSD1306_WHITE);
  display.drawFastHLine(rightEyeCenterX - 10, eyeCenterY + 3, 20, SSD1306_WHITE);

  // Floating animated "Zzz"
  uint16_t zPhase = (millis() / 400) % 4;
  display.setTextSize(1);
  if (zPhase >= 1) {
    display.setCursor(98, 16);
    display.print(F("z"));
  }
  if (zPhase >= 2) {
    display.setCursor(106, 10);
    display.print(F("Z"));
  }
  if (zPhase >= 3) {
    display.setCursor(114, 4);
    display.print(F("Z"));
  }
}

void DisplayEyes::drawMouthOrStatus() {
  int16_t mouthCenterY = 56;

  if (currentState == FACE_SPEAKING) {
    // Dynamic animated talking mouth wave (synced with audio level)
    mouthAnimPhase = (mouthAnimPhase + 1) % 6;
    int16_t mouthWidth = 24 + (int16_t)(currentAudioLevel * 20.0f);
    int16_t mouthHeight = 4 + (int16_t)(currentAudioLevel * 8.0f) + (mouthAnimPhase % 3);

    display.fillRoundRect(64 - (mouthWidth / 2), mouthCenterY - (mouthHeight / 2), mouthWidth, mouthHeight, 2, SSD1306_WHITE);
  } else if (currentState == FACE_LISTENING) {
    // Pulsating listening activity bar / dots
    uint8_t pulse = (millis() / 120) % 5;
    for (int8_t i = -2; i <= 2; i++) {
      int8_t h = (abs(i) == pulse % 3) ? 6 : 2;
      display.fillRoundRect(64 + (i * 7) - 1, mouthCenterY - (h / 2), 3, h, 1, SSD1306_WHITE);
    }
  } else if (currentState == FACE_THINKING) {
    // Progress thinking scan bar
    uint8_t scanX = (millis() / 25) % 40;
    display.drawFastHLine(44, mouthCenterY, 40, SSD1306_WHITE);
    display.fillCircle(44 + scanX, mouthCenterY, 2, SSD1306_WHITE);
  }
}

void DisplayEyes::showWeather(const String& city, const String& temp, const String& condition, uint16_t durationMs) {
  messageTitle = city + " " + temp;
  messageSubtitle = condition;
  messageExpiryTime = millis() + durationMs;
}

void DisplayEyes::drawMessageOverlay() {
  display.drawRoundRect(2, 2, 124, 60, 4, SSD1306_WHITE);
  display.setCursor(10, 14);
  display.setTextSize(1);
  display.print(messageTitle);
  display.drawFastHLine(10, 26, 108, SSD1306_WHITE);
  display.setCursor(10, 36);
  display.print(messageSubtitle);
}

