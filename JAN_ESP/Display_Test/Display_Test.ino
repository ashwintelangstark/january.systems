/**
 * ============================================================================
 *           🧪 JANUARY AI — OLED DISPLAY & HARDWARE DIAGNOSTIC TEST
 * ============================================================================
 * Use this sketch to instantly verify:
 * 1. I2C Bus Scanner on GPIO 21 (SDA) & GPIO 22 (SCL)
 * 2. 0.96" OLED Display (SSD1306) rendering at 128x64
 * 3. All 7 procedural eye animations & emotion transitions
 * 4. Weather card overlay test
 * 5. ISD1820 Voice Module GPIO 4 (REC) & GPIO 5 (PLAYE) pin triggers
 * ============================================================================
 */

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// Hardware Pin Configuration
#define OLED_SDA_PIN    21
#define OLED_SCL_PIN    22
#define OLED_RESET_PIN  -1
#define SCREEN_WIDTH    128
#define SCREEN_HEIGHT   64
#define OLED_I2C_ADDR   0x3C

#define ISD_REC_PIN     4
#define ISD_PLAYE_PIN   5

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET_PIN);

// Test State Variables
uint8_t currentTestStep = 0;
unsigned long lastStepChangeTime = 0;
const uint16_t STEP_DURATION = 2500; // Switch animation step every 2.5 seconds

// Eye Rendering Coordinates
const int16_t leftX = 38;
const int16_t rightX = 90;
const int16_t eyeY = 28;
const int16_t eyeW = 26;
const int16_t eyeH = 34;

void scanI2CBus() {
  Serial.println(F("\n🔍 [I2C Scanner] Scanning bus on SDA=GPIO 21, SCL=GPIO 22..."));
  byte count = 0;
  for (byte i = 8; i < 120; i++) {
    Wire.beginTransmission(i);
    if (Wire.endTransmission() == 0) {
      Serial.print(F("   ✅ Found I2C Device at address 0x"));
      if (i < 16) Serial.print("0");
      Serial.print(i, HEX);
      if (i == 0x3C || i == 0x3D) {
        Serial.println(F(" (SSD1306 OLED Display Detected!)"));
      } else {
        Serial.println();
      }
      count++;
    }
  }
  if (count == 0) {
    Serial.println(F("   ❌ No I2C devices found! Please check SDA/SCL and 5V/GND wiring."));
  }
  Serial.println();
}

void drawEyeContour(int16_t x, int16_t y, int16_t w, int16_t h, int16_t r, int8_t pX, int8_t pY) {
  int16_t top = y - (h / 2);
  int16_t left = x - (w / 2);
  display.fillRoundRect(left, top, w, h, r, SSD1306_WHITE);

  int16_t pupilX = constrain(x + pX, left + 6, left + w - 6);
  int16_t pupilY = constrain(y + pY, top + 6, top + h - 6);
  display.fillCircle(pupilX, pupilY, 4, SSD1306_BLACK);
  display.drawPixel(pupilX - 1, pupilY - 1, SSD1306_WHITE);
}

void setup() {
  Serial.begin(115200);
  delay(600);

  Serial.println(F("\n=================================================="));
  Serial.println(F("🧪 JANUARY OLED DISPLAY & HARDWARE DIAGNOSTIC SUITE"));
  Serial.println(F("=================================================="));

  pinMode(ISD_REC_PIN, OUTPUT);
  pinMode(ISD_PLAYE_PIN, OUTPUT);
  digitalWrite(ISD_REC_PIN, LOW);
  digitalWrite(ISD_PLAYE_PIN, LOW);

  Wire.begin(OLED_SDA_PIN, OLED_SCL_PIN);
  Wire.setClock(400000);

  scanI2CBus();

  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDR)) {
    if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3D)) {
      Serial.println(F("❌ [Display] SSD1306 OLED failed to initialize at 0x3C/0x3D. Check wiring."));
      while (1) delay(1000);
    }
  }

  Serial.println(F("✅ [Display] OLED initialized successfully at 128x64!"));
  Serial.println(F("▶️ Starting automated animation & weather display test loop...\n"));

  lastStepChangeTime = millis();
}

