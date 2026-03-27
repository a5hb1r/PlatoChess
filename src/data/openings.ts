/**
 * Book-inspired opening curriculum based on major MCO sections/chapters.
 * Uses original move data authored in this project (SAN), not copied prose.
 */
export interface OpeningLine {
  id: string;
  name: string;
  eco?: string;
  family: string;
  moves: string[];
}

export interface OpeningChapter {
  family: string;
  chapter: string;
}

export const OPENING_FAMILIES = [
  "I. Double King Pawn (1.e4 e5)",
  "II. Semi-Open Games (1.e4 ...)",
  "III. Double Queen Pawn (1.d4 d5 2.c4)",
  "IV. Other Queen Pawn Openings",
  "V. Indian Openings",
  "VI. Flank Openings",
] as const;

export const OPENING_CHAPTERS: OpeningChapter[] = [
  { family: OPENING_FAMILIES[0], chapter: "King's Gambit" },
  { family: OPENING_FAMILIES[0], chapter: "Italian / Giuoco Piano" },
  { family: OPENING_FAMILIES[0], chapter: "Evans Gambit" },
  { family: OPENING_FAMILIES[0], chapter: "Ruy Lopez" },
  { family: OPENING_FAMILIES[0], chapter: "Petrov / Scotch / Vienna / Philidor" },
  { family: OPENING_FAMILIES[1], chapter: "Sicilian (Najdorf, Dragon, Scheveningen, Sveshnikov)" },
  { family: OPENING_FAMILIES[1], chapter: "French / Caro-Kann / Alekhine / Pirc / Scandinavian" },
  { family: OPENING_FAMILIES[2], chapter: "QGD / Tarrasch / QGA / Slav / Semi-Slav" },
  { family: OPENING_FAMILIES[3], chapter: "Dutch, Trompowsky, London, Torre, Colle" },
  { family: OPENING_FAMILIES[4], chapter: "Nimzo, Queen's Indian, Bogo, KID, Grunfeld, Benoni, Benko" },
  { family: OPENING_FAMILIES[5], chapter: "English, Reti, KIA, Bird, Larsen" },
];

const L = (
  id: string,
  family: (typeof OPENING_FAMILIES)[number],
  eco: string,
  name: string,
  moves: string[]
): OpeningLine => ({ id, family, eco, name, moves });

