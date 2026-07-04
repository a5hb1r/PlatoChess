import { useState } from "react";
import {
  Zap,
  Shuffle,
  Timer,
  Users,
  Bot,
  LineChart,
  BookOpen,
  CalendarClock,
  Upload,
  Clock,
  Gauge,
  Globe,
  X,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { GuestOnboarding } from "@/components/GuestOnboarding";
import { Slider } from "@/components/ui/slider";
import { PIECE_URLS } from "@/lib/chess-constants";

// ── Static decorative board ───────────────────────────────────────────────────
// Renders a 8×8 CSS grid as visual chrome using the user's chosen piece set.
function DecorativeBoard() {
  const BACK = ["r", "n", "b", "q", "k", "b", "n", "r"];
  const START_CELLS: ({ c: "w" | "b"; t: string } | null)[][] = [
    BACK.map((t) => ({ c: "b" as const, t })),
    BACK.map(() => ({ c: "b" as const, t: "p" })),
    ...Array.from({ length: 4 }, () => Array<null>(8).fill(null)),
    BACK.map(() => ({ c: "w" as const, t: "p" })),
    BACK.map((t) => ({ c: "w" as const, t })),
  ];

  return (
    <div className="relative w-full max-w-[400px] aspect-square rounded-xl overflow-hidden border border-border/50 shadow-xl">
      {START_CELLS.map((row, r) =>
        row.map((cell, c) => {
          const light = (r + c) % 2 === 0;
          return (
            <div
              key={`${r}-${c}`}
              className="absolute flex items-center justify-center"
              style={{
                width: "12.5%",
                height: "12.5%",
                left: `${c * 12.5}%`,
                top: `${r * 12.5}%`,
                background: light
                  ? "hsl(var(--chess-light))"
                  : "hsl(var(--chess-dark))",
              }}
            >
              {cell && (
                <img
                  src={PIECE_URLS[cell.c][cell.t]}
                  alt=""
                  draggable={false}
                  className="h-[88%] w-[88%] select-none"
                  style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" }}
                />
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Play option rows ──────────────────────────────────────────────────────────
interface PlayOption {
  icon: React.ElementType;
  iconBg: string;
  label: string;
  description: string;
  onClick: () => void;
  highlight?: boolean;
}

// ── Time-control picker ───────────────────────────────────────────────────────
const TIME_CATEGORIES = [
  {
    label: "Bullet", icon: Zap, color: "text-yellow-400",
    times: ["1+0","2+1"],
  },
  {
    label: "Blitz", icon: Timer, color: "text-orange-400",
    times: ["3+0","3+2","5+0","5+3"],
  },
  {
    label: "Rapid", icon: Clock, color: "text-sky-400",
    times: ["10+0","15+10","30+0"],
  },
];

// ── Casual mode ELO picker ────────────────────────────────────────────────────
const CASUAL_ELO_MIN = 250;
const CASUAL_ELO_MAX = 2300;
const CASUAL_PRESETS = [400, 800, 1200, 1600, 2000, 2300];

function CasualEloModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [elo, setElo] = useState(800);

  const strengthLabel =
    elo < 500 ? "Beginner"
    : elo < 850 ? "Casual"
    : elo < 1150 ? "Club player"
    : elo < 1500 ? "Tournament player"
    : elo < 1850 ? "Expert"
    : elo < 2100 ? "Master"
    : "Grandmaster";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm px-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.93, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.93, y: 20 }}
          transition={{ duration: 0.25 }}
          className="relative bg-card border border-border rounded-2xl p-7 max-w-md w-full shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-3 mb-1">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600">
              <Gauge className="h-5 w-5 text-white" />
            </span>
            <div>
              <h2 className="font-display text-xl font-bold">Casual Mode</h2>
              <p className="font-body text-xs text-muted-foreground">
                Play any strength — your rating never changes.
              </p>
            </div>
          </div>

          {/* Big ELO readout */}
          <div className="text-center my-6">
            <p className="font-display text-5xl font-bold text-foreground tabular-nums">
              {elo}
            </p>
            <p className="font-body text-xs uppercase tracking-[0.25em] text-muted-foreground mt-1">
              {strengthLabel}
            </p>
          </div>

          {/* Slider */}
          <Slider
            value={[elo]}
            min={CASUAL_ELO_MIN}
            max={CASUAL_ELO_MAX}
            step={50}
            onValueChange={(v) => setElo(v[0])}
            className="mb-5"
            aria-label="Opponent ELO"
          />

          {/* Preset chips */}
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {CASUAL_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setElo(preset)}
                className={`rounded-md border px-3 py-1.5 font-mono text-xs font-medium transition-colors ${
                  elo === preset
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-foreground hover:border-foreground/30"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => navigate(`/game?mode=casual&elo=${elo}`)}
            className="w-full bg-primary py-3 rounded-md font-body text-sm font-semibold text-primary-foreground shadow-gold transition-transform hover:scale-[1.02]"
          >
            Start Casual Game
          </button>
          <p className="mt-3 text-center font-body text-[11px] text-muted-foreground">
            Unrated — win or lose, your ELO stays put.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
const Play = () => {
  const navigate = useNavigate();
  const [casualOpen, setCasualOpen] = useState(false);

  const handleTimeControl = (time: string) => {
    const [minutes, increment] = time.split("+").map(Number);
    navigate(`/game?level=2&mode=practice&min=${minutes || 10}&inc=${increment || 0}`);
  };

  const OPTIONS: PlayOption[] = [
    {
      icon: Bot,
      iconBg: "bg-sky-600",
      label: "Play Bots",
      description: "Challenge a philosopher-bot, Easy to Master",
      onClick: () => navigate("/bots"),
      highlight: true,
    },
    {
      icon: Gauge,
      iconBg: "bg-teal-600",
      label: "Casual Mode",
      description: "Pick any ELO strength — unrated, no ELO at stake",
      onClick: () => setCasualOpen(true),
    },
    {
      icon: Users,
      iconBg: "bg-amber-600",
      label: "Pass & Play",
      description: "Play a friend on this device",
      onClick: () => navigate("/game?mode=friend&min=10&inc=0"),
    },
    {
      icon: CalendarClock,
      iconBg: "bg-green-700",
      label: "Daily Chess",
      description: "Up to 24h per move, no time pressure",
      onClick: () => navigate("/game?level=2&mode=daily"),
    },
  ];

  const COMING_SOON = [
    { icon: Globe, label: "Play Online", desc: "Matchmaking vs players worldwide" },
    { icon: Shuffle, label: "Chess 960", desc: "Randomised starting position" },
  ];

  return (
    <AppLayout>
      {/* First-visit skill calibration — asked here, where the rating is used */}
      <GuestOnboarding />
      <div className="min-h-screen bg-background">
        {/* Casual ELO picker modal */}
        {casualOpen && <CasualEloModal onClose={() => setCasualOpen(false)} />}

        {/* ── Page header ─────────────────────────────────────────── */}
        <div className="border-b border-border/40 px-6 lg:px-10 py-4">
          <h1 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
            ♟ Play Chess
          </h1>
        </div>

        {/* ── Two-column layout ────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-0 min-h-[calc(100vh-57px)]">

          {/* Left — decorative board */}
          <div className="lg:flex-1 flex items-center justify-center bg-secondary/20 p-8 lg:p-12 border-b lg:border-b-0 lg:border-r border-border/30">
            <div className="w-full max-w-[420px]">
              <DecorativeBoard />

              {/* Time controls below the board */}
              <div className="mt-6 space-y-3">
                {TIME_CATEGORIES.map((cat) => (
                  <div key={cat.label}>
                    <p className="flex items-center gap-1.5 font-body text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      <cat.icon className={`h-3.5 w-3.5 ${cat.color}`} />
                      {cat.label}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {cat.times.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => handleTimeControl(t)}
                          className="rounded-md border border-border bg-card px-3.5 py-1.5 font-body text-xs font-medium text-foreground hover:border-primary hover:text-primary transition-colors"
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right — options panel */}
          <div className="lg:w-80 xl:w-96 flex flex-col p-5 lg:p-8 gap-2">
            <h2 className="font-display text-lg font-bold text-foreground mb-2">
              How do you want to play?
            </h2>

            {OPTIONS.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={opt.onClick}
                className={`group flex items-center gap-4 rounded-xl border p-4 text-left transition-all duration-200 ${
                  opt.highlight
                    ? "border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary/60"
                    : "border-border bg-card hover:border-foreground/25 hover:bg-secondary/50"
                }`}
              >
                <span
                  className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${opt.iconBg}`}
                >
                  <opt.icon className="h-5 w-5 text-white" />
                </span>
                <div className="min-w-0">
                  <p className={`font-display text-sm font-semibold ${opt.highlight ? "text-primary" : "text-foreground"}`}>
                    {opt.label}
                  </p>
                  <p className="font-body text-xs text-muted-foreground leading-snug">
                    {opt.description}
                  </p>
                </div>
                <span className="ml-auto text-muted-foreground group-hover:text-foreground text-lg shrink-0">›</span>
              </button>
            ))}

            {/* Divider */}
            <div className="my-2 h-px bg-border/50" />

            {/* Learn / Analyze */}
            <p className="font-body text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              Tools
            </p>
            {[
              { to: "/analyze", icon: LineChart, label: "Analyze Game", desc: "Paste a PGN for Stockfish review" },
              { to: "/openings", icon: BookOpen, label: "Opening Practice", desc: "Drill classical opening lines" },
              { to: "/import", icon: Upload, label: "Import & Review", desc: "Upload a PGN file" },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover:border-foreground/25 hover:bg-secondary/50 transition-all"
              >
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                  <item.icon className="h-5 w-5 text-foreground/70" />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="font-body text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <span className="ml-auto text-muted-foreground group-hover:text-foreground text-lg shrink-0">›</span>
              </Link>
            ))}

            {/* Coming soon */}
            <div className="my-2 h-px bg-border/50" />
            <p className="font-body text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              Coming soon
            </p>
            {COMING_SOON.map((item) => (
              <div
                key={item.label}
                aria-disabled="true"
                className="flex items-center gap-4 rounded-xl border border-border/40 bg-card/50 p-4 opacity-60 select-none"
              >
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                  <item.icon className="h-5 w-5 text-foreground/50" />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-sm font-semibold text-foreground/70">{item.label}</p>
                  <p className="font-body text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <span className="ml-auto shrink-0 rounded-full border border-border px-2 py-0.5 font-body text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Soon
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Play;
