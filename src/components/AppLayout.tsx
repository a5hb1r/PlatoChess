import { type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home,
  Swords,
  Puzzle,
  BookOpen,
  BarChart2,
  Bot,
  Settings,
  LogOut,
  Upload,
  DollarSign,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/use-profile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogoMark } from "@/components/LogoMark";

const NAV_ITEMS = [
  { to: "/dashboard", icon: Home,     label: "Home"     },
  { to: "/play",      icon: Swords,   label: "Play"     },
  { to: "/puzzles",   icon: Puzzle,   label: "Puzzles"  },
  { to: "/openings",  icon: BookOpen, label: "Learn"    },
  { to: "/analyze",   icon: BarChart2,label: "Analysis" },
  { to: "/bots",      icon: Bot,      label: "Bots"     },
  { to: "/import",    icon: Upload,   label: "Import"   },
  { to: "/pricing",   icon: DollarSign,label: "Upgrade" },
];

const BOTTOM_ITEMS = [
  { to: "/settings", icon: Settings, label: "Settings" },
];

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const { signOut } = useAuth();
  const { profile } = useProfile();

  const initials = profile
    ? (profile.display_name || profile.username || "?")
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Left Sidebar ────────────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-40 flex flex-col w-14 lg:w-48 bg-[hsl(222,47%,8%)] border-r border-border/40">

        {/* Logo */}
        <div className="flex h-14 items-center justify-center lg:justify-start lg:px-4 border-b border-border/30 shrink-0">
          <Link to="/dashboard" className="flex items-center gap-2 min-w-0">
            <LogoMark iconSize="sm" textClass="hidden lg:block text-sm font-bold truncate" />
          </Link>
        </div>

        {/* Primary nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-1.5 space-y-0.5">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
            const active =
              location.pathname === to ||
              (to !== "/dashboard" && location.pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                title={label}
                className={`group flex items-center gap-3 rounded-md px-2 py-2 text-sm font-body transition-colors ${
                  active
                    ? "bg-sidebar-accent text-primary font-semibold"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                }`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className="hidden lg:block leading-none">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="shrink-0 border-t border-border/30 px-1.5 py-3 space-y-0.5">
          {BOTTOM_ITEMS.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              title={label}
              className="flex items-center gap-3 rounded-md px-2 py-2 text-sm font-body text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground transition-colors"
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="hidden lg:block">{label}</span>
            </Link>
          ))}

          <button
            type="button"
            onClick={signOut}
            title="Sign out"
            className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm font-body text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground transition-colors"
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            <span className="hidden lg:block">Sign out</span>
          </button>

          {/* User chip */}
          {profile && (
            <Link
              to="/settings"
              title={profile.display_name || profile.username || "Profile"}
              className="flex items-center gap-2.5 rounded-md px-2 py-2 hover:bg-sidebar-accent/60 transition-colors mt-1"
            >
              <Avatar className="h-7 w-7 shrink-0 border border-border/50">
                <AvatarImage src={profile.avatar_url ?? undefined} />
                <AvatarFallback className="bg-secondary text-foreground text-[10px] font-display">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden lg:block min-w-0">
                <p className="text-xs font-semibold text-foreground truncate leading-none">
                  {profile.display_name || profile.username || "Player"}
                </p>
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
                  {profile.rating} ELO
                </p>
              </div>
            </Link>
          )}
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────── */}
      <div className="flex-1 ml-14 lg:ml-48 min-h-screen">
        {children}
      </div>
    </div>
  );
}
