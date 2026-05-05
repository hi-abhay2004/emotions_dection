"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface FaceScannerProps {
  onFramesCaptured: (frames: string[]) => void;
  isRecording: boolean;
  isAnalyzing: boolean;
}

const AI_LABELS = [
  "micro-expression detected",
  "signal stable",
  "face landmarks mapped",
  "AU encoding...",
  "valence estimating",
  "gaze tracking active",
];

export default function FaceScanner({ onFramesCaptured, isRecording, isAnalyzing }: FaceScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const framesRef = useRef<string[]>([]);
  const animRef = useRef<number>(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [labelIndex, setLabelIndex] = useState(0);

  // Start webcam
  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480, facingMode: "user" } })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setCameraActive(true);
        }
      })
      .catch((err) => {
        if (!cancelled) setCameraError(err.message ?? "Camera access denied");
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Rotating AI labels
  useEffect(() => {
    if (!isRecording && !isAnalyzing) return;
    const id = setInterval(() => {
      setLabelIndex((i) => (i + 1) % AI_LABELS.length);
    }, 1400);
    return () => clearInterval(id);
  }, [isRecording, isAnalyzing]);

  // Corner-box overlay animation on canvas
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = 640;
    canvas.height = 480;

    let tick = 0;
    const drawOverlay = () => {
      ctx.clearRect(0, 0, 640, 480);
      if (!isRecording && !isAnalyzing) {
        animRef.current = requestAnimationFrame(drawOverlay);
        return;
      }

      tick += 0.04;

      // Bounding box with animated corners
      const x = 160, y = 80, w = 320, h = 340;
      const cLen = 24;
      const alpha = 0.5 + Math.sin(tick) * 0.3;

      ctx.strokeStyle = `rgba(0, 216, 214, ${alpha})`;
      ctx.lineWidth = 1.5;

      const corners: [number, number, number, number, number, number][] = [
        [x, y, cLen, 0, 0, cLen],           // top-left
        [x + w, y, -cLen, 0, 0, cLen],      // top-right
        [x, y + h, cLen, 0, 0, -cLen],      // bottom-left
        [x + w, y + h, -cLen, 0, 0, -cLen], // bottom-right
      ];

      corners.forEach(([cx, cy, dx, dy, ex, ey]) => {
        ctx.beginPath();
        ctx.moveTo(cx + dx, cy + dy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + ex, cy + ey);
        ctx.stroke();
      });

      // Center cross
      const cx2 = x + w / 2;
      const cy2 = y + h / 2;
      ctx.strokeStyle = `rgba(0, 216, 214, 0.2)`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(cx2 - 10, cy2); ctx.lineTo(cx2 + 10, cy2);
      ctx.moveTo(cx2, cy2 - 10); ctx.lineTo(cx2, cy2 + 10);
      ctx.stroke();

      // Scan sweep line
      const sweepY = y + ((tick * 30) % h);
      const grad = ctx.createLinearGradient(x, sweepY - 4, x, sweepY + 4);
      grad.addColorStop(0, "transparent");
      grad.addColorStop(0.5, `rgba(0, 216, 214, ${0.15 * alpha})`);
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.fillRect(x, sweepY - 4, w, 8);

      animRef.current = requestAnimationFrame(drawOverlay);
    };

    drawOverlay();
    return () => cancelAnimationFrame(animRef.current);
  }, [isRecording, isAnalyzing]);

  // Frame capture during recording
  useEffect(() => {
    if (!isRecording) {
      if (frameTimerRef.current) clearInterval(frameTimerRef.current);
      return;
    }

    framesRef.current = [];
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    frameTimerRef.current = setInterval(() => {
      ctx.drawImage(video, 0, 0, 320, 240);
      framesRef.current.push(canvas.toDataURL("image/jpeg", 0.6).split(",")[1]);
      if (framesRef.current.length >= 12) {
        if (frameTimerRef.current) clearInterval(frameTimerRef.current);
        onFramesCaptured(framesRef.current);
      }
    }, 550); // ~12 frames in 7s

    return () => {
      if (frameTimerRef.current) clearInterval(frameTimerRef.current);
    };
  }, [isRecording, onFramesCaptured]);

  return (
    <div className="relative rounded-sm overflow-hidden bg-[#080808] border border-[#1a1a1a]" style={{ aspectRatio: "4/3" }}>
      {/* Video */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover scale-x-[-1]"
        muted
        playsInline
      />

      {/* Hidden capture canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Overlay canvas */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ objectFit: "cover" }}
      />

      {/* Camera error */}
      {cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#080808]">
          <div className="font-mono text-xs text-[#555] mb-2">CAMERA_ERROR</div>
          <div className="text-[#444] text-sm max-w-[200px] text-center">{cameraError}</div>
        </div>
      )}

      {/* AI floating label */}
      <AnimatePresence mode="wait">
        {(isRecording || isAnalyzing) && (
          <motion.div
            key={labelIndex}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
            className="absolute top-3 left-3 right-3 flex items-center gap-2"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#00d8d6] animate-pulse flex-shrink-0" />
            <span className="font-mono text-[10px] text-[#00d8d6]/70 tracking-wider truncate">
              {AI_LABELS[labelIndex]}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status badge */}
      <div className="absolute bottom-3 right-3">
        <div className={`font-mono text-[11px] font-medium tracking-widest uppercase px-2.5 py-1 border rounded-sm ${
          isAnalyzing
            ? "border-[#f59e0b]/40 text-[#f59e0b] bg-[#f59e0b]/5"
            : isRecording
            ? "border-[#ef4444]/40 text-[#ef4444] bg-[#ef4444]/5"
            : cameraActive
            ? "border-[#00d8d6]/20 text-[#00d8d6]/50 bg-transparent"
            : "border-[#333] text-[#333]"
        }`}>
          {isAnalyzing ? "ANALYZING" : isRecording ? "● REC" : cameraActive ? "STANDBY" : "NO FEED"}
        </div>
      </div>
    </div>
  );
}
