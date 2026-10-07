-- Structure: the right tables, functions, buckets, cron jobs and permissions exist.
begin;
select plan(32);

select tables_are('public',
  array['season', 'profiles', 'admins', 'bots', 'submissions', 'rounds', 'matches',
        'match_players', 'jobs', 'workers'],
  'public schema has exactly the expected tables');

select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity), 0,
  'RLS is enabled on every public table');

select has_view('public', 'leaderboard', 'leaderboard view exists');
select ok(
  (select 'security_invoker=true' = any(reloptions) from pg_class where oid = 'public.leaderboard'::regclass),
  'leaderboard view respects RLS (security_invoker)');

select functions_are('internal',
  array['handle_new_user', 'claim_job', 'heartbeat', 'own_running_job', 'complete_validation',
        'lock_match_bots', 'complete_match', 'mark_job_failed', 'fail_job', 'requeue_expired',
        'schedule_round'],
  'internal schema has exactly the expected functions');

-- Season defaults
select is((select allowed_email_domain from public.season), 'iiitdmj.ac.in', 'sign-ups limited to iiitdmj.ac.in');
select is((select frozen from public.season), false, 'season starts unfrozen');

-- House bots
select is((select count(*)::int from public.bots where is_house), 5, 'five house bots');
select is(
  array(select distinct s.builtin from public.bots b join public.submissions s on s.id = b.active_submission_id
         where b.is_house order by 1),
  array['greedy', 'random', 'safe_expander'],
  'house bots use the library baselines');
select is(
  (select count(*)::int from public.bots where is_house and active_submission_id is null), 0,
  'every house bot has an active submission');

-- Storage
select is((select public from storage.buckets where id = 'agents'), false, 'agents bucket is private');
select is((select public from storage.buckets where id = 'replays'), true, 'replays bucket is public');
select is((select file_size_limit from storage.buckets where id = 'agents'), 1048576::bigint, 'agent files capped at 1 MB');
select is(
  (select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects'
     and (qual ilike '%agents%' or with_check ilike '%agents%')), 0,
  'no storage policy opens the agents bucket');

-- Scheduled jobs
select results_eq(
  $$select jobname::text, schedule::text from cron.job where jobname like 'papersseum-%' order by jobname$$,
  $$values ('papersseum-requeue-expired', '* * * * *'), ('papersseum-schedule-round', '*/15 * * * *')$$,
  'cron jobs are scheduled');

-- Realtime
select is(
  array(select tablename::text from pg_publication_tables where pubname = 'supabase_realtime'
          and schemaname = 'public' order by 1),
  array['bots', 'matches', 'submissions'],
  'realtime publishes bots, matches and submissions');

-- Table privileges: private tables are closed to browsers
select table_privs_are('public', 'jobs',    'anon',          array[]::text[], 'anon has no access to jobs');
select table_privs_are('public', 'jobs',    'authenticated', array[]::text[], 'authenticated has no access to jobs');
select table_privs_are('public', 'workers', 'anon',          array[]::text[], 'anon has no access to workers');
select table_privs_are('public', 'workers', 'authenticated', array[]::text[], 'authenticated has no access to workers');
select table_privs_are('public', 'admins',  'anon',          array[]::text[], 'anon has no access to admins');
select table_privs_are('public', 'admins',  'authenticated', array[]::text[], 'authenticated has no access to admins');
select table_privs_are('public', 'submissions', 'anon',          array[]::text[],   'anon has no access to submissions');
select table_privs_are('public', 'submissions', 'authenticated', array['SELECT'],   'authenticated can only read submissions');
select table_privs_are('public', 'bots',        'anon',          array['SELECT'],   'anon can only read bots');
select table_privs_are('public', 'bots',        'authenticated', array['SELECT'],   'authenticated can only read bots');
select table_privs_are('public', 'leaderboard', 'anon',          array['SELECT'],   'anon can read the leaderboard');

-- Schema and function privileges
select schema_privs_are('internal', 'anon',          array[]::text[], 'anon cannot use the internal schema');
select schema_privs_are('internal', 'authenticated', array[]::text[], 'authenticated cannot use the internal schema');
select function_privs_are('public', 'api_create_submission', array['uuid', 'uuid', 'text', 'text', 'integer'],
  'anon', array[]::text[], 'anon cannot create submissions');
select function_privs_are('public', 'api_create_submission', array['uuid', 'uuid', 'text', 'text', 'integer'],
  'authenticated', array[]::text[], 'authenticated cannot call the submission function directly');
select function_privs_are('public', 'api_create_submission', array['uuid', 'uuid', 'text', 'text', 'integer'],
  'service_role', array['EXECUTE'], 'service_role (API route) can create submissions');

select * from finish();
rollback;
