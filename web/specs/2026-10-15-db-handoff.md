# Handoff for the database and infra owner (2026-10-15)

The web app and worker for the redesign are built against the contracts in the appendix below. The database side isn't there yet: none of A1, A4 to A12 are in `supabase/migrations`.

The SQL drafts for every ask are in the appendix at the end. Treat their names, arguments, return shapes and error codes as the contract; rewrite the bodies in your own style. A7 and A12 were corrected on 2026-10-15 against the real schema.

## How the app behaves until your side ships

Every web call to a function that doesn't exist yet goes through `callRpc` (`web/lib/server/rpc.ts`). It maps `PGRST202` and `42883` to the message "This isn't switched on yet" and the page keeps working. So asks can ship in any order, and nothing breaks in between. Three exceptions:

| Call | What happens if it's missing | Who fixes it |
| --- | --- | --- |
| `resolve_bot_name` (A6) | Old bot links 404, which is also the right behaviour with no aliases | Nobody, it's fine |
| `internal.notify_validation`, `internal.notify_match` (A10) | Worker logs a warning once and carries on | Nobody, it's fine |
| `internal.record_final_standings` (A11) | `papersseum-final --write` crashes with a traceback | Us: the worker will say "not deployed" and exit non-zero |

## Fix these before writing the SQL

An inventory of every table, function and column the code touches turned up places where the drafts and the real schema or the web code disagree.

1. **`returns table` comes back as an array.** `rename_bot` and `set_active_submission` are drafted as `returns table (...)`, so supabase-js returns `[{...}]`. The web reads `r.data.name` and `r.data.status` as if it were one object. **Keep `returns table`;** we're changing the web to read the first row, so you don't need to change anything.
2. **A7 `set_active_submission` only set `bots.active_submission_id`.** The real activation in `internal.complete_validation` also marks the old active version `superseded`, sets the new one `active`, and sets `bots.active_version` and `active_since`. The appendix now does all of that. Without it the leaderboard would show the old version number.
3. **A12 `admin_requeue_job` used `jobs.worker`.** The column is `worker_id`. It also left the submission alone, but `internal.mark_job_failed` marks a submission `rejected` with the prefix "Validation could not run: " when its validation job fails. The appendix now sets that submission back to `pending` and clears `finished_at` on the job and the match.

Two privacy problems in the drafts:

4. **A10 puts `email_opt_in` on `profiles`, and `profiles` is publicly readable** (public-read policy plus a table-level anon grant). Anyone could list who opted in to email. Either put it in a new owner-only table (`notification_settings (user_id pk, email_opt_in)`), or revoke the column from `anon` and `authenticated` and read it through `set_email_opt_in` / a `my_settings()` function. The web only calls the functions, so either works for us.
5. **A4 puts the bot's exception text in `match_players.error`, and `match_players` is anon-readable.** A traceback can include a bot's source lines. Keep `status` public. Keep `error` owner-only: revoke the column from `anon` and `authenticated`, and expose it through `my_match_errors(p_match bigint)`, which returns rows only for the caller's bot. The web will show the reason to the owner and "crashed" to everyone else.

