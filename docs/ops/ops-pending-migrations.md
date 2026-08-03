# Hosted migration inventory and rollout status

Live source of truth for repository migration count and the verification still required for hosted environments.

## Current state — 3 August 2026

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository `main` | **70** | 70 canonical migrations through `20260803213000_season_scoring.sql`; contract 70 adds the season Main Predictor scoring counterpart with TypeScript parity | MERGED; HOSTED NOT APPLIED |
| Development Supabase at contract 69 | **69** | contract 69 applied 3 August 2026 through the ADR 0024 fast lane, run 30845804899 | VERIFIED |
| Development Supabase at contract 68 | **68** | contract 68 applied 3 August 2026 through the ADR 0024 fast lane, run 30843028463 | VERIFIED |
| Development Supabase at contract 67 | **67** | contract 67 applied 3 August 2026 through the ADR 0024 fast lane, run 30840592967 | VERIFIED |
| Repository at contract 66 | **66** | 66 canonical migrations through `20260803070000_c1b_game_catalogue_memberships.sql`; PR #371 merged 3 August 2026 | VERIFIED |
| Development Supabase | **66** | contract 66 applied 3 August 2026 through the ADR 0024 additive fast lane, run 30837677979: dispatch guards, secret preflight, additive proof, pre-apply snapshot, `supabase db push`, postflight reporting `Development is at contract 66.` | VERIFIED |
| Production Supabase | **63** | migration ledger directly verified at 63 through `20260729154931_prediction_consensus_minimum_cohort` | PAUSED AND UNCHANGED |
| Netlify `dev` / `branch-deploy` / `deploy-preview` | **hosted declaration from last alignment** | all three non-production contexts point to the development Supabase project; a declaration trailing the repository contract is reported as informational rather than failing the build (ADR 0024) | VERIFIED FOR PROJECT REF; CONTRACT DECLARATION MAY TRAIL |
| Netlify `production` | **63 hosted declaration** | production points to the production Supabase project and remains on contract 63 | BLOCKED BY DESIGN |

### Contract 66 — C1b repository candidate

| # | Canonical migration | Repository-side purpose | Hosted status |
| ---: | --- | --- | --- |
| 66 | `20260803070000_c1b_game_catalogue_memberships.sql` | Generalises the existing game platform into a stable catalogue and per-season availability root; adds canonical join, leave, rejoin and disqualification evidence; links Main/Original entries and Bonus Games entrants to one membership truth; scopes private leagues to the selected game; seeds draft Premier League and Scottish Premiership 2026/27 season roots without fixtures or dates | disposable database parity passed before the latest main sync; exact combined-head gates required; development not applied |

Contract 66 preserves the C2 ownership and auth-deletion boundary. Issue #272 still blocks profile ownership, pseudonymisation and account-erasure work. No hosted migration is authorised merely because disposable parity passes.

### Contract 65 — Stage C1 hosted development baseline

| # | Canonical migration | Repository-side purpose | Hosted status |
| ---: | --- | --- | --- |
| 65 | `20260730235602_stage_c1_competition_season_foundation.sql` | Competition-season identity, metadata/timezone authority, rounds, fixture administration, monotonic locks, awards, same-season constraints, private lock authorities and always-on scope preparation | development VERIFIED; production not applied |

The guarded development rollout completed with encrypted backup and restore rehearsal, canonical preflight/postflight comparison, unchanged audit digest and preservation counts, and the single authored `enforce_joker_rules()` search-path hardening explicitly accounted for. Non-production Netlify contexts were then aligned to contract 65. Production remained contract 63 throughout.

### Contract 64

| # | Canonical migration | Repository-side purpose | Hosted status |
| ---: | --- | --- | --- |
| 64 | `20260730180000_cup_winner_deletion_semantics.sql` | Declares the omitted `on delete` action on `bonus_cup_fixtures.winner_user_id` as `restrict` | included in development contract 65; production not applied |

Behaviour-preserving: `NO ACTION` and `RESTRICT` are equivalent for this non-deferrable constraint. Production must not receive contracts 64, 65 or 66 merely to equalise numbers.

## Tagged repository state — 29 July 2026

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| `euro-2028-baseline` | 63 | 63 canonical migrations through `20260729154931_prediction_consensus_minimum_cohort.sql` | VERIFIED HISTORICAL BASELINE |
| Repository at reconciliation start | 63 | identical to the tag at the start of reconciliation; superseded by the current state above | HISTORICAL |

The tag annotation carries historical hosted claims and named deploy IDs. Current hosted truth is the directly verified state in the first table, not the tag contract.

## Contracts 61–63 inside the tag

| # | Canonical migration | Repository-side purpose |
| ---: | --- | --- |
| 61 | `20260729122100_prediction_consensus.sql` | Authenticated post-lock, tournament-wide Original Predictor aggregate over submitted entries |
| 62 | `20260729122200_final_standings_tiebreaks.sql` | Overall/private final standings tie-break activation after all results |
| 63 | `20260729154931_prediction_consensus_minimum_cohort.sql` | Ten-entry tournament-wide cohort gate and suppression below threshold |

## Pending hosted work

1. Complete all exact combined-head contract 66 gates on PR #371: build, lint, Vitest, dependency audit, zero-to-66 rebuild, database lint, full pgTAP, SQL/TypeScript parity, populated 65→66 transition and authenticated browser journeys.
2. Review and merge PR #371 only from a current, mergeable head with no unresolved review threads and no newer concurrent `main` work outstanding.
3. After merge, create a separate guarded development prepare/apply rollout for contract 65→66 with a fresh encrypted backup, restore rehearsal, one-migration dry run, exact confirmation and postflight preservation proof.
4. Only after development reaches contract 66 may Netlify `dev`, `branch-deploy` and `deploy-preview` declarations move from 65 to 66 and an exact-origin non-production smoke be accepted.
5. Keep production Supabase and Netlify at contract 63 until a separately scoped, explicitly approved production release.

## Related authority

- [`../quality/current-status.md`](../quality/current-status.md)
- [`../quality/risk-register.md`](../quality/risk-register.md)
- [`stage-c1-contract-65-rollout-recovery.md`](stage-c1-contract-65-rollout-recovery.md)
- [`../quality/investigations/2026-07-29-tag-reconciliation.md`](../quality/investigations/2026-07-29-tag-reconciliation.md)
- `config/deployment-contract.json`
