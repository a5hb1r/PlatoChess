import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "./_lib/supabase-admin";
import { resolveAuthenticatedUser } from "./_lib/resolve-auth-user";

type NotificationRow = {
  id: string;
  game_session_id: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};

function parseLimit(raw: unknown): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 5;
  return Math.min(20, Math.max(1, Math.floor(parsed)));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Allow", "GET, POST");

  if (!hasSupabaseAdminEnv()) {
    return res.status(503).json({ error: "Notifications service unavailable" });
  }

  const user = await resolveAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const supabase = getSupabaseAdminClient();

  if (req.method === "GET") {
    const limit = parseLimit(req.query.limit);
    const { data, error } = await supabase
      .from("daily_turn_notifications")
      .select("id, game_session_id, payload, created_at")
      .eq("recipient_user_id", user.id)
      .eq("channel", "in_app")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return res.status(500).json({ error: "Failed to load notifications" });
    }

    return res.status(200).json({
      notifications: (data || []) as NotificationRow[],
    });
  }

  if (req.method === "POST") {
    const body = (req.body || {}) as { ids?: string[] };
    const ids = Array.isArray(body.ids) ? body.ids.filter((id) => typeof id === "string") : [];
    if (ids.length === 0) {
      return res.status(200).json({ updated: 0 });
    }

    const deliveredAt = new Date().toISOString();
    const { error } = await supabase
      .from("daily_turn_notifications")
      .update({ status: "delivered", delivered_at: deliveredAt })
      .eq("recipient_user_id", user.id)
      .eq("channel", "in_app")
      .in("id", ids);

    if (error) {
      return res.status(500).json({ error: "Failed to acknowledge notifications" });
    }

    return res.status(200).json({ updated: ids.length });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
