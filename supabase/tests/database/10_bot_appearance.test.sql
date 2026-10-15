-- Bot appearance: players save their Bot Forge character on their own bot only.
begin;
select plan(17);

delete from public.jobs; delete from public.rounds; delete from public.workers; delete from auth.users;
update public.season set frozen = false, allowed_email_domain = 'iiitdmj.ac.in';

create function pg_temp.new_user(p_email text) returns uuid language sql as $$
  insert into auth.users (id, email, instance_id, aud, role)
  values (gen_random_uuid(), p_email, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
  returning id;
$$;
-- A player with one validated (active) upload, so the bot is on the leaderboard.
create function pg_temp.active_player(p_email text) returns uuid language plpgsql as $$
declare v_user uuid; v_sub uuid := gen_random_uuid();
begin
  v_user := pg_temp.new_user(p_email);
  perform public.api_create_submission(v_user, v_sub, 'bot/' || v_sub || '.py', 'sha', 100);
  update public.submissions set status = 'active', validated_at = now() where id = v_sub;
  update public.bots set active_submission_id = v_sub, active_version = 1, active_since = now()
   where owner_id = v_user;
  return v_user;
end $$;
create function pg_temp.sign_in(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

create temp table people (name text primary key, id uuid);
insert into people values ('alice', pg_temp.active_player('alice@iiitdmj.ac.in')),
                          ('bob',   pg_temp.active_player('bob@iiitdmj.ac.in'));
grant select on people to anon, authenticated;

select has_column('public', 'bots', 'appearance', 'bots have an appearance column');
select is((select count(*)::int from public.bots where appearance is not null), 0, 'every bot starts with the seeded look');
select function_privs_are('public', 'set_bot_appearance', array['jsonb'], 'anon', array[]::text[],
  'anon cannot save an appearance');
select function_privs_are('public', 'set_bot_appearance', array['jsonb'], 'authenticated', array['EXECUTE'],
  'signed-in players can save an appearance');

-- Signed in as alice
select pg_temp.sign_in((select id from people where name = 'alice'));
set local role authenticated;

select lives_ok(
  $$select public.set_bot_appearance('{"v":1,"head":2,"eyes":5,"antenna":0,"mouth":3,"pattern":1,"signature":4}')$$,
  'alice saves the genome the web sends (including v)');
select is((select appearance from public.bots where owner_id = auth.uid()),
  '{"v":1,"head":2,"eyes":5,"antenna":0,"mouth":3,"pattern":1,"signature":4}'::jsonb,
  'it is stored on her bot');
select is((select appearance from public.bots where owner_id = (select id from people where name = 'bob')),
  null, 'bob''s bot is untouched');
select is((select appearance->>'head' from public.leaderboard where handle = 'alice'), '2',
  'the leaderboard carries the appearance');

select throws_ok($$select public.set_bot_appearance('{"v":1,"hat":1}')$$, 'PS008', null, 'unknown parts are refused');
select throws_ok($$select public.set_bot_appearance('{"v":1,"head":"x"}')$$, 'PS008', null, 'non-numeric parts are refused');
select throws_ok($$select public.set_bot_appearance('{"v":1,"head":1.5}')$$, 'PS008', null, 'fractional parts are refused');
select throws_ok($$select public.set_bot_appearance('{"v":1,"head":-1}')$$, 'PS008', null, 'negative parts are refused');
select throws_ok($$select public.set_bot_appearance('[1,2]')$$, 'PS008', null, 'non-objects are refused');
select throws_ok('update public.bots set appearance = ''{}''', '42501', null, 'alice cannot write bots directly');

select lives_ok($$select public.set_bot_appearance(null)$$, 'alice resets to the seeded look');
select is((select appearance from public.bots where owner_id = auth.uid()), null, 'and it is cleared');
reset role;

-- Signed in as someone with no bot
select pg_temp.sign_in(gen_random_uuid());
set local role authenticated;
select throws_ok($$select public.set_bot_appearance('{"v":1}')$$, 'PS002', null, 'no bot, nothing to dress');
reset role;

select * from finish();
rollback;
