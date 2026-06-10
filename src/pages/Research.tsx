import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Chess, type Square } from "chess.js";
import { motion } from "framer-motion";
import {
  BarChart3,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Crown,
  Library,
  Lock,
  Search,
} from "lucide-react";
import { FAMOUS_GAMES, famousGameTierAvailable, type FamousGame } from "@/data/famous-games";
import { PIECE_URLS } from "@/lib/chess-constants";
import { playMoveSound } from "@/lib/sounds";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";

const TIER_CHIP: Record<string, string> = {
  free: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  pro: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  master: "text-violet-400 bg-violet-400/10 border-violet-400/30",
};

const TITLE_CHIP: Record<string, string> = {
  GM: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  IM: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  FM: "bg-yellow-500/15 text-yellow-200 border-yellow-500/30",
  WCh: "bg-amber-400/15 text-amber-300 border-amber-400/40",
  Legend: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  Engine: "bg-violet-500/15 text-violet-300 border-violet-500/30",
};

function TitleChip({ title }: { title: string }) {
  const cls = TITLE_CHIP[title] ?? "bg-secondary text-muted-foreground border-border";
  return (
    <span className={`rounded border px-1 py-px font-mono text-[9px] font-bold uppercase ${cls}`}>
      {title}
    </span>
  );
}

