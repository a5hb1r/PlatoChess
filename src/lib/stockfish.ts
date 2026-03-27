// Stockfish 18 - prefers full NNUE single-threaded build (strong; no COEP/COOP).
// Falls back to lite if the full WASM fails to load.

export type StockfishCallback = (info: StockfishInfo) => void;

export interface StockfishInfo {
  depth?: number;
  score?: number;
  mate?: number;
  bestMove?: string;
  pv?: string;
  pvLine?: string;
}

const ENGINE_FULL = { script: "/stockfish/stockfish-18-single.js", label: "Stockfish 18 (NNUE)" };
const ENGINE_LITE = {
  script: "/stockfish/stockfish-18-lite-single.js",
  label: "Stockfish 18 (lite NNUE)",
};

/** Classic worker from /public so `location` is real HTTP URL - blob+importScripts breaks wasm locateFile. */
function resolvePublicWorkerUrl(scriptPath: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const root = new URL(base, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  const rel = scriptPath.startsWith("/") ? scriptPath.slice(1) : scriptPath;
  return new URL(rel, root).href;
}

export function formatEngineInitError(e: unknown): string {
  if (e instanceof ErrorEvent) {
    const parts = [e.message, e.filename && `at ${e.filename}:${e.lineno}`].filter(Boolean);
    return parts.join(" ") || "Worker error";
  }
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Unknown error";
}

function parseWorkerPayload(data: unknown): string[] {
  if (data == null) return [];
  if (typeof data === "string") return data.split(/\r?\n/).filter(Boolean);
  if (typeof data === "object" && data !== null && "data" in data && typeof (data as { data: unknown }).data === "string") {
    return parseWorkerPayload((data as { data: string }).data);
  }
  return [String(data)];
}

export class StockfishEngine {
  private worker: Worker | null = null;
  private onInfo: StockfishCallback | null = null;
  private bestMoveResolver: ((m: string) => void) | null = null;
  private goPurpose: "idle" | "eval" | "bestmove" = "idle";
  /** Resolves when a `bestmove` line completes an in-flight `stop` flush (discard partial move). */
  private flushWait: (() => void) | null = null;
  private label = ENGINE_LITE.label;

  getLabel() {
    return this.label;
  }

  async init() {
    if (this.worker) return;

    const tryScripts = [ENGINE_FULL.script, ENGINE_LITE.script];
    let lastErr: unknown;

    for (const scriptPath of tryScripts) {
      try {
        await this.spawnWorker(scriptPath);
        this.label = scriptPath.includes("lite") ? ENGINE_LITE.label : ENGINE_FULL.label;
        return;
      } catch (e) {
        lastErr = e;
        this.destroy();
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(formatEngineInitError(lastErr));
  }

  private spawnWorker(scriptPath: string): Promise<void> {
    const workerHref = resolvePublicWorkerUrl(scriptPath);
    this.worker = new Worker(workerHref, { type: "classic" });

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Stockfish failed to start (${scriptPath}). Run npm install and copy script (postinstall).`));
      }, 45000);

      let sawUciOk = false;
      let initDone = false;

      this.worker!.onmessage = (e) => {
        for (const line of parseWorkerPayload(e.data)) {
          if (!initDone) {
            if (line.includes("uciok")) {
              sawUciOk = true;
              this.worker!.postMessage("isready");
            }
            if (sawUciOk && line.includes("readyok")) {
              clearTimeout(timeout);
              initDone = true;
              resolve();
            }
          }
          this.handleLine(line);
        }
      };

      this.worker!.onerror = (ev) => {
        clearTimeout(timeout);
        const msg = formatEngineInitError(ev);
        reject(new Error(`${msg} (${workerHref})`));
      };

      this.worker!.postMessage("uci");
    });
  }

  /** Wait until any in-flight `go` completes with `bestmove` (e.g. after `stop`). */
  private flushStop(): Promise<void> {
    if (!this.worker) return Promise.resolve();
    if (this.goPurpose === "idle") return Promise.resolve();
    return new Promise((resolve) => {
      this.flushWait = () => resolve();
      this.worker!.postMessage("stop");
    });
  }

  private handleLine(line: string) {
    if (line.startsWith("info") && line.includes("score")) {
      const info: StockfishInfo = {};

      const depthMatch = line.match(/depth (\d+)/);
      if (depthMatch) info.depth = parseInt(depthMatch[1], 10);

      const cpMatch = line.match(/score cp (-?\d+)/);
      if (cpMatch) info.score = parseInt(cpMatch[1], 10);

      const mateMatch = line.match(/score mate (-?\d+)/);
      if (mateMatch) info.mate = parseInt(mateMatch[1], 10);

      const pvMatch = line.match(/\bpv (.+)/);
      if (pvMatch) {
        const full = pvMatch[1].trim();
        info.pvLine = full;
        info.pv = full.split(/\s+/)[0];
      }

      if (this.onInfo && (info.score !== undefined || info.mate !== undefined)) {
        this.onInfo(info);
      }
    }

    if (line.startsWith("bestmove")) {
      const parts = line.split(/\s+/);
      const move = parts[1];

      if (this.flushWait) {
        if (this.goPurpose === "bestmove" && this.bestMoveResolver) {
          const cancel = this.bestMoveResolver;
          this.bestMoveResolver = null;
          cancel("");
        }
        this.goPurpose = "idle";
        const done = this.flushWait;
        this.flushWait = null;
        done();
        return;
      }

      const purpose = this.goPurpose;
      this.goPurpose = "idle";

      if (purpose === "bestmove" && this.bestMoveResolver) {
        const res = this.bestMoveResolver;
        this.bestMoveResolver = null;
        if (move && move !== "(none)") {
          res(move);
        } else {
          res("");
        }
      }
    }
  }

  setSkillLevel(level: number) {
    if (!this.worker) return;
    this.worker.postMessage(`setoption name Skill Level value ${level}`);
  }

  evaluate(fen: string, depth: number = 18, callback: StockfishCallback) {
    if (!this.worker) return;
    void this.flushStop().then(() => {
      if (!this.worker) return;
      this.goPurpose = "eval";
      this.onInfo = callback;
      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(`go depth ${depth}`);
    });
  }

  /**
   * One-shot eval for a single FEN (e.g. move-quality). Resolves when `targetDepth` is reached,
   * or on timeout with the last score seen. Stops the search afterward.
   */
  async probeEval(
    fen: string,
    targetDepth: number,
    timeoutMs = 4500
  ): Promise<{ score?: number; mate?: number }> {
    if (!this.worker) return {};
    await this.flushStop();
    if (!this.worker) return {};

    return new Promise((resolve) => {
      const latest: { score?: number; mate?: number } = {};
      let finished = false;

      const done = () => {
        if (finished) return;
        finished = true;
        window.clearTimeout(t);
        this.onInfo = null;
        this.worker?.postMessage("stop");
        resolve(latest);
      };

      const t = window.setTimeout(() => done(), timeoutMs);

      this.goPurpose = "eval";
      this.onInfo = (info: StockfishInfo) => {
        if (info.mate !== undefined) latest.mate = info.mate;
        if (info.score !== undefined) latest.score = info.score;
        if (
          info.depth !== undefined &&
          info.depth >= targetDepth &&
          (latest.score !== undefined || latest.mate !== undefined)
        ) {
          done();
        }
      };

      this.worker!.postMessage(`position fen ${fen}`);
      this.worker!.postMessage(`go depth ${targetDepth}`);
    });
  }

  async getBestMove(fen: string, depth: number = 12): Promise<string> {
    if (!this.worker) return "";

    await this.flushStop();

    if (this.bestMoveResolver) {
      this.bestMoveResolver("");
      this.bestMoveResolver = null;
    }

    return new Promise((resolve) => {
      if (!this.worker) {
        resolve("");
        return;
      }

      this.goPurpose = "bestmove";
      this.bestMoveResolver = resolve;
      this.onInfo = null;

      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(`go depth ${depth}`);

      window.setTimeout(() => {
        if (this.bestMoveResolver === resolve) {
          this.bestMoveResolver = null;
          this.goPurpose = "idle";
          resolve("");
        }
      }, 60000);
    });
  }

  stop() {
    this.worker?.postMessage("stop");
  }

  destroy() {
    if (this.flushWait) {
      const fw = this.flushWait;
      this.flushWait = null;
      fw();
    }
    if (this.bestMoveResolver) {
      this.bestMoveResolver("");
      this.bestMoveResolver = null;
    }
    if (this.worker) {
      try {
        this.worker.postMessage("quit");
      } catch {
        /* ignore */
      }
      this.worker.terminate();
      this.worker = null;
    }
    this.goPurpose = "idle";
    this.bestMoveResolver = null;
    this.onInfo = null;
  }
}

export const STOCKFISH_VERSION_LABEL = "Stockfish 18";
