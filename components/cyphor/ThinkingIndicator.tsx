"use client";

import { useEffect, useState } from "react";

const GLYPHS = "!<>-_\\/[]{}=+*^?#01";
const WORD = "decrypting";

export function ThinkingIndicator() {
  const [noise, setNoise] = useState(WORD);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const id = setInterval(() => {
      setNoise(() => {
        const chars = WORD.split("").map((ch, i) => {
          // keep ~60% of positions stable at any tick so it reads as "settling", not pure noise
          const stable = (i + Math.floor(Date.now() / 260)) % 5 !== 0;
          return stable ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        });
        return chars.join("");
      });
    }, 90);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-2.5 py-1 text-muted-foreground">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-signal-pulse rounded-full bg-primary" />
      </span>
      <span className="font-mono text-[13px] tracking-wide">{noise}</span>
    </div>
  );
}
