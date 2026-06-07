import { useState, useRef, useCallback, useEffect } from "react";
import { Chess, Square } from "chess.js";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronFirst,
  ChevronLast,
  Link2,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  User,
} from "lucide-react";
import { Link } from "react-router-dom";
import { PIECE_URLS } from "@/lib/chess-constants";
import { playMoveSound } from "@/lib/sounds";

// ─── helpers ────────────────────────────────────────────────────────────────

function extractLichessId(url: string): string | null {
  // e.g. https://lichess.org/aBcDeFgH  or  https://lichess.org/aBcDeFgH/black
  const m = url.match(/lichess\.org\/([A-Za-z0-9]{8})(?:\/|$)/);
  return m ? m[1] : null;
}

function extractChessComId(url: string): string | null {
  // e.g. https://www.chess.com/game/live/12345678
  const m = url.match(/chess\.com\/game\/(?:live|daily)\/(\d+)/);
  return m ? m[1] : null;
}

async function fetchLichessPgn(gameId: string): Promise<string> {
  const res = await fetch(`https://lichess.org/game/export/${gameId}?clocks=0&evals=0&opening=1`, {
    headers: { Accept: "application/x-chess-pgn" },
  });
  if (!res.ok) throw new Error(`Lichess API error: ${res.status}`);
  return res.text();
}

function getSquareFromPoint(boardEl: HTMLElement, clientX: number, clientY: number, flipped: boolean): Square | null {
  const rect = boardEl.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  let col = Math.floor((x / rect.width) * 8);
  let row = Math.floor((y / rect.height) * 8);
  if (flipped) { col = 7 - col; row = 7 - row; }
  if (col < 0 || col > 7 || row < 0 || row > 7) return null;
  return `${String.fromCharCode(97 + col)}${8 - row}` as Square;
}

// ─── component ──────────────────────────────────────────────────────────────

