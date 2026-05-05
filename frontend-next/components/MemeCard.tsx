"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface MemeCardProps {
  imageBase64: string | null;
  topText: string | null;
  bottomText: string | null;
}

export default function MemeCard({ imageBase64, topText, bottomText }: MemeCardProps) {
  const [typedCaption, setTypedCaption] = useState("");
  const fullCaption = [topText, bottomText].filter(Boolean).join(" / ");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Typewriter effect for caption
  useEffect(() => {
    if (!fullCaption) { setTypedCaption(""); return; }
    setTypedCaption("");
    let i = 0;
    timerRef.current = setInterval(() => {
      i++;
      setTypedCaption(fullCaption.slice(0, i));
      if (i >= fullCaption.length && timerRef.current) {
        clearInterval(timerRef.current);
      }
    }, 35);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fullCaption]);

  if (!imageBase64) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="glass rounded-sm overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[rgba(255,255,255,0.05)]">
        <span className="font-mono text-[10px] text-[#555] tracking-widest uppercase">Generated Meme</span>
        <span className="font-mono text-[9px] text-[#00d8d6]/50 tracking-widest">REAL-TIME</span>
      </div>

      <div className="relative">
        <img
          src={`data:image/png;base64,${imageBase64}`}
          alt="Generated meme"
          className="w-full object-cover"
        />
      </div>

      <div className="px-4 py-3">
        <p className="font-mono text-xs text-[#888] leading-relaxed min-h-[2.5rem]">
          {typedCaption}
          <span className="inline-block w-1.5 h-3 bg-[#00d8d6]/60 ml-0.5 animate-[blink_1s_step-end_infinite] align-middle" />
        </p>
      </div>
    </motion.div>
  );
}
