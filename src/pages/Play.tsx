import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Clock,
  Zap,
  Shuffle,
  Timer,
  Users,
  Crown,
  Bot,
  Puzzle,
  LineChart,
  BookOpen,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

const variants = [
  {
    id: "standard",
    icon: Crown,
    name: "Standard",
    description: "Classic chess - all the rules you know and love.",
    color: "text-foreground/75",
  },
  {
    id: "blitz",
    icon: Zap,
    name: "Blitz & Bullet",
    description: "Fast time controls. Think fast, move faster.",
    color: "text-foreground/75",
  },
  {
    id: "increment",
    icon: Timer,
    name: "Increment",
    description: "Every move earns you seconds back on the clock.",
    color: "text-foreground/75",
  },
  {
    id: "chess960",
    icon: Shuffle,
    name: "Chess960",
    description: "Randomized back rank. No memorized openings - pure chess.",
    color: "text-foreground/75",
  },
];

const timeControls: Record<string, { label: string; time: string }[]> = {
  standard: [
    { label: "Rapid 15|10", time: "15+10" },
    { label: "Rapid 10|0", time: "10+0" },
    { label: "Classical 30|0", time: "30+0" },
  ],
  blitz: [
    { label: "Bullet 1|0", time: "1+0" },
    { label: "Blitz 3|0", time: "3+0" },
    { label: "Blitz 5|0", time: "5+0" },
  ],
  increment: [
    { label: "3|2", time: "3+2" },
    { label: "5|3", time: "5+3" },
    { label: "10|5", time: "10+5" },
    { label: "15|10", time: "15+10" },
  ],
  chess960: [
    { label: "Blitz 5|0", time: "5+0" },
    { label: "Rapid 10|0", time: "10+0" },
    { label: "Increment 5|3", time: "5+3" },
  ],
};

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

const STOCKFISH_LEVELS = [
  { label: "Beginner", rating: "~400", level: 0 },
  { label: "Easy", rating: "~800", level: 1 },
  { label: "Medium", rating: "~1200", level: 2 },
  { label: "Hard", rating: "~1600", level: 3 },
  { label: "Expert", rating: "~2000", level: 4 },
  { label: "Master", rating: "~2500", level: 5 },
];

const COACH_MATCHUPS = [
  { id: "plato", name: "Plato", style: "Strategic foundations", level: 1 },
  { id: "marcus", name: "Marcus Aurelius", style: "Stoic positional play", level: 2 },
  { id: "seneca", name: "Seneca", style: "Practical decision-making", level: 2 },
  { id: "nietzsche", name: "Nietzsche", style: "Dynamic imbalances", level: 3 },
  { id: "confucius", name: "Confucius", style: "Harmony and structure", level: 2 },
] as const;

