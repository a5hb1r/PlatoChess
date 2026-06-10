export type ReviewTone = {
  text: string;
  chip: string;
  row: string;
};

const DEFAULT_TONE: ReviewTone = {
  text: "text-foreground",
  chip: "bg-foreground/10 text-foreground border-foreground/20",
  row: "border-l-foreground/30",
};

/** Chess.com analysis palette — keep in sync with GLYPH_META in move-glyph-meta.ts. */
const TONES: Record<string, ReviewTone> = {
  Brilliant: {
    text: "text-[#26c2a3]",
    chip: "bg-[#26c2a3]/15 text-[#7ee9d4] border-[#26c2a3]/40",
    row: "border-l-[#26c2a3]/70",
  },
  Great: {
    text: "text-[#749bbf]",
    chip: "bg-[#749bbf]/15 text-[#b8d2e8] border-[#749bbf]/40",
    row: "border-l-[#749bbf]/70",
  },
  Best: {
    text: "text-[#81b64c]",
    chip: "bg-[#81b64c]/15 text-[#c6e3a2] border-[#81b64c]/40",
    row: "border-l-[#81b64c]/70",
  },
  Excellent: {
    text: "text-[#96bc4b]",
    chip: "bg-[#96bc4b]/15 text-[#d2e8a6] border-[#96bc4b]/40",
    row: "border-l-[#96bc4b]/70",
  },
  Good: {
    text: "text-[#95af8a]",
    chip: "bg-[#95af8a]/15 text-[#d3e0cc] border-[#95af8a]/40",
    row: "border-l-[#95af8a]/70",
  },
  Book: {
    text: "text-[#d5a47d]",
    chip: "bg-[#d5a47d]/20 text-[#f0dcc8] border-[#d5a47d]/45",
    row: "border-l-[#d5a47d]/70",
  },
  Inaccuracy: {
    text: "text-[#f7c631]",
    chip: "bg-[#f7c631]/15 text-[#fbe79a] border-[#f7c631]/40",
    row: "border-l-[#f7c631]/70",
  },
  Miss: {
    text: "text-[#ff7769]",
    chip: "bg-[#ff7769]/15 text-[#ffc4bd] border-[#ff7769]/40",
    row: "border-l-[#ff7769]/70",
  },
  Mistake: {
    text: "text-[#ffa459]",
    chip: "bg-[#ffa459]/15 text-[#ffd6b3] border-[#ffa459]/40",
    row: "border-l-[#ffa459]/70",
  },
  Blunder: {
    text: "text-[#fa412d]",
    chip: "bg-[#fa412d]/15 text-[#fda99f] border-[#fa412d]/40",
    row: "border-l-[#fa412d]/70",
  },
};

export function reviewTone(label?: string): ReviewTone {
  if (!label) return DEFAULT_TONE;
  return TONES[label] ?? DEFAULT_TONE;
}
