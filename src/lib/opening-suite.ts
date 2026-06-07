import { Chess } from "chess.js";
import { OPENING_LINES } from "@/data/openings";

export interface OpeningTheoryNode {
  id: string;
  uci: string;
  san: string;
  whitePct: number;
  drawPct: number;
  blackPct: number;
  games: number;
  score?: number;
  note?: string;
  children: OpeningTheoryNode[];
}

export interface PassedGameRecord {
  id: string;
  white: string;
  black: string;
  result: string;
  year: number;
  event: string;
  url?: string;
}

export interface OpeningSuiteData {
  opening: string;
  variation: string;
  eco?: string;
  source: "lichess" | "local";
  lines: OpeningTheoryNode[];
  passedGames: PassedGameRecord[];
  providerNotice?: string;
}

type ExplorerProvider = "lichess" | "chessdb";

interface ExplorerMove {
  uci: string;
  san: string;
  whitePct: number;
  drawPct: number;
  blackPct: number;
  games: number;
  note?: string;
  score?: number;
}

interface LichessMoveDto {
  uci: string;
  san: string;
  white: number;
  draws: number;
  black: number;
  averageRating?: number;
}

interface LichessGameDto {
  id: string;
  white?: { name?: string };
  black?: { name?: string };
  winner?: "white" | "black";
  year?: number;
  month?: string;
}

interface LichessExplorerResponse {
  opening?: { eco?: string; name?: string };
  moves?: LichessMoveDto[];
  topGames?: LichessGameDto[];
  recentGames?: LichessGameDto[];
}

interface ChessDbMoveDto {
  uci: string;
  san: string;
  score?: number;
  rank?: number;
  note?: string;
  winrate?: string;
}

interface ChessDbResponse {
  status: string;
  moves?: ChessDbMoveDto[];
}

const LICHEST_EXPLORER_URL = "https://explorer.lichess.ovh/masters";
const CHESSDB_QUERY_URL = "https://www.chessdb.cn/cdb.php";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function normalizeFenForPosition(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

function safePct(value: number): number {
  return Number(clamp(value, 0, 100).toFixed(1));
}

function splitOpeningName(name: string): { opening: string; variation: string } {
  const idx = name.indexOf(":");
  if (idx < 0) return { opening: name, variation: "Main line" };
  return {
    opening: name.slice(0, idx).trim(),
    variation: name.slice(idx + 1).trim() || "Main line",
  };
}

function parseChessDbWdl(winrateRaw?: string, score = 0): { whitePct: number; drawPct: number; blackPct: number } {
  const whiteScore = clamp(Number(winrateRaw ?? "50"), 0, 100) / 100;
  // ChessDB exposes expected score only; infer draw from score spread for stable W/D/L UI buckets.
  const drawPct = clamp(36 - Math.abs(score) * 0.08, 12, 52) / 100;
  const whitePct = clamp(whiteScore - drawPct * 0.5, 0, 1);
  const blackPct = clamp(1 - whitePct - drawPct, 0, 1);
  const sum = whitePct + drawPct + blackPct || 1;
  return {
    whitePct: safePct((whitePct / sum) * 100),
    drawPct: safePct((drawPct / sum) * 100),
    blackPct: safePct((blackPct / sum) * 100),
  };
}

function identifyOpeningByLine(playedSanMoves: string[]): { opening: string; variation: string; eco?: string } {
  let best:
    | {
        length: number;
        name: string;
        eco?: string;
      }
    | undefined;

  for (const line of OPENING_LINES) {
    if (line.moves.length === 0) continue;
    let prefix = 0;
    while (
      prefix < line.moves.length &&
      prefix < playedSanMoves.length &&
      line.moves[prefix] === playedSanMoves[prefix]
    ) {
      prefix += 1;
    }
    if (prefix > 0 && (!best || prefix > best.length)) {
      best = { length: prefix, name: line.name, eco: line.eco };
    }
  }

  if (!best) {
    return { opening: "Unclassified Opening", variation: "No named variation", eco: undefined };
  }
  const parsed = splitOpeningName(best.name);
  return { ...parsed, eco: best.eco };
}

async function fetchLichessMoves(fen: string, token?: string): Promise<LichessExplorerResponse> {
  const url = new URL(LICHEST_EXPLORER_URL);
  url.searchParams.set("fen", fen);
  url.searchParams.set("moves", "14");
  url.searchParams.set("topGames", "10");
  url.searchParams.set("recentGames", "10");
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url.toString(), { headers });
  if (!response.ok) {
    throw new Error(`Lichess explorer unavailable (${response.status})`);
  }
  return (await response.json()) as LichessExplorerResponse;
}

