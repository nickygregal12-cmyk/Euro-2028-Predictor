# Euro 2028 baseline readiness

**Date:** 29 July 2026  
**Baseline commit:** `ff633396e04eca77ed4456c5537ab361d9d259ee`  
**Merged delivery:** PR #193  
**Contract:** 63  
**Canonical migration count:** 63  
**Highest migration:** `20260729154931_prediction_consensus_minimum_cohort.sql`

## Final disposition

PR #193 merged on 29 July 2026 at `ff633396e04eca77ed4456c5537ab361d9d259ee`. Repository, development Supabase, production Supabase, every Netlify contract declaration and the published production application are aligned at contract 63.

The exact production release is Netlify deploy `6a6a53af58a0a500096b7cb1`, ready, production context, from the exact merge commit. No baseline tag has been created.

## What contracts 61–63 changed

- **Contract 61** added one bounded, authenticated, post-lock Original Predictor consensus read. Only submitted entries contribute; Bonus Games remain separate.
- **Contract 62** added database-owned final standings metrics and automatically activates the approved five-step order only after every tournament result is confirmed or corrected. Live standings remain points-only.
- **Contract 63** enforces a minimum cohort of ten submitted Original Predictor entries before tournament-wide consensus is returned. The caller counts. Below ten, the RPC returns an explicit successful `not_enough_entries` state. Browser roles cannot execute the unsuppressed helper.

## Deferred-decision findings

- `DEC-003` is resolved by contract 62: final tie-break ordering activates automatically at complete tournament result confirmation; no separate administrative calculation is required.
- `DEC-004` is resolved by the owner-approved contract-63 policy: minimum ten submitted entries, caller included, database constant, explicit successful suppression response.

## Reliability findings

- `REL-008` remains historical evidence for inconsistent documentation-branch Netlify previews on PRs #194/#195. It did not reproduce on the final contract-63 delivery: exact PR #193 preview publication, HTTP smoke and Chromium smoke passed in Browser E2E `30473546011`.
- `MIG-001` is resolved. Pull-request CI fetches `origin/main`, rejects any added migration timestamp less than or equal to main's highest timestamp, checks multiple additions for strict order and passes when no migration is added.
- The canonical 63-file migration chain has no duplicate timestamps.

## Hosted verification

### Development Supabase

Verified at exactly 63 migrations through `20260729154931`. Public consensus execution is authenticated/service-only; anonymous execution is denied; browser execution of the private consensus and standings helpers is denied.

### Production Supabase

Promoted from exactly 60 to exactly 63 after explicit owner approval. Preflight required the exact contract-60 baseline. Postflight verified:

- exactly 63 migrations through `20260729154931`;
- canonical rows `20260729122100`, `20260729122200` and `20260729154931`;
- authenticated public consensus execution allowed;
- anonymous public consensus execution denied;
- authenticated execution of private consensus and standings helpers denied;
- rollback-only suppression call returned the approved `not_enough_entries` object;
- no persisted test data.

### Production preservation

The 60→63 promotion retained:

- one Auth user;
- one profile;
- one entry;
- one league and one league member;
- 51 matches;
- 36 Original match predictions;
- three Bonus Games;
- zero Bonus Games entrants;
- zero Last Man Standing selections;
- zero KO Predictor selections.

### Netlify and production application

- `dev`, `branch-deploy`, `deploy-preview` and `production` declare contract 63;
- non-production contexts use development Supabase;
- production uses production Supabase;
- exact production deploy `6a6a53af58a0a500096b7cb1` is ready from `ff633396e04eca77ed4456c5537ab361d9d259ee`;
- Netlify plugin state passed and the deploy secret scan found no matches;
- production Lighthouse: Performance 96, Accessibility 100, Best Practices 100, SEO 100;
- exact pre-merge production-equivalent preview HTTP and Chromium smoke passed.

## Exact validation evidence

- CI `30473545872`: **VERIFIED** — build, lint, migration timestamp guard, 149 isolated Vitest files and production dependency audit passed;
- Database parity `30473545780`: **VERIFIED** — clean 63-migration rebuild, database lint, all pgTAP and TypeScript/PostgreSQL parity passed;
- Browser E2E `30473546011`: **VERIFIED** — authenticated desktop/mobile journeys, ten-entry Trends, signup/recovery, exact preview HTTP smoke and Chromium smoke passed;
- Netlify deploy `6a6a53af58a0a500096b7cb1`: **VERIFIED READY** from exact merged `main` commit.

## Readiness checklist

| Item | Status |
| --- | --- |
| Repository migration count matches `contractVersion` | **VERIFIED** — 63/63 |
| PR #193 merged or deliberately excluded | **VERIFIED** — merged 29 July 2026 |
| Authority documents carry dated, attributed hosted claims | **VERIFIED** |
| Deferred-decisions register reflects what shipped | **VERIFIED** |
| Risk register reflects current `main` | **VERIFIED** |
| No duplicate migration timestamps | **VERIFIED** |
| Development Supabase at expected contract | **VERIFIED** — 63 |
| Production Supabase at expected contract | **VERIFIED** — 63 |
| Published production release identified and contract split recorded deliberately | **VERIFIED** — deploy `6a6a53af58a0a500096b7cb1`, no split remains |
| Branch cleanup complete — PR #194 merged and deletions run | **REQUIRES OWNER VERIFICATION** — separate repository-hygiene item; not a product/database/tag integrity blocker |
| Deploy-preview reliability confirmed or recorded as a finding | **VERIFIED** — final exact preview passed; historical inconsistency remains recorded |
| Exact production application release ready | **VERIFIED** |
| Baseline tag currently absent | **VERIFIED** |

## Prepared annotated tag command

The command below is prepared for the final evidence commit that merges this reconciliation. Replace `<FINAL_MAIN_SHA>` with that exact merge commit after this documentation-only PR is merged. Do not tag `ff633396...` if `main` has advanced to include this final evidence commit.

```bash
git tag -a euro-2028-baseline <FINAL_MAIN_SHA> -m "Euro 2028 product baseline. Repository, development Supabase, production Supabase and all Netlify contexts verified at contract 63 with 63 canonical migrations, highest 20260729154931_prediction_consensus_minimum_cohort.sql. Product release deploy 6a6a53af58a0a500096b7cb1 published from ff633396e04eca77ed4456c5537ab361d9d259ee. Test evidence: CI 30473545872 with 149 Vitest files, Database parity 30473545780, Browser E2E and exact preview smoke 30473546011. Superseded by the multi-competition hub direction (ADR 0011)."
git push origin euro-2028-baseline
```

No tag was created, moved or deleted. The command remains unexecuted.
