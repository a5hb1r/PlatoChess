import { motion } from "framer-motion";
import { ArrowLeft, Lock, Swords } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { BOTS, isBotUnlocked, type Bot } from "@/lib/bots";
import { useProfile } from "@/hooks/use-profile";

const TIER_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  master: "Master",
};

const TIER_COLORS: Record<string, string> = {
  free: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  pro: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  master: "text-violet-400 bg-violet-400/10 border-violet-400/30",
};

function BotCard({ bot, unlocked }: { bot: Bot; unlocked: boolean }) {
  const navigate = useNavigate();

  const handlePlay = () => {
    if (!unlocked) return;
    // Navigate to Game page with bot's skill/depth params
    navigate(
      `/game?level=${bot.levelIndex}&skill=${bot.skill}&depth=${bot.depth}&bot=${bot.id}&mode=practice`
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`relative rounded-xl border p-5 flex flex-col gap-3 transition-all duration-200 ${
        unlocked
          ? "border-border bg-card hover:border-foreground/25 hover:shadow-gold cursor-pointer"
          : "border-border/50 bg-card/50 opacity-60 cursor-not-allowed"
      }`}
      onClick={unlocked ? handlePlay : undefined}
    >
      {/* Tier badge */}
      <span
        className={`absolute top-3 right-3 rounded-full border px-2 py-0.5 font-body text-[10px] font-semibold uppercase tracking-wider ${TIER_COLORS[bot.tier]}`}
      >
        {TIER_LABELS[bot.tier]}
      </span>

      {/* Lock overlay */}
      {!unlocked && (
        <div className="absolute inset-0 rounded-xl flex items-center justify-center">
          <div className="bg-background/80 rounded-full p-2.5">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      )}

      {/* Avatar / emoji */}
      <div className="text-3xl leading-none">{bot.emoji}</div>

      {/* Name + title */}
      <div>
        <h3 className="font-display text-lg font-bold text-foreground">{bot.name}</h3>
        <p className="font-body text-xs text-muted-foreground">{bot.title}</p>
      </div>

      {/* Rating pill */}
      <div className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1 w-fit">
        <span className="font-mono text-xs font-semibold text-foreground/80">{bot.ratingLabel}</span>
        <span className="font-body text-[10px] text-muted-foreground">ELO</span>
      </div>

      {/* Personality */}
      <p className="font-body text-xs text-muted-foreground leading-relaxed">{bot.personality}</p>

      {/* Quote */}
      <p className="font-body text-xs italic text-foreground/50 border-l-2 border-primary/30 pl-2 mt-auto">
        "{bot.quote}"
      </p>

      {/* CTA */}
      {unlocked && (
        <button
          type="button"
          onClick={handlePlay}
          className="mt-1 flex items-center justify-center gap-2 rounded-md bg-primary py-2 font-body text-sm font-semibold text-primary-foreground shadow-gold transition-transform hover:scale-[1.02]"
        >
          <Swords className="h-4 w-4" />
          Play
        </button>
      )}

      {!unlocked && (
        <Link
          to="/pricing"
          onClick={(e) => e.stopPropagation()}
          className="mt-1 flex items-center justify-center gap-2 rounded-md border border-border py-2 font-body text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          Upgrade to {TIER_LABELS[bot.tier]}
        </Link>
      )}
    </motion.div>
  );
}

const Bots = () => {
  const { isPro, isMaster, loading } = useProfile();

  // In dev mode all bots are unlocked regardless of tier
  const devMode = import.meta.env.DEV;

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center gap-4 px-6 py-4">
          <Link
            to="/play"
            className="flex items-center gap-2 font-body text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Play
          </Link>
          <h1 className="font-display text-xl font-semibold">
            Play a <span className="text-gradient-brand">Bot</span>
          </h1>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-12 max-w-5xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <p className="font-body text-sm uppercase tracking-[0.25em] text-foreground/75 mb-2">
            Ancient minds, modern chess
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-3">
            Choose your opponent
          </h2>
          <p className="font-body text-muted-foreground max-w-lg">
            Each philosopher-bot has a unique playing style and personality.
            Free players get three bots — upgrade to Pro or Master to unlock them all.
          </p>

          {devMode && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-1 font-body text-xs text-amber-400">
              🛠 Dev mode — all bots unlocked for testing
            </p>
          )}
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-card/50 h-72 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {BOTS.map((bot) => (
              <BotCard
                key={bot.id}
                bot={bot}
                unlocked={devMode || isBotUnlocked(bot, isPro, isMaster)}
              />
            ))}
          </div>
        )}

        {/* Tier upgrade CTA */}
        {!loading && !isPro && !isMaster && !devMode && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-12 rounded-xl border border-primary/30 bg-primary/5 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div>
              <h3 className="font-display text-lg font-bold mb-1">Unlock all 8 bots</h3>
              <p className="font-body text-sm text-muted-foreground">
                Upgrade to Pro to play Pythagoras, Archimedes, and Euclid. Master tier unlocks Hypatia and Plato.
              </p>
            </div>
            <Link
              to="/pricing"
              className="shrink-0 bg-primary px-6 py-3 rounded-md font-body text-sm font-semibold text-primary-foreground shadow-gold transition-transform hover:scale-[1.02]"
            >
              View plans →
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Bots;
