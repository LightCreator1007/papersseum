-- Owner names from the Google account, and the one-per-season bot rename
-- (handoff ask A6, web/specs/2026-10-15-db-handoff.md).
--
-- A bot shows two names: its own (bots.name, unique, in URLs, renamable once a
-- season) and its owner's (profiles.display_name, the Google account name).

-- ---------------------------------------------------------------------------
-- Owner names
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column display_name text check (char_length(display_name) between 1 and 64);

-- The name Google sent: full_name, else name. Whitespace collapsed; an
-- all-capitals name (institute accounts send "ARUNIT CHAKRABORTY") is
-- title-cased, anything else is kept as given. Null when there is none.
create or replace function internal.display_name_from(p_meta jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text;
begin
  v := coalesce(nullif(btrim(p_meta ->> 'full_name'), ''), p_meta ->> 'name');
  v := btrim(regexp_replace(coalesce(v, ''), '[[:space:][:cntrl:]]+', ' ', 'g'));
  if v = '' then
    return null;
  end if;
  if v = upper(v) and v <> lower(v) then
    v := initcap(v);
  end if;
  return left(v, 64);
end;
$$;

-- Same as 20261007100300_signup.sql, plus the owner name.
create or replace function internal.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_domain text;
  v_base   text;
  v_handle text;
begin
  select allowed_email_domain into v_domain from public.season where id = 1;
  -- Exact domain match; a missing email is denied (a NULL comparison would let it through).
  if v_domain is not null
     and (new.email is null or lower(split_part(new.email, '@', 2)) <> lower(v_domain)) then
    raise exception 'Sign-ups are limited to @% email addresses', v_domain;
  end if;

  v_base := left(regexp_replace(lower(split_part(coalesce(new.email, ''), '@', 1)), '[^a-z0-9_]', '', 'g'), 24);
  if length(v_base) < 2 then
    v_base := 'player';
  end if;
  v_handle := v_base;
  if exists (select 1 from public.profiles where handle = v_handle)
     or exists (select 1 from public.bots where name = v_handle) then
    v_handle := v_base || '_' || substr(md5(random()::text), 1, 4);
  end if;

  insert into public.profiles (id, handle, display_name)
  values (new.id, v_handle, internal.display_name_from(new.raw_user_meta_data));
  insert into public.bots (owner_id, name) values (new.id, v_handle);
  return new;
end;
$$;

-- Supabase rewrites raw_user_meta_data from Google on every sign-in, so a
-- changed account name reaches the site the next time its owner signs in.
create or replace function internal.refresh_display_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set display_name = internal.display_name_from(new.raw_user_meta_data)
   where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_meta_updated
  after update of raw_user_meta_data on auth.users
  for each row
  when (old.raw_user_meta_data is distinct from new.raw_user_meta_data)
  execute function internal.refresh_display_name();

update public.profiles p
   set display_name = internal.display_name_from(u.raw_user_meta_data)
  from auth.users u
 where u.id = p.id;

-- Same as 20261007100200_access_control.sql, plus owner_name at the end.
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
  p.display_name    as owner_name
from public.bots b
left join public.profiles p on p.id = b.owner_id
where b.active_submission_id is not null and not b.banned;

-- ---------------------------------------------------------------------------
-- Rename, once a season. Old names stay reserved and keep resolving, so a
-- shared link never ends up on someone else's bot. Clear bot_name_aliases
-- between seasons to give everyone their rename back.
-- ---------------------------------------------------------------------------

create table public.bot_name_aliases (
  old_name    text primary key check (old_name ~ '^[a-z0-9_]{2,32}$'),
  bot_id      uuid not null references public.bots (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index bot_name_aliases_bot_idx on public.bot_name_aliases (bot_id);

alter table public.bot_name_aliases enable row level security;
revoke all on public.bot_name_aliases from anon, authenticated;
grant all on public.bot_name_aliases to service_role;
grant select on public.bot_name_aliases to anon, authenticated;
create policy "public read" on public.bot_name_aliases for select to anon, authenticated using (true);

create or replace function public.rename_bot(p_new_name text)
returns table (name text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_bot public.bots;
begin
  select * into v_bot from public.bots where owner_id = (select auth.uid()) for update;
  if not found then
    raise exception 'You have no bot' using errcode = 'PS002';
  end if;
  if v_bot.banned then
    raise exception 'This bot is banned' using errcode = 'PS003';
  end if;
  if p_new_name is null or p_new_name !~ '^[a-z0-9_]{2,32}$' then
    raise exception 'Invalid name' using errcode = 'PS009';
  end if;
  if p_new_name = v_bot.name then
    return query select v_bot.name;  -- nothing to do; the rename isn't used up
    return;
  end if;
  if exists (select 1 from public.bot_name_aliases a where a.bot_id = v_bot.id) then
    raise exception 'Already renamed this season' using errcode = 'PS005';
  end if;
  if exists (select 1 from public.bot_name_aliases a where a.old_name = p_new_name) then
    raise exception 'Name is reserved' using errcode = '23505';
  end if;

  insert into public.bot_name_aliases (old_name, bot_id) values (v_bot.name, v_bot.id);
  update public.bots set name = p_new_name where id = v_bot.id;  -- a taken name raises 23505
  return query select p_new_name;
end;
$$;

-- The current name of a bot that used to be called p_name, or null.
create or replace function public.resolve_bot_name(p_name text)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select b.name
    from public.bot_name_aliases a
    join public.bots b on b.id = a.bot_id
   where a.old_name = p_name;
$$;

revoke all on function public.rename_bot(text) from public, anon, authenticated;
grant execute on function public.rename_bot(text) to authenticated, service_role;
revoke all on function public.resolve_bot_name(text) from public, anon, authenticated;
grant execute on function public.resolve_bot_name(text) to anon, authenticated, service_role;
