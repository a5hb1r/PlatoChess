/**
 * useChessClock — a synchronized two-player countdown with increment support.
 *
 * Time is decremented from `performance.now()` deltas (not naive interval
 * counts) so the display stays accurate even if a tick is delayed. The parent
 * drives the clock by telling it which side is active and whether it is
 * running; after each completed move it calls `applyIncrement(side)`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Color } from "chess.js";

export interface ChessClockOptions {
  /** Starting time per side, in milliseconds. */
  initialMs: number;
  /** Fischer increment added to the side that just moved, in milliseconds. */
  incrementMs: number;
}

export interface ChessClock {
  whiteMs: number;
  blackMs: number;
  /** The side that ran out of time, if any. */
  flagged: Color | null;
  setActive: (color: Color | null) => void;
  setRunning: (running: boolean) => void;
  applyIncrement: (color: Color) => void;
  reset: (initialMs?: number) => void;
}

export function useChessClock({ initialMs, incrementMs }: ChessClockOptions): ChessClock {
  const [whiteMs, setWhiteMs] = useState(initialMs);
  const [blackMs, setBlackMs] = useState(initialMs);
  const [flagged, setFlagged] = useState<Color | null>(null);

  const activeRef = useRef<Color | null>(null);
  const runningRef = useRef(false);
  const lastRef = useRef<number>(performance.now());

  useEffect(() => {
    let raf = 0;
    let mounted = true;

    const loop = () => {
      if (!mounted) return;
      const now = performance.now();
      const dt = now - lastRef.current;
      lastRef.current = now;

      if (runningRef.current && activeRef.current) {
        if (activeRef.current === "w") {
          setWhiteMs((m) => {
            const next = Math.max(0, m - dt);
            if (next <= 0) setFlagged("w");
            return next;
          });
        } else {
          setBlackMs((m) => {
            const next = Math.max(0, m - dt);
            if (next <= 0) setFlagged("b");
            return next;
          });
        }
      }
      raf = window.setTimeout(loop, 200) as unknown as number;
    };

    raf = window.setTimeout(loop, 200) as unknown as number;
    return () => {
      mounted = false;
      clearTimeout(raf);
    };
  }, []);

  const setActive = useCallback((color: Color | null) => {
    // Reset the delta baseline so the newly active clock doesn't lose the gap.
    lastRef.current = performance.now();
    activeRef.current = color;
  }, []);

  const setRunning = useCallback((running: boolean) => {
    lastRef.current = performance.now();
    runningRef.current = running;
  }, []);

  const applyIncrement = useCallback(
    (color: Color) => {
      if (incrementMs <= 0) return;
      if (color === "w") setWhiteMs((m) => m + incrementMs);
      else setBlackMs((m) => m + incrementMs);
    },
    [incrementMs],
  );

  const reset = useCallback(
    (next?: number) => {
      const value = next ?? initialMs;
      setWhiteMs(value);
      setBlackMs(value);
      setFlagged(null);
      activeRef.current = null;
      runningRef.current = false;
      lastRef.current = performance.now();
    },
    [initialMs],
  );

  return { whiteMs, blackMs, flagged, setActive, setRunning, applyIncrement, reset };
}

/** Format milliseconds as m:ss, adding tenths under 20s for urgency. */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, ms) / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  if (ms < 20000) {
    const tenths = Math.floor((totalSeconds * 10) % 10);
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
