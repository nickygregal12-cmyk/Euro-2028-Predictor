# Euro 2028 baseline readiness

**Date:** 29 July 2026  
**Repository baseline reviewed:** `main` at `7555db4625f8e1c4d9a0cb72185c40391cf90f3f`  
**Pull request #193 disposition:** OPEN, DRAFT, NOT MERGED  
**Outcome:** Phase A stop condition reached. Phases B–D were not started.  
**Tag status:** No tag created. The prepared command remains unexecuted.

## Phase A — repository and PR #193 findings

### A1. Current repository position

| Check | Finding | Evidence |
| --- | --- | --- |
| Current `main` commit | `7555db4625f8e1c4d9a0cb72185c40391cf90f3f` | The draft reconciliation PR was created from this exact `main` SHA; PR #193 also has this exact base and merge base. |
| Migration count | 60 canonical migration files | Current `config/deployment-contract.json` declares both `contractVersion` and `requiredMigrationCount` as 60. PR #193 adds exactly two migration files and changes those values from 60 to 62. The existing migration inventory also records 60 files. |
| Highest migration on `main` | `20260729110000_predictor_cup_lint_safe_qualification.sql` | The file exists on `main` and identifies itself as contract 60. |
| `contractVersion` | 60 | `config/deployment-contract.json` on `main`. |
| `requiredMigrationCount` | 60 | `config/deployment-contract.json` on `main`. |
| Migrations 61 and 62 on `main` | No | Both files are additions in PR #193 and are absent from the current `main` baseline. |

The repository-side count and declared contract agree at 60. Hosted environment alignment is not established by this review.

### A2. Pull request #193 disposition

PR #193, **Build post-lock trends and final standings**, is open and draft. `merged_at` is `null`; it is therefore **not merged**. Its non-null `merge_commit_sha` is GitHub's synthetic test-merge ref and is not evidence of a merge.

The branch is 15 commits ahead and zero commits behind `main`. Its merge base is the current `main` commit above. GitHub reports it as mergeable, so the non-mutating comparison indicates it applies cleanly at the time of review.

### A3. Migration timestamp safety

PR #193 adds:

- `20260729122100_prediction_consensus.sql`
- `20260729122200_final_standings_tiebreaks.sql`

Both timestamps are strictly greater than the current highest timestamp `20260729110000`. They do not collide with each other. This avoids the timestamp-collision defect found on seven older branches.

### A4. Contract 61 — post-lock prediction consensus

Contract 61 adds one authenticated, bounded, read-only RPC: `public.get_prediction_consensus(uuid)`.

In plain English, it:

- refuses anonymous callers;
- refuses access before the tournament lock;
- includes only submitted Original Predictor entries;
- returns bounded aggregate trends such as champion picks, predicted finals, Golden Boot picks, agreed/divided matches, trusted teams and group-goals distribution;
- returns at most six caller-only uniqueness cards;
- leaves Bonus Games outside the query;
- uses an empty function search path;
- revokes execution from all roles before granting only `authenticated` and `service_role`.

Impact review:

| Area | Effect |
| --- | --- |
| Entries | Read only. Filters to submitted entries; does not insert, update, delete or submit entries. |
| Predictions | Read only. Aggregates existing group, progression and award predictions. |
| Scoring | No scoring values, score events or recomputation logic changed. |
| Competition scoping | Explicitly scoped to one tournament's Original Predictor entries and matches. Bonus Games remain separate. |
| Locking | Does not alter lock rules. It adds a post-lock read gate using the existing tournament `lock_at`. |
| Stored decisions | No stored tie, bracket, result or competition decision changed. |
| Privileges | Adds one deliberately authenticated RPC; anonymous remains denied. |

### A5. Contract 62 — final standings tie-break activation

Contract 62 adds a private metrics helper and recreates the existing overall and private-league standings RPCs without changing their signatures.

In plain English, it:

- keeps live-tournament ranks based on shared total points;
- activates final tie-breaks only after every tournament fixture is confirmed or corrected;
- then orders equal-point entries by: exact scores, correct outcomes, correct knockout teams, correct champion, and closest predicted group-stage goals total;
- applies the same ordering to overall and private-league standings;
- includes a `finalStandings` response flag and invalidates pagination cursors when the live/final mode changes;
- keeps the new metrics helper unavailable to browser roles.

Impact review:

| Area | Effect |
| --- | --- |
| Entries | Read only. Uses submitted Original Predictor entries. |
| Predictions | Read only. Uses saved group and progression outcomes to calculate tie-break metrics. |
| Scoring | Point awards and `score_events` are unchanged. Final ranking semantics change only for equal-point entries after tournament completion. |
| Competition scoping | Overall reads use the supplied tournament; private reads derive the league's tournament. Bonus standings are not touched. |
| Locking | No entry or match lock changed. Activation depends on authoritative result completion, not on a new lock. |
| Stored decisions | No stored bracket, tie-resolution, result or score decision is rewritten. |
| Privileges | Existing public RPC signatures are preserved. The new internal helper has all browser/service execution revoked. Existing function privilege coverage was updated. |

The helper identifies a correct champion through the current cumulative knockout score event of 110 points. This matches the current stacking rules (10 + 15 + 20 + 25 + 40), but it is a deliberate coupling to the current scoring contract and should remain covered whenever scoring changes.

### A6. Validation and current blocker

At exact PR #193 head `544bbfe5889e7b762897d043d3e0d4ccaf8f3093`:

