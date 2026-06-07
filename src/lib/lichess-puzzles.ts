import { Chess } from "chess.js";

interface LichessApiResponse {
  game: { pgn: string };
  puzzle: {
    id: string;
    initialPly: number;
    rating: number;
    solution: string[];
    themes: string[];
  };
}

export interface LichessPuzzle {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  fen: string;
  playerColor: "w" | "b";
  solution: string[];
  hint: string;
  rating: number;
  source: "lichess";
}

// Maps Lichess theme names to our UI category labels
const THEME_TO_CATEGORY: Record<string, string> = {
  fork: "Fork",
  pin: "Pin",
  skewer: "Skewer",
  backRankMate: "Back Rank",
  mateIn1: "Mate in 1",
  mateIn2: "Mate in 2",
  discoveredAttack: "Discovery",
  deflection: "Deflection",
  endgame: "Endgame",
  sacrifice: "Sacrifice",
  attraction: "Tactics",
  interference: "Tactics",
  middlegame: "Tactics",
  opening: "Tactics",
  zugzwang: "Tactics",
  trappedPiece: "Tactics",
  hangingPiece: "Tactics",
  advancedPawn: "Tactics",
  promotion: "Tactics",
  quietMove: "Tactics",
  defensiveMove: "Tactics",
};

// Maps our category labels to Lichess angle param for targeted fetching
export const CATEGORY_TO_ANGLE: Record<string, string> = {
  Fork: "fork",
  Pin: "pin",
  Skewer: "skewer",
  "Back Rank": "backRankMate",
  "Mate in 1": "mateIn1",
  "Mate in 2": "mateIn2",
  Discovery: "discoveredAttack",
  Deflection: "deflection",
  Endgame: "endgame",
  Sacrifice: "sacrifice",
  Tactics: "middlegame",
};

function themesToCategory(themes: string[]): string {
  for (const theme of themes) {
    const cat = THEME_TO_CATEGORY[theme];
    if (cat) return cat;
  }
  return "Tactics";
}

function ratingToDifficulty(rating: number): "easy" | "medium" | "hard" {
  if (rating < 1300) return "easy";
  if (rating < 1700) return "medium";
  return "hard";
}

function themeToHint(themes: string[]): string {
  const hints: Record<string, string> = {
    fork: "One move attacks two pieces at once.",
    pin: "A piece is pinned to a more valuable piece behind it.",
    skewer: "Attack a valuable piece — something better is hiding behind it.",
    backRankMate: "The king is trapped on the back rank.",
    mateIn1: "Find the checkmate in one move.",
    mateIn2: "Force checkmate in two moves.",
    discoveredAttack: "Moving one piece reveals an attack from another.",
    deflection: "Force a defending piece to leave its post.",
    endgame: "Use precise technique to convert the endgame.",
    sacrifice: "Give up material to gain a decisive advantage.",
    attraction: "Lure the enemy king or piece to a bad square.",
    interference: "Cut off a defender's line of communication.",
    zugzwang: "Force the opponent into a position where any move loses.",
    trappedPiece: "A piece has no safe squares to go to.",
    hangingPiece: "Win a piece that is left undefended.",
  };
  for (const theme of themes) {
    if (hints[theme]) return hints[theme];
  }
  return "Find the best tactical continuation.";
}

function reconstructFen(
  pgn: string,
  initialPly: number
): { fen: string; playerColor: "w" | "b" } | null {
  try {
    const full = new Chess();
    full.loadPgn(pgn);
    const history = full.history({ verbose: true });

    const g = new Chess();
    for (let i = 0; i < initialPly && i < history.length; i++) {
      g.move(history[i]);
    }
    return { fen: g.fen(), playerColor: g.turn() as "w" | "b" };
  } catch {
    return null;
  }
}

const CACHE_KEY = "lichess_puzzle_cache_v2";
const CACHE_MAX = 200;

export function loadCachedPuzzles(): LichessPuzzle[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as LichessPuzzle[]) : [];
  } catch {
    return [];
  }
}

export function savePuzzlesToCache(puzzles: LichessPuzzle[]): void {
  try {
    const existing = loadCachedPuzzles();
    const seen = new Set(existing.map((p) => p.id));
    const fresh = puzzles.filter((p) => !seen.has(p.id));
    const merged = [...existing, ...fresh].slice(-CACHE_MAX);
    localStorage.setItem(CACHE_KEY, JSON.stringify(merged));
  } catch {
    // storage full — silently skip
  }
}

export async function fetchLichessPuzzle(
  angle?: string
): Promise<LichessPuzzle | null> {
  try {
    const url = angle
      ? `https://lichess.org/api/puzzle/next?angle=${angle}`
      : "https://lichess.org/api/puzzle/next";

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;

    const data: LichessApiResponse = await res.json();
    const position = reconstructFen(data.game.pgn, data.puzzle.initialPly);
    if (!position) return null;

    const category = themesToCategory(data.puzzle.themes);

    return {
      id: data.puzzle.id,
      title: `${category} (${data.puzzle.rating})`,
      description: `Lichess puzzle #${data.puzzle.id} — ${data.puzzle.themes.slice(0, 2).join(", ")}.`,
      category,
      difficulty: ratingToDifficulty(data.puzzle.rating),
      fen: position.fen,
      playerColor: position.playerColor,
      solution: data.puzzle.solution,
      hint: themeToHint(data.puzzle.themes),
      rating: data.puzzle.rating,
      source: "lichess",
    };
  } catch {
    return null;
  }
}

export async function fetchPuzzleBatch(
  count: number,
  angle?: string
): Promise<LichessPuzzle[]> {
  const results = await Promise.allSettled(
    Array.from({ length: count }, () => fetchLichessPuzzle(angle))
  );
  return results
    .filter(
      (r): r is PromiseFulfilledResult<LichessPuzzle> =>
        r.status === "fulfilled" && r.value !== null
    )
    .map((r) => r.value);
}
