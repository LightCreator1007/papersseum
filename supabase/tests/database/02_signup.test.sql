-- Sign-up: domain restriction, automatic profile and bot, handle generation.
begin;
select plan(16);

-- Clean slate (rolled back at the end)
delete from public.jobs; delete from public.rounds; delete from public.workers; delete from auth.users;
update public.season set allowed_email_domain = 'iiitdmj.ac.in';

create function pg_temp.new_user(p_email text) returns uuid language sql as $$
  insert into auth.users (id, email, instance_id, aud, role)
  values (gen_random_uuid(), p_email, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
  returning id;
$$;

-- Allowed domain
select lives_ok($$select pg_temp.new_user('ram.kumar-21@iiitdmj.ac.in')$$, 'iiitdmj.ac.in email can sign up');
select is((select handle from public.profiles), 'ramkumar21', 'handle is the cleaned-up email name');
select is((select count(*)::int from public.bots where not is_house), 1, 'a bot is created for the new user');
select is(
  (select b.name from public.bots b join public.profiles p on p.id = b.owner_id), 'ramkumar21',
  'the bot is named after the handle');
select is(
  (select count(*)::int from public.leaderboard where handle = 'ramkumar21'), 0,
  'a bot with no valid upload is not on the leaderboard');
select lives_ok($$select pg_temp.new_user('Shouty@IIITDMJ.AC.IN')$$, 'domain check ignores case');

-- Handle collisions and short names
select pg_temp.new_user('ramkumar21@iiitdmj.ac.in');
select matches(
  (select p.handle from public.profiles p join auth.users u on u.id = p.id where u.email = 'ramkumar21@iiitdmj.ac.in'),
  '^ramkumar21_[0-9a-f]{4}$',
  'a taken handle gets a random suffix');
select pg_temp.new_user('a@iiitdmj.ac.in');
select matches(
  (select p.handle from public.profiles p join auth.users u on u.id = p.id where u.email = 'a@iiitdmj.ac.in'),
  '^player(_[0-9a-f]{4})?$',
  'a too-short name falls back to "player"');

-- Blocked
select throws_ok($$select pg_temp.new_user('someone@gmail.com')$$, 'P0001',
  'Sign-ups are limited to @iiitdmj.ac.in email addresses', 'other domains are blocked');
select throws_ok($$select pg_temp.new_user('x@iiitdmj.ac.in.evil.com')$$, 'P0001',
  'Sign-ups are limited to @iiitdmj.ac.in email addresses', 'look-alike domains are blocked');
select throws_ok($$select pg_temp.new_user('x@cse.iiitdmj.ac.in')$$, 'P0001',
  'Sign-ups are limited to @iiitdmj.ac.in email addresses', 'subdomains are blocked');
select throws_ok($$select pg_temp.new_user('x@iiitdmj_ac_in')$$, 'P0001',
  'Sign-ups are limited to @iiitdmj.ac.in email addresses', 'no LIKE-style wildcard matching');
select throws_ok($$select pg_temp.new_user(null)$$, 'P0001',
  'Sign-ups are limited to @iiitdmj.ac.in email addresses', 'sign-ups without an email are blocked');
select is(
  (select count(*)::int from public.profiles p join auth.users u on u.id = p.id where u.email not like '%@iiitdmj.ac.in'
     and lower(u.email) not like '%@iiitdmj.ac.in'), 0,
  'no profile exists for a blocked email');

-- Domain restriction switched off
update public.season set allowed_email_domain = null;
select lives_ok($$select pg_temp.new_user('guest@gmail.com')$$, 'with no domain set, anyone can sign up');
select is(
  (select count(*)::int from public.bots b join auth.users u on u.id = b.owner_id where u.email = 'guest@gmail.com'), 1,
  'the guest also gets a bot');

select * from finish();
rollback;
