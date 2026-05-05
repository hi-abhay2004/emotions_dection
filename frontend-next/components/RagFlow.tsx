"use client";

import { motion, useAnimationControls } from "framer-motion";
import { useEffect, useState } from "react";

const NODES = [
  { id: "input", label: "Input", sub: "face + voice" },
  { id: "emotion", label: "Emotion", sub: "DeepFace / Wav2Vec2" },
  { id: "embed", label: "Embedding", sub: "sentence-transformers" },
  { id: "search", label: "Vector Search", sub: "ChromaDB cosine" },
  { id: "results", label: "Results", sub: "movies + songs" },
];

const FLOAT_LABELS = [
  { text: "embedding generated", step: 2 },
  { text: "similarity: 0.82", step: 3 },
  { text: "top-k retrieved", step: 4 },
  { text: "LLM explanation", step: 4 },
];

interface RagFlowProps {
  activeStep?: number; // 0-4, which node is "active"
}

export default function RagFlow({ activeStep = -1 }: RagFlowProps) {
  const [floatLabel, setFloatLabel] = useState<string | null>(null);

  // Cycle float labels based on active step
  useEffect(() => {
    const label = FLOAT_LABELS.find((f) => f.step === activeStep);
    if (label) {
      setFloatLabel(label.text);
      const t = setTimeout(() => setFloatLabel(null), 2000);
      return () => clearTimeout(t);
    }
  }, [activeStep]);

  return (
    <div className="glass rounded-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="font-mono text-[10px] text-[#444] tracking-widest uppercase">
            RAG Pipeline
          </div>
          <div className="font-display text-sm text-[#666] mt-0.5">
            How your mood becomes recommendations
          </div>
        </div>
        {floatLabel && (
          <motion.div
            key={floatLabel}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="font-mono text-[10px] text-[#00d8d6]/70 bg-[#00d8d6]/5 border border-[#00d8d6]/15 px-3 py-1 rounded-sm"
          >
            {floatLabel}
          </motion.div>
        )}
      </div>

      {/* Pipeline */}
      <div className="relative flex items-center gap-0">
        {NODES.map((node, i) => {
          const isActive = i === activeStep;
          const isPast = i < activeStep;

          return (
            <div key={node.id} className="flex items-center flex-1">
              {/* Node */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={`relative w-14 h-14 border rounded-sm flex items-center justify-center transition-all duration-500 ${
                    isActive
                      ? "border-[#00d8d6] bg-[#00d8d6]/8"
                      : isPast
                      ? "border-[#00d8d6]/25 bg-[#00d8d6]/3"
                      : "border-[#1d1d1d] bg-[#0d0d0d]"
                  }`}
                >
                  {/* Index number */}
                  <span
                    className={`font-mono text-lg font-bold transition-colors duration-500 ${
                      isActive ? "text-[#00d8d6]" : isPast ? "text-[#00d8d6]/30" : "text-[#222]"
                    }`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  {/* Active pulse ring */}
                  {isActive && (
                    <motion.div
                      className="absolute inset-0 border border-[#00d8d6]/40 rounded-sm"
                      animate={{ scale: [1, 1.15, 1], opacity: [0.8, 0, 0.8] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  )}
                </div>

                <div className="mt-2 text-center">
                  <div
                    className={`font-display text-[11px] font-medium transition-colors duration-500 ${
                      isActive ? "text-[#e0e0e0]" : isPast ? "text-[#555]" : "text-[#333]"
                    }`}
                  >
                    {node.label}
                  </div>
                  <div className="font-mono text-[9px] text-[#2a2a2a] mt-0.5 max-w-[72px] leading-tight">
                    {node.sub}
                  </div>
                </div>
              </div>

              {/* Connector line */}
              {i < NODES.length - 1 && (
                <div className="flex-1 relative h-px mx-2 mt-[-24px]">
                  <div className="absolute inset-0 bg-[#1a1a1a]" />
                  <motion.div
                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-[#00d8d6]/40 to-[#00d8d6]/10"
                    initial={{ width: "0%" }}
                    animate={{ width: i < activeStep ? "100%" : "0%" }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                  {/* Animated dot */}
                  {i === activeStep - 1 && (
                    <motion.div
                      className="absolute top-[-2px] w-1.5 h-1.5 rounded-full bg-[#00d8d6]"
                      animate={{ x: ["0%", "100%"] }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-6 pt-4 border-t border-[rgba(255,255,255,0.04)]">
        {[
          { color: "bg-[#1d1d1d]", label: "Pending" },
          { color: "bg-[#00d8d6]", label: "Active" },
          { color: "bg-[#00d8d6]/30", label: "Complete" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-sm ${color}`} />
            <span className="font-mono text-[10px] text-[#333]">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
