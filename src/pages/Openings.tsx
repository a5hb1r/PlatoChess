import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Chess, Square } from "chess.js";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  RotateCcw,
  Target,
  Lock,
  Crown,
  Lightbulb,
} from "lucide-react";
import {
  OPENING_CHAPTERS,
  OPENING_FAMILIES,
  OPENING_LINES,
  openingLineAvailable,
  type OpeningLine,
} from "@/data/openings";
import { PIECE_URLS } from "@/lib/chess-constants";
import { playMoveSound } from "@/lib/sounds";
import { useProfile } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TIER_CHIP: Record<string, string> = {
  free: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  pro: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  master: "text-violet-400 bg-violet-400/10 border-violet-400/30",
};

const Openings = () => {
  const navigate = useNavigate();
  const { isPro, isMaster } = useProfile();
  const devMode = import.meta.env.DEV;

  const unlocked = (l: OpeningLine) => devMode || openingLineAvailable(l, isPro, isMaster);

  const [family, setFamily] = useState<string>(OPENING_FAMILIES[0]);
  const [line, setLine] = useState<OpeningLine | null>(OPENING_LINES[0] ?? null);
  const [ply, setPly] = useState(0);
  const [quiz, setQuiz] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const linesInFamily = useMemo(() => OPENING_LINES.filter((l) => l.family === family), [family]);
  const chapters = useMemo(() => OPENING_CHAPTERS.filter((c) => c.family === family), [family]);

  const { fen, sideToMove, expectedSan } = useMemo(() => {
    const g = new Chess();
    if (!line) return { fen: g.fen(), sideToMove: "w" as const, expectedSan: null as string | null };
    for (let i = 0; i < ply && i < line.moves.length; i++) {
      const m = g.move(line.moves[i]);
      if (!m) break;
    }
    const expected = line.moves[ply] ?? null;
    return { fen: g.fen(), sideToMove: g.turn(), expectedSan: expected };
  }, [line, ply]);

  const displayGame = new Chess(fen);

  /** Theory note for the most recently played move (null at the start). */
  const currentTheory = line && ply > 0 ? line.theory[ply - 1] : null;
  const nextTheory = line && ply < line.moves.length ? line.theory[ply] : null;

  const goStart = () => {
    setPly(0);
    setFeedback(null);
  };

  const step = (delta: number) => {
    if (!line) return;
    setPly((p) => Math.max(0, Math.min(line.moves.length, p + delta)));
    setFeedback(null);
  };

  const onPickLine = (l: OpeningLine) => {
    if (!unlocked(l)) {
      navigate("/pricing");
      return;
    }
    setLine(l);
    setPly(0);
    setFeedback(null);
  };

  const [pickFrom, setPickFrom] = useState<Square | null>(null);

  const onSquare = (sq: Square) => {
    if (!quiz || !line || !expectedSan) return;
    const trial = new Chess(fen);
    const piece = trial.get(sq);

    if (!pickFrom) {
      if (piece && piece.color === trial.turn()) {
        setPickFrom(sq);
        setFeedback(null);
      }
      return;
    }

    const m = trial.move({ from: pickFrom, to: sq, promotion: "q" });
    setPickFrom(null);
    if (!m) {
      setFeedback("Illegal try again.");
      return;
    }
    const ref = new Chess(fen);
    const ok = ref.move(expectedSan);
    if (!ok) {
      setFeedback("Line data error.");
      return;
    }
    if (m.san === ok.san) {
      playMoveSound(m, trial.isCheck());
      setPly((p) => p + 1);
      setFeedback("Correct - book move!");
    } else {
      setFeedback(`Expected ${expectedSan}, played ${m.san}`);
    }
  };

  const freeCount = OPENING_LINES.filter((l) => l.tier === "free").length;

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 py-0">
          <div className="flex items-center gap-4 pt-3">
            <Link
              to="/play"
              className="flex items-center gap-2 font-body text-sm text-muted-foreground transition-colors hover:text-foreground shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <h1 className="font-display text-xl font-semibold">
              Puzzles <span className="text-gradient-brand">&amp; Openings</span>
            </h1>
            <div className="ml-auto flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-body text-xs font-semibold text-amber-400">
                <Crown className="h-3 w-3" />
                {freeCount} free · {OPENING_LINES.length} lines with full theory
              </span>
            </div>
          </div>
          {/* Tab bar */}
          <div className="flex gap-0 mt-3">
            <button
              onClick={() => navigate("/puzzles")}
              className="flex items-center gap-2 px-4 py-2.5 font-body text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors"
            >
              <Target className="w-4 h-4" />
              Puzzles
            </button>
            <button
              onClick={() => {/* already on openings */}}
              className="flex items-center gap-2 px-4 py-2.5 font-body text-sm font-semibold border-b-2 border-primary text-foreground transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              Openings
            </button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-7xl grid lg:grid-cols-12 gap-8">
        <aside className="lg:col-span-4 space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="font-display text-xs uppercase tracking-wider text-muted-foreground mb-2">
              MCO-inspired chapter map
            </p>
            <ul className="space-y-1">
              {chapters.map((c) => (
                <li key={c.chapter} className="font-body text-xs text-muted-foreground">
                  - {c.chapter}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-foreground/75 mb-2 font-body">Family</p>
            <div className="flex flex-wrap gap-2">
              {OPENING_FAMILIES.map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={family === f ? "default" : "outline"}
                  className={family === f ? "bg-primary text-primary-foreground" : ""}
                  onClick={() => {
                    setFamily(f);
                    const first = OPENING_LINES.find(
                      (l) => l.family === f && (devMode || openingLineAvailable(l, isPro, isMaster))
                    ) ?? OPENING_LINES.find((l) => l.family === f);
                    if (first && unlocked(first)) onPickLine(first);
                  }}
                >
                  {f}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card max-h-[420px] overflow-y-auto">
            <div className="p-3 border-b border-border flex items-center gap-2 font-display text-sm font-semibold">
              <BookOpen className="h-4 w-4 text-foreground/75" />
              Lines ({linesInFamily.length})
            </div>
            <ul className="divide-y divide-border">
              {linesInFamily.map((l) => {
                const open = unlocked(l);
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => onPickLine(l)}
                      className={cn(
                        "w-full text-left px-4 py-3 font-body text-sm transition-colors hover:bg-secondary",
                        line?.id === l.id && "bg-secondary border-l-2 border-foreground/40",
                        !open && "opacity-60"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{l.name}</span>
                        {!open && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />}
                        <span
                          className={`ml-auto shrink-0 rounded-full border px-2 py-0.5 font-body text-[9px] font-semibold uppercase tracking-wider ${TIER_CHIP[l.tier]}`}
                        >
                          {l.tier}
                        </span>
                      </span>
                      {l.eco && <span className="text-xs text-muted-foreground">ECO {l.eco}</span>}
                      <span className="text-xs text-muted-foreground block mt-0.5">
                        Depth {l.moves.length} plies · theory on every move
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        <main className="lg:col-span-8 space-y-6">
          {line && (
            <>
              {/* Line summary */}
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-lg font-bold">{line.name}</h2>
                  {line.eco && (
                    <span className="font-mono text-xs text-muted-foreground">ECO {line.eco}</span>
                  )}
                  <span
                    className={`ml-auto rounded-full border px-2 py-0.5 font-body text-[10px] font-semibold uppercase tracking-wider ${TIER_CHIP[line.tier]}`}
                  >
                    {line.tier}
                  </span>
                </div>
                <p className="mt-1.5 font-body text-sm text-foreground/80 leading-relaxed">
                  {line.summary}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" size="icon" onClick={goStart}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" disabled={ply <= 0} onClick={() => step(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={ply >= line.moves.length}
                  onClick={() => step(1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <span className="font-mono text-sm text-muted-foreground">
                  Ply {ply}/{line.moves.length}
                </span>
                <Button
                  variant={quiz ? "default" : "outline"}
                  className={quiz ? "bg-primary text-primary-foreground" : ""}
                  onClick={() => {
                    setQuiz(!quiz);
                    setPickFrom(null);
                    setFeedback(null);
                  }}
                >
                  <GraduationCap className="h-4 w-4 mr-2" />
                  {quiz ? "Quiz on" : "Quiz mode"}
                </Button>
              </div>

              {quiz && (
                <p className="text-sm font-body text-muted-foreground">
                  {expectedSan
                    ? `${sideToMove === "w" ? "White" : "Black"} to play - find the book move.`
                    : "Line complete."}
                </p>
              )}
              {feedback && (
                <p className="text-sm font-body text-foreground/75 border border-border rounded-md px-3 py-2 bg-card">
                  {feedback}
                </p>
              )}

              {/* Theory note for the current position */}
              <div className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 flex items-start gap-3">
                <Lightbulb className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <div className="font-body text-sm text-foreground/85 leading-relaxed">
                  {ply === 0 ? (
                    <>
                      <span className="font-semibold">Starting position.</span>{" "}
                      {nextTheory
                        ? `Next: ${line.moves[0]} — ${nextTheory}`
                        : "Step through the line to read the theory for every move."}
                    </>
                  ) : (
                    <>
                      <span className="font-mono font-semibold">
                        {Math.ceil(ply / 2)}.{ply % 2 === 0 ? ".." : ""} {line.moves[ply - 1]}
                      </span>{" "}
                      — {currentTheory}
                      {!quiz && nextTheory && (
                        <span className="block mt-1 text-xs text-muted-foreground">
                          Next: {line.moves[ply]} — {nextTheory}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="rounded-lg overflow-hidden border border-border shadow-elevated aspect-square max-w-[480px] w-full mx-auto grid grid-cols-8 grid-rows-8">
                  {Array.from({ length: 64 }, (_, i) => {
                    const row = Math.floor(i / 8);
                    const col = i % 8;
                    const square = `${String.fromCharCode(97 + col)}${8 - row}` as Square;
                    const piece = displayGame.get(square);
                    const isDark = (row + col) % 2 === 1;
                    const hl = pickFrom === square;
                    return (
                      <button
                        key={square}
                        type="button"
                        disabled={!quiz || !expectedSan}
                        onClick={() => onSquare(square)}
                        className={cn(
                          "relative flex items-center justify-center p-0 border-0",
                          isDark ? "bg-chess-dark" : "bg-chess-light",
                          hl && "ring-2 ring-foreground/40 ring-inset",
                          (!quiz || !expectedSan) && "cursor-default opacity-90"
                        )}
                      >
                        {piece && (
                          <img
                            src={PIECE_URLS[piece.color][piece.type]}
                            alt=""
                            className="w-[82%] h-[82%] object-contain pointer-events-none"
                            draggable={false}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Annotated move list */}
                <div className="rounded-lg border border-border bg-card p-4 max-h-[480px] overflow-y-auto">
                  <h3 className="font-display text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
                    Theory — move by move
                  </h3>
                  <ol className="space-y-1.5">
                    {line.moves.map((mv, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => !quiz && setPly(i + 1)}
                          className={cn(
                            "w-full text-left rounded-md px-2 py-1.5 transition-colors",
                            i === ply - 1
                              ? "bg-primary/15 border border-primary/30"
                              : "hover:bg-secondary border border-transparent",
                            i >= ply && "opacity-70"
                          )}
                        >
                          <span className="font-mono text-xs font-semibold text-foreground">
                            {Math.ceil((i + 1) / 2)}.{i % 2 === 1 ? ".." : ""} {mv}
                          </span>
                          <span className="block font-body text-[11px] text-muted-foreground leading-snug mt-0.5">
                            {line.theory[i]}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default Openings;
