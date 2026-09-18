#!/usr/bin/env python3
"""
System Speaker Multilingual Neural TTS Engine for January AI
Synthesizes speech using open-source neural TTS (Edge-TTS) across English and
all 15 Indian languages (Hindi, Bengali, Marathi, Gujarati, Punjabi, Odia,
Assamese, Maithili, Kashmiri, Konkani, Dogri, Sindhi, Urdu, Sanskrit, Nepali)
and outputs directly to macOS system speakers via /usr/bin/afplay.
"""

import sys
import os
import re
import asyncio
import subprocess
import tempfile
import uuid
import argparse

VOICE_MAP = {
    "en": "en-US-AriaNeural",
    "en-IN": "en-IN-NeerjaExpressiveNeural",
    "hi": "hi-IN-SwaraNeural",
    "bn": "bn-IN-TanishaaNeural",
    "mr": "mr-IN-AarohiNeural",
    "gu": "gu-IN-DhwaniNeural",
    "pa": "hi-IN-SwaraNeural",
    "or": "hi-IN-SwaraNeural",
    "as": "bn-IN-TanishaaNeural",
    "ur": "ur-IN-GulNeural",
    "ne": "ne-NP-HemkalaNeural",
    "sa": "hi-IN-SwaraNeural",
    "mai": "hi-IN-SwaraNeural",
    "kok": "mr-IN-AarohiNeural",
    "doi": "hi-IN-MadhurNeural",
    "sd": "ur-IN-SalmanNeural",
    "ks": "ur-IN-GulNeural",
    "kn": "kn-IN-SapnaNeural",
    "ta": "ta-IN-PallaviNeural",
    "te": "te-IN-ShrutiNeural",
    "ml": "ml-IN-SobhanaNeural",
}

def detect_language(text: str) -> str:
    """
    Detects the primary language / script of the text to select the best native neural voice.
    """
    if not text:
        return "en"

    # Count characters in Unicode script blocks
    devanagari_count = len(re.findall(r'[\u0900-\u097F]', text))
    bengali_count = len(re.findall(r'[\u0980-\u09FF]', text))
    gujarati_count = len(re.findall(r'[\u0A80-\u0AFF]', text))
    gurmukhi_count = len(re.findall(r'[\u0A00-\u0A7F]', text))
    odia_count = len(re.findall(r'[\u0B00-\u0B7F]', text))
    arabic_count = len(re.findall(r'[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]', text))
    kannada_count = len(re.findall(r'[\u0C80-\u0CFF]', text))
    tamil_count = len(re.findall(r'[\u0B80-\u0BFF]', text))
    telugu_count = len(re.findall(r'[\u0C00-\u0C7F]', text))
    malayalam_count = len(re.findall(r'[\u0D00-\u0D7F]', text))

    counts = {
        "devanagari": devanagari_count,
        "bengali": bengali_count,
        "gujarati": gujarati_count,
        "gurmukhi": gurmukhi_count,
        "odia": odia_count,
        "arabic": arabic_count,
        "kannada": kannada_count,
        "tamil": tamil_count,
        "telugu": telugu_count,
        "malayalam": malayalam_count,
    }

    max_script = max(counts, key=counts.get)
    if counts[max_script] > 1:
        if max_script == "devanagari":
            # Discriminate between Marathi, Nepali, Sanskrit, and Hindi
            hindi_keywords = ["है", "हूँ", "हो", "क्या", "मैं", "आप", "की", "का", "के", "नहीं", "कहाँ", "कैसे", "बताओ", "करो", "धन्यवाद", "नमस्ते"]
            marathi_keywords = ["आहे", "नाही", "काय", "मी", "तुम्ही", "करणार", "होते", "आहेत", "च्या", "मध्ये", "झाले", "कसे", "आणि", "सांगा", "नमस्कार"]
            nepali_keywords = ["छ", "छैन", "गर्ने", "हुने", "भयो", "तपाईं", "हामी", "हुन्छ", "गर्नुहोस्", "नेपाल", "धन्यवाद"]
            sanskrit_keywords = ["अस्ति", "भवति", "करोति", "नमः", "स्वाहा", "इदम्", "अहम्", "त्वम्", "वयं", "इति", "विद्", "श्रीमद्", "सुप्रभातम्"]

            words = text.split()
            hi_score = sum(1 for k in hindi_keywords if k in text)
            mr_score = sum(1 for k in marathi_keywords if k in text) * 1.5
            ne_score = sum(1 for k in nepali_keywords if k in text) * 1.5
            sa_score = sum(1 for k in sanskrit_keywords if k in text) * 1.5

            if mr_score > hi_score and mr_score > ne_score and mr_score > sa_score:
                return "mr"
            elif ne_score > hi_score and ne_score > mr_score and ne_score > sa_score:
                return "ne"
            elif sa_score > hi_score and sa_score > mr_score and sa_score > ne_score:
                return "sa"
            return "hi"
        elif max_script == "bengali":
            return "bn"
        elif max_script == "gujarati":
            return "gu"
        elif max_script == "gurmukhi":
            return "pa"
        elif max_script == "odia":
            return "or"
        elif max_script == "arabic":
            return "ur"
        elif max_script == "kannada":
            return "kn"
        elif max_script == "tamil":
            return "ta"
        elif max_script == "telugu":
            return "te"
        elif max_script == "malayalam":
            return "ml"

    # Default to English / Indian English
    return "en"

