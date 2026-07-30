# Euro 2028 baseline readiness

**Date:** 29 July 2026  
**Baseline commit:** `ff633396e04eca77ed4456c5537ab361d9d259ee`  
**Merged delivery:** PR #193  
**Contract:** 63  
**Canonical migration count:** 63  
**Highest migration:** `20260729154931_prediction_consensus_minimum_cohort.sql`

## Final disposition

PR #193 merged on 29 July 2026 at `ff633396e04eca77ed4456c5537ab361d9d259ee`. Repository source is contract 63. Hosted Supabase and Netlify claims in this historical readiness record are `REQUIRES OWNER VERIFICATION` for the tag-reconciliation task because that task has no hosted access.

The tagged commit is `1fb8ffd36ad113079181829a8bcc47175c43b6da`, created by the later documentation-only PR #197. The tag and `main` were identical, zero ahead and zero behind, when reconciliation began.

## What contracts 61–63 changed

- **Contract 61** added one bounded, authenticated, post-lock Original Predictor consensus read. Only submitted entries contribute; Bonus Games remain separate. The read is tournament-wide rather than private-league scoped.
- **Contract 62** added database-owned final standings metrics and automatically activates the approved five-step order only after every tournament result is confirmed or corrected. Live standings remain points-only.
- **Contract 63** enforces a minimum cohort of ten submitted Original Predictor entries before tournament-wide consensus is returned. The caller counts. Below ten, the RPC returns an explicit successful `not_enough_entries` state. Browser roles cannot execute the unsuppressed helper.

## Deferred-decision findings

- `DEC-003` is resolved in tagged source by contract 62: final tie-break ordering activates automatically at complete tournament result confirmation; no separate administrative calculation is required.
- `DEC-004` is resolved in tagged source by contract 63: minimum ten submitted entries, caller included, database constant and explicit successful suppression response.

## Reliability findings

- `REL-008` remains historical evidence for inconsistent documentation-branch Netlify previews on PRs #194/#195. Earlier repository records state that exact PR #193 preview publication and smoke passed, but that hosted claim is `REQUIRES OWNER VERIFICATION` in this reconciliation.
- `MIG-001` is resolved in repository source. Pull-request CI fetches `origin/main`, rejects added migration timestamps less than or equal to main's highest timestamp, checks multiple additions for strict order and passes when no migration is added.
- The recorded canonical migration chain has 63 unique timestamps.

## Repository verification

- tag: `euro-2028-baseline`;
- tag target: `1fb8ffd36ad113079181829a8bcc47175c43b6da`;
- `main` at reconciliation start: same commit;
- comparison: identical, zero ahead, zero behind;
- `contractVersion`: 63;
- `requiredMigrationCount`: 63;
- highest migration: `20260729154931_prediction_consensus_minimum_cohort.sql`.

## Hosted verification

The tag annotation states that development Supabase, production Supabase and all Netlify contexts were verified at contract 63 and names two deploy IDs. This reconciliation has no database or Netlify access and does not independently adopt those statements as current facts.

| Hosted claim | Reconciliation status |
| --- | --- |
| Development Supabase at 63 | `REQUIRES OWNER VERIFICATION` |
| Production Supabase at 63 | `REQUIRES OWNER VERIFICATION` |
| Netlify contexts at 63 | `REQUIRES OWNER VERIFICATION` |
| Product deploy `6a6a53af58a0a500096b7cb1` | `REQUIRES OWNER VERIFICATION` |
| Final evidence deploy `6a6a5816a972230008318710` | `REQUIRES OWNER VERIFICATION` |
| Production preservation counts | `REQUIRES OWNER VERIFICATION` |

## Exact repository test evidence

The tag annotation cites:

- CI `30473545872` with 149 Vitest files;
- Database parity `30473545780`;
- Browser E2E and exact preview smoke `30473546011`.

Those are product-release checks from the PR #193 lineage. The exact tagged documentation commit came from PR #197, whose repository checks were CI `30485286469` and Database parity `30485286465`. The annotation is therefore precise about the product-release evidence but does not label it as ancestor rather than exact-tag validation.

## Readiness checklist

| Item | Status |
| --- | --- |
| Tagged repository migration count matches `contractVersion` | **VERIFIED** — 63/63 |
| Tag points to current baseline commit | **VERIFIED** — `1fb8ffd36ad113079181829a8bcc47175c43b6da` |
| PR #193 merged | **VERIFIED** — `merged_at` 29 July 2026 19:25:32 UTC |
| PR #197 merged | **VERIFIED** — `merged_at` 29 July 2026 19:44:21 UTC |
| No duplicate migration timestamps | **VERIFIED by recorded chain and existing guard** |
| Development Supabase at expected contract | `REQUIRES OWNER VERIFICATION` |
| Production Supabase at expected contract | `REQUIRES OWNER VERIFICATION` |
| Published production release identified | Annotation names it; `REQUIRES OWNER VERIFICATION` |
| Tag annotation placeholders | **VERIFIED — none** |
| `PRIV-001` minimum cohort | **RESOLVED IN TAGGED SOURCE** — threshold ten |
| Aggregate scope | **TOURNAMENT-WIDE** — residual scope concern retained under `SEC-001` |

## Tag annotation

The annotation is reproduced verbatim in [`2026-07-29-tag-reconciliation.md`](2026-07-29-tag-reconciliation.md).

No tag correction is recommended because the target, contract, migration count and highest migration match. No tag was created, moved, deleted or re-pushed by the reconciliation.

---

## Correction alongside the original contract-60 assessment

The original assessment exists at PR #195 head `798733ce69e0f2212b5954d2051bfb168c294976`. It assessed `main` at `7555db4625f8e1c4d9a0cb72185c40391cf90f3f`, contract 60, while PR #193 was open, draft and deliberately excluded. At that time the assessment correctly found:

- 60 canonical migrations;
- `contractVersion` and `requiredMigrationCount` both 60;
- migrations 61–62 absent from `main`;
- migration 61 had no minimum cohort threshold and could produce output from one submitted entry;
- `PRIV-001` was a prospective merge risk rather than shipped behaviour;
- the prepared contract-60 tag command still contained `<OWNER TO CONFIRM>` placeholders and had not been executed.

That assessment was temporally correct and is not rewritten away. What changed afterward is:

1. PR #196 was recorded with `merged_at` 29 July 2026 16:14:46 UTC after its stacked head became contained in PR #193's branch.
2. PR #193 merged to `main` at 19:25:32 UTC and delivered migrations 61–63, including the ten-entry repair.
3. PR #197 merged at 19:44:21 UTC and produced the final tagged commit.
4. The owner created `euro-2028-baseline` at the PR #197 merge commit.

Therefore the tagged baseline is contract 63, not the contract-60 baseline assessed by PR #195. The difference is a later change in repository history, not evidence that the original assessment should be silently edited to pretend it assessed contract 63.
