import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ChevronRight,
  Trophy,
  Target,
  Lightbulb,
  CheckCircle,
  XCircle,
  SkipForward,
  RotateCcw,
  Flame,
  Zap,
  Shield,
  Crown,
  Swords,
  Sparkles,
  Gift,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Chess, Color, Square, PieceSymbol } from "chess.js";
import { ChessSounds, playMoveSound } from "@/lib/sounds";
import { GameSettingsMenu } from "@/components/GameSettingsMenu";
import { useTheme } from "@/contexts/ThemeContext";
import { PIECE_URLS } from "@/lib/chess-constants";
import { loadPersonalizedPuzzles } from "@/lib/game-review";

interface Puzzle {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  fen: string;
  playerColor: "w" | "b";
  solution: string[]; // Alternating player/opponent moves in UCI (e.g. "e7e8q")
  hint: string;
  source?: "default" | "personalized";
}

const BASE_PUZZLES: Puzzle[] = [
  // Positions verified against move playouts; many match public Lichess puzzle records.
  // === FORKS ===
  {
    id: "fork-lic-z8aS6",
    title: "Knight jump with tempo",
    description: "Knight fork and breakthrough on the kingside (Lichess puzzle z8aS6).",
    category: "Fork",
    difficulty: "medium",
    fen: "5rk1/3q1pp1/bp4r1/1N1p1N2/PQ6/4P1P1/1P2K2P/7R w - - 1 1",
    playerColor: "w",
    solution: ["f5e7", "g8h7", "e7g6", "f7g6", "b4f8"],
    hint: "Look for a knight check that lines up a decisive follow-up on the light squares.",
  },
  {
    id: "fork-2",
    title: "Royal Fork",
    description: "Central knight fork regains the pawn with interest.",
    category: "Fork",
    difficulty: "medium",
    fen: "r3k2r/ppp2ppp/2n1b3/3q4/3P4/2N2N2/PPP2PPP/R1BQR1K1 w kq - 0 10",
    playerColor: "w",
    solution: ["f3e5", "c6e5", "d4e5"],
    hint: "Can your knight land on a central square attacking multiple pieces?",
  },
  {
    id: "fork-lic-CT2JL",
    title: "Attraction on g4",
    description: "Sac the queen to unleash a knight fork (Lichess puzzle CT2JL).",
    category: "Fork",
    difficulty: "hard",
    fen: "rn3rk1/ppp2p1p/3p2p1/3P4/2P1NPn1/5QPq/PP5P/R1B2RK1 w - - 1 1",
    playerColor: "w",
    solution: ["f3g4", "h3g4", "e4f6", "g8g7", "f6g4"],
    hint: "The g4-square is overloaded: what if you remove the queen from the defense?",
  },
  {
    id: "fork-queen-knight",
    title: "Bxf7+ Tactics",
    description: "Strike f7 with check — typical ideas from online puzzle practice.",
    category: "Fork",
    difficulty: "medium",
    fen: "r3kb1r/pppp1ppp/2n2n2/4q3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 0 1",
    playerColor: "w",
    solution: ["c4f7"],
    hint: "The bishop capture on f7 comes with check.",
  },
  {
    id: "black-fork-1",
    title: "Central fork for Black",
    description: "Ne4 hits the bishop and the e-pawn — a staple from Italian-style games.",
    category: "Fork",
    difficulty: "medium",
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR b KQkq - 0 1",
    playerColor: "b",
    solution: ["f6e4"],
    hint: "The central knight eyes the bishop and a pawn.",
  },
  // === PINS ===
  {
    id: "pin-lic-YOr66",
    title: "Queen raid on the kingside",
    description: "Combine attack and pin motifs (Lichess puzzle YOr66).",
    category: "Pin",
    difficulty: "medium",
    fen: "rnbqkbnr/ppp4p/6p1/4p2Q/2B1p3/3P4/PPP2PPP/RNB1K2R w KQkq - 0 1",
    playerColor: "w",
    solution: ["h5e5", "d8e7", "e5h8", "e4d3", "c1e3"],
    hint: "Start with a forcing queen move on the long diagonal, then finish the attack.",
  },
  {
    id: "pin-2",
    title: "Winning the pinned knight",
    description: "Absolute pin on the c6-knight — exploit it with a capture.",
    category: "Pin",
    difficulty: "medium",
    fen: "r1bqk2r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQ1RK1 w kq - 4 4",
    playerColor: "w",
    solution: ["b5c6", "d7c6"],
    hint: "Capture the pinned piece.",
  },
  // === SKEWERS ===
  {
    id: "skewer-rook-file",
    title: "Rook skewer",
    description: "File skewer — common pattern in puzzle sets from major sites.",
    category: "Skewer",
    difficulty: "easy",
    fen: "8/8/4k3/8/8/8/4b3/R3K3 w - - 0 1",
    playerColor: "w",
    solution: ["a1a6"],
    hint: "Check the king — the bishop pays the price behind it.",
  },
  // === BACK RANK ===
  {
    id: "backrank-1",
    title: "Back rank mate",
    description: "Deliver checkmate on the back rank.",
    category: "Back Rank",
    difficulty: "easy",
    fen: "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
    playerColor: "w",
    solution: ["e1e8"],
    hint: "The king is trapped — can you deliver a check on the 8th rank?",
  },
  {
    id: "backrank-2",
    title: "Back rank with sacrifice",
    description: "Sacrifice to exploit the weak back rank.",
    category: "Back Rank",
    difficulty: "hard",
    fen: "2r3k1/5ppp/8/8/8/8/4QPPP/1R4K1 w - - 0 1",
    playerColor: "w",
    solution: ["e2e8", "c8e8", "b1e1", "e8e1"],
    hint: "What if you sacrifice your queen first?",
  },
  // === DISCOVERY ===
  {
    id: "discovered-1",
    title: "Knight discovery",
    description: "Block removal leading to discovered pressure.",
    category: "Discovery",
    difficulty: "medium",
    fen: "r1bqkb1r/pppppppp/2n5/8/3nP3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1",
    playerColor: "w",
    solution: ["f3d4", "c6d4"],
    hint: "Jump with the knight and open lines for another piece.",
  },
  {
    id: "discovery-rook",
    title: "Rook discovery",
    description: "Central knight interference opens a rook avalanche.",
    category: "Discovery",
    difficulty: "medium",
    fen: "3r2k1/ppp2ppp/8/4n3/8/2N1B3/PPP2PPP/2KR4 w - - 0 1",
    playerColor: "w",
    solution: ["c3d5", "d8d5", "d1d5"],
    hint: "Jump into the center with tempo.",
  },
  // === MATE IN 1 ===
  {
    id: "mate1-1",
    title: "Queen mate",
    description: "Deliver mate in one with the queen.",
    category: "Mate in 1",
    difficulty: "easy",
    fen: "k7/8/1K6/8/8/8/8/1Q6 w - - 0 1",
    playerColor: "w",
    solution: ["b1a2"],
    hint: "Where can your queen deliver check with no escape?",
  },
  {
    id: "mate1-2",
    title: "Rook mate",
    description: "Checkmate with your rook.",
    category: "Mate in 1",
    difficulty: "easy",
    fen: "2k5/8/2K5/8/8/8/8/R7 w - - 0 1",
    playerColor: "w",
    solution: ["a1a8"],
    hint: "The king is confined — deliver check on the back rank.",
  },
  {
    id: "mate1-queen-f7",
    title: "Queen on f7",
    description: "Typical weakening of f7 punished at once.",
    category: "Mate in 1",
    difficulty: "easy",
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
    playerColor: "w",
    solution: ["h5f7"],
    hint: "The f-pawn square is brittle when the knight cannot recapture cleanly.",
  },
  {
    id: "mate1-rook-h1",
    title: "Corner rook mate",
    description: "Trap the opposing king along the last rank/file.",
    category: "Mate in 1",
    difficulty: "easy",
    fen: "7k/8/5K2/8/8/8/8/R7 w - - 0 1",
    playerColor: "w",
    solution: ["a1h1"],
    hint: "Trap the king on the h-file.",
  },
  {
    id: "mate1-lic-d1Qfa",
    title: "Back rank sting",
    description: "Pinned pieces drop (Lichess puzzle d1Qfa).",
    category: "Mate in 1",
    difficulty: "medium",
    fen: "8/pp3p1k/2b2Pp1/2P4p/6q1/P6Q/6P1/6RK b - - 0 1",
    playerColor: "b",
    solution: ["g4h3"],
    hint: "The exchange of heavies exposes a mating net on dark squares.",
  },
  {
    id: "mate1-black",
    title: "Black to mate",
    description: "One quiet queen move decides.",
    category: "Mate in 1",
    difficulty: "easy",
    fen: "7k/5ppp/8/8/8/8/5q2/6K1 b - - 0 1",
    playerColor: "b",
    solution: ["f2f1"],
    hint: "The white king is very weak.",
  },
  // === MATE IN 2+ (forced wins) ===
  {
    id: "mate2-lic-AiI3T",
    title: "Decoy along the diagonal",
    description: "Force the defender wrong (Lichess puzzle AiI3T — mate-in-2).",
    category: "Mate in 2",
    difficulty: "medium",
    fen: "r7/2p3k1/pp1P4/4p3/4n3/3B3b/PPQ1KB1P/1R5q b - - 1 1",
    playerColor: "b",
    solution: ["h3g4", "e2e3", "h1f3"],
    hint: "Give a check that makes the bishop cover the wrong escape square.",
  },
  {
    id: "mate2-lic-W50VF",
    title: "Arabian mate idea",
    description: "Rook lifts and Arabian mate motifs (Lichess puzzle W50VF).",
    category: "Mate in 2",
    difficulty: "hard",
    fen: "8/1RRn1r1k/p2P3P/3P2p1/5pNn/7K/P4N2/6r1 b - - 1 1",
    playerColor: "b",
    solution: ["g1g3", "h3h2", "h4f3", "h2h1", "g3g1"],
    hint: "Keep the rook active on the kingside dark squares.",
  },
  {
    id: "mate2-anastasia",
    title: "Anastasia's mate pattern",
    description: "Knight restrains escapes while rook delivers.",
    category: "Mate in 2",
    difficulty: "hard",
    fen: "5rk1/5ppp/8/8/3N4/8/PPP2PPP/R5K1 w - - 0 1",
    playerColor: "w",
    solution: ["a1e1", "f8e8", "e1e8"],
    hint: "Open the e-file — the knight covers flight squares.",
  },
  // === REMOVING DEFENDER / DEFLECTION / zwischenzug ===
  {
    id: "remove-def-1",
    title: "Remove the defender",
    description: "Bxf7+ tears down the pawn shield — standard puzzle fare.",
    category: "Removing Defender",
    difficulty: "medium",
    fen: "r1b1kb1r/pppp1ppp/2n2n2/4p3/2B1P1q1/5N2/PPPP1PPP/RNBQR1K1 w kq - 0 1",
    playerColor: "w",
    solution: ["c4f7", "e8f7", "f3g5", "f7g8"],
    hint: "If f7 falls, what happens next?",
  },
  {
    id: "deflect-1",
    title: "Deflection",
    description: "Ng5 threatens mate and forks — force the queen astray.",
    category: "Deflection",
    difficulty: "hard",
    fen: "r4rk1/ppp2ppp/3b4/3Pp1q1/8/1B3N2/PPP2PPP/R2Q1RK1 w - - 0 1",
    playerColor: "w",
    solution: ["f3g5"],
    hint: "Attack with your knight — what does it threaten?",
  },
  {
    id: "zwischenzug-1",
    title: "Zwischenzug",
    description: "Bxf7+ first, then unleash the queen — in-between motif.",
    category: "Zwischenzug",
    difficulty: "medium",
    fen: "r1bqkb1r/pppp1ppp/2n5/4p3/2BnP3/8/PPPP1PPP/RNBQK1NR w KQkq - 0 1",
    playerColor: "w",
    solution: ["c4f7", "e8e7", "d1h5"],
    hint: "Bxf7+ first; after the king steps up, bring the queen into the attack.",
  },
  {
    id: "sac-1",
    title: "Seventh-rank invasion",
    description: "Rook havoc on the 7th — common middlegame drill.",
    category: "Sacrifice",
    difficulty: "medium",
    fen: "3r2k1/ppp2ppp/8/8/8/2R5/PPP2PPP/2KR4 w - - 0 1",
    playerColor: "w",
    solution: ["c3c7", "d8d7", "c7d7"],
    hint: "Capture on c7, meet the recapture, then take the defender.",
  },
  // === ENDGAME ===
  {
    id: "endgame-1",
    title: "King & pawn duel",
    description: "Seize the squares in front of the passer.",
    category: "Endgame",
    difficulty: "medium",
    fen: "8/8/8/8/8/4K3/4P3/4k3 w - - 0 1",
    playerColor: "w",
    solution: ["e3d3"],
    hint: "Opposition guides the pawn home.",
  },
  {
    id: "endgame-2",
    title: "Rook cuts off the king",
    description: "Lateral rook cuts mirror puzzles from Chesstempo-style drills.",
    category: "Endgame",
    difficulty: "medium",
    fen: "8/8/4k3/8/4P3/8/8/4K1R1 w - - 0 1",
    playerColor: "w",
    solution: ["g1g6"],
    hint: "Use your rook to cut off the enemy king.",
  },
  {
    id: "endgame-opp",
    title: "Opposition before promotion",
    description: "Distant opposition to secure the passer.",
    category: "Endgame",
    difficulty: "medium",
    fen: "8/4k3/8/3P4/8/8/3K4/8 w - - 0 1",
    playerColor: "w",
    solution: ["d2e3"],
    hint: "When black plays …Ke7, you want geometry that keeps the passer.",
  },
  // === TACTICS ===
  {
    id: "tactics-double-attack",
    title: "Queen fork on g7",
    description: "Check and capture — hallmark of Chess.com bullet puzzles.",
    category: "Tactics",
    difficulty: "medium",
    fen: "r4rk1/ppp2ppp/8/3q4/8/2Q5/PPP2PPP/R1B1KB1R w KQ - 0 1",
    playerColor: "w",
    solution: ["c3g7"],
    hint: "Check and capture — tempo wins material.",
  },
  {
    id: "fork-lic-Cx81H",
    title: "Pawn avalanche mate",
    description: "Pawn breakout finishes the king (Lichess puzzle Cx81H).",
    category: "Tactics",
    difficulty: "hard",
    fen: "5rk1/ppp2qpp/2n5/3r4/4Q3/P1P5/2P2PPP/R1B2RK1 b - - 0 1",
    playerColor: "b",
    solution: ["f7f2", "f1f2", "d5d1", "e4e1", "d1e1", "f2f1", "e1f1"],
    hint: "Push the passer so the rook cannot organise a defense.",
  },
];

