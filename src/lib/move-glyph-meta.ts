/**
 * Classification glyph metadata shared by the MoveGlyph component and the
 * review UIs. Kept separate from the component so the component file only
 * exports a component (keeps React Fast Refresh happy).
 */
export type GlyphShape =
  | "double-bang"
  | "bang"
  | "check"
  | "dot"
  | "book"
  | "ql"
  | "q"
  | "qq"
  | "cross";

export interface GlyphMeta {
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

/** True for labels that represent a damaging move (used to offer "Retry"). */
export function isMistakeLabel(label?: string): boolean {
  return label === "Mistake" || label === "Blunder" || label === "Miss";
}
