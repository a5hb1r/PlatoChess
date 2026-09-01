import { useState } from "react";
import { Check, Eye, EyeOff, Loader2, Lock, Mail, Shield, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Account & Security — self-contained card group that lets the user change
 * their sign-in email and their password. Each row starts collapsed to keep
 * the Settings page scannable, and expands into an inline form on demand.
 *
 * Supabase enforces the actual security: passwords are bcrypt-hashed with a
 * per-user salt server-side (we never see them), and an email change fires
 * a confirmation link to the NEW address before the swap takes effect.
 */
export function AccountSecuritySection({ userEmail }: { userEmail: string }) {
  return (
    <section>
      <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
        <Shield className="h-5 w-5 text-foreground/75" />
        Account &amp; Security
      </h2>
      <div className="rounded-lg border border-border bg-card divide-y divide-border">
        <EmailRow currentEmail={userEmail} />
        <PasswordRow />
      </div>
      <p className="mt-2 font-body text-[11px] text-muted-foreground">
        Passwords are hashed and stored by Supabase — we never see or store the plain text.
        Email changes require confirmation from the new address before they take effect.
      </p>
    </section>
  );
}

/* ── Email ─────────────────────────────────────────────────────────────── */

function EmailRow({ currentEmail }: { currentEmail: string }) {
  const [editing, setEditing] = useState(false);
  const [next, setNext] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const trimmed = next.trim().toLowerCase();
    if (!trimmed || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (trimmed === currentEmail.toLowerCase()) {
      toast.message("That's already your email.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ email: trimmed });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Confirmation sent — click the link in your new inbox to complete the change.");
    setEditing(false);
    setNext("");
  };

  return (
    <div className="p-5">
      <div className="flex items-center gap-3">
        <Mail className="h-4 w-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="font-body text-sm font-semibold text-foreground">Email</p>
          <p className="truncate font-body text-xs text-muted-foreground">{currentEmail}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="rounded-md border border-border px-3 py-1.5 font-body text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          {editing ? "Cancel" : "Change"}
        </button>
      </div>

      {editing && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            autoComplete="email"
            placeholder="new@email.com"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            disabled={saving}
            className="flex-1"
          />
          <button
            type="button"
            onClick={submit}
            disabled={saving || !next}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 font-body text-xs font-semibold text-primary-foreground transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Send confirmation
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Password ──────────────────────────────────────────────────────────── */

function PasswordRow() {
  const [editing, setEditing] = useState(false);
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setEditing(false);
    setNext("");
    setConfirm("");
    setReveal(false);
  };

  const submit = async () => {
    if (next.length < 8) {
      toast.error("Use at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: next });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated.");
    reset();
  };

  return (
    <div className="p-5">
      <div className="flex items-center gap-3">
        <Lock className="h-4 w-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="font-body text-sm font-semibold text-foreground">Password</p>
          <p className="font-body text-xs text-muted-foreground">Last updated when you last changed it</p>
        </div>
        <button
          type="button"
          onClick={() => (editing ? reset() : setEditing(true))}
          className="rounded-md border border-border px-3 py-1.5 font-body text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          {editing ? "Cancel" : "Change"}
        </button>
      </div>

      {editing && (
        <div className="mt-4 space-y-2">
          <div className="relative">
            <Input
              type={reveal ? "text" : "password"}
              autoComplete="new-password"
              placeholder="New password (min. 8 characters)"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              disabled={saving}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              aria-label={reveal ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            >
              {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <Input
            type={reveal ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={saving}
          />
          <button
            type="button"
            onClick={submit}
            disabled={saving || !next || !confirm}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 font-body text-xs font-semibold text-primary-foreground transition-transform hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100 sm:w-auto"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Update password
          </button>
        </div>
      )}
    </div>
  );
}
