#!/usr/bin/env bash
#
# The disposable browser catalogue, applied straight after a `supabase db reset`.
#
# This is a script rather than an inline workflow block because the browser job
# rebuilds the database more than once: `e2e/global-setup.ts` provisions the
# seeded identities by hard-deleting and recreating them, which only works on a
# freshly rebuilt database, so each Playwright configuration that runs it gets
# its own rebuild and therefore its own catalogue.
#
# It targets the local Supabase container by name and must never be pointed at a
# hosted database.
set -euo pipefail

DB_CONTAINER='supabase_db_euro-2028-predictor-local'

docker exec -i "$DB_CONTAINER" \
  psql --username postgres --dbname postgres --set=ON_ERROR_STOP=1 \
  < scripts/bonus-games/publish-catalogue.sql
docker exec -i "$DB_CONTAINER" \
  psql --username postgres --dbname postgres --set=ON_ERROR_STOP=1 \
  < e2e/bonus-games-fixture.sql
# A playable Scottish league season. The migrations create both league-season
# rows with no clubs, matchweeks or fixtures, so without this every season
# surface renders its unavailable state and the browser suite can only prove the
# empty path.
docker exec -i "$DB_CONTAINER" \
  psql --username postgres --dbname postgres --set=ON_ERROR_STOP=1 \
  < e2e/league-season-fixture.sql
docker exec "$DB_CONTAINER" \
  psql --username postgres --dbname postgres --set=ON_ERROR_STOP=1 \
  --command='grant select on table public.bonus_competitions to service_role;'
