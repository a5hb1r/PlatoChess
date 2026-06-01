import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Gauge,
  Lightbulb,
  Loader2,
  Menu,
  Play,
  Puzzle,
  RefreshCw,
  Sparkles,
  Swords,
  Target,
  XCircle,
} from "lucide-react";
import { Chess, Square, PieceSymbol } from "chess.js";
import { PIECE_URLS } from "@/lib/chess-constants";
import { MoveGlyph, isMistakeLabel } from "@/components/chess/MoveGlyph";
import { playMoveSound } from "@/lib/sounds";
import {
  consumeAnalysisTransitionMs,
  loadLatestFinishedGame,
  loadLatestGameReview,
  loadPersonalizedPuzzles,
  saveLatestGameReview,
  savePersonalizedPuzzles,
  scoreForLabel,
  type GameReviewReport,
  type ReviewedPly,
} from "@/lib/game-review";
import { reviewTone } from "@/lib/review-colors";
import { StockfishEngine, STOCKFISH_VERSION_LABEL, type StockfishInfo, formatEngineInitError } from "@/lib/stockfish";
import { buildGameReviewReport } from "@/lib/review-builder";
import { buildOpeningSuite, lineToFen, openingLinePreview, type OpeningSuiteData, type OpeningTheoryNode } from "@/lib/opening-suite";
import { buildPersonalizedPuzzles } from "@/lib/personalized-puzzles";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

function squareCenter(square: Square): { x: number; y: number } {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  const x = (file + 0.5) / 8;
  const y = (8 - rank + 0.5) / 8;
  return { x, y };
}

function parseUci(uci?: string): { from: Square; to: Square } | null {
  if (!uci || uci.length < 4) return null;
  return { from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square };
}

function formatEval(evalCp: number, mate?: number | null): string {
  if (mate !== undefined && mate !== null) return mate > 0 ? `M${mate}` : `-M${Math.abs(mate)}`;
  return `${evalCp >= 0 ? "+" : ""}${(evalCp / 100).toFixed(2)}`;
}

type FilterId = "all" | "good" | "errors" | "critical" | "white" | "black";
const MISTAKE_LABELS = new Set(["Inaccuracy", "Mistake", "Blunder"]);
const HIGH_QUALITY_LABELS = new Set(["Brilliant", "Best", "Excellent", "Good"]);

function isMistakeLike(label: string): boolean {
  return MISTAKE_LABELS.has(label);
}

