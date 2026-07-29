# Euro 2028 baseline readiness

**Date:** 29 July 2026  
**Repository baseline reviewed:** `main` at `7555db4625f8e1c4d9a0cb72185c40391cf90f3f`  
**Pull request #193 disposition:** OPEN, DRAFT, NOT MERGED  
**Outcome:** Phase A stop condition remains active. Phases B–D were not started.  
**Tag status:** No tag created. The prepared command remains unexecuted.

## Phase A — repository and PR #193 findings

### A1. Current repository position

| Check | Finding | Evidence |
| --- | --- | --- |
| Current `main` commit | `7555db4625f8e1c4d9a0cb72185c40391cf90f3f` | PR #195 was created from this exact SHA. PR #193 has the same base and merge base. |
| Migration count | 60 canonical migration files | Current `config/deployment-contract.json` declares `contractVersion` and `requiredMigrationCount` as 60. PR #193 adds exactly two migration files. |
| Highest migration on `main` | `20260729110000_predictor_cup_lint_safe_qualification.sql` | The file exists on `main` and identifies itself as contract 60. |
| `contractVersion` | 60 | `config/deployment-contract.json` on `main`. |
| `requiredMigrationCount` | 60 | `config/deployment-contract.json` on `main`. |
| Migrations 61 and 62 on `main` | No | Both files are additions in PR #193 and are absent from current `main`. |

The repository-side count and declared contract agree at 60. Hosted environment alignment is not established by this review.

### A2. Pull request #193 disposition

PR #193, **Build post-lock trends and final standings**, remains open and draft. `merged_at` is `null`; it is therefore **not merged**. A non-null synthetic merge ref is not evidence of a completed merge.

At the latest review, the branch is ahead of and not behind `main`. Its merge base is the current `main` commit above, and GitHub reports it as mergeable. The non-mutating comparison therefore indicates that it applies cleanly at the time of review.

### A3. Migration timestamp safety

PR #193 adds:

- `20260729122100_prediction_consensus.sql`
- `20260729122200_final_standings_tiebreaks.sql`

Both timestamps are strictly greater than the current highest timestamp `20260729110000`, and they do not collide with each other. This avoids the timestamp-collision defect found on older branches.

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
- then orders equal-point entries by exact scores, correct outcomes, correct knockout teams, correct champion, and closest predicted group-stage goals total;
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
| Privileges | Existing public RPC signatures are preserved. The new internal helper has browser/service execution revoked. Existing function privilege coverage was updated. |

The helper identifies a correct champion through the current cumulative knockout score event of 110 points. This matches the current stacking rules, but it is a deliberate coupling to the current scoring contract and must remain covered whenever scoring changes.

### A6. Browser assertion repair and exact-head validation

The original PR #193 Browser E2E failure was a test-selector defect. The page renders the numeric submitted-entry count in a sibling `<strong>` element and its label in a `<span>`. The test read only the label span and therefore parsed zero.

Commit `901a2bb92b74979283491e5c85d71b01657193a9` repairs the assertion by reading the complete parent summary element. No application code, migration or product behaviour changed in that repair.

At exact PR #193 head `901a2bb92b74979283491e5c85d71b01657193a9`:

| Gate | Result |
| --- | --- |
| CI run `30456665007` | PASS |
| Database parity run `30456665266` | PASS |
| Browser E2E run `30456664993` | PASS |
| Exact deploy-preview smoke within Browser E2E | PASS |
| Authenticated desktop/mobile journeys | PASS |
| Signup and password-recovery journeys | PASS |

Repository-side implementation and validation are therefore complete and green at that exact head.

### A7. Hosted checks that remain owner-only

No hosted database or Netlify configuration was independently verified in this review. The following checks are recorded as **REQUIRES OWNER VERIFICATION**.

#### Development Supabase

Run against project `iouzoutneyjpugbbtdem`:

```sql
select count(*)::integer as migration_count,
       max(version) as highest_version
from supabase_migrations.schema_migrations;

select version, name
from supabase_migrations.schema_migrations
where version in ('20260729122100', '20260729122200')
order by version;

select
  has_function_privilege('authenticated', 'public.get_prediction_consensus(uuid)', 'execute') as authenticated_consensus,
  has_function_privilege('anon', 'public.get_prediction_consensus(uuid)', 'execute') as anonymous_consensus,
  has_function_privilege('authenticated', 'predictor_internal.standing_metrics(uuid)', 'execute') as browser_internal_metrics;
```

Expected only after an intentional development promotion:

- 62 migration rows;
- highest version `20260729122200`;
- canonical rows `20260729122100_prediction_consensus` and `20260729122200_final_standings_tiebreaks`;
- privileges `true`, `false`, `false` respectively.

