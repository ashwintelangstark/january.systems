/**
 * ============================================================================
 *      ⚡ JANUARY AI — STANDALONE OLED FACE & SPEAKER QUICK-TEST SKETCH
 * ============================================================================
 * Complete self-contained single-file diagnostic sketch.
 * No external headers needed. Requires only Adafruit_SSD1306 library.
 *
 * Your OLED Pin Order (GND is Pin 1!):
 * - Pin 1 (GND) ──> ESP32 GND (Breadboard Negative Rail)
 * - Pin 2 (VCC) ──> ESP32 3V3 or 5V (Breadboard Positive Rail)
 * - Pin 3 (SCL) ──> ESP32 GPIO 22 (I2C Clock)
 * - Pin 4 (SDA) ──> ESP32 GPIO 21 (I2C Data)
 *
 * ISD1820 Voice Module:
 * - VCC ──────────> 5V
 * - GND ──────────> GND
 * - REC ──────────> ESP32 GPIO 4
 * - PLAYE ────────> ESP32 GPIO 5
 * ============================================================================
 */

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH   128
#define SCREEN_HEIGHT  64
#define OLED_RESET     -1

#define SDA_PIN        21
#define SCL_PIN        22

#define ISD_REC_PIN    4
#define ISD_PLAYE_PIN  5

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

bool displayInitialized = false;
unsigned long lastScanRetry = 0;

// Eye Geometry
const int16_t leftX  = 38;
const int16_t rightX = 90;
const int16_t eyeY   = 28;
const int16_t eyeW   = 26;
const int16_t eyeH   = 32;

// Animation State
float currentHeight  = 32.0f;
bool isBlinking       = false;
uint8_t blinkStep    = 0;
unsigned long lastBlink = 0;
int8_t gazeX         = 0;
int8_t gazeY         = 0;
unsigned long lastGaze = 0;

void drawEye(int16_t x, int16_t y, int16_t w, int16_t h, int8_t pX, int8_t pY) {
  if (h < 3) {
    display.drawFastHLine(x - w / 2, y, w, SSD1306_WHITE);
    display.drawFastHLine(x - w / 2, y + 1, w, SSD1306_WHITE);
    return;
  }
  int16_t top = y - (h / 2);
  int16_t left = x - (w / 2);
  int16_t r = min((int16_t)7, (int16_t)(h / 2));
  display.fillRoundRect(left, top, w, h, r, SSD1306_WHITE);

  // Pupil Inset
  int16_t pupilX = constrain(x + pX, left + 6, left + w - 6);
  int16_t pupilY = constrain(y + pY, top + 6, top + h - 6);
  display.fillCircle(pupilX, pupilY, 4, SSD1306_BLACK);
  display.drawPixel(pupilX - 1, pupilY - 1, SSD1306_WHITE);
}

void triggerSpeakerPlayback() {
  Serial.println(F("🔊 [Speaker Test] Pulsing GPIO 5 (PLAYE) HIGH... Playing audio through speaker!"));
  digitalWrite(ISD_PLAYE_PIN, LOW);
  delay(10);
  digitalWrite(ISD_PLAYE_PIN, HIGH);
  delay(120);
  digitalWrite(ISD_PLAYE_PIN, LOW);
}

bool tryInitDisplay() {
  uint8_t addresses[] = {0x3C, 0x3D};
  uint8_t found = 0;

  for (uint8_t a : addresses) {
    Wire.beginTransmission(a);
    if (Wire.endTransmission() == 0) {
      found = a;
      Serial.print(F("✅ [I2C Scan] Found OLED at 0x"));
      Serial.println(a, HEX);
      break;
    }
  }

  if (found == 0) {
    found = 0x3C; // forced fallback attempt
  }

  if (display.begin(SSD1306_SWITCHCAPVCC, found)) {
    display.dim(false); // Maximum brightness
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    
    // Draw immediate test frame
    display.drawRoundRect(2, 2, 124, 60, 4, SSD1306_WHITE);
    display.setCursor(16, 20);
    display.print(F("JANUARY AI"));
    display.setCursor(16, 36);
    display.print(F("OLED CONNECTED!"));
    display.display();
    delay(1000);

    displayInitialized = true;
    Serial.println(F("🎉 [Display] OLED 128x64 INITIALIZED & TEST SCREEN DISPLAYED!"));
    return true;
  }

  return false;
}

