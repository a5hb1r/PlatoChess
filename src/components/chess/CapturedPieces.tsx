/**
 * CapturedPieces — miniature SVG icons of the pieces a player has captured,
 * plus the material advantage (+N) when that side is ahead. Pieces overlap
 * slightly to stay compact inside the player banner.
 */
import { memo } from "react";
import type { Color, PieceSymbol } from "chess.js";
import { PIECE_URLS } from "@/lib/chess-constants";

export interface CapturedPiecesProps {
  /** The piece types this player has captured. */
  pieces: PieceSymbol[];
  /** Color of the captured pieces (the opponent's color). */
  color: Color;
  /** Point advantage to display (only shown when > 0). */
  advantage?: number;
  className?: string;
}

export const CapturedPieces = memo(function CapturedPieces({
  pieces,
  color,
  advantage = 0,
  className = "",
}: CapturedPiecesProps) {
  if (pieces.length === 0 && advantage <= 0) {
    return <div className={`h-4 ${className}`} aria-hidden="true" />;
  }

  return (
    <div className={`flex h-4 items-center ${className}`}>
      <div className="flex items-center">
        {pieces.map((type, i) => (
          <img
            key={`${type}-${i}`}
            src={PIECE_URLS[color][type]}
            alt={`captured ${type}`}
            draggable={false}
            className="h-4 w-4 object-contain opacity-95"
            style={{ marginLeft: i === 0 ? 0 : -6 }}
          />
        ))}
      </div>
      {advantage > 0 && (
        <span className="ml-1.5 font-mono text-xs font-semibold text-muted-foreground">+{advantage}</span>
      )}
    </div>
  );
});
