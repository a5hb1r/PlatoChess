import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  History,
  Trophy,
  User,
  Bot,
  Loader2,
  BarChart3,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Chess, Square, PieceSymbol } from "chess.js";
import {
  StockfishEngine,
  StockfishInfo,
  STOCKFISH_VERSION_LABEL,
  formatEngineInitError,
} from "@/lib/stockfish";
import { ChessSounds, playMoveSound } from "@/lib/sounds";
import { BoardThemeSelect } from "@/components/BoardThemeSelect";
import { PIECE_URLS } from "@/lib/chess-constants";
import { rateMoveLikeChessCom } from "@/lib/move-rating";
import {
  type CoachId,
  coachOnMoveRating,
  coachOnEval,
  COACHES,
} from "@/lib/philosopher-coaches";
import { reviewTone } from "@/lib/review-colors";
import {
  saveLatestGameReview,
  scoreForLabel,
  type ReviewedPly,
} from "@/lib/game-review";

const DIFFICULTY_LEVELS = [
  { label: "Beginner", skill: 1, depth: 4, rating: "~400" },
  { label: "Easy", skill: 5, depth: 6, rating: "~800" },
  { label: "Medium", skill: 10, depth: 10, rating: "~1200" },
  { label: "Hard", skill: 15, depth: 14, rating: "~1600" },
  { label: "Expert", skill: 18, depth: 16, rating: "~2000" },
  { label: "Master", skill: 20, depth: 20, rating: "~2500" },
];

function parseCoachId(raw: string | null): CoachId {
  const r = (raw || "").toLowerCase();
  if (!r || r === "none") return "none";
  if (r in COACHES) return r as CoachId;
  return "none";
}

// Helper to get square from mouse/touch position relative to board
function getSquareFromPoint(
  boardEl: HTMLElement,
  clientX: number,
  clientY: number
): Square | null {
  const rect = boardEl.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const col = Math.floor((x / rect.width) * 8);
  const row = Math.floor((y / rect.height) * 8);
  if (col < 0 || col > 7 || row < 0 || row > 7) return null;
  return `${String.fromCharCode(97 + col)}${8 - row}` as Square;
}

