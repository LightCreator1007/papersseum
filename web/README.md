# Papersseum web

The website: leaderboard, matches, bot pages, uploads and Google sign-in.
Design: `specs/2026-10-13-web-app-design.md`.

## Run locally

1. Start Supabase from the repo root: `supabase start`.
2. Google sign-in (once):
   - In Google Cloud Console create an OAuth consent screen (External, testing
     mode; add your test accounts as test users) and a **Web application**
     OAuth client with these authorised redirect URIs:
     `http://127.0.0.1:54321/auth/v1/callback` and
     `http://localhost:54321/auth/v1/callback`.
   - Put the client's values in `supabase/.env` (git-ignored):
     ```
     SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=...
     SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=...
     ```
   - Restart Supabase: `supabase stop && supabase start`.
3. `web/.env.local` needs `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` from
   `supabase status`. The secret key is used only by the upload code.
4. `npm install && npm run dev`, then open http://127.0.0.1:3000.

Use one host in the browser for the whole sign-in, either `127.0.0.1` or
`localhost`, not both: the session cookie is per host, so signing in on one and
then opening the other looks signed out. Supabase's site URL is `127.0.0.1`, so
that is the one to use. The dev server accepts it through `allowedDevOrigins`
in `next.config.ts`.

For data to look at, seed players and run a worker as described in
`worker/README.md`. Uploads need the worker running: it checks each upload, so
without it a new version stays on "Checking…" and never becomes Active or
Rejected.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm test` | Unit tests |
| `npm run test:int` | Upload tests against local Supabase (creates and deletes test users) |
| `npm run typecheck` | Generates route types, then `tsc` |
| `npm run lint` | ESLint |
| `npm run gen:types` | Regenerates `lib/database.types.ts` after a migration |
