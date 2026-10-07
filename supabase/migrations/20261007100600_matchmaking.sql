-- Matchmaking: build a round of matches from every active bot (run by pg_cron).

-- Every active, non-banned player bot plays `games_per_round` matches.
-- Bots are sorted by Elo plus random jitter and cut into lobbies of 5, so
-- opponents are similar but not always the same. Short lobbies are filled
-- with house bots, and seats are shuffled. Skips the round when the season is
-- frozen or the backlog is too big (e.g. no worker online).
-- Returns the new round id, or null if nothing was scheduled.
create or replace function internal.schedule_round()
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  c_lobby   constant integer := 5;   -- papersseum.constants.N_PLAYERS
  v_season  public.season;
  v_backlog integer;
  v_house   uuid[];
  v_pool    uuid[];
  v_group   uuid[];
  v_round   bigint;
  v_match   bigint;
  v_n       integer;
  i         integer;
begin
  select * into v_season from public.season where id = 1;
  if v_season.frozen then
    return null;
  end if;

  select count(*) into v_backlog
    from public.jobs where kind = 'match' and status in ('queued', 'running');
  if v_backlog >= v_season.max_backlog then
    return null;
  end if;

  select array_agg(id) into v_house
    from public.bots
   where is_house and not banned and active_submission_id is not null;

  for rep in 1..v_season.games_per_round loop
    select array_agg(id order by elo + (random() - 0.5) * v_season.matchmaking_noise)
      into v_pool
      from public.bots
     where not is_house and not banned and active_submission_id is not null;

    exit when v_pool is null;

    if v_round is null then
      insert into public.rounds (kind) values ('ladder') returning id into v_round;
    end if;

    v_n := array_length(v_pool, 1);
    i := 1;
    while i <= v_n loop
      v_group := v_pool[i : least(i + c_lobby - 1, v_n)];

      if array_length(v_group, 1) < c_lobby then
        v_group := v_group || coalesce((
          select array_agg(h)
            from (select h from unnest(v_house) as h
                   order by random()
                   limit c_lobby - array_length(v_group, 1)) as pad
        ), '{}');
      end if;

      if array_length(v_group, 1) = c_lobby then
        insert into public.matches (round_id, seed)
        values (v_round, floor(random() * 2147483647)::bigint)
        returning id into v_match;

        insert into public.match_players (match_id, slot, bot_id, submission_id)
        select v_match, (row_number() over (order by random()) - 1)::smallint,
               b.id, b.active_submission_id
          from unnest(v_group) as g(id)
          join public.bots b on b.id = g.id;

        insert into public.jobs (kind, match_id) values ('match', v_match);
      end if;

      i := i + c_lobby;
    end loop;
  end loop;

  return v_round;
end;
$$;