export const OPENING_LINES: OpeningLine[] = [
  // I. Double King Pawn (1.e4 e5)
  L("ruy-lopez-main", OPENING_FAMILIES[0], "C60", "Ruy Lopez - Main Line", ["e4", "e5", "Nf3", "Nc6", "Bb5"]),
  L("ruy-lopez-berlin", OPENING_FAMILIES[0], "C65", "Ruy Lopez - Berlin Defence", ["e4", "e5", "Nf3", "Nc6", "Bb5", "Nf6"]),
  L("ruy-lopez-morphy", OPENING_FAMILIES[0], "C70", "Ruy Lopez - Morphy Defence", ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6"]),
  L("italian-giuoco", OPENING_FAMILIES[0], "C50", "Italian - Giuoco Piano", ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6", "d3", "d6"]),
  L("italian-two-knights", OPENING_FAMILIES[0], "C55", "Italian - Two Knights Defence", ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "d3", "Bc5"]),
  L("evans-gambit", OPENING_FAMILIES[0], "C51", "Evans Gambit", ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "b4", "Bxb4", "c3", "Ba5"]),
  L("scotch-main", OPENING_FAMILIES[0], "C45", "Scotch Game", ["e4", "e5", "Nf3", "Nc6", "d4", "exd4", "Nxd4", "Nf6", "Nxc6", "bxc6"]),
  L("vienna-main", OPENING_FAMILIES[0], "C25", "Vienna Game", ["e4", "e5", "Nc3", "Nf6", "g3", "d5", "exd5", "Nxd5"]),
  L("kings-gambit", OPENING_FAMILIES[0], "C30", "King's Gambit Accepted", ["e4", "e5", "f4", "exf4", "Nf3", "g5", "h4", "g4"]),
  L("petrov-main", OPENING_FAMILIES[0], "C42", "Petrov Defence", ["e4", "e5", "Nf3", "Nf6", "Nxe5", "d6", "Nf3", "Nxe4"]),
  L("philidor-main", OPENING_FAMILIES[0], "C41", "Philidor Defence", ["e4", "e5", "Nf3", "d6", "d4", "Nf6", "Nc3", "Nbd7"]),
  L("ponziani", OPENING_FAMILIES[0], "C44", "Ponziani Opening", ["e4", "e5", "Nf3", "Nc6", "c3", "Nf6", "d4", "Nxe4"]),
  L("bishops-opening", OPENING_FAMILIES[0], "C23", "Bishop's Opening", ["e4", "e5", "Bc4", "Nf6", "d3", "c6", "Nf3", "d5"]),

  // II. Semi-Open Games (1.e4 ...)
  L("sicilian-najdorf", OPENING_FAMILIES[1], "B90", "Sicilian - Najdorf", ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"]),
  L("sicilian-dragon", OPENING_FAMILIES[1], "B70", "Sicilian - Dragon", ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "g6"]),
  L("sicilian-scheveningen", OPENING_FAMILIES[1], "B80", "Sicilian - Scheveningen", ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "e6"]),
  L("sicilian-sveshnikov", OPENING_FAMILIES[1], "B33", "Sicilian - Sveshnikov", ["e4", "c5", "Nf3", "Nc6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "e5"]),
  L("french-winawer", OPENING_FAMILIES[1], "C15", "French - Winawer", ["e4", "e6", "d4", "d5", "Nc3", "Bb4", "e5", "c5"]),
  L("french-classical", OPENING_FAMILIES[1], "C11", "French - Classical", ["e4", "e6", "d4", "d5", "Nc3", "Nf6", "Bg5", "Be7"]),
  L("caro-kann-classical", OPENING_FAMILIES[1], "B18", "Caro-Kann - Classical", ["e4", "c6", "d4", "d5", "Nc3", "dxe4", "Nxe4", "Bf5"]),
  L("caro-kann-advance", OPENING_FAMILIES[1], "B12", "Caro-Kann - Advance", ["e4", "c6", "d4", "d5", "e5", "Bf5", "Nf3", "e6"]),
  L("alekhine-main", OPENING_FAMILIES[1], "B03", "Alekhine Defence", ["e4", "Nf6", "e5", "Nd5", "d4", "d6", "Nf3", "Bg4"]),
  L("pirc-austrian", OPENING_FAMILIES[1], "B09", "Pirc - Austrian Attack", ["e4", "d6", "d4", "Nf6", "Nc3", "g6", "f4", "Bg7"]),
  L("modern-defence", OPENING_FAMILIES[1], "B06", "Modern Defence", ["e4", "g6", "d4", "Bg7", "Nc3", "d6", "Nf3", "Nf6"]),
  L("scandinavian-main", OPENING_FAMILIES[1], "B01", "Scandinavian - Qa5", ["e4", "d5", "exd5", "Qxd5", "Nc3", "Qa5"]),

  // III. Double Queen Pawn (1.d4 d5 2.c4)
  L("qgd-orthodox", OPENING_FAMILIES[2], "D60", "QGD - Orthodox", ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5", "Be7"]),
  L("qgd-exchange", OPENING_FAMILIES[2], "D35", "QGD - Exchange", ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "cxd5", "exd5"]),
  L("qgd-cambridge-springs", OPENING_FAMILIES[2], "D52", "QGD - Cambridge Springs", ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5", "Nbd7", "e3", "c6", "Nf3", "Qa5"]),
  L("tarrasch-defence", OPENING_FAMILIES[2], "D32", "Tarrasch Defence", ["d4", "d5", "c4", "e6", "Nc3", "c5", "cxd5", "exd5"]),
  L("qga-main", OPENING_FAMILIES[2], "D20", "Queen's Gambit Accepted", ["d4", "d5", "c4", "dxc4", "Nf3", "Nf6", "e3", "e6"]),
  L("slav-main", OPENING_FAMILIES[2], "D10", "Slav Defence", ["d4", "d5", "c4", "c6", "Nf3", "Nf6", "Nc3", "dxc4"]),
  L("semi-slav-meran", OPENING_FAMILIES[2], "D47", "Semi-Slav - Meran", ["d4", "d5", "c4", "c6", "Nc3", "Nf6", "Nf3", "e6", "e3", "Nbd7", "Bd3", "dxc4"]),
  L("chigorin-defence", OPENING_FAMILIES[2], "D07", "Chigorin Defence", ["d4", "d5", "c4", "Nc6", "Nc3", "Nf6", "Nf3", "Bg4"]),

  // IV. Other Queen Pawn Openings
  L("dutch-classical", OPENING_FAMILIES[3], "A80", "Dutch Defence", ["d4", "f5", "g3", "Nf6", "Bg2", "e6", "Nf3", "Be7"]),
  L("london-system", OPENING_FAMILIES[3], "D02", "London System", ["d4", "d5", "Bf4", "Nf6", "e3", "e6", "Nf3", "c5"]),
  L("colle-system", OPENING_FAMILIES[3], "D05", "Colle System", ["d4", "Nf6", "Nf3", "e6", "e3", "d5", "Bd3", "c5"]),
  L("torre-attack", OPENING_FAMILIES[3], "D03", "Torre Attack", ["d4", "Nf6", "Nf3", "e6", "Bg5", "d5", "e3", "Be7"]),
  L("trompowsky", OPENING_FAMILIES[3], "A45", "Trompowsky Attack", ["d4", "Nf6", "Bg5", "e6", "e4", "h6", "Bxf6", "Qxf6"]),
  L("veresov", OPENING_FAMILIES[3], "D01", "Veresov Attack", ["d4", "d5", "Nc3", "Nf6", "Bg5", "e6", "e4", "Be7"]),
  L("blackmar-diemer", OPENING_FAMILIES[3], "D00", "Blackmar-Diemer Gambit", ["d4", "d5", "e4", "dxe4", "Nc3", "Nf6", "f3"]),

  // V. Indian Openings
  L("nimzo-classical", OPENING_FAMILIES[4], "E32", "Nimzo-Indian - Classical", ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4", "Qc2", "O-O"]),
  L("queens-indian", OPENING_FAMILIES[4], "E12", "Queen's Indian", ["d4", "Nf6", "c4", "e6", "Nf3", "b6", "g3", "Bb7"]),
  L("bogo-indian", OPENING_FAMILIES[4], "E11", "Bogo-Indian", ["d4", "Nf6", "c4", "e6", "Nf3", "Bb4+"]),
  L("kings-indian-classical", OPENING_FAMILIES[4], "E94", "King's Indian - Classical", ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6"]),
  L("old-indian", OPENING_FAMILIES[4], "A53", "Old Indian Defence", ["d4", "Nf6", "c4", "d6", "Nc3", "e5", "Nf3", "Nbd7"]),
  L("grunfeld-exchange", OPENING_FAMILIES[4], "D85", "Grunfeld - Exchange", ["d4", "Nf6", "c4", "g6", "Nc3", "d5", "cxd5", "Nxd5", "e4"]),
  L("benoni-modern", OPENING_FAMILIES[4], "A60", "Benoni - Modern", ["d4", "Nf6", "c4", "c5", "d5", "e6", "Nc3", "exd5", "cxd5", "d6"]),
  L("benko-gambit", OPENING_FAMILIES[4], "A57", "Benko Gambit", ["d4", "Nf6", "c4", "c5", "d5", "b5", "cxb5", "a6"]),
  L("budapest-gambit", OPENING_FAMILIES[4], "A51", "Budapest Gambit", ["d4", "Nf6", "c4", "e5", "dxe5", "Ng4", "Nf3", "Nc6"]),

  // VI. Flank Openings
  L("english-symmetrical", OPENING_FAMILIES[5], "A30", "English - Symmetrical", ["c4", "c5", "Nc3", "Nc6", "g3", "g6", "Bg2", "Bg7"]),
  L("english-reversed-sicilian", OPENING_FAMILIES[5], "A20", "English - Reversed Sicilian", ["c4", "e5", "Nc3", "Nf6", "g3", "d5"]),
  L("reti-main", OPENING_FAMILIES[5], "A04", "Reti Opening", ["Nf3", "d5", "g3", "Nf6", "Bg2", "e6", "O-O", "Be7"]),
  L("kings-indian-attack", OPENING_FAMILIES[5], "A07", "King's Indian Attack", ["Nf3", "d5", "g3", "Nf6", "Bg2", "e6", "O-O", "Be7", "d3"]),
  L("larsen-opening", OPENING_FAMILIES[5], "A01", "Larsen's Opening", ["b3", "d5", "Bb2", "Nf6", "e3", "e6", "Nf3", "Be7"]),
  L("birds-opening", OPENING_FAMILIES[5], "A02", "Bird's Opening", ["f4", "d5", "Nf3", "g6", "e3", "Bg7", "Be2", "Nf6"]),
];

export function linesByFamily(family: string): OpeningLine[] {
  return OPENING_LINES.filter((l) => l.family === family);
}
