-- Make an older version active: switch at once, or re-check when the engine changed.
begin;
select plan(24);

delete from public.jobs; delete from public.rounds; delete from public.workers; delete from auth.users;
update public.season set frozen = false, engine_hash = null, submission_cooldown = '10 minutes',
                         allowed_email_domain = 'iiitdmj.ac.in';

create function pg_temp.new_user(p_email text) returns uuid language sql as $$
  insert into auth.users (id, email, instance_id, aud, role)
  values (gen_random_uuid(), p_email, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
  returning id;
$$;
-- A version that went through validation an hour ago (so outside the cooldown), on engine 'e1'.
create function pg_temp.add_version(p_user uuid, p_version int, p_status public.submission_status)
returns uuid language sql as $$
  insert into public.submissions (bot_id, version, storage_path, status, engine_hash, created_at, validated_at)
  select b.id, p_version, 'bot/' || b.id || '/v' || p_version || '.py', p_status, 'e1',
         now() - interval '1 hour', now() - interval '1 hour'
    from public.bots b where b.owner_id = p_user
  returning id;
$$;
create function pg_temp.sign_in(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

create temp table people (name text primary key, id uuid);
insert into people values ('alice', pg_temp.new_user('alice@iiitdmj.ac.in')),
                          ('bob',   pg_temp.new_user('bob@iiitdmj.ac.in'));
-- alice: v1 superseded, v2 playing, v3 rejected. bob: v1 playing.
create temp table v (name text primary key, id uuid);
insert into v values
  ('a1', pg_temp.add_version((select id from people where name = 'alice'), 1, 'superseded')),
  ('a2', pg_temp.add_version((select id from people where name = 'alice'), 2, 'active')),
  ('a3', pg_temp.add_version((select id from people where name = 'alice'), 3, 'rejected')),
  ('b1', pg_temp.add_version((select id from people where name = 'bob'),   1, 'active'));
update public.bots set active_submission_id = (select id from v where name = 'a2'), active_version = 2
 where owner_id = (select id from people where name = 'alice');
update public.bots set active_submission_id = (select id from v where name = 'b1'), active_version = 1
 where owner_id = (select id from people where name = 'bob');
grant select on people, v to authenticated;

select function_privs_are('public', 'set_active_submission', array['uuid'], 'anon', array[]::text[],
  'anon cannot switch versions');
select function_privs_are('public', 'set_active_submission', array['uuid'], 'authenticated', array['EXECUTE'],
  'signed-in players can switch versions');

-- No engine hash enforced: every passed version switches at once
select pg_temp.sign_in((select id from people where name = 'alice'));
set local role authenticated;
select is((select status from public.set_active_submission((select id from v where name = 'a1'))), 'active',
  'alice switches back to v1 at once');
reset role;
select is((select status::text from public.submissions where id = (select id from v where name = 'a1')), 'active',
  'v1 is active');
select is((select status::text from public.submissions where id = (select id from v where name = 'a2')), 'superseded',
  'v2, which was playing, is superseded');
select is((select active_submission_id from public.bots where owner_id = (select id from people where name = 'alice')),
  (select id from v where name = 'a1'), 'her bot plays v1');
select is((select active_version from public.bots where owner_id = (select id from people where name = 'alice')), 1,
  'and shows version 1');
select is((select count(*)::int from public.jobs), 0, 'a direct switch queues no validation');

select pg_temp.sign_in((select id from people where name = 'alice'));
set local role authenticated;
select is((select status from public.set_active_submission((select id from v where name = 'a1'))), 'active',
  'making the playing version active again does nothing');
select throws_ok($$select public.set_active_submission((select id from v where name = 'a3'))$$, 'PS006', null,
  'a rejected version cannot be made active');
select throws_ok($$select public.set_active_submission((select id from v where name = 'b1'))$$, 'PS006', null,
  'another player''s version cannot be made active');
select throws_ok($$select public.set_active_submission(gen_random_uuid())$$, 'PS006', null,
  'an unknown version cannot be made active');
reset role;

-- The engine changed since alice's versions passed
update public.season set engine_hash = 'e2';
select pg_temp.sign_in((select id from people where name = 'alice'));
set local role authenticated;
select is((select status from public.set_active_submission((select id from v where name = 'a2'))), 'revalidating',
  'a version that passed on an older engine is re-checked');
reset role;
select is((select status::text from public.submissions where id = (select id from v where name = 'a2')), 'pending',
  'it shows as waiting for its check');
select is(
  (select priority from public.jobs where submission_id = (select id from v where name = 'a2') and kind = 'validate' and status = 'queued'),
  10::smallint, 'its validation job is queued ahead of matches');
select is((select active_submission_id from public.bots where owner_id = (select id from people where name = 'alice')),
  (select id from v where name = 'a1'), 'v1 keeps playing until the re-check passes');

select pg_temp.sign_in((select id from people where name = 'alice'));
set local role authenticated;
select is((select status from public.set_active_submission((select id from v where name = 'a2'))), 'revalidating',
  'asking again while it is being checked says so');
reset role;
select is((select count(*)::int from public.jobs where submission_id = (select id from v where name = 'a2')), 1,
  'and queues no second job');

-- Re-checks share the upload cooldown
update public.jobs set status = 'done';
update public.submissions set status = 'superseded' where id = (select id from v where name = 'a2');
select pg_temp.sign_in((select id from people where name = 'alice'));
set local role authenticated;
select throws_ok($$select public.set_active_submission((select id from v where name = 'a2'))$$, 'PS004', null,
  'a second re-check within the cooldown is refused');
reset role;
update public.jobs set created_at = created_at - interval '11 minutes';
select pg_temp.sign_in((select id from people where name = 'alice'));
set local role authenticated;
select is((select status from public.set_active_submission((select id from v where name = 'a2'))), 'revalidating',
  'after the cooldown it can be re-checked');
reset role;

-- A version that passed on the current engine still switches at once, cooldown or not
update public.submissions set status = 'superseded', engine_hash = 'e2' where id = (select id from v where name = 'a2');
select pg_temp.sign_in((select id from people where name = 'alice'));
set local role authenticated;
select is((select status from public.set_active_submission((select id from v where name = 'a2'))), 'active',
  'a version that passed on the current engine switches at once');
reset role;

-- Frozen season, bans, no bot
update public.season set frozen = true;
select pg_temp.sign_in((select id from people where name = 'alice'));
set local role authenticated;
select throws_ok($$select public.set_active_submission((select id from v where name = 'a1'))$$, 'PS001', null,
  'versions cannot be switched while the season is frozen');
reset role;
update public.season set frozen = false;

update public.bots set banned = true where owner_id = (select id from people where name = 'alice');
select pg_temp.sign_in((select id from people where name = 'alice'));
set local role authenticated;
select throws_ok($$select public.set_active_submission((select id from v where name = 'a1'))$$, 'PS003', null,
  'a banned bot cannot switch versions');
reset role;

select pg_temp.sign_in(gen_random_uuid());
set local role authenticated;
select throws_ok($$select public.set_active_submission((select id from v where name = 'a1'))$$, 'PS002', null,
  'no bot, no versions');
reset role;

select * from finish();
rollback;
