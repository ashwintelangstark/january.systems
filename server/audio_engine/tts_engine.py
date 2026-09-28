#!/usr/bin/env python3
"""
January AI - Ultra-Realistic Neural Female Voice Engine
Powered by Kokoro-82M (af_heart) Realistic Female Voicepack
with Sub-Second Emotion Dynamics and Multi-Tiered System Fallbacks.
"""

import sys
import os
import re
import json
import warnings
import argparse
import tempfile
import uuid

# Suppress PyTorch and HuggingFace deprecation noise & force offline local mode
warnings.filterwarnings("ignore")
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"

# Setup bundled or Homebrew espeak-ng paths for macOS
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
bundled_espeak_lib = os.path.join(CURRENT_DIR, "espeak", "lib", "libespeak-ng.dylib")
bundled_espeak_data = os.path.join(CURRENT_DIR, "espeak", "share", "espeak-ng-data")
brew_lib = "/opt/homebrew/lib/libespeak-ng.dylib"
brew_data = "/opt/homebrew/share/espeak-ng-data"

chosen_lib = None
chosen_data = None
if os.path.exists(bundled_espeak_lib) and os.path.exists(bundled_espeak_data):
    chosen_lib = bundled_espeak_lib
    chosen_data = bundled_espeak_data
elif os.path.exists(brew_lib) and os.path.exists(brew_data):
    chosen_lib = brew_lib
    chosen_data = brew_data

if chosen_lib and chosen_data:
    os.environ["PHONEMIZER_ESPEAK_LIBRARY"] = chosen_lib
    os.environ["PHONEMIZER_ESPEAK_DATA_PATH"] = chosen_data
    try:
        # Patch phonemizer EspeakAPI so sibling dylibs (libpcaudio) are copied alongside libespeak-ng
        import shutil
        import pathlib
        import phonemizer.backend.espeak.api as espeak_api
        orig_init = espeak_api.EspeakAPI.__init__
        def patched_init(self, library, data_path):
            def custom_copy(src, dst, *args, **kwargs):
                shutil.copy2(src, dst, *args, **kwargs)
                parent = pathlib.Path(src).parent
                for sibling in parent.glob("*.dylib"):
                    if sibling.name != pathlib.Path(src).name:
                        shutil.copy2(sibling, pathlib.Path(dst).parent / sibling.name)
            old_copy = espeak_api.shutil.copy
            espeak_api.shutil.copy = custom_copy
            try:
                orig_init(self, library, data_path)
            finally:
                espeak_api.shutil.copy = old_copy
        espeak_api.EspeakAPI.__init__ = patched_init

        from phonemizer.backend.espeak.wrapper import EspeakWrapper
        EspeakWrapper.set_library(chosen_lib)
        EspeakWrapper.set_data_path(chosen_data)
    except Exception as e:
        sys.stderr.write(f"[TTSEngine] Espeak setup warning: {e}\n")

# Emotion to Speed & Prosody Modulation for Kokoro
KOKORO_EMOTION_SPEED = {
    "joy": 1.06,
    "curious": 1.03,
    "focused": 1.02,
    "empathetic": 0.95,
    "concerned": 0.96,
    "calm": 0.92,
    "neutral": 1.00,
}

_KOKORO_PIPELINE = None
_VOICE_CACHE = {}

def get_kokoro_pipeline():
    global _KOKORO_PIPELINE
    if _KOKORO_PIPELINE is None:
        try:
            from kokoro import KPipeline, KModel
            local_weights = os.path.join(CURRENT_DIR, "weights")
            config_file = os.path.join(local_weights, "config.json")
            model_file = os.path.join(local_weights, "kokoro-v1_0.pth")

            if os.path.exists(config_file) and os.path.exists(model_file):
                kmodel = KModel(repo_id="hexgrad/Kokoro-82M", config=config_file, model=model_file)
                _KOKORO_PIPELINE = KPipeline(lang_code="a", model=kmodel, repo_id="hexgrad/Kokoro-82M")
            else:
                _KOKORO_PIPELINE = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")

            # Pre-populate voice cache in pipeline to prevent any external downloads
            v_init = get_voice_pack("af_heart")
            if v_init is not None and hasattr(_KOKORO_PIPELINE, "voices"):
                _KOKORO_PIPELINE.voices["af_heart"] = v_init
        except Exception as e:
            sys.stderr.write(f"[TTSEngine] Kokoro init error: {e}\n")
            sys.stderr.flush()
            _KOKORO_PIPELINE = False
    return _KOKORO_PIPELINE if _KOKORO_PIPELINE else None

