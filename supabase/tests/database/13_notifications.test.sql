-- Notifications: the worker records them, owners read and clear their own, opt-in stays private.
begin;
select plan(35);

delete from public.jobs; delete from public.rounds; delete from public.workers; delete from auth.users;
update public.bots set elo = 1000, games = 0, banned = false where is_house;
update public.season set frozen = false, engine_hash = null, games_per_round = 1, max_backlog = 60,
  allowed_email_domain = 'iiitdmj.ac.in';

create function pg_temp.new_user(p_email text) returns uuid language sql as $$
  insert into auth.users (id, email, instance_id, aud, role)
  values (gen_random_uuid(), p_email, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
  returning id;
$$;
create function pg_temp.active_player(p_email text) returns uuid language plpgsql as $$
declare v_user uuid; v_sub uuid := gen_random_uuid();
begin
  v_user := pg_temp.new_user(p_email);
  perform public.api_create_submission(v_user, v_sub, 'bot/' || v_sub || '.py', 'sha', 100);
  delete from public.jobs where submission_id = v_sub;
  update public.submissions set status = 'active', validated_at = now() where id = v_sub;
  update public.bots set active_submission_id = v_sub, active_version = 1, active_since = now()
   where owner_id = v_user;
  return v_user;
end $$;
create function pg_temp.sign_in(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

create temp table people (name text primary key, id uuid);
insert into people select 'p' || g, pg_temp.active_player('p' || g || '@iiitdmj.ac.in') from generate_series(1, 5) g;
grant select on people to anon, authenticated;

-- Structure and privacy
select has_table('public', 'notifications', 'notifications table exists');
select has_table('public', 'notification_settings', 'notification_settings table exists');
select hasnt_column('public', 'profiles', 'email_opt_in', 'the opt-in is not on the public profiles table');
select table_privs_are('public', 'notification_settings', 'anon', array[]::text[], 'anon cannot read settings');
select table_privs_are('public', 'notification_settings', 'authenticated', array[]::text[],
  'players cannot read settings directly, not even their own');
select table_privs_are('public', 'notifications', 'anon', array[]::text[], 'anon cannot read notifications');
select table_privs_are('public', 'notifications', 'authenticated', array['SELECT'], 'players can only read notifications');
select function_privs_are('public', 'my_notifications', array['integer'], 'anon', array[]::text[], 'anon has no inbox');
select function_privs_are('public', 'set_email_opt_in', array['boolean'], 'anon', array[]::text[], 'anon cannot opt in');
select function_privs_are('public', 'set_email_opt_in', array['boolean'], 'authenticated', array['EXECUTE'],
  'players can opt in');

-- Validation: p1's version passes, p2's is rejected
update public.submissions s set status = 'rejected', error = 'too slow'
  from public.bots b where b.id = s.bot_id and b.owner_id = (select id from people where name = 'p2');

create temp table told as
select * from internal.notify_validation(
  (select active_submission_id from public.bots where owner_id = (select id from people where name = 'p1')));
select results_eq('select user_id, email, email_opt_in, kind, payload from told',
  $$select id, 'p1@iiitdmj.ac.in'::text, false, 'submission_passed'::text, '{"version": 1}'::jsonb
      from people where name = 'p1'$$,
  'a pass tells the owner, opted out by default');

select results_eq(
  $$select kind, payload from internal.notify_validation(
      (select s.id from public.submissions s join public.bots b on b.id = s.bot_id
        where b.owner_id = (select id from people where name = 'p2')))$$,
  $$values ('submission_rejected'::text, '{"version": 1, "error": "too slow"}'::jsonb)$$,
  'a rejection carries the reason');

select is_empty(
  $$select * from internal.notify_validation(
      (select active_submission_id from public.bots where is_house limit 1))$$,
  'house bots have nobody to tell');
select is_empty($$select * from internal.notify_validation(gen_random_uuid())$$, 'an unknown submission tells nobody');
select is((select count(*)::int from public.notifications), 2, 'two notifications recorded');

-- First match: all five players play one, and each hears about it once
select internal.schedule_round();
create temp table job as select internal.claim_job('w1', 'h') as p;
create temp table m as select (p->>'match_id')::bigint as id, (p->>'job_id')::bigint as job from job;

select is_empty(format('select * from internal.notify_match(%s)', (select id from m)),
  'a match that is not done yet tells nobody');

create temp table locked as select * from internal.lock_match_bots((select id from m));
select internal.complete_match((select job from m), 'w1',
  (select jsonb_agg(jsonb_build_object(
     'slot', slot, 'placement', slot + 1, 'coverage', 40 - slot * 8, 'deaths', slot,
     'strikes', 0, 'crashed', false, 'score', 48 - slot * 10, 'elo_after', 1000))
   from locked),
  (select id from m) || '.jsonl.gz', 'h');

create temp table firsts as select * from internal.notify_match((select id from m));
select is((select count(*)::int from firsts), 5, 'every player hears about their first match');
select ok((select bool_and(kind = 'first_match' and (payload->>'match_id')::bigint = (select id from m)) from firsts),
  'with the match id');
select is(
  (select (payload->>'placement')::int from firsts f join public.match_players mp
      on mp.match_id = (select id from m) and mp.bot_id = (select b.id from public.bots b where b.owner_id = f.user_id)
    where mp.slot = 0),
  1, 'and their placement');
select is_empty(format('select * from internal.notify_match(%s)', (select id from m)),
  'asking again tells nobody twice');

-- A second match is nobody's first
select internal.schedule_round();
create temp table job2 as select internal.claim_job('w1', 'h') as p;
create temp table m2 as select (p->>'match_id')::bigint as id, (p->>'job_id')::bigint as job from job2;
create temp table locked2 as select * from internal.lock_match_bots((select id from m2));
select internal.complete_match((select job from m2), 'w1',
  (select jsonb_agg(jsonb_build_object(
     'slot', slot, 'placement', slot + 1, 'coverage', 10, 'deaths', 0,
     'strikes', 0, 'crashed', false, 'score', 10, 'elo_after', 1000))
   from locked2),
  (select id from m2) || '.jsonl.gz', 'h');
select is_empty(format('select * from internal.notify_match(%s)', (select id from m2)),
  'a second match tells nobody');

-- Signed in as p1
select pg_temp.sign_in((select id from people where name = 'p1'));
set local role authenticated;

select is((select count(*)::int from public.my_notifications()), 2, 'p1 sees only their own two');
select is((select kind from public.my_notifications(1)), 'first_match', 'newest first, and the limit applies');
select is((select count(*)::int from public.notifications), 2, 'RLS hides other people''s rows from direct reads too');
select is((select email_opt_in from public.my_settings()), false, 'opted out by default');

select lives_ok($$select public.set_email_opt_in(true)$$, 'p1 opts in');
select is((select email_opt_in from public.my_settings()), true, 'and it is saved');
select throws_ok($$select * from public.notification_settings$$, '42501', null, 'the settings table stays closed');

select lives_ok(
  $$select public.mark_notifications_read(array(select id from public.notifications where user_id <> auth.uid()))$$,
  'marking someone else''s ids is harmless');
select lives_ok($$select public.mark_notifications_read(array(select id from public.my_notifications()))$$,
  'p1 marks theirs read');
select is((select count(*)::int from public.my_notifications() where read_at is null), 0, 'all read');
select throws_ok($$update public.notifications set read_at = null$$, '42501', null, 'no direct writes');
reset role;

select is(
  (select count(*)::int from public.notifications n join people p on p.id = n.user_id
    where p.name = 'p2' and n.read_at is not null),
  0, 'p2''s notifications were untouched');
select is(
  (select email_opt_in from internal.notify_validation(
     (select active_submission_id from public.bots where owner_id = (select id from people where name = 'p1')))),
  true, 'the worker sees the opt-in');

-- Signed out
select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok($$select * from public.my_notifications()$$, '42501', null, 'anon cannot read an inbox');
reset role;

select * from finish();
rollback;
