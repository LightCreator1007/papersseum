-- Creating a submission (called by the Next.js API route with the secret key).

-- The route uploads the file to `p_storage_path` first, then calls this.
-- Raises (SQLSTATE PS001 frozen, PS002 no bot, PS003 banned, PS004 cooldown)
-- and the route should then delete the uploaded file.
create or replace function public.api_create_submission(
  p_user_id       uuid,
  p_submission_id uuid,
  p_storage_path  text,
  p_sha256        text,
  p_size_bytes    integer
)
returns public.submissions
language plpgsql
set search_path = ''
as $$
declare
  v_season  public.season;
  v_bot     public.bots;
  v_last    timestamptz;
  v_version integer;
  v_sub     public.submissions;
begin
  select * into v_season from public.season where id = 1;
  if v_season.frozen then
    raise exception 'Submissions are closed' using errcode = 'PS001';
  end if;

  select * into v_bot from public.bots where owner_id = p_user_id for update;
  if not found then
    raise exception 'No bot for this user' using errcode = 'PS002';
  end if;
  if v_bot.banned then
    raise exception 'This bot is banned' using errcode = 'PS003';
  end if;

  select max(created_at), coalesce(max(version), 0) + 1
    into v_last, v_version
    from public.submissions where bot_id = v_bot.id;
  if v_last is not null and v_last > now() - v_season.submission_cooldown then
    raise exception 'Please wait % before submitting again',
      date_trunc('second', v_season.submission_cooldown - (now() - v_last))
      using errcode = 'PS004';
  end if;

  insert into public.submissions (id, bot_id, version, storage_path, sha256, size_bytes)
  values (p_submission_id, v_bot.id, v_version, p_storage_path, p_sha256, p_size_bytes)
  returning * into v_sub;

  insert into public.jobs (kind, submission_id, priority) values ('validate', v_sub.id, 10);
  return v_sub;
end;
$$;

revoke execute on function public.api_create_submission(uuid, uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.api_create_submission(uuid, uuid, text, text, integer)
  to service_role;
