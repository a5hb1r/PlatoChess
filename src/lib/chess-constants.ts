/**
 * Chess piece sets — all vendored locally in /public/pieces/<set>/ with their
 * licenses, so pieces load instantly with no third-party network dependency.
 *
 * PIECE_URLS is a live map: applyPieceSet() rewrites its entries in place, so
 * every board (they all read it at render time) shows the user's chosen set.
 */

export type PieceSetId =
  | "chessnut"
  | "cburnett"
  | "merida"
  | "kosal"
  | "skak"
  | "flat"
  | "synthwave"
  | "imperial";

export const PIECE_SETS: Record<PieceSetId, { label: string; description: string }> = {
  chessnut: { label: "Chessnut", description: "Bold and modern — the default" },
  flat: { label: "Modern Flat", description: "Crisp minimal vectors, premium finish" },
  synthwave: { label: "Synthwave", description: "Neon turquoise vs. magenta glow" },
  imperial: { label: "Imperial", description: "Luxury gold and obsidian" },
  cburnett: { label: "Classic", description: "The familiar standard seen everywhere" },
  merida: { label: "Merida", description: "Elegant traditional engraving" },
  kosal: { label: "Kosal", description: "Clean minimalist lines" },
  skak: { label: "Skak", description: "Classic LaTeX book style" },
};

export const DEFAULT_PIECE_SET: PieceSetId = "chessnut";
export const PIECE_SET_STORAGE_KEY = "platochess-piece-set";

export function isPieceSetId(s: string): s is PieceSetId {
  return s in PIECE_SETS;
}

const FILE_BY_TYPE: Record<string, string> = { k: "K", q: "Q", r: "R", b: "B", n: "N", p: "P" };

/** URL of one piece image for a given set. */
export function pieceUrl(set: PieceSetId, color: "w" | "b", type: string): string {
  return `/pieces/${set}/${color}${FILE_BY_TYPE[type] ?? "P"}.svg`;
}

export function getStoredPieceSet(): PieceSetId {
  try {
    const s = localStorage.getItem(PIECE_SET_STORAGE_KEY);
    if (s && isPieceSetId(s)) return s;
  } catch {
    /* SSR / private mode */
  }
  return DEFAULT_PIECE_SET;
}

/** Live piece-URL map — entries are swapped in place by applyPieceSet(). */
export const PIECE_URLS: Record<string, Record<string, string>> = { w: {}, b: {} };

export function applyPieceSet(set: PieceSetId): void {
  for (const color of ["w", "b"] as const) {
    for (const type of Object.keys(FILE_BY_TYPE)) {
      PIECE_URLS[color][type] = pieceUrl(set, color, type);
    }
  }
  try {
    localStorage.setItem(PIECE_SET_STORAGE_KEY, set);
  } catch {
    /* ignore */
  }
}

// Initialize from the stored preference at module load.
applyPieceSet(getStoredPieceSet());
