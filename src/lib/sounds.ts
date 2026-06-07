/**
 * Chess board SFX.
 *
 * Two-tier audio system:
 *  1. MP3 file playback — drop real sound files into /public/sounds/*.mp3
 *     (see SOUND_FILE_PATHS below for the exact expected filenames).
 *     Files are pre-warmed on the first user gesture and cached in memory.
 *  2. Web Audio synthesis fallback — if a file is missing or fails to load
 *     the synthesised burst plays instead (zero extra dependencies).
 *
 * Call `preloadSounds()` once after the first user interaction (already wired
 * via `installAudioUnlockListeners`).
 */
import type { Move } from "chess.js";

let ctx: AudioContext | null = null;

export const SOUND_STORAGE_KEY = "platochess-sound-enabled";

/** Global mute switch for all board SFX. Read once from storage. */
let soundEnabled = (() => {
  if (typeof localStorage === "undefined") return true;
  try {
    return localStorage.getItem(SOUND_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
})();

export function setSoundsEnabled(enabled: boolean): void {
  soundEnabled = enabled;
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, String(enabled));
  } catch {
    /* ignore */
  }
}

export function areSoundsEnabled(): boolean {
  return soundEnabled;
}

// ─────────────────────────────────────────────────────────────────────────────
// Audio context helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Browsers suspend AudioContext until a user gesture; call once on app mount. */
export function installAudioUnlockListeners(): void {
  if (typeof window === "undefined") return;
  const unlock = () => {
    void resumeAudioContext();
    void preloadSounds();
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

// ─────────────────────────────────────────────────────────────────────────────
// MP3 file loading + cache
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Drop your chess sound MP3/OGG files here → /public/sounds/<name>
 * Files are fetched once and cached; missing files silently fall back to
 * synthesised audio.
 */
export const SOUND_FILE_PATHS = {
  move: "/sounds/move.mp3",
  capture: "/sounds/capture.mp3",
  check: "/sounds/check.mp3",
  castle: "/sounds/castle.mp3",
  gameOver: "/sounds/game-over.mp3",
  promote: "/sounds/promote.mp3",
  brilliant: "/sounds/brilliant.mp3",
  blunder: "/sounds/blunder.mp3",
  illegal: "/sounds/illegal.mp3",
} as const;

type SoundKey = keyof typeof SOUND_FILE_PATHS;

const soundFileCache = new Map<SoundKey, AudioBuffer | null>();

async function fetchAndCacheSound(key: SoundKey): Promise<AudioBuffer | null> {
  if (soundFileCache.has(key)) return soundFileCache.get(key) ?? null;
  const path = SOUND_FILE_PATHS[key];
  try {
    const response = await fetch(path, { cache: "force-cache" });
    if (!response.ok) {
      soundFileCache.set(key, null);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    const c = getCtx();
    const audioBuffer = await c.decodeAudioData(arrayBuffer);
    soundFileCache.set(key, audioBuffer);
    return audioBuffer;
  } catch {
    soundFileCache.set(key, null);
    return null;
  }
}

/** Pre-warm the cache after first user gesture so playback is instant. */
export async function preloadSounds(): Promise<void> {
  await Promise.all(
    (Object.keys(SOUND_FILE_PATHS) as SoundKey[]).map((key) =>
      fetchAndCacheSound(key).catch(() => null)
    )
  );
}

function playCachedBuffer(buffer: AudioBuffer, volume = 0.85): void {
  if (!soundEnabled) return;
  const c = getCtx();
  const src = c.createBufferSource();
  src.buffer = buffer;
  const g = c.createGain();
  g.gain.setValueAtTime(volume, c.currentTime);
  src.connect(g).connect(c.destination);
  src.start();
}

/**
 * Tries the cached MP3 file first; if absent, runs the `fallback` synthesiser.
 * Non-blocking — the async fetch is fire-and-forget on first call (the
 * pre-warm should have already done it).
 */
function playFileOrFallback(key: SoundKey, fallback: () => void): void {
  if (!soundEnabled) return;
  const cached = soundFileCache.get(key);
  if (cached === undefined) {
    // Not yet fetched — fire async but play synth immediately so there's no
    // gap on the very first move.
    fallback();
    void fetchAndCacheSound(key);
    return;
  }
  if (cached === null) {
    // File doesn't exist — always use fallback.
    fallback();
    return;
  }
  playCachedBuffer(cached);
}

// ─────────────────────────────────────────────────────────────────────────────
// Synthesised fallbacks (Web Audio API)
// ─────────────────────────────────────────────────────────────────────────────

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
  if (!soundEnabled) return;
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
  if (!soundEnabled) return;
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

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/** Use after chess.js `move()` — matches move type to the closest audio event. */
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
  move() {
    playFileOrFallback("move", () => {
      playNoiseBurst(1200, 0.028, 0.14, 2.2);
      playNoiseBurst(420, 0.022, 0.1, 1.2, 0.004);
      playTone(180, 0.022, "sine", 0.045);
    });
  },

  capture() {
    playFileOrFallback("capture", () => {
      playNoiseBurst(520, 0.055, 0.32, 1.4);
      playNoiseBurst(1400, 0.035, 0.16, 2.8, 0.01);
      playTone(95, 0.06, "triangle", 0.11);
    });
  },

  check() {
    playFileOrFallback("check", () => {
      playTone(740, 0.055, "sine", 0.16);
      playTone(990, 0.07, "sine", 0.14, 0.05);
    });
  },

  castle() {
    playFileOrFallback("castle", () => {
      playNoiseBurst(1100, 0.024, 0.15, 2.2);
      playNoiseBurst(900, 0.026, 0.18, 2, 0.045);
      playTone(240, 0.02, "sine", 0.04, 0.055);
    });
  },

  gameOver() {
    playFileOrFallback("gameOver", () => {
      playTone(587, 0.18, "sine", 0.11);
      playTone(440, 0.2, "sine", 0.09, 0.14);
      playTone(330, 0.32, "sine", 0.08, 0.28);
    });
  },

  promote() {
    playFileOrFallback("promote", () => {
      playTone(523, 0.06, "sine", 0.1);
      playTone(659, 0.06, "sine", 0.09, 0.05);
      playTone(784, 0.08, "sine", 0.1, 0.1);
      playTone(1047, 0.12, "sine", 0.11, 0.16);
    });
  },

  /** Distinct celebratory sound for a Brilliant move classification. */
  brilliant() {
    playFileOrFallback("brilliant", () => {
      playTone(880, 0.04, "sine", 0.12);
      playTone(1108, 0.04, "sine", 0.1, 0.06);
      playTone(1318, 0.06, "sine", 0.12, 0.11);
      playTone(1760, 0.1, "sine", 0.1, 0.16);
    });
  },

  /** Low, ominous sound for a Blunder classification. */
  blunder() {
    playFileOrFallback("blunder", () => {
      playTone(220, 0.18, "sawtooth", 0.09);
      playTone(165, 0.22, "sawtooth", 0.07, 0.12);
      playTone(110, 0.28, "square", 0.05, 0.25);
    });
  },

  illegal() {
    playFileOrFallback("illegal", () => {
      playTone(165, 0.12, "square", 0.07);
      playTone(130, 0.16, "square", 0.05, 0.08);
    });
  },
};
