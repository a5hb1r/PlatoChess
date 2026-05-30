import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
import { areSoundsEnabled, setSoundsEnabled, SOUND_STORAGE_KEY } from "@/lib/sounds";

const STORAGE_KEY = "platochess-board-theme";
const VALID_MOVES_STORAGE_KEY = "platochess-show-valid-moves";

type ThemeContextValue = {
  boardTheme: BoardThemeId;
  setBoardTheme: (id: BoardThemeId) => void;
  boardThemes: typeof BOARD_THEMES;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  showValidMoves: boolean;
  setShowValidMoves: (show: boolean) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw !== "false";
  } catch {
    return fallback;
  }
}

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

  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => areSoundsEnabled());
  const [showValidMoves, setShowValidMovesState] = useState<boolean>(() =>
    readBool(VALID_MOVES_STORAGE_KEY, true)
  );

  const setBoardTheme = useCallback((id: BoardThemeId) => {
    setBoardThemeState(id);
  }, []);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    setSoundEnabledState(enabled);
    setSoundsEnabled(enabled);
  }, []);

  const setShowValidMoves = useCallback((show: boolean) => {
    setShowValidMovesState(show);
    try {
      localStorage.setItem(VALID_MOVES_STORAGE_KEY, String(show));
    } catch {
      /* ignore */
    }
  }, []);

  useLayoutEffect(() => {
    applyBoardTheme(boardTheme);
    try {
      localStorage.setItem(STORAGE_KEY, boardTheme);
    } catch {
      /* ignore */
    }
  }, [boardTheme]);

  // Keep the audio module in sync (covers first mount + storage edits in other tabs).
  useEffect(() => {
    setSoundsEnabled(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === SOUND_STORAGE_KEY) {
        setSoundEnabledState(event.newValue !== "false");
      } else if (event.key === VALID_MOVES_STORAGE_KEY) {
        setShowValidMovesState(event.newValue !== "false");
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const value = useMemo(
    () => ({
      boardTheme,
      setBoardTheme,
      boardThemes: BOARD_THEMES,
      soundEnabled,
      setSoundEnabled,
      showValidMoves,
      setShowValidMoves,
    }),
    [boardTheme, setBoardTheme, soundEnabled, setSoundEnabled, showValidMoves, setShowValidMoves]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
