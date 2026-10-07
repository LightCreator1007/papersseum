-- Matchmaking: who gets scheduled, lobby sizes, house-bot padding, backlog and freeze.
begin;
select plan(16);

delete from public.jobs; delete from public.rounds; delete from public.workers; delete from auth.users;
update public.season set frozen = false, games_per_round = 1, max_backlog = 60, allowed_email_domain = 'iiitdmj.ac.in';

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

-- Nobody to schedule
select is(internal.schedule_round(), null, 'no players: no round');
select is((select count(*)::int from public.rounds), 0, 'and no round row');

-- 7 active players, 1 banned, 1 who never uploaded
select pg_temp.active_player('p' || g || '@iiitdmj.ac.in') from generate_series(1, 7) g;
create temp table cheater as select pg_temp.active_player('cheater@iiitdmj.ac.in') as id;
update public.bots set banned = true where owner_id = (select id from cheater);
select pg_temp.new_user('lurker@iiitdmj.ac.in');

create temp table r1 as select internal.schedule_round() as id;
select isnt((select id from r1), null, 'a round is created');
select is((select count(*)::int from public.matches where round_id = (select id from r1)), 2, '7 players -> 2 matches');
select is(
  (select count(*)::int from (select match_id from public.match_players mp join public.matches m on m.id = mp.match_id
     where m.round_id = (select id from r1) group by match_id having count(*) = 5) full_lobbies), 2,
  'every match has exactly 5 seats');
select is(
  (select count(distinct mp.bot_id)::int from public.match_players mp
     join public.matches m on m.id = mp.match_id join public.bots b on b.id = mp.bot_id
    where m.round_id = (select id from r1) and not b.is_house), 7,
  'all 7 active players are scheduled');
select is(
  (select max(n)::int from (select count(*) as n from public.match_players mp
     join public.matches m on m.id = mp.match_id join public.bots b on b.id = mp.bot_id
    where m.round_id = (select id from r1) and not b.is_house group by mp.bot_id) per_bot), 1,
  'each player plays once per round');
select is(
  (select count(*)::int from public.match_players mp join public.matches m on m.id = mp.match_id
     join public.bots b on b.id = mp.bot_id where m.round_id = (select id from r1) and b.is_house), 3,
  'the short lobby is filled with 3 house bots');
select is(
  (select count(*)::int from (select mp.match_id, mp.bot_id from public.match_players mp
     join public.matches m on m.id = mp.match_id where m.round_id = (select id from r1)
    group by 1, 2 having count(*) > 1) dupes), 0,
  'no bot appears twice in the same match');
select is(
  (select count(*)::int from public.match_players mp join public.matches m on m.id = mp.match_id
     join public.bots b on b.id = mp.bot_id
    where m.round_id = (select id from r1) and (b.banned or b.active_submission_id is null)), 0,
  'banned bots and bots without an upload are left out');
select is(
  (select count(*)::int from public.match_players mp join public.matches m on m.id = mp.match_id
     join public.bots b on b.id = mp.bot_id
    where m.round_id = (select id from r1) and mp.submission_id is distinct from b.active_submission_id), 0,
  'each seat records the exact version being played');
select is(
  (select count(*)::int from public.jobs j join public.matches m on m.id = j.match_id
    where m.round_id = (select id from r1) and j.kind = 'match' and j.status = 'queued'), 2,
  'one queued job per match');

-- More games per round
update public.season set games_per_round = 2;
create temp table r2 as select internal.schedule_round() as id;
select is(
  (select min(n)::int from (select count(*) as n from public.match_players mp
     join public.matches m on m.id = mp.match_id join public.bots b on b.id = mp.bot_id
    where m.round_id = (select id from r2) and not b.is_house group by mp.bot_id) per_bot), 2,
  'with games_per_round = 2 every player plays twice');

-- Backlog guard: no worker is draining the queue
update public.season set max_backlog = (select count(*) from public.jobs where kind = 'match' and status = 'queued');
select is(internal.schedule_round(), null, 'no new round while the backlog is full');

-- Frozen season
update public.season set max_backlog = 1000, frozen = true, games_per_round = 1;
select is(internal.schedule_round(), null, 'no ladder rounds while the season is frozen');
update public.season set frozen = false;

-- Lobby padding when there are fewer players than seats
delete from public.jobs; delete from public.rounds; delete from auth.users;
select pg_temp.active_player('solo@iiitdmj.ac.in');
create temp table r3 as select internal.schedule_round() as id;
select is(
  (select count(*)::int from public.match_players mp join public.matches m on m.id = mp.match_id
    where m.round_id = (select id from r3)), 5,
  'a single player still gets a full match against house bots');

select * from finish();
rollback;