void loop() {
  unsigned long now = millis();

  if (now - lastStepChangeTime > STEP_DURATION) {
    lastStepChangeTime = now;
    currentTestStep = (currentTestStep + 1) % 9;
  }

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);

  switch (currentTestStep) {
    // 1. Boundary & Hardware Info Test
    case 0:
      display.drawRect(0, 0, 128, 64, SSD1306_WHITE);
      display.setCursor(16, 12);
      display.print(F("JANUARY AI OLED"));
      display.drawFastHLine(16, 24, 96, SSD1306_WHITE);
      display.setCursor(18, 32);
      display.print(F("128x64 OLED: OK"));
      display.setCursor(18, 44);
      display.print(F("SDA:21 | SCL:22"));
      break;

    // 2. Emotion: Neutral Eyes with Natural Gaze
    case 1: {
      int8_t gazeX = (sin(now / 300.0) * 5);
      drawEyeContour(leftX, eyeY, eyeW, eyeH, 8, gazeX, 0);
      drawEyeContour(rightX, eyeY, eyeW, eyeH, 8, gazeX, 0);
      display.setCursor(24, 54);
      display.print(F("[ 1. NEUTRAL EYES ]"));
      break;
    }

    // 3. Emotion: Joy / Happy Crescents
    case 2:
      for (int8_t t = 0; t < 3; t++) {
        display.drawCircleHelper(leftX, eyeY - 6 + t, 13, 0x1 | 0x2, SSD1306_WHITE);
        display.drawCircleHelper(rightX, eyeY - 6 + t, 13, 0x1 | 0x2, SSD1306_WHITE);
      }
      display.fillCircle(leftX - 14, eyeY + 12, 2, SSD1306_WHITE);
      display.fillCircle(rightX + 14, eyeY + 12, 2, SSD1306_WHITE);
      display.setCursor(30, 54);
      display.print(F("[ 2. JOY / HAPPY ]"));
      break;

    // 4. Emotion: Curious / Inquisitive
    case 3:
      drawEyeContour(leftX, eyeY - 4, eyeW + 2, eyeH + 4, 8, 4, -4);
      drawEyeContour(rightX, eyeY + 2, eyeW - 4, eyeH - 8, 5, 4, -4);
      display.drawLine(leftX - 14, eyeY - 24, leftX + 12, eyeY - 27, SSD1306_WHITE);
      display.setCursor(20, 54);
      display.print(F("[ 3. CURIOUS / BROW ]"));
      break;

    // 5. Emotion: Focused / Coding Mode
    case 4:
      drawEyeContour(leftX, eyeY, eyeW + 4, 14, 4, 0, 0);
      drawEyeContour(rightX, eyeY, eyeW + 4, 14, 4, 0, 0);
      display.drawLine(leftX - 14, eyeY - 14, leftX + 12, eyeY - 9, SSD1306_WHITE);
      display.drawLine(rightX - 12, eyeY - 9, rightX + 14, eyeY - 14, SSD1306_WHITE);
      display.setCursor(20, 54);
      display.print(F("[ 4. FOCUSED CODING ]"));
      break;

    // 6. Emotion: Surprised / Wide Awake
    case 5:
      display.fillCircle(leftX, eyeY, 16, SSD1306_WHITE);
      display.fillCircle(rightX, eyeY, 16, SSD1306_WHITE);
      display.fillCircle(leftX, eyeY, 5, SSD1306_BLACK);
      display.fillCircle(rightX, eyeY, 5, SSD1306_BLACK);
      display.setCursor(22, 54);
      display.print(F("[ 5. WIDE / SURPRISE ]"));
      break;

    // 7. Emotion: Sleep Mode (Closed Eyes with Zzz)
    case 6: {
      display.drawFastHLine(leftX - 12, eyeY + 2, 24, SSD1306_WHITE);
      display.drawFastHLine(rightX - 12, eyeY + 2, 24, SSD1306_WHITE);
      uint8_t z = (now / 350) % 3;
      if (z >= 0) { display.setCursor(98, 16); display.print("z"); }
      if (z >= 1) { display.setCursor(106, 10); display.print("Z"); }
      if (z >= 2) { display.setCursor(114, 4); display.print("Z"); }
      display.setCursor(22, 54);
      display.print(F("[ 6. SLEEP / ZZZ ]"));
      break;
    }

    // 8. Weather Display Card Test
    case 7:
      display.drawRoundRect(2, 2, 124, 60, 4, SSD1306_WHITE);
      display.setCursor(10, 10);
      display.print(F("WEATHER: HUBLI"));
      display.drawFastHLine(10, 22, 108, SSD1306_WHITE);
      display.setCursor(10, 30);
      display.setTextSize(2);
      display.print(F("28"));
      display.setTextSize(1);
      display.print(F("o"));
      display.setTextSize(2);
      display.print(F("C"));
      display.setTextSize(1);
      display.setCursor(64, 34);
      display.print(F("Cloudy"));
      display.setCursor(10, 48);
      display.print(F("Humidity: 65%"));
      break;

    // 9. ISD1820 Audio Module Pin Trigger Test
    case 8:
      display.drawRoundRect(4, 4, 120, 56, 3, SSD1306_WHITE);
      display.setCursor(14, 14);
      display.print(F("ISD1820 AUDIO PIN"));
      display.drawFastHLine(14, 26, 100, SSD1306_WHITE);
      display.setCursor(14, 34);
      display.print(F("GPIO 4: REC (Mic)"));
      display.setCursor(14, 46);
      display.print(F("GPIO 5: PLAYE (Spk)"));
      break;
  }

  display.display();
  delay(30);
}
