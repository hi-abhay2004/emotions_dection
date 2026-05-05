"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { analyzeSession, generateMeme, type SessionResult, type Recommendations } from "@/lib/api";
import FaceScanner from "@/components/FaceScanner";
import AudioWave from "@/components/AudioWave";
import ResultCards from "@/components/ResultCards";
import RagFlow from "@/components/RagFlow";
import MoodSimulator from "@/components/MoodSimulator";
import FaceScanLoader from "@/components/FaceScanLoader";

type DemoState = "idle" | "initializing" | "recording" | "analyzing" | "done";

export default function DemoPage() {
  const [demoState, setDemoState] = useState<DemoState>("idle");
  const [result, setResult] = useState<SessionResult | null>(null);
  const [ragStep, setRagStep] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  const framesRef = useRef<string[]>([]);
  const audioRef = useRef<string | null>(null);
  const framesReadyRef = useRef(false);
  const audioReadyRef = useRef(false);

  // Called when enough frames are captured
  const handleFramesCaptured = useCallback((frames: string[]) => {
    framesRef.current = frames;
    framesReadyRef.current = true;
    maybeAnalyze();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Called when audio recording is done
  const handleAudioCaptured = useCallback((audio: string) => {
    audioRef.current = audio;
    audioReadyRef.current = true;
    maybeAnalyze();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Only run once both are ready
  const maybeAnalyze = async () => {
    if (!framesReadyRef.current || !audioReadyRef.current) return;
    // Prevent double-call
    framesReadyRef.current = false;
    audioReadyRef.current = false;

    setDemoState("analyzing");
    setError(null);
    setRagStep(1);

    try {
      setTimeout(() => setRagStep(2), 600);
      setTimeout(() => setRagStep(3), 1800);
      setTimeout(() => setRagStep(4), 3000);

      const data = await analyzeSession({
        frames: framesRef.current,
        audio: audioRef.current ?? undefined,
        preferences: { content_type: "both", goal: "match" },
      });

      setResult(data);
      setRagStep(5);
      setDemoState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
      setDemoState("idle");
      setRagStep(-1);
    }
  };

  const handleStart = () => {
    if (demoState === "recording" || demoState === "initializing") return;
    setResult(null);
    setRagStep(0);
    setError(null);
    
    // Phase 1: Initialize (3s loader)
    setDemoState("initializing");
    
    setTimeout(() => {
      // Phase 2: Start Recording
      framesRef.current = [];
      audioRef.current = null;
      framesReadyRef.current = false;
      audioReadyRef.current = false;
      setDemoState("recording");
    }, 3000);
  };

  const handleReset = () => {
    setDemoState("idle");
    setResult(null);
    setRagStep(-1);
    setError(null);
  };

  // Simulation results (bypasses camera)
  const handleSimulatedResults = useCallback(
    (recs: Recommendations, mood: string, meme: any) => {
      setResult({
        face_result: null,
        audio_result: null,
        mood_result: {
          status: "success",
          final_mood: mood,
          valence: recs.movies[0] ? 0.5 : 0.3,
          arousal: 0.4,
          confidence: 0.9,
        },
        recommendations: recs,
        meme: meme,
        metrics: {},
      });
      setRagStep(5);
      setDemoState("done");
    },
    []
  );

  const handleRefreshMeme = useCallback(async () => {
    if (!result?.mood_result || !result.recommendations) return;
    try {
      const movie = result.recommendations.movies[0]?.title;
      const song = result.recommendations.songs[0]?.title;
      const newMeme = await generateMeme({
        mood: result.mood_result.final_mood || "neutral",
        movie,
        song
      });
      setResult(prev => prev ? { ...prev, meme: newMeme } : null);
    } catch (err) {
      console.error("Failed to refresh meme", err);
    }
  }, [result]);

  return (
    <div className="min-h-screen bg-[#050505]">
      <AnimatePresence>
        {(demoState === "initializing" || demoState === "analyzing") && <FaceScanLoader />}
      </AnimatePresence>
      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-[rgba(255,255,255,0.05)] bg-[rgba(5,5,5,0.92)] backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-12 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-5 h-5 border border-[#00d8d6]/50 rotate-45 flex items-center justify-center group-hover:border-[#00d8d6] transition-colors">
              <div className="w-1.5 h-1.5 bg-[#00d8d6]/60 group-hover:bg-[#00d8d6] transition-colors" />
            </div>
            <span className="font-mono text-xs tracking-[0.25em] text-[#888] group-hover:text-[#aaa] transition-colors uppercase">
              MoodSense AI
            </span>
          </Link>

          <div className="flex items-center gap-6">
            {/* State indicator */}
            <div className={`flex items-center gap-2 font-mono text-[11px] tracking-widest uppercase ${
              demoState === "analyzing" ? "text-[#f59e0b]" :
              demoState === "recording" ? "text-[#ef4444]" :
              demoState === "done" ? "text-[#00d8d6]" : "text-[#444]"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                demoState === "analyzing" ? "bg-[#f59e0b] animate-pulse" :
                demoState === "recording" ? "bg-[#ef4444] animate-pulse" :
                demoState === "done" ? "bg-[#00d8d6]" : "bg-[#222]"
              }`} />
              {demoState}
            </div>

            {demoState === "done" && (
              <button
                onClick={handleReset}
                className="font-mono text-[11px] text-[#666] hover:text-[#aaa] tracking-widest uppercase transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 pt-20 pb-16">
        {/* Page header */}
        <div className="mb-8 pt-4">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="font-mono text-[10px] text-[#444] tracking-widest uppercase mb-2">
              Live Analysis
            </div>
            <h1 className="font-display text-3xl font-semibold text-[#e0e0e0]">
              Mood Detection Studio
            </h1>
          </motion.div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
          {/* LEFT — Camera + audio + controls */}
          <div className="space-y-4">
            <FaceScanner
              onFramesCaptured={handleFramesCaptured}
              isRecording={demoState === "recording"}
              isAnalyzing={demoState === "analyzing"}
            />

            <AudioWave
              isRecording={demoState === "recording"}
              onAudioCaptured={handleAudioCaptured}
            />

            {/* Control row */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleStart}
                disabled={demoState === "recording" || demoState === "analyzing" || demoState === "initializing"}
                suppressHydrationWarning
                className="relative flex-1 py-3 font-display font-medium text-sm tracking-wide border rounded-sm overflow-hidden transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed
                  border-[#00d8d6]/40 text-[#00d8d6] hover:border-[#00d8d6] hover:bg-[#00d8d6]/5 active:scale-[0.98]"
              >
                <AnimatePresence mode="wait">
                  {demoState === "initializing" ? (
                    <motion.span
                      key="init"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-center gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00d8d6] animate-pulse" />
                      Initializing...
                    </motion.span>
                  ) : demoState === "recording" ? (
                    <motion.span
                      key="rec"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-center gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] animate-pulse" />
                      Recording... (7s)
                    </motion.span>
                  ) : demoState === "analyzing" ? (
                    <motion.span
                      key="analyzing"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-center gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-pulse" />
                      Analyzing...
                    </motion.span>
                  ) : (
                    <motion.span
                      key="start"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      ▸ Start Analysis (7s)
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>

              {demoState === "done" && (
                <motion.button
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleReset}
                  className="px-6 py-3 border border-[#1d1d1d] text-[#555] font-display text-sm rounded-sm hover:border-[#2a2a2a] hover:text-[#888] transition-colors"
                >
                  Retake
                </motion.button>
              )}
            </div>

            {/* Error */}
            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-mono text-[11px] text-[#ef4444]/70"
              >
                ✕ {error}
              </motion.p>
            )}

            {/* Hint text */}
            {demoState === "idle" && !result && (
              <p className="font-mono text-xs text-[#666] leading-relaxed mt-4">
                Allow camera + microphone access when prompted. The system captures 8 frames and 7s of audio for analysis.
              </p>
            )}

            {/* RAG Flow visualization */}
            <div className="mt-2">
              <RagFlow activeStep={ragStep} />
            </div>

            {/* Mood Simulator */}
            <MoodSimulator onResults={handleSimulatedResults} />
          </div>

          {/* RIGHT — Results panel */}
          <div>
            <div className="sticky top-16">
              <div className="font-mono text-[10px] text-[#333] tracking-widest uppercase mb-3">
                Analysis Results
              </div>
              <div className="overflow-y-auto max-h-[calc(100vh-8rem)] pr-1">
                <ResultCards
                  data={result}
                  isAnalyzing={demoState === "analyzing"}
                  onRefreshMeme={handleRefreshMeme}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