type TransformName = "identity" | "flipH" | "flipV" | "rot180";

function transformSquare(sq: Square, t: TransformName): Square {
  const file = sq.charCodeAt(0) - 97;
  const rank = parseInt(sq[1], 10) - 1;
  let f = file;
  let r = rank;
  if (t === "flipH") f = 7 - file;
  if (t === "flipV") r = 7 - rank;
  if (t === "rot180") {
    f = 7 - file;
    r = 7 - rank;
  }
  return `${String.fromCharCode(97 + f)}${r + 1}` as Square;
}

function transformUci(uci: string, t: TransformName): string {
  const from = transformSquare(uci.slice(0, 2) as Square, t);
  const to = transformSquare(uci.slice(2, 4) as Square, t);
  return `${from}${to}${uci.length > 4 ? uci[4] : ""}`;
}

function swapColor(ch: string): string {
  if (ch >= "a" && ch <= "z") return ch.toUpperCase();
  if (ch >= "A" && ch <= "Z") return ch.toLowerCase();
  return ch;
}

function flipColorFenBoard(board: string): string {
  return board
    .split("/")
    .map((rank) => rank.split("").map(swapColor).join(""))
    .join("/");
}

function transformFen(fen: string, t: TransformName, colorSwap: boolean): string {
  const parts = fen.split(" ");
  if (parts.length < 4) return fen;
  const [board, turn, castling, ep, half = "0", full = "1"] = parts;
  const rows = board.split("/");
  const expanded = rows.map((row) => {
    const out: string[] = [];
    for (const ch of row) {
      if (ch >= "1" && ch <= "8") {
        const n = parseInt(ch, 10);
        for (let i = 0; i < n; i++) out.push("1");
      } else {
        out.push(ch);
      }
    }
    return out;
  });

  const dst = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => "1"));
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      let rf = f;
      let rr = r;
      if (t === "flipH") rf = 7 - f;
      if (t === "flipV") rr = 7 - r;
      if (t === "rot180") {
        rf = 7 - f;
        rr = 7 - r;
      }
      dst[rr][rf] = expanded[r][f];
    }
  }

  const compact = dst
    .map((rank) => {
      let s = "";
      let n = 0;
      for (const ch of rank) {
        if (ch === "1") n++;
        else {
          if (n) s += String(n);
          n = 0;
          s += ch;
        }
      }
      if (n) s += String(n);
      return s;
    })
    .join("/");

  const mappedBoard = colorSwap ? flipColorFenBoard(compact) : compact;
  const mappedTurn = colorSwap ? (turn === "w" ? "b" : "w") : turn;
  // Keep castling/ep simple; many puzzles don't rely on them.
  return `${mappedBoard} ${mappedTurn} ${castling} ${ep} ${half} ${full}`;
}

