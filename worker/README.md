# papersseum-worker

Claims jobs from the Supabase queue, validates uploads, plays matches, uploads
replays and reports ratings. See `supabase/migrations/*_worker_api.sql` for the
database functions it calls.

> **`runner.py` is a stand-in.** It runs agent code inside the worker process
> with no sandbox and no time limits. Use it only locally with your own bots.
> The Docker sandbox replaces `validate()` and `play()` in that file; nothing
> else changes. Until then it fails closed: see `PAPERSSEUM_UNSAFE_LOCAL` below.

## Run locally

Start Supabase from the repo root (`supabase start`), then create `worker/.env`:

```
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SECRET_KEY=<Secret key from `supabase status`>
WORKER_ID=my-laptop
PAPERSSEUM_UNSAFE_LOCAL=1
```

`PAPERSSEUM_UNSAFE_LOCAL=1` allows the stand-in runner to execute uploaded bots.
Without it the worker refuses to start. Never set it on a worker connected to prod.

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
