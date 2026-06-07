import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Trophy,
  Gamepad2,
  Puzzle,
  TrendingUp,
  User,
  Loader2,
  Swords,
  BookOpen,
  CheckCircle2,
  XCircle,
  Minus,
  Clock,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getGameHistory, type GameHistoryEntry } from "@/lib/game-review";

interface Profile {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  rating: number;
  games_played: number;
  puzzles_solved: number;
  created_at: string;
}

function formatRelativeDate(ts: number): string {
  const diff = Date.now() - ts;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ResultBadge({ result }: { result: GameHistoryEntry["result"] }) {
  if (result === "win") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 font-body text-xs font-semibold text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        Win
      </span>
    );
  }
  if (result === "loss") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 font-body text-xs font-semibold text-rose-400">
        <XCircle className="h-3 w-3" />
        Loss
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary border border-border px-2.5 py-0.5 font-body text-xs font-semibold text-muted-foreground">
      <Minus className="h-3 w-3" />
      Draw
    </span>
  );
}

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [gameHistory, setGameHistory] = useState<GameHistoryEntry[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (user) {
      supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single()
        .then(({ data }) => {
          setProfile(data);
          setLoading(false);
        });
    }
  }, [user, authLoading, navigate]);

  // Game history is stored client-side in localStorage.
  useEffect(() => {
    setGameHistory(getGameHistory());
  }, []);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) return null;

  const ratingTier =
    profile.rating >= 2000 ? "Master" :
    profile.rating >= 1400 ? "Advanced" :
    profile.rating >= 1000 ? "Intermediate" : "Beginner";

  const ratingProgress = Math.min((profile.rating / 2400) * 100, 100);
  const memberSince = new Date(profile.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const initials = (profile.display_name || profile.username || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const stats = [
    { label: "Rating", value: profile.rating, icon: TrendingUp, color: "text-primary" },
    { label: "Games Played", value: profile.games_played, icon: Gamepad2, color: "text-primary" },
    { label: "Puzzles Solved", value: profile.puzzles_solved, icon: Puzzle, color: "text-primary" },
    { label: "Tier", value: ratingTier, icon: Trophy, color: "text-primary" },
  ];

  // Win / loss / draw counts from local history
  const wld = gameHistory.reduce(
    (acc, g) => {
      acc[g.result]++;
      return acc;
    },
    { win: 0, loss: 0, draw: 0 }
  );

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center gap-4 px-6 py-4">
          <Link
            to="/"
            className="flex items-center gap-2 font-body text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <h1 className="font-display text-xl font-semibold">
            Dash<span className="text-gradient-brand">board</span>
          </h1>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-12 max-w-4xl space-y-8">
        {/* Profile header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row items-center gap-6 rounded-lg border border-border bg-card p-8"
        >
          <Avatar className="h-20 w-20 border-2 border-primary">
            <AvatarImage src={profile.avatar_url || undefined} />
            <AvatarFallback className="bg-secondary text-foreground text-2xl font-display">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="text-center sm:text-left space-y-1">
            <h2 className="font-display text-2xl font-semibold text-foreground">
              {profile.display_name || profile.username || "Chess Player"}
            </h2>
            {profile.username && (
              <p className="font-body text-sm text-muted-foreground">@{profile.username}</p>
            )}
            <p className="font-body text-xs text-muted-foreground">Member since {memberSince}</p>
          </div>
          <div className="sm:ml-auto text-center">
            <p className="font-display text-4xl font-bold text-primary">{profile.rating}</p>
            <p className="font-body text-xs text-muted-foreground uppercase tracking-wider">{ratingTier}</p>
          </div>
        </motion.div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 * (i + 1) }}
            >
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="font-body text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                    {stat.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-2xl font-bold text-foreground">{stat.value}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* W/L/D mini summary */}
        {gameHistory.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.55 }}
            className="grid grid-cols-3 gap-4"
          >
            {[
              { label: "Wins", value: wld.win, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/25" },
              { label: "Losses", value: wld.loss, color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/25" },
              { label: "Draws", value: wld.draw, color: "text-foreground/70", bg: "bg-secondary border-border" },
            ].map(({ label, value, color, bg }) => (
              <div
                key={label}
                className={`rounded-lg border px-4 py-3 text-center ${bg}`}
              >
                <p className={`font-display text-2xl font-bold ${color}`}>{value}</p>
                <p className="font-body text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </motion.div>
        )}

        {/* Rating progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="font-display text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Rating Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={ratingProgress} className="h-3 bg-secondary" />
              <div className="flex justify-between font-body text-xs text-muted-foreground">
                <span>Beginner</span>
                <span>Intermediate</span>
                <span>Advanced</span>
                <span>Master</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Game history table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.62 }}
        >
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-display text-lg font-semibold flex items-center gap-2">
                <Swords className="h-5 w-5 text-primary" />
                Game History
              </CardTitle>
              {gameHistory.length > 0 && (
                <span className="font-body text-xs text-muted-foreground">
                  {gameHistory.length} {gameHistory.length === 1 ? "game" : "games"}
                </span>
              )}
            </CardHeader>
            <CardContent>
              {gameHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground">
                  <Gamepad2 className="h-10 w-10 opacity-30" />
                  <p className="font-body text-sm">No games recorded yet.</p>
                  <Link
                    to="/bots"
                    className="btn-chess btn-chess-primary text-sm px-6 py-2.5"
                  >
                    Play your first game
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full font-body text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-left">
                        <th className="pb-2 pr-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                          Result
                        </th>
                        <th className="pb-2 pr-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                          Opponent
                        </th>
                        <th className="pb-2 pr-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell">
                          Moves
                        </th>
                        <th className="pb-2 pr-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                          Accuracy
                        </th>
                        <th className="pb-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                          <span className="sr-only">Date</span>
                          <Clock className="h-3.5 w-3.5" />
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {gameHistory.map((entry) => (
                        <tr key={entry.id} className="group">
                          <td className="py-2.5 pr-4">
                            <ResultBadge result={entry.result} />
                          </td>
                          <td className="py-2.5 pr-4">
                            <span className="font-medium text-foreground">{entry.opponent}</span>
                            <span className="block text-[11px] text-muted-foreground truncate max-w-[160px]">
                              {entry.resultDetail}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 tabular-nums text-foreground/80 hidden sm:table-cell">
                            {entry.moveCount}
                          </td>
                          <td className="py-2.5 pr-4 hidden md:table-cell">
                            {entry.accuracy ? (
                              <span className="font-semibold text-primary">
                                {entry.accuracy.w}%
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                          <td className="py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                            {formatRelativeDate(entry.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.72 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        >
          {[
            { to: "/play", icon: Swords, label: "Play", primary: true },
            { to: "/bots", icon: User, label: "Bots" },
            { to: "/puzzles", icon: Puzzle, label: "Puzzles" },
            { to: "/openings", icon: BookOpen, label: "Openings" },
          ].map(({ to, icon: Icon, label, primary }) => (
            <Link
              key={to}
              to={to}
              className={primary ? "btn-chess btn-chess-primary justify-center" : "btn-chess btn-chess-outline justify-center"}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
