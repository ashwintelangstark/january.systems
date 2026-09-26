# ⚡ January AI (`january.systems`)
> **The emotionally expressive, local autonomous AI companion, Computer-Using Agent (CUA), and 3D Generative Engine running natively on macOS. Powered by Dynamic AI Model Routing (458+ Models), Google Gemini Multimodal Vision, Native Blender 3D BIM Synthesis, Anthropic Claude, AVFoundation 60 FPS Camera Eyes, and Open-Source Neural Audio.**

---

## 🌟 Executive Overview

**January** is an advanced, emotionally attuned, autonomous operating system agent engineered to run directly on your Mac hardware. It listens through your MacBook's physical microphone using local **Faster-Whisper** speech-to-text, sees through your native Mac webcam with **AVFoundation 60 FPS hardware streaming** and sub-20ms **local edge face detection**, reasons across **458+ AI models** via a **Dynamic Multi-Tier Model Router**, acts on your desktop as an autonomous **Computer-Using Agent (CUA)**, creates interactive **3D models and architectural BIM buildings in Blender**, generates production-grade **Python, C, and C++** code, queries real-time internet and weather data, and speaks aloud through physical laptop speakers with **ElevenLabs Ultra-Realistic Neural Voices** dynamically modulated by a **7-Archetype Emotion Engine**, backed by **Microsoft Edge-TTS** and native speech fallback.

January operates across two seamless modes:
1. **Autonomous Background Daemon (`npm run dev`)**: Runs headlessly in the background, listening for wake phrases (**"Rise"**) and spoken commands in the room with no open windows required.
2. **Interactive Terminal CLI (`npm run cli`)**: A dual-section REPL (`[ME]` & `[JANUARY]`) that automatically pauses the background microphone during keyboard interaction and resumes room listening upon exit.

---

## 🏛️ Master System Architecture

```mermaid
flowchart TD
    subgraph Inputs ["🎙️ & 📷 Physical Inputs & Perceptions"]
        MIC["🎙️ MacBook Microphone<br/>(16kHz PCM sounddevice)"]
        CAM["📷 MacBook Camera Eyes<br/>(Native AVFoundation 60 FPS Swift Binary)"]
        CLI["💻 Interactive Terminal CLI<br/>([ME] Input REPL)"]
        BLUEPRINT["📐 2D Floor Plan / Blueprint<br/>(Camera Snapshot or CAD/Image File)"]
    end

    subgraph Daemon ["⚡ Core Daemon & State Coordination"]
        VAD["⚡ Voice Activity Detection<br/>(Energy Threshold + 1.2s Reverb Guard)"]
        STT["🗣️ Faster-Whisper<br/>(Local Multilingual tiny Model)"]
        SW["⏸️ / 🔔 CLI Auto-Switching Coordinator<br/>(Pauses mic on CLI attach, resumes on exit)"]
        STATE["🧠 Agent State Machine<br/>[PASSIVE] ⇋ [LISTENING] ⇋ [WORKING] ⇋ [SPEAKING]<br/>⇋ [SLEEPING] ('good night' / 'Rise')"]
        MEM["🧠 Continuous Adaptive Self-Learning Memory<br/>(Local learned_profile.json + interactions.jsonl)"]
    end

    subgraph VisionEngine ["👁️ Native Computer Vision & Perception"]
        SNAP["⚡ Swift Camera Snap Engine<br/>(1080p Frame Capture <0.6s / 60 FPS Stream)"]
        FACE["👤 Local Face & Presence Detector<br/>(OpenCV Haar-Cascade <20ms)"]
        ACT_MON["📊 Continuous Ambient Activity Monitor<br/>(Arrival Greetings, Posture, Wave Gestures)"]
        PLAN_AI["🏛️ Multimodal Architectural Plan Analyzer<br/>(Structural Topology & Room Decomposition)"]
    end

    subgraph CUA_3D ["🤖 CUA Actuation & Blender 3D Engine"]
        SAFETY["🛑 SafetyInterlock<br/>(Bounds Clamping + Emergency Halt Corner 0,0)"]
        MOUSE["🖱️ Humanized Mouse Controller<br/>(Quadratic Bezier Curves & Cliclick Strokes)"]
        KEYB["⌨️ Natural Keyboard Controller<br/>(Humanized Typing & Shortcut Chords)"]
        BLENDER_PROC["🎨 Blender 3D Bridge<br/>(Procedural Swords, Cars, Cups, Torus Knots)"]
        BIM_PROC["🏛️ Procedural BIM Construction<br/>(Foundation, PBR Floors, 3m Walls, Windows, Furniture)"]
        BLENDER_APP["🚀 Native Blender 5.2 GUI<br/>(Automatic Launch & Focus on macOS)"]
    end

    subgraph Intelligence ["🧠 Dynamic AI Brain & Multi-Tier Router"]
        ROUTER["🌐 Dynamic AI Model Router<br/>(458+ OpenRouter / OmniRoute Catalog)"]
        EMO["🎭 Local Emotion Engine<br/>(7 Mood Archetypes & Prosody Attunement)"]
        WEB["🌐 Real-Time Internet & Live Weather<br/>(DuckDuckGo Search + wttr.in Weather)"]
        CODE["💻 Python / C / C++ Coding Engine<br/>(Claude 3.7 ➜ Instant Gemini Fallback)"]
        
        subgraph RoutingTiers ["Tier Fallback & Capability Pools"]
            T1["Tier 1: Primary Gemini Flash / Pro"]
            T2["Tier 2: Fallback Gemini Flash"]
            T3["Tier 3: Dynamic Model Cascade (458+ Models)<br/>• Coding: Qwen Coder, DeepSeek Coder<br/>• Vision: Gemini, Llama Vision, Qwen VL<br/>• Reasoning: DeepSeek R1, LiquidAI<br/>• Fast/Free: 22 Zero-Cost Models"]
        end
    end

    subgraph Synthesis ["🔊 Vocal Synthesis & Physical Output"]
        LANG_ROUTER["🔤 Unicode Script & Language Classifier<br/>(English + 15 Indian Languages)"]
        EL_TTS["🎙️ ElevenLabs Realistic Neural Voice Engine<br/>(Voice: Monika Sogam / Sarah | Real-Time Emotion Tuning)"]
        EDGE_TTS["🗣️ Microsoft Edge-TTS / Native Say Fallback<br/>(Multilingual Script Synthesis)"]
        SPEAKER["🔊 MacBook Physical Speaker<br/>(macOS afplay with Echo Muting)"]
    end

    MIC --> VAD --> STT --> STATE
    CAM --> SNAP --> FACE --> ACT_MON
    BLUEPRINT --> PLAN_AI --> BIM_PROC
    CLI <--> SW <--> VAD
    CLI --> STATE
    STATE <--> MEM
    STATE --> EMO
    STATE --> WEB
    STATE --> CODE
    STATE --> ROUTER
    ROUTER --> T1
    T1 -->|429/Error| T2
    T2 -->|429/Error| T3
    
    STATE --> SAFETY
    SAFETY --> MOUSE
    SAFETY --> KEYB
    STATE --> BLENDER_PROC --> BLENDER_APP
    BIM_PROC --> BLENDER_APP
    
    ROUTER --> LANG_ROUTER
    CODE -.-> LANG_ROUTER
    EMO --> EL_TTS
    LANG_ROUTER --> EL_TTS
    EL_TTS -->|Success| SPEAKER
    EL_TTS -->|Fallback / Offline| EDGE_TTS --> SPEAKER

    classDef primary fill:#1e1e2e,stroke:#89b4fa,stroke-width:2px,color:#cdd6f4;
    classDef highlight fill:#313244,stroke:#f9e2af,stroke-width:2px,color:#f9e2af;
    classDef visionBox fill:#1e1e2e,stroke:#a6e3a1,stroke-width:2px,color:#a6e3a1;
    classDef cuaBox fill:#181825,stroke:#cba6f7,stroke-width:2px,color:#cdd6f4;
    class Inputs,Synthesis primary;
    class Daemon,Intelligence highlight;
    class VisionEngine visionBox;
    class CUA_3D cuaBox;
```

---

## 🌐 Dynamic AI Model Router (458+ Models)

January features a **Dynamic AI Model Router** connecting to an extensive catalog of **458+ models** via OpenRouter / OmniRoute with automatic capability indexing, task-based auto-routing, and on-the-fly voice model switching.

