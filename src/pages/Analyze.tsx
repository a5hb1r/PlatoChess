import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Chess, Square } from "chess.js";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { PIECE_URLS } from "@/lib/chess-constants";
import {
  StockfishEngine,
  StockfishInfo,
  STOCKFISH_VERSION_LABEL,
  formatEngineInitError,
} from "@/lib/stockfish";
import { playMoveSound } from "@/lib/sounds";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { type CoachId, coachOnEval, COACHES } from "@/lib/philosopher-coaches";

const examplePgn = `[Event "Casual"]
[Site "PlatoChess"]
[White "You"]
[Black "Friend"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3`;

const Analyze = () => {
  const [pgnInput, setPgnInput] = useState(examplePgn);
  const [error, setError] = useState<string | null>(null);
  const [mainLine, setMainLine] = useState<Chess | null>(null);
  const [plyIndex, setPlyIndex] = useState(0);
  const [fen, setFen] = useState(new Chess().fen());
  const [evalCp, setEvalCp] = useState(0);
  const [evalMate, setEvalMate] = useState<number | null>(null);
  const [depth, setDepth] = useState(0);
  const [pvLine, setPvLine] = useState("");
  const [engineReady, setEngineReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Square | null>(null);
  const [targets, setTargets] = useState<Square[]>([]);
  const [coachId, setCoachId] = useState<CoachId>("none");
  const [coachMsg, setCoachMsg] = useState<string | null>(null);

  const engineRef = useRef<StockfishEngine | null>(null);

  const lastMoveSan = useMemo(() => {
    if (!mainLine || plyIndex <= 0) return null;
    const h = mainLine.history();
    return h[plyIndex - 1] ?? null;
  }, [mainLine, plyIndex]);
  const loadPgn = useCallback(() => {
    setError(null);
    const g = new Chess();
    try {
      g.loadPgn(pgnInput.trim(), { strict: false });
    } catch {
      setError("Invalid PGN - check headers and move text.");
      return;
    }
    const verbose = g.history({ verbose: true });
    if (verbose.length === 0) {
      setError("No moves found in PGN.");
      return;
    }
    setMainLine(g);
    setPlyIndex(verbose.length);
    setFen(g.fen());
    setSelected(null);
    setTargets([]);
  }, [pgnInput]);

  useEffect(() => {
    loadPgn();
  }, [loadPgn]);

  useEffect(() => {
    const e = new StockfishEngine();
    engineRef.current = e;
    e.init()
      .then(() => setEngineReady(true))
      .catch((err) =>
        setError(err instanceof Error ? err.message : formatEngineInitError(err))
      );
    return () => e.destroy();
  }, []);

  useEffect(() => {
    if (!engineReady || !engineRef.current) return;
    engineRef.current.evaluate(fen, 20, (info: StockfishInfo) => {
      if (info.mate !== undefined) {
        setEvalMate(info.mate);
        setEvalCp(0);
      } else if (info.score !== undefined) {
        setEvalMate(null);
        setEvalCp(info.score);
      }
      if (info.depth) setDepth(info.depth);
      if (info.pvLine) setPvLine(info.pvLine);
    });
  }, [fen, engineReady]);

  useEffect(() => {
    if (coachId === "none" || !engineReady) {
      setCoachMsg(null);
      return;
    }
    setCoachMsg(coachOnEval(coachId, evalCp, evalMate, lastMoveSan, fen.length + plyIndex + depth));
  }, [coachId, evalCp, evalMate, lastMoveSan, fen, plyIndex, depth, engineReady]);

  const positionAt = useCallback(
    (ply: number) => {
      if (!mainLine) return;
      const replay = new Chess();
      const hist = mainLine.history({ verbose: true });
      for (let i = 0; i < ply && i < hist.length; i++) {
        replay.move(hist[i]);
      }
      setFen(replay.fen());
      setPlyIndex(ply);
      setSelected(null);
      setTargets([]);
    },
    [mainLine]
  );

  const displayGame = new Chess(fen);
  const maxPly = mainLine?.history().length ?? 0;

  const evalLabel =
    evalMate !== null
      ? `M${evalMate > 0 ? "" : "-"}${Math.abs(evalMate)}`
      : (evalCp / 100).toFixed(2);

  const whiteBar = Math.max(5, Math.min(95, 50 + Math.max(-5, Math.min(5, evalCp / 100)) * 8));

  const suggestBest = async () => {
    if (!engineRef.current || busy) return;
    setBusy(true);
    const uci = await engineRef.current.getBestMove(fen, 18);
    setBusy(false);
    if (uci.length < 4) return;
    const from = uci.slice(0, 2) as Square;
    const to = uci.slice(2, 4) as Square;
    const promotion = uci.length > 4 ? uci[4] : undefined;
    const g = new Chess(fen);
    const m = g.move({ from, to, promotion: promotion as "q" | "r" | "b" | "n" | undefined });
    if (m) {
      playMoveSound(m, g.isCheck());
      setFen(g.fen());
    }
  };

  const onSquareClick = (sq: Square) => {
    const piece = displayGame.get(sq);
    if (selected) {
      if (targets.includes(sq)) {
        const g = new Chess(fen);
        const moving = g.get(selected);
        const promo =
          moving?.type === "p" && (sq[1] === "8" || sq[1] === "1") ? "q" : undefined;
        const m = g.move({ from: selected, to: sq, promotion: promo });
        if (m) {
          playMoveSound(m, g.isCheck());
          setFen(g.fen());
        }
        setSelected(null);
        setTargets([]);
        return;
      }
    }
    if (piece) {
      setSelected(sq);
      setTargets(displayGame.moves({ square: sq, verbose: true }).map((x) => x.to as Square));
    } else {
      setSelected(null);
      setTargets([]);
    }
  };

  return (
    <div className="min-h-screen bg-background">
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
            Game <span className="text-gradient-brand">Analysis</span>
          </h1>
          <span className="ml-auto text-xs text-muted-foreground border border-border rounded-full px-3 py-1">
            {STOCKFISH_VERSION_LABEL}
          </span>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-6xl grid lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <label className="font-body text-sm text-muted-foreground">Philosopher coach</label>
          <select
            value={coachId}
            onChange={(e) => setCoachId(e.target.value as CoachId)}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground font-body mb-4"
          >
            <option value="none">Off</option>
            {(Object.keys(COACHES) as (keyof typeof COACHES)[]).map((id) => (
              <option key={id} value={id}>
                {COACHES[id].name} - {COACHES[id].epithet}
              </option>
            ))}
          </select>

          <label className="font-body text-sm text-muted-foreground">Paste PGN</label>
          <Textarea
            value={pgnInput}
            onChange={(e) => setPgnInput(e.target.value)}
            className="min-h-[200px] font-mono text-xs"
            placeholder="[Event &quot;...&quot;]&#10;1. e4 e5 2. Nf3 ..."
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={loadPgn} variant="default" className="bg-primary text-primary-foreground">
              Load game
            </Button>
            <Button onClick={suggestBest} disabled={!engineReady || busy} variant="outline">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              Best move (analysis board)
            </Button>
          </div>
          {error && <p className="text-sm text-destructive font-body">{error}</p>}

          <div className="rounded-lg border border-border bg-card p-4 space-y-2">
            <p className="font-display text-sm font-semibold">Replay loaded game</p>
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                disabled={plyIndex <= 0}
                onClick={() => positionAt(Math.max(0, plyIndex - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-mono text-xs text-muted-foreground flex-1 text-center">
                Move {plyIndex} / {maxPly}
              </span>
              <Button
                size="icon"
                variant="outline"
                disabled={plyIndex >= maxPly}
                onClick={() => positionAt(Math.min(maxPly, plyIndex + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground font-body">
              After loading, stepping updates the analysis position. You can also drag pieces on the board
              to explore variations (does not modify the saved PGN line).
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="flex w-full max-w-[420px] gap-2">
            <div className="w-5 rounded-md border border-border bg-muted flex flex-col-reverse overflow-hidden">
              <div className="bg-ivory transition-all duration-300" style={{ height: `${whiteBar}%` }} />
            </div>
            <div className="flex-1 grid grid-cols-8 grid-rows-8 aspect-square rounded-lg overflow-hidden border border-border shadow-elevated">
              {Array.from({ length: 64 }, (_, i) => {
                const row = Math.floor(i / 8);
                const col = i % 8;
                const square = `${String.fromCharCode(97 + col)}${8 - row}` as Square;
                const piece = displayGame.get(square);
                const isDark = (row + col) % 2 === 1;
                const sel = selected === square;
                const t = targets.includes(square);
                return (
                  <button
                    key={square}
                    type="button"
                    onClick={() => onSquareClick(square)}
                    className={`relative flex items-center justify-center p-0 border-0 ${
                      isDark ? "bg-chess-dark" : "bg-chess-light"
                    } ${sel ? "ring-2 ring-foreground/45 ring-inset z-10" : ""}`}
                  >
                    {t && (
                      <span className="absolute z-20 w-3 h-3 rounded-full bg-foreground/25 pointer-events-none" />
                    )}
                    {piece && (
                      <img
                        src={PIECE_URLS[piece.color][piece.type]}
                        alt=""
                        className="w-[82%] h-[82%] object-contain pointer-events-none"
                        draggable={false}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="w-full max-w-[420px] rounded-lg border border-border bg-card p-4 font-body text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Eval (White)</span>
              <span className="font-mono font-semibold">{evalLabel}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Depth</span>
              <span>{depth}</span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Principal variation</p>
              <p className="font-mono text-xs break-all leading-relaxed">{pvLine || "-"}</p>
            </div>
            {coachId !== "none" && coachMsg && (
              <div className="pt-3 mt-3 border-t border-border">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  {COACHES[coachId].name}
                </p>
                <p className="text-sm text-foreground/90 leading-relaxed font-body">{coachMsg}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analyze;
