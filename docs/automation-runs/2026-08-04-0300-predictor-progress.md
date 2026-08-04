# Predictor progress handover — 4 August 2026, 03:00 session

## Scope

This session continued from the 01:00 handover, merged its verified report, refreshed GitHub/Supabase/Netlify state, and addressed the repeated class of development-hosted contract drift. It inspected only the active Netlify site `euro28predictor`; the historic `euro28-predictor-dev` project remained out of scope.

## Confirmed state

- GitHub repository: `nickygregal12-cmyk/Euro-2028-Predictor`.
- PR #424 passed CI and the active-site Netlify deploy preview, then squash-merged as `9122733fa26b6bd486b4259267d7ef160eff2cb2`.
- Repository contract: 78 through `20260804053000_cup_league_schedule.sql`.
- Development Supabase `iouzoutneyjpugbbtdem`: 78 migrations through `cup_league_schedule`, freshly read from the hosted migration ledger.
- Production Supabase `vkfnsqdyhvtwyqkisxhk`: 63 migrations through `prediction_consensus_minimum_cohort`; unchanged.
- Active Netlify site `euro28predictor` (`c69da01a-4650-43db-a1d2-b78b7f8e198a`): current deploy `6a6bac566b6e440008d44e5b`, state `ready`.

No database, production or Netlify mutation was made.

## Work completed

### 1. Closed the 01:00 handover gate

PR #424 was merged only after its exact head had successful GitHub CI and a ready deploy preview on the active Netlify project.

### 2. Added a machine-readable hosted development contract

Added `config/development-hosted-contract.json`, initially recording:

- development project ref `iouzoutneyjpugbbtdem`;
- hosted contract 78;
- latest migration `20260804053000_cup_league_schedule`;
- production contract 63;
- `productionPromotionAuthorised: false`.

This separates moving hosted evidence from prose while keeping production posture explicit and fail-closed.

### 3. Added automatic post-rollout status follow-up

Added `.github/workflows/development-hosted-status-followup.yml`.

After a successful `Development fast-lane rollout`, it:

1. checks out current `main`;
2. derives the repository contract and latest migration from committed sources;
3. updates `config/development-hosted-contract.json` with the successful source run and exact head;
4. creates a dedicated branch and pull request rather than pushing directly to `main`;
5. retains production at contract 63 and explicitly unauthorised for promotion.

This removes the previous failure mode where a successful hosted apply could complete with no repository follow-up at all. The generated PR remains subject to normal review and CI.

## Authority finding

The durable next roadmap item is provider-ingestion custody: recreate the strict decoders, archive-before-decode custody, server-only Edge Function and canonical identity mapping from current `main`, without reviving stale PR #416/#352 migrations. The domestic vertical slice has already advanced through rule and SQL parity work to contract 78; its remaining work is scheduler, LMS settlement, Cup persistence and surfaces, with surfaces blocked on Phase 1 design.

## Remaining documentation drift

`docs/quality/current-status.md`, `AGENTS.md`, and `docs/ops/ops-pending-migrations.md` still contain prose that says development is contract 77 or describes contract-66/67 work as pending. They must be reconciled to the fresh contract-78 evidence and the roadmap's provider-ingestion next step.

This branch introduces the durable machine record and automatic follow-up mechanism first. The 05:00 session should complete the prose reconciliation and add a guard ensuring the live status authority references the machine record rather than copying a second hosted contract number.

## Verification

- PR #424 exact-head CI: success.
- PR #424 active Netlify deploy preview: ready.
- Development migration ledger: 78 entries, latest `20260804053000_cup_league_schedule`.
- Production migration ledger: 63 entries, unchanged.
- Active Netlify production deploy: ready.
- Workflow YAML was reviewed after correcting an initial duplicate-step draft; final file has one deterministic update-and-PR step.

## Risks and blockers

1. The new follow-up workflow has not yet executed in GitHub because it only triggers after a future successful fast-lane rollout. Its syntax and behaviour still require CI validation on this PR.
2. The prose authority remains stale until the next focused documentation update merges.
3. A generated status PR can still wait unmerged; the improvement guarantees visible repository work and evidence, not automatic bypass of branch protection.
4. Production remains 15 contracts behind intentionally. Do not promote it to eliminate the gap.

## Exact next action for the 05:00 session

1. Inspect and merge this PR only if exact-head CI and the active-site preview are green.
2. Reconcile `docs/quality/current-status.md`, `AGENTS.md`, and `docs/ops/ops-pending-migrations.md` to contract 78 and provider-ingestion custody as the next roadmap item.
3. Add/adjust documentation freshness coverage so those documents reference `config/development-hosted-contract.json` and cannot independently restate a conflicting development contract.
4. Then begin the provider-ingestion custody rebuild from current `main` only if the authority reconciliation is merged and the remaining session permits a coherent, tested slice.
