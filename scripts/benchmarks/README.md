# Benchmarks

Measurement harnesses for open risks in
[`docs/quality/acquisition-risk-register.md`](../../docs/quality/acquisition-risk-register.md).
Each is disposable-local only, guards on `auth.users` count, removes its own
rows and rolls back.

| Script | Risk | Evidence |
| --- | --- | --- |
| `acq-r02-leaderboard.sql` | `ACQ-R02` — leaderboard read cost | [30 Jul 2026](../../docs/quality/investigations/2026-07-30-acq-r02-leaderboard-scale.md) |
| `acq-r03-result-write.sql` | `ACQ-R03` / `DEC-009` — result-write cost | [30 Jul 2026](../../docs/quality/investigations/2026-07-30-acq-r03-result-write-cost.md) |
| `acq-r03-bloat.sh` | `ACQ-R03` — table bloat, commits per result | [30 Jul 2026](../../docs/quality/investigations/2026-07-30-acq-r03-result-write-cost.md) |
| `acq-r03-knockout.sh` | `ACQ-R03` — knockout cost, run after the group stage | [30 Jul 2026](../../docs/quality/investigations/2026-07-30-acq-r03-result-write-cost.md) |
| `acq-r03-probe.sql` | diagnostic — 5 entries, one confirm | — |
| `cap-deadline-burst.sh` | `CAP-006` — the 250-player deadline burst, and whether it fails honestly | [20 Aug 2026](../../docs/quality/investigations/2026-08-20-cap-006-deadline-burst-capacity.md) |

`acq-r03-bloat.sh` is the exception to the rollback rule: it **commits**, because
dead tuples are invisible to the stats collector inside an open transaction and
autovacuum can never be a factor there. Point it at a throwaway database only.

`cap-deadline-burst.sh` is the other exception, for a different reason: a
CONCURRENCY test needs many sessions to see the same rows, and rows inside one
open transaction are visible to exactly one session. It seeds, measures and
leaves its rows behind; `cap-deadline-burst-teardown.sql` removes exactly the
`cab00000-…` namespace it created, and the seed's own guard counts only
`auth.users` rows that are NOT its own, so a second run is not blocked by the
first. It raises the LOCAL `operating_limits` and prints, every run, that the
hosted ones are untouched.

## Running them

The supported path is a disposable Supabase stack:

    supabase start && supabase db reset --local
    psql "$(supabase status -o env | grep '^DB_URL=' | cut -d= -f2- | tr -d '"')" -f <script>

`local-postgres-shim.sql` exists for environments where container images cannot
be pulled. It creates the roles, `auth` schema, `auth.users` shape and
`auth.uid()`/`auth.jwt()` that the migrations expect, so the migrations and
`seed.sql` apply against a plain PostgreSQL cluster.

**It had stopped doing that, and was repaired on 20 August 2026.** The schema
moved on; the shim did not. Three things the migrations now need were absent —
an `extensions` schema holding `pgcrypto` (the Stage C1 foundation calls
`extensions.digest` by name), `pg_cron`, and `pg_net` — so loading stopped at
migration 47 of 210 and every benchmark here was unrunnable on the documented
path. Run `install-local-extension-stubs.sh` once for the last two; the stubs
schedule nothing and send nothing, which is fine for measuring query cost and
wrong everywhere else. Verified 20 August 2026: all 210 migrations apply to a
clean cluster with no failures.

    sudo scripts/benchmarks/install-local-extension-stubs.sh
    createdb measure
    psql -d measure -f scripts/benchmarks/local-postgres-shim.sql
    for f in supabase/migrations/*.sql; do psql -q -d measure -v ON_ERROR_STOP=1 -f "$f"; done

**It is not a substitute for the `local-supabase` CI job.** That job runs the
real stack with `supabase db lint` and pgTAP; this shim only makes the schema
loadable for measurement. Postgres major version, planner and extension set all
differ, so numbers taken against it describe shape, not absolutes.
