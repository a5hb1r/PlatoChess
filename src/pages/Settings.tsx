import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CreditCard,
  User,
  LogOut,
  Loader2,
  Pencil,
  Check,
  X,
  Shield,
  Trophy,
  Palette,
  Upload,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { validateDisplayName, validateUsername } from "@/lib/content-moderation";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useTheme } from "@/contexts/ThemeContext";
import type { BoardThemeId } from "@/lib/chess-themes";
import { pieceUrl, type PieceSetId } from "@/lib/chess-constants";
import { COUNTRIES, countryFlag, countryName } from "@/lib/countries";

const PREMOVE_STORAGE_KEY = "plato:premove-enabled";
const PREMOVE_QUEUE_STORAGE_KEY = "plato:queued-premove";

interface Profile {
  avatar_url: string | null;
  display_name: string | null;
  country: string | null;
  max_active_games: number;
  premove_enabled: boolean;
  rating: number;
  username: string | null;
  subscription_status: string | null;
  subscription_plan: string | null;
}

const Settings = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const {
    boardTheme,
    setBoardTheme,
    boardThemes,
    pieceSet,
    setPieceSet,
    pieceSets,
    soundEnabled,
    setSoundEnabled,
    showValidMoves,
    setShowValidMoves,
  } = useTheme();
  const navigate = useNavigate();
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingName, setEditingName] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [usernameValue, setUsernameValue] = useState("");
  const [avatarValue, setAvatarValue] = useState("");
  const [maxGamesValue, setMaxGamesValue] = useState(3);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

  const handleAvatarFile = async (file: File | undefined) => {
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Image must be under 2 MB.");
      return;
    }

    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      await updateProfile({ avatar_url: data.publicUrl }, "Profile picture updated!");
      setAvatarValue(data.publicUrl);
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploadingAvatar(false);
      if (avatarFileRef.current) avatarFileRef.current.value = "";
    }
  };

  const saveCountry = async (code: string) => {
    await updateProfile(
      { country: code || null },
      code ? `Country set to ${countryName(code)} ${countryFlag(code)}` : "Country cleared."
    );
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    if (!user) return;

    supabase
      .from("profiles")
      .select("avatar_url, display_name, country, max_active_games, premove_enabled, rating, username, subscription_status, subscription_plan")
      .eq("user_id", user.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          toast.error("Could not load profile settings.");
          setLoadingProfile(false);
          return;
        }
        if (data) {
          setProfile(data);
          setNameValue(data.display_name || "");
          setUsernameValue(data.username || "");
          setAvatarValue(data.avatar_url || "");
          setMaxGamesValue(data.max_active_games);
          localStorage.setItem(PREMOVE_STORAGE_KEY, JSON.stringify(data.premove_enabled));
        }
        setLoadingProfile(false);
      });
  }, [authLoading, navigate, user]);

  const updateProfile = async (updates: Partial<Profile>, successMessage = "Saved!") => {
    if (!user) return;

    setSaving(true);
    const { error } = await supabase.from("profiles").update(updates).eq("user_id", user.id);
    if (error) {
      if (error.message.toLowerCase().includes("disallowed content")) {
        toast.error("That name isn't allowed. Please choose a different one.");
      } else if (error.message.toLowerCase().includes("username")) {
        toast.error("That username is already taken.");
      } else {
        toast.error("Failed to save. Please try again.");
      }
      setSaving(false);
      return;
    }

    setProfile((prev) => (prev ? { ...prev, ...updates } : prev));
    if (updates.premove_enabled !== undefined) {
      localStorage.setItem(PREMOVE_STORAGE_KEY, JSON.stringify(updates.premove_enabled));
      if (!updates.premove_enabled) {
        localStorage.removeItem(PREMOVE_QUEUE_STORAGE_KEY);
        window.dispatchEvent(new CustomEvent("plato:premove-disabled"));
      }
    }
    toast.success(successMessage);
    setSaving(false);
  };

  const saveDisplayName = async () => {
    const trimmed = nameValue.trim();
    const err = validateDisplayName(trimmed);
    if (err) { toast.error(err); return; }
    await updateProfile({ display_name: trimmed || null });
    setEditingName(false);
  };

  const saveUsername = async () => {
    const trimmed = usernameValue.trim();
    const err = validateUsername(trimmed);
    if (err) { toast.error(err); return; }
    await updateProfile({ username: trimmed.toLowerCase() });
    setEditingUsername(false);
  };

  const saveAvatar = async () => {
    const trimmed = avatarValue.trim();
    if (trimmed.length > 0) {
      try {
        new URL(trimmed);
      } catch {
        toast.error("Profile picture must be a valid URL.");
        return;
      }
    }
    await updateProfile({ avatar_url: trimmed || null });
    setEditingAvatar(false);
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
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          email: user.email,
          returnUrl: window.location.origin + "/settings",
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      if (data.url) window.location.href = data.url;
    } catch {
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

  if (!user || !profile) {
    navigate("/auth");
    return null;
  }

  const initials = (profile.display_name || profile.username || user.email || "P")
    .split(" ")
    .map((token) => token[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

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
            Settings <span className="text-gradient-brand">Hub</span>
          </h1>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-12 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          <section>
            <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-foreground/75" />
              Profile
            </h2>
            <div className="rounded-lg border border-border bg-card p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <Avatar className="h-20 w-20 border-2 border-border">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback className="font-display text-xl bg-secondary">{initials}</AvatarFallback>
                </Avatar>
                <div className="space-y-2 w-full">
                  <p className="font-body text-sm text-muted-foreground">Profile Picture</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={avatarFileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => handleAvatarFile(e.target.files?.[0])}
                    />
                    <button
                      onClick={() => avatarFileRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-body font-semibold text-primary-foreground shadow-gold transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                    >
                      {uploadingAvatar ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                      {uploadingAvatar ? "Uploading…" : "Upload photo"}
                    </button>
                    {editingAvatar ? (
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Input
                          value={avatarValue}
                          onChange={(event) => setAvatarValue(event.target.value)}
                          className="h-9 bg-secondary border-border font-body"
                          placeholder="https://..."
                        />
                        <button
                          onClick={saveAvatar}
                          disabled={saving}
                          className="p-1.5 rounded-md text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                        >
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => {
                            setEditingAvatar(false);
                            setAvatarValue(profile.avatar_url || "");
                          }}
                          className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingAvatar(true)}
                        className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-body text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Use URL instead
                      </button>
                    )}
                  </div>
                  <p className="font-body text-[11px] text-muted-foreground">
                    PNG, JPG, WebP or GIF — up to 2 MB.
                  </p>
                </div>
              </div>

              <div>
                <p className="font-body text-sm text-muted-foreground mb-1">Display Name</p>
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={nameValue}
                      onChange={(event) => setNameValue(event.target.value)}
                      maxLength={50}
                      className="h-9 max-w-xs bg-secondary border-border font-body"
                      placeholder="Enter display name"
                    />
                    <button
                      onClick={saveDisplayName}
                      disabled={saving}
                      className="p-1.5 rounded-md text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => {
                        setEditingName(false);
                        setNameValue(profile.display_name || "");
                      }}
                      className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="font-body text-foreground">{profile.display_name || "-"}</p>
                    <button
                      onClick={() => setEditingName(true)}
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div>
                <p className="font-body text-sm text-muted-foreground mb-1">Username (unique handle)</p>
                {editingUsername ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center">
                      <span className="font-body text-muted-foreground text-sm mr-1">@</span>
                      <Input
                        value={usernameValue}
                        onChange={(event) => setUsernameValue(event.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                        maxLength={30}
                        className="h-9 max-w-xs bg-secondary border-border font-body"
                        placeholder="username"
                      />
                    </div>
                    <button
                      onClick={saveUsername}
                      disabled={saving}
                      className="p-1.5 rounded-md text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => {
                        setEditingUsername(false);
                        setUsernameValue(profile.username || "");
                      }}
                      className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="font-body text-foreground">{profile.username ? `@${profile.username}` : "-"}</p>
                    <button
                      onClick={() => setEditingUsername(true)}
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div>
                <p className="font-body text-sm text-muted-foreground mb-1">Country</p>
                <div className="flex items-center gap-3">
                  {profile.country && (
                    <span className="text-2xl leading-none" aria-hidden>
                      {countryFlag(profile.country)}
                    </span>
                  )}
                  <select
                    value={profile.country ?? ""}
                    onChange={(e) => saveCountry(e.target.value)}
                    disabled={saving}
                    className="h-9 max-w-xs w-full rounded-md border border-border bg-secondary px-3 font-body text-sm text-foreground focus:border-foreground/35 focus:outline-none focus:ring-1 focus:ring-foreground/25 disabled:opacity-50"
                  >
                    <option value="">— No country —</option>
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {countryFlag(c.code)} {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="font-body text-[11px] text-muted-foreground mt-1">
                  Your flag shows next to your name in games.
                </p>
              </div>

              <div>
                <p className="font-body text-sm text-muted-foreground mb-1">Email</p>
                <p className="font-body text-foreground">{user.email}</p>
              </div>

              <div>
                <p className="font-body text-sm text-muted-foreground mb-1">ELO Rating</p>
                <p className="font-display text-2xl text-primary">{profile.rating}</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-foreground/75" />
              Game Preferences
            </h2>
            <div className="rounded-lg border border-border bg-card p-6 space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-body text-sm font-semibold text-foreground">Premove</p>
                  <p className="font-body text-xs text-muted-foreground">
                    Queue moves while waiting. Turning this off clears queued premoves instantly.
                  </p>
                </div>
                <Switch
                  checked={profile.premove_enabled}
                  disabled={saving}
                  onCheckedChange={(checked) => updateProfile({ premove_enabled: checked }, "Premove preference saved.")}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-body text-sm font-semibold text-foreground">Maximum Active Games</p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={maxGamesValue}
                      onChange={(event) => {
                        const next = Number(event.target.value || 1);
                        setMaxGamesValue(Math.max(1, Math.min(10, next)));
                      }}
                      className="h-9 w-20 bg-secondary border-border font-body text-center"
                    />
                    <button
                      onClick={() => updateProfile({ max_active_games: maxGamesValue }, "Active game limit updated.")}
                      disabled={saving || maxGamesValue === profile.max_active_games}
                      className="rounded-md border border-border px-3 py-2 font-body text-sm text-foreground hover:bg-secondary disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                </div>
                <Slider
                  value={[maxGamesValue]}
                  min={1}
                  max={10}
                  step={1}
                  onValueChange={(value) => setMaxGamesValue(value[0])}
                />
                <p className="font-body text-xs text-muted-foreground">
                  Current seek cap: {profile.max_active_games} active game{profile.max_active_games === 1 ? "" : "s"}.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
              <Palette className="h-5 w-5 text-foreground/75" />
              Board &amp; Interface
            </h2>
            <div className="rounded-lg border border-border bg-card p-6 space-y-6">
              <div>
                <p className="font-body text-sm font-semibold text-foreground mb-1">Board Theme</p>
                <p className="font-body text-xs text-muted-foreground mb-3">
                  Choose the square colors used across Play and Puzzles.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(Object.keys(boardThemes) as BoardThemeId[]).map((id) => {
                    const theme = boardThemes[id];
                    const active = boardTheme === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setBoardTheme(id)}
                        className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors ${
                          active
                            ? "border-primary/60 bg-secondary"
                            : "border-border hover:bg-secondary/60"
                        }`}
                      >
                        <span className="flex h-6 w-6 shrink-0 overflow-hidden rounded-sm border border-border">
                          <span className="h-full w-1/2" style={{ background: `hsl(${theme.chessLight})` }} />
                          <span className="h-full w-1/2" style={{ background: `hsl(${theme.chessDark})` }} />
                        </span>
                        <span className="truncate font-body text-sm text-foreground">{theme.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="font-body text-sm font-semibold text-foreground mb-1">Chess Pieces</p>
                <p className="font-body text-xs text-muted-foreground mb-3">
                  Pick the piece style used on every board.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(pieceSets) as PieceSetId[]).map((id) => {
                    const set = pieceSets[id];
                    const active = pieceSet === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setPieceSet(id)}
                        className={`flex items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors ${
                          active
                            ? "border-primary/60 bg-secondary"
                            : "border-border hover:bg-secondary/60"
                        }`}
                      >
                        <span className="flex shrink-0 items-center -space-x-1.5 rounded-sm bg-[#739552] p-1">
                          <img src={pieceUrl(id, "w", "n")} alt="" className="h-8 w-8" draggable={false} />
                          <img src={pieceUrl(id, "b", "q")} alt="" className="h-8 w-8" draggable={false} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-body text-sm font-semibold text-foreground">
                            {set.label}
                          </span>
                          <span className="block truncate font-body text-[11px] text-muted-foreground">
                            {set.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-body text-sm font-semibold text-foreground">Sound Effects</p>
                  <p className="font-body text-xs text-muted-foreground">
                    Move, capture, and check audio cues.
                  </p>
                </div>
                <Switch
                  checked={soundEnabled}
                  onCheckedChange={setSoundEnabled}
                  aria-label="Toggle sound effects"
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-body text-sm font-semibold text-foreground">Show Valid Moves</p>
                  <p className="font-body text-xs text-muted-foreground">
                    Highlight legal destinations when you select a piece.
                  </p>
                </div>
                <Switch
                  checked={showValidMoves}
                  onCheckedChange={setShowValidMoves}
                  aria-label="Toggle valid move indicators"
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-foreground/75" />
              Subscription
            </h2>
            <div className="rounded-lg border border-border bg-card p-6 space-y-4">
              {profile && (
                <div className="flex items-center gap-3">
                  <span className="font-body text-sm text-muted-foreground">Current plan:</span>
                  <span className="font-body text-sm font-semibold capitalize text-foreground">
                    {profile.subscription_status === "active" && profile.subscription_plan
                      ? profile.subscription_plan
                      : "Free"}
                  </span>
                  {profile.subscription_status !== "active" && (
                    <Link
                      to="/pricing"
                      className="ml-auto inline-flex items-center gap-1.5 bg-primary px-4 py-2 rounded-md font-body text-xs font-semibold text-primary-foreground shadow-gold transition-transform hover:scale-105"
                    >
                      Upgrade
                    </Link>
                  )}
                </div>
              )}
              <p className="font-body text-sm text-muted-foreground">
                Update payment methods or cancel your plan through the Stripe Customer Portal.
              </p>
              <button
                onClick={handleManageSubscription}
                disabled={loadingPortal}
                className="inline-flex items-center gap-2 border border-border px-6 py-3 rounded-md font-body text-sm font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
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

          <section>
            <div className="rounded-lg border border-border bg-card p-6 flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Trophy className="h-4 w-4" />
                <span className="font-body text-sm">Account ID {user.id.slice(0, 8).toUpperCase()}</span>
              </div>
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
