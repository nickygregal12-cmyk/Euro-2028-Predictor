# Open pull-request stack plan — 29 July 2026

**Purpose:** report the true open pull-request graph, file collisions and recommended integration order.  
**Repository baseline inspected:** `main` at `1fb8ffd36ad113079181829a8bcc47175c43b6da`.  
**Scope:** report only. No pull request was merged, closed, approved, rebased or retargeted while producing this document.

## 1. Verified merged prerequisites

The following historical statements are based on `merged_at`, not on the issue `state` field:

| PR | `merged_at` | Why it matters |
| --- | --- | --- |
| #196 | `2026-07-29T16:14:46Z` | Its head became contained in #193 and supplies the contract-63 privacy/timestamp work referenced by later reconciliation. |
| #193 | `2026-07-29T19:25:32Z` | Established the merged contract-63 product/database baseline. |
| #197 | `2026-07-29T19:44:21Z` | Produced current `main` and the tag-readiness authority used by #198. |

This confirms that #195's contract-60 authority text is superseded and that #198 is reconciling the actual post-#197 baseline rather than an unmerged candidate.

## 2. True dependency graph

The reported linear chain `#199 → #201 → #202 → #203 → #204` was incomplete. The true graph, including the programme-plan PR, is:

```text
main @ 1fb8ffd3
├── #194  chore/branch-inventory
├── #195  chore/baseline-reconciliation          [superseded; do not merge]
├── #198  chore/tag-reconciliation
└── #199  agent/land-adrs-0011-0018
    ├── #200  agent/regroup-docs-ops-only
    └── #201  agent/competition-context-engine
        └── #202  agent/reframe-platform-forward-docs
            └── #203  agent/reconcile-architecture-adrs
                └── #204  agent/fix-domain-parity-filter
                    └── #205  docs/add-programme-plan
```

#200 is therefore a **sibling of #201**, not a missing link between #199 and #201. However, later documentation already assumes its `docs/ops/` destination, so it is an integration dependency of #202 even though GitHub's declared base does not encode that dependency.

## 3. Every open pull request

Mergeability below is GitHub's result **against the pull request's current declared base**, not against `main` unless the base is `main`.

| PR | Head | Declared base | True dependency | Mergeable against current base | `merged_at` |
| --- | --- | --- | --- | --- | --- |
| #194 | `chore/branch-inventory` | `main` | independent historical report | yes | `null` |
| #195 | `chore/baseline-reconciliation` | `main` | independent but superseded | **no** | `null` |
| #198 | `chore/tag-reconciliation` | `main` | independent current-baseline reconciliation | yes | `null` |
| #199 | `agent/land-adrs-0011-0018` | `main` | root authority PR | yes | `null` |
| #200 | `agent/regroup-docs-ops-only` | #199 head | sibling branch under #199 | yes | `null` |
| #201 | `agent/competition-context-engine` | #199 head | sibling branch under #199 | yes | `null` |
| #202 | `agent/reframe-platform-forward-docs` | #201 head | depends on #201; operationally also needs #200 | yes | `null` |
| #203 | `agent/reconcile-architecture-adrs` | #202 head | depends on #202 and edits a file introduced/changed by #199 | yes | `null` |
| #204 | `agent/fix-domain-parity-filter` | #203 head | depends on #203 | yes | `null` |
| #205 | `docs/add-programme-plan` | #204 head | depends on #204 and replaces #202's build-plan version | yes | `null` |

## 4. Files touched

### #194 — branch inventory

- `docs/quality/investigations/2026-07-29-branch-inventory.md`

### #195 — superseded contract-60 reconciliation

- `AGENTS.md`
- `CLAUDE.md`
- `config/deployment-contract.json`
- `docs/ops-pending-migrations.md`
- `docs/quality/current-status.md`
- `docs/quality/deferred-decisions.md`
- `docs/quality/investigations/2026-07-29-euro-2028-baseline-readiness.md`
- `docs/quality/risk-register.md`
- `docs/roadmap.md`

### #198 — tagged-baseline reconciliation

- `config/deployment-contract.json`
- `docs/ops-pending-migrations.md`
- `docs/quality/current-status.md`
- `docs/quality/deferred-decisions.md`
- `docs/quality/investigations/2026-07-29-euro-2028-baseline-readiness.md`
- `docs/quality/investigations/2026-07-29-tag-reconciliation.md`
- `docs/quality/risk-register.md`

### #199 — ADR authority

