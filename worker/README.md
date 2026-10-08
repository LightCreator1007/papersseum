# papersseum-worker

Claims jobs from the Supabase queue, validates uploads, plays matches, uploads
replays and reports ratings. See `supabase/migrations/*_worker_api.sql` for the
database functions it calls.

Uploaded bots run in the papersseum sandbox: one locked-down Docker container
per bot (no network, read-only, 512 MB, 1 CPU). House bots run in-process.

## Run locally

Start Supabase from the repo root (`supabase start`), then create `worker/.env`:

```
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SECRET_KEY=<Secret key from `supabase status`>
WORKER_ID=my-laptop
```

Build the sandbox image from the repo root (rebuild it whenever the library
changes; the worker refuses to start if the image's engine differs from its own):

```bash
uv build --wheel --package papersseum && docker build -f docker/Dockerfile -t papersseum-sandbox .
```

No Docker? Add these two lines to `.env` to run uploaded bots as plain child
processes instead. That is **not** a sandbox: only do it on your own machine,
never on a worker connected to prod. Without the second line the worker
refuses to start.

```
SANDBOX_BACKEND=subprocess
PAPERSSEUM_UNSAFE_LOCAL=1
```

Other settings: `SANDBOX_IMAGE` (default `papersseum-sandbox`), `DOCKER` (the
docker binary, default `docker`).

If the worker itself runs in a container, give it the Docker socket and set
`TMPDIR` to a directory mounted at the same path on the host: the sandbox mounts
each bot's temp folder into its container by path.

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

No database or Docker needed; storage and the database are faked, and bots
run with the subprocess backend.
