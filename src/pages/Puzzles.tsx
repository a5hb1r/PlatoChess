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
  Loader2,
  Lock,
  BookOpen,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useProfile } from "@/hooks/use-profile";
import { getPuzzleLimit } from "@/lib/tier-features";

// ── Daily puzzle counter (resets at midnight) ────────────────────────────────
const DAILY_KEY = "platochess:puzzle_daily";
interface DailyCount { date: string; count: number }
function getTodayStr() { return new Date().toISOString().slice(0, 10); }
function getDailyCount(): number {
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (!raw) return 0;
    const val = JSON.parse(raw) as DailyCount;
    return val.date === getTodayStr() ? val.count : 0;
  } catch { return 0; }
}
function incrementDailyCount(): number {
  const today = getTodayStr();
  const next = getDailyCount() + 1;
  localStorage.setItem(DAILY_KEY, JSON.stringify({ date: today, count: next }));
  return next;
}
import { Chess, Color, Square, PieceSymbol } from "chess.js";
import { ChessSounds, playMoveSound } from "@/lib/sounds";
import { PIECE_URLS } from "@/lib/chess-constants";
import { BoardArrows } from "@/components/chess/BoardArrows";
import { loadPersonalizedPuzzles } from "@/lib/game-review";
import {
  fetchPuzzleBatch,
  loadCachedPuzzles,
  savePuzzlesToCache,
  CATEGORY_TO_ANGLE,
  type LichessPuzzle,
} from "@/lib/lichess-puzzles";

interface Puzzle {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  fen: string;
  playerColor: "w" | "b";
  solution: string[];
  hint: string;
  source?: "default" | "personalized" | "lichess";
}

// Placeholder shown while Lichess puzzles load
const FALLBACK_PUZZLES: Puzzle[] = [
  {
    id: "loading-placeholder",
    title: "Loading puzzles…",
    description: "Fetching real tactics from Lichess.",
    category: "Tactics",
    difficulty: "medium",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    playerColor: "w",
    solution: ["e2e4"],
    hint: "Puzzles are loading from Lichess.",
  },
];

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
  { id: "Discovery", label: "Discovery", icon: Sparkles },
  { id: "Deflection", label: "Deflection", icon: Swords },
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

function mapLichess(p: LichessPuzzle): Puzzle {
  return { ...p };
}

