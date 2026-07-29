# Documentation surface audit — 29 July 2026

**Audit date:** 29 July 2026
**Repository:** `nickygregal12-cmyk/Euro-2028-Predictor`
**Audited commit:** `1fb8ffd36ad113079181829a8bcc47175c43b6da` (`HEAD` == `origin/main`, "Merge PR #197: record final contract 63 tag readiness")
**Mode:** Read-only classification. No file was moved, archived, deleted or edited. No pull request was merged, closed or approved. No tag was created, moved or deleted.
**Verified baseline used as the comparison oracle:** contract 63 — `docs/quality/current-status.md`, `docs/quality/risk-register.md`, `docs/ops-pending-migrations.md` and `docs/quality/investigations/2026-07-29-euro-2028-baseline-readiness.md` all agree that repository, development Supabase `iouzoutneyjpugbbtdem`, production Supabase `vkfnsqdyhvtwyqkisxhk`, every Netlify context and the published production application (deploy `6a6a53af58a0a500096b7cb1` from `ff633396e04eca77ed4456c5537ab361d9d259ee`) are aligned at contract 63 with 63 canonical migrations through `20260729154931_prediction_consensus_minimum_cohort.sql`.

**Files in scope:** 134 markdown files (every `*.md` outside `node_modules/` and `.git/`). Each appears exactly once in § 2.

---

## 0. Correction to the audit brief — four named documents do not exist

The brief asked for a four-document sequencing analysis over `docs/roadmap.md`, `MASTER-TODO.md`, `docs/architecture/programme-plan.md` and `docs/architecture/multi-competition-hub-build-plan.md`, and for a comparison of `docs/architecture-and-tournament-states.md` against "ADRs 0011–0013 now that they cross-reference". Treating those as hypotheses and checking them in this session:

| Named artefact | Verified state |
| --- | --- |
| `docs/roadmap.md` | **Exists.** |
| `MASTER-TODO.md` | **Absent.** Never existed — `git log --all -- MASTER-TODO.md` returns no commits. |
| `TASKS.md` (the "proposed structure") | **Absent.** Never existed in git history. |
| `docs/architecture/programme-plan.md` | **Absent.** Never existed in git history. |
| `docs/architecture/multi-competition-hub-build-plan.md` | **Absent.** Never existed in git history. |
| `docs/adr/0011`, `0012`, `0013` | **Absent.** Never existed. `docs/adr/README.md` states the series deliberately starts at 0003; the highest record present is `0010`. |
| `claude/` session-artefact directory | **Absent.** No such directory, and no equivalent committed session-artefact directory anywhere in the repository. |
| `.github/` documentation | **No markdown.** `.github/` contains five workflow YAML files only — no `PULL_REQUEST_TEMPLATE`, `CODEOWNERS` or `SECURITY.md`. |

`docs/architecture/` contains exactly one file: `acquisition-target-architecture.md`. No `git log --all --diff-filter=D -- '*.md'` deletion exists, so none of these was created and removed; the only markdown path ever seen in history and absent now is `docs/quality/reconciliations/2026-07-XX-production-backup-workflow.md`, a literal-placeholder filename later corrected to `2026-07-27-production-backup-workflow.md`.

### Where the premise comes from — and why it is a real finding

The brief's framing is not invented. There is exactly one trace of it in the repository, and it is a genuine documentation defect:

`docs/quality/investigations/2026-07-29-euro-2028-baseline-readiness.md:106`, inside a committed but **unexecuted** `git tag -a euro-2028-baseline` command, contains the annotation:

> `Superseded by the multi-competition hub direction (ADR 0011).`

So the repository contains a prepared tag message that declares the entire verified contract-63 baseline **superseded by a direction that has no committed document of any kind** — no ADR 0011, no programme plan, no hub build plan, no roadmap stage, no risk-register entry, no `current-status.md` mention. `grep` across all markdown and source finds that phrase exactly once. `git tag -l` confirms zero tags exist, so the claim has not yet been published into git metadata.

This is precisely the `DOC-001` shape ("documentation authority can drift") that `docs/quality/risk-register.md` currently records as **Resolved; reopen on contradiction**. It is a contradiction, and it is the single most consequential finding in this audit. It is reported, not resolved, per the brief's constraint.

The four-document sequencing question is therefore answered in § 5 against the four documents that **actually** assert sequencing, which are a different set.

---

## 1. Summary counts

| Classification | Count |
| --- | ---: |
| `AUTHORITATIVE` | 20 |
| `OVERLAPPING` | 8 |
| `SUPERSEDED` | 5 |
| `STALE` | 9 |
| `PARKED` | 0 |
| `ARCHIVED-CORRECTLY` | 91 |
| `OBSOLETE` | 0 |
| `UNCLEAR` | 1 |
| **Total** | **134** |

| Audience | Count |
| --- | ---: |
| `AGENT-FACING` | 29 |
| `HUMAN-FACING` | 105 |

**Why `PARKED` is empty.** No file is Euro 2028-specific, still valid, and dormant until January 2028. The nearest candidates fail the test for concrete reasons: `docs/tournament-structure.md` is actively implemented today (its re-verification banner is a live instruction, not a dormancy marker); `docs/test-script.md` is gated on an owner-run session, not a date, and carries a factually stale contract number; `DEC-002`/`DEC-011`/`DEC-012` in `docs/quality/deferred-decisions.md` are register *rows*, not files. Forcing a `PARKED` row would misdescribe all of them.

**Why `OBSOLETE` is empty.** Every file still serves either the current direction, a documented compatibility purpose, or the dated-evidence record. The five `SUPERSEDED` operational records are historical operator evidence for real production events and are explicitly protected as immutable by `docs/quality/README.md`; deleting them would destroy evidence, which is why they are `SUPERSEDED` (archive) and not `OBSOLETE` (drop).

---

## 2. Classification table

### Root

| Path | Classification | Audience | Reason |
| --- | --- | --- | --- |
| `README.md` | `STALE` | `AGENT-FACING` | Describes an environment split that no longer exists: "contract 62" repository/development, production "re-locked at contract 60", "controlled environment split is active for PR #193", "verified production release remains the PR #184 Bonus Games application". PR #193 merged and everything is at 63. |
| `AGENTS.md` | `STALE` | `AGENT-FACING` | The operating rules are current and authoritative, but § *Current baseline* asserts "aligned at contract `60`" with "exactly 60 versions through `20260729110000_predictor_cup_lint_safe_qualification.sql`" — a state that no longer exists. |
| `CLAUDE.md` | `OVERLAPPING` | `AGENT-FACING` | Self-declared "convenience summary" of **`AGENTS.md`** (named counterpart) plus `docs/quality/current-status.md`; independently restates contract 60 baseline, scoring values, architecture rules and current order, and is stale on all contract claims. |

### `docs/` top level

