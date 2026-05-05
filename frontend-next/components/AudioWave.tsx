"use client";

import { useRef, useEffect, useState } from "react";

interface AudioWaveProps {
  isRecording: boolean;
  onAudioCaptured: (audioBase64: string) => void;
}

export default function AudioWave({ isRecording, onAudioCaptured }: AudioWaveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animRef = useRef<number>(0);
  const chunksRef = useRef<Blob[]>([]);
  const [micError, setMicError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      if (!analyserRef.current || !isRecording) {
        // Idle flat line
        ctx.strokeStyle = "rgba(68, 68, 68, 0.6)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteTimeDomainData(dataArray);

      // Compute level
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = (dataArray[i] - 128) / 128;
        sum += v * v;
      }
      setAudioLevel(Math.sqrt(sum / bufferLength));

      ctx.lineWidth = 1.5;
      const gradient = ctx.createLinearGradient(0, 0, w, 0);
      gradient.addColorStop(0, "rgba(0,216,214,0.1)");
      gradient.addColorStop(0.5, "rgba(0,216,214,0.8)");
      gradient.addColorStop(1, "rgba(0,216,214,0.1)");
      ctx.strokeStyle = gradient;

      ctx.beginPath();
      const sliceWidth = w / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * h) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [isRecording]);

  // Start / stop recording
  useEffect(() => {
    if (!isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        // Web Audio analyser
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        analyserRef.current = analyser;

        // Media recorder
        chunksRef.current = [];
        const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(",")[1];
            onAudioCaptured(base64);
          };
          reader.readAsDataURL(blob);
          stream.getTracks().forEach((t) => t.stop());
          ctx.close();
          analyserRef.current = null;
        };

        recorder.start();

        // Auto-stop after 7s
        setTimeout(() => {
          if (recorder.state === "recording") recorder.stop();
        }, 7000);
      })
      .catch((err) => setMicError(err.message ?? "Mic access denied"));
  }, [isRecording, onAudioCaptured]);

  return (
    <div className="rounded-sm border border-[#1a1a1a] bg-[#080808] p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[10px] text-[#444] tracking-widest uppercase">
          Audio Waveform
        </span>
        <div className="flex items-center gap-2">
          {isRecording && (
            <div className="flex gap-0.5 items-end h-3">
              {[0.4, 0.7, 1, 0.6, 0.9, 0.5].map((scale, i) => (
                <div
                  key={i}
                  className="w-0.5 bg-[#00d8d6] rounded-full"
                  style={{
                    height: `${Math.min(12, audioLevel * 80 * scale + 3)}px`,
                    transition: "height 0.1s ease",
                    opacity: 0.6 + scale * 0.3,
                  }}
                />
              ))}
            </div>
          )}
          <span className={`font-mono text-[9px] tracking-widest uppercase ${
            isRecording ? "text-[#ef4444]" : "text-[#333]"
          }`}>
            {isRecording ? "● REC" : "IDLE"}
          </span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={400}
        height={48}
        className="w-full"
      />

      {micError && (
        <p className="font-mono text-[10px] text-[#555] mt-1">{micError}</p>
      )}
    </div>
  );
}
