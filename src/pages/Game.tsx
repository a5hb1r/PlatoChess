import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from "react";
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
import { isBookMove, probeResultToCp, rateMoveLikeChessCom } from "@/lib/move-rating";
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
  appendToGameHistory,
  updateGameHistoryAccuracy,
  type ReviewedPly,
} from "@/lib/game-review";
import { estimateGameRating } from "@/lib/game-rating";
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
import { PhilosopherAvatar } from "@/components/chess/PhilosopherAvatar";
import { BoardArrows, type BoardArrow } from "@/components/chess/BoardArrows";
import { supabase } from "@/integrations/supabase/client";
import { countryFlag } from "@/lib/countries";
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

type GameMode = "practice" | "daily" | "online" | "casual" | "friend";
type BotMsg = { id: number; text: string; isBot: boolean };

function parseGameMode(raw: string | null): GameMode {
  const r = (raw || "").toLowerCase();
  if (r === "daily") return "daily";
  if (r === "online") return "online";
  if (r === "casual") return "casual";
  if (r === "friend") return "friend";
  return "practice";
}

// ── Casual mode — any ELO, unrated ────────────────────────────────────────────
// Maps a requested ELO to Stockfish skill/depth by interpolating between the
// same anchor points used for the named difficulty levels.
const CASUAL_ELO_MIN = 250;
const CASUAL_ELO_MAX = 2300;
const CASUAL_ANCHORS = [
  { elo: 250, skill: 0, depth: 2 },
  { elo: 500, skill: 2, depth: 3 },
  { elo: 850, skill: 4, depth: 5 },
  { elo: 1150, skill: 7, depth: 7 },
  { elo: 1500, skill: 10, depth: 9 },
  { elo: 1850, skill: 14, depth: 12 },
  { elo: 2100, skill: 17, depth: 14 },
  { elo: 2300, skill: 20, depth: 16 },
] as const;

function clampCasualElo(raw: number): number {
  if (!Number.isFinite(raw)) return 800;
  return Math.round(Math.max(CASUAL_ELO_MIN, Math.min(CASUAL_ELO_MAX, raw)));
}