| Path | Classification | Audience | Reason |
| --- | --- | --- | --- |
| `docs/roadmap.md` | `OVERLAPPING` | `AGENT-FACING` | Claims "the only live execution sequence", but three other files assert sequencing: **`docs/roadmap/acquisition-readiness-roadmap.md`**, **`docs/architecture-and-tournament-states.md`** (§ 11–12) and **`docs/quality/current-status.md`** (§ *Current next batch*). Also stale: Stage 6A/6B are marked current/pending though both are production-hosted at 63. |
| `docs/build-todo.md` | `SUPERSEDED` | `AGENT-FACING` | Content fully replaced by **`docs/roadmap.md`** + **`docs/quality/current-status.md`**; survives as a five-line redirect. Deliberate and sanctioned by `AGENTS.md`, but 16 documents still cite it as if it held content. |
| `docs/architecture-and-tournament-states.md` | `OVERLAPPING` | `AGENT-FACING` | Authoritative for the tournament-state contract, but § 12 "Reconciliation with the decided build sequence" and § 11 ("this redefines the rehearsal method in `roadmap.md`") assert sequencing owned by **`docs/roadmap.md`** — contradicting its own § 5 rule that "sequencing stays in `roadmap.md`". Its § 12 target, "`roadmap.md` → Launch scope & build sequence", exists only in `docs/history/roadmap-2026-07-22.md`. |
| `docs/scoring-rules.md` | `AUTHORITATIVE` | `AGENT-FACING` | Single source for scoring and entry validity; bound to `src/domain/tournament/scoringConfig.ts` by `AGENTS.md` § *Scoring authority*. |
| `docs/tournament-structure.md` | `AUTHORITATIVE` | `AGENT-FACING` | Single source for tournament facts, third-place ranking and the R16 allocation table; its UEFA re-verification banner is a current, correctly-scoped instruction. |
| `docs/competition-structure.md` | `AUTHORITATIVE` | `AGENT-FACING` | Single source for the Original/Bonus Games separation law. |
| `docs/predictor-cup-rules.md` | `AUTHORITATIVE` | `AGENT-FACING` | Single source for Cup rules. Two defects noted, neither displacing authority: the status block still reads "Draft … concept rules v0.1, 22 July 2026" for a production-hosted competition, and it cites "`docs/roadmap.md` Stage 5 item 3" for Fan Duels, a section that no longer exists in that form. |
| `docs/design-system.md` | `AUTHORITATIVE` | `AGENT-FACING` | Single source for visual/interaction design under an explicit doc-wins rule. Broken forward reference: "Build sequencing … lives in `build-todo.md` § UI/CRO audit follow-ups (Batches A–D)" — that section now exists only in `docs/history/build-todo-2026-07-22.md`. |
| `docs/auth-plan.md` | `STALE` | `HUMAN-FACING` | Framed as a plan for work that is delivered ("implemented — one polish item open") and numbered in a retired "Phase 1 / Phase 2" scheme. Its live content — the dev auto-login mechanism — has no other home, so it needs updating rather than archiving wholesale. |
| `docs/test-script.md` | `STALE` | `HUMAN-FACING` | The friction-test method is valid and unrun, but the environment preconditions assert "production is a locked milestone target (contract 38)". |
| `docs/ops-admin-bootstrap.md` | `AUTHORITATIVE` | `HUMAN-FACING` | Single source for administrator capability assignment and revocation; the `app_metadata` model it documents is current. |
| `docs/ops-pending-migrations.md` | `OVERLAPPING` | `AGENT-FACING` | Correct and current at 63, but its hosted contract/migration facts duplicate the Baseline table of **`docs/quality/current-status.md`** row for row — two live documents asserting the same hosted truth. |
| `docs/ops-hosted-migration-rollout.md` | `SUPERSEDED` | `HUMAN-FACING` | Self-labelled "completed production rollout record" for migrations 21–35; replaced by `docs/ops-pending-migrations.md` and the dated promotion reconciliations. Not in a history directory. |
| `docs/ops-prod-cutover.md` | `SUPERSEDED` | `HUMAN-FACING` | Self-labelled "Historical record … its environment tables are a dated snapshot … (superseded)". Not in a history directory. |
| `docs/ops-production-backup-restore.md` | `STALE` | `HUMAN-FACING` | Status date 27 July; asserts "The workflow now expects the current contract-38 head". The verifier has since been aligned to 60 and the current recovery point is same-day contract-60 evidence with a 60→63 postflight. |
| `docs/ops-production-observability.md` | `STALE` | `HUMAN-FACING` | Header asserts "repository/development 44 … production locked at 38"; both wrong at 63. |
| `docs/ops-production-promotion-contract-38.md` | `SUPERSEDED` | `HUMAN-FACING` | Self-labelled "Completed 27 July 2026. Retained as historical operator evidence; do not reuse it as the current promotion checklist." Not in a history directory. |
| `docs/ops-result-entry.md` | `SUPERSEDED` | `HUMAN-FACING` | Self-labelled "Superseded for normal result entry (2026-07-27)"; its hosted-status table is a 25 July snapshot at contract 35/38. Retains residual value as the service-role/SQL reference. |
| `docs/ops-sentry.md` | `OVERLAPPING` | `HUMAN-FACING` | Sentry SDK operations overlap the Sentry delivery/verification content of **`docs/ops-production-observability.md`**. Also fully orphaned (no inbound reference from any markdown file) and carries an undated hosted claim — see § 6. |

### `docs/adr/`

| Path | Classification | Audience | Reason |
| --- | --- | --- | --- |
| `docs/adr/README.md` | `STALE` | `AGENT-FACING` | The index table lists 0003–0009 only; **ADR-0010 exists and is missing from it**, so the index no longer describes the set it indexes. Its status vocabulary and "0001/0002 never issued" rule are correct and useful. |
| `docs/adr/0003-asynchronous-incremental-scoring.md` | `AUTHORITATIVE` | `AGENT-FACING` | Single source for the decision; status line carries the measured ~354 ms evidence and defers to `DEC-009`. |
| `docs/adr/0004-maintained-entry-standings.md` | `AUTHORITATIVE` | `AGENT-FACING` | Single source; status line correctly separates the unbuilt table from the shipped contract-43 consequences. |
| `docs/adr/0005-background-jobs.md` | `AUTHORITATIVE` | `AGENT-FACING` | Single source; status line enumerates shipped versus unbuilt jobs precisely. |
| `docs/adr/0006-admin-authorisation-and-audit.md` | `AUTHORITATIVE` | `AGENT-FACING` | Single source; marked Implemented with migration and test evidence. |
| `docs/adr/0007-reference-data-caching.md` | `AUTHORITATIVE` | `AGENT-FACING` | Single source; accepted direction, unimplemented, correctly stated. |
| `docs/adr/0008-live-updates.md` | `AUTHORITATIVE` | `AGENT-FACING` | Single source; accepted direction, unimplemented, correctly stated. |
| `docs/adr/0009-product-analytics.md` | `AUTHORITATIVE` | `AGENT-FACING` | Single source; accepted direction, unimplemented, correctly stated. |
| `docs/adr/0010-bonus-games-platform.md` | `AUTHORITATIVE` | `AGENT-FACING` | Single source for the delivered Bonus Games platform decision, cited by `docs/roadmap.md`, `docs/architecture-and-tournament-states.md` § 8 and `docs/quality/audit-prompt.md`. Defect: absent from `docs/adr/README.md`, so it is unreachable from the index. |

### `docs/architecture/`, `docs/roadmap/`, `docs/audits/`

