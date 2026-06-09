import type { Color } from "chess.js";
import { supabase } from "@/integrations/supabase/client";

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
export const GAME_HISTORY_STORAGE_KEY = "platochess:game-history";
const ANALYSIS_TRANSITION_STORAGE_KEY = "platochess:analysis-transition-start-ms";

/** Maximum number of entries kept in the rolling game-history list. */
const GAME_HISTORY_MAX = 50;

export interface FinishedGameSnapshot {
  createdAt: number;
  pgn: string;
  result: string;
  engine: string;
}

/**
 * Lightweight record saved for every completed game so the Dashboard can show
 * a full history list (opponent name, result, date, move count, accuracy).
 */
export interface GameHistoryEntry {
  id: string;
  createdAt: number;
  opponent: string;
  result: "win" | "loss" | "draw";
  resultDetail: string;
  moveCount: number;
  /** Accuracy scores after analysis; null until/unless the user runs the review. */
  accuracy?: { w: number; b: number } | null;
  pgn?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Game History helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getGameHistory(): GameHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(GAME_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as GameHistoryEntry[];
  } catch {
    return [];
  }
}

/**
 * Persist a new game entry.
 *
 * Always writes to localStorage so the Dashboard works instantly and offline.
 * When `userId` is supplied (user is logged in) also upserts the row to
 * Supabase so history syncs across devices — fire-and-forget, never throws.
 */
export function appendToGameHistory(
  entry: GameHistoryEntry,
  userId?: string | null,
): void {
  // ── localStorage (always) ──────────────────────────────────────────────────
  if (typeof localStorage !== "undefined") {
    try {
      const existing = getGameHistory();
      // Prepend newest entry; cap at max.
      const updated = [entry, ...existing].slice(0, GAME_HISTORY_MAX);
      localStorage.setItem(GAME_HISTORY_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      /* ignore storage failures */
    }
  }

  // ── Supabase (logged-in users only) ────────────────────────────────────────
  if (userId) {
    supabase
      .from("game_history")
      .upsert(
        {
          id: entry.id,
          user_id: userId,
          opponent: entry.opponent,
          result: entry.result,
          result_detail: entry.resultDetail,
          move_count: entry.moveCount,
          accuracy_w: entry.accuracy?.w ?? null,
          accuracy_b: entry.accuracy?.b ?? null,
          pgn: entry.pgn ?? null,
          created_at: new Date(entry.createdAt).toISOString(),
        },
        { onConflict: "user_id,id" },
      )
      .then(({ error }) => {
        if (error) console.warn("[game-history] upsert failed:", error.message);
      });
  }
}

/**
 * Patch the accuracy fields on an existing history entry.
 *
 * Always updates localStorage. When `userId` is supplied also updates the
 * Supabase row — fire-and-forget, never throws.
 */
export function updateGameHistoryAccuracy(
  id: string,
  accuracy: { w: number; b: number },
  userId?: string | null,
): void {
  // ── localStorage (always) ──────────────────────────────────────────────────
  if (typeof localStorage !== "undefined") {
    try {
      const existing = getGameHistory();
      const updated = existing.map((e) => (e.id === id ? { ...e, accuracy } : e));
      localStorage.setItem(GAME_HISTORY_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      /* ignore */
    }
  }

  // ── Supabase (logged-in users only) ────────────────────────────────────────
  if (userId) {
    supabase
      .from("game_history")
      .update({ accuracy_w: accuracy.w, accuracy_b: accuracy.b })
      .eq("user_id", userId)
      .eq("id", id)
      .then(({ error }) => {
        if (error)
          console.warn("[game-history] accuracy update failed:", error.message);
      });
  }
}

/**
 * Fetch the full game history for a logged-in user from Supabase.
 * Returns entries sorted newest-first, capped at GAME_HISTORY_MAX.
 * Falls back to an empty array on error — callers should display localStorage
 * data while this promise is pending.
 */
export async function getGameHistoryForUser(
  userId: string,
): Promise<GameHistoryEntry[]> {
  const { data, error } = await supabase
    .from("game_history")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(GAME_HISTORY_MAX);

  if (error || !data) {
    console.warn("[game-history] fetch failed:", error?.message);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    createdAt: new Date(row.created_at).getTime(),
    opponent: row.opponent,
    result: row.result as "win" | "loss" | "draw",
    resultDetail: row.result_detail,
    moveCount: row.move_count,
    accuracy:
      row.accuracy_w != null && row.accuracy_b != null
        ? { w: Number(row.accuracy_w), b: Number(row.accuracy_b) }
        : null,
    pgn: row.pgn ?? undefined,
  }));
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
