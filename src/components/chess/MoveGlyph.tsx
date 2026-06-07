/**
 * MoveGlyph — the small circular classification badge shown next to a move
 * (Brilliant, Great, Best, Excellent, Good, Book, Inaccuracy, Miss, Mistake,
 * Blunder). Each glyph is a crisp inline SVG so it stays sharp at any size and
 * keeps the move list scannable, mirroring Chess.com's review symbols.
 */
import { memo } from "react";
import { GLYPH_META, type GlyphShape } from "@/lib/move-glyph-meta";

function GlyphSymbol({ shape, color }: { shape: GlyphShape; color: string }) {
  const stroke = { stroke: color, strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  switch (shape) {
    case "check":
      return <path d="M6 12.5l3.2 3.4L18 7.5" {...stroke} />;
    case "double-bang":
      return (
        <text x="12" y="17" textAnchor="middle" fontSize="13" fontWeight="800" fill={color} fontFamily="Inter, sans-serif">
          !!
        </text>
      );
    case "bang":
      return (
        <text x="12" y="17.2" textAnchor="middle" fontSize="15" fontWeight="800" fill={color} fontFamily="Inter, sans-serif">
          !
        </text>
      );
    case "ql":
      return (
        <text x="12" y="17" textAnchor="middle" fontSize="12" fontWeight="800" fill={color} fontFamily="Inter, sans-serif">
          ?!
        </text>
      );
    case "q":
      return (
        <text x="12" y="17.3" textAnchor="middle" fontSize="15" fontWeight="800" fill={color} fontFamily="Inter, sans-serif">
          ?
        </text>
      );
    case "qq":
      return (
        <text x="12" y="17" textAnchor="middle" fontSize="13" fontWeight="800" fill={color} fontFamily="Inter, sans-serif">
          ??
        </text>
      );
    case "cross":
      return (
        <>
          <path d="M7.5 7.5l9 9M16.5 7.5l-9 9" {...stroke} />
        </>
      );
    case "book":
      return (
        <path
          d="M6 7.5c2-1 4-1 6 0 2-1 4-1 6 0v9c-2-1-4-1-6 0-2-1-4-1-6 0z M12 7.5v9"
          {...stroke}
          strokeWidth={1.8}
        />
      );
    case "dot":
    default:
      return <circle cx="12" cy="12" r="3.2" fill={color} />;
  }
}

export interface MoveGlyphProps {
  label?: string;
  size?: number;
  className?: string;
}

export const MoveGlyph = memo(function MoveGlyph({ label, size = 16, className = "" }: MoveGlyphProps) {
  if (!label) return null;
  const meta = GLYPH_META[label];
  if (!meta) return null;

  return (
    <span
      title={meta.title}
      aria-label={meta.title}
      className={`inline-flex shrink-0 items-center justify-center rounded-full shadow-sm ${className}`}
      style={{ width: size, height: size, backgroundColor: meta.bg }}
    >
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <GlyphSymbol shape={meta.shape} color={meta.fg} />
      </svg>
    </span>
  );
});
