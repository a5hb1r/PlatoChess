# AGENTS.md

## Project Overview

- Frontend: Vite + React + TypeScript.
- UI: Tailwind + shadcn/ui + Radix primitives.
- Tests: Vitest (unit/integration) and Playwright (E2E smoke).
- Primary app output: `dist/`.

## Environment & Setup

- Use Node.js with npm (lockfiles are present).
- Install dependencies from repo root:
  - `npm install`
- Postinstall scripts copy static runtime assets (Stockfish/logo). Do not skip install scripts unless debugging setup issues.

## Common Commands

Run from repo root:

- Dev server: `npm run dev`
- Production build: `npm run build`
- Lint: `npm run lint`
- Unit tests: `npm test`
- E2E tests: `npm run test:e2e`
- Headed E2E tests (local debugging): `npm run test:e2e:headed`

## Code Guidelines

- Prefer small, focused changes over broad refactors.
- Keep TypeScript strictness intact; avoid `any` unless unavoidable and documented.
- Reuse existing UI patterns/components before adding new abstractions.
- Avoid touching generated/binary assets unless the task explicitly requires it.
- Keep environment-specific values in env vars (never hardcode secrets).

## Testing Expectations

- For logic changes: run at least relevant unit tests and lint.
- For UI behavior changes: run relevant E2E tests and perform a manual smoke check.
- For release-sensitive work, use the checklist in `LAUNCH_CHECKLIST.md` and commands in `RELEASE.md`.
- Prefer targeted test runs first; expand scope if failures indicate cross-cutting impact.

## Cursor Cloud specific instructions

- Before coding, identify success criteria and how to validate them end-to-end.
- For non-trivial UI changes, record a short demo video showing the behavior working.
- Include concise evidence in summaries (exact commands run + pass/fail result).
- If local environment issues block validation, document attempted remediations and remaining blocker clearly.

## PR / Change Hygiene

- Keep commits logically grouped with clear messages.
- Include a short summary of changed files and behavior impact in PR description.
- Highlight any known risks, follow-ups, or intentionally deferred work.