One copy dependency: `/privacy` (written upstream in #25) says "we don't email you". That's true until A10 ships with `RESEND_API_KEY` set. The same change that switches email on has to update that paragraph, or the privacy page becomes wrong.

## Asks, in the order they unlock the most

| Ask | What the user gets | Web or worker side | Priority |
| --- | --- | --- | --- |
| A13 env vars | Status page, organiser panel, email | Code reads them today | Now |
| A4 seat status and error | "Your bot crashed on turn 212: ..." on the match page; Diagnostics later | Worker already sends both fields; `complete_match` drops them | P0 |
| A5 platform faults skip the cooldown | Nobody waits out the 10-minute cooldown for our outage | The "Validation could not run: " prefix already marks these rows | P0 |
| A6 rename with aliases | One rename per season, old links keep working | Rename form on `/welcome` and `/me/settings` is built | P0 |
| A7 make an older version active | Roll back to v3 from `/me/versions` | Button is built | P1 |
| A8 season dates and auto freeze | Countdown, "Closing soon", T-24h banner, the Season page | `lib/season-phase.ts` is written; nothing renders it until dates exist | P1 |
| A11 final round and standings | Final results on the Season page | Worker can rank a final (`worker/.../final.py`); nothing starts one | P1 |
| A1 bot appearance | Bot Forge saves to the account, not just the browser | We add `appearance` to the bot selects when you ship it | P1 |
| A10 notifications and opt-in | Inbox and email | Inbox, settings toggle and worker sender are built | P2 |
| A12 requeue a failed job | Retry in the organiser panel | The organiser panel at `/admin` is built; Retry says "not switched on yet" until this ships | P2 |
| A9 record skipped rounds | Exact skip reason instead of inferred | Web infers today | P2 |

## New asks

Numbered after the appendix asks. Short on purpose; tell us the names you pick.

**A14. Ban reason.** `bots.ban_reason text`, set together with `banned`. The organiser panel will send a reason with every ban. Owner-only, like A4's `error`: the owner sees why on `/me`, the public sees "Banned". If you'd rather keep a history, a `bot_bans (bot_id, banned_at, reason, by_admin)` table works and is better for disputes.

**A15. Match reports.** The worker can compute per-seat kills, deaths and a coverage curve from a replay (`papersseum report`). Storing them lets the match page show them without re-running the replay, and is what the board's Diagnostics screen and weekly digest need. Proposed: `match_reports (match_id bigint, slot smallint, kills int, deaths int, coverage real[], computed_at timestamptz, primary key (match_id, slot))`, public read, written by the worker inside `complete_match` or right after it.

**A16. Notifications on Realtime.** The publication carries `bots`, `submissions` and `matches` only. Adding `notifications` lets the inbox count update without a refresh. Optional: the inbox polls for now.

**A17. Sign-up domain: nothing to do.** Already enforced: `handle_new_user` reads `season.allowed_email_domain` (`iiitdmj.ac.in`) and allows an exact match only, so `cs.iiitdmj.ac.in` and personal Gmail are refused. The sign-in page already turns that refusal into "Papersseum is only open to @iiitdmj.ac.in Google accounts." (`features/auth/auth-errors.ts` matches the exception text). Listed only so nobody re-opens it.

**A18. A way to start the final.** Doc 10 A11 mentions it; restating because nothing can start a final today. Something like `internal.schedule_final_round(p_matches_per_bot int)`, run by an organiser, reusing `schedule_round`'s lobby code, on an on-demand VM, not spot.

**A19 (decision, not SQL). Bigger bots.** Weights already have a path: `papersseum pack` embeds them in the single `.py` as `WEIGHTS = "..."`, and uploads cap at 1 MB (`MAX_BYTES`, the same limit in the web and in `papersseum/security/static_check.py`). A float16 network that fits is fine. If you want bigger models this season, raise both limits and the bucket's `file_size_limit` together; otherwise nothing to do, and we'll say "1 MB including weights" more plainly in the docs.

## Edge cases that wait on the database

We audited 165 edge cases and states from the FigJam board. Everything the web or worker can handle with today's schema is built in the redesign PRs. These are the ones waiting on you, grouped by ask.

| Ask | Cases |
| --- | --- |
| A4 | Crashed seat shows why; owner sees the error, others see "crashed"; Diagnostics screen; the "my bot keeps crashing" problem |
| A5 | "Could not run" means retry with no cooldown; worker outage during a check |
| A6 | Rename away from a roll-number name or an `_a3f9` suffix; old links still resolve; email local-part collisions |
| A7 | Make active, roll back after a bad upload, re-check when the engine changed |
| A8 | Draft, Closing soon, Archived phases; T-24h banner; freeze at close without an organiser |
| A8 + A11 | Final round, final standings, final running long, outage during the final |
| A9 | Exact reason a bot skipped a round |
| A10 | Owner notified on verdict and first match, in the inbox and by email |
| A12 | Organiser Retry |
| A19 | Bots over 1 MB with packed weights |

## Environment variables

| Host | Required | Optional |
| --- | --- | --- |
| Web | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | `NEXT_PUBLIC_SITE_URL` (link previews; falls back to localhost, so set it in production) |
| Worker | `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | `WORKER_ID`, `AGENT_CACHE_DIR`, `SANDBOX_BACKEND`, `SANDBOX_IMAGE`, `DOCKER`, `RESEND_API_KEY`, `NOTIFY_FROM`, `SITE_URL` |

`PAPERSSEUM_UNSAFE_LOCAL=1` is for the subprocess sandbox on a laptop. It must never be set on the VM.

## Things we checked that you don't need to change

- The secret key is read only in server code. No client component imports `createAdminClient`, and there's no write path without an auth check.
- `/status` and `/api/status` are public and use the secret key, but they return counts only (queue length, workers alive, last heartbeat), never rows.
- `loadCheckProgress` reads `jobs` with the secret key and doesn't check ownership itself. It's only called with a submission id that came from the user's own RLS-filtered query. We're adding an ownership check anyway so it stays safe if someone calls it from somewhere else.
- The worker's 90-emails-a-day cap lives in memory, so a restart resets it. Fine for one worker. If you run several, move the counter into a table.

## How to check each ask once it ships

The dev login (`/dev/login?as=player`) uses fixtures, so test DB changes with a real Google account on the deployed preview.

| Ask | Do this | Expect |
| --- | --- | --- |
| A1 | Save a character in the Bot Forge, open the bot page in another browser | Same character |
| A4 | Upload a bot that raises on turn 1, open its next match | Owner sees the exception; signed out sees "crashed". The web reads these fields once you tell us A4 is live; it's a small change on our side. |
| A5 | Stop the worker mid-check, start it again | "Could not run" with no cooldown; upload works at once |
| A6 | Rename on `/me/settings`, open the old `/bots/<old>` link | Redirects to the new name; a second rename is refused (PS005) |
| A7 | On `/me/versions`, Make active on an older version | Leaderboard shows that version within a round |
| A8 | Set `closes_at` to tomorrow | "Closing soon" banner; uploads freeze at that time with nobody touching it |
| A10 | Opt in on `/me/settings`, upload | Inbox entry, and an email if `RESEND_API_KEY` is set |
| A11 | Start a final, run `papersseum-final --round <id> --write` | Standings on the Season page |
| A12 | Fail a job, press Retry in `/admin` | Job back in the queue; Retry on a non-failed job is refused (PS007) |

Regenerate `web/lib/supabase/database.types.ts` after each migration so the one untyped cast in `rpc.ts` can go.

---

## Appendix: SQL drafts for A1 to A13

The web and worker code already calls everything below. Until a function exists, the feature that uses it shows "Not switched on yet" instead of breaking, so these can ship in any order.

The SQL is a draft that shows the contract: names, arguments, return shapes and error codes. Rewrite the bodies in your own style, add pgTAP tests next to `supabase/tests/database/`, and keep the **names, arguments, return shapes and error codes** as written, or tell us what changed so we can update the callers.

New error codes continue the existing series (PS001 frozen, PS002 no bot, PS003 banned, PS004 cooldown):

| Code | Meaning |
|---|---|
| PS005 | Already renamed this season |
| PS006 | That version can't be made active (not yours, or never passed) |
| PS007 | Only failed jobs can be requeued |

After deploying, regenerate `web/lib/supabase/database.types.ts` (moved there by #22) so the one untyped cast in `web/lib/server/rpc.ts` can be removed.

### Summary

| # | Ask | Unlocks | Priority |
|---|---|---|---|
| A1 | `bots.appearance` + `set_bot_appearance` | Saving Bot Forge characters | P1 |
| A2 | ~~Public `worker_status` view~~ No longer needed: the web reads `workers` on the server with the secret key | n/a | dropped |
| A3 | `NEXT_PUBLIC_SITE_URL` on the web host | Absolute link-preview image URLs | P1 |
| A4 | `match_players.status`, `match_players.error`, read in `complete_match` | Crash reason per seat | P0 |
| A5 | Cooldown ignores platform-fault rejections | Not punishing people for our outages | P0 |
| A6 | `bot_name_aliases`, `rename_bot`, `resolve_bot_name` | Rename with old links still working | P0 |
| A7 | `set_active_submission` | Switching back to an older version | P1 |
| A8 | `season.opens_at`, `closes_at`, `final_at` + freeze at close | Season countdown and automatic freeze | P1 |
| A9 | Optional: record skipped rounds | Exact skip reasons (we infer them today) | P2 |
| A10 | Notifications table and functions, `profiles.email_opt_in` | Inbox and email | P2 |
| A11 | `final_standings` + `record_final_standings`, a way to start a final round | Final results | P1 |
| A12 | `admin_requeue_job` | Requeue button in the organiser panel | P2 |
| A13 | Env vars: `SUPABASE_SECRET_KEY` on the web host; `RESEND_API_KEY`, `NOTIFY_FROM`, `SITE_URL` on the worker VM | Status page, admin, email | P1 |

---

### A1. Bot appearance

```sql
alter table public.bots add column appearance jsonb
  check (appearance is null or (jsonb_typeof(appearance) = 'object' and octet_length(appearance::text) <= 512));

create function public.set_bot_appearance(p_appearance jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_appearance is not null and exists (
    select 1 from jsonb_object_keys(p_appearance) k
     where k not in ('head', 'eyes', 'antenna', 'mouth', 'pattern', 'signature')) then
    raise exception 'Unknown appearance part' using errcode = 'PS008';
  end if;
  update public.bots set appearance = p_appearance where owner_id = auth.uid();
  if not found then raise exception 'You have no bot' using errcode = 'PS002'; end if;
end $$;
revoke all on function public.set_bot_appearance(jsonb) from public, anon;
grant execute on function public.set_bot_appearance(jsonb) to authenticated;
```

Return `appearance` from the `leaderboard` view and wherever bots are selected for match seats and profiles. The key set matches `BotGenome` in `web/lib/character/genome.ts`; the web validates values before calling.

### A4. Seat status and error

The worker already sends `status` (`ok | reset_failed | crashed | unresponsive | too_slow`) and `error` (up to 300 characters) in each `p_players` element.

```sql
alter table public.match_players
  add column status text check (status in ('ok', 'reset_failed', 'crashed', 'unresponsive', 'too_slow')),
  add column error text check (char_length(error) <= 300);
```

In `internal.complete_match`, add `status text, error text` to the `jsonb_to_recordset(p_players) as x(...)` column list and write them. Old workers that don't send them leave the columns null.

### A5. Cooldown refund for platform faults

When validation can't run (sandbox down), the worker raises, and after 3 attempts `mark_job_failed` rejects the submission with an error starting `Validation could not run`. In `api_create_submission`, compute the cooldown from the latest submission **excluding** those:

```sql
-- inside api_create_submission, replacing the cooldown's max(created_at) source
select max(created_at) into v_last
  from public.submissions
 where bot_id = v_bot.id
   and not (status = 'rejected' and coalesce(error, '') like 'Validation could not run%');
```

Use whatever the error column on `submissions` is actually called.

### A6. Rename with aliases

```sql
create table public.bot_name_aliases (
  old_name   text primary key check (old_name ~ '^[a-z0-9_]{2,32}$'),
  bot_id     uuid not null references public.bots (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.bot_name_aliases enable row level security;
create policy "aliases are public" on public.bot_name_aliases for select using (true);

create function public.rename_bot(p_new_name text)
returns table (name text) language plpgsql security definer set search_path = '' as $$
declare v_bot public.bots;
begin
  select * into v_bot from public.bots where owner_id = auth.uid() for update;
  if not found then raise exception 'You have no bot' using errcode = 'PS002'; end if;
  if v_bot.banned then raise exception 'This bot is banned' using errcode = 'PS003'; end if;
  if p_new_name !~ '^[a-z0-9_]{2,32}$' then
    raise exception 'Invalid name' using errcode = 'PS009';
  end if;
  if exists (select 1 from public.bot_name_aliases a where a.bot_id = v_bot.id) then
    raise exception 'Already renamed this season' using errcode = 'PS005';
  end if;
  if exists (select 1 from public.bot_name_aliases a where a.old_name = p_new_name) then
    raise exception 'Name is reserved' using errcode = '23505';
  end if;
  insert into public.bot_name_aliases (old_name, bot_id) values (v_bot.name, v_bot.id);
  update public.bots set name = p_new_name where id = v_bot.id;  -- unique violation raises 23505
  return query select p_new_name;
end $$;

create function public.resolve_bot_name(p_name text)
returns text language sql stable security invoker set search_path = '' as $$
  select b.name from public.bot_name_aliases a join public.bots b on b.id = a.bot_id where a.old_name = p_name
$$;

grant execute on function public.rename_bot(text) to authenticated;
grant execute on function public.resolve_bot_name(text) to anon, authenticated;
```

"Once a season" is enforced by "one alias row per bot"; clear the table between seasons, or add a season column if you'd rather keep history. Old names stay reserved so a shared link never points at someone else's bot.

### A7. Make an older version active

```sql
create function public.set_active_submission(p_submission uuid)
returns table (status text) language plpgsql security definer set search_path = '' as $$
declare v_bot public.bots; v_sub public.submissions; v_hash text;
begin
  select * into v_bot from public.bots where owner_id = auth.uid() for update;
  if not found then raise exception 'You have no bot' using errcode = 'PS002'; end if;
  if v_bot.banned then raise exception 'This bot is banned' using errcode = 'PS003'; end if;
  select * into v_sub from public.submissions where id = p_submission and bot_id = v_bot.id;
  if not found or v_sub.status not in ('active', 'superseded') then   -- adjust to the enum's "passed" states
    raise exception 'That version can''t be made active' using errcode = 'PS006';
  end if;
  select engine_hash into v_hash from public.season limit 1;
  if v_hash is not null and v_sub.engine_hash is distinct from v_hash then
    -- Engine changed since it passed: re-check before it goes live.
    insert into public.jobs (kind, submission_id, priority) values ('validate', v_sub.id, 10);
    return query select 'revalidating'::text;
    return;
  end if;
  -- Same three writes complete_validation makes when a version passes.
  update public.submissions set status = 'superseded'
   where bot_id = v_bot.id and status = 'active' and id <> v_sub.id;
  update public.submissions set status = 'active' where id = v_sub.id;
  update public.bots
     set active_submission_id = v_sub.id, active_version = v_sub.version, active_since = now()
   where id = v_bot.id;
  return query select 'active'::text;
end $$;
grant execute on function public.set_active_submission(uuid) to authenticated;
```

Match the submission status values and the column that records which engine a submission passed on to what the schema actually has. If re-validation should also respect the upload cooldown, raise PS004 like `api_create_submission`.

### A8. Season dates and automatic freeze

```sql
alter table public.season
  add column opens_at timestamptz,
  add column closes_at timestamptz,
  add column final_at timestamptz,
  add constraint season_dates_order check (
    (opens_at is null or closes_at is null or opens_at < closes_at) and
    (closes_at is null or final_at is null or closes_at <= final_at));

create function internal.freeze_at_close() returns void language sql as $$
  update public.season set frozen = true where not frozen and closes_at is not null and now() >= closes_at
$$;
select cron.schedule('papersseum-freeze-at-close', '* * * * *', $$select internal.freeze_at_close()$$);
```

The columns are read through the existing public select on `season`.

### A9. Record skipped rounds (optional)

We infer skips today from the gap since the last `rounds.created_at` plus the frozen flag, the queue size and the number of active bots. For exact reasons, have `schedule_round` write a row instead of returning null:

```sql
create table public.round_skips (
  id         bigint generated always as identity primary key,
  reason     text not null check (reason in ('frozen', 'backlog', 'no-players')),
  created_at timestamptz not null default now()
);
-- in schedule_round, before each `return null;`:
-- insert into public.round_skips (reason) values ('frozen');  -- or 'backlog' / 'no-players'
```

Readable by the service role only is fine; the web reads it on the server.

### A10. Notifications

```sql
alter table public.profiles add column email_opt_in boolean not null default false;

create table public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('submission_passed', 'submission_rejected', 'first_match', 'final_results')),
  payload    jsonb not null default '{}',
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy "own notifications" on public.notifications for select using (user_id = auth.uid());
alter publication supabase_realtime add table public.notifications;  -- /me listens, filtered to the user

create function public.my_notifications(p_limit int default 30)
returns setof public.notifications language sql stable security invoker set search_path = '' as $$
  select * from public.notifications where user_id = auth.uid() order by created_at desc limit least(p_limit, 100)
$$;

create function public.mark_notifications_read(p_ids bigint[])
returns void language sql security definer set search_path = '' as $$
  update public.notifications set read_at = now()
   where user_id = auth.uid() and id = any(p_ids) and read_at is null
$$;

create function public.set_email_opt_in(p_opt_in boolean)
returns void language sql security definer set search_path = '' as $$
  update public.profiles set email_opt_in = p_opt_in where id = auth.uid()
$$;

grant execute on function public.my_notifications(int), public.mark_notifications_read(bigint[]),
  public.set_email_opt_in(boolean) to authenticated;

-- Called by the worker after complete_validation.
create function internal.notify_validation(p_submission uuid)
returns table (user_id uuid, email text, email_opt_in boolean, kind text, payload jsonb)
language plpgsql set search_path = '' as $$
declare v record;
begin
  select b.owner_id, u.email, p.email_opt_in, s.status, s.version, s.error into v
    from public.submissions s
    join public.bots b on b.id = s.bot_id
    join public.profiles p on p.id = b.owner_id
    join auth.users u on u.id = b.owner_id
   where s.id = p_submission;
  if v.owner_id is null or v.status not in ('active', 'rejected') then return; end if;
  kind := case when v.status = 'active' then 'submission_passed' else 'submission_rejected' end;
  payload := case when kind = 'submission_passed' then jsonb_build_object('version', v.version)
                  else jsonb_build_object('version', v.version, 'error', v.error) end;
  insert into public.notifications (user_id, kind, payload) values (v.owner_id, kind, payload);
  user_id := v.owner_id; email := v.email; email_opt_in := v.email_opt_in;
  return next;
end $$;

-- Called by the worker after complete_match. Notifies owners whose bot just played its first match.
create function internal.notify_match(p_match bigint)
returns table (user_id uuid, email text, email_opt_in boolean, kind text, payload jsonb)
language sql set search_path = '' as $$
  with firsts as (
    select b.owner_id, mp.placement
      from public.match_players mp
      join public.bots b on b.id = mp.bot_id and not b.is_house
     where mp.match_id = p_match
       and not exists (select 1 from public.match_players o
                         join public.matches m on m.id = o.match_id and m.status = 'done'
                        where o.bot_id = mp.bot_id and o.match_id <> p_match)
  ), ins as (
    insert into public.notifications (user_id, kind, payload)
    select owner_id, 'first_match', jsonb_build_object('match_id', p_match, 'placement', placement) from firsts
    returning user_id, kind, payload
  )
  select ins.user_id, u.email, p.email_opt_in, ins.kind, ins.payload
    from ins join auth.users u on u.id = ins.user_id join public.profiles p on p.id = ins.user_id
$$;
```

Both `internal` functions must be callable by the role in the worker's `DATABASE_URL`, like `claim_job`. If either is missing, the worker logs once and carries on.

### A11. Final round and standings

```sql
create table public.final_standings (
  round_id   bigint not null references public.rounds (id) on delete cascade,
  rank       integer not null,
  bot_id     uuid not null references public.bots (id) on delete cascade,
  strength   double precision not null,
  matches    integer not null,
  primary key (round_id, rank)
);
alter table public.final_standings enable row level security;
create policy "standings are public" on public.final_standings for select using (true);

create function internal.record_final_standings(p_round bigint, p_standings jsonb)
returns void language plpgsql set search_path = '' as $$
begin
  delete from public.final_standings where round_id = p_round;
  insert into public.final_standings (round_id, rank, bot_id, strength, matches)
  select p_round, x.rank, x.bot_id, x.strength, x.matches
    from jsonb_to_recordset(p_standings) as x(rank int, bot_id uuid, strength double precision, matches int);
  insert into public.notifications (user_id, kind, payload)
  select b.owner_id, 'final_results', jsonb_build_object('rank', fs.rank)
    from public.final_standings fs join public.bots b on b.id = fs.bot_id and not b.is_house
   where fs.round_id = p_round;
end $$;
```

Also needed, and yours to design: a way to **start** a final round (`kind = 'final'`), for example `internal.schedule_final_round(p_matches_per_bot int)` reusing the lobby code in `schedule_round`. The constraints doc recommends running the final on an on-demand VM, not spot. Once its matches finish, an organiser runs `papersseum-final --round <id> --write` on the worker VM.

### A12. Requeue a failed job (organiser panel)

```sql
create function public.admin_requeue_job(p_job bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.jobs
     set status = 'queued', attempts = 0, lease_until = null, worker_id = null, finished_at = null
   where id = p_job and status = 'failed';
  if not found then raise exception 'Only failed jobs can be requeued' using errcode = 'PS007'; end if;
  -- Undo what internal.mark_job_failed did to the match or the submission.
  update public.matches m set status = 'queued', error = null, finished_at = null
    from public.jobs j where j.id = p_job and j.match_id = m.id;
  update public.submissions s set status = 'pending', error = null
    from public.jobs j where j.id = p_job and j.submission_id = s.id and s.status = 'rejected'
     and s.error like 'Validation could not run: %';
end $$;
revoke all on function public.admin_requeue_job(bigint) from public, anon, authenticated;
grant execute on function public.admin_requeue_job(bigint) to service_role;
```

The web calls it with the secret key after checking the `admins` table. Corrected on 2026-10-15 against `20261007100550_job_failures.sql`: the column is `worker_id`, and a validation job that failed for platform reasons also leaves its submission `rejected` with the "Validation could not run" prefix, so requeue puts that submission back to `pending`. Keep `last_error` so the organiser panel can still show why it failed the first time.

### A13. Environment variables

| Where | Variable | Purpose |
|---|---|---|
| Web host | `SUPABASE_SECRET_KEY` (already used by uploads) | Server-only reads for status and admin |
| Web host | `NEXT_PUBLIC_SITE_URL` | Absolute URLs in link previews |
| Worker VM | `RESEND_API_KEY` (optional) | Email. Without it, notifications still reach the inbox |
| Worker VM | `NOTIFY_FROM` (optional) | Sender, e.g. `Papersseum <arena@your-domain>`; the domain must be verified in Resend |
| Worker VM | `SITE_URL` | Links inside emails |