| Path | Classification | Audience | Reason |
| --- | --- | --- | --- |
| `docs/architecture/acquisition-target-architecture.md` | `OVERLAPPING` | `HUMAN-FACING` | Its component sections restate **ADRs `0003`–`0009`** in prose, one section per ADR, but without the ADRs' maintained status lines — so it reads as future intent for work that has partly shipped. See § 3.4 and § 7. |
| `docs/roadmap/acquisition-readiness-roadmap.md` | `OVERLAPPING` | `HUMAN-FACING` | A second full sequence (Phases 1–6) over the same programme as **`docs/roadmap.md`** (Stages 0–8). Also stale: Phase 3 marks league reads "in flight — draft PR #138", long merged, and Phase 6 lists "post-lock trends" and "bonus games" as future candidates though both are production-hosted. |
| `docs/audits/2026-07-27-acquisition-technical-audit.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated, self-labelled "Historical audit snapshot … Informative only". Its location outside `docs/quality/audits/` is explicitly sanctioned by `docs/quality/README.md`, though the two-audit-directory split is a taxonomy defect (§ 7). |

### `docs/history/`

| Path | Classification | Audience | Reason |
| --- | --- | --- | --- |
| `docs/history/CLAUDE-2026-07-22.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated predecessor of `CLAUDE.md` in a history directory. |
| `docs/history/build-todo-2026-07-22.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated predecessor of `docs/build-todo.md`; correctly cited by the surviving stub. |
| `docs/history/roadmap-2026-07-22.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated predecessor of `docs/roadmap.md`; sole remaining home of the "Launch scope & build sequence" section that three live documents still cite. |

### `docs/quality/` top level

| Path | Classification | Audience | Reason |
| --- | --- | --- | --- |
| `docs/quality/README.md` | `AUTHORITATIVE` | `AGENT-FACING` | Single source for the quality governance charter, source-of-truth hierarchy, finding IDs, severities and the prohibition on duplicate roadmaps. Its "Existing authoritative controls" list omits `docs/adr/`, `docs/architecture/` and `docs/roadmap/`, which is a completeness gap, not a competing authority. |
| `docs/quality/current-status.md` | `AUTHORITATIVE` | `AGENT-FACING` | The live implementation and hosted-status authority; dated 29 July, internally consistent at 63, and corroborated by the risk register, migration inventory and baseline-readiness investigation. The one qualification is its § *Current next batch*, which is sequencing (§ 5). |
| `docs/quality/feature-baseline.md` | `STALE` | `AGENT-FACING` | Pinned wholesale to contract 60: "Repository and both hosted databases have exactly 60 canonical migrations", `SAFE-054` "every Netlify context declares contract 60", `SAFE-026` "Full 60-migration rebuild", and `FEAT-050` post-lock trends classified "Documented/planned — Current Stage 6 product batch" though it is production-hosted. |
| `docs/quality/risk-register.md` | `AUTHORITATIVE` | `AGENT-FACING` | Single source for current findings; dated 29 July, rebased on contract 63, with explicit register rules separating repository, database and application closure states. |
| `docs/quality/acquisition-risk-register.md` | `OVERLAPPING` | `HUMAN-FACING` | Tracks the same underlying risks as **`docs/quality/risk-register.md`** under a parallel `ACQ-R` numbering, and disagrees on status — see § 3.5. |
| `docs/quality/deferred-decisions.md` | `STALE` | `AGENT-FACING` | Correct and dated on nine of twelve rows, but asserts "The exact contract-63 application release remains a delivery gate", and `DEC-003`/`DEC-004` both defer to "exact application publication" as a pending gate. That release is published and verified. |
| `docs/quality/audit-prompt.md` | `AUTHORITATIVE` | `AGENT-FACING` | Single source for the controlled reusable audit method, with a dated owner-directed revision note (2026-07-28) preserving comparability. |

### `docs/quality/audits/`

| Path | Classification | Audience | Reason |
| --- | --- | --- | --- |
| `docs/quality/audits/README.md` | `AUTHORITATIVE` | `AGENT-FACING` | Single source for the dated-audit filename and immutability convention. |
| `docs/quality/audits/2026-07-23-full-audit.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated baseline audit evidence at a named commit. |
| `docs/quality/audits/2026-07-23-live-environment-audit.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `2026-07-23L` evidence at a named commit. |
| `docs/quality/audits/2026-07-23-repeat-verification-audit.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `2026-07-23R` evidence; explicitly non-superseding. |
| `docs/quality/audits/2026-07-24-repeat-verification-audit.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `2026-07-24R` evidence; explicitly non-superseding. |
| `docs/quality/audits/2026-07-25-repeat-verification-audit.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `2026-07-25R` evidence; explicitly non-superseding. |
| `docs/quality/audits/2026-07-29-contract-60-full-documentation-audit.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated evidence, correct at its commit. Its conclusions are now three contracts behind — notably "`AGENTS.md` / `CLAUDE.md` Already correctly described contract 60 … No blocking contradiction" — which is exactly how a dated audit is supposed to age. Direct predecessor of this report. |

### `docs/quality/history/`

| Path | Classification | Audience | Reason |
| --- | --- | --- | --- |
| `docs/quality/history/feature-baseline-2026-07-23R.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated predecessor of `feature-baseline.md`, named per the `<document>-<audit-designation>.md` convention and cited by the live file's continuity register. |
| `docs/quality/history/risk-register-2026-07-23R.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated predecessor of `risk-register.md`, correctly named and retained as finding history. |

### `docs/quality/investigations/`

| Path | Classification | Audience | Reason |
| --- | --- | --- | --- |
| `.../2026-07-25-data-003-constraint-inventory.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `DATA-003` evidence with stated environment boundary. |
| `.../2026-07-26-data-003-acceptance-reassessment.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `DATA-003` reassessment tied to Issue #72. |
| `.../2026-07-28-contract-48-production-release.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated release-boundary evidence for a named merge. |
| `.../2026-07-28-stage-3c2-private-league-evidence.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated 250-member capacity evidence at contract 46. |
| `.../2026-07-28-stage-3c2-scale-read-recompute-evidence.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated 250-entry read/recompute evidence at contract 44; the source of the ~354 ms measurement cited by ADR-0003, `DEC-009` and `ACQ-R03`. |
| `.../2026-07-28-stage-4-secure-player-profile-evidence.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated profile-privacy evidence at contract 47. |
| `.../2026-07-29-contract60-production-promotion.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated contract-60 promotion evidence; still cited by `feature-baseline.md`. |
| `.../2026-07-29-euro-2028-baseline-readiness.md` | `UNCLEAR` | `HUMAN-FACING` | See § 4. |
| `.../2026-07-29-predictor-cup-lint-safe-progression.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated contract 59–60 lint-safety finding. |
| `.../2026-07-29-priv-001-options.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `PRIV-001` options and resolution record. |
| `.../2026-07-29-rel-008-deploy-preview-reliability.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `REL-008` evidence; correctly cited by the risk register as historical. |

### `docs/quality/reconciliations/` — all 69 files

Every file in this directory is `ARCHIVED-CORRECTLY` and `HUMAN-FACING`. Each is dated in its filename per the `YYYY-MM-DD-<workstream>.md` convention, carries a workstream/finding/PR header and an explicit evidence boundary, and is protected as immutable by `docs/quality/README.md`. None asserts live authority. Two directory-level observations, neither changing a classification, are recorded in § 7: none of the 69 has any inbound link from any markdown file, and `2026-07-24-league-options-disclosure.md` and `2026-07-25-league-options-disclosure.md` are two closure notes for the same finding (`A11Y-002`).

