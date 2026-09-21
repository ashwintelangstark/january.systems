# 🤖 JAN_ESP: January AI Physical Companion Firmware for ESP32

Complete ESP32 firmware for transforming your **ESP32-WROOM DevKit**, **0.96" I2C OLED Display**, and **ISD1820 Voice Recording & Playback Module** into an interactive physical desktop companion for **January AI**.

---

## ⚡ Circuit & Wiring Diagram

```mermaid
flowchart LR
    subgraph ESP32 ["⚡ ESP32 WROOM DevKit"]
        VIN["5V / VIN"]
        GND["GND"]
        GPIO21["GPIO 21 (SDA)"]
        GPIO22["GPIO 22 (SCL)"]
        GPIO4["GPIO 4 (REC)"]
        GPIO5["GPIO 5 (PLAYE)"]
    end

    subgraph Rails ["🍞 Breadboard Power Rails"]
        POS["(+) 5V Positive Rail"]
        NEG["(-) GND Negative Rail"]
    end

    subgraph OLED ["👀 0.96\" I2C OLED (SSD1306)"]
        OVCC["VCC"]
        OGND["GND"]
        OSCL["SCL"]
        OSDA["SDA"]
    end

    subgraph ISD ["🎙️ ISD1820 Voice Module"]
        IVCC["VCC"]
        IGND["GND"]
        IREC["REC"]
        IPLAYE["PLAYE"]
        ISP["Speaker & Onboard Mic"]
    end

    VIN --> POS
    GND --> NEG

    OVCC --> POS
    OGND --> NEG
    OSCL --> GPIO22
    OSDA --> GPIO21

    IVCC --> POS
    IGND --> NEG
    IREC --> GPIO4
    IPLAYE --> GPIO5
```

### 📌 Pinout Table

| Module | Pin Name | Connects To | Description |
| :--- | :--- | :--- | :--- |
| **Power** | `ESP32 5V (or VIN)` | Breadboard `(+)` Rail | Main 5V power supply rail |
| **Power** | `ESP32 GND` | Breadboard `(-)` Rail | Common Ground |
| **0.96" OLED** | `VCC` | Breadboard `(+)` Rail (5V/3.3V) | Display power |
| **0.96" OLED** | `GND` | Breadboard `(-)` Rail | Display ground |
| **0.96" OLED** | `SCL` | **ESP32 GPIO 22** | Dedicated I2C Clock |
| **0.96" OLED** | `SDA` | **ESP32 GPIO 21** | Dedicated I2C Data |
| **ISD1820** | `VCC` | Breadboard `(+)` Rail (5V) | Voice module power |
| **ISD1820** | `GND` | Breadboard `(-)` Rail | Voice module ground |
| **ISD1820** | `REC` | **ESP32 GPIO 4** | Set `HIGH` to record audio via mic |
| **ISD1820** | `PLAYE` | **ESP32 GPIO 5** | Pulse `HIGH` for edge-triggered playback |
| **ISD1820** | `PLAYL` | *Leave Disconnected* | Level-activated playback |
| **ISD1820** | `FT` | *Leave Disconnected* | Direct feed-through mode |

---

## ✨ Features & Expressive Face Engine

### 1. Vector Eye Animations (40 FPS)
- **Natural Saccades & Looking Around**: Eyes shift position organically when idle.
- **Organic Blinking**: Eyelids smoothly close and spring open with variable timing intervals.
- **7 Expressive Emotions**:
  - **`NEUTRAL`**: Friendly open rounded eyes with pupil gaze shifts.
  - **`JOY` (`^ ^`)**: Cheerful bouncing crescent arcs with blushing cheek dots.
  - **`CURIOUS`**: Asymmetrical inquisitive look with raised eyebrow and tilted head.
  - **`FOCUSED`**: Intense narrowed slit eyes with downward coding eyebrows.
  - **`CONCERNED`**: Empathetic slanting eyebrows.
  - **`SURPRISED` (`O O`)**: Large circular eyes with dilated pupils.
  - **`SLEEP` (`- -`)**: Flat sleeping eyelids with animated floating **Zzz**.
- **Real-Time Mouth & Telemetry**:
  - **`SPEAKING`**: Dynamic animated mouth waveform that expands with speech volume.
  - **`LISTENING`**: Pulsating audio indicator bar below eyes.
  - **`THINKING`**: Smoothly scanning progress bar.

### 2. Live January Server Synchronization
- Connects over local Wi-Fi to your January Node.js Core (`ws://<SERVER_HOST>:3001`).
- Instantly mirrors real-time emotion shifts (`emotion_update`), agent states (`state_change`), and verbal responses.

---

## 🚀 How to Flash into ESP32

### Option A: Using Arduino IDE (Recommended)

1. **Install ESP32 Board Package**:
   - Open Arduino IDE ➜ Go to **Settings / Preferences**.
   - In *Additional Board Manager URLs*, add:
     `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
   - Go to **Tools ➜ Board ➜ Boards Manager** ➜ Search for **`esp32`** by Espressif ➜ Click **Install**.

2. **Install Required Libraries**:
   - Go to **Tools ➜ Manage Libraries...** and install:
     - **`Adafruit SSD1306`** (by Adafruit)
     - **`Adafruit GFX Library`** (by Adafruit)
     - **`ArduinoJson`** (by Benoit Blanchon, v6.x)
     - **`WebSockets`** (by Markus Sattler)

3. **Configure Wi-Fi & Server**:
   - Open [`JAN_ESP/config.h`](file:///Users/ashwintelangstark/Desktop/dot.files/PVT.PROJECTS/JANUARY/january-ai/JAN_ESP/config.h) and edit:
     ```cpp
     #define WIFI_SSID       "YOUR_WIFI_NAME"
     #define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"
     #define SERVER_HOST     "192.168.1.xxx" // IP of computer running January
     #define SERVER_PORT     3001
     ```

4. **Flash**:
   - Connect your ESP32 to your computer via USB.
   - Select **Tools ➜ Board ➜ ESP32 Dev Module**.
   - Select your USB Port (**Tools ➜ Port**).
   - Click **Upload** (or press `Cmd + U` / `Ctrl + U`).

---

### Option B: Using PlatformIO / VS Code

1. Open the project folder in VS Code with PlatformIO extension installed.
2. Open terminal in the `JAN_ESP` folder:
   ```bash
   cd JAN_ESP
   pio run -t upload
   pio device monitor -b 115200
   ```

---

## 🎮 USB Serial Command Interface

Open the Serial Monitor at **`115200 baud`** to control emotions and audio hardware manually:

| Command | Action |
| :--- | :--- |
| `joy` | Switch eyes to happy bouncing crescents |
| `curious` | Switch eyes to curious raised-eyebrow look |
| `focused` | Switch eyes to intense narrowed coding eyes |
| `sleep` | Close eyes and start floating Zzz animation |
| `neutral` | Reset eyes to default natural looking state |
| `surprised` | Open eyes wide in surprise |
| `blink` | Trigger immediate eyelid blink |
| `rec` | Start recording voice on ISD1820 module (GPIO 4 HIGH) |
| `stop` | Stop recording (GPIO 4 LOW) |
| `play` | Play recorded audio through speaker (GPIO 5 PLAYE pulse) |
| `ask:<text>` | Send prompt to January Server (e.g. `ask:what is the weather`) |
| `wake` | Send wake signal (*"Rise"*) to server |
| `help` | Print complete command menu |
