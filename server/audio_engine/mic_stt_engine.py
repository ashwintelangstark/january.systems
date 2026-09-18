#!/usr/bin/env python3
"""
System Microphone & Open-Source STT Engine for January AI
Listens to physical laptop microphone via sounddevice, performs VAD,
and transcribes speech using Faster-Whisper (tiny.en). Emits JSON events to stdout.
"""

import sys
import json
import time
import queue
import tempfile
import threading
import numpy as np

# Audio configuration
SAMPLE_RATE = 16000
BLOCK_SIZE = 1024  # ~64ms per block
VAD_ENERGY_THRESHOLD = 350.0
SILENCE_DURATION = 0.85  # Seconds of silence to trigger transcription

audio_queue = queue.Queue()
is_muted = False
mute_until_time = 0.0

def audio_callback(indata, frames, time_info, status):
    if status:
        sys.stderr.write(f"[Mic] Status: {status}\n")
    if not is_muted and time.time() > mute_until_time:
        audio_queue.put(indata.copy())

def stdin_listener():
    global is_muted, mute_until_time
    for line in sys.stdin:
        try:
            cmd = json.loads(line.strip())
            if cmd.get("type") == "mute":
                if cmd.get("muted"):
                    is_muted = True
                    sys.stderr.write("[Mic Engine] Muted (speaker active - suppressing echo)\n")
                else:
                    # Add 1200ms cooldown before unmuting to ignore acoustic room reverb and speaker tails
                    mute_until_time = time.time() + 1.2
                    is_muted = False
                    # Clear any audio queued while speaker was active
                    while not audio_queue.empty():
                        try:
                            audio_queue.get_nowait()
                        except Exception:
                            break
                    sys.stderr.write("[Mic Engine] Unmuted (listening for user with 1200ms reverb guard)\n")
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

                    if len(speech_buffer) < 6:  # Too short (click, pop, or transient noise)
                        speech_buffer = []
                        continue

                    full_audio = np.concatenate(speech_buffer, axis=0).flatten()
                    speech_buffer = []

                    # Save to temp WAV file for whisper transcription
                    with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as tmp:
                        wavfile.write(tmp.name, SAMPLE_RATE, full_audio)
                        segments, info = model.transcribe(tmp.name, beam_size=1, language=None)
                        text = " ".join([seg.text.strip() for seg in segments]).strip()

                    if text:
                        lower_text = text.lower()
                        sys.stderr.write(f"[Mic Engine] Transcribed: \"{text}\"\n")

                        # Check if sleep phrase "Good night" was spoken
                        if "good night" in lower_text or "goodnight" in lower_text or "go to sleep" in lower_text:
                            print(json.dumps({
                                "type": "sleep",
                                "phrase": "good night",
                                "raw": text,
                                "timestamp": int(time.time() * 1000),
                            }), flush=True)

                        # Check if wake phrase "Arise" was spoken
                        elif "arise" in lower_text or "a rise" in lower_text or "wake up" in lower_text:
                            print(json.dumps({
                                "type": "wake",
                                "phrase": "arise",
                                "raw": text,
                                "timestamp": int(time.time() * 1000),
                            }), flush=True)

                        # Regular user speech prompt
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
