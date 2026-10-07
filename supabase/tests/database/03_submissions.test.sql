-- Submissions: versions, validation job, cooldown, frozen season, bans.
begin;
select plan(13);

delete from public.jobs; delete from public.rounds; delete from public.workers; delete from auth.users;
update public.season set frozen = false, submission_cooldown = '10 minutes', allowed_email_domain = 'iiitdmj.ac.in';

create function pg_temp.new_user(p_email text) returns uuid language sql as $$
  insert into auth.users (id, email, instance_id, aud, role)
  values (gen_random_uuid(), p_email, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
  returning id;
$$;
create function pg_temp.submit(p_user uuid) returns public.submissions language sql as $$
  select public.api_create_submission(p_user, s, 'bot/' || s || '.py', 'sha', 100)
    from gen_random_uuid() as s;
$$;
create function pg_temp.skip_cooldown() returns void language sql as $$
  update public.submissions set created_at = created_at - interval '11 minutes';
$$;

create temp table t (user_id uuid, first_sub uuid);
insert into t select pg_temp.new_user('alice@iiitdmj.ac.in'), null;

-- First upload
update t set first_sub = (pg_temp.submit(user_id)).id;
select is((select version from public.submissions where id = (select first_sub from t)), 1, 'first upload is version 1');
select is((select status::text from public.submissions where id = (select first_sub from t)), 'pending', 'new upload waits for validation');
select is((select storage_path from public.submissions where id = (select first_sub from t)),
  'bot/' || (select first_sub from t) || '.py', 'storage path is recorded');
select is(
  (select priority from public.jobs where submission_id = (select first_sub from t) and kind = 'validate' and status = 'queued'),
  10::smallint, 'a validation job is queued ahead of matches');

-- Cooldown
select throws_ok($$select pg_temp.submit((select user_id from t))$$, 'PS004', null, 'a second upload within 10 minutes is refused');
select is((select count(*)::int from public.submissions s join public.bots b on b.id = s.bot_id where not b.is_house), 1,
  'the refused upload created no submission');
select pg_temp.skip_cooldown();
select is((pg_temp.submit((select user_id from t))).version, 2, 'after the cooldown, the next upload is version 2');

-- Frozen season, bans, unknown users
select pg_temp.skip_cooldown();
update public.season set frozen = true;
select throws_ok($$select pg_temp.submit((select user_id from t))$$, 'PS001', null, 'uploads are refused when the season is frozen');
update public.season set frozen = false;

update public.bots set banned = true where owner_id = (select user_id from t);
select throws_ok($$select pg_temp.submit((select user_id from t))$$, 'PS003', null, 'banned bots cannot upload');
update public.bots set banned = false where owner_id = (select user_id from t);

select throws_ok($$select pg_temp.submit(gen_random_uuid())$$, 'PS002', null, 'an unknown user cannot upload');

-- Data integrity
select throws_ok(
  $$insert into public.submissions (bot_id, version) select id, 99 from public.bots where owner_id = (select user_id from t)$$,
  '23514', null, 'a submission needs exactly one of storage_path or builtin');
select throws_ok(
  $$insert into public.submissions (bot_id, version, storage_path) select id, 1, 'dup.py' from public.bots where owner_id = (select user_id from t)$$,
  '23505', null, 'version numbers are unique per bot');
select is((select count(*)::int from public.jobs where kind = 'validate'), 2, 'one validation job per accepted upload');

select * from finish();
rollback;
