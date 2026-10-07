-- Match results: locking, rating updates, history, leaderboard order.
begin;
select plan(14);

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

select pg_temp.active_player('p' || g || '@iiitdmj.ac.in') from generate_series(1, 5) g;
select internal.schedule_round();
create temp table job as select internal.claim_job('w1', 'h') as p;
create temp table m as select (p->>'match_id')::bigint as id, (p->>'job_id')::bigint as job from job;

-- lock_match_bots returns current ratings, one row per seat
create temp table locked as select * from internal.lock_match_bots((select id from m));
select is((select count(*)::int from locked), 5, 'lock_match_bots returns all 5 seats');
select is((select array_agg(slot order by slot) from locked), array[0, 1, 2, 3, 4]::smallint[], 'ordered by seat');
select ok((select bool_and(elo = 1000 and games = 0) from locked), 'with current ratings');

-- The worker reports: seat 0 wins ... seat 4 last
select internal.complete_match((select job from m), 'w1',
  (select jsonb_agg(jsonb_build_object(
     'slot', slot, 'placement', slot + 1, 'coverage', 40 - slot * 8, 'deaths', slot,
     'strikes', 0, 'crashed', slot = 4, 'score', 48 - slot * 10, 'elo_after', 1020 - slot * 10))
   from locked),
  (select id from m) || '.jsonl.gz', 'h');

select results_eq(
  format('select slot, placement, elo_before, elo_after from public.match_players where match_id = %s order by slot', (select id from m)),
  $$values (0::smallint, 1::smallint, 1000::float8, 1020::float8), (1::smallint, 2::smallint, 1000::float8, 1010::float8),
           (2::smallint, 3::smallint, 1000::float8, 1000::float8), (3::smallint, 4::smallint, 1000::float8, 990::float8),
           (4::smallint, 5::smallint, 1000::float8, 980::float8)$$,
  'placements and rating history are stored per seat');
select is(
  (select crashed from public.match_players where match_id = (select id from m) and slot = 4), true,
  'crashes are recorded');
select results_eq(
  format('select b.elo, b.games from public.match_players mp join public.bots b on b.id = mp.bot_id where mp.match_id = %s order by mp.slot', (select id from m)),
  $$values (1020::float8, 1), (1010::float8, 1), (1000::float8, 1), (990::float8, 1), (980::float8, 1)$$,
  'bot ratings and games played are updated');
select is((select status::text from public.matches where id = (select id from m)), 'done', 'the match is done');
select is((select replay_path from public.matches where id = (select id from m)), (select id from m) || '.jsonl.gz',
  'the replay path is stored');
select is((select engine_hash from public.matches where id = (select id from m)), 'h', 'the engine hash is stored');
select is((select status::text from public.jobs where id = (select job from m)), 'done', 'the job is done');
select is((select current_job from public.workers where id = 'w1'), null, 'the worker is free again');

-- Reporting twice is refused (ratings would be applied twice)
select throws_like(
  format($$select internal.complete_match(%s, 'w1', '[]', 'x', 'h')$$, (select job from m)),
  '%is not running%', 'a finished match cannot be reported again');

-- Leaderboard order follows the conservative rating
select is(
  (select bot_id from public.leaderboard where rank = 1),
  (select bot_id from public.match_players where match_id = (select id from m) and slot = 0),
  'the winner tops the leaderboard');
select is(
  (select conservative from public.leaderboard where rank = 1),
  round((1020 - 2 * 350.0 / sqrt(2))::numeric, 1),
  'conservative rating = elo - 2 * 350 / sqrt(1 + games), as in rating.py');

select * from finish();
rollback;
