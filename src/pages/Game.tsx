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
  ListOrdered,
  Users,
  MessageSquare,
  Flag,
  Handshake,
  Send,
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
import {
  type CoachId,
  coachOnEval,
  COACHES,
} from "@/lib/philosopher-coaches";
import { reviewTone } from "@/lib/review-colors";
import {
  saveLatestFinishedGame,
} from "@/lib/game-review";
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

function parseGameMode(raw: string | null): "standard" | "daily" {
  return raw === "daily" ? "daily" : "standard";
}

function formatDuration(ms: number): string {
  const clamped = Math.max(0, ms);
  const hours = Math.floor(clamped / (60 * 60 * 1000));
  const minutes = Math.floor((clamped % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((clamped % (60 * 1000)) / 1000);
  return `${hours}h ${minutes}m ${seconds}s`;
}

/** Compact clock for the player banners (m:ss, or h:mm:ss past an hour). */
function formatClock(ms: number): string {
  const clamped = Math.max(0, ms);
  const totalSeconds = Math.floor(clamped / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
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

  const [game, setGame] = useState(new Chess());
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [validMoves, setValidMoves] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [moveHistory, setMoveHistory] = useState<
    { san: string; rating?: { label: string; color: string }; cpLoss?: number; bestUci?: string }[]
  >([]);
  const [eval_, setEval_] = useState<number>(0);
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
  const [premoveEnabled, setPremoveEnabled] = useState(true);
  const [queuedPremove, setQueuedPremove] = useState<QueuedPremove | null>(null);
  const [dailyMoveDeadlineMs, setDailyMoveDeadlineMs] = useState<number | null>(
    isDailyMode ? Date.now() + DAILY_MOVE_WINDOW_MS : null
  );
  const [dailyClockMs, setDailyClockMs] = useState<number>(DAILY_MOVE_WINDOW_MS);

  // chess.com-style dashboard UI state
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("moves");
  const [whiteClockMs, setWhiteClockMs] = useState<number>(PRACTICE_CLOCK_MS);
  const [blackClockMs, setBlackClockMs] = useState<number>(PRACTICE_CLOCK_MS);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [profile, setProfile] = useState<{
    username: string | null;
    display_name: string | null;
    rating: number | null;
    avatar_url: string | null;
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
  const gameOverActionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const lastEvalUiUpdateRef = useRef(0);

  const engineRef = useRef<StockfishEngine | null>(null);
  const gameRef = useRef(game);
  gameRef.current = game;
  const gameFen = game.fen();
  const gameTurn = game.turn();
  const gameIsOver = game.isGameOver();

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
      .select("premove_enabled, username, display_name, rating, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const enabled = data?.premove_enabled ?? true;
        setPremoveEnabled(enabled);
        localStorage.setItem(PREMOVE_STORAGE_KEY, JSON.stringify(enabled));
        if (data) {
          setProfile({
            username: data.username ?? null,
            display_name: data.display_name ?? null,
            rating: data.rating ?? null,
            avatar_url: data.avatar_url ?? null,
          });
        }
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

  // Keep eval updates active in practice mode (visible eval bar), and also when
  // coach/review requires it in other modes.
  const liveEvalNeeded = isPracticeMode || coach !== "none" || !!viewFen || !!gameOver;
  useEffect(() => {
    if (!isPracticeMode || !liveEvalNeeded) return;
    if (!engineReady || !engineRef.current || engineError) return;
    const fen = viewFen || gameFen;
    const side = new Chess(fen).turn();
    if (!viewFen && side === "b") return;
    engineRef.current.evaluate(fen, 18, (info: StockfishInfo) => {
      const now = performance.now();
      const shouldRefreshUi = now - lastEvalUiUpdateRef.current >= EVAL_UPDATE_INTERVAL_MS;
      if (!shouldRefreshUi) return;
      if (info.mate !== undefined) {
        setEval_(info.mate > 0 ? 9999 : -9999);
      } else if (info.score !== undefined) {
        setEval_(info.score);
      }
      lastEvalUiUpdateRef.current = now;
      lastEvalUiUpdateRef.current = now;
    });
  }, [gameFen, viewFen, engineReady, engineError, isPracticeMode, liveEvalNeeded]);

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

  useEffect(() => {
    if (!gameOver || game.history().length === 0) return;
    saveLatestFinishedGame({
      createdAt: Date.now(),
      pgn: game.pgn(),
      result: gameOver,
      engine: engineLabel,
    });
  }, [engineLabel, game, gameOver]);

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
      gameTurn === "b" &&
      !gameIsOver &&
      !engineThinking
    ) {
      const timer = setTimeout(makeEngineMove, ENGINE_MOVE_DELAY_MS);
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
    setCoachLine(coachOnEval(coach, eval_, null, last?.san ?? null, moveHistory.length * 13));
  }, [coach, moveHistory, eval_]);

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
    if (gameOver || viewFen) return;
    if (dragging) return; // Don't process clicks during drag

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

  const resetGame = useCallback(() => {
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
    setWhiteClockMs(PRACTICE_CLOCK_MS);
    setBlackClockMs(PRACTICE_CLOCK_MS);
    setChatMessages([]);
    clearQueuedPremove();
    if (isDailyMode) {
      setDailyMoveDeadlineMs(Date.now() + DAILY_MOVE_WINDOW_MS);
      setDailyClockMs(DAILY_MOVE_WINDOW_MS);
    }
  }, [clearQueuedPremove, isDailyMode]);

  // Navigation cursor. `currentPly` = number of plies applied in the currently
  // displayed position. When viewing the live position viewFen is null and the
  // cursor sits at the end; the start position is represented by viewFen set to
  // the initial board with historyIndex === -1.
  const totalPlies = moveHistory.length;
  const currentPly = viewFen === null ? totalPlies : historyIndex + 1;

  const goToMove = (index: number) => {
    const fullHistory = game.history();
    const replay = new Chess();
    for (let i = 0; i <= Math.min(index, fullHistory.length - 1); i++) {
      replay.move(fullHistory[i]);
    }
    setViewFen(replay.fen());
    setHistoryIndex(index);
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
    const target = currentPly + 1;
    if (target >= totalPlies) goToLast();
    else goToMove(target - 1);
  };

  const handleResign = useCallback(() => {
    if (gameOver) return;
    ChessSounds.gameOver();
    setGameOver("Black wins - White resigned.");
  }, [gameOver]);

  const handleOfferDraw = useCallback(() => {
    if (gameOver) return;
    // Versus the engine, accept the offer only in a roughly balanced position.
    if (Math.abs(eval_) <= 40) {
      ChessSounds.gameOver();
      setGameOver("Draw by agreement.");
      toast.success("Stockfish accepted your draw offer.");
    } else {
      toast.message("Stockfish declined the draw offer.");
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

  const displayFen = viewFen || game.fen();
  const displayGame = new Chess(displayFen);

  // Player banner identities. The user plays White (bottom banner); the engine
  // (or selected philosopher coach) plays Black (top banner).
  const userName =
    profile?.display_name?.trim() ||
    profile?.username?.trim() ||
    user?.email?.split("@")[0] ||
    "You";
  const userRating = profile?.rating ?? 1200;
  const opponentName = coach !== "none" ? COACHES[coach].name : "Stockfish";
  const opponentRating = difficulty.rating;
  const isLiveView = !viewFen && !gameOver;
  const userTurnActive = isLiveView && gameTurn === "w";
  const opponentTurnActive = isLiveView && gameTurn === "b";
  const userClockLabel = isDailyMode
    ? userTurnActive
      ? formatDuration(dailyClockMs)
      : "24h / move"
    : formatClock(whiteClockMs);
  const opponentClockLabel = isDailyMode
    ? opponentTurnActive
      ? formatDuration(dailyClockMs)
      : "24h / move"
    : formatClock(blackClockMs);

  const evalPawns = Math.max(-10, Math.min(10, eval_ / 100));
  const whitePercent = 50 + evalPawns * 5;

  const evalDisplay =
    Math.abs(eval_) >= 9999
      ? eval_ > 0
        ? "M" + (eval_ === 9999 ? "" : Math.abs(eval_))
        : "-M"
      : (eval_ / 100).toFixed(1);

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

  // Practice mode keeps the eval bar visible; online/daily modes hide it.
  const showEvalBar = isPracticeMode;
  return (
    <div className="flex min-h-screen flex-col bg-cc-bg text-gray-200">
      {/* Top navigation bar */}
      <nav className="border-b border-cc-border bg-cc-panel">
        <div className="mx-auto flex w-full max-w-[1280px] items-center gap-4 px-4 py-3 sm:px-6">
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
          <div className="ml-auto flex items-center gap-2">
            {isDailyMode && (
              <span className="rounded-full border border-cc-green/50 px-3 py-1 font-body text-xs text-cc-green">
                24h / move
              </span>
            )}
            <span className="rounded-full border border-cc-border px-3 py-1 font-body text-xs text-gray-400">
              {difficulty.label} (~{difficulty.rating})
            </span>
          </div>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* Left element: opponent banner, board, and user banner stacked */}
          <section className="order-1 flex flex-col items-center lg:col-span-8">
            <div className="flex w-full max-w-[640px] flex-col gap-2">
              {/* Top player banner (opponent) */}
              <div
                className={`flex items-center justify-between gap-3 rounded-md border bg-cc-panel px-3 py-2 transition-colors ${
                  opponentTurnActive ? "border-cc-green/60" : "border-cc-border"
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-black/30">
                    <Bot className="h-5 w-5 text-gray-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-body text-sm font-semibold text-gray-100">
                      {opponentName}{" "}
                      <span className="font-normal text-gray-400">({opponentRating})</span>
                    </p>
                    <p className="font-body text-xs text-gray-500">{engineLabel}</p>
                  </div>
                  {engineThinking && (
                    <Loader2 className="h-4 w-4 animate-spin text-cc-green" />
                  )}
                </div>
                {/* Opponent countdown clock */}
                <div
                  className={`rounded px-3 py-1.5 font-mono text-lg font-semibold tabular-nums ${
                    opponentTurnActive
                      ? "bg-white text-cc-bg"
                      : "bg-black/40 text-gray-400"
                  }`}
                >
                  {opponentClockLabel}
                </div>
              </div>

              {/* Eval bar + board row */}
              <div className={`flex w-full ${showEvalBar ? "gap-2" : ""}`}>
              {/* Eval bar - hidden while a game is actively in progress. */}
              {showEvalBar && (
                <div
                  data-testid="eval-bar"
                  className="relative flex w-6 flex-col-reverse overflow-hidden rounded-md border border-cc-border bg-black/40"
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
              <div className="relative flex-1 overflow-hidden rounded-md border border-cc-border shadow-elevated">
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
                              isDark ? "bg-amber-200/30" : "bg-amber-300/35"
                            }`}
                          />
                        )}

                        {/* Selected highlight */}
                        {isSelected && (
                          <div className="absolute inset-0 bg-cyan-300/30 z-10 ring-2 ring-cyan-100/50 ring-inset" />
                        )}

                        {/* Drag target highlight */}
                        {isDragTarget && (
                          <div className="absolute inset-0 bg-emerald-300/30 z-10 ring-2 ring-emerald-100/50 ring-inset" />
                        )}

                        {showAmbienceDots && (
                          <div className="absolute z-[15] flex items-center justify-center w-full h-full pointer-events-none">
                            <div className="w-[14%] h-[14%] rounded-full bg-cyan-200/30 ring-1 ring-cyan-100/20" />
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
                              <div className="w-[82%] h-[82%] rounded-full border-[5px] border-cyan-100/45" />
                            ) : (
                              <div className="w-[30%] h-[30%] rounded-full bg-cyan-100/45" />
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

                {gameOver && (
                  <div className="absolute inset-0 z-[70] flex items-center justify-center bg-background/78 p-4 backdrop-blur-md">
                    <section
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="end-game-title"
                      className="w-full max-w-md rounded-2xl border border-border/80 bg-card/95 p-5 shadow-elevated"
                    >
                      <p className="font-body text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                        Match Complete
                      </p>
                      <h2 id="end-game-title" className="mt-1 font-display text-3xl font-semibold text-foreground">
                        {gameOutcome}
                      </h2>
                      <p className="mt-2 font-body text-base font-medium text-foreground/90">{resultSummary}</p>
                      <div className="mt-5 grid gap-2">
                        <button
                          ref={(node) => {
                            gameOverActionRefs.current[0] = node;
                          }}
                          type="button"
                          onClick={handleAnalyzeAction}
                          className="group w-full rounded-lg bg-primary px-4 py-3 text-left font-body text-sm font-semibold text-primary-foreground shadow-gold transition-transform duration-150 hover:scale-[1.01] focus-visible:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                        >
                          <span className="flex items-center justify-between">
                            Game Analysis
                            <span className="text-[11px] font-mono opacity-85">A</span>
                          </span>
                        </button>
                        <button
                          ref={(node) => {
                            gameOverActionRefs.current[1] = node;
                          }}
                          type="button"
                          onClick={resetGame}
                          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-left font-body text-sm font-semibold text-foreground transition-transform duration-150 hover:scale-[1.01] hover:bg-secondary/70 focus-visible:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
                        >
                          <span className="flex items-center justify-between">
                            Rematch
                            <span className="text-[11px] font-mono text-muted-foreground">R</span>
                          </span>
                        </button>
                        <button
                          ref={(node) => {
                            gameOverActionRefs.current[2] = node;
                          }}
                          type="button"
                          onClick={handleNewOpponentAction}
                          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-left font-body text-sm font-semibold text-foreground transition-transform duration-150 hover:scale-[1.01] hover:bg-secondary/70 focus-visible:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
                        >
                          <span className="flex items-center justify-between">
                            New Opponent
                            <span className="text-[11px] font-mono text-muted-foreground">N</span>
                          </span>
                        </button>
                      </div>
                    </section>
                  </div>
                )}
              </div>
            </div>

              {/* Bottom player banner (user) */}
              <div
                className={`flex items-center justify-between gap-3 rounded-md border bg-cc-panel px-3 py-2 transition-colors ${
                  userTurnActive ? "border-cc-green/60" : "border-cc-border"
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-cc-green/20">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={userName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="h-5 w-5 text-cc-green" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-body text-sm font-semibold text-gray-100">
                      {userName}{" "}
                      <span className="font-normal text-gray-400">({userRating})</span>
                    </p>
                    <p className="font-body text-xs text-gray-500">White</p>
                  </div>
                </div>
                {/* User countdown clock - high contrast when it is your move */}
                <div
                  className={`rounded px-3 py-1.5 font-mono text-lg font-semibold tabular-nums ${
                    userTurnActive ? "bg-white text-cc-bg" : "bg-black/40 text-gray-400"
                  }`}
                >
                  {userClockLabel}
                </div>
              </div>
            </div>

            {/* Live status + engine label */}
            <div className="mt-3 w-full max-w-[640px] text-center">
              <p className="font-body text-sm font-medium text-gray-200">
                {gameOver
                  ? gameOver
                  : engineThinking
                  ? "Stockfish is thinking..."
                  : game.turn() === "w"
                  ? isDailyMode
                    ? `Your turn (Daily) - ${formatDuration(dailyClockMs)} left`
                    : "Your turn (White)"
                  : "Black to move"}
                {game.inCheck() && !gameOver && (
                  <span className="ml-2 font-semibold text-destructive">Check!</span>
                )}
              </p>
              <p className="mt-1 font-body text-xs text-gray-500">
                {engineLabel}
                {showEvalBar && ` - Eval: ${evalDisplay}`}
              </p>
              {engineError && (
                <p className="mt-2 font-body text-sm text-destructive">
                  Engine failed to load: {engineError}
                </p>
              )}
            </div>
          </section>

          {/* Right element: sidebar panel (tabs + content + controls) */}
          <aside className="order-2 lg:col-span-4">
            <div className="flex h-full flex-col overflow-hidden rounded-lg border border-cc-border bg-cc-panel lg:max-h-[calc(100vh-7rem)]">
              {/* Header tabs */}
              <div className="flex border-b border-cc-border">
                {(
                  [
                    { id: "moves", label: "Moves", icon: ListOrdered },
                    { id: "players", label: "Players", icon: Users },
                    { id: "chat", label: "Chat", icon: MessageSquare },
                  ] as const
                ).map((tab) => {
                  const isActive = sidebarTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSidebarTab(tab.id)}
                      className={`relative flex flex-1 items-center justify-center gap-2 py-3 font-body text-sm font-medium transition-colors ${
                        isActive
                          ? "text-gray-100"
                          : "text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      <tab.icon className="h-4 w-4" />
                      {tab.label}
                      {/* Active tab underline highlight */}
                      {isActive && (
                        <span className="absolute inset-x-0 bottom-0 h-0.5 bg-cc-green" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              <div className="flex min-h-[280px] flex-1 flex-col overflow-hidden">
                {/* MOVES tab: scrollable move log laid out as a turn grid */}
                {sidebarTab === "moves" && (
                  <div className="flex-1 overflow-y-auto scrollbar-hide">
                    {moveHistory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-2 py-16 text-gray-500">
                        <History className="h-8 w-8 opacity-40" />
                        <p className="font-body text-sm">No moves yet</p>
                        <p className="font-body text-xs">
                          Click or drag a piece to move!
                        </p>
                      </div>
                    ) : (
                      Array.from({
                        length: Math.ceil(moveHistory.length / 2),
                      }).map((_, i) => {
                        const whiteMove = moveHistory[i * 2];
                        const blackMove = moveHistory[i * 2 + 1];
                        return (
                          <div
                            key={i}
                            className={`grid grid-cols-[2.75rem_1fr_1fr] items-stretch ${
                              i % 2 === 0 ? "bg-black/10" : ""
                            }`}
                          >
                            <div className="flex items-center justify-center py-2 font-mono text-xs text-gray-500">
                              {i + 1}.
                            </div>
                            {renderMoveCell(whiteMove, i * 2)}
                            {renderMoveCell(blackMove, i * 2 + 1)}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* PLAYERS tab: summaries + game controls preserved from old panel */}
                {sidebarTab === "players" && (
                  <div className="flex-1 space-y-4 overflow-y-auto p-4 scrollbar-hide">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 rounded-md border border-cc-border bg-black/20 p-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-black/30">
                          <Bot className="h-5 w-5 text-gray-300" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-body text-sm font-semibold text-gray-100">
                            {opponentName}{" "}
                            <span className="font-normal text-gray-400">
                              ({opponentRating})
                            </span>
                          </p>
                          <p className="font-body text-xs text-gray-500">
                            {engineLabel} - {difficulty.label}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 rounded-md border border-cc-border bg-black/20 p-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-cc-green/20">
                          {profile?.avatar_url ? (
                            <img
                              src={profile.avatar_url}
                              alt={userName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <User className="h-5 w-5 text-cc-green" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-body text-sm font-semibold text-gray-100">
                            {userName}{" "}
                            <span className="font-normal text-gray-400">
                              ({userRating})
                            </span>
                          </p>
                          <p className="font-body text-xs text-gray-500">White</p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={resetGame}
                      className="flex w-full items-center justify-center gap-2 rounded-md border border-cc-border bg-black/20 py-3 font-body text-xs font-semibold uppercase tracking-wider text-gray-300 transition-colors hover:bg-black/40 hover:text-gray-100"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      New Game
                    </button>

                    <BoardThemeSelect />

                    {coach !== "none" && (
                      <div className="space-y-2 rounded-md border border-cc-border bg-black/20 p-4">
                        <p className="font-display text-xs font-semibold uppercase tracking-wider text-gray-100">
                          Coach - {COACHES[coach].name}
                        </p>
                        <p className="min-h-[3rem] font-body text-xs leading-relaxed text-gray-400">
                          {coachLine ||
                            "Your philosopher-coach will comment after each of your moves. Play a move to begin."}
                        </p>
                        <p className="font-body text-[10px] text-gray-500">
                          Add{" "}
                          <span className="font-mono">?coach={coach}</span> to the
                          URL to return to this guide.
                        </p>
                      </div>
                    )}

                    <div className="space-y-1 rounded-md border border-cc-border bg-black/20 p-3">
                      <p className="font-body text-[11px] uppercase tracking-wider text-gray-500">
                        Mode
                      </p>
                      <p className="font-body text-sm text-gray-200">
                        {isDailyMode ? "Daily Chess" : "Standard Practice"}
                      </p>
                      {isDailyMode && (
                        <p className="font-mono text-xs text-gray-400">
                          Time left this move: {formatDuration(dailyClockMs)}
                        </p>
                      )}
                      <p className="font-body text-xs text-gray-400">
                        Premove: {premoveEnabled ? "On" : "Off"}{" "}
                        {queuedPremove
                          ? `(queued ${queuedPremove.from}-${queuedPremove.to})`
                          : ""}
                      </p>
                    </div>
                  </div>
                )}

                {/* CHAT tab */}
                {sidebarTab === "chat" && (
                  <div className="flex flex-1 flex-col overflow-hidden">
                    <div className="flex-1 space-y-2 overflow-y-auto p-4 scrollbar-hide">
                      {chatMessages.length === 0 ? (
                        <p className="py-8 text-center font-body text-sm text-gray-500">
                          No messages yet. Say hello!
                        </p>
                      ) : (
                        chatMessages.map((m) => (
                          <div key={m.id} className="font-body text-sm">
                            <span className="font-semibold text-cc-green">
                              {m.author}:{" "}
                            </span>
                            <span className="text-gray-200">{m.text}</span>
                          </div>
                        ))
                      )}
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        sendChat();
                      }}
                      className="flex items-center gap-2 border-t border-cc-border p-3"
                    >
                      <input
                        value={chatDraft}
                        onChange={(e) => setChatDraft(e.target.value)}
                        placeholder="Send a message"
                        className="flex-1 rounded-md border border-cc-border bg-black/30 px-3 py-2 font-body text-sm text-gray-100 placeholder:text-gray-600 focus:border-cc-green focus:outline-none"
                      />
                      <button
                        type="submit"
                        aria-label="Send message"
                        className="rounded-md bg-cc-green p-2 text-white transition-colors hover:bg-cc-green-dark"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                )}
              </div>

              {/* Footer control bar */}
              <div className="space-y-2 border-t border-cc-border p-3">
                {/* History navigation utilities */}
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={goToStart}
                    disabled={currentPly === 0}
                    aria-label="First move"
                    title="First move"
                    className="flex items-center justify-center rounded-md border border-cc-border bg-black/20 py-2.5 text-gray-300 transition-colors hover:bg-black/40 hover:text-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronFirst className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={currentPly === 0}
                    aria-label="Previous move"
                    title="Previous move"
                    className="flex items-center justify-center rounded-md border border-cc-border bg-black/20 py-2.5 text-gray-300 transition-colors hover:bg-black/40 hover:text-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={goForward}
                    disabled={currentPly >= totalPlies}
                    aria-label="Next move"
                    title="Next move"
                    className="flex items-center justify-center rounded-md border border-cc-border bg-black/20 py-2.5 text-gray-300 transition-colors hover:bg-black/40 hover:text-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={goToLast}
                    disabled={currentPly >= totalPlies}
                    aria-label="Last move"
                    title="Last move"
                    className="flex items-center justify-center rounded-md border border-cc-border bg-black/20 py-2.5 text-gray-300 transition-colors hover:bg-black/40 hover:text-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLast className="h-4 w-4" />
                  </button>
                </div>
                {/* Major game actions */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleOfferDraw}
                    disabled={!!gameOver}
                    className="flex items-center justify-center gap-2 rounded-md border border-cc-border bg-black/20 py-2.5 font-body text-sm font-medium text-gray-200 transition-colors hover:bg-black/40 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Handshake className="h-4 w-4" />
                    Offer Draw
                  </button>
                  <button
                    type="button"
                    onClick={handleResign}
                    disabled={!!gameOver}
                    className="flex items-center justify-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 py-2.5 font-body text-sm font-medium text-destructive transition-colors hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Flag className="h-4 w-4" />
                    Resign
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default Game;
