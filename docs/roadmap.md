# Multi-competition platform — roadmap

**Status date:** 3 August 2026  
**Purpose:** current delivery position and next executable slice.  
**Current facts:** [`quality/current-status.md`](quality/current-status.md)  
**Parent programme:** [`architecture/programme-plan.md`](architecture/programme-plan.md)  
**Engineering workstream:** [`architecture/multi-competition-hub-build-plan.md`](architecture/multi-competition-hub-build-plan.md)  
**Detailed inventory:** [`../MASTER-TODO.md`](../MASTER-TODO.md)  
**Decision authority:** [`adr/README.md`](adr/README.md)

This roadmap does **not** duplicate the programme phases or Stage A–L engineering plan. It records where delivery is now and the next executable sequence.

## Current baseline

Every moving value — the current `main` commit, the repository contract, each hosted contract, the live production deploy — is stated in [`quality/current-status.md`](quality/current-status.md) and [`ops/ops-pending-migrations.md`](ops/ops-pending-migrations.md). **This document deliberately states none of them.**

It used to. The result was a baseline nine releases behind the repository, sitting beside a pinned deploy id and short commit — one line below a bullet warning that a pinned SHA in a live document goes stale. Naming an authority and then restating its facts produces two answers to one question, and the stale one is the one that gets read. `tests/scripts/documentationContractFreshness.test.ts` now fails if any of it comes back.

What is durable enough to state here:

