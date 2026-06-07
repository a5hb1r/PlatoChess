import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isGuest: boolean;
  signOut: () => Promise<void>;
  convertGuestToAccount: (email: string, password: string, displayName?: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isGuest: false,
  signOut: async () => {},
  convertGuestToAccount: async () => ({ error: null }),
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const isGuest = Boolean(user?.app_metadata?.is_anonymous);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setSession(session);
        setUser(session.user);
        setLoading(false);
      } else {
        // No existing session — create an anonymous one so the user is
        // immediately active without having to sign up.
        const { data, error } = await supabase.auth.signInAnonymously();
        if (!error && data.session) {
          setSession(data.session);
          setUser(data.user);
        }
        setLoading(false);
      }
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

  /** Upgrade an anonymous guest to a real email/password account. */
  const convertGuestToAccount = async (
    email: string,
    password: string,
    displayName?: string
  ): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase.auth.updateUser({
        email,
        password,
        data: displayName ? { full_name: displayName } : undefined,
      });
      if (error) return { error: error.message };
      // Clear is_guest flag in profiles table
      if (user) {
        await supabase
          .from("profiles")
          .update({ is_guest: false, display_name: displayName || undefined })
          .eq("user_id", user.id);
      }
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Failed to create account" };
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isGuest, signOut, convertGuestToAccount }}>
      {children}
    </AuthContext.Provider>
  );
};
