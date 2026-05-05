import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MoodSense AI — Multimodal Emotion Intelligence",
  description:
    "Detect your mood through face and voice, get personalized movie, song, and meme recommendations powered by AI.",
  keywords: ["mood detection", "AI", "emotion recognition", "recommendations"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable}`} suppressHydrationWarning>
      <body className="bg-[#050505] text-[#f0f0f0] antialiased scanlines" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
