import { Link } from "react-router-dom";
import { UserPlus, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getGuestSession } from "@/lib/guest-session";

export function GuestBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  // Only show for unauthenticated visitors who have completed onboarding
  const guest = getGuestSession();
  if (user || dismissed || !guest?.onboardingComplete) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-card border-t border-border px-4 py-3 flex items-center justify-between gap-4 shadow-lg">
      <p className="font-body text-sm text-muted-foreground">
        <span className="text-foreground font-semibold">You're playing as a guest.</span>{" "}
        Create a free account to save your rating and progress.
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          to="/auth?mode=signup"
          className="inline-flex items-center gap-1.5 bg-primary px-4 py-2 rounded-md font-body text-xs font-semibold text-primary-foreground shadow-gold transition-transform hover:scale-105"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Save progress
        </Link>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
