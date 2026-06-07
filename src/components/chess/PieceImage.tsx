/**
 * Shared crisp SVG piece renderer. Uses the bundled Cburnett vector set (the
 * same high-fidelity vectors used by Lichess / referenced by Chess.com's Neo
 * style) so pieces stay razor-sharp at any board size, with a subtle drop
 * shadow for the premium, lifted look.
 */
import { memo } from "react";
import type { Color, PieceSymbol } from "chess.js";
import { PIECE_URLS } from "@/lib/chess-constants";

export interface PieceImageProps {
  color: Color | "w" | "b";
  type: PieceSymbol | string;
  className?: string;
  /** Slightly larger + stronger shadow while selected / dragging. */
  active?: boolean;
}

export const PieceImage = memo(function PieceImage({ color, type, className = "", active = false }: PieceImageProps) {
  return (
    <img
      src={PIECE_URLS[color][type]}
      alt={`${color} ${type}`}
      draggable={false}
      className={`pointer-events-none select-none object-contain transition-transform duration-150 ease-out ${
        active ? "scale-110 drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)]" : "drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]"
      } ${className}`}
    />
  );
});
