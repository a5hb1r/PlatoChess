/**
 * BoardArrows — chess.com-style move arrows rendered as an SVG overlay.
 * Drop inside any `relative` board container; it fills the box and maps
 * squares onto a 100×100 viewBox, honoring board orientation.
 */
import { memo } from "react";
import type { Square } from "chess.js";

export interface BoardArrow {
  from: Square;
  to: Square;
  /** Arrow color (default chess.com best-move green). */
  color?: string;
  opacity?: number;
}

function squareCenter(square: Square, flipped: boolean): { x: number; y: number } {
  let file = square.charCodeAt(0) - 97; // a→0 … h→7
  let rank = 8 - Number(square[1]); // rank 8 → row 0 (top)
  if (flipped) {
    file = 7 - file;
    rank = 7 - rank;
  }
  return { x: file * 12.5 + 6.25, y: rank * 12.5 + 6.25 };
}

export const BoardArrows = memo(function BoardArrows({
  arrows,
  flipped = false,
}: {
  arrows: BoardArrow[];
  flipped?: boolean;
}) {
  if (arrows.length === 0) return null;

  return (
    <svg
      viewBox="0 0 100 100"
      className="pointer-events-none absolute inset-0 z-40 h-full w-full"
      aria-hidden
    >
      {arrows.map((arrow, i) => {
        const start = squareCenter(arrow.from, flipped);
        const end = squareCenter(arrow.to, flipped);
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const len = Math.hypot(dx, dy);
        if (len < 1) return null;

        const ux = dx / len;
        const uy = dy / len;
        // Start a little off the piece so the arrow reads as a pointer, and
        // end with a solid triangular head.
        const startOffset = 4.2;
        const headLength = 4.4;
        const headWidth = 6.2;
        const sx = start.x + ux * startOffset;
        const sy = start.y + uy * startOffset;
        const bx = end.x - ux * headLength;
        const by = end.y - uy * headLength;
        const px = -uy;
        const py = ux;
        const color = arrow.color ?? "#81b64c";

        return (
          <g key={`${arrow.from}${arrow.to}${i}`} opacity={arrow.opacity ?? 0.8}>
            <line
              x1={sx}
              y1={sy}
              x2={bx}
              y2={by}
              stroke={color}
              strokeWidth={2.9}
              strokeLinecap="round"
            />
            <polygon
              points={`${end.x},${end.y} ${bx + (px * headWidth) / 2},${by + (py * headWidth) / 2} ${bx - (px * headWidth) / 2},${by - (py * headWidth) / 2}`}
              fill={color}
            />
          </g>
        );
      })}
    </svg>
  );
});
