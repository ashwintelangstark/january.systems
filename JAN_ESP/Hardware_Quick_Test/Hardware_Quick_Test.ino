/**
 * ============================================================================
 *      ⚡ JANUARY AI — STANDALONE OLED FACE & SPEAKER QUICK-TEST SKETCH
 * ============================================================================
 * Complete self-contained single-file diagnostic sketch.
 * No external headers needed. Requires only Adafruit_SSD1306 library.
 *
 * Circuit Verification:
 * - 0.96" OLED: VCC->5V/3.3V, GND->GND, SCL->GPIO 22, SDA->GPIO 21
 * - ISD1820:    VCC->5V,      GND->GND, REC->GPIO 4,   PLAYE->GPIO 5
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
  delay(100);
  digitalWrite(ISD_PLAYE_PIN, LOW);
}

void runRecordAndPlayRoutine() {
  Serial.println(F("\n🎙️ [Audio Routine] Starting automatic 3-second Mic Record & Speaker Play test..."));
  
  // 1. Show Recording prompt on OLED
  display.clearDisplay();
  display.drawRoundRect(4, 4, 120, 56, 4, SSD1306_WHITE);
  display.setCursor(14, 16);
  display.setTextSize(1);
  display.print(F("[ 🔴 RECORDING ]"));
  display.setCursor(14, 34);
  display.print(F("Speak to Mic now!"));
  display.display();

  // Hold REC pin HIGH for 2.5 seconds to capture voice
  digitalWrite(ISD_REC_PIN, HIGH);
  delay(2500);
  digitalWrite(ISD_REC_PIN, LOW);
  Serial.println(F("⏹️ [Audio Routine] Recording complete. Saved to ISD1820."));

  // 2. Show Playback prompt on OLED & pulse PLAYE
  display.clearDisplay();
  display.drawRoundRect(4, 4, 120, 56, 4, SSD1306_WHITE);
  display.setCursor(14, 16);
  display.setTextSize(1);
  display.print(F("[ 🔊 PLAYBACK ]"));
  display.setCursor(14, 34);
  display.print(F("Playing your voice!"));
  display.display();

  triggerSpeakerPlayback();
  delay(3000);
}

void setup() {
  Serial.begin(115200);
  delay(600);

  Serial.println(F("\n=================================================="));
  Serial.println(F("⚡ JANUARY AI — OLED FACE & SPEAKER QUICK TEST"));
  Serial.println(F("=================================================="));

  // Initialize Audio Pins
  pinMode(ISD_REC_PIN, OUTPUT);
  pinMode(ISD_PLAYE_PIN, OUTPUT);
  digitalWrite(ISD_REC_PIN, LOW);
  digitalWrite(ISD_PLAYE_PIN, LOW);

  // Initialize I2C Bus at 100kHz for breadboard wire stability
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(100000);

  // Scan I2C
  Serial.println(F("🔍 [I2C Scan] Checking for OLED on SDA=GPIO 21, SCL=GPIO 22..."));
  uint8_t targetAddr = 0;
  uint8_t probeAddrs[] = {0x3C, 0x3D};

  for (uint8_t a : probeAddrs) {
    Wire.beginTransmission(a);
    if (Wire.endTransmission() == 0) {
      targetAddr = a;
      Serial.print(F("   ✅ Found I2C display device at 0x"));
      Serial.println(a, HEX);
      break;
    }
  }

  if (targetAddr == 0) {
    targetAddr = 0x3C; // fallback
    Serial.println(F("   ⚠️ No ACK received during scan. Attempting forced init on 0x3C..."));
  }

  // Initialize SSD1306 OLED
  if (!display.begin(SSD1306_SWITCHCAPVCC, targetAddr)) {
    Serial.println(F("❌ [Display Error] Could not initialize OLED at 0x3C or 0x3D!"));
    Serial.println(F("   Troubleshooting checklist:"));
    Serial.println(F("   1. Check pin order on your OLED module: GND, VCC, SCL, SDA vs VCC, GND, SCL, SDA."));
    Serial.println(F("   2. Verify SCL is on ESP32 GPIO 22."));
    Serial.println(F("   3. Verify SDA is on ESP32 GPIO 21."));
    Serial.println(F("   4. Verify OLED VCC is on 5V (or 3.3V) and GND is connected."));
  } else {
    Serial.println(F("✅ [Display] OLED 128x64 initialized successfully!"));
    display.dim(false); // Max brightness
  }

  // Run the 3-second Record & Speaker Play test
  runRecordAndPlayRoutine();

  Serial.println(F("\n✨ Entering continuous interactive January Face loop."));
  Serial.println(F("💡 Commands you can type in Serial Monitor:"));
  Serial.println(F("   'play'  -> Trigger speaker playback"));
  Serial.println(F("   'rec'   -> Record voice for 2.5 seconds"));
  Serial.println(F("   'blink' -> Force eyelid blink"));
  Serial.println(F("==================================================\n"));
  
  lastBlink = millis();
  lastGaze = millis();
}

void loop() {
  unsigned long now = millis();

  // Natural Gaze Shifts
  if (now - lastGaze > 3500) {
    lastGaze = now;
    uint8_t r = random(0, 3);
    if (r == 0) { gazeX = 0; gazeY = 0; }
    else if (r == 1) { gazeX = -5; gazeY = -2; }
    else { gazeX = 5; gazeY = 1; }
  }

  // Periodic Natural Blinking
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

  // Draw Face onto Display
  display.clearDisplay();

  // Left & Right Eyes
  drawEye(leftX, eyeY, eyeW, (int16_t)currentHeight, gazeX, gazeY);
  drawEye(rightX, eyeY, eyeW, (int16_t)currentHeight, gazeX, gazeY);

  // Cute smiling mouth curve
  for (int8_t t = 0; t < 2; t++) {
    display.drawCircleHelper(64, 46 + t, 10, 0x4 | 0x8, SSD1306_WHITE);
  }

  // Status caption
  display.setCursor(18, 56);
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.print(F("JANUARY FACE: OK"));

  display.display();

  // Serial Monitor Command Listener
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    cmd.toLowerCase();

    if (cmd == "play") {
      triggerSpeakerPlayback();
    } else if (cmd == "rec") {
      runRecordAndPlayRoutine();
    } else if (cmd == "blink") {
      isBlinking = true;
      blinkStep = 1;
    }
  }

  delay(30);
}
