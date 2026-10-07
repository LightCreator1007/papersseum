-- House bots: the library baselines, so a lobby can always be filled.
-- `builtin` must be a key of papersseum.agents.BASELINES.


do $$
declare
  v_bot uuid;
  v_sub uuid;
  h     record;
begin
  for h in
    select * from (values
      ('house_greedy_1', 'greedy'),
      ('house_greedy_2', 'greedy'),
      ('house_safe_expander_1', 'safe_expander'),
      ('house_safe_expander_2', 'safe_expander'),
      ('house_random', 'random')
    ) as t(name, builtin)
  loop
    insert into public.bots (name, is_house) values (h.name, true) returning id into v_bot;
    insert into public.submissions (bot_id, version, builtin, status, validated_at)
    values (v_bot, 1, h.builtin, 'active', now())
    returning id into v_sub;
    update public.bots
       set active_submission_id = v_sub, active_version = 1, active_since = now()
     where id = v_bot;
  end loop;
end;
$$;
