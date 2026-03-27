import { motion } from "framer-motion";
import { Target, BookOpen, BarChart3, Swords, Brain, Repeat } from "lucide-react";

const features = [
  {
    icon: Target,
    title: "Tactical Puzzles",
    description:
      "Curated puzzles matched to your rating and weakness patterns. Every puzzle sharpens a specific skill.",
  },
  {
    icon: BookOpen,
    title: "Opening Repertoire",
    description:
      "Build and drill a personalized opening repertoire. Learn the ideas, not just the moves.",
  },
  {
    icon: BarChart3,
    title: "Deep Analysis",
    description:
      "Review your games with engine-powered insights that explain why - not just what - went wrong.",
  },
  {
    icon: Swords,
    title: "Focused Play",
    description:
      "Play rated games with post-game reviews built in. Every game becomes a learning opportunity.",
  },
  {
    icon: Brain,
    title: "Endgame Mastery",
    description:
      "Structured endgame courses from basic checkmates to complex theoretical positions.",
  },
  {
    icon: Repeat,
    title: "Spaced Repetition",
    description:
      "Critical positions resurface at optimal intervals so knowledge sticks permanently.",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

const FeaturesSection = () => {
  return (
    <section id="features" className="py-24 md:py-32">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="font-body text-sm uppercase tracking-[0.3em] text-foreground/75 mb-4">
            Everything You Need
          </p>
          <h2 className="font-display text-3xl md:text-5xl font-bold mb-4">
            Train With <span className="italic text-gradient-brand">Purpose</span>
          </h2>
          <p className="font-body text-muted-foreground max-w-xl mx-auto">
            Every feature exists to make you a stronger chess player. Nothing more, nothing less.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={cardVariants}
              className="group rounded-lg border border-border bg-card p-8 transition-all duration-300 hover:border-foreground/25 hover:shadow-elevated"
            >
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-md bg-secondary text-foreground/75 transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-xl font-semibold mb-3">
                {feature.title}
              </h3>
              <p className="font-body text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default FeaturesSection;
