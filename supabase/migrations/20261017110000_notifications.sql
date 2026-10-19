-- Notifications (handoff A10, plus A16): the /me inbox and opt-in email.
--
-- The worker records a notification after a version passes or is rejected and
-- after a bot's first match. Every one reaches the owner's inbox; the worker
-- also emails owners who opted in, when RESEND_API_KEY is set on the VM.
--
-- The opt-in lives in its own owner-only table, not on public.profiles as the
-- draft had it: profiles is publicly readable, so anyone could have listed
-- who opted in.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.notification_settings (
  user_id       uuid primary key references public.profiles (id) on delete cascade,
  email_opt_in  boolean not null default false,
  updated_at    timestamptz not null default now()
);

create table public.notifications (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('submission_passed', 'submission_rejected', 'first_match', 'final_results')),
  payload     jsonb not null default '{}' check (jsonb_typeof(payload) = 'object'),
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- Settings: functions only. Notifications: owners read their own rows, so
-- my_notifications (security invoker) and Realtime both go through RLS.
alter table public.notification_settings enable row level security;
alter table public.notifications enable row level security;
revoke all on public.notification_settings, public.notifications from anon, authenticated;
grant all on public.notification_settings, public.notifications to service_role;
grant select on public.notifications to authenticated;
create policy "owner reads own notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));

-- A16: the inbox can update without a refresh. RLS still applies, so each
-- person only receives their own rows.
alter publication supabase_realtime add table public.notifications;

-- ---------------------------------------------------------------------------
-- Player functions (the web calls these)
-- ---------------------------------------------------------------------------

-- Newest first, at most 100.
create or replace function public.my_notifications(p_limit int default 30)
returns setof public.notifications
language sql
stable
security invoker
set search_path = ''
as $$
  select *
    from public.notifications
   where user_id = (select auth.uid())
   order by created_at desc, id desc
   limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

-- Only the caller's own unread rows; other ids are ignored.
create or replace function public.mark_notifications_read(p_ids bigint[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications
     set read_at = now()
   where user_id = (select auth.uid()) and id = any(p_ids) and read_at is null;
$$;

create or replace function public.set_email_opt_in(p_opt_in boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  insert into public.notification_settings (user_id, email_opt_in, updated_at)
  values ((select auth.uid()), coalesce(p_opt_in, false), now())
  on conflict (user_id) do update set email_opt_in = excluded.email_opt_in, updated_at = excluded.updated_at;
end;
$$;

-- The caller's settings, with defaults when they never saved any.
create or replace function public.my_settings()
returns table (email_opt_in boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.email_opt_in from public.notification_settings s
                    where s.user_id = (select auth.uid())), false)
   where (select auth.uid()) is not null;
$$;

revoke all on function public.my_notifications(int), public.mark_notifications_read(bigint[]),
  public.set_email_opt_in(boolean), public.my_settings() from public, anon, authenticated;
grant execute on function public.my_notifications(int), public.mark_notifications_read(bigint[]),
  public.set_email_opt_in(boolean), public.my_settings() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Worker functions. Both record the notification and return one row per
-- person to tell, with what the worker needs to decide whether to email.
-- ---------------------------------------------------------------------------

-- Called after internal.complete_validation. House bots have no owner and get nothing.
create or replace function internal.notify_validation(p_submission uuid)
returns table (user_id uuid, email text, email_opt_in boolean, kind text, payload jsonb)
language plpgsql
set search_path = ''
as $$
declare
  v        record;
  v_kind   text;
  v_payload jsonb;
begin
  select b.owner_id, u.email, coalesce(ns.email_opt_in, false) as opt_in, s.status, s.version, s.error
    into v
    from public.submissions s
    join public.bots b on b.id = s.bot_id
    join auth.users u on u.id = b.owner_id
    left join public.notification_settings ns on ns.user_id = b.owner_id
   where s.id = p_submission;
  if v.owner_id is null or v.status not in ('active', 'rejected') then
    return;
  end if;

  if v.status = 'active' then
    v_kind := 'submission_passed';
    v_payload := jsonb_build_object('version', v.version);
  else
    v_kind := 'submission_rejected';
    v_payload := jsonb_build_object('version', v.version, 'error', v.error);
  end if;

  insert into public.notifications (user_id, kind, payload) values (v.owner_id, v_kind, v_payload);
  return query select v.owner_id, v.email::text, v.opt_in, v_kind, v_payload;
end;
$$;

-- Called after internal.complete_match. Tells owners whose bot just finished
-- its first match. Calling it twice for the same match tells nobody twice.
create or replace function internal.notify_match(p_match bigint)
returns table (user_id uuid, email text, email_opt_in boolean, kind text, payload jsonb)
language sql
set search_path = ''
as $$
  with firsts as (
    select b.owner_id, mp.placement
      from public.match_players mp
      join public.matches m on m.id = mp.match_id and m.status = 'done'
      join public.bots b on b.id = mp.bot_id and not b.is_house
     where mp.match_id = p_match
       and not exists (select 1
                         from public.match_players o
                         join public.matches om on om.id = o.match_id and om.status = 'done'
                        where o.bot_id = mp.bot_id and o.match_id <> p_match)
       and not exists (select 1 from public.notifications n
                        where n.user_id = b.owner_id and n.kind = 'first_match')
  ), ins as (
    insert into public.notifications (user_id, kind, payload)
    select owner_id, 'first_match', jsonb_build_object('match_id', p_match, 'placement', placement)
      from firsts
    returning notifications.user_id, notifications.kind, notifications.payload
  )
  select ins.user_id, u.email::text, coalesce(ns.email_opt_in, false), ins.kind, ins.payload
    from ins
    join auth.users u on u.id = ins.user_id
    left join public.notification_settings ns on ns.user_id = ins.user_id;
$$;

revoke all on function internal.notify_validation(uuid), internal.notify_match(bigint) from public;
