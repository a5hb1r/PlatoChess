/**
 * MoveGlyph — the small circular classification badge shown next to a move
 * (Brilliant, Great, Best, Excellent, Good, Book, Inaccuracy, Miss, Mistake,
 * Blunder). Each glyph is a crisp inline SVG so it stays sharp at any size and
 * keeps the move list scannable, mirroring Chess.com's review symbols.
 */
import { memo } from "react";

type GlyphShape = "double-bang" | "bang" | "check" | "dot" | "book" | "ql" | "q" | "qq" | "cross";

interface GlyphMeta {
  shape: GlyphShape;
  /** Solid badge background. */
  bg: string;
  /** Symbol / foreground color. */
  fg: string;
  title: string;
}

/** Canonical metadata for every classification label. */
export const GLYPH_META: Record<string, GlyphMeta> = {
  Brilliant: { shape: "double-bang", bg: "#26c2a3", fg: "#06281f", title: "Brilliant — a sharp, optimal sacrifice" },
  Great: { shape: "bang", bg: "#5b8baf", fg: "#08151f", title: "Great move — the only move that holds or wins" },
  Best: { shape: "check", bg: "#81b64c", fg: "#0f2107", title: "Best move — the top engine choice" },
  Excellent: { shape: "check", bg: "#95b776", fg: "#10210a", title: "Excellent — keeps the advantage" },
  Good: { shape: "dot", bg: "#7a9b6a", fg: "#0d1a08", title: "Good — a solid, reasonable move" },
  Book: { shape: "book", bg: "#a88865", fg: "#241606", title: "Book — known opening theory" },
  Inaccuracy: { shape: "ql", bg: "#f7c045", fg: "#2e2304", title: "Inaccuracy — slightly drops evaluation" },
  Miss: { shape: "cross", bg: "#ee6b55", fg: "#2a0a05", title: "Missed win — a tactical shot or forced win was available" },
  Mistake: { shape: "q", bg: "#e58f2a", fg: "#2a1804", title: "Mistake — noticeably worsens the position" },
  Blunder: { shape: "qq", bg: "#ca3431", fg: "#2a0606", title: "Blunder — a major error or loss of material" },
};

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

/** True for labels that represent a damaging move (used to offer "Retry"). */
export function isMistakeLabel(label?: string): boolean {
  return label === "Mistake" || label === "Blunder" || label === "Miss";
}
