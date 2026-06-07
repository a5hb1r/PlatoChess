/**
 * EvalBar — vertical evaluation bar beside the board. Maps the engine's
 * centipawn score to a win-probability height with a logistic curve (the same
 * shape Chess.com / Lichess use) so small edges read sensibly and decisive
 * positions saturate. The fill animates smoothly via a CSS transition.
 */
import { memo, useMemo } from "react";

export interface EvalBarProps {
  /** White-positive centipawns. Use the mate prop for forced mates. */
  cp: number;
  /** Positive = white mates in N, negative = black mates in N. */
  mate?: number | null;
  /** When true the board is shown from Black's side, so flip the fill. */
  flipped?: boolean;
  className?: string;
}

/** Logistic win-probability for White, 0..1. */
function winProbability(cp: number): number {
  return 1 / (1 + Math.pow(10, -cp / 400));
}

export const EvalBar = memo(function EvalBar({ cp, mate, flipped = false, className = "" }: EvalBarProps) {
  const { whitePercent, label, whiteWinning } = useMemo(() => {
    if (mate !== undefined && mate !== null && mate !== 0) {
      const winning = mate > 0;
      return {
        whitePercent: winning ? 100 : 0,
        label: `${winning ? "" : "-"}M${Math.abs(mate)}`,
        whiteWinning: winning,
      };
    }
    const clamped = Math.max(-1500, Math.min(1500, cp));
    const pct = winProbability(clamped) * 100;
    const pawns = (cp / 100).toFixed(1);
    return {
      whitePercent: pct,
      label: cp >= 0 ? `+${pawns}` : pawns,
      whiteWinning: cp >= 0,
    };
  }, [cp, mate]);

  // The white fill always grows from White's end of the board.
  const fillFromBottom = !flipped;

  return (
    <div
      className={`relative w-7 overflow-hidden rounded-lg border border-white/10 bg-[#403d39] shadow-inner ${className}`}
      role="meter"
      aria-label={`Evaluation ${label}`}
    >
      <div
        className="eval-fill absolute inset-x-0 bg-gradient-to-b from-[#f8f9fa] to-[#d9dee3]"
        style={fillFromBottom ? { bottom: 0, height: `${whitePercent}%` } : { top: 0, height: `${whitePercent}%` }}
      />
      {/* Midline marker */}
      <div className="absolute inset-x-0 top-1/2 h-px bg-black/30" />
      {/* The score label sits on whichever side is winning, in that side's color. */}
      <span
        className={`absolute inset-x-0 text-center font-mono text-[9px] font-bold tracking-tight ${
          whiteWinning ? "text-[#2b2b2b]" : "text-white/90"
        } ${(whiteWinning ? !flipped : flipped) ? "bottom-1" : "top-1"}`}
      >
        {label}
      </span>
    </div>
  );
});
