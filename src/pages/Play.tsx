import { useEffect, useState } from "react";
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
  Crown,
  Clock,
  Loader2,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";

// ── Static decorative board ───────────────────────────────────────────────────
// Renders a 8×8 CSS grid as visual chrome (no chess logic needed).
function DecorativeBoard() {
  const START_FEN_SYMBOLS: (string | null)[][] = [
    ["♜","♞","♝","♛","♚","♝","♞","♜"],
    ["♟","♟","♟","♟","♟","♟","♟","♟"],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    ["♙","♙","♙","♙","♙","♙","♙","♙"],
    ["♖","♘","♗","♕","♔","♗","♘","♖"],
  ];

  return (
    <div className="relative w-full max-w-[400px] aspect-square rounded-xl overflow-hidden border border-border/50 shadow-xl">
      {START_FEN_SYMBOLS.map((row, r) =>
        row.map((piece, c) => {
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
                  ? "hsl(var(--ivory) / 1)"
                  : "hsl(var(--walnut) / 0.9)",
              }}
            >
              {piece && (
                <span
                  className="select-none"
                  style={{
                    fontSize: "clamp(14px, 3.5vw, 28px)",
                    lineHeight: 1,
                    filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))",
                  }}
                >
                  {piece}
                </span>
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

// ── Main component ────────────────────────────────────────────────────────────
const Play = () => {
  const { user } = useAuth();
  const [maxActiveGames, setMaxActiveGames] = useState(3);
  const [activeGameCount, setActiveGameCount] = useState(0);
  const [loadingGate, setLoadingGate] = useState(false);
  const navigate = useNavigate();

  const fetchActiveGameCount = async (userId: string) => {
    const { data, error } = await supabase.rpc("get_active_game_count", { p_user_id: userId });
    if (error) return 0;
    return typeof data === "number" ? data : 0;
  };

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    setLoadingGate(true);
    Promise.all([
      supabase.from("profiles").select("max_active_games").eq("user_id", user.id).maybeSingle(),
      fetchActiveGameCount(user.id),
    ]).then(([prof, count]) => {
      if (!mounted) return;
      if (prof.data?.max_active_games) setMaxActiveGames(prof.data.max_active_games);
      setActiveGameCount(count);
    }).finally(() => { if (mounted) setLoadingGate(false); });
    return () => { mounted = false; };
  }, [user]);

  const handleOnlinePlay = async () => {
    if (user) {
      setLoadingGate(true);
      const count = await fetchActiveGameCount(user.id);
      setActiveGameCount(count);
      setLoadingGate(false);
      if (count >= maxActiveGames) {
        toast.error(`Active game limit (${count}/${maxActiveGames}). Finish a game first.`);
        return;
      }
    }
    toast.message("Matchmaking coming soon — opening a practice game.");
    navigate("/game?level=2&mode=online");
  };

  const handleTimeControl = async (time: string) => {
    if (user) {
      const count = await fetchActiveGameCount(user.id);
      if (count >= maxActiveGames) {
        toast.error(`Active game limit (${count}/${maxActiveGames}).`);
        return;
      }
    }
    navigate(`/game?level=2&mode=standard&time=${encodeURIComponent(time)}`);
  };

  const OPTIONS: PlayOption[] = [
    {
      icon: Zap,
      iconBg: "bg-yellow-500",
      label: "Play Online",
      description: "Play vs a person of similar skill",
      onClick: handleOnlinePlay,
      highlight: true,
    },
    {
      icon: Bot,
      iconBg: "bg-sky-600",
      label: "Play Bots",
      description: "Challenge a bot from Easy to Master",
      onClick: () => navigate("/bots"),
    },
    {
      icon: Users,
      iconBg: "bg-amber-600",
      label: "Play a Friend",
      description: "Invite a friend to a game of chess",
      onClick: () => { toast.message("Friend invites coming soon!"); },
    },
    {
      icon: CalendarClock,
      iconBg: "bg-green-700",
      label: "Daily Chess",
      description: "Up to 24h per move, no time pressure",
      onClick: () => navigate("/game?level=2&mode=daily"),
    },
    {
      icon: Shuffle,
      iconBg: "bg-purple-600",
      label: "Chess 960",
      description: "Randomised starting position",
      onClick: () => navigate("/game?level=2&mode=standard&variant=chess960"),
    },
  ];

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
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

              {user && (
                <p className="mt-4 font-body text-[11px] text-muted-foreground text-center">
                  {loadingGate ? (
                    <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Checking games…</span>
                  ) : (
                    `Active games: ${activeGameCount} / ${maxActiveGames}`
                  )}
                </p>
              )}
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
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Play;
