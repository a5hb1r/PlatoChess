import { LogoMark } from "@/components/LogoMark";

/**
 * Branded route-transition loader — replaces the blank divs that used to
 * flash while lazy pages loaded. Logo breathes, three dots wave.
 */
export function PageLoader() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
      <div className="animate-[loader-breathe_1.6s_ease-in-out_infinite]">
        <LogoMark asLink={false} iconSize="lg" textClass="text-2xl" />
      </div>
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-[loader-dot_1.2s_ease-in-out_infinite]"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <style>{`
        @keyframes loader-breathe {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.75; transform: scale(0.97); }
        }
        @keyframes loader-dot {
          0%, 100% { opacity: 0.35; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