- Euro 2028: recoverable at `euro-2028-baseline`, with remaining tournament work parked until January 2028;
- production Netlify deploys are paused by the prebuild contract gate until an intentional production migration/release milestone. The last good deploy stays live;
- Stage B: complete through PR #226, with the retained checklist closed by PR #239;
- Stage C: design baseline, assertion classification, C2 non-interference and the detailed C1 schema overlay are complete. The Stage C1 migration is merged (PRs #317, #349) with hosted rollout tooling and a guarded GitHub workflow (PRs #350, #351); the hosted development apply **completed and was postflight-verified 2–3 August 2026** (PRs #359–#368 hardened the tooling en route). No production write is authorised;
- lock policy is **game-owned** (ADR 0020, PR #353): the competition supplies identity, calendar and structure; each game supplies its own explicit lock policy, failing closed when missing or incompatible.

## Development operating model

[`adr/0024-development-environment-operating-model.md`](adr/0024-development-environment-operating-model.md) is the authority for how work reaches the development environment. It exists because the ceremony protecting production had been applied to a database with no data worth protecting, and the cost was paid on every schema change.

- development data is **disposable** until a closed external cohort holds it. That expiry is a *condition*, not a date: the model ends when real entrants exist, whoever notices first;
- an **additive** development migration applies through `.github/workflows/development-fast-lane-rollout.yml`, which proves additiveness by reading the pending migrations rather than trusting the dispatcher. Anything destructive is refused and sent back to `stage-c1-development-rollout.yml`, which keeps the backup and restore rehearsal;
- a deploy preview whose hosted database trails the repository contract now **builds and reports the gap** instead of failing. Production keeps the fatal check. This ended a circular gate in which a schema-advancing PR could not produce a green preview before the merge that would make its schema real;
- browser journeys are **selected from the change** (`scripts/select-browser-journeys.mjs`), widening to the full suite on anything unrecognised. Contract and schema changes always run everything;
- development data is **reseedable** through `npm run reset:development`, which refuses both hosted project refs.

**What ADR 0024 does not relax:** production backup, preflight, approval and verification; RLS; TypeScript/PostgreSQL parity; and the C2 block under issue #272. Production has no fast lane.

## Delivered foundation

### Stage A — authority and control alignment

The platform ADRs, parent/child planning hierarchy, state architecture and domain controls are established. Brand selection is deferred with a trigger under ADR 0019 and is not on the engineering critical path.

### Stage B — competition-context foundation and surface migration

Complete on `main`:

- pure context, lock and match-state foundation through PR #212;
- Home migration through PR #219;
- Matches, Match Centre, entry lock and `MatchTemporalState` retirement through PR #226;
- clean application, database, preview and authenticated-browser gates before integration;
- retained inventory closure through PR #239.

### Landed control and Stage C preparation

- PR #228: cross-tournament read scoping, production guard derivation, real 404 routing and deployment-contract controls.
- PR #229: Original Predictor scoring parity.
- PR #232: complete Database parity directory execution.
- PR #233: CSP/application resource parity.
- PR #235: environment and deployment-RPC/database-privilege parity.
- PR #245: timezone-authority before-state.
- PR #246: effective account-deletion action before-state.
- PR #250: exhaustive public-table RLS and security-definer `search_path` guard.
- PR #252: `competitionTimeZone`/`viewerTimeZone` seam with temporary viewer fallback.
- PR #255: TypeScript test project and corrected timezone fixtures.
- PR #258: Playwright/e2e, TypeScript tool and config coverage.
- PR #261: production-smoke coverage, explicit strictness and exhaustive committed TS/TSX project guard.
- PR #264: typechecking for the three JavaScript deploy gates and an explicit deferred JavaScript inventory.
- PR #265: exhaustive public-view and direct browser relation-grant guard.
- PR #266: disposable-local leaderboard scale evidence; ACQ-R02 remains open and no standings migration was introduced.
- Original Stage C TypeScript contracts: `stageCRelationCoverage`, `stageCFunctionCoverage`, `stageCTriggerBindingCoverage`, `stageCTournamentIdCompatibility` and `stageCEuroSeedPreservation`.
- Hostile reference before-state: `031_stage_c_reference_scope_before_state.sql` (PR #286).
- Lock and late-write before-state: `032_stage_c_lock_before_state.sql` (PR #292).
- C1 boundary: `stageC1ContractClassification.test.ts` enforces the 40/0/9 assertion split; `stageC1NonInterference` freezes auth ownership, deletion FKs and ownership RLS.
- C1 overlay: `stageC1SchemaOverlayCoverage.test.ts` proves every original relation and reviewed function has a current C1/C2/shared disposition.
- C1 lock-function consistency: `stageC1LockFunctionConsistency.test.ts` compares the entry-lock trigger definitions to each other. The migration defines each twice because the season-scope backfill writes to lock-guarded tables, and the second definition of the generic guard had drifted to `security definer` + `session_user` — which left the trusted automatic-submission refresh permanently unreachable. `pg_proc` cannot see this, because the live database only shows the last definition.
- PRs #319–#340 (31 July 2026): gate integrity and accessibility enforcement. CI refuses to pass a suite that discovered no test files; the browser-suite path filter now watches what its jobs read, including the deployment contract; the deploy smoke compares served security headers against the committed ones rather than checking four of thirteen directives; every `e2e` spec is proven to run under exactly one Playwright config with a project gate that exists. Accessibility moved from a scan over 11 of 34 routes to every declared route plus the component gallery, component states no route renders, the design-token contrast matrix and the declared CSS pairings — with axe's `incomplete` results counted, not discarded. Thirteen real defects were found and fixed, and the palette was raised so every text pairing meets AA (`--gold-strong` added; the light muted ramp rebalanced). Two accessibility deferrals remain, both "covered elsewhere" rather than gaps.

PRs #245 and #246 remain before-state contracts. PR #252 is the application seam. PRs #250, #255, #258, #261, #264 and #265 are preservation invariants.

## Stage C design and governance

PR #236 — **merged 30 July 2026** — remains the original combined design record.

The accepted implementation authority is now:

- [`architecture/stage-c1-c2-governance.md`](architecture/stage-c1-c2-governance.md) — C1/C2 split;
- [`architecture/stage-c1-contract-classification.md`](architecture/stage-c1-contract-classification.md) — 40 C1, zero authorised C2 after-state and nine shared-before-state assertions;
- [`architecture/stage-c1-schema-overlay.md`](architecture/stage-c1-schema-overlay.md) — relation, function, RLS, migration-order and evidence dispositions for C1.

Stage C1 keeps current auth-owned competitive rows unchanged and is tracked by issue #303. Stage C2 remains blocked by the independent data-protection review in issue #272.

None of these documents authorises a migration or hosted write.

## Next executable sequence

1. ~~Approve and integrate PR #236 as the Stage C design baseline.~~ **Done.**
2. ~~Land the original pre-migration contract inventory and C1 boundary guard.~~ **Done.**
3. ~~Split C1 from C2 and keep the legal review scoped to profile ownership/deletion.~~ **Done.**
4. ~~Reconcile every combined Stage C relation, function, RLS and evidence instruction.~~ **Done through the C1 schema overlay and `stageC1SchemaOverlayCoverage.test.ts`.** The overlay covers 35 current relations/view, four proposed C1 relations and 51 reviewed functions, while preserving PR #246 unchanged.
5. ~~Prepare and review the exact append-only development-intent C1 migration.~~ **Done — merged at contract 65 (PRs #317, #349), proven on disposable infrastructure (rebuild, lint, pgTAP, parity, Euro preservation).**
6. ~~Move lock policy from the competition to the selected game per ADR 0020.~~ **Done — PR #353.**
7. ~~Complete the guarded Stage C1 development rollout.~~ **Done — applied and postflight-verified 2–3 August 2026** (prepare run 30771110879, apply run 30771280887). The `SUPABASE_DEV_DB_URL` blocker is resolved and non-production Netlify contexts are aligned to 65; production Netlify stays 63.
8. ~~C1b — persistent game catalogue and memberships.~~ **Done — PR #371**, applied to development through the ADR 0024 fast lane: game definitions, per-competition-season availability, one entry per competition-season game with joined/left/disqualified state and append-only join/leave/rejoin evidence; separate membership for Main Predictor, LMS and Predictor Championship; seeds for Premier League 2026/27, Scottish Premiership 2026/27 and Euro 2028. It extended the existing `bonus_competition_*`/`entries` structures rather than duplicating them, and carried no C2 content.
9. **Provider-ingestion custody**: recreate PR #352's strict decoders, archive-before-decode custody, server-only Edge Function and canonical identity mapping on top of C1b; do not merge its stale migration. This step used to pre-assign itself a contract number, which merge order then gave to something else. Contract numbers are allocated by the order migrations land, so no planned step names one here.
10. **Domestic Main Predictor vertical slice** (ADR 0012 as amended by ADR 0020): one generic implementation serving Premier League and Scottish Premiership — entries, matchweeks, score predictions, ten whole-matchweek Jokers split five/five, zero-buffer matchweek locks, automatic submission, separate domestic scoring authority with TypeScript/PostgreSQL parity, standings, audited fixture reassignment.

    **Rule layer done, 3 August 2026.** PRs #372, #373, #375, #377, #379, #381 and #383 landed ten further pure authorities, thirteen in total, under `src/domain/season/` covering every pinned rule in ADRs 0012, 0013 and 0014 — scoring and Jokers, standings and derived views, matchweek settlement, card submission at lock, fixture reassignment, LMS eligibility/reset/round resolution/presets, and the Cup's format selector, tie settlement, schedule generation, table/split and launch threshold.

    **Persistence and SQL parity followed, 3–4 August 2026.** Season fixtures, predictions and matchweek Jokers, Main Predictor scoring, LMS pick resolution, setup and entrant state, LMS round conclusion and season exhaustion, and the Cup's pure rules all have PostgreSQL counterparts held in step by `tests/database-parity/` and proven against a real database by `supabase/tests/`. The contract each landed at is in [`ops/ops-pending-migrations.md`](ops/ops-pending-migrations.md) rather than here.

    **The Cup rescoping completed at contracts 75–79.** ADR 0022's correction is discharged: `predictor_internal.cup_*` is competition-agnostic, the season supplies its own points and settlement sources, and the shared functions combine both by union rather than branching on competition kind. Cup persistence turned out to be largely present — `bonus_cup_groups`, `bonus_cup_members`, `bonus_cup_fixtures` and `bonus_competition_windows` were already competition-scoped, and contract 79 removed the last tournament-format constraints from them.

    What remains in this step, narrowed to what is actually outstanding:

    - the **recurring matchweek scheduler** is now built: contract 80 decides what the lock does to a card, contract 82 removed the pre-filled card so a partial card resolves like any other, contract 81 stores where each card stands plus an append-only record of what the lock did, and contract 83 is the job that finds due matchweeks and writes the outcome. The ledger is keyed by lock instant, so a retry, a crash or a rescheduled matchweek all behave;
    - the **LMS settlement job**, which is two slices rather than one, and the order matters. Contracts 71–73 decide a pick, a round and a season, but nothing drives them from confirmed results. Scoping produced two findings:

      **It needs no new storage.** `bonus_lms_selections` is already competition-generic — it keys on `bonus_competition_windows` and `teams`, both of which a league season has — and the season window/fixture link it also needs already exists. `season_cup_window_fixtures` is `(window_id -> bonus_competition_windows, season_fixture_id -> season_fixtures)` and contains nothing Cup-specific but its NAME. Reuse it rather than adding a parallel `season_lms_window_fixtures`; renaming is unavailable because contract 77 is applied to development and migrations are append-only after hosted application.

      **It is blocked on a parity slice that does not exist yet.** `resolveLmsEligibility` and `autoAssignLmsTeam` are TypeScript-only — contract 71 gave `resolve_lms_pick` a SQL counterpart but not these. The job cannot be written without them, because ADR 0013 requires an entrant who missed a pick to be **auto-assigned deterministically, not eliminated**, and a server job that eliminated for silence would be the harshest possible reading of a rule the ADR explicitly rejected as "too punitive across thirty-eight weekly deadlines". So: SQL parity for eligibility and auto-assignment FIRST, then the settlement job.

      **A blocker found while designing the job, larger than the job itself.** `assert_bonus_lms_selection_shape` — defined once in the original tournament LMS migration and never redefined — ends with a check that the picked club plays in the round, and it reads `bonus_window_fixtures` joined to `matches`. That is the TOURNAMENT link. A season LMS selection has its fixtures in `season_cup_window_fixtures` joined to `season_fixtures`, so the trigger raises "The picked team does not play in this round" for every season pick, locked or not. **Season Last Man Standing selection was therefore impossible**, and no later migration widened it. The remaining work is not "add a settlement job"; it is "make season LMS selection possible", of which the job is the last part. **Step one landed at contract 86**: the trigger function is redefined so the participation check accepts either link, additive via `create or replace` — the same route contract 82 took for the card resolver, and necessary because `bonus_lms_selections` is inside the production-hosted contract-63 baseline. Nothing else in the trigger changed, and the lock in particular still refuses every caller, because widening who may pick and opening a hole in the lock are separate changes. The tournament path was held by differential test rather than assertion: 30 accept/refuse scenarios against the old function and the new one, with the 25 that do not involve a season round identical down to the refusal text, and three mutants of the widened check each killed. Two steps remain — the lock-time auto-assignment writer with its server-only capability exception, and the settlement job itself.

      **A second blocker, found by testing an assumption of the writer rather than by reading.** ADR 0013 §25 makes the used-team reset MANDATORY and §87 records "no used-team reset" as a rejected alternative, "because long competitions become mathematically impossible once a survivor exhausts the team pool". `bonus_lms_selections` could not store it: `unique (competition_id, user_id, team_id)` from the contract-63 tournament baseline allows one club per entrant per competition for all time, so the pick the rule authorises is the pick the key refuses — measured, not inferred, with the rule returning `usedListReset: true` and the storage returning 23505 on the same scenario. A twenty-club league over thirty-eight matchweeks reaches this around matchweek twenty of every season, and it blocked the existing player RPC as much as any future writer. **Contract 87 makes it storable** by scoping club uniqueness to a `used_cycle`: the reset opens a new cycle rather than deleting the picks the settlement replay must fold over. The tournament is untouched — it never leaves cycle 0, where the new key is the old key.

      **A trap the parity slice must encode, verified rather than assumed.** `resolveLmsEligibility` sorts eligible teams by club name using JavaScript code-unit comparison, and `autoAssignLmsTeam` returns element [0]. PostgreSQL's `order by name` uses the database collation, and on a scratch PostgreSQL 16 the two disagree: C collation gives `A.F.C. Ajax | AFC Bournemouth | ATH MADRID | Aston Villa | afc wimbledon`, matching JavaScript exactly, while ICU `en-US` gives `A.F.C. Ajax | AFC Bournemouth | afc wimbledon | Aston Villa | ATH MADRID`. Because auto-assignment takes the FIRST element, a naive `order by name` does not merely order a list differently — it assigns a different club to a player who missed their pick, and in Last Man Standing that is the difference between surviving the round and being eliminated. The SQL must sort `collate "C"`, and the parity suite must pin it with names whose C and ICU orders actually differ, or the assertion proves nothing. The domain module anticipated this in its own docblock: alphabetical order is "chosen over locale collation so TypeScript and the future SQL parity implement the same deterministic order regardless of environment locale."

      What the job itself then adds is the outcome derivation — won/drew/lost/postponed for the picked team from its season fixture, where `status = 'played'` decides the result and every other status (`scheduled`, `postponed`, `abandoned`, `void`) is a postponement that survives without consuming a life or a save — and the loop that spends allowances through `resolve_lms_pick` and concludes through `conclude_lms_round`;
    - the **Cup split-stage persistence decision**, then its implementation. This is the only Cup work left, and it is a decision before it is a migration: a season split stage needs `group_id` and `matchday`, which `bonus_cup_fixtures_group_shape` forbids for any non-group stage, so the enum cannot widen until that check's intent is settled;
    - every **surface**. **None of the surface work can start before the Phase 1 design.**
11. Keep production at contract 63 and paused. Production promotion is a separate intentional release milestone.
12. Complete C2 only after issue #272 records an independent review and the approved retention/erasure boundary is reflected in design and tests.
13. Review ACQ-R02 only on a material cap increase or adverse rehearsal/hosted concurrency evidence.

## Parked Euro 2028 scope

The complete inventory remains in [`../MASTER-TODO.md`](../MASTER-TODO.md) for January 2028. It includes official data, final tournament presentation, administration fit-for-final verification, rehearsal, operational recovery and the published-release decision.

## Programme and stage navigation

- Product phases, discovery, instrumentation, cohort thresholds and go-to-market: [`architecture/programme-plan.md`](architecture/programme-plan.md).
- Engineering Stages A–L and engineering gates: [`architecture/multi-competition-hub-build-plan.md`](architecture/multi-competition-hub-build-plan.md).
- Stage C implementation split: [`architecture/stage-c1-c2-governance.md`](architecture/stage-c1-c2-governance.md).
- Stage C assertion boundary: [`architecture/stage-c1-contract-classification.md`](architecture/stage-c1-contract-classification.md).
- Stage C1 implementation overlay: [`architecture/stage-c1-schema-overlay.md`](architecture/stage-c1-schema-overlay.md).
- Original combined Stage C design and coverage: [`architecture/stage-c-competition-season-schema.md`](architecture/stage-c-competition-season-schema.md) and [`architecture/stage-c-schema-coverage.md`](architecture/stage-c-schema-coverage.md).
- Current implementation and hosted facts: [`quality/current-status.md`](quality/current-status.md).
- Detailed active and parked tasks: [`../MASTER-TODO.md`](../MASTER-TODO.md).
- Decisions: [`adr/README.md`](adr/README.md).

When documents disagree, keep the conflict visible until deliberately reconciled. ADRs decide architecture and rules; current code/tests and verified hosted evidence decide implementation truth.
