const screens = document.querySelectorAll(".screen");
// Use current origin by default; allow override via window.APP_API_BASE if needed
let API_BASE = (window.APP_API_BASE || window.location.origin || "").replace(/\/$/, "");
console.log("[MoodApp] API_BASE:", API_BASE);
const statusNodes = {
  permissions: document.querySelector('[data-status="permissions"]'),
  capture: document.querySelector('[data-status="capture"]'),
  upload: document.querySelector('[data-status="upload"]'),
};

const state = {
  cameraStream: null,
  audioStream: null,
  frames: [],
  audioBase64: null,
  moodResult: null,
  preferences: {},
};

const cameraEl = document.getElementById("camera");
const audioCard = document.querySelector(".audio-card");

function showScreen(name) {
  screens.forEach((screen) => {
    screen.classList.toggle("active", screen.dataset.screen === name);
  });
}

function setStatus(key, message) {
  const node = statusNodes[key];
  if (node) {
    node.textContent = message;
  }
}

async function enableCamera() {
  try {
    state.cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
    cameraEl.srcObject = state.cameraStream;
    setStatus("permissions", "Camera enabled.");
  } catch (error) {
    setStatus("permissions", "Camera permission denied.");
  }
}

async function enableMic() {
  try {
    state.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    setStatus("permissions", "Microphone enabled.");
  } catch (error) {
    setStatus("permissions", "Microphone permission denied.");
  }
}

function readPreferences() {
  state.preferences = {
    content_type: document.getElementById("pref-content-type").value,
    goal: document.getElementById("pref-goal").value,
    manual_mood: document.getElementById("pref-manual-mood").value,
    language: document.getElementById("pref-language").value || "English",
    genres: document.getElementById("pref-genres").value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    exclude_genres: document.getElementById("pref-exclude-genres").value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    hide_explicit: document.getElementById("pref-hide-explicit").checked,
  };
}

function captureFrames(durationMs = 7000, intervalMs = 500) {
  return new Promise((resolve) => {
    if (!state.cameraStream) {
      state.frames = [];
      resolve([]);
      return;
    }

    const track = state.cameraStream.getVideoTracks()[0];
    const settings = track.getSettings();
    const canvas = document.createElement("canvas");
    canvas.width = settings.width || 640;
    canvas.height = settings.height || 480;
    const ctx = canvas.getContext("2d");

    const video = cameraEl;
    const frames = [];
    const start = Date.now();

    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      if (elapsed >= durationMs) {
        clearInterval(timer);
        state.frames = frames;
        resolve(frames);
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      frames.push(dataUrl.split(",")[1]);
    }, intervalMs);
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result || "";
      const parts = result.split(",");
      resolve(parts[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function recordAudio(durationMs = 7000) {
  if (!state.audioStream) {
    return;
  }
  const recorder = new MediaRecorder(state.audioStream);
  const chunks = [];
  recorder.ondataavailable = (event) => chunks.push(event.data);

  audioCard.classList.add("active");
  recorder.start();

  return new Promise((resolve) => {
    setTimeout(() => {
      recorder.stop();
      audioCard.classList.remove("active");
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        state.audioBase64 = await blobToBase64(blob);
        resolve();
      };
    }, durationMs);
  });
}

async function analyzeSession() {
  showScreen("processing");
  document.getElementById("processing-text").textContent =
    "Running full session analysis...";

  if (!state.frames.length && !state.audioBase64 && state.preferences.manual_mood) {
    state.moodResult = manualMoodToResult(state.preferences.manual_mood);
    const recommendations = await fetchRecommendations();
    const meme = await fetchMeme(recommendations);
    renderResults(recommendations, meme);
    return;
  }

  const response = await fetch(`${API_BASE}/analyze-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      frames: state.frames,
      audio: state.audioBase64,
      preferences: state.preferences,
    }),
  });
  const payload = await response.json();
  state.moodResult = payload.mood_result || {};
  renderResults(payload.recommendations || {}, payload.meme || null);
}

async function uploadDataset() {
  const input = document.getElementById("upload-files");
  const files = Array.from(input.files || []);
  if (!files.length) {
    setStatus("upload", "Please select files to upload.");
    return;
  }

  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  setStatus("upload", "Uploading files...");
  const uploadResponse = await fetch(`${API_BASE}/upload-dataset`, {
    method: "POST",
    body: formData,
  });
  const uploadResult = await uploadResponse.json();
  if (uploadResult.status !== "success") {
    setStatus("upload", uploadResult.reason || "Upload failed.");
    return;
  }
  // If server already built the index during upload, surface count and stop.
  if (typeof uploadResult.indexed_records === "number") {
    setStatus(
      "upload",
      `Uploaded ${uploadResult.files?.length || 0} file(s). Indexed ${uploadResult.indexed_records} records.`
    );
    return;
  }

  setStatus("upload", "Building index...");
  const buildResponse = await fetch(`${API_BASE}/build-index`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data_dir: "./data/uploads" }),
  });
  const buildResult = await buildResponse.json();
  if (buildResult.status !== "success") {
    setStatus("upload", buildResult.reason || "Index build failed.");
    return;
  }

  setStatus("upload", `Indexed ${buildResult.indexed_records} records.`);
}

async function buildDefaultIndex() {
  setStatus("upload", "Building index from data/... ");
  const response = await fetch(`${API_BASE}/build-index`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data_dir: "./data" }),
  });
  const result = await response.json();
  if (result.status !== "success") {
    setStatus("upload", result.reason || "Index build failed.");
    return;
  }
  setStatus("upload", `Indexed ${result.indexed_records} records.`);
}

async function fetchRecommendations() {
  const response = await fetch(`${API_BASE}/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mood_result: state.moodResult,
      preferences: state.preferences,
    }),
  });
  return response.json();
}

