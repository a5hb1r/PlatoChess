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
