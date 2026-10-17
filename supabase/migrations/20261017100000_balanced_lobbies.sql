-- Balanced lobbies: nobody plays a lobby of house bots only.
--
-- Before: the sorted players were cut into lobbies of exactly 5 and the leftover (for 16 players,
-- one player) got a lobby of four house bots. That player was always at the end of the sorted
-- list, i.e. one of the top-rated bots, who then collected easy wins against house bots.
--
-- Now: the fewest lobbies that fit everyone (ceil(players / 5)), with sizes as equal as possible,
-- topped up to 5 seats with house bots. 16 players -> four lobbies of 4 players + 1 house bot. With
-- 6 or more players every lobby has at least 3 real players. Lobbies are still cut from the
-- rating-sorted list (plus jitter), so opponents are similar in strength but vary between rounds.

-- True if all of these submissions already met in one match in round `p_since` or later.
-- Used for short lobbies, where the house bot added as padding would otherwise hide a repeat.
create or replace function internal.students_played(p_submissions uuid[], p_since bigint)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.matches m
     where m.round_id >= p_since
       and not exists (
         select s from unnest(p_submissions) as s
         except
         select mp.submission_id from public.match_players mp where mp.match_id = m.id));
$$;

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
  v_l       integer;                 -- number of lobbies
  v_base    integer;
  v_extra   integer;
  v_starts  integer[];               -- first and last pool position of every lobby
  v_ends    integer[];
  v_len     integer;
  v_pos     integer;
  v_tmp     uuid;
  i         integer;
  k         integer;
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
    v_l := (v_n + c_lobby - 1) / c_lobby;        -- fewest lobbies that fit everybody
    v_base := v_n / v_l;
    v_extra := v_n % v_l;                        -- the first v_extra lobbies get one more player
    v_starts := '{}'; v_ends := '{}';
    v_pos := 1;
    for k in 1..v_l loop
      v_len := v_base + case when k <= v_extra then 1 else 0 end;
      v_starts := v_starts || v_pos;
      v_ends := v_ends || (v_pos + v_len - 1);
      v_pos := v_pos + v_len;
    end loop;

    if v_n % c_lobby = 0 then
      -- Every lobby is full: repair repeats. A seat at distance d - a inside the lobby swaps with
      -- the bot a places outside it, after or before; a swap into the previous lobby must leave
      -- that one fresh too.
      i := 1;
      while i <= v_n loop
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
    elsif v_l > 1 then
      -- Short lobbies: if the same players already met within the window, swap one of them with a
      -- player across the boundary to the next or previous lobby (the closest swap that makes both
      -- lobbies fresh). If nothing fresh is found the repeat is played anyway.
      for k in 1..v_l loop
        if internal.students_played(v_pool[v_starts[k] : v_ends[k]], v_since) then
          <<search_short>>
          for d in 1..c_reach loop
            for side in 0..1 loop
              if side = 0 and k < v_l then
                m := v_ends[k] - (d - 1);
                j := v_ends[k] + d;
                continue when m < v_starts[k] or j > v_ends[k + 1];
              elsif side = 1 and k > 1 then
                m := v_starts[k] + (d - 1);
                j := v_starts[k] - d;
                continue when m > v_ends[k] or j < v_starts[k - 1];
              else
                continue;
              end if;

              v_tmp := v_pool[m]; v_pool[m] := v_pool[j]; v_pool[j] := v_tmp;
              if not internal.students_played(v_pool[v_starts[k] : v_ends[k]], v_since)
                 and not internal.students_played(
                       v_pool[v_starts[case when side = 0 then k + 1 else k - 1 end] :
                              v_ends[case when side = 0 then k + 1 else k - 1 end]], v_since) then
                exit search_short;
              end if;
              v_pool[j] := v_pool[m]; v_pool[m] := v_tmp;
            end loop;
          end loop;
        end if;
      end loop;
    end if;

    for k in 1..v_l loop
      v_group := v_pool[v_starts[k] : v_ends[k]];

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
    end loop;
  end loop;

  return v_round;
end;
$$;
