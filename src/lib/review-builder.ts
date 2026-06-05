import { Chess, type Color } from "chess.js";
import { moveIsSacrifice, probeResultToCp, rateMoveLikeChessCom } from "@/lib/move-rating";
import { scoreForLabel, type GameReviewReport, type ReviewedPly } from "@/lib/game-review";
import type { StockfishEngine } from "@/lib/stockfish";

interface BuildReviewParams {
  pgn: string;
  result: string;
  engineLabel: string;
  engine: StockfishEngine;
  depth?: number;
  onProgress?: (done: number, total: number) => void;
  /** Player Elo, used to scale brilliancy detection for the player's own moves (spec Section 3). */
  playerElo?: number;
  /** Which color the (human) player controlled. Defaults to White. */
  playerColor?: Color;
}

export async function buildGameReviewReport({
  pgn,
  result,
  engineLabel,
  engine,
  depth = 10,
  onProgress,
  playerElo,
  playerColor = "w",
}: BuildReviewParams): Promise<GameReviewReport> {
  const game = new Chess();
  game.loadPgn(pgn, { strict: false });
  const history = game.history({ verbose: true });
  if (history.length === 0) {
    throw new Error("No move history available for review.");
  }

  const replay = new Chess();
  let beforeProbe = await engine.probeEval(replay.fen(), depth, 2500);
  const reviewedPlies: ReviewedPly[] = [];

  for (let i = 0; i < history.length; i++) {
    const mv = history[i];
    const side = replay.turn();
    const fenBefore = replay.fen();
    const best = await engine.getBestMove(fenBefore, depth);

    const playedUci = `${mv.from}${mv.to}${mv.promotion ?? ""}`;
    const isSacrifice = moveIsSacrifice(fenBefore, mv);

    replay.move(mv);
    const afterProbe = await engine.probeEval(replay.fen(), depth, 2500);
    const rated = rateMoveLikeChessCom(side, beforeProbe, afterProbe, mv, best || undefined, {
      playerElo: side === playerColor ? playerElo : undefined,
      isOnlyGoodMove: !!best && playedUci === best,
      isSacrifice,
    });
    reviewedPlies.push({
      ply: i + 1,
      side,
      san: mv.san,
      label: rated.label,
      colorClass: rated.color,
      cpLoss: rated.cpLoss,
      bestUci: rated.bestMove,
      playedUci,
      fenBefore,
      fenAfter: replay.fen(),
      evalBeforeCp: probeResultToCp(beforeProbe),
      evalAfterCp: probeResultToCp(afterProbe),
    });
    beforeProbe = afterProbe;
    onProgress?.(i + 1, history.length);
  }

  const bySide = { w: [] as number[], b: [] as number[] };
  for (const move of reviewedPlies) bySide[move.side].push(scoreForLabel(move.label));
  const avg = (a: number[]) => (a.length ? (a.reduce((sum, x) => sum + x, 0) / a.length) * 100 : 0);

  return {
    createdAt: Date.now(),
    pgn,
    result,
    engine: engineLabel,
    depth,
    accuracy: {
      w: Number(avg(bySide.w).toFixed(1)),
      b: Number(avg(bySide.b).toFixed(1)),
    },
    moves: reviewedPlies,
  };
}
