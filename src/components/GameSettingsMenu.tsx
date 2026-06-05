import { Check, Settings2, Volume2, VolumeX } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/contexts/ThemeContext";
import type { BoardThemeId } from "@/lib/chess-themes";

/**
 * Quick-access game settings popover (chess.com-style gear menu).
 * Lets the player switch board theme, mute SFX, and toggle move hints
 * without leaving the board.
 */
export function GameSettingsMenu({ className = "" }: { className?: string }) {
  const {
    boardTheme,
    setBoardTheme,
    boardThemes,
    soundEnabled,
    setSoundEnabled,
    showValidMoves,
    setShowValidMoves,
  } = useTheme();

  return (
    <Popover>
      <PopoverTrigger
        aria-label="Open game settings"
        className={`flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 font-body text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground ${className}`}
      >
        <Settings2 className="h-4 w-4" />
        Settings
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 space-y-4 border-border bg-card p-4"
      >
        <div>
          <p className="mb-2 font-body text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Board theme
          </p>
          <div className="grid grid-cols-1 gap-1">
            {(Object.keys(boardThemes) as BoardThemeId[]).map((id) => {
              const theme = boardThemes[id];
              const active = boardTheme === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setBoardTheme(id)}
                  className={`flex items-center gap-3 rounded-md border px-2.5 py-2 text-left transition-colors ${
                    active
                      ? "border-primary/60 bg-secondary"
                      : "border-border hover:bg-secondary/60"
                  }`}
                >
                  <span className="flex h-6 w-6 shrink-0 overflow-hidden rounded-sm border border-border">
                    <span
                      className="h-full w-1/2"
                      style={{ background: `hsl(${theme.chessLight})` }}
                    />
                    <span
                      className="h-full w-1/2"
                      style={{ background: `hsl(${theme.chessDark})` }}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-body text-sm text-foreground">
                      {theme.label}
                    </span>
                    <span className="block truncate font-body text-[11px] text-muted-foreground">
                      {theme.description}
                    </span>
                  </span>
                  {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-border" />

        <label className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 font-body text-sm text-foreground">
            {soundEnabled ? (
              <Volume2 className="h-4 w-4 text-foreground/75" />
            ) : (
              <VolumeX className="h-4 w-4 text-muted-foreground" />
            )}
            Sound effects
          </span>
          <Switch
            checked={soundEnabled}
            onCheckedChange={setSoundEnabled}
            aria-label="Toggle sound effects"
          />
        </label>

        <label className="flex items-center justify-between gap-3">
          <span className="font-body text-sm text-foreground">
            Show valid moves
          </span>
          <Switch
            checked={showValidMoves}
            onCheckedChange={setShowValidMoves}
            aria-label="Toggle valid move indicators"
          />
        </label>
      </PopoverContent>
    </Popover>
  );
}
