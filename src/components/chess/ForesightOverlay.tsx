/**
 * ForesightOverlay — the "Tactical Foresight" HUD drawn on top of the board.
 *
 *  - Red ghost dots: squares the hovered enemy piece controls.
 *  - Green ghost dots: legal destinations of the hovered friendly piece.
 *  - Pin mapping: a marching-dash line links an enemy slider → the pinned
 *    piece → the high-value target (King/Queen), with a lock icon on the
 *    immobilized piece. This is PlatoChess's tactical edge over plain arrows.
 */
import { memo } from "react";
import { Lock } from "lucide-react";
import type { Square } from "chess.js";
import { squareToCoord } from "@/lib/chess-foresight";
import type { Pin } from "@/lib/chess-foresight";

type Orientation = "white" | "black";

/** Center of a square as board percentages (0-100), honoring orientation. */
function squareCenter(sq: Square, orientation: Orientation): { x: number; y: number } {
  const { f, r } = squareToCoord(sq);
  const col = orientation === "white" ? f : 7 - f;
  const rowFromTop = orientation === "white" ? 7 - r : r;
  return { x: (col + 0.5) * 12.5, y: (rowFromTop + 0.5) * 12.5 };
}

export interface ForesightOverlayProps {
  redSquares: Square[];
  greenSquares: Square[];
  pins: Pin[];
  orientation?: Orientation;
}

export const ForesightOverlay = memo(function ForesightOverlay({
  redSquares,
  greenSquares,
  pins,
  orientation = "white",
}: ForesightOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[25]">
      {/* Pin lines + lock icons */}
      {pins.length > 0 && (
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {pins.map((pin, i) => {
            const a = squareCenter(pin.attacker, orientation);
            const t = squareCenter(pin.target, orientation);
            const stroke = pin.targetType === "k" ? "#ef4444" : "#fb923c";
            return (
              <line
                key={`pinline-${i}`}
                x1={a.x}
                y1={a.y}
                x2={t.x}
                y2={t.y}
                stroke={stroke}
                strokeWidth={1.4}
                strokeOpacity={0.85}
                vectorEffect="non-scaling-stroke"
                className="pin-line"
              />
            );
          })}
        </svg>
      )}

      {/* Lock icons on pinned pieces */}
      {pins.map((pin, i) => {
        const p = squareCenter(pin.pinned, orientation);
        const color = pin.targetType === "k" ? "#ef4444" : "#fb923c";
        return (
          <div
            key={`lock-${i}`}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${p.x}%`, top: `${p.y - 5}%` }}
          >
            <span
              className="flex h-4 w-4 items-center justify-center rounded-full ring-2"
              style={{ backgroundColor: `${color}cc`, color: "#fff", boxShadow: `0 0 0 2px ${color}55` }}
            >
              <Lock className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
          </div>
        );
      })}

      {/* Enemy attack dots (red) */}
      {redSquares.map((sq) => {
        const c = squareCenter(sq, orientation);
        return (
          <div
            key={`red-${sq}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `${c.x}%`,
              top: `${c.y}%`,
              width: "26%",
              height: "26%",
              maxWidth: 26,
              maxHeight: 26,
              background: "radial-gradient(circle, rgba(239,68,68,0.42) 0%, rgba(239,68,68,0.12) 70%, transparent 72%)",
            }}
          />
        );
      })}

      {/* Friendly legal-move dots (green) */}
      {greenSquares.map((sq) => {
        const c = squareCenter(sq, orientation);
        return (
          <div
            key={`green-${sq}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `${c.x}%`,
              top: `${c.y}%`,
              width: "26%",
              height: "26%",
              maxWidth: 26,
              maxHeight: 26,
              background: "radial-gradient(circle, rgba(34,197,94,0.42) 0%, rgba(34,197,94,0.12) 70%, transparent 72%)",
            }}
          />
        );
      })}
    </div>
  );
});
