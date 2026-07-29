# Euro 2028 baseline readiness

**Date:** 29 July 2026  
**Repository baseline:** contract 60 on `main` at `7555db4625f8e1c4d9a0cb72185c40391cf90f3f`  
**PR #193 disposition:** open, draft, not merged (`merged_at = null`); deliberately excluded from this baseline  
**Tag status:** no tag created; prepared command remains unexecuted

## Assessment verdict

This report assesses a legitimate **contract-60 repository baseline**. PR #193 contains a repository-green contract-62 candidate, but it is unmerged and therefore is not part of current `main` or this tag point.

The repository and authority-document work is internally reconciled. The baseline is **not ready to tag yet** because hosted Supabase/Netlify facts require owner verification and branch cleanup is incomplete.

## 1. Current repository position

| Check | Finding | Status |
| --- | --- | --- |
| Current `main` commit | `7555db4625f8e1c4d9a0cb72185c40391cf90f3f` | VERIFIED |
| Canonical migration count | 60 | VERIFIED |
| Highest migration | `20260729110000_predictor_cup_lint_safe_qualification.sql` | VERIFIED |
| `contractVersion` | 60 | VERIFIED |
| `requiredMigrationCount` | 60 | VERIFIED |
| Count/contract agreement | 60 files, contract 60, required count 60 | VERIFIED |
| Migrations 61–62 on `main` | absent; both are additions in PR #193 | VERIFIED |
| PR #193 merged | no; `merged_at = null` | VERIFIED |
| Hosted verification results recorded by owner on PR #193 | no. The only owner-authored project comment records commands and expected results, not executed results. | REQUIRES OWNER VERIFICATION |

PR #193 is mergeable, based on the same `main` commit and was 16 commits ahead/zero behind at review. Exact head `901a2bb92b74979283491e5c85d71b01657193a9` passed:

- CI `30456665007`;
- Database parity `30456665266`;
- Browser E2E `30456664993`, including exact preview smoke, authenticated desktop/mobile journeys, signup and password recovery.

Repository-side contract 61–62 work is therefore complete and green, but it is not shipped into the assessed baseline.

## 2. What migrations 61 and 62 change

### Contract 61 — `20260729122100_prediction_consensus.sql`

Adds one authenticated, security-definer, post-lock aggregate RPC over submitted Original Predictor entries.

It:

- rejects anonymous callers and pre-lock access;
- reads submitted entries, group predictions, progression and Golden Boot selections;
- returns bounded champion/final/award, agreement/division, trusted-team and goals-distribution summaries;
- returns at most six caller-specific uniqueness cards;
- remains separate from Bonus Games;
- does not insert, update, delete or submit entries;
- does not change predictions, scoring, competition boundaries or lock rules.

### Contract 62 — `20260729122200_final_standings_tiebreaks.sql`

Adds a private metrics helper and recreates the existing overall/private standings RPCs without changing their signatures.

It:

- leaves live standings on points/shared-rank semantics;
- automatically activates final ordering when every tournament match is `confirmed` or `corrected`;
- separates equal points by exact scores, correct outcomes, correct knockout teams, correct champion and closest predicted group-stage goals total;
- applies the same order to overall and private leagues;
- does not change point awards or score-event generation;
- does not write entries, predictions, bracket decisions, tie decisions or results;
- does not alter entry or match locking;
- keeps the internal helper unavailable to browser roles.

The candidate timestamps `20260729122100` and `20260729122200` are both strictly above contract 60's `20260729110000` and do not collide with each other.

## 3. Deferred-decision findings

### `DEC-003` — final tie-break activation

**Finding:** answered by migration 62.

The implementation activates the final tie-break order automatically after all tournament results are confirmed/corrected. No separate administrative calculation is required. Live rankings remain points/shared-rank based.

`docs/quality/deferred-decisions.md` records `DEC-003` as resolved for the tested contract-62 candidate, citing PR #193 and its exact green runs. Because PR #193 is unmerged, this is a fixed candidate decision rather than contract-60 baseline behaviour.

### `DEC-004` — aggregate minimum cohort and privacy

**Finding:** migration 61 enforces **no minimum cohort threshold**.

There is no count/suppression gate before returning the aggregate object. The smallest cohort that can produce a result is **one submitted entry**.

The task premise described this as potentially shipped behaviour. That would be inaccurate here: PR #193 is unmerged, so the behaviour is not shipped into `main`. The implementation choice is nevertheless settled by source and creates a prospective merge risk.

New finding `PRIV-001` records that in a one- or two-entry tournament cohort, aggregate output combined with the caller's own prediction can substantially disclose another person's selections. Before PR #193 merges, the owner must either approve and test a suppression threshold or explicitly accept/document the privacy behaviour.

## 4. Authority-document reconciliation

The following files now separate verified repository facts from hosted claims:

- `docs/quality/current-status.md`;
- `AGENTS.md`;
- `CLAUDE.md`;
- `docs/roadmap.md`;
- `docs/ops-pending-migrations.md`;
- `docs/quality/risk-register.md`;
- `docs/quality/deferred-decisions.md`;
- `config/deployment-contract.json` notes only.

Undated hosted assertions were converted to **REQUIRES OWNER VERIFICATION** with exact checks. Future contract-62 intent is separated from current contract-60 behaviour.

`config/deployment-contract.json` remains at `contractVersion: 60` and `requiredMigrationCount: 60`; only `notes` changed.

