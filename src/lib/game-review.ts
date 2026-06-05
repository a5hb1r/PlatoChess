import type { Color } from "chess.js";

export interface ReviewedPly {
  ply: number;
  side: Color;
  san: string;
  label: string;
  colorClass: string;
  cpLoss: number;
  bestUci?: string;
  playedUci: string;
  fenBefore: string;
  fenAfter: string;
  evalBeforeCp?: number;
  evalAfterCp?: number;
}

export interface GameReviewReport {
  createdAt: number;
  pgn: string;
  result: string;
  engine: string;
  depth: number;
  accuracy: {
    w: number;
    b: number;
  };
  moves: ReviewedPly[];
}

export const GAME_REVIEW_STORAGE_KEY = "platochess:last-game-review";
export const FINISHED_GAME_STORAGE_KEY = "platochess:last-finished-game";
export const PERSONALIZED_PUZZLES_STORAGE_KEY = "platochess:personalized-puzzles";
const ANALYSIS_TRANSITION_STORAGE_KEY = "platochess:analysis-transition-start-ms";

export interface FinishedGameSnapshot {
  createdAt: number;
  pgn: string;
  result: string;
  engine: string;
  /** Player Elo at the time of the game, used to scale brilliancy detection (spec Section 3). */
  playerElo?: number;
  /** Which color the (human) player controlled. Defaults to White. */
  playerColor?: Color;
}

export interface PersonalizedPuzzle {
  id: string;
  sourcePly: number;
  sourceLabel: string;
  fen: string;
  playerColor: Color;
  solution: string[];
  title: string;
  description: string;
  bestGapCp: number;
}

/** Move classifications in the fixed order used by the post-game report (spec Section 4). */
export const MOVE_CLASSIFICATION_ORDER = [
  "Brilliant",
  "Great",
  "Best",
  "Excellent",
  "Good",
  "Inaccuracy",
  "Mistake",
  "Blunder",
] as const;

export type MoveClassification = (typeof MOVE_CLASSIFICATION_ORDER)[number];
export type ClassificationCounts = Record<MoveClassification, number>;

export type GameResultBanner = "WIN" | "LOSS" | "DRAW";

function emptyClassificationCounts(): ClassificationCounts {
  return {
    Brilliant: 0,
    Great: 0,
    Best: 0,
    Excellent: 0,
    Good: 0,
    Inaccuracy: 0,
    Mistake: 0,
    Blunder: 0,
  };
}

/** Count each move classification, optionally restricted to a single side. */
export function summarizeMoveClassifications(
  moves: Array<{ label: string; side?: Color }>,
  side?: Color
): ClassificationCounts {
  const counts = emptyClassificationCounts();
  for (const move of moves) {
    if (side && move.side !== side) continue;
    if (move.label in counts) {
      counts[move.label as MoveClassification] += 1;
    }
  }
  return counts;
}

/** Derive the player's WIN/LOSS/DRAW banner from a result string and the player's color. */
export function resultBannerForSide(result: string, side: Color = "w"): GameResultBanner {
  const normalized = result.toLowerCase();
  const whiteWon = normalized.includes("white wins");
  const blackWon = normalized.includes("black wins");
  if (!whiteWon && !blackWon) return "DRAW";
  const playerWon = side === "w" ? whiteWon : blackWon;
  return playerWon ? "WIN" : "LOSS";
}

/** Produce the exact post-game performance summary text block (spec Section 4). */
export function formatPerformanceReport(
  banner: GameResultBanner,
  counts: ClassificationCounts
): string {
  return [
    `[GAME OVER: ${banner}]`,
    "------------------------------------",
    "POST-GAME MOVE ANALYSIS REPORT",
    "------------------------------------",
    `Brilliant (!!) : ${counts.Brilliant}`,
    `Great Move (*) : ${counts.Great}`,
    `Best Move      : ${counts.Best}`,
    `Excellent      : ${counts.Excellent}`,
    `Good           : ${counts.Good}`,
    `Inaccuracy (?) : ${counts.Inaccuracy}`,
    `Mistake (?)    : ${counts.Mistake}`,
    `Blunder (??)   : ${counts.Blunder}`,
  ].join("\n");
}

export function scoreForLabel(label: string): number {
  switch (label) {
    case "Brilliant":
      return 1.0;
    case "Great":
      return 0.98;
    case "Best":
      return 0.96;
    case "Excellent":
      return 0.9;
    case "Good":
      return 0.82;
    case "Inaccuracy":
      return 0.62;
    case "Miss":
      return 0.48;
    case "Mistake":
      return 0.3;
    case "Blunder":
      return 0.08;
    default:
      return 0.5;
  }
}

export function saveLatestGameReview(report: GameReviewReport): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(GAME_REVIEW_STORAGE_KEY, JSON.stringify(report));
  } catch {
    /* ignore storage failures */
  }
}

export function loadLatestGameReview(): GameReviewReport | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(GAME_REVIEW_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GameReviewReport;
  } catch {
    return null;
  }
}

export function saveLatestFinishedGame(snapshot: FinishedGameSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(FINISHED_GAME_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* ignore storage failures */
  }
}

export function loadLatestFinishedGame(): FinishedGameSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(FINISHED_GAME_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FinishedGameSnapshot;
  } catch {
    return null;
  }
}

export function markAnalysisTransitionStart(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(ANALYSIS_TRANSITION_STORAGE_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function consumeAnalysisTransitionMs(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(ANALYSIS_TRANSITION_STORAGE_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(ANALYSIS_TRANSITION_STORAGE_KEY);
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return null;
    return Math.max(0, Date.now() - ts);
  } catch {
    return null;
  }
}

export function savePersonalizedPuzzles(puzzles: PersonalizedPuzzle[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PERSONALIZED_PUZZLES_STORAGE_KEY, JSON.stringify(puzzles));
  } catch {
    /* ignore */
  }
}

export function loadPersonalizedPuzzles(): PersonalizedPuzzle[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(PERSONALIZED_PUZZLES_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PersonalizedPuzzle[];
  } catch {
    return [];
  }
}