function casualEngineParams(elo: number): { skill: number; depth: number } {
  for (let i = 1; i < CASUAL_ANCHORS.length; i++) {
    if (elo <= CASUAL_ANCHORS[i].elo) {
      const lo = CASUAL_ANCHORS[i - 1];
      const hi = CASUAL_ANCHORS[i];
      const t = (elo - lo.elo) / (hi.elo - lo.elo);
      return {
        skill: Math.round(lo.skill + t * (hi.skill - lo.skill)),
        depth: Math.round(lo.depth + t * (hi.depth - lo.depth)),
      };
    }
  }
  return { skill: 20, depth: 16 };
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
  const { profile, isPro, isMaster, loading: profileLoading } = useProfile();
  const { showValidMoves } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const difficultyParam = parseInt(searchParams.get("level") || "2");
  const mode = parseGameMode(searchParams.get("mode"));
  const isDailyMode = mode === "daily";
  const isCasualMode = mode === "casual";
  const isFriendMode = mode === "friend";
  /** Stockfish plays Black in every mode except local pass-and-play. */
  const isEngineOpponent = !isFriendMode;
  /** Live eval bar/readout — hidden online and in pass-and-play (it would spoil a human game). */
  const showLiveEval = mode !== "online" && !isFriendMode;

  // Named-bot support: override skill/depth from URL params when a bot is specified
  const botId = searchParams.get("bot");
  const namedBot = botId ? getBotById(botId) : null;
  const baseLevel = DIFFICULTY_LEVELS[Math.min(difficultyParam, DIFFICULTY_LEVELS.length - 1)];
  const skillOverride = searchParams.get("skill");
  const depthOverride = searchParams.get("depth");
  const casualElo = isCasualMode ? clampCasualElo(Number(searchParams.get("elo") || "800")) : null;
  const difficulty = casualElo !== null
    ? { label: "Casual", rating: `~${casualElo}`, ...casualEngineParams(casualElo) }
    : namedBot
      ? { ...baseLevel, skill: namedBot.skill, depth: namedBot.depth, label: namedBot.name, rating: namedBot.ratingLabel }
      : skillOverride && depthOverride
        ? { ...baseLevel, skill: parseInt(skillOverride), depth: parseInt(depthOverride) }
        : baseLevel;

  const coach = parseCoachId(searchParams.get("coach"));
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

  // Drag state. The pointer position deliberately lives OUTSIDE React state —
  // updating it per mousemove would re-render the whole board ~60×/s and make
  // the drag stutter. The ghost element is positioned directly via rAF.
  const [dragging, setDragging] = useState<{
    square: Square;
    piece: { color: string; type: string };
  } | null>(null);
  const [dragOver, setDragOver] = useState<Square | null>(null);
  const dragPosRef = useRef({ x: 0, y: 0 });
  const dragGhostRef = useRef<HTMLDivElement>(null);
  const dragGhostSizeRef = useRef(72);
  const dragRafRef = useRef(0);

  const positionDragGhost = useCallback(() => {
    const el = dragGhostRef.current;
    if (!el) return;
    const half = dragGhostSizeRef.current / 2;
    el.style.transform = `translate(${dragPosRef.current.x - half}px, ${dragPosRef.current.y - half}px)`;
  }, []);

  // ── User annotations — chess.com-style right-click arrows & highlights ────
  // Right-drag draws an arrow, right-click marks a square; modifier keys pick
  // the color (Shift=green, Ctrl=red, Alt=blue). Left click clears everything.
  const [userArrows, setUserArrows] = useState<BoardArrow[]>([]);
  const [userHighlights, setUserHighlights] = useState<{ square: Square; color: string }[]>([]);
  const [drawStart, setDrawStart] = useState<Square | null>(null);
  const [drawPreview, setDrawPreview] = useState<Square | null>(null);

  const clearAnnotations = useCallback(() => {
    setUserArrows((prev) => (prev.length ? [] : prev));
    setUserHighlights((prev) => (prev.length ? [] : prev));
  }, []);

  // Board orientation
  const [boardFlipped, setBoardFlipped] = useState(false);

  // Commit/preview right-click drawings (declared after boardFlipped — the
  // handlers map pointer coordinates through the current orientation).
  useEffect(() => {
    if (!drawStart) return;

    const annotationColor = (e: { shiftKey: boolean; ctrlKey: boolean; altKey: boolean }) =>
      e.shiftKey ? "#81b64c" : e.ctrlKey ? "#f42a32" : e.altKey ? "#52aeff" : "#ffaa00";

    const handleMove = (e: MouseEvent) => {
      if (!boardRef.current) return;
      const sq = getSquareFromPoint(boardRef.current, e.clientX, e.clientY, boardFlipped);
      setDrawPreview((prev) => (prev === sq ? prev : sq));
    };

    const handleUp = (e: MouseEvent) => {
      if (e.button !== 2) return;
      const start = drawStart;
      setDrawStart(null);
      setDrawPreview(null);
      if (!boardRef.current) return;
      const target = getSquareFromPoint(boardRef.current, e.clientX, e.clientY, boardFlipped);
      if (!target) return;
      const color = annotationColor(e);

      if (target === start) {
        // Toggle a square highlight (same color removes, new color recolors).
        setUserHighlights((prev) => {
          const existing = prev.find((h) => h.square === start);
          if (existing && existing.color === color) return prev.filter((h) => h.square !== start);
          return [...prev.filter((h) => h.square !== start), { square: start, color }];
        });
      } else {
        // Toggle an arrow.
        setUserArrows((prev) => {
          const existing = prev.find((a) => a.from === start && a.to === target);
          if (existing && existing.color === color) {
            return prev.filter((a) => a !== existing);
          }
          return [
            ...prev.filter((a) => !(a.from === start && a.to === target)),
            { from: start, to: target, color, opacity: 0.85 },
          ];
        });
      }
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [drawStart, boardFlipped]);

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
  // Pending piece-slide animation (chess.com-style). Set by non-drag moves
  // (click, engine, premove); consumed once by the layout effect below. Drag
  // moves leave this null because the piece already moved under the pointer.
  const pendingSlideRef = useRef<{ from: Square; to: Square } | null>(null);
  // Stable ID for this game session — used to correlate the history entry when
  // accuracy data is added later during the review step.
  const gameHistoryIdRef = useRef<string>(`game-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const engineRef = useRef<StockfishEngine | null>(null);
  const gameRef = useRef(game);
  gameRef.current = game;
  const gameFen = game.fen();
  const gameTurn = game.turn();
  const gameIsOver = game.isGameOver();

  const displayFen = viewFen || game.fen();
  const displayGame = useMemo(() => new Chess(displayFen), [displayFen]);

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
      setActive(gameTurn);
      setRunning(!viewFen);
    }
  }, [gameTurn, gameOver, gameIsOver, isDailyMode, viewFen, setActive, setRunning]);

  // Pass & Play: running out of time ends the game (vs the engine the clock is
  // cosmetic, but between two humans the flag must be decisive).
  useEffect(() => {
    if (!isFriendMode || gameOver || !flagged) return;
    setGameOver(flagged === "w" ? "Black wins on time!" : "White wins on time!");
    ChessSounds.gameOver();
  }, [flagged, gameOver, isFriendMode]);

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
    if (!showLiveEval || !engineReady || !engineRef.current || engineError) return;
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
  }, [gameFen, viewFen, engineReady, engineError, showLiveEval]);

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
    const now = Date.now();
    saveLatestFinishedGame({
      createdAt: now,
      pgn: game.pgn(),
      result: gameOver,
      engine: engineLabel,
    });

    // Derive a canonical outcome for the history entry.
    const resultOutcome: "win" | "loss" | "draw" =
      gameOver.startsWith("White wins") ? "win"
      : gameOver.startsWith("Black wins") ? "loss"
      : "draw";

    appendToGameHistory({
      id: gameHistoryIdRef.current,
      createdAt: now,
      opponent: isFriendMode
        ? "Pass & Play"
        : namedBot
          ? namedBot.name
          : `Stockfish ${difficulty.label}`,
      result: resultOutcome,
      resultDetail: gameOver,
      moveCount: game.history().length,
      accuracy: null,
      pgn: game.pgn(),
    }, user?.id);
  }, [engineLabel, game, gameOver, difficulty.label, namedBot, user?.id, isFriendMode]);

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
        pendingSlideRef.current = { from, to }; // slide the engine's reply in
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
    if (isEngineOpponent && engineReady && !engineError && game.turn() === "b" && !game.isGameOver() && !engineThinking) {
      const timer = setTimeout(makeEngineMove, 320);
      return () => clearTimeout(timer);
    }
  }, [gameTurn, gameIsOver, engineReady, engineError, engineThinking, makeEngineMove, isEngineOpponent, game]);

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
    (from: Square, to: Square, promotion?: string, animate = true) => {
      const mover = game.turn();
      const g = new Chess(game.fen());
      const result = g.move({ from, to, promotion: (promotion || undefined) as PieceSymbol | undefined });

      if (result) {
        playMoveSound(result, g.isCheck());
        applyIncrement(mover);
        // Drag moves already travelled under the pointer — only click/engine
        // moves get the slide animation.
        if (animate) pendingSlideRef.current = { from, to };
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

  // chess.com-style slide: after a non-drag move lands, start the moved piece
  // at its origin square and transition it home. Runs before paint so there's
  // no flash of the piece at its destination.
  useLayoutEffect(() => {
    const slide = pendingSlideRef.current;
    pendingSlideRef.current = null;
    if (!slide || !boardRef.current || viewFen) return;

    const board = boardRef.current;
    const node = board.querySelector<HTMLElement>(`[data-square="${slide.to}"] img`);
    if (!node) return;

    const squarePx = board.getBoundingClientRect().width / 8;
    const visual = (sq: Square) => {
      let col = sq.charCodeAt(0) - 97;
      let row = 8 - Number(sq[1]);
      if (boardFlipped) {
        col = 7 - col;
        row = 7 - row;
      }
      return { col, row };
    };
    const f = visual(slide.from);
    const t = visual(slide.to);
    const dx = (f.col - t.col) * squarePx;
    const dy = (f.row - t.row) * squarePx;
    if (dx === 0 && dy === 0) return;

    node.style.transition = "none";
    node.style.transform = `translate(${dx}px, ${dy}px)`;
    node.getBoundingClientRect(); // force reflow so the starting offset commits
    requestAnimationFrame(() => {
      node.style.transition = "transform 0.18s cubic-bezier(0.22, 1, 0.36, 1)";
      node.style.transform = "translate(0px, 0px)";
      const clear = () => {
        node.style.transition = "";
        node.style.transform = "";
        node.removeEventListener("transitionend", clear);
      };
      node.addEventListener("transitionend", clear);
    });
  }, [moveHistory.length, viewFen, boardFlipped]);

  useEffect(() => {
    if (!queuedPremove || !isEngineOpponent || game.turn() !== "w" || engineThinking || gameOver || !premoveEnabled) return;

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
    isEngineOpponent,
  ]);

  useEffect(() => {
    if (!isDailyMode || gameOver) return;
    if (game.turn() === "w") {
      toast.message("Daily mode: your move window has started.");
    }
  }, [gameTurn, gameOver, isDailyMode, game]);

  // Which color the human at the board may pick up right now. Vs the engine the
  // human is always White; in pass-and-play both players share the device, so
  // it is whoever's turn it is.
  const movableColor: Color = isFriendMode ? game.turn() : "w";

  const handleSquareClick = (square: Square) => {
    clearAnnotations(); // chess.com behavior: any left click wipes drawings
    if (gameOver || viewFen || dragging) return;

    const piece = game.get(square);

    // Engine is thinking (Black's turn): clicks queue a premove instead.
    if (isEngineOpponent && game.turn() !== "w") {
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

    if (piece && piece.color === movableColor) {
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
    if ("button" in e && e.button !== 0) return; // only left button drags pieces
    clearAnnotations();
    if ((isEngineOpponent && game.turn() !== "w") || engineThinking || gameOver || viewFen) return;
    const piece = game.get(square);
    if (!piece || piece.color !== movableColor) return;

    e.preventDefault();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    // Ghost matches the live square size so the piece doesn't jump scale.
    if (boardRef.current) {
      dragGhostSizeRef.current = boardRef.current.getBoundingClientRect().width / 8;
    }
    dragPosRef.current = { x: clientX, y: clientY };
    setDragging({ square, piece: { color: piece.color, type: piece.type } });
    setSelectedSquare(square);
    const moves = game.moves({ square, verbose: true });
    setValidMoves(moves.map((m) => m.to as Square));
  };

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      // Stop the page from scrolling underneath the piece on touch devices —
      // the board must feel pinned while a drag is in progress.
      if ("touches" in e && e.cancelable) e.preventDefault();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      dragPosRef.current = { x: clientX, y: clientY };

      // Batch DOM work to one frame: move the ghost directly (no re-render)
      // and only touch React state when the hovered square actually changes.
      if (!dragRafRef.current) {
        dragRafRef.current = requestAnimationFrame(() => {
          dragRafRef.current = 0;
          positionDragGhost();
          if (boardRef.current) {
            const sq = getSquareFromPoint(
              boardRef.current,
              dragPosRef.current.x,
              dragPosRef.current.y,
              boardFlipped
            );
            setDragOver((prev) => (prev === sq ? prev : sq));
          }
        });
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
          executeMove(dragging.square, targetSquare, undefined, false); // no slide: already dragged
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
    window.addEventListener("touchcancel", handleEnd);

    return () => {
      if (dragRafRef.current) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = 0;
      }
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
      window.removeEventListener("touchcancel", handleEnd);
    };
  }, [dragging, executeMove, game, validMoves, boardFlipped, positionDragGhost]);

  const resetGame = useCallback(() => {
    setGame(new Chess());
    setSelectedSquare(null);
    setValidMoves([]);
    setLastMove(null);
    setUserArrows([]);
    setUserHighlights([]);
    setDrawStart(null);
    setDrawPreview(null);
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

      const sansSoFar: string[] = [];
      for (let i = 0; i < history.length; i++) {
        const mv = history[i];
        const side = replay.turn();
        const fenBefore = replay.fen();
        const best = await engine.getBestMove(fenBefore, 10);

        replay.move(mv);
        sansSoFar.push(mv.san);
        const afterProbe = await engine.probeEval(replay.fen(), 10, 2500);
        let rated = rateMoveLikeChessCom(side, beforeProbe, afterProbe, mv, best || undefined);
        if (isBookMove(sansSoFar) && rated.cpLoss <= 40) {
          rated = { ...rated, label: "Book", color: "text-[#d5a47d]" };
        }
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
      const top = ["Brilliant", "Great", "Best", "Excellent", "Good", "Book", "Inaccuracy", "Miss", "Mistake", "Blunder"]
        .filter((k) => summary[k])
        .map((k) => `${k}: ${summary[k]}`)
        .join("  |  ");

      const gameRating = estimateGameRating(reviewedPlies);
      setMoveHistory(reviewed);
      setReviewSummary(
        `${top || "Review complete."}\nGame rating — You: ${gameRating.w.rating} · Stockfish: ${gameRating.b.rating}`
      );
      setReviewReady(true);
      const bySide = { w: [] as number[], b: [] as number[] };
      for (const m of reviewedPlies) bySide[m.side].push(scoreForLabel(m.label));
      const avg = (a: number[]) => (a.length ? (a.reduce((s, x) => s + x, 0) / a.length) * 100 : 0);
      const accuracy = { w: Number(avg(bySide.w).toFixed(1)), b: Number(avg(bySide.b).toFixed(1)) };
      saveLatestGameReview({
        createdAt: Date.now(),
        pgn: game.pgn(),
        result: gameOver || "Game complete",
        engine: engineLabel,
        depth: 10,
        accuracy,
        gameRating,
        moves: reviewedPlies,
      });
      // Persist accuracy into the game history entry created when the game ended.
      updateGameHistoryAccuracy(gameHistoryIdRef.current, accuracy, user?.id);
      if (coach !== "none") setCoachLine(coachOnMoveRating(coach, "Good", "analysis", Date.now()));
    } finally {
      setReviewingGame(false);
    }
  }, [eval_, gameOver]);

  const evalText =
    evalMate != null ? `${evalMate > 0 ? "" : "-"}M${Math.abs(evalMate)}` : eval_ >= 0 ? `+${(eval_ / 100).toFixed(1)}` : (eval_ / 100).toFixed(1);

  const moveListEntries = moveHistory.map((m) => ({ san: m.san, label: m.rating?.label }));

  /**
   * Cumulative move-classification counters — derived from whatever ratings are
   * currently in moveHistory (populated live during the review pass).
   */
  const moveCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of moveHistory) {
      const label = m.rating?.label;
      if (label) counts[label] = (counts[label] || 0) + 1;
    }
    return counts;
  }, [moveHistory]);

  // Ordered summary rows shown in the sidebar move-stats strip.
  // Chess.com analysis palette — keep in sync with GLYPH_META.
  const MOVE_STATS_ORDER = [
    { label: "Brilliant", dot: "bg-[#26c2a3]" },
    { label: "Great", dot: "bg-[#749bbf]" },
    { label: "Best", dot: "bg-[#81b64c]" },
    { label: "Excellent", dot: "bg-[#96bc4b]" },
    { label: "Good", dot: "bg-[#95af8a]" },
    { label: "Book", dot: "bg-[#d5a47d]" },
    { label: "Inaccuracy", dot: "bg-[#f7c631]" },
    { label: "Miss", dot: "bg-[#ff7769]" },
    { label: "Mistake", dot: "bg-[#ffa459]" },
    { label: "Blunder", dot: "bg-[#fa412d]" },
  ] as const;

  const moveStatsVisible = reviewReady && moveHistory.some((m) => m.rating?.label);

  const statusText = gameOver
    ? gameOver
    : engineThinking
      ? "Stockfish is thinking…"
      : game.turn() === "w"
        ? isFriendMode ? "White to move" : "Your turn (White)"
        : "Black to move";

  // Unrated modes (casual, pass-and-play) never show an ELO swing.
  const isUnratedMode = isCasualMode || isFriendMode;
  const eloPulse = useMemo(
    () => (gameOver && !isUnratedMode ? eloPulseForResult(gameOver, difficulty.skill) : 0),
    [difficulty.skill, gameOver, isUnratedMode]
  );
  const resultSummary = useMemo(
    () =>
      gameOver
        ? isUnratedMode
          ? `${summarizeResultLabel(gameOver)} - Unrated`
          : `${summarizeResultLabel(gameOver)} - ${eloPulse > 0 ? `+${eloPulse}` : `${eloPulse}`} Elo`
        : null,
    [eloPulse, gameOver, isUnratedMode]
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
    const tierPrice = namedBot.tier === "master" ? "$3.99/mo" : "$1.99/mo";
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
            {isFriendMode ? (
              <>Pass &amp; Play <span className="text-primary">vs a Friend</span></>
            ) : (
              <>
                {isDailyMode ? "Daily" : isCasualMode ? "Casual" : "Practice"}{" "}
                <span className="text-primary">vs Stockfish</span>
              </>
            )}
          </h1>
          <span className="ml-auto rounded-full border border-border px-3 py-1 font-body text-xs text-muted-foreground">
            {isFriendMode
              ? "Local · Unrated"
              : isCasualMode
                ? `${difficulty.rating} · Unrated`
                : `${difficulty.label} (${difficulty.rating})`}
          </span>
        </div>
      </nav>

      <div className="container mx-auto max-w-[1500px] px-3 py-4 lg:py-5">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-center">
          {/* ===== Board area — sized to fill the viewport height like chess.com ===== */}
          <div className="order-1 w-full lg:flex-[0_0_auto] lg:w-auto">
            <div className="mx-auto flex w-full max-w-[min(calc(100vh_-_225px),860px)] flex-col gap-1.5 lg:w-[min(calc(100vh_-_225px),860px)]">
              {/* Opponent banner (Black — Stockfish, or the friend in pass-and-play) */}
              <PlayerBanner
                name={isFriendMode ? "Black" : namedBot ? namedBot.name : "Stockfish"}
                rating={isFriendMode ? undefined : difficulty.rating}
                subtitle={isFriendMode ? "Pass & Play" : `${engineLabel} · ${difficulty.label}`}
                avatar={
                  isFriendMode ? (
                    <User className="h-5 w-5" />
                  ) : namedBot ? (
                    <PhilosopherAvatar botId={namedBot.id} size={36} />
                  ) : (
                    <Bot className="h-5 w-5" />
                  )
                }
                color="b"
                captured={material.capturedByBlack}
                advantage={blackAdvantage}
                isActive={gameTurn === "b" && !gameOver}
                isThinking={isEngineOpponent && engineThinking}
                clockMs={blackMs}
                flagged={flagged === "b"}
              />

              {/* Eval bar + board */}
              <div className="flex items-stretch gap-2">
                {showLiveEval && <EvalBar cp={eval_} mate={evalMate} />}

                <div className="relative flex-1 overflow-hidden rounded-[5px] shadow-[0_12px_32px_rgba(0,0,0,0.45)]">
                  {/* touch-none: the board is not a scroll surface — piece drags must not pan the page */}
                  <div
                    ref={boardRef}
                    onContextMenu={(e) => e.preventDefault()}
                    className="grid aspect-square w-full select-none touch-none grid-cols-8 grid-rows-8"
                  >
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

                      return (
                        <div
                          key={square}
                          data-square={square}
                          onClick={() => handleSquareClick(square)}
                          onMouseDown={(e) => {
                            if (e.button === 2) {
                              e.preventDefault();
                              setDrawStart(square);
                              setDrawPreview(square);
                              return;
                            }
                            handleDragStart(square, e);
                          }}
                          onTouchStart={(e) => handleDragStart(square, e)}
                          onMouseEnter={() => foresightOn && setHoveredSquare(square)}
                          onMouseLeave={() => foresightOn && setHoveredSquare((s) => (s === square ? null : s))}
                          className={`relative flex select-none items-center justify-center ${
                            isDark ? "bg-chess-dark" : "bg-chess-light"
                          } ${
                            piece && piece.color === movableColor && (isFriendMode || game.turn() === "w") && !gameOver && !viewFen
                              ? "cursor-grab"
                              : "cursor-pointer"
                          }`}
                        >
                          {/* Last move highlight (chess.com yellow) */}
                          {isLastMoveSquare && !viewFen && (
                            <div className="absolute inset-0" style={{ backgroundColor: "rgba(255,255,51,0.45)" }} />
                          )}

                          {/* Right-click square highlight */}
                          {userHighlights.map((h) =>
                            h.square === square ? (
                              <div
                                key={h.square}
                                className="absolute inset-0 z-[8]"
                                style={{ backgroundColor: h.color, opacity: 0.5 }}
                              />
                            ) : null
                          )}

                          {/* Selected highlight */}
                          {isSelected && (
                            <div className="absolute inset-0 z-10" style={{ backgroundColor: "rgba(255,255,51,0.58)" }} />
                          )}

                          {/* Drag target — chess.com's thick translucent frame */}
                          {isDragTarget && (
                            <div
                              className="absolute inset-0 z-10"
                              style={{ boxShadow: "inset 0 0 0 4px rgba(255,255,255,0.65)" }}
                            />
                          )}

                          {/* Coords */}
                          {col === 0 && (
                            <span
                              className={`absolute left-[3px] top-[2px] z-10 text-[10px] font-bold leading-none ${
                                isDark ? "text-chess-light/90" : "text-chess-dark/90"
                              }`}
                            >
                              {boardFlipped ? fr + 1 : 8 - fr}
                            </span>
                          )}
                          {row === 7 && (
                            <span
                              className={`absolute bottom-[2px] right-[3px] z-10 text-[10px] font-bold leading-none ${
                                isDark ? "text-chess-light/90" : "text-chess-dark/90"
                              }`}
                            >
                              {String.fromCharCode(97 + fc)}
                            </span>
                          )}

                          {/* Piece */}
                          {piece && !isDragSource && (
                            <PieceImage color={piece.color} type={piece.type} active={isSelected} className="z-20 h-[96%] w-[96%]" />
                          )}

                          {/* Move hints — chess.com's translucent dark dot / capture ring */}
                          {showValidMoves && isValidTarget && !isDragTarget && (
                            <div className="pointer-events-none absolute z-30 flex h-full w-full items-center justify-center">
                              {piece && !isDragSource ? (
                                <div
                                  className="h-full w-full rounded-full"
                                  style={{ boxShadow: "inset 0 0 0 6px rgba(0,0,0,0.14)" }}
                                />
                              ) : (
                                <div className="h-[33%] w-[33%] rounded-full" style={{ backgroundColor: "rgba(0,0,0,0.14)" }} />
                              )}
                            </div>
                          )}

                          {/* Check highlight — radial red glow under the king */}
                          {piece?.type === "k" && displayGame.inCheck() && piece.color === displayGame.turn() && (
                            <div
                              className="absolute inset-0 z-[5]"
                              style={{
                                background:
                                  "radial-gradient(circle at center, rgba(255,0,0,0.65) 0%, rgba(231,0,0,0.45) 40%, rgba(169,0,0,0) 80%)",
                              }}
                            />
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

                  {/* User-drawn arrows (right-click drag) + live preview */}
                  {(userArrows.length > 0 || (drawStart && drawPreview && drawPreview !== drawStart)) && (
                    <BoardArrows
                      flipped={boardFlipped}
                      arrows={[
                        ...userArrows,
                        ...(drawStart && drawPreview && drawPreview !== drawStart
                          ? [{ from: drawStart, to: drawPreview, color: "#ffaa00", opacity: 0.5 }]
                          : []),
                      ]}
                    />
                  )}

                  {/* Dragged piece ghost — positioned via transform outside React renders */}
                  {dragging && (
                    <div
                      ref={dragGhostRef}
                      className="drag-ghost fixed left-0 top-0 z-[100] pointer-events-none will-change-transform"
                      style={{
                        width: dragGhostSizeRef.current,
                        height: dragGhostSizeRef.current,
                        transform: `translate(${dragPosRef.current.x - dragGhostSizeRef.current / 2}px, ${dragPosRef.current.y - dragGhostSizeRef.current / 2}px)`,
                      }}
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
                              <PieceImage
                                color={(promotionSquare && game.get(promotionSquare.from)?.color) || "w"}
                                type={p}
                                className="h-10 w-10"
                              />
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Game over overlay — Chess.com-style result modal */}
                  <AnimatePresence>
                    {gameOver && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md"
                      >
                        <motion.div
                          initial={{ scale: 0.88, opacity: 0, y: 12 }}
                          animate={{ scale: 1, opacity: 1, y: 0 }}
                          exit={{ scale: 0.88, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 340, damping: 26 }}
                          className="mx-4 w-full max-w-[340px] overflow-hidden rounded-2xl border border-border bg-card shadow-panel"
                        >
                          {/* Coloured result banner */}
                          <div
                            className={`flex items-center justify-center gap-3 px-6 py-5 ${
                              gameOver.startsWith("White wins")
                                ? "bg-emerald-500/15 border-b border-emerald-500/25"
                                : gameOver.startsWith("Black wins")
                                  ? "bg-rose-500/15 border-b border-rose-500/25"
                                  : "bg-secondary/60 border-b border-border"
                            }`}
                          >
                            <Trophy
                              className={`h-8 w-8 shrink-0 ${
                                gameOver.startsWith("White wins")
                                  ? "text-amber-400"
                                  : gameOver.startsWith("Black wins")
                                    ? "text-rose-400"
                                    : "text-foreground/40"
                              }`}
                            />
                            <div className="text-center">
                              <p
                                className={`font-display text-xl font-bold ${
                                  gameOver.startsWith("White wins")
                                    ? "text-emerald-300"
                                    : gameOver.startsWith("Black wins")
                                      ? "text-rose-300"
                                      : "text-foreground"
                                }`}
                              >
                                {gameOutcome}
                              </p>
                              <p className="font-body text-xs text-muted-foreground mt-0.5">
                                {gameOver}
                              </p>
                            </div>
                          </div>

                          {/* Stats row */}
                          <div className="flex items-center justify-center gap-4 px-6 py-3 border-b border-border/60">
                            <div className="text-center">
                              <p className="font-display text-lg font-bold text-foreground">
                                {game.history().length}
                              </p>
                              <p className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">
                                Moves
                              </p>
                            </div>
                            {resultSummary && (
                              <>
                                <div className="h-8 w-px bg-border" />
                                <div className="text-center">
                                  {isUnratedMode ? (
                                    <>
                                      <p className="font-display text-lg font-bold text-foreground">—</p>
                                      <p className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">
                                        Unrated
                                      </p>
                                    </>
                                  ) : (
                                    <>
                                      <p
                                        className={`font-display text-lg font-bold ${
                                          eloPulse > 0 ? "text-emerald-400" : eloPulse < 0 ? "text-rose-400" : "text-foreground"
                                        }`}
                                      >
                                        {eloPulse > 0 ? `+${eloPulse}` : eloPulse}
                                      </p>
                                      <p className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">
                                        ELO
                                      </p>
                                    </>
                                  )}
                                </div>
                              </>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div className="flex flex-col gap-2 px-5 py-4">
                            {/* PRIMARY — New Game */}
                            <button
                              onClick={resetGame}
                              className="btn-chess btn-chess-primary w-full py-3 text-sm"
                              ref={(el) => { gameOverActionRefs.current[1] = el; }}
                            >
                              New Game  <span className="font-mono text-[10px] opacity-60 ml-1">[R]</span>
                            </button>

                            {/* SECONDARY — Analyze */}
                            <button
                              onClick={async () => {
                                markAnalysisTransitionStart();
                                if (!reviewReady && !reviewingGame) void analyzeFinishedGame();
                                navigate("/analyze-game");
                              }}
                              disabled={reviewingGame || !engineReady || !!engineError}
                              className="btn-chess btn-chess-secondary w-full py-2.5 text-sm disabled:opacity-50"
                              ref={(el) => { gameOverActionRefs.current[0] = el; }}
                            >
                              <BarChart3 className="h-4 w-4" />
                              {reviewingGame
                                ? `Analyzing ${reviewProgress}/${game.history().length}`
                                : "Analysis"}
                              <span className="font-mono text-[10px] opacity-60 ml-1">[A]</span>
                            </button>

                            {/* TERTIARY row */}
                            <div className="flex gap-2">
                              <button
                                onClick={() => navigate("/play")}
                                className="btn-chess btn-chess-outline flex-1 py-2 text-xs"
                                ref={(el) => { gameOverActionRefs.current[2] = el; }}
                              >
                                New Opponent
                                <span className="font-mono text-[9px] opacity-50 ml-1">[N]</span>
                              </button>
                              <button
                                onClick={copyPgn}
                                className="btn-chess btn-chess-outline flex-1 py-2 text-xs"
                                title="Copy PGN to clipboard"
                              >
                                <Copy className="h-3.5 w-3.5" />
                                Copy PGN
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Player banner (White / You) */}
              <PlayerBanner
                name={
                  isFriendMode
                    ? "White"
                    : profile?.display_name || profile?.username || "You"
                }
                rating={isUnratedMode ? undefined : playerElo}
                subtitle={isFriendMode ? "Pass & Play" : "White"}
                flag={isFriendMode ? undefined : countryFlag(profile?.country) || undefined}
                avatar={
                  !isFriendMode && profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <User className="h-5 w-5" />
                  )
                }
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

          {/* ===== Unified sidebar ===== */}
          <div className="order-2 w-full space-y-3 lg:flex-1 lg:min-w-[320px] lg:max-w-[430px]">
            {/* Board controls + live analysis row */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
              {showLiveEval && (
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                    <span className="font-body text-xs font-semibold text-foreground/80 uppercase tracking-wider">Live Analysis</span>
                  </div>
                  <span className="font-mono text-xs text-foreground font-semibold">
                    {evalText} <span className="text-muted-foreground font-normal">· d{evalDepth}</span>
                  </span>
                </div>
              )}

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
                {moveHistory.length > 0 && (
                  <span className="ml-auto font-mono text-[11px] font-normal text-muted-foreground">
                    {Math.ceil(moveHistory.length / 2)} / {moveHistory.length} plies
                  </span>
                )}
              </h3>
              <MoveList moves={moveListEntries} activeIndex={historyIndex} onSelect={goToMove} />

              {/* Live move-classification stats strip — visible once any move has a rating */}
              {moveStatsVisible && (
                <div className="mt-3 pt-3 border-t border-border/60">
                  <p className="font-body text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                    Move Accuracy
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                    {MOVE_STATS_ORDER.filter((s) => moveCounts[s.label]).map(({ label, dot }) => (
                      <span key={label} className="flex items-center gap-1.5 font-body text-xs text-foreground/80">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                        <span className="text-muted-foreground">{label}:</span>
                        <span className="font-semibold tabular-nums">{moveCounts[label]}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
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
                    <p className="font-body text-[11px] leading-relaxed text-foreground/80 whitespace-pre-line">{reviewSummary}</p>
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
                {/* Header — animated avatar + voice toggle */}
                <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border bg-secondary/40">
                  {namedBot && (
                    <PhilosopherAvatar
                      botId={namedBot.id}
                      speaking={false}
                      size={40}
                      className="shrink-0 -my-1"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="font-display text-sm font-semibold text-foreground leading-none">
                      {botPersonality.displayName}
                    </p>
                    <p className="font-body text-[10px] text-muted-foreground mt-0.5 truncate">
                      {botPersonality.tagline}
                    </p>
                  </div>
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground shrink-0">
                    {namedBot?.ratingLabel}
                  </span>
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 font-body text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Voice Soon
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
