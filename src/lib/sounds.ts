// Crisp board SFX (Web Audio). Styled like popular sites - not sampled from third"party assets.
import type { Move } from "chess.js";

let ctx: AudioContext | null = null;

/** Browsers suspend AudioContext until a user gesture; call once on app mount. */
export function installAudioUnlockListeners(): void {
  if (typeof window === "undefined") return;
  const unlock = () => {
    void resumeAudioContext();
  };
  window.addEventListener("pointerdown", unlock, { passive: true, once: true });
  window.addEventListener("keydown", unlock, { passive: true, once: true });
}

export async function resumeAudioContext(): Promise<void> {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") await ctx.resume();
}

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  void ctx.resume();
  return ctx;
}

const MIN_GAIN = 0.0001;

function rampGain(g: GainNode, start: number, end: number, t0: number, t1: number) {
  const s = Math.max(MIN_GAIN, start);
  const e = Math.max(MIN_GAIN, end);
  g.gain.setValueAtTime(s, t0);
  g.gain.exponentialRampToValueAtTime(e, t1);
}

function createNoise(duration: number, sampleRate: number): AudioBuffer {
  const buffer = new AudioBuffer({
    length: Math.floor(sampleRate * duration),
    sampleRate,
    numberOfChannels: 1,
  });
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function playNoiseBurst(
  freq: number,
  duration: number,
  volume: number,
  filterQ = 1,
  startOffset = 0
) {
  const c = getCtx();
  const t = c.currentTime + startOffset;

  const src = c.createBufferSource();
  src.buffer = createNoise(duration, c.sampleRate);

  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(freq, t);
  bp.Q.setValueAtTime(filterQ, t);

  const g = c.createGain();
  rampGain(g, volume, MIN_GAIN, t, t + duration);

  src.connect(bp).connect(g).connect(c.destination);
  src.start(t);
  src.stop(t + duration);
}

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType,
  volume: number,
  delay = 0
) {
  const c = getCtx();
  const t = c.currentTime + delay;

  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);

  const g = c.createGain();
  rampGain(g, volume, MIN_GAIN, t, t + duration);

  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + duration);
}

/** Use after chess.js `move()` - matches move type to the closest "site-style" feedback. */
export function playMoveSound(move: Move, sideToMoveAfterMoveInCheck: boolean) {
  if (sideToMoveAfterMoveInCheck) {
    ChessSounds.check();
    return;
  }
  if (move.flags.includes("p")) {
    ChessSounds.promote();
    return;
  }
  if (move.flags.includes("k") || move.flags.includes("q")) {
    ChessSounds.castle();
    return;
  }
  if (move.captured) {
    ChessSounds.capture();
    return;
  }
  ChessSounds.move();
}

export const ChessSounds = {
  /** Quiet slide - short "knock" */
  move() {
    playNoiseBurst(1200, 0.028, 0.14, 2.2);
    playNoiseBurst(420, 0.022, 0.1, 1.2, 0.004);
    playTone(180, 0.022, "sine", 0.045);
  },

  /** Heavier transient + scrape */
  capture() {
    playNoiseBurst(520, 0.055, 0.32, 1.4);
    playNoiseBurst(1400, 0.035, 0.16, 2.8, 0.01);
    playTone(95, 0.06, "triangle", 0.11);
  },

  /** Bright alert */
  check() {
    playTone(740, 0.055, "sine", 0.16);
    playTone(990, 0.07, "sine", 0.14, 0.05);
  },

  /** Two quick taps */
  castle() {
    playNoiseBurst(1100, 0.024, 0.15, 2.2);
    playNoiseBurst(900, 0.026, 0.18, 2, 0.045);
    playTone(240, 0.02, "sine", 0.04, 0.055);
  },

  gameOver() {
    playTone(587, 0.18, "sine", 0.11);
    playTone(440, 0.2, "sine", 0.09, 0.14);
    playTone(330, 0.32, "sine", 0.08, 0.28);
  },

  promote() {
    playTone(523, 0.06, "sine", 0.1);
    playTone(659, 0.06, "sine", 0.09, 0.05);
    playTone(784, 0.08, "sine", 0.1, 0.1);
    playTone(1047, 0.12, "sine", 0.11, 0.16);
  },

  illegal() {
    playTone(165, 0.12, "square", 0.07);
    playTone(130, 0.16, "square", 0.05, 0.08);
  },
};
