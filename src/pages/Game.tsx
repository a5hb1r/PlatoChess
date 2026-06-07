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
  Trophy,
  Lock,
  FlipVertical2,
  Download,
  Copy,
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
import { GameSettingsMenu } from "@/components/GameSettingsMenu";
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
  coachOnMoveRating,
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
import { useProfile } from "@/hooks/use-profile";
import { useTheme } from "@/contexts/ThemeContext";
import { getBotById, isBotUnlocked } from "@/lib/bots";
import {
  getPersonality,
  getBotLine,
  pickDialogueForMove,
  pickTaunt,
  type BotPersonality,
} from "@/lib/bot-personalities";
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


const DAILY_MOVE_WINDOW_MS = 24 * 60 * 60 * 1000;
const PREMOVE_STORAGE_KEY = "plato:premove-enabled";
const PREMOVE_QUEUE_STORAGE_KEY = "plato:queued-premove";
type QueuedPremove = {
  from: Square;
  to: Square;
  promotion?: string;
};

type GameMode = "practice" | "daily" | "online";
type BotMsg = { id: number; text: string; isBot: boolean };

function parseGameMode(raw: string | null): GameMode {
  const r = (raw || "").toLowerCase();
  if (r === "daily") return "daily";
  if (r === "online") return "online";
  return "practice";
}

function parseCoachId(raw: string | null): CoachId {
  const r = (raw || "").toLowerCase();
  if (!r || r === "none") return "none";
  if (r in COACHES) return r as CoachId;
  return "none";
}

