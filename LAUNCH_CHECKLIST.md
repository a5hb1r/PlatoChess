# PlatoChess Launch Checklist

## 0) Launch bar (definition of done)

- [ ] App is stable in production for core flows (play, puzzle, analyze, auth)
- [ ] Observability is in place (errors + uptime + analytics)
- [ ] Legal, policy, and trust pages are published
- [ ] Automated checks gate deployment

## 1) Must-have before public launch

- [ ] **Auth + data safety**
  - [ ] Verify all auth flows in production
  - [ ] Audit Supabase RLS policies and table access
  - [ ] Add graceful API/network failure states
- [ ] **Error monitoring**
  - [x] Frontend error reporting (Sentry or equivalent)
  - [ ] Source maps uploaded for production debugging
  - [ ] Alert route for critical failures
- [x] **Code quality gate**
  - [x] `npm run lint` passes
  - [x] `npm test` passes
  - [x] `npm run build` passes
- [ ] **E2E smoke tests**
  - [x] Standard Playwright config (no vendor lock)
  - [x] Smoke test file scaffolding
  - [x] Run on CI for every PR/deploy
- [ ] **Legal pages**
  - [x] Privacy Policy
  - [x] Terms of Service
  - [ ] Contact / support details

## 2) Product readiness

- [x] Route-level lazy loading for heavier pages
- [ ] Asset performance pass (images/chunks/cache headers)
- [ ] SEO metadata + OpenGraph + sitemap
- [ ] Accessibility audit (keyboard, contrast, semantics)
- [ ] First-session onboarding hints/tooltips

## 3) Growth + operations

- [ ] Product analytics events and conversion funnel
- [ ] Uptime checks for frontend and backend services
- [ ] Rollback plan and deployment runbook
- [ ] Changelog and release process

## 4) Current implementation started in this pass

- [x] Add launch checklist file
- [x] Begin performance optimization (lazy routes)
- [x] Begin launch test harness (Playwright smoke suite)
- [x] Wire smoke suite into CI pipeline
