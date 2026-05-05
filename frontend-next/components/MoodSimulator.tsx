"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { recommend } from "@/lib/api";
import type { Recommendations, MemeResult } from "@/lib/api";

const MOODS = [
  { key: "happy", emoji: "😄", valence: 0.8, arousal: 0.7 },
  { key: "sad", emoji: "😔", valence: -0.7, arousal: -0.3 },
  { key: "angry", emoji: "😡", valence: -0.6, arousal: 0.8 },
  { key: "calm", emoji: "😌", valence: 0.3, arousal: -0.5 },
  { key: "anxious", emoji: "😰", valence: -0.4, arousal: 0.6 },
];

interface MoodSimulatorProps {
  onResults: (recs: Recommendations, mood: string, meme: MemeResult | null) => void;
}

export default function MoodSimulator({ onResults }: MoodSimulatorProps) {
  const [activeMood, setActiveMood] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const handleMood = async (mood: typeof MOODS[0]) => {
    if (loading) return;
    setActiveMood(mood.key);
    setLoading(mood.key);

    try {
      const recs = await recommend(
        {
          status: "success",
          final_mood: mood.key,
          valence: mood.valence,
          arousal: mood.arousal,
          confidence: 0.9,
        },
        { content_type: "both", goal: "match" }
      );

      // Also simulate meme generation
      let meme = null;
      try {
        const { generateMeme } = await import("@/lib/api");
        meme = await generateMeme({
          mood: mood.key,
          movie: recs.movies[0]?.title,
          song: recs.songs[0]?.title,
        });
      } catch (e) {
        console.error("Simulated meme error:", e);
      }

      onResults(recs, mood.key, meme);
    } catch (err) {
      console.error("Recommend error:", err);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="glass rounded-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-mono text-[10px] text-[#444] tracking-widest uppercase">
            Quick Simulation
          </div>
          <div className="text-[#555] text-xs mt-0.5">
            Test recommendations without camera
          </div>
        </div>
        {loading && (
          <div className="font-mono text-[10px] text-[#00d8d6]/60 animate-pulse">
            fetching...
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {MOODS.map((mood) => (
          <motion.button
            key={mood.key}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => handleMood(mood)}
            suppressHydrationWarning
            disabled={!!loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-sm border text-sm font-display transition-all duration-200 disabled:opacity-50 ${
              activeMood === mood.key
                ? "border-[#00d8d6]/50 bg-[#00d8d6]/8 text-[#e0e0e0]"
                : "border-[#1d1d1d] bg-transparent text-[#555] hover:border-[#2a2a2a] hover:text-[#888]"
            }`}
          >
            <span className="text-lg">{mood.emoji}</span>
            <span className="capitalize">{mood.key}</span>
            {loading === mood.key && (
              <motion.span
                className="w-1.5 h-1.5 rounded-full bg-[#00d8d6]"
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
