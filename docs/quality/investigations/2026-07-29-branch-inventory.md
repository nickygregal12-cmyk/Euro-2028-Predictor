# Branch inventory and disposition audit

**Date:** 29 July 2026  
**Scope:** every remote branch on `origin` other than `main` (155 branches)  
**Baseline:** `origin/main` at `7555db4`, contract 60, 60 canonical migrations  
**Type:** read-only audit  
**Confidence:** high for the 127 branches with ancestry or merged-PR evidence; explicitly reserved for the 3 `UNCLEAR` branches below.

No branch, tag or remote ref was created, deleted, renamed, merged, rebased or force-pushed while producing this report. See the closing note.

## Summary

**155 remote branches other than `main`:** 59 MERGED, 68 LANDED-SQUASHED, 7 DEAD-COLLIDING, 17 STALE, 1 ACTIVE, 3 UNCLEAR.

| Disposition | Count | Deletion posture |
| --- | --- | --- |
| `MERGED` | 59 | Safe to delete — commands listed below |
| `LANDED-SQUASHED` | 68 | Safe to delete — commands listed below |
| `DEAD-COLLIDING` | 7 | Not deletable on this evidence; work must be redone or dropped |
| `STALE` | 17 | Deletion recommended, but requires owner confirmation |
| `ACTIVE` | 1 | Keep |
| `UNCLEAR` | 3 | Keep pending review |
| **Total** | **155** | |

## Method

Every measurement below came from a non-mutating command run against `origin/main`:

- `git log -1` — last commit date, author and subject;
- `git rev-list --left-right --count origin/main...<branch>` — commits ahead and behind;
- `git branch -r --merged origin/main` — ancestry;
- `git cherry origin/main <branch>` — per-commit content equivalence;
- `git merge-tree --write-tree origin/main <branch>` — whether the branch still applies cleanly, and whether the merge result tree equals `main`'s tree (i.e. the merge would add nothing). No merge was performed;
- a three-way blob comparison across merge base, branch and `main` — separating work that genuinely never landed from files where `main` has simply moved further ahead;
- GitHub pull request number and state.

The clone was shallow on arrival and was unshallowed with `git fetch --unshallow` so that ancestry and merge bases were computable. That is a local-only operation and changed nothing on the remote.

### Evidence bar for a "safe to delete" call

A branch is recorded `MERGED` or `LANDED-SQUASHED` only on one of these grounds:

1. it is an ancestor of `origin/main` (59 branches); or
2. its own pull request is merged into `main` (67 branches); or
3. merging it into `main` is a provable no-op (1 branch).

### Two measurement traps that changed the result

**`git cherry` does not detect this repository's squash merges.** Squashing rewrites patch IDs, so `git cherry` marks a squash-merged branch's commits `+` even when the work is entirely present in `main`. Not one of the 68 `LANDED-SQUASHED` branches would have been detected by `git cherry` alone — 67 rest on a merged PR number and 1 on a provable no-op merge. Ancestry and `git cherry` counts are still reported per branch, but PR state is the decisive evidence here.

**GitHub reports a merged pull request with `state: closed`.** Reading `state` alone would have mislabelled all 129 merged PRs in this repository as unmerged, and with them 67 branches that are genuinely safe to delete. Merge status was taken from `merged_at` instead.

### Stated deviation: the 30-day recency test could not be applied

The `STALE` and `ACTIVE` definitions turn on whether a branch has commits within the last 30 days. **The entire repository history spans 19–29 July 2026 — ten days.** Every branch therefore falls inside the 30-day window, which would classify all 18 unmerged, non-colliding branches as `ACTIVE` and collapse the distinction entirely.

The calendar test was therefore replaced with the abandonment signal that is actually available in this repository: **a pull request closed without being merged.** Seventeen branches are recorded `STALE` on that basis, and `ACTIVE` is reserved for a branch with an open PR. This substitution is stated rather than applied silently. It cannot cause work to be lost: `STALE` branches are excluded from the deletion command list regardless, and appear only under owner confirmation.

## Branch table

Ahead/behind are commits relative to `origin/main`. "Applies cleanly" is the `git merge-tree` result — no merge was attempted. Rows are grouped by disposition, then alphabetical.

