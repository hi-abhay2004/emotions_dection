"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { motion } from "framer-motion";
import Link from "next/link";
import * as THREE from "three";

// ─── Animated deforming sphere ────────────────────────────────────────────────

function DeformingSphere({ mousePos }: { mousePos: React.RefObject<{ x: number; y: number }> }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const { size } = useThree();
  const clock = useRef(0);

  // Store original positions
  const geometry = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1.6, 32);
    return geo;
  }, []);

  const originalPositions = useMemo(() => {
    const pos = geometry.attributes.position;
    const arr = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count * 3; i++) arr[i] = pos.array[i];
    return arr;
  }, [geometry]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    clock.current += delta * 0.6;

    const t = clock.current;
    const mx = mousePos.current ? mousePos.current.x / size.width - 0.5 : 0;
    const my = mousePos.current ? mousePos.current.y / size.height - 0.5 : 0;

    const pos = meshRef.current.geometry.attributes.position;

    for (let i = 0; i < pos.count; i++) {
      const ox = originalPositions[i * 3];
      const oy = originalPositions[i * 3 + 1];
      const oz = originalPositions[i * 3 + 2];

      // Simplex-like noise via sin
      const noise =
        Math.sin(ox * 2.1 + t) * 0.09 +
        Math.sin(oy * 1.8 + t * 1.3) * 0.09 +
        Math.sin(oz * 2.4 + t * 0.9) * 0.09;

      // Mouse influence
      const mousePull = mx * ox * 0.12 + my * oy * 0.12;

      pos.setXYZ(
        i,
        ox + ox * noise + mousePull,
        oy + oy * noise + my * 0.08,
        oz + oz * noise
      );
    }
    pos.needsUpdate = true;
    meshRef.current.rotation.y += delta * 0.08;
    meshRef.current.rotation.x += delta * 0.03;
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial
        color="#0d1a1a"
        roughness={0.6}
        metalness={0.3}
        wireframe={false}
      />
      {/* Wireframe overlay */}
      <mesh geometry={geometry}>
        <meshBasicMaterial
          color="#00d8d6"
          wireframe
          opacity={0.08}
          transparent
        />
      </mesh>
    </mesh>
  );
}

function Particles() {
  const count = 200;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 2.2 + Math.random() * 1.5;
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);

  const ref = useRef<THREE.Points>(null!);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.04;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial color="#00d8d6" size={0.015} transparent opacity={0.5} />
    </points>
  );
}

// ─── Hero3D component ─────────────────────────────────────────────────────────

export default function Hero3D({ onStart }: { onStart: () => void }) {
  const mousePos = useRef({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    mousePos.current = { x: e.clientX, y: e.clientY };
  };

  return (
    <div
      className="relative w-full h-screen bg-[#050505]"
      onMouseMove={handleMouseMove}
    >
      {/* Three.js canvas */}
      <div className="absolute inset-0">
        <Canvas
          camera={{ position: [0, 0, 5], fov: 50 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true }}
        >
          <ambientLight intensity={0.3} />
          <pointLight position={[5, 5, 5]} intensity={1.2} color="#00d8d6" />
          <pointLight position={[-5, -3, -5]} intensity={0.4} color="#f59e0b" />
          <DeformingSphere mousePos={mousePos} />
          <Particles />
        </Canvas>
      </div>

      {/* Vignette */}
      <div className="absolute inset-0 bg-radial-[ellipse_at_center,transparent_30%,#050505_80%] pointer-events-none" />

      {/* Scan line sweep */}
      <div
        className="absolute left-0 right-0 h-[1px] pointer-events-none z-10"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(0,216,214,0.15), transparent)",
          animation: "scanline 6s linear infinite",
        }}
      />

      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,216,214,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,216,214,1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Overlay UI */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none px-6">
        {/* System tag */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="flex items-center gap-2 mb-8"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#00d8d6] animate-pulse" />
          <span className="font-mono text-[11px] tracking-[0.3em] text-[#00d8d6]/70 uppercase">
            Neural Engine Active
          </span>
        </motion.div>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="font-display text-5xl md:text-7xl font-semibold text-center leading-[1.05] tracking-tight max-w-3xl"
        >
          Your mood.{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d8d6] to-[#00d8d6]/60">
            Understood
          </span>{" "}
          instantly.
        </motion.h1>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="mt-5 text-[#666] text-center max-w-md leading-relaxed"
        >
          Multimodal AI using face expression, voice tone, and retrieval
          intelligence to understand how you feel.
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="mt-10 flex items-center gap-4 pointer-events-auto"
        >
          <button
            onClick={onStart}
            className="group relative px-8 py-3 bg-transparent border border-[#00d8d6]/40 text-[#00d8d6] font-display font-medium text-sm tracking-wide rounded-sm overflow-hidden transition-all duration-300 hover:border-[#00d8d6] hover:text-white corner-border"
          >
            <span className="relative z-10">Start Analysis</span>
            <div className="absolute inset-0 bg-[#00d8d6]/5 translate-x-[-101%] group-hover:translate-x-0 transition-transform duration-300" />
          </button>

          <button className="text-[#555] text-sm font-mono tracking-wider hover:text-[#888] transition-colors">
            Learn how it works ↓
          </button>
        </motion.div>
      </div>

      {/* Bottom info strip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4 }}
        className="absolute bottom-6 left-0 right-0 flex justify-center gap-10 z-20"
      >
        {[
          ["DeepFace", "Face Analysis"],
          ["Wav2Vec2", "Voice Detection"],
          ["ChromaDB", "Vector Retrieval"],
        ].map(([tech, label]) => (
          <div key={tech} className="text-center">
            <div className="font-mono text-[10px] text-[#00d8d6]/60 tracking-widest uppercase">
              {tech}
            </div>
            <div className="text-[10px] text-[#333] mt-0.5">{label}</div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