async function fetchMeme(recommendations) {
  const firstMovie = recommendations.movies?.[0]?.title;
  const firstSong = recommendations.songs?.[0]?.title;
  const response = await fetch(`${API_BASE}/generate-meme`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mood: state.moodResult.final_mood || "neutral",
      movie: firstMovie,
      song: firstSong,
    }),
  });
  return response.json();
}

function manualMoodToResult(mood) {
  const map = {
    happy: { valence: 0.85, arousal: 0.65 },
    sad: { valence: -0.75, arousal: -0.4 },
    calm: { valence: 0.5, arousal: -0.2 },
    angry: { valence: -0.7, arousal: 0.8 },
    neutral: { valence: 0.0, arousal: 0.2 },
    anxious: { valence: -0.3, arousal: 0.5 },
  };

  const va = map[mood] || map.neutral;
  return {
    status: "success",
    final_mood: mood,
    valence: va.valence,
    arousal: va.arousal,
    confidence: 1.0,
    source: "manual",
  };
}

function renderResults(recommendations, meme) {
  document.getElementById("result-mood").textContent =
    state.moodResult.final_mood || "unknown";
  document.getElementById("result-confidence").textContent =
    `Confidence: ${Number(state.moodResult.confidence || 0).toFixed(2)}`;
  document.getElementById("result-va").textContent =
    `Valence ${Number(state.moodResult.valence || 0).toFixed(2)}, Arousal ${Number(
      state.moodResult.arousal || 0
    ).toFixed(2)}`;
  drawValenceArousalChart(
    Number(state.moodResult.valence || 0),
    Number(state.moodResult.arousal || 0)
  );

  const movieList = document.getElementById("result-movies");
  movieList.innerHTML = "";
  (recommendations.movies || []).forEach((movie) => {
    const li = document.createElement("li");
    li.textContent = `${movie.title} — ${movie.reason}`;
    movieList.appendChild(li);
  });

  const songList = document.getElementById("result-songs");
  songList.innerHTML = "";
  (recommendations.songs || []).forEach((song) => {
    const li = document.createElement("li");
    li.textContent = `${song.title} — ${song.reason}`;
    songList.appendChild(li);
  });

  // Surface recommendation errors if present
  if (recommendations && recommendations.error) {
    const errNode = document.getElementById("recommendation-error") || document.getElementById("result-error");
    if (errNode) {
      errNode.textContent = String(recommendations.error);
    }
  }

  // Surface fusion/mood detection failures
  if (state.moodResult && state.moodResult.status && state.moodResult.status !== "success") {
    const moodErr = document.getElementById("result-error");
    if (moodErr) {
      moodErr.textContent = state.moodResult.reason || "Mood detection failed.";
    }
  }

  const memeImg = document.getElementById("result-meme");
  if (meme && meme.image_base64) {
    memeImg.src = `data:image/png;base64,${meme.image_base64}`;
    document.getElementById("result-meme-text").textContent =
      `${meme.top_text} / ${meme.bottom_text}`;
  } else {
    memeImg.removeAttribute("src");
    document.getElementById("result-meme-text").textContent =
      "Meme not available.";
  }

  showScreen("results");
}

function drawValenceArousalChart(valence, arousal) {
  const canvas = document.getElementById("result-va-chart");
  if (!canvas) {
    return;
  }
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fff9f2";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#e0d7cf";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width / 2, 10);
  ctx.lineTo(width / 2, height - 10);
  ctx.moveTo(10, height / 2);
  ctx.lineTo(width - 10, height / 2);
  ctx.stroke();

  const x = ((valence + 1) / 2) * (width - 20) + 10;
  const y = (1 - (arousal + 1) / 2) * (height - 20) + 10;

  ctx.fillStyle = "#ff7a5c";
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();
}

function bindActions() {
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.action;
      if (action === "start") {
        showScreen("permissions");
      }
      if (action === "upload") {
        showScreen("upload");
      }
      if (action === "skip") {
        showScreen("preferences");
      }
      if (action === "enable-camera") {
        await enableCamera();
      }
      if (action === "enable-mic") {
        await enableMic();
      }
      if (action === "to-preferences") {
        showScreen("preferences");
      }
      if (action === "to-capture") {
        readPreferences();
        showScreen("capture");
      }
      if (action === "record") {
        setStatus("capture", "Recording for 7 seconds...");
        await Promise.all([captureFrames(), recordAudio()]);
        const audioSize = (state.audioBase64 ? state.audioBase64.length : 0);
        setStatus(
          "capture",
          `Recording complete. Frames: ${state.frames.length}, audio size (base64 chars): ${audioSize}`
        );
        console.log("[MoodApp] Frames captured:", state.frames.length, "Audio base64 length:", audioSize);
      }
      if (action === "retake") {
        state.frames = [];
        state.audioBase64 = null;
        setStatus("capture", "Ready to record again.");
        showScreen("capture");
      }
      if (action === "analyze") {
        setStatus("capture", "Sending data to server...");
        await analyzeSession();
      }
      if (action === "to-feedback") {
        showScreen("feedback");
      }
      if (action === "finish") {
        await fetch("/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            detected_mood: state.moodResult?.final_mood,
            mood_accuracy: document.getElementById("feedback-accuracy").value,
            recommendation_feedback: document.getElementById("feedback-like").value,
          }),
        });
        showScreen("end");
      }
      if (action === "submit-upload") {
        await uploadDataset();
      }
      if (action === "build-default") {
        await buildDefaultIndex();
      }
      if (action === "restart") {
        showScreen("landing");
      }
    });
  });
}

bindActions();
showScreen("landing");