| Branch | Last commit | Ahead/behind | PR | Touches migrations | Applies cleanly | Disposition | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `agent/account-clear-race-safety` | 2026-07-28 | 0/90 | #171 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `agent/account-privacy-contact` | 2026-07-28 | 0/82 | #174 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `agent/admin-control-room-current-main` | 2026-07-27 | 0/307 | #108 closed, #112 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `agent/bonus-games-browser-e2e` | 2026-07-29 | 0/17 | #187 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `agent/bonus-games-e2e-evidence` | 2026-07-29 | 0/13 | #188 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `agent/bonus-games-production-release` | 2026-07-29 | 0/29 | #184 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `agent/bonus-games-release-evidence` | 2026-07-29 | 0/26 | #185 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `agent/clarify-release-evidence-label` | 2026-07-29 | 0/24 | #186 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `agent/complete-admin-result-workflow` | 2026-07-27 | 0/300 | #120 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `agent/contract-38-promotion-docs` | 2026-07-27 | 0/305 | #117 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `agent/export-canonical-migrations` | 2026-07-26 | 0/320 | #104 closed | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `agent/full-docs-audit-contract-60` | 2026-07-29 | 0/44 | #183 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `agent/h2h-rank-history-evidence` | 2026-07-29 | 0/7 | #190 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `agent/h2h-rank-history-pgtap` | 2026-07-29 | 0/11 | #189 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `agent/match-centre-resilience` | 2026-07-28 | 0/114 | #162 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `agent/match-centre-resilient-states` | 2026-07-28 | 0/157 | #154 closed | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `agent/paginated-private-league-standings` | 2026-07-28 | 0/249 | #138 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `agent/production-backup-auth-schema-compat` | 2026-07-27 | 0/311 | #115 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `agent/production-backup-json-summary` | 2026-07-27 | 0/309 | #116 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `agent/profile-h2h-surface-verification` | 2026-07-28 | 0/234 | #141 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `agent/result-revision-content-pgtap` | 2026-07-29 | 0/5 | #191 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `agent/result-revision-evidence` | 2026-07-29 | 0/1 | #192 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `agent/richer-h2h-rank-bracket-health` | 2026-07-28 | 0/177 | #145 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `agent/secure-other-player-profiles` | 2026-07-28 | 0/203 | #143 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `agent/streamlined-development-mode` | 2026-07-27 | 0/303 | #119 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `audit/2026-07-23-live-reconciliation` | 2026-07-23 | 0/468 | #15 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `batch-3-manual-tie-resolution` | 2026-07-23 | 0/555 | #6 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `claude/apply-patch-gckf6v` | 2026-07-29 | 0/73 | #150 merged, #157 merged, #164 merged, #165 merged, #166 merged, #167 merged, #172 merged, #177 merged, #178 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `claude/branch-inventory-audit-dsf9pn` | 2026-07-29 | 0/0 | none | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `claude/production-backup-workflow-gqz35v` | 2026-07-27 | 0/315 | #111 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `codex/add-github-actions-ci-workflow` | 2026-07-23 | 0/585 | #1 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `codex/fix-batch-1-compatibility-gate-error` | 2026-07-23 | 0/578 | #4 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `data-002-knockout-result-lifecycle` | 2026-07-23 | 0/511 | #11 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `database-parity-foundation` | 2026-07-23 | 0/543 | #7 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `db-integrity-entry-boundary-1` | 2026-07-23 | 0/522 | #9 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `docs/accept-final-recovery-evidence` | 2026-07-25 | 0/353 | #89 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `docs/reconcile-group-order-contract` | 2026-07-23 | 0/573 | #5 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `docs/reconcile-group-order-parity-completion` | 2026-07-23 | 0/538 | #8 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `docs/reconcile-league-disclosure` | 2026-07-24 | 0/401 | none | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `docs/reconcile-post-func-001` | 2026-07-23 | 0/495 | #13 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `docs/ux-002-availability-reconciliation` | 2026-07-25 | 0/360 | #86 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `feature/match-centre-lifecycle-browser-coverage` | 2026-07-26 | 0/324 | #100 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `feature/match-centre-lifecycle-content` | 2026-07-26 | 0/334 | #96 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `fix/league-hub-data-availability` | 2026-07-25 | 0/370 | #82 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `fix/match-centre-league-availability` | 2026-07-25 | 0/362 | #85 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `func-001-bracket-tree-integrity` | 2026-07-23 | 0/500 | #12 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `hotfix/cup-settle-lint` | 2026-07-29 | 0/65 | #180 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `ops-fix-production-rollback-boundary` | 2026-07-23 | 0/518 | #10 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `ops/migrations-21-33-rollout-readiness` | 2026-07-23 | 0/455 | #16 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `ops/production-migration-history-1-20-proof` | 2026-07-23 | 0/449 | #17 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `pr3-repair-staging` | 2026-07-23 | 0/583 | none | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `rel-004-atomic-bracket-persistence` | 2026-07-23 | 0/484 | #14 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `release/align-contract55-controls` | 2026-07-28 | 0/125 | #161 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `release/align-contract60-controls-v2` | 2026-07-29 | 0/51 | #182 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `release/contract55-production-publish` | 2026-07-28 | 0/135 | #160 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `release/production-contract-48` | 2026-07-28 | 0/175 | #148 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `release/production-smoke-contract48` | 2026-07-28 | 0/138 | #158 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `reliability/rel-003-submit-save-barrier` | 2026-07-24 | 0/421 | #19 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `security/003-function-privileges` | 2026-07-24 | 0/433 | #18 merged | no | yes | `MERGED` | Ancestry-merged into `origin/main`. |
| `a11y/league-options-disclosure` | 2026-07-24 | 5/405 | #41 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #41. |
| `a11y/link-semantic-bottom-nav` | 2026-07-24 | 8/408 | #37 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #37. |
| `a11y/route-transitions` | 2026-07-24 | 15/406 | #39 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #39. |
| `a11y/route-transitions-cleanup` | 2026-07-24 | 3/405 | #42 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #42. |
| `agent/acquisition-audit-docs` | 2026-07-27 | 12/317 | #109 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #109. |
| `agent/actual-round-of-16-lifecycle` | 2026-07-27 | 16/299 | #122 merged | yes — 20260727150621 | no | `LANDED-SQUASHED` | Squash-merged via merged PR #122. |
| `agent/actual-third-place-resolution` | 2026-07-27 | 20/297 | #126 merged | yes — 20260727163339 | no | `LANDED-SQUASHED` | Squash-merged via merged PR #126. |
| `agent/add-auth-recovery-e2e` | 2026-07-24 | 45/390 | #61 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #61. |
| `agent/add-authenticated-browser-e2e` | 2026-07-24 | 21/396 | #53 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #53. |
| `agent/add-bracket-conflict-e2e` | 2026-07-24 | 6/394 | #55 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #55. |
| `agent/add-locked-state-e2e` | 2026-07-24 | 5/393 | #56 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #56. |
| `agent/add-submission-barrier-e2e` | 2026-07-24 | 8/395 | #54 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #54. |
| `agent/authoritative-knockout-results` | 2026-07-27 | 9/298 | #124 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #124. |
| `agent/automatic-entry-submission` | 2026-07-27 | 26/296 | #128 merged | yes — 20260727174658 | no | `LANDED-SQUASHED` | Squash-merged via merged PR #128. |
| `agent/bounded-read-models` | 2026-07-27 | 11/295 | #131 merged | yes — 20260727182300 | no | `LANDED-SQUASHED` | Squash-merged via merged PR #131. |
| `agent/close-audit-control-findings` | 2026-07-24 | 11/399 | #48 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #48. |
| `agent/close-feature-baseline-identifiers` | 2026-07-24 | 7/397 | #51 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #51. |
| `agent/data-003-reference-integrity` | 2026-07-25 | 22/381 | #76 merged | yes — 20260725010000 | no | `LANDED-SQUASHED` | Squash-merged via merged PR #76. |
| `agent/fix-database-parity-trigger` | 2026-07-24 | 4/401 | #45 merged | no | yes | `LANDED-SQUASHED` | Squash-merged via merged PR #45. |
| `agent/focus-refresh-stale-pages` | 2026-07-25 | 17/385 | #68 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #68. |
| `agent/harden-logical-restore-privileges` | 2026-07-25 | 1/358 | #88 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #88. |
| `agent/idempotent-entry-creation` | 2026-07-24 | 11/387 | #65 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #65. |
| `agent/operating-cap-enforcement-v2` | 2026-07-27 | 38/293 | #136 merged | yes — 20260727191942 | no | `LANDED-SQUASHED` | Squash-merged via merged PR #136. |
| `agent/paginated-overall-standings` | 2026-07-27 | 19/294 | #134 merged | yes — 20260727183900 | no | `LANDED-SQUASHED` | Squash-merged via merged PR #134. |
| `agent/prepare-final-target-contract-36` | 2026-07-27 | 4/319 | #106 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #106. |
| `agent/prevent-late-read-overwrite` | 2026-07-24 | 13/389 | #63 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #63. |
| `agent/production-backup-pg17-client` | 2026-07-27 | 1/314 | #113 merged | no | yes | `LANDED-SQUASHED` | Squash-merged via merged PR #113. |
| `agent/production-backup-storage-cleanup` | 2026-07-27 | 2/313 | #114 merged | no | yes | `LANDED-SQUASHED` | Squash-merged via merged PR #114. |
| `agent/production-operational-assurance` | 2026-07-26 | 27/351 | #92 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #92. |
| `agent/reconcile-contract-35-production` | 2026-07-25 | 16/352 | #90 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #90. |
| `agent/reconcile-contract-36` | 2026-07-26 | 14/322 | #101 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #101. |
| `agent/remove-unused-vite-asset` | 2026-07-25 | 1/381 | #74 merged | no | yes | `LANDED-SQUASHED` | Squash-merged via merged PR #74. |
| `agent/repair-audit-controls` | 2026-07-24 | 27/400 | #47 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #47. |
| `agent/repair-contract-36-control-plane` | 2026-07-26 | 8/321 | #103 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #103. |
| `agent/restore-feature-baseline-ids` | 2026-07-24 | 9/398 | #50 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #50. |
| `agent/safe-user-facing-errors` | 2026-07-25 | 12/383 | #71 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #71. |
| `agent/sentry-operational-assurance` | 2026-07-26 | 25/350 | #93 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #93. |
| `agent/verify-development-contract-36` | 2026-07-27 | 10/320 | #105 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #105. |
| `chore/editor-baseline` | 2026-07-24 | 3/409 | #36 merged | no | yes | `LANDED-SQUASHED` | Squash-merged via merged PR #36. |
| `claude/docs-staleness-review-v2ct7z` | 2026-07-28 | 9/292 | #139 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #139. |
| `codex/add-github-actions-ci-workflow-0rcz27` | 2026-07-23 | 4/584 | #3 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #3. |
| `data/005-persist-score-clearing` | 2026-07-24 | 27/420 | #20 merged | yes — 20260724003000 | no | `LANDED-SQUASHED` | Squash-merged via merged PR #20. |
| `docs/2026-07-24-post-merge-production-state` | 2026-07-24 | 11/419 | #21 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #21. |
| `docs/2026-07-24-stable-release-identity` | 2026-07-24 | 5/418 | #22 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #22. |
| `docs/2026-07-25-repeat-audit` | 2026-07-25 | 11/379 | #77 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #77. |
| `docs/close-rel005` | 2026-07-25 | 4/384 | #69 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #69. |
| `docs/close-rel006` | 2026-07-24 | 4/386 | #66 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #66. |
| `docs/legacy-dev-site-turnstile` | 2026-07-24 | 5/413 | #29 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #29. |
| `docs/owner-default-decisions` | 2026-07-24 | 2/410 | #35 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #35. |
| `docs/reconcile-editor-and-bottom-nav` | 2026-07-24 | 1/407 | #38 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #38. |
| `docs/sec002-authority-reconciliation` | 2026-07-25 | 4/381 | none | no | yes | `LANDED-SQUASHED` | Net diff against its merge base is empty — the branch contributes no content at all. |
| `feature/match-centre-navigation-coverage` | 2026-07-26 | 12/333 | #97 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #97. |
| `feature/match-centre-v1-contract` | 2026-07-26 | 31/347 | #95 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #95. |
| `fix/golden-boot-search-availability` | 2026-07-25 | 6/359 | #87 merged | no | yes | `LANDED-SQUASHED` | Squash-merged via merged PR #87. |
| `fix/home-data-availability` | 2026-07-25 | 20/375 | #81 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #81. |
| `fix/migration31-existing-submission-compatibility` | 2026-07-24 | 14/392 | #58 merged | yes — 20260723184000 | no | `LANDED-SQUASHED` | Squash-merged via merged PR #58. |
| `fix/pending-invite-render-boundary` | 2026-07-25 | 11/376 | #80 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #80. |
| `fix/profile-data-availability` | 2026-07-25 | 5/369 | #83 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #83. |
| `ops/2026-07-24-production-recovery-readiness` | 2026-07-24 | 16/417 | #23 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #23. |
| `ops/app-schema-deploy-gate` | 2026-07-24 | 4/415 | #25 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #25. |
| `ops/app-schema-deploy-gate-evidence` | 2026-07-24 | 7/414 | #26 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #26. |
| `ops/env-file-hygiene` | 2026-07-24 | 4/411 | #31 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #31. |
| `ops/netlify-non-production-isolation` | 2026-07-24 | 9/416 | #24 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #24. |
| `ops/pin-node-runtime` | 2026-07-24 | 7/412 | #30 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #30. |
| `ops/update-production-rollout-fingerprint-20260724` | 2026-07-24 | 3/391 | #59 merged | no | yes | `LANDED-SQUASHED` | Squash-merged via merged PR #59. |
| `test/browser-route-accessibility` | 2026-07-25 | 3/378 | #78 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #78. |
| `test/private-league-invite-journey` | 2026-07-25 | 6/377 | #79 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #79. |
| `ux/sign-out-confirmation` | 2026-07-24 | 9/388 | #43 merged | no | no | `LANDED-SQUASHED` | Squash-merged via merged PR #43. |
| `agent/account-privacy-controls` | 2026-07-28 | 27/103 | #169 closed | yes — 20260729070000 | no | `DEAD-COLLIDING` | Adds migration `20260729070000` — timestamp already used in `main` by `account_entry_controls`. |
| `agent/admin-control-room-rebased` | 2026-07-27 | 19/316 | #110 closed | yes — 20260727080000, 20260727083000 | no | `DEAD-COLLIDING` | Adds `20260727080000`/`20260727083000`, both renumbered upstream to `20260727075922`/`20260727080159`. |
| `agent/bounded-leaderboard-members` | 2026-07-27 | 18/295 | #132 closed | yes — 20260727183000 | no | `DEAD-COLLIDING` | Adds `20260727183000`, renumbered upstream to `20260727183900` by merged PR #134. |
| `agent/operating-cap-enforcement` | 2026-07-27 | 25/294 | #135 closed | yes — 20260727190000 | no | `DEAD-COLLIDING` | Adds `20260727190000`, renumbered upstream to `20260727191942` by merged PR #136. |
| `agent/post-lock-consensus` | 2026-07-28 | 10/81 | #176 open | yes — 20260729110000 | no | `DEAD-COLLIDING` | Adds migration `20260729110000` — timestamp taken by merged contract 60 `predictor_cup_lint_safe_qualification`. |
| `backup/admin-control-room-current-main-pre-rebase-4abfde1` | 2026-07-27 | 16/317 | none | yes — 20260727080000, 20260727083000 | no | `DEAD-COLLIDING` | Backup ref carrying `20260727080000`/`20260727083000`, both renumbered upstream. |
| `codex/add-github-actions-ci-workflow-089far` | 2026-07-23 | 1/586 | #2 closed | yes — 20260723130000 | no | `DEAD-COLLIDING` | Adds `20260723130000`, renumbered upstream to `20260723173000`; PR #2 self-describes as superseded. |
| `agent/admin-control-room-foundation` | 2026-07-26 | 30/321 | #102 closed | no | no | `STALE` | PR #102 closed without merge; no valuable unique work found. |
| `agent/admin-control-room-rebase-2` | 2026-07-27 | 7/317 | #107 closed | no | no | `STALE` | PR #107 closed without merge; no valuable unique work found. |
| `agent/production-contract-38-dry-run` | 2026-07-27 | 2/304 | #118 closed | no | yes | `STALE` | PR #118 closed without merge; no valuable unique work found. |
| `fix/profile-source-availability` | 2026-07-25 | 5/369 | #84 closed | no | no | `STALE` | PR #84 closed without merge; no valuable unique work found. |
| `ops/production-payload-rehearsal-20260724` | 2026-07-24 | 6/392 | #57 closed | yes — 20260723184000 | yes | `STALE` | PR #57 closed without merge; no valuable unique work found. |
| `reconcile/contract54-source-discovery` | 2026-07-28 | 2/157 | #156 closed | no | yes | `STALE` | PR #156 closed without merge; no valuable unique work found. |
| `reconcile/match-centre-e2e-discovery` | 2026-07-28 | 1/124 | #163 closed | no | yes | `STALE` | PR #163 closed without merge; no valuable unique work found. |
| `release/align-contract60-controls` | 2026-07-29 | 9/64 | #181 closed | no | no | `STALE` | PR #181 closed unmerged; content fully absorbed and successor PR #182 merged. |
| `release/align-production-smoke-contract48` | 2026-07-28 | 2/145 | #153 closed | no | no | `STALE` | PR #153 closed without merge; no valuable unique work found. |
| `release/contract55-production-promotion` | 2026-07-28 | 12/137 | #159 closed | no | yes | `STALE` | PR #159 closed without merge; no valuable unique work found. |
| `release/contract58-production-promotion` | 2026-07-29 | 10/73 | #179 closed | no | yes | `STALE` | PR #179 closed without merge; no valuable unique work found. |
| `temp/contract48-production-export` | 2026-07-28 | 2/177 | #146 closed | no | yes | `STALE` | PR #146 closed without merge; no valuable unique work found. |
| `temp/contract48-production-smoke` | 2026-07-28 | 1/174 | #151 closed | no | yes | `STALE` | PR #151 closed without merge; no valuable unique work found. |
| `temp/netlify-build-log-diagnostics` | 2026-07-28 | 1/157 | #155 closed | no | yes | `STALE` | PR #155 closed without merge; no valuable unique work found. |
| `temp/netlify-contract48-production-deploy` | 2026-07-28 | 3/157 | #149 closed | no | yes | `STALE` | PR #149 closed without merge; no valuable unique work found. |
| `temp/production-contract48-source` | 2026-07-28 | 1/176 | #147 closed | no | yes | `STALE` | PR #147 closed without merge; no valuable unique work found. |
| `ux/confirm-sign-out` | 2026-07-24 | 2/405 | #40 closed | no | no | `STALE` | PR #40 closed without merge; no valuable unique work found. |
| `agent/post-lock-final-standings` | 2026-07-29 | 8/0 | #193 open | yes — 20260729122100, 20260729122200 | yes | `ACTIVE` | Open PR #193; 8 ahead, 0 behind; carries the live post-lock trends and final-standings work. |
| `backup/admin-control-room-pre-backup-refresh-d743f7c` | 2026-07-27 | 3/316 | none | yes — 20260727075922, 20260727080159 | no | `UNCLEAR` | Deliberate backup ref, no PR; both migrations byte-identical to `main`, no unique files. |
| `fix/nav-restore-and-continue` | 2026-07-22 | 2/608 | none | no | no | `UNCLEAR` | No PR; three unique unlanded source files; tip commit is explicitly parked WIP. |
| `release/contract55-production-live` | 2026-07-28 | 1/137 | none | no | yes | `UNCLEAR` | No PR; adds a contract-55 patch workflow absent from `main`. |

