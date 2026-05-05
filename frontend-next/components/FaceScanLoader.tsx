"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

const SCAN_LINES = [
  "Extracting biometric features...",
  "Analyzing micro-expressions...",
  "Encoding valence/arousal vectors...",
  "Retrieving similar mood patterns...",
  "Synthesizing recommendations...",
];

export default function FaceScanLoader() {
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setLineIndex((i) => (i + 1) % SCAN_LINES.length);
    }, 800);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-[#050505]/90 backdrop-blur-xl flex flex-col items-center justify-center"
    >
      {/* Scanning Animation Container */}
      <div className="relative w-64 h-64 mb-12">
        {/* Face Outline (Simplified Sci-Fi Hex/Circle) */}
        <div className="absolute inset-0 border border-[#00d8d6]/10 rounded-full" />
        <motion.div
          className="absolute inset-4 border border-[#00d8d6]/20 rounded-full"
          animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Scanning Bar */}
        <motion.div
          className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#00d8d6] to-transparent z-10"
          animate={{ top: ["0%", "100%", "0%"] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
        />

        {/* Grid Background inside circle */}
        <div className="absolute inset-0 rounded-full overflow-hidden opacity-20">
          <div
            className="w-full h-full"
            style={{
              backgroundImage: `linear-gradient(#00d8d6 1px, transparent 1px), linear-gradient(90deg, #00d8d6 1px, transparent 1px)`,
              backgroundSize: "20px 20px",
            }}
          />
        </div>

        {/* Pulsing Dots */}
        {[0, 90, 180, 270].map((angle) => (
          <motion.div
            key={angle}
            className="absolute w-1.5 h-1.5 bg-[#00d8d6] rounded-full"
            style={{
              top: "50%",
              left: "50%",
              transform: `rotate(${angle}deg) translate(128px) rotate(-${angle}deg)`,
            }}
            animate={{ opacity: [0.2, 1, 0.2], scale: [1, 1.5, 1] }}
            transition={{ duration: 2, repeat: Infinity, delay: angle / 360 }}
          />
        ))}

        {/* Center UI - AI Face */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="w-full h-full p-6 opacity-80">
            {/* Corner Brackets */}
            <path d="M 20 30 L 20 20 L 30 20" fill="none" stroke="#00d8d6" strokeWidth="1" />
            <path d="M 80 30 L 80 20 L 70 20" fill="none" stroke="#00d8d6" strokeWidth="1" />
            <path d="M 20 70 L 20 80 L 30 80" fill="none" stroke="#00d8d6" strokeWidth="1" />
            <path d="M 80 70 L 80 80 L 70 80" fill="none" stroke="#00d8d6" strokeWidth="1" />
            
            {/* Low-Poly Face Wireframe */}
            <g fill="none" stroke="#00d8d6" strokeWidth="0.5" strokeLinejoin="round">
              <polygon points="50,15 75,30 70,65 50,85 30,65 25,30" strokeDasharray="1 2" />
              <polygon points="50,15 65,35 50,45 35,35" />
              <polygon points="25,30 35,35 50,45" />
              <polygon points="75,30 65,35 50,45" />
              <polygon points="30,65 35,35 45,55 50,45 55,55 65,35 70,65" />
              <polygon points="50,85 45,55 50,75 55,55" />
              <polygon points="30,65 50,75 70,65" />
            </g>

            {/* Neural Nodes (Eyes, Nose, Chin) */}
            <circle cx="35" cy="35" r="1.5" fill="#00d8d6" />
            <circle cx="65" cy="35" r="1.5" fill="#00d8d6" />
            <circle cx="50" cy="45" r="1.5" fill="#00d8d6" />
            <circle cx="50" cy="75" r="1" fill="#00d8d6" />
            <circle cx="45" cy="55" r="1" fill="#00d8d6" />
            <circle cx="55" cy="55" r="1" fill="#00d8d6" />
          </svg>
        </div>
      </div>

      {/* Text Sequence */}
      <div className="text-center h-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={lineIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="font-mono text-xs text-[#666] tracking-wider"
          >
            {SCAN_LINES[lineIndex]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress Ring */}
      <div className="mt-12 w-48 h-1 bg-[#111] rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-[#00d8d6]"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 4.5, ease: "easeInOut" }}
        />
      </div>
    </motion.div>
  );
}
