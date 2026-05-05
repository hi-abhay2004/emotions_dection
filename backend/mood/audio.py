from __future__ import annotations

import base64
import io
from dataclasses import dataclass
from functools import lru_cache
from typing import Any
import os
import warnings

# Suppress heavy library logs and noise
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
warnings.filterwarnings("ignore", category=RuntimeWarning, module="pydub")

print("\n[AI SYSTEM] Initializing Neural Layers...")
print("[AI SYSTEM] Loading heavy models (Torch, TensorFlow, Transformers)...")
print("[AI SYSTEM] PLEASE WAIT - This can take 1-3 minutes on first run.\n")

import numpy as np

from .mapping import emotion_to_valence_arousal, normalize_label

# Optional ffmpeg via pip (no system install). If available, add its dir to PATH.
_ffmpeg_exe = None
try:
    import imageio_ffmpeg  # type: ignore

    _ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    if _ffmpeg_exe:
        os.environ["PATH"] = os.path.dirname(_ffmpeg_exe) + os.pathsep + os.environ.get("PATH", "")
except Exception:
    pass

try:
    import librosa
    import soundfile as sf
    from transformers import pipeline
except ImportError:
    librosa = None
    sf = None
    pipeline = None

try:
    from pydub import AudioSegment

    if AudioSegment and _ffmpeg_exe:
        AudioSegment.converter = _ffmpeg_exe
except ImportError:
    AudioSegment = None


@dataclass
class AudioConfig:
    target_sample_rate: int = 16000
    min_duration: float = 2.0
    chunk_seconds: float = 2.5
    silence_threshold: float = 0.01
    model_name: str = "superb/wav2vec2-base-superb-er"


def detect_audio_mood(audio_b64: str, config: AudioConfig | None = None) -> dict[str, Any]:
    if librosa is None or sf is None or pipeline is None:
        raise RuntimeError("librosa, soundfile, and transformers must be installed")

    cfg = config or AudioConfig()
    signal, sample_rate = _decode_audio(audio_b64)
    if signal is None:
        return {
            "status": "invalid_audio",
            "reason": "Unable to decode audio",
            "confidence": 0.0,
        }

    if sample_rate != cfg.target_sample_rate:
        signal = librosa.resample(signal, orig_sr=sample_rate, target_sr=cfg.target_sample_rate)
        sample_rate = cfg.target_sample_rate

    signal = _trim_silence(signal, cfg.silence_threshold)
    duration = len(signal) / float(sample_rate)
    if duration < cfg.min_duration:
        return {
            "status": "low_confidence",
            "reason": "Audio too short",
            "confidence": 0.2,
        }

    if _rms_energy(signal) < cfg.silence_threshold:
        return {
            "status": "no_speech",
            "reason": "No usable speech detected",
            "confidence": 0.0,
        }

    classifier = _get_audio_classifier(cfg.model_name)
    chunks = _chunk_audio(signal, sample_rate, cfg.chunk_seconds)

    aggregated: dict[str, float] = {}
    total = 0.0
    for chunk in chunks:
        results = classifier(chunk, sampling_rate=sample_rate, top_k=None)
        for item in results:
            label = normalize_label(item["label"])
            score = float(item["score"])
            aggregated[label] = aggregated.get(label, 0.0) + score
            total += score

    if not aggregated or total <= 0:
        return {
            "status": "low_confidence",
            "reason": "No confident emotion detected",
            "confidence": 0.0,
        }

    averaged = {label: score / total for label, score in aggregated.items()}
    dominant_emotion = max(averaged, key=averaged.get)
    va = emotion_to_valence_arousal(dominant_emotion)
    energy = _rms_energy(signal)
    speech_quality_score = min(1.0, max(0.0, energy / 0.08))
    final_confidence = averaged[dominant_emotion] * speech_quality_score

    return {
        "status": "success",
        "dominant_emotion": dominant_emotion,
        "emotion_scores": averaged,
        "confidence": final_confidence,
        "valence": va.valence,
        "arousal": va.arousal,
        "duration": duration,
        "speech_quality_score": speech_quality_score,
    }


def _decode_audio(audio_b64: str):
    # Support data URLs from browsers: data:audio/webm;codecs=opus;base64,....
    if "," in (audio_b64 or ""):
        try:
            audio_b64 = audio_b64.split(",", 1)[1]
        except Exception:
            pass

    try:
        encoded = base64.b64decode(audio_b64)
    except Exception:
        return None, None

    try:
        signal, sample_rate = sf.read(io.BytesIO(encoded), dtype="float32")
        if signal.ndim > 1:
            signal = np.mean(signal, axis=1)
        return signal, sample_rate
    except Exception:
        pass

    if AudioSegment is None:
        return None, None

    try:
        audio = AudioSegment.from_file(io.BytesIO(encoded))
        audio = audio.set_channels(1).set_frame_rate(16000)
        samples = np.array(audio.get_array_of_samples()).astype("float32")
        samples /= float(1 << (8 * audio.sample_width - 1))
        return samples, 16000
    except Exception:
        return None, None


def _trim_silence(signal: np.ndarray, threshold: float) -> np.ndarray:
    energy = np.abs(signal)
    mask = energy > threshold
    if not mask.any():
        return signal
    idx = np.where(mask)[0]
    return signal[idx[0] : idx[-1] + 1]


def _rms_energy(signal: np.ndarray) -> float:
    return float(np.sqrt(np.mean(np.square(signal))))


def _chunk_audio(signal: np.ndarray, sample_rate: int, chunk_seconds: float) -> list[np.ndarray]:
    chunk_size = int(sample_rate * chunk_seconds)
    min_chunk_size = int(sample_rate * 1.0)
    if chunk_size <= 0:
        return [signal]

    chunks: list[np.ndarray] = []
    for i in range(0, len(signal), chunk_size):
        chunk = signal[i : i + chunk_size]
        if len(chunk) >= min_chunk_size:
            chunks.append(chunk)

    return chunks or [signal]


@lru_cache(maxsize=2)
def _get_audio_classifier(model_name: str):
    return pipeline("audio-classification", model=model_name)
