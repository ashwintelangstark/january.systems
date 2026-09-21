#ifndef JAN_NETWORK_CLIENT_H
#define JAN_NETWORK_CLIENT_H

#include <Arduino.h>
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include "config.h"

// Callback type definitions for event dispatch
typedef void (*EmotionCallback)(const String& emotion);
typedef void (*StateCallback)(const String& state);
typedef void (*AudioLevelCallback)(float level);
typedef void (*TranscriptCallback)(const String& role, const String& text);

class JanNetworkClient {
public:
  JanNetworkClient();
  void begin();
  void update();

  bool isConnectedToWifi() const;
  bool isConnectedToServer() const;

  // Event Callbacks
  void onEmotion(EmotionCallback cb) { emotionCallback = cb; }
  void onState(StateCallback cb) { stateCallback = cb; }
  void onAudioLevel(AudioLevelCallback cb) { audioLevelCallback = cb; }
  void onTranscript(TranscriptCallback cb) { transcriptCallback = cb; }

  // Outgoing Commands
  void sendTextPrompt(const String& prompt);
  void sendWakeTrigger();
  void sendSleepTrigger();

private:
  WebSocketsClient webSocket;
  bool wifiConnected;
  bool serverConnected;
  unsigned long lastWifiCheck;
  unsigned long lastPingTime;

  EmotionCallback emotionCallback;
  StateCallback stateCallback;
  AudioLevelCallback audioLevelCallback;
  TranscriptCallback transcriptCallback;

  void connectWiFi();
  void setupWebSocket();
  void handleWebSocketEvent(WStype_t type, uint8_t* payload, size_t length);
  void processJsonMessage(const String& message);

  static JanNetworkClient* instance;
  static void staticWebSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
    if (instance) {
      instance->handleWebSocketEvent(type, payload, length);
    }
  }
};

#endif // JAN_NETWORK_CLIENT_H