#### Netlify non-production contexts

Open or query the exact PR preview:

```bash
curl -fsS https://deploy-preview-193--euro28predictor.netlify.app/release.json
```

The owner must record that it identifies:

- exact PR head `901a2bb92b74979283491e5c85d71b01657193a9`;
- application/database contract 62;
- deploy-preview context;
- development Supabase project `iouzoutneyjpugbbtdem`;
- no production Supabase identifier.

The owner must also inspect Netlify environment settings for `dev`, `branch-deploy` and `deploy-preview`, recording that each expects contract 62 and points to development Supabase. The `production` context must be inspected separately and its actual contract/project recorded without changing it.

#### Production baseline

Run the migration count/highest-version query against production Supabase and inspect:

```bash
curl -fsS https://euro28predictor.com/release.json
```

Record the verifier, verification date, actual production database contract, published release commit/deploy identity and whether any application/database split is deliberate. This report does not assert those facts.

### A8. Independent merge recommendation

**Repository-side contract 61–62 work is complete and safe based on the reviewed diff and exact-head validation.**

The migrations use safe timestamps, apply cleanly to current `main`, preserve Original/Bonus competition separation, do not rewrite entries or predictions, do not change point awards, do not alter lock rules, and preserve stored decisions and existing public RPC signatures. CI, Database parity and the complete Browser E2E workflow pass on the exact repaired head.

**PR #193 should nevertheless remain unmerged until the owner records the hosted checks in A7.** The remaining block is hosted environment evidence, not a repository implementation or validation defect.

## Phase B — authority-document reconciliation

**NOT YET COMPLETED.** Phase A requires the task to stop because PR #193 is not merged and has not been deliberately excluded.

No authority document was changed. No hosted claim was rewritten.

## Final migration summary

**NOT YET COMPLETED AS A BASELINE SUMMARY.** Contracts 61–62 remain unmerged and are not part of current `main`.

Their proposed behaviour is summarised in Phase A4–A5 solely for independent review.

## Phase C — deploy preview and migration timestamp controls

**NOT YET COMPLETED.** The task remains stopped at Phase A.

PR #193's exact deploy-preview smoke now passes, but the requested five-merged-PR comparison and repository-wide timestamp-guard inspection were not performed.

## Phase D — final tag-readiness assessment

**NOT YET COMPLETED.** A baseline tag must not be prepared as ready while PR #193 is unresolved and the later phases remain unperformed.

## Readiness checklist

| Item | Status | Evidence / owner check |
| --- | --- | --- |
| Repository migration count matches `contractVersion` | VERIFIED | Current `main`: 60 migrations; `contractVersion` 60; `requiredMigrationCount` 60. |
| PR #193 merged, or deliberately excluded from the baseline | BLOCKED | PR #193 is open, draft and unmerged; repository gates are green, but owner environment checks remain outstanding. |
| Authority documents carry dated, attributed hosted claims | NOT YET COMPLETED | Phase B not started because of the Phase A stop condition. |
| Risk register reflects current `main` | NOT YET COMPLETED | Phase B not started. |
| No duplicate migration timestamps | NOT YET COMPLETED | PR #193's two timestamps are safe relative to `main`; the full canonical-chain/CI-guard Phase C check was not performed. |
| Development Supabase at expected contract | REQUIRES OWNER VERIFICATION | Run and record the SQL in A7. |
| Production Supabase at expected contract | REQUIRES OWNER VERIFICATION | Run the history query against production and record verifier/date. |
| Published production release identified and any database-contract split recorded deliberately | REQUIRES OWNER VERIFICATION | Inspect production `/release.json` and record deployment identity, contract and any deliberate split. |
| Branch cleanup complete — PR #194 merged and deletions run | REQUIRES OWNER VERIFICATION | PR #194 and branch deletions were not changed or verified by this task. |
| Deploy previews confirmed working, or failure recorded as a finding | NOT YET COMPLETED | PR #193's exact preview smoke passes; the required five-merged-PR comparison remains unperformed. |

## Prepared annotated tag command — unexecuted

This command is deliberately not ready to run. Repository facts are filled from current `main`; owner-only and test-suite values remain placeholders.

```bash
git tag -a euro-2028-baseline -m "Euro 2028 product baseline. Repository verified at contract 60, 60 migrations, highest 20260729110000_predictor_cup_lint_safe_qualification.sql. Development Supabase: <OWNER TO CONFIRM>. Production Supabase: <OWNER TO CONFIRM>. Published production release: <OWNER TO CONFIRM>. Test suite: <X> passing across <Y> files. Superseded by the multi-competition hub direction (ADR 0011)."
git push origin euro-2028-baseline
```

No tag was created, moved or deleted. The command above is prepared only and has not been executed.
