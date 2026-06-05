/** Board + page accent presets. Applied via `data-board-theme` on `<html>`. */

export type BoardThemeId =
  | "green"
  | "wood"
  | "classic"
  | "marble"
  | "graphite"
  | "zen"
  | "midnight";

export const BOARD_THEMES: Record<
  BoardThemeId,
  { label: string; chessLight: string; chessDark: string; description: string }
> = {
  green: {
    label: "Green / White",
    description: "Tournament green felt squares",
    chessLight: "70 38% 90%",
    chessDark: "92 28% 44%",
  },
  wood: {
    label: "Wood",
    description: "Warm walnut and maple board",
    chessLight: "35 52% 80%",
    chessDark: "26 42% 42%",
  },
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
    label: "Dark Mode",
    description: "Dim board for night play",
    chessLight: "220 12% 38%",
    chessDark: "220 18% 14%",
  },
};

export const DEFAULT_BOARD_THEME: BoardThemeId = "green";

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
