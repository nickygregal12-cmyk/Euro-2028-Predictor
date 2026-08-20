# Hosted migration status

> **Live index only.** The machine records are authoritative; this page exists so a human or AI can see the current rollout boundary without reading the historical contract chronology. The previous full narrative is preserved at [`docs/history/context-reset-2026-08-19/ops-pending-migrations.pre-reconciliation.txt`](../history/context-reset-2026-08-19/ops-pending-migrations.pre-reconciliation.txt).

## Current state — repository 208, Production 208, Development 208 (20 August 2026)

Repository contract **208** is the head of the committed migration chain.

| Environment | Recorded contract | Authority |
| --- | ---: | --- |
| Development Supabase `iouzoutneyjpugbbtdem` | **208** | [`config/development-hosted-contract.json`](../../config/development-hosted-contract.json) |
| Production Supabase `vkfnsqdyhvtwyqkisxhk` | **208** | [`config/production-hosted-contract.json`](../../config/production-hosted-contract.json) |

**Repository, Development and Production are level at Contract 208. There are no pending repository migrations in either hosted environment.**

Contracts 206 through 208 reached Development first through guarded fast-lane run `32312618799`. Production then crossed the exact 205-to-208 boundary through guarded rollout run `32318082186` from exact `main` `f2c244b6a4a0fb27e81624df41a9e893d39bd565`, gated on encrypted backup `32312404053` and exact-head disposable-restore rehearsal `32317690357`; coordinator run `32317678763` also re-proved that `main` had not moved between rehearsal and rollout. The canonical rollout postflight passed, and an independent read-only Production query then named all 208 ledger rows and the final migration before the machine record was written.

## Netlify deployed-contract declarations

`EURO28_DEPLOYED_DB_CONTRACT` is compatibility metadata for builds, not proof that a bundle was rebuilt or published. A declaration may trail its hosted database; it must never lead it.

| Surface | Context | Declared contract |
| --- | --- | ---: |
| Netlify `predictorhub` | `dev`, `branch-deploy`, `deploy-preview` | **208** |
| Netlify `predictorhub` | `production` | **208** |
| Netlify `euro28predictor` | `dev`, `branch-deploy`, `deploy-preview` | **208** |
| Netlify `euro28predictor` | `production` | **208** |

The three non-production contexts were raised only after Development reached 208. The Production contexts stayed at 205 until Production itself was independently verified at 208, then both were raised to 208 and read back directly from Netlify.

- **No repository migration is pending in Development or Production.**
- `promotionAuthorised` remains false in the Production machine record; closing a completed rollout is not standing authority for a future one.
- Repository, Development, Production and a published Netlify bundle remain separate closure states. Never infer one from another.
- The historic Netlify project `euro28-predictor-dev` is out of scope for the current Development/Production migration lane.

## How to use this page

1. Read the three machine records before any future rollout.
2. If Development trails the repository, use the guarded Development lane required by the governing ADR/workflow.
3. Production moves only under explicit authority for the exact boundary and with its own backup/rehearsal gates.
4. For why a historical contract existed, use the archived narrative or the migration/PR itself — do not reconstruct history from this live index.

The old “Repository candidate … applied to no hosted environment by this record” blocks are **historical contract records**, not a current pending queue; that wording is intentionally kept only in the archive.
