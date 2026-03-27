import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Filter, Target } from "lucide-react";
import { Chess, Square } from "chess.js";
import { PIECE_URLS } from "@/lib/chess-constants";
import { loadLatestGameReview, scoreForLabel, type ReviewedPly } from "@/lib/game-review";
import { reviewTone } from "@/lib/review-colors";

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

type FilterId = "all" | "good" | "errors" | "critical" | "white" | "black";
const MISTAKE_LABELS = new Set(["Inaccuracy", "Miss", "Mistake", "Blunder"]);

function isMistakeLike(label: string): boolean {
  return MISTAKE_LABELS.has(label);
}

export default function AnalyzeGame() {
  const report = useMemo(() => loadLatestGameReview(), []);
  const moves = useMemo(() => report?.moves ?? [], [report]);
  const [filter, setFilter] = useState<FilterId>("all");
  const [onlyMistakes, setOnlyMistakes] = useState(false);
  const [selectedPly, setSelectedPly] = useState<number>(moves.length);

  const filtered = moves.filter((m) => {
    if (onlyMistakes && !isMistakeLike(m.label)) return false;
    if (filter === "all") return true;
    if (filter === "white") return m.side === "w";
    if (filter === "black") return m.side === "b";
    if (filter === "critical") return m.label === "Mistake" || m.label === "Blunder";
    if (filter === "errors") return isMistakeLike(m.label);
    return m.label === "Brilliant" || m.label === "Great" || m.label === "Best" || m.label === "Excellent" || m.label === "Good";
  });

  const boundedPly = Math.max(0, Math.min(selectedPly, moves.length));
  const current: ReviewedPly | null = boundedPly > 0 ? moves[boundedPly - 1] : null;
  const boardFen = current?.fenAfter ?? new Chess().fen();
  const display = new Chess(boardFen);
  const best = parseUci(current?.bestUci);
  const played = parseUci(current?.playedUci);
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

  const jumpCritical = useCallback((direction: 1 | -1) => {
    if (!criticalPlies.length) return;
    const sorted = [...criticalPlies].sort((a, b) => a - b);
    if (direction > 0) {
      const next = sorted.find((ply) => ply > boundedPly) ?? sorted[0];
      setSelectedPly(next);
      return;
    }
    const prev = [...sorted].reverse().find((ply) => ply < boundedPly) ?? sorted[sorted.length - 1];
    setSelectedPly(prev);
  }, [boundedPly, criticalPlies]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") setSelectedPly((p) => Math.max(0, p - 1));
      if (e.key === "ArrowRight") setSelectedPly((p) => Math.min(moves.length, p + 1));
      if (e.key.toLowerCase() === "j") jumpCritical(-1);
      if (e.key.toLowerCase() === "k") jumpCritical(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [jumpCritical, moves.length]);

  const toPercent = (n: number) => `${Math.max(0, Math.min(100, n * 100)).toFixed(2)}%`;
  const line = (arrow: { from: Square; to: Square } | null, color: string) => {
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

  if (!report) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-6 py-12 max-w-3xl space-y-4">
          <Link to="/game" className="text-sm text-muted-foreground hover:text-foreground">
            Back to game
          </Link>
          <h1 className="font-display text-3xl font-semibold">No analyzed game found</h1>
          <p className="font-body text-muted-foreground">
            Finish a game and click "Analyze Completed Game" first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center gap-4 px-6 py-4">
          <Link to="/game" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <h1 className="font-display text-xl font-semibold">Post-Game Analysis</h1>
          <span className="ml-auto text-xs text-muted-foreground border border-border rounded-full px-3 py-1">
            {report.engine}
          </span>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-6 max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-3 space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <p className="font-display text-sm font-semibold">Accuracy</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-border bg-background p-2">
                <p className="text-[10px] text-muted-foreground uppercase">White</p>
                <p className="font-mono text-lg">{report.accuracy.w.toFixed(1)}%</p>
              </div>
              <div className="rounded-md border border-border bg-background p-2">
                <p className="text-[10px] text-muted-foreground uppercase">Black</p>
                <p className="font-mono text-lg">{report.accuracy.b.toFixed(1)}%</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{report.result}</p>
            <div className="rounded-md border border-border bg-background p-2">
              <p className="text-[10px] text-muted-foreground uppercase mb-2">Trend</p>
              <svg viewBox="0 0 100 100" className="w-full h-16">
                <line x1="0" y1="100" x2="100" y2="100" stroke="hsl(var(--border))" strokeWidth="1" />
                <polyline
                  points={trend.wPoints}
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <polyline
                  points={trend.bPoints}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-[#e5e7eb]" />
                  White
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-[#94a3b8]" />
                  Black
                </span>
              </div>
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
              Show only colored mistake moves
            </label>
          </div>
        </aside>

        <main className="lg:col-span-6 space-y-4">
          <div className="rounded-lg overflow-hidden border border-border shadow-elevated aspect-square relative">
            <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
              {Array.from({ length: 64 }, (_, i) => {
                const row = Math.floor(i / 8);
                const col = i % 8;
                const sq = `${String.fromCharCode(97 + col)}${8 - row}` as Square;
                const isDark = (row + col) % 2 === 1;
                const piece = display.get(sq);
                return (
                  <div key={sq} className={`relative ${isDark ? "bg-chess-dark" : "bg-chess-light"}`}>
                    {piece && (
                      <img
                        src={PIECE_URLS[piece.color][piece.type]}
                        alt=""
                        className="w-[82%] h-[82%] object-contain absolute inset-0 m-auto pointer-events-none"
                        draggable={false}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <polygon points="0 0, 6 3, 0 6" fill="currentColor" />
                </marker>
              </defs>
              <g style={{ color: "#7dd3fc" }}>{line(best, "currentColor")}</g>
              <g style={{ color: "#f87171" }}>{line(played, "currentColor")}</g>
            </svg>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedPly((p) => Math.max(0, p - 1))}
              className="p-3 bg-card border border-border rounded-lg hover:bg-secondary"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 bg-card border border-border rounded-lg px-4 py-3 text-sm">
              {current ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono">
                    Ply {current.ply}: {current.san}
                  </span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${reviewTone(current.label).chip}`}
                  >
                    {current.label}
                  </span>
                </div>
              ) : (
                <span className="text-muted-foreground">Start position</span>
              )}
            </div>
            <button
              onClick={() => setSelectedPly((p) => Math.min(report.moves.length, p + 1))}
              className="p-3 bg-card border border-border rounded-lg hover:bg-secondary"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            Blue arrow = engine best move, red arrow = played move (for selected ply).
          </p>
          <p className="text-xs text-muted-foreground">
            Hotkeys: Left/Right to step moves, J/K to jump between Mistakes/Blunders.
          </p>
        </main>

        <aside className="lg:col-span-3">
          <div className="rounded-lg border border-border bg-card p-4 max-h-[75vh] overflow-y-auto">
            <h3 className="font-display text-sm font-semibold mb-3 flex items-center gap-2">
              <Target className="w-4 h-4" />
              Move Review ({filtered.length})
            </h3>
            {criticalPlies.length > 0 && (
              <div className="mb-3 rounded-md border border-border bg-background px-2 py-1 text-[10px] text-muted-foreground">
                Critical moves: {criticalPlies.join(", ")}
              </div>
            )}
            <div className="space-y-1">
              {filtered.map((m) => (
                <button
                  key={m.ply}
                  onClick={() => setSelectedPly(m.ply)}
                  className={`w-full text-left rounded-md px-3 py-2 border transition-colors ${
                    selectedPly === m.ply
                      ? "bg-secondary border-border"
                      : "border-transparent hover:bg-secondary/70"
                  } ${reviewTone(m.label).row}`}
                  style={{ borderLeftWidth: 4 }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-mono text-xs ${reviewTone(m.label).text}`}>
                      {m.ply}. {m.san}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${reviewTone(m.label).chip}`}
                    >
                      {m.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    cp loss: {m.cpLoss.toFixed(0)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
