-- Owner names from the Google account, and the one-per-season bot rename.
begin;
select plan(30);

delete from public.jobs; delete from public.rounds; delete from public.workers; delete from auth.users;
update public.season set frozen = false, allowed_email_domain = 'iiitdmj.ac.in';

create function pg_temp.new_user(p_email text, p_meta jsonb default '{}') returns uuid language sql as $$
  insert into auth.users (id, email, instance_id, aud, role, raw_user_meta_data)
  values (gen_random_uuid(), p_email, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_meta)
  returning id;
$$;
create function pg_temp.owner_name(p_email text) returns text language sql as $$
  select p.display_name from public.profiles p join auth.users u on u.id = p.id where u.email = p_email;
$$;
-- A player with one validated (active) upload, so the bot is on the leaderboard.
create function pg_temp.active_player(p_email text, p_meta jsonb) returns uuid language plpgsql as $$
declare v_user uuid; v_sub uuid := gen_random_uuid();
begin
  v_user := pg_temp.new_user(p_email, p_meta);
  perform public.api_create_submission(v_user, v_sub, 'bot/' || v_sub || '.py', 'sha', 100);
  update public.submissions set status = 'active', validated_at = now() where id = v_sub;
  update public.bots set active_submission_id = v_sub, active_version = 1, active_since = now()
   where owner_id = v_user;
  return v_user;
