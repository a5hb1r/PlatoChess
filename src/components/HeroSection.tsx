import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import heroImg from "@/assets/hero-chess.jpg";
import { LogoMark } from "@/components/LogoMark";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
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
          Puzzles, openings, engine play, and post-game analysis — styled in
          black and white like the pieces themselves.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.65 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            to="/play"
            className="bg-primary px-8 py-3.5 rounded-md font-body text-base font-semibold text-primary-foreground shadow-gold transition-transform hover:scale-[1.03]"
          >
            Begin training
          </Link>
          <a
            href="#features"
            className="border border-border px-8 py-3.5 rounded-md font-body text-base text-foreground transition-colors hover:bg-secondary"
          >
            Explore features
          </a>
        </motion.div>

        {/* Decorative mini board */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.9 }}
          className="mt-20 flex justify-center gap-0.5 opacity-30"
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
