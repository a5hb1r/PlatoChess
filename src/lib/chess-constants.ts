/**
 * Chessnut piece set (Alexis Luengas, Apache 2.0) — vendored locally in
 * /public/pieces/chessnut so pieces load instantly with no third-party
 * network dependency. A clean, bold, modern set in the chess.com spirit.
 */
export const PIECE_URLS: Record<string, Record<string, string>> = {
  w: {
    k: "/pieces/chessnut/wK.svg",
    q: "/pieces/chessnut/wQ.svg",
    r: "/pieces/chessnut/wR.svg",
    b: "/pieces/chessnut/wB.svg",
    n: "/pieces/chessnut/wN.svg",
    p: "/pieces/chessnut/wP.svg",
  },
  b: {
    k: "/pieces/chessnut/bK.svg",
    q: "/pieces/chessnut/bQ.svg",
    r: "/pieces/chessnut/bR.svg",
    b: "/pieces/chessnut/bB.svg",
    n: "/pieces/chessnut/bN.svg",
    p: "/pieces/chessnut/bP.svg",
  },
};