end $$;
create function pg_temp.sign_in(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

-- ---------------------------------------------------------------------------
-- Owner names
-- ---------------------------------------------------------------------------

select pg_temp.new_user('caps@iiitdmj.ac.in', '{"full_name": "ARUNIT CHAKRABORTY", "name": "ARUNIT CHAKRABORTY"}');
select is(pg_temp.owner_name('caps@iiitdmj.ac.in'), 'Arunit Chakraborty', 'an all-capitals Google name is title-cased');

select pg_temp.new_user('mixed@iiitdmj.ac.in', '{"full_name": "Ada van der Berg"}');
select is(pg_temp.owner_name('mixed@iiitdmj.ac.in'), 'Ada van der Berg', 'a mixed-case name is kept as Google sends it');

select pg_temp.new_user('nameonly@iiitdmj.ac.in', '{"name": "Ravi Teja"}');
select is(pg_temp.owner_name('nameonly@iiitdmj.ac.in'), 'Ravi Teja', 'falls back to "name" without "full_name"');

select pg_temp.new_user('spaces@iiitdmj.ac.in', E'{"full_name": "  Ram \\t  Kumar\\n "}');
select is(pg_temp.owner_name('spaces@iiitdmj.ac.in'), 'Ram Kumar', 'whitespace is collapsed and trimmed');

select pg_temp.new_user('blank@iiitdmj.ac.in', '{"full_name": "   "}');
select is(pg_temp.owner_name('blank@iiitdmj.ac.in'), null, 'a blank name gives no owner name');

select pg_temp.new_user('none@iiitdmj.ac.in');
select is(pg_temp.owner_name('none@iiitdmj.ac.in'), null, 'no name in the account gives no owner name');

select pg_temp.new_user('long@iiitdmj.ac.in', jsonb_build_object('full_name', repeat('Abcdefghij ', 10)));
select is(char_length(pg_temp.owner_name('long@iiitdmj.ac.in')), 64, 'a long name is cut to 64 characters');

update auth.users set raw_user_meta_data = '{"full_name": "Ravi Teja Kumar"}' where email = 'nameonly@iiitdmj.ac.in';
select is(pg_temp.owner_name('nameonly@iiitdmj.ac.in'), 'Ravi Teja Kumar', 'a changed Google name updates the owner name');

update auth.users set last_sign_in_at = now() where email = 'nameonly@iiitdmj.ac.in';
select is(pg_temp.owner_name('nameonly@iiitdmj.ac.in'), 'Ravi Teja Kumar', 'other account updates leave the name alone');

select is(
  (select handle from public.profiles p join auth.users u on u.id = p.id where u.email = 'caps@iiitdmj.ac.in'), 'caps',
  'the handle is still made from the email');

-- ---------------------------------------------------------------------------
-- Leaderboard and public reads
-- ---------------------------------------------------------------------------

create temp table people (name text primary key, id uuid);
insert into people values
  ('alice', pg_temp.active_player('alice@iiitdmj.ac.in', '{"full_name": "ALICE SHARMA"}')),
  ('bob',   pg_temp.active_player('bob@iiitdmj.ac.in',   '{"full_name": "Bob Verma"}')),
  ('carol', pg_temp.active_player('carol@iiitdmj.ac.in', '{"full_name": "Carol Das"}')),
  ('dave',  pg_temp.active_player('dave@iiitdmj.ac.in',  '{"full_name": "Dave Rao"}'));
grant select on people to anon, authenticated;

set local role anon;
select is((select owner_name from public.leaderboard where name = 'alice'), 'Alice Sharma',
  'the leaderboard shows the owner name');
select is((select owner_name from public.leaderboard where name = 'house_greedy_1'), null,
  'house bots have no owner name');
select is((select display_name from public.profiles where handle = 'bob'), 'Bob Verma',
  'anyone can read owner names');
reset role;

-- ---------------------------------------------------------------------------
-- Rename
-- ---------------------------------------------------------------------------

select pg_temp.sign_in((select id from people where name = 'alice'));
set local role authenticated;
select is((select name from public.rename_bot('alice_bot')), 'alice_bot', 'rename returns the new name');
select is((select name from public.bots where owner_id = auth.uid()), 'alice_bot', 'the bot has the new name');
select is((select count(*)::int from public.leaderboard where name = 'alice_bot'), 1, 'the leaderboard shows it');
select throws_ok($$select * from public.rename_bot('alice_again')$$, 'PS005', 'Already renamed this season',
  'a second rename is refused');
select throws_ok($$select * from public.rename_bot('alice')$$, 'PS005', 'Already renamed this season',
  'and so is renaming back');
reset role;

set local role anon;
select is(public.resolve_bot_name('alice'), 'alice_bot', 'the old name resolves to the new one');
select is(public.resolve_bot_name('nobody_here'), null, 'an unknown name resolves to nothing');
select throws_ok($$select * from public.rename_bot('anon_bot')$$, '42501', null, 'anon cannot rename');
select throws_ok($$insert into public.bot_name_aliases (old_name, bot_id) values ('x_y', gen_random_uuid())$$,
  '42501', null, 'anon cannot write aliases');
reset role;

select pg_temp.sign_in((select id from people where name = 'bob'));
set local role authenticated;
select throws_ok($$select * from public.rename_bot('carol')$$, '23505', null, 'a name another bot has is refused');
select throws_ok($$select * from public.rename_bot('alice')$$, '23505', 'Name is reserved',
  'a name another bot used to have is refused');
select throws_ok($$select * from public.rename_bot('Bad Name')$$, 'PS009', 'Invalid name',
  'a name outside the pattern is refused');
select is((select name from public.rename_bot('bob')), 'bob', 'renaming to the current name is a no-op');
select is((select name from public.rename_bot('bobby')), 'bobby', 'and does not use up the rename');
select throws_ok($$insert into public.bot_name_aliases (old_name, bot_id) values ('x_y', gen_random_uuid())$$,
  '42501', null, 'players cannot write aliases directly');
reset role;

update public.bots set banned = true where owner_id = (select id from people where name = 'carol');
select pg_temp.sign_in((select id from people where name = 'carol'));
set local role authenticated;
select throws_ok($$select * from public.rename_bot('carol_bot')$$, 'PS003', 'This bot is banned',
  'a banned bot cannot be renamed');
reset role;

delete from public.bots where owner_id = (select id from people where name = 'dave');
select pg_temp.sign_in((select id from people where name = 'dave'));
set local role authenticated;
select throws_ok($$select * from public.rename_bot('dave_bot')$$, 'PS002', 'You have no bot',
  'someone without a bot cannot rename');
reset role;

select * from finish();
rollback;
