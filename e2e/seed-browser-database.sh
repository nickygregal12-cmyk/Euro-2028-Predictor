#!/usr/bin/env bash
#
# The disposable browser catalogue, applied straight after a `supabase db reset`.
#
# This is a script rather than an inline workflow block because it belongs to
# the rebuild rather than to one step: `e2e/global-setup.ts` provisions the
# seeded identities by hard-deleting and recreating them, which only works on a
# freshly rebuilt database, so any Playwright configuration that runs it needs a
# rebuild of its own -- and a rebuild is only usable once this has run against
# it. tests/scripts/browserE2EWorkflow.test.ts holds the workflow to that.
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
# The harness reads this catalogue as the service role. Base-table privileges
# are withheld from `service_role` on purpose -- writes go through the RPCs --
# so the read is granted back here, in the disposable database only, rather than
# by widening the schema.
docker exec "$DB_CONTAINER" \
  psql --username postgres --dbname postgres --set=ON_ERROR_STOP=1 \
  --command='grant select on table public.bonus_competitions to service_role;'