void setup() {
  Serial.begin(115200);
  delay(800);

  Serial.println(F("\n=================================================="));
  Serial.println(F("⚡ JANUARY AI — OLED FACE & SPEAKER QUICK TEST"));
  Serial.println(F("=================================================="));

  // Initialize Audio Pins
  pinMode(ISD_REC_PIN, OUTPUT);
  pinMode(ISD_PLAYE_PIN, OUTPUT);
  digitalWrite(ISD_REC_PIN, LOW);
  digitalWrite(ISD_PLAYE_PIN, LOW);

  // Initialize I2C Bus at 100kHz for breadboard jumper stability
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(100000);

  // Immediate Speaker Test on Boot
  Serial.println(F("🔊 [Boot Test] Pulsing GPIO 5 (PLAYE) to test speaker..."));
  triggerSpeakerPlayback();

  // Try initial display connect
  if (!tryInitDisplay()) {
    Serial.println(F("\n⚠️ [OLED NOT DETECTED YET]"));
    Serial.println(F("👉 YOUR MODULE IS: [Pin 1: GND] [Pin 2: VCC] [Pin 3: SCL] [Pin 4: SDA]"));
    Serial.println(F("   Make sure:"));
    Serial.println(F("   1. Pin 1 (GND) -> Connected to ESP32 GND (NOT 5V!)"));
    Serial.println(F("   2. Pin 2 (VCC) -> Connected to ESP32 3V3 or 5V (NOT GND!)"));
    Serial.println(F("   3. Pin 3 (SCL) -> Connected to ESP32 GPIO 22"));
    Serial.println(F("   4. Pin 4 (SDA) -> Connected to ESP32 GPIO 21"));
    Serial.println(F("🔄 Auto-detecting in background every 2 seconds... Swap the wires now if reversed!\n"));
  }

  lastBlink = millis();
  lastGaze = millis();
  lastScanRetry = millis();
}

void loop() {
  unsigned long now = millis();

  // If display wasn't detected on boot, retry automatically
  if (!displayInitialized) {
    if (now - lastScanRetry > 2000) {
      lastScanRetry = now;
      Serial.println(F("🔍 Scanning I2C bus for OLED on GPIO 21 (SDA) and GPIO 22 (SCL)..."));
      if (tryInitDisplay()) {
        Serial.println(F("✨ OLED detected and turned on!"));
      }
    }
    delay(50);
    return;
  }

  // 1. Natural Gaze Shifts
  if (now - lastGaze > 3500) {
    lastGaze = now;
    uint8_t r = random(0, 3);
    if (r == 0) { gazeX = 0; gazeY = 0; }
    else if (r == 1) { gazeX = -5; gazeY = -2; }
    else { gazeX = 5; gazeY = 1; }
  }

  // 2. Periodic Natural Blinking
  if (!isBlinking && (now - lastBlink > 3500)) {
    isBlinking = true;
    blinkStep = 1;
    lastBlink = now;
  }

  if (isBlinking) {
    if (blinkStep == 1) {
      currentHeight -= 8.0f;
      if (currentHeight <= 2.0f) {
        currentHeight = 2.0f;
        blinkStep = 2;
      }
    } else if (blinkStep == 2) {
      currentHeight += 7.0f;
      if (currentHeight >= 32.0f) {
        currentHeight = 32.0f;
        isBlinking = false;
        blinkStep = 0;
      }
    }
  }

  // 3. Draw January Animated Face
  display.clearDisplay();

  // Left & Right Eyes
  drawEye(leftX, eyeY, eyeW, (int16_t)currentHeight, gazeX, gazeY);
  drawEye(rightX, eyeY, eyeW, (int16_t)currentHeight, gazeX, gazeY);

  // Cute smiling mouth
  for (int8_t t = 0; t < 2; t++) {
    display.drawCircleHelper(64, 46 + t, 10, 0x4 | 0x8, SSD1306_WHITE);
  }

  // Status caption
  display.setCursor(18, 56);
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.print(F("JANUARY FACE: OK"));

  display.display();

  // 4. Process Incoming Serial Commands
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    cmd.toLowerCase();

    if (cmd == "play") {
      triggerSpeakerPlayback();
    } else if (cmd == "rec") {
      Serial.println(F("🔴 Recording audio for 2.5 seconds... Speak now!"));
      digitalWrite(ISD_REC_PIN, HIGH);
      delay(2500);
      digitalWrite(ISD_REC_PIN, LOW);
      Serial.println(F("⏹️ Recording saved. Playing back..."));
      triggerSpeakerPlayback();
    } else if (cmd == "blink") {
      isBlinking = true;
      blinkStep = 1;
    }
  }

  delay(30);
}
