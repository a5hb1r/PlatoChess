import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Trophy, Gamepad2, Puzzle, TrendingUp, User, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface Profile {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  rating: number;
  games_played: number;
  puzzles_solved: number;
  created_at: string;
}

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

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

        {/* Quick actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="flex flex-wrap gap-4"
        >
          <Link
            to="/play"
            className="bg-primary px-6 py-3 rounded-md font-body text-sm font-semibold text-primary-foreground shadow-gold transition-transform hover:scale-105"
          >
            Play Now
          </Link>
          <Link
            to="/settings"
            className="border border-border px-6 py-3 rounded-md font-body text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary"
          >
            Account Settings
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
