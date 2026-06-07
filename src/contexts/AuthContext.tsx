import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !session?.access_token) return;

    let cancelled = false;
    const seenNotificationIds = new Set<string>();

    const fetchDailyNotifications = async () => {
      try {
        const response = await fetch("/api/daily-notifications", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        if (!response.ok) return;

        const payload = (await response.json()) as {
          notifications?: { id: string; game_session_id: string }[];
        };
        const notifications = payload.notifications || [];
        const newNotifications = notifications.filter((item) => !seenNotificationIds.has(item.id));
        if (cancelled || newNotifications.length === 0) return;

        newNotifications.forEach((item) => {
          seenNotificationIds.add(item.id);
          toast.message("Daily game update: it is your turn.", {
            description: `Game ${item.game_session_id.slice(0, 8).toUpperCase()}`,
          });
        });

        await fetch("/api/daily-notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ ids: newNotifications.map((item) => item.id) }),
        });
      } catch {
        // Best-effort notification fetch: do not block auth state.
      }
    };

    fetchDailyNotifications();
    const interval = window.setInterval(fetchDailyNotifications, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [session?.access_token, user]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
