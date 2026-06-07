# Israel's Chess App (PlatoChess)

A modern chess web app built with React + Vite + TypeScript.  
The app includes play modes, puzzles, analysis tools, auth, and production-focused deployment/testing workflows.

## Core features

- Play games against Stockfish
- Solve tactical puzzles
- Analyze games and positions
- Browse openings
- User authentication and dashboard/settings flows
- Privacy and Terms pages for launch readiness

## Tech stack

- Frontend: React 18, TypeScript, Vite
- UI: Tailwind CSS + shadcn/ui + Radix UI
- Data/Auth: Supabase
- Payments: Stripe
- Monitoring: Sentry
- Testing: Vitest + Playwright

## Prerequisites

- Node.js 20+ (recommended)
- npm 10+ (recommended)

## Local development

1. Install dependencies:
   - `npm install`
2. Create your environment file:
   - `cp .env.example .env`
3. Fill required values in `.env` (see `.env.example`).
4. Start the dev server:
   - `npm run dev`

## Environment variables

Required for most app flows:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Optional / feature-specific:

- `VITE_SENTRY_DSN`
- `VITE_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`

## Scripts

- `npm run dev` — start local development server
- `npm run build` — production build
- `npm run preview` — preview production build locally
- `npm run lint` — run ESLint
- `npm test` — run Vitest once
- `npm run test:watch` — run Vitest in watch mode
- `npm run test:e2e` — run Playwright end-to-end tests
- `npm run test:e2e:headed` — run Playwright with visible browser

## Quality and release workflow

- Launch checklist: `LAUNCH_CHECKLIST.md`
- Release playbook: `RELEASE.md`

Recommended pre-release command sequence:

1. `npm run lint`
2. `npm test`
3. `npm run build`
4. `npm run test:e2e`

## Project structure (high level)

- `src/pages` — route-level page components
- `src/components` — reusable UI and feature components
- `src/contexts` — app-wide providers (auth/theme)
- `src/lib` — shared utilities and integrations
- `e2e` — Playwright tests
- `public` — static assets (including Stockfish binary assets)