```mermaid
flowchart TD
    UserQuery["User Request / Voice Command"] --> IntentCheck{"Intent Detection"}
    
    IntentCheck -->|'Switch model to X'| LockModel["Lock Session Model in ModelRouter"]
    IntentCheck -->|'Reset model'| ResetModel["Restore Dynamic Auto-Routing"]
    IntentCheck -->|'What model are you using?'| StatusCheck["Return Active Model Status"]
    IntentCheck -->|'List models'| ListModels["Query Catalog by Category"]

    IntentCheck -->|Normal Query / Chat| ExecPath{"Is Session Model Locked?"}
    
    ExecPath -->|Yes| DirectQuery["Query Locked Model directly via OpenRouter"]
    ExecPath -->|No (Default Auto)| PrimaryTier["Tier 1: Primary Gemini Key"]
    
    PrimaryTier -->|429 Quota Exhausted| FallbackGemini["Tier 2: Fallback Gemini Key"]
    FallbackGemini -->|429 Quota Exhausted| DynamicRouter["Tier 3: Dynamic Model Router"]
    
    subgraph "Dynamic Capability Router"
        DynamicRouter -->|Coding Task| CodingPool["Qwen Coder / DeepSeek Coder / Claude"]
        DynamicRouter -->|Vision / Camera| VisionPool["Gemini / Llama Vision / Qwen VL"]
        DynamicRouter -->|Reasoning / Math| ReasoningPool["DeepSeek R1 / LiquidAI"]
        DynamicRouter -->|Casual Chat| FastPool["LiquidAI / Gemma / OpenRouter Auto"]
    end
```

### 📊 Capability Breakdown & Catalog Index

