/** Board + page accent presets (black & white family). Applied via `data-board-theme` on `<html>`. */

export type BoardThemeId = "classic" | "marble" | "graphite" | "zen" | "midnight";

export const BOARD_THEMES: Record<
  BoardThemeId,
  { label: string; chessLight: string; chessDark: string; description: string }
> = {
  classic: {
    label: "Classic",
    description: "Soft ivory and charcoal squares",
    chessLight: "0 0% 88%",
    chessDark: "0 0% 32%",
  },
  marble: {
    label: "Marble",
    description: "High-contrast light gray / slate",
    chessLight: "0 0% 96%",
    chessDark: "0 0% 42%",
  },
  graphite: {
    label: "Graphite",
    description: "Cool blue-gray tones",
    chessLight: "215 18% 82%",
    chessDark: "215 22% 28%",
  },
  zen: {
    label: "Zen",
    description: "Muted near-white / deep gray",
    chessLight: "0 0% 92%",
    chessDark: "0 0% 22%",
  },
  midnight: {
    label: "Midnight",
    description: "Dim board for night play",
    chessLight: "220 12% 38%",
    chessDark: "220 18% 14%",
  },
};

export const DEFAULT_BOARD_THEME: BoardThemeId = "classic";

export function isBoardThemeId(s: string): s is BoardThemeId {
  return s in BOARD_THEMES;
}

export function applyBoardTheme(id: BoardThemeId) {
  const t = BOARD_THEMES[id];
  if (!t || typeof document === "undefined") return;
  document.documentElement.dataset.boardTheme = id;
  document.documentElement.style.setProperty("--chess-light", t.chessLight);
  document.documentElement.style.setProperty("--chess-dark", t.chessDark);
}
