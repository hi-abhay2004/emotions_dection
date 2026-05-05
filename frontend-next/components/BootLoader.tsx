"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { checkHealth } from "@/lib/api";

const BOOT_LINES = [
  "Initializing neural layers...",
  "Calibrating multimodal sensors...",
  "Loading embedding index...",
  "Connecting to intelligence core...",
  "System ready.",
];

interface BootLoaderProps {
  onComplete: () => void;
}

export default function BootLoader({ onComplete }: BootLoaderProps) {
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const [status, setStatus] = useState<"booting" | "success" | "error">("booting");
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const completedRef = useRef(false);

  // Particle background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: { x: number; y: number; vx: number; vy: number; a: number }[] = [];
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        a: Math.random() * 0.4 + 0.05,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 216, 214, ${p.a})`;
        ctx.fill();
      });
      // Draw faint connecting lines between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 90) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(0, 216, 214, ${0.04 * (1 - dist / 90)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      animFrameRef.current = requestAnimationFrame(draw);
    };
    draw();

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Boot sequence
  useEffect(() => {
    let lineIndex = 0;
    let cancelled = false;

    const showNextLine = () => {
      if (cancelled || lineIndex >= BOOT_LINES.length) return;
      setVisibleLines((prev) => [...prev, BOOT_LINES[lineIndex]]);
      setProgress(Math.round(((lineIndex + 1) / BOOT_LINES.length) * 100));
      lineIndex++;
    };

    const intervals: ReturnType<typeof setTimeout>[] = [];

    BOOT_LINES.forEach((_, i) => {
      intervals.push(setTimeout(showNextLine, i * 600));
    });

    // Health check
    const healthTimeout = setTimeout(async () => {
      try {
        await checkHealth();
        if (!cancelled) setStatus("success");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }, 800);

    intervals.push(healthTimeout);

    return () => {
      cancelled = true;
      intervals.forEach(clearTimeout);
    };
  }, []);

  // Transition to hero when both boot lines done AND status known
  useEffect(() => {
    if (completedRef.current) return;
    if (
      visibleLines.length === BOOT_LINES.length &&
      (status === "success" || status === "error")
    ) {
      completedRef.current = true;
      setTimeout(onComplete, 900);
    }
  }, [visibleLines, status, onComplete]);

  return (
    <motion.div
      className="fixed inset-0 bg-[#050505] flex flex-col items-center justify-center z-50 overflow-hidden"
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.7, ease: "easeInOut" }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      <div className="relative z-10 w-full max-w-lg px-8">
        {/* Logo mark */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-10"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-7 h-7 border border-[#00d8d6]/60 rotate-45 flex items-center justify-center">
              <div className="w-2.5 h-2.5 bg-[#00d8d6]" />
            </div>
            <span className="font-display text-sm tracking-[0.25em] text-[#888] uppercase">
              MoodSense AI
            </span>
          </div>
          <div className="h-px w-full bg-gradient-to-r from-[#00d8d6]/30 via-[#00d8d6]/10 to-transparent" />
        </motion.div>

        {/* Boot lines */}
        <div className="space-y-2 mb-8 min-h-[160px]">
          <AnimatePresence>
            {visibleLines.map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className={`font-mono text-xs tracking-wider flex items-center gap-2 ${
                  i === visibleLines.length - 1
                    ? status === "error"
                      ? "text-red-400"
                      : "text-[#00d8d6]"
                    : "text-[#444]"
                }`}
              >
                <span className="text-[#333]">
                  {i === visibleLines.length - 1 ? "›" : "·"}
                </span>
                {line}
                {i === visibleLines.length - 1 && (
                  <span className="inline-block w-1.5 h-3 bg-current ml-0.5 animate-[blink_1s_step-end_infinite]" />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Progress bar */}
        <div className="relative">
          <div className="h-px w-full bg-[#1a1a1a] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-[#00d8d6]/60 to-[#00d8d6]"
              initial={{ width: "0%" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="font-mono text-[10px] text-[#333] tracking-widest uppercase">
              {status === "error" ? "Connection failed — offline mode" : "System boot"}
            </span>
            <span className="font-mono text-[10px] text-[#555]">{progress}%</span>
          </div>
        </div>

        {/* Status indicator */}
        {status !== "booting" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`mt-6 text-[11px] font-mono tracking-widest ${
              status === "success" ? "text-[#00d8d6]" : "text-red-400"
            }`}
          >
            {status === "success"
              ? "▸ BACKEND CONNECTED"
              : "▸ RUNNING IN DEMO MODE"}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