| Gate | Result |
| --- | --- |
| CI | PASS |
| Database parity | PASS |
| Netlify deploy-preview status | PASS — repository status only; hosted configuration was not independently inspected |
| Browser E2E deploy-preview smoke | PASS |
| Browser E2E authenticated journey | **FAIL** |

The failing journey is the new Prediction Trends test on both desktop and mobile. The page renders the numeric entry count in a sibling `<strong>` element and the words `locked entries in this view` in a `<span>`. The test locates only the text-bearing span, parses its `textContent`, finds no digit and therefore reads zero. It expects at least three and fails on both viewports. Because the authenticated job fails at that point, signup and password-recovery journeys are skipped in that run.

This appears to be a test-selector defect rather than evidence that the RPC returned zero entries, but the required Browser E2E gate is still red. The test must target the whole summary element or otherwise assert the returned count, then the complete browser workflow must pass.

### A7. Hosted checks that remain owner-only

No hosted database or Netlify state was verified in this review.

Before any merge, the owner should verify development Supabase with:

```sql
select count(*) as migration_count, max(version) as highest_version
from supabase_migrations.schema_migrations;

select version, name
from supabase_migrations.schema_migrations
where version in ('20260729122100', '20260729122200')
order by version;
```

Expected only after an intentional development promotion: 62 rows, highest `20260729122200`, with the two canonical migration names above.

The owner should also open the exact PR preview's `/release.json` and confirm:

- exact PR head `544bbfe5889e7b762897d043d3e0d4ccaf8f3093`;
- application/deployed database contract 62;
- deploy-preview context;
- development Supabase project `iouzoutneyjpugbbtdem`;
- no production Supabase identifier.

Production Supabase and production Netlify must be checked separately and deliberately; this review does not assert their contract or release state.

### A8. Independent merge recommendation

**PR #193 is not safe to merge yet.**

The migration timestamps are safe, the branch is current and cleanly applicable, the database work is bounded and preserves Original/Bonus separation, existing scoring, stored decisions and lock rules. CI and Database parity pass. However:

1. the required authenticated Browser E2E gate fails on both desktop and mobile;
2. the remainder of that browser workflow is skipped after the failure;
3. development Supabase and non-production Netlify alignment are owner-only facts and were not independently verified here.

The merge block is therefore validation and environment evidence, not a detected migration collision or destructive database change. Repair the selector assertion, rerun the full Browser E2E workflow to green, and complete the owner checks above before reconsidering merge.

## Phase B — authority-document reconciliation

**NOT YET COMPLETED.** Phase A requires the task to stop because PR #193 is not merged.

No authority document was changed. No hosted claim was rewritten.

## Final migration summary

**NOT YET COMPLETED AS A BASELINE SUMMARY.** Contracts 61–62 remain unmerged and are not part of current `main`.

Their proposed behaviour is summarised in Phase A4–A5 solely for independent review.

## Phase C — deploy preview and migration timestamp controls

**NOT YET COMPLETED.** The task stopped at Phase A as required.

The only preview evidence reviewed is PR #193's own exact-head status and Browser E2E result. The requested five-merged-PR comparison and repository-wide timestamp-guard inspection were not performed.

## Phase D — final tag-readiness assessment

**NOT YET COMPLETED.** A baseline tag must not be prepared as ready while PR #193 is unresolved and the later phases remain unperformed.

## Readiness checklist

| Item | Status | Evidence / owner check |
| --- | --- | --- |
| Repository migration count matches `contractVersion` | VERIFIED | Current `main`: 60 migrations; `contractVersion` 60; `requiredMigrationCount` 60. |
| PR #193 merged, or deliberately excluded from the baseline | BLOCKED | PR #193 is open, draft and unmerged; no deliberate exclusion decision was recorded. |
| Authority documents carry dated, attributed hosted claims | NOT YET COMPLETED | Phase B not started because of the Phase A stop condition. |
| Risk register reflects current `main` | NOT YET COMPLETED | Phase B not started. |
| No duplicate migration timestamps | NOT YET COMPLETED | The two PR #193 timestamps are safe relative to `main`; the full canonical-chain/CI-guard Phase C check was not performed. |
| Development Supabase at expected contract | REQUIRES OWNER VERIFICATION | Run the migration-history SQL in Phase A7. |
| Production Supabase at expected contract | REQUIRES OWNER VERIFICATION | Run the same history count/highest query against production and record the verifier/date. |
| Published production release identified and any database-contract split recorded deliberately | REQUIRES OWNER VERIFICATION | Inspect production `/release.json`, deployment identity and production environment contract; record verifier/date and any deliberate split. |
| Branch cleanup complete — PR #194 merged and deletions run | REQUIRES OWNER VERIFICATION | PR #194 and branch deletions were not changed or verified by this task. |
| Deploy previews confirmed working, or failure recorded as a finding | NOT YET COMPLETED | Repository-wide five-PR comparison not performed. PR #193's preview smoke passes, but its authenticated Browser E2E fails. |

## Prepared annotated tag command — unexecuted

This command is deliberately not ready to run. Repository facts are filled from current `main`; owner-only and test-suite values remain placeholders.

```bash
git tag -a euro-2028-baseline -m "Euro 2028 product baseline. Repository verified at contract 60, 60 migrations, highest 20260729110000_predictor_cup_lint_safe_qualification.sql. Development Supabase: <OWNER TO CONFIRM>. Production Supabase: <OWNER TO CONFIRM>. Published production release: <OWNER TO CONFIRM>. Test suite: <X> passing across <Y> files. Superseded by the multi-competition hub direction (ADR 0011)."
git push origin euro-2028-baseline
```

No tag was created, moved or deleted. The command above is prepared only and has not been executed.
