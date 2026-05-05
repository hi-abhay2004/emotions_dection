"use client";

import dynamic from "next/dynamic";
import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import BootLoader from "@/components/BootLoader";
import HowItWorks from "@/components/HowItWorks";
import FaceScanLoader from "@/components/FaceScanLoader";

// Lazy-load Three.js hero (SSR disabled)
const Hero3D = dynamic(() => import("@/components/Hero3D"), {
  ssr: false,
  loading: () => <div className="w-full h-screen bg-[#050505]" />,
});

export default function HomePage() {
  const [booted, setBooted] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const router = useRouter();

  const handleBootComplete = useCallback(() => {
    setBooted(true);
  }, []);

  const handleStartAnalysis = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => {
      router.push("/demo");
    }, 3000);
  }, [router]);

  return (
    <main>
      <AnimatePresence mode="wait">
        {!booted ? (
          <BootLoader key="boot" onComplete={handleBootComplete} />
        ) : isTransitioning ? (
          <FaceScanLoader key="scanner" />
        ) : (
          <motion.div
            key="hero"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            <Hero3D onStart={handleStartAnalysis} />
            <HowItWorks />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
