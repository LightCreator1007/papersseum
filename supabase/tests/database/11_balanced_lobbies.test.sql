-- Balanced lobbies: nobody plays a lobby of house bots only; players are spread evenly over the fewest lobbies.
begin;
select plan(9);

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

-- Sixteen players with Elo 100 apart and no jitter.
create temp table players as
select g as n, pg_temp.active_player('p' || g || '@iiitdmj.ac.in') as owner, null::uuid as bot
  from generate_series(1, 16) g;
update players p set bot = b.id from public.bots b where b.owner_id = p.owner;
update public.bots b set elo = 2000 - p.n * 100 from players p where b.id = p.bot;

-- Real players per match in a round, as a sorted array.
create function pg_temp.players_per_match(p_round bigint) returns int[] language sql as $$
  select array_agg(n order by n) from (
    select (count(*) filter (where not b.is_house))::int as n
      from public.matches m join public.match_players mp on mp.match_id = m.id
      join public.bots b on b.id = mp.bot_id
     where m.round_id = p_round group by m.id) x;
$$;
-- Pairs of matches with the same real players, at most `p_window` rounds apart.
create function pg_temp.player_repeats(p_window int) returns int language sql as $$
  with g as (
    select m.id, m.round_id, array_agg(mp.bot_id order by mp.bot_id) filter (where not b.is_house) as bots
      from public.matches m join public.match_players mp on mp.match_id = m.id
      join public.bots b on b.id = mp.bot_id group by m.id, m.round_id)
  select count(*)::int from g a join g b on a.bots = b.bots and a.id < b.id and b.round_id - a.round_id <= p_window;
$$;
create function pg_temp.reset_rounds() returns void language sql as $$
  delete from public.jobs; delete from public.rounds;
$$;
create function pg_temp.drop_players_above(p_n int) returns void language sql as $$
  delete from auth.users where id in (select owner from players where n > p_n);
  delete from players where n > p_n;
$$;

create temp table r1 as select internal.schedule_round() as id;
select is(pg_temp.players_per_match((select id from r1)), array[4, 4, 4, 4],
  '16 players: four lobbies of four, not 5, 5, 5 and 1');
select is(
  (select count(*)::int from public.match_players mp join public.matches m on m.id = mp.match_id
     join public.bots b on b.id = mp.bot_id where m.round_id = (select id from r1) and b.is_house), 4,
  'each lobby is topped up with one house bot');
select is(
  (select count(distinct mp.bot_id)::int from public.match_players mp join public.matches m on m.id = mp.match_id
     join public.bots b on b.id = mp.bot_id where m.round_id = (select id from r1) and not b.is_house), 16,
  'all 16 players are scheduled');

select internal.schedule_round() from generate_series(1, 5);
select is(
  (select min(n) from (select (count(*) filter (where not b.is_house))::int as n from public.matches m
     join public.match_players mp on mp.match_id = m.id join public.bots b on b.id = mp.bot_id group by m.id) x), 4,
  'over six rounds no lobby has fewer than four real players');
select is(pg_temp.player_repeats(4), 0, 'the same four players do not meet again within 4 rounds');

-- Other sizes
select pg_temp.reset_rounds();
select pg_temp.drop_players_above(12);
select is(pg_temp.players_per_match(internal.schedule_round()), array[4, 4, 4], '12 players: three lobbies of four');
select pg_temp.reset_rounds();
select pg_temp.drop_players_above(11);
select is(pg_temp.players_per_match(internal.schedule_round()), array[3, 4, 4], '11 players: lobbies of 4, 4 and 3');
select pg_temp.reset_rounds();
select pg_temp.drop_players_above(6);
select is(pg_temp.players_per_match(internal.schedule_round()), array[3, 3], '6 players: two lobbies of three');
select pg_temp.reset_rounds();
select pg_temp.drop_players_above(3);
select is(pg_temp.players_per_match(internal.schedule_round()), array[3], '3 players: one lobby, with two house bots');

select * from finish();
rollback;