function TheoryNode({
  node,
  depth = 0,
  activeId,
  onPick,
}: {
  node: OpeningTheoryNode;
  depth?: number;
  activeId: string | null;
  onPick: (line: OpeningTheoryNode) => void;
}) {
  const isActive = node.id === activeId;
  return (
    <div className="space-y-1">
      <button
        onClick={() => onPick(node)}
        className={`w-full rounded-md border px-2 py-1 text-left text-xs ${
          isActive ? "border-primary/50 bg-secondary" : "border-border bg-background hover:bg-secondary/70"
        }`}
        style={{ marginLeft: depth * 10 }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-foreground">
            {node.san}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {node.whitePct}/{node.drawPct}/{node.blackPct}
          </span>
        </div>
      </button>
      {node.children.slice(0, 6).map((child) => (
        <TheoryNode key={child.id} node={child} depth={depth + 1} activeId={activeId} onPick={onPick} />
      ))}
    </div>
  );
}

export default function AnalyzeGame() {
  const navigate = useNavigate();
  const engineRef = useRef<StockfishEngine | null>(null);
  const [report, setReport] = useState<GameReviewReport | null>(() => loadLatestGameReview());
  const [reviewing, setReviewing] = useState(false);
  const [reviewProgress, setReviewProgress] = useState({ done: 0, total: 0 });
  const [engineLabel, setEngineLabel] = useState(STOCKFISH_VERSION_LABEL);
  const [engineReady, setEngineReady] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>("all");
  const [onlyMistakes, setOnlyMistakes] = useState(false);
  const [selectedPly, setSelectedPly] = useState<number>(report?.moves.length ?? 0);
  const [liveEvalCp, setLiveEvalCp] = useState(0);
  const [liveEvalMate, setLiveEvalMate] = useState<number | null>(null);
  const [liveEvalDepth, setLiveEvalDepth] = useState(0);
  const [evalLoading, setEvalLoading] = useState(false);
  const [transitionMs, setTransitionMs] = useState<number | null>(null);
  const [openingSuite, setOpeningSuite] = useState<OpeningSuiteData | null>(null);
  const [openingLoading, setOpeningLoading] = useState(false);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [previewFen, setPreviewFen] = useState<string | null>(null);
  const [previewLineText, setPreviewLineText] = useState<string | null>(null);
  const [buildingPuzzles, setBuildingPuzzles] = useState(false);
  const [personalizedPuzzleCount, setPersonalizedPuzzleCount] = useState(() => loadPersonalizedPuzzles().length);

  // --- "Retry This Move" challenge state ---
  const [retryMode, setRetryMode] = useState(false);
  const [retryGame, setRetryGame] = useState<Chess | null>(null);
  const [retrySel, setRetrySel] = useState<Square | null>(null);
  const [retryTargets, setRetryTargets] = useState<Square[]>([]);
  const [retryFeedback, setRetryFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [retrySolved, setRetrySolved] = useState(false);

  const moves = useMemo(() => report?.moves ?? [], [report]);
  const boundedPly = Math.max(0, Math.min(selectedPly, moves.length));
  const current: ReviewedPly | null = boundedPly > 0 ? moves[boundedPly - 1] : null;
  const boardFen = current?.fenAfter ?? new Chess().fen();
  const renderedFen = previewFen ?? boardFen;
  // While retrying, the board shows the position *before* the error so the
  // player can hunt for the engine's best move.
  const boardRenderFen = retryMode && retryGame ? retryGame.fen() : renderedFen;
  const display = useMemo(() => new Chess(boardRenderFen), [boardRenderFen]);

  // Per-side classification tallies for the Coach's Breakdown summary.
  const breakdown = useMemo(() => {
    const make = () => ({ Brilliant: 0, Great: 0, Best: 0, Excellent: 0, Good: 0, Inaccuracy: 0, Miss: 0, Mistake: 0, Blunder: 0 } as Record<string, number>);
    const w = make();
    const b = make();
    for (const m of moves) {
      const target = m.side === "w" ? w : b;
      if (target[m.label] !== undefined) target[m.label] += 1;
    }
    return { w, b };
  }, [moves]);
  const best = previewFen ? null : parseUci(current?.bestUci);
  const played = previewFen ? null : parseUci(current?.playedUci);

  const filtered = useMemo(
    () =>
      moves.filter((m) => {
        if (onlyMistakes && !isMistakeLike(m.label)) return false;
        if (filter === "all") return true;
        if (filter === "white") return m.side === "w";
        if (filter === "black") return m.side === "b";
        if (filter === "critical") return m.label === "Mistake" || m.label === "Blunder";
        if (filter === "errors") return isMistakeLike(m.label);
        return HIGH_QUALITY_LABELS.has(m.label);
      }),
    [filter, moves, onlyMistakes]
  );

  const criticalPlies = useMemo(
    () => moves.filter((m) => m.label === "Mistake" || m.label === "Blunder").map((m) => m.ply),
    [moves]
  );

  const trend = useMemo(() => {
    let wSum = 0;
    let wCount = 0;
    let bSum = 0;
    let bCount = 0;
    const wPoints: string[] = [];
    const bPoints: string[] = [];
    const xFor = (ply: number) => (moves.length <= 1 ? 0 : ((ply - 1) / (moves.length - 1)) * 100);
    for (const m of moves) {
      const score = scoreForLabel(m.label) * 100;
      if (m.side === "w") {
        wSum += score;
        wCount += 1;
      } else {
        bSum += score;
        bCount += 1;
      }
      const wAvg = wCount ? wSum / wCount : 0;
      const bAvg = bCount ? bSum / bCount : 0;
      wPoints.push(`${xFor(m.ply).toFixed(2)},${(100 - wAvg).toFixed(2)}`);
      bPoints.push(`${xFor(m.ply).toFixed(2)},${(100 - bAvg).toFixed(2)}`);
    }
    return { wPoints: wPoints.join(" "), bPoints: bPoints.join(" ") };
  }, [moves]);

  const jumpCritical = useCallback(
    (direction: 1 | -1) => {
      if (!criticalPlies.length) return;
      const sorted = [...criticalPlies].sort((a, b) => a - b);
      if (direction > 0) {
        const next = sorted.find((ply) => ply > boundedPly) ?? sorted[0];
        setSelectedPly(next);
        setPreviewFen(null);
        return;
      }
      const prev = [...sorted].reverse().find((ply) => ply < boundedPly) ?? sorted[sorted.length - 1];
      setSelectedPly(prev);
      setPreviewFen(null);
    },
    [boundedPly, criticalPlies]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") {
        setSelectedPly((p) => Math.max(0, p - 1));
        setPreviewFen(null);
      }
      if (e.key === "ArrowRight") {
        setSelectedPly((p) => Math.min(moves.length, p + 1));
        setPreviewFen(null);
      }
      if (e.key.toLowerCase() === "j") jumpCritical(-1);
      if (e.key.toLowerCase() === "k") jumpCritical(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [jumpCritical, moves.length]);

  useEffect(() => {
    setTransitionMs(consumeAnalysisTransitionMs());
  }, []);

  // Leaving the current ply abandons any in-progress retry.
  useEffect(() => {
    setRetryMode(false);
    setRetryGame(null);
    setRetrySel(null);
    setRetryTargets([]);
    setRetryFeedback(null);
    setRetrySolved(false);
  }, [boundedPly]);

  useEffect(() => {
    const engine = new StockfishEngine();
    engineRef.current = engine;
    setEngineError(null);
    engine
      .init()
      .then(() => {
        setEngineReady(true);
        setEngineLabel(engine.getLabel());
      })
      .catch((err) => {
        setEngineError(err instanceof Error ? err.message : formatEngineInitError(err));
      });
    return () => engine.destroy();
  }, []);

  useEffect(() => {
    if (!engineReady || !engineRef.current || engineError) return;
    const snapshot = loadLatestFinishedGame();
    const requiresBuild =
      !!snapshot &&
      (!report ||
        report.pgn !== snapshot.pgn ||
        report.moves.length === 0);
    if (!requiresBuild) return;

    let cancelled = false;
    setReviewing(true);
    setReviewProgress({ done: 0, total: 1 });
    buildGameReviewReport({
      pgn: snapshot.pgn,
      result: snapshot.result,
      engineLabel: engineRef.current.getLabel(),
      engine: engineRef.current,
      depth: 10,
      onProgress: (done, total) => {
        if (cancelled) return;
        setReviewProgress({ done, total });
      },
    })
      .then((nextReport) => {
        if (cancelled) return;
        saveLatestGameReview(nextReport);
        setReport(nextReport);
        setSelectedPly(nextReport.moves.length);
      })
      .catch((err) => {
        if (cancelled) return;
        setEngineError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setReviewing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [engineError, engineReady, report]);

  useEffect(() => {
    if (!engineReady || !engineRef.current || !renderedFen) return;
    let alive = true;
    setEvalLoading(true);
    setLiveEvalMate(null);
    if (!previewFen && current?.evalAfterCp !== undefined) {
      setLiveEvalCp(current.evalAfterCp);
    }
    const timer = window.setTimeout(() => {
      if (alive) setEvalLoading(false);
    }, 1600);
    engineRef.current.evaluate(renderedFen, 18, (info: StockfishInfo) => {
      if (!alive) return;
      if (info.mate !== undefined) {
        setLiveEvalMate(info.mate);
      } else if (info.score !== undefined) {
        setLiveEvalMate(null);
        setLiveEvalCp(info.score);
      }
      if (info.depth !== undefined) setLiveEvalDepth(info.depth);
      if (info.depth !== undefined && info.depth >= 14) setEvalLoading(false);
    });
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [current?.evalAfterCp, engineReady, previewFen, renderedFen]);

  const openingAnchorPly = useMemo(() => Math.min(16, moves.length), [moves.length]);
  const openingFen = openingAnchorPly > 0 ? moves[openingAnchorPly - 1].fenAfter : new Chess().fen();
  const openingSanMoves = useMemo(() => moves.slice(0, openingAnchorPly).map((m) => m.san), [moves, openingAnchorPly]);

  useEffect(() => {
    if (!report || reviewing) return;
    let cancelled = false;
    setOpeningLoading(true);
    buildOpeningSuite(openingFen, openingSanMoves, { maxDepth: 5, branchWidth: 6, nodeBudget: 120 })
      .then((suite) => {
        if (cancelled) return;
        setOpeningSuite(suite);
      })
      .catch(() => {
        if (cancelled) return;
        setOpeningSuite(null);
      })
      .finally(() => {
        if (!cancelled) setOpeningLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [openingFen, openingSanMoves, report, reviewing]);

  useEffect(() => {
    if (!report || !engineRef.current || !engineReady) return;
    let cancelled = false;
    const candidates = report.moves
      .filter((m) => isMistakeLike(m.label) && !!m.bestUci)
      .sort((a, b) => b.cpLoss - a.cpLoss)
      .slice(0, 8);
    if (!candidates.length) {
      savePersonalizedPuzzles([]);
      setPersonalizedPuzzleCount(0);
      return;
    }

    setBuildingPuzzles(true);
    (async () => {
      const packs: Array<{ move: ReviewedPly; topLines: Awaited<ReturnType<StockfishEngine["probeTopLines"]>> }> = [];
      for (const move of candidates) {
        const topLines = await engineRef.current!.probeTopLines(move.fenBefore, 12, 3, 3500);
        packs.push({ move, topLines });
      }
      if (cancelled) return;
      const puzzles = buildPersonalizedPuzzles(packs);
      savePersonalizedPuzzles(puzzles);
      setPersonalizedPuzzleCount(puzzles.length);
      setBuildingPuzzles(false);
    })().catch(() => {
      if (!cancelled) setBuildingPuzzles(false);
    });

    return () => {
      cancelled = true;
    };
  }, [engineReady, report]);

  const toPercent = (n: number) => `${Math.max(0, Math.min(100, n * 100)).toFixed(2)}%`;
  const arrowLine = (arrow: { from: Square; to: Square } | null, color: string) => {
    if (!arrow) return null;
    const a = squareCenter(arrow.from);
    const b = squareCenter(arrow.to);
    return (
      <line
        x1={toPercent(a.x)}
        y1={toPercent(a.y)}
        x2={toPercent(b.x)}
        y2={toPercent(b.y)}
        stroke={color}
        strokeWidth="3"
        markerEnd="url(#arrowhead)"
        opacity="0.92"
      />
    );
  };

  const quickActions = (
    <div className="space-y-2">
      <button
        onClick={() => navigate("/game")}
        className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-left hover:bg-secondary transition-colors flex items-center gap-2"
      >
        <RefreshCw className="w-4 h-4" />
        Rematch
      </button>
      <button
        onClick={() => navigate("/play")}
        className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-left hover:bg-secondary transition-colors flex items-center gap-2"
      >
        <Play className="w-4 h-4" />
        New Game
      </button>
      <button
        onClick={() => navigate("/puzzles?source=personalized")}
        className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-left hover:bg-secondary transition-colors flex items-center gap-2"
      >
        <Puzzle className="w-4 h-4" />
        Puzzle Training {personalizedPuzzleCount > 0 ? `(${personalizedPuzzleCount})` : ""}
      </button>
    </div>
  );

  const onPickTheoryLine = useCallback(
    (line: OpeningTheoryNode) => {
      setSelectedLineId(line.id);
      setPreviewLineText(openingLinePreview(line));
      const fen = lineToFen(openingFen, line);
      setPreviewFen(fen);
    },
    [openingFen]
  );

  // SAN for a UCI move applied to a FEN (used to name the engine's best move).
  const bestSan = useMemo(() => {
    if (!current?.bestUci) return null;
    try {
      const g = new Chess(current.fenBefore);
      const m = g.move({
        from: current.bestUci.slice(0, 2) as Square,
        to: current.bestUci.slice(2, 4) as Square,
        promotion: (current.bestUci[4] as PieceSymbol) || undefined,
      });
      return m?.san ?? null;
    } catch {
      return null;
    }
  }, [current]);

  const startRetry = useCallback(() => {
    if (!current) return;
    setRetryGame(new Chess(current.fenBefore));
    setRetryMode(true);
    setRetrySel(null);
    setRetryTargets([]);
    setRetryFeedback(null);
    setRetrySolved(false);
    setPreviewFen(null);
  }, [current]);

  const exitRetry = useCallback(() => {
    setRetryMode(false);
    setRetryGame(null);
    setRetrySel(null);
    setRetryTargets([]);
    setRetryFeedback(null);
    setRetrySolved(false);
  }, []);

  const attemptRetryMove = useCallback(
    (from: Square, to: Square) => {
      if (!current || !retryGame) return;
      const g = new Chess(retryGame.fen());
      const mover = g.get(from);
      const isPromo = mover?.type === "p" && (to[1] === "8" || to[1] === "1");
      const move = g.move({ from, to, promotion: isPromo ? "q" : undefined });
      if (!move) return;

      const uci = `${from}${to}${isPromo ? "q" : ""}`;
      const correct = !!current.bestUci && uci === current.bestUci;
      playMoveSound(move, g.isCheck());
      setRetrySel(null);
      setRetryTargets([]);

      if (correct) {
        setRetryGame(g);
        setRetrySolved(true);
        setRetryFeedback({ ok: true, msg: `Correct — ${move.san} is the engine's top move here.` });
      } else {
        setRetryFeedback({
          ok: false,
          msg: bestSan
            ? `${move.san} isn't best. The engine prefers ${bestSan}. Try again.`
            : `${move.san} isn't the engine's choice. Try again.`,
        });
        // Reset back to the puzzle position for another attempt.
        setRetryGame(new Chess(current.fenBefore));
      }
    },
    [current, retryGame, bestSan]
  );

  const onRetrySquare = useCallback(
    (sq: Square) => {
      if (!retryMode || !retryGame || retrySolved || !current) return;
      if (retryGame.turn() !== current.side) return;
      if (retrySel && retryTargets.includes(sq)) {
        attemptRetryMove(retrySel, sq);
        return;
      }
      const piece = retryGame.get(sq);
      if (piece && piece.color === retryGame.turn()) {
        setRetrySel(sq);
        setRetryTargets(retryGame.moves({ square: sq, verbose: true }).map((m) => m.to as Square));
      } else {
        setRetrySel(null);
        setRetryTargets([]);
      }
    },
    [retryMode, retryGame, retrySolved, current, retrySel, retryTargets, attemptRetryMove]
  );

  if (!report && !reviewing) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-6 py-12 max-w-3xl space-y-4">
          <Link to="/game" className="text-sm text-muted-foreground hover:text-foreground">
            Back to game
          </Link>
          <h1 className="font-display text-3xl font-semibold">No analyzed game found</h1>
          <p className="font-body text-muted-foreground">
            Finish a game first, then open analysis from the game-over screen.
          </p>
        </div>
      </div>
    );
  }

  if (!report && reviewing) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-6 py-16 max-w-3xl">
          <div className="rounded-lg border border-border bg-card p-6 space-y-3">
            <p className="font-display text-xl font-semibold">Generating post-game review...</p>
            <p className="text-sm text-muted-foreground">
              {reviewProgress.done}/{reviewProgress.total} plies analyzed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center gap-3 px-4 py-4">
          <Link to="/game" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <h1 className="font-display text-xl font-semibold">Post-Game Analysis</h1>
          <span className="ml-auto text-xs text-muted-foreground border border-border rounded-full px-3 py-1">
            {engineLabel}
          </span>
          <Sheet>
            <SheetTrigger asChild>
              <button className="lg:hidden rounded-md border border-border p-2 hover:bg-secondary" aria-label="Open analysis menu">
                <Menu className="w-4 h-4" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] space-y-4">
              <p className="font-display text-sm font-semibold">Analysis Side Menu</p>
              {quickActions}
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-6 max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-3 space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <p className="font-display text-sm font-semibold">Accuracy</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-border bg-background p-2">
                <p className="text-[10px] text-muted-foreground uppercase">White</p>
                <p className="font-mono text-lg">{report!.accuracy.w.toFixed(1)}%</p>
              </div>
              <div className="rounded-md border border-border bg-background p-2">
                <p className="text-[10px] text-muted-foreground uppercase">Black</p>
                <p className="font-mono text-lg">{report!.accuracy.b.toFixed(1)}%</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{report!.result}</p>
            {transitionMs !== null && (
              <p className="text-[11px] text-muted-foreground">
                Game Over → Analysis: <span className="font-mono">{transitionMs}ms</span>
              </p>
            )}
            <div className="rounded-md border border-border bg-background p-2">
              <p className="text-[10px] text-muted-foreground uppercase mb-2">Trend</p>
              <svg viewBox="0 0 100 100" className="w-full h-16">
                <line x1="0" y1="100" x2="100" y2="100" stroke="hsl(var(--border))" strokeWidth="1" />
                <polyline points={trend.wPoints} fill="none" stroke="#e5e7eb" strokeWidth="2" strokeLinecap="round" />
                <polyline points={trend.bPoints} fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <p className="font-display text-sm font-semibold">Coach's Breakdown</p>
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-1.5">
              <span />
              <span className="text-center text-[10px] font-semibold uppercase text-muted-foreground">You</span>
              <span className="text-center text-[10px] font-semibold uppercase text-muted-foreground">Bot</span>
              {["Brilliant", "Great", "Best", "Excellent", "Good", "Inaccuracy", "Miss", "Mistake", "Blunder"].map((label) => (
                <Fragment key={label}>
                  <span className="flex items-center gap-1.5 text-xs">
                    <MoveGlyph label={label} size={15} />
                    <span className="text-foreground/85">{label}</span>
                  </span>
                  <span className={`text-center font-mono text-sm ${breakdown.w[label] ? "text-foreground" : "text-muted-foreground/40"}`}>
                    {breakdown.w[label]}
                  </span>
                  <span className={`text-center font-mono text-sm ${breakdown.b[label] ? "text-foreground" : "text-muted-foreground/40"}`}>
                    {breakdown.b[label]}
                  </span>
                </Fragment>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-md border border-border bg-background px-2.5 py-1.5 text-xs">
              <span className="text-muted-foreground">Accuracy</span>
              <span className="font-mono">
                You {report!.accuracy.w.toFixed(1)}% · Bot {report!.accuracy.b.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-2">
              <Filter className="w-3 h-3" />
              Move Filter
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterId)}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All moves</option>
              <option value="good">Good moves</option>
              <option value="errors">Errors</option>
              <option value="critical">Critical errors</option>
              <option value="white">White only</option>
              <option value="black">Black only</option>
            </select>
            <label className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={onlyMistakes}
                onChange={(e) => setOnlyMistakes(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border bg-background"
              />
              Show only mistake-class moves
            </label>
          </div>

          <div className="hidden lg:block rounded-lg border border-border bg-card p-4">
            <p className="font-display text-sm font-semibold mb-2">Analysis Side Menu</p>
            {quickActions}
            {buildingPuzzles && (
              <p className="mt-2 text-[11px] text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                Building strict personalized puzzles...
              </p>
            )}
          </div>
        </aside>

        <main className="lg:col-span-6 space-y-4">
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground mb-2">Move Rating Timeline</p>
            <div className="overflow-x-auto">
              <div className="flex items-end gap-1 min-w-max">
                {moves.map((move) => (
                  <button
                    key={move.ply}
                    onClick={() => {
                      setSelectedPly(move.ply);
                      setPreviewFen(null);
                    }}
                    className={`h-11 w-7 rounded-sm border text-[9px] font-mono ${
                      selectedPly === move.ply && !previewFen
                        ? "border-primary bg-secondary"
                        : `border-border ${reviewTone(move.label).row}`
                    }`}
                    title={`${move.ply}. ${move.san} — ${move.label} (${move.cpLoss.toFixed(0)} cp)`}
                  >
                    {move.ply}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg overflow-hidden border border-border shadow-elevated aspect-square relative">
            <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
              {Array.from({ length: 64 }, (_, i) => {
                const row = Math.floor(i / 8);
                const col = i % 8;
                const sq = `${String.fromCharCode(97 + col)}${8 - row}` as Square;
                const isDark = (row + col) % 2 === 1;
                const piece = display.get(sq);
                const isRetrySel = retryMode && retrySel === sq;
                const isRetryTarget = retryMode && retryTargets.includes(sq);
                return (
                  <div
                    key={sq}
                    onClick={() => onRetrySquare(sq)}
                    className={`relative ${isDark ? "bg-chess-dark" : "bg-chess-light"} ${
                      retryMode && !retrySolved ? "cursor-pointer" : ""
                    }`}
                  >
                    {isRetrySel && (
                      <div className="absolute inset-0 z-10" style={{ backgroundColor: "rgba(245,200,68,0.45)" }} />
                    )}
                    {piece && (
                      <img
                        src={PIECE_URLS[piece.color][piece.type]}
                        alt=""
                        className="w-[82%] h-[82%] object-contain absolute inset-0 m-auto pointer-events-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]"
                        draggable={false}
                      />
                    )}
                    {isRetryTarget && (
                      <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
                        {piece ? (
                          <div className="h-[84%] w-[84%] rounded-full border-[5px]" style={{ borderColor: "rgba(129,182,76,0.55)" }} />
                        ) : (
                          <div className="h-[30%] w-[30%] rounded-full" style={{ backgroundColor: "rgba(129,182,76,0.5)" }} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {!retryMode && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <polygon points="0 0, 6 3, 0 6" fill="currentColor" />
                  </marker>
                </defs>
                <g style={{ color: "#7dd3fc" }}>{arrowLine(best, "currentColor")}</g>
                <g style={{ color: "#f87171" }}>{arrowLine(played, "currentColor")}</g>
              </svg>
            )}
            {retryMode && (
              <div className="pointer-events-none absolute left-2 top-2 z-40 rounded-md bg-background/85 px-2 py-1 text-[11px] font-semibold text-foreground backdrop-blur-sm">
                Retry mode · {current?.side === "w" ? "White" : "Black"} to move
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedPly((p) => Math.max(0, p - 1));
                setPreviewFen(null);
              }}
              className="p-3 bg-card border border-border rounded-lg hover:bg-secondary"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 bg-card border border-border rounded-lg px-4 py-3 text-sm space-y-1">
              {current ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono">
                    Ply {current.ply}: {current.san}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${reviewTone(current.label).chip}`}>
                    {current.label}
                  </span>
                </div>
              ) : (
                <span className="text-muted-foreground">Start position</span>
              )}
              <div className="text-xs text-muted-foreground flex items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <Gauge className="w-3 h-3" />
                  Eval {formatEval(liveEvalCp, liveEvalMate)} (d{liveEvalDepth})
                </span>
                {evalLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                {previewFen && <span className="text-primary">Opening line preview mode</span>}
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedPly((p) => Math.min(report!.moves.length, p + 1));
                setPreviewFen(null);
              }}
              className="p-3 bg-card border border-border rounded-lg hover:bg-secondary"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {current && isMistakeLabel(current.label) && (
            <div className="rounded-lg border border-glyph-mistake/40 bg-card p-3">
              {!retryMode ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                      <Lightbulb className="h-4 w-4 text-foreground/80" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">You played a {current.label} here</p>
                      <p className="text-[11px] text-muted-foreground">Hide the game line and find the engine's best move yourself.</p>
                    </div>
                  </div>
                  <button
                    onClick={startRetry}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-gold transition-transform hover:scale-105"
                  >
                    Retry This Move
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      Find the best move for {current.side === "w" ? "White" : "Black"}
                    </p>
                    <button onClick={exitRetry} className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                      Exit retry
                    </button>
                  </div>
                  {retryFeedback ? (
                    <div
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                        retryFeedback.ok
                          ? "border-glyph-best/50 bg-glyph-best/10 text-glyph-best"
                          : "border-glyph-mistake/50 bg-glyph-mistake/10 text-glyph-mistake"
                      }`}
                    >
                      {retryFeedback.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      <span>{retryFeedback.msg}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Click a piece, then its destination square.</p>
                  )}
                  {retrySolved && (
                    <button
                      onClick={exitRetry}
                      className="w-full rounded-md border border-border py-2 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
                    >
                      Back to review
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Blue arrow = best engine move, red arrow = played move. Live evaluation updates during scrubbing.
          </p>
          <p className="text-xs text-muted-foreground">
            Hotkeys: Left/Right to scrub timeline, J/K to jump between Mistakes and Blunders.
          </p>
        </main>

        <aside className="lg:col-span-3 space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 max-h-[42vh] overflow-y-auto">
            <h3 className="font-display text-sm font-semibold mb-3 flex items-center gap-2">
              <Target className="w-4 h-4" />
              Move Review ({filtered.length})
            </h3>
            {criticalPlies.length > 0 && (
              <div className="mb-3 rounded-md border border-border bg-background px-2 py-1 text-[10px] text-muted-foreground">
                Critical plies: {criticalPlies.join(", ")}
              </div>
            )}
            <div className="space-y-1">
              {filtered.map((m) => (
                <button
                  key={m.ply}
                  onClick={() => {
                    setSelectedPly(m.ply);
                    setPreviewFen(null);
                  }}
                  className={`w-full text-left rounded-md px-3 py-2 border transition-colors ${
                    selectedPly === m.ply && !previewFen
                      ? "bg-secondary border-border"
                      : "border-transparent hover:bg-secondary/70"
                  } ${reviewTone(m.label).row}`}
                  style={{ borderLeftWidth: 4 }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-mono text-xs ${reviewTone(m.label).text}`}>
                      {m.ply}. {m.san}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-semibold ${reviewTone(m.label).text}`}>{m.label}</span>
                      <MoveGlyph label={m.label} size={16} />
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    cp loss: {m.cpLoss.toFixed(0)}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 max-h-[36vh] overflow-y-auto space-y-3">
            <h3 className="font-display text-sm font-semibold flex items-center gap-2">
              <BookOpenCheck className="w-4 h-4" />
              Grandmaster Opening Suite
            </h3>
            {openingLoading && (
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                Expanding all theory lines...
              </p>
            )}
            {openingSuite && (
              <>
                <div className="rounded-md border border-border bg-background p-2 text-xs space-y-1">
                  <p className="font-semibold text-foreground">
                    {openingSuite.opening}
                    {openingSuite.variation ? `: ${openingSuite.variation}` : ""}
                  </p>
                  {openingSuite.eco && <p className="text-muted-foreground">ECO {openingSuite.eco}</p>}
                  <p className="text-muted-foreground">Provider: {openingSuite.source === "lichess" ? "Lichess Master DB" : "Cloud Opening Book"}</p>
                  {openingSuite.providerNotice && (
                    <p className="text-[10px] text-muted-foreground">{openingSuite.providerNotice}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">All lines (sound branches)</p>
                  {openingSuite.lines.slice(0, 8).map((line) => (
                    <TheoryNode key={line.id} node={line} activeId={selectedLineId} onPick={onPickTheoryLine} />
                  ))}
                </div>
                {previewLineText && (
                  <div className="rounded-md border border-border bg-background p-2 text-[11px] text-muted-foreground">
                    <p className="font-semibold text-foreground mb-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Selected study line
                    </p>
                    <p>{previewLineText}</p>
                    <button
                      onClick={() => setPreviewFen(null)}
                      className="mt-2 text-xs underline underline-offset-2 hover:text-foreground"
                    >
                      Return to game timeline
                    </button>
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Passed games (exact position)</p>
                  {openingSuite.passedGames.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      No passed games in current provider for this exact position.
                    </p>
                  ) : (
                    openingSuite.passedGames.slice(0, 6).map((game) => (
                      <a
                        key={game.id}
                        href={game.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-md border border-border bg-background px-2 py-1.5 text-[11px] hover:bg-secondary"
                      >
                        <p className="font-semibold text-foreground">{game.white} vs {game.black}</p>
                        <p className="text-muted-foreground">{game.event} {game.year > 0 ? `• ${game.year}` : ""} • {game.result}</p>
                      </a>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground flex items-start gap-2">
            <Swords className="w-3.5 h-3.5 mt-0.5 text-foreground/70" />
            Puzzle logic enforces strict best-move uniqueness by checking MultiPV gap before adding personalized puzzles.
          </div>
          {engineError && (
            <div className="rounded-lg border border-destructive/40 bg-card p-3 text-xs text-destructive">
              Engine error: {engineError}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
