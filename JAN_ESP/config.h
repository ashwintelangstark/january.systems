#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// ============================================================================
// 1. PIN CONFIGURATION (Matches Your Circuit Connections)
// ============================================================================

// 0.96" I2C OLED Display (SSD1306, 128x64)
#define OLED_SDA_PIN    21   // ESP32 GPIO 21 -> OLED SDA
#define OLED_SCL_PIN    22   // ESP32 GPIO 22 -> OLED SCL
#define OLED_RESET_PIN  -1   // Reset pin (-1 if sharing Arduino reset pin)
#define SCREEN_WIDTH    128  // OLED display width in pixels
#define SCREEN_HEIGHT   64   // OLED display height in pixels
#define OLED_I2C_ADDR   0x3C // Default SSD1306 I2C address (some use 0x3D)

// ISD1820 Voice Recording & Playback Module
#define ISD_REC_PIN     4    // ESP32 GPIO 4 -> ISD1820 REC (HIGH to record)
#define ISD_PLAYE_PIN   5    // ESP32 GPIO 5 -> ISD1820 PLAYE (Pulse HIGH for edge playback)

// ============================================================================
// 2. WI-FI & JANUARY AI BACKEND SERVER CONFIGURATION
// ============================================================================
// Change these credentials to your local Wi-Fi and PC IP address
#define WIFI_SSID       "YOUR_WIFI_SSID"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"

// IP address of the machine running January AI server (npm run dev)
#define SERVER_HOST     "192.168.1.100"
#define SERVER_PORT     3001

// Set to true to connect to January Server over WebSocket, false for standalone offline test mode
#define ENABLE_WIFI     false

// ============================================================================
// 3. ANIMATION & TIMING CONSTANTS
// ============================================================================
#define ANIMATION_FPS       40   // Target refresh rate for smooth vector eye animations
#define BLINK_INTERVAL_MIN  3000 // Minimum time between natural random blinks (ms)
#define BLINK_INTERVAL_MAX  7000 // Maximum time between natural random blinks (ms)
#define SACCADE_INTERVAL    4000 // Time between natural eye position shifts (ms)

#endif // CONFIG_H
