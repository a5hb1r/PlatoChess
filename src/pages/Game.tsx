import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronFirst,
  ChevronLast,
  RotateCcw,
  History,
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
import { describeGameTermination } from "@/lib/game-termination";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DIFFICULTY_LEVELS = [
  { label: "Beginner", skill: 0, depth: 2, rating: "~250" },
  { label: "Easy", skill: 2, depth: 3, rating: "~500" },
  { label: "Medium", skill: 4, depth: 5, rating: "~850" },
  { label: "Hard", skill: 7, depth: 7, rating: "~1150" },
  { label: "Expert", skill: 10, depth: 9, rating: "~1500" },
  { label: "Master", skill: 14, depth: 12, rating: "~1850" },
];
const ENGINE_MOVE_DELAY_MS = 180;
const EVAL_UPDATE_INTERVAL_MS = 120;

// Default per-player clock for the chess.com-style player banners. Practice
// games versus Stockfish have no enforced time control, so the clocks are a
// cosmetic 10-minute countdown that simply pauses at 0 (it never flags / ends
// the game) and visually indicates whose turn it is.
const PRACTICE_CLOCK_MS = 10 * 60 * 1000;

type SidebarTab = "moves" | "players" | "chat";
type ChatMessage = { id: number; author: string; text: string };

const DAILY_MOVE_WINDOW_MS = 24 * 60 * 60 * 1000;
const PREMOVE_STORAGE_KEY = "plato:premove-enabled";
const PREMOVE_QUEUE_STORAGE_KEY = "plato:queued-premove";
type QueuedPremove = {
  from: Square;
  to: Square;
  promotion?: string;
};

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

function summarizeResultLabel(result: string): string {
  const normalized = result.toLowerCase();
  if (normalized.includes("checkmate")) return "Checkmate";
  if (normalized.includes("stalemate")) return "Stalemate";
  if (normalized.includes("draw")) return "Draw";
  return "Game over";
}

function eloPulseForResult(result: string, skillLevel: number): number {
  const baseSwing = Math.max(8, Math.round(8 + skillLevel * 0.65));
  if (result.startsWith("White wins")) return baseSwing;
  if (result.startsWith("Black wins")) return -Math.max(6, Math.round(baseSwing * 0.8));
  return 0;
}

