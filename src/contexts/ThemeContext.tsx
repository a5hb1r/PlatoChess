import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import {
  applyBoardTheme,
  type BoardThemeId,
  BOARD_THEMES,
  DEFAULT_BOARD_THEME,
  isBoardThemeId,
} from "@/lib/chess-themes";

const STORAGE_KEY = "platochess-board-theme";

type ThemeContextValue = {
  boardTheme: BoardThemeId;
  setBoardTheme: (id: BoardThemeId) => void;
  boardThemes: typeof BOARD_THEMES;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [boardTheme, setBoardThemeState] = useState<BoardThemeId>(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s && isBoardThemeId(s)) return s;
    } catch {
      /* ignore */
    }
    return DEFAULT_BOARD_THEME;
  });

  const setBoardTheme = useCallback((id: BoardThemeId) => {
    setBoardThemeState(id);
  }, []);

  useLayoutEffect(() => {
    applyBoardTheme(boardTheme);
    try {
      localStorage.setItem(STORAGE_KEY, boardTheme);
    } catch {
      /* ignore */
    }
  }, [boardTheme]);

  const value = useMemo(
    () => ({ boardTheme, setBoardTheme, boardThemes: BOARD_THEMES }),
    [boardTheme, setBoardTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
