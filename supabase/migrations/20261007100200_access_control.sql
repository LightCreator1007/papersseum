-- Who can read what, plus the public leaderboard view.

-- conservative = elo - SIGMA_K * SIGMA_START / sqrt(1 + games), the same
-- formula as papersseum.rating.Ladder (SIGMA_K = 2, SIGMA_START = 350).
-- Keep these constants in sync with rating.py.
create view public.leaderboard with (security_invoker = true) as
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
  b.active_since
from public.bots b
left join public.profiles p on p.id = b.owner_id
where b.active_submission_id is not null and not b.banned;

alter table public.season        enable row level security;
alter table public.profiles      enable row level security;
alter table public.admins        enable row level security;
alter table public.bots          enable row level security;
alter table public.submissions   enable row level security;
alter table public.rounds        enable row level security;
alter table public.matches       enable row level security;
alter table public.match_players enable row level security;
alter table public.jobs          enable row level security;
alter table public.workers       enable row level security;

-- Start from nothing, then grant only what each role needs. (Older projects
-- auto-grant every new public table to anon/authenticated.)
revoke all on public.season, public.profiles, public.admins, public.bots,
  public.submissions, public.rounds, public.matches, public.match_players,
  public.jobs, public.workers, public.leaderboard
  from anon, authenticated;

grant all on public.season, public.profiles, public.admins, public.bots,
  public.submissions, public.rounds, public.matches, public.match_players,
  public.jobs, public.workers, public.leaderboard
  to service_role;

-- Public, read-only: anyone (signed in or not) can see these.
grant select on public.season, public.profiles, public.bots, public.rounds,
  public.matches, public.match_players, public.leaderboard
  to anon, authenticated;

create policy "public read" on public.season        for select to anon, authenticated using (true);
create policy "public read" on public.profiles      for select to anon, authenticated using (true);
create policy "public read" on public.bots          for select to anon, authenticated using (true);
create policy "public read" on public.rounds        for select to anon, authenticated using (true);
create policy "public read" on public.matches       for select to anon, authenticated using (true);
create policy "public read" on public.match_players for select to anon, authenticated using (true);

-- Submissions: you can see your own versions (status, errors), nobody else's.
grant select on public.submissions to authenticated;

create policy "owner reads own submissions" on public.submissions
  for select to authenticated
  using (
    exists (
      select 1 from public.bots b
      where b.id = submissions.bot_id and b.owner_id = (select auth.uid())
    )
  );

-- admins, jobs, workers: no grants to anon/authenticated at all.