`docs/quality/feature-baseline.md` was not changed. Its stable `FEAT-*`, `SAFE-*` and `PLAN-*` identifiers remain untouched. `FEAT-050` correctly remains planned because PR #193 is unmerged.

## 5. Deploy-preview reliability

The last five merged pull requests were reviewed using their PR head status:

| PR | Head | Overall Netlify deploy-preview |
| ---: | --- | --- |
| #188 | `1707a867dbf953d7f83ed454eed809bd1b083ce4` | success |
| #189 | `ddb9b3abef74c8073ed186af4f5137105188f965` | success |
| #190 | `5a3242d5a24d1bc33caa6c12a3ec9772f335167f` | success |
| #191 | `9d43bc0256aa6ad918c8b27c362d65a871aaadf8` | success |
| #192 | `3409eb7443001e95dad33998d000cd011b31de1d` | success |

Docs-only PR #194 head `0aa233f30158381f669a0769424009c990697b1a` has overall `netlify/euro28predictor/deploy-preview` failure and reported failures for Redirect rules, Header rules and Pages changed.

This is not a repo-wide outage: the five preceding merged PRs succeeded. It is still an inconsistent control, because a documentation-only change failed checks that code/database PRs passed. New finding `REL-008` records the proportionate-checks reliability gap. No Netlify configuration was changed or retriggered.

## 6. Migration timestamp control

The canonical contract-60 chain contains 60 unique migration timestamps. PR #193's two candidate timestamps are also unique and above current `main`.

No current CI job prevents a pull request from adding a migration timestamp less than or equal to the highest timestamp on `main`:

- `.github/workflows/ci.yml` runs build, lint, Vitest and dependency audit;
- `.github/workflows/database-parity.yml` rebuilds the submitted migration chain, lints, runs pgTAP and parity;
- neither compares newly added migration filenames with the highest timestamp on the PR base.

A duplicate may fail during rebuild, but that is not the requested monotonic-base guard. The seven dead colliding branches found by PR #194 demonstrate recurrence risk. New finding `MIG-001` records the gap; no guard was built in this documentation task.

## 7. Owner verification checks

No hosted result is marked verified in this report.

### Development Supabase

Run against project `iouzoutneyjpugbbtdem` and record verifier/date:

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

### Netlify non-production

```bash
curl -fsS https://deploy-preview-193--euro28predictor.netlify.app/release.json
```

Record exact commit, context, application/database contract and Supabase project. Inspect `dev`, `branch-deploy` and `deploy-preview` environment values separately.

### Production Supabase and published release

Run the migration count/highest-version query against production, then inspect:

```bash
curl -fsS https://euro28predictor.com/release.json
```

Record verifier/date, database contract, application contract, exact release commit/deploy identity, Supabase project and whether any split is deliberate.

### Branch cleanup

PR #194 remains open and unmerged. The owner must merge or otherwise accept the inventory, execute the approved deletions and record completion. No branch was deleted by this task.

## 8. Readiness checklist

| Item | Status | Evidence / remaining check |
| --- | --- | --- |
| Repository migration count matches `contractVersion` | VERIFIED | 60 files; contract 60; required count 60; highest `20260729110000_predictor_cup_lint_safe_qualification.sql`. |
| PR #193 merged, or deliberately excluded and baseline recorded as contract 60 | VERIFIED | PR #193 is unmerged and deliberately excluded from this report/tag point. |
| Authority documents carry dated, attributed hosted claims | VERIFIED | Named authority files now use repository facts or `REQUIRES OWNER VERIFICATION` with exact checks. |
| Deferred-decisions register reflects what shipped/candidate code decided | VERIFIED | `DEC-003` and `DEC-004` updated with migration/PR evidence and contract-60 boundary. |
| Risk register reflects current `main` | VERIFIED | Open findings rechecked; `PRIV-001`, `REL-008` and `MIG-001` recorded. |
| No duplicate migration timestamps | VERIFIED | Canonical 60-file chain and PR #193 candidate names are unique. |
| Development Supabase at expected contract | REQUIRES OWNER VERIFICATION | Run SQL in section 7 and record verifier/date. |
| Production Supabase at expected contract | REQUIRES OWNER VERIFICATION | Run production history query and record verifier/date. |
| Published production release and deliberate database split identified | REQUIRES OWNER VERIFICATION | Inspect production `/release.json` and environment identity. |
| Branch cleanup complete — PR #194 merged and deletions run | BLOCKED | PR #194 is open/unmerged; deletions are not recorded complete. |
| Deploy-preview reliability confirmed or recorded as a finding | VERIFIED | Inconsistency recorded as `REL-008`; no configuration change made. |

## 9. Prepared annotated tag command — unexecuted

The command is not ready to run. Repository facts and test totals are filled; owner-only values remain placeholders. Ordinary CI passed 850 tests across 144 files. The 15 tests in the skipped PostgreSQL parity file were exercised by successful Database parity run `30460530182`.

```bash
git tag -a euro-2028-baseline -m "Euro 2028 product baseline. Repository verified at contract 60, 60 migrations, highest 20260729110000_predictor_cup_lint_safe_qualification.sql. Development Supabase: <OWNER TO CONFIRM>. Production Supabase: <OWNER TO CONFIRM>. Published production release: <OWNER TO CONFIRM>. Test suite: 850 passing across 144 files. Superseded by the multi-competition hub direction (ADR 0011)."
git push origin euro-2028-baseline
```

No tag was created, moved or deleted. The command above is prepared only and has not been executed.