def get_voice_pack(voice_name: str = "af_heart"):
    global _VOICE_CACHE
    if voice_name in _VOICE_CACHE:
        return _VOICE_CACHE[voice_name]
    
    local_voice = os.path.join(CURRENT_DIR, "weights", "voices", f"{voice_name}.pt")
    if os.path.exists(local_voice):
        try:
            import torch
            v_tensor = torch.load(local_voice, weights_only=True)
            _VOICE_CACHE[voice_name] = v_tensor
            return v_tensor
        except Exception:
            pass
    return voice_name

def sanitize_text(text: str) -> str:
    if not text:
        return ""
    clean = re.sub(r'```[\s\S]*?```', '', text)
    clean = re.sub(r'`[^`]+`', '', clean)
    clean = re.sub(r'<[^>]+>', '', clean)
    clean = re.sub(r'\[\s*(?:emotion|feeling|mood|tone)\s*:[^\]]+\]', '', clean, flags=re.I)
    clean = re.sub(r'\(\s*(?:emotion|feeling|mood|tone)\s*:[^)]+\)', '', clean, flags=re.I)
    clean = re.sub(r'[#*_~>`]', '', clean)
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean

def synthesize_kokoro(text: str, emotion: str = "neutral", out_path: str = None, voice: str = "af_heart") -> str:
    pipeline = get_kokoro_pipeline()
    if not pipeline:
        return ""

    emo_key = (emotion or "neutral").lower().strip()
    speed = KOKORO_EMOTION_SPEED.get(emo_key, 1.0)
    target_file = out_path or os.path.join(tempfile.gettempdir(), f"january_kokoro_{uuid.uuid4().hex[:8]}.wav")
    if not target_file.endswith('.wav'):
        target_file = target_file.rsplit('.', 1)[0] + '.wav'

    try:
        import soundfile as sf
        import numpy as np

        voice_obj = get_voice_pack(voice)
        generator = pipeline(text, voice=voice_obj, speed=speed, split_pattern=r'\n+')
        audio_segments = []
        for _, _, audio in generator:
            if audio is not None and len(audio) > 0:
                audio_segments.append(audio)

        if not audio_segments:
            return ""

        full_audio = np.concatenate(audio_segments) if len(audio_segments) > 1 else audio_segments[0]
        sf.write(target_file, full_audio, 24000)

        if os.path.exists(target_file) and os.path.getsize(target_file) > 100:
            return target_file
    except Exception as e:
        sys.stderr.write(f"[TTSEngine] Kokoro synthesis error: {e}\n")
        sys.stderr.flush()

    return ""

def synthesize_fallback_edge(text: str, emotion: str = "neutral", out_path: str = None) -> str:
    try:
        import asyncio
        import edge_tts

        is_devanagari = bool(re.search(r'[\u0900-\u097F]', text))
        voice = "hi-IN-SwaraNeural" if is_devanagari else "en-US-AvaNeural"
        rate = "+4%" if emotion == "joy" else "-4%" if emotion in ("calm", "empathetic") else "+0%"

        temp_file = out_path or os.path.join(tempfile.gettempdir(), f"january_edge_{uuid.uuid4().hex[:8]}.mp3")
        if not temp_file.endswith('.mp3'):
            temp_file = temp_file.rsplit('.', 1)[0] + '.mp3'

        async def _run():
            comm = edge_tts.Communicate(text, voice, rate=rate)
            await comm.save(temp_file)

        asyncio.run(_run())
        if os.path.exists(temp_file) and os.path.getsize(temp_file) > 100:
            return temp_file
    except Exception as e:
        sys.stderr.write(f"[TTSEngine] Edge-TTS fallback notice: {e}\n")
        sys.stderr.flush()
    return ""

