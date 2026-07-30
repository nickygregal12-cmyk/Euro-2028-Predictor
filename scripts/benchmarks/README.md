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
| `acq-r03-probe.sql` | diagnostic — 5 entries, one confirm | — |

`acq-r03-bloat.sh` is the exception to the rollback rule: it **commits**, because
dead tuples are invisible to the stats collector inside an open transaction and
autovacuum can never be a factor there. Point it at a throwaway database only.

## Running them

The supported path is a disposable Supabase stack:

    supabase start && supabase db reset --local
    psql "$(supabase status -o env | grep '^DB_URL=' | cut -d= -f2- | tr -d '"')" -f <script>

`local-postgres-shim.sql` exists for environments where container images cannot
be pulled. It creates the roles, `auth` schema, `auth.users` shape and
`auth.uid()`/`auth.jwt()` that the migrations expect, so all 63 migrations and
`seed.sql` apply against a plain PostgreSQL cluster.

**It is not a substitute for the `local-supabase` CI job.** That job runs the
real stack with `supabase db lint` and pgTAP; this shim only makes the schema
loadable for measurement. Postgres major version, planner and extension set all
differ, so numbers taken against it describe shape, not absolutes.