- `docs/adr/0010-bonus-games-platform.md`
- `docs/adr/0011-multi-competition-platform.md`
- `docs/adr/0012-season-predictor-rules.md`
- `docs/adr/0013-last-man-standing-season-rules.md`
- `docs/adr/0014-predictor-cup-season-formats.md`
- `docs/adr/0015-commercial-and-social-model.md`
- `docs/adr/0016-client-and-distribution.md`
- `docs/adr/0017-brand-and-club-identity.md`
- `docs/adr/0018-pre-launch-promotion-cadence.md`
- `docs/adr/README.md`
- `docs/architecture-and-tournament-states.md`
- `docs/competition-structure.md`
- `docs/predictor-cup-rules.md`
- `docs/scoring-rules.md`

### #200 — operational runbook regrouping

- `.github/workflows/production-backup.yml`
- `README.md`
- `docs/ops/ops-admin-bootstrap.md`
- `docs/ops/ops-hosted-migration-rollout.md`
- `docs/ops/ops-pending-migrations.md`
- `docs/ops/ops-prod-cutover.md`
- `docs/ops/ops-production-backup-restore.md`
- `docs/ops/ops-production-promotion-contract-38.md`
- `docs/ops/ops-result-entry.md`
- `docs/quality/README.md`

The seven `docs/ops/ops-*.md` entries are Git renames from the corresponding top-level `docs/ops-*.md` paths.

### #201 — pure competition-context foundation

- `src/domain/competition/context.ts`
- `src/domain/competition/kinds.ts`
- `src/domain/competition/lockState.ts`
- `src/domain/competition/matchState.ts`
- `tests/domain/competition/context.test.ts`
- `tests/domain/competition/kinds.test.ts`
- `tests/domain/competition/lockState.test.ts`
- `tests/domain/competition/matchState.test.ts`

### #202 — forward-document reframing

- `AGENTS.md`
- `CLAUDE.md`
- `MASTER-TODO.md`
- `docs/architecture/multi-competition-hub-build-plan.md`
- `docs/build-todo.md`
- `docs/quality/current-status.md`
- `docs/roadmap.md`

### #203 — state-architecture reconciliation

- `docs/architecture-and-tournament-states.md`

### #204 — domain-wide Database parity trigger

- `.github/workflows/database-parity.yml`
- `docs/quality/risk-register.md`

### #205 — parent programme and reconciled engineering plan

- `docs/architecture/README.md`
- `docs/architecture/multi-competition-hub-build-plan.md`
- `docs/architecture/programme-plan.md`

## 5. File-level collisions

### Direct same-path collisions

| File | Pull requests | Disposition needed |
| --- | --- | --- |
| `AGENTS.md` | #195, #202 | #195 must not merge; retain #202's platform framing. |
| `CLAUDE.md` | #195, #202 | #195 must not merge; retain #202's platform framing. |
| `config/deployment-contract.json` | #195, #198 | #195 is superseded; review and retain #198 only. |
| `docs/ops-pending-migrations.md` | #195, #198, then renamed by #200 | #195 must not merge. Merge #198 before #200 so the rename carries the reconciled file content. |
| `docs/quality/current-status.md` | #195, #198, #202 | #195 must not merge. When #202 is rebased after #198, preserve #198's tagged-baseline evidence while applying #202's platform framing. |
| `docs/quality/deferred-decisions.md` | #195, #198 | #195 must not merge; retain #198's reconciliation. |
| `docs/quality/investigations/2026-07-29-euro-2028-baseline-readiness.md` | #195, #198 | #195 must not merge; retain #198's final reconciliation. |
| `docs/quality/risk-register.md` | #195, #198, #204 | #195 must not merge. Rebase #204 after #198 and preserve both the tag reconciliation and `CI-001`. |
| `docs/roadmap.md` | #195, #202 | #195 must not merge; #202's reframing is the active proposal. |
| `docs/architecture-and-tournament-states.md` | #199, #203 | Intentional descendant edit. #203 must land after #199 and be rebased onto the landed #199 version. |
| `docs/architecture/multi-competition-hub-build-plan.md` | #202, #205 | Intentional descendant replacement. #205 must land after #202 and remain a modification of #202's file. |

### Rename/path collision introduced by #200

#198 modifies `docs/ops-pending-migrations.md`, while #200 renames that path to `docs/ops/ops-pending-migrations.md`. If #200 lands first, #198 will either conflict or recreate the old path. The safe order is **#198 before #200**, followed by a refresh of #200 so Git carries #198's final content through the rename.

