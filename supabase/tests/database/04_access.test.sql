-- Access rules: what anonymous visitors and signed-in players can and cannot do.
begin;
select plan(17);

delete from public.jobs; delete from public.rounds; delete from public.workers; delete from auth.users;
update public.season set frozen = false, allowed_email_domain = 'iiitdmj.ac.in';

create function pg_temp.new_user(p_email text) returns uuid language sql as $$
  insert into auth.users (id, email, instance_id, aud, role)
  values (gen_random_uuid(), p_email, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
  returning id;
$$;
-- A player with one validated (active) upload.
create function pg_temp.active_player(p_email text) returns uuid language plpgsql as $$
declare v_user uuid; v_sub uuid := gen_random_uuid();
begin
  v_user := pg_temp.new_user(p_email);
  perform public.api_create_submission(v_user, v_sub, 'bot/' || v_sub || '.py', 'sha', 100);
  update public.submissions set status = 'active', validated_at = now() where id = v_sub;
  update public.bots set active_submission_id = v_sub, active_version = 1, active_since = now()
   where owner_id = v_user;
  return v_user;
end $$;

create temp table people (name text primary key, id uuid);
insert into people values ('alice', pg_temp.active_player('alice@iiitdmj.ac.in')),
                          ('bob',   pg_temp.active_player('bob@iiitdmj.ac.in'));
grant select on people to anon, authenticated;

-- Anonymous visitor
set local role anon;
select is((select count(*)::int from public.leaderboard), 7, 'anon sees the leaderboard (2 players + 5 house bots)');
select is((select count(*)::int from public.bots), 7, 'anon can read bots');
select throws_ok('select * from public.submissions', '42501', null, 'anon cannot read submissions');
select throws_ok('select * from public.jobs',        '42501', null, 'anon cannot read jobs');
select throws_ok('select * from public.workers',     '42501', null, 'anon cannot read workers');
select throws_ok('select * from public.admins',      '42501', null, 'anon cannot read admins');
select throws_ok($$select internal.claim_job('x', null)$$, '42501', null, 'anon cannot claim jobs');
select throws_ok($$select public.api_create_submission(gen_random_uuid(), gen_random_uuid(), 'x', 'x', 1)$$,
  '42501', null, 'anon cannot create submissions directly');
select throws_ok('update public.bots set elo = 9999', '42501', null, 'anon cannot change ratings');
reset role;

-- Signed in as alice
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from people where name = 'alice'), 'role', 'authenticated')::text, true);
set local role authenticated;
select is((select count(*)::int from public.submissions), 1, 'alice sees exactly one submission');
select is(
  (select b.owner_id from public.submissions s join public.bots b on b.id = s.bot_id limit 1),
  (select id from people where name = 'alice'),
  'and it is her own');
select throws_ok('update public.bots set elo = 9999', '42501', null, 'alice cannot change ratings');
select throws_ok($$insert into public.submissions (bot_id, version, storage_path)
                   select id, 50, 'x.py' from public.bots limit 1$$,
  '42501', null, 'alice cannot insert submissions directly');
select throws_ok('select * from public.jobs', '42501', null, 'alice cannot read jobs');
select throws_ok($$insert into public.admins (user_id) values (auth.uid())$$, '42501', null, 'alice cannot make herself admin');
select throws_ok($$select internal.complete_match(1, 'x', '[]', 'x', 'x')$$, '42501', null, 'alice cannot report match results');
reset role;

-- Signed in as bob: alice's submission stays hidden
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from people where name = 'bob'), 'role', 'authenticated')::text, true);
set local role authenticated;
select is(
  (select count(*)::int from public.submissions s join public.bots b on b.id = s.bot_id
     where b.owner_id = (select id from people where name = 'alice')), 0,
  'bob cannot see alice''s submissions');
reset role;

select * from finish();
rollback;