## `DEAD-COLLIDING` branches — evidence

All seven are unmerged and each adds a migration that the merged chain has since taken or renumbered. Re-merging any of them as-is would either duplicate a timestamp or insert a second copy of a migration that is already applied under a different version. In every case the underlying feature is already in `main` under the renumbered migration, except `agent/post-lock-consensus`, whose successor is still open.

### `agent/post-lock-consensus`

- **Tip:** `40398dd`, 2026-07-28, _Test strict prediction-consensus parsing_
- **Position:** 10 ahead, 81 behind `origin/main`; `git cherry` +10 / -0; `git merge-tree` reports conflicts
- **Pull request:** #176 (open) — Build post-lock prediction consensus and My-entry reveal
- **Migration added:** `supabase/migrations/20260729110000_prediction_consensus.sql`
- **Collision:** `main` already holds `20260729110000_predictor_cup_lint_safe_qualification.sql` — the merged contract 60 migration. The timestamp is taken by a different file with different content.
- **Unique unlanded files:** 6, including the colliding migration, `src/services/supabase/predictionConsensus.ts`, `predictionConsensusModel.ts` and `supabase/tests/113_prediction_consensus.sql`.

**This is the known case named in the audit brief, and it is confirmed.** The branch stalled at 2026-07-28 while contracts 59 and 60 (`20260729100000` and `20260729110000`) were merged ahead of it, and it now sits 81 commits behind `main`.