async function fetchChessDbMoves(fen: string): Promise<ExplorerMove[]> {
  const url = new URL(CHESSDB_QUERY_URL);
  url.searchParams.set("action", "queryall");
  url.searchParams.set("board", fen);
  url.searchParams.set("json", "1");
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`ChessDB unavailable (${response.status})`);
  const data = (await response.json()) as ChessDbResponse;
  if (data.status !== "ok" || !data.moves?.length) return [];

  return data.moves.map((move) => {
    const wdl = parseChessDbWdl(move.winrate, move.score ?? 0);
    return {
      uci: move.uci,
      san: move.san,
      ...wdl,
      games: Math.max(1, (move.rank ?? 0) * 10 + 1),
      note: move.note,
      score: move.score,
    };
  });
}

function mapLichessMoves(moves: LichessMoveDto[]): ExplorerMove[] {
  return moves.map((move) => {
    const total = Math.max(1, move.white + move.draws + move.black);
    return {
      uci: move.uci,
      san: move.san,
      whitePct: safePct((move.white / total) * 100),
      drawPct: safePct((move.draws / total) * 100),
      blackPct: safePct((move.black / total) * 100),
      games: total,
      note: move.averageRating ? `avg ${move.averageRating}` : undefined,
    };
  });
}

function isTheoryMove(move: ExplorerMove, provider: ExplorerProvider): boolean {
  if (provider === "lichess") return move.games >= 6;
  return (move.score ?? 0) > -80 || move.games >= 10;
}

function applyUciMove(fen: string, uci: string): string | null {
  try {
    const game = new Chess(fen);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    const played = game.move({
      from,
      to,
      promotion: promotion as "q" | "r" | "b" | "n" | undefined,
    });
    if (!played) return null;
    return game.fen();
  } catch {
    return null;
  }
}

interface BuildTreeOptions {
  maxDepth: number;
  branchWidth: number;
  nodeBudget: number;
  provider: ExplorerProvider;
}

async function fetchProviderMoves(
  fen: string,
  provider: ExplorerProvider,
  token?: string
): Promise<ExplorerMove[]> {
  if (provider === "lichess") {
    const result = await fetchLichessMoves(fen, token);
    return mapLichessMoves(result.moves ?? []);
  }
  return fetchChessDbMoves(fen);
}

async function buildTheoryTree(
  fen: string,
  options: BuildTreeOptions,
  token?: string
): Promise<OpeningTheoryNode[]> {
  let budget = options.nodeBudget;
  const cache = new Map<string, ExplorerMove[]>();

  const expand = async (currentFen: string, depth: number, path: string): Promise<OpeningTheoryNode[]> => {
    if (depth <= 0 || budget <= 0) return [];
    if (!cache.has(currentFen)) {
      cache.set(currentFen, await fetchProviderMoves(currentFen, options.provider, token));
    }
    const moves = (cache.get(currentFen) ?? [])
      .filter((m) => isTheoryMove(m, options.provider))
      .sort((a, b) => b.games - a.games)
      .slice(0, options.branchWidth);

    const nodes: OpeningTheoryNode[] = [];
    for (const move of moves) {
      if (budget <= 0) break;
      budget -= 1;
      const nextFen = applyUciMove(currentFen, move.uci);
      const children = nextFen ? await expand(nextFen, depth - 1, `${path}-${move.uci}`) : [];
      nodes.push({
        id: `${path}-${move.uci}`,
        uci: move.uci,
        san: move.san,
        whitePct: move.whitePct,
        drawPct: move.drawPct,
        blackPct: move.blackPct,
        games: move.games,
        note: move.note,
        score: move.score,
        children,
      });
    }
    return nodes;
  };

  return expand(fen, options.maxDepth, "root");
}

