"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { SessionResult, Recommendations } from "@/lib/api";
import MemeCard from "./MemeCard";

type ResultData = Pick<SessionResult, "mood_result" | "recommendations" | "meme"> | {
  mood_result: null;
  recommendations: Recommendations;
  meme: null;
};

interface ResultCardsProps {
  data: ResultData | null;
  isAnalyzing: boolean;
  onRefreshMeme?: () => void;
}

const MOODS_EMOJI: Record<string, string> = {
  happy: "😄", sad: "😔", angry: "😡", neutral: "😐",
  calm: "😌", surprised: "😲", fear: "😨", disgust: "🤢",
  anxious: "😰", excited: "🤩",
};

function SkeletonCard() {
  return (
    <div className="glass rounded-sm p-4 space-y-3">
      <div className="skeleton h-3 w-24 rounded" />
      <div className="skeleton h-7 w-40 rounded" />
      <div className="skeleton h-3 w-full rounded" />
      <div className="skeleton h-3 w-3/4 rounded" />
    </div>
  );
}

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.5, ease: "easeOut" as const },
  }),
};

export default function ResultCards({ data, isAnalyzing }: ResultCardsProps) {
  if (!isAnalyzing && !data) {
    return (
      <div className="space-y-3">
        <div className="glass rounded-sm p-6 flex flex-col items-center justify-center text-center min-h-[200px]">
          <div className="w-10 h-10 border border-[#1a1a1a] rotate-45 flex items-center justify-center mb-4">
            <div className="w-3 h-3 bg-[#222] rotate-[-45deg]" />
          </div>
          <p className="font-mono text-xs text-[#333] tracking-widest">AWAITING ANALYSIS</p>
          <p className="text-[#2a2a2a] text-xs mt-2">
            Start recording to see results
          </p>
        </div>
      </div>
    );
  }

  if (isAnalyzing) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  const mood = data?.mood_result;
  const recs = data?.recommendations as (Recommendations & { error?: string }) | undefined;
  const meme = data?.meme;
  const moodKey = mood?.final_mood?.toLowerCase() ?? "neutral";
  const emoji = MOODS_EMOJI[moodKey] ?? "🔍";

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {/* Card 1 — Mood */}
        <motion.div
          key="mood"
          custom={0}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="glass rounded-sm p-5"
        >
          <div className="font-mono text-xs text-[#888] tracking-widest uppercase mb-3">
            Detected Mood
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl">{emoji}</span>
            <div>
              <div className="font-display text-3xl font-semibold capitalize text-[#f0f0f0]">
                {mood?.final_mood ?? "—"}
              </div>
              <div className="font-mono text-[11px] text-[#555] mt-0.5">
                Confidence:{" "}
                <span className="text-[#00d8d6]">
                  {mood?.confidence != null ? `${(mood.confidence * 100).toFixed(0)}%` : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Valence / Arousal bars */}
          {mood?.valence != null && mood?.arousal != null && (
            <div className="mt-4 space-y-2">
              {[
                { label: "Valence", value: (mood.valence + 1) / 2 },
                { label: "Arousal", value: (mood.arousal + 1) / 2 },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="flex justify-between font-mono text-xs text-[#888] mb-1">
                    <span>{label}</span>
                    <span className="text-[#555]">{(value * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-px bg-[#1a1a1a] rounded overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-[#00d8d6]/40 to-[#00d8d6]"
                      initial={{ width: 0 }}
                      animate={{ width: `${value * 100}%` }}
                      transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Card 2 — Movie */}
        {recs?.movies?.[0] && (
          <motion.div
            key="movie"
            custom={1}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="glass rounded-sm p-4"
          >
            <div className="font-mono text-xs text-[#888] tracking-widest uppercase mb-2">
              Recommended Movie
            </div>
            <div className="font-display text-base font-medium text-[#e0e0e0]">
              {recs.movies[0].title}
            </div>
            <div className="flex items-center gap-2 mt-1.5 mb-2">
              <div className="font-mono text-xs text-[#00d8d6]">
                Score: {(recs.movies[0].score * 100).toFixed(0)}%
              </div>
            </div>
            <p className="text-[#555] text-xs leading-relaxed line-clamp-3">
              {recs.movies[0].reason}
            </p>
          </motion.div>
        )}

        {/* Card 3 — Song */}
        {recs?.songs?.[0] && (
          <motion.div
            key="song"
            custom={2}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="glass rounded-sm p-4"
          >
            <div className="font-mono text-xs text-[#888] tracking-widest uppercase mb-2">
              Recommended Song
            </div>
            <div className="font-display text-base font-medium text-[#e0e0e0]">
              {recs.songs[0].title}
            </div>
            <div className="flex items-center gap-2 mt-1.5 mb-2">
              <div className="font-mono text-xs text-[#f59e0b]">
                Score: {(recs.songs[0].score * 100).toFixed(0)}%
              </div>
            </div>
            <p className="text-[#555] text-xs leading-relaxed line-clamp-3">
              {recs.songs[0].reason}
            </p>
          </motion.div>
        )}

        {/* Card 4 — Meme */}
        {meme?.memeUrl && (
          <motion.div
            key="meme"
            custom={3}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
          >
            <MemeCard
              memeUrl={meme.memeUrl}
              top={meme.caption?.top ?? null}
              bottom={meme.caption?.bottom ?? null}
              onRefresh={onRefreshMeme}
            />
          </motion.div>
        )}

        {/* Error */}
        {recs?.error && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-mono text-[11px] text-[#ef4444]/60 px-2"
          >
            {recs.error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
