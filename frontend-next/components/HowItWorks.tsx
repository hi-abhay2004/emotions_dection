"use client";

import { motion } from "framer-motion";

const STEPS = [
  {
    title: "Multimodal Capture",
    desc: "The system simultaneously analyzes video frames for facial micro-expressions and audio for vocal energy and tone.",
    tech: "DeepFace / Wav2Vec2"
  },
  {
    title: "Neural Fusion",
    desc: "Confidences from both signals are weighted and fused using an ensemble logic to determine your true emotional state.",
    tech: "Custom Logic"
  },
  {
    title: "Vector Search",
    desc: "Your mood is converted into an embedding and matched against a multi-dimensional vector database of movies and songs.",
    tech: "ChromaDB / S-BERT"
  },
  {
    title: "AI Synthesis",
    desc: "An LLM generates real-time explanations for each choice and crafts a unique meme tailored to your specific mood.",
    tech: "Gemini / OpenAI"
  }
];

export default function HowItWorks() {
  return (
    <section className="bg-[#050505] py-24 px-6 border-t border-[rgba(255,255,255,0.05)]">
      <div className="max-w-6xl mx-auto">
        <div className="mb-16">
          <div className="font-mono text-[10px] text-[#00d8d6]/60 tracking-[0.3em] uppercase mb-3">
            System Architecture
          </div>
          <h2 className="font-display text-4xl font-semibold text-[#f0f0f0]">
            How MoodSense Works
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {STEPS.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="glass p-6 group hover:border-[#00d8d6]/30 transition-colors"
            >
              <div className="font-mono text-[10px] text-[#333] mb-4 group-hover:text-[#00d8d6]/50 transition-colors">
                0{i + 1}
              </div>
              <h3 className="font-display text-lg font-medium text-[#e0e0e0] mb-3">
                {step.title}
              </h3>
              <p className="text-xs text-[#666] leading-relaxed mb-6">
                {step.desc}
              </p>
              <div className="pt-4 border-t border-[rgba(255,255,255,0.03)] font-mono text-[9px] text-[#444] tracking-widest uppercase">
                {step.tech}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-24 glass p-12 text-center">
          <h3 className="font-display text-2xl text-[#f0f0f0] mb-4">
            Ready to experience it?
          </h3>
          <p className="text-sm text-[#666] max-w-lg mx-auto mb-10 leading-relaxed">
            MoodSense AI is an experiment in emotional intelligence, combining state-of-the-art computer vision and signal processing.
          </p>
          <div className="flex justify-center">
            <div className="w-12 h-px bg-gradient-to-r from-transparent via-[#00d8d6]/30 to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}
