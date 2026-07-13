import { Link, useLocation } from "react-router-dom";
import { UserPlus, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getGuestSession } from "@/lib/guest-session";

const DISMISS_KEY = "platochess:guest-banner-dismissed";

/** Pages where the nudge would cover primary actions or distract from play. */
const HIDDEN_ON = ["/auth", "/pricing", "/game", "/analyze-game"];

/**
 * Compact bottom-right save-progress nudge for guests. Toast-sized on
 * purpose — the old full-width bar sat over page content (it covered the
 * Subscribe button on Pricing, among others).
 */
export function GuestBanner() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  // Only show for unauthenticated visitors who have completed onboarding
  const guest = getGuestSession();
  if (user || dismissed || !guest?.onboardingComplete) return null;
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[calc(100vw-2rem)] max-w-xs rounded-xl border border-border bg-card p-4 shadow-panel">
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <p className="pr-5 font-body text-xs text-muted-foreground">
        <span className="block font-semibold text-foreground text-sm mb-0.5">
          Playing as a guest
        </span>
        Create a free account to keep your rating and progress.
      </p>
      <Link
        to="/auth?mode=signup"
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 font-body text-xs font-semibold text-primary-foreground transition-transform hover:scale-[1.02]"
      >
        <UserPlus className="h-3.5 w-3.5" />
        Save progress
      </Link>
    </div>
  );
}
