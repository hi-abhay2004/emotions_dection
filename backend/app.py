from __future__ import annotations

import json
import os
import time
from datetime import datetime
from flask import Flask, jsonify, render_template, request
from werkzeug.utils import secure_filename

from backend.config import load_config
from backend.meme import generate_caption, render_meme
from .mood import detect_audio_mood, detect_face_mood, fuse_mood
from .rag import build_index, explain_recommendations, retrieve_recommendations
from .embeddings import ChromaStore


def create_app() -> Flask:
    # Reduce noisy/buggy telemetry from ChromaDB in some environments
    os.environ.setdefault("CHROMA_TELEMETRY_ENABLED", "false")
    frontend_root = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "frontend")
    )
    app = Flask(
        __name__,
        static_folder=os.path.join(frontend_root, "static"),
        template_folder=os.path.join(frontend_root, "templates"),
    )
    app.config.update(load_config())
    app.config["MAX_CONTENT_LENGTH"] = 32 * 1024 * 1024

    @app.get("/health")
    def health_check():
        return jsonify({"status": "ok"})

    @app.get("/")
    def index():
        return render_template("index.html")

    @app.post("/detect-face")
    def detect_face():
        payload = request.get_json(silent=True) or {}
        frames = payload.get("frames") or []
        try:
            result = detect_face_mood(frames)
            return jsonify(result)
        except Exception as exc:
            return jsonify({"status": "error", "reason": str(exc)}), 400

    @app.post("/detect-audio")
    def detect_audio():
        payload = request.get_json(silent=True) or {}
        audio = payload.get("audio")
        if not audio:
            return jsonify({"status": "invalid_audio", "reason": "Missing audio"}), 400
        try:
            result = detect_audio_mood(audio)
            return jsonify(result)
        except Exception as exc:
            return jsonify({"status": "error", "reason": str(exc)}), 400

    @app.post("/fuse")
    def fuse():
        payload = request.get_json(silent=True) or {}
        face_result = payload.get("face")
        audio_result = payload.get("audio")
        result = fuse_mood(face_result, audio_result)
        return jsonify(result)

    @app.post("/analyze-session")
    def analyze_session():
        payload = request.get_json(silent=True) or {}
        frames = payload.get("frames") or []
        audio = payload.get("audio")
        preferences = payload.get("preferences") or {}

        metrics: dict[str, float] = {}

        face_result = None
        audio_result = None

        if frames:
            try:
                face_start = time.perf_counter()
                face_result = detect_face_mood(frames)
                metrics["face_latency_ms"] = (time.perf_counter() - face_start) * 1000
            except Exception as exc:
                face_result = {"status": "error", "reason": str(exc)}

        if audio:
            try:
                audio_start = time.perf_counter()
                audio_result = detect_audio_mood(audio)
                metrics["audio_latency_ms"] = (time.perf_counter() - audio_start) * 1000
            except Exception as exc:
                audio_result = {"status": "error", "reason": str(exc), "confidence": 0.0}

        fusion_start = time.perf_counter()
        fused = fuse_mood(face_result, audio_result)
        metrics["fusion_latency_ms"] = (time.perf_counter() - fusion_start) * 1000

        recommendations_payload = {"movies": [], "songs": []}
        meme_payload = None

        if fused.get("status") == "success":
            movies: list[dict] = []
            songs: list[dict] = []

            # Retrieval + explanations (errors should not block meme)
            try:
                retrieval_start = time.perf_counter()
                retrieval = retrieve_recommendations(app.config, fused, preferences)
                metrics["retrieval_latency_ms"] = (
                    time.perf_counter() - retrieval_start
                ) * 1000

                explanation_start = time.perf_counter()
                explanations = explain_recommendations(app.config, retrieval)
                metrics["explanation_latency_ms"] = (
                    time.perf_counter() - explanation_start
                ) * 1000

                movies = [
                    {
                        "title": item.title,
                        "score": item.score,
                        "reason": explanations["movies"][index]
                        if index < len(explanations["movies"])
                        else item.reason,
                        "metadata": item.metadata,
                    }
                    for index, item in enumerate(retrieval.movies)
                ]

                songs = [
                    {
                        "title": item.title,
                        "score": item.score,
                        "reason": explanations["songs"][index]
                        if index < len(explanations["songs"])
                        else item.reason,
                        "metadata": item.metadata,
                    }
                    for index, item in enumerate(retrieval.songs)
                ]

                recommendations_payload = {
                    "query": retrieval.query_text,
                    "movies": movies,
                    "songs": songs,
                }

                metrics["context_utilization"] = _average_context_utilization(
                    movies + songs
                )
                metrics["faithfulness"] = metrics["context_utilization"]
            except Exception as exc:
                recommendations_payload = {
                    "error": str(exc),
                    "movies": [],
                    "songs": [],
                }

            # Meme generation (should try even if recommendations failed)
            try:
                first_movie = movies[0]["title"] if movies else None
                first_song = songs[0]["title"] if songs else None

                meme_start = time.perf_counter()
                caption = generate_caption(
                    app.config,
                    fused.get("final_mood", "neutral"),
                    first_movie,
                    first_song,
                )

                image_b64 = render_meme(
                    caption["top_text"],
                    caption["bottom_text"],
                    fused.get("final_mood", "neutral"),
                )

                meme_payload = {
                    "emotion": fused.get("final_mood", "neutral"),
                    "caption": {
                        "top": caption["top_text"],
                        "bottom": caption["bottom_text"],
                    },
                    "memeUrl": image_b64,
                }
                metrics["meme_latency_ms"] = (time.perf_counter() - meme_start) * 1000
            except Exception as exc:
                meme_payload = {
                    "error": str(exc),
                    "top_text": None,
                    "bottom_text": None,
                    "image_base64": None,
                }

        return jsonify(
            {
                "face_result": face_result,
                "audio_result": audio_result,
                "mood_result": fused,
                "recommendations": recommendations_payload,
                "meme": meme_payload,
                "metrics": metrics,
            }
        )

    @app.post("/recommend")
    def recommend():
        payload = request.get_json(silent=True) or {}
        mood_result = payload.get("mood_result") or {}
        preferences = payload.get("preferences") or {}
        if not mood_result:
            return (
                jsonify({"status": "error", "reason": "mood_result is required"}),
                400,
            )
        try:
            retrieval = retrieve_recommendations(app.config, mood_result, preferences)
        except Exception as exc:
            return (
                jsonify(
                    {
                        "status": "error",
                        "reason": str(exc),
                        "movies": [],
                        "songs": [],
                    }
                ),
                400,
            )

        explain_error = None
        try:
            explanations = explain_recommendations(app.config, retrieval)
        except Exception as exc:
            explanations = {
                "movies": [item.reason for item in retrieval.movies],
                "songs": [item.reason for item in retrieval.songs],
            }
            explain_error = str(exc)

        return jsonify(
            {
                "query": retrieval.query_text,
                "movies": [
                    {
                        "title": item.title,
                        "score": item.score,
                        "reason": explanations["movies"][index]
                        if index < len(explanations["movies"]) else item.reason,
                        "metadata": item.metadata,
                    }
                    for index, item in enumerate(retrieval.movies)
                ],
                "songs": [
                    {
                        "title": item.title,
                        "score": item.score,
                        "reason": explanations["songs"][index]
                        if index < len(explanations["songs"]) else item.reason,
                        "metadata": item.metadata,
                    }
                    for index, item in enumerate(retrieval.songs)
                ],
                **({"explain_error": explain_error} if explain_error else {}),
            }
        )

    @app.post("/recommend-core")
    def recommend_core():
        payload = request.get_json(silent=True) or {}
        mood_result = payload.get("mood_result") or {}
        preferences = payload.get("preferences") or {}
        if not mood_result:
            return (
                jsonify({"status": "error", "reason": "mood_result is required"}),
                400,
            )
        try:
            retrieval = retrieve_recommendations(app.config, mood_result, preferences)
            return jsonify(
                {
                    "query": retrieval.query_text,
                    "movies": [
                        {
                            "title": item.title,
                            "score": item.score,
                            "reason": item.reason,
                            "metadata": item.metadata,
                        }
                        for item in retrieval.movies
                    ],
                    "songs": [
                        {
                            "title": item.title,
                            "score": item.score,
                            "reason": item.reason,
                            "metadata": item.metadata,
                        }
                        for item in retrieval.songs
                    ],
                }
            )
        except Exception as exc:
            return (
                jsonify(
                    {
                        "status": "error",
                        "reason": str(exc),
                        "movies": [],
                        "songs": [],
                    }
                ),
                400,
            )

    @app.post("/build-index")
    def build_index_route():
        payload = request.get_json(silent=True) or {}
        data_dir = payload.get("data_dir") or "./data"

        try:
            count = build_index(app.config, data_dir)
            return jsonify(
                {
                    "status": "success",
                    "indexed_records": count,
                    "data_dir": data_dir,
                }
            )
        except Exception as exc:
            return jsonify({"status": "error", "reason": str(exc)}), 400

    @app.get("/index-count")
    def index_count():
        try:
            store = ChromaStore(persist_dir=app.config.get("CHROMA_DIR", "./data/chroma"))
            total = store.count()
            breakdown = store.type_counts(limit=min(1000, total or 1000))
            return jsonify({"status": "success", "count": total, "types": breakdown})
        except Exception as exc:
            return jsonify({"status": "error", "reason": str(exc)}), 400

    @app.post("/llm-test")
    def llm_test():
        payload = request.get_json(silent=True) or {}
        prompt = payload.get("prompt") or "Write one short supportive sentence for someone feeling sad."
        provider_name = app.config.get("LLM_PROVIDER", "none")
        model = app.config.get("OPENAI_CHAT_MODEL") if provider_name == "openai" else app.config.get("GEMINI_CHAT_MODEL")

        try:
            from .llm import get_llm_provider

            provider = get_llm_provider(app.config)
            if provider is None:
                return jsonify({
                    "status": "error",
                    "reason": "LLM provider is disabled",
                    "provider": provider_name,
                    "model": model,
                }), 400

            text = provider.generate(prompt)
            return jsonify({
                "status": "success",
                "provider": provider_name,
                "model": model,
                "output": text,
            })
        except Exception as exc:
            # Don't leak secrets; just return error message
            return jsonify({
                "status": "error",
                "reason": str(exc),
                "provider": provider_name,
                "model": model,
            }), 400

    @app.post("/upload-dataset")
    def upload_dataset():
        # Validate presence of files field
        if "files" not in request.files:
            return jsonify({"status": "error", "reason": "No files field provided"}), 400

        upload_dir = os.path.join("data", "uploads")
        os.makedirs(upload_dir, exist_ok=True)

        files = request.files.getlist("files")
        # Filter out empty entries
        files = [f for f in files if f and getattr(f, "filename", "")] 

        if not files:
            return jsonify({"status": "error", "reason": "Please select at least one file"}), 400

        allowed_ext = {".csv", ".pdf", ".docx"}
        saved_files: list[str] = []
        for file in files:
            filename = secure_filename(file.filename)
            ext = os.path.splitext(filename)[1].lower()
            if ext not in allowed_ext:
                return (
                    jsonify({
                        "status": "error",
                        "reason": f"Unsupported file type: {ext}. Use CSV, PDF, or DOCX.",
                    }),
                    400,
                )
            target = os.path.join(upload_dir, filename)
            file.save(target)
            saved_files.append(target)

        # Optional: build after upload
        build_after_upload = (request.form.get("build", "true") or "true").lower() in {"1", "true", "yes", "on"}
        indexed_records = None
        if build_after_upload:
            try:
                indexed_records = build_index(app.config, upload_dir)
            except Exception as exc:
                # Return upload success but surface index build error
                return (
                    jsonify({
                        "status": "partial",
                        "files": saved_files,
                        "indexed_records": 0,
                        "data_dir": upload_dir,
                        "reason": f"Index build failed: {exc}",
                    }),
                    207,
                )

        return jsonify({
            "status": "success",
            "files": saved_files,
            "indexed_records": indexed_records,
            "data_dir": upload_dir,
        })

    @app.post("/feedback")
    def feedback():
        payload = request.get_json(silent=True) or {}
        payload["timestamp"] = datetime.utcnow().isoformat() + "Z"

        feedback_path = os.path.join("data", "feedback.jsonl")
        os.makedirs(os.path.dirname(feedback_path), exist_ok=True)
        with open(feedback_path, "a", encoding="utf-8") as handle:
            handle.write(json.dumps(payload) + "\n")

        return jsonify({"status": "success"})

    @app.post("/generate-meme")
    def generate_meme():
        payload = request.get_json(silent=True) or {}
        mood = (payload.get("mood") or "neutral").lower()
        movie = payload.get("movie")
        song = payload.get("song")

        if not (movie or song):
            return (
                jsonify(
                    {
                        "status": "error",
                        "reason": "Provide at least a movie or a song to generate a meme",
                    }
                ),
                400,
            )

        try:
            caption = generate_caption(app.config, mood, movie, song)
            image_b64 = render_meme(caption["top_text"], caption["bottom_text"], mood)
            return jsonify(
                {
                    "emotion": mood,
                    "caption": {
                        "top": caption["top_text"],
                        "bottom": caption["bottom_text"],
                    },
                    "memeUrl": image_b64,  # Now returns the URL string from renderer.py
                }
            )
        except Exception as exc:
            return jsonify({"status": "error", "reason": str(exc)}), 500

    return app


def _context_utilization(reason: str, metadata: dict) -> float:
    text = (reason or "").lower()
    used = 0
    total = 0
    for key in ["title", "genre", "mood_tags", "description"]:
        value = metadata.get(key)
        if value:
            total += 1
            token = str(value).split(",")[0].lower()
            if token and token in text:
                used += 1
    return used / max(total, 1)


def _average_context_utilization(items: list[dict]) -> float:
    if not items:
        return 0.0
    scores = [
        _context_utilization(item.get("reason", ""), item.get("metadata", {}))
        for item in items
    ]
    return sum(scores) / max(len(scores), 1)


if __name__ == "__main__":
    print("\n" + "="*50)
    print(" [AI SYSTEM] INITIALIZING NEURAL LAYERS...")
    print(" [AI SYSTEM] LOADING MODELS (Torch, TF, Transformers)...")
    print(" [AI SYSTEM] PLEASE WAIT - 60+ seconds expected.")
    print("="*50 + "\n")
    
    app = create_app()
    app.run(
        host="0.0.0.0", 
        port=5000, 
        debug=app.config.get("FLASK_DEBUG", False),
        use_reloader=False
    )
