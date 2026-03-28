import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CreditCard, User, LogOut, Loader2, Pencil, Check, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Profile {
  display_name: string | null;
  username: string | null;
}

const Settings = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Edit states
  const [editingName, setEditingName] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [usernameValue, setUsernameValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (user) {
      supabase
        .from("profiles")
        .select("display_name, username")
        .eq("user_id", user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setProfile(data);
            setNameValue(data.display_name || "");
            setUsernameValue(data.username || "");
          }
          setLoadingProfile(false);
        });
    }
  }, [user, authLoading, navigate]);

  const saveField = async (field: "display_name" | "username", value: string) => {
    if (!user) return;
    const trimmed = value.trim();

    if (field === "username" && trimmed.length > 0) {
      if (trimmed.length < 3 || trimmed.length > 30) {
        toast.error("Username must be 3-30 characters");
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
        toast.error("Username can only contain letters, numbers, and underscores");
        return;
      }
    }

    if (field === "display_name" && trimmed.length > 50) {
      toast.error("Display name must be under 50 characters");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ [field]: trimmed || null })
      .eq("user_id", user.id);

    if (error) {
      toast.error("Failed to save. Please try again.");
    } else {
      setProfile((prev) => prev ? { ...prev, [field]: trimmed || null } : prev);
      toast.success("Saved!");
      if (field === "display_name") setEditingName(false);
      else setEditingUsername(false);
    }
    setSaving(false);
  };

  const handleManageSubscription = async () => {
    if (!user?.email) {
      navigate("/auth");
      return;
    }

    setLoadingPortal(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const response = await fetch("/api/create-portal-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          email: user.email,
          returnUrl: window.location.origin + "/settings",
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);
      if (data.url) window.location.href = data.url;
    } catch (error) {
      toast.error("Unable to open subscription management. Please try again.");
    } finally {
      setLoadingPortal(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (authLoading || loadingProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground/75" />
      </div>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center gap-4 px-6 py-4">
          <Link
            to="/"
            className="flex items-center gap-2 font-body text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <h1 className="font-display text-xl font-semibold">
            Account <span className="text-gradient-brand">Settings</span>
          </h1>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-12 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          {/* Profile Info */}
          <section>
            <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-foreground/75" />
              Profile
            </h2>
            <div className="rounded-lg border border-border bg-card p-6 space-y-5">
              {/* Display Name */}
              <div>
                <p className="font-body text-sm text-muted-foreground mb-1">Display Name</p>
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      maxLength={50}
                      className="h-9 max-w-xs bg-secondary border-border font-body"
                      placeholder="Enter display name"
                      autoFocus
                    />
                    <button
                      onClick={() => saveField("display_name", nameValue)}
                      disabled={saving}
                      className="p-1.5 rounded-md text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => { setEditingName(false); setNameValue(profile?.display_name || ""); }}
                      className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="font-body text-foreground">{profile?.display_name || "-"}</p>
                    <button
                      onClick={() => setEditingName(true)}
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Username */}
              <div>
                <p className="font-body text-sm text-muted-foreground mb-1">Username</p>
                {editingUsername ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center">
                      <span className="font-body text-muted-foreground text-sm mr-1">@</span>
                      <Input
                        value={usernameValue}
                        onChange={(e) => setUsernameValue(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                        maxLength={30}
                        className="h-9 max-w-xs bg-secondary border-border font-body"
                        placeholder="username"
                        autoFocus
                      />
                    </div>
                    <button
                      onClick={() => saveField("username", usernameValue)}
                      disabled={saving}
                      className="p-1.5 rounded-md text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => { setEditingUsername(false); setUsernameValue(profile?.username || ""); }}
                      className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="font-body text-foreground">{profile?.username ? `@${profile.username}` : "-"}</p>
                    <button
                      onClick={() => setEditingUsername(true)}
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Email (read-only) */}
              <div>
                <p className="font-body text-sm text-muted-foreground mb-1">Email</p>
                <p className="font-body text-foreground">{user.email}</p>
              </div>

              {/* User ID (read-only) */}
              <div>
                <p className="font-body text-sm text-muted-foreground mb-1">User ID</p>
                <p className="font-body text-foreground text-sm font-mono">{user.id.slice(0, 8).toUpperCase()}</p>
              </div>
            </div>
          </section>

          {/* Subscription Management */}
          <section>
            <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-foreground/75" />
              Subscription
            </h2>
            <div className="rounded-lg border border-border bg-card p-6">
              <p className="font-body text-sm text-muted-foreground mb-4">
                Manage your subscription, update payment methods, or cancel your plan through the Stripe Customer Portal.
              </p>
              <button
                onClick={handleManageSubscription}
                disabled={loadingPortal}
                className="inline-flex items-center gap-2 bg-primary px-6 py-3 rounded-md font-body text-sm font-semibold text-primary-foreground shadow-gold transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {loadingPortal ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Opening Portal...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    Manage Subscription
                  </>
                )}
              </button>
            </div>
          </section>

          {/* Sign Out */}
          <section>
            <div className="rounded-lg border border-border bg-card p-6">
              <button
                onClick={handleSignOut}
                className="inline-flex items-center gap-2 border border-destructive/50 text-destructive px-6 py-3 rounded-md font-body text-sm font-semibold transition-colors hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </section>
        </motion.div>
      </div>
    </div>
  );
};

export default Settings;