const ImportGame = () => {
  // Import form state
  const [urlInput, setUrlInput] = useState("");
  const [pgnInput, setPgnInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  // Loaded game state
  const [game, setGame] = useState<Chess | null>(null);
  const [moveHistory, setMoveHistory] = useState<{ san: string; from: Square; to: Square }[]>([]);
  const [currentPly, setCurrentPly] = useState(-1); // -1 = latest
  const [viewFen, setViewFen] = useState<string | null>(null);
  const [activeHistoryIndex, setActiveHistoryIndex] = useState(-1);

  // Meta from PGN headers
  const [whiteName, setWhiteName] = useState("White");
  const [blackName, setBlackName] = useState("Black");
  const [whiteElo, setWhiteElo] = useState<string | null>(null);
  const [blackElo, setBlackElo] = useState<string | null>(null);
  const [eventName, setEventName] = useState<string | null>(null);
  const [gameDate, setGameDate] = useState<string | null>(null);
  const [gameResult, setGameResult] = useState<string | null>(null);

  // Drag state
  const [dragging, setDragging] = useState<{
    square: Square;
    piece: { color: string; type: string };
    x: number;
    y: number;
  } | null>(null);
  const [dragOver, setDragOver] = useState<Square | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const moveListRef = useRef<HTMLDivElement>(null);

  const isViewMode = true; // always read-only in import viewer
  const flipped = false; // white always at bottom

  const displayFen = viewFen || (game ? game.fen() : new Chess().fen());
  const displayGame = new Chess(displayFen);

  const lastMove = moveHistory[activeHistoryIndex] ?? null;

  // ── parse PGN ─────────────────────────────────────────────────────────────
  const loadPgn = useCallback((pgn: string) => {
    try {
      const g = new Chess();
      g.loadPgn(pgn, { sloppy: true });
      const headers = g.header();

      setWhiteName(headers.White || "White");
      setBlackName(headers.Black || "Black");
      setWhiteElo(headers.WhiteElo || null);
      setBlackElo(headers.BlackElo || null);
      setEventName(headers.Event && headers.Event !== "?" ? headers.Event : null);
      setGameDate(headers.Date && headers.Date !== "????.??.??" ? headers.Date : null);
      setGameResult(headers.Result || null);

      const history = g.history({ verbose: true }) as { san: string; from: Square; to: Square }[];
      setMoveHistory(history);
      setGame(g);
      setCurrentPly(history.length - 1);
      setActiveHistoryIndex(history.length - 1);
      setViewFen(null);
      setImportSuccess(true);
      setImportError(null);
    } catch {
      throw new Error("Invalid PGN. Please paste a valid PGN.");
    }
  }, []);

  // ── import from URL ───────────────────────────────────────────────────────
  const handleImportUrl = async () => {
    const url = urlInput.trim();
    if (!url) { setImportError("Please enter a URL."); return; }

    setImporting(true);
    setImportError(null);
    setImportSuccess(false);

    try {
      const lichessId = extractLichessId(url);
      if (lichessId) {
        const pgn = await fetchLichessPgn(lichessId);
        loadPgn(pgn);
      } else if (extractChessComId(url)) {
        // Chess.com doesn't expose a simple public API for arbitrary games.
        // Guide user to export the PGN manually.
        setImportError(
          "Chess.com games can't be fetched automatically. Open the game on chess.com, click Share → Download PGN, then paste the PGN below."
        );
      } else {
        setImportError("Unrecognized URL. Supported: lichess.org/xxxxxxxx game links.");
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to import game.");
    } finally {
      setImporting(false);
    }
  };

  // ── import from PGN paste ─────────────────────────────────────────────────
  const handleImportPgn = () => {
    const pgn = pgnInput.trim();
    if (!pgn) { setImportError("Please paste a PGN."); return; }
    setImportError(null);
    setImportSuccess(false);
    try {
      loadPgn(pgn);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Invalid PGN.");
    }
  };

  // ── navigation ────────────────────────────────────────────────────────────
  const goToMove = useCallback((idx: number) => {
    if (!game) return;
    const clampedIdx = Math.max(-1, Math.min(idx, moveHistory.length - 1));
    if (clampedIdx === -1) {
      setViewFen(new Chess().fen());
    } else {
      const replay = new Chess();
      for (let i = 0; i <= clampedIdx; i++) {
        replay.move(moveHistory[i].san);
      }
      setViewFen(replay.fen());
    }
    setActiveHistoryIndex(clampedIdx);
    setCurrentPly(clampedIdx);
  }, [game, moveHistory]);

  const goToStart = () => goToMove(-1);
  const goToEnd = () => goToMove(moveHistory.length - 1);
  const goBack = () => goToMove(activeHistoryIndex - 1);
  const goForward = () => goToMove(activeHistoryIndex + 1);

  // keyboard navigation
  useEffect(() => {
    if (!game) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); goBack(); }
      if (e.key === "ArrowRight") { e.preventDefault(); goForward(); }
      if (e.key === "Home") { e.preventDefault(); goToStart(); }
      if (e.key === "End") { e.preventDefault(); goToEnd(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, activeHistoryIndex, moveHistory.length]);

  // auto-scroll move list
  useEffect(() => {
    if (!moveListRef.current) return;
    const active = moveListRef.current.querySelector("[data-active='true']") as HTMLElement | null;
    if (active) active.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeHistoryIndex]);

  // drag handlers (read-only: just visual, no moves applied)
  const handleDragStart = (square: Square, e: React.MouseEvent | React.TouchEvent) => {
    if (isViewMode) return;
    e.preventDefault();
    const piece = displayGame.get(square);
    if (!piece) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    setDragging({ square, piece: { color: piece.color, type: piece.type }, x: clientX, y: clientY });
  };

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = "touches" in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
      setDragging((prev) => prev ? { ...prev, x: clientX, y: clientY } : null);
      if (boardRef.current) {
        const sq = getSquareFromPoint(boardRef.current, clientX, clientY, flipped);
        setDragOver(sq);
      }
    };
    const handleEnd = () => { setDragging(null); setDragOver(null); };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleEnd);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [dragging, flipped]);

  const resetImport = () => {
    setGame(null);
    setMoveHistory([]);
    setCurrentPly(-1);
    setActiveHistoryIndex(-1);
    setViewFen(null);
    setImportSuccess(false);
    setImportError(null);
    setUrlInput("");
    setPgnInput("");
  };

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center gap-4 px-6 py-4">
          <Link
            to="/play"
            className="flex items-center gap-2 font-body text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <h1 className="font-display text-xl font-semibold">
            Import <span className="text-gradient-brand">&amp; Analyze</span>
          </h1>
          {game && (
            <button
              onClick={resetImport}
              className="ml-auto flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 font-body text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Import Another
            </button>
          )}
        </div>
      </nav>

      {/* Import form (shown until a game is loaded) */}
      {!game && (
        <div className="container mx-auto max-w-2xl px-4 py-12">
          <div className="space-y-8">
            {/* Title block */}
            <div className="text-center space-y-2">
              <p className="font-body text-muted-foreground text-sm">
                Import a game from Lichess by URL, or paste any PGN to analyze it.
              </p>
            </div>

            {/* URL input */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Link2 className="h-4 w-4 text-foreground/70" />
                <span className="font-display text-sm font-semibold text-foreground">Import from URL</span>
              </div>
              <p className="font-body text-xs text-muted-foreground -mt-2">
                Paste a Lichess game link (e.g. lichess.org/aBcDeFgH)
              </p>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleImportUrl()}
                  placeholder="https://lichess.org/aBcDeFgH"
                  className="flex-1 rounded-lg border border-border bg-secondary/40 px-4 py-2.5 font-body text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <button
                  onClick={handleImportUrl}
                  disabled={importing}
                  className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-body text-sm font-semibold text-primary-foreground shadow-gold transition-all hover:scale-[1.02] disabled:opacity-60"
                >
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  {importing ? "Importing…" : "Import"}
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-border" />
              <span className="font-body text-xs text-muted-foreground uppercase tracking-wider">or paste PGN</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* PGN paste */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-foreground/70" />
                <span className="font-display text-sm font-semibold text-foreground">Paste PGN</span>
              </div>
              <p className="font-body text-xs text-muted-foreground -mt-2">
                Paste the full PGN from Chess.com, Lichess, or any other source
              </p>
              <textarea
                value={pgnInput}
                onChange={(e) => setPgnInput(e.target.value)}
                rows={8}
                placeholder={`[Event "Example"]\n[White "Magnus"]\n[Black "Hikaru"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 ...`}
                className="w-full rounded-lg border border-border bg-secondary/40 px-4 py-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
              <button
                onClick={handleImportPgn}
                className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 font-body text-sm font-semibold text-primary-foreground shadow-gold transition-all hover:scale-[1.02]"
              >
                <FileText className="h-4 w-4" />
                Load PGN
              </button>
            </div>

            {/* Error / success */}
            <AnimatePresence>
              {importError && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3"
                >
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="font-body text-sm text-destructive leading-relaxed">{importError}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Game viewer (shown after a game is loaded) */}
      {game && (
        <div className="container mx-auto max-w-[1300px] px-4 py-6">
          {/* Game header */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {importSuccess && (
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-body text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Game imported
              </span>
            )}
            {eventName && <span className="font-body text-sm text-muted-foreground">{eventName}</span>}
            {gameDate && <span className="font-body text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5">{gameDate}</span>}
            {gameResult && (
              <span className={`rounded-full px-3 py-0.5 font-body text-xs font-semibold border ${gameResult === "1-0" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : gameResult === "0-1" ? "bg-rose-500/15 border-rose-500/30 text-rose-400" : "bg-secondary/80 border-border text-muted-foreground"}`}>
                {gameResult === "1-0" ? "White wins" : gameResult === "0-1" ? "Black wins" : gameResult === "1/2-1/2" ? "Draw" : gameResult}
              </span>
            )}
            <span className="font-body text-xs text-muted-foreground ml-auto">
              {moveHistory.length} moves · Use ← → arrow keys to navigate
            </span>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            {/* Board column */}
            <div className="w-full lg:flex-[0_0_60%] lg:max-w-[60%]">
              <div className="mx-auto flex max-w-[580px] flex-col gap-2">
                {/* Black player banner */}
                <div className="flex items-center gap-3 rounded-xl border border-border bg-card/80 px-4 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary border border-border">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-display text-sm font-semibold text-foreground leading-none">{blackName}</p>
                    {blackElo && <p className="font-body text-xs text-muted-foreground mt-0.5">{blackElo}</p>}
                  </div>
                  <div className="ml-auto flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-sm bg-foreground/70 border border-border" />
                    <span className="font-body text-xs text-muted-foreground">Black</span>
                  </div>
                </div>

                {/* Board */}
                <div className="relative overflow-hidden rounded-xl border border-border shadow-elevated ring-1 ring-white/5">
                  <div ref={boardRef} className="grid aspect-square w-full grid-cols-8 grid-rows-8">
                    {Array.from({ length: 64 }, (_, i) => {
                      const row = Math.floor(i / 8);
                      const col = i % 8;
                      const square = `${String.fromCharCode(97 + col)}${8 - row}` as Square;
                      const piece = displayGame.get(square);
                      const isDark = (row + col) % 2 === 1;
                      const isLastMoveFrom = lastMove?.from === square;
                      const isLastMoveTo = lastMove?.to === square;
                      const isDragSource = dragging?.square === square;

                      return (
                        <div
                          key={square}
                          className={`relative flex select-none items-center justify-center ${isDark ? "bg-chess-dark" : "bg-chess-light"}`}
                        >
                          {/* Last move highlight */}
                          {(isLastMoveFrom || isLastMoveTo) && (
                            <div className="absolute inset-0" style={{ backgroundColor: "rgba(245,200,68,0.30)" }} />
                          )}

                          {/* File/rank coords */}
                          {col === 0 && (
                            <span className={`absolute left-1 top-0.5 z-10 text-[9px] font-bold ${isDark ? "text-chess-light/80" : "text-chess-dark/80"}`}>
                              {8 - row}
                            </span>
                          )}
                          {row === 7 && (
                            <span className={`absolute bottom-0 right-1 z-10 text-[9px] font-bold ${isDark ? "text-chess-light/80" : "text-chess-dark/80"}`}>
                              {String.fromCharCode(97 + col)}
                            </span>
                          )}

                          {/* Piece */}
                          {piece && !isDragSource && (
                            <img
                              src={PIECE_URLS[piece.color][piece.type]}
                              alt={`${piece.color}${piece.type}`}
                              className="z-20 h-[84%] w-[84%] select-none object-contain drop-shadow-md pointer-events-none"
                              draggable={false}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* White player banner */}
                <div className="flex items-center gap-3 rounded-xl border border-border bg-card/80 px-4 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary border border-border">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-display text-sm font-semibold text-foreground leading-none">{whiteName}</p>
                    {whiteElo && <p className="font-body text-xs text-muted-foreground mt-0.5">{whiteElo}</p>}
                  </div>
                  <div className="ml-auto flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-sm bg-foreground/10 border border-border" />
                    <span className="font-body text-xs text-muted-foreground">White</span>
                  </div>
                </div>

                {/* Navigation controls */}
                <div className="flex w-full items-stretch gap-1.5">
                  <button
                    onClick={goToStart}
                    className="rounded-lg border border-border bg-card p-2.5 transition-colors hover:bg-secondary"
                    title="First move"
                  >
                    <ChevronFirst className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button
                    onClick={goBack}
                    className="rounded-lg border border-border bg-card p-2.5 transition-colors hover:bg-secondary"
                    title="Previous move (←)"
                  >
                    <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <div className="flex flex-1 items-center justify-center rounded-lg border border-border bg-card px-3 font-body text-sm text-muted-foreground text-center min-w-0">
                    {activeHistoryIndex === -1
                      ? "Start position"
                      : `Move ${Math.floor(activeHistoryIndex / 2) + 1}${activeHistoryIndex % 2 === 0 ? "." : "…"} ${moveHistory[activeHistoryIndex]?.san ?? ""}`}
                  </div>
                  <button
                    onClick={goForward}
                    className="rounded-lg border border-border bg-card p-2.5 transition-colors hover:bg-secondary"
                    title="Next move (→)"
                  >
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button
                    onClick={goToEnd}
                    className="rounded-lg border border-border bg-card p-2.5 transition-colors hover:bg-secondary"
                    title="Last move"
                  >
                    <ChevronLast className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
            </div>

            {/* Move list sidebar */}
            <div className="w-full lg:flex-1 space-y-3">
              {/* Move list */}
              <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
                <h3 className="mb-3 font-display text-sm font-semibold text-foreground uppercase tracking-wider">
                  Moves
                </h3>
                <div
                  ref={moveListRef}
                  className="max-h-[420px] overflow-y-auto pr-1 space-y-0.5"
                  style={{ scrollbarWidth: "thin" }}
                >
                  {moveHistory.length === 0 && (
                    <p className="py-8 text-center font-body text-sm text-muted-foreground">No moves</p>
                  )}
                  {Array.from({ length: Math.ceil(moveHistory.length / 2) }, (_, i) => {
                    const wMove = moveHistory[i * 2];
                    const bMove = moveHistory[i * 2 + 1];
                    const wActive = activeHistoryIndex === i * 2;
                    const bActive = activeHistoryIndex === i * 2 + 1;
                    return (
                      <div key={i} className="flex items-center gap-1 text-sm rounded-md overflow-hidden">
                        <span className="w-7 shrink-0 font-mono text-xs text-muted-foreground text-right pr-1">
                          {i + 1}.
                        </span>
                        <button
                          data-active={wActive}
                          onClick={() => goToMove(i * 2)}
                          className={`w-20 rounded px-2 py-1.5 font-body text-sm text-left transition-colors ${wActive ? "bg-primary/20 text-foreground font-semibold" : "text-foreground hover:bg-secondary"}`}
                        >
                          {wMove?.san}
                        </button>
                        {bMove && (
                          <button
                            data-active={bActive}
                            onClick={() => goToMove(i * 2 + 1)}
                            className={`w-20 rounded px-2 py-1.5 font-body text-sm text-left transition-colors ${bActive ? "bg-primary/20 text-foreground font-semibold" : "text-foreground hover:bg-secondary"}`}
                          >
                            {bMove.san}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quick info */}
              <div className="rounded-xl border border-border bg-card p-4 shadow-soft space-y-2">
                <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider mb-2">
                  Game Info
                </h3>
                {eventName && (
                  <div className="flex justify-between font-body text-sm">
                    <span className="text-muted-foreground">Event</span>
                    <span className="text-foreground text-right max-w-[60%] truncate">{eventName}</span>
                  </div>
                )}
                {gameDate && (
                  <div className="flex justify-between font-body text-sm">
                    <span className="text-muted-foreground">Date</span>
                    <span className="text-foreground">{gameDate}</span>
                  </div>
                )}
                <div className="flex justify-between font-body text-sm">
                  <span className="text-muted-foreground">Total moves</span>
                  <span className="text-foreground">{moveHistory.length}</span>
                </div>
                {gameResult && (
                  <div className="flex justify-between font-body text-sm">
                    <span className="text-muted-foreground">Result</span>
                    <span className={`font-semibold ${gameResult === "1-0" ? "text-emerald-400" : gameResult === "0-1" ? "text-rose-400" : "text-muted-foreground"}`}>
                      {gameResult === "1-0" ? "White wins" : gameResult === "0-1" ? "Black wins" : "Draw"}
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t border-border">
                  <p className="font-body text-[11px] text-muted-foreground">
                    Tip: Use ← → arrow keys to step through moves
                  </p>
                </div>
              </div>

              {/* Import another */}
              <button
                onClick={resetImport}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-border bg-card py-2.5 font-body text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <RotateCcw className="h-4 w-4" />
                Import Another Game
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportGame;
