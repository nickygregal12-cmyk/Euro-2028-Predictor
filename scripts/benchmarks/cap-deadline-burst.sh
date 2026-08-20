#!/usr/bin/env bash
# ===========================================================================
# CAP — the deadline burst, measured.
# ===========================================================================
#
# `CAP-006` approves 250 as the next controlled Hub stage and says what is
# still owed: "one `service_role` call AND THE LOAD EVIDENCE". This produces
# the evidence half. It does not, and must not, produce the other half — see
# the closing note this script prints.
#
# WHAT IT MEASURES, AND WHY IT IS SHAPED LIKE THIS
#
# The last ten minutes before a matchweek locks is the only moment this product
# is under load at all. Everybody writes at once, into the same matchweek, and
# everybody then reloads the standings to see whether it took. So the mix is
# weighted towards writes, the fixtures are seeded ten minutes from kickoff so
# the writes are inside the window rather than refused by the lock, and the
# reads that contend with them are the real ones — the league standings and the
# attention feed, not a synthetic `select 1`.
#
# It runs the RPCs THE BROWSER CALLS. Nothing here reimplements a read or a
# write in the benchmark's own SQL, because a benchmark against hand-written
# queries measures the benchmark.
#
# HOW FAILURE IS COUNTED, WHICH IS THE POINT
#
# pgbench aborts a client on an SQL error, so a run in which every write was
# refused would report a tidy early finish rather than a refusal rate. Every
# operation is therefore wrapped in plpgsql that CATCHES the exception and
# records it with its SQLSTATE. The success rate below is counted from those
# rows, so a refused write is reported as a refused write — which is the
# property `F2` actually asks about.
#
# DISPOSABLE LOCAL DATABASE ONLY. The seed commits, raises the local operating
# limits and creates 250 accounts. It refuses to run where `auth.users` looks
# real. Never point this at a hosted environment.
#
#   scripts/benchmarks/cap-deadline-burst.sh [--players N] [--clients N] [--seconds N]
#
# Requires: a PostgreSQL cluster with this repository's migrations applied, and
# `PGDATABASE`/`PGHOST`/`PGUSER` pointing at it. `local-postgres-shim.sql` plus
# `install-local-extension-stubs.sh` make a plain cluster loadable.
# ===========================================================================
set -euo pipefail

PLAYERS=${PLAYERS:-250}
CLIENTS=${CLIENTS:-40}
SECONDS_TO_RUN=${SECONDS_TO_RUN:-30}
SKIP_SEED=${SKIP_SEED:-0}
# `burst` is the ten-minutes-before-lock mix. `quiet` is an ordinary Tuesday:
# people look, almost nobody writes. Both are needed — a system measured only at
# its peak has no baseline to say what the peak cost.
PROFILE=${PROFILE:-burst}

while [ $# -gt 0 ]; do
  case "$1" in
    --players) PLAYERS="$2"; shift 2 ;;
    --clients) CLIENTS="$2"; shift 2 ;;
    --seconds) SECONDS_TO_RUN="$2"; shift 2 ;;
    --skip-seed) SKIP_SEED=1; shift ;;
    --profile) PROFILE="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mix="$here/cap-deadline-burst"
db=${PGDATABASE:?PGDATABASE must name a disposable local database}

echo "== capacity: deadline burst =="
echo "database ${db}   profile ${PROFILE}   players ${PLAYERS}   clients ${CLIENTS}   duration ${SECONDS_TO_RUN}s"
echo

if [ "$SKIP_SEED" = "0" ]; then
  psql -q -v ON_ERROR_STOP=1 -v players="$PLAYERS" -f "$here/cap-deadline-burst-seed.sql"
  echo
fi

# Start from an empty ledger so the numbers describe this run alone.
psql -q -c 'truncate public.cap_burst_outcomes;'

