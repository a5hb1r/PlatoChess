import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, User, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logo from "@/assets/platochess-logo.png";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const navigate = useNavigate();

  const normalizeUsername = (value: string) => value.trim().replace(/[^a-zA-Z0-9_]/g, "");

  const validateUsername = (value: string) => {
    if (value.length < 3 || value.length > 30) {
      return "Username must be 3-30 characters";
    }
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      return "Username can only contain letters, numbers, and underscores";
    }
    return null;
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
        navigate("/play");
      } else {
        const normalizedUsername = normalizeUsername(username);
        const usernameError = validateUsername(normalizedUsername);
        if (usernameError) {
          toast.error(usernameError);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: displayName.trim(),
              username: normalizedUsername,
            },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("Account created! Check your email to confirm.");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Authentication failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "google" | "azure") => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/play`,
        },
      });
      if (error) throw error;
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Sign-in failed";
      toast.error(message);
      setLoading(false);
    }
  };

  const handleEmailMagicLink = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      toast.error("Enter your email first.");
      return;
    }

    setMagicLoading(true);
    try {
      const signupMetadata = !isLogin
        ? {
            full_name: displayName.trim(),
            username: normalizeUsername(username),
          }
        : undefined;

      if (!isLogin) {
        const usernameError = validateUsername(signupMetadata?.username ?? "");
        if (usernameError) {
          toast.error(usernameError);
          return;
        }
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/play`,
          data: signupMetadata,
        },
      });
      if (error) throw error;

      toast.success("Magic link sent. Check your inbox.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not send magic link";
      toast.error(message);
    } finally {
      setMagicLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-body text-sm text-muted-foreground mb-8 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <div className="rounded-lg border border-border bg-card p-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <img
              src={logo}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-xl object-cover ring-1 ring-border/40"
              decoding="async"
            />
            <h1 className="font-display text-2xl font-bold">
              {isLogin ? "Welcome Back" : "Join Platochess"}
            </h1>
          </div>

          {/* OAuth buttons */}
          <div className="space-y-3 mb-6">
            <button
              onClick={() => handleOAuth("google")}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 rounded-md border border-border bg-background px-4 py-3 font-body text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>
            <button
              onClick={() => handleOAuth("azure")}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 rounded-md border border-border bg-background px-4 py-3 font-body text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#f25022" d="M2 2h9.5v9.5H2z" />
                <path fill="#00a4ef" d="M12.5 2H22v9.5h-9.5z" />
                <path fill="#7fba00" d="M2 12.5h9.5V22H2z" />
                <path fill="#ffb900" d="M12.5 12.5H22V22h-9.5z" />
              </svg>
              Continue with Outlook
            </button>
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-card px-3 font-body text-xs text-muted-foreground">
                or continue with email
              </span>
            </div>
          </div>

          {/* Email form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {!isLogin && (
              <div className="space-y-4">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Display name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full rounded-md border border-border bg-background pl-10 pr-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground/35 focus:outline-none focus:ring-1 focus:ring-foreground/25"
                    required
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm text-muted-foreground">@</span>
                  <input
                    type="text"
                    placeholder="Username (unique handle)"
                    value={username}
                    onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                    className="w-full rounded-md border border-border bg-background pl-8 pr-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground/35 focus:outline-none focus:ring-1 focus:ring-foreground/25"
                    minLength={3}
                    maxLength={30}
                    required
                  />
                </div>
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-border bg-background pl-10 pr-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground/35 focus:outline-none focus:ring-1 focus:ring-foreground/25"
                required
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-background pl-10 pr-10 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground/35 focus:outline-none focus:ring-1 focus:ring-foreground/25"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary py-3 rounded-md font-body text-sm font-semibold text-primary-foreground shadow-gold transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
            >
              {loading ? "Loading..." : isLogin ? "Sign In" : "Create Account"}
            </button>
            <button
              type="button"
              onClick={handleEmailMagicLink}
              disabled={magicLoading}
              className="w-full border border-border py-3 rounded-md font-body text-sm font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
            >
              {magicLoading ? "Sending..." : "Send Magic Link (SMTP Email)"}
            </button>
          </form>

          {/* Toggle */}
          <p className="mt-6 text-center font-body text-sm text-muted-foreground">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-foreground/75 font-medium hover:underline"
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
