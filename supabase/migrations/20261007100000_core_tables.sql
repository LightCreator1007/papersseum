-- Core tables: global settings, people, bots and their uploaded versions.
--
-- Who touches the database (the rest of the migrations follow this split):
--   * Browser (publishable key): reads public tables through the Data API,
--     protected by RLS. Never writes directly.
--   * Next.js API routes (secret key, service_role): create submissions via
--     public.api_create_submission().
--   * Worker (direct Postgres connection as `postgres`): calls the functions in
--     the `internal` schema, which is not exposed to the Data API.
--   * pg_cron (inside the database): schedules rounds and requeues dead jobs.

create schema if not exists internal;
revoke all on schema internal from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Season: one row of global settings
-- ---------------------------------------------------------------------------

create table public.season (
  id                    smallint primary key default 1 check (id = 1),
  name                  text        not null default 'Season 1',
  engine_hash           text,                 -- workers must match this; null = not enforced yet
  frozen                boolean     not null default false,  -- true = no new submissions, no ladder rounds
  games_per_round       smallint    not null default 1 check (games_per_round between 1 and 10),
  max_backlog           integer     not null default 60,     -- skip a round if this many match jobs are pending
  matchmaking_noise     real        not null default 200,    -- Elo jitter so lobbies are similar but not fixed
  submission_cooldown   interval    not null default '10 minutes',
  allowed_email_domain  text                                 -- e.g. 'iiitdmj.ac.in'; null = anyone can sign up
);

insert into public.season (id, allowed_email_domain) values (1, 'iiitdmj.ac.in');

-- ---------------------------------------------------------------------------
-- People and bots
-- ---------------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  handle      text not null unique check (handle ~ '^[a-z0-9_]{2,32}$'),
  created_at  timestamptz not null default now()
);

-- Admins live in their own table so the flag is never readable or writable
-- through the Data API.
create table public.admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- One bot per person. Its rating survives new uploads.
-- House bots (the library baselines) have no owner and fill empty seats.
create table public.bots (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid unique references public.profiles (id) on delete cascade,
  name                  text not null unique,
  is_house              boolean not null default false,
  banned                boolean not null default false,
  elo                   double precision not null default 1000,  -- rating.ELO_START
  games                 integer not null default 0,
  active_submission_id  uuid,          -- FK added below (circular with submissions)
  active_version        integer,
  active_since          timestamptz,
  created_at            timestamptz not null default now(),
  check (is_house or owner_id is not null)
);

create type public.submission_status as enum (
  'pending',      -- uploaded, waiting for a worker to validate it
  'validating',   -- a worker is validating it right now
  'active',       -- passed validation; the bot's current version
  'rejected',     -- failed validation (see error / violations)
  'superseded'    -- was active, replaced by a newer version
);

create table public.submissions (
  id            uuid primary key default gen_random_uuid(),
  bot_id        uuid not null references public.bots (id) on delete cascade,
  version       integer not null,
  storage_path  text,                  -- path inside the 'agents' bucket: '<bot_id>/<id>.py'
  builtin       text,                  -- library baseline name for house bots
  sha256        text,
  size_bytes    integer,
  status        public.submission_status not null default 'pending',
  error         text,
  violations    jsonb,                 -- static scan output: [{line, kind, detail}]
  engine_hash   text,
  created_at    timestamptz not null default now(),
  validated_at  timestamptz,
  unique (bot_id, version),
  check ((storage_path is null) <> (builtin is null))
);

alter table public.bots
  add constraint bots_active_submission_fk
  foreign key (active_submission_id) references public.submissions (id) on delete set null;

create index submissions_bot_idx on public.submissions (bot_id, created_at desc);
create index bots_active_sub_idx on public.bots (active_submission_id);