# THE MIX. Weights are a matchweek deadline rather than a uniform sample: ten
# fixtures to enter means saves dominate, the card is re-read a few times, the
# confirmation happens about once per player, and the standings and feed are
# what everyone else is doing to the same database at the same moment.
# Sample backend count DURING the run. Reading it afterwards measures an idle
# database, which is the one moment connection pressure cannot be observed.
peaks="$(mktemp)"
( while :; do
    psql -tAc "select count(*) from pg_stat_activity where datname = current_database();" \
      >> "$peaks" 2>/dev/null || true
    sleep 1
  done ) &
sampler=$!
trap 'kill "$sampler" 2>/dev/null || true' EXIT

case "$PROFILE" in
  burst)
    weights=( "$mix/save.sql@50" "$mix/card.sql@15" "$mix/confirm.sql@5"
              "$mix/standings.sql@20" "$mix/actions.sql@10" ) ;;
  quiet)
    # An ordinary day between deadlines: people open the app, look at where
    # they are, and occasionally change one prediction.
    weights=( "$mix/save.sql@5" "$mix/card.sql@25" "$mix/confirm.sql@1"
              "$mix/standings.sql@34" "$mix/actions.sql@35" ) ;;
  *) echo "unknown profile: $PROFILE (expected burst or quiet)" >&2; exit 2 ;;
esac

pgbench -n \
  -c "$CLIENTS" -j "$(nproc)" -T "$SECONDS_TO_RUN" \
  -D players="$PLAYERS" \
  "${weights[@]/#/-f}" \
  2>&1 | sed 's/^/  /'

kill "$sampler" 2>/dev/null || true
peak_backends="$(sort -n "$peaks" | tail -1)"
rm -f "$peaks"

echo
echo "== outcomes, counted from the ledger rather than from the runner =="
psql -P pager=off -c "
  select operation,
         count(*)                                              as attempts,
         count(*) filter (where ok)                            as ok,
         round(100.0 * count(*) filter (where ok) / count(*), 2) as success_pct,
         round(percentile_cont(0.50) within group (order by duration_ms)::numeric, 1) as p50_ms,
         round(percentile_cont(0.95) within group (order by duration_ms)::numeric, 1) as p95_ms,
         round(percentile_cont(0.99) within group (order by duration_ms)::numeric, 1) as p99_ms,
         round(max(duration_ms)::numeric, 1)                   as max_ms
    from public.cap_burst_outcomes
   group by operation
   order by attempts desc;"

echo "== how the failures failed, if any =="
psql -P pager=off -c "
  select operation, sqlstate, count(*) as failures
    from public.cap_burst_outcomes
   where not ok
   group by operation, sqlstate
   order by failures desc;"

echo "== duplicate-write safety: one row per player per fixture, or not =="
# The property `F2` names. A burst that produced two prediction rows for one
# player and one fixture would mean the deadline created a duplicate the
# scoring authority would then have to choose between.
psql -P pager=off -c "
  select count(*) as duplicate_prediction_rows
    from (
      select entry_id, season_fixture_id
        from public.season_predictions
       group by entry_id, season_fixture_id
      having count(*) > 1
    ) duplicated;"

echo "== connection and rate-limit pressure =="
echo "  peak backends during the run: ${peak_backends:-unknown}"
psql -P pager=off -c "
  select (select setting::int from pg_settings where name = 'max_connections') as max_connections,
         (select count(*) from public.rate_limit_events) as rate_limit_events,
         (select count(*) from public.season_predictions
           where entry_id::text like 'cab00000-0000-0000-0004-%') as predictions_written,
         (select count(*) from public.season_matchweek_cards
           where entry_id::text like 'cab00000-0000-0000-0004-%'
             and confirmed_at is not null) as cards_confirmed;"

echo
echo "The hosted operating limits are UNCHANGED by this script. Raising"
echo "public_user_limit to the CAP-006 figure is a separate, authorised"
echo "operations action against a named environment:"
echo "    select public.set_operating_limits(250, <current total_league_limit>);"