Two things qualify the disposition and should be read before anyone acts on it:

- **PR #176 is still open.** Under the literal rule an open PR means `ACTIVE`. It is recorded `DEAD-COLLIDING` because the branch cannot be merged as-is regardless of its PR state — the migration timestamp is already occupied in `main`. The open PR is recorded here rather than used to classify, and PR #176 should be closed or retargeted rather than left implying mergeable work.
- **The work is already being redone.** `agent/post-lock-final-standings` (open PR #193, 8 ahead / 0 behind) carries a commit `Adopt post-lock consensus on current baseline` and re-adds consensus cleanly at `20260729122100_prediction_consensus.sql`, after the merged head. That branch is the live successor.

The consensus work is therefore not lost, but this branch is not the vehicle for it. **Do not delete it until PR #176 is closed and the owner confirms PR #193 fully carries the work.**

### `agent/account-privacy-controls`

- **Tip:** `cb2f17f`, 2026-07-28, _Test strict Account response parsing_
- **Position:** 27 ahead, 103 behind `origin/main`; `git cherry` +27 / -0; `git merge-tree` reports conflicts
- **Pull request:** #169 (closed) — Build private Account, privacy and contact-admin controls
- **Migration added:** `supabase/migrations/20260729070000_account_privacy_controls.sql`
- **Collision:** `main` already holds `20260729070000_account_entry_controls.sql` at the same timestamp, added by `Add the Account page with entry controls (contract 57)`.
- **Unique unlanded files:** 6, including `src/services/supabase/account.ts`, `accountModel.ts` and `supabase/tests/111_account_privacy_controls.sql`.
- **What landed instead:** PR #169 was closed unmerged; the Account, privacy and contact-admin programme landed via `agent/account-privacy-contact` (merged PR #174).

The feature is delivered in `main`, but this branch's specific migration can never be applied on top of it. Redo or drop; do not merge.

### `agent/admin-control-room-rebased`

- **Tip:** `870246d`, 2026-07-27, _Keep admin RPCs out of service-role allowlist_
- **Position:** 19 ahead, 316 behind `origin/main`; `git cherry` +19 / -0; `git merge-tree` reports conflicts
- **Pull request:** #110 (closed) — Add protected Admin Control Room and controlled result entry
- **Migrations added:** `20260727080000_admin_result_authorization.sql` and `20260727083000_admin_result_revision_timestamp.sql`
- **Collision:** `main` carries the same two logical migrations renumbered to `20260727075922` and `20260727080159`. Merging would insert a second, earlier-sorting copy of each.
- **What landed instead:** Commit `Refresh admin control room onto current main` (`57efbcb`) introduced the renumbered pair; PR #110 was closed unmerged.

### `agent/bounded-leaderboard-members`

- **Tip:** `749966f`, 2026-07-27, _Remove temporary build diagnostics_
- **Position:** 18 ahead, 295 behind `origin/main`; `git cherry` +18 / -0; `git merge-tree` reports conflicts
- **Pull request:** #132 (closed) — Bound and paginate overall standings
- **Migrations added:** `20260727183000_bounded_overall_leaderboard.sql`
- **Collision:** `main` carries the same migration renumbered to `20260727183900`.
- **What landed instead:** Merged PR #134 (`Paginate overall standings on contract 43`) landed the renumbered migration; PR #132 was closed unmerged.

### `agent/operating-cap-enforcement`

- **Tip:** `839fe67`, 2026-07-27, _Seed a baseline league for lower-limit enforcement_
- **Position:** 25 ahead, 294 behind `origin/main`; `git cherry` +25 / -0; `git merge-tree` reports conflicts
- **Pull request:** #135 (closed) — Enforce public user and total league operating caps
- **Migrations added:** `20260727190000_operating_cap_enforcement.sql`
- **Collision:** `main` carries the same migration renumbered to `20260727191942`.
- **What landed instead:** Merged PR #136 on `agent/operating-cap-enforcement-v2` landed the renumbered migration; PR #135 was closed unmerged.

### `codex/add-github-actions-ci-workflow-089far`

- **Tip:** `5fc19ea`, 2026-07-23, _test: add predicted group order parity foundation_
- **Position:** 1 ahead, 586 behind `origin/main`; `git cherry` +1 / -0; `git merge-tree` reports conflicts
- **Pull request:** #2 (closed) — Superseded by PR #3 — incomplete SQL/Supabase parity foundation
- **Migrations added:** `20260723130000_predicted_group_order_resolver.sql`
- **Collision:** `main` carries the same resolver renumbered to `20260723173000`.
- **What landed instead:** PR #2 is titled `Superseded by PR #3 — incomplete SQL/Supabase parity foundation`, so supersession is recorded by the author.

### `backup/admin-control-room-current-main-pre-rebase-4abfde1`

- **Tip:** `4abfde1`, 2026-07-27, _Reconcile admin branch with current documentation authority_
- **Position:** 16 ahead, 317 behind `origin/main`; `git cherry` +16 / -0; `git merge-tree` reports conflicts
- **Pull request:** none
- **Migrations added:** `20260727080000_admin_result_authorization.sql` and `20260727083000_admin_result_revision_timestamp.sql`
- **Collision:** Same renumbering collision as `agent/admin-control-room-rebased` — `main` holds `20260727075922` and `20260727080159`.
- **What landed instead:** No pull request was ever opened. The branch name marks it as a pre-rebase backup snapshot of the admin control-room work, which is in `main`.

## `UNCLEAR` branches — evidence

None of these three has a pull request, so the two strongest evidence sources — ancestry and merge status — are both unavailable. Each is left unclassified deliberately rather than guessed.

### `fix/nav-restore-and-continue`

- **Tip:** `4972bda`, 2026-07-22, _WIP: nav-restore — parked pending Batch B / hub re-cut decision_
- **Position:** 2 ahead, 608 behind `origin/main`; `git cherry` +2 / -0; `git merge-tree` reports conflicts
- **Pull request:** none
- **Unique unlanded files:** `src/app/navRestore.ts`, `src/features/predict/entryFlow.ts`, `tests/features/predict/entryFlow.test.ts`
- **Migrations:** none

The oldest branch in the repository and the furthest behind (608 commits). Its tip commit reads _"WIP: nav-restore — parked pending Batch B / hub re-cut decision"_, so it was parked deliberately rather than abandoned by drift, and the decision it was waiting on is not recorded here. It carries three unique source files that never landed in any form, including a navigation-restore module with no counterpart in `main`.

This is real, unlanded, deliberately-parked work. **Whoever parked it should confirm the hub re-cut decision was made before this is deleted.**

### `release/contract55-production-live`

- **Tip:** `5de9abd`, 2026-07-28, _Prepare contract 55 production release alignment_
- **Position:** 1 ahead, 137 behind `origin/main`; `git cherry` +1 / -0; `git merge-tree` applies cleanly
- **Pull request:** none
- **Unique unlanded file:** `.github/workflows/patch-contract55-production-live.yml`
- **Migrations:** none

A single commit adding a one-off contract-55 production patch workflow that is absent from `main`. No PR was opened, so there is no record of whether it was used, superseded or rejected. The repository and both Supabase projects are now at contract 60, which makes a contract-55 patch workflow obsolete on its face — but "obsolete" is inferred from the contract number, not evidenced, and the file has no successor in `main` to point at. Almost certainly disposable; not evidenced enough to say so.

### `backup/admin-control-room-pre-backup-refresh-d743f7c`

- **Tip:** `d743f7c`, 2026-07-27, _Align preview smoke with contract 38_
- **Position:** 3 ahead, 316 behind `origin/main`; `git cherry` +3 / -0; `git merge-tree` reports conflicts
- **Pull request:** none
- **Migrations touched:** `20260727075922_admin_result_authorization.sql` and `20260727080159_admin_result_revision_timestamp.sql` — both **byte-identical** to the versions in `main`
- **Unique unlanded files:** none

Unlike the other `backup/` ref, this snapshot carries the *canonical* migration versions, so it does not collide with `main`, and the three-way comparison finds no file it holds that `main` lacks. On content alone it is redundant and safe to remove.

It is held back from the deletion list for a different reason: it is a **deliberately created backup ref** with no PR, and its `merge-tree` still reports conflicts against `main`. Deleting a ref that someone created on purpose as a safety net is an owner policy decision, not a mechanical one, and the branch name records no expiry.

## Recommended deletions

These 127 commands cover **only** the 59 `MERGED` and 68 `LANDED-SQUASHED` branches. Every one has either ancestry into `origin/main`, its own merged pull request, or a provable no-op merge. No `STALE`, `ACTIVE`, `DEAD-COLLIDING` or `UNCLEAR` branch appears here.

One entry needs a note before it is run: `claude/branch-inventory-audit-dsf9pn` is the branch this audit itself was run from. It is ancestry-merged and holds no unique content, so it belongs in this list on the evidence — but delete it after this report has merged, not before.

```sh
# MERGED — ancestry-merged into origin/main (59)
git push origin --delete agent/account-clear-race-safety
git push origin --delete agent/account-privacy-contact
git push origin --delete agent/admin-control-room-current-main
git push origin --delete agent/bonus-games-browser-e2e
git push origin --delete agent/bonus-games-e2e-evidence
git push origin --delete agent/bonus-games-production-release
git push origin --delete agent/bonus-games-release-evidence
git push origin --delete agent/clarify-release-evidence-label
git push origin --delete agent/complete-admin-result-workflow
git push origin --delete agent/contract-38-promotion-docs
git push origin --delete agent/export-canonical-migrations
git push origin --delete agent/full-docs-audit-contract-60
git push origin --delete agent/h2h-rank-history-evidence
git push origin --delete agent/h2h-rank-history-pgtap
git push origin --delete agent/match-centre-resilience
git push origin --delete agent/match-centre-resilient-states
git push origin --delete agent/paginated-private-league-standings
git push origin --delete agent/production-backup-auth-schema-compat
git push origin --delete agent/production-backup-json-summary
git push origin --delete agent/profile-h2h-surface-verification
git push origin --delete agent/result-revision-content-pgtap
git push origin --delete agent/result-revision-evidence
git push origin --delete agent/richer-h2h-rank-bracket-health
git push origin --delete agent/secure-other-player-profiles
git push origin --delete agent/streamlined-development-mode
git push origin --delete audit/2026-07-23-live-reconciliation
git push origin --delete batch-3-manual-tie-resolution
git push origin --delete claude/apply-patch-gckf6v
git push origin --delete claude/branch-inventory-audit-dsf9pn
git push origin --delete claude/production-backup-workflow-gqz35v
git push origin --delete codex/add-github-actions-ci-workflow
git push origin --delete codex/fix-batch-1-compatibility-gate-error
git push origin --delete data-002-knockout-result-lifecycle
git push origin --delete database-parity-foundation
git push origin --delete db-integrity-entry-boundary-1
git push origin --delete docs/accept-final-recovery-evidence
git push origin --delete docs/reconcile-group-order-contract
git push origin --delete docs/reconcile-group-order-parity-completion
git push origin --delete docs/reconcile-league-disclosure
git push origin --delete docs/reconcile-post-func-001
git push origin --delete docs/ux-002-availability-reconciliation
git push origin --delete feature/match-centre-lifecycle-browser-coverage
git push origin --delete feature/match-centre-lifecycle-content
git push origin --delete fix/league-hub-data-availability
git push origin --delete fix/match-centre-league-availability
git push origin --delete func-001-bracket-tree-integrity
git push origin --delete hotfix/cup-settle-lint
git push origin --delete ops-fix-production-rollback-boundary
git push origin --delete ops/migrations-21-33-rollout-readiness
git push origin --delete ops/production-migration-history-1-20-proof
git push origin --delete pr3-repair-staging
git push origin --delete rel-004-atomic-bracket-persistence
git push origin --delete release/align-contract55-controls
git push origin --delete release/align-contract60-controls-v2
git push origin --delete release/contract55-production-publish
git push origin --delete release/production-contract-48
git push origin --delete release/production-smoke-contract48
git push origin --delete reliability/rel-003-submit-save-barrier
git push origin --delete security/003-function-privileges

# LANDED-SQUASHED — squash-merged or provably no-op (68)
git push origin --delete a11y/league-options-disclosure
git push origin --delete a11y/link-semantic-bottom-nav
git push origin --delete a11y/route-transitions
git push origin --delete a11y/route-transitions-cleanup
git push origin --delete agent/acquisition-audit-docs
git push origin --delete agent/actual-round-of-16-lifecycle
git push origin --delete agent/actual-third-place-resolution
git push origin --delete agent/add-auth-recovery-e2e
git push origin --delete agent/add-authenticated-browser-e2e
git push origin --delete agent/add-bracket-conflict-e2e
git push origin --delete agent/add-locked-state-e2e
git push origin --delete agent/add-submission-barrier-e2e
git push origin --delete agent/authoritative-knockout-results
git push origin --delete agent/automatic-entry-submission
git push origin --delete agent/bounded-read-models
git push origin --delete agent/close-audit-control-findings
git push origin --delete agent/close-feature-baseline-identifiers
git push origin --delete agent/data-003-reference-integrity
git push origin --delete agent/fix-database-parity-trigger
git push origin --delete agent/focus-refresh-stale-pages
git push origin --delete agent/harden-logical-restore-privileges
git push origin --delete agent/idempotent-entry-creation
git push origin --delete agent/operating-cap-enforcement-v2
git push origin --delete agent/paginated-overall-standings
git push origin --delete agent/prepare-final-target-contract-36
git push origin --delete agent/prevent-late-read-overwrite
git push origin --delete agent/production-backup-pg17-client
git push origin --delete agent/production-backup-storage-cleanup
git push origin --delete agent/production-operational-assurance
git push origin --delete agent/reconcile-contract-35-production
git push origin --delete agent/reconcile-contract-36
git push origin --delete agent/remove-unused-vite-asset
git push origin --delete agent/repair-audit-controls
git push origin --delete agent/repair-contract-36-control-plane
git push origin --delete agent/restore-feature-baseline-ids
git push origin --delete agent/safe-user-facing-errors
git push origin --delete agent/sentry-operational-assurance
git push origin --delete agent/verify-development-contract-36
git push origin --delete chore/editor-baseline
git push origin --delete claude/docs-staleness-review-v2ct7z
git push origin --delete codex/add-github-actions-ci-workflow-0rcz27
git push origin --delete data/005-persist-score-clearing
git push origin --delete docs/2026-07-24-post-merge-production-state
git push origin --delete docs/2026-07-24-stable-release-identity
git push origin --delete docs/2026-07-25-repeat-audit
git push origin --delete docs/close-rel005
git push origin --delete docs/close-rel006
git push origin --delete docs/legacy-dev-site-turnstile
git push origin --delete docs/owner-default-decisions
git push origin --delete docs/reconcile-editor-and-bottom-nav
git push origin --delete docs/sec002-authority-reconciliation
git push origin --delete feature/match-centre-navigation-coverage
git push origin --delete feature/match-centre-v1-contract
git push origin --delete fix/golden-boot-search-availability
git push origin --delete fix/home-data-availability
git push origin --delete fix/migration31-existing-submission-compatibility
git push origin --delete fix/pending-invite-render-boundary
git push origin --delete fix/profile-data-availability
git push origin --delete ops/2026-07-24-production-recovery-readiness
git push origin --delete ops/app-schema-deploy-gate
git push origin --delete ops/app-schema-deploy-gate-evidence
git push origin --delete ops/env-file-hygiene
git push origin --delete ops/netlify-non-production-isolation
git push origin --delete ops/pin-node-runtime
git push origin --delete ops/update-production-rollout-fingerprint-20260724
git push origin --delete test/browser-route-accessibility
git push origin --delete test/private-league-invite-journey
git push origin --delete ux/sign-out-confirmation
```

## Requires owner confirmation before deletion

These 17 `STALE` branches each have a pull request that was **closed without merging**. None carries unique work that appears valuable, and most are short-lived `temp/`, `release/` or `reconcile/` branches from the contract 48–60 promotion sequence. They are recommended for deletion, but the evidence is a rejected PR rather than landed work, so an owner should confirm before running these.

Read the recency caveat above first: these are `STALE` on the strength of a closed-unmerged PR, **not** because they are dormant by date. Every branch in this repository was committed to within the last ten days.

```sh
git push origin --delete agent/admin-control-room-foundation   # PR #102 closed unmerged
git push origin --delete agent/admin-control-room-rebase-2   # PR #107 closed unmerged
git push origin --delete agent/production-contract-38-dry-run   # PR #118 closed unmerged
git push origin --delete fix/profile-source-availability   # PR #84 closed unmerged
git push origin --delete ops/production-payload-rehearsal-20260724   # PR #57 closed unmerged
git push origin --delete reconcile/contract54-source-discovery   # PR #156 closed unmerged
git push origin --delete reconcile/match-centre-e2e-discovery   # PR #163 closed unmerged
git push origin --delete release/align-contract60-controls   # PR #181 closed unmerged
git push origin --delete release/align-production-smoke-contract48   # PR #153 closed unmerged
git push origin --delete release/contract55-production-promotion   # PR #159 closed unmerged
git push origin --delete release/contract58-production-promotion   # PR #179 closed unmerged
git push origin --delete temp/contract48-production-export   # PR #146 closed unmerged
git push origin --delete temp/contract48-production-smoke   # PR #151 closed unmerged
git push origin --delete temp/netlify-build-log-diagnostics   # PR #155 closed unmerged
git push origin --delete temp/netlify-contract48-production-deploy   # PR #149 closed unmerged
git push origin --delete temp/production-contract48-source   # PR #147 closed unmerged
git push origin --delete ux/confirm-sign-out   # PR #40 closed unmerged
```

## Not for deletion

- **`DEAD-COLLIDING` (7)** — cannot be merged as-is, but each still holds the only copy of its own attempt. Close or retarget the associated pull requests, confirm the successor work in `main` is complete, then delete deliberately. `agent/post-lock-consensus` in particular still has an open PR (#176).
- **`ACTIVE` (1)** — `agent/post-lock-final-standings`, open PR #193, 0 behind `main`. Keep.
- **`UNCLEAR` (3)** — see the evidence section above. Roughly thirty seconds of owner review each.

## Closing note

**No branch, tag or remote ref was deleted, renamed, force-pushed, rebased, merged or closed in the course of this audit.** Every command listed in this document is **unexecuted**; they are recorded for a human to review and run deliberately.

The audit used read-only inspection throughout. `git merge-tree --write-tree` was used to test mergeability without performing a merge, and the only state-changing command run at all was `git fetch --unshallow`, which is local to the clone and does not touch the remote. No pull request was opened, closed, merged or commented on. No application code, migration, test or configuration file was modified; the single file added by the change that carries this report is the report itself.

Branch counts, ahead/behind figures and PR states are a snapshot at `origin/main` `7555db4` on 29 July 2026 and will drift as work continues. Re-measure before acting on the deletion lists.
