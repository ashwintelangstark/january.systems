#!/usr/bin/env python3
"""
System Microphone & Open-Source STT Engine for January AI
Listens to physical laptop microphone via sounddevice, performs VAD,
and transcribes speech using Faster-Whisper (tiny.en). Emits JSON events to stdout.
"""

import os
import sys
import json
import time
import re
import queue
import tempfile
import threading
import numpy as np

# Audio configuration
SAMPLE_RATE = 16000
BLOCK_SIZE = 1024  # ~64ms per block
VAD_ENERGY_THRESHOLD = 350.0
SILENCE_DURATION = 0.42  # Fast silence cutoff for real-time responsiveness

audio_queue = queue.Queue()
is_muted = False
mute_until_time = 0.0
recent_assistant_utterances = []

def record_assistant_speech(text):
    global recent_assistant_utterances
    clean = re.sub(r'[^\w\s]', '', text.lower()).strip()
    if not clean:
        return
    words = set(clean.split())
    recent_assistant_utterances.append({
        "clean": clean,
        "words": words,
        "timestamp": time.time()
    })
    if len(recent_assistant_utterances) > 10:
        recent_assistant_utterances.pop(0)

def is_echo_of_assistant(text):
    if not text:
        return True
    clean = re.sub(r'[^\w\s]', '', text.lower()).strip()
    if not clean or len(clean) < 3:
        return True
    words = set(clean.split())
    now = time.time()
    for item in reversed(recent_assistant_utterances):
        age = now - item["timestamp"]
        if age > 25.0:
            continue
        ast_clean = item["clean"]
        if not ast_clean:
            continue
        # Direct substring match
        if clean in ast_clean or ast_clean in clean:
            return True
        # Word overlap check
        ast_words = item["words"]
        if words and ast_words:
            overlap = len(words.intersection(ast_words))
            if overlap >= len(words) * 0.5 and age < 12.0:
                return True
    return False

def audio_callback(indata, frames, time_info, status):
    if not is_muted and time.time() > mute_until_time:
        try:
            audio_queue.put_nowait(indata.copy())
        except Exception:
            pass

def stdin_listener():
    global is_muted, mute_until_time, audio_queue
    for line in sys.stdin:
        try:
            line_str = line.strip()
            if not line_str:
                continue
            cmd = json.loads(line_str)
            cmd_type = cmd.get("type")
            if cmd_type == "mute":
                if cmd.get("muted"):
                    is_muted = True
                    # Instantly purge queued audio chunks to kill any speaker echo
                    while not audio_queue.empty():
                        try:
                            audio_queue.get_nowait()
                        except Exception:
                            break
                    sys.stderr.write("[Mic Engine] Muted (suppressing playback echo)\n")
                else:
                    # 600ms acoustic dampening cooldown after speaker stops
                    mute_until_time = time.time() + 0.60
                    is_muted = False
                    # Clear any audio queued while speaker was active
                    while not audio_queue.empty():
                        try:
                            audio_queue.get_nowait()
                        except Exception:
                            break
                    sys.stderr.write("[Mic Engine] Unmuted (listening with 600ms acoustic guard)\n")
            elif cmd_type == "assistant_spoke":
                ast_text = cmd.get("text", "")
                if ast_text:
                    record_assistant_speech(ast_text)
        except Exception:
            pass

