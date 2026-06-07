import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, X, Loader2, Zap, Crown, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { stripePromise } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/use-profile";
import { LogoMark } from "@/components/LogoMark";
import { PRICING_FEATURES } from "@/lib/tier-features";

const PLANS = [
  {
    id: "free",
    productId: null,
    name: "Free",
    price: "$0",
    period: "forever",
    description: "For casual players",
    icon: Sparkles,
    badge: null,
    highlights: [
      "10 puzzles / day",
      "3 philosopher bots (up to ~900 ELO)",
      "Openings explorer",
      "Human vs human games",
    ],
    cta: "Current plan",
    ctaDisabled: true,
  },
  {
    id: "pro",
    productId: "pro-monthly",
    name: "Pro",
    price: "$9",
    period: "/ month",
    description: "For the dedicated improver",
    icon: Zap,
    badge: "Popular",
    highlights: [
      "Unlimited puzzles",
      "6 bots (up to ~1650 ELO)",
      "Full post-game analysis",
      "Move ratings + AI coach",
      "Personalized puzzles",
    ],
    cta: "Subscribe to Pro",
    ctaDisabled: false,
  },
  {
    id: "master",
    productId: "master-monthly",
    name: "Master",
    price: "$19",
    period: "/ month",
    description: "Train like a titled player",
    icon: Crown,
    badge: "Best value",
    highlights: [
      "Everything in Pro",
      "All 8 bots incl. Hypatia & Plato (~2100)",
      "Deep analysis (depth 15)",
      "Custom position analysis",
      "Priority matchmaking",
    ],
    cta: "Subscribe to Master",
    ctaDisabled: false,
  },
] as const;

const Pricing = () => {
  const { user } = useAuth();
  const { isPro, isMaster, loading: profileLoading } = useProfile();
  const navigate = useNavigate();

  const [checkoutProductId, setCheckoutProductId] = useState<string | null>(null);
  const [loadingProductId, setLoadingProductId] = useState<string | null>(null);

  const fetchClientSecret = useCallback(
    async (productId: string) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ productId }),
      });
      const data = await res.json();
      if (!res.ok || !data.clientSecret) throw new Error(data.error || "Checkout failed");
      return data.clientSecret as string;
    },
    []
  );

  const handleSubscribe = async (productId: string) => {
    if (!user) {
      navigate("/auth?next=/pricing");
      return;
    }
    setLoadingProductId(productId);
    try {
      setCheckoutProductId(productId);
    } finally {
      setLoadingProductId(null);
    }
  };

  const activeId = isMaster ? "master" : isPro ? "pro" : "free";

  if (checkoutProductId) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <nav className="border-b border-border/50 bg-background/80 backdrop-blur-md">
          <div className="container mx-auto flex items-center gap-4 px-6 py-4">
            <button
              type="button"
              onClick={() => setCheckoutProductId(null)}
              className="flex items-center gap-2 font-body text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to plans
            </button>
            <LogoMark iconSize="sm" textClass="text-base" />
          </div>
        </nav>
        <div className="flex-1 container mx-auto max-w-2xl px-6 py-12">
          <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={{ fetchClientSecret: () => fetchClientSecret(checkoutProductId) }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center gap-4 px-6 py-4">
          <Link
            to="/"
            className="flex items-center gap-2 font-body text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <LogoMark iconSize="sm" textClass="text-base" />
        </div>
      </nav>

      <div className="container mx-auto px-6 py-16 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <p className="font-body text-xs uppercase tracking-[0.3em] text-muted-foreground mb-3">
            Plans &amp; Pricing
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-bold mb-4">
            Invest in your <span className="text-gradient-brand italic">chess</span>
          </h1>
          <p className="font-body text-muted-foreground max-w-md mx-auto">
            Start free. Upgrade when you want deeper analysis and coaching.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan, i) => {
            const Icon = plan.icon;
            const isCurrent = !profileLoading && activeId === plan.id;
            const isHighlighted = plan.id === "pro";

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className={`relative rounded-xl border p-6 flex flex-col gap-5 ${
                  isHighlighted
                    ? "border-primary/50 shadow-gold bg-card"
                    : "border-border bg-card"
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground font-body text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                    {plan.badge}
                  </span>
                )}

                <div>
                  <div className="flex items-center gap-2.5 mb-3">
                    <Icon className="h-5 w-5 text-foreground/70" />
                    <span className="font-display text-lg font-semibold">{plan.name}</span>
                  </div>
                  <p className="font-body text-xs text-muted-foreground">{plan.description}</p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="font-display text-4xl font-bold">{plan.price}</span>
                  <span className="font-body text-sm text-muted-foreground">{plan.period}</span>
                </div>

                <ul className="space-y-2.5 flex-1">
                  {plan.highlights.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 font-body text-sm">
                      <Check className="h-4 w-4 shrink-0 text-primary mt-px" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled={plan.ctaDisabled || isCurrent || loadingProductId === plan.productId}
                  onClick={() => plan.productId && handleSubscribe(plan.productId)}
                  className={`w-full py-3 rounded-md font-body text-sm font-semibold transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${
                    isHighlighted
                      ? "bg-primary text-primary-foreground shadow-gold hover:scale-[1.02]"
                      : "border border-border text-foreground hover:bg-secondary"
                  }`}
                >
                  {loadingProductId === plan.productId ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </span>
                  ) : isCurrent ? (
                    "Current plan"
                  ) : (
                    plan.cta
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* Feature comparison table */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-16"
        >
          <h2 className="font-display text-2xl font-bold text-center mb-6">
            Full feature comparison
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full font-body text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 pr-4 font-semibold text-foreground/80 w-1/2">Feature</th>
                  <th className="py-3 px-3 font-semibold text-foreground/80 text-center">Free</th>
                  <th className="py-3 px-3 font-semibold text-foreground/80 text-center">Pro</th>
                  <th className="py-3 px-3 font-semibold text-foreground/80 text-center">Master</th>
                </tr>
              </thead>
              <tbody>
                {PRICING_FEATURES.map((row, i) => (
                  <tr
                    key={row.label}
                    className={`border-b border-border/50 ${i % 2 === 0 ? "bg-secondary/30" : ""}`}
                  >
                    <td className="py-3 pr-4 text-foreground/80">{row.label}</td>
                    {(["free", "pro", "master"] as const).map((tier) => {
                      const val = row[tier];
                      return (
                        <td key={tier} className="py-3 px-3 text-center">
                          {val === true ? (
                            <Check className="h-4 w-4 text-primary mx-auto" />
                          ) : val === false ? (
                            <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                          ) : (
                            <span className="text-foreground/70 text-xs">{val}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        <p className="text-center font-body text-xs text-muted-foreground mt-10">
          Cancel anytime from{" "}
          <Link to="/settings" className="underline hover:text-foreground">
            Settings
          </Link>
          . Payments secured by Stripe.
        </p>
      </div>
    </div>
  );
};

export default Pricing;
