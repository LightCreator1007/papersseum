-- Repeat-lobby guard: the same five bots running the same code should not
-- meet again within a few rounds, so groups keep mixing and ratings converge
-- across the whole ladder instead of inside fixed cliques.

alter table public.season
  add column repeat_window_rounds smallint not null default 4
    check (repeat_window_rounds between 0 and 96);  -- a lobby can't repeat in this round or the previous N

-- Who played, running what: a hash of the sorted (bot, code hash) seats.
-- Uploading different code makes a new key; re-uploading the same file keeps
-- the old one. House bots have no file, so their built-in name stands in.
alter table public.matches add column lobby_key text;

create or replace function internal.lobby_key(p_submissions uuid[])
returns text
language sql
stable
set search_path = ''
as $$
  select md5(string_agg(seat, ',' order by seat))
    from (select s.bot_id::text || ':' || coalesce(s.sha256, s.builtin, s.id::text) as seat
            from public.submissions s
           where s.id = any(p_submissions)) as seats;
$$;

-- True if this lobby was already scheduled in round `p_since` or later.
create or replace function internal.lobby_played(p_submissions uuid[], p_since bigint)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.matches
     where lobby_key = internal.lobby_key(p_submissions) and round_id >= p_since
  );
$$;

update public.matches m
   set lobby_key = internal.lobby_key(array(
         select mp.submission_id from public.match_players mp where mp.match_id = m.id));

create index matches_lobby_key_idx on public.matches (lobby_key, round_id);

-- Same as before, plus: a full lobby that was played within the repeat window
-- swaps a seat with a nearby bot (closest sorted positions first), and the
-- short lobby tries other house bots. If nothing fresh is found the repeat is
-- played anyway, e.g. when there are only five players.
create or replace function internal.schedule_round()
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  c_lobby   constant integer := 5;   -- papersseum.constants.N_PLAYERS
  c_reach   constant integer := 4;   -- how far a repair swap may reach; < c_lobby
  v_season  public.season;
  v_backlog integer;
  v_house   uuid[];
  v_shuffled uuid[];
  v_h       integer;
  v_need    integer;
  v_pool    uuid[];                  -- active submission ids, sorted by jittered Elo
  v_group   uuid[];
  v_padded  uuid[];
  v_round   bigint;
  v_since   bigint;                  -- oldest round inside the repeat window
  v_match   bigint;
  v_n       integer;
  v_full    integer;                 -- seats that form full lobbies
  v_tmp     uuid;
  i         integer;
  m         integer;
  j         integer;
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

  select array_agg(active_submission_id) into v_house
    from public.bots
   where is_house and not banned and active_submission_id is not null;

  for rep in 1..v_season.games_per_round loop
    select array_agg(active_submission_id order by elo + (random() - 0.5) * v_season.matchmaking_noise)
      into v_pool
      from public.bots
     where not is_house and not banned and active_submission_id is not null;

    exit when v_pool is null;

    if v_round is null then
      insert into public.rounds (kind) values ('ladder') returning id into v_round;
      select min(id) into v_since
        from (select id from public.rounds order by id desc
               limit v_season.repeat_window_rounds + 1) as recent;
    end if;

    v_n := array_length(v_pool, 1);
    v_full := v_n - v_n % c_lobby;

    -- Repair full lobbies. A seat at distance d - a inside the lobby swaps with
    -- the bot a places outside it, after or before; a swap into the previous
    -- lobby must leave that one fresh too.
    i := 1;
    while i <= v_full loop
      if internal.lobby_played(v_pool[i : i + c_lobby - 1], v_since) then
        <<search>>
        for d in 1..c_reach loop
          for a in 1..d loop
            for side in 0..1 loop
              if side = 0 then
                m := i + c_lobby - 1 - (d - a);
                j := i + c_lobby - 1 + a;
                continue when j > v_n;
              else
                m := i + (d - a);
                j := i - a;
                continue when j < 1;
              end if;

              v_tmp := v_pool[m]; v_pool[m] := v_pool[j]; v_pool[j] := v_tmp;
              if not internal.lobby_played(v_pool[i : i + c_lobby - 1], v_since)
                 and (side = 0 or not internal.lobby_played(v_pool[i - c_lobby : i - 1], v_since)) then
                exit search;
              end if;
              v_pool[j] := v_pool[m]; v_pool[m] := v_tmp;
            end loop;
          end loop;
        end loop;
      end if;
      i := i + c_lobby;
    end loop;

    i := 1;
    while i <= v_n loop
      v_group := v_pool[i : least(i + c_lobby - 1, v_n)];

      -- Short lobby: shuffle the house bots, then try each rotation of them
      -- until the padded lobby is fresh, so every house bot gets a turn.
      if array_length(v_group, 1) < c_lobby then
        v_need := c_lobby - array_length(v_group, 1);
        v_shuffled := array(select h from unnest(v_house) as h order by random());
        v_h := coalesce(array_length(v_shuffled, 1), 0);
        for draw in 0..greatest(v_h - 1, 0) loop
          v_padded := v_group || array(
            select v_shuffled[1 + (draw + x) % v_h] from generate_series(0, least(v_need, v_h) - 1) as x);
          exit when not internal.lobby_played(v_padded, v_since);
        end loop;
        v_group := v_padded;
      end if;

      if array_length(v_group, 1) = c_lobby then
        insert into public.matches (round_id, seed, lobby_key)
        values (v_round, floor(random() * 2147483647)::bigint, internal.lobby_key(v_group))
        returning id into v_match;

        insert into public.match_players (match_id, slot, bot_id, submission_id)
        select v_match, (row_number() over (order by random()) - 1)::smallint, s.bot_id, s.id
          from unnest(v_group) as g(id)
          join public.submissions s on s.id = g.id;

        insert into public.jobs (kind, match_id) values ('match', v_match);
      end if;

      i := i + c_lobby;
    end loop;
  end loop;

  return v_round;
end;
$$;
