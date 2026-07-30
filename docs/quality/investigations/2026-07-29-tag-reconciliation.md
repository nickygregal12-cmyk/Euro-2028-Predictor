# Tagged Euro 2028 baseline reconciliation

**Date:** 29 July 2026  
**Branch:** `chore/tag-reconciliation`  
**Tag:** `euro-2028-baseline`  
**Tagged commit:** `1fb8ffd36ad113079181829a8bcc47175c43b6da`

## Purpose

Reconcile the tagged baseline against the earlier contract-60 readiness assessment and establish the current source-backed status of `PRIV-001`.

Repository and GitHub history are verified in this report. This task has no database or Netlify access. Every hosted claim is therefore `REQUIRES OWNER VERIFICATION`, even where the tag annotation or earlier repository documents describe it as verified.

## Step 1 — Tag verification

**Status:** COMPLETED

GitHub ref comparison confirms:

- `euro-2028-baseline` resolves to `1fb8ffd36ad113079181829a8bcc47175c43b6da`;
- `main` resolves to the same commit at the start of this reconciliation;
- comparison status is `identical`;
- the tag is zero commits ahead and zero commits behind `main`.

### Annotation — verbatim

The annotated tag message is:

> Euro 2028 product baseline. Repository, development Supabase, production Supabase and all Netlify contexts verified at contract 63 with 63 canonical migrations, highest 20260729154931_prediction_consensus_minimum_cohort.sql. Product release deploy 6a6a53af58a0a500096b7cb1 published from ff633396e04eca77ed4456c5537ab361d9d259ee. Final evidence deploy 6a6a5816a972230008318710 published from 1fb8ffd36ad113079181829a8bcc47175c43b6da. Test evidence: CI 30473545872 with 149 Vitest files, Database parity 30473545780, Browser E2E and exact preview smoke 30473546011. Superseded by the multi-competition hub direction (ADR 0011).

### Placeholder check

No unfilled placeholders were found. Specifically, the annotation contains none of:

- `<OWNER TO CONFIRM>`;
- `<N>`;
- `<M>`;
- `<FILENAME>`;
- `<X>`;
- `<Y>`.

### Annotation versus tagged source

| Annotation statement | Tagged-source result |
| --- | --- |
| Contract | `63` — matches |
| Canonical migration count | `63` — matches `requiredMigrationCount` and the recorded repository chain |
| Highest migration | `20260729154931_prediction_consensus_minimum_cohort.sql` — matches |
| Product release commit | `ff633396e04eca77ed4456c5537ab361d9d259ee` is an ancestor merged by PR #193 |
| Final evidence commit | `1fb8ffd36ad113079181829a8bcc47175c43b6da` — exact tagged commit |
| CI figures | `149 Vitest files` and runs `30473545872`, `30473545780`, `30473546011` describe the PR #193 product-release head/merge lineage, not the exact final documentation-only tag commit |

The test evidence is therefore accurate product-release evidence but is not labelled as exact-tag validation. The exact tag commit arose from documentation-only PR #197, whose own repository checks were CI `30485286469` and Database parity `30485286465`. This is a precision contradiction in the annotation, not a contract or tag-target mismatch.

The annotation's hosted statements cannot be independently verified in this task and are recorded as `REQUIRES OWNER VERIFICATION`.

## Step 2 — What actually merged

**Status:** COMPLETED

### Tagged repository contract

At the tagged commit:

- canonical migration count: **63**;
- highest migration: `20260729154931_prediction_consensus_minimum_cohort.sql`;
- `contractVersion`: **63**;
- `requiredMigrationCount`: **63**.

### Pull requests merged after PR #195's assessment head

The boundary assessment head is `798733ce69e0f2212b5954d2051bfb168c294976`. Using `merged_at`, not `state`, the pull requests merged after that assessment and before the tag are:

| PR | `merged_at` | Relationship to tagged baseline |
| ---: | --- | --- |
| #196 — Resolve PRIV-001 and migration timestamp controls | 29 July 2026 16:14:46 UTC | GitHub auto-classified the stacked PR as merged when its head became contained in its base branch. Its implementation was incorporated into PR #193. |
| #193 — Complete contract 63 post-lock and final standings baseline | 29 July 2026 19:25:32 UTC | Merged to `main`; contains migrations 61–63 and the product implementation. |
| #197 — Record final contract 63 tag readiness | 29 July 2026 19:44:21 UTC | Documentation/config-notes reconciliation merged to `main`; its merge commit is the tagged commit. |

PR #193 is therefore among the merged pull requests and is the merge that moved contracts 61–63 onto `main`.

PRs #194 and #195 have `merged_at = null` and are not part of the tagged baseline.

### Migrations introduced by the merged delivery

#### Contract 61 — `20260729122100_prediction_consensus.sql`

Plain-English effect:

- adds an authenticated, post-lock aggregate read for submitted Original Predictor entries;
- reads `entries`, `match_predictions`, `predicted_progression`, `bonus_predictions`, players, teams and matches;
- returns bounded tournament-wide champion, final, Golden Boot, match-outcome, trusted-team, group-goals and caller-uniqueness summaries;
- does not join a private league or check league membership;
- does not create, submit, update or delete entries;
- does not write predictions;
- does not award or recompute points;
- does not change competition scoping in stored data;
- does not alter locking rules, but refuses access before the tournament lock.

