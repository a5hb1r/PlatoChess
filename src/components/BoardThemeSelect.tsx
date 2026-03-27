import { useTheme } from "@/contexts/ThemeContext";
import type { BoardThemeId } from "@/lib/chess-themes";
import { BOARD_THEMES } from "@/lib/chess-themes";

/** Compact board palette control (persists via ThemeContext). */
export function BoardThemeSelect({ className = "" }: { className?: string }) {
  const { boardTheme, setBoardTheme } = useTheme();
  return (
    <label className={`flex flex-col gap-1 font-body text-[10px] uppercase tracking-wider text-muted-foreground ${className}`}>
      Board theme
      <select
        value={boardTheme}
        onChange={(e) => setBoardTheme(e.target.value as BoardThemeId)}
        className="rounded-md border border-border bg-card px-2 py-2 text-xs text-foreground normal-case focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {(Object.keys(BOARD_THEMES) as BoardThemeId[]).map((id) => (
          <option key={id} value={id}>
            {BOARD_THEMES[id].label}
          </option>
        ))}
      </select>
    </label>
  );
}
