from __future__ import annotations

from typing import Any

from .mapping import classify_valence_arousal


def fuse_mood(face_result: dict[str, Any] | None, audio_result: dict[str, Any] | None) -> dict[str, Any]:
    face_ok = face_result and face_result.get("status") == "success"
    audio_ok = audio_result and audio_result.get("status") == "success"

    if not face_ok and not audio_ok:
        return {
            "status": "failed",
            "reason": "No reliable face or audio input",
            "confidence": 0.0,
        }

    if face_ok and not audio_ok:
        return _single_source(face_result, source="face_only")

    if audio_ok and not face_ok:
        return _single_source(audio_result, source="audio_only")

    face_conf = float(face_result.get("confidence", 0.0))
    audio_conf = float(audio_result.get("confidence", 0.0))
    total = face_conf + audio_conf
    if total <= 0:
        return {
            "status": "low_confidence",
            "reason": "Both modalities have low confidence",
            "confidence": 0.0,
        }

    face_weight = face_conf / total
    audio_weight = audio_conf / total

    final_valence = (face_weight * float(face_result.get("valence", 0.0))) + (
        audio_weight * float(audio_result.get("valence", 0.0))
    )
    final_arousal = (face_weight * float(face_result.get("arousal", 0.0))) + (
        audio_weight * float(audio_result.get("arousal", 0.0))
    )

    agreement = 1.0 - min(
        1.0,
        (
            abs(face_result.get("valence", 0.0) - audio_result.get("valence", 0.0))
            + abs(face_result.get("arousal", 0.0) - audio_result.get("arousal", 0.0))
        )
        / 2.0,
    )
    final_confidence = (face_weight * face_conf + audio_weight * audio_conf) * agreement
    disagreement = agreement < 0.5
    warning = (
        "Face and voice signals disagree. Result may be less reliable."
        if disagreement
        else None
    )

    return {
        "status": "success",
        "final_mood": classify_valence_arousal(final_valence, final_arousal),
        "valence": final_valence,
        "arousal": final_arousal,
        "confidence": final_confidence,
        "agreement_score": agreement,
        "disagreement": disagreement,
        "warning": warning,
        "source": "face_audio_fusion",
        "face_result": face_result,
        "audio_result": audio_result,
    }


def _single_source(result: dict[str, Any], source: str) -> dict[str, Any]:
    valence = float(result.get("valence", 0.0))
    arousal = float(result.get("arousal", 0.0))

    return {
        "status": "success",
        "final_mood": classify_valence_arousal(valence, arousal),
        "dominant_emotion": result.get("dominant_emotion"),
        "valence": valence,
        "arousal": arousal,
        "confidence": result.get("confidence"),
        "source": source,
        "face_result": result if source == "face_only" else None,
        "audio_result": result if source == "audio_only" else None,
    }
