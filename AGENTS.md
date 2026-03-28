# AGENTS.md

## Cursor Cloud specific instructions

### Overview

PlatoChess Studio is a React + TypeScript chess training SPA built with Vite. It runs a single local process (the Vite dev server on port 8080). Supabase (auth/db) is consumed as a hosted cloud service; Stockfish runs client-side via WASM; Stripe and Sentry are optional.

### Running the dev server

```bash
npm run dev          # starts Vite on http://127.0.0.1:8080
```

### Lint / Test / Build

```bash
npm run lint         # ESLint (flat config)
npm test             # Vitest unit tests
npm run build        # production build
npm run test:e2e     # Playwright E2E (auto-starts dev server; needs `npx playwright install --with-deps chromium` first)
```

### Non-obvious notes

- The `postinstall` script copies Stockfish WASM binaries from `node_modules/stockfish/bin/` into `public/stockfish/`. If the chess engine fails to load in the browser, verify those files exist after `npm ci`.
- The project uses `npm` (lockfile: `package-lock.json`). CI pins Node 20, but Node 22 also works.
- Supabase credentials are committed in `.env` (public anon key); no extra secrets are needed for basic local dev.
- Playwright E2E tests require Chromium to be installed (`npx playwright install --with-deps chromium`). The test config auto-starts the dev server if not already running.
- The Vite dev server binds to `0.0.0.0:8080` (`host: true` in `vite.config.ts`).