const Research = () => {
  const navigate = useNavigate();
  const { isPro, isMaster, loading } = useProfile();
  const devMode = import.meta.env.DEV;

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<FamousGame>(FAMOUS_GAMES[0]);
  const [ply, setPly] = useState(0);

  const unlocked = (g: FamousGame) => devMode || famousGameTierAvailable(g, isPro, isMaster);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAMOUS_GAMES;
    return FAMOUS_GAMES.filter((g) =>
      [g.white, g.black, g.nickname ?? "", g.opening, g.event, String(g.year)]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [query]);

  const { fen, lastMove } = useMemo(() => {
    const board = new Chess();
    let last: { from: Square; to: Square } | null = null;
    for (let i = 0; i < ply && i < selected.moves.length; i++) {
      const m = board.move(selected.moves[i]);
      if (!m) break;
      last = { from: m.from as Square, to: m.to as Square };
    }
    return { fen: board.fen(), lastMove: last };
  }, [selected, ply]);

  const display = useMemo(() => new Chess(fen), [fen]);

  const step = (delta: number) => {
    setPly((p) => {
      const next = Math.max(0, Math.min(selected.moves.length, p + delta));
      if (delta > 0 && next > p) {
        const board = new Chess();
        for (let i = 0; i < next; i++) {
          const m = board.move(selected.moves[i]);
          if (m && i === next - 1) playMoveSound(m, board.isCheck());
        }
      }
      return next;
    });
  };

  const pickGame = (g: FamousGame) => {
    if (!unlocked(g)) {
      navigate("/pricing");
      return;
    }
    setSelected(g);
    setPly(0);
  };

  const openInAnalysis = () => {
    const board = new Chess();
    board.header(
      "White", selected.white,
      "Black", selected.black,
      "Event", selected.event,
      "Date", String(selected.year),
      "Result", selected.result
    );
    for (const san of selected.moves) board.move(san);
    navigate("/analyze", { state: { pgn: board.pgn(), source: "research" } });
  };

  const selectedLocked = !unlocked(selected);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/40 px-6 lg:px-10 py-4 flex items-center gap-3">
        <h1 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
          <Library className="h-5 w-5 text-primary" />
          Research
        </h1>
        <p className="hidden md:block font-body text-xs text-muted-foreground">
          Landmark games from the masters — study the classics move by move.
        </p>
        <span className="ml-auto flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-body text-xs font-semibold text-amber-400">
          <Crown className="h-3 w-3" />
          {FAMOUS_GAMES.filter((g) => g.tier === "free").length} free ·{" "}
          {FAMOUS_GAMES.length} total
        </span>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── Game list ─────────────────────────────────────────────── */}
        <aside className="lg:col-span-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search players, openings, years…"
              className="w-full rounded-md border border-border bg-card pl-10 pr-4 py-2.5 font-body text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground/35 focus:outline-none focus:ring-1 focus:ring-foreground/25"
            />
          </div>

          <div className="rounded-lg border border-border bg-card max-h-[calc(100vh-220px)] overflow-y-auto divide-y divide-border">
            {loading ? (
              <div className="p-6 text-center font-body text-sm text-muted-foreground">
                Loading…
              </div>
            ) : (
              filtered.map((g) => {
                const open = unlocked(g);
                const active = selected.id === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => pickGame(g)}
                    className={cn(
                      "w-full text-left px-4 py-3 transition-colors hover:bg-secondary/60",
                      active && "bg-secondary border-l-2 border-primary",
                      !open && "opacity-60"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm font-semibold text-foreground truncate">
                        {g.nickname || `${g.white} vs ${g.black}`}
                      </span>
                      {!open && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />}
                      <span
                        className={`ml-auto shrink-0 rounded-full border px-2 py-0.5 font-body text-[9px] font-semibold uppercase tracking-wider ${TIER_CHIP[g.tier]}`}
                      >
                        {g.tier}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 font-body text-xs text-muted-foreground">
                      <TitleChip title={g.whiteTitle} />
                      <span className="truncate">{g.white}</span>
                      <span>–</span>
                      <TitleChip title={g.blackTitle} />
                      <span className="truncate">{g.black}</span>
                    </div>
                    <p className="mt-0.5 font-body text-[11px] text-muted-foreground">
                      {g.event} · {g.year} · {g.result}
                      {g.eco ? ` · ${g.eco}` : ""}
                    </p>
                  </button>
                );
              })
            )}
            {!loading && filtered.length === 0 && (
              <div className="p-6 text-center font-body text-sm text-muted-foreground">
                No games match "{query}".
              </div>
            )}
          </div>
        </aside>

        {/* ── Viewer ────────────────────────────────────────────────── */}
        <main className="lg:col-span-8 space-y-4">
          {selectedLocked ? (
            <div className="rounded-lg border border-border bg-card p-10 text-center space-y-4">
              <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
              <h2 className="font-display text-xl font-bold">
                This game requires {selected.tier === "master" ? "Master" : "Pro"}
              </h2>
              <p className="font-body text-sm text-muted-foreground max-w-md mx-auto">
                Upgrade to study {selected.nickname || "this game"} move by move with engine
                analysis.
              </p>
              <button
                type="button"
                onClick={() => navigate("/pricing")}
                className="bg-primary px-8 py-3 rounded-md font-body text-sm font-semibold text-primary-foreground shadow-gold transition-transform hover:scale-[1.02]"
              >
                View plans
              </button>
            </div>
          ) : (
            <>
              {/* Game header */}
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-lg font-bold text-foreground">
                    {selected.nickname || `${selected.white} vs ${selected.black}`}
                  </h2>
                  <span className="font-mono text-xs text-muted-foreground">
                    {selected.eco} · {selected.opening}
                  </span>
                  <span className="ml-auto font-mono text-sm font-semibold text-foreground">
                    {selected.result}
                  </span>
                </div>
                <p className="mt-1 font-body text-xs text-muted-foreground">
                  {selected.white} ({selected.whiteTitle}) vs {selected.black} (
                  {selected.blackTitle}) · {selected.event}, {selected.year}
                </p>
                <p className="mt-2 font-body text-sm text-foreground/80 leading-relaxed">
                  {selected.description}
                </p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {/* Board */}
                <div>
                  <div className="rounded-lg overflow-hidden border border-border shadow-elevated aspect-square grid grid-cols-8 grid-rows-8">
                    {Array.from({ length: 64 }, (_, i) => {
                      const row = Math.floor(i / 8);
                      const col = i % 8;
                      const square = `${String.fromCharCode(97 + col)}${8 - row}` as Square;
                      const piece = display.get(square);
                      const isDark = (row + col) % 2 === 1;
                      const isLast = lastMove?.from === square || lastMove?.to === square;
                      return (
                        <div
                          key={square}
                          className={cn(
                            "relative flex items-center justify-center",
                            isDark ? "bg-chess-dark" : "bg-chess-light"
                          )}
                        >
                          {isLast && (
                            <div
                              className="absolute inset-0"
                              style={{ backgroundColor: "rgba(245,200,68,0.30)" }}
                            />
                          )}
                          {piece && (
                            <img
                              src={PIECE_URLS[piece.color][piece.type]}
                              alt=""
                              className="relative w-[82%] h-[82%] object-contain pointer-events-none"
                              draggable={false}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Controls */}
                  <div className="mt-2 flex items-stretch gap-1.5">
                    <button
                      onClick={() => setPly(0)}
                      className="rounded-lg border border-border bg-card p-2.5 hover:bg-secondary transition-colors"
                      aria-label="Start"
                    >
                      <ChevronFirst className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => step(-1)}
                      disabled={ply <= 0}
                      className="rounded-lg border border-border bg-card p-2.5 hover:bg-secondary transition-colors disabled:opacity-40"
                      aria-label="Previous move"
                    >
                      <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <div className="flex flex-1 items-center justify-center rounded-lg border border-border bg-card font-mono text-xs text-muted-foreground">
                      {ply} / {selected.moves.length}
                    </div>
                    <button
                      onClick={() => step(1)}
                      disabled={ply >= selected.moves.length}
                      className="rounded-lg border border-border bg-card p-2.5 hover:bg-secondary transition-colors disabled:opacity-40"
                      aria-label="Next move"
                    >
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => setPly(selected.moves.length)}
                      className="rounded-lg border border-border bg-card p-2.5 hover:bg-secondary transition-colors"
                      aria-label="End"
                    >
                      <ChevronLast className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>

                {/* Moves + actions */}
                <div className="space-y-3">
                  <div className="rounded-lg border border-border bg-card p-4 max-h-[380px] overflow-y-auto">
                    <h3 className="font-display text-xs uppercase tracking-wider text-muted-foreground mb-3">
                      Moves
                    </h3>
                    <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-0.5 font-mono text-xs">
                      {Array.from(
                        { length: Math.ceil(selected.moves.length / 2) },
                        (_, n) => {
                          const wIdx = n * 2;
                          const bIdx = n * 2 + 1;
                          return (
                            <div key={n} className="contents">
                              <span className="text-muted-foreground/60">{n + 1}.</span>
                              <button
                                type="button"
                                onClick={() => setPly(wIdx + 1)}
                                className={cn(
                                  "text-left rounded px-1 hover:bg-secondary transition-colors",
                                  ply === wIdx + 1
                                    ? "bg-primary/15 text-primary font-semibold"
                                    : "text-foreground/85"
                                )}
                              >
                                {selected.moves[wIdx]}
                              </button>
                              {selected.moves[bIdx] ? (
                                <button
                                  type="button"
                                  onClick={() => setPly(bIdx + 1)}
                                  className={cn(
                                    "text-left rounded px-1 hover:bg-secondary transition-colors",
                                    ply === bIdx + 1
                                      ? "bg-primary/15 text-primary font-semibold"
                                      : "text-foreground/85"
                                  )}
                                >
                                  {selected.moves[bIdx]}
                                </button>
                              ) : (
                                <span />
                              )}
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={openInAnalysis}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary py-3 font-body text-sm font-semibold text-primary-foreground shadow-gold transition-transform hover:scale-[1.01]"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Open in Analysis
                  </button>
                  <p className="font-body text-[11px] text-muted-foreground text-center">
                    Runs the full Stockfish review on this game.
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

export default Research;