| Path (within `docs/quality/reconciliations/`) | Classification | Audience | Reason |
| --- | --- | --- | --- |
| `2026-07-23-atomic-bracket-persistence.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `REL-004` closure evidence. |
| `2026-07-23-database-parity-foundation.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated parity foundation/completion record. |
| `2026-07-23-entry-boundary-integrity.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated PR #9 closure evidence. |
| `2026-07-23-group-order-contract.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated group-order contract overlay, self-labelled not a replacement. |
| `2026-07-23-hosted-migration-rehearsal.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `OPS-006` rehearsal/preflight evidence. |
| `2026-07-23-knockout-bracket-tree-integrity.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `FUNC-001` closure evidence. |
| `2026-07-23-knockout-result-lifecycle.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `DATA-002` closure evidence. |
| `2026-07-23-live-audit-documentation-reconciliation.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `2026-07-23L` documentation reconciliation. |
| `2026-07-23-post-func-001-docs-reconciliation.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated post-`FUNC-001` documentation reconciliation. |
| `2026-07-23-production-migration-history-1-20.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated production migration-history proof. |
| `2026-07-23-production-rollback-boundary.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `OPS-001` boundary reconciliation. |
| `2026-07-24-app-schema-deployment-gate.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `OPS-006` deployment-gate evidence. |
| `2026-07-24-audit-control-cleanup.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated Issue #46 / PR #47 closure. |
| `2026-07-24-auth-recovery-browser-e2e.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated PR #61 browser-evidence closure. |
| `2026-07-24-authenticated-browser-e2e.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated PR #53 browser-evidence closure. |
| `2026-07-24-bottom-navigation-links.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `A11Y-003` closure evidence. |
| `2026-07-24-bracket-snapshot-conflict-browser-e2e.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated PR #55 browser-evidence closure. |
| `2026-07-24-database-parity-trigger.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `TEST-002` workflow repair. |
| `2026-07-24-editor-baseline.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `REPO-001` partial closure. |
| `2026-07-24-entry-creation-idempotency.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `REL-006` closure evidence. |
| `2026-07-24-environment-file-hygiene.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `REPO-002` ignore-policy closure. |
| `2026-07-24-feature-baseline-identifiers.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated identifier restoration; cited by the live feature baseline. |
| `2026-07-24-foreground-refresh.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `REL-005` closure evidence. |
| `2026-07-24-function-privilege-hardening.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `SECURITY-003` hardening evidence. |
| `2026-07-24-late-read-overwrite-guard.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `REL-002` closure evidence. |
| `2026-07-24-league-options-disclosure.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `A11Y-002` closure evidence; paired with the 25 July note (§ 7). |
| `2026-07-24-legacy-development-site-and-turnstile.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `OPS-008`/`AUTH-001` inspection record. |
| `2026-07-24-locked-state-browser-e2e.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated PR #56 browser-evidence closure. |
| `2026-07-24-netlify-environment-isolation.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `OPS-007` isolation evidence. |
| `2026-07-24-node-runtime-pinning.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `OPS-004` closure evidence. |
| `2026-07-24-owner-default-decisions.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated record of three owner-approved operational defaults. |
| `2026-07-24-post-merge-production-release-state.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated post-merge production release state. |
| `2026-07-24-production-recovery-readiness.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated recovery-readiness reconciliation. |
| `2026-07-24-route-transition-accessibility.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `A11Y-001` closure evidence. |
| `2026-07-24-score-clearing.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `DATA-005` closure evidence. |
| `2026-07-24-sign-out-confirmation.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `UX-004` closure evidence. |
| `2026-07-24-submission-barrier-browser-e2e.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated PR #54 browser-evidence closure. |
| `2026-07-24-submit-save-barrier.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `REL-003` closure evidence. |
| `2026-07-25-browser-route-accessibility.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `A11Y-001`/`TEST-001` browser evidence. |
| `2026-07-25-contract-35-production-promotion.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated contract-35 promotion evidence at a named commit. |
| `2026-07-25-disposable-restore-privilege-reconciliation.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated disposable-restore privilege record; no production impact. |
| `2026-07-25-final-recovery-acceptance.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated recovery-proof acceptance record. |
| `2026-07-25-golden-boot-search-availability.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `UX-002` closure evidence. |
| `2026-07-25-home-data-availability.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `UX-002` closure evidence. |
| `2026-07-25-league-hub-data-availability.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `UX-002` / PR #82 closure evidence. |
| `2026-07-25-league-options-disclosure.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `A11Y-002` / Issue #75 closure; paired with the 24 July note (§ 7). |
| `2026-07-25-match-centre-league-scope-availability.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `UX-002` / PR #85 closure evidence. |
| `2026-07-25-pending-invite-render-boundary.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `UX-001` render-boundary evidence. |
| `2026-07-25-private-league-invite-browser.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `TEST-001` browser evidence. |
| `2026-07-25-production-backup-and-repeat-audit.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated backup and `2026-07-25R` record; explicitly closes nothing requiring a restore. |
| `2026-07-25-production-operational-assurance-foundation.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated Issue #91 / PR #92 foundation record. |
| `2026-07-25-profile-data-availability.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `UX-002` closure evidence. |
| `2026-07-25-safe-user-facing-errors.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `SEC-002` closure evidence at a named merge. |
| `2026-07-26-contract-36-control-plane-repair.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated control-plane repair record at a named base commit. |
| `2026-07-26-contract-36-development-promotion.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated development promotion and preview verification. |
| `2026-07-26-contract-36-final-target-preparation.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated final-target preparation record. |
| `2026-07-26-contract-36-repository-reconciliation.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated repository-authority reconciliation. |
| `2026-07-26-sentry-operational-assurance.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated Sentry assurance record with explicit open items. |
| `2026-07-27-admin-migration-version-reconciliation.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated canonical-version reconciliation for admin authorisation. |
| `2026-07-27-contract-36-final-target-promotion.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated promotion record including the recorded approval exception. |
| `2026-07-27-contract-38-final-target-promotion.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated contract-38 promotion closure record. |
| `2026-07-27-production-backup-workflow.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated backup-workflow record; cited as Phase 5 evidence by the acquisition roadmap. |
| `2026-07-28-contract-44-production-promotion.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated contract-44 promotion with recorded owner direction. |
| `2026-07-28-contract-55-production-promotion.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated contract-55 promotion record. |
| `2026-07-29-bonus-games-browser-e2e.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `TEST-GAP-01` / PR #187 closure evidence. |
| `2026-07-29-bonus-games-production-release.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated Bonus Games release record at a named merge. |
| `2026-07-29-contract-62-post-lock-final-standings.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated PR #193 development-batch record; correctly states the then-current production boundary at 60. |
| `2026-07-29-h2h-rank-history-pgtap.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `TEST-GAP-02` / PR #189 closure evidence. |
| `2026-07-29-result-revision-content-pgtap.md` | `ARCHIVED-CORRECTLY` | `HUMAN-FACING` | Dated `RESULT-AUDIT-01` / PR #191 closure evidence. |

### `scripts/`

| Path | Classification | Audience | Reason |
| --- | --- | --- | --- |
| `scripts/seed-dev/README.md` | `AUTHORITATIVE` | `AGENT-FACING` | Single source for the dev seed script, correctly co-located with the code it documents. Minor stale reference: "every page from Phase 2 on", a retired phase scheme. |

---

## 3. `OVERLAPPING` groups

### 3.1 Sequencing — four documents