def main():
    sys.stderr.write("[Mic Engine] Initializing physical microphone & Faster-Whisper...\n")

    # Start stdin reader thread for real-time mute/unmute control
    t = threading.Thread(target=stdin_listener, daemon=True)
    t.start()

    try:
        import sounddevice as sd
        from faster_whisper import WhisperModel
        import scipy.io.wavfile as wavfile
    except ImportError as e:
        sys.stderr.write(f"[Mic Engine] Missing dependency: {e}\n")
        print(json.dumps({"type": "error", "message": str(e)}), flush=True)
        return

    # Load local Whisper model (multilingual tiny for English and all Indian languages)
    sys.stderr.write("[Mic Engine] Loading Faster-Whisper multilingual model (tiny)...\n")
    model = WhisperModel("tiny", device="cpu", compute_type="int8")
    sys.stderr.write("[Mic Engine] Whisper ready. Starting sounddevice InputStream...\n")

    print(json.dumps({"type": "ready", "samplerate": SAMPLE_RATE}), flush=True)

    stream = sd.InputStream(
        samplerate=SAMPLE_RATE,
        channels=1,
        dtype="int16",
        blocksize=BLOCK_SIZE,
        callback=audio_callback,
    )

    speaking = False
    speech_buffer = []
    silence_start = None
    last_level_emit = time.time()

    with stream:
        sys.stderr.write("[Mic Engine] Listening to system microphone...\n")

        while True:
            try:
                chunk = audio_queue.get(timeout=1.0)
            except queue.Empty:
                continue

            now = time.time()
            if is_muted or now < mute_until_time:
                speaking = False
                speech_buffer = []
                silence_start = None
                continue

            # Calculate RMS energy
            pcm = chunk.flatten().astype(np.float32)
            rms = float(np.sqrt(np.mean(pcm ** 2)))

            # Emit level for dashboard waveform visualizer
            now = time.time()
            if now - last_level_emit > 0.08:
                normalized_level = min(1.0, rms / 1500.0)
                print(json.dumps({"type": "level", "value": round(normalized_level, 3)}), flush=True)
                last_level_emit = now

            if rms > VAD_ENERGY_THRESHOLD:
                if not speaking:
                    speaking = True
                    speech_buffer = []
                    sys.stderr.write("[Mic Engine] Speech activity detected...\n")
                speech_buffer.append(chunk)
                silence_start = None
            elif speaking:
                speech_buffer.append(chunk)
                if silence_start is None:
                    silence_start = now
                elif now - silence_start > SILENCE_DURATION:
                    # Speech segment finished, run STT
                    speaking = False
                    silence_start = None

                    if len(speech_buffer) < 4:  # Too short (transient noise)
                        speech_buffer = []
                        continue

                    full_audio = np.concatenate(speech_buffer, axis=0).flatten()
                    speech_buffer = []

                    # In-memory float32 normalized transcription (zero disk I/O)
                    audio_float = full_audio.astype(np.float32) / 32768.0
                    stt_lang = os.environ.get("STT_LANGUAGE", "en").strip() or "en"
                    segments, info = model.transcribe(
                        audio_float,
                        beam_size=1,
                        language=stt_lang,
                        condition_on_previous_text=False,
                        vad_filter=True,
                    )
                    text = " ".join([seg.text.strip() for seg in segments]).strip()

                    if text:
                        if is_echo_of_assistant(text):
                            sys.stderr.write(f"[Mic Engine] Discarded acoustic echo of assistant: \"{text}\"\n")
                            continue

                        lower_text = text.lower()
                        # Strip punctuation and extra whitespace for robust phrase recognition
                        clean_text = re.sub(r'[^\w\s]', '', lower_text).strip()
                        sys.stderr.write(f"[Mic Engine] Transcribed: \"{text}\" (normalized: \"{clean_text}\")\n")

                        # 1. Check Camera Wake Phrase (e.g. "eyes open")
                        cam_wake_target = os.environ.get("CAMERA_WAKE_PHRASE", "eyes open").strip().strip('"\'').lower()
                        cam_wake_variants = list(set([
                            cam_wake_target,
                            "eyes open", "open eyes", "camera open", "open camera", "eyes on", "turn on camera", "enable camera"
                        ]))
                        is_cam_wake = any(
                            clean_text == v or re.search(r'\b' + re.escape(v) + r'\b', clean_text)
                            for v in cam_wake_variants if v
                        )

                        # 2. Check Camera Sleep Phrase (e.g. "eyes closed")
                        cam_sleep_target = os.environ.get("CAMERA_SLEEP_PHRASE", "eyes closed").strip().strip('"\'').lower()
                        cam_sleep_variants = list(set([
                            cam_sleep_target,
                            "eyes closed", "close eyes", "camera closed", "close camera", "eyes off", "turn off camera", "disable camera"
                        ]))
                        is_cam_sleep = any(
                            clean_text == v or re.search(r'\b' + re.escape(v) + r'\b', clean_text)
                            for v in cam_sleep_variants if v
                        )

                        # 3. Check System Sleep Phrase (e.g. "good night")
                        sleep_target = os.environ.get("SLEEP_PHRASE", "good night").strip().strip('"\'').lower()
                        sleep_variants = list(set([
                            sleep_target,
                            "good night", "goodnight", "go to sleep", "sleep"
                        ]))
                        is_sleep = any(
                            clean_text == v or re.search(r'\b' + re.escape(v) + r'\b', clean_text)
                            for v in sleep_variants if v
                        )

                        # 4. Check System Wake Phrase (e.g. "rise")
                        wake_target = os.environ.get("WAKE_PHRASE", "rise").strip().strip('"\'').lower()
                        wake_variants = list(set([
                            wake_target,
                            "rise", "arise", "a rise", "wake up", "wake"
                        ]))
                        is_wake = any(
                            clean_text == v or re.search(r'\b' + re.escape(v) + r'\b', clean_text)
                            for v in wake_variants if v
                        )

                        if is_cam_wake:
                            sys.stderr.write(f"[Mic Engine] Matched Camera Wake Phrase: \"{cam_wake_target}\"\n")
                            print(json.dumps({
                                "type": "camera_wake",
                                "phrase": cam_wake_target,
                                "raw": text,
                                "timestamp": int(time.time() * 1000),
                            }), flush=True)
                        elif is_cam_sleep:
                            sys.stderr.write(f"[Mic Engine] Matched Camera Sleep Phrase: \"{cam_sleep_target}\"\n")
                            print(json.dumps({
                                "type": "camera_sleep",
                                "phrase": cam_sleep_target,
                                "raw": text,
                                "timestamp": int(time.time() * 1000),
                            }), flush=True)
                        elif is_sleep:
                            sys.stderr.write(f"[Mic Engine] Matched System Sleep Phrase: \"{sleep_target}\"\n")
                            print(json.dumps({
                                "type": "sleep",
                                "phrase": sleep_target,
                                "raw": text,
                                "timestamp": int(time.time() * 1000),
                            }), flush=True)
                        elif is_wake:
                            sys.stderr.write(f"[Mic Engine] Matched System Wake Phrase: \"{wake_target}\"\n")
                            print(json.dumps({
                                "type": "wake",
                                "phrase": wake_target,
                                "raw": text,
                                "timestamp": int(time.time() * 1000),
                            }), flush=True)
                        else:
                            print(json.dumps({
                                "type": "speech",
                                "text": text,
                                "timestamp": int(time.time() * 1000),
                            }), flush=True)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.stderr.write("[Mic Engine] Stopped.\n")
