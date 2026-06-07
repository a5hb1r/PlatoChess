import { useMemo } from "react";
import { BookOpen } from "lucide-react";
import { detectOpening } from "@/lib/opening-detect";

interface OpeningPanelProps {
  /** Played moves in SAN order (white move 1, black move 1, ...). */
  moves: readonly string[];
  className?: string;
}

/**
 * Side-panel "Stockfish analysis" surface that reports only the recognized
 * opening name. Centipawn scores, depth, principal variations, and best moves
 * are intentionally not rendered here.
 */
export function OpeningPanel({ moves, className = "" }: OpeningPanelProps) {
  const opening = useMemo(() => detectOpening(moves), [moves]);

  return (
    <div
      className={`rounded-lg border border-border bg-card p-4 space-y-2 ${className}`}
      data-testid="opening-panel"
    >
      <div className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <BookOpen className="h-3.5 w-3.5" />
        Opening
      </div>
      <p
        className="font-body text-sm text-foreground leading-snug min-h-[1.25rem]"
        data-testid="opening-name"
      >
        {opening?.name ?? (moves.length === 0 ? "Awaiting first move" : "Out of book")}
      </p>
    </div>
  );
}
