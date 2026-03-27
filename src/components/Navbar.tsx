import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { LogOut, Settings, LayoutDashboard } from "lucide-react";
import logo from "@/assets/platochess-logo.png";
import type { BoardThemeId } from "@/lib/chess-themes";
import { BOARD_THEMES } from "@/lib/chess-themes";

const Navbar = () => {
  const { user, signOut } = useAuth();
  const { boardTheme, setBoardTheme } = useTheme();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex items-center justify-between gap-3 px-6 py-3">
        <Link to="/" className="flex items-center gap-3 min-w-0 shrink">
          <img
            src={logo}
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 sm:h-12 sm:w-12 shrink-0 object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.08)]"
            decoding="async"
          />
          <span className="font-display text-lg sm:text-xl font-semibold text-foreground tracking-tight">
            Plato<span className="text-gradient-brand">chess</span>
          </span>
        </Link>

        <div className="hidden lg:flex items-center gap-8 font-body text-sm text-muted-foreground">
          <a href="#features" className="transition-colors hover:text-foreground">
            Features
          </a>
          <a href="#method" className="transition-colors hover:text-foreground">
            Method
          </a>
          <a href="#pricing" className="transition-colors hover:text-foreground">
            Pricing
          </a>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <label className="hidden sm:flex items-center gap-2 font-body text-[10px] uppercase tracking-wider text-muted-foreground">
            <span className="sr-only">Board theme</span>
            <select
              value={boardTheme}
              onChange={(e) => setBoardTheme(e.target.value as BoardThemeId)}
              className="max-w-[120px] rounded-md border border-border bg-card px-2 py-1.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {(Object.keys(BOARD_THEMES) as BoardThemeId[]).map((id) => (
                <option key={id} value={id}>
                  {BOARD_THEMES[id].label}
                </option>
              ))}
            </select>
          </label>

          {user ? (
            <>
              <Link
                to="/play"
                className="bg-primary px-4 sm:px-5 py-2 rounded-md font-body text-sm font-semibold text-primary-foreground shadow-gold transition-transform hover:scale-105"
              >
                Play
              </Link>
              <Link
                to="/dashboard"
                className="hidden sm:flex items-center gap-2 border border-border px-3 py-2 rounded-md font-body text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary"
                title="Dashboard"
              >
                <LayoutDashboard className="h-4 w-4" />
              </Link>
              <Link
                to="/settings"
                className="flex items-center gap-2 border border-border px-3 py-2 rounded-md font-body text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary"
                title="Settings"
              >
                <Settings className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={signOut}
                className="hidden sm:flex items-center gap-2 border border-border px-3 py-2 rounded-md font-body text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="bg-primary px-4 sm:px-5 py-2 rounded-md font-body text-sm font-semibold text-primary-foreground shadow-gold transition-transform hover:scale-105"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
