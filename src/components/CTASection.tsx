import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const CTASection = () => {
  return (
    <section className="py-24 md:py-32">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative rounded-2xl border border-foreground/20 bg-card p-12 md:p-20 text-center overflow-hidden"
        >
          {/* Subtle chess pattern background */}
          <div className="absolute inset-0 opacity-[0.03]">
            <div className="grid grid-cols-8 h-full">
              {Array.from({ length: 64 }).map((_, i) => (
                <div
                  key={i}
                  className={`${
                    (Math.floor(i / 8) + (i % 8)) % 2 === 0
                      ? "bg-foreground"
                      : ""
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="relative z-10">
            <motion.h2
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="font-display text-3xl md:text-5xl font-bold mb-4"
            >
              Ready to Get <span className="italic text-gradient-brand">Serious</span>?
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="font-body text-muted-foreground max-w-lg mx-auto mb-8"
            >
              Join players who chose mastery over entertainment. Your next breakthrough is one training session away.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <Link
                to="/auth"
                className="inline-block bg-primary px-10 py-4 rounded-md font-body text-base font-semibold text-primary-foreground shadow-gold transition-transform hover:scale-105"
              >
                Start Training Free
              </Link>
              <p className="font-body text-xs text-muted-foreground mt-4">
                No credit card required. Free plan includes 10 puzzles/day.
              </p>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