const Game = () => {
  const { user } = useAuth();
  const { showValidMoves } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const difficultyParam = parseInt(searchParams.get("level") || "2");
  const modeParam = (searchParams.get("mode") || "practice").toLowerCase();
  const isPracticeMode = modeParam !== "online";
  const difficulty = DIFFICULTY_LEVELS[Math.min(difficultyParam, DIFFICULTY_LEVELS.length - 1)];
  const coach = parseCoachId(searchParams.get("coach"));
  const mode = parseGameMode(searchParams.get("mode"));
  const isDailyMode = mode === "daily";
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
  const gameOverActionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const lastEvalUiUpdateRef = useRef(0);

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
    if (gameTurn !== "w" || gameIsOver || viewFen) return s;
    for (const m of game.moves({ verbose: true })) {
      if (m.color === "w") s.add(m.to as Square);
    }
    return s;
  }, [game, gameTurn, gameIsOver, viewFen]);

  const clearQueuedPremove = useCallback(() => {
    setQueuedPremove(null);
    localStorage.removeItem(PREMOVE_QUEUE_STORAGE_KEY);
  }, []);

  const queuePremove = useCallback((move: QueuedPremove) => {
    setQueuedPremove(move);
    localStorage.setItem(PREMOVE_QUEUE_STORAGE_KEY, JSON.stringify(move));
    toast.message("Premove queued.");
  }, []);

  useEffect(() => {
    if (!user) return;

    supabase
      .from("profiles")
      .select("premove_enabled, rating")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const enabled = data?.premove_enabled ?? true;
        setPremoveEnabled(enabled);
        localStorage.setItem(PREMOVE_STORAGE_KEY, JSON.stringify(enabled));
        if (typeof data?.rating === "number") setPlayerElo(data.rating);
      });
  }, [user]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== PREMOVE_STORAGE_KEY) return;
      setPremoveEnabled(event.newValue !== "false");
    };
    const handleDisabled = () => {
      setPremoveEnabled(false);
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("plato:premove-disabled", handleDisabled);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("plato:premove-disabled", handleDisabled);
    };
  }, []);

  useEffect(() => {
    if (!premoveEnabled) {
      clearQueuedPremove();
      setSelectedSquare(null);
      setValidMoves([]);
    }
  }, [clearQueuedPremove, premoveEnabled]);

  useEffect(() => {
    if (!isDailyMode || gameOver) {
      setDailyMoveDeadlineMs(null);
      return;
    }
    const nextDeadline = Date.now() + DAILY_MOVE_WINDOW_MS;
    setDailyMoveDeadlineMs(nextDeadline);
    setDailyClockMs(DAILY_MOVE_WINDOW_MS);
  }, [gameTurn, gameOver, isDailyMode]);

  useEffect(() => {
    if (!isDailyMode || !dailyMoveDeadlineMs || gameOver) return;

    const tick = () => {
      const remaining = dailyMoveDeadlineMs - Date.now();
      setDailyClockMs(Math.max(0, remaining));
      if (remaining <= 0) {
        setGameOver(game.turn() === "w" ? "White flagged on time." : "Black flagged on time.");
      }
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [dailyMoveDeadlineMs, game, gameOver, isDailyMode]);

  // Cosmetic per-player countdown that ticks for whoever is on the move. It
  // never flags the game (just clamps at 0) so it cannot interfere with the
  // practice-vs-engine flow; it only signals whose turn it is. Daily mode keeps
  // its own dedicated 24h-per-move clock instead.
  useEffect(() => {
    if (isDailyMode || gameOver || viewFen || gameIsOver) return;
    const interval = window.setInterval(() => {
      if (gameTurn === "w") {
        setWhiteClockMs((ms) => Math.max(0, ms - 1000));
      } else {
        setBlackClockMs((ms) => Math.max(0, ms - 1000));
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [gameTurn, gameOver, viewFen, gameIsOver, isDailyMode]);

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

  // Eval is computed for the coach, for board scrubbing, and once the game has
  // concluded (so the bar can be revealed). It is intentionally NOT surfaced to
  // the user while a game is actively in progress (spec Section 1).
  const liveEvalNeeded = isPracticeMode || coach !== "none" || !!viewFen || !!gameOver;
  useEffect(() => {
    if (!isPracticeMode || !engineReady || !engineRef.current || engineError) return;
    const fen = viewFen || gameFen;
    const side = new Chess(fen).turn();
    if (!viewFen && side === "b") return;
    engineRef.current.evaluate(fen, 18, (info: StockfishInfo) => {
      const now = performance.now();
      const shouldRefreshUi = now - lastEvalUiUpdateRef.current >= EVAL_UPDATE_INTERVAL_MS;
      if (!shouldRefreshUi) return;
      if (info.mate !== undefined) {
        setEvalMate(info.mate);
        setEval_(info.mate > 0 ? 2000 : -2000);
      } else if (info.score !== undefined) {
        setEvalMate(null);
        setEval_(info.score);
      }
      lastEvalUiUpdateRef.current = now;
      lastEvalUiUpdateRef.current = now;
    });
  }, [gameFen, viewFen, engineReady, engineError, isPracticeMode]);

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
  }, [gameTurn, gameIsOver, engineReady, engineError, engineThinking, makeEngineMove]);

  useEffect(() => {
    if (coach === "none") return;
    if (moveHistory.length === 0) {
      setCoachLine("I am ready. Play with intention, and I will annotate the ideas behind each move.");
      return;
    }
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

  useEffect(() => {
    if (!queuedPremove || game.turn() !== "w" || engineThinking || gameOver || !premoveEnabled) return;

    const queuedMove = queuedPremove;
    clearQueuedPremove();
    const played = executeMove(queuedMove.from, queuedMove.to, queuedMove.promotion);
    if (played) {
      toast.success("Queued premove played.");
    } else {
      toast.message("Queued premove cleared because it was no longer legal.");
    }
  }, [
    clearQueuedPremove,
    engineThinking,
    executeMove,
    game,
    gameOver,
    premoveEnabled,
    queuedPremove,
  ]);

  useEffect(() => {
    if (!isDailyMode || gameOver) return;
    if (game.turn() === "w") {
      toast.message("Daily mode: your move window has started.");
    }
  }, [gameTurn, gameOver, isDailyMode, game]);

  const handleSquareClick = (square: Square) => {
    if (game.turn() !== "w" || engineThinking || gameOver || viewFen) return;
    if (dragging) return;

    const piece = game.get(square);

    if (game.turn() !== "w") {
      if (!premoveEnabled) return;

      if (selectedSquare) {
        if (selectedSquare === square) {
          setSelectedSquare(null);
          return;
        }
        queuePremove({ from: selectedSquare, to: square });
        setSelectedSquare(null);
        setValidMoves([]);
        return;
      }

      if (piece && piece.color === "w") {
        setSelectedSquare(square);
      } else {
        setSelectedSquare(null);
      }
      setValidMoves([]);
      return;
    }

    if (engineThinking) return;

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

  const resetGame = useCallback(() => {
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

  const goToStart = () => {
    if (totalPlies === 0) return;
    setViewFen(new Chess().fen());
    setHistoryIndex(-1);
  };

  const goToLast = () => {
    setViewFen(null);
    setHistoryIndex(-1);
  };

  const goBack = () => {
    const target = currentPly - 1;
    if (target <= 0) goToStart();
    else goToMove(target - 1);
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
  }, [eval_, gameOver]);

  const sendChat = () => {
    const text = chatDraft.trim();
    if (!text) return;
    setChatMessages((prev) => [
      ...prev,
      { id: Date.now(), author: "You", text },
    ]);
    setChatDraft("");
  };

  // A single move cell in the sidebar move log. Highlights with a distinct
  // background when it is the position currently shown on the board.
  const renderMoveCell = (
    move: { san: string; rating?: { label: string; color: string } } | undefined,
    ply: number
  ) => {
    if (!move) return <div />;
    const active = historyIndex === ply;
    const toneText = move.rating?.label
      ? reviewTone(move.rating.label).text
      : "text-gray-200";
    return (
      <button
        type="button"
        onClick={() => goToMove(ply)}
        className={`flex items-center gap-1.5 px-3 py-2 text-left font-body text-sm transition-colors ${
          active
            ? "bg-cc-green font-semibold text-white"
            : `hover:bg-white/5 ${toneText}`
        }`}
      >
        <span>{move.san}</span>
        {move.rating?.label && (
          <span
            className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${reviewTone(
              move.rating.label
            ).chip}`}
          >
            {move.rating.label}
          </span>
        )}
      </button>
    );
  };

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

  const eloPulse = useMemo(
    () => (gameOver ? eloPulseForResult(gameOver, difficulty.skill) : 0),
    [difficulty.skill, gameOver]
  );
  const resultSummary = useMemo(
    () =>
      gameOver
        ? `${summarizeResultLabel(gameOver)} - ${eloPulse > 0 ? `+${eloPulse}` : `${eloPulse}`} Elo`
        : null,
    [eloPulse, gameOver]
  );
  const gameOutcome = useMemo(() => {
    if (!gameOver) return "Game complete";
    if (gameOver.startsWith("White wins")) return "Victory";
    if (gameOver.startsWith("Black wins")) return "Defeat";
    return "Draw";
  }, [gameOver]);

  const handleAnalyzeAction = useCallback(() => {
    if (!gameOver) return;
    navigate("/analyze", {
      state: {
        pgn: game.pgn(),
        source: "end-of-game-overlay",
      },
    });
  }, [game, gameOver, navigate]);

  const handleNewOpponentAction = useCallback(() => {
    navigate("/play");
  }, [navigate]);

  useEffect(() => {
    if (!gameOver) return;
    const focusFirstAction = requestAnimationFrame(() => {
      gameOverActionRefs.current[0]?.focus();
    });

    const onOverlayKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "a") {
        event.preventDefault();
        handleAnalyzeAction();
        return;
      }
      if (key === "r") {
        event.preventDefault();
        resetGame();
        return;
      }
      if (key === "n") {
        event.preventDefault();
        handleNewOpponentAction();
        return;
      }
      if (event.key !== "Tab") return;

      const actions = gameOverActionRefs.current.filter(
        (btn): btn is HTMLButtonElement => Boolean(btn)
      );
      if (!actions.length) return;

      event.preventDefault();
      const currentIndex = actions.findIndex((btn) => btn === document.activeElement);
      if (currentIndex === -1) {
        actions[0].focus();
        return;
      }
      const delta = event.shiftKey ? -1 : 1;
      const nextIndex = (currentIndex + delta + actions.length) % actions.length;
      actions[nextIndex].focus();
    };

    window.addEventListener("keydown", onOverlayKeyDown);
    return () => {
      cancelAnimationFrame(focusFirstAction);
      window.removeEventListener("keydown", onOverlayKeyDown);
    };
  }, [gameOver, handleAnalyzeAction, handleNewOpponentAction, resetGame]);

  // The evaluation bar is strictly hidden during the active game across all modes
  // and is only revealed once the game has completely concluded (spec Section 1).
  const showEvalBar = !!gameOver;
  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center gap-4 px-6 py-4">
          <Link
            to="/play"
            className="flex items-center gap-2 font-body text-sm text-gray-400 transition-colors hover:text-gray-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <h1 className="font-display text-lg font-semibold text-gray-100 sm:text-xl">
            {isDailyMode ? "Daily" : "Practice"}{" "}
            <span className="text-cc-green">vs Stockfish</span>
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
            <div className={`flex w-full max-w-[600px] ${isPracticeMode ? "gap-2" : ""}`}>
              {/* Eval bar */}
              {isPracticeMode && (
                <div
                  data-testid="eval-bar"
                  className="w-6 rounded-lg overflow-hidden border border-border bg-muted flex flex-col-reverse relative"
                >
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
              )}

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
                onClick={resetGame}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-secondary/40 py-2.5 font-body text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                New Game
              </button>
              <BoardThemeSelect />
            </div>

            {/* Eval info */}
            {isPracticeMode && (
              <>
                <div className="mt-2 font-body text-xs text-muted-foreground text-center">
                  {engineLabel}  -  Eval: {evalDisplay}  -  Depth: {evalDepth}
                </div>
                {engineError && (
                  <p className="mt-2 max-w-md mx-auto text-center text-sm text-destructive font-body">
                    Engine failed to load: {engineError}
                  </p>
                )}
              </>
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
              {isPracticeMode && (
                <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                  <div className="font-body text-xs text-muted-foreground flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-foreground/50 animate-pulse" />
                    Live Analysis
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    d{evalDepth}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Game;
