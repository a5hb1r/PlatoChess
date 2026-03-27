import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const bin = path.join(root, "node_modules", "stockfish", "bin");
const outDir = path.join(root, "public", "stockfish");

/** Full single-thread NNUE (~113MB wasm) + lite fallback (~7MB). */
const files = [
  "stockfish-18-single.js",
  "stockfish-18-single.wasm",
  "stockfish-18-lite-single.js",
  "stockfish-18-lite-single.wasm",
];

if (!fs.existsSync(bin)) {
  console.warn("[copy-stockfish] stockfish bin not found — run npm install");
  process.exit(0);
}

fs.mkdirSync(outDir, { recursive: true });
for (const f of files) {
  const src = path.join(bin, f);
  const dest = path.join(outDir, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log("[copy-stockfish]", f);
  } else {
    console.warn("[copy-stockfish] missing", src);
  }
}
