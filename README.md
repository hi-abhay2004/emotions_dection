# AI Mood Detection & RAG Recommendations

Multimodal mood detection (DeepFace + Wav2Vec2) with confidence-based fusion, RAG-based movie/song recommendations, and meme generation (LLM + Pillow). Frontend is vanilla HTML/CSS/JS; backend is Flask.

## Quick Start

### 1) Clone + Python
- Python 3.10+ recommended (3.12 works)

```bash
cd ai-mood-detection
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install -r backend/requirements.txt
# Ensure OpenAI client compatibility with httpx
pip install 'httpx==0.27.2'
```

### 2) Configure .env
Create a `.env` in the project root (same folder as this README):

```
# LLM providers
OPENAI=true
GEMINI=false

# Flask
APP_ENV=dev
FLASK_DEBUG=true

# RAG / embeddings
CHROMA_DIR=./data/chroma
EMBEDDING_PROVIDER=local
LOCAL_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
GEMINI_EMBEDDING_MODEL=models/embedding-001

# LLM chat models
OPENAI_CHAT_MODEL=gpt-4o-mini
GEMINI_CHAT_MODEL=gemini-1.5-flash

# API keys (replace!)
OPENAI_API_KEY=sk-REPLACE_ME
GEMINI_API_KEY=your_gemini_api_key_here
```

Notes:
- Explanations use OpenAI by default; embeddings are local for speed/cost.
- If you prefer OpenAI embeddings too, set `EMBEDDING_PROVIDER=openai` (rebuild index).

### 3) Start the server
```bash
# Kill port if reusing same terminal frequently
fuser -k 5000/tcp || true

# Run Flask (uses backend.app:create_app)
PYTHONPATH=$(pwd) flask --app backend.app:create_app run --debug
# Or different port
# PYTHONPATH=$(pwd) flask --app backend.app:create_app run --debug --port 5001
```

Open the app:
- http://127.0.0.1:5000 (or change to :5001 if you used a different port)

### 4) Build the recommendation index
Two options:

- From the UI (Upload screen):
  - Upload CSV/PDF/DOCX and click "Upload & Build" (auto-builds and reports indexed count)
  - Or click "Build index from data/" to use bundled samples (`data/sample_movies.csv`, `data/sample_songs.csv`)

- Or via API with bundled data:
```bash
curl -s -X POST http://127.0.0.1:5000/build-index \
  -H 'Content-Type: application/json' \
  -d '{"data_dir":"./data"}' | jq .

# Inspect index size and type breakdown
curl -s http://127.0.0.1:5000/index-count | jq .
```

### 5) Run a quick recommendation test
```bash
curl -s -X POST http://127.0.0.1:5000/recommend \
  -H 'Content-Type: application/json' \
  -d '{
    "mood_result": {"status":"success","final_mood":"sad","valence":-0.7,"arousal":-0.3,"confidence":0.8},
    "preferences": {"content_type":"both","goal":"improve","language":"English","genres":[]}
  }' | jq .
```
Expected: non-empty `movies` and `songs`. If the LLM explainer has an issue, you will see an `explain_error` but results still appear.

### 6) Full flow from UI
- Click "Start Mood Session"
- Allow Camera/Mic
- Adjust preferences (optional)
- Click "Capture mood" → "Start recording" (7s) → "Analyze mood"
- Results: mood, recommendations, meme. Error details are surfaced in-page if something fails.

---

## Dataset format (CSV recommended)
Flexible header mapping is supported. Recommended columns:

- Required: `title`
- Recommended: `type` (movie|song). If missing, inferred from file name (e.g., `sample_movies.csv`).
- Optional: `description`, `genre`, `mood|moods|mood_tags|emotion|emotions`, `valence`, `arousal`, `rating`, `language`

Example:

```csv
id,type,title,description,genre,mood_tags,valence,arousal,rating,language
m1,movie,Inside Out,A comforting story,Animation|Comedy,sad|hopeful|comforting,0.45,0.35,8.1,English
s1,song,Fix You,A calm uplifting song,Alternative Rock,sad|healing|hopeful,0.20,0.30,9.0,English
```

Rebuild index after changing your dataset or embedding provider.

---

## Frontend configuration
The frontend automatically calls the same origin it was loaded from (`window.location.origin`). If you host frontend separately, override the API base at runtime in the browser console before analyzing:

```js
window.APP_API_BASE = 'http://127.0.0.1:5001';
```

You’ll see the detected base in the console:
```
[MoodApp] API_BASE: http://127.0.0.1:5001
```

During capture, the UI prints debug info (frames count and audio base64 size) in the status and console.

---

## API Endpoints

- `GET /health` → `{status: "ok"}`
- `POST /upload-dataset` (multipart/form-data: files[]) → saves files; optionally auto-builds index
- `POST /build-index` `{data_dir}` → returns `{indexed_records}`
- `GET /index-count` → `{count, types: {movie: n, song: n, ...}}`
- `POST /analyze-session` `{frames[], audio(base64), preferences}` → mood_result, recommendations, meme, metrics
- `POST /recommend` `{mood_result, preferences}` → movies, songs (+ `explain_error` if LLM explainer fails)
- `POST /recommend-core` `{mood_result, preferences}` → retrieval-only (bypasses LLM explainer) for diagnostics
- `POST /generate-meme` `{mood, movie?, song?}` → `{image_base64, top_text, bottom_text}`
- `POST /feedback` → appends JSONL to `data/feedback.jsonl`
- `POST /llm-test` `{prompt?}` → `{status, provider, model, output?}`

---

## Troubleshooting

- Port in use
```bash
fuser -k 5000/tcp || true
# or for 5001
fuser -k 5001/tcp || true
```

- LLM "proxies" error with OpenAI client
```bash
# Ensure this in your venv
pip install 'httpx==0.27.2'
# Re-run server
PYTHONPATH=$(pwd) flask --app backend.app:create_app run --debug
# Sanity check LLM
curl -s -X POST http://127.0.0.1:5000/llm-test -H 'Content-Type: application/json' -d '{"prompt":"hi"}' | jq .
```

- Chroma telemetry noise – harmless; to quiet further:
```bash
export CHROMA_TELEMETRY_ENABLED=false
export POSTHOG_DISABLED=true
```

- Audio decoding (browser audio/webm)
  - We use pip ffmpeg via `imageio-ffmpeg` automatically. pydub may still warn.
  - If decoding still fails, install system ffmpeg:

```bash
sudo apt update && sudo apt install -y ffmpeg
ffmpeg -version
```

- Empty recommendations
  - Check index: `curl -s http://127.0.0.1:5000/index-count | jq .`
  - Ensure `type` is `movie` or `song` in metadata; rebuild index
  - Try `/recommend-core` to isolate RAG from LLM explanations

---

## Dev notes
- First request may be slower due to model warmup (DeepFace, Wav2Vec2, SentenceTransformer).
- Results screen shows error messages if detection, retrieval, or meme generation fail.

## License
See project files. No license header was added by default.
