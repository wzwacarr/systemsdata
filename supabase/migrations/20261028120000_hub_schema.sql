-- Private schema: not exposed through the public API. Claude reads it via the Supabase connector.
create schema if not exists hub;
revoke all on schema hub from anon, authenticated;

-- Raw layer: one row per record per source, latest copy wins.
create table if not exists hub.records (
  source     text        not null,
  entity     text        not null,
  id         text        not null,
  data       jsonb       not null,
  synced_at  timestamptz not null default now(),
  primary key (source, entity, id)
);

-- One row per sync run, so we can see what worked and what failed.
create table if not exists hub.sync_runs (
  id          bigserial   primary key,
  source      text        not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      text        not null default 'running',
  row_count   integer     not null default 0,
  detail      jsonb
);

create index if not exists sync_runs_source_started_idx on hub.sync_runs (source, started_at desc);

create extension if not exists pg_cron;
create extension if not exists pg_net;
