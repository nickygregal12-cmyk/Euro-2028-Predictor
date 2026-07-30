# Hosted migration inventory and rollout status

Live source of truth for repository migration count and the verification still required for hosted environments.

## Current repository state — 30 July 2026

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository `main` | **64** | 64 canonical files through `20260730180000_cup_winner_deletion_semantics.sql` | VERIFIED |
| Development Supabase | **64** | owner-applied and owner-verified 30 July 2026: `bonus_cup_fixtures_winner_user_id_fkey` returns `confdeltype = r`, `condeferrable = false` | VERIFIED |
| Production Supabase | 63 | unchanged since the 29 July 2026 promotion | `REQUIRES OWNER VERIFICATION` |
| Netlify `deploy-preview` / `branch-deploy` | **64** | `EURO28_DEPLOYED_DB_CONTRACT=64`; preview build passes the contract gate and the exact-head smoke reports contract 64 | VERIFIED |
| Netlify `production` | 63 | **production deploys are paused**: the repository requires 64, so the prebuild gate refuses the build. The last good deploy stays live. Owner-accepted 30 July 2026 | BLOCKED BY DESIGN |

### Contract 64

| # | Canonical migration | Repository-side purpose | Hosted status |
| ---: | --- | --- | --- |
| 64 | `20260730180000_cup_winner_deletion_semantics.sql` | Declares the omitted `on delete` action on `bonus_cup_fixtures.winner_user_id` as `restrict` | development VERIFIED; production not applied |

Behaviour-preserving. `NO ACTION` and `RESTRICT` are equivalent for a non-deferrable constraint, and the constraint is non-deferrable. Measured rather than argued: the same delete against the same settled cup fixture fails identically on databases built at 63 and at 64 migrations, naming the same constraint in the same message.

**To unblock production:** apply the migration to production Supabase, confirm `confdeltype = 'r'`, then set `EURO28_DEPLOYED_DB_CONTRACT=64` on the `production` context. Do not set the production value before the database is verified — that is the exact inversion the gate exists to prevent.

## Tagged repository state — 29 July 2026

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| `euro-2028-baseline` | 63 | 63 canonical files through `20260729154931_prediction_consensus_minimum_cohort.sql` | VERIFIED |
| `main` at reconciliation start | 63 | identical to the tag; zero ahead and zero behind. Superseded — see the current state above | HISTORICAL |
| Development Supabase | — | no database access in this task | `REQUIRES OWNER VERIFICATION` |
| Production Supabase | — | no database access in this task | `REQUIRES OWNER VERIFICATION` |
| Netlify non-production contexts | — | no Netlify access in this task | `REQUIRES OWNER VERIFICATION` |
| Netlify production | — | no Netlify access in this task | `REQUIRES OWNER VERIFICATION` |

The tag annotation asserts hosted contract-63 alignment and names deploy IDs. Those claims are recorded in the tag-reconciliation report but are not independently verified here.

## Contracts 61–63 inside the tag

| # | Canonical migration | Repository-side purpose | Hosted status |
| ---: | --- | --- | --- |
| 61 | `20260729122100_prediction_consensus.sql` | Authenticated post-lock, tournament-wide Original Predictor aggregate over submitted entries | `REQUIRES OWNER VERIFICATION` |
| 62 | `20260729122200_final_standings_tiebreaks.sql` | Overall/private final standings tie-break activation after all results | `REQUIRES OWNER VERIFICATION` |
| 63 | `20260729154931_prediction_consensus_minimum_cohort.sql` | Ten-entry tournament-wide cohort gate and successful suppression below threshold | `REQUIRES OWNER VERIFICATION` |

## Repository-side effects

- contract 61 reads submitted entries, predictions, progression and Golden Boot selections; it writes none of them;
- contract 62 reads entries, predictions, matches and score events to order final standings; it does not change scoring or locks;
- contract 63 moves the unsuppressed aggregate to a private helper and gates the public RPC at ten submitted entries;
- all three preserve Bonus Games separation;
- the aggregate remains tournament-wide rather than private-league scoped.

## Pending hosted verification

An owner with access should verify and date:

1. development migration count/highest version and public/private function privileges;
2. production migration count/highest version and public/private function privileges;
3. Netlify contract declarations and development/production Supabase separation;
4. the named product and final-evidence deploy identities;
5. any production preservation and recovery claims carried by the annotation.

## Related authority

- [`../quality/current-status.md`](../quality/current-status.md)
- [`../quality/risk-register.md`](../quality/risk-register.md)
- [`../quality/investigations/2026-07-29-tag-reconciliation.md`](../quality/investigations/2026-07-29-tag-reconciliation.md)
- `config/deployment-contract.json`
