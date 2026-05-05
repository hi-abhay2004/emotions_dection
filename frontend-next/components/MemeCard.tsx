"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface MemeCardProps {
  memeUrl: string | null;
  top: string | null;
  bottom: string | null;
  onRefresh?: () => void;
}

export default function MemeCard({ memeUrl, top, bottom, onRefresh }: MemeCardProps) {
  const [typedCaption, setTypedCaption] = useState("");
  const fullCaption = [top, bottom].filter(Boolean).join(" / ");
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

  if (!memeUrl) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ 
        type: "spring",
        damping: 20,
        stiffness: 100,
        opacity: { duration: 0.6 } 
      }}
      className="glass rounded-sm overflow-hidden group relative"
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[rgba(255,255,255,0.05)]">
        <span className="font-mono text-[10px] text-[#555] tracking-widest uppercase">Visual Representation</span>
        {onRefresh && (
          <button 
            onClick={onRefresh}
            className="font-mono text-[9px] text-[#00d8d6] hover:text-[#00d8d6]/80 tracking-widest uppercase transition-colors"
          >
            [ Generate Another ]
          </button>
        )}
      </div>

      <div className="relative overflow-hidden">
        <motion.img
          src={memeUrl}
          alt="Generated meme"
          className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent opacity-40" />
      </div>

      <div className="px-4 py-4 bg-[#080808]/80 backdrop-blur-sm border-t border-[rgba(255,255,255,0.03)]">
        <p className="font-mono text-xs text-[#888] leading-relaxed min-h-[3rem]">
          <span className="text-[#00d8d6]/40 mr-2">»</span>
          {typedCaption}
          <span className="inline-block w-1.5 h-3 bg-[#00d8d6]/60 ml-0.5 animate-[blink_1s_step-end_infinite] align-middle" />
        </p>
      </div>
    </motion.div>
  );
}
