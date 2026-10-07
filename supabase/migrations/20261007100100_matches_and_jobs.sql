-- Rounds, matches and per-seat results, plus the job queue and worker registry.

create type public.round_kind   as enum ('ladder', 'final');
create type public.match_status as enum ('queued', 'running', 'done', 'failed');
create type public.job_kind     as enum ('validate', 'match');
create type public.job_status   as enum ('queued', 'running', 'done', 'failed');

create table public.rounds (
  id          bigint generated always as identity primary key,
  kind        public.round_kind not null default 'ladder',
  created_at  timestamptz not null default now()
);

create table public.matches (
  id           bigint generated always as identity primary key,
  round_id     bigint not null references public.rounds (id) on delete cascade,
  seed         bigint not null,
  status       public.match_status not null default 'queued',
  engine_hash  text,
  replay_path  text,                   -- path inside the 'replays' bucket: '<id>.jsonl.gz'
  error        text,
  created_at   timestamptz not null default now(),
  started_at   timestamptz,
  finished_at  timestamptz
);

-- One row per seat. Doubles as rating history (elo_before / elo_after).
create table public.match_players (
  match_id       bigint not null references public.matches (id) on delete cascade,
  slot           smallint not null check (slot between 0 and 4),
  bot_id         uuid references public.bots (id) on delete set null,
  submission_id  uuid references public.submissions (id) on delete set null,
  placement      smallint check (placement between 1 and 5),
  coverage       real,
  deaths         integer,
  strikes        integer,              -- late decisions
  crashed        boolean,
  score          real,                 -- rating.match_scores blended score
  elo_before     double precision,
  elo_after      double precision,
  primary key (match_id, slot)
);

-- Work for the workers: validate an upload, or play a match.
create table public.jobs (
  id             bigint generated always as identity primary key,
  kind           public.job_kind not null,
  submission_id  uuid references public.submissions (id) on delete cascade,
  match_id       bigint references public.matches (id) on delete cascade,
  status         public.job_status not null default 'queued',
  priority       smallint not null default 0,   -- higher runs first; validation beats matches
  attempts       smallint not null default 0,
  max_attempts   smallint not null default 3,
  worker_id      text,
  lease_until    timestamptz,
  last_error     text,
  created_at     timestamptz not null default now(),
  finished_at    timestamptz,
  check (
    (kind = 'validate' and submission_id is not null and match_id is null) or
    (kind = 'match'    and match_id is not null and submission_id is null)
  )
);

create table public.workers (
  id           text primary key,      -- a name you pick, e.g. 'lab-pc-1'
  engine_hash  text,
  version      text,
  current_job  bigint,
  last_seen    timestamptz not null default now()
);

create index jobs_queued_idx       on public.jobs (priority desc, id) where status = 'queued';
create index jobs_running_idx      on public.jobs (lease_until)       where status = 'running';
create index jobs_submission_idx   on public.jobs (submission_id);
create index jobs_match_idx        on public.jobs (match_id);
create index matches_round_idx     on public.matches (round_id);
create index match_players_bot_idx on public.match_players (bot_id, match_id desc);
create index match_players_sub_idx on public.match_players (submission_id);
