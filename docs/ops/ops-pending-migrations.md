# Hosted migration status

> **Live index only.** The machine records are authoritative; this page exists so a human or AI can see the current rollout boundary without reading the historical contract chronology. The previous full narrative is preserved at [`docs/history/context-reset-2026-08-19/ops-pending-migrations.pre-reconciliation.txt`](../history/context-reset-2026-08-19/ops-pending-migrations.pre-reconciliation.txt).

## Current state — repository 208, Production 208, Development 208 (20 August 2026)

Repository contract **208** is the head of the committed migration chain.

| Environment | Recorded contract | Authority |
| --- | ---: | --- |
| Development Supabase `iouzoutneyjpugbbtdem` | **208** | [`config/development-hosted-contract.json`](../../config/development-hosted-contract.json) |
| Production Supabase `vkfnsqdyhvtwyqkisxhk` | **208** | [`config/production-hosted-contract.json`](../../config/production-hosted-contract.json) |

**All three are level at Contract 208, and there is no pending migration anywhere.** Contracts 206 through 208 reached Development through guarded fast-lane run `32312618799` from exact `main` `0c489629d299c2e57bd0981d0b2b2b4f6b56c287`, and an independent read-only Supabase query then named all 208 ledger rows and the newest migration before that record was written.

Production followed, in that order, which the workflows refuse to invert. The exact-head read-only rehearsal [32317690357](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32317690357) passed and the guarded rollout [32318082186](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32318082186) succeeded, both from exact `main` [`f2c244b`](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/commit/f2c244b6a4a0fb27e81624df41a9e893d39bd565); the coordinator merged as #939 refused to dispatch the rollout until the rehearsal had succeeded and `main` had not moved by one commit. An independent read-only query after it named 208 ledger rows, every Contract-205 protected count unchanged, the three new reads authenticated-only with `anon` refused, and both publication gates still closed. The measured read-back is in the machine record, which is the authority.

Development and Production were level at Contract 205 before these three landed. Contracts 199 to 205 reached Development first and Production second, in that order, which the Production workflows refuse to invert. Production was moved by guarded rollout [32253892640](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32253892640) from exact `main` `8971245`, gated on encrypted backup [32229916242](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32229916242) and exact-head rehearsal [32252751621](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/32252751621). **That run is recorded FAILED and it is not a contradiction:** the apply succeeded and the run then exited on its own postflight measurement, so Production is correctly migrated and the workflow's own verification never ran. The measured read-back is in the machine record, which is the authority; this page states only that the boundary was crossed and where to read the evidence.

## Netlify deployed-contract declarations

These rows deliberately mirror the current declaration table in [`netlify-deploy-access.md`](netlify-deploy-access.md). A declaration may trail its hosted database; it must never lead it.

| Surface | Declared contract |
| --- | ---: |
| Netlify `euro28predictor` non-production contexts | **178 hosted declaration** |
| Netlify `euro28predictor` production | **178 hosted declaration** |

- No environment has a pending repository migration. The 205-to-208 promotion boundary is closed.
- Production being level with Development is the END of a gated promotion and not a standing state: the next repository migration reopens the gap, and Development still goes first.
- Repository, Development and Production remain separate closure states. Never infer hosted state from the repository count.
- The historic Netlify project `euro28-predictor-dev` is out of scope for the current Development/Production migration lane.

## How to use this page

1. Read the three machine records before any rollout.
2. If Development trails the repository, use the guarded Development lane required by the governing ADR/workflow.
3. Production moves only under explicit authority for the exact boundary and with its own backup/rehearsal gates.
4. For why a historical contract existed, use the archived narrative or the migration/PR itself — do not reconstruct history from this live index.

The old “Repository candidate … applied to no hosted environment by this record” blocks are **historical contract records**, not a current pending queue; that wording is intentionally kept only in the archive.