#### Contract 62 — `20260729122200_final_standings_tiebreaks.sql`

Plain-English effect:

- adds a private standings-metrics helper;
- recreates overall and private-league standings reads;
- reads submitted entries, predictions, matches and score events;
- leaves live ranking on points/shared-rank semantics;
- after every tournament result is confirmed or corrected, orders equal-point entries by exact scores, correct outcomes, correct knockout teams, champion correctness and closest group-goals total;
- does not change point values or score-event generation;
- does not write entries or predictions;
- retains private-league membership checks in the private standings RPC;
- does not alter tournament or entry locking.

#### Contract 63 — `20260729154931_prediction_consensus_minimum_cohort.sql`

Plain-English effect:

- moves the contract-61 aggregate implementation into `predictor_internal`;
- revokes browser-role execution of the unsuppressed helper;
- recreates the public RPC as a tournament-wide cohort gate;
- counts submitted Original Predictor entries for the tournament;
- suppresses aggregate output while fewer than ten submitted entries exist;
- counts the caller's submitted entry toward ten;
- returns a successful `not_enough_entries` state below the threshold;
- does not write entries, predictions or scores;
- does not alter point awards, competition storage boundaries or locking rules.

## Step 3 — `PRIV-001`

**Status:** COMPLETED — RESOLVED FOR MINIMUM COHORT; RESIDUAL SCOPE RISK REMAINS

### Source-backed answers

1. **Aggregate present:** yes. `public.get_prediction_consensus(uuid)` exists in the tagged source.
2. **Minimum cohort:** yes. Contract 63 defines `v_minimum_entries constant integer := 10`.
3. **Scope:** tournament-wide. The function accepts only `p_tournament_id`, counts every submitted `public.entries` row for that tournament and contains no league identifier, league join or caller-membership check.
4. **Smallest cohort producing aggregate output:** **10 submitted entries**. Cohorts from zero through nine receive only the explicit suppression object. The caller counts toward ten.

### Plain finding

Migration 61 by itself had the defect described by the original `PRIV-001`: one submitted entry could produce tournament-wide aggregate output. That unguarded public boundary is **not** the final tagged behaviour. Migration 63, included in the same tagged baseline, replaces the public boundary with a ten-entry threshold and makes the unsuppressed implementation inaccessible to browser roles.

`PRIV-001` is therefore **resolved in tagged source** as a minimum-cohort finding.

However, the aggregate remains tournament-wide rather than private-league scoped. A threshold of ten materially reduces small-cell subtraction risk, but it does not create a rule authorising disclosure of tournament-wide stranger aggregates. The residual scope concern remains a **Medium privacy/assurance risk** under `SEC-001` and should be reviewed against explicit product privacy rules before predictions open.

Hosted deployment of this source is `REQUIRES OWNER VERIFICATION` in this task.

## Step 4 — Record reconciliation

**Status:** COMPLETED

This branch updates:

- the original readiness investigation with a correction section rather than silently editing away the contract-60 assessment;
- `docs/quality/current-status.md` to the tagged repository contract and tag state, while marking hosted claims `REQUIRES OWNER VERIFICATION`;
- `docs/ops-pending-migrations.md` to the 63-file tagged chain with hosted state unverified here;
- `config/deployment-contract.json` notes only; `contractVersion` and `requiredMigrationCount` remain 63;
- `docs/quality/risk-register.md` with the resolved cohort finding and residual tournament-wide scope risk;
- `docs/quality/deferred-decisions.md` so `DEC-003` and `DEC-004` describe tagged source rather than an unmerged candidate.

### Recorded contradiction

The PR #195 readiness assessment legitimately described contract 60 at its assessment point and deliberately excluded PR #193. The tag was created later, after PR #193 and PR #197 merged. The tagged baseline is therefore contract 63, not the contract-60 point assessed by PR #195.

The original assessment was temporally correct; later records that treated it as the actual tagged baseline were not. The correction is recorded alongside the assessment rather than rewriting the earlier conclusion as though it had never existed.

## Step 5 — Tag correction assessment

**Status:** COMPLETED — NO TAG MUTATION RECOMMENDED

The tag target, contract, migration count and highest migration match the tagged commit, and the annotation contains no placeholders. No delete/recreate commands are required.

The annotation could be more precise by distinguishing product-release checks from exact-tag documentation checks, but that does not justify moving an immutable baseline tag whose target and substantive repository facts are correct.

No tag was created, moved, deleted or re-pushed by this reconciliation.

## Acceptance evidence

**Status:** COMPLETED

- branch created from the exact tag commit;
- draft PR opened before investigation work;
- tag and `main` verified identical, zero ahead and zero behind;
- annotation recorded verbatim;
- placeholder list completed;
- merged PRs identified using `merged_at`;
- migrations 61–63 explained and classified;
- `PRIV-001` answered with threshold, scope and smallest cohort;
- no changes under `src/`, `supabase/`, `scripts/` or `tests/`;
- `contractVersion` unchanged;
- no tag mutation;
- no pull request merge, close or approval;
- first complete reconciliation head CI `30488647322`: passed, including Markdown link integrity;
- first complete reconciliation head Database parity `30488647382`: passed clean rebuild, lint, pgTAP and TypeScript/PostgreSQL parity;
- final evidence-only head CI: pending exact-head confirmation before ready-for-review transition.