const Game = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const difficultyParam = parseInt(searchParams.get("level") || "2");
  const difficulty = DIFFICULTY_LEVELS[Math.min(difficultyParam, DIFFICULTY_LEVELS.length - 1)];
  const coach = parseCoachId(searchParams.get("coach"));
  const [coachLine, setCoachLine] = useState<string | null>(null);

  const [game, setGame] = useState(new Chess());
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [validMoves, setValidMoves] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [moveHistory, setMoveHistory] = useState<
    { san: string; rating?: { label: string; color: string }; cpLoss?: number; bestUci?: string }[]
  >([]);
  const [reviewingGame, setReviewingGame] = useState(false);
  const [reviewProgress, setReviewProgress] = useState(0);
  const [reviewSummary, setReviewSummary] = useState<string | null>(null);
  const [reviewReady, setReviewReady] = useState(false);
  const [eval_, setEval_] = useState<number>(0);
  const [evalDepth, setEvalDepth] = useState(0);
  const [engineReady, setEngineReady] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [engineLabel, setEngineLabel] = useState(STOCKFISH_VERSION_LABEL);
  const [engineThinking, setEngineThinking] = useState(false);
  const [gameOver, setGameOver] = useState<string | null>(null);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [viewFen, setViewFen] = useState<string | null>(null);
  const [promotionSquare, setPromotionSquare] = useState<{
    from: Square;
    to: Square;
  } | null>(null);

  // Drag state
  const [dragging, setDragging] = useState<{
    square: Square;
    piece: { color: string; type: string };
    x: number;
    y: number;
  } | null>(null);
  const [dragOver, setDragOver] = useState<Square | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const engineRef = useRef<StockfishEngine | null>(null);
  const gameRef = useRef(game);
  gameRef.current = game;
  const gameFen = game.fen();
  const gameTurn = game.turn();
  const gameIsOver = game.isGameOver();

  const allLegalDestinations = useMemo(() => {
    const s = new Set<Square>();
    if (game.turn() !== "w" || game.isGameOver() || viewFen) return s;
    for (const m of game.moves({ verbose: true })) {
      if (m.color === "w") s.add(m.to as Square);
    }
    return s;
  }, [game, viewFen]);

  // Init Stockfish
  useEffect(() => {
    const engine = new StockfishEngine();
    engineRef.current = engine;
    setEngineError(null);
    setEngineReady(false);
    engine
      .init()
      .then(() => {
        engine.setSkillLevel(difficulty.skill);
        setEngineLabel(engine.getLabel());
        setEngineReady(true);
      })
      .catch((err) => {
        setEngineError(err instanceof Error ? err.message : formatEngineInitError(err));
        setEngineReady(false);
      });
    return () => engine.destroy();
  }, [difficulty.skill]);

  // Run eval (skip while Stockfish is searching a move - avoids canceling / corrupting `getBestMove`)
  useEffect(() => {
    if (!engineReady || !engineRef.current || engineError) return;
    const fen = viewFen || gameFen;
    const side = new Chess(fen).turn();
    if (!viewFen && side === "b") return;
    engineRef.current.evaluate(fen, 18, (info: StockfishInfo) => {
      if (info.mate !== undefined) {
        setEval_(info.mate > 0 ? 9999 : -9999);
      } else if (info.score !== undefined) {
        setEval_(info.score);
      }
      if (info.depth) setEvalDepth(info.depth);
    });
  }, [gameFen, viewFen, engineReady, engineError]);

  // Check game over
  useEffect(() => {
    if (game.isCheckmate()) {
      setGameOver(game.turn() === "w" ? "Black wins by checkmate!" : "White wins by checkmate!");
      ChessSounds.gameOver();
    } else if (game.isDraw()) {
      setGameOver("Draw!");
      ChessSounds.gameOver();
    } else if (game.isStalemate()) {
      setGameOver("Stalemate!");
      ChessSounds.gameOver();
    }
  }, [game]);

  // Stockfish plays black (use ref for position so this callback stays stable across white moves)
  const makeEngineMove = useCallback(async () => {
    const g0 = gameRef.current;
    if (!engineRef.current || g0.isGameOver() || engineError) return;
    setEngineThinking(true);

    const move = await engineRef.current.getBestMove(g0.fen(), difficulty.depth);

    if (move && move.length >= 4) {
      const from = move.slice(0, 2) as Square;
      const to = move.slice(2, 4) as Square;
      const promotion = move.length > 4 ? move[4] : undefined;

      const g = new Chess(gameRef.current.fen());
      const result = g.move({ from, to, promotion: promotion as PieceSymbol | undefined });
      if (result) {
        playMoveSound(result, g.isCheck());

        setGame(g);
        setLastMove({ from, to });
        setHistoryIndex(-1);
        setViewFen(null);
        setMoveHistory((prev) => [...prev, { san: result.san }]);
      }
    }
    setEngineThinking(false);
  }, [difficulty.depth, engineError]);

  useEffect(() => {
    if (
      engineReady &&
      !engineError &&
      game.turn() === "b" &&
      !game.isGameOver() &&
      !engineThinking
    ) {
      const timer = setTimeout(makeEngineMove, 320);
      return () => clearTimeout(timer);
    }
  }, [game, gameTurn, gameIsOver, engineReady, engineError, engineThinking, makeEngineMove]);

  useEffect(() => {
    if (coach === "none") return;
    if (moveHistory.length === 0) {
      setCoachLine("I am ready. Play with intention, and I will annotate the ideas behind each move.");
      return;
    }
    if (reviewingGame) return;
    const last = moveHistory[moveHistory.length - 1];
    setCoachLine(coachOnEval(coach, eval_, null, last?.san ?? null, moveHistory.length * 13));
  }, [coach, moveHistory, eval_, reviewingGame]);

  const executeMove = useCallback((from: Square, to: Square, promotion?: string) => {
    const g = new Chess(game.fen());
    const result = g.move({ from, to, promotion: (promotion || undefined) as PieceSymbol | undefined });

    if (result) {
      playMoveSound(result, g.isCheck());

      const moveEntry: { san: string; rating?: { label: string; color: string } } = {
        san: result.san,
      };
      setMoveHistory((prev) => [...prev, moveEntry]);

      setGame(g);
      setLastMove({ from, to });
      setSelectedSquare(null);
      setValidMoves([]);
      setHistoryIndex(-1);
      setViewFen(null);
      setPromotionSquare(null);
      if (coach !== "none") setCoachLine(coachOnEval(coach, eval_, null, result.san, Date.now()));
      return true;
    }
    return false;
  }, [coach, eval_, game]);

  const handleSquareClick = (square: Square) => {
    if (game.turn() !== "w" || engineThinking || gameOver || viewFen) return;
    if (dragging) return; // Don't process clicks during drag

    const piece = game.get(square);

    if (selectedSquare) {
      const isValid = validMoves.includes(square);
      if (isValid) {
        const movingPiece = game.get(selectedSquare);
        if (
          movingPiece?.type === "p" &&
          ((movingPiece.color === "w" && square[1] === "8") ||
            (movingPiece.color === "b" && square[1] === "1"))
        ) {
          setPromotionSquare({ from: selectedSquare, to: square });
          return;
        }
        executeMove(selectedSquare, square);
        return;
      }
    }

    if (piece && piece.color === "w") {
      setSelectedSquare(square);
      const moves = game.moves({ square, verbose: true });
      setValidMoves(moves.map((m) => m.to as Square));
    } else {
      setSelectedSquare(null);
      setValidMoves([]);
    }
  };

  const handlePromotion = (piece: string) => {
    if (promotionSquare) {
      executeMove(promotionSquare.from, promotionSquare.to, piece);
    }
  };

  // --- Drag and Drop ---
  const handleDragStart = (square: Square, e: React.MouseEvent | React.TouchEvent) => {
    if (game.turn() !== "w" || engineThinking || gameOver || viewFen) return;
    const piece = game.get(square);
    if (!piece || piece.color !== "w") return;

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
      setDragging((prev) => prev ? { ...prev, x: clientX, y: clientY } : null);

      if (boardRef.current) {
        const sq = getSquareFromPoint(boardRef.current, clientX, clientY);
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
      const targetSquare = getSquareFromPoint(boardRef.current, clientX, clientY);

      if (targetSquare && validMoves.includes(targetSquare)) {
        // Check for promotion
        const movingPiece = game.get(dragging.square);
        if (
          movingPiece?.type === "p" &&
          ((movingPiece.color === "w" && targetSquare[1] === "8") ||
            (movingPiece.color === "b" && targetSquare[1] === "1"))
        ) {
          setPromotionSquare({ from: dragging.square, to: targetSquare });
        } else {
          executeMove(dragging.square, targetSquare);
        }
      } else {
        // Invalid drop - snap back
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
  }, [dragging, executeMove, game, validMoves]);

  const resetGame = () => {
    setGame(new Chess());
    setSelectedSquare(null);
    setValidMoves([]);
    setLastMove(null);
    setMoveHistory([]);
    setEval_(0);
    setGameOver(null);
    setHistoryIndex(-1);
    setViewFen(null);
    setPromotionSquare(null);
    setDragging(null);
    setCoachLine(null);
    setReviewSummary(null);
    setReviewReady(false);
  };

  const goToMove = (index: number) => {
    const fullHistory = game.history();
    const replay = new Chess();
    for (let i = 0; i <= Math.min(index, fullHistory.length - 1); i++) {
      replay.move(fullHistory[i]);
    }
    setViewFen(replay.fen());
    setHistoryIndex(index);
  };

  const goBack = () => {
    const fullHistory = game.history();
    const current = historyIndex === -1 ? fullHistory.length - 1 : historyIndex - 1;
    if (current >= 0) goToMove(current);
    else {
      setViewFen(new Chess().fen());
      setHistoryIndex(-1);
    }
  };

  const goForward = () => {
    const fullHistory = game.history();
    const current = historyIndex === -1 ? fullHistory.length : historyIndex + 1;
    if (current < fullHistory.length) {
      goToMove(current);
    } else {
      setViewFen(null);
      setHistoryIndex(-1);
    }
  };

  const analyzeFinishedGame = useCallback(async () => {
    if (!engineRef.current || !gameOver || reviewingGame) return;
    const history = game.history({ verbose: true });
    if (history.length === 0) return;

    setReviewingGame(true);
    setReviewProgress(0);
    setReviewSummary(null);

    try {
      const engine = engineRef.current;
      const replay = new Chess();
      let beforeProbe = await engine.probeEval(replay.fen(), 10, 2500);
      const reviewed: { san: string; rating?: { label: string; color: string }; cpLoss?: number; bestUci?: string }[] = [];
      const reviewedPlies: ReviewedPly[] = [];

      for (let i = 0; i < history.length; i++) {
        const mv = history[i];
        const side = replay.turn();
        const fenBefore = replay.fen();
        const best = await engine.getBestMove(fenBefore, 10);

        replay.move(mv);
        const afterProbe = await engine.probeEval(replay.fen(), 10, 2500);
        const rated = rateMoveLikeChessCom(side, beforeProbe, afterProbe, mv, best || undefined);
        reviewed.push({
          san: mv.san,
          rating: { label: rated.label, color: rated.color },
          cpLoss: rated.cpLoss,
          bestUci: rated.bestMove,
        });
        reviewedPlies.push({
          ply: i + 1,
          side,
          san: mv.san,
          label: rated.label,
          colorClass: rated.color,
          cpLoss: rated.cpLoss,
          bestUci: rated.bestMove,
          playedUci: `${mv.from}${mv.to}${mv.promotion ?? ""}`,
          fenBefore,
          fenAfter: replay.fen(),
        });
        beforeProbe = afterProbe;
        setReviewProgress(i + 1);
      }

      const summary = reviewed.reduce<Record<string, number>>((acc, m) => {
        const k = m.rating?.label || "Unrated";
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});
      const top = ["Brilliant", "Great", "Best", "Excellent", "Good", "Inaccuracy", "Miss", "Mistake", "Blunder"]
        .filter((k) => summary[k])
        .map((k) => `${k}: ${summary[k]}`)
        .join("  |  ");

      setMoveHistory(reviewed);
      setReviewSummary(top || "Review complete.");
      setReviewReady(true);
      const bySide = { w: [] as number[], b: [] as number[] };
      for (const m of reviewedPlies) bySide[m.side].push(scoreForLabel(m.label));
      const avg = (a: number[]) => (a.length ? (a.reduce((s, x) => s + x, 0) / a.length) * 100 : 0);
      saveLatestGameReview({
        createdAt: Date.now(),
        pgn: game.pgn(),
        result: gameOver || "Game complete",
        engine: engineLabel,
        depth: 10,
        accuracy: {
          w: Number(avg(bySide.w).toFixed(1)),
          b: Number(avg(bySide.b).toFixed(1)),
        },
        moves: reviewedPlies,
      });
      if (coach !== "none") {
        setCoachLine(coachOnMoveRating(coach, "Good", "analysis", Date.now()));
      }
    } finally {
      setReviewingGame(false);
    }
  }, [coach, engineLabel, game, gameOver, reviewingGame]);

  const displayFen = viewFen || game.fen();
  const displayGame = new Chess(displayFen);

  const evalPawns = Math.max(-10, Math.min(10, eval_ / 100));
  const whitePercent = 50 + evalPawns * 5;

  const evalDisplay =
    Math.abs(eval_) >= 9999
      ? eval_ > 0
        ? "M" + (eval_ === 9999 ? "" : Math.abs(eval_))
        : "-M"
      : (eval_ / 100).toFixed(1);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
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
            vs <span className="text-gradient-brand">Stockfish</span>
          </h1>
          <span className="ml-auto font-body text-xs text-muted-foreground border border-border rounded-full px-3 py-1">
            {difficulty.label} (~{difficulty.rating})
          </span>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left panel */}
          <div className="lg:col-span-3 space-y-4 order-2 lg:order-1">
            <div className="rounded-lg border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-display text-base font-semibold flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-foreground/80" />
                  Practice Match
                </h2>
              </div>

              {/* Stockfish (Black) */}
              <div
                className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                  game.turn() === "b" && !gameOver
                    ? "bg-secondary border border-border"
                    : ""
                }`}
              >
                <div className="w-9 h-9 rounded-md bg-secondary flex items-center justify-center">
                  <Bot className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-body text-sm font-semibold text-foreground">
                    Stockfish
                  </p>
                  <p className="font-body text-xs text-muted-foreground">
                    {engineLabel}  -  {difficulty.label}
                  </p>
                </div>
                {engineThinking && (
                  <Loader2 className="w-4 h-4 animate-spin text-foreground/80 ml-auto" />
                )}
              </div>

              <div className="h-px bg-border" />

              {/* Player (White) */}
              <div
                className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                  game.turn() === "w" && !gameOver
                    ? "bg-secondary border border-border"
                    : ""
                }`}
              >
                <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center">
                  <User className="w-4 h-4 text-primary-foreground" />
                </div>
                <div>
                  <p className="font-body text-sm font-semibold text-foreground">
                    You
                  </p>
                  <p className="font-body text-xs text-muted-foreground">White</p>
                </div>
              </div>
            </div>

            <button
              onClick={resetGame}
              className="w-full py-3 bg-card hover:bg-secondary rounded-lg flex items-center justify-center gap-2 transition-colors border border-border font-body text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              New Game
            </button>

            <BoardThemeSelect />

            {gameOver && (
              <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                <button
                  onClick={analyzeFinishedGame}
                  disabled={reviewingGame || !engineReady || !!engineError}
                  className="w-full py-2.5 bg-primary rounded-md font-body text-xs font-semibold text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {reviewingGame ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Reviewing {reviewProgress}/{game.history().length}
                    </>
                  ) : (
                    <>
                      <BarChart3 className="w-3.5 h-3.5" />
                      Analyze Completed Game
                    </>
                  )}
                </button>
                <p className="font-body text-[11px] text-muted-foreground">
                  Move ratings stay hidden during play and appear only after this review, similar to Chess.com.
                </p>
                {reviewSummary && (
                  <p className="font-body text-[11px] text-foreground/80 leading-relaxed">{reviewSummary}</p>
                )}
                {reviewReady && (
                  <button
                    onClick={() => navigate("/analyze-game")}
                    className="w-full py-2.5 border border-border rounded-md font-body text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
                  >
                    Open Full Analysis
                  </button>
                )}
              </div>
            )}

            {coach !== "none" && (
              <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                <p className="font-display text-xs font-semibold text-foreground uppercase tracking-wider">
                  Coach  -  {COACHES[coach].name}
                </p>
                <p className="font-body text-xs text-muted-foreground leading-relaxed min-h-[3rem]">
                  {coachLine ||
                    "Your philosopher-coach will comment after each of your moves. Play a move to begin."}
                </p>
                <p className="font-body text-[10px] text-muted-foreground/80">
                  Add <span className="font-mono">?coach={coach}</span> to the URL to return to this guide.
                </p>
              </div>
            )}
          </div>

          {/* Center - Board + Eval bar */}
          <div className="lg:col-span-6 flex flex-col items-center order-1 lg:order-2">
            <div className="flex w-full max-w-[600px] gap-2">
              {/* Eval bar */}
              <div className="w-6 rounded-lg overflow-hidden border border-border bg-muted flex flex-col-reverse relative">
                <motion.div
                  className="bg-ivory"
                  animate={{ height: `${whitePercent}%` }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className={`font-mono text-[9px] font-bold ${
                      eval_ >= 0 ? "text-foreground" : "text-muted-foreground"
                    }`}
                    style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}
                  >
                    {evalDisplay}
                  </span>
                </div>
              </div>

              {/* Board */}
              <div className="flex-1 relative rounded-lg overflow-hidden border border-border shadow-elevated">
                <div
                  ref={boardRef}
                  className="grid grid-cols-8 grid-rows-8 aspect-square w-full"
                >
                  {Array.from({ length: 64 }, (_, i) => {
                    const row = Math.floor(i / 8);
                    const col = i % 8;
                    const square = `${String.fromCharCode(97 + col)}${8 - row}` as Square;
                    const piece = displayGame.get(square);
                    const isDark = (row + col) % 2 === 1;
                    const isSelected = selectedSquare === square;
                    const isValidTarget = validMoves.includes(square);
                    const isLastMoveSquare =
                      lastMove?.from === square || lastMove?.to === square;
                    const isDragSource = dragging?.square === square;
                    const isDragTarget = dragOver === square && isValidTarget;
                    const showAmbienceDots =
                      !selectedSquare &&
                      !dragging &&
                      game.turn() === "w" &&
                      !gameOver &&
                      !viewFen &&
                      allLegalDestinations.has(square);

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
                        } ${piece && game.turn() === "w" && piece.color === "w" && !gameOver && !viewFen ? "cursor-grab" : "cursor-pointer"}`}
                      >
                        {/* Last move highlight */}
                        {isLastMoveSquare && !viewFen && (
                          <div
                            className={`absolute inset-0 ${
                              isDark ? "bg-foreground/18" : "bg-foreground/12"
                            }`}
                          />
                        )}

                        {/* Selected highlight */}
                        {isSelected && (
                          <div className="absolute inset-0 bg-foreground/25 z-10" />
                        )}

                        {/* Drag target highlight */}
                        {isDragTarget && (
                          <div className="absolute inset-0 bg-foreground/20 z-10" />
                        )}

                        {showAmbienceDots && (
                          <div className="absolute z-[15] flex items-center justify-center w-full h-full pointer-events-none">
                            <div className="w-[14%] h-[14%] rounded-full bg-foreground/12 ring-1 ring-foreground/10" />
                          </div>
                        )}

                        {/* Coords */}
                        {col === 0 && (
                          <span
                            className={`absolute top-0.5 left-1 text-[9px] font-bold z-10 ${
                              isDark ? "text-chess-light/80" : "text-chess-dark/80"
                            }`}
                          >
                            {8 - row}
                          </span>
                        )}
                        {row === 7 && (
                          <span
                            className={`absolute bottom-0 right-1 text-[9px] font-bold z-10 ${
                              isDark ? "text-chess-light/80" : "text-chess-dark/80"
                            }`}
                          >
                            {String.fromCharCode(97 + col)}
                          </span>
                        )}

                        {/* Piece */}
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

                        {/* Valid move indicator */}
                        {isValidTarget && !isDragTarget && (
                          <div className="absolute z-30 flex items-center justify-center w-full h-full pointer-events-none">
                            {piece && !isDragSource ? (
                              <div className="w-[82%] h-[82%] rounded-full border-[5px] border-foreground/20" />
                            ) : (
                              <div className="w-[30%] h-[30%] rounded-full bg-foreground/20" />
                            )}
                          </div>
                        )}

                        {/* Check highlight */}
                        {piece?.type === "k" &&
                          game.inCheck() &&
                          piece.color === game.turn() &&
                          !viewFen && (
                            <div className="absolute inset-0 bg-destructive/40 rounded-full z-5" />
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

                {/* Promotion dialog */}
                <AnimatePresence>
                  {promotionSquare && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center"
                    >
                      <div className="bg-card border border-border rounded-lg p-4 flex gap-3">
                        {["q", "r", "b", "n"].map((p) => (
                          <button
                            key={p}
                            onClick={() => handlePromotion(p)}
                            className="w-14 h-14 rounded-md bg-secondary hover:bg-foreground/10 border border-border transition-colors flex items-center justify-center"
                          >
                            <img
                              src={PIECE_URLS["w"][p]}
                              alt={p}
                              className="w-10 h-10"
                            />
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Game over overlay */}
                <AnimatePresence>
                  {gameOver && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-50 bg-background/85 backdrop-blur-sm flex flex-col items-center justify-center gap-4"
                    >
                      <Trophy className="w-12 h-12 text-foreground/80" />
                      <p className="font-display text-2xl font-bold text-foreground">
                        {gameOver}
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                          onClick={async () => {
                            if (!reviewReady && !reviewingGame) await analyzeFinishedGame();
                            navigate("/analyze-game");
                          }}
                          disabled={reviewingGame || !engineReady || !!engineError}
                          className="bg-card border border-border px-4 py-2 rounded-md font-body text-sm font-semibold text-foreground hover:bg-secondary transition-colors disabled:opacity-60"
                        >
                          {reviewingGame ? `Analyzing ${reviewProgress}/${game.history().length}` : "Analyze Game"}
                        </button>
                        <button
                          onClick={resetGame}
                          className="bg-primary px-6 py-2.5 rounded-md font-body text-sm font-semibold text-primary-foreground shadow-gold transition-transform hover:scale-105"
                        >
                          Play Again
                        </button>
                        <button
                          onClick={() => navigate("/play")}
                          className="bg-card border border-border px-4 py-2 rounded-md font-body text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
                        >
                          Go to Menu
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Turn indicator + nav */}
            <div className="mt-4 flex gap-2 w-full justify-center max-w-[600px]">
              <button
                onClick={goBack}
                className="p-3 bg-card rounded-lg hover:bg-secondary transition-colors border border-border"
              >
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              </button>
              <div className="flex-1 flex items-center justify-center bg-card rounded-lg px-6 font-body text-sm font-medium border border-border text-foreground">
                {gameOver
                  ? gameOver
                  : engineThinking
                  ? "Stockfish is thinking..."
                  : game.turn() === "w"
                  ? "Your turn (White)"
                  : "Black to move"}
                {game.inCheck() && !gameOver && (
                  <span className="ml-2 text-destructive font-semibold">Check!</span>
                )}
              </div>
              <button
                onClick={goForward}
                className="p-3 bg-card rounded-lg hover:bg-secondary transition-colors border border-border"
              >
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Eval info */}
            <div className="mt-2 font-body text-xs text-muted-foreground text-center">
              {engineLabel}  -  Eval: {evalDisplay}  -  Depth: {evalDepth}
            </div>
            {engineError && (
              <p className="mt-2 max-w-md mx-auto text-center text-sm text-destructive font-body">
                Engine failed to load: {engineError}
              </p>
            )}
          </div>

          {/* Right panel - Move history */}
          <div className="lg:col-span-3 space-y-4 order-3">
            <div className="rounded-lg border border-border bg-card p-5 flex flex-col">
              <h3 className="font-display text-base font-semibold mb-4 flex items-center gap-2">
                <History className="w-4 h-4 text-muted-foreground" />
                Moves
              </h3>
              <div className="flex-1 overflow-y-auto max-h-[400px] pr-1 scrollbar-hide">
                <div className="space-y-1">
                  {Array.from({
                    length: Math.ceil(moveHistory.length / 2),
                  }).map((_, i) => {
                    const whiteMove = moveHistory[i * 2];
                    const blackMove = moveHistory[i * 2 + 1];
                    return (
                      <div key={i} className="flex items-center gap-1 text-sm">
                        <span className="font-mono text-xs text-muted-foreground w-6 text-right shrink-0">
                          {i + 1}.
                        </span>
                        <button
                          onClick={() => goToMove(i * 2)}
                          className={`px-2 py-1 rounded font-body text-sm transition-colors w-16 text-center ${
                            historyIndex === i * 2
                              ? "bg-foreground/15 text-foreground"
                              : `hover:bg-secondary ${whiteMove?.rating?.label ? reviewTone(whiteMove.rating.label).text : "text-foreground"}`
                          }`}
                        >
                          {whiteMove?.san}
                        </button>
                        {whiteMove?.rating?.label && (
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${reviewTone(
                              whiteMove.rating.label
                            ).chip}`}
                          >
                            {whiteMove.rating.label}
                          </span>
                        )}
                        {blackMove && (
                          <>
                            <button
                              onClick={() => goToMove(i * 2 + 1)}
                              className={`px-2 py-1 rounded font-body text-sm transition-colors w-16 text-center ${
                                historyIndex === i * 2 + 1
                                  ? "bg-foreground/15 text-foreground"
                                  : `hover:bg-secondary ${blackMove?.rating?.label ? reviewTone(blackMove.rating.label).text : "text-foreground"}`
                              }`}
                            >
                              {blackMove.san}
                            </button>
                            {blackMove.rating?.label && (
                              <span
                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${reviewTone(
                                  blackMove.rating.label
                                ).chip}`}
                              >
                                {blackMove.rating.label}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
                {moveHistory.length === 0 && (
                  <div className="flex flex-col items-center justify-center text-muted-foreground space-y-2 py-12">
                    <History className="w-8 h-8 opacity-40" />
                    <p className="text-sm font-body">No moves yet</p>
                    <p className="text-xs font-body">Click or drag a piece to move!</p>
                  </div>
                )}
              </div>

              {/* Live analysis indicator */}
              <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                <div className="font-body text-xs text-muted-foreground flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-foreground/50 animate-pulse" />
                  Live Analysis
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">
                  d{evalDepth}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;
