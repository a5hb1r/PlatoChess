import { useState, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { PRODUCTS } from "@/lib/products";

const Checkout = lazy(() => import("./Checkout"));

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

const PricingSection = () => {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const handlePlanClick = (productId: string) => {
    // Free plan doesn't need checkout
    if (productId === "free") {
      window.location.href = "/auth";
      return;
    }
    setSelectedProductId(productId);
  };

  return (
    <section id="pricing" className="py-24 md:py-32">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="font-body text-sm uppercase tracking-[0.3em] text-foreground/75 mb-4">
            Pricing
          </p>
          <h2 className="font-display text-3xl md:text-5xl font-bold mb-4">
            Invest in Your <span className="italic text-gradient-brand">Game</span>
          </h2>
          <p className="font-body text-muted-foreground max-w-xl mx-auto">
            Every plan is built around one goal - making you a stronger chess player.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto items-stretch"
        >
          {PRODUCTS.map((product) => (
            <motion.div
              key={product.id}
              variants={cardVariants}
              className={`relative rounded-lg border p-8 flex flex-col transition-all duration-300 ${
                product.highlighted
                  ? "border-foreground/30 bg-card shadow-gold scale-[1.02]"
                  : "border-border bg-card hover:border-foreground/20"
              }`}
            >
              {product.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary px-4 py-1 rounded-full font-body text-xs font-semibold text-primary-foreground">
                  Most Popular
                </span>
              )}

              <div className="mb-6">
                <h3 className="font-display text-xl font-semibold mb-1">{product.name}</h3>
                <p className="font-body text-sm text-muted-foreground">{product.description}</p>
              </div>

              <div className="mb-6">
                <span className="font-display text-4xl font-bold">
                  ${(product.priceInCents / 100).toFixed(0)}
                </span>
                <span className="font-body text-sm text-muted-foreground ml-1">{product.period}</span>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {product.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 font-body text-sm">
                    <Check className="h-4 w-4 text-foreground/75 mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handlePlanClick(product.id)}
                className={`w-full py-3 rounded-md font-body text-sm font-semibold transition-transform hover:scale-105 ${
                  product.highlighted
                    ? "bg-primary text-primary-foreground shadow-gold"
                    : "border border-border text-foreground hover:border-foreground/25"
                }`}
              >
                {product.cta}
              </button>
            </motion.div>
          ))}
        </motion.div>

        {/* Stripe Checkout Modal */}
        {selectedProductId && (
          <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"><div className="text-foreground">Loading checkout...</div></div>}>
            <Checkout
              productId={selectedProductId}
              onClose={() => setSelectedProductId(null)}
            />
          </Suspense>
        )}
      </div>
    </section>
  );
};

export default PricingSection;
