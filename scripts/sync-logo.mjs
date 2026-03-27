import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "src", "assets", "platochess-logo.png");
const dest = path.join(root, "public", "logo.png");

if (!fs.existsSync(src)) {
  console.warn("[sync-logo] missing", src);
  process.exit(0);
}
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log("[sync-logo] public/logo.png");
