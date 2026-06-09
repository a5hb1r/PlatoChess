import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Swords,
  Puzzle,
  BarChart2,
  BookOpen,
  Bot,
  Loader2,
  CheckCircle2,
  XCircle,
  Minus,
  Trophy,
  TrendingUp,
  Gamepad2,
  Upload,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/use-profile";
import { AppLayout } from "@/components/AppLayout";
import {
  getGameHistory,
  getGameHistoryForUser,
  type GameHistoryEntry,
} from "@/lib/game-review";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  const diff = Date.now() - ts;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ResultIcon({ result }: { result: GameHistoryEntry["result"] }) {
  if (result === "win")
    return (
      <span className="flex items-center gap-1 text-emerald-400 font-semibold text-xs">
        <CheckCircle2 className="h-3.5 w-3.5" /> Win
      </span>
    );
  if (result === "loss")
    return (
      <span className="flex items-center gap-1 text-rose-400 font-semibold text-xs">
        <XCircle className="h-3.5 w-3.5" /> Loss
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-muted-foreground font-semibold text-xs">
      <Minus className="h-3.5 w-3.5" /> Draw
    </span>
  );
}

// ── Quick-action cards ────────────────────────────────────────────────────────

interface ActionCard {
  to: string;
  icon: React.ElementType;
  iconBg: string;
  title: string;
  subtitle: string;
  stat?: string | number;
  statLabel?: string;
}

const ACTION_CARDS: ActionCard[] = [
  {
    to: "/puzzles",
    icon: Puzzle,
    iconBg: "bg-orange-500",
    title: "Puzzles",
    subtitle: "Sharpen your tactics",
    statLabel: "Solve now",
  },
  {
    to: "/bots",
    icon: Bot,
    iconBg: "bg-sky-600",
    title: "Play a Bot",
    subtitle: "Challenge a philosopher",
    statLabel: "Choose bot",
  },
  {
    to: "/analyze",
    icon: BarChart2,
    iconBg: "bg-emerald-600",
    title: "Game Review",
    subtitle: "Learn from your mistakes",
    statLabel: "Analyze",
  },
];

