-- Live updates for the frontend, and the scheduled jobs that keep the ladder running.

-- Realtime: live leaderboard, submission status, match progress.
-- RLS still applies, so people only receive changes to rows they can read.
alter publication supabase_realtime add table public.bots, public.submissions, public.matches;

-- pg_cron runs inside the database, so these keep going when every worker is off.
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule('papersseum-schedule-round', '*/15 * * * *', $$select internal.schedule_round()$$);
select cron.schedule('papersseum-requeue-expired', '* * * * *',   $$select internal.requeue_expired()$$);
