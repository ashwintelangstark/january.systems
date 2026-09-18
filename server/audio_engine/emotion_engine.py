#!/usr/bin/env python3
"""
Free & Open-Source Emotion Analysis Engine for January AI
Analyzes user and assistant speech to extract emotional valence, arousal,
and category, computing pitch and speaking rate adjustments for neural TTS.
"""

import sys
import json
import re

# Comprehensive emotion keyword & valence lexicon
EMOTION_PATTERNS = {
    "joy": {
        "words": [
            r"\b(happy|glad|joy|delighted|excited|thrilled|awesome|amazing|fantastic|great|wonderful|love|yay|hurray|celebrate|haha|lol|congrats|bravo)\b",
            r"\b(thank\s+you\s+so\s+much|you'?re\s+the\s+best|love\s+it)\b"
        ],
        "valence": 0.8,
        "arousal": 0.7,
        "tone": "cheerful",
        "pitch": "+4Hz",
        "rate": "+5%",
        "color": "#F59E0B"  # Golden Amber
    },
    "curious": {
        "words": [
            r"\b(why|how|what\s+if|wonder|curious|explain|tell\s+me\s+about|interesting|fascinating|explore|understand|learn|discover|reason)\b",
            r"\b(can\s+you\s+show|what\s+does\s+that\s+mean)\b"
        ],
        "valence": 0.4,
        "arousal": 0.6,
        "tone": "curious",
        "pitch": "+2Hz",
        "rate": "+2%",
        "color": "#00F5FF"  # Neon Cyan
    },
    "empathetic": {
        "words": [
            r"\b(sad|depressed|unhappy|down|stressed|tired|exhausted|burnout|lonely|hurt|sorry|apologize|miss|pain|anxious|nervous|afraid|scared|worried)\b",
            r"\b(rough\s+day|hard\s+time|feel\s+bad)\b"
        ],
        "valence": -0.5,
        "arousal": -0.3,
        "tone": "empathetic",
        "pitch": "-2Hz",
        "rate": "-5%",
        "color": "#10B981"  # Mint Emerald
    },
    "focused": {
        "words": [
            r"\b(code|build|program|develop|debug|function|api|server|database|simulation|algorithm|solve|calculate|refactor|optimize|terminal)\b",
            r"\b(write\s+a\s+script|create\s+an\s+app|fix\s+the\s+bug)\b"
        ],
        "valence": 0.3,
        "arousal": 0.5,
        "tone": "focused",
        "pitch": "+0Hz",
        "rate": "+0%",
        "color": "#8B5CF6"  # Electric Violet
    },
    "concerned": {
        "words": [
            r"\b(error|crash|failed|broken|issue|fatal|alert|danger|critical|emergency|warning|bug|corrupt|panic)\b",
            r"\b(not\s+working|something\s+went\s+wrong)\b"
        ],
        "valence": -0.6,
        "arousal": 0.8,
        "tone": "serious",
        "pitch": "-1Hz",
        "rate": "+3%",
        "color": "#EF4444"  # Coral Red
    },
    "calm": {
        "words": [
            r"\b(peace|relax|calm|quiet|serene|chill|meditate|sleep|night|rest|breathe|zen|gentle|soft)\b",
            r"\b(good\s+night|sleep\s+well|take\s+it\s+easy)\b"
        ],
        "valence": 0.3,
        "arousal": -0.5,
        "tone": "gentle",
        "pitch": "-3Hz",
        "rate": "-7%",
        "color": "#6366F1"  # Deep Indigo
    }
}

def analyze_emotion(text: str) -> dict:
    if not text or not text.strip():
        return {
            "emotion": "neutral",
            "valence": 0.0,
            "arousal": 0.0,
            "tone": "neutral",
            "pitch": "+0Hz",
            "rate": "+0%",
            "color": "#00F5FF"
        }

    clean = text.lower()
    scores = {}

    for emotion, meta in EMOTION_PATTERNS.items():
        score = 0
        for pattern in meta["words"]:
            matches = re.findall(pattern, clean, flags=re.IGNORECASE)
            score += len(matches)
        if score > 0:
            scores[emotion] = score

    if not scores:
        if "?" in text:
            primary = "curious"
        elif "!" in text:
            primary = "joy"
        else:
            primary = "neutral"
            return {
                "emotion": "neutral",
                "valence": 0.0,
                "arousal": 0.0,
                "tone": "neutral",
                "pitch": "+0Hz",
                "rate": "+0%",
                "color": "#00F5FF"
            }
    else:
        primary = max(scores, key=scores.get)

    meta = EMOTION_PATTERNS.get(primary, {})
    return {
        "emotion": primary,
        "valence": meta.get("valence", 0.0),
        "arousal": meta.get("arousal", 0.0),
        "tone": meta.get("tone", "neutral"),
        "pitch": meta.get("pitch", "+0Hz"),
        "rate": meta.get("rate", "+0%"),
        "color": meta.get("color", "#00F5FF")
    }

def main():
    if len(sys.argv) > 1:
        text = " ".join(sys.argv[1:])
    else:
        text = sys.stdin.read()

    result = analyze_emotion(text)
    print(json.dumps(result))

if __name__ == "__main__":
    main()