| Category | Model Count | Example Models | Purpose |
| :--- | :--- | :--- | :--- |
| **Free Models** | **22** | `liquid/lfm-2.5-2.6b:free`, `google/gemma-2-9b-it:free`, `meta-llama/llama-3.3-70b-instruct:free` | Zero-cost general chatting, reasoning & fallback |
| **Coding** | **135** | `qwen/qwen-2.5-coder-32b-instruct`, `deepseek/deepseek-coder`, `anthropic/claude-3.7-sonnet` | Specialized code synthesis (C++, Python, C, TS) |
| **Vision** | **287** | `google/gemini-2.0-flash-001`, `meta-llama/llama-3.2-11b-vision-instruct`, `qwen/qwen-2-vl-72b-instruct` | Camera perception, OCR, blueprint analysis |
| **Reasoning** | **197** | `deepseek/deepseek-r1`, `openai/o3-mini`, `liquid/lfm-7b` | Mathematical reasoning, complex logic, planning |
| **Fast / Realtime**| **153** | `meta-llama/llama-3.1-8b-instruct`, `liquid/lfm-2.5-2.6b:free`, `google/gemini-flash-1.5` | Sub-second latency responses |
| **Total Catalog** | **458+** | Indexed in [`server/data/models/catalog.json`](file:///Users/ashwintelangstark/Desktop/dot.files/PVT.PROJECTS/JANUARY/january-ai/server/data/models/catalog.json) & [`openrouter_models.csv`](file:///Users/ashwintelangstark/Desktop/dot.files/PVT.PROJECTS/JANUARY/january-ai/openrouter_models.csv) | Universal model coverage |

### 🗣️ Model Control Voice & Text Commands

| Voice / Chat Command | Action Performed |
| :--- | :--- |
| **"Switch model to DeepSeek R1"** | Locks session model to `deepseek/deepseek-r1-0528` |
| **"Switch model to Liquid"** | Locks session model to `liquid/lfm-2.5-2.6b:free` |
| **"Switch model to Qwen Coder"** | Locks session model to `qwen/qwen-2.5-coder-32b-instruct` |
| **"Switch model to GPT-4o"** | Locks session model to `openai/gpt-4o` |
| **"What model are you using?"** | Reports active model name, token context window, and pricing status |
| **"List free models"** | Lists top zero-cost free models |
| **"Reset model"** | Clears session lock and restores automatic dynamic routing |

---

## 🤖 Computer-Using Agent (CUA) Actuation Layer (Phase 1)

January includes an **OS-level Computer-Using Agent (CUA)** actuation layer that translates natural language intentions into physical mouse, keyboard, and application actions on macOS.

```mermaid
flowchart TD
    Prompt["User Command:<br/>'Move cursor to top right and type search query'"] --> ToolCall["executeTool('execute_cua_action')"]

    subgraph "Safety & Interlock Layer"
        ToolCall --> Interlock["SafetyInterlock Controller"]
        Interlock --> CheckHalt{"Emergency Halt Corner?<br/>(x <= 10 && y <= 10)"}
        CheckHalt -->|Yes| Abort["🛑 Global Halt & Abort Action"]
        CheckHalt -->|No| Clamp["Screen Bounds Clamping<br/>(0 to Display Width/Height)"]
    end

    subgraph "Actuation Layer"
        Clamp --> Mouse["MouseController (/opt/homebrew/bin/cliclick)"]
        Clamp --> Keyboard["KeyboardController"]
        Clamp --> Window["WindowManager (AppleScript)"]
        
        Mouse --> Bezier["Quadratic Bezier Curve Interpolation<br/>(Smooth humanized acceleration)"]
        Mouse --> Clicks["Physical Clicks, Double Clicks, Right Clicks, Drag Strokes"]
        Keyboard --> Typing["Humanized Per-Character Delay Typing"]
        Keyboard --> Shortcuts["Shortcut Chords (cmd+s, cmd+n, cmd+shift+p)"]
        Window --> Focus["Bring App Window to Front & Center"]
    end
```

### 🛡️ Safety Interlocks & Features
1. **Emergency Fail-Safe Corner**: Moving the mouse to the top-left corner `(x <= 10, y <= 10)` or pressing `Ctrl+C` immediately aborts all running CUA actions.
2. **Screen Coordinate Clamping**: Clamps every coordinate against native display resolution to prevent out-of-bounds pointer exceptions.
3. **Humanized Bezier Trajectories**: Instead of teleporting the cursor, January calculates quadratic Bezier curves with randomized micro-deviations to simulate human motor movement.
4. **Natural Keyboard Strokes**: Types text with randomized per-character cadence (10–35ms) and executes complex keyboard shortcuts (`cmd+shift+p`, `cmd+s`, etc.).

---

## 🎨 Native Blender 3D Bridge & GUI Launcher (Phase 2)

January communicates directly with `/Applications/Blender.app` (Blender 5.2.2 LTS) to procedurally generate 3D scenes, apply PBR shaders, position studio lighting and cameras, export universal 3D assets, and launch the Blender GUI on screen.

```mermaid
flowchart TD
    Voice["Voice Command:<br/>'January, build a 3D model of a cyber sword in Blender'"] --> Intent{"3D Intent Detection"}
    
    Intent --> Bridge["BlenderBridge (bpy Headless Script Generation)"]
    
    subgraph "Procedural 3D Mesh Synthesis"
        Bridge --> MeshTypes{"Target Preset / Custom"}
        MeshTypes -->|Cyber Sword| Sword["Dual-tone metallic blade, neon edge, carbon hilt, glowing pommel"]
        MeshTypes -->|Coffee Mug| Mug["Hollowed cylinder with solidify modifier, torus handle, beveled lip"]
        MeshTypes -->|Sports Car| Car["Low-poly aerodynamic chassis, tinted cockpit glass, 4 rubber wheels"]
        MeshTypes -->|Minimalist Chair| Chair["Wood seat & backrest, 4 polished steel legs"]
        MeshTypes -->|Porcelain Vase| Vase["Subdivision surface rotational silhouette with ceramic glaze"]
        MeshTypes -->|Torus Sculpture| Knot["Parametric mathematical torus knot with iridescent shader"]
    end

    subgraph "PBR Shading & Studio Lighting"
        Sword & Mug & Car & Chair & Vase & Knot --> Shaders["PBR Principled BSDF Shaders<br/>(Metallic, Roughness, Specular, Neon Emission)"]
        Shaders --> Lights["3-Point Studio Lighting<br/>(Key Sun Light + Rim Point Light + Fill)"]
        Lights --> Cam["35mm Isometric Presentation Camera"]
    end

    subgraph "Export & Native GUI Launch"
        Cam --> BlendFile["Save .blend Project (server/data/exports/3d/)"]
        Cam --> OBJFile["Export Universal .obj + .mtl Mesh"]
        Cam --> GLBFile["Export Web/Realtime .glb Binary"]
        BlendFile --> OpenBlender["macOS Exec: open -a Blender '<filepath>'"]
        OpenBlender --> FocusApp["WindowManager: Bring Blender to Front & Center"]
    end
```

### 📦 3D Generation Capabilities & Presets
- **Cyberpunk Plasma Swords**: Dual-tone metallic blade, neon plasma emissive edge, carbon fiber crossguard, wrapped hilt, glowing pommel.
- **Ceramic Coffee Mugs**: Solidified cylinder geometry, smooth beveled lip, extruded torus handle, porcelain PBR glaze.
- **Low-Poly Sports Cars**: Aerodynamic chassis, tinted cockpit glass canopy, 4 distinct rubber wheels with silver rims.
- **Modern Minimalist Chairs**: Solid wood seat and backrest with four brushed-steel legs.
- **Porcelain Vases**: Organic curved silhouette with subdivision surface smoothing.
- **Mathematical Torus Knot Sculptures**: Parametric (p=2, q=3) knot with iridescent metallic sheen.
- **Universal Formats**: Every generation automatically writes `.blend` (Blender project), `.obj` + `.mtl` (Universal 3D mesh), and `.glb` (glTF binary).

---

## ✈️ Real-World High-Precision 3D Engineering & Aerodynamic Kernel (Phase 1 & 2)

When asked to model specific real-world machines, aircraft, or industrial designs (e.g. **Boeing 787-9 Dreamliner**, **Lockheed Martin F-22 Raptor**, **Concorde**, **Supermarine Spitfire**, **Cessna 172**), January activates its **Phase 1 Technical Grounding Engine** and **Phase 2 BMesh Aerodynamic Kernel** to produce CAD-grade, mathematically lofted 3D replicas with exact physical dimensions.

```mermaid
flowchart TD
    UserQuery["User Prompt / Voice:<br/>'January, make a 3D model of a Boeing 787-9 Dreamliner in Blender'"] --> IntentCheck{"GeminiService 3D Intent Routing"}

    IntentCheck -->|Precision Request| SpecEngine["TechnicalSpecEngine (Phase 1 Grounding)"]

    subgraph "Phase 1: Technical Grounding"
        SpecEngine --> CuratedDB{"Curated Iconic Catalog?"}
        CuratedDB -->|Match: Boeing 787-9, F-22, Concorde, Spitfire, Cessna| ExactSpec["Load Exact Metric Dimensions, NACA Profile, Engines & Materials"]
        CuratedDB -->|Unknown Subject| WebSearch["DuckDuckGo/Wikipedia Technical Telemetry Scraper"]
        WebSearch --> ExtractSpec["Extract Length, Wingspan, Height & Nacelle Specs"]
        ExactSpec --> NormalizedSpec["Normalized EngineeringSpec Schema"]
        ExtractSpec --> NormalizedSpec
    end

    subgraph "Phase 2: BMesh Precision Lofting Kernel (Blender 5.2.2 LTS)"
        NormalizedSpec --> BMeshEngine["BMeshLoftingEngine (Python Script Synthesizer)"]
        BMeshEngine --> Stations["Fuselage Cross-Section Station Lofting (bmesh Station Skinning)"]
        BMeshEngine --> Airfoils["Aerodynamic Wings (NACA 4-Digit & Supercritical Camber Curves)"]
        BMeshEngine --> AeroParams["Sweep Angle, Dihedral Angle, Washout Twist & Raked Wingtips"]
        BMeshEngine --> Empennage["Vertical Tailfin & Horizontal Stabilizers (Symmetric NACA 0012)"]
        BMeshEngine --> Turbofans["Turbofan Nacelles: Intake Lip, Twisted Blades, Spinner & Chevrons"]
        BMeshEngine --> Cockpit["Cockpit Windscreen Glazing & Passenger Window Belts"]
        BMeshEngine --> PBRShaders["Principled BSDF v2 PBR Shaders (Gloss Enamel, Titanium, Glass, Aluminum)"]
        BMeshEngine --> Studio["Daylight Solar Sun + Ambient Sky Lighting + 50mm Camera Framing"]
    end

    subgraph "Asset Export & Presentation"
        BMeshEngine --> SaveBlend[".blend Project (server/data/exports/3d/)"]
        BMeshEngine --> SaveOBJ[".obj Mesh + .mtl Materials"]
        BMeshEngine --> SaveGLB[".glb Realtime Model"]
        SaveBlend --> LaunchApp["open -a Blender & Bring to Front on macOS"]
    end
```

### 🔬 High-Precision Engineering Capabilities
1. **Mathematical NACA & Supercritical Airfoils**: Calculates exact aerofoil thickness distributions and camber lines:
   $$y_t(x) = 5 \cdot t \cdot c \cdot \left(0.2969\sqrt{\frac{x}{c}} - 0.1260\left(\frac{x}{c}\right) - 0.3516\left(\frac{x}{c}\right)^2 + 0.2843\left(\frac{x}{c}\right)^3 - 0.1015\left(\frac{x}{c}\right)^4\right)$$
2. **Parametric Station Lofting**: Skins fuselage cross-sections in `bmesh` with clean quad topology, calculating outward surface normals without non-manifold geometry.
3. **Aerodynamic Wing Synthesis**: Accounts for spanwise sweep angle ($\Lambda$), dihedral angle ($\Gamma$), geometric washout twist ($\theta$), and raked wingtips or sharklets.
4. **Turbofan Nacelles with Chevron Serrations**: Features intake lips, central spinner cones, arrays of twisted titanium fan blades, and noise-attenuating sawtooth chevrons (such as on the Rolls-Royce Trent 1000 / GEnx).
5. **Photorealistic PBR Materials**: Multi-layer aircraft polyurethane gloss enamel with clearcoat, burnt titanium/inconel jet exhaust, dielectric cockpit glass ($IOR = 1.52$), and polished de-icing aluminum leading edges.

---

## 🌌 Universal 3D Object Synthesis Engine (Arbitrary Natural Language 3D Modeling)

January is not limited to aircraft or architectural floor plans. Through the **Universal 3D Generation Engine** (`Universal3DEngine`), January can construct a detailed, multi-component 3D model of **literally any object** requested in natural language—scientific instruments, drones, musical instruments, cyber weapons, mechanical assemblies, consumer electronics, furniture, or artistic sculptures—directly in Blender 5.2.2 LTS.

```mermaid
flowchart TD
    UserVoice["🗣️ User Prompt / Voice:<br/>'January, build a 3D model of a vintage brass microscope with dual objective lenses'"] --> IntentRouter{"Intent & Routing"}
    
    IntentRouter -->|Aircraft / Aerospace| AeroEngine["BMeshLoftingEngine (Phase 1 & 2)"]
    IntentRouter -->|Architectural Blueprint| BIMEngine["ArchitecturalBridge (BIM Engine)"]
    IntentRouter -->|Any Arbitrary Object| UnivEngine["Universal3DEngine (Master 3D Synthesizer)"]
    
    subgraph "Universal 3D Synthesis Pipeline"
        UnivEngine --> Decomp["Component Assembly Decomposition<br/>(4-8 Sub-meshes: Base, Frame, Stage, Optics, Knobs)"]
        Decomp --> MultiAI{"Multi-Tier AI Synthesizer"}
        MultiAI -->|Tier 1| GeminiFlash["Gemini 2.0 Flash (Blender 5.2.2 Script Synthesizer)"]
        MultiAI -->|Tier 2 / Fallback| QwenCoder["OpenRouter Qwen 2.5 Coder 32B"]
        
        GeminiFlash --> Sanitize["Syntax Sanitizer & Blender 5.2 Patching<br/>(Coat Weight, Transmission Weight, BMesh Geoms)"]
        QwenCoder --> Sanitize
        
        Sanitize --> HeadlessExec["Blender 5.2 Headless Execution<br/>(bpy / bmesh Native Python Worker)"]
        
        HeadlessExec --> ResultCheck{"Generation Success?"}
        ResultCheck -->|Blender Traceback / Error| SelfHeal["🩹 Self-Healing Recovery Loop<br/>(Feed traceback back to AI for dynamic repair)"]
        SelfHeal --> HeadlessExec
        ResultCheck -->|Repeated Failure / Offline| ParametricFallback["🛡️ Guaranteed Parametric Procedural Builder<br/>(Multi-Component Assembly Fallback)"]
        
        ResultCheck -->|Success| ExportAssets["Export .blend, .obj/.mtl, and .glb"]
        ParametricFallback --> ExportAssets
    end
    
    subgraph "Presentation & System Activation"
        ExportAssets --> BlendFile["Saved in server/data/exports/3d/"]
        BlendFile --> OpenGUI["macOS Launch: open -a Blender '<filepath>'"]
        OpenGUI --> WindowFocus["WindowManager: Bring Blender to Front & Center"]
    end
```

### 🛠️ Key Architectural Capabilities
1. **Zero-Restriction Object Modeling**: Accepts arbitrary natural language descriptions without preset constraints (e.g. vintage microscope, surveillance quadcopter drone, Fender electric guitar, espresso machine, robotic arm, cyber katana).
2. **Component Assembly Decomposition**: Dynamically breaks down requested objects into 4–8 distinct realistic sub-meshes and functional components rather than single primitive block-outs.
3. **Blender 5.2.2 LTS Socket Compatibility**: Enforces clean compatibility with Blender 4.0+/5.0+ Principled BSDF shader architecture (`Coat Weight`, `Transmission Weight`, `Emission Color`, `Specular IOR Level`).
4. **Self-Healing Error Recovery**: If Blender's Python runtime encounters any traceback error, January's self-healing loop automatically captures `stdout`/`stderr` and feeds it back to the code model for an immediate corrected patch.
5. **Guaranteed Offline Parametric Fallback**: If network is offline or AI quotas are exhausted, an offline procedural generator creates a proportional, multi-component assembly so model creation *never fails*.
6. **Triple Universal Format Output**: Every generation compiles `.blend` (Blender project), `.obj` + `.mtl` (Universal CAD/3D interchange), and `.glb` (Realtime glTF 2.0 binary).

---

## 🏛️ 2D Architectural Plan & Blueprint to 3D Blender BIM Engine

January can visually inspect any 2D architectural building floor plan, CAD blueprint, or hand-drawn sketch (either held up in front of the camera or from a local file), extract the structural layout, and construct an interactive, fully-furnished 3D architectural model in Blender.

```mermaid
flowchart TD
    Input["👤 Input: Physical Blueprint on Camera OR Local CAD/Image File"] --> PlanAI["Multimodal PlanAnalyzer (Gemini / OpenRouter Vision)"]

    subgraph "1. Structural Topology Extraction"
        PlanAI --> Schema["ArchitecturalBlueprint JSON Schema"]
        Schema --> Dims["Building Footprint (e.g. 14.0m x 10.0m x 3.0m)"]
        Schema --> Rooms["Room Decomposition (Living, Kitchen, Master Bed, Guest Bed, Bath)"]
        Schema --> Walls["Perimeter & Partition Wall Coordinate Segments"]
        Schema --> Openings["Doorways, Panoramic Windows, Sill Heights"]
        Schema --> Finishes["PBR Floor Materials (Hardwood, Marble, Ceramic Tile)"]
    end

    subgraph "2. Procedural BIM Construction (Blender 5.2.2 Engine)"
        Schema --> BIM["ArchitecturalBridge (Blender bpy Script)"]
        BIM --> Foundation["Concrete Foundation Base Slab (15cm)"]
        BIM --> RoomFloors["Room-Specific Flooring Slabs with PBR Shaders"]
        BIM --> WallsExtrude["Extrude 3.0m Perimeter & Partition Walls"]
        BIM --> Cutouts["Boolean/Mesh Openings for Windows & Doors"]
        BIM --> WindowsDoors["Install Glass Panes, Window Frames & Door Leaves"]
        BIM --> Furniture["Place Low-Poly Architectural Block-outs<br/>(Sectional Sofa, Coffee Table, Bed, Kitchen Island)"]
        BIM --> SolarLighting["Solar Daylight Sun + Sky Fill Lighting"]
        BIM --> PresCam["Isometric Architectural Perspective Camera"]
    end

    subgraph "3. Export & Presentation"
        BIM --> SaveBlend[".blend Project (server/data/exports/3d/)"]
        BIM --> SaveOBJ[".obj Mesh + .mtl Materials"]
        BIM --> SaveGLB[".glb Realtime Model"]
        SaveBlend --> LaunchApp["open -a Blender & Bring to Front on macOS"]
    end
```

### 🏗️ Blueprint-to-BIM Workflow
1. **Multimodal Plan Perception**: The `PlanAnalyzer` analyzes blueprint images from the camera or local disk and detects outer walls, partition walls, room categories, doors, and panoramic windows.
2. **Foundation & Flooring**: Creates a concrete base foundation and assigns custom PBR flooring materials per room:
   - **Living Room / Corridors**: Parquet European oak hardwood (`Roughness: 0.35`).
   - **Kitchen & Bathrooms**: Polished ceramic/porcelain tile (`Roughness: 0.15`).
   - **Bedrooms**: Calacatta marble slab (`Roughness: 0.10`).
3. **Wall Extrusion & Cutouts**: Extrudes walls to exact 3.0m ceiling heights and cuts openings for doors and windows.
4. **Architectural Glazing & Doors**: Installs dark metal window frames with transparent dielectric glass and semi-open door leaves.
5. **Interior Furniture Block-outs**: Automatically positions stylized architectural furniture placeholders (sectional sofas, coffee tables, master beds, and kitchen island counters).
6. **Daylight & Presentation**: Configures solar daylight lighting and positions an isometric 35mm camera framing the entire building.
7. **Native macOS Activation**: Saves `.blend`, `.obj`, and `.glb` files and immediately launches Blender on screen.

---

## 👁️ Continuous Ambient Camera Eyes & Adaptive Self-Learning System

January runs a background **Continuous Ambient Visual Cortex** and **Adaptive Self-Learning Memory System** that continuously monitors your desk presence, reads gestures, understands posture and emotions, and continuously evolves its coding and interaction models based on your habits.

```mermaid
flowchart TD
    subgraph Controls ["🎤 & 💬 Camera Wake / Sleep Triggers"]
        CMD_OPEN["🗣️ / 💬 'eyes open' / 'camera open'"] --> STREAM_ON["👁️ Activate 60 FPS Hardware Camera Stream<br/>(camera_snap --stream)"]
        CMD_CLOSE["🗣️ / 💬 'eyes closed' / 'camera closed'"] --> STREAM_OFF["🌙 Shutdown Camera Hardware Process<br/>(Camera LED Off | 0% CPU | Hardware Released)"]
    end

    subgraph EdgeWatch ["⚡ Realtime Zero-Lag Frame Loop (<0.2ms Latency)"]
        STREAM_ON --> TICK["⏱️ Stream Frame Buffer Sync (60 FPS)"]
        TICK --> OPENCV["👤 Local OpenCV Haar-Cascade Face & Motion Detector (<20ms CPU)"]
        OPENCV --> PRESENCE{"Presence Transition?"}
    end

    subgraph StateEvents ["🌟 Proactive Ambient Events"]
        PRESENCE -->|"User Just Arrived (0 ➜ 1 Face)"| ARRIVAL["🚀 User Arrival Event<br/>(Desk presence recognized)"]
        PRESENCE -->|"User Stepped Away (1 ➜ 0 Faces)"| DEPART["👋 User Departure Event<br/>(Away state logged)"]
        PRESENCE -->|"User Still Present (>30s Cadence)"| PERIODIC["🧠 Ambient Periodic Multimodal Check"]
    end

    subgraph Cortex ["🧠 Multimodal Visual Reasoning & Gesture Cortex"]
        ARRIVAL --> GEMINI_VISION["✨ Gemini Multimodal Vision<br/>(Inspects posture, activity, expression, wave gestures)"]
        PERIODIC --> GEMINI_VISION
        GEMINI_VISION --> GESTURE{"Waving Gesture Detected?"}
        GESTURE -->|"Yes"| WAVE_ACK["👋 Proactive Spoken Wave Acknowledgment"]
        GESTURE -->|"No"| UPDATE_CTX["📊 Update Visual Context State"]
        ARRIVAL --> COOLDOWN{"Arrival Cooldown Elapsed (>8 min) & Not Sleeping?"}
        COOLDOWN -->|"Yes"| PROACTIVE_GREET["🗣️ Proactive Spoken Greeting<br/>('Good afternoon, Ashwin! Good to see you back. What are we building today?')"]
        COOLDOWN -->|"Cooldown Active"| KEEP_SILENT["🤫 Silent Presence Sync"]
    end

    subgraph MemoryEngine ["🧠 Continuous Adaptive Self-Learning System"]
        INTERACTION["💬 User Interaction<br/>(Voice, Coding, System Commands, Camera Inquiries)"]
        INTERACTION --> LOG["📝 Append Interaction to server/data/memory/interactions.jsonl"]
        LOG --> ADAPT["🔄 Incremental Memory Adaptation<br/>- Preferred Coding Languages (C++, Python, C)<br/>- Preferred Spoken Languages (English, Hindi, Marathi)<br/>- Daily Work Rhythms (Hourly Activity Distribution)<br/>- Learned Coding Style Preferences"]
        ADAPT --> STORE["💾 Local Profile Storage: server/data/memory/learned_profile.json"]
        STORE --> INJECT["💉 Dynamic System Prompt Injection into Gemini<br/>(All future coding outputs and replies automatically personalize)"]
    end

    UPDATE_CTX --> INJECT
    PROACTIVE_GREET --> INJECT
```

### 🎯 Key Visual & Memory Innovations
1. **60 FPS Hardware Streaming & Camera Wake Words**:
   - The camera remains **OFF by default** until commanded with the wake word **"eyes open"**.
   - Spawning the native `AVCaptureVideoDataOutput` stream delivers 60 FPS video capture with **<0.2ms zero-lag frame retrieval**.
   - Saying or typing **"eyes closed"** immediately terminates the process and releases camera hardware (camera LED off, 0% CPU).
2. **Two-Tier Smart Sampling**:
   - Local OpenCV face and motion detection runs on native Mac CPU at high frequency (<20ms CPU, 0 cloud bandwidth).
   - Rich multimodal cloud inspection is invoked strictly upon state transitions (such as user desk arrival) or at a gentle ambient cadence.
3. **Proactive Arrival & Gesture Attunement**:
   - Detects when you sit down at your desk and offers a contextual greeting (*"Good morning, Ashwin! Good to see you back. What are we building today?"*).
   - Guarded by an **8-minute cooldown** to avoid repetitive spam, and stays silent during sleep mode.
   - Waving at the webcam triggers friendly recognition (*"Hey Ashwin, I saw you wave! What can I help you with?"*).
4. **Adaptive Self-Learning Memory**:
   - Stores learned preferences in [`server/data/memory/learned_profile.json`](file:///Users/ashwintelangstark/Desktop/dot.files/PVT.PROJECTS/JANUARY/january-ai/server/data/memory/learned_profile.json) and [`interactions.jsonl`](file:///Users/ashwintelangstark/Desktop/dot.files/PVT.PROJECTS/JANUARY/january-ai/server/data/memory/interactions.jsonl).
   - Tracks preferred coding languages (modern C++20, Python 3.10+, C), natural communication dialects, and hourly activity rhythms.
   - Automatically injects learned context into Gemini's system prompts.

---

## 🖥️ macOS System Control Engine

January has deep macOS integration to launch applications, search and play video files, open documents and spreadsheets, explore Finder directories, and preview file contents.

```mermaid
flowchart TD
    CMD["👤 User Voice / CLI Command<br/>('Open VS Code', 'Launch Safari', 'Play demo.mp4',<br/>'Open resume.pdf', 'Show Downloads folder', 'VS Code खोलो')"] --> PARSE{"Intent & Resource Classifier"}

    PARSE -->|"IDE / Software"| APP_LOOKUP{"Known App & Alias Dictionary"}
    PARSE -->|"Video / Movie"| SPOT_VID["🎬 Spotlight Video Search<br/>(mdfind public.movie / *.mp4 / *.mov / *.mkv)"]
    PARSE -->|"Document / File"| SPOT_DOC["📄 Spotlight Document Search<br/>(mdfind public.document / *.pdf / *.docx / *.txt)"]
    PARSE -->|"Folder / Directory"| FOLDER_LOOKUP["📁 System Path Resolver<br/>(~/Downloads, ~/Desktop, ~/Documents, ~/Movies)"]

    APP_LOOKUP -->|"Known Match"| EXEC_APP["🚀 /usr/bin/open -a '<App>'"]
    APP_LOOKUP -->|"Custom App"| SPOT_APP["🔍 Spotlight Application Finder"]
    SPOT_APP --> EXEC_APP

    SPOT_VID --> PLAY_VID["🎥 Launch Default Video Player / VLC"]
    SPOT_DOC --> OPEN_DOC["📖 Open in Default App / Preview"]
    FOLDER_LOOKUP --> OPEN_FOLDER["📂 Open in macOS Finder"]

    EXEC_APP & PLAY_VID & OPEN_DOC & OPEN_FOLDER --> CONFIRM["🗣️ Speaker Audio & Terminal Confirmation"]
```

### 🎯 Supported System Actions & Examples

| Category | Examples & Supported Targets | Voice / Text Command Examples |
| :--- | :--- | :--- |
| **IDEs & Editors** | VS Code, Cursor, Antigravity IDE, Xcode, PyCharm, IntelliJ IDEA, WebStorm, Android Studio, Sublime Text, CLion, Zed, Neovim | *"Open VS Code"*, *"Launch Cursor"*, *"Start Xcode"*, *"VS Code खोलो"* |
| **Softwares & Apps** | Safari, Chrome, Brave, Arc, Firefox, Slack, Discord, WhatsApp, Spotify, VLC, Zoom, Teams, Docker, Postman, Notes, Calculator, Blender | *"Open Spotify"*, *"Launch Docker Desktop"*, *"Open Calculator"*, *"Safari ओपन करा"* |
| **Videos & Movies** | `.mp4`, `.mov`, `.mkv`, `.avi`, `.webm` across whole disk | *"Play my project demo video"*, *"Open vacation.mp4"*, *"video चलाओ"* |
| **Documents & Files** | `.pdf`, `.docx`, `.xlsx`, `.pptx`, `.txt`, `.md`, `.json`, `.csv` | *"Open resume.pdf"*, *"Show report.docx"*, *"Open document"* |
| **Folders & Directories**| `Downloads`, `Desktop`, `Documents`, `Movies`, `Pictures`, `Music`, custom project folders | *"Open Downloads folder"*, *"Show Desktop"*, *"Downloads फोल्डर उघडा"* |
| **System File Search** | Spotlight fast index search across entire Mac storage | *"Find all mp4 files on my Mac"*, *"Search for presentation PDF"* |
| **Read File Contents** | Direct terminal file preview without opening external windows | *"Read notes.txt"*, *"Show contents of package.json"* |

---

## 💻 Python, C & C++ Coding Engine

```mermaid
flowchart TD
    A["👤 User Code Request<br/>('write a quicksort in python', 'code a thread-safe queue in c++')"] --> B{"Language Detection Regex & Lexical Parser"}
    
    B -->|"Python"| LP["🐍 Python Target (Python 3.10+, Type Hints, Docstrings, Main Block)"]
    B -->|"C"| LC["⚙️ C Target (C99/C11, Standard Headers, Malloc/Free, gcc main.c)"]
    B -->|"C++"| LCPP["🚀 C++ Target (C++17/20, STL, RAII, Smart Pointers, g++ main.cpp)"]

    LP --> T1
    LC --> T1
    LCPP --> T1

    subgraph Pipeline ["⚡ Multi-Tier Coding Pipeline"]
        T1{"Tier 1: Anthropic Claude API<br/>(claude-3-7-sonnet)"}
        T2{"Tier 2: Google Gemini API<br/>(gemini-3.6-flash / 3.5-flash-lite)"}
        T3{"Tier 3: Dynamic Coding Models<br/>(qwen/qwen-2.5-coder-32b-instruct)"}
    end

    T1 -->|"Key Valid & Online"| RES["✨ Formatted Code Box + Compilation Command + Verbal Summary"]
    T1 -->|"Unavailable / Quota"| T2
    T2 -->|"Primary High-Speed Inference"| RES
    T2 -->|"Offline Fallback"| T3
    T3 --> RES

    RES --> OUT1["🖥️ Terminal / Web Output: Syntax-Highlighted Code Box + Run Command"]
    RES --> OUT2["🗣️ Speaker Audio Output: 1-Sentence Verbal Confirmation (Never recites raw code)"]
```

---

## 🎭 Local Emotion Engine & ElevenLabs Realistic Voice Attunement

January features a **100% real-time local Emotion Engine** running in under 1ms on your Mac. It analyzes conversational valence, arousal, and intent to dynamically attune January's responses, visual glow auras, and vocal synthesis parameters across **7 Emotional Archetypes**.

### 🎙️ ElevenLabs Ultra-Realistic Neural Voice Modulation
When ElevenLabs is enabled, January directly modulates the neural voice parameters (`stability`, `similarity_boost`, `style`, `use_speaker_boost`) in real-time per utterance using high-performance streaming with `optimize_streaming_latency=3` (<300ms Time-to-First-Audio):

| Emotion Archetype | Tone & Psychological Context | Stability | Style Exaggeration | Similarity Boost | Visual Glow Aura |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Joy** | Upbeat, celebrating wins, lively dynamic range | `0.35` | `0.45` | `0.82` | Golden Amber (`#F59E0B`) |
| **Curious** | Inquisitive, exploratory, investigative cadence | `0.45` | `0.30` | `0.85` | Neon Cyan (`#00F5FF`) |
| **Empathetic** | Warm, supportive, comforting, gentle reassurance | `0.58` | `0.35` | `0.88` | Mint Emerald (`#10B981`) |
| **Focused** | Analytical, precise, articulate technical execution | `0.68` | `0.15` | `0.85` | Electric Violet (`#8B5CF6`) |
| **Calm / Sleep** | Soothing, relaxed, peaceful, bedtime standby | `0.75` | `0.10` | `0.85` | Deep Indigo (`#6366F1`) |
| **Concerned** | Alert, cautious, debugging errors, serious tone | `0.40` | `0.35` | `0.80` | Coral Red (`#EF4444`) |
| **Neutral** | Balanced, conversational naturalism | `0.50` | `0.20` | `0.85` | Crystal White (`#E2E8F0`) |

### 🛡️ Multi-Tier Resilient Voice Fallback
1. **Tier 1 (ElevenLabs High-Fidelity Neural)**: Synthesizes ultra-realistic voice (`2zRM7PkgwBPiau2jvVXc` - Monika Sogam / `EXAVITQu4vr4xnSDxMaL` - Sarah) modulated by active emotion.
2. **Tier 2 (Microsoft Edge-TTS)**: Seamless fallback for 15+ Indian regional languages and offline operation with prosody pitch and rate shifting.
3. **Tier 3 (macOS Native Say)**: Low-latency local fallback (`Samantha` / `Lekha`) ensuring voice output is never blocked.

---

## 🇮🇳 Multilingual Indian Language Routing & Session Locking

January speaks and understands **English** and **15 major Indian languages** natively with authentic regional pronunciation, grammar, and official script:

```mermaid
flowchart TD
    TEXT["Incoming Text Response"] --> SCRIPT{"Unicode Script & Lexical Classifier"}
    
    SCRIPT -->|"\u0900-\u097F"| DEV["Devanagari Analyzer"]
    SCRIPT -->|"\u0980-\u09FF"| BEN["Bengali / Assamese (\u0980-\u09FF)"]
    SCRIPT -->|"\u0A80-\u0AFF"| GUJ["Gujarati (\u0A80-\u0AFF)"]
    SCRIPT -->|"\u0A00-\u0A7F"| PUN["Gurmukhi / Punjabi (\u0A00-\u0A7F)"]
    SCRIPT -->|"\u0B00-\u0B7F"| ODI["Odia (\u0B00-\u0B7F)"]
    SCRIPT -->|"\u0600-\u06FF"| ARB["Perso-Arabic (\u0600-\u06FF)"]
    SCRIPT -->|"Latin / English"| ENG["English (en-US / en-IN)"]

    DEV -->|"Marathi (आहे / मला)"| V_MR["Voice: mr-IN-AarohiNeural"]
    DEV -->|"Nepali (छ / हुन्छ)"| V_NE["Voice: ne-NP-HemkalaNeural"]
    DEV -->|"Sanskrit (अस्ति / नमः)"| V_SA["Voice: hi-IN-SwaraNeural"]
    DEV -->|"Hindi (है / करता)"| V_HI["Voice: hi-IN-SwaraNeural"]

    BEN --> V_BN["Voice: bn-IN-TanishaaNeural"]
    GUJ --> V_GU["Voice: gu-IN-DhwaniNeural"]
    PUN --> V_PA["Voice: hi-IN-SwaraNeural"]
    ODI --> V_OR["Voice: hi-IN-SwaraNeural"]
    ARB -->|"Urdu / Kashmiri / Sindhi"| V_UR["Voice: ur-IN-GulNeural"]
    ENG --> V_EN["Voice: en-US-AriaNeural"]

    V_MR & V_NE & V_SA & V_HI & V_BN & V_GU & V_PA & V_OR & V_UR & V_EN --> MOD["🎭 Apply Emotional Prosody (Pitch & Rate)"]
    MOD --> SYNTH["🗣️ Microsoft Edge-TTS Synthesis"]
    SYNTH --> PLAY["🔊 Output via macOS /usr/bin/afplay"]
```

### 🔒 Persistent Session Language & Phonetic Transliteration
1. **Multi-Turn Language Locking**: Spoken or typed requests to speak in a language (e.g. *"Speak in Hindi"*, *"मराठीत बोला"*) lock January into that language across all future turns until commanded otherwise (*"Switch to English"*).
2. **Phonetic / Romanized Decoding**: Romanized phonetic input (e.g. *"mudje dekho"*, *"aap kaun ho"*, *"kasa ahes"*) is automatically interpreted into authentic native script (हिंदी / मराठी) with regional voice inflections.

| Language | Script | Native Neural Voice (Edge-TTS) | Regional Tone & Phonetic Interpretation |
| :--- | :--- | :--- | :--- |
| **Hindi** (हिंदी) | Devanagari | `hi-IN-SwaraNeural` / `hi-IN-MadhurNeural` | Conversational Hindi & Hinglish ("mudje dekho" ➜ "मुझे देखो") |
| **Marathi** (मराठी) | Devanagari | `mr-IN-AarohiNeural` / `mr-IN-ManoharNeural` | Fluent native Marathi ("kasa ahes" ➜ "कसा आहेस") |
| **Bengali** (বাংলা) | Bengali | `bn-IN-TanishaaNeural` / `bn-IN-BashkarNeural` | Expressive Bengali ("kemon acho" ➜ "কেমন আছো") |
| **Gujarati** (ગુજરાતી) | Gujarati | `gu-IN-DhwaniNeural` / `gu-IN-NiranjanNeural` | Fluent Gujarati ("kem cho" ➜ "કેમ છો") |
| **Kannada** (ಕನ್ನಡ) | Kannada | `kn-IN-SapnaNeural` | Native Kannada ("hegiddira" ➜ "ಹೇಗಿದ್ದೀರಾ") |
| **Tamil** (தமிழ்) | Tamil | `ta-IN-PallaviNeural` | Fluent Tamil ("eppadi irukkinga" ➜ "எப்படி இருக்கிறீர்கள்") |
| **Telugu** (తెలుగు) | Telugu | `te-IN-ShrutiNeural` | Native Telugu ("ela unnaru" ➜ "ఎలా ఉన్నారు") |
| **Malayalam** (മലയാളം) | Malayalam | `ml-IN-SobhanaNeural` | Expressive Malayalam ("engane und" ➜ "എങ്ങനെയുണ്ട്") |
| **Punjabi** (ਪੰਜਾਬੀ) | Gurmukhi | `hi-IN-SwaraNeural` / `pa-IN` | Authentic Punjabi ("ki haal" ➜ "ਕੀ ਹಾಲ ਹੈ") |
| **Odia** (ଓଡ଼ିଆ) | Odia | `hi-IN-SwaraNeural` / `or-IN` | Odia regional pronunciation ("kemiti achhanti" ➜ "କେମିତି ଅଛନ୍ତି") |
| **Assamese** (অসমীয়া) | Assamese | `bn-IN-TanishaaNeural` | Northeastern Assamese inflection |
| **Maithili** (मैथिली) | Devanagari | `hi-IN-SwaraNeural` | Bihari Maithili cadence |
| **Kashmiri** (کٲشُر) | Perso-Arabic / Dev | `ur-IN-GulNeural` / `hi-IN-SwaraNeural` | Kashmiri phrasing & vocabulary |
| **Konkani** (कोंकणी) | Devanagari | `mr-IN-AarohiNeural` | Coastal Goan / Konkan cadence |
| **Dogri** (डोगरी) | Devanagari | `hi-IN-MadhurNeural` | Jammu Dogri inflection |
| **Sindhi** (سنڌي) | Perso-Arabic / Dev | `ur-IN-SalmanNeural` | Traditional Sindhi cadence |
| **Urdu** (اردو) | Perso-Arabic | `ur-IN-GulNeural` / `ur-IN-SalmanNeural` | Poetic and polite Urdu adab |
| **Sanskrit** (संस्कृतम्) | Devanagari | `hi-IN-SwaraNeural` | Classical Sanskrit metrics |
| **Nepali** (नेपाली) | Devanagari | `ne-NP-HemkalaNeural` / `ne-NP-SagarNeural` | Fluent Nepali |
| **English** | Latin | `en-US-AriaNeural` / `en-IN-NeerjaExpressiveNeural` | Dynamic English |

---

## 🔄 End-to-End Voice Lifecycle & Reverb Guard

```mermaid
sequenceDiagram
    autonumber
    actor User as 👤 User (Room / Hardware)
    participant Mic as 🎙️ System Mic & Whisper
    participant Daemon as ⚡ January Core Daemon
    participant Emotion as 🎭 Emotion Engine
    participant Router as 🌐 Dynamic Model Router
    participant TTS as 🗣️ Edge-TTS Neural Engine
    participant Speaker as 🔊 MacBook Speakers

    User->>Mic: Speaks: "Rise, whats the weather in Hubli?"
    Mic->>Daemon: Transcribes text ("Rise, whats the weather in Hubli?")
    Daemon->>Daemon: Detects "Rise" -> Transitions to [WORKING]
    
    par Parallel Analysis
        Daemon->>Emotion: Analyze User Sentiment / Emotion
        Emotion-->>Daemon: Detected: "Curious" (Pitch: +2Hz, Rate: +2%)
    and Model Selection
        Daemon->>Router: Resolve optimal AI Model for task
        Router-->>Daemon: Selected: Gemini 3.6 Flash / OpenRouter
    end

    Daemon->>Router: Dispatch prompt + context + emotion guidance
    Router-->>Daemon: Spoken Response: "It's currently an overcast 20°C in Hubli..."
    
    Daemon->>Mic: 🔕 Mute Physical Mic (Echo Cancellation)
    Daemon->>TTS: Synthesize Speech (Voice: en-US / hi-IN, Pitch: +2Hz, Rate: +2%)
    TTS-->>Speaker: Play audio via /usr/bin/afplay
    Speaker-->>User: 🔊 Speaks out loud in the room
    
    Speaker->>Daemon: Playback finished
    Daemon->>Mic: 🔔 Unmute Physical Mic (+1.2s Reverb Guard Cooldown)
    Daemon->>Daemon: Transition to [PASSIVE] standby
```

---

## 💻 Terminal CLI & Background Daemon Auto-Switching Flow

```mermaid
flowchart TD
    DAEMON["⚡ Background Daemon Active (npm run dev)<br/>🎙️ Hardware Mic ACTIVE & Listening in room"] 
    USER_START["👤 User runs 'npm run cli'"] --> ATTACH["🔌 CLI connects via WebSocket / REST<br/>Sends 'cli_attach' Handshake"]
    
    ATTACH --> PAUSE["🔕 DAEMON AUTOMATICALLY PAUSES BACKGROUND MIC<br/>(Prevents double-hearing, echo, and voice loops)"]
    PAUSE --> CLI_SESSION["💻 Interactive Dual Terminal CLI Ready<br/>[ME] ➜ User types prompts, questions, or code<br/>[JANUARY] ➜ Real-time ANSI responses + Speaker Audio"]
    
    CLI_SESSION --> USER_EXIT["👤 User exits CLI ('exit', 'quit', or Ctrl+C)"]
    USER_EXIT --> DETACH["🔌 CLI sends 'cli_detach' signal"]
    DETACH --> RESUME["🔔 DAEMON AUTOMATICALLY RESUMES BACKGROUND MIC<br/>(January seamlessly returns to room voice listening)"]
    RESUME --> DAEMON
```

---

## 🛠️ Complete Tech Stack

| Subsystem | Technology | Purpose |
| :--- | :--- | :--- |
| **Runtime & Backend** | Node.js 22+, TypeScript, Express, `ws` (WebSockets) | Core state coordination, process daemon, and IPC routing |
| **AI Model Router** | OpenRouter / OmniRoute API (`458+ models`), Fuzzy Matcher | Dynamic task-based auto-routing & natural language model switching |
| **3D & BIM Engine** | Blender 5.2.2 LTS (`bpy` procedural scripting), macOS `open -a Blender` | Procedural 3D mesh synthesis, PBR shaders, 2D blueprint to 3D BIM conversion |
| **Computer-Using Agent** | `SafetyInterlock`, `cliclick` native binary, AppleScript | OS cursor Bezier navigation, mouse clicks, keyboard chords, window management |
| **Architectural Vision** | `PlanAnalyzer` + Multimodal Gemini / OpenRouter Vision | Structural decomposition of 2D floor plans into normalized JSON BIM schemas |
| **Continuous Ambient Cortex**| `VisualActivityMonitor` (Two-tier sampling: 4s edge + 45s cloud) | Real-time presence, arrival greetings, wave gesture recognition, posture tracking |
| **Self-Learning Memory** | `LearnedProfileEngine` + Local JSON/JSONL Storage | Dynamic profile adaptation for C++/Python/C preferences, spoken languages, and work habits |
| **Camera Hardware Stream** | macOS `AVFoundation` (Swift Binary) + OpenCV Haar Cascade | 60 FPS zero-lag hardware camera stream & sub-20ms local face detection |
| **Speech-to-Text** | Faster-Whisper (`tiny` multilingual model), `sounddevice` | Zero-latency local microphone listening & transcription |
| **Neural Voice Synthesis** | Microsoft Edge-TTS, macOS Native `/usr/bin/afplay` | Free high-fidelity neural voice synthesis with emotional prosody |
| **Emotion Engine** | Python 3.11+, Valence-Arousal NLP Classifier | Real-time emotion classification across 7 archetypes |
| **Real-Time Web & Weather**| DuckDuckGo Instant API, Wikipedia API, `wttr.in` | Real-time web knowledge and global live weather |
| **System Resource Search** | Native macOS Spotlight `mdfind` + AppleScript + `open` | Instant file, folder, movie, video, and app opening |

---

## 📂 Project Structure

```
january-ai/
├── package.json                   # Root build & execution scripts
├── README.md                      # Comprehensive system documentation
├── openrouter_models.csv          # Complete catalog export of 458+ AI models
├── .gitignore                     # Git filter rules
├── server/
│   ├── .env                       # API keys & configuration
│   ├── .env.example               # Template environment configuration
│   ├── package.json               # Server dependencies & scripts
│   ├── tsconfig.json              # TypeScript compiler configuration
│   ├── data/                      # Local data & persistence
│   │   ├── captures/              # Local camera frame cache (latest.jpg auto-overwritten)
│   │   ├── faces/                 # Enrolled user identity profiles (profile.json)
│   │   ├── memory/                # Self-learning memory (learned_profile.json, interactions.jsonl)
│   │   ├── models/                # AI model catalog cache (catalog.json)
│   │   └── exports/3d/            # Generated .blend, .obj, .glb 3D files & BIM scenes
│   ├── camera_engine/             # Native vision & face recognition engines
│   │   ├── camera_snap.swift      # Swift AVFoundation 60 FPS camera snapshot & stream tool
│   │   ├── camera_snap            # Compiled native macOS arm64 binary
│   │   └── face_detect.py         # Sub-20ms OpenCV Haar-cascade presence detector
│   ├── audio_engine/              # Local Python audio & emotion engines
│   │   ├── emotion_engine.py      # 100% free local emotion & sentiment classifier
│   │   ├── mic_stt_engine.py      # sounddevice + Faster-Whisper microphone daemon
│   │   └── tts_engine.py          # Edge-TTS multilingual synthesis & voice router
│   └── src/
│       ├── index.ts               # Core daemon coordinator & WebSocket server
│       ├── cli.ts                 # Dual-section interactive Terminal CLI
│       ├── config.ts              # Environment variables validation & defaults
│       ├── types.ts               # State machine, WebSocket & tool type definitions
│       ├── models/                # Dynamic AI Model Router
│       │   ├── modelRegistry.ts   # Live OpenRouter catalog sync & fuzzy search
│       │   └── modelRouter.ts     # Task-based auto-router & session locker
│       ├── cua/                   # Computer-Using Agent Actuation Layer
│       │   ├── safetyInterlock.ts # Emergency halt corner (0,0) & bounds clamp
│       │   ├── mouseController.ts # Humanized quadratic Bezier mouse motion & clicks
│       │   └── keyboardController.ts # Natural typing & keyboard shortcut chords
│       ├── gui/                   # macOS Window Management
│       │   └── windowManager.ts   # AppleScript window focus, bounds, and placement
│       ├── blender/               # Blender 3D, Precision Engineering & BIM Bridges
│       │   ├── blenderBridge.ts   # Procedural 3D model generator & Blender GUI launcher
│       │   ├── architecturalBridge.ts # 2D Blueprint to 3D BIM procedural builder
│       │   └── advanced/          # High-Precision Real-World & Universal 3D Engine
│       │       ├── technicalSpecEngine.ts # Web grounding & dimensional telemetry scraper
│       │       ├── bmeshLoftingEngine.ts  # Mathematical NACA airfoils & bmesh station skinning
│       │       └── universal3DEngine.ts   # Arbitrary multi-component 3D model generator & Blender 5.2 synthesizer
│       ├── vision/                # Vision Cortex & Blueprint Perception
│       │   ├── activityMonitor.ts # Continuous ambient camera monitor & gesture detector
│       │   ├── cameraService.ts   # Swift camera snapshot invoker & frame cache
│       │   ├── faceEngine.ts      # Face detection manager & profile loader
│       │   └── planAnalyzer.ts    # Multimodal 2D floor plan structural analyzer
│       ├── memory/
│       │   └── learnedProfileEngine.ts # Adaptive self-learning profile engine
│       ├── emotions/
│       │   └── emotionEngine.ts   # Emotional memory & prompt injector
│       ├── audio/
│       │   ├── systemMic.ts       # Python STT process manager
│       │   └── systemSpeaker.ts   # Neural TTS & afplay player
│       ├── wake/
│       │   ├── wakeDetector.ts    # Wake/Sleep phrase lifecycle manager
│       │   └── wakeWordWorker.ts  # Worker thread monitoring audio stream
│       ├── gemini/
│       │   ├── geminiService.ts   # AI Dispatcher with search context, memory & tools
│       │   └── liveClient.ts      # Multimodal Live API client
│       ├── tools/                 # Tool Registry & Function Declarations
│       │   ├── index.ts           # Central tool registry
│       │   ├── architectureTool.ts # 2D blueprint to 3D Blender tool
│       │   ├── manageModel.ts     # Dynamic model switcher tool
│       │   ├── visionTool.ts      # Camera & face analysis tool
│       │   ├── systemAccess.ts    # Spotlight file, video, folder & app opener
│       │   ├── webSearch.ts       # DuckDuckGo, Wikipedia & weather fetcher
│       │   └── delegateCoding.ts  # Python, C & C++ coding engine
│       └── tests/                 # Automated Verification Test Suites
│           ├── test_cua_blender.ts # CUA & Blender 3D test suite (17/17 passed)
│           ├── test_plan_to_3d.ts  # 2D Floor Plan to 3D BIM test suite (14/14 passed)
│           ├── test_precision_3d.ts # High-Precision Real-World 3D Engine (18/18 passed)
│           ├── test_universal_3d.ts # Universal arbitrary 3D model test suite (9/9 passed)
│           ├── test_speech_path_sanitization.ts # Speech Path Sanitization test suite (13/13 passed)
│           └── test_gemini_3d_intent.ts # Conversational intent test suite
```

---

## ⚡ Natural Language Command Master Reference

| Intent / Category | Spoken or Typed Command | System Action |
| :--- | :--- | :--- |
| **Model Switching** | *"Switch model to DeepSeek R1"* | Locks active model to DeepSeek R1 across all queries |
| **Model Switching** | *"Switch model to Liquid"* | Locks active model to zero-cost LiquidAI |
| **Model Switching** | *"Switch model to Qwen Coder"* | Locks active model to Qwen 2.5 Coder 32B |
| **Model Status** | *"What model are you using?"* | Displays active model, token limit, and pricing status |
| **Model Catalog** | *"List free models"* | Queries and lists top 22 zero-cost models |
| **Model Reset** | *"Reset model"* | Restores automatic dynamic model cascade routing |
| **3D Modeling** | *"Make a 3D model of a cyber sword in Blender"* | Generates procedural sword, PBR shaders, studio lights, exports `.blend`, and launches Blender GUI |
| **3D Modeling** | *"Build a 3D model of a sports car in Blender"* | Generates aerodynamic car chassis, wheels, canopy, and opens Blender |
| **3D Modeling** | *"Create a 3D coffee mug in Blender"* | Generates beveled ceramic coffee mug and opens Blender |
| **Precision 3D Engineering** | *"Make a 3D model of a Boeing 787-9 Dreamliner in Blender"* | Grounds engineering dimensions (62.8m length, 60.1m wingspan), lofts supercritical wings with raked tips, builds Rolls-Royce Trent 1000 turbofans with chevrons, and opens Blender |
| **Precision 3D Engineering** | *"Build an exact 3D model of an F-22 Raptor in Blender"* | Grounds stealth diamond-delta wings, twin canted rudders (28°), faceted chine fuselage, and opens Blender |
| **Precision 3D Engineering** | *"Create a 3D model of Concorde in Blender"* | Grounds ogival gothic delta wings, droop nose visor, 4 Olympus turbojets, and opens Blender |
| **2D Plan to 3D BIM** | *"Look at this building plan and convert it into 3D in Blender"* | Analyzes blueprint from webcam, builds foundation, PBR floors, 3m walls, openings, furniture, and opens Blender |
| **2D Plan to 3D BIM** | *"Convert floorplan modern_villa.png to 3D architectural model"* | Reads local file, extracts structural BIM topology, and constructs 3D building |
| **Universal 3D Modeling** | *"Make a 3D model of a vintage brass microscope in Blender"* | Decomposes microscope into base, pillar, stage, dual objective lenses, and glass eyepiece with brass PBR shader and opens Blender |
| **Universal 3D Modeling** | *"Build a 3D model of a surveillance quadcopter drone in Blender"* | Generates drone airframe, 4 motor arms, carbon propellers, gimbal camera, and opens Blender |
| **Universal 3D Modeling** | *"Create a 3D model of an electric guitar in Blender"* | Generates contoured body, neck, fretboard, pickups, bridge, and volume knobs and opens Blender |
| **CUA Actuation** | *"Move mouse to 500, 300 and click"* | Moves cursor with quadratic Bezier smoothing and executes left click |
| **CUA Keyboard** | *"Type 'Hello World' and press return"* | Types characters with natural delay and presses Return |
| **Camera Eyes** | *"Eyes open"* / *"Camera open"* | Starts 60 FPS AVFoundation hardware stream |
| **Camera Eyes** | *"Eyes closed"* / *"Camera closed"* | Stops camera process (Camera LED off, 0% CPU) |
| **Visual Query** | *"What do you see?"* / *"Look at what I'm holding"* | Captures 1080p frame and performs multimodal Gemini visual reasoning |
| **Face Recognition** | *"Who am I?"* | Recognizes face locally (<20ms) and checks enrolled profile |
| **System Apps** | *"Open VS Code"*, *"Launch Safari"*, *"Start Cursor"* | Launches applications and brings window to foreground |
| **Media Playback** | *"Play my project demo video"* | Searches whole disk via Spotlight and opens video in default player |
| **File Opening** | *"Open resume.pdf"*, *"Show report.docx"* | Locates document and opens in Preview / default editor |
| **Folder Explorer** | *"Open Downloads folder"*, *"Show Desktop"* | Opens requested path in macOS Finder |
| **Coding Engine** | *"Write a quicksort in Python with type hints"* | Generates clean Python 3.10+ code box with run instructions |
| **Coding Engine** | *"Code a thread-safe queue in modern C++"* | Generates modern C++20 code with STL, RAII, and `g++` command |
| **Coding Engine** | *"Write a linked list with malloc in C"* | Generates clean C99/C11 code with standard headers and `gcc` command |
| **Live Weather** | *"What is the weather in Hubli?"* | Queries live weather and speaks temperature, conditions, wind |
| **Live Web Search** | *"Who won the latest cricket match?"* | Searches live internet via DuckDuckGo and provides spoken summary |
| **Language Lock** | *"Speak in Hindi"*, *"मराठीत बोला"* | Locks conversation to Indian language with native script and voice |
| **Language Reset** | *"Switch to English"* | Restores English conversational mode |
| **Sleep / Wake** | *"Good night"* / *"Rise"* | Transitions between silent sleep standby and active listening |

---

## 🚀 Getting Started

### 1. Prerequisites
- **macOS** (Apple Silicon M1/M2/M3/M4 or Intel Mac)
- **Node.js 20+** (`node -v`)
- **Python 3.11+** (`python3 --version`)
- **Blender 4.0+ / 5.0+** installed in `/Applications/Blender.app`
- **cliclick** (for CUA mouse/keyboard actuation):
  ```bash
  brew install cliclick
  ```
- **uv package manager**:
  ```bash
  curl -LsSf https://astral.sh/uv/install.sh | sh
  ```

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/ashwintelangstark/january.systems.git
cd january-ai

# Install root & server dependencies and compile TypeScript
npm install
npm run build
```

### 3. Configure Environment (`server/.env`)
Create `server/.env` based on `server/.env.example`:
```env
PORT=3001
HOST=localhost

# Google Gemini API Keys (Tier 1 & Tier 2 Fallback)
GEMINI_API="YOUR_GEMINI_API_KEY"
GEMINI_API_FALLBACK="YOUR_FALLBACK_GEMINI_KEY"
GEMINI_MODEL=models/gemini-3.6-flash
GEMINI_VOICE=Aoede

# ElevenLabs Realistic Neural Voice & Emotion Engine
ELEVENLABS_API_KEY="YOUR_ELEVENLABS_API_KEY"
ELEVENLABS_VOICE_ID="2zRM7PkgwBPiau2jvVXc"
ELEVENLABS_MODEL_ID=eleven_turbo_v2_5
USE_ELEVENLABS=true

# OpenRouter / OmniRoute API Key (Tier 3 Dynamic Model Router across 458+ models)
OPENROUTER_API_KEY="YOUR_OPENROUTER_API_KEY"

# Anthropic Claude API Key (Optional - Automatically falls back to Gemini)
CLAUDE_CODE_API="YOUR_CLAUDE_API_KEY"
CLAUDE_MODEL=claude-3-7-sonnet-20250219

# System Wake & Sleep Phrases
WAKE_PHRASE=rise
SLEEP_PHRASE="good night"

# Camera Eyes Wake & Sleep Phrases (60 FPS Continuous Hardware Stream)
CAMERA_WAKE_PHRASE="eyes open"
CAMERA_SLEEP_PHRASE="eyes closed"
```

---

## 🏃 Running January

### 1. Start the Background Daemon
```bash
npm run dev
```
> *January starts headlessly in the background, listening to your microphone in the room and vocalizing responses through your laptop speakers.*

### 2. Start the Interactive Terminal CLI
```bash
npm run cli
```
> *Opens the dual-section CLI (`[ME]` & `[JANUARY]`). Automatically pauses the background microphone while you interact and resumes background listening upon exit.*

---

## 🧪 Verification & Test Suites

Run the integrated verification test suites to validate all subsystems:

```bash
# Test 1: Computer-Using Agent (CUA) & Blender 3D Engine (17/17 Passed)
npx tsx server/src/tests/test_cua_blender.ts

# Test 2: 2D Building Plan & Blueprint to 3D Blender BIM Engine (14/14 Passed)
npx tsx server/src/tests/test_plan_to_3d.ts

# Test 3: Conversational 3D Intent Routing
npx tsx server/src/tests/test_gemini_3d_intent.ts

# Test 4: Real-World Precision 3D Engine & Aerodynamic Kernel (18/18 Passed)
npx tsx server/src/tests/test_precision_3d.ts

# Test 5: Universal 3D Object Synthesis Engine (9/9 Passed)
npx tsx server/src/tests/test_universal_3d.ts

# Test 6: Speech Path Sanitization (No File Paths Spoken) (13/13 Passed)
npx tsx server/src/tests/test_speech_path_sanitization.ts

# Test 7: ElevenLabs Neural Voice & Emotion Engine Integration (12/12 Passed)
npx tsx server/src/tests/test_elevenlabs_speech.ts
```

---

## 🛑 Stopping January

- **Kill running process in terminal**: Press `Ctrl + C`
- **Kill background port from any terminal**: `npx kill-port 3001`
- **Put to Sleep via Voice**: Say out loud **`"Good night"`**
- **Put to Sleep via CLI**: Type **`good night`**

---

## 📄 License

MIT License © 2026 Ashwin Telang Stark. All Rights Reserved.
