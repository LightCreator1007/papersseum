-- Sign-up: only allowed email domains; every new user gets a profile and a bot.

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

  insert into public.profiles (id, handle) values (new.id, v_handle);
  insert into public.bots (owner_id, name) values (new.id, v_handle);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function internal.handle_new_user();
