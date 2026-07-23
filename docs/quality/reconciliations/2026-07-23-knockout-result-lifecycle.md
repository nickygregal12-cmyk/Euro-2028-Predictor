# Knockout result lifecycle reconciliation

**Workstream:** `DATA-002`  
**Pull request:** #11  
**Evidence boundary:** repository code plus disposable local Supabase only

This note records the current repository implementation for authoritative match
results. It does not rewrite the dated 23 July 2026 audits and does not claim
that either hosted Supabase project has applied the migrations.

## What changed

The database no longer treats a bare `home_score` / `away_score` pair as enough
to establish a knockout result.

- Results have an explicit state: scheduled, confirmed or corrected.
- The method is regulation, extra time or penalties.
- Scores at 90 minutes, 120 minutes and in a shootout are stored separately.
- The public football score excludes shootout kicks.
- `winner_team_id` is derived by the protected lifecycle and is authoritative.
- Group draws remain valid with no winner.
- A knockout result cannot remain tied without a valid shootout.
- Corrections and clears require a reason.
- Every confirm, correct and clear appends an immutable revision snapshot.
- Direct result-column writes are rejected.
- Confirmed participants cannot be changed until the result is cleared.
- Result write and scoring recomputation share one transaction and one
  tournament advisory lock.
- Champion scoring uses `winner_team_id`, including penalty-decided finals.
- Final rank history is captured after the authoritative winner is scored.

## Server boundary

The public-schema lifecycle functions exist only as a server adapter surface:

- `confirm_match_result(...)`
- `correct_match_result(...)`
- `clear_match_result(...)`

`PUBLIC`, `anon` and `authenticated` cannot execute them. `service_role` may call
the functions but has no direct access to the revision table. The function owner
writes revision rows transactionally.

There is no browser admin result-entry page in this batch.

## Executable evidence

The disposable database suite covers:

- direct-write bypass attempts;
- function and revision-table permissions;
- group draws;
- valid regulation, extra-time and penalty results;
- invalid tied knockout regulation results;
- invalid 90/120/shootout shapes;
- cross-tournament participants;
- mandatory method and non-negative scores;
- confirmation, correction, clear and re-confirm versioning;
- correction/clear reasons;
- participant immutability under a confirmed result;
- immutable ordered revision history;
- penalty winner and finalist scoring;
- corrected winner scoring;
- clearing champion status;
- final rank-history capture; and
- continued TypeScript/PostgreSQL group-order parity.

The workflow also rebuilds every committed migration, lints PostgreSQL and
removes the disposable stack after the run.

## Finding reconciliation

| Finding | Repository/local result | Remaining boundary |
| --- | --- | --- |
| `DATA-002` — tied knockout matches have no authoritative winner | Implemented locally through explicit method, score checkpoints and `winner_team_id` | Hosted rollout, admin UI and real operational rehearsal remain unverified |
| `REL-001` — score recomputation is not serialised | Materially addressed for the current recompute path with a tournament advisory transaction lock | Broader result-feed/admin concurrency and hosted verification remain open |
| `TEST-001` — database integrity rules are not executed | Narrowed with authoritative result and scoring pgTAP coverage | Browser E2E and hosted behaviour remain open |

A targeted post-merge finding review may update statuses while preserving the
hosted-evidence boundary.

## Legacy-data rule

The migration fails if any existing match already has a score. This is
intentional. A historical `2–1` cannot prove whether the result was reached in
regulation or extra time, and a tied score cannot identify a shootout winner.
Any hosted result must be classified and remediated explicitly before rollout.

## Deliberately not included

This batch does not implement:

- automatic propagation of winners to later fixtures;
- full bracket-tree replay (`FUNC-001`);
- a browser admin result-entry page;
- automatic deadline submission;
- wider reference-data constraints;
- hosted migration application or data inspection; or
- any scoring-value change.
