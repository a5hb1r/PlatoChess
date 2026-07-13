/**
 * Live online play — thin client over the Supabase RPCs + realtime channel.
 * Matchmaking pairs players via join_matchmaking; games stream as row
 * UPDATEs on live_games (server-authoritative clocks and results).
 */
import { supabase } from "@/integrations/supabase/client";

export interface LiveGameRow {
  id: string;
  white_id: string;
  black_id: string;
  white_name: string;
  black_name: string;
  white_rating: number;
  black_rating: number;
  time_minutes: number;
  increment_seconds: number;
  moves: string;
  fen: string;
  turn: "w" | "b";
  white_ms: number;
  black_ms: number;
  last_move_at: string;
  status: "active" | "finished" | "aborted";
  result: "1-0" | "0-1" | "1/2-1/2" | null;
  end_reason: string | null;
  rating_delta_w: number | null;
  rating_delta_b: number | null;
}

/** Returns a game id if matched immediately (or reconnecting), else null (queued). */
export async function joinMatchmaking(minutes: number, increment: number): Promise<string | null> {
  const { data, error } = await supabase.rpc("join_matchmaking", {
    p_minutes: minutes,
    p_increment: increment,
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function leaveMatchmaking(): Promise<void> {
  await supabase.rpc("leave_matchmaking");
}

export async function myActiveGame(): Promise<string | null> {
  const { data, error } = await supabase.rpc("my_active_game");
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function fetchLiveGame(id: string): Promise<LiveGameRow | null> {
  const { data, error } = await supabase.from("live_games").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as LiveGameRow | null;
}

export async function playLiveMove(
  gameId: string,
  uci: string,
  fen: string,
  gameOver = false,
  result: string | null = null,
  endReason: string | null = null
): Promise<void> {
  const { error } = await supabase.rpc("play_live_move", {
    p_game_id: gameId,
    p_uci: uci,
    p_fen: fen,
    p_game_over: gameOver,
    p_result: result,
    p_end_reason: endReason,
  });
  if (error) throw error;
}

export async function resignLiveGame(gameId: string): Promise<void> {
  const { error } = await supabase.rpc("resign_live_game", { p_game_id: gameId });
  if (error) throw error;
}

export async function claimLiveTimeout(gameId: string): Promise<void> {
  await supabase.rpc("claim_live_timeout", { p_game_id: gameId });
}

export async function abortLiveGame(gameId: string): Promise<void> {
  await supabase.rpc("abort_live_game", { p_game_id: gameId });
}

/** Subscribe to row updates for one game. Returns an unsubscribe function. */
export function subscribeToLiveGame(
  gameId: string,
  onUpdate: (row: LiveGameRow) => void
): () => void {
  const channel = supabase
    .channel(`live-game-${gameId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "live_games", filter: `id=eq.${gameId}` },
      (payload) => onUpdate(payload.new as LiveGameRow)
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/** Human-readable summary of a finished game from my point of view. */
export function describeLiveResult(row: LiveGameRow, myColor: "w" | "b"): string {
  if (row.status === "aborted") return "Game aborted.";
  if (!row.result) return "Game over.";
  const reason = row.end_reason ? ` by ${row.end_reason}` : "";
  if (row.result === "1/2-1/2") return `Draw${reason}.`;
  const iWon = (row.result === "1-0" && myColor === "w") || (row.result === "0-1" && myColor === "b");
  const winner = row.result === "1-0" ? "White" : "Black";
  return iWon ? `You win${reason}!` : `${winner} wins${reason}.`;
}
