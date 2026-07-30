# Landed-state verification — 30 July 2026

**Purpose:** establish which proposed documentation and architecture changes are present on
`origin/main`. This document records state only. It contains no remediation instructions.

**Verification baseline**

| Field | Value |
| --- | --- |
| Reference used for every classification | `origin/main` |
| `origin/main` head | `ca0d7ae6603ec8eae43b32ede6dc2e3673f3c6c2` — *Merge pull request #199 from nickygregal12-cmyk/agent/land-adrs-0011-0018*, 30 July 2026 08:17:12 +0100 |
| Local `main` at investigation start | `01cefc741f5d1455c11f3c5ffdccbb9d054e144c` — *Paginate overall standings on contract 43 (#134)*, 27 July 2026 |
| Local-`main` staleness | **Confirmed present.** Local `main` was 25 commits behind and reported the contract-43 era. The documented hazard is real; every finding below was taken from `origin/main` after `git fetch origin main`. |
| Repository contract on `origin/main` | 63 (`config/deployment-contract.json`) |
| Pull-request state source | GitHub API `merged_at`, never `state` |
| Access limits | Repository and GitHub only. No Supabase or Netlify access, so no hosted claim in this document is independently verified. |

---

## 1 — Summary counts

| Classification | Count |
| --- | --- |
| `LANDED` | 14 |
| `PARTLY LANDED` | 4 |
| `NOT LANDED` | 29 |
| `LANDED DIFFERENTLY` | 0 |
| `UNCLEAR` | 2 |
| **Total items classified** | **49** |

Per section:

| Section | LANDED | PARTLY | NOT LANDED | DIFFERENTLY | UNCLEAR | Items |
| --- | --- | --- | --- | --- | --- | --- |
| A — Pull request status | 5 | 0 | 12 | 0 | 0 | 17 |
| B — Architecture decision records | 3 | 1 | 0 | 0 | 0 | 4 |
| C — Planning documents | 0 | 0 | 3 | 0 | 1 | 4 |
| D — Documentation consolidation | 0 | 1 | 7 | 0 | 0 | 8 |
| E — Corrections | 2 | 2 | 1 | 0 | 0 | 5 |
| F — Engineering | 2 | 0 | 4 | 0 | 0 | 6 |
| G — Repository-wide | 2 | 0 | 2 | 0 | 1 | 5 |

**Single most consequential fact:** the contract-63 baseline (PRs #193, #196–#199) has landed, and
the ADR series 0011–0018 has landed. Everything else proposed under sections C, D, E and F is
still unmerged, sitting in a nine-deep chain of stacked open pull requests (#200–#209) plus two
independent open pull requests (#206, #207).

In section A, `LANDED` means the pull request is merged and its content is therefore on
`origin/main`; `NOT LANDED` means the pull request is open and its content is absent from
`origin/main`.

---

## 2 — Section A: pull request status

Every pull request from #193 to the highest open number (#209). Determined by `merged_at`.
No pull request in this range is closed-unmerged.

| # | Title | `state` | `merged_at` | Head → base | Classification | Note |
| --- | --- | --- | --- | --- | --- | --- |
| 193 | Complete contract 63 post-lock and final standings baseline | `closed` | 2026-07-29T19:25:32Z | `agent/post-lock-final-standings` → `main` | `LANDED` | Merged. `state: closed` here means merged — the documented inversion trap. |
| 194 | Record 29 July 2026 branch inventory and disposition audit | `open` | — | `chore/branch-inventory` → `main` | `NOT LANDED` | Open against `main`. |
| 195 | Superseded: contract 60 baseline reconciliation | `open` | — | `chore/baseline-reconciliation` → `main` | `NOT LANDED` | Open, and self-titled "Superseded" while still open. |
| 196 | Resolve PRIV-001 and migration timestamp controls | `closed` | 2026-07-29T16:14:46Z | `agent/privacy-preview-timestamp-controls` → `agent/post-lock-final-standings` | `LANDED` | Merged into #193's head, which then merged to `main`; content is on `origin/main`. |
| 197 | Record final contract 63 tag readiness | `closed` | 2026-07-29T19:44:21Z | `chore/final-contract-63-tag-readiness` → `main` | `LANDED` | Merge commit `1fb8ffd3` is the `euro-2028-baseline` tag target. |
| 198 | Reconcile tagged Euro 2028 baseline | `closed` | 2026-07-30T07:16:54Z | `chore/tag-reconciliation` → `main` | `LANDED` | Added `docs/quality/investigations/2026-07-29-tag-reconciliation.md`. |
| 199 | Land ADRs 0011–0018 | `closed` | 2026-07-30T07:17:12Z | `agent/land-adrs-0011-0018` → `main` | `LANDED` | `origin/main` head. Source of every section-B pass below. |
| 200 | Group operational runbooks under `docs/ops` | `open` | — | `agent/regroup-docs-ops-only` → `main` | `NOT LANDED` | Sole proposer of the `docs/ops/` grouping (D3). |
| 201 | Build pure competition-context engine | `open` | — | `agent/competition-context-engine` → `agent/land-adrs-0011-0018` | `NOT LANDED` | Base branch is #199's now-merged head. Sole proposer of `src/domain/competition/` (F1). |
| 202 | Reframe forward documents around the platform | `open` | — | `agent/reframe-platform-forward-docs` → `agent/competition-context-engine` | `NOT LANDED` | Stacked on #201. Adds `MASTER-TODO.md` and the hub build plan. |
| 203 | Reconcile state architecture with platform ADRs | `open` | — | `agent/reconcile-architecture-adrs` → `agent/reframe-platform-forward-docs` | `NOT LANDED` | Stacked on #202. |
| 204 | Apply database parity to every domain module | `open` | — | `agent/fix-domain-parity-filter` → `agent/reconcile-architecture-adrs` | `NOT LANDED` | Stacked on #203. Sole proposer of the parity path widening (F4). |
| 205 | Add parent programme plan and reconcile engineering workstream | `open` | — | `docs/add-programme-plan` → `agent/fix-domain-parity-filter` | `NOT LANDED` | Stacked on #204. Sole proposer of `programme-plan.md` and `docs/architecture/README.md`. |
| 206 | Record true open pull-request stack and merge plan | `open` | — | `chore/stack-plan` → `main` | `NOT LANDED` | Open against `main`. Its diff **deletes** ADRs 0011–0018 relative to `origin/main`. |
| 207 | Documentation audit, consolidation, roadmap reconciliation and risk-register merge | `open` | — | `claude/documentation-audit-b2h2ch` → `main` | `NOT LANDED` | Sole proposer of most of section D/E. 25 commits behind `main`; its diff **deletes** ADRs 0011–0018. |
| 208 | Correct stale test evidence and reconcile roadmap | `open` | — | `docs/reconcile-roadmap-evidence` → `docs/add-programme-plan` | `NOT LANDED` | Stacked on #205. Sole proposer of the roadmap correction (E1). |
| 209 | Migrate Home to shared competition context with legacy parity | `open` | — | `agent/capture-home-dashboard-behaviour` → `docs/reconcile-roadmap-evidence` | `NOT LANDED` | Top of the stack, nine bases deep from `main`. |

**Requested determination for #194, #195, #198–#206:**

| Bucket | Pull requests |
| --- | --- |
| Merged (`merged_at` non-null) | **#198, #199** |
| Open | **#194, #195, #200, #201, #202, #203, #204, #205, #206** |
| Closed unmerged | **none** |

Two additional facts about section A that bear on every later section:

- **The stack is behind `main`.** Every branch from `agent/competition-context-engine` upward shows
  `D docs/quality/investigations/2026-07-29-tag-reconciliation.md` and `M
  config/deployment-contract.json` when diffed against `origin/main` — that is, they predate #198
  and would remove its content. `chore/stack-plan` (#206) and
  `claude/documentation-audit-b2h2ch` (#207) additionally show `D docs/adr/0011-…` through `D
  docs/adr/0018-…`, i.e. they would remove the ADR series that #199 landed.
- **#207 proposes a different shape from the hypothesis under test.** It moves the superseded
  runbooks to `docs/history/ops/` (a nested subdirectory), and archives
  `acquisition-readiness-roadmap.md` and `acquisition-risk-register.md` to *dated* filenames
  (`docs/history/acquisition-readiness-roadmap-2026-07-27.md`,
  `docs/quality/history/acquisition-risk-register-2026-07-27.md`). Recorded here as context only;
  it does not change any classification, because nothing in #207 is on `origin/main`.

---

## 3 — Section B: architecture decision records

| Item | Classification | Evidence | Note |
| --- | --- | --- | --- |
| B1 — ADRs 0011 to 0018 present in `docs/adr/` | `LANDED` | `git ls-tree -r origin/main -- docs/adr` lists `0011-multi-competition-platform.md`, `0012-season-predictor-rules.md`, `0013-last-man-standing-season-rules.md`, `0014-predictor-cup-season-formats.md`, `0015-commercial-and-social-model.md`, `0016-client-and-distribution.md`, `0017-brand-and-club-identity.md`, `0018-pre-launch-promotion-cadence.md`. Sizes 5,110–13,968 bytes. | All eight present and substantive, not stubs. Landed by #199. |
| B2 — `docs/adr/README.md` indexes all of them, including 0010 | `LANDED` | `docs/adr/README.md` § *Index* is a 16-row table covering 0003 through 0018 contiguously, each with a status cell. Row 0010 reads "Implemented for the Euro 2028 Bonus Games platform (contracts 49–60); multi-competition generalisation is governed by ADR 0011". | Complete. The README also records that 0001/0002 were never issued. |
| B3 — States that ADRs are superseded by status change and never archived | `PARTLY LANDED` | Present: "Update a record's status line when merged work changes its truth — an ADR describing shipped behaviour as future intent is a documentation defect"; and status vocabulary "**Superseded** — replaced by a later decision; the record is retained for traceability"; and "substantive changes to a decision get a new ADR, not a rewrite". Absent: `grep -i 'archiv'` over `docs/adr/README.md` returns **no match**. | The supersession-by-status-change half is stated explicitly. The never-archived half is only implied by "retained for traceability" — there is no prohibition on archiving, and `docs/quality/README.md` § *`history/`* does instruct archiving for "a live control document", a category an ADR is not explicitly excluded from. |
| B4 — ADR-0010 carries a status line consistent with its delivery | `LANDED` | `docs/adr/0010-bonus-games-platform.md:3` — "**Status:** Implemented for the Euro 2028 Bonus Games platform (contracts 49–60); multi-competition generalisation is governed by ADR 0011". Corroborated by `docs/roadmap.md` § *Stage 5 — Bonus competitions: complete* ("ADR-0010 B1–B7c is delivered and production-aligned") and merged PRs #184/#185. | Consistent with delivery, and correctly scopes what 0010 does *not* cover. Minor unreconciled detail: `AGENTS.md` attributes the Bonus Games programme to "contracts 49–56" where ADR-0010 says 49–60; both are defensible readings (49–56 rules, 59–60 lint-safety) and neither contradicts delivery. |

---

## 4 — Section C: planning documents

`docs/architecture/` on `origin/main` contains exactly one file:
`docs/architecture/acquisition-target-architecture.md`.

| Item | Classification | Evidence | Note |
| --- | --- | --- | --- |
| C1 — `docs/architecture/programme-plan.md` present | `NOT LANDED` | `git ls-tree -r --name-only origin/main -- docs/architecture` returns only `acquisition-target-architecture.md`. The file exists on `origin/docs/add-programme-plan` (`A docs/architecture/programme-plan.md`), the head of open PR #205. | Absent from `origin/main`. Proposed only in the #205 stack, which is four bases deep from `main`. |
| C2 — `multi-competition-hub-build-plan.md` describes itself as the engineering workstream of the programme plan | `NOT LANDED` | The file does not exist on `origin/main`. It exists from `origin/agent/reframe-platform-forward-docs` (PR #202) upward. On `origin/docs/add-programme-plan` its header does read "# Multi-competition hub — engineering workstream", "**Status:** Child engineering plan within the product programme", and a "**Parent programme:**" line whose target is `programme-plan.md` (a relative markdown link in the original, de-linked in this quotation so `tests/scripts/markdownDocumentation.test.ts` does not try to resolve a branch-only path against this directory). | The self-description exists and is correctly worded — but only on unmerged branches. Nothing on `origin/main`. |
| C3 — `docs/architecture/README.md` making the parent/child relationship discoverable | `NOT LANDED` | Not in `git ls-tree -r origin/main -- docs/architecture`. Appears as `A docs/architecture/README.md` first on `origin/docs/add-programme-plan` (#205). | Absent from `origin/main`. |
| C4 — Does either document still contain a hardcoded contract version number | `UNCLEAR` | Neither `programme-plan.md` nor `multi-competition-hub-build-plan.md` exists on `origin/main`, so the property has no value there. **Reason for `UNCLEAR` rather than an answer:** the question presupposes files that are absent from the reference branch; answering from a branch would report a state that is not `origin/main`. | Recorded for completeness, not as a classification of `origin/main`: on `origin/docs/add-programme-plan`, `programme-plan.md` contains three contract-number mentions (lines 17, 21, 226) and `multi-competition-hub-build-plan.md` contains none. All three in the programme plan are retrospective staleness assertions ("Production and repository were at contract 60 → **Stale.** … are contract 63"), i.e. deliberate historical comparison rather than a hardcoded current baseline. This observation is about a branch and must not be read as an `origin/main` finding. |

---

## 5 — Section D: documentation consolidation

| Item | Classification | Evidence | Note |
| --- | --- | --- | --- |
| D1 — Four files under `docs/history/`, each with a supersession header naming what superseded it and when | `NOT LANDED` | `docs/history/` on `origin/main` contains exactly three files, none of them the four named: `CLAUDE-2026-07-22.md`, `build-todo-2026-07-22.md`, `roadmap-2026-07-22.md`. All four target documents remain in their original live locations: `docs/ops-prod-cutover.md`, `docs/ops-hosted-migration-rollout.md`, `docs/ops-production-promotion-contract-38.md`, `docs/roadmap/acquisition-readiness-roadmap.md`. | None of the four has moved. Separately, the three files that *are* in `docs/history/` carry no supersession header — each opens straight into its original title and body. `docs/ops-prod-cutover.md` does carry an inline "> **Historical record.**" blockquote in place, which names successors but is not a `docs/history/` placement. |
| D2 — `docs/roadmap/` gone as a directory, leaving `docs/roadmap.md` unambiguous | `NOT LANDED` | `git ls-tree -r --name-only origin/main -- docs/roadmap docs/roadmap.md` returns both `docs/roadmap.md` and `docs/roadmap/acquisition-readiness-roadmap.md`. | The file/directory collision persists: `docs/roadmap` resolves to both a file and a directory. |
| D3 — The seven `ops-*.md` runbooks under `docs/ops/` | `NOT LANDED` | `git ls-tree -r --name-only origin/main -- docs/ops` returns **nothing** — the directory does not exist. All nine `ops-*.md` files sit at `docs/` top level: `ops-admin-bootstrap.md`, `ops-hosted-migration-rollout.md`, `ops-pending-migrations.md`, `ops-prod-cutover.md`, `ops-production-backup-restore.md`, `ops-production-observability.md`, `ops-production-promotion-contract-38.md`, `ops-result-entry.md`, `ops-sentry.md`. | Open PR #200 confirms which seven were intended — it renames exactly those files minus `ops-production-observability.md` and `ops-sentry.md`, and rewrites the inbound links in `README.md`, `docs/quality/README.md` and `.github/workflows/production-backup.yml`. Nothing merged. |
| D4 — `CLAUDE.md` is a pointer index, not a restatement | `NOT LANDED` | `origin/main:CLAUDE.md` is 69 lines and restates all four categories the item asks about: § *Baseline* (React 19/Vite/Supabase, both project refs, "aligned at contract 60"), § *Scoring* (the full ten-line point table: group 3, exact 5, five Jokers, positions 2 + 5, knockout 10/15/20/25/40, Golden Boot 25, group goals 40/30/20, KO Predictor 5/3/+2, LMS format), § *Architecture* (eleven rules), § *Current order* (four numbered items), § *Hard boundaries* (seven rules). | Not a pointer index. It declares "`AGENTS.md` and `docs/quality/current-status.md` are authoritative" in line 3 and then duplicates their content anyway. The duplicated baseline is also wrong for `origin/main` — it says contract 60 where the repository is at 63 — and the § *Current order* items 1 and 2 describe post-lock consensus and final-standings activation as upcoming work, both of which landed at contracts 61–63. |
| D5 — `AGENTS.md` contains a documentation map distinguishing read-first, read-when-relevant and never-read-as-truth | `NOT LANDED` | `grep -niE 'read-first\|never-read\|documentation map'` over `origin/main:AGENTS.md` returns **no match**. The nearest content is § *Authority order* (a five-item evidence-precedence list) and § *Documentation maintenance* (four bullets naming single authorities). | An authority *order* exists; a three-tier documentation *map* does not. Nothing in `AGENTS.md` designates any document as never-read-as-truth. |
| D6 — `AGENTS.md` states where the task queue lives | `NOT LANDED` | `grep -ni 'queue'` and `grep -ni 'GitHub Issues'` over `origin/main:AGENTS.md` both return **no match**. | The statement exists elsewhere — `docs/quality/README.md` § *Active and historical documents* marks "GitHub Issues — Approved active remediation work" as the only row with "Active source of implementation tasks? **Yes**" — but not in `AGENTS.md`, which is the designated read-first file ("Read this file and `docs/quality/current-status.md` before changing the repository"). The repository has 18 open issues. |
| D7 — `AGENTS.md` carries a standing rule to diff against `origin/main` | `NOT LANDED` | `grep -n 'origin/main'` over `origin/main:AGENTS.md` returns **no match**. § *Git discipline* says only "Work from current `main` on a dedicated branch." | The one place the distinction *is* enforced is machine-level, not documented as an agent rule: `scripts/check-migration-timestamps.mjs` explicitly fetches `+refs/heads/main:refs/remotes/origin/main` before comparing. This investigation independently confirmed the hazard the rule would address — local `main` was 25 commits and three contract generations stale in a fresh clone. |
| D8 — `docs/quality/README.md` and `docs/adr/README.md` each state what belongs in their area | `PARTLY LANDED` | `docs/quality/README.md`: yes, and emphatically — § *Prohibited content* ("Never store in `docs/quality/`:" followed by twelve categories including "duplicate roadmaps, backlogs, project-control systems or architecture-decision registers"), plus § *Active and historical documents* (a per-document role table) and "Do not move their content here or create competing copies". `docs/adr/README.md`: no equivalent — it states the numbering rule, the status vocabulary and the update discipline, but has no statement of what does or does not belong in `docs/adr/`. | Half the item is fully satisfied. The ADR README defines *how* a record behaves, not *what qualifies* as one. |

---

## 6 — Section E: corrections

| Item | Classification | Evidence | Note |
| --- | --- | --- | --- |
| E1 — `docs/roadmap.md` corrected: Stages 6A and 6B accurate, no contract-60 references | `NOT LANDED` | Both halves fail. (a) `docs/roadmap.md:52` still reads "…implemented, resilient and production-aligned at **contract 60**" — one contract-60 reference remains. (b) § *Stage 6 — Post-lock product experience: current* still lists 6A ("post-lock prediction consensus/trends; clearer My-entry hero and reveal state") and 6B ("wire `calculateLeagueRank` into final authoritative standings; expose the applied tie-break criteria in the UI") as pending work, while `docs/quality/current-status.md` records "Post-lock consensus — **Implemented.** Contract 61 supplies the aggregate and contract 63 gates it" and "Final standings — **Implemented in source.** Contract 62 activates the five-step order", and `docs/quality/risk-register.md` records `POSTLOCK-001` and `LEAGUE-001` as "**Resolved in tagged source**". | The roadmap describes delivered contract-61/62/63 work as upcoming. Correction is proposed only in open PR #208, which is five bases deep from `main`. |
| E2 — `acquisition-risk-register.md` merged into `docs/quality/risk-register.md`; ACQ-R02, ACQ-R06, ACQ-R07 present with a stated status | `PARTLY LANDED` | Merge: **not done.** Both files exist independently on `origin/main` (`docs/quality/risk-register.md`, `docs/quality/acquisition-risk-register.md`), and `git grep -n 'ACQ' origin/main -- docs/quality/risk-register.md` returns **zero matches** — the merge target contains no acquisition findings and no cross-reference. `docs/quality/README.md` still lists them as two separate rows and ranks them jointly at hierarchy level 6. Findings: **present with a stated status**, in the unmerged register — `ACQ-R02` "Open as a future scale direction — current 250-entry query-plan evidence is single-digit milliseconds with zero disk reads, so a maintained table is not justified at the enforced cap; review on cap increase or adverse dress-rehearsal evidence"; `ACQ-R06` "Open"; `ACQ-R07` "Open". | The three findings exist and carry statuses, so the item is not wholly absent — but they are in the wrong file, and the register that `AGENTS.md`/`README.md` point to as "Current risks" does not mention them at all. `ACQ-R06` and `ACQ-R07` carry a bare "Open" with no evidence or review-trigger text, unlike `ACQ-R02`. |
| E3 — FUNC-002 / ACQ-R05 contradiction resolved | `PARTLY LANDED` | Current state of both entries: `docs/quality/risk-register.md:40` — "`FUNC-002` \| Valid entries are not automatically submitted at lock \| **Resolved in source** \| Hosted schedule/status requires owner verification."  `docs/quality/acquisition-risk-register.md:28` — "`ACQ-R05` \| Complete entries may remain unsubmitted at lock and score zero. \| … \| In progress — idempotent database-scheduled auto-submit with immutable outcomes is deployed through contract 41; user notification/email remains pending Auth/SMTP ownership." Neither entry references the other; `grep -niE 'auto-submit\|notification\|contract 41'` over `risk-register.md` matches only the `FUNC-002` row's title text. | The hard contradiction is gone: neither register now asserts that auto-submit is unimplemented, and both are consistent with `AGENTS.md` § *Scoring authority* ("implemented through contract 41"). What remains is an unreconciled status divergence for the same control — "Resolved in source" against "In progress" — with no cross-reference stating that the difference is `ACQ-R05`'s wider notification scope. A reader consulting one register cannot tell that the other exists or why it disagrees. **Basis for `PARTLY LANDED` rather than a firm verdict:** the original contradiction's exact wording is not recorded anywhere on `origin/main`, so this assesses the present state of both entries rather than the delta from a text I could not read. |
| E4 — `TEST-GAP-01` no longer appears as an open finding, and nothing asserts Bonus Games Browser E2E coverage is absent | `LANDED` | `git grep -n 'TEST-GAP-01' origin/main -- '*.md'` returns exactly two hits, both in `docs/quality/reconciliations/2026-07-29-bonus-games-browser-e2e.md`: line 4 "**Audit finding:** `TEST-GAP-01`" and line 59 "`TEST-GAP-01` is resolved. All three delivered Bonus Games now have database-rule proof, unit coverage, authenticated desktop/phone lifecycle coverage and exact deploy-preview smoke protection." It appears in no risk register. Absence assertions: the only surviving "Bonus Games … absent as interactive browser journeys" sentence is line 11 of that same reconciliation, in past tense describing the state the work closed. `README.md:106` positively asserts current coverage: "Browser E2E covers … Account, Bonus Games, tournament-information states and Prediction Trends." | Clean. No open finding, no live absence assertion. The remaining "no browser E2E" phrases in the repository are all in dated audits from 23–25 July, which are immutable historical evidence by `docs/quality/README.md` rule. |
| E5 — Any planning document still stating a fixed test count | `LANDED` | Zero matches for `[0-9]{2,4} (tests\|test files\|passing\|pgTAP\|Vitest)` across `docs/roadmap.md`, `docs/build-todo.md`, `docs/quality/current-status.md`, `docs/quality/feature-baseline.md`, `docs/roadmap/acquisition-readiness-roadmap.md`, `docs/architecture/acquisition-target-architecture.md`, `docs/test-script.md`. Also zero matches for `\b844\b` or `144 test` anywhere in `origin/main`. | No live planning document states a fixed count. Every count that survives (335, 434, 577, 653) is inside a dated audit, reconciliation or `docs/history/` file, where a count is legitimate as point-in-time evidence rather than a live claim. |

---

## 7 — Section F: engineering

| Item | Classification | Evidence | Note |
| --- | --- | --- | --- |
| F1 — `src/domain/competition/` exists on `origin/main`, and if so which files | `NOT LANDED` | `git ls-tree -r --name-only origin/main -- src/domain/competition` returns **nothing**. `git grep -n 'domain/competition/' origin/main` returns **no reference anywhere** in code, docs or workflows. The four proposed files appear first on `origin/agent/competition-context-engine` (open PR #201): `src/domain/competition/context.ts`, `kinds.ts`, `lockState.ts`, `matchState.ts`, plus four matching test files under `tests/domain/competition/`. | Absent. **Trap worth naming explicitly:** `src/domain/competitions/` — *plural* — does exist on `origin/main` with four files (`competitionModel.ts`, `lmsSelection.ts`, `resolveCompetitionStatus.ts`, `windowFixtures.ts`). It is not the proposed engine. `git log --diff-filter=A` dates it to the Bonus Games B3/B6 commits (`00459ad`, `2376955`), and its header reads "Bonus Games platform — shared domain model (NOT logic)". A directory listing alone would misread this as landed. |
| F2 — `entryLock.ts`, `matchCentre.ts`, `matchesTab.ts`, `homeDashboard.ts` still compute phase, day shape or lock state themselves | `NOT LANDED` (all four still do) | Each still owns its own computation, and none imports a shared context. `src/domain/tournament/entryLock.ts:15` — `export function isEntryLocked(lockAt, now = new Date())` returning `now.getTime() >= new Date(lockAt).getTime()`; the file is 19 lines with zero imports. `matchCentre.ts:22` — `export function matchTemporalState(match)`. `matchesTab.ts:38` — `groupByMatchday()` mapping over `MATCHDAY_POINTS` with its own `whenOf`/`byWhen` time comparators, i.e. day shape computed locally. `homeDashboard.ts:15` — `export function homePhase(input): HomePhase` returning `'during' \| 'preSubmitted' \| 'preIncomplete'`. | Corroborated by the repository's own documentation: `docs/architecture-and-tournament-states.md:5` states "timing logic currently lives in the individual domain modules (`entryLock.ts`, `matchCentre.ts`, `matchesTab.ts`, `homeDashboard.ts`) pending the engine", and `docs/adr/0011-multi-competition-platform.md:12` repeats it. The landed ADR accurately describes the landed code. |
| F3 — `MatchTemporalState` still present and in use | `NOT LANDED` (still present and in use) | Defined at `src/domain/tournament/matchCentre.ts:12` as `export type MatchTemporalState = 'before' \| 'during' \| 'after'`, and used in three further places: `matchCentre.ts:23` (return type of `matchTemporalState`), `matchCentreLegacyBridge.ts:1,9,28` (import, field type, return type), `src/features/matches/MatchCentreScreen.tsx:10,52` (import, prop type). Live UI consumption, not a vestigial type. | `docs/adr/0011-multi-competition-platform.md:40` records the intent — "`MatchTemporalState` is superseded by the 12-state match contract in the architecture document §4" — as an accepted direction. The ADR landed; the supersession did not. `docs/adr/README.md` correctly carries 0011 as "Accepted direction — context and lock generalisation unimplemented". |
| F4 — Does the database parity workflow filter on `src/domain/**` or a narrower path | `NOT LANDED` (narrower) | `.github/workflows/database-parity.yml` § `on.pull_request.paths` lists `src/domain/tournament/**` — **not** `src/domain/**`. Full list: `.github/workflows/database-parity.yml`, `config/deployment-contract.json`, `fixtures/predicted-group-order.json`, `scripts/database-rollout/**`, `src/domain/tournament/**`, `supabase/**`, `tests/database-parity/**`, `tests/scripts/databaseParityWorkflow.test.ts`. | The narrower filter leaves a live gap on `origin/main`, not just a hypothetical one: `src/domain/competitions/` (F1) exists and contains `resolveCompetitionStatus.ts` and `windowFixtures.ts`, whose headers claim to implement architecture §3/§4/§8/§10 semantics — and a pull request touching only those files does not trigger Database parity. Widening is proposed only in open PR #204, four bases deep. |
| F5 — Does any CI check reject a migration whose timestamp is at or below the highest on `main` | `LANDED` | `.github/workflows/ci.yml:21-22` runs `npm run check:migration-timestamps` on every `pull_request` and on `push` to `main`. `scripts/check-migration-timestamps.mjs` fetches `+refs/heads/main:refs/remotes/origin/main`, derives `highestOnMain` by reduction over `git ls-tree origin/main -- supabase/migrations`, and rejects on `if (migration.timestamp <= highestOnMain)` with "…which is not above origin/main highest…". It additionally enforces strict ordering *within* the added set and rejects any filename not matching `/^(\d{14})_.+\.sql$/`. Failure sets `process.exitCode = 1`. | Fully landed, and the `<=` comparison is inclusive exactly as the item specifies. Landed via PR #196; recorded as `MIG-001` "**Resolved in repository source.** Pull-request CI rejects stale/colliding migration timestamps" in `docs/quality/risk-register.md`. This is also the only place in the repository that enforces the `origin/main`-not-local-`main` distinction. |
| F6 — `config/deployment-contract.json` agrees with the migration count | `LANDED` | `git ls-tree --name-only origin/main -- supabase/migrations/ \| wc -l` → **63**. `config/deployment-contract.json` → `"contractVersion": 63`, `"requiredMigrationCount": 63`. Highest migration filename `20260729154931_prediction_consensus_minimum_cohort.sql` matches the filename cited in the contract's `notes`. Independently corroborated by `docs/quality/current-status.md` § *Baseline* ("Repository contract | 63 canonical migrations through `20260729154931_…`"; "Deployment contract | `contractVersion: 63`; `requiredMigrationCount: 63`"). | Three-way agreement: file count, declared count, and declared version. |

---

## 8 — Section G: repository-wide

| Item | Classification | Evidence | Note |
| --- | --- | --- | --- |
| G1 — Hardcoded contract version numbers in markdown, with paths | `NOT LANDED` (hardcoding present) | `git grep -lIE '[Cc]ontract[ -][0-9]{2}' origin/main -- '*.md'` matches **62 files**, 233 total line hits. **Live / actively-read documents, with per-file hit counts:** `README.md` (7), `docs/quality/feature-baseline.md` (8), `docs/quality/risk-register.md` (6), `AGENTS.md` (5), `CLAUDE.md` (4), `docs/scoring-rules.md` (4), `docs/ops-pending-migrations.md` (4), `docs/quality/current-status.md` (3), `docs/quality/acquisition-risk-register.md` (3), `docs/quality/deferred-decisions.md` (3), `docs/roadmap/acquisition-readiness-roadmap.md` (3), `docs/adr/README.md` (2), `docs/roadmap.md` (1), `docs/competition-structure.md` (1), `docs/test-script.md` (1), `docs/adr/0004-maintained-entry-standings.md` (1), `docs/adr/0005-background-jobs.md` (1), plus all nine `docs/ops-*.md` runbooks. Clean (zero hits): `docs/quality/README.md`, `docs/architecture-and-tournament-states.md`, `docs/architecture/acquisition-target-architecture.md`, `docs/build-todo.md`. The remaining ~40 matched files are dated audits, investigations, reconciliations and `docs/history/`, where a contract number is the point-in-time record. | The material problem is not the count but the *disagreement*: on a repository at contract 63, `AGENTS.md` § *Current baseline* asserts "Repository, development Supabase and production Supabase are aligned at contract `60`" and "canonical repository migration history contains exactly 60 versions through `20260729110000_predictor_cup_lint_safe_qualification.sql`"; `CLAUDE.md` § *Baseline* asserts the same 60; `README.md:11-15` asserts "contract 62 … production Supabase and Netlify production remain aligned and re-locked at **contract 60**". All three are read-first files and all three are wrong about the repository they describe. By contrast `docs/quality/current-status.md` and `docs/quality/risk-register.md` are contract-63 aligned. |
| G2 — Markdown asserting a hosted Supabase or Netlify state without a date or verifier | `NOT LANDED` (undated assertions present) | Three live files assert hosted state with no date and no named verifier. `AGENTS.md` § *Current baseline*: "development Supabase is `iouzoutneyjpugbbtdem` and records the same 60 canonical versions"; "production Supabase is `vkfnsqdyhvtwyqkisxhk` and records the same 60 canonical versions"; "production database lint, privileges and environment isolation are verified at contract 60" — passive voice, no verifier, no date. `CLAUDE.md` § *Baseline*: "Repository, development Supabase and production Supabase are aligned at contract 60"; "The 55→60 production promotion passed encrypted backup/restore, exact dry-runs, preserved-data checks, privilege verification and hosted database lint". `README.md:11-15`: "Netlify `dev`, `branch-deploy` and `deploy-preview` declare 62 and use development Supabase"; "production Supabase and Netlify production remain aligned and re-locked at **contract 60**". | The correct pattern already exists in the same repository and is worth contrasting: `docs/quality/current-status.md` § *Baseline* carries "**Status date:** 29 July 2026" and marks every hosted row `REQUIRES OWNER VERIFICATION` — Development Supabase, Production Supabase, Netlify contexts and deploys, and hosted data preservation — then states why: "This reconciliation has no database or Netlify access, so those statements are retained as annotation/history rather than independently verified current facts." `docs/quality/risk-register.md` uses the same discipline (`Hosted baseline: REQUIRES OWNER VERIFICATION`). The three files above predate that discipline and were not brought forward with it. This investigation likewise had no hosted access and verifies none of these claims either way. |
| G3 — `euro-2028-baseline` resolves to `1fb8ffd36ad113079181829a8bcc47175c43b6da` | `LANDED` (confirmed) | `git fetch origin --tags` then `git rev-list -n1 euro-2028-baseline` → `1fb8ffd36ad113079181829a8bcc47175c43b6da`. It is an **annotated** tag: `git rev-parse euro-2028-baseline` returns the tag object `1bcb3657f17530990258d269dd0e172095268c52`, which peels to the expected commit — a distinction that would make a naive `rev-parse` check look like a mismatch. The target commit is "Merge PR #197: record final contract 63 tag readiness", 29 July 2026 20:44:20 +0100, and `git merge-base --is-ancestor` confirms it is an ancestor of `origin/main`. | Unchanged and consistent with all three places that cite it: `config/deployment-contract.json` `notes`, `docs/quality/current-status.md` § *Baseline*, `docs/quality/risk-register.md` header. Exactly one tag exists in the repository. |
| G4a — Current repository name | `LANDED` (confirmed) | GitHub API: `full_name` `nickygregal12-cmyk/Euro-2028-Predictor`, `id` 1305632191, `default_branch` `main`, `created_at` 2026-07-19T10:54:44Z, `visibility` public, `fork` false, `archived` false, 18 open issues. Matches `git remote -v` and `docs/quality/current-status.md` § *Baseline* row "Repository \| `nickygregal12-cmyk/Euro-2028-Predictor`". | Consistent everywhere. The lowercase `nickygregal12-cmyk/euro-2028-predictor` form in session tooling is case-insensitive resolution of the same repository, not evidence of a different name. |
| G4b — Whether any rename has occurred | `UNCLEAR` | No available surface answers this. The GitHub REST repository object exposes no rename history and no former-name field; renames are served transparently by redirect, so a successful lookup under any name cannot distinguish "current name" from "redirected old name". The repository `id` (1305632191) is stable across renames and so cannot detect one either. Nothing in `origin/main` records a rename: `git log --diff-filter=A` shows the repository created 2026-07-19 with `full_name` unchanged in every document that cites it. | **Reason for `UNCLEAR` rather than "no rename":** absence of a rename record in the repository is weak evidence, and the only positive test — probing a hypothesised former name for a redirect — requires knowing the former name in advance. No evidence of a rename was found; that is not the same as evidence of no rename. Determinable only from the owner's GitHub audit log. |

---

## 9 — Everything `NOT LANDED` or `PARTLY LANDED`, in the order it should be addressed

Ordering only, per the scope of this investigation. No remediation approach is proposed for any
item, and no item's position implies a method. The reason given for each position is the reason
for its *rank*, not a recommendation.

### Position 1 — The open pull-request stack's relationship to `origin/main` (A: #194, #195, #200–#209)

**Reason for first position:** this is the only item on the list whose resolution changes whether
every other item can be resolved at all. Twelve open pull requests carry essentially all of
sections C, D, E and F, and every one of them is behind `origin/main`. Two of them — #206 and #207
— currently diff as *deleting* `docs/adr/0011-…` through `docs/adr/0018-…`, the section-B work that
#199 landed this morning. Nine of them (#201–#205, #208, #209) form a single chain whose base
branches are themselves unmerged pull-request heads, so their order is not a preference but a
constraint. Anything done to items below this line either lands through one of these pull requests
or conflicts with one, which is why this position is occupied by the stack itself rather than by
any document.

### Position 2 — `AGENTS.md`, `CLAUDE.md` and `README.md` contract and hosted-state claims (G1, G2; and D4's baseline half)

**Reason for second position:** these are the three files an agent reads before touching anything,
and on a contract-63 repository all three assert contract 60 or 62 as current, with hosted Supabase
and Netlify state asserted flatly and with no date or verifier. They rank directly below the stack
because every item below them is at risk of being worked from these numbers. This position is also
where the repository is least self-consistent: `docs/quality/current-status.md` and
`docs/quality/risk-register.md` already carry the dated, `REQUIRES OWNER VERIFICATION` discipline
that these three lack, so the defect is a divergence inside the repository rather than an open
question about the outside world.

### Position 3 — `AGENTS.md` has no standing rule to diff against `origin/main` (D7)

**Reason for third position:** the hazard is demonstrated, not theoretical — this investigation
opened with a fresh clone whose local `main` was 25 commits and three contract generations stale,
the same class of error the task brief records as having previously produced a false alarm. It ranks
immediately after position 2 because it is the control that would catch a recurrence of position 2's
symptom being read from the wrong ref, and because `AGENTS.md` is already being opened for position
2. It ranks below position 2 only because a stale ref misleads an agent once, whereas a wrong
contract number in a read-first file misleads every agent every time.

### Position 4 — Database parity path filter is narrower than the domain (F4)

**Reason for fourth position:** this is the highest-ranked item that is a live gap in an *automated
guard* on code that is already merged, rather than a document defect. `src/domain/competitions/`
exists on `origin/main` and contains modules asserting architecture §3/§4/§8/§10 semantics, and the
workflow filter `src/domain/tournament/**` does not reach them — so a pull request touching only
those files silently skips Database parity today. It ranks above the remaining engineering items
because those describe work not yet started, whereas this one leaves landed code unguarded, and a
missing check reports as a pass.

### Position 5 — `docs/roadmap.md` misdescribes delivered work as pending (E1)

**Reason for fifth position:** `AGENTS.md` § *Authority order* item 4 designates
`docs/roadmap.md` as the authority for future sequence, and its § *Stage 6* still lists post-lock
consensus (6A) and final-standings activation (6B) as current work when both landed at contracts
61–63 and are recorded as resolved in `current-status.md` and the risk register. It ranks below the
read-first files because the roadmap is consulted for sequencing rather than for gating, and above
the register items because it is the document most likely to cause already-delivered work to be
started again. Its residual contract-60 reference at line 52 belongs to this position rather than to
position 2, since it is the same edit.

### Position 6 — Two unmerged risk registers, and the FUNC-002 / ACQ-R05 status divergence (E2, E3)

**Reason for sixth position:** these two items share one root cause and cannot sensibly be
separated — `docs/quality/risk-register.md` contains zero `ACQ` references, so `ACQ-R02`, `ACQ-R06`
and `ACQ-R07` are invisible from the register that `AGENTS.md` and `README.md` present as "Current
risks", and the `FUNC-002` / `ACQ-R05` divergence ("Resolved in source" against "In progress") is
only unreadable *because* the two entries live in separate files with no cross-reference. It ranks
below position 5 because both registers are internally coherent and neither now states anything
false — the defect is discoverability and reconciliation, not incorrectness. E3 sits after E2
within this position because the divergence is legible once the registers are in one place.

### Position 7 — `CLAUDE.md` is a restatement rather than a pointer index (D4, structural half)

**Reason for seventh position:** the duplication is the mechanism that produced position 2 —
`CLAUDE.md` declares `AGENTS.md` and `current-status.md` authoritative in its third line and then
re-states the baseline, the full scoring table, eleven architecture rules and a four-item order of
work, giving each of them a second place to go stale. It ranks below position 6 because its factual
errors are already counted at position 2; what remains here is only the structure that will
regenerate them. It ranks above the remaining structural items because it is the file most
frequently read of those still outstanding.

### Position 8 — `docs/roadmap` resolves to both a file and a directory (D2)

**Reason for eighth position:** highest-ranked of the purely structural items because it is the only
one that creates a genuine ambiguity rather than an inconvenience — `docs/roadmap.md` and
`docs/roadmap/acquisition-readiness-roadmap.md` coexist, so a reference to "docs/roadmap" has two
valid resolutions, one of which is a live authority and the other a superseded acquisition
document. It ranks below position 7 because the ambiguity has not yet been observed to mislead
anything, and above positions 9–11 because it affects a path that `AGENTS.md` cites by name.

### Position 9 — Superseded documents not placed under `docs/history/` with supersession headers (D1, D3)

**Reason for ninth position:** `ops-prod-cutover.md`, `ops-hosted-migration-rollout.md`,
`ops-production-promotion-contract-38.md` and `acquisition-readiness-roadmap.md` all remain in live
locations, and the nine `ops-*.md` runbooks remain at `docs/` top level with no `docs/ops/`
directory, so superseded operational records are indistinguishable by location from current ones.
The two are ranked together because #200 and #207 both move files in this space and would collide.
It ranks here rather than higher because the most dangerous of these documents already carries an
inline "> **Historical record.**" warning naming its successors, so the risk is mitigated in the
single worst case even though the structure is not. Note also that the three files already in
`docs/history/` carry no supersession header, so the convention this item asserts is not yet
established anywhere.

### Position 10 — `AGENTS.md` has no documentation map and does not state where the task queue lives (D5, D6)

**Reason for tenth position:** both are absences in the read-first file rather than errors in it, and
both have a working substitute — `AGENTS.md` § *Authority order* covers evidence precedence, and
`docs/quality/README.md` does identify GitHub Issues as the only active task source. They rank
below position 9 because an agent that follows the existing authority order reaches correct
documents by a longer route, whereas misfiled history can be read as current. They rank together
because both are edits to the same section of the same file, and D6 is the narrower of the two.

### Position 11 — The competition-context engine and its dependents (F1, F2, F3)

**Reason for eleventh position:** these are the largest items on the list and the only ones that are
*correctly documented as unbuilt* — `docs/adr/0011` is carried as "Accepted direction — context and
lock generalisation unimplemented", `docs/adr/README.md` agrees, and
`docs/architecture-and-tournament-states.md:5` names the four modules that hold timing logic
"pending the engine". Nothing in the repository currently claims this work exists, so it misleads
no one. That is precisely why it ranks last among substantive items despite being the largest: it is
a known gap under an accepted direction, not a discrepancy. F1 precedes F2 which precedes F3, since
the engine must exist before the four modules can consume it and before `MatchTemporalState` has
anything to be superseded by. `src/domain/competitions/` (plural) must not be mistaken for progress
on F1 — it is the pre-existing Bonus Games data model.

### Position 12 — Planning documents absent (C1, C2, C3) and their contract-number property (C4)

**Reason for twelfth position:** `programme-plan.md`, `multi-competition-hub-build-plan.md` and
`docs/architecture/README.md` are all absent from `origin/main`, and no landed document references
them, so nothing on `origin/main` is currently broken by their absence — there are no dangling
links and no orphaned children. They rank below position 11 because position 11 is a gap in code
that landed documents describe, whereas this is a gap in documents that nothing describes. C4 is
carried at this position because it is not answerable until C1 and C2 exist; it is `UNCLEAR` rather
than pending for that reason.

### Position 13 — `docs/adr/README.md` wording gaps (B3, D8's ADR half)

**Reason for last position:** the smallest items on the list and the only two that are partial
rather than absent. The supersession-by-status-change rule is stated; only the explicit
never-archived prohibition is missing, and the retained-for-traceability wording already points the
same way. Likewise the README defines how a record behaves without stating what qualifies as one.
Both rank last because `docs/adr/` is currently correct in practice — all sixteen records are
indexed, none has been archived, and every status line matches its delivery — so these are gaps in
stated rules rather than in observed behaviour. The one contingency worth noting for rank: the
absent never-archived rule sits alongside `docs/quality/README.md` § *`history/`*, which does
instruct archiving for live control documents and does not exclude ADRs.

---

## 10 — Method and limits

**Commands and sources used.** `git fetch origin main` and `git fetch origin --tags` before every
inspection; all file evidence read via `git show origin/main:<path>` and
`git ls-tree -r origin/main -- <path>` rather than the working tree; all searches via
`git grep origin/main`; branch comparisons via `git diff --name-status origin/main origin/<branch>`.
Pull-request status from the GitHub API, keyed on `merged_at`. Repository metadata from the GitHub
API repository object.

**Read-only compliance.** No file in the repository was created, modified, moved, archived or
deleted other than this report. No pull request was merged, closed, approved, rebased or retargeted.
No tag was created, moved or deleted. No hosted system was contacted, mutated or verified. No
defect recorded above was fixed.

**Limits on this document.**

- No Supabase or Netlify access. Every hosted claim encountered is reported as an
  assertion in a file, never as a verified fact. G2 records which assertions lack a date or
  verifier; it does not adjudicate whether any of them is true.
- Section A reflects pull-request state at the time of reading on 30 July 2026. #199 merged at
  07:17:12Z the same morning, so this state is fresh and correspondingly perishable.
- C4 and G4b are `UNCLEAR` for stated structural reasons — an absent file has no properties, and
  rename history is not exposed by any surface available here. Neither was guessed.
- E3 assesses the present state of the `FUNC-002` and `ACQ-R05` entries rather than the delta from
  the original contradiction, whose wording is not recorded on `origin/main`.
- Branch observations under C2, C4 and section A are supplementary context, explicitly marked, and
  are not classifications of `origin/main`.
