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

const TONES: Record<string, ReviewTone> = {
  Brilliant: {
    text: "text-[#14b8a6]",
    chip: "bg-[#14b8a6]/15 text-[#99f6e4] border-[#14b8a6]/40",
    row: "border-l-[#14b8a6]/70",
  },
  Great: {
    text: "text-[#1d4ed8]",
    chip: "bg-[#1d4ed8]/15 text-[#bfdbfe] border-[#1d4ed8]/40",
    row: "border-l-[#1d4ed8]/70",
  },
  Best: {
    text: "text-[#22c55e]",
    chip: "bg-[#22c55e]/15 text-[#bbf7d0] border-[#22c55e]/40",
    row: "border-l-[#22c55e]/70",
  },
  Excellent: {
    text: "text-[#22c55e]",
    chip: "bg-[#22c55e]/15 text-[#bbf7d0] border-[#22c55e]/40",
    row: "border-l-[#22c55e]/70",
  },
  Good: {
    text: "text-[#22c55e]",
    chip: "bg-[#22c55e]/15 text-[#bbf7d0] border-[#22c55e]/40",
    row: "border-l-[#22c55e]/70",
  },
  Book: {
    text: "text-[#8b5e34]",
    chip: "bg-[#8b5e34]/20 text-[#f3e4cf] border-[#8b5e34]/45",
    row: "border-l-[#8b5e34]/70",
  },
  Inaccuracy: {
    text: "text-[#eab308]",
    chip: "bg-[#eab308]/15 text-[#fef08a] border-[#eab308]/40",
    row: "border-l-[#eab308]/70",
  },
  Miss: {
    text: "text-[#f97316]",
    chip: "bg-[#f97316]/15 text-[#fed7aa] border-[#f97316]/40",
    row: "border-l-[#f97316]/70",
  },
  Mistake: {
    text: "text-[#f97316]",
    chip: "bg-[#f97316]/15 text-[#fed7aa] border-[#f97316]/40",
    row: "border-l-[#f97316]/70",
  },
  Blunder: {
    text: "text-[#dc2626]",
    chip: "bg-[#dc2626]/15 text-[#fecaca] border-[#dc2626]/40",
    row: "border-l-[#dc2626]/70",
  },
};

export function reviewTone(label?: string): ReviewTone {
  if (!label) return DEFAULT_TONE;
  return TONES[label] ?? DEFAULT_TONE;
}