def synthesize_fallback_macos(text: str, out_path: str = None) -> str:
    try:
        temp_file = out_path or os.path.join(tempfile.gettempdir(), f"january_say_{uuid.uuid4().hex[:8]}.aiff")
        if not (temp_file.endswith('.aiff') or temp_file.endswith('.wav')):
            temp_file = temp_file.rsplit('.', 1)[0] + '.aiff'

        is_devanagari = bool(re.search(r'[\u0900-\u097F]', text))
        voice = "Lekha" if is_devanagari else "Samantha"
        os.system(f'say -v "{voice}" -o "{temp_file}" "{text}"')
        if os.path.exists(temp_file) and os.path.getsize(temp_file) > 100:
            return temp_file
    except Exception as e:
        sys.stderr.write(f"[TTSEngine] macOS say fallback error: {e}\n")
        sys.stderr.flush()
    return ""

def synthesize_speech(text: str, emotion: str = "neutral", out_path: str = None, voice: str = "af_heart") -> str:
    clean = sanitize_text(text)
    if not clean:
        return ""

    # Check for Devanagari script (Hindi/Marathi) which Kokoro doesn't natively speak
    is_devanagari = bool(re.search(r'[\u0900-\u097F]', clean))
    if is_devanagari:
        res = synthesize_fallback_edge(clean, emotion, out_path)
        if res:
            return res
        return synthesize_fallback_macos(clean, out_path)

    # 1. Primary engine: Kokoro-82M Realistic Female Voicepack (af_heart)
    res = synthesize_kokoro(clean, emotion, out_path, voice=voice)
    if res:
        return res

    # 2. Secondary fallback: Edge-TTS
    res = synthesize_fallback_edge(clean, emotion, out_path)
    if res:
        return res

    # 3. Tertiary fallback: macOS CoreAudio Say
    return synthesize_fallback_macos(clean, out_path)

def run_daemon():
    # Isolate original stdout descriptor strictly for JSON IPC responses
    real_stdout = sys.stdout
    sys.stdout = sys.stderr

    sys.stderr.write("[TTSEngine] Warming up Kokoro realistic female voice engine...\n")
    sys.stderr.flush()
    pipeline = get_kokoro_pipeline()
    if pipeline:
        try:
            # Generate a 1-word warmup sample
            warmup_gen = pipeline("Ready", voice=get_voice_pack("af_heart"), speed=1.0)
            for _ in warmup_gen:
                pass
            sys.stderr.write("[TTSEngine] Kokoro female voicepack ready.\n")
            sys.stderr.flush()
        except Exception as e:
            sys.stderr.write(f"[TTSEngine] Warmup notice: {e}\n")
            sys.stderr.flush()

    # Emit daemon ready signal on dedicated IPC stdout
    real_stdout.write(json.dumps({"ready": True, "engine": "kokoro", "voice": "af_heart"}) + "\n")
    real_stdout.flush()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        req_id = None
        try:
            req = json.loads(line)
            req_id = req.get("id")
            text = req.get("text", "")
            emotion = req.get("emotion", "neutral")
            out_path = req.get("out")
            voice = req.get("voice", "af_heart")

            audio_path = synthesize_speech(text, emotion=emotion, out_path=out_path, voice=voice)
            if audio_path and os.path.exists(audio_path) and os.path.getsize(audio_path) > 100:
                real_stdout.write(json.dumps({"id": req_id, "success": True, "audio_path": audio_path}) + "\n")
            else:
                real_stdout.write(json.dumps({"id": req_id, "success": False, "error": "Synthesis failed"}) + "\n")
            real_stdout.flush()
        except Exception as e:
            real_stdout.write(json.dumps({"id": req_id, "success": False, "error": str(e)}) + "\n")
            real_stdout.flush()

def main():
    parser = argparse.ArgumentParser(description="January Ultra-Realistic Neural Female Voice Engine")
    parser.add_argument("text", nargs="*", help="Text to speak")
    parser.add_argument("--emotion", default="neutral", help="Emotion state")
    parser.add_argument("--out", default=None, help="Output audio file path")
    parser.add_argument("--voice", default="af_heart", help="Kokoro voicepack (default: af_heart)")
    parser.add_argument("--daemon", action="store_true", help="Run in persistent daemon IPC mode")
    args = parser.parse_args()

    if args.daemon:
        run_daemon()
        return

    text = " ".join(args.text) if args.text else sys.stdin.read()
    if not text or not text.strip():
        sys.exit(0)

    audio_path = synthesize_speech(text, emotion=args.emotion, out_path=args.out, voice=args.voice)
    if audio_path:
        print(json.dumps({"success": True, "audio_path": audio_path}))
    else:
        print(json.dumps({"success": False, "error": "Speech synthesis failed"}))

if __name__ == "__main__":
    main()
