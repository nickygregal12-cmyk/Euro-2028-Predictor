# Predictor progress handover — 4 August 2026, 05:00 session

## Scope

This session continued from the 01:00 and 03:00 handovers. It merged the verified contract-78 hosted-status control, freshly rechecked GitHub, both Supabase targets and the single active Netlify site, removed obsolete contract-66 rollout instructions from the operational inventory, and added a dedicated inventory freshness gate.

The historic Netlify project `euro28-predictor-dev` remained out of scope throughout.

## Confirmed state

- GitHub repository: `nickygregal12-cmyk/Euro-2028-Predictor`.
- PR #425 passed exact-head CI and its active-site Netlify deploy preview, then squash-merged as `deb4c9fba27779475a5814fc16ebf7f5c6e890a1`.
- Repository contract: **78**, through `20260804053000_cup_league_schedule.sql`.
- Development Supabase `iouzoutneyjpugbbtdem`: **78 migrations**, freshly verified through `20260804053000_cup_league_schedule`.
- Production Supabase `vkfnsqdyhvtwyqkisxhk`: **63 migrations**, freshly verified through `20260729154931_prediction_consensus_minimum_cohort`; unchanged.
- Active Netlify site: `euro28predictor`, site ID `c69da01a-4650-43db-a1d2-b78b7f8e198a`.
- Active Netlify deploy: `6a6bac566b6e440008d44e5b`, state `ready`.

No Supabase write, production mutation, Netlify configuration change or deployment was performed.

## Work completed

### 1. Merged the 03:00 hosted-status control

PR #425 was merged only after:

- GitHub CI completed successfully at exact head `6cde0f2d6ee4236d93c38ca9f83c4161f366e998`;
- the deploy preview on the active `euro28predictor` Netlify project was ready;
- the PR remained mergeable and unchanged.

The merge adds:

- `config/development-hosted-contract.json`;
- `.github/workflows/development-hosted-status-followup.yml`;
- the 03:00 handover.

### 2. Reconciled the operational migration inventory

Updated `docs/ops/ops-pending-migrations.md` to remove stale instructions that still described contract 66 as pending and development as contract 77.

The inventory now records:

- repository contract 78;
- development contract 78;
- production contract 63;
- all contracts 64–78 applied to development;
- the single active Netlify project only;
- provider-ingestion custody as the next implementation boundary;
- explicit exclusion of the historic Netlify project.

It now points to `config/development-hosted-contract.json` for the moving hosted fact instead of using historical rollout prose as live authority.

### 3. Added a fail-closed inventory freshness guard

Added:

- `scripts/check-hosted-migration-inventory.mjs`;
- `.github/workflows/hosted-migration-inventory.yml`.

The guard checks that:

1. hosted development cannot lead the repository contract;
2. production promotion remains explicitly unauthorised;
3. the migration inventory references the machine-readable hosted record;
4. development and production rows match that record;
5. obsolete contract-66 rollout wording is absent;
6. the historic Netlify project remains explicitly excluded.

The workflow runs on relevant pull requests and on matching changes to `main`.

## Verification

- PR #425 exact-head CI: **success**.
- PR #425 active-site Netlify preview: **ready**.
- Development hosted migration ledger: **78 entries**.
- Production hosted migration ledger: **63 entries**.
- Active Netlify deploy: **ready**.
- `config/deployment-contract.json`: `requiredMigrationCount: 78`.
- `config/development-hosted-contract.json`: development 78, production 63, promotion unauthorised.
- New guard logic reviewed against those committed records.

## Remaining authority drift

Two prose documents still contain copied hosted-contract wording from before the machine record was introduced:

- `AGENTS.md` says development is contract 77 in one paragraph;
- `docs/quality/current-status.md` says development is contract 77 and carries a contract-67-era next-executable narrative.

They were not destructively rewritten in this session because both are large governing documents and the available repository write interface replaces whole files rather than applying reviewed line patches. The operational document most likely to cause an unsafe action was corrected first, and the new machine record plus inventory gate now prevents the obsolete rollout plan from remaining authoritative.

## Risks and blockers

1. The new inventory guard still requires normal PR CI validation before merge.
2. `AGENTS.md` and `docs/quality/current-status.md` remain stale until a normal line-level repository edit reconciles them to `config/development-hosted-contract.json`.
3. The generated hosted-status follow-up workflow has not yet executed after a future migration rollout; its first real run remains an operational proof point.
4. Production is intentionally 15 contracts behind. This is not a defect and must not be closed by promotion outside a milestone.
5. Provider-ingestion custody remains unimplemented on current `main`; stale PR #352/#416 work must not be revived.

## Overnight consolidated result

Across the three sessions:

- contract 78 was confirmed in repository and development;
- production was confirmed and preserved at contract 63;
- the single active Netlify project was confirmed ready;
- stale PR #416 was closed as superseded;
- the 01:00 handover PR #424 was merged;
- the machine-readable hosted-development record and post-rollout PR workflow were added and merged through PR #425;
- obsolete contract-66/77 operational migration instructions were removed;
- a dedicated hosted migration inventory CI guard was added;
- no production, database or hosting mutation was made.

## Exact next action

1. Let the authority-reconciliation PR complete normal CI and the active-site Netlify preview; merge only at exact green head.
2. Reconcile `AGENTS.md` and `docs/quality/current-status.md` with reviewed line-level edits so both consume `config/development-hosted-contract.json`, then widen the guard to cover them.
3. Start provider-ingestion custody from current `main`: strict decoders and archive-before-decode tests first, followed by the server-only Edge Function and canonical identity mapping. Do not reuse stale migrations from PR #352 or #416.