Files: `docs/roadmap.md`, `docs/roadmap/acquisition-readiness-roadmap.md`, `docs/architecture-and-tournament-states.md` (§ 11–12), `docs/quality/current-status.md` (§ *Current next batch*). Contained: `docs/build-todo.md`.

**Recommended authority: `docs/roadmap.md`.** Full analysis in § 5.

### 3.2 Agent operating rules — `AGENTS.md` and `CLAUDE.md`

`CLAUDE.md` opens by declaring itself a "Convenience summary for coding-agent sessions" and names `AGENTS.md` and `docs/quality/current-status.md` as authoritative — then independently restates the contract baseline, the full scoring table, architecture rules, hard boundaries and a four-item "Current order". Every restatement is a second place to drift, and both files have in fact drifted to contract 60 together.

Its "Current order" also disagrees with `docs/roadmap.md` in substance, not just wording: `CLAUDE.md` item 1 is "Build the post-lock consensus/trends surface … from the stable contract-60 baseline" — work that `docs/quality/current-status.md` records as production-hosted.

**Recommended authority: `AGENTS.md`** for all agent operating rules. `CLAUDE.md` should be reduced to pointers plus anything genuinely Claude-session-specific, holding no restated facts, no contract numbers and no sequence.

### 3.3 Hosted contract state — `docs/quality/current-status.md` and `docs/ops-pending-migrations.md`

Both are live, both dated 29 July, both currently correct at 63, and both assert the same five facts: repository contract and migration count, development Supabase verified state, production Supabase verified state, Netlify context declarations, and pending rollout scope. `README.md`'s authority table tries to split them ("current implementation, hosted status" versus "migration inventory and hosted applied state") but the split does not survive contact with the content.

That they agree today is not the point — `README.md`, `AGENTS.md`, `CLAUDE.md` and `docs/quality/feature-baseline.md` are the same class of restatement and they have all drifted.

**Recommended authority: `docs/quality/current-status.md`** for hosted contract facts. `docs/ops-pending-migrations.md` should keep only what is genuinely migration-inventory — the canonical filename chain, per-migration applied state and pending rollout scope — and cite `current-status.md` for the contract numbers rather than repeating them.

### 3.4 Target platform architecture — `docs/architecture/acquisition-target-architecture.md` and ADRs 0003–0009

The overlap is section-for-section:

| `acquisition-target-architecture.md` section | ADR restating the same decision |
| --- | --- |
| Reference data | `0007-reference-data-caching.md` |
| Standings | `0004-maintained-entry-standings.md` |
| Scoring | `0003-asynchronous-incremental-scoring.md` |
| Background jobs | `0005-background-jobs.md` |
| Administrator platform | `0006-admin-authorisation-and-audit.md` |
| Live updates | `0008-live-updates.md` |
| Analytics and communications | `0009-product-analytics.md` |

The material difference is that **the ADRs carry maintained status lines and the architecture document does not.** ADR-0006 is marked Implemented with migration evidence; ADR-0005 enumerates exactly which jobs shipped; ADR-0003 records the ~354 ms measurement that makes it not currently justified. The architecture document states all seven in the future tense, so a reader who finds it first learns that shipped administrator authorisation and shipped auto-submission are target direction.

It is **not fully contained**: its Objective, Principles, Preserved foundation, Security constraints, Performance acceptance direction and Implementation boundary sections have no ADR home.

**Recommended authority: ADRs `0003`–`0009`**, one decision per record, for every component decision. `acquisition-target-architecture.md` should be reduced to the cross-cutting material that is genuinely only there.

### 3.5 Risk registers — `docs/quality/risk-register.md` and `docs/quality/acquisition-risk-register.md`

Two live registers track the same underlying risks under different IDs, and they contradict each other on status:

| Underlying risk | `risk-register.md` | `acquisition-risk-register.md` | Agree? |
| --- | --- | --- | --- |
| Complete entries unsubmitted at lock | `FUNC-002` **Resolved and production-hosted** | `ACQ-R05` **In progress** | **No** |
| Whole-tournament synchronous recompute | `PERF-002` **Open pending complete-volume measurement** | `ACQ-R03` **In progress through evidence** | Roughly |
| Browser standings aggregate the scoring table | `PERF-001` **Open** | `ACQ-R02` **Open as a future scale direction** | Roughly |
| Administrator workflow least-privilege | `OPS-002` **Resolved** | `ACQ-R04` **Mitigated** | Roughly |
| Unbounded global leaderboard | not carried | `ACQ-R01` **Mitigated at the enforced cap** | n/a |

The `FUNC-002` / `ACQ-R05` pair is a direct contradiction: one register calls the same risk resolved and production-hosted, the other in progress. `ACQ-R04` also still reads "production contract 44 carries the workflow", stale at 63.

`docs/quality/README.md` legitimises both registers side by side and reserves the `ACQ-R` prefix, so this duplication is sanctioned by the charter — which is itself worth the owner's attention, since the same charter prohibits "duplicate roadmaps, backlogs, project-control systems or architecture-decision registers".

**Recommended authority: `docs/quality/risk-register.md`** as the single live register. `ACQ-R` IDs should be preserved as cross-references on the rows they map to (`docs/quality/README.md` § *Finding identifiers* already forbids renumbering), and the acquisition register retained as dated 27 July derivation evidence rather than a live parallel register.

### 3.6 Sentry and observability — `docs/ops-sentry.md` and `docs/ops-production-observability.md`

Both describe the production Sentry posture and both assert its verification. `ops-sentry.md` covers SDK, initialisation and adapter; `ops-production-observability.md` covers the operating policy, release identity, smoke and rollback — but restates the delivery-verified claim, and does so at stale contracts ("repository/development 44 … production locked at 38"). `ops-sentry.md` is additionally the only fully orphaned live document in the repository.

**Recommended authority: `docs/ops-production-observability.md`** as the observability runbook, with `docs/ops-sentry.md` retained strictly as the provider/SDK configuration reference it uniquely is, linked from the runbook and carrying no independent verification claim.

### 3.7 Also asked: `docs/quality/current-status.md` versus `docs/quality/feature-baseline.md`

**These are not genuinely overlapping, and should not be merged.** They answer different questions and `docs/quality/README.md` § *Regression and repeat-audit review* depends on the separation: `current-status.md` answers "what is true right now", `feature-baseline.md` answers "what capabilities and safeguards must never silently disappear, keyed by stable identifier". The baseline's `FEAT-*`/`SAFE-*`/`PLAN-*` register, its identifier-continuity table and its safeguard regression rules have no other home, and collapsing them into a status document would destroy the anti-regression control.

The real defect is not duplication but **drift**: `feature-baseline.md` is pinned to contract 60 throughout and classifies `FEAT-050` post-lock trends as "Documented/planned — Current Stage 6 product batch" while `current-status.md` records it as production-hosted. Both documents also restate the contract number and migration count, which the baseline does not need to do at all.

**Recommendation: keep both, distinct.** `feature-baseline.md` should carry classifications and identifiers only, and cite `current-status.md` for the contract rather than restating it.

### 3.8 Also asked: `docs/architecture-and-tournament-states.md` versus ADRs 0011–0013

**Not assessable as framed — ADRs 0011, 0012 and 0013 do not exist** (§ 0), and no cross-reference between them and the architecture document exists in either direction.