function mapPassedGamesFromLichess(dto: LichessExplorerResponse): PassedGameRecord[] {
  const games = [...(dto.topGames ?? []), ...(dto.recentGames ?? [])];
  const seen = new Set<string>();
  const rows: PassedGameRecord[] = [];
  for (const game of games) {
    if (!game.id || seen.has(game.id)) continue;
    seen.add(game.id);
    rows.push({
      id: game.id,
      white: game.white?.name || "White",
      black: game.black?.name || "Black",
      result: game.winner === "white" ? "1-0" : game.winner === "black" ? "0-1" : "1/2-1/2",
      year: game.year ?? 0,
      event: game.month ? `Master DB ${game.month}` : "Master DB",
      url: `https://lichess.org/${game.id}`,
    });
  }
  return rows.slice(0, 10);
}

export async function buildOpeningSuite(
  fen: string,
  playedSanMoves: string[],
  options?: Partial<Pick<BuildTreeOptions, "maxDepth" | "branchWidth" | "nodeBudget">>
): Promise<OpeningSuiteData> {
  const localOpening = identifyOpeningByLine(playedSanMoves);
  const lichessToken = import.meta.env.VITE_LICHESS_EXPLORER_TOKEN as string | undefined;
  const treeOptions: BuildTreeOptions = {
    maxDepth: options?.maxDepth ?? 5,
    branchWidth: options?.branchWidth ?? 6,
    nodeBudget: options?.nodeBudget ?? 120,
    provider: "chessdb",
  };

  try {
    const lichess = await fetchLichessMoves(fen, lichessToken);
    const localName = lichess.opening?.name ? splitOpeningName(lichess.opening.name) : null;
    treeOptions.provider = "lichess";
    const lines = await buildTheoryTree(fen, treeOptions, lichessToken);
    return {
      opening: localName?.opening ?? localOpening.opening,
      variation: localName?.variation ?? localOpening.variation,
      eco: lichess.opening?.eco ?? localOpening.eco,
      source: "lichess",
      lines,
      passedGames: mapPassedGamesFromLichess(lichess),
    };
  } catch {
    const lines = await buildTheoryTree(fen, treeOptions);
    return {
      opening: localOpening.opening,
      variation: localOpening.variation,
      eco: localOpening.eco,
      source: "local",
      lines,
      passedGames: [],
      providerNotice:
        "Lichess opening explorer requires OAuth now; using cloud opening book fallback. Set VITE_LICHESS_EXPLORER_TOKEN for full GM database stats and passed games.",
    };
  }
}

export function openingLinePreview(node: OpeningTheoryNode): string {
  const parts = [`${node.san} (${node.whitePct}%/${node.drawPct}%/${node.blackPct}%)`];
  let cursor: OpeningTheoryNode | undefined = node.children[0];
  let guard = 0;
  while (cursor && guard < 14) {
    parts.push(cursor.san);
    cursor = cursor.children[0];
    guard += 1;
  }
  return parts.join(" ");
}

export function lineToFen(baseFen: string, line: OpeningTheoryNode): string | null {
  const sequence: string[] = [line.uci];
  let cursor: OpeningTheoryNode | undefined = line.children[0];
  let guard = 0;
  while (cursor && guard < 24) {
    sequence.push(cursor.uci);
    cursor = cursor.children[0];
    guard += 1;
  }
  let fen = baseFen;
  for (const move of sequence) {
    const nextFen = applyUciMove(fen, move);
    if (!nextFen) return null;
    fen = nextFen;
  }
  return fen;
}

export function samePositionFen(a: string, b: string): boolean {
  return normalizeFenForPosition(a) === normalizeFenForPosition(b);
}
