import type { ReviewedPly } from "@/lib/game-review";

/**
 * Display metadata for each move-quality label, ordered the way a premium
 * post-game report presents them (best → worst). The icon/symbol/impact copy
 * mirrors the high-end "Move Classification Summary" layout.
 */
export interface MoveQualityMeta {
  label: string;
  icon: string;
  symbol?: string;
  title: string;
  impact: string;
}

export const MOVE_QUALITY_ORDER: MoveQualityMeta[] = [
  { label: "Brilliant", icon: "🌟", symbol: "!!", title: "Brilliant", impact: "Game-changing, level-adjusted sacrifice" },
  { label: "Great", icon: "⭐", symbol: "*", title: "Great Move", impact: "The single critical saving or winning move" },
  { label: "Best", icon: "🟢", title: "Best Move", impact: "Top engine choice" },
  { label: "Excellent", icon: "✅", title: "Excellent", impact: "Kept the position solid" },
  { label: "Good", icon: "⚪", title: "Good", impact: "Sub-optimal but playable" },
  { label: "Inaccuracy", icon: "🟡", symbol: "?", title: "Inaccuracy", impact: "Minor tactical slip" },
  { label: "Mistake", icon: "🟠", symbol: "?", title: "Mistake", impact: "Lost a noticeable advantage" },
  { label: "Blunder", icon: "🔴", symbol: "??", title: "Blunder", impact: "Major tactical failure or material loss" },
];

export type MoveQualityCounts = Record<string, number>;

export interface MoveClassificationRow extends MoveQualityMeta {
  total: number;
  white: number;
  black: number;
}

/** Tally how many moves landed in each quality bucket, split by side. */
export function summarizeMoveClassifications(moves: ReviewedPly[]): MoveClassificationRow[] {
  const total: MoveQualityCounts = {};
  const white: MoveQualityCounts = {};
  const black: MoveQualityCounts = {};
  for (const move of moves) {
    total[move.label] = (total[move.label] ?? 0) + 1;
    if (move.side === "w") white[move.label] = (white[move.label] ?? 0) + 1;
    else black[move.label] = (black[move.label] ?? 0) + 1;
  }
  return MOVE_QUALITY_ORDER.map((meta) => ({
    ...meta,
    total: total[meta.label] ?? 0,
    white: white[meta.label] ?? 0,
    black: black[meta.label] ?? 0,
  }));
}

/**
 * Reverse the mate encoding used by `probeResultToCp` so a stored centipawn
 * score can be rendered as `M3` / `-M2` when it represents a forced mate.
 */
const MATE_THRESHOLD = 30000;

export function describeEval(cp: number): string {
  if (cp >= MATE_THRESHOLD) {
    const mate = Math.max(1, Math.round((32000 - cp) / 80));
    return `M${mate}`;
  }
  if (cp <= -MATE_THRESHOLD) {
    const mate = Math.max(1, Math.round((cp + 32000) / 80));
    return `-M${mate}`;
  }
  return `${cp >= 0 ? "+" : ""}${(cp / 100).toFixed(1)}`;
}

export interface EvaluationPhase {
  name: "Opening" | "Middlegame" | "Endgame";
  present: boolean;
  evalCp: number;
  evalText: string;
  note: string;
}

const PHASE_NAMES: EvaluationPhase["name"][] = ["Opening", "Middlegame", "Endgame"];
const CRITICAL_LABELS = new Set(["Inaccuracy", "Mistake", "Blunder"]);

function fullMoveNumber(ply: number): number {
  return Math.ceil(ply / 2);
}

function describePhase(name: EvaluationPhase["name"], segment: ReviewedPly[]): EvaluationPhase {
  if (segment.length === 0) {
    return { name, present: false, evalCp: 0, evalText: "—", note: "Not reached" };
  }
  const last = segment[segment.length - 1];
  const evalCp = last.evalAfterCp ?? 0;

  // Highlight the most damaging error in the phase, if any.
  let worst: ReviewedPly | null = null;
  for (const move of segment) {
    if (!CRITICAL_LABELS.has(move.label)) continue;
    if (!worst || move.cpLoss > worst.cpLoss) worst = move;
  }

  let note: string;
  if (worst && (worst.label === "Mistake" || worst.label === "Blunder")) {
    const side = worst.side === "w" ? "White" : "Black";
    note = `${worst.label} by ${side} on move ${fullMoveNumber(worst.ply)} (${worst.san})`;
  } else if (Math.abs(evalCp) >= MATE_THRESHOLD) {
    note = "Forced checkmate sequence";
  } else if (Math.abs(evalCp) < 50) {
    note = "Balanced play";
  } else {
    note = evalCp > 0 ? "White holds the edge" : "Black holds the edge";
  }

  return { name, present: true, evalCp, evalText: describeEval(evalCp), note };
}

/**
 * Split the reviewed plies into three contiguous phases (opening / middlegame /
 * endgame) and summarise the evaluation at the end of each phase. Splitting
 * proportionally keeps the timeline meaningful for both short and long games.
 */
export function buildEvaluationPhases(moves: ReviewedPly[]): EvaluationPhase[] {
  if (moves.length === 0) {
    return PHASE_NAMES.map((name) => ({ name, present: false, evalCp: 0, evalText: "—", note: "Not reached" }));
  }
  const third = moves.length / 3;
  const segments: ReviewedPly[][] = [
    moves.slice(0, Math.ceil(third)),
    moves.slice(Math.ceil(third), Math.ceil(third * 2)),
    moves.slice(Math.ceil(third * 2)),
  ];
  return PHASE_NAMES.map((name, i) => describePhase(name, segments[i]));
}