The one real ADR relationship is sound and worth recording as the model to follow: `docs/architecture-and-tournament-states.md` § 8 cites "ADR-0010 decision 3, 28 July 2026" as the canonical authority for competition-state precedence, and `docs/adr/0010-bonus-games-platform.md` § *Context* reciprocally cites the architecture document's § 12 and reconciles it with `docs/roadmap.md` Stage 5 explicitly. Each names the other and neither claims the other's subject. The overlap that does exist in the architecture document is on **sequencing** (§ 3.1), not on architecture decisions.

---

## 4. `UNCLEAR`

### `docs/quality/investigations/2026-07-29-euro-2028-baseline-readiness.md`

**Why it cannot be classified confidently.** The file behaves as two incompatible document kinds at once, and the repository's own rules point in opposite directions for each.

Evidence that it is dated evidence (`ARCHIVED-CORRECTLY`): it lives in `investigations/`, which `docs/quality/README.md` § *Source-of-truth hierarchy* item 9 designates "historical evidence only"; it is dated 29 July; it is pinned to commit `ff633396…`; and its body is verification output (CI `30473545872`, Database parity `30473545780`, Browser E2E `30473546011`, deploy `6a6a53af…`).

Evidence that it is a live control document (not archivable as-is):

1. `docs/quality/current-status.md` § *Executive verdicts* cites it as the current authority for a **pending action**: "Baseline tag readiness: **Ready.** The annotated command is prepared in the baseline-readiness investigation and remains unexecuted." An immutable evidence file is being used as the home of an open task.
2. Its § *Readiness checklist* carries a row still awaiting action — "Branch cleanup complete — PR #194 merged and deletions run: **REQUIRES OWNER VERIFICATION**". Open items belong in the risk register or GitHub Issues per `docs/quality/README.md` § *Finding workflow*.
3. Its § *Prepared annotated tag command* contains a live, parameterised, unexecuted command with an instruction to substitute `<FINAL_MAIN_SHA>` — a forward instruction, not a record of something done.
4. That same command asserts the direction contradiction in § 0: `Superseded by the multi-competition hub direction (ADR 0011)` — a claim with no supporting document anywhere in the repository.

Classifying it `ARCHIVED-CORRECTLY` would freeze an open action and an unsupported direction claim into immutable evidence. Classifying it `STALE` would be wrong: its verification content is accurate and is the corroborating source for the contract-63 baseline this audit relied on. The resolution is an owner decision about which parts are evidence and which are live — see § 6, item 1.

---

## 5. The sequencing question — answered

The brief named four sequencing documents. Two do not exist. The repository does, however, contain exactly four documents that assert sequencing, and the problem the brief describes is real.

### 5.1 What each actually claims authority over

| Document | Claimed authority (verbatim) | Unit | Scope |
| --- | --- | --- | --- |
| `docs/roadmap.md` | "The only live execution sequence" | Stages 0–8 | Whole product, foundation through launch readiness |
| `docs/roadmap/acquisition-readiness-roadmap.md` | "Planning authority for audit-derived platform work" | Phases 1–6 | Platform/operations work derived from the 27 July acquisition audit |
| `docs/architecture-and-tournament-states.md` § 12 | "Reconciliation with the decided build sequence … no resequencing of decided items, one insertion" | Items 1–7, citing "Phase 3/4/5–7" | Ordering of the state-engine work relative to games and re-cuts |
| `docs/quality/current-status.md` § *Current next batch* | Implied by the file's "only live implementation and hosted-status authority" | Numbered 1–4 | The immediate batch |

`docs/build-todo.md` is a fifth entry point but asserts nothing — it redirects to the first and fourth.

### 5.2 Where they agree

All four agree on the remaining launch-gate content: official Euro 2028 data, manual accessibility review, Auth/SMTP ownership, operational/monitoring ownership, and a full dress rehearsal before launch. All four agree those gates are not passed. `docs/roadmap.md` Stage 5 and `docs/adr/0010` also agree explicitly on Bonus Games ordering, which is the one cross-document reconciliation in the set that was done properly.

### 5.3 Where they contradict

1. **Three incompatible numbering schemes for one programme.** Stages 0–8, Phases 1–6, and § 12's items 1–7 with embedded "Phase 3/4/5–7" references. "Phase 4" means *tournament readiness* in the acquisition roadmap and *Bonus Games platform* in § 12. `docs/auth-plan.md` and `scripts/seed-dev/README.md` use a fourth, retired scheme ("Phase 1/Phase 2"). There is no mapping table anywhere.

2. **`docs/roadmap.md` contradicts `docs/quality/current-status.md` on what is done.** Stage 6 is headed "current" and lists 6A (post-lock consensus/trends, richer My-entry) and 6B (wire `calculateLeagueRank`, expose tie-break criteria) as pending. `current-status.md` records both as **production-hosted** at contract 63, and `risk-register.md` closes `POSTLOCK-001` and `LEAGUE-001` as "Resolved and production-hosted". The roadmap's Stage 4 exit and Stage 5 note also still read "production-aligned at contract 60".

3. **The acquisition roadmap contradicts delivered state twice over.** Phase 3 marks league reads "*(in flight — draft PR #138, contracts 45–46)*", merged long ago; Phase 6 lists "post-lock trends" and "bonus games" as candidates "after the foundations above are stable", though both are production-hosted. It also asserts an ordering rule — "Feature work may continue only where it does not bypass a hard gate" with Phases 3–5 ahead of Phase 6 — that the delivered history did not follow, since the Phase 6 product work shipped while `ACQ-R02`, `ACQ-R06` and `ACQ-R07` remain Open.

4. **§ 12 contradicts its own document and cites a section that no longer exists.** § 5 of the same file states "sequencing stays in `roadmap.md`"; § 12 then supplies a sequence. It sequences against "`roadmap.md` → Launch scope & build sequence", which exists only in `docs/history/roadmap-2026-07-22.md`, and § 11 asserts it "redefines the rehearsal method in `roadmap.md`" — a live document reaching into another live document's subject via an archived anchor.

5. **§ 12 item 3 versus shipped reality.** It requires the tournament-context engine be built "**before** the state-heavy re-cuts (Home phases, Matches expansion, My entry, spectator states) so they're built once, on the engine". `docs/roadmap.md` Stage 4 records those re-cuts as delivered through PRs #162, #165–#178, and the same file's own implementation-status header confirms the engine (§ 3) is "adopted design, not yet built". The stated ordering constraint was inverted in practice and no document records that as a decision.

### 5.4 Containment

- **`docs/build-todo.md` is fully contained** in `docs/roadmap.md` + `docs/quality/current-status.md`, by its own text.
- **`docs/quality/current-status.md` § *Current next batch* is fully contained** in what `docs/roadmap.md` Stage 6C ought to say — same four items (secondary states, invite trust, manual accessibility, defect closure).
- **`docs/roadmap/acquisition-readiness-roadmap.md` is substantially but not fully contained.** Its Phases 1–2 and most of 3–5 map onto `docs/roadmap.md` Stages 0–3 and 7–8. Two things are not contained: its *audit-derived backlog map* (audit item C-1/C-2/H-6 → phase), which is the only traceability from the 27 July audit to planned work, and its *exit gates* per phase, which the roadmap expresses only for Stage 4.
- **§ 12 is fully contained** in `docs/roadmap.md` as sequencing. Its non-contained value is the *rationale* for one ordering constraint (build the engine before the state-heavy re-cuts), which belongs with the architecture, not the sequence.
- **`docs/roadmap.md` is contained in nothing.** It is the only document covering Stages 0–8 end to end.

