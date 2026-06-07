import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Bot, LineChart, Puzzle, BookOpen, Swords } from "lucide-react";
import heroImg from "@/assets/hero-chess.jpg";
import { LogoMark } from "@/components/LogoMark";

const QUICK_ACTIONS = [
  {
    icon: Swords,
    label: "Play Online",
    sublabel: "Find an opponent",
    href: "/play",
    primary: true,
  },
  {
    icon: Bot,
    label: "Play Computer",
    sublabel: "Challenge a philosopher-bot",
    href: "/bots",
    primary: false,
  },
  {
    icon: Puzzle,
    label: "Puzzles",
    sublabel: "Sharpen tactics daily",
    href: "/puzzles",
    primary: false,
  },
  {
    icon: LineChart,
    label: "Analysis",
    sublabel: "Review your games",
    href: "/analyze",
    primary: false,
  },
  {
    icon: BookOpen,
    label: "Openings",
    sublabel: "Drill classical lines",
    href: "/openings",
    primary: false,
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, delay: 0.75 + i * 0.07, ease: "easeOut" },
  }),
};

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <img
          src={heroImg}
          alt=""
          className="h-full w-full object-cover grayscale contrast-[1.05] opacity-[0.18]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_hsl(var(--background))_70%)]" />
      </div>

      <div className="relative z-10 container mx-auto px-6 text-center pt-28 pb-16">
        {/* Brand wordmark */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="flex justify-center mb-8"
        >
          <LogoMark asLink={false} iconSize="lg" textClass="text-2xl sm:text-3xl" />
        </motion.div>

        {/* Eyebrow */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="font-body text-xs sm:text-sm uppercase tracking-[0.35em] text-muted-foreground mb-6"
        >
          Pure chess · Monochrome discipline
        </motion.p>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, delay: 0.3 }}
          className="font-display text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-[1.05] mb-6 text-foreground"
        >
          Master the
          <br />
          <span className="text-gradient-brand italic">Art of Chess</span>
        </motion.h1>

        {/* Sub-headline */}
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.5 }}
          className="font-body text-base md:text-lg text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed"
        >
          Puzzles, openings, engine play, and post-game analysis — guided by the
          great minds of antiquity.
        </motion.p>

        {/* Primary CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.65 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
        >
          <Link to="/play" className="btn-chess btn-chess-primary text-base px-10 py-3.5">
            Begin Training
          </Link>
          <a href="#features" className="btn-chess btn-chess-outline text-base px-10 py-3.5">
            Explore Features
          </a>
        </motion.div>

        {/* Quick-play grid — Chess.com-style card grid */}
        <div className="mx-auto max-w-3xl">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.72 }}
            className="font-body text-xs uppercase tracking-[0.3em] text-muted-foreground mb-5"
          >
            Jump right in
          </motion.p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {QUICK_ACTIONS.map(({ icon: Icon, label, sublabel, href, primary }, i) => (
              <motion.div
                key={href}
                custom={i}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
              >
                <Link
                  to={href}
                  className={`group flex flex-col items-center gap-2.5 rounded-xl border p-4 text-center transition-all duration-200 ${
                    primary
                      ? "border-primary/40 bg-primary/10 hover:bg-primary/20 hover:border-primary/60"
                      : "border-border bg-card hover:bg-secondary hover:border-foreground/20"
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                      primary
                        ? "bg-primary/20 text-primary group-hover:bg-primary/30"
                        : "bg-secondary text-foreground/70 group-hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p
                      className={`font-display text-sm font-semibold leading-tight ${
                        primary ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {label}
                    </p>
                    <p className="font-body text-[11px] text-muted-foreground mt-0.5 leading-tight">
                      {sublabel}
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Decorative mini board */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.2 }}
          className="mt-16 flex justify-center gap-0.5 opacity-20"
        >
          {Array.from({ length: 8 }).map((_, row) => (
            <div key={row} className="flex flex-col gap-0.5">
              {Array.from({ length: 4 }).map((_, col) => (
                <div
                  key={col}
                  className={`h-3 w-3 rounded-sm ${
                    (row + col) % 2 === 0 ? "bg-chess-light" : "bg-chess-dark"
                  }`}
                />
              ))}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
