# papersseum-worker

Claims jobs from the Supabase queue, validates uploads, plays matches, uploads
replays and reports ratings. See `supabase/migrations/*_worker_api.sql` for the
database functions it calls.

> **`runner.py` is a stand-in.** It runs agent code inside the worker process
> with no sandbox and no time limits. Use it only locally with your own bots.
> The Docker sandbox replaces `validate()` and `play()` in that file; nothing
> else changes.

## Run locally

Start Supabase from the repo root (`supabase start`), then create `worker/.env`:

```
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SECRET_KEY=<Secret key from `supabase status`>
WORKER_ID=my-laptop
```

Start the worker (from `worker/`):

```bash
uv run --env-file .env papersseum-worker
```

Create test players with uploads (from the repo root):

```bash
uv run --project worker --env-file worker/.env python worker/scripts/seed_local.py
```

Start a round without waiting for the 15-minute schedule, in the local
dashboard's SQL editor:

```sql
select internal.schedule_round();
```

Ctrl+C finishes the current job, then stops. `supabase db reset` wipes local
data so the seed script can run again.

## Tests

```bash
uv run pytest tests
```

No database needed; storage and the database are faked.
