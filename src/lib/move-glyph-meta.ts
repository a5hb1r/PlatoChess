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

/**
 * Canonical metadata for every classification label.
 * Colors match Chess.com's analysis palette exactly:
 * Brilliant #26c2a3 · Great #749bbf · Best #81b64c · Excellent #96bc4b ·
 * Good #95af8a · Book #d5a47d · Inaccuracy #f7c631 · Mistake #ffa459 ·
 * Miss #ff7769 · Blunder #fa412d
 */
export const GLYPH_META: Record<string, GlyphMeta> = {
  Brilliant: { shape: "double-bang", bg: "#26c2a3", fg: "#06281f", title: "Brilliant — a sharp, optimal sacrifice" },
  Great: { shape: "bang", bg: "#749bbf", fg: "#08151f", title: "Great Move — the only move that holds or wins" },
  Best: { shape: "check", bg: "#81b64c", fg: "#0f2107", title: "Best Move — the top engine choice" },
  Excellent: { shape: "check", bg: "#96bc4b", fg: "#10210a", title: "Excellent — keeps the advantage" },
  Good: { shape: "dot", bg: "#95af8a", fg: "#0d1a08", title: "Good — a solid, reasonable move" },
  Book: { shape: "book", bg: "#d5a47d", fg: "#241606", title: "Book — known opening theory" },
  Inaccuracy: { shape: "ql", bg: "#f7c631", fg: "#2e2304", title: "Inaccuracy — slightly drops evaluation" },
  Miss: { shape: "cross", bg: "#ff7769", fg: "#2a0a05", title: "Miss — a tactical shot or forced win was available" },
  Mistake: { shape: "q", bg: "#ffa459", fg: "#2a1804", title: "Mistake — noticeably worsens the position" },
  Blunder: { shape: "qq", bg: "#fa412d", fg: "#2a0606", title: "Blunder — a major error or loss of material" },
};

/** True for labels that represent a damaging move (used to offer "Retry"). */
export function isMistakeLabel(label?: string): boolean {
  return label === "Mistake" || label === "Blunder" || label === "Miss";
}
