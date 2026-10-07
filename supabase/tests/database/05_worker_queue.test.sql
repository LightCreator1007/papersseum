-- Worker queue: claiming, validation results, leases, retries, dead workers.
begin;
select plan(36);

delete from public.jobs; delete from public.rounds; delete from public.workers; delete from auth.users;
update public.season set frozen = false, engine_hash = null, games_per_round = 1, max_backlog = 60,
  submission_cooldown = '10 minutes', allowed_email_domain = 'iiitdmj.ac.in';

create function pg_temp.new_user(p_email text) returns uuid language sql as $$
  insert into auth.users (id, email, instance_id, aud, role)
  values (gen_random_uuid(), p_email, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
  returning id;
$$;
create function pg_temp.submit(p_user uuid) returns uuid language sql as $$
  update public.submissions set created_at = created_at - interval '11 minutes';  -- skip cooldown
  select (public.api_create_submission(p_user, s, 'bot/' || s || '.py', 'sha', 100)).id
    from gen_random_uuid() as s;
$$;
create function pg_temp.active_player(p_email text) returns uuid language plpgsql as $$
declare v_user uuid; v_sub uuid;
begin
  v_user := pg_temp.new_user(p_email);
  v_sub := pg_temp.submit(v_user);
  delete from public.jobs where submission_id = v_sub;
  update public.submissions set status = 'active', validated_at = now() where id = v_sub;
  update public.bots set active_submission_id = v_sub, active_version = 1, active_since = now()
   where owner_id = v_user;
  return v_user;
end $$;
create function pg_temp.job_id(p jsonb) returns bigint language sql as $$ select (p->>'job_id')::bigint $$;

create temp table ctx (k text primary key, v text);

-- Setup: 5 active players -> one scheduled match; alice has a pending upload.
select pg_temp.active_player('p' || g || '@iiitdmj.ac.in') from generate_series(1, 5) g;
select internal.schedule_round();
insert into ctx values ('alice', pg_temp.new_user('alice@iiitdmj.ac.in'));
insert into ctx values ('v1', pg_temp.submit((select v::uuid from ctx where k = 'alice')));
select internal.heartbeat('w1', 'h', '0.1');

-- Validation is claimed before matches
insert into ctx values ('job', internal.claim_job('w1', 'h')::text);
select is((select (v::jsonb)->>'kind' from ctx where k = 'job'), 'validate', 'validation jobs are claimed before matches');
select is((select (v::jsonb)->>'submission_id' from ctx where k = 'job'), (select v from ctx where k = 'v1'),
  'the claim names the submission to validate');
select is((select (v::jsonb)->>'storage_path' from ctx where k = 'job'), 'bot/' || (select v from ctx where k = 'v1') || '.py',
  'the claim includes where the file is stored');
select is((select status::text from public.submissions where id = (select v::uuid from ctx where k = 'v1')), 'validating',
  'the submission shows as validating');
select is((select status::text from public.jobs where id = pg_temp.job_id((select v::jsonb from ctx where k = 'job'))), 'running',
  'the job is running');
select ok((select lease_until > now() + interval '4 minutes' from public.jobs
            where id = pg_temp.job_id((select v::jsonb from ctx where k = 'job'))), 'the job has a lease');
select is((select current_job from public.workers where id = 'w1'), pg_temp.job_id((select v::jsonb from ctx where k = 'job')),
  'the worker row shows its current job');

-- Validation passes
select internal.complete_validation(pg_temp.job_id((select v::jsonb from ctx where k = 'job')), 'w1', true);
select is((select status::text from public.submissions where id = (select v::uuid from ctx where k = 'v1')), 'active',
  'a passing upload becomes active');
select is((select active_submission_id from public.bots where owner_id = (select v::uuid from ctx where k = 'alice')),
  (select v::uuid from ctx where k = 'v1'), 'the bot now plays the new upload');
select is((select status::text from public.jobs where id = pg_temp.job_id((select v::jsonb from ctx where k = 'job'))), 'done',
  'the validation job is done');

-- A newer version replaces it
insert into ctx values ('v2', pg_temp.submit((select v::uuid from ctx where k = 'alice')));
update ctx set v = internal.claim_job('w1', 'h')::text where k = 'job';
select internal.complete_validation(pg_temp.job_id((select v::jsonb from ctx where k = 'job')), 'w1', true);
select is((select status::text from public.submissions where id = (select v::uuid from ctx where k = 'v1')), 'superseded',
  'the old version is marked superseded');
select is((select active_version from public.bots where owner_id = (select v::uuid from ctx where k = 'alice')), 2,
  'the bot is on version 2');

-- A broken upload is rejected and the bot keeps playing the last good version
insert into ctx values ('v3', pg_temp.submit((select v::uuid from ctx where k = 'alice')));
update ctx set v = internal.claim_job('w1', 'h')::text where k = 'job';
select internal.complete_validation(pg_temp.job_id((select v::jsonb from ctx where k = 'job')), 'w1', false,
  'act() returned 7', '[{"line": 3, "kind": "import", "detail": "import os"}]');
select is((select status::text from public.submissions where id = (select v::uuid from ctx where k = 'v3')), 'rejected',
  'a failing upload is rejected');
select is((select error from public.submissions where id = (select v::uuid from ctx where k = 'v3')), 'act() returned 7',
  'the rejection reason is stored');
select is((select violations->0->>'detail' from public.submissions where id = (select v::uuid from ctx where k = 'v3')), 'import os',
  'scan violations are stored');
select is((select active_version from public.bots where owner_id = (select v::uuid from ctx where k = 'alice')), 2,
  'a rejected upload does not replace the working version');

-- The match is claimed next, with everything the worker needs
update ctx set v = internal.claim_job('w1', 'h')::text where k = 'job';
select is((select (v::jsonb)->>'kind' from ctx where k = 'job'), 'match', 'then the match is claimed');
select is((select jsonb_array_length((v::jsonb)->'players') from ctx where k = 'job'), 5, 'the claim lists 5 players');
select is(
  (select array_agg((p->>'slot')::int order by (p->>'slot')::int) from ctx, jsonb_array_elements((v::jsonb)->'players') p where k = 'job'),
  array[0, 1, 2, 3, 4], 'one player per seat, seats 0-4');
select ok((select (v::jsonb)->>'seed' is not null from ctx where k = 'job'), 'the claim includes the seed');
select is((select status::text from public.matches where id = ((select v::jsonb from ctx where k = 'job')->>'match_id')::bigint),
  'running', 'the match shows as running');
select is(internal.claim_job('w1', 'h'), null, 'an empty queue returns null');

-- Heartbeats extend the lease
update public.jobs set lease_until = now() + interval '1 second' where id = pg_temp.job_id((select v::jsonb from ctx where k = 'job'));
select internal.heartbeat('w1', 'h', '0.1', pg_temp.job_id((select v::jsonb from ctx where k = 'job')));
select ok((select lease_until > now() + interval '4 minutes' from public.jobs
            where id = pg_temp.job_id((select v::jsonb from ctx where k = 'job'))), 'a heartbeat extends the lease');

-- Only the worker holding the job can report it
select throws_like(
  format($$select internal.complete_match(%s, 'w2', '[]', 'x', 'h')$$, pg_temp.job_id((select v::jsonb from ctx where k = 'job'))),
  '%is not running on worker w2%', 'another worker cannot report this job');

-- Engine hash
update public.season set engine_hash = 'h';
select throws_like($$select internal.claim_job('old-laptop', 'stale')$$, 'Engine hash mismatch%',
  'a worker with a different engine is refused');
select lives_ok($$select internal.claim_job('w1', 'h')$$, 'a worker with the right engine can claim');
update public.season set engine_hash = null;

-- Worker errors: retried until max_attempts (3), then failed
select internal.fail_job(pg_temp.job_id((select v::jsonb from ctx where k = 'job')), 'w1', 'docker crashed');
select is((select status::text from public.jobs where id = pg_temp.job_id((select v::jsonb from ctx where k = 'job'))), 'queued',
  'after a worker error the job is retried');
select is((select status::text from public.matches where id = ((select v::jsonb from ctx where k = 'job')->>'match_id')::bigint),
  'queued', 'and the match is queued again');
select internal.fail_job(pg_temp.job_id(internal.claim_job('w1', 'h')), 'w1', 'docker crashed');
select internal.fail_job(pg_temp.job_id(internal.claim_job('w1', 'h')), 'w1', 'docker crashed again');
select is((select status::text from public.jobs where id = pg_temp.job_id((select v::jsonb from ctx where k = 'job'))), 'failed',
  'after 3 attempts the job fails');
select is((select status::text from public.matches where id = ((select v::jsonb from ctx where k = 'job')->>'match_id')::bigint),
  'failed', 'and so does the match');
select is((select error from public.matches where id = ((select v::jsonb from ctx where k = 'job')->>'match_id')::bigint),
  'docker crashed again', 'with the last error');

-- Dead worker: an expired lease puts the job back in the queue
update public.season set max_backlog = 60;
select internal.schedule_round();
update ctx set v = internal.claim_job('dead', 'h')::text where k = 'job';
update public.jobs set lease_until = now() - interval '1 second' where id = pg_temp.job_id((select v::jsonb from ctx where k = 'job'));
select is(internal.requeue_expired(), 1, 'requeue_expired finds the abandoned job');
select is((select status::text from public.jobs where id = pg_temp.job_id((select v::jsonb from ctx where k = 'job'))), 'queued',
  'the abandoned job is back in the queue');
select throws_like(
  format($$select internal.complete_match(%s, 'dead', '[]', 'x', 'h')$$, pg_temp.job_id((select v::jsonb from ctx where k = 'job'))),
  '%is not running on worker dead%', 'the dead worker cannot report it later');

-- ...unless it has used up its attempts
update public.jobs set status = 'running', worker_id = 'dead', attempts = 3, lease_until = now() - interval '1 second'
 where id = pg_temp.job_id((select v::jsonb from ctx where k = 'job'));
select internal.requeue_expired();
select is((select error from public.matches where id = ((select v::jsonb from ctx where k = 'job')->>'match_id')::bigint),
  'Worker stopped responding', 'a job abandoned 3 times fails');

-- A validation job that keeps failing rejects the upload with a clear reason
insert into ctx values ('v4', pg_temp.submit((select v::uuid from ctx where k = 'alice')));
update public.jobs set status = 'running', worker_id = 'dead', attempts = 3, lease_until = now() - interval '1 second'
 where submission_id = (select v::uuid from ctx where k = 'v4');
select internal.requeue_expired();
select alike((select error from public.submissions where id = (select v::uuid from ctx where k = 'v4')),
  'Validation could not run:%', 'an upload that could never be validated is rejected with a reason');

select * from finish();
rollback;
