// lib/api.ts — All typed fetch helpers for the Flask backend
// Next.js rewrites /api/* → http://127.0.0.1:5000/*

const BASE = "/api";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface MoodResult {
  status: "success" | "error" | "no_input";
  final_mood?: string;
  valence?: number;
  arousal?: number;
  confidence?: number;
  reason?: string;
}

export interface RecommendationItem {
  title: string;
  score: number;
  reason: string;
  metadata: Record<string, unknown>;
}

export interface Recommendations {
  query?: string;
  movies: RecommendationItem[];
  songs: RecommendationItem[];
  explain_error?: string;
}

export interface MemeResult {
  emotion?: string;
  caption?: {
    top: string;
    bottom: string;
  };
  memeUrl: string | null;
  error?: string;
}

export interface SessionResult {
  face_result: MoodResult | null;
  audio_result: MoodResult | null;
  mood_result: MoodResult;
  recommendations: Recommendations & { error?: string };
  meme: MemeResult | null;
  metrics: Record<string, number>;
}

export interface Preferences {
  content_type?: "both" | "movies" | "songs";
  goal?: "match" | "improve";
  language?: string;
  genres?: string[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ reason: res.statusText }));
    throw new Error(err.reason ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ──────────────────────────────────────────────────────────────────────────────
// API calls
// ──────────────────────────────────────────────────────────────────────────────

export async function checkHealth(): Promise<{ status: string }> {
  return request("/health");
}

export async function analyzeSession(payload: {
  frames: string[];
  audio?: string;
  preferences?: Preferences;
}): Promise<SessionResult> {
  return request("/analyze-session", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function recommend(
  moodResult: MoodResult,
  preferences?: Preferences
): Promise<Recommendations> {
  return request("/recommend", {
    method: "POST",
    body: JSON.stringify({ mood_result: moodResult, preferences }),
  });
}

export async function generateMeme(payload: {
  mood: string;
  movie?: string;
  song?: string;
}): Promise<MemeResult> {
  return request("/generate-meme", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function buildIndex(dataDir = "./data"): Promise<{ indexed_records: number }> {
  return request("/build-index", {
    method: "POST",
    body: JSON.stringify({ data_dir: dataDir }),
  });
}
