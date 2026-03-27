import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Chess, Square } from "chess.js";
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, GraduationCap, RotateCcw } from "lucide-react";
import {
  OPENING_CHAPTERS,
  OPENING_FAMILIES,
  OPENING_LINES,
  type OpeningLine,
} from "@/data/openings";
import { PIECE_URLS } from "@/lib/chess-constants";
import { playMoveSound } from "@/lib/sounds";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const Openings = () => {
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

  return (
    <div className="min-h-screen bg-background">
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
            Opening <span className="text-gradient-brand">Practice</span>
          </h1>
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
                    const first = OPENING_LINES.find((l) => l.family === f);
                    if (first) onPickLine(first);
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
              {linesInFamily.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => onPickLine(l)}
                    className={cn(
                      "w-full text-left px-4 py-3 font-body text-sm transition-colors hover:bg-secondary",
                      line?.id === l.id && "bg-secondary border-l-2 border-foreground/40"
                    )}
                  >
                    <span className="font-semibold text-foreground block">{l.name}</span>
                    {l.eco && <span className="text-xs text-muted-foreground">ECO {l.eco}</span>}
                    <span className="text-xs text-muted-foreground block mt-0.5">
                      Depth {l.moves.length} plies
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <main className="lg:col-span-8 space-y-6">
          {line && (
            <>
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

                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="font-display text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
                    Main line (SAN)
                  </h3>
                  <div className="font-mono text-xs leading-7 text-foreground flex flex-wrap gap-x-2 gap-y-1">
                    {line.moves.map((mv, i) => (
                      <span
                        key={i}
                        className={cn(
                          i < ply && "text-muted-foreground",
                          i === ply && "text-foreground/75 font-semibold"
                        )}
                      >
                        {mv}
                        {i < line.moves.length - 1 ? " - " : ""}
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground font-body">
                    {OPENING_LINES.length} named lines across major families - extend{" "}
                    <code className="text-foreground/70">src/data/openings.ts</code> anytime.
                  </p>
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