async def synthesize_and_play(text: str, voice_override: str = None, pitch: str = "+0Hz", rate: str = "+0%"):
    if not text or not text.strip():
        return

    text = text.strip()
    temp_dir = tempfile.gettempdir()
    output_file = os.path.join(temp_dir, f"january_speech_{uuid.uuid4().hex[:8]}.mp3")

    # Determine voice
    if voice_override and voice_override in VOICE_MAP.values():
        voice = voice_override
    elif voice_override and voice_override in VOICE_MAP:
        voice = VOICE_MAP[voice_override]
    else:
        lang = detect_language(text)
        voice = VOICE_MAP.get(lang, "en-US-AriaNeural")

    sys.stderr.write(f"[TTS Engine] Synthesizing with voice {voice} (pitch: {pitch}, rate: {rate}): \"{text[:50]}...\"\n")

    try:
        import edge_tts
        communicate = edge_tts.Communicate(text, voice, pitch=pitch, rate=rate)
        await communicate.save(output_file)

        # Play directly through system speaker using macOS native player
        subprocess.run(["afplay", output_file], check=True)
    except Exception as e:
        sys.stderr.write(f"[TTS Engine] Edge-TTS error, falling back to native say: {e}\n")
        # Native macOS fallback
        mac_voice = "Lekha" if any(ord(c) >= 0x0900 and ord(c) <= 0x0D7F for c in text) else "Samantha"
        subprocess.run(["say", "-v", mac_voice, text])
    finally:
        if os.path.exists(output_file):
            try:
                os.remove(output_file)
            except OSError:
                pass

def main():
    parser = argparse.ArgumentParser(description="January Multilingual Expressive TTS Engine")
    parser.add_argument("text", nargs="*", help="Text to speak")
    parser.add_argument("--voice", default=os.environ.get("TTS_VOICE", None), help="Explicit voice or language code")
    parser.add_argument("--pitch", default=os.environ.get("TTS_PITCH", "+0Hz"), help="Pitch adjustment like +4Hz or -2Hz")
    parser.add_argument("--rate", default=os.environ.get("TTS_RATE", "+0%"), help="Rate adjustment like +5 percent or -5 percent")
    args = parser.parse_args()

    if args.text:
        text = " ".join(args.text)
        asyncio.run(synthesize_and_play(text, voice_override=args.voice, pitch=args.pitch, rate=args.rate))
    else:
        # Read from stdin line by line
        for line in sys.stdin:
            line = line.strip()
            if line:
                asyncio.run(synthesize_and_play(line, voice_override=args.voice, pitch=args.pitch, rate=args.rate))

if __name__ == "__main__":
    main()

