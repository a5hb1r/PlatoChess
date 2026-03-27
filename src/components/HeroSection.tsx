import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import heroImg from "@/assets/hero-chess.jpg";
import logo from "@/assets/platochess-logo.png";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={heroImg}
          alt=""
          className="h-full w-full object-cover grayscale contrast-[1.05] opacity-[0.22]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_hsl(var(--background))_70%)]" />
      </div>

      <div className="relative z-10 container mx-auto px-6 text-center pt-28 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="flex flex-col items-center gap-6 mb-10"
        >
          <img
            src={logo}
            alt=""
            width={120}
            height={120}
            className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 object-contain drop-shadow-[0_0_32px_rgba(255,255,255,0.12)]"
            decoding="async"
          />
          <p className="font-body text-xs sm:text-sm uppercase tracking-[0.35em] text-muted-foreground">
            Pure chess  -  Monochrome discipline
          </p>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, delay: 0.25 }}
          className="font-display text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-[1.05] mb-6 text-foreground"
        >
          Master the
          <br />
          <span className="text-gradient-brand italic">Art of Chess</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.45 }}
          className="font-body text-base md:text-lg text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed"
        >
          Training that respects the board: puzzles, openings, engine play, and analysis-styled in black
          and white like the pieces themselves.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.6 }}
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

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.9 }}
          className="mt-20 flex justify-center gap-0.5 opacity-40"
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