const Puzzles = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isPro, isMaster } = useProfile();
  const puzzleLimit = getPuzzleLimit(isPro, isMaster);
  const [dailyCount, setDailyCount] = useState(getDailyCount);
  const limitReached = dailyCount >= puzzleLimit;

  const [category, setCategory] = useState("all");
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [game, setGame] = useState<Chess | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [validMoves, setValidMoves] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [moveIndex, setMoveIndex] = useState(0);
  const [status, setStatus] = useState<"solving" | "correct" | "wrong" | "complete">("solving");
  /** 0 = hidden, 1 = show which piece to move, 2 = reveal the answer move. */
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2>(0);
  const [solved, setSolved] = useState<Set<string>>(new Set());
  const [streak, setStreak] = useState(0);
  const [lichessPuzzles, setLichessPuzzles] = useState<Puzzle[]>([]);
  const [loadingPuzzles, setLoadingPuzzles] = useState(true);
  const fetchingRef = useRef(false);

  // Drag state
  const [dragging, setDragging] = useState<{
    square: Square;
    piece: { color: string; type: string };
    x: number;
    y: number;
  } | null>(null);
  const [dragOver, setDragOver] = useState<Square | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // Load cached puzzles immediately, then fetch fresh ones in background
  useEffect(() => {
    const cached = loadCachedPuzzles();
    if (cached.length > 0) {
      setLichessPuzzles(cached.map(mapLichess));
      setLoadingPuzzles(false);
    }

    if (fetchingRef.current) return;
    fetchingRef.current = true;

    fetchPuzzleBatch(30).then((fresh) => {
      if (fresh.length > 0) {
        savePuzzlesToCache(fresh);
        setLichessPuzzles((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const newOnes = fresh.map(mapLichess).filter((p) => !existingIds.has(p.id));
          return [...newOnes, ...prev];
        });
      }
      setLoadingPuzzles(false);
      fetchingRef.current = false;
    });
  }, []);

  const allPuzzles = useMemo(() => {
    const personalized = mapPersonalizedPuzzles();
    const pool = loadingPuzzles && lichessPuzzles.length === 0 ? FALLBACK_PUZZLES : lichessPuzzles;
    return [...personalized, ...pool];
  }, [lichessPuzzles, loadingPuzzles]);

  const filteredPuzzles = category === "all"
    ? allPuzzles
    : allPuzzles.filter((p) => p.category === category);

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
    setHintLevel(0);
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

  /** The actual next solution move — powers the two-stage hint. */
  const hintAnswer = useMemo(() => {
    if (!game || !currentPuzzle || status !== "solving") return null;
    const uci = currentPuzzle.solution[moveIndex];
    if (!uci || uci.length < 4) return null;
    const from = uci.slice(0, 2) as Square;
    const to = uci.slice(2, 4) as Square;
    const promotion = uci.length > 4 ? uci[4] : undefined;
    const clone = new Chess(game.fen());
    const names: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
    const pieceName = names[clone.get(from)?.type ?? ""] ?? "piece";
    try {
      const m = clone.move({ from, to, promotion: promotion as "q" | "r" | "b" | "n" | undefined });
      if (!m) return null;
      return { from, to, san: m.san, pieceName };
    } catch {
      return null;
    }
  }, [game, currentPuzzle, moveIndex, status]);

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
          setDailyCount(incrementDailyCount());
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
                setDailyCount(incrementDailyCount());
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
    const next = (puzzleIndex + 1) % activePuzzles.length;
    setPuzzleIndex(next);
    // Pre-fetch more puzzles when pool gets low
    if (lichessPuzzles.length - next < 10 && !fetchingRef.current) {
      fetchingRef.current = true;
      const angle = category !== "all" && category !== "From My Games"
        ? CATEGORY_TO_ANGLE[category]
        : undefined;
      fetchPuzzleBatch(20, angle).then((fresh) => {
        if (fresh.length > 0) {
          savePuzzlesToCache(fresh);
          setLichessPuzzles((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const newOnes = fresh.map(mapLichess).filter((p) => !existingIds.has(p.id));
            return [...prev, ...newOnes];
          });
        }
        fetchingRef.current = false;
      });
    }
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
    setHintLevel(0);
  };

  if (!game || !currentPuzzle) return null;

  const displayGame = game;
  const diffColor =
    currentPuzzle.difficulty === "easy"
      ? "text-emerald-400"
      : currentPuzzle.difficulty === "medium"
      ? "text-foreground/75"
      : "text-destructive";

  // Daily limit paywall
  if (limitReached) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-6">
        <div className="text-5xl">🔒</div>
        <h2 className="font-display text-3xl font-bold text-center">
          Daily puzzle limit reached
        </h2>
        <p className="font-body text-muted-foreground text-center max-w-sm">
          Free accounts get <strong>10 puzzles per day</strong>. Come back tomorrow, or upgrade to Pro for unlimited puzzles.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/pricing"
            className="bg-primary px-8 py-3 rounded-md font-body text-sm font-semibold text-primary-foreground shadow-gold transition-transform hover:scale-[1.02]"
          >
            Upgrade to Pro — $1.99/mo
          </Link>
          <Link
            to="/play"
            className="border border-border px-8 py-3 rounded-md font-body text-sm font-medium text-foreground hover:bg-secondary transition-colors"
          >
            Play a game instead
          </Link>
        </div>
        <p className="font-body text-xs text-muted-foreground">
          Resets at midnight · {dailyCount}/{puzzleLimit === Infinity ? "∞" : puzzleLimit} used today
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 py-0">
          <div className="flex items-center gap-4 pt-3 pb-0">
            <Link
              to="/play"
              className="flex items-center gap-2 font-body text-sm text-muted-foreground transition-colors hover:text-foreground shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <h1 className="font-display text-xl font-semibold shrink-0">
              Puzzles <span className="text-gradient-brand">&amp; Openings</span>
            </h1>
            <div className="ml-auto flex items-center gap-3">
              {streak > 0 && (
                <div className="flex items-center gap-1 font-body text-sm font-semibold text-amber-400">
                  <Flame className="w-4 h-4" />
                  {streak}
                </div>
              )}
              {loadingPuzzles && (
                <span className="flex items-center gap-1 font-body text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Loading…
                </span>
              )}
              <span className="font-body text-xs text-muted-foreground border border-border rounded-full px-3 py-1">
                {solved.size}/{allPuzzles.length} solved
              </span>
            </div>
          </div>
          {/* Tab bar */}
          <div className="flex gap-0 mt-3">
            <button
              onClick={() => {/* already on puzzles */}}
              className="flex items-center gap-2 px-4 py-2.5 font-body text-sm font-semibold border-b-2 border-primary text-foreground transition-colors"
            >
              <Target className="w-4 h-4" />
              Puzzles
            </button>
            <button
              onClick={() => navigate("/openings")}
              className="flex items-center gap-2 px-4 py-2.5 font-body text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              Openings
            </button>
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
                      : allPuzzles.filter((p) => p.category === cat.id).length;
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

              {/* Hint — first click shows the piece, second reveals the move */}
              <button
                onClick={() => setHintLevel((lvl) => (lvl === 0 ? 1 : lvl === 1 ? 2 : 0))}
                disabled={!hintAnswer}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md border border-border text-sm font-body text-muted-foreground hover:text-foreground transition-colors mb-3 disabled:opacity-50"
              >
                <Lightbulb className="w-4 h-4 text-foreground/75" />
                {hintLevel === 0 ? "Show Hint" : hintLevel === 1 ? "Reveal Answer" : "Hide Hint"}
              </button>
              <AnimatePresence>
                {hintLevel > 0 && hintAnswer && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="font-body text-sm space-y-1"
                  >
                    {hintLevel === 1 ? (
                      <p className="text-foreground/80">
                        Move your <span className="font-semibold text-foreground">{hintAnswer.pieceName}</span> on{" "}
                        <span className="font-mono font-semibold text-foreground">{hintAnswer.from}</span> — it&apos;s
                        highlighted on the board.
                      </p>
                    ) : (
                      <p className="text-foreground/80">
                        Answer:{" "}
                        <span className="font-mono font-semibold text-[#81b64c]">{hintAnswer.san}</span>
                        <span className="text-muted-foreground"> ({hintAnswer.from} → {hintAnswer.to}) — follow the arrow.</span>
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground italic">{currentPuzzle.hint}</p>
                  </motion.div>
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
                            isDark ? "bg-foreground/18" : "bg-foreground/15"
                          }`}
                        />
                      )}
                      {isSelected && (
                        <div className="absolute inset-0 bg-foreground/25 z-10" />
                      )}
                      {hintLevel >= 1 && hintAnswer?.from === square && (
                        <div className="absolute inset-0 z-10" style={{ backgroundColor: "rgba(255,255,51,0.5)" }} />
                      )}
                      {isDragTarget && (
                        <div className="absolute inset-0 bg-foreground/20 z-10" />
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
                          className={`w-[94%] h-[94%] object-contain drop-shadow-md select-none pointer-events-none z-20 transition-transform duration-150 ${
                            isSelected ? "scale-110 drop-shadow-xl" : ""
                          }`}
                          draggable={false}
                        />
                      )}

                      {isValidTarget && !isDragTarget && (
                        <div className="absolute z-30 flex items-center justify-center w-full h-full pointer-events-none">
                          {piece && !isDragSource ? (
                            <div className="w-[82%] h-[82%] rounded-full border-[5px] border-foreground/20" />
                          ) : (
                            <div className="w-[30%] h-[30%] rounded-full bg-foreground/20" />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {hintLevel === 2 && hintAnswer && (
                <BoardArrows
                  arrows={[{ from: hintAnswer.from, to: hintAnswer.to, opacity: 0.9 }]}
                  flipped={flipped}
                />
              )}

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
