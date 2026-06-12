import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Crown, Sprout, Trophy, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  BRACKET_RATINGS,
  getGuestSession,
  saveGuestSession,
} from "@/lib/guest-session";
import { LogoMark } from "@/components/LogoMark";

interface Bracket {
  id: string;
  label: string;
  range: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const BRACKETS: Bracket[] = [
  {
    id: "beginner",
    label: "Just Starting",
    range: "Under 800",
    description: "I'm new to chess or still learning the basics.",
    icon: Sprout,
    color: "text-emerald-400",
  },
  {
    id: "intermediate",
    label: "Club Player",
    range: "800 – 1 200",
    description: "I know tactics and have played casually for a while.",
    icon: Zap,
    color: "text-amber-400",
  },
  {
    id: "advanced",
    label: "Tournament Player",
    range: "1 200 – 1 600",
    description: "I study openings, play rated games, and compete.",
    icon: Trophy,
    color: "text-blue-400",
  },
  {
    id: "expert",
    label: "Strong Player",
    range: "1 600 +",
    description: "I'm an experienced, high-rated player.",
    icon: Crown,
    color: "text-purple-400",
  },
];

export function GuestOnboarding() {
  const { user } = useAuth();

  // Only show for unauthenticated visitors who haven't done onboarding yet
  const existing = getGuestSession();
  const [visible, setVisible] = useState(
    !user && (!existing || !existing.onboardingComplete)
  );

  if (!visible) return null;

  const handleSelect = (bracket: Bracket) => {
    saveGuestSession({
      rating: BRACKET_RATINGS[bracket.id] ?? 800,
      bracket: bracket.id,
      placementGamesRemaining: 5,
      onboardingComplete: true,
      createdAt: Date.now(),
    });
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center px-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="w-full max-w-2xl"
          >
            {/* Header */}
            <div className="text-center mb-10">
              <div className="flex justify-center mb-6">
                <LogoMark asLink={false} iconSize="lg" textClass="text-2xl" />
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold mb-3">
                Where are you{" "}
                <span className="text-gradient-brand italic">right now?</span>
              </h1>
              <p className="font-body text-muted-foreground max-w-sm mx-auto">
                Pick your current skill level. You'll play{" "}
                <span className="text-foreground font-semibold">
                  5 placement matches
                </span>{" "}
                to calibrate your exact rating — no account needed.
              </p>
            </div>

            {/* Bracket cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {BRACKETS.map((b, i) => {
                const Icon = b.icon;
                return (
                  <motion.button
                    key={b.id}
                    type="button"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 + i * 0.07 }}
                    onClick={() => handleSelect(b)}
                    className="group relative rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-border/80 hover:bg-secondary/60"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`mt-0.5 shrink-0 ${b.color}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-display text-base font-semibold">
                            {b.label}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground shrink-0">
                            {b.range}
                          </span>
                        </div>
                        <p className="font-body text-sm text-muted-foreground leading-snug">
                          {b.description}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-1 group-hover:text-foreground/60 transition-colors" />
                    </div>
                  </motion.button>
                );
              })}
            </div>

            <p className="text-center font-body text-xs text-muted-foreground mt-6">
              No account needed to start.{" "}
              <Link to="/auth?mode=signup" className="underline hover:text-foreground">
                Sign up
              </Link>{" "}
              anytime to save your progress permanently.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
