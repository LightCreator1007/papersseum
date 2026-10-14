-- Repeat lobbies: the same bots running the same code don't meet again within the window.
begin;
select plan(15);

delete from public.jobs; delete from public.rounds; delete from public.workers; delete from auth.users;
update public.season set frozen = false, games_per_round = 1, max_backlog = 1000, matchmaking_noise = 0,
       repeat_window_rounds = 4, allowed_email_domain = 'iiitdmj.ac.in';

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

-- Ten players with Elo 100 apart and no jitter, so without the guard every
-- round would cut the same two lobbies.
create temp table players as
select g as n, pg_temp.active_player('p' || g || '@iiitdmj.ac.in') as owner, null::uuid as bot
  from generate_series(1, 10) g;
update players p set bot = b.id from public.bots b where b.owner_id = p.owner;
update public.bots b set elo = 2000 - p.n * 100 from players p where b.id = p.bot;

-- Each match of a round as sorted player numbers (house bots are 0).
create function pg_temp.lobbies(p_round bigint) returns setof int[] language sql as $$
  select array_agg(coalesce(p.n, 0) order by coalesce(p.n, 0))
    from public.matches m
    join public.match_players mp on mp.match_id = m.id
    left join players p on p.bot = mp.bot_id
   where m.round_id = p_round
   group by m.id;
$$;
-- Pairs of matches with the same lobby at most `p_window` rounds apart.
create function pg_temp.repeats(p_window int) returns int language sql as $$
  select count(*)::int
    from public.matches a
    join public.matches b on b.lobby_key = a.lobby_key and a.id < b.id and b.round_id - a.round_id <= p_window;
$$;
create function pg_temp.upload(p_n int, p_sha text) returns void language plpgsql as $$
declare v_bot uuid := (select bot from players where n = p_n); v_sub uuid; v_version int;
begin
  select max(version) + 1 into v_version from public.submissions where bot_id = v_bot;
  insert into public.submissions (bot_id, version, storage_path, sha256, status, validated_at)
  values (v_bot, v_version, 'bot/v' || v_version || '.py', p_sha, 'active', now())
  returning id into v_sub;
  update public.bots set active_submission_id = v_sub, active_version = v_version, active_since = now()
   where id = v_bot;
end $$;
create function pg_temp.reset_rounds() returns void language sql as $$
  delete from public.jobs; delete from public.rounds;
$$;
create function pg_temp.drop_players_above(p_n int) returns void language sql as $$
  delete from auth.users where id in (select owner from players where n > p_n);
  delete from players where n > p_n;
$$;

-- The key
select is(
  internal.lobby_key(array(select active_submission_id from public.bots where is_house order by name)),
  internal.lobby_key(array(select active_submission_id from public.bots where is_house order by name desc)),
  'seat order does not change the lobby key');

-- Without a window the next round repeats both lobbies
update public.season set repeat_window_rounds = 0;
select internal.schedule_round() from generate_series(1, 2);
select is(pg_temp.repeats(1), 2, 'with a window of 0 the next round repeats both lobbies');

-- With the default window of 4
select pg_temp.reset_rounds();
update public.season set repeat_window_rounds = 4;
select internal.schedule_round() from generate_series(1, 6);
select is(pg_temp.repeats(4), 0, 'no lobby repeats within 4 rounds');
select is((select count(*)::int from public.matches), 12, 'every round still has two full lobbies');
select is(
  (select count(distinct (m.round_id, mp.bot_id))::int from public.matches m
     join public.match_players mp on mp.match_id = m.id join players p on p.bot = mp.bot_id), 60,
  'all ten players play exactly once in each of the 6 rounds');
select is(
  (select count(*)::int from public.rounds r, pg_temp.lobbies(r.id) l where 1 = any(l) and 10 = any(l)), 0,
  'repair swaps stay local: the best and worst players never share a lobby');

-- Two games in one round
select pg_temp.reset_rounds();
update public.season set games_per_round = 2;
select internal.schedule_round();
select is((select count(*)::int from public.matches), 4, 'two games per round: four lobbies');
select is(pg_temp.repeats(0), 0, 'the second game of a round uses new lobbies');
update public.season set games_per_round = 1;

-- New code makes a new lobby; the same file does not.
-- Six players: the lowest-rated five (2-6) fill a lobby, player 1 gets house bots.
select pg_temp.reset_rounds();
select pg_temp.drop_players_above(6);
create temp table e1 as select internal.schedule_round() as id;
select ok(exists(select 1 from pg_temp.lobbies((select id from e1)) l where l = array[2, 3, 4, 5, 6]),
  'players 2-6 share a lobby');
select pg_temp.upload(2, 'sha-v2');
create temp table e2 as select internal.schedule_round() as id;
select ok(exists(select 1 from pg_temp.lobbies((select id from e2)) l where l = array[2, 3, 4, 5, 6]),
  'after player 2 uploads new code, players 2-6 can meet again');
select pg_temp.upload(2, 'sha-v2');
create temp table e3 as select internal.schedule_round() as id;
select ok(not exists(select 1 from pg_temp.lobbies((select id from e3)) l where l = array[2, 3, 4, 5, 6]),
  're-uploading the same file still counts as a repeat');

-- Five players: the repeat can't be avoided, so it is played
select pg_temp.reset_rounds();
select pg_temp.drop_players_above(5);
select internal.schedule_round() from generate_series(1, 2);
select is((select count(*)::int from public.matches), 2, 'with five players every round is still scheduled');
select is(pg_temp.repeats(1), 1, 'and the unavoidable repeat is played');

-- Four players: the house seat rotates
select pg_temp.reset_rounds();
select pg_temp.drop_players_above(4);
select internal.schedule_round() from generate_series(1, 5);
select is(pg_temp.repeats(4), 0, 'a short lobby tries other house bots instead of repeating');
select is(
  (select count(distinct mp.bot_id)::int from public.match_players mp
     join public.bots b on b.id = mp.bot_id where b.is_house), 5,
  'every house bot gets a turn');

select * from finish();
rollback;
