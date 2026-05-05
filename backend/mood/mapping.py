from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ValenceArousal:
    valence: float
    arousal: float


EMOTION_VA = {
    "happy": ValenceArousal(0.85, 0.65),
    "excited": ValenceArousal(0.90, 0.90),
    "neutral": ValenceArousal(0.00, 0.20),
    "sad": ValenceArousal(-0.75, -0.40),
    "angry": ValenceArousal(-0.70, 0.80),
    "fear": ValenceArousal(-0.85, 0.85),
    "surprise": ValenceArousal(0.30, 0.75),
    "disgust": ValenceArousal(-0.80, 0.55),
    "calm": ValenceArousal(0.50, -0.20),
}

LABEL_ALIASES = {
    "anger": "angry",
    "ang": "angry",
    "angry": "angry",
    "sadness": "sad",
    "sad": "sad",
    "happiness": "happy",
    "happi": "happy",
    "hap": "happy",
    "joy": "happy",
    "neutrality": "neutral",
    "neutral": "neutral",
    "neu": "neutral",
    "fearful": "fear",
    "fea": "fear",
    "fear": "fear",
    "surprised": "surprise",
    "sur": "surprise",
    "surprise": "surprise",
    "disgusted": "disgust",
    "dis": "disgust",
    "disgust": "disgust",
    "calmness": "calm",
    "calm": "calm",
}


def normalize_label(label: str) -> str:
    cleaned = label.strip().lower()
    return LABEL_ALIASES.get(cleaned, cleaned)


def emotion_to_valence_arousal(emotion: str) -> ValenceArousal:
    normalized = normalize_label(emotion)
    return EMOTION_VA.get(normalized, EMOTION_VA["neutral"])


def classify_valence_arousal(valence: float, arousal: float) -> str:
    if valence > 0.4 and arousal > 0.4:
        return "happy"
    if valence > 0.4 and arousal <= 0.4:
        return "calm"
    if -0.3 <= valence <= 0.3 and arousal < 0.4:
        return "neutral"
    if valence < -0.4 and arousal < 0.2:
        return "sad"
    if valence < -0.4 and arousal > 0.5:
        return "angry"
    if valence < 0 and 0.2 <= arousal <= 0.5:
        return "anxious"
    return "neutral"
