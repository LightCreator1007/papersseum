-- Worker API. The worker connects straight to Postgres and calls these
-- functions. The internal schema is not exposed to the Data API, so browsers
-- cannot call them.

-- Claim the next job. Returns null when the queue is empty, otherwise a JSON
-- payload with everything the worker needs:
--   validate: {job_id, kind, submission_id, storage_path, sha256}
--   match:    {job_id, kind, match_id, seed,
--              players: [{slot, bot_id, submission_id, storage_path, builtin, sha256}]}
create or replace function internal.claim_job(
  p_worker      text,
  p_engine_hash text,
  p_lease       interval default '5 minutes'
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_expected text;
  v_job      public.jobs;
begin
  select engine_hash into v_expected from public.season where id = 1;
  if v_expected is not null and p_engine_hash is distinct from v_expected then
    raise exception 'Engine hash mismatch: worker has %, season expects %', p_engine_hash, v_expected;
  end if;

  update public.jobs j
     set status = 'running', worker_id = p_worker,
         lease_until = now() + p_lease, attempts = j.attempts + 1
   where j.id = (
     select id from public.jobs
      where status = 'queued'
      order by priority desc, id
      for update skip locked
      limit 1
   )
  returning * into v_job;

  if v_job.id is null then
    return null;
  end if;

  update public.workers set current_job = v_job.id, last_seen = now() where id = p_worker;

  if v_job.kind = 'validate' then
    update public.submissions set status = 'validating' where id = v_job.submission_id;
    return (
      select jsonb_build_object(
        'job_id', v_job.id, 'kind', 'validate', 'submission_id', s.id,
        'storage_path', s.storage_path, 'sha256', s.sha256)
      from public.submissions s where s.id = v_job.submission_id
    );
  end if;

  update public.matches set status = 'running', started_at = now() where id = v_job.match_id;
  return (
    select jsonb_build_object(
      'job_id', v_job.id, 'kind', 'match', 'match_id', m.id, 'seed', m.seed,
      'players', (
        select jsonb_agg(jsonb_build_object(
                 'slot', mp.slot, 'bot_id', mp.bot_id, 'submission_id', s.id,
                 'storage_path', s.storage_path, 'builtin', s.builtin, 'sha256', s.sha256)
               order by mp.slot)
          from public.match_players mp
          join public.submissions s on s.id = mp.submission_id
         where mp.match_id = m.id))
    from public.matches m where m.id = v_job.match_id
  );
end;
$$;

-- Keep the worker visible on the admin page and extend its current lease.
create or replace function internal.heartbeat(
  p_worker      text,
  p_engine_hash text,
  p_version     text,
  p_job         bigint default null,
  p_lease       interval default '5 minutes'
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  insert into public.workers (id, engine_hash, version, current_job, last_seen)
  values (p_worker, p_engine_hash, p_version, p_job, now())
  on conflict (id) do update
    set engine_hash = excluded.engine_hash, version = excluded.version,
        current_job = excluded.current_job, last_seen = now();

  if p_job is not null then
    update public.jobs set lease_until = now() + p_lease
     where id = p_job and worker_id = p_worker and status = 'running';
  end if;
end;
$$;

-- Internal helper: the job must still be running and owned by this worker
-- (a job whose lease expired may already belong to someone else).
create or replace function internal.own_running_job(p_job bigint, p_worker text)
returns public.jobs
language plpgsql
set search_path = ''
as $$
declare
  v_job public.jobs;
begin
  select * into v_job from public.jobs where id = p_job for update;
  if v_job.id is null or v_job.status <> 'running' or v_job.worker_id is distinct from p_worker then
    raise exception 'Job % is not running on worker %', p_job, p_worker;
  end if;
  return v_job;
end;
$$;

-- Report a validation result. On success the submission becomes the bot's
-- active version; the previous one is marked superseded (matches already
-- queued with it still run it).
create or replace function internal.complete_validation(
  p_job         bigint,
  p_worker      text,
  p_ok          boolean,
  p_error       text default null,
  p_violations  jsonb default null,
  p_engine_hash text default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_sub public.submissions;
begin
  v_job := internal.own_running_job(p_job, p_worker);
  select * into v_sub from public.submissions where id = v_job.submission_id for update;

  if p_ok then
    update public.submissions set status = 'superseded'
     where bot_id = v_sub.bot_id and status = 'active' and id <> v_sub.id;
    update public.submissions
       set status = 'active', error = null, violations = p_violations,
           engine_hash = p_engine_hash, validated_at = now()
     where id = v_sub.id;
    update public.bots
       set active_submission_id = v_sub.id, active_version = v_sub.version, active_since = now()
     where id = v_sub.bot_id;
  else
    update public.submissions
       set status = 'rejected', error = p_error, violations = p_violations,
           engine_hash = p_engine_hash, validated_at = now()
     where id = v_sub.id;
  end if;

  update public.jobs set status = 'done', finished_at = now(), lease_until = null where id = p_job;
  update public.workers set current_job = null where id = p_worker;
end;
$$;

-- Lock the bots in a match and return their current ratings. Call this and
-- complete_match in ONE transaction:
--   begin;
--   select * from internal.lock_match_bots(match_id);   -- read elo, games
--   -- compute new ratings with papersseum.rating
--   select internal.complete_match(...);
--   commit;
create or replace function internal.lock_match_bots(p_match bigint)
returns table (slot smallint, bot_id uuid, elo double precision, games integer)
language sql
set search_path = ''
as $$
  with locked as (
    select b.id, b.elo, b.games
      from public.bots b
     where b.id in (select mp.bot_id from public.match_players mp where mp.match_id = p_match)
     order by b.id            -- consistent lock order avoids deadlocks between workers
       for update
  )
  select mp.slot, mp.bot_id, l.elo, l.games
    from public.match_players mp
    join locked l on l.id = mp.bot_id
   where mp.match_id = p_match
   order by mp.slot;
$$;

-- Report a finished match. p_players is a JSON array, one object per slot:
--   {slot, placement, coverage, deaths, strikes, crashed, score, elo_after}
create or replace function internal.complete_match(
  p_job         bigint,
  p_worker      text,
  p_players     jsonb,
  p_replay_path text,
  p_engine_hash text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_job public.jobs;
  r     record;
begin
  v_job := internal.own_running_job(p_job, p_worker);

  for r in
    select * from jsonb_to_recordset(p_players) as x(
      slot smallint, placement smallint, coverage real, deaths integer,
      strikes integer, crashed boolean, score real, elo_after double precision)
  loop
    update public.match_players mp
       set placement = r.placement, coverage = r.coverage, deaths = r.deaths,
           strikes = r.strikes, crashed = r.crashed, score = r.score,
           elo_before = b.elo, elo_after = r.elo_after
      from public.bots b
     where mp.match_id = v_job.match_id and mp.slot = r.slot and b.id = mp.bot_id;

    update public.bots b
       set elo = r.elo_after, games = b.games + 1
      from public.match_players mp
     where mp.match_id = v_job.match_id and mp.slot = r.slot and b.id = mp.bot_id;
  end loop;

  update public.matches
     set status = 'done', finished_at = now(), replay_path = p_replay_path,
         engine_hash = p_engine_hash, error = null
   where id = v_job.match_id;

  update public.jobs set status = 'done', finished_at = now(), lease_until = null where id = p_job;
  update public.workers set current_job = null where id = p_worker;
end;
$$;