// Helper to get square from mouse/touch position relative to board.
function getSquareFromPoint(boardEl: HTMLElement, clientX: number, clientY: number, flipped = false): Square | null {
  const rect = boardEl.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const col = Math.floor((x / rect.width) * 8);
  const row = Math.floor((y / rect.height) * 8);
  if (col < 0 || col > 7 || row < 0 || row > 7) return null;
  const fc = flipped ? 7 - col : col;
  const fr = flipped ? 7 - row : row;
  return `${String.fromCharCode(97 + fc)}${8 - fr}` as Square;
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
  const { isPro, isMaster, loading: profileLoading } = useProfile();
  const { showValidMoves } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const difficultyParam = parseInt(searchParams.get("level") || "2");
  const modeParam = (searchParams.get("mode") || "practice").toLowerCase();
  const isPracticeMode = modeParam !== "online";

  // Named-bot support: override skill/depth from URL params when a bot is specified
  const botId = searchParams.get("bot");
  const namedBot = botId ? getBotById(botId) : null;
  const baseLevel = DIFFICULTY_LEVELS[Math.min(difficultyParam, DIFFICULTY_LEVELS.length - 1)];
  const skillOverride = searchParams.get("skill");
  const depthOverride = searchParams.get("depth");
  const difficulty = namedBot
    ? { ...baseLevel, skill: namedBot.skill, depth: namedBot.depth, label: namedBot.name, rating: namedBot.ratingLabel }
    : skillOverride && depthOverride
      ? { ...baseLevel, skill: parseInt(skillOverride), depth: parseInt(depthOverride) }
      : baseLevel;

  const coach = parseCoachId(searchParams.get("coach"));
  const mode = parseGameMode(searchParams.get("mode"));
  const isDailyMode = mode === "daily";
  const [coachLine, setCoachLine] = useState<string | null>(null);

  // Named-bot personality dialogue
  const botPersonality: BotPersonality | null = namedBot ? getPersonality(namedBot.id) : null;
  const [botMessages, setBotMessages] = useState<BotMsg[]>([]);
  const prevEvalRef = useRef<number>(0);
  const botMessageEndRef = useRef<HTMLDivElement>(null);

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

  // Board orientation
  const [boardFlipped, setBoardFlipped] = useState(false);

  // Premove state
  const [premoveEnabled, setPremoveEnabled] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem(PREMOVE_STORAGE_KEY) ?? "true"); } catch { return true; }
  });
  const [queuedPremove, setQueuedPremove] = useState<QueuedPremove | null>(() => {
    try { const s = localStorage.getItem(PREMOVE_QUEUE_STORAGE_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
  });

  // Player ELO (loaded from profile)
  const [playerElo, setPlayerElo] = useState<number>(1200);

  // Daily mode deadline
  const [dailyMoveDeadlineMs, setDailyMoveDeadlineMs] = useState<number | null>(null);

  // Post-game review state
  const [reviewReady, setReviewReady] = useState(false);
  const [reviewingGame, setReviewingGame] = useState(false);
  const [reviewProgress, setReviewProgress] = useState(0);
  const [reviewSummary, setReviewSummary] = useState<string | null>(null);

  // Daily mode per-move clock display (ms remaining for current move)
  const [dailyClockMs, setDailyClockMs] = useState<number>(DAILY_MOVE_WINDOW_MS);

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

  // Clock direction: useChessClock hook handles the per-player countdown.
  // setActive controls whose side is ticking.
  useEffect(() => {
    if (isDailyMode || gameOver || gameIsOver) {
      setRunning(false);
    } else {
      setActive(gameTurn === "w" ? "white" : "black");
      setRunning(!viewFen);
    }
  }, [gameTurn, gameOver, gameIsOver, isDailyMode, viewFen, setActive, setRunning]);

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

  useEffect(() => {
    if (!isPracticeMode || !engineReady || !engineRef.current || engineError) return;
    const fen = viewFen || gameFen;
    const side = new Chess(fen).turn();
    if (!viewFen && side === "b") return;
    engineRef.current.evaluate(fen, 18, (info: StockfishInfo) => {
      const now = performance.now();
      const shouldRefreshUi = now - lastEvalUiUpdateRef.current >= EVAL_UPDATE_INTERVAL_MS;
      if (!shouldRefreshUi) return;
      if (info.depth !== undefined) setEvalDepth(info.depth);
      if (info.mate !== undefined) {
        setEvalMate(info.mate);
        setEval_(info.mate > 0 ? 2000 : -2000);
      } else if (info.score !== undefined) {
        setEvalMate(null);
        setEval_(info.score);
      }
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

  // ── Bot personality dialogue ─────────────────────────────────────────────
  const addBotMsg = useCallback((text: string, isBot = true) => {
    if (!text) return;
    setBotMessages((prev) => [...prev, { id: Date.now() + Math.random(), text, isBot }]);
  }, []);

  // Greeting when game starts
  useEffect(() => {
    if (!botPersonality) return;
    const greeting = getBotLine(botPersonality, "greeting", Math.floor(Math.random() * 1000));
    addBotMsg(greeting);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!botPersonality]);

  // React to every move (both player and bot)
  useEffect(() => {
    if (!botPersonality || moveHistory.length === 0) return;
    const n = moveHistory.length;
    const playerJustMoved = n % 2 === 1; // odd half-moves = white (player) just moved
    const evalDelta = eval_ - prevEvalRef.current;
    prevEvalRef.current = eval_;
    const last = moveHistory[n - 1];
    const seed = n * 17 + Math.abs(evalDelta | 0);
    const text = pickDialogueForMove(
      botPersonality,
      playerJustMoved,
      evalDelta,
      n,
      last?.rating?.label,
      eval_
    );
    addBotMsg(text);

    // Occasional taunt every ~6 moves
    if (n > 4 && n % 6 === 0) {
      const taunt = pickTaunt(botPersonality, eval_, seed);
      setTimeout(() => addBotMsg(taunt), 1200);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveHistory.length]);

  // Game over message
  useEffect(() => {
    if (!botPersonality || !gameOver) return;
    let moment: "win" | "loss" | "draw" = "draw";
    if (gameOver.toLowerCase().includes("white wins")) moment = "loss"; // bot wins = player loses
    else if (gameOver.toLowerCase().includes("black wins")) moment = "win"; // player wins = bot loses
    const text = getBotLine(botPersonality, moment, Date.now());
    addBotMsg(text);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver]);

  // Auto-scroll bot chat
  useEffect(() => {
    botMessageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [botMessages]);
  // ────────────────────────────────────────────────────────────────────────

  const downloadPgn = useCallback(() => {
    const pgn = game.pgn() || "*";
    const blob = new Blob([pgn], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "platochess-game.pgn";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("PGN downloaded.");
  }, [game]);

  const copyPgn = useCallback(() => {
    const pgn = game.pgn() || "*";
    navigator.clipboard.writeText(pgn).then(
      () => toast.success("PGN copied to clipboard."),
      () => toast.error("Clipboard not available.")
    );
  }, [game]);

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
      if (boardRef.current) setDragOver(getSquareFromPoint(boardRef.current, clientX, clientY, boardFlipped));
    };

    const handleEnd = (e: MouseEvent | TouchEvent) => {
      if (!dragging || !boardRef.current) {
        setDragging(null);
        setDragOver(null);
        return;
      }
      const clientX = "changedTouches" in e ? e.changedTouches[0].clientX : e.clientX;
      const clientY = "changedTouches" in e ? e.changedTouches[0].clientY : e.clientY;
      const targetSquare = getSquareFromPoint(boardRef.current, clientX, clientY, boardFlipped);

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
  }, [resetClock]);

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
    if (game.history().length === 0) return;
    setViewFen(new Chess().fen());
    setHistoryIndex(-1);
  };

  const goToLast = () => {
    setViewFen(null);
    setHistoryIndex(-1);
  };

  const goBack = () => {
    const totalPlies = game.history().length;
    const currentPly = historyIndex === -1 ? totalPlies : historyIndex + 1;
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

  // Bot tier gate — show upgrade screen if the named bot requires a higher tier
  if (
    !import.meta.env.DEV &&
    !profileLoading &&
    namedBot &&
    !isBotUnlocked(namedBot, isPro, isMaster)
  ) {
    const tierLabel = namedBot.tier === "master" ? "Master" : "Pro";
    const tierPrice = namedBot.tier === "master" ? "$19/mo" : "$9/mo";
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <nav className="border-b border-border/50 bg-background/80 backdrop-blur-md">
          <div className="container mx-auto flex items-center gap-4 px-6 py-4">
            <button
              type="button"
              onClick={() => navigate("/bots")}
              className="flex items-center gap-2 font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Bots
            </button>
          </div>
        </nav>
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-sm">
            <div className="text-5xl mb-5">{namedBot.emoji}</div>
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-secondary mb-4 mx-auto">
              <Lock className="h-6 w-6 text-foreground/60" />
            </div>
            <h2 className="font-display text-2xl font-bold mb-2">
              {namedBot.name} requires {tierLabel}
            </h2>
            <p className="font-body text-muted-foreground mb-2 leading-relaxed">
              "{namedBot.quote}"
            </p>
            <p className="font-body text-sm text-muted-foreground mb-8">
              Upgrade to {tierLabel} ({tierPrice}) to challenge {namedBot.name} and {namedBot.tier === "master" ? "7 other bots" : "5 other bots"}.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/pricing"
                className="bg-primary px-8 py-3 rounded-md font-body text-sm font-semibold text-primary-foreground shadow-gold transition-transform hover:scale-[1.02]"
              >
                Upgrade to {tierLabel} — {tierPrice}
              </Link>
              <button
                type="button"
                onClick={() => navigate("/bots")}
                className="border border-border px-8 py-3 rounded-md font-body text-sm font-medium text-foreground hover:bg-secondary transition-colors"
              >
                Choose another bot
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
                      const fc = boardFlipped ? 7 - col : col;
                      const fr = boardFlipped ? 7 - row : row;
                      const square = `${String.fromCharCode(97 + fc)}${8 - fr}` as Square;
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
                              {boardFlipped ? fr + 1 : 8 - fr}
                            </span>
                          )}
                          {row === 7 && (
                            <span
                              className={`absolute bottom-0 right-1 z-10 text-[9px] font-bold ${
                                isDark ? "text-chess-light/80" : "text-chess-dark/80"
                              }`}
                            >
                              {String.fromCharCode(97 + fc)}
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
                        className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background/92 backdrop-blur-md px-6"
                      >
                        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }}>
                          <Trophy className={`h-14 w-14 ${gameOver.startsWith("White wins") ? "text-amber-400" : gameOver.startsWith("Black wins") ? "text-rose-400" : "text-foreground/50"}`} />
                        </motion.div>
                        <p className="font-display text-2xl font-bold text-foreground">{gameOutcome}</p>
                        <p className="font-body text-sm text-muted-foreground text-center leading-relaxed">{gameOver}</p>
                        <div className="flex items-center gap-2 flex-wrap justify-center mt-1">
                          <span className="rounded-full bg-secondary/80 border border-border px-3 py-1 font-body text-xs text-muted-foreground">
                            {game.history().length} moves
                          </span>
                          {resultSummary && (
                            <span className={`rounded-full border px-3 py-1 font-body text-xs font-semibold ${eloPulse > 0 ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : eloPulse < 0 ? "bg-rose-500/15 border-rose-500/30 text-rose-400" : "bg-secondary/80 border-border text-muted-foreground"}`}>
                              {resultSummary}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                          <button
                            onClick={async () => {
                              markAnalysisTransitionStart();
                              if (!reviewReady && !reviewingGame) void analyzeFinishedGame();
                              navigate("/analyze-game");
                            }}
                            disabled={reviewingGame || !engineReady || !!engineError}
                            className="flex items-center gap-2 rounded-lg border border-border bg-card/90 px-5 py-2.5 font-body text-sm font-semibold text-foreground transition-all hover:bg-secondary hover:scale-[1.02] disabled:opacity-50"
                            ref={(el) => { gameOverActionRefs.current[0] = el; }}
                          >
                            <BarChart3 className="h-4 w-4" />
                            {reviewingGame ? `Analyzing ${reviewProgress}/${game.history().length}` : "Analyze"}
                          </button>
                          <button
                            onClick={resetGame}
                            className="rounded-lg bg-primary px-7 py-2.5 font-body text-sm font-semibold text-primary-foreground shadow-gold transition-all hover:scale-[1.04]"
                            ref={(el) => { gameOverActionRefs.current[1] = el; }}
                          >
                            Play Again
                          </button>
                          <button
                            onClick={() => navigate("/play")}
                            className="rounded-lg border border-border bg-card/90 px-5 py-2.5 font-body text-sm font-semibold text-foreground transition-all hover:bg-secondary hover:scale-[1.02]"
                            ref={(el) => { gameOverActionRefs.current[2] = el; }}
                          >
                            New Opponent
                          </button>
                          <button
                            onClick={copyPgn}
                            className="flex items-center gap-1.5 rounded-lg border border-border bg-card/90 px-5 py-2.5 font-body text-sm font-medium text-muted-foreground transition-all hover:bg-secondary hover:text-foreground hover:scale-[1.02]"
                            title="Copy game PGN"
                          >
                            <Copy className="h-4 w-4" />
                            PGN
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
              <div className="mt-2 flex w-full items-stretch gap-1.5">
                <button
                  onClick={goToStart}
                  className="rounded-lg border border-border bg-card p-2.5 transition-colors hover:bg-secondary"
                  aria-label="Go to start"
                  title="First move"
                >
                  <ChevronFirst className="h-4 w-4 text-muted-foreground" />
                </button>
                <button
                  onClick={goBack}
                  className="rounded-lg border border-border bg-card p-2.5 transition-colors hover:bg-secondary"
                  aria-label="Previous move"
                  title="Previous move"
                >
                  <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                </button>
                <div className="flex flex-1 items-center justify-center rounded-lg border border-border bg-card px-3 font-body text-sm font-medium text-foreground text-center min-w-0 truncate">
                  {statusText}
                  {displayGame.inCheck() && !gameOver && <span className="ml-2 font-semibold text-destructive shrink-0">Check!</span>}
                </div>
                <button
                  onClick={goForward}
                  className="rounded-lg border border-border bg-card p-2.5 transition-colors hover:bg-secondary"
                  aria-label="Next move"
                  title="Next move"
                >
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
                <button
                  onClick={goToLast}
                  className="rounded-lg border border-border bg-card p-2.5 transition-colors hover:bg-secondary"
                  aria-label="Go to end"
                  title="Last move"
                >
                  <ChevronLast className="h-4 w-4 text-muted-foreground" />
                </button>
                <button
                  onClick={resetGame}
                  className="rounded-lg border border-border bg-card p-2.5 transition-colors hover:bg-secondary"
                  aria-label="New game"
                  title="New game"
                >
                  <RotateCcw className="h-4 w-4 text-muted-foreground" />
                </button>
                <button
                  onClick={() => setBoardFlipped((f) => !f)}
                  className={`rounded-lg border p-2.5 transition-colors ${boardFlipped ? "border-primary/60 bg-primary/10 text-primary" : "border-border bg-card hover:bg-secondary text-muted-foreground"}`}
                  aria-label="Flip board"
                  title="Flip board"
                >
                  <FlipVertical2 className="h-4 w-4" />
                </button>
              </div>

              {engineError && (
                <p className="mt-2 text-center font-body text-sm text-destructive">Engine failed to load: {engineError}</p>
              )}
            </div>
          </div>

          {/* ===== Unified sidebar (≈35%) ===== */}
          <div className="order-2 w-full space-y-3 lg:flex-1">
            {/* Board controls + live analysis row */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-cc-green" />
                  <span className="font-body text-xs font-semibold text-foreground/80 uppercase tracking-wider">Live Analysis</span>
                </div>
                <span className="font-mono text-xs text-foreground font-semibold">
                  {evalText} <span className="text-muted-foreground font-normal">· d{evalDepth}</span>
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/50 px-3 py-2 mb-2">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-foreground/80" />
                  <div>
                    <p className="font-body text-sm font-semibold text-foreground">Tactical Foresight</p>
                    <p className="font-body text-[11px] text-muted-foreground">Hover pieces to map threats &amp; pins</p>
                  </div>
                </div>
                <Switch checked={foresightOn} onCheckedChange={setForesightOn} aria-label="Toggle Tactical Foresight" />
              </div>

              {foresightOn && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-body text-[11px] text-muted-foreground mb-2">
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

              <div className="mt-2 flex items-center justify-between">
                <GameSettingsMenu />
              </div>
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
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 font-body text-sm font-semibold text-primary-foreground shadow-gold transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                >
                  {reviewingGame ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Reviewing {reviewProgress}/{game.history().length}…
                    </>
                  ) : (
                    <>
                      <BarChart3 className="h-4 w-4" />
                      Analyze Game
                    </>
                  )}
                </button>
                {!reviewReady && !reviewingGame && (
                  <p className="font-body text-[11px] text-muted-foreground text-center">
                    Move ratings reveal after analysis — just like Chess.com
                  </p>
                )}
                {reviewSummary && (
                  <div className="rounded-lg bg-secondary/50 border border-border px-3 py-2">
                    <p className="font-body text-[11px] leading-relaxed text-foreground/80">{reviewSummary}</p>
                  </div>
                )}
                {reviewReady && (
                  <button
                    onClick={() => {
                      markAnalysisTransitionStart();
                      navigate("/analyze-game");
                    }}
                    className="w-full rounded-lg border border-border py-2.5 font-body text-sm font-semibold text-foreground transition-all hover:bg-secondary"
                  >
                    Open Full Review →
                  </button>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={downloadPgn}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card py-2 font-body text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary"
                    title="Download PGN file"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download PGN
                  </button>
                  <button
                    onClick={copyPgn}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card py-2 font-body text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary"
                    title="Copy PGN to clipboard"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy PGN
                  </button>
                </div>
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

            {/* Bot personality chat panel */}
            {botPersonality && (
              <div className="rounded-lg border border-border bg-card flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border bg-secondary/40">
                  <span className="text-xl leading-none">{namedBot?.emoji}</span>
                  <div>
                    <p className="font-display text-sm font-semibold text-foreground leading-none">
                      {botPersonality.displayName}
                    </p>
                    <p className="font-body text-[10px] text-muted-foreground mt-0.5">
                      {botPersonality.tagline}
                    </p>
                  </div>
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                    {namedBot?.ratingLabel}
                  </span>
                </div>

                {/* Messages */}
                <div className="flex flex-col gap-2 p-3 max-h-52 overflow-y-auto">
                  {botMessages.length === 0 && (
                    <p className="font-body text-xs text-muted-foreground italic text-center py-3">
                      {botPersonality.displayName} is thinking…
                    </p>
                  )}
                  {botMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.isBot ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`max-w-[90%] rounded-lg px-3 py-2 font-body text-xs leading-relaxed ${
                          msg.isBot
                            ? "bg-secondary text-foreground rounded-tl-none"
                            : "bg-primary text-primary-foreground rounded-tr-none"
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  <div ref={botMessageEndRef} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;
