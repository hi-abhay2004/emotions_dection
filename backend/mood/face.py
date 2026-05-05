from __future__ import annotations

import base64
from dataclasses import dataclass
from typing import Any

from .mapping import emotion_to_valence_arousal

try:
    import cv2
    import numpy as np
    from deepface import DeepFace
except ImportError:  # pragma: no cover - optional dependency
    cv2 = None
    np = None
    DeepFace = None


@dataclass
class FaceConfig:
    min_valid_frames: int = 5
    brightness_min: float = 40.0
    blur_min: float = 40.0


def detect_face_mood(frames: list[str], config: FaceConfig | None = None) -> dict[str, Any]:
    if DeepFace is None or cv2 is None or np is None:
        raise RuntimeError("deepface, opencv-python, and numpy must be installed")

    cfg = config or FaceConfig()
    aggregated: dict[str, float] = {}
    total_weight = 0.0
    valid_frames = 0

    total_frames = len(frames)
    for frame_b64 in frames:
        image = _decode_image(frame_b64)
        if image is None:
            continue

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        brightness = float(gray.mean())
        blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        if brightness < cfg.brightness_min or blur_score < cfg.blur_min:
            continue

        try:
            analysis = DeepFace.analyze(
                image,
                actions=["emotion"],
                enforce_detection=True,
            )
        except Exception:
            continue
        if not analysis:
            continue

        result = _select_face_result(analysis)
        if not result or "emotion" not in result:
            continue

        region = result.get("region") or {}
        if int(region.get("w", 0)) <= 0 or int(region.get("h", 0)) <= 0:
            continue

        scores = _normalize_scores(result["emotion"])
        confidence = max(scores.values(), default=0.0)
        if confidence <= 0:
            continue

        weight = confidence
        for emotion, score in scores.items():
            aggregated[emotion] = aggregated.get(emotion, 0.0) + score * weight
        total_weight += weight
        valid_frames += 1

    if valid_frames < cfg.min_valid_frames or total_weight <= 0:
        return {
            "status": "low_confidence",
            "reason": "Insufficient valid face frames",
            "confidence": 0.0,
        }

    averaged = {emotion: value / total_weight for emotion, value in aggregated.items()}
    dominant_emotion = max(averaged, key=averaged.get)
    va = emotion_to_valence_arousal(dominant_emotion)
    valid_frame_ratio = valid_frames / max(total_frames, 1)
    final_confidence = averaged[dominant_emotion] * valid_frame_ratio

    return {
        "status": "success",
        "dominant_emotion": dominant_emotion,
        "emotion_scores": averaged,
        "confidence": final_confidence,
        "valence": va.valence,
        "arousal": va.arousal,
        "valid_frames": valid_frames,
        "total_frames": total_frames,
        "valid_frame_ratio": valid_frame_ratio,
    }


def _decode_image(frame_b64: str):
    try:
        if "," in frame_b64:
            frame_b64 = frame_b64.split(",", 1)[1]
        encoded = base64.b64decode(frame_b64)
        array = np.frombuffer(encoded, dtype=np.uint8)
        image = cv2.imdecode(array, cv2.IMREAD_COLOR)
        return image
    except Exception:
        return None


def _select_face_result(result: Any) -> dict | None:
    if isinstance(result, list):
        best_item = None
        best_area = -1
        for item in result:
            region = item.get("region") or {}
            area = int(region.get("w", 0)) * int(region.get("h", 0))
            if area > best_area:
                best_area = area
                best_item = item
        return best_item
    if isinstance(result, dict):
        return result
    return None


def _normalize_scores(scores: dict) -> dict[str, float]:
    normalized: dict[str, float] = {}
    for emotion, value in scores.items():
        score = float(value)
        if score > 1.0:
            score = score / 100.0
        normalized[str(emotion).lower()] = max(0.0, min(score, 1.0))
    return normalized
