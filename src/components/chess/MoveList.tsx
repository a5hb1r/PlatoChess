/**
 * MoveList — the scannable, side-by-side move history. Every ply shows its SAN
 * plus a classification glyph (once the game has been reviewed), and clicking a
 * ply jumps the board to that exact position.
 */
import { memo, useEffect, useRef } from "react";
import { History } from "lucide-react";
import { MoveGlyph } from "./MoveGlyph";
import { reviewTone } from "@/lib/review-colors";

export interface MoveListEntry {
  san: string;
  label?: string;
}

export interface MoveListProps {
  moves: MoveListEntry[];
  /** Ply index currently shown on the board (0-based), or -1 for the live tip. */
  activeIndex: number;
  onSelect: (plyIndex: number) => void;
}

function PlyButton({
  entry,
  index,
  active,
  onSelect,
}: {
  entry?: MoveListEntry;
  index: number;
  active: boolean;
  onSelect: (i: number) => void;
}) {
  if (!entry) return <span className="flex-1" />;
  const tone = entry.label ? reviewTone(entry.label) : null;
  return (
    <button
      onClick={() => onSelect(index)}
      data-active={active}
      className={`group flex flex-1 items-center justify-between gap-1 rounded-md px-2 py-1 text-left font-body text-sm transition-colors ${
        active ? "bg-foreground/15 text-foreground" : `hover:bg-secondary ${tone ? tone.text : "text-foreground/90"}`
      }`}
    >
      <span className="truncate font-medium">{entry.san}</span>
      <MoveGlyph label={entry.label} size={15} />
    </button>
  );
}

export const MoveList = memo(function MoveList({ moves, activeIndex, onSelect }: MoveListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRowRef = useRef<HTMLDivElement>(null);

  // Keep the active move visible as the game / navigation progresses.
  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIndex, moves.length]);

  if (moves.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
        <History className="h-8 w-8 opacity-40" />
        <p className="font-body text-sm">No moves yet</p>
        <p className="font-body text-xs">Click or drag a piece to begin</p>
      </div>
    );
  }

  const rows = Math.ceil(moves.length / 2);

  return (
    <div ref={scrollRef} className="scrollbar-hide max-h-[420px] flex-1 overflow-y-auto pr-1">
      <div className="space-y-0.5">
        {Array.from({ length: rows }, (_, i) => {
          const whiteIndex = i * 2;
          const blackIndex = i * 2 + 1;
          const isActiveRow = activeIndex === whiteIndex || activeIndex === blackIndex;
          return (
            <div
              key={i}
              ref={isActiveRow ? activeRowRef : undefined}
              className="flex items-center gap-1 rounded-md text-sm odd:bg-white/[0.015]"
            >
              <span className="w-7 shrink-0 text-right font-mono text-xs text-muted-foreground">{i + 1}.</span>
              <PlyButton entry={moves[whiteIndex]} index={whiteIndex} active={activeIndex === whiteIndex} onSelect={onSelect} />
              <PlyButton entry={moves[blackIndex]} index={blackIndex} active={activeIndex === blackIndex} onSelect={onSelect} />
            </div>
          );
        })}
      </div>
    </div>
  );
});
