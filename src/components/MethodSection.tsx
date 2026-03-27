import { motion } from "framer-motion";

const steps = [
  {
    number: "01",
    title: "Assess Your Game",
    description:
      "Upload your games or play on Platochess. Our engine identifies your specific weaknesses across openings, tactics, and endgames.",
  },
  {
    number: "02",
    title: "Train Your Weaknesses",
    description:
      "Get a personalized training plan with puzzles, drills, and lessons targeting exactly where you lose the most Elo.",
  },
  {
    number: "03",
    title: "Play & Review",
    description:
      "Apply what you've learned in focused games. Every game is reviewed automatically, closing the feedback loop.",
  },
  {
    number: "04",
    title: "Track Your Growth",
    description:
      "Watch your rating climb as weaknesses become strengths. Detailed analytics show exactly how you've improved.",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15 },
  },
};

const stepVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

const MethodSection = () => {
  return (
    <section id="method" className="py-24 md:py-32 bg-card">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="font-body text-sm uppercase tracking-[0.3em] text-foreground/75 mb-4">
            The Platochess Method
          </p>
          <h2 className="font-display text-3xl md:text-5xl font-bold mb-4">
            A System That <span className="italic text-gradient-brand">Works</span>
          </h2>
          <p className="font-body text-muted-foreground max-w-xl mx-auto">
            Inspired by how grandmasters actually train - structured, deliberate, and deeply focused.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto"
        >
          {steps.map((step) => (
            <motion.div
              key={step.number}
              variants={stepVariants}
              className="relative rounded-lg border border-border p-8 transition-all hover:border-foreground/25"
            >
              <span className="font-display text-5xl font-bold text-gradient-brand opacity-40 absolute top-4 right-6">
                {step.number}
              </span>
              <h3 className="font-display text-xl font-semibold mb-3 mt-2">
                {step.title}
              </h3>
              <p className="font-body text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default MethodSection;
