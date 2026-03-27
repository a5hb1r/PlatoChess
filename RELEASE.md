# Free Release Guide

Use this flow to ship safely without paid CI.

## 1) Local pre-release checks

Run from project root:

```powershell
npm install
npm run lint
npm test
npm run build
npm run test:e2e
```

If all commands pass, your build is release-ready.

## 2) Push code

```powershell
git add .
git commit -m "release: update app"
git push origin main
```

## 3) Deploy (free-tier options)

- Vercel
- Netlify
- Cloudflare Pages

For Vite apps, build settings are usually:

- Build command: `npm run build`
- Output directory: `dist`

## 4) Environment variables

Set these in your hosting dashboard:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_STRIPE_PUBLISHABLE_KEY` (if needed)
- `VITE_SENTRY_DSN` (optional; leave empty to disable Sentry)

## 5) Post-deploy smoke test

Manually verify:

- Home page loads
- Play page loads
- Game vs Stockfish starts
- Puzzles page works
- Analyze page works
- Privacy and Terms pages open

## 6) If something fails

Rollback to the last good commit in your hosting provider, then fix locally and redeploy.