const Play = () => {
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const navigate = useNavigate();

  const handlePlay = () => {
    toast.message("Online matchmaking is not live yet - opening a practice game vs Stockfish.");
    navigate("/game?level=2&mode=online");
  };

  const handlePlayStockfish = (level: number) => {
    navigate(`/game?level=${level}&mode=practice`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
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
            Play <span className="text-gradient-brand">Chess</span>
          </h1>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-12 max-w-4xl">
        {/* Step 1: Choose variant */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <p className="font-body text-sm uppercase tracking-[0.25em] text-foreground/75 mb-2">
            Step 1
          </p>
          <h2 className="font-display text-2xl md:text-3xl font-bold mb-6">
            Choose Your Format
          </h2>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            {variants.map((v) => (
              <motion.button
                key={v.id}
                variants={itemVariants}
                onClick={() => {
                  setSelectedVariant(v.id);
                  setSelectedTime(null);
                }}
                className={`group relative rounded-lg border p-6 text-left transition-all duration-200 ${
                  selectedVariant === v.id
                    ? "border-foreground/35 bg-secondary shadow-gold"
                    : "border-border bg-card hover:border-foreground/20"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors ${
                      selectedVariant === v.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-foreground/75"
                    }`}
                  >
                    <v.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-semibold mb-1">
                      {v.name}
                    </h3>
                    <p className="font-body text-sm text-muted-foreground leading-relaxed">
                      {v.description}
                    </p>
                  </div>
                </div>
              </motion.button>
            ))}
          </motion.div>
        </motion.div>

        {/* Step 2: Time control */}
        {selectedVariant && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-10"
          >
            <p className="font-body text-sm uppercase tracking-[0.25em] text-foreground/75 mb-2">
              Step 2
            </p>
            <h2 className="font-display text-2xl md:text-3xl font-bold mb-6">
              Pick Time Control
            </h2>

            <div className="flex flex-wrap gap-3">
              {timeControls[selectedVariant]?.map((tc) => (
                <button
                  key={tc.time}
                  onClick={() => setSelectedTime(tc.time)}
                  className={`flex items-center gap-2 rounded-md border px-5 py-3 font-body text-sm font-medium transition-all duration-200 ${
                    selectedTime === tc.time
                      ? "border-foreground/35 bg-secondary text-foreground shadow-gold"
                      : "border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                  }`}
                >
                  <Clock className="h-4 w-4 text-foreground/75" />
                  {tc.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Play button */}
        {selectedVariant && selectedTime && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="text-center"
          >
            <button
              onClick={handlePlay}
              className="inline-flex items-center gap-3 bg-primary px-12 py-4 rounded-md font-body text-base font-semibold text-primary-foreground shadow-gold transition-transform hover:scale-105"
            >
              <Users className="h-5 w-5" />
              Find Opponent
            </button>
            <p className="font-body text-xs text-muted-foreground mt-3">
              {variants.find((v) => v.id === selectedVariant)?.name}  -  {selectedTime}
            </p>
          </motion.div>
        )}

        {/* Practice vs Stockfish */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-16"
        >
          <div className="h-px bg-border mb-12" />
          <p className="font-body text-sm uppercase tracking-[0.25em] text-foreground/75 mb-2">
            Practice
          </p>
          <h2 className="font-display text-2xl md:text-3xl font-bold mb-2">
            Play vs Stockfish
          </h2>
          <p className="font-body text-sm text-muted-foreground mb-6">
            Sharpen your skills against the engine at different difficulty levels.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {STOCKFISH_LEVELS.map((lvl) => (
              <button
                key={lvl.level}
                onClick={() => handlePlayStockfish(lvl.level)}
                className="group relative rounded-lg border border-border bg-card p-5 text-left transition-all duration-200 hover:border-foreground/25 hover:shadow-gold"
              >
                <div className="flex items-center gap-3 mb-2">
                  <Bot className="w-5 h-5 text-foreground/75" />
                  <span className="font-display text-base font-semibold text-foreground">
                    {lvl.label}
                  </span>
                </div>
                <p className="font-mono text-xs text-muted-foreground">
                  {lvl.rating}
                </p>
              </button>
            ))}
          </div>

          <p className="font-body text-sm text-muted-foreground mt-8 mb-3">
            Play against philosopher coaches (engine opponent + live philosopher dialogue).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {COACH_MATCHUPS.map((coach) => (
              <Link
                key={coach.id}
                to={`/game?level=${coach.level}&coach=${coach.id}&mode=practice`}
                className="rounded-lg border border-border bg-card p-4 hover:bg-secondary hover:border-foreground/25 transition-colors"
              >
                <p className="font-display text-base font-semibold text-foreground">{coach.name}</p>
                <p className="font-body text-xs text-muted-foreground mt-1">{coach.style}</p>
                <p className="font-mono text-[11px] text-muted-foreground mt-2">Level {coach.level + 1}</p>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Chess Puzzles */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mt-12"
        >
          <div className="h-px bg-border mb-12" />
          <p className="font-body text-sm uppercase tracking-[0.25em] text-foreground/75 mb-2">
            Train
          </p>
          <h2 className="font-display text-2xl md:text-3xl font-bold mb-2">
            Analysis & Openings
          </h2>
          <p className="font-body text-sm text-muted-foreground mb-6 max-w-xl">
            Paste a PGN for Stockfish 18 analysis, or drill classical opening lines with quiz mode.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              to="/analyze"
              className="inline-flex items-center gap-3 border border-foreground/30 bg-card px-8 py-4 rounded-md font-body text-base font-semibold text-foreground transition-transform hover:scale-[1.02] hover:border-foreground/40"
            >
              <LineChart className="h-5 w-5 text-foreground/75" />
              Analyze game
            </Link>
            <Link
              to="/openings"
              className="inline-flex items-center gap-3 border border-foreground/30 bg-card px-8 py-4 rounded-md font-body text-base font-semibold text-foreground transition-transform hover:scale-[1.02] hover:border-foreground/40"
            >
              <BookOpen className="h-5 w-5 text-foreground/75" />
              Opening practice
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12"
        >
          <div className="h-px bg-border mb-12" />
          <p className="font-body text-sm uppercase tracking-[0.25em] text-foreground/75 mb-2">
            Improve
          </p>
          <h2 className="font-display text-2xl md:text-3xl font-bold mb-2">
            Chess Puzzles
          </h2>
          <p className="font-body text-sm text-muted-foreground mb-6">
            Solve tactical puzzles to sharpen your pattern recognition - forks, pins, mates, and more.
          </p>
          <Link
            to="/puzzles"
            className="inline-flex items-center gap-3 bg-primary px-8 py-4 rounded-md font-body text-base font-semibold text-primary-foreground shadow-gold transition-transform hover:scale-105"
          >
            <Puzzle className="h-5 w-5" />
            Start Solving Puzzles
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

export default Play;
