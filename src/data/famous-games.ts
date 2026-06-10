/**
 * Research library — landmark games by the all-time greats.
 * Game scores (move sequences) are historical facts and public domain; the
 * descriptions are original. Every entry is validated move-by-move with
 * chess.js in famous-games.test.ts.
 */
import type { BotTier } from "@/lib/bots";

export interface FamousGame {
  id: string;
  white: string;
  black: string;
  /** Honorific shown as a chip: GM, WCh (world champion), Engine, Legend… */
  whiteTitle: string;
  blackTitle: string;
  event: string;
  year: number;
  result: "1-0" | "0-1" | "1/2-1/2";
  eco?: string;
  opening: string;
  nickname?: string;
  /** What makes this game worth studying (original commentary). */
  description: string;
  /** Full game in SAN. */
  moves: string[];
  /** Minimum subscription tier required to open this game. */
  tier: BotTier;
}

export const FAMOUS_GAMES: FamousGame[] = [
  {
    id: "opera-game-1858",
    white: "Paul Morphy",
    black: "Duke Karl / Count Isouard",
    whiteTitle: "Legend",
    blackTitle: "Amateurs",
    event: "Italian Opera House, Paris",
    year: 1858,
    result: "1-0",
    eco: "C41",
    opening: "Philidor Defence",
    nickname: "The Opera Game",
    description:
      "The most famous teaching game ever played. Morphy develops every piece with tempo, sacrifices the queen, and mates with his last two pieces — a perfect lesson in development and open files.",
    moves: [
      "e4", "e5", "Nf3", "d6", "d4", "Bg4", "dxe5", "Bxf3", "Qxf3", "dxe5",
      "Bc4", "Nf6", "Qb3", "Qe7", "Nc3", "c6", "Bg5", "b5", "Nxb5", "cxb5",
      "Bxb5+", "Nbd7", "O-O-O", "Rd8", "Rxd7", "Rxd7", "Rd1", "Qe6", "Bxd7+", "Nxd7",
      "Qb8+", "Nxb8", "Rd8#",
    ],
    tier: "free",
  },
  {
    id: "legal-mate-1750",
    white: "Kermur de Légal",
    black: "Saint Brie",
    whiteTitle: "Legend",
    blackTitle: "Amateur",
    event: "Café de la Régence, Paris",
    year: 1750,
    result: "1-0",
    eco: "C41",
    opening: "Philidor Defence",
    nickname: "Légal's Mate",
    description:
      "The original queen-sacrifice miniature. White allows his queen to be captured and delivers mate with three minor pieces — the pattern every tactics course still teaches.",
    moves: [
      "e4", "e5", "Nf3", "d6", "Bc4", "Bg4", "Nc3", "g6", "Nxe5", "Bxd1",
      "Bxf7+", "Ke7", "Nd5#",
    ],
    tier: "free",
  },
  {
    id: "greco-smothered-1620",
    white: "NN",
    black: "Gioachino Greco",
    whiteTitle: "Amateur",
    blackTitle: "Legend",
    event: "Italy (recorded game)",
    year: 1620,
    result: "0-1",
    eco: "C54",
    opening: "Italian Game",
    nickname: "Greco's Smothered Mate",
    description:
      "Four hundred years old and still winning blitz games today: queen check on g1 forces the rook to box in its own king, and the knight delivers the smothered mate.",
    moves: [
      "e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "O-O", "Nf6", "Re1", "O-O",
      "c3", "Qe7", "d4", "exd4", "e5", "Ng4", "cxd4", "Nxd4", "Nxd4", "Qh4",
      "Nf3", "Qxf2+", "Kh1", "Qg1+", "Rxg1", "Nf2#",
    ],
    tier: "free",
  },
  {
    id: "immortal-game-1851",
    white: "Adolf Anderssen",
    black: "Lionel Kieseritzky",
    whiteTitle: "Legend",
    blackTitle: "Legend",
    event: "London (casual)",
    year: 1851,
    result: "1-0",
    eco: "C33",
    opening: "King's Gambit Accepted",
    nickname: "The Immortal Game",
    description:
      "Anderssen gives up a bishop, both rooks, and the queen — then mates with the three minor pieces he has left. The most celebrated attacking game in chess history.",
    moves: [
      "e4", "e5", "f4", "exf4", "Bc4", "Qh4+", "Kf1", "b5", "Bxb5", "Nf6",
      "Nf3", "Qh6", "d3", "Nh5", "Nh4", "Qg5", "Nf5", "c6", "g4", "Nf6",
      "Rg1", "cxb5", "h4", "Qg6", "h5", "Qg5", "Qf3", "Ng8", "Bxf4", "Qf6",
      "Nc3", "Bc5", "Nd5", "Qxb2", "Bd6", "Bxg1", "e5", "Qxa1+", "Ke2", "Na6",
      "Nxg7+", "Kd8", "Qf6+", "Nxf6", "Be7#",
    ],
    tier: "free",
  },
  {
    id: "game-of-the-century-1956",
    white: "Donald Byrne",
    black: "Bobby Fischer",
    whiteTitle: "IM",
    blackTitle: "GM",
    event: "Rosenwald Memorial, New York",
    year: 1956,
    result: "0-1",
    eco: "D92",
    opening: "Grünfeld Defence",
    nickname: "The Game of the Century",
    description:
      "Thirteen-year-old Fischer plays 11…Na4!! and follows with a queen sacrifice for a windmill of discovered checks. The deepest combination ever produced by a child — and one of the deepest by anyone.",
    moves: [
      "Nf3", "Nf6", "c4", "g6", "Nc3", "Bg7", "d4", "O-O", "Bf4", "d5",
      "Qb3", "dxc4", "Qxc4", "c6", "e4", "Nbd7", "Rd1", "Nb6", "Qc5", "Bg4",
      "Bg5", "Na4", "Qa3", "Nxc3", "bxc3", "Nxe4", "Bxe7", "Qb6", "Bc4", "Nxc3",
      "Bc5", "Rfe8+", "Kf1", "Be6", "Bxb6", "Bxc4+", "Kg1", "Ne2+", "Kf1", "Nxd4+",
      "Kg1", "Ne2+", "Kf1", "Nc3+", "Kg1", "axb6", "Qb4", "Ra4", "Qxb6", "Nxd1",
      "h3", "Rxa2", "Kh2", "Nxf2", "Re1", "Rxe1", "Qd8+", "Bf8", "Nxe1", "Bd5",
      "Nf3", "Ne4", "Qb8", "b5", "h4", "h5", "Ne5", "Kg7", "Kg1", "Bc5+",
      "Kf1", "Ng3+", "Ke1", "Bb4+", "Kd1", "Bb3+", "Kc1", "Ne2+", "Kb1", "Nc3+",
      "Kc1", "Rc2#",
    ],
    tier: "free",
  },
  {
    id: "evergreen-game-1852",
    white: "Adolf Anderssen",
    black: "Jean Dufresne",
    whiteTitle: "Legend",
    blackTitle: "Master",
    event: "Berlin (casual)",
    year: 1852,
    result: "1-0",
    eco: "C52",
    opening: "Evans Gambit",
    nickname: "The Evergreen Game",
    description:
      "Anderssen's other immortal. The quiet 19.Rad1 sets up a double-rook-and-queen sacrifice ending in a picture-perfect mate. Steinitz called it 'an evergreen in the laurel crown of chess.'",
    moves: [
      "e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "b4", "Bxb4", "c3", "Ba5",
      "d4", "exd4", "O-O", "d3", "Qb3", "Qf6", "e5", "Qg6", "Re1", "Nge7",
      "Ba3", "b5", "Qxb5", "Rb8", "Qa4", "Bb6", "Nbd2", "Bb7", "Ne4", "Qf5",
      "Bxd3", "Qh5", "Nf6+", "gxf6", "exf6", "Rg8", "Rad1", "Qxf3", "Rxe7+", "Nxe7",
      "Qxd7+", "Kxd7", "Bf5+", "Ke8", "Bd7+", "Kf8", "Bxe7#",
    ],
    tier: "pro",
  },
  {
    id: "reti-tartakower-1910",
    white: "Richard Réti",
    black: "Savielly Tartakower",
    whiteTitle: "Legend",
    blackTitle: "GM",
    event: "Vienna (casual)",
    year: 1910,
    result: "1-0",
    eco: "B15",
    opening: "Caro-Kann Defence",
    nickname: "The Réti Sacrifice",
    description:
      "Eleven moves, one immortal idea: 9.Qd8+!! drags the king onto a discovered-check highway. The fastest brilliancy in the classical canon.",
    moves: [
      "e4", "c6", "d4", "d5", "Nc3", "dxe4", "Nxe4", "Nf6", "Qd3", "e5",
      "dxe5", "Qa5+", "Bd2", "Qxe5", "O-O-O", "Nxe4", "Qd8+", "Kxd8", "Bg5+", "Kc7",
      "Bd8#",
    ],
    tier: "pro",
  },
  {
    id: "lasker-bauer-1889",
    white: "Emanuel Lasker",
    black: "Johann Bauer",
    whiteTitle: "WCh",
    blackTitle: "Master",
    event: "Amsterdam",
    year: 1889,
    result: "1-0",
    eco: "A03",
    opening: "Bird's Opening",
    nickname: "The Double Bishop Sacrifice",
    description:
      "The original two-bishop demolition: Bxh7+, then Bxg7!, stripping the king bare. Every 'Greek gift' double sacrifice since — Tal's, Judit Polgár's — descends from this game.",
    moves: [
      "f4", "d5", "e3", "Nf6", "b3", "e6", "Bb2", "Be7", "Bd3", "b6",
      "Nf3", "Bb7", "Nc3", "Nbd7", "O-O", "O-O", "Ne2", "c5", "Ng3", "Qc7",
      "Ne5", "Nxe5", "Bxe5", "Qc6", "Qe2", "a6", "Nh5", "Nxh5", "Bxh7+", "Kxh7",
      "Qxh5+", "Kg8", "Bxg7", "Kxg7", "Qg4+", "Kh7", "Rf3", "e5", "Rh3+", "Qh6",
      "Rxh6+", "Kxh6", "Qd7", "Bf6", "Qxb7", "Kg7", "Rf1", "Rab8", "Qd7", "Rfd8",
      "Qg4+", "Kf8", "fxe5", "Bg7", "e6", "Rb7", "Qg6", "f6", "Rxf6+", "Bxf6",
      "Qxf6+", "Ke8", "Qh8+", "Ke7", "Qg7+", "Kxe6", "Qxb7",
    ],
    tier: "pro",
  },
  {
    id: "byrne-fischer-1963",
    white: "Robert Byrne",
    black: "Bobby Fischer",
    whiteTitle: "GM",
    blackTitle: "GM",
    event: "US Championship, New York",
    year: 1963,
    result: "0-1",
    eco: "E60",
    opening: "King's Indian / Grünfeld setup",
    nickname: "The Brilliancy Prize",
    description:
      "Fischer rips open a calm fianchetto position with 15…Nxf2!. When White resigned after 21…Qd7, grandmasters in the commentary room were still arguing that Black stood worse — the combination was that deep.",
    moves: [
      "d4", "Nf6", "c4", "g6", "g3", "c6", "Bg2", "d5", "cxd5", "cxd5",
      "Nc3", "Bg7", "e3", "O-O", "Nge2", "Nc6", "O-O", "b6", "b3", "Ba6",
      "Ba3", "Re8", "Qd2", "e5", "dxe5", "Nxe5", "Rfd1", "Nd3", "Qc2", "Nxf2",
      "Kxf2", "Ng4+", "Kg1", "Nxe3", "Qd2", "Nxg2", "Kxg2", "d4", "Nxd4", "Bb7+",
      "Kf1", "Qd7",
    ],
    tier: "pro",
  },
  {
    id: "deep-blue-kasparov-1997",
    white: "Deep Blue",
    black: "Garry Kasparov",
    whiteTitle: "Engine",
    blackTitle: "WCh",
    event: "Match game 6, New York",
    year: 1997,
    result: "1-0",
    eco: "B17",
    opening: "Caro-Kann Defence",
    nickname: "The Machine's Victory",
    description:
      "The 19-move game that ended the most famous man-vs-machine match. Deep Blue plays the known piece sacrifice 8.Nxe6! and the world champion collapses — the moment computers overtook humanity at chess.",
    moves: [
      "e4", "c6", "d4", "d5", "Nc3", "dxe4", "Nxe4", "Nd7", "Ng5", "Ngf6",
      "Bd3", "e6", "N1f3", "h6", "Nxe6", "Qe7", "O-O", "fxe6", "Bg6+", "Kd8",
      "Bf4", "b5", "a4", "Bb7", "Re1", "Nd5", "Bg3", "Kc8", "axb5", "cxb5",
      "Qd3", "Bc6", "Bf5", "exf5", "Rxe7", "Bxe7", "c4",
    ],
    tier: "pro",
  },
  {
    id: "kasparov-topalov-1999",
    white: "Garry Kasparov",
    black: "Veselin Topalov",
    whiteTitle: "WCh",
    blackTitle: "GM",
    event: "Hoogovens, Wijk aan Zee",
    year: 1999,
    result: "1-0",
    eco: "B07",
    opening: "Pirc Defence",
    nickname: "Kasparov's Immortal",
    description:
      "24.Rxd4!! launches a king hunt that drags Black's king from b6 to b1's doorstep across fifteen forced moves. Widely voted the greatest game ever played.",
    moves: [
      "e4", "d6", "d4", "Nf6", "Nc3", "g6", "Be3", "Bg7", "Qd2", "c6",
      "f3", "b5", "Nge2", "Nbd7", "Bh6", "Bxh6", "Qxh6", "Bb7", "a3", "e5",
      "O-O-O", "Qe7", "Kb1", "a6", "Nc1", "O-O-O", "Nb3", "exd4", "Rxd4", "c5",
      "Rd1", "Nb6", "g3", "Kb8", "Na5", "Ba8", "Bh3", "d5", "Qf4+", "Ka7",
      "Rhe1", "d4", "Nd5", "Nbxd5", "exd5", "Qd6", "Rxd4", "cxd4", "Re7+", "Kb6",
      "Qxd4+", "Kxa5", "b4+", "Ka4", "Qc3", "Qxd5", "Ra7", "Bb7", "Rxb7", "Qc4",
      "Qxf6", "Kxa3", "Qxa6+", "Kxb4", "c3+", "Kxc3", "Qa1+", "Kd2", "Qb2+", "Kd1",
      "Bf1", "Rd2", "Rd7", "Rxd7", "Bxc4", "bxc4", "Qxh8", "Rd3", "Qa8", "c3",
      "Qa4+", "Ke1", "f4", "f5", "Kc1", "Rd2", "Qa7",
    ],
    tier: "master",
  },
  {
    id: "fischer-spassky-1972-g6",
    white: "Bobby Fischer",
    black: "Boris Spassky",
    whiteTitle: "WCh",
    blackTitle: "WCh",
    event: "World Championship game 6, Reykjavik",
    year: 1972,
    result: "1-0",
    eco: "D59",
    opening: "Queen's Gambit Declined, Tartakower",
    nickname: "The Match of the Century, Game 6",
    description:
      "Fischer opens 1.c4 for the first time in a serious game and produces a positional masterpiece so clean that Spassky himself joined the audience's applause. The model game for the minority-attack-turned-kingside-squeeze.",
    moves: [
      "c4", "e6", "Nf3", "d5", "d4", "Nf6", "Nc3", "Be7", "Bg5", "O-O",
      "e3", "h6", "Bh4", "b6", "cxd5", "Nxd5", "Bxe7", "Qxe7", "Nxd5", "exd5",
      "Rc1", "Be6", "Qa4", "c5", "Qa3", "Rc8", "Bb5", "a6", "dxc5", "bxc5",
      "O-O", "Ra7", "Be2", "Nd7", "Nd4", "Qf8", "Nxe6", "fxe6", "e4", "d4",
      "f4", "Qe7", "e5", "Rb8", "Bc4", "Kh8", "Qh3", "Nf8", "b3", "a5",
      "f5", "exf5", "Rxf5", "Nh7", "Rcf1", "Qd8", "Qg3", "Re7", "h4", "Rbb7",
      "e6", "Rbc7", "Qe5", "Qe8", "a4", "Qd8", "R1f2", "Qe8", "R2f3", "Qd8",
      "Bd3", "Qe8", "Qe4", "Nf6", "Rxf6", "gxf6", "Rxf6", "Kg8", "Bc4", "Kh8",
      "Qf4",
    ],
    tier: "master",
  },
  {
    id: "rotlewi-rubinstein-1907",
    white: "Gersz Rotlewi",
    black: "Akiba Rubinstein",
    whiteTitle: "Master",
    blackTitle: "Legend",
    event: "Lodz",
    year: 1907,
    result: "0-1",
    eco: "D40",
    opening: "Queen's Gambit, Semi-Tarrasch",
    nickname: "Rubinstein's Immortal",
    description:
      "22…Rxc3!! begins a four-piece sacrifice cascade where every Black piece hangs and none may be taken. The finest pure combination of the pre-war era.",
    moves: [
      "d4", "d5", "Nf3", "e6", "e3", "c5", "c4", "Nc6", "Nc3", "Nf6",
      "dxc5", "Bxc5", "a3", "a6", "b4", "Bd6", "Bb2", "O-O", "Qd2", "Qe7",
      "Bd3", "dxc4", "Bxc4", "b5", "Bd3", "Rd8", "Qe2", "Bb7", "O-O", "Ne5",
      "Nxe5", "Bxe5", "f4", "Bc7", "e4", "Rac8", "e5", "Bb6+", "Kh1", "Ng4",
      "Be4", "Qh4", "g3", "Rxc3", "gxh4", "Rd2", "Qxd2", "Bxe4+", "Qg2", "Rh3",
    ],
    tier: "master",
  },
  {
    id: "paulsen-morphy-1857",
    white: "Louis Paulsen",
    black: "Paul Morphy",
    whiteTitle: "Master",
    blackTitle: "Legend",
    event: "First American Chess Congress, New York",
    year: 1857,
    result: "0-1",
    eco: "C48",
    opening: "Four Knights Game",
    nickname: "Morphy's Queen Sacrifice",
    description:
      "17…Qxf3!! — Morphy gives his queen for a single bishop and suffocates White with light-square dominance. The first great positional queen sacrifice ever recorded.",
    moves: [
      "e4", "e5", "Nf3", "Nc6", "Nc3", "Nf6", "Bb5", "Bc5", "O-O", "O-O",
      "Nxe5", "Re8", "Nxc6", "dxc6", "Bc4", "b5", "Be2", "Nxe4", "Nxe4", "Rxe4",
      "Bf3", "Re6", "c3", "Qd3", "b4", "Bb6", "a4", "bxa4", "Qxa4", "Bd7",
      "Ra2", "Rae8", "Qa6", "Qxf3", "gxf3", "Rg6+", "Kh1", "Bh3", "Rd1", "Bg2+",
      "Kg1", "Bxf3+", "Kf1", "Bg2+", "Kg1", "Bh3+", "Kh1", "Bxf2", "Qf1", "Bxf1",
      "Rxf1", "Re2", "Ra1", "Rh6", "d4", "Be3",
    ],
    tier: "master",
  },
  {
    id: "steinitz-bardeleben-1895",
    white: "Wilhelm Steinitz",
    black: "Curt von Bardeleben",
    whiteTitle: "WCh",
    blackTitle: "Master",
    event: "Hastings",
    year: 1895,
    result: "1-0",
    eco: "C54",
    opening: "Italian Game, Giuoco Piano",
    nickname: "The Battle of Hastings",
    description:
      "22.Rxe7+! starts a rook that cannot be captured for nine consecutive moves. Bardeleben famously walked out of the hall rather than resign; Steinitz demonstrated the forced mate to the spectators.",
    moves: [
      "e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6", "d4", "exd4",
      "cxd4", "Bb4+", "Nc3", "d5", "exd5", "Nxd5", "O-O", "Be6", "Bg5", "Be7",
      "Bxd5", "Bxd5", "Nxd5", "Qxd5", "Bxe7", "Nxe7", "Re1", "f6", "Qe2", "Qd7",
      "Rac1", "c6", "d5", "cxd5", "Nd4", "Kf7", "Ne6", "Rhc8", "Qg4", "g6",
      "Ng5+", "Ke8", "Rxe7+", "Kf8", "Rf7+", "Kg8", "Rg7+", "Kh8", "Rxh7+",
    ],
    tier: "master",
  },
];

export function famousGameTierAvailable(
  game: FamousGame,
  isPro: boolean,
  isMaster: boolean
): boolean {
  if (game.tier === "free") return true;
  if (game.tier === "pro") return isPro || isMaster;
  return isMaster;
}
