#!/usr/bin/env bash
# ===========================================================================
# Stub extensions, so a plain PostgreSQL cluster can LOAD this schema.
# ===========================================================================
#
# DISPOSABLE LOCAL CLUSTERS ONLY. These are not implementations. `pg_cron`
# schedules nothing and `pg_net` sends no HTTP request — they record what they
# were asked to do into a table and return. A cluster carrying them will
# silently never run a scheduled job or a webhook, which is fine for measuring
# read and write cost and catastrophic anywhere else.
#
# WHY THEY ARE NEEDED. `local-postgres-shim.sql` makes the migrations loadable
# on a plain cluster, and it worked when it was written. The schema has moved:
# 210 migrations now, and three of them need things a stock PostgreSQL install
# does not have —
#
#   * `pg_cron`, for the scheduled lock processing and provider polling;
#   * `pg_net`, for the poll dispatch's outbound request;
#   * an `extensions` schema holding `pgcrypto`, which Supabase provides and a
#     plain cluster does not — `extensions.digest` and
#     `extensions.gen_random_bytes` are referenced directly.
#
# The third is handled by the shim itself. The first two need files on disk
# beside PostgreSQL's own extensions, which is what this writes.
#
#   sudo scripts/benchmarks/install-local-extension-stubs.sh
#
# It refuses to overwrite a REAL extension of the same name, so a cluster that
# genuinely has pg_cron installed keeps it.
# ===========================================================================
set -euo pipefail

ext_dir="${PG_EXTENSION_DIR:-$(pg_config --sharedir)/extension}"
[ -d "$ext_dir" ] || { echo "no extension directory at $ext_dir" >&2; exit 1; }

refuse_if_real() {
  local name="$1"
  # A real extension ships a shared library; a stub is SQL only. Presence of
  # the control file alone is not enough to tell them apart, so the marker
  # this script writes is what identifies its own work.
  if [ -f "$ext_dir/$name.control" ] && ! grep -q 'Local measurement stub' "$ext_dir/$name.control"; then
    echo "refusing to replace what looks like a real $name in $ext_dir" >&2
    exit 1
  fi
}

refuse_if_real pg_cron
refuse_if_real pg_net

cat > "$ext_dir/pg_cron.control" <<'CONTROL'
comment = 'Local measurement stub for pg_cron (NOT the real scheduler)'
default_version = '1.6'
schema = 'cron'
relocatable = false
CONTROL

cat > "$ext_dir/pg_cron--1.6.sql" <<'SQL'
\echo Use "CREATE EXTENSION pg_cron" to load this file. \quit
create table if not exists cron.job (
  jobid bigserial primary key,
  schedule text not null,
  command text not null,
  nodename text not null default 'localhost',
  nodeport int not null default 5432,
  database text not null default current_database(),
  username text not null default current_user,
  active boolean not null default true,
  jobname text unique
);
create table if not exists cron.job_run_details (
  jobid bigint,
  runid bigserial primary key,
  job_pid int,
  database text,
  username text,
  command text,
  status text,
  return_message text,
  start_time timestamptz,
  end_time timestamptz
);
create or replace function cron.schedule(job_name text, schedule text, command text)
returns bigint language sql as $$
  insert into cron.job (schedule, command, jobname) values (schedule, command, job_name)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command
  returning jobid;
$$;
create or replace function cron.schedule(schedule text, command text)
returns bigint language sql as $$
  insert into cron.job (schedule, command) values (schedule, command) returning jobid;
$$;
create or replace function cron.unschedule(job_name text)
returns boolean language sql as $$
  delete from cron.job where jobname = job_name; select true;
$$;
create or replace function cron.unschedule(job_id bigint)
returns boolean language sql as $$
  delete from cron.job where jobid = job_id; select true;
$$;
SQL

cat > "$ext_dir/pg_net.control" <<'CONTROL'
comment = 'Local measurement stub for pg_net (NOT a real HTTP client)'
default_version = '0.14.0'
schema = 'net'
relocatable = false
CONTROL

cat > "$ext_dir/pg_net--0.14.0.sql" <<'SQL'
\echo Use "CREATE EXTENSION pg_net" to load this file. \quit
create table if not exists net.http_request_queue (
  id bigserial primary key,
  method text not null,
  url text not null,
  headers jsonb,
  body jsonb,
  timeout_milliseconds int
);
create or replace function net.http_post(
  url text,
  body jsonb default '{}'::jsonb,
  params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb,
  timeout_milliseconds int default 5000
) returns bigint language sql as $$
  insert into net.http_request_queue (method, url, headers, body, timeout_milliseconds)
  values ('POST', url, headers, body, timeout_milliseconds) returning id;
$$;
SQL

echo "wrote pg_cron and pg_net measurement stubs to $ext_dir"
echo "These schedule and send NOTHING. Disposable local clusters only."
