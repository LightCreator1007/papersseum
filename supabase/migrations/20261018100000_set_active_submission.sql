-- Make an older version active (handoff A7): "Make active" on /me/versions.

-- A version that passed on the current engine switches at once, with the same
-- writes internal.complete_validation makes when a version passes. One that
-- passed on an older engine goes back to 'pending' with a validation job, so
-- /me/versions shows it being checked; complete_validation makes it active if
-- it passes. The version playing now keeps playing until then.
--
-- Returns one row: 'active' (switched) or 'revalidating' (being re-checked).
-- Raises PS001 (season frozen), PS002 (no bot), PS003 (banned),
-- PS004 (a re-check within the upload cooldown), PS006 (not a version that passed).
create or replace function public.set_active_submission(p_submission uuid)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_season public.season;
  v_bot    public.bots;
  v_sub    public.submissions;
  v_last   timestamptz;
begin
  select * into v_season from public.season where id = 1;
  if v_season.frozen then
    raise exception 'Submissions are closed for this season' using errcode = 'PS001';
  end if;

  -- Locking the bot serialises switches, so a double click can't queue two re-checks.
  select * into v_bot from public.bots where owner_id = (select auth.uid()) for update;
  if not found then
    raise exception 'You have no bot' using errcode = 'PS002';
  end if;
  if v_bot.banned then
    raise exception 'This bot is banned' using errcode = 'PS003';
  end if;

  select * into v_sub from public.submissions s where s.id = p_submission and s.bot_id = v_bot.id;
  if not found then
    raise exception 'That version can''t be made active' using errcode = 'PS006';
  end if;
  if v_sub.status = 'active' then
    return query select 'active'::text;  -- already playing; nothing to do
    return;
  end if;
  if v_sub.status in ('pending', 'validating') then
    return query select 'revalidating'::text;  -- already being checked; don't queue another job
    return;
  end if;
  if v_sub.status <> 'superseded' then
    raise exception 'That version can''t be made active' using errcode = 'PS006';
  end if;

  if v_season.engine_hash is not null and v_sub.engine_hash is distinct from v_season.engine_hash then
    -- A re-check costs a worker run, like an upload, so it shares the upload cooldown.
    select max(t) into v_last from (
      select s.created_at as t from public.submissions s where s.bot_id = v_bot.id
      union all
      select j.created_at from public.jobs j
        join public.submissions s on s.id = j.submission_id
       where s.bot_id = v_bot.id and j.kind = 'validate'
    ) recent;
    if v_last is not null and v_last > now() - v_season.submission_cooldown then
      raise exception 'Please wait % before switching versions',
        date_trunc('second', v_season.submission_cooldown - (now() - v_last))
        using errcode = 'PS004';
    end if;

    update public.submissions set status = 'pending', error = null where id = v_sub.id;
    insert into public.jobs (kind, submission_id, priority) values ('validate', v_sub.id, 10);
    return query select 'revalidating'::text;
    return;
  end if;

  update public.submissions set status = 'superseded'
   where bot_id = v_bot.id and status = 'active' and id <> v_sub.id;
  update public.submissions set status = 'active' where id = v_sub.id;
  update public.bots
     set active_submission_id = v_sub.id, active_version = v_sub.version, active_since = now()
   where id = v_bot.id;
  return query select 'active'::text;
end;
$$;

revoke all on function public.set_active_submission(uuid) from public, anon, authenticated;
grant execute on function public.set_active_submission(uuid) to authenticated, service_role;
