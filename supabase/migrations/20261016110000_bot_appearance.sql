-- Bot appearance (handoff A1): the character made in the Bot Forge is saved
-- on the bot, so it shows on every page and in every browser, not only in the
-- one that made it. Null means "not customised": the web draws the character
-- seeded from the bot's name.

-- The shape is BotGenome in web/lib/character/genome.ts:
--   {"v": 1, "head": 0-5, "eyes": 0-5, "antenna": 0-4, "mouth": 0-3, "pattern": 0-3, "signature": 0-4}
-- The web checks the exact ranges; the database only keeps the value small and well-formed.
alter table public.bots add column appearance jsonb
  check (appearance is null
         or (jsonb_typeof(appearance) = 'object' and octet_length(appearance::text) <= 512));

-- Players can't update public.bots directly (select only), so this is the one
-- write path. It only ever touches the caller's own bot.
-- Raises PS002 (no bot) or PS008 (unknown part or a value that isn't a small whole number).
create or replace function public.set_bot_appearance(p_appearance jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_appearance is not null then
    if jsonb_typeof(p_appearance) <> 'object' then
      raise exception 'Unknown appearance part' using errcode = 'PS008';
    end if;
    if exists (
      select 1 from jsonb_each(p_appearance) as part(k, val)
       where part.k not in ('v', 'head', 'eyes', 'antenna', 'mouth', 'pattern', 'signature')
          or case when jsonb_typeof(part.val) = 'number'
                  then part.val::numeric <> trunc(part.val::numeric)
                       or part.val::numeric not between 0 and 255
                  else true end
    ) then
      raise exception 'Unknown appearance part' using errcode = 'PS008';
    end if;
  end if;

  update public.bots set appearance = p_appearance where owner_id = (select auth.uid());
  if not found then
    raise exception 'You have no bot' using errcode = 'PS002';
  end if;
end;
$$;

revoke all on function public.set_bot_appearance(jsonb) from public, anon;
grant execute on function public.set_bot_appearance(jsonb) to authenticated;

-- Leaderboard rows carry the character too. Same as 20261016100000_names.sql,
-- plus appearance at the end: `create or replace` only allows appending
-- columns, and it keeps the view's grants in place.
create or replace view public.leaderboard with (security_invoker = true) as
select
  rank() over (order by b.elo - 2 * 350.0 / sqrt(1 + b.games) desc) as rank,
  b.id              as bot_id,
  b.name,
  p.handle,
  b.is_house,
  round(b.elo::numeric, 1)                                as elo,
  b.games,
  round((350.0 / sqrt(1 + b.games))::numeric, 1)          as sigma,
  round((b.elo - 2 * 350.0 / sqrt(1 + b.games))::numeric, 1) as conservative,
  b.active_version,
  b.active_since,
  p.display_name    as owner_name,
  b.appearance
from public.bots b
left join public.profiles p on p.id = b.owner_id
where b.active_submission_id is not null and not b.banned;
