/**
 * Single source of truth for what each subscription tier unlocks.
 * Import this everywhere a feature gate is needed.
 */

export type Tier = "free" | "pro" | "master";

// ─── Feature flags ─────────────────────────────────────────────────────────

export const TIER_FEATURES = {
  free: {
    label: "Free",
    price: "$0",
    puzzlesPerDay: 10,
    analysis: false,
    moveRatings: false,
    aiCoach: false,
    personalizedPuzzles: false,
    /** Which bot IDs are accessible */
    bots: ["chiron", "socrates", "aristotle"],
    /** Stockfish depth cap for analysis */
    analysisDepth: 0,
    humanVsHuman: true,
    placementMatches: true,
    priorityMatchmaking: false,
    customAnalysisPosition: false,
  },
  pro: {
    label: "Pro",
    price: "$1.99/mo",
    puzzlesPerDay: Infinity,
    analysis: true,
    moveRatings: true,
    aiCoach: true,
    personalizedPuzzles: true,
    bots: ["chiron", "socrates", "aristotle", "pythagoras", "archimedes", "euclid"],
    analysisDepth: 10,
    humanVsHuman: true,
    placementMatches: true,
    priorityMatchmaking: false,
    customAnalysisPosition: false,
  },
  master: {
    label: "Master",
    price: "$3.99/mo",
    puzzlesPerDay: Infinity,
    analysis: true,
    moveRatings: true,
    aiCoach: true,
    personalizedPuzzles: true,
    bots: ["chiron", "socrates", "aristotle", "pythagoras", "archimedes", "euclid", "hypatia", "plato"],
    analysisDepth: 15,
    humanVsHuman: true,
    placementMatches: true,
    priorityMatchmaking: true,
    customAnalysisPosition: true,
  },
} as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

export function getTier(isPro: boolean, isMaster: boolean): Tier {
  if (isMaster) return "master";
  if (isPro) return "pro";
  return "free";
}

export function getFeatures(isPro: boolean, isMaster: boolean) {
  return TIER_FEATURES[getTier(isPro, isMaster)];
}

/** Returns true if the user can access analysis at all */
export function canUseAnalysis(isPro: boolean, isMaster: boolean): boolean {
  // Dev mode bypass
  if (import.meta.env.DEV) return true;
  return getFeatures(isPro, isMaster).analysis;
}

/** Returns the analysis depth for the current tier (0 = no analysis) */
export function getAnalysisDepth(isPro: boolean, isMaster: boolean): number {
  if (import.meta.env.DEV) return TIER_FEATURES.master.analysisDepth;
  return getFeatures(isPro, isMaster).analysisDepth;
}

/** Returns how many puzzles per day the user can solve (Infinity = unlimited) */
export function getPuzzleLimit(isPro: boolean, isMaster: boolean): number {
  if (import.meta.env.DEV) return Infinity;
  return getFeatures(isPro, isMaster).puzzlesPerDay;
}

/** Returns true if the given bot ID is accessible */
export function canPlayBot(
  botId: string,
  isPro: boolean,
  isMaster: boolean
): boolean {
  if (import.meta.env.DEV) return true;
  return (getFeatures(isPro, isMaster).bots as readonly string[]).includes(botId);
}

// ─── Human-readable feature list for Pricing page ───────────────────────────

export interface FeatureItem {
  label: string;
  free: boolean | string;
  pro: boolean | string;
  master: boolean | string;
}

export const PRICING_FEATURES: FeatureItem[] = [
  { label: "Tactics puzzles", free: "10/day", pro: "Unlimited", master: "Unlimited" },
  { label: "Play vs bots", free: "3 bots", pro: "6 bots", master: "All 8 bots" },
  { label: "Post-game analysis", free: false, pro: true, master: true },
  { label: "Move quality ratings", free: false, pro: true, master: true },
  { label: "AI coach hints", free: false, pro: true, master: true },
  { label: "Personalized puzzles", free: false, pro: true, master: true },
  { label: "Analysis depth", free: false, pro: "Standard (depth 10)", master: "Deep (depth 15)" },
  { label: "Human vs human", free: true, pro: true, master: true },
  { label: "Custom analysis position", free: false, pro: false, master: true },
  { label: "Priority matchmaking", free: false, pro: false, master: true },
];
