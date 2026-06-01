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
  Eye,
  Sparkles,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Chess, Square, PieceSymbol, Color } from "chess.js";
import {
  StockfishEngine,
  StockfishInfo,
  STOCKFISH_VERSION_LABEL,
  formatEngineInitError,
} from "@/lib/stockfish";
import { ChessSounds, playMoveSound } from "@/lib/sounds";
import { BoardThemeSelect } from "@/components/BoardThemeSelect";
import { Switch } from "@/components/ui/switch";
import { PieceImage } from "@/components/chess/PieceImage";
import { EvalBar } from "@/components/chess/EvalBar";
import { PlayerBanner } from "@/components/chess/PlayerBanner";
import { MoveList } from "@/components/chess/MoveList";
import { ForesightOverlay } from "@/components/chess/ForesightOverlay";
import { useChessClock } from "@/hooks/use-chess-clock";
import { computeMaterial } from "@/lib/captured-material";
import { attackedSquares, findPins, legalOrControlledMoves } from "@/lib/chess-foresight";
import { probeResultToCp, rateMoveLikeChessCom } from "@/lib/move-rating";
import {
  type CoachId,
  coachOnMoveRating,
  coachOnEval,
  COACHES,
} from "@/lib/philosopher-coaches";
import {
  markAnalysisTransitionStart,
  saveLatestFinishedGame,
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

// Helper to get square from mouse/touch position relative to board (white at bottom).
function getSquareFromPoint(boardEl: HTMLElement, clientX: number, clientY: number): Square | null {
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

  // Time control (minutes + Fischer increment seconds, defaults to 10|0).
  const initialMinutes = Number(searchParams.get("min")) || 10;
  const incrementSeconds = Number(searchParams.get("inc")) || 0;
  const clock = useChessClock({ initialMs: initialMinutes * 60000, incrementMs: incrementSeconds * 1000 });
  const { whiteMs, blackMs, flagged, setActive, setRunning, applyIncrement, reset: resetClock } = clock;

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
  const [evalMate, setEvalMate] = useState<number | null>(null);
  const [evalDepth, setEvalDepth] = useState(0);
  const [engineReady, setEngineReady] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [engineLabel, setEngineLabel] = useState(STOCKFISH_VERSION_LABEL);
  const [engineThinking, setEngineThinking] = useState(false);
  const [gameOver, setGameOver] = useState<string | null>(null);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [viewFen, setViewFen] = useState<string | null>(null);
  const [promotionSquare, setPromotionSquare] = useState<{ from: Square; to: Square } | null>(null);

  // Tactical Foresight HUD.
  const [foresightOn, setForesightOn] = useState(false);
  const [hoveredSquare, setHoveredSquare] = useState<Square | null>(null);

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

  const displayFen = viewFen || game.fen();
  const displayGame = useMemo(() => new Chess(displayFen), [displayFen]);

  const allLegalDestinations = useMemo(() => {
    const s = new Set<Square>();
    if (game.turn() !== "w" || game.isGameOver() || viewFen) return s;
    for (const m of game.moves({ verbose: true })) {
      if (m.color === "w") s.add(m.to as Square);
    }
    return s;
  }, [game, viewFen]);

  // --- Material + captured pieces (derived from the displayed position) ---
  const material = useMemo(() => computeMaterial(displayFen), [displayFen]);
  const whiteAdvantage = material.diff > 0 ? material.diff : 0;
  const blackAdvantage = material.diff < 0 ? -material.diff : 0;

  // --- Tactical Foresight derivations ---
  // Pins depend only on the position, so they persist while Foresight is on.
  const foresightPins = useMemo(() => {
    if (!foresightOn) return [];
    return [...findPins(displayGame, "w"), ...findPins(displayGame, "b")];
  }, [foresightOn, displayGame]);

  // Hover dots: green for your (white) pieces, red for the enemy's reach.
  const foresightDots = useMemo(() => {
    if (!foresightOn || !hoveredSquare) return { red: [] as Square[], green: [] as Square[] };
    const piece = displayGame.get(hoveredSquare);
    if (!piece) return { red: [], green: [] };
    if (piece.color === "w") {
      return { red: [], green: legalOrControlledMoves(displayFen, hoveredSquare) };
    }
    return { red: attackedSquares(displayGame, hoveredSquare), green: [] };
  }, [foresightOn, hoveredSquare, displayGame, displayFen]);

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
        setEvalMate(info.mate);
        setEval_(info.mate > 0 ? 2000 : -2000);
      } else if (info.score !== undefined) {
        setEvalMate(null);
        setEval_(info.score);
      }
      if (info.depth) setEvalDepth(info.depth);
    });
  }, [gameFen, viewFen, engineReady, engineError]);

  // --- Clock wiring ---
  useEffect(() => {
    setActive(viewFen || gameOver ? null : gameTurn);
    setRunning(engineReady && !engineError && !gameOver && !viewFen);
  }, [viewFen, gameOver, gameTurn, engineReady, engineError, setActive, setRunning]);

  useEffect(() => {
    if (flagged && !gameOver) {
      setGameOver(flagged === "w" ? "Black wins on time!" : "White wins on time!");
      ChessSounds.gameOver();
    }
  }, [flagged, gameOver]);

  // Check game over
  useEffect(() => {
    if (game.isCheckmate()) {
      setGameOver(game.turn() === "w" ? "Black wins by checkmate!" : "White wins by checkmate!");
      ChessSounds.gameOver();
    } else if (game.isStalemate()) {
      setGameOver("Stalemate!");
      ChessSounds.gameOver();
    } else if (game.isDraw()) {
      setGameOver("Draw!");
      ChessSounds.gameOver();
    }
  }, [game]);

  useEffect(() => {
    if (!gameOver || game.history().length === 0) return;
    saveLatestFinishedGame({
      createdAt: Date.now(),
      pgn: game.pgn(),
      result: gameOver,
      engine: engineLabel,
    });
  }, [engineLabel, game, gameOver]);

  // Stockfish plays black
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
        applyIncrement("b");
        setGame(g);
        setLastMove({ from, to });
        setHistoryIndex(-1);
        setViewFen(null);
        setMoveHistory((prev) => [...prev, { san: result.san }]);
      }
    }
    setEngineThinking(false);
  }, [difficulty.depth, engineError, applyIncrement]);

  useEffect(() => {
    if (engineReady && !engineError && game.turn() === "b" && !game.isGameOver() && !engineThinking) {
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
    setCoachLine(coachOnEval(coach, eval_, evalMate, last?.san ?? null, moveHistory.length * 13));
  }, [coach, moveHistory, eval_, evalMate, reviewingGame]);

  const executeMove = useCallback(
    (from: Square, to: Square, promotion?: string) => {
      const g = new Chess(game.fen());
      const result = g.move({ from, to, promotion: (promotion || undefined) as PieceSymbol | undefined });

      if (result) {
        playMoveSound(result, g.isCheck());
        applyIncrement("w");
        setMoveHistory((prev) => [...prev, { san: result.san }]);
        setGame(g);
        setLastMove({ from, to });
        setSelectedSquare(null);
        setValidMoves([]);
        setHistoryIndex(-1);
        setViewFen(null);
        setPromotionSquare(null);
        if (coach !== "none") setCoachLine(coachOnEval(coach, eval_, evalMate, result.san, Date.now()));
        return true;
      }
      return false;
    },
    [coach, eval_, evalMate, game, applyIncrement],
  );

  const handleSquareClick = (square: Square) => {
    if (game.turn() !== "w" || engineThinking || gameOver || viewFen) return;
    if (dragging) return;

    const piece = game.get(square);

    if (selectedSquare) {
      const isValid = validMoves.includes(square);
      if (isValid) {
        const movingPiece = game.get(selectedSquare);
        if (
          movingPiece?.type === "p" &&
          ((movingPiece.color === "w" && square[1] === "8") || (movingPiece.color === "b" && square[1] === "1"))
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
      setDragging((prev) => (prev ? { ...prev, x: clientX, y: clientY } : null));
      if (boardRef.current) setDragOver(getSquareFromPoint(boardRef.current, clientX, clientY));
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
    setEvalMate(null);
    setGameOver(null);
    setHistoryIndex(-1);
    setViewFen(null);
    setPromotionSquare(null);
    setDragging(null);
    setCoachLine(null);
    setReviewSummary(null);
    setReviewReady(false);
    setHoveredSquare(null);
    resetClock();
  };

  const goToMove = (index: number) => {
    const fullHistory = game.history();
    const replay = new Chess();
    for (let i = 0; i <= Math.min(index, fullHistory.length - 1); i++) replay.move(fullHistory[i]);
    setViewFen(replay.fen());
    setHistoryIndex(index);
    setSelectedSquare(null);
    setValidMoves([]);
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
    if (current < fullHistory.length) goToMove(current);
    else {
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
          evalBeforeCp: probeResultToCp(beforeProbe),
          evalAfterCp: probeResultToCp(afterProbe),
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
        accuracy: { w: Number(avg(bySide.w).toFixed(1)), b: Number(avg(bySide.b).toFixed(1)) },
        moves: reviewedPlies,
      });
      if (coach !== "none") setCoachLine(coachOnMoveRating(coach, "Good", "analysis", Date.now()));
    } finally {
      setReviewingGame(false);
    }
  }, [coach, engineLabel, game, gameOver, reviewingGame]);

  const evalText =
    evalMate != null ? `${evalMate > 0 ? "" : "-"}M${Math.abs(evalMate)}` : eval_ >= 0 ? `+${(eval_ / 100).toFixed(1)}` : (eval_ / 100).toFixed(1);

  const moveListEntries = moveHistory.map((m) => ({ san: m.san, label: m.rating?.label }));

  const statusText = gameOver
    ? gameOver
    : engineThinking
      ? "Stockfish is thinking…"
      : game.turn() === "w"
        ? "Your turn (White)"
        : "Black to move";

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
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
          <span className="ml-auto rounded-full border border-border px-3 py-1 font-body text-xs text-muted-foreground">
            {difficulty.label} ({difficulty.rating})
          </span>
        </div>
      </nav>

      <div className="container mx-auto max-w-[1400px] px-4 py-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* ===== Board area (≈65%) ===== */}
          <div className="order-1 w-full lg:flex-[0_0_64%] lg:max-w-[64%]">
            <div className="mx-auto flex max-w-[620px] flex-col gap-2">
              {/* Opponent banner (Black / Stockfish) */}
              <PlayerBanner
                name="Stockfish"
                rating={difficulty.rating}
                subtitle={`${engineLabel} · ${difficulty.label}`}
                avatar={<Bot className="h-5 w-5" />}
                color="b"
                captured={material.capturedByBlack}
                advantage={blackAdvantage}
                isActive={gameTurn === "b" && !gameOver}
                isThinking={engineThinking}
                clockMs={blackMs}
                flagged={flagged === "b"}
              />

              {/* Eval bar + board */}
              <div className="flex items-stretch gap-2">
                <EvalBar cp={eval_} mate={evalMate} />

                <div className="relative flex-1 overflow-hidden rounded-xl border border-border shadow-elevated ring-1 ring-white/5">
                  <div ref={boardRef} className="grid aspect-square w-full grid-cols-8 grid-rows-8">
                    {Array.from({ length: 64 }, (_, i) => {
                      const row = Math.floor(i / 8);
                      const col = i % 8;
                      const square = `${String.fromCharCode(97 + col)}${8 - row}` as Square;
                      const piece = displayGame.get(square);
                      const isDark = (row + col) % 2 === 1;
                      const isSelected = selectedSquare === square;
                      const isValidTarget = validMoves.includes(square);
                      const isLastMoveSquare = lastMove?.from === square || lastMove?.to === square;
                      const isDragSource = dragging?.square === square;
                      const isDragTarget = dragOver === square && isValidTarget;
                      const showAmbienceDots =
                        !selectedSquare &&
                        !dragging &&
                        !foresightOn &&
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
                          onMouseEnter={() => foresightOn && setHoveredSquare(square)}
                          onMouseLeave={() => foresightOn && setHoveredSquare((s) => (s === square ? null : s))}
                          className={`relative flex select-none items-center justify-center transition-[filter] ${
                            isDark ? "bg-chess-dark hover:brightness-110" : "bg-chess-light hover:brightness-105"
                          } ${
                            piece && game.turn() === "w" && piece.color === "w" && !gameOver && !viewFen
                              ? "cursor-grab"
                              : "cursor-pointer"
                          }`}
                        >
                          {/* Last move highlight (warm yellow) */}
                          {isLastMoveSquare && !viewFen && (
                            <div className="absolute inset-0" style={{ backgroundColor: "rgba(245,200,68,0.30)" }} />
                          )}

                          {/* Selected highlight */}
                          {isSelected && (
                            <div className="absolute inset-0 z-10" style={{ backgroundColor: "rgba(245,200,68,0.45)" }} />
                          )}

                          {/* Drag target highlight */}
                          {isDragTarget && (
                            <div className="absolute inset-0 z-10" style={{ backgroundColor: "rgba(129,182,76,0.40)" }} />
                          )}

                          {showAmbienceDots && (
                            <div className="pointer-events-none absolute z-[15] flex h-full w-full items-center justify-center">
                              <div className="h-[14%] w-[14%] rounded-full bg-foreground/12 ring-1 ring-foreground/10" />
                            </div>
                          )}

                          {/* Coords */}
                          {col === 0 && (
                            <span
                              className={`absolute left-1 top-0.5 z-10 text-[9px] font-bold ${
                                isDark ? "text-chess-light/80" : "text-chess-dark/80"
                              }`}
                            >
                              {8 - row}
                            </span>
                          )}
                          {row === 7 && (
                            <span
                              className={`absolute bottom-0 right-1 z-10 text-[9px] font-bold ${
                                isDark ? "text-chess-light/80" : "text-chess-dark/80"
                              }`}
                            >
                              {String.fromCharCode(97 + col)}
                            </span>
                          )}

                          {/* Piece */}
                          {piece && !isDragSource && (
                            <PieceImage color={piece.color} type={piece.type} active={isSelected} className="z-20 h-[84%] w-[84%]" />
                          )}

                          {/* Valid move indicator (green) */}
                          {isValidTarget && !isDragTarget && (
                            <div className="pointer-events-none absolute z-30 flex h-full w-full items-center justify-center">
                              {piece && !isDragSource ? (
                                <div className="h-[84%] w-[84%] rounded-full border-[5px]" style={{ borderColor: "rgba(129,182,76,0.55)" }} />
                              ) : (
                                <div className="h-[30%] w-[30%] rounded-full" style={{ backgroundColor: "rgba(129,182,76,0.45)" }} />
                              )}
                            </div>
                          )}

                          {/* Check highlight */}
                          {piece?.type === "k" && displayGame.inCheck() && piece.color === displayGame.turn() && (
                            <div className="absolute inset-0 z-[5] rounded-full bg-destructive/45" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Tactical Foresight HUD */}
                  {foresightOn && (
                    <ForesightOverlay
                      redSquares={foresightDots.red}
                      greenSquares={foresightDots.green}
                      pins={foresightPins}
                      orientation="white"
                    />
                  )}

                  {/* Dragged piece ghost */}
                  {dragging && (
                    <div
                      className="drag-ghost fixed z-[100] pointer-events-none"
                      style={{ left: dragging.x - 36, top: dragging.y - 36, width: 72, height: 72 }}
                    >
                      <PieceImage color={dragging.piece.color as Color} type={dragging.piece.type} active className="h-full w-full opacity-95" />
                    </div>
                  )}

                  {/* Promotion dialog */}
                  <AnimatePresence>
                    {promotionSquare && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
                      >
                        <div className="flex gap-3 rounded-xl border border-border bg-card p-4 shadow-panel">
                          {(["q", "r", "b", "n"] as const).map((p) => (
                            <button
                              key={p}
                              onClick={() => handlePromotion(p)}
                              className="flex h-14 w-14 items-center justify-center rounded-md border border-border bg-secondary transition-colors hover:bg-foreground/10"
                            >
                              <PieceImage color="w" type={p} className="h-10 w-10" />
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
                        className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/85 backdrop-blur-sm"
                      >
                        <Trophy className="h-12 w-12 text-foreground/80" />
                        <p className="font-display text-2xl font-bold text-foreground">{gameOver}</p>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <button
                            onClick={async () => {
                              markAnalysisTransitionStart();
                              if (!reviewReady && !reviewingGame) void analyzeFinishedGame();
                              navigate("/analyze-game");
                            }}
                            disabled={reviewingGame || !engineReady || !!engineError}
                            className="rounded-md border border-border bg-card px-4 py-2 font-body text-sm font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
                          >
                            {reviewingGame ? `Analyzing ${reviewProgress}/${game.history().length}` : "Analyze Game"}
                          </button>
                          <button
                            onClick={resetGame}
                            className="rounded-md bg-primary px-6 py-2.5 font-body text-sm font-semibold text-primary-foreground shadow-gold transition-transform hover:scale-105"
                          >
                            Play Again
                          </button>
                          <button
                            onClick={() => navigate("/play")}
                            className="rounded-md border border-border bg-card px-4 py-2 font-body text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
                          >
                            Go to Menu
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Player banner (White / You) */}
              <PlayerBanner
                name="You"
                rating={1500}
                subtitle="White"
                avatar={<User className="h-5 w-5" />}
                color="w"
                captured={material.capturedByWhite}
                advantage={whiteAdvantage}
                isActive={gameTurn === "w" && !gameOver}
                clockMs={whiteMs}
                flagged={flagged === "w"}
              />

              {/* Move navigation + status */}
              <div className="mt-1 flex w-full items-stretch gap-2">
                <button
                  onClick={goBack}
                  className="rounded-lg border border-border bg-card p-3 transition-colors hover:bg-secondary"
                  aria-label="Previous move"
                >
                  <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                </button>
                <div className="flex flex-1 items-center justify-center rounded-lg border border-border bg-card px-6 font-body text-sm font-medium text-foreground">
                  {statusText}
                  {displayGame.inCheck() && !gameOver && <span className="ml-2 font-semibold text-destructive">Check!</span>}
                </div>
                <button
                  onClick={goForward}
                  className="rounded-lg border border-border bg-card p-3 transition-colors hover:bg-secondary"
                  aria-label="Next move"
                >
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              {engineError && (
                <p className="mt-2 text-center font-body text-sm text-destructive">Engine failed to load: {engineError}</p>
              )}
            </div>
          </div>

          {/* ===== Unified sidebar (≈35%) ===== */}
          <div className="order-2 w-full space-y-4 lg:flex-1">
            {/* Engine + Foresight controls */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-foreground/70" />
                  <span className="font-body text-xs text-muted-foreground">Live analysis</span>
                </div>
                <span className="font-mono text-xs text-foreground">
                  {evalText} <span className="text-muted-foreground">· d{evalDepth}</span>
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between rounded-lg border border-border/60 bg-secondary/50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-foreground/80" />
                  <div>
                    <p className="font-body text-sm font-semibold text-foreground">Tactical Foresight</p>
                    <p className="font-body text-[11px] text-muted-foreground">Hover pieces to map threats & pins</p>
                  </div>
                </div>
                <Switch checked={foresightOn} onCheckedChange={setForesightOn} aria-label="Toggle Tactical Foresight" />
              </div>

              {foresightOn && (
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-body text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-green-500/60" /> Your moves
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" /> Enemy attacks
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-red-400" /> Pins
                  </span>
                </div>
              )}
            </div>

            {/* Move history */}
            <div className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-soft">
              <h3 className="mb-3 flex items-center gap-2 font-display text-base font-semibold">
                <History className="h-4 w-4 text-muted-foreground" />
                Moves
              </h3>
              <MoveList moves={moveListEntries} activeIndex={historyIndex} onSelect={goToMove} />
            </div>

            {/* Post-game review */}
            {gameOver && (
              <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-soft">
                <button
                  onClick={analyzeFinishedGame}
                  disabled={reviewingGame || !engineReady || !!engineError}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 font-body text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {reviewingGame ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Reviewing {reviewProgress}/{game.history().length}
                    </>
                  ) : (
                    <>
                      <BarChart3 className="h-3.5 w-3.5" />
                      Analyze Completed Game
                    </>
                  )}
                </button>
                <p className="font-body text-[11px] text-muted-foreground">
                  Move ratings stay hidden during play and appear here after review, just like Chess.com.
                </p>
                {reviewSummary && <p className="font-body text-[11px] leading-relaxed text-foreground/80">{reviewSummary}</p>}
                {reviewReady && (
                  <button
                    onClick={() => {
                      markAnalysisTransitionStart();
                      navigate("/analyze-game");
                    }}
                    className="w-full rounded-md border border-border py-2.5 font-body text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
                  >
                    Open Full Game Review
                  </button>
                )}
              </div>
            )}

            {/* Controls */}
            <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-soft">
              <button
                onClick={resetGame}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-secondary/40 py-2.5 font-body text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                New Game
              </button>
              <BoardThemeSelect />
            </div>

            {/* Coach */}
            {coach !== "none" && (
              <div className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-soft">
                <p className="font-display text-xs font-semibold uppercase tracking-wider text-foreground">
                  Coach · {COACHES[coach].name}
                </p>
                <p className="min-h-[3rem] font-body text-xs leading-relaxed text-muted-foreground">
                  {coachLine || "Your philosopher-coach will comment after each of your moves. Play a move to begin."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;