// ── Main component ────────────────────────────────────────────────────────────

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const navigate = useNavigate();
  const [gameHistory, setGameHistory] = useState<GameHistoryEntry[]>([]);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  // Load history: localStorage first, then Supabase
  useEffect(() => {
    setGameHistory(getGameHistory());
    if (!user) return;
    getGameHistoryForUser(user.id).then((rows) => {
      if (rows.length > 0) setGameHistory(rows);
    });
  }, [user]);

  if (authLoading || profileLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!profile) return null;

  const displayName = profile.display_name || profile.username || "Chess Player";
  const ratingTier =
    profile.rating >= 2000 ? "Master" :
    profile.rating >= 1400 ? "Advanced" :
    profile.rating >= 1000 ? "Intermediate" : "Beginner";

  const wld = gameHistory.reduce(
    (acc, g) => { acc[g.result]++; return acc; },
    { win: 0, loss: 0, draw: 0 }
  );

  return (
    <AppLayout>
      <div className="min-h-screen bg-background p-6 lg:p-8">

        {/* ── Page header ─────────────────────────────────────────── */}
        <div className="mb-7">
          <h1 className="font-display text-2xl font-bold text-foreground">
            Good game, <span className="text-primary">{displayName}</span>
          </h1>
          <p className="font-body text-sm text-muted-foreground mt-0.5">
            {ratingTier} · {profile.rating} ELO
          </p>
        </div>

        {/* ── Two-column layout ────────────────────────────────────── */}
        <div className="flex flex-col xl:flex-row gap-6">

          {/* LEFT — main content */}
          <div className="flex-1 min-w-0 space-y-6">

            {/* Action cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {ACTION_CARDS.map((card) => (
                <Link
                  key={card.to}
                  to={card.to}
                  className="group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-5 hover:border-foreground/25 hover:shadow-md transition-all duration-200"
                >
                  <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${card.iconBg}`}>
                    <card.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-display text-base font-semibold text-foreground">{card.title}</p>
                    <p className="font-body text-xs text-muted-foreground">{card.subtitle}</p>
                  </div>
                  <span className="mt-auto inline-flex items-center font-body text-xs font-semibold text-primary group-hover:underline">
                    {card.statLabel} →
                  </span>
                </Link>
              ))}
            </div>

            {/* Quick play strip */}
            <div className="flex flex-wrap gap-3">
              <Link
                to="/play"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-body text-sm font-semibold text-primary-foreground shadow-gold hover:opacity-90 transition-opacity"
              >
                <Swords className="h-4 w-4" /> Play Chess
              </Link>
              <Link
                to="/openings"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 font-body text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
              >
                <BookOpen className="h-4 w-4" /> Openings
              </Link>
              <Link
                to="/import"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 font-body text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
              >
                <Upload className="h-4 w-4" /> Import PGN
              </Link>
            </div>

            {/* Game history table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
                <h2 className="font-display text-base font-semibold flex items-center gap-2">
                  <Swords className="h-4 w-4 text-primary" />
                  Game History
                  {gameHistory.length > 0 && (
                    <span className="ml-1 rounded-full bg-secondary px-2 py-0.5 font-body text-xs text-muted-foreground">
                      {gameHistory.length}
                    </span>
                  )}
                </h2>
                <Link to="/bots" className="font-body text-xs text-primary hover:underline">
                  New game
                </Link>
              </div>

              {gameHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                  <Gamepad2 className="h-10 w-10 opacity-25" />
                  <p className="font-body text-sm">No games recorded yet.</p>
                  <Link to="/bots" className="font-body text-xs text-primary hover:underline">
                    Play your first game →
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full font-body text-sm">
                    <thead>
                      <tr className="border-b border-border/40 bg-secondary/30">
                        <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-10">&nbsp;</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Players</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Result</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Accuracy</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Moves</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {gameHistory.map((entry) => (
                        <tr
                          key={entry.id}
                          className="hover:bg-secondary/20 transition-colors"
                        >
                          {/* Result color bar */}
                          <td className="px-5 py-3">
                            <span
                              className={`inline-block h-4 w-1.5 rounded-full ${
                                entry.result === "win"
                                  ? "bg-emerald-400"
                                  : entry.result === "loss"
                                  ? "bg-rose-400"
                                  : "bg-muted-foreground/40"
                              }`}
                            />
                          </td>
                          {/* Players */}
                          <td className="px-3 py-3">
                            <p className="font-medium text-foreground leading-none">
                              {displayName}
                            </p>
                            <p className="text-muted-foreground text-xs mt-0.5 leading-none">
                              vs {entry.opponent}
                            </p>
                          </td>
                          {/* Result */}
                          <td className="px-3 py-3">
                            <ResultIcon result={entry.result} />
                            <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[120px] truncate">
                              {entry.resultDetail}
                            </p>
                          </td>
                          {/* Accuracy */}
                          <td className="px-3 py-3 hidden sm:table-cell">
                            {entry.accuracy ? (
                              <span className="font-semibold text-primary text-xs">
                                {entry.accuracy.w.toFixed(1)}%
                              </span>
                            ) : (
                              <Link
                                to="/analyze"
                                className="inline-flex items-center rounded-md border border-border px-2.5 py-1 font-body text-[11px] font-semibold text-foreground hover:bg-secondary transition-colors"
                              >
                                Review
                              </Link>
                            )}
                          </td>
                          {/* Moves */}
                          <td className="px-3 py-3 hidden md:table-cell">
                            <span className="tabular-nums text-foreground/70 text-xs">
                              {entry.moveCount}
                            </span>
                          </td>
                          {/* Date */}
                          <td className="px-3 py-3">
                            <span className="text-muted-foreground text-xs whitespace-nowrap">
                              {formatDate(entry.createdAt)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — stats sidebar */}
          <aside className="xl:w-64 shrink-0 space-y-4">

            {/* Profile card */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center font-display text-sm font-bold text-primary shrink-0">
                  {profile.display_name?.[0]?.toUpperCase() ?? profile.username?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="min-w-0">
                  <p className="font-display text-sm font-semibold text-foreground truncate">
                    {displayName}
                  </p>
                  {profile.username && (
                    <p className="font-body text-xs text-muted-foreground truncate">
                      @{profile.username}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-secondary/50 px-2 py-2">
                  <p className="font-display text-lg font-bold text-foreground">{profile.games_played}</p>
                  <p className="font-body text-[10px] text-muted-foreground">Games</p>
                </div>
                <div className="rounded-lg bg-secondary/50 px-2 py-2">
                  <p className="font-display text-lg font-bold text-foreground">{profile.puzzles_solved}</p>
                  <p className="font-body text-[10px] text-muted-foreground">Puzzles</p>
                </div>
                <div className="rounded-lg bg-secondary/50 px-2 py-2">
                  <p className="font-display text-lg font-bold text-foreground">{profile.rating}</p>
                  <p className="font-body text-[10px] text-muted-foreground">ELO</p>
                </div>
              </div>
            </div>

            {/* W / L / D */}
            {gameHistory.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="font-display text-sm font-semibold flex items-center gap-2 mb-3">
                  <Trophy className="h-4 w-4 text-primary" /> Record
                </h3>
                <div className="space-y-2">
                  {[
                    { label: "Wins",   value: wld.win,  bar: "bg-emerald-400", text: "text-emerald-400" },
                    { label: "Losses", value: wld.loss, bar: "bg-rose-400",    text: "text-rose-400" },
                    { label: "Draws",  value: wld.draw, bar: "bg-muted-foreground/40", text: "text-muted-foreground" },
                  ].map(({ label, value, bar, text }) => {
                    const total = gameHistory.length;
                    const pct = total ? Math.round((value / total) * 100) : 0;
                    return (
                      <div key={label}>
                        <div className="flex justify-between font-body text-xs mb-1">
                          <span className="text-muted-foreground">{label}</span>
                          <span className={`font-semibold ${text}`}>{value}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div
                            className={`h-full rounded-full ${bar} transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tier card */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-display text-sm font-semibold flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-primary" /> Rating
              </h3>
              <p className="font-display text-3xl font-bold text-foreground">{profile.rating}</p>
              <p className="font-body text-xs text-muted-foreground mt-0.5">{ratingTier}</p>
              <div className="mt-3 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min((profile.rating / 2400) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between font-body text-[10px] text-muted-foreground mt-1">
                <span>Beginner</span>
                <span>Master</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
