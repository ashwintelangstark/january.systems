#include "JanNetworkClient.h"

JanNetworkClient* JanNetworkClient::instance = nullptr;

JanNetworkClient::JanNetworkClient()
  : wifiConnected(false),
    serverConnected(false),
    lastWifiCheck(0),
    lastPingTime(0),
    emotionCallback(nullptr),
    stateCallback(nullptr),
    audioLevelCallback(nullptr),
    transcriptCallback(nullptr) {
  instance = this;
}

void JanNetworkClient::begin() {
  if (!ENABLE_WIFI) {
    Serial.println(F("ℹ️ [Network] Wi-Fi disabled in config. Running in standalone hardware mode."));
    return;
  }

  connectWiFi();
  setupWebSocket();
}

void JanNetworkClient::connectWiFi() {
  Serial.print(F("🌐 [Wi-Fi] Connecting to: "));
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  uint8_t retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 25) {
    delay(400);
    Serial.print(F("."));
    retries++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.print(F("✅ [Wi-Fi] Connected! IP Address: "));
    Serial.println(WiFi.localIP());
  } else {
    wifiConnected = false;
    Serial.println(F("⚠️ [Wi-Fi] Could not connect. Continuing in offline standalone mode."));
  }
}

void JanNetworkClient::setupWebSocket() {
  if (!wifiConnected) return;

  Serial.print(F("🔌 [WebSocket] Initializing connection to January Server ws://"));
  Serial.print(SERVER_HOST);
  Serial.print(F(":"));
  Serial.println(SERVER_PORT);

  webSocket.begin(SERVER_HOST, SERVER_PORT, "/");
  webSocket.onEvent(staticWebSocketEvent);
  webSocket.setReconnectInterval(5000);
}

void JanNetworkClient::handleWebSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      serverConnected = false;
      Serial.println(F("🔌 [WebSocket] Disconnected from January Server."));
      break;

    case WStype_CONNECTED:
      serverConnected = true;
      Serial.println(F("🌟 [WebSocket] CONNECTED TO JANUARY AI CORE!"));
      // Send initial registration ping
      webSocket.sendTXT("{\"type\":\"ping\"}");
      break;

    case WStype_TEXT: {
      String msg = String((char*)payload);
      processJsonMessage(msg);
      break;
    }

    case WStype_BIN:
    case WStype_ERROR:
    case WStype_PING:
    case WStype_PONG:
    default:
      break;
  }
}

void JanNetworkClient::processJsonMessage(const String& message) {
  // Parse incoming JSON message from January Server using ArduinoJson 7
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, message);

  if (err) {
    return;
  }

  const char* type = doc["type"] | "";

  // 1. Emotion Update (Joy, Curious, Focused, Sleep, Concerned, Calm)
  if (strcmp(type, "emotion_update") == 0) {
    const char* emotion = doc["payload"]["emotion"] | "neutral";
    Serial.print(F("✨ [Event] Emotion Update: "));
    Serial.println(emotion);
    if (emotionCallback) {
      emotionCallback(String(emotion));
    }
  }
  // 2. Agent State Change (listening, speaking, working, sleeping, passive)
  else if (strcmp(type, "state_change") == 0) {
    const char* state = doc["state"] | "passive";
    Serial.print(F("⚡ [Event] State Change: "));
    Serial.println(state);
    if (stateCallback) {
      stateCallback(String(state));
    }
  }
  // 3. Spoken Transcript
  else if (strcmp(type, "transcript") == 0) {
    const char* role = doc["payload"]["role"] | "";
    const char* text = doc["payload"]["text"] | "";
    if (transcriptCallback) {
      transcriptCallback(String(role), String(text));
    }
  }
  // 4. Audio Level (Waveform Visualizer)
  else if (strcmp(type, "audio_level") == 0) {
    float level = doc["level"] | 0.0f;
    if (audioLevelCallback) {
      audioLevelCallback(level);
    }
  }
}

void JanNetworkClient::sendTextPrompt(const String& prompt) {
  if (!serverConnected) return;

  JsonDocument doc;
  doc["type"] = "text_input";
  doc["text"] = prompt;

  String output;
  serializeJson(doc, output);
  webSocket.sendTXT(output);
}

void JanNetworkClient::sendWakeTrigger() {
  if (!serverConnected) return;
  webSocket.sendTXT("{\"type\":\"wake_trigger\",\"source\":\"esp32\"}");
}

void JanNetworkClient::sendSleepTrigger() {
  if (!serverConnected) return;
  webSocket.sendTXT("{\"type\":\"sleep_trigger\",\"source\":\"esp32\"}");
}

bool JanNetworkClient::isConnectedToWifi() const {
  return wifiConnected && (WiFi.status() == WL_CONNECTED);
}

bool JanNetworkClient::isConnectedToServer() const {
  return serverConnected;
}

void JanNetworkClient::update() {
  if (!ENABLE_WIFI) return;

  // Wi-Fi Auto-Reconnect Check (every 10 seconds)
  unsigned long now = millis();
  if (now - lastWifiCheck > 10000) {
    lastWifiCheck = now;
    if (WiFi.status() != WL_CONNECTED) {
      wifiConnected = false;
      serverConnected = false;
      Serial.println(F("🔄 [Wi-Fi] Connection lost. Attempting reconnection..."));
      WiFi.reconnect();
    }
  }

  // Heartbeat ping (every 15 seconds)
  if (serverConnected && (now - lastPingTime > 15000)) {
    lastPingTime = now;
    webSocket.sendTXT("{\"type\":\"ping\"}");
  }

  webSocket.loop();
}
