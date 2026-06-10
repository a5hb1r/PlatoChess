/**
 * Philosopher text-to-speech via the Web Speech API.
 * Each philosopher gets a distinct vocal character (pitch/rate, and a female
 * voice for Hypatia when the platform provides one). No network, no cost —
 * speechSynthesis ships in every modern browser.
 */

export interface VoiceProfile {
  pitch: number;
  rate: number;
  preferFemale?: boolean;
}

export const PHILOSOPHER_VOICES: Record<string, VoiceProfile> = {
  chiron: { pitch: 0.9, rate: 0.95 },
  socrates: { pitch: 0.78, rate: 0.9 },
  aristotle: { pitch: 1.0, rate: 1.0 },
  pythagoras: { pitch: 1.1, rate: 0.92 },
  archimedes: { pitch: 1.05, rate: 1.12 },
  euclid: { pitch: 0.95, rate: 0.88 },
  hypatia: { pitch: 1.2, rate: 1.0, preferFemale: true },
  plato: { pitch: 0.74, rate: 0.9 },
};

export const VOICE_STORAGE_KEY = "plato:bot-voice-enabled";

export function isVoiceSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function getVoiceEnabled(): boolean {
  if (!isVoiceSupported()) return false;
  try {
    return JSON.parse(localStorage.getItem(VOICE_STORAGE_KEY) ?? "true");
  } catch {
    return true;
  }
}

export function setVoiceEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(VOICE_STORAGE_KEY, JSON.stringify(enabled));
  } catch {
    /* private mode */
  }
  if (!enabled) stopSpeaking();
}

const FEMALE_VOICE_HINTS = [
  "female", "samantha", "victoria", "karen", "moira", "tessa", "zira",
  "susan", "hazel", "aria", "jenny", "libby", "sonia", "natasha", "google uk english female",
];

let cachedVoices: SpeechSynthesisVoice[] = [];

function loadVoices(): SpeechSynthesisVoice[] {
  if (!isVoiceSupported()) return [];
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) cachedVoices = voices;
  return cachedVoices;
}

// Voices arrive asynchronously on some platforms — warm the cache.
if (isVoiceSupported()) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = () => loadVoices();
}

function pickVoice(profile: VoiceProfile): SpeechSynthesisVoice | null {
  const voices = loadVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
  if (voices.length === 0) return null;

  if (profile.preferFemale) {
    const female = voices.find((v) =>
      FEMALE_VOICE_HINTS.some((hint) => v.name.toLowerCase().includes(hint))
    );
    if (female) return female;
  }
  // Prefer a local/default voice for latency.
  return voices.find((v) => v.default) ?? voices[0];
}

export interface SpeakCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
}

/**
 * Speak a line in the given philosopher's voice. Any line still playing is
 * cancelled first — the latest comment always wins.
 */
export function speakAsPhilosopher(botId: string, text: string, callbacks?: SpeakCallbacks): void {
  if (!isVoiceSupported() || !text.trim()) {
    callbacks?.onEnd?.();
    return;
  }

  const synth = window.speechSynthesis;
  synth.cancel();

  const profile = PHILOSOPHER_VOICES[botId] ?? { pitch: 1, rate: 1 };
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.pitch = profile.pitch;
  utterance.rate = profile.rate;
  utterance.volume = 0.9;
  const voice = pickVoice(profile);
  if (voice) utterance.voice = voice;

  utterance.onstart = () => callbacks?.onStart?.();
  utterance.onend = () => callbacks?.onEnd?.();
  utterance.onerror = () => callbacks?.onEnd?.();

  synth.speak(utterance);
}

export function stopSpeaking(): void {
  if (isVoiceSupported()) window.speechSynthesis.cancel();
}
