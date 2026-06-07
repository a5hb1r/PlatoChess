import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Lock, Swords, X } from "lucide-react";
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

const TIER_PRICES: Record<string, string> = {
  pro: "$9/mo",
  master: "$19/mo",
};

/** Full-screen upgrade modal when a locked bot is tapped */
function LockedBotModal({ bot, onClose }: { bot: Bot; onClose: () => void }) {
  const tierLabel = TIER_LABELS[bot.tier];
  const tierPrice = TIER_PRICES[bot.tier] ?? "";
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
          className="relative bg-card border border-border rounded-2xl p-8 max-w-sm w-full text-center shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Bot emoji */}
          <div className="text-5xl mb-3">{bot.emoji}</div>

          {/* Lock icon */}
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-secondary mb-4 mx-auto">
            <Lock className="h-5 w-5 text-foreground/60" />
          </div>

          <h2 className="font-display text-2xl font-bold mb-2">
            {bot.name} is locked
          </h2>
          <p className="font-body text-sm text-muted-foreground mb-1 italic">
            "{bot.quote}"
          </p>
          <p className="font-body text-sm text-muted-foreground mb-6 mt-3 leading-relaxed">
            <span className={`font-semibold ${TIER_COLORS[bot.tier].split(" ")[0]}`}>
              {tierLabel}
            </span>{" "}
            subscription required to play {bot.name}.
          </p>

          <div className="flex flex-col gap-2">
            <Link
              to="/pricing"
              className="bg-primary px-6 py-3 rounded-md font-body text-sm font-semibold text-primary-foreground shadow-gold transition-transform hover:scale-[1.02]"
            >
              Upgrade to {tierLabel} — {tierPrice}
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="border border-border px-6 py-3 rounded-md font-body text-sm font-medium text-foreground hover:bg-secondary transition-colors"
            >
              Back to bots
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function BotCard({
  bot,
  unlocked,
  onLockedClick,
}: {
  bot: Bot;
  unlocked: boolean;
  onLockedClick: (bot: Bot) => void;
}) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (unlocked) {
      navigate(
        `/game?level=${bot.levelIndex}&skill=${bot.skill}&depth=${bot.depth}&bot=${bot.id}&mode=practice`
      );
    } else {
      onLockedClick(bot);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`relative rounded-xl border p-5 flex flex-col gap-3 transition-all duration-200 cursor-pointer ${
        unlocked
          ? "border-border bg-card hover:border-foreground/25 hover:shadow-gold"
          : "border-border/40 bg-card/60 hover:border-border"
      }`}
      onClick={handleClick}
    >
      {/* Tier badge */}
      <span
        className={`absolute top-3 right-3 rounded-full border px-2 py-0.5 font-body text-[10px] font-semibold uppercase tracking-wider ${TIER_COLORS[bot.tier]}`}
      >
        {TIER_LABELS[bot.tier]}
      </span>

      {/* Avatar / emoji */}
      <div className={`text-3xl leading-none ${!unlocked ? "grayscale opacity-60" : ""}`}>
        {bot.emoji}
      </div>

      {/* Name + title */}
      <div>
        <h3 className={`font-display text-lg font-bold ${unlocked ? "text-foreground" : "text-foreground/50"}`}>
          {bot.name}
        </h3>
        <p className="font-body text-xs text-muted-foreground">{bot.title}</p>
      </div>

      {/* Rating pill */}
      <div className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1 w-fit">
        <span className="font-mono text-xs font-semibold text-foreground/80">{bot.ratingLabel}</span>
        <span className="font-body text-[10px] text-muted-foreground">ELO</span>
      </div>

      {/* Personality */}
      <p className={`font-body text-xs leading-relaxed ${unlocked ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
        {bot.personality}
      </p>

      {/* Quote */}
      <p className="font-body text-xs italic text-foreground/40 border-l-2 border-primary/20 pl-2 mt-auto">
        "{bot.quote}"
      </p>

      {/* CTA */}
      {unlocked ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleClick(); }}
          className="mt-1 flex items-center justify-center gap-2 rounded-md bg-primary py-2 font-body text-sm font-semibold text-primary-foreground shadow-gold transition-transform hover:scale-[1.02]"
        >
          <Swords className="h-4 w-4" />
          Play
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onLockedClick(bot); }}
          className="mt-1 flex items-center justify-center gap-2 rounded-md border border-border/50 py-2 font-body text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border transition-colors"
        >
          <Lock className="h-3.5 w-3.5" />
          Requires {TIER_LABELS[bot.tier]}
        </button>
      )}
    </motion.div>
  );
}

const Bots = () => {
  const { isPro, isMaster, loading } = useProfile();
  const [lockedBot, setLockedBot] = useState<Bot | null>(null);

  // In dev mode all bots are unlocked regardless of tier
  const devMode = import.meta.env.DEV;

  return (
    <div className="min-h-screen bg-background">
      {/* Locked-bot upgrade modal */}
      {lockedBot && (
        <LockedBotModal bot={lockedBot} onClose={() => setLockedBot(null)} />
      )}

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
                onLockedClick={setLockedBot}
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