#195 has the same path collision but is explicitly superseded and should not enter the merge sequence.

## 6. Does #200 collide with #202 or #203?

### #202

- **No same-file collision:** #200 and #202 have no identical changed filename.
- **No stale top-level `docs/ops-*.md` reference was found** in #202's `MASTER-TODO.md`, `AGENTS.md`, `CLAUDE.md`, roadmap or build-plan changes.
- #202's `docs/quality/current-status.md` already describes operations as the relevant `docs/ops/` runbook. That is compatible with #200, but it means #202 semantically assumes the move has landed.

Conclusion: #200 does not conflict with #202; it should be treated as an **early dependency** so #202 does not describe a directory structure that is not present.

### #203

- #203 changes only `docs/architecture-and-tournament-states.md`.
- That file contains no reference to any moved `docs/ops-*.md` path.

Conclusion: there is no file or reference collision between #200 and #203.

## 7. Explicit recommendation on #200

**Merge #200 early. Do not close it and do not fold the move into #202/#205.**

Reasons:

1. the seven runbooks form a coherent operational directory and Git already recognises the changes as renames;
2. #202 already assumes `docs/ops/` exists;
3. #203 and #205 do not collide with the moved paths;
4. folding the move into later documentation work would enlarge already broad authority PRs and obscure rename review;
5. leaving #200 stranded behind #202–#205 creates the exact split-brain path state this plan is meant to avoid.

The only sequencing requirement is to merge #198 first so its update to `docs/ops-pending-migrations.md` is preserved in the renamed file.

## 8. Recommended integration order

### Dispositions before the platform chain

1. **#194 — merge first, after a final content review.** It is an additive historical investigation with no collision. No downstream PR is based on it.
2. **#195 — do not merge; close as superseded when the owner permits closure.** It is non-mergeable and its contract-60 authority text collides with the current contract-63 records.
3. **#198 — merge next.** It contains the unique tag-reconciliation report and updates the exact file #200 later moves. Landing it before the platform documents gives later rebases one current baseline rather than two competing ones.

### Platform authority and siblings

4. **#199 — merge the ADR authority.** It is the root dependency for both #200 and #201. After #198 lands, refresh #199 onto current `main`; it has no direct file collision with #198.
5. **#200 — merge the ops move early.** After #199 lands, retarget/rebase #200 to `main`, ensuring #198's final `docs/ops-pending-migrations.md` content is included in the rename.
6. **#201 — merge the pure engine.** After #199 lands, retarget/rebase #201 to the then-current `main` (which should now include #200). #201 and #200 have no file overlap.

### Linear documentation/control descendants

7. **#202 — rebase onto and retarget to `main` after #200 and #201.** Resolve `current-status.md` against #198 by preserving the tag reconciliation and applying the platform framing. Verify all `docs/ops/` references against the landed move.
8. **#203 — rebase onto and retarget to `main` after #202.** Its edit to `docs/architecture-and-tournament-states.md` must be applied to the already-landed #199 authority links.
9. **#204 — rebase onto and retarget to `main` after #203.** Resolve `docs/quality/risk-register.md` against the landed #198 content, preserving both the tag findings and `CI-001`; rerun Database parity on the final head.
10. **#205 — rebase onto and retarget to `main` after #204.** It must remain a modification of #202's build plan, not a new independent file, and its parent/child links must be rechecked against the final tree.

## 9. Retarget/rebase actions after each merge

| After merge | Required follow-up |
| --- | --- |
| #194 | none for the platform stack |
| #198 | refresh #199 from current `main`; prepare #200 to carry the updated ops inventory through its rename; note collisions for #202/#204 |
| #199 | retarget/rebase both sibling PRs #200 and #201 to `main` |
| #200 | no base change for #201; ensure the later #202 rebase includes the new `docs/ops/` paths |
| #201 | retarget/rebase #202 to `main`, now including both sibling results |
| #202 | retarget/rebase #203 to `main` |
| #203 | retarget/rebase #204 to `main` |
| #204 | retarget/rebase #205 to `main` |
| #205 | the open stack is resolved; only then may the first surface-migration branch start from clean `main` |

## 10. Gate for the first surface migration

The `homeDashboard.ts` migration must **not** begin from any open stack head. Its start condition is:

- the selected PRs above have landed in the intended order;
- superseded PRs are dispositioned by the owner;
- `main` is clean and all required checks are green;
- the final competition-context engine and planning authority are present on `main`.

Until then, Part 3 is blocked by design.
