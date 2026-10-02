"use client";

import { useEffect, useRef, useState } from "react";

const GLYPHS = "!<>-_\\/[]{}=+*^?#$%&01";

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface DecodeTextProps {
  text: string;
  className?: string;
  /** ms for the whole reveal */
  duration?: number;
  /** delay before starting, ms */
  delay?: number;
  as?: "span" | "h1" | "h2" | "div";
  onDone?: () => void;
}

/**
 * Renders `text` so it appears to resolve out of cipher noise, left to
 * right. Non-space characters past the "revealed" cursor are swapped for
 * random glyphs each tick; once a character is revealed it locks in place.
 */
export function DecodeText({
  text,
  className,
  duration = 500,
  delay = 0,
  as = "span",
  onDone,
}: DecodeTextProps) {
  const [display, setDisplay] = useState(() => (prefersReducedMotion() ? text : ""));
  const frame = useRef<number | undefined>(undefined);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (prefersReducedMotion()) {
      // Deliberate: keeps display in sync if `text` changes after mount while
      // reduced-motion is on (initial mount is already handled by the lazy
      // useState initializer above, so this only fires on a later text swap).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplay(text);
      doneRef.current?.();
      return;
    }

    let start: number | null = null;
    let stopped = false;

    const tick = (t: number) => {
      if (stopped) return;
      if (start === null) start = t;
      const elapsed = t - start - delay;
      if (elapsed < 0) {
        frame.current = requestAnimationFrame(tick);
        return;
      }
      const progress = Math.min(1, elapsed / duration);
      const revealCount = Math.floor(progress * text.length);

      let out = "";
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === " ") {
          out += " ";
        } else if (i < revealCount) {
          out += ch;
        } else {
          out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        }
      }
      setDisplay(out);

      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
      } else {
        setDisplay(text);
        doneRef.current?.();
      }
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [text, duration, delay]);

  const Comp = as;
  return (
    <Comp className={className} aria-label={text}>
      {display}
    </Comp>
  );
}