function transformsForCategory(category: string): TransformName[] {
  // Preserve tactical motif fidelity for forcing mates.
  if (category === "Mate in 1" || category === "Mate in 2") return ["identity", "flipH"];
  if (category === "Back Rank" || category === "Endgame") return ["identity", "flipH", "rot180"];
  return ["identity", "flipH", "flipV", "rot180"];
}

function transformWeight(t: TransformName): number {
  if (t === "identity") return 4;
  if (t === "flipH") return 3;
  return 1;
}

function isPuzzlePlayable(p: Puzzle): boolean {
  try {
    const g = new Chess(p.fen);
    if (g.turn() !== (p.playerColor as Color)) return false;
    for (const uci of p.solution) {
      const move = g.move({
        from: uci.slice(0, 2) as Square,
        to: uci.slice(2, 4) as Square,
        promotion: (uci.length > 4 ? uci[4] : undefined) as "q" | "r" | "b" | "n" | undefined,
      });
      if (!move) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function generatePuzzleBank(base: Puzzle[], target = 2400): Puzzle[] {
  const out: Puzzle[] = [];
  const seen = new Set<string>();
  let serial = 0;
  let guard = 0;

  while (out.length < target && guard < target * 50) {
    const p = base[serial % base.length];
    const transforms = transformsForCategory(p.category);
    const weighted: TransformName[] = transforms.flatMap((t) =>
      Array.from({ length: transformWeight(t) }, () => t)
    );
    const t = weighted[Math.floor(serial / base.length) % weighted.length];
    const colorSwap = Math.floor(serial / (base.length * weighted.length)) % 2 === 1;
    const playerColor = colorSwap ? (p.playerColor === "w" ? "b" : "w") : p.playerColor;
    const solution = p.solution.map((u) => transformUci(u, t));
    const fen = transformFen(p.fen, t, colorSwap);
    const key = `${fen}|${solution.join(",")}|${p.category}`;
    if (!seen.has(key)) {
      const v: Puzzle = {
        ...p,
        id: `${p.id}-v${serial}`,
        title: `${p.title} - Variation ${serial + 1}`,
        fen,
        playerColor,
        solution,
      };
      if (isPuzzlePlayable(v)) {
        out.push(v);
        seen.add(key);
      }
    }
    serial++;
    guard++;
  }
  return out;
}

const PUZZLES: Puzzle[] = generatePuzzleBank(BASE_PUZZLES, 2600);

function mapPersonalizedPuzzles(): Puzzle[] {
  return loadPersonalizedPuzzles().map((puzzle) => {
    const difficulty: Puzzle["difficulty"] =
      puzzle.bestGapCp >= 180 ? "hard" : puzzle.bestGapCp >= 110 ? "medium" : "easy";
    return {
      id: `personal-${puzzle.id}`,
      title: puzzle.title,
      description: puzzle.description,
      category: "From My Games",
      difficulty,
      fen: puzzle.fen,
      playerColor: puzzle.playerColor,
      solution: puzzle.solution,
      hint: "Find the unique top move from your own game.",
      source: "personalized",
    };
  });
}

const CATEGORIES = [
  { id: "all", label: "All Puzzles", icon: Target },
  { id: "From My Games", label: "From My Games", icon: Lightbulb },
  { id: "Fork", label: "Forks", icon: Zap },
  { id: "Pin", label: "Pins", icon: Shield },
  { id: "Skewer", label: "Skewers", icon: Swords },
  { id: "Back Rank", label: "Back Rank", icon: Crown },
  { id: "Mate in 1", label: "Mate in 1", icon: Trophy },
  { id: "Mate in 2", label: "Mate in 2", icon: Flame },
  { id: "Endgame", label: "Endgame", icon: Target },
  { id: "Discovery", label: "Discovery", icon: Lightbulb },
  { id: "Removing Defender", label: "Remove Defender", icon: Shield },
  { id: "Deflection", label: "Deflection", icon: Swords },
  { id: "Zwischenzug", label: "Zwischenzug", icon: Sparkles },
  { id: "Sacrifice", label: "Sacrifice", icon: Gift },
  { id: "Tactics", label: "Tactics", icon: Zap },
];

function getSquareFromPoint(
  boardEl: HTMLElement,
  clientX: number,
  clientY: number,
  flipped: boolean
): Square | null {
  const rect = boardEl.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  let col = Math.floor((x / rect.width) * 8);
  let row = Math.floor((y / rect.height) * 8);
  if (flipped) {
    col = 7 - col;
    row = 7 - row;
  }
  if (col < 0 || col > 7 || row < 0 || row > 7) return null;
  return `${String.fromCharCode(97 + col)}${8 - row}` as Square;
}

const Puzzles = () => {
  const { showValidMoves } = useTheme();
  const [searchParams] = useSearchParams();
  const [category, setCategory] = useState("all");
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [game, setGame] = useState<Chess | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [validMoves, setValidMoves] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [moveIndex, setMoveIndex] = useState(0);
  const [status, setStatus] = useState<"solving" | "correct" | "wrong" | "complete">("solving");
  const [showHint, setShowHint] = useState(false);
  const [solved, setSolved] = useState<Set<string>>(new Set());
  const [streak, setStreak] = useState(0);

  // Drag state
  const [dragging, setDragging] = useState<{
    square: Square;
    piece: { color: string; type: string };
    x: number;
    y: number;
  } | null>(null);
  const [dragOver, setDragOver] = useState<Square | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const allPuzzles = useMemo(() => {
    const personalized = mapPersonalizedPuzzles();
    return [...personalized, ...PUZZLES];
  }, []);
  const countsByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const puzzle of allPuzzles) {
      counts.set(puzzle.category, (counts.get(puzzle.category) ?? 0) + 1);
    }
    return counts;
  }, [allPuzzles]);

  const filteredPuzzles = useMemo(
    () => (category === "all" ? allPuzzles : allPuzzles.filter((p) => p.category === category)),
    [allPuzzles, category]
  );

  const activePuzzles = filteredPuzzles.length > 0 ? filteredPuzzles : allPuzzles;
  const currentPuzzle = activePuzzles[puzzleIndex % activePuzzles.length];
  const flipped = currentPuzzle?.playerColor === "b";

  useEffect(() => {
    if (searchParams.get("source") !== "personalized") return;
    const hasPersonalized = allPuzzles.some((p) => p.category === "From My Games");
    if (!hasPersonalized) return;
    setCategory("From My Games");
    setPuzzleIndex(0);
  }, [allPuzzles, searchParams]);

  // Initialize puzzle
  useEffect(() => {
    if (!currentPuzzle) return;
    const g = new Chess(currentPuzzle.fen);
    setGame(g);
    setMoveIndex(0);
    setSelectedSquare(null);
    setValidMoves([]);
    setLastMove(null);
    setStatus("solving");
    setShowHint(false);
    setDragging(null);
    setDragOver(null);
  }, [currentPuzzle]);

  const parseUCI = (uci: string): { from: Square; to: Square; promotion?: string } => {
    return {
      from: uci.slice(0, 2) as Square,
      to: uci.slice(2, 4) as Square,
      promotion: uci.length > 4 ? uci[4] : undefined,
    };
  };

  const executePlayerMove = useCallback(
    (from: Square, to: Square) => {
      if (!game || !currentPuzzle || status !== "solving") return;

      const expectedUCI = currentPuzzle.solution[moveIndex];
      if (!expectedUCI) return;
      const expected = parseUCI(expectedUCI);

      if (from === expected.from && to === expected.to) {
        // Correct move
        const g = new Chess(game.fen());
        const result = g.move({
          from,
          to,
          promotion: expected.promotion as PieceSymbol | undefined,
        });
        if (!result) return;

        playMoveSound(result, g.isCheck());

        setGame(g);
        setLastMove({ from, to });
        setSelectedSquare(null);
        setValidMoves([]);

        const nextMoveIdx = moveIndex + 1;

        // Check if puzzle is complete
        if (nextMoveIdx >= currentPuzzle.solution.length) {
          setStatus("complete");
          ChessSounds.promote();
          setSolved((prev) => new Set(prev).add(currentPuzzle.id));
          setStreak((s) => s + 1);
          return;
        }

        // Play opponent's response after a delay
        setMoveIndex(nextMoveIdx);
        setTimeout(() => {
          const opponentUCI = currentPuzzle.solution[nextMoveIdx];
          if (opponentUCI) {
            const opp = parseUCI(opponentUCI);
            const g2 = new Chess(g.fen());
            const oppResult = g2.move({
              from: opp.from,
              to: opp.to,
              promotion: opp.promotion as PieceSymbol | undefined,
            });
            if (oppResult) {
              playMoveSound(oppResult, g2.isCheck());
              setGame(g2);
              setLastMove({ from: opp.from, to: opp.to });
              setMoveIndex(nextMoveIdx + 1);

              // Check again if puzzle complete after opponent move
              if (nextMoveIdx + 1 >= currentPuzzle.solution.length) {
                setStatus("complete");
                ChessSounds.promote();
                setSolved((prev) => new Set(prev).add(currentPuzzle.id));
                setStreak((s) => s + 1);
              }
            }
          }
        }, 400);
      } else {
        // Wrong move
        setStatus("wrong");
        ChessSounds.illegal();
        setStreak(0);
        setSelectedSquare(null);
        setValidMoves([]);

        // Reset after a moment
        setTimeout(() => {
          setStatus("solving");
        }, 1200);
      }
    },
    [game, currentPuzzle, moveIndex, status]
  );

  const handleSquareClick = (square: Square) => {
    if (!game || status !== "solving" || dragging) return;
    const playerColor = currentPuzzle.playerColor;
    const piece = game.get(square);

    if (selectedSquare) {
      if (validMoves.includes(square)) {
        executePlayerMove(selectedSquare, square);
        return;
      }
    }

    if (piece && piece.color === playerColor) {
      setSelectedSquare(square);
      const moves = game.moves({ square, verbose: true });
      setValidMoves(moves.map((m) => m.to as Square));
    } else {
      setSelectedSquare(null);
      setValidMoves([]);
    }
  };

  // Drag handlers
  const handleDragStart = (square: Square, e: React.MouseEvent | React.TouchEvent) => {
    if (!game || status !== "solving") return;
    const piece = game.get(square);
    if (!piece || piece.color !== currentPuzzle.playerColor) return;

    e.preventDefault();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    setDragging({ square, piece: { color: piece.color, type: piece.type }, x: clientX, y: clientY });
    setSelectedSquare(square);
    const moves = game.moves({ square, verbose: true });
    setValidMoves(moves.map((m) => m.to as Square));
  };

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      setDragging((prev) => (prev ? { ...prev, x: clientX, y: clientY } : null));
      if (boardRef.current) {
        const sq = getSquareFromPoint(boardRef.current, clientX, clientY, flipped);
        setDragOver(sq);
      }
    };

    const handleEnd = (e: MouseEvent | TouchEvent) => {
      if (!dragging || !boardRef.current) {
        setDragging(null);
        setDragOver(null);
        return;
      }
      const clientX = "changedTouches" in e ? e.changedTouches[0].clientX : e.clientX;
      const clientY = "changedTouches" in e ? e.changedTouches[0].clientY : e.clientY;
      const targetSquare = getSquareFromPoint(boardRef.current, clientX, clientY, flipped);

      if (targetSquare && validMoves.includes(targetSquare)) {
        executePlayerMove(dragging.square, targetSquare);
      } else {
        ChessSounds.illegal();
      }

      setDragging(null);
      setDragOver(null);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleEnd);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [dragging, validMoves, executePlayerMove, flipped]);

  const nextPuzzle = () => {
    setPuzzleIndex((i) => (i + 1) % activePuzzles.length);
  };

  const retryPuzzle = () => {
    if (!currentPuzzle) return;
    const g = new Chess(currentPuzzle.fen);
    setGame(g);
    setMoveIndex(0);
    setSelectedSquare(null);
    setValidMoves([]);
    setLastMove(null);
    setStatus("solving");
    setShowHint(false);
  };

  if (!game || !currentPuzzle) return null;

  const displayGame = game;
  const diffColor =
    currentPuzzle.difficulty === "easy"
      ? "text-emerald-400"
      : currentPuzzle.difficulty === "medium"
      ? "text-foreground/75"
      : "text-destructive";

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center gap-4 px-6 py-4">
          <Link
            to="/play"
            className="flex items-center gap-2 font-body text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <h1 className="font-display text-xl font-semibold">
            Chess <span className="text-gradient-brand">Puzzles</span>
          </h1>
          <div className="ml-auto flex items-center gap-3">
            {streak > 0 && (
              <div className="flex items-center gap-1 font-body text-sm font-semibold text-foreground/75">
                <Flame className="w-4 h-4" />
                {streak}
              </div>
            )}
            <span className="font-body text-xs text-muted-foreground border border-border rounded-full px-3 py-1">
              {solved.size}/{allPuzzles.length} solved
            </span>
            <GameSettingsMenu />
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left - Categories */}
          <div className="lg:col-span-3 space-y-4 order-2 lg:order-1">
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="font-display text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
                Categories
              </h3>
              <div className="space-y-1">
                {CATEGORIES.map((cat) => {
                  const count =
                    cat.id === "all"
                      ? allPuzzles.length
                      : (countsByCategory.get(cat.id) ?? 0);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setCategory(cat.id);
                        setPuzzleIndex(0);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-body transition-colors ${
                        category === cat.id
                          ? "bg-secondary text-foreground border border-border"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                      }`}
                    >
                      <cat.icon className="w-4 h-4 text-foreground/75" />
                      {cat.label}
                      <span className="ml-auto text-xs text-muted-foreground">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Puzzle info */}
            <div className="rounded-lg border border-border bg-card p-5">
              <h3 className="font-display text-base font-semibold mb-1">
                {currentPuzzle.title}
              </h3>
              <p className="font-body text-sm text-muted-foreground mb-3">
                {currentPuzzle.description}
              </p>
              <div className="flex items-center gap-2 mb-4">
                <span className={`text-xs font-semibold uppercase ${diffColor}`}>
                  {currentPuzzle.difficulty}
                </span>
                <span className="text-xs text-muted-foreground"> - </span>
                <span className="text-xs text-muted-foreground">{currentPuzzle.category}</span>
                <span className="text-xs text-muted-foreground"> - </span>
                <span className="text-xs text-muted-foreground">
                  {currentPuzzle.playerColor === "w" ? "White" : "Black"} to move
                </span>
              </div>

              {/* Hint */}
              <button
                onClick={() => setShowHint(!showHint)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md border border-border text-sm font-body text-muted-foreground hover:text-foreground transition-colors mb-3"
              >
                <Lightbulb className="w-4 h-4 text-foreground/75" />
                {showHint ? "Hide Hint" : "Show Hint"}
              </button>
              <AnimatePresence>
                {showHint && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="font-body text-sm text-foreground/65 italic"
                  >
                    Hint: {currentPuzzle.hint}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Center - Board */}
          <div className="lg:col-span-6 flex flex-col items-center order-1 lg:order-2">
            <div className="relative rounded-lg overflow-hidden border border-border shadow-elevated w-full max-w-[600px]">
              <div
                ref={boardRef}
                className="grid grid-cols-8 grid-rows-8 aspect-square w-full"
              >
                {Array.from({ length: 64 }, (_, i) => {
                  const row = Math.floor(i / 8);
                  const col = i % 8;
                  const displayRow = flipped ? 7 - row : row;
                  const displayCol = flipped ? 7 - col : col;
                  const square = `${String.fromCharCode(97 + displayCol)}${8 - displayRow}` as Square;
                  const piece = displayGame.get(square);
                  const isDark = (displayRow + displayCol) % 2 === 1;
                  const isSelected = selectedSquare === square;
                  const isValidTarget = validMoves.includes(square);
                  const isLastMoveSquare =
                    lastMove?.from === square || lastMove?.to === square;
                  const isDragSource = dragging?.square === square;
                  const isDragTarget = dragOver === square && isValidTarget;

                  return (
                    <div
                      key={square}
                      onClick={() => handleSquareClick(square)}
                      onMouseDown={(e) => handleDragStart(square, e)}
                      onTouchStart={(e) => handleDragStart(square, e)}
                      className={`relative flex items-center justify-center select-none transition-colors ${
                        isDark
                          ? "bg-chess-dark hover:brightness-110"
                          : "bg-chess-light hover:brightness-105"
                      } ${
                        piece && piece.color === currentPuzzle.playerColor && status === "solving"
                          ? "cursor-grab"
                          : "cursor-pointer"
                      }`}
                    >
                      {isLastMoveSquare && (
                        <div
                          className={`absolute inset-0 ${
                            isDark ? "bg-amber-200/30" : "bg-amber-300/35"
                          }`}
                        />
                      )}
                      {isSelected && (
                        <div className="absolute inset-0 bg-cyan-300/30 z-10 ring-2 ring-cyan-100/50 ring-inset" />
                      )}
                      {isDragTarget && (
                        <div className="absolute inset-0 bg-emerald-300/30 z-10 ring-2 ring-emerald-100/50 ring-inset" />
                      )}

                      {/* Coords */}
                      {col === 0 && (
                        <span
                          className={`absolute top-0.5 left-1 text-[9px] font-bold z-10 ${
                            isDark ? "text-chess-light/80" : "text-chess-dark/80"
                          }`}
                        >
                          {8 - displayRow}
                        </span>
                      )}
                      {row === 7 && (
                        <span
                          className={`absolute bottom-0 right-1 text-[9px] font-bold z-10 ${
                            isDark ? "text-chess-light/80" : "text-chess-dark/80"
                          }`}
                        >
                          {String.fromCharCode(97 + displayCol)}
                        </span>
                      )}

                      {piece && !isDragSource && (
                        <img
                          src={PIECE_URLS[piece.color][piece.type]}
                          alt={`${piece.color} ${piece.type}`}
                          className={`w-[82%] h-[82%] object-contain drop-shadow-md select-none pointer-events-none z-20 transition-transform duration-150 ${
                            isSelected ? "scale-110 drop-shadow-xl" : ""
                          }`}
                          draggable={false}
                        />
                      )}

                      {showValidMoves && isValidTarget && !isDragTarget && (
                        <div className="absolute z-30 flex items-center justify-center w-full h-full pointer-events-none">
                          {piece && !isDragSource ? (
                            <div className="w-[82%] h-[82%] rounded-full border-[5px] border-cyan-100/45" />
                          ) : (
                            <div className="w-[30%] h-[30%] rounded-full bg-cyan-100/45" />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Dragged piece ghost */}
              {dragging && (
                <div
                  className="fixed pointer-events-none z-[100]"
                  style={{
                    left: dragging.x - 36,
                    top: dragging.y - 36,
                    width: 72,
                    height: 72,
                  }}
                >
                  <img
                    src={PIECE_URLS[dragging.piece.color][dragging.piece.type]}
                    alt="dragging"
                    className="w-full h-full object-contain drop-shadow-xl opacity-90"
                    draggable={false}
                  />
                </div>
              )}

              {/* Status overlays */}
              <AnimatePresence>
                {status === "wrong" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 bg-destructive/20 backdrop-blur-sm flex items-center justify-center"
                  >
                    <div className="flex items-center gap-2 bg-card border border-destructive/50 rounded-lg px-6 py-3">
                      <XCircle className="w-5 h-5 text-destructive" />
                      <span className="font-display text-lg font-bold text-destructive">
                        Wrong move!
                      </span>
                    </div>
                  </motion.div>
                )}
                {status === "complete" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4"
                  >
                    <CheckCircle className="w-12 h-12 text-emerald-400" />
                    <p className="font-display text-2xl font-bold text-foreground">
                      Puzzle Solved!
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={retryPuzzle}
                        className="flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-card hover:bg-secondary transition-colors font-body text-sm"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Retry
                      </button>
                      <button
                        onClick={nextPuzzle}
                        className="flex items-center gap-2 bg-primary px-6 py-2 rounded-md font-body text-sm font-semibold text-primary-foreground shadow-gold transition-transform hover:scale-105"
                      >
                        Next Puzzle
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Status bar */}
            <div className="mt-4 flex gap-2 w-full justify-center max-w-[600px]">
              <button
                onClick={retryPuzzle}
                className="p-3 bg-card rounded-lg hover:bg-secondary transition-colors border border-border"
                title="Retry puzzle"
              >
                <RotateCcw className="w-4 h-4 text-muted-foreground" />
              </button>
              <div className="flex-1 flex items-center justify-center bg-card rounded-lg px-6 font-body text-sm font-medium border border-border text-foreground">
                {status === "solving" && (
                  <>
                    <span>{currentPuzzle.playerColor === "w" ? "White" : "Black"} to move</span>
                    <span className="ml-2 text-muted-foreground">
                      - Find the best move!
                    </span>
                  </>
                )}
                {status === "wrong" && (
                  <span className="text-destructive">Try again...</span>
                )}
                {status === "complete" && (
                  <span className="text-emerald-400">Solved!</span>
                )}
              </div>
              <button
                onClick={nextPuzzle}
                className="p-3 bg-card rounded-lg hover:bg-secondary transition-colors border border-border"
                title="Skip puzzle"
              >
                <SkipForward className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Right - Progress */}
          <div className="lg:col-span-3 space-y-4 order-3">
            <div className="rounded-lg border border-border bg-card p-5">
              <h3 className="font-display text-base font-semibold mb-4 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-foreground/75" />
                Progress
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between font-body text-sm">
                  <span className="text-muted-foreground">Solved</span>
                  <span className="font-semibold text-foreground">
                    {solved.size}/{allPuzzles.length}
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${(solved.size / allPuzzles.length) * 100}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between font-body text-sm">
                  <span className="text-muted-foreground">Current Streak</span>
                  <span className="font-semibold text-foreground/75 flex items-center gap-1">
                    <Flame className="w-3 h-3" />
                    {streak}
                  </span>
                </div>
              </div>
            </div>

            {/* Puzzle list */}
            <div className="rounded-lg border border-border bg-card p-4 max-h-[400px] overflow-y-auto scrollbar-hide">
              <h3 className="font-display text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
                Puzzles
              </h3>
              <div className="space-y-1">
                {activePuzzles.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => setPuzzleIndex(i)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-body transition-colors text-left ${
                      puzzleIndex % activePuzzles.length === i
                        ? "bg-secondary text-foreground border border-border"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    }`}
                  >
                    {solved.has(p.id) ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <Target className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="truncate">{p.title}</span>
                    <span
                      className={`ml-auto text-[10px] font-semibold uppercase ${
                        p.difficulty === "easy"
                          ? "text-emerald-400"
                          : p.difficulty === "medium"
                          ? "text-foreground/75"
                          : "text-destructive"
                      }`}
                    >
                      {p.difficulty}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Puzzles;
