/**
 * PlayerBanner — the horizontal player card shown above and below the board.
 * Surfaces avatar, name, rating, optional country flag, the pieces this player
 * has captured (with material advantage), and a synchronized countdown clock
 * that flashes red under 20 seconds.
 */
import { memo, type ReactNode } from "react";
import type { Color, PieceSymbol } from "chess.js";
import { Loader2 } from "lucide-react";
import { CapturedPieces } from "./CapturedPieces";
import { formatClock } from "@/hooks/use-chess-clock";

export interface PlayerBannerProps {
  name: string;
  rating?: number | string;
  subtitle?: string;
  /** Avatar slot (icon or image). */
  avatar?: ReactNode;
  /** Optional country flag emoji. */
  flag?: string;
  /** Side this player controls — captured pieces shown are the opponent's color. */
  color: Color;
  captured: PieceSymbol[];
  advantage?: number;
  isActive?: boolean;
  isThinking?: boolean;
  /** Remaining time in ms; pass null to hide the clock entirely. */
  clockMs?: number | null;
  flagged?: boolean;
}

export const PlayerBanner = memo(function PlayerBanner({
  name,
  rating,
  subtitle,
  avatar,
  flag,
  color,
  captured,
  advantage = 0,
  isActive = false,
  isThinking = false,
  clockMs = null,
  flagged = false,
}: PlayerBannerProps) {
  const showClock = clockMs !== null;
  const lowTime = showClock && isActive && clockMs! < 20000 && clockMs! > 0;
  const capturedColor: Color = color === "w" ? "b" : "w";

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-all duration-200 ${
        isActive
          ? "border-primary/40 bg-secondary/80 shadow-soft"
          : "border-border/60 bg-card/60"
      }`}
    >
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary text-muted-foreground">
        {avatar}
        {isActive && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-card" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {flag && <span className="text-sm leading-none">{flag}</span>}
          <span className="truncate font-body text-sm font-semibold text-foreground">{name}</span>
          {typeof rating !== "undefined" && (
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
              {rating}
            </span>
          )}
          {isThinking && <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <CapturedPieces pieces={captured} color={capturedColor} advantage={advantage} />
          {subtitle && captured.length === 0 && advantage <= 0 && (
            <span className="font-body text-[11px] text-muted-foreground">{subtitle}</span>
          )}
        </div>
      </div>

      {showClock && (
        <div
          className={`flex h-9 min-w-[72px] items-center justify-center rounded-lg border px-2 font-mono text-lg font-bold tabular-nums transition-colors ${
            flagged
              ? "border-destructive/60 bg-destructive/20 text-destructive"
              : lowTime
                ? "timer-danger border-destructive/50 text-destructive"
                : isActive
                  ? "border-primary/30 bg-background/60 text-foreground"
                  : "border-border/60 bg-background/40 text-muted-foreground"
          }`}
        >
          {formatClock(clockMs!)}
        </div>
      )}
    </div>
  );
});