### 5.5 Recommendation

**`docs/roadmap.md` is authoritative for sequencing.** It is the only end-to-end sequence, it is already designated as such by `AGENTS.md` § *Documentation maintenance*, `docs/quality/README.md`, `docs/quality/current-status.md` § *Documentation authority* and `README.md`, and it is contained in nothing. Twenty-two documents cite it. Changing the authority would invalidate more cross-references than fixing the drift.

For the other three:

| Document | Recommended disposition |
| --- | --- |
| `docs/roadmap/acquisition-readiness-roadmap.md` | **Archive to `docs/quality/history/` as dated 27 July planning**, after lifting the two non-contained parts: fold the *audit-derived backlog map* into `docs/quality/acquisition-risk-register.md` (or the consolidated register) so audit→work traceability survives, and fold per-phase *exit gates* into the matching `docs/roadmap.md` stages. Do not delete — it is the only record of the audit-derived plan. |
| `docs/architecture-and-tournament-states.md` § 12 (and § 11's rehearsal-method sentence) | **Remove the sequence, keep the constraint.** Replace § 12 with the architectural dependency stated as a rule — "the state-heavy surfaces must consume the context engine; where they were built first, they are migration debt" — and let `docs/roadmap.md` carry the order. Move § 11's rehearsal-method redefinition into `docs/roadmap.md` Stage 7 rather than asserting it remotely. The rest of the document stays authoritative for tournament states. |
| `docs/quality/current-status.md` § *Current next batch* | **Keep, and make the containment explicit.** An immediate batch in the live status document is genuinely useful. It should be labelled as the current slice of a named roadmap stage — "Stage 6C, current slice" — so it can never disagree about ordering, only about progress. |
| `docs/build-todo.md` | Keep as a redirect only until the 16 citing documents are repaired, then archive. See § 6. |

**Prerequisite before any of this.** `docs/roadmap.md` must first be corrected to the contract-63 reality — Stage 6A and 6B closed, Stage 4/5 contract references updated — because consolidating three documents into a stale authority would propagate the staleness rather than remove it.

---

## 6. Proposed consolidation plan

Recommendations only; nothing here has been executed. Ordered by risk.

### Priority 1 — direction integrity

1. **`docs/quality/investigations/2026-07-29-euro-2028-baseline-readiness.md` — resolve the unsupported direction claim before any tag is created.** The prepared command annotates the baseline tag "Superseded by the multi-competition hub direction (ADR 0011)" and no such ADR or plan exists. Either the direction is real, in which case it needs an ADR and a roadmap position before a tag asserts it, or it is not, in which case the phrase must come out of the command. **Executing this tag as written would publish an unsupported direction claim into permanent git metadata**, which is why this is first. This is an owner decision, and it is the contradiction that reopens `DOC-001` under that finding's own reopen condition. Separately, split the file's two open items — the unexecuted tag and the "REQUIRES OWNER VERIFICATION" branch-cleanup row — out of an immutable-evidence directory into the risk register or GitHub Issues, leaving the verification record as dated evidence.

### Priority 2 — the contract-63 drift sweep

Five live documents describe contract 60 or earlier as current. Every one of them is a document that restates facts owned by `docs/quality/current-status.md`.

2. **`AGENTS.md`** — update § *Current baseline* to contract 63 and the correct highest migration. Better: replace the enumerated baseline with a pointer, since the file's own § *Documentation maintenance* already says `current-status.md` is the only live status authority. `AGENTS.md` should carry rules, not facts.
3. **`CLAUDE.md`** — reduce to pointers per § 3.2. Remove the contract baseline, the restated scoring table, and the "Current order" list.
4. **`README.md`** — rewrite § *Current position* and § *Current contract-62 development candidate* to the single aligned contract-63 state. The environment split it describes is closed.
5. **`docs/quality/feature-baseline.md`** — reclassify `FEAT-050` to production-hosted, update `SAFE-054`/`SAFE-026`/§ *Current route and data baseline* off 60, and remove the restated contract number in favour of a citation.
6. **`docs/quality/deferred-decisions.md`** — close the "exact contract-63 application release remains a delivery gate" framing in the preamble and in `DEC-003`/`DEC-004`; that release is published and verified.
7. **`docs/roadmap.md`** — close Stage 6A and 6B; correct the Stage 4 exit and Stage 5 contract references. Prerequisite for § 5.5.
8. **`docs/ops-production-observability.md`** and **`docs/ops-production-backup-restore.md`** — update the contract headers (44/38 and 38 respectively) or replace them with a citation to `current-status.md`.
9. **`docs/test-script.md`** — correct "production is a locked milestone target (contract 38)".

The pattern is the finding: **every stale document is stale because it restated a fact it did not own.** Sweeping them once without removing the restatements guarantees the next audit finds the same list.

### Priority 3 — archive what is already superseded

Five operational records self-describe as historical but sit alongside live runbooks in `docs/`, where `docs/ops-*.md` is cited generically as current procedure by `docs/quality/README.md` and `AGENTS.md`.

10. **`docs/ops-prod-cutover.md`**, **`docs/ops-hosted-migration-rollout.md`**, **`docs/ops-production-promotion-contract-38.md`** — move to a history directory (`docs/history/ops/` or `docs/quality/history/`). All three already carry "do not reuse" banners; the banners are doing work that the directory layout should do.
11. **`docs/ops-result-entry.md`** — split. Its service-role/SQL reference content is live and unique; its 25 July hosted-status table is superseded. Archive the snapshot, keep the reference.
12. **`docs/roadmap/acquisition-readiness-roadmap.md`** — archive after lifting the backlog map and exit gates, per § 5.5. Retiring the file also retires the empty `docs/roadmap/` directory, whose existence alongside `docs/roadmap.md` invites exactly this confusion.

### Priority 4 — de-duplicate live authority

13. **`docs/ops-pending-migrations.md`** — reduce to the migration chain and pending scope; cite `current-status.md` for contract numbers (§ 3.3).
14. **`docs/quality/acquisition-risk-register.md`** — merge live rows into `docs/quality/risk-register.md` preserving `ACQ-R` IDs as cross-references, and resolve the `FUNC-002`/`ACQ-R05` status contradiction on the way. Retain the file as dated derivation evidence (§ 3.5).
15. **`docs/architecture/acquisition-target-architecture.md`** — reduce to its non-ADR material and replace the seven component sections with links to ADRs 0003–0009 (§ 3.4).
16. **`docs/ops-sentry.md`** — scope to provider/SDK configuration; link it from `docs/ops-production-observability.md` so it stops being orphaned (§ 3.6).

### Priority 5 — repair the reference graph

17. **`docs/adr/README.md`** — add the missing ADR-0010 row. An index that omits a record makes that record unreachable, and ADR-0010 is the authority for a delivered production feature.
18. **`docs/build-todo.md`** — repair the 16 documents that cite it as if it held content, then archive the stub. It cannot be removed first without breaking those references.
19. **Three broken cross-references into archived content** — `docs/design-system.md` → "`build-todo.md` § UI/CRO audit follow-ups (Batches A–D)"; `docs/architecture-and-tournament-states.md` § 12 → "`roadmap.md` → Launch scope & build sequence"; `docs/predictor-cup-rules.md` → "`docs/roadmap.md` Stage 5 item 3". Each should point at `docs/history/` explicitly, or the content should be restored to a live home.
20. **`docs/predictor-cup-rules.md`** — update the status block. Rules labelled "Draft … concept rules v0.1" govern a production-hosted competition; that mislabel invites an agent to treat settled rules as provisional.
21. **`docs/auth-plan.md`** and **`scripts/seed-dev/README.md`** — retire the "Phase 1/Phase 2" references to whichever scheme survives § 5.5.
22. **The two `league-options-disclosure` reconciliations** (24 and 25 July, both `A11Y-002`) — no action needed if both record genuinely distinct closure attempts; if the later supersedes the earlier, the later should say so. Reported, not resolved, per the brief.

### Not recommended

- **Do not merge `current-status.md` and `feature-baseline.md`** (§ 3.7) — it would destroy the identifier-keyed anti-regression control.
- **Do not delete any dated audit, investigation or reconciliation.** All 91 are correctly archived and immutable by charter.
- **Do not link every reconciliation from a live document** to fix their orphan status (§ 7).

### Files needing no action

`docs/scoring-rules.md`, `docs/tournament-structure.md`, `docs/competition-structure.md`, `docs/ops-admin-bootstrap.md`, `docs/quality/README.md`, `docs/quality/current-status.md`, `docs/quality/risk-register.md`, `docs/quality/audit-prompt.md`, `docs/quality/audits/README.md`, ADRs `0003`–`0010`, all 3 files in `docs/history/`, all 7 in `docs/quality/audits/`, both in `docs/quality/history/`, 10 of 11 in `docs/quality/investigations/`, all 69 in `docs/quality/reconciliations/`, and `docs/audits/2026-07-27-acquisition-technical-audit.md`.

---

## 7. Proposed documentation taxonomy

One home per kind of content. Where today's layout differs, the divergence is named.

| Content kind | Single home | Audience | Divergence today |
| --- | --- | --- | --- |
| Agent operating rules, git/database discipline, hard boundaries | `AGENTS.md` | Agent | `CLAUDE.md` duplicates it (§ 3.2) |
| Current implementation and hosted status | `docs/quality/current-status.md` | Agent | Restated in `README.md`, `AGENTS.md`, `CLAUDE.md`, `feature-baseline.md`, `ops-pending-migrations.md` |
| Execution sequence | `docs/roadmap.md` | Agent | Three other documents sequence (§ 5) |
| Immediate batch | `docs/quality/current-status.md`, labelled as a slice of a named roadmap stage | Agent | Unlabelled today |
| Capability/safeguard inventory, stable identifiers, regression rules | `docs/quality/feature-baseline.md` | Agent | Correct home; drifted content |
| Current risks and findings | `docs/quality/risk-register.md` | Agent | Parallel `acquisition-risk-register.md` (§ 3.5) |
| Deliberately postponed decisions | `docs/quality/deferred-decisions.md` | Agent | Correct home; ADR-0003/`DEC-009` restate one verdict |
| Platform architecture decisions | `docs/adr/NNNN-*.md`, one decision per record, maintained status line | Agent | `acquisition-target-architecture.md` restates seven (§ 3.4) |
| Cross-cutting architectural principles and constraints | `docs/architecture/acquisition-target-architecture.md`, reduced | Human | Currently mixed with ADR content |
| How the app understands the tournament (states, contracts, layer laws) | `docs/architecture-and-tournament-states.md`, minus § 12 | Agent | Carries a sequence (§ 5.3) |
| Scoring and entry validity | `docs/scoring-rules.md` | Agent | None |
| Tournament facts, structure, R16 allocation | `docs/tournament-structure.md` | Agent | None |
| Competition separation law | `docs/competition-structure.md` | Agent | None |
| Individual competition rules | `docs/predictor-cup-rules.md` (Cup); `docs/competition-structure.md` § 4 (KO Predictor, LMS) | Agent | Cup status block mislabelled draft |
| Visual and interaction design | `docs/design-system.md` | Agent | Broken forward reference |
| Repeatable operational procedure | `docs/ops-<subject>.md`, live runbooks only | Human | Four completed records sit among them (§ 6.3) |
| Migration chain and per-migration applied state | `docs/ops-pending-migrations.md`, without contract restatement | Agent | Duplicates contract facts (§ 3.3) |
| Provider/SDK configuration | `docs/ops-sentry.md`, linked from the observability runbook | Human | Orphaned; restates verification |
| Audit method | `docs/quality/audit-prompt.md` | Agent | None |
| Dated audit evidence | `docs/quality/audits/YYYY-MM-DD-<scope>.md` | Human | A second audit directory exists at `docs/audits/` |
| Dated investigation evidence | `docs/quality/investigations/YYYY-MM-DD-<subject>.md`, evidence only — no open actions | Human | One file carries open actions (§ 4) |
| Dated workstream closure evidence | `docs/quality/reconciliations/YYYY-MM-DD-<workstream>.md` | Human | None |
| Superseded versions of live control documents | `docs/quality/history/<document>-<designation>.md` | Human | Four superseded ops records are not in any history directory |
| Superseded root/planning documents | `docs/history/` | Human | Correct for the three files there |
| Script usage | `README.md` co-located with the script | Agent | None |
| Active remediation work | GitHub Issues | Human | Per charter |

### Three structural notes

**The two audit directories.** `docs/audits/` holds one file and `docs/quality/audits/` holds six. `docs/quality/README.md` sanctions the split explicitly, so it is intentional, but "the acquisition technical audit lives at `../audits/`" is a rule that exists only to explain the exception. One audit directory would need no such rule.

**The `docs/roadmap.md` / `docs/roadmap/` collision.** A file and a directory with the same stem, holding two competing sequences. Retiring the directory (§ 6.12) removes the collision along with the overlap.

**The 69 orphaned reconciliations are correct.** No live document links to any of them, and that is the design: `docs/quality/README.md` places them at hierarchy level 4 as dated evidence reached by date and workstream, not by navigation. The audit brief's heuristic that "orphans are usually superseded" holds for live documents — it identified the genuinely orphaned `docs/ops-sentry.md` and the unreachable `docs/adr/0010` — but it does not apply to an evidence archive. **The one orphan that matters is `docs/adr/0010-bonus-games-platform.md`**: unlike the reconciliations it is a live authority for a delivered feature, and it is unreachable from its own index (§ 6.17).

---

## 8. Audit result

**The documentation surface is not correct for task decomposition yet.** Two classes of defect must be settled first.

1. **One direction contradiction.** A committed, unexecuted tag command declares the verified contract-63 baseline superseded by a "multi-competition hub direction (ADR 0011)" that has no document of any kind behind it. No decomposition should proceed against a baseline whose successor direction is asserted in one code block and nowhere else. This reopens `DOC-001` under its own stated reopen condition.

2. **Systematic restatement drift.** Nine live documents describe a state that no longer exists, and eight overlap another document's subject. The root cause is uniform: documents restate facts they do not own. The four-document sequencing problem the brief asked about is real — it is just a different four documents, three numbering schemes, and one document (`docs/architecture-and-tournament-states.md`) that forbids sequencing in § 5 and then sequences in § 12.

What is in good order: the ADR series (maintained status lines, one decision per record, honest about what is unbuilt); `docs/quality/current-status.md` and `docs/quality/risk-register.md` (dated, at 63, mutually consistent); and the 91-file evidence archive, which is dated, bounded, immutable and correctly placed throughout.

**No file was moved, archived, deleted or edited during this audit. No pull request was merged, closed or approved. No git tag was created, moved or deleted.**
