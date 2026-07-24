# Repeat verification audit — 24 July 2026

> **Audit designation:** `2026-07-24R`
>
> Repeat audit under `audit-prompt.md` § *Repeat-audit and quality-baseline controls*. It does not supersede `2026-07-23-full-audit.md`, `2026-07-23-repeat-verification-audit.md` (`2026-07-23R`) or `2026-07-23-live-environment-audit.md` (`2026-07-23L`), all of which remain immutable evidence.
>
> **No code, migration, schema, deployment or configuration change was made.**

---

## 1. Audit identity

| Field | Value |
| --- | --- |
| Designation | `2026-07-24R` |
| Date | 2026-07-24 |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Branch / commit SHA | **Not determinable** — source archive carried no `.git`. See `L-1`. |
| Prior audits reviewed | `2026-07-23-full-audit.md`; `2026-07-23R`; `2026-07-23L` |
| Governance docs read first | `current-status.md`, `feature-baseline.md`, `risk-register.md`, `deferred-decisions.md`. **`docs/quality/README.md` could not be read — it no longer exists.** See `DOC-004`. |
| Hosted systems inspected | **None.** No Supabase, Netlify, GitHub or deployed-site access. |

### 1.1 Change since `2026-07-23R`

This is a materially different repository. Structural deltas:

| Measure | `2026-07-23R` | `2026-07-24R` |
| --- | ---: | ---: |
| Supabase migrations | 20 | **35** |
| Database (pgTAP) test files | 0 | **12** |
| Vitest test files | 42 | **57** (56 executed, 1 environment-gated) |
| Executed test cases | 335 | **434 passing, 15 skipped** |
| CI workflows | 0 | **2** (`ci.yml`, `database-parity.yml`) |
| Node runtime pin | none | `.nvmrc`, `engines`, Actions, `netlify.toml` |
| Deployment contract gate | none | `config/deployment-contract.json` + two prebuild validators |
| `src/` lines | 17,167 | 17,760 |
| Routes | 25 (`path=`) | 25 — unchanged |

This is a large, disciplined remediation programme, not incremental drift.

---

## 2. Executed checks

| # | Command | Result |
| --- | --- | --- |
| C-1 | `npm ci` | ✅ 136 packages from lockfile, 10s |
| C-2 | `npx tsc -b` | ✅ exit 0 — see § 2.1 caveat, unchanged from `2026-07-23R` |
| C-3 | `npx oxlint` | ✅ 0 errors, 0 warnings, 230 files, 95 rules |
| C-4 | `npm run build` (incl. `prebuild` guards) | ✅ both validators passed, built in 1.51s; `dist/` 1.5 MB, 186 kB gzip total; entry chunk 212.85 kB (67.24 kB gzip), **down from 251.52 kB** |
| C-5 | `npx vitest run` | ✅ **434 passing, 15 skipped, 0 failing** across 57 files — see § 2.2 |
| C-6 | `npm audit` | ✅ 0 vulnerabilities, 181 dependencies |
| C-7 | `node scripts/check-fixtures.mjs` | ✅ 11 predicted-group-order fixtures validated |

### 2.1 The type-check caveat still stands

`tsconfig.app.json` still sets no `strict`, `strictNullChecks` or `noImplicitAny`. A green `tsc -b` continues to prove much less than it appears to. `TYPE-001` correctly remains open.

### 2.2 Test-run detail — one environmental failure, correctly diagnosed

On first run, `tests/scripts/envFileHygiene.test.ts` reported **8 failures**. All eight were `git check-ignore` failing because the audited archive contains no `.git` directory. After `git init` + `git add -A`, the same file passes 8/8 with no source change.

**The true result is 434 passing, 0 failing.** However, the behaviour itself is a finding — see `TEST-003`. The suite's other environment-dependent file, `tests/database-parity/predictedGroupOrderParity.test.ts`, handles the same class of dependency correctly via `describe.skip` (its 15 tests skip unless `DATABASE_PARITY` is set). Two files, two different strategies for the same problem.

---

## 3. Repairs verified since `2026-07-23R`

Each was verified against migrations and source, not accepted from documentation.

| Finding | Verified repair |
| --- | --- |
| `SECURITY-002` | `20260723180000_entry_boundary_integrity.sql:31` — `revoke update, delete on table public.entries from public, anon, authenticated`. A privilege-level fix, stronger than the trigger I recommended. |
| `SECURITY-001` / `DATA-001` | Same migration, lines 40–52: `predicted_group_positions` becomes `select`-only for `authenticated`, with insert/update/delete revoked. Positions are server-derived. |
| `DATA-003` | 25 `validate_*_scope` references establishing same-tournament trigger validation via private `SECURITY DEFINER` helpers. |
| `DATA-002` | `20260723183000_knockout_result_lifecycle.sql:40–53` adds `result_state`, `result_method`, 90/120-minute and penalty scores, `winner_team_id`, `result_version`, `confirmed_at`, `corrected_at`, `last_result_reason`. Comprehensive. |
| `REL-003` | `PredictionsProvider.tsx:277` `flushDebouncedSaves()`, called at line 526 before the submit RPC. Exactly the gap I identified. |
| `REL-004` | `replace_predicted_progression` RPC wired at `src/services/supabase/progression.ts:93`. |
| `DATA-005` | `delete_match_prediction` RPC wired at `src/services/supabase/predictions.ts:122`. |
| `OPS-004` | Node `22.22.2` pinned in four places, with alignment test coverage. |
| `REPO-002` | `.gitignore` now `.env`, `.env.*`, `!.env.example`, plus backup-artifact patterns — with executable `check-ignore` coverage. |
| `OPS-005` | Correctly investigated and **superseded by `OPS-002`**: production does not hold an untracked role column; the historical cutover log was inaccurate. `docs/ops-admin-bootstrap.md` was rewritten to prohibit the old grant. This is the right outcome and the right disposition. |
| `TEST-001` | Substantially addressed: 12 pgTAP files, disposable Supabase in CI, TS↔SQL parity harness. Correctly held **Partially resolved** pending browser E2E. |

The register's discipline of holding repository-implemented fixes **open** until production is verified is correct and should not be relaxed.

---

## 4. New findings

### `DOC-004` — the quality governance charter has been deleted

**Severity:** Medium · **Confidence:** Confirmed · **Category:** Documentation / Governance

`docs/quality/README.md` no longer exists. It previously defined the source-of-truth hierarchy, the finding workflow, the finding-ID prefix registry, **severity definitions**, **status definitions**, evidence requirements, resolution requirements, regression/repeat-audit review rules, review frequency and prohibited content.

`docs/quality/audit-prompt.md:955` still instructs every repeat auditor to *"read `docs/quality/README.md`, `current-status.md`, `feature-baseline.md`, `risk-register.md` and `deferred-decisions.md` before inspecting implementation."* That control is now unsatisfiable. I could not comply with it during this audit.

Nothing else in the repository defines what `Critical` versus `High` means, or what evidence `Resolved` requires. The register's eight-line "Register rules" section is a partial substitute at best. Prohibited-content rules — no credentials, no personal data, no production logs in `docs/quality/` — have no current home at all, which matters now that reconciliation notes routinely carry hosted evidence.

**Recommended fix:** restore the charter, updated for the `reconciliations/` and `history/` directories that did not exist when it was written. A restored draft accompanies this audit.
**Validation:** the file exists, `audit-prompt.md` § repeat-audit item 1 is satisfiable, and severity/status/resolution definitions are stated once.

### `DOC-005` — the live feature baseline has lost its stable identifiers

**Severity:** Medium · **Confidence:** Confirmed · **Category:** Documentation / Governance

`feature-baseline.md` was rewritten from **96 rows carrying stable IDs** (`FEAT-001`…`FEAT-044`, `PLAN-001`…`PLAN-008`, `SAFE-001`…`SAFE-044`) to **60 rows carrying none**. The `Last verified`, `Validation evidence` and `Regression notes` columns are gone. The previous version is preserved at `history/feature-baseline-2026-07-23R.md`, so no evidence is lost — but the *live* control is weakened.

The new document is genuinely more readable and better organised by domain. The problem is functional: `audit-prompt.md` § repeat-audit item 3 requires comparing "every feature and safeguard against `feature-baseline.md` to detect silent removal, loss of reachability, weakened enforcement or scope drift", and item 4 requires reusing original IDs. Row-by-row diffing across audits needs identifiers. Without them, a future auditor comparing 60 prose rows against a previous 60 prose rows cannot reliably distinguish a reworded row from a removed capability — which is precisely the failure mode the baseline exists to prevent.

**Note on scope:** the 96→60 reduction is *not* by itself evidence of feature loss. Several old rows were consolidated and several described safeguards now covered by executable tests. But that judgement cannot currently be audited, which is the point.

**Recommended fix:** re-attach the archived IDs to the current rows and record explicitly which archived IDs were consolidated, superseded or intentionally retired. **I have deliberately not attempted this remap** — it requires knowledge of which consolidations were intended, and guessing at 60 mappings would manufacture false traceability. This is owner work.
**Validation:** every current row carries an ID; every archived ID is either present, or listed with a recorded disposition.

### `TEST-002` — the database-parity gate filters on a path that does not exist

**Severity:** Medium · **Confidence:** Confirmed · **Category:** Testing / CI

`.github/workflows/database-parity.yml` triggers on changes to:

```
.github/workflows/database-parity.yml
fixtures/predicted-group-order.json
scripts/database-parity/**        ← does not exist
src/domain/tournament/**
supabase/**
tests/database-parity/**
```

`scripts/database-parity/` is absent from the repository. The real rollout SQL lives in **`scripts/database-rollout/`** — `production-preflight.sql`, `post-rollout-verification.sql`, `production-baseline-1-20-verification.sql`, `managed-schema-customizations.sql`, `production-backup-inventory.sql`, `create-production-backup.sh` — and **none of those paths triggers the workflow.**

Compounding this, `ci.yml` does not run the pgTAP suite at all; database assurance lives exclusively in the paths-filtered workflow. So a pull request that modifies the production preflight or post-rollout verification SQL — the exact artefacts guarding the pending migrations 21–35 rollout — receives no database verification whatsoever.

A quality gate that silently does not fire is more dangerous than an absent one, because the green check is read as assurance.

**Recommended fix:** replace `scripts/database-parity/**` with `scripts/database-rollout/**`, and add `config/deployment-contract.json`. Consider `workflow_dispatch` plus a required-check setting so the rollout window cannot proceed on a stale pass.
**Validation:** a no-op edit to a `scripts/database-rollout/` file triggers the workflow.

### `TEST-003` — one test file hard-fails outside a git work tree

**Severity:** Low · **Confidence:** Confirmed · **Category:** Testing

`tests/scripts/envFileHygiene.test.ts` shells out to `git check-ignore` and throws when the command fails, including when it fails because there is no repository. All 8 tests fail in any git-less checkout — source archives, some container builds, vendored copies. CI is unaffected (`actions/checkout` provides `.git`).

The impact is on audit and triage: a suite reporting 8 failures invites investigation of a defect that does not exist, and — worse — could mask a genuine regression in the same file behind assumed environmental noise.

**Recommended fix:** detect the absence of a git work tree and skip with an explicit reason, matching the `describe.skip` pattern already used by `tests/database-parity/`.
**Validation:** the suite reports 0 failures and an explicit skip in a git-less checkout, and still fails on a genuinely committable `.env.production`.

### `DOC-006` — archived evidence has broken relative links

**Severity:** Low · **Confidence:** Confirmed · **Category:** Documentation

A link check across all repository Markdown found **53 broken internal links, all inside `docs/quality/history/`**. `risk-register-2026-07-23R.md` (50) and `feature-baseline-2026-07-23R.md` (3) were moved down one directory level without adjusting relative paths: they point at `audits/…` and `risk-register.md`, which now resolve to `docs/quality/history/audits/…`.

**The live documentation set has zero broken links** — a good result worth stating.

**Recommended fix:** prefix the affected targets with `../`.
**Validation:** a link check reports zero broken links repository-wide.

---

## 5. Corrections required to the current risk register

Two entries state something the repository contradicts. Both are factual corrections, not new risks.

### 5.1 `HYGIENE-001` — the asset is present and locatable

The register records: *"Open — original referenced asset not yet identified; common `vite.svg` scaffold paths are absent. Do not delete by assumption."*

**`src/assets/vite.svg` exists in this snapshot.** It is the exact path named in the original 23 July audit and re-confirmed in `2026-07-23R`. It has no import anywhere in `src/`, `index.html` or `public/`.

The caution about not deleting by assumption is sound practice, but the stated basis is wrong. The entry should record the confirmed path so the item can actually be closed.

### 5.2 `DOC-001` — should not be `Resolved`

The register records `DOC-001` as *"Resolved by active documentation authority/reconciliation process."*

Resolving a documentation-consistency finding by citing a *process* rather than evidence of consistency does not meet the resolution bar — and a live counter-example exists. `docs/test-script.md` still reads:

> *"Prerequisite (added 2026-07-22): UI/CRO audit Batch A has shipped (build-todo § UI/CRO audit follow-ups — mobile physics: viewport-fit, 16px inputs, 44px chevron, contrast, theme-color)."*

`docs/build-todo.md` was rewritten on 24 July and contains **no "UI/CRO audit follow-ups" section and no "Batch A" or "Batch C"**. The test script also frames itself as the "Phase 2 exit gate", a phase model the current roadmap and status document have superseded — the current gate is the migrations 21–35 production rollout.

The reconciliation process is genuinely working, and the roadmap and build-todo rewrites are excellent. But `test-script.md` was missed, which is exactly what `DOC-001` tracks.

**Recommended disposition:** reopen as **Partially resolved**. A corrected `test-script.md` accompanies this audit.

---

## 6. Positive findings

1. **The remediation programme is real and verifiable.** Every claimed repair I spot-checked was present in code or migrations, implemented at the correct layer, and often stronger than recommended (privilege revocation rather than triggers).
2. **The register's production/repository distinction is exemplary.** Holding `DATA-001`, `SECURITY-001`, `SECURITY-002`, `DATA-002` and others **open** because production has not received them — while documenting that development passes — is precisely correct and resists the temptation to bank a fix early.
3. **`OPS-006` is well handled.** A live application/database mismatch was found, contained by a fail-closed prebuild gate rather than a rushed migration, and documented with an explicit prohibition on raising the production contract to make a build pass.
4. **The deployment contract design is sound.** `validate-deployment-contract.mjs` always checks repository migration count against the contract, and skips only the *hosted* comparison outside Netlify — fail-closed where it matters, non-obstructive locally.
5. **`OPS-005` was disproved honestly.** The finding was investigated against production, found not to hold, correctly marked superseded rather than quietly deleted, and the inaccurate cutover log was corrected.
6. **Scoring parity holds for a third consecutive audit** — doc, TypeScript config and SQL agree on every value.
7. **Documentation authority is now explicit.** `AGENTS.md`, `CLAUDE.md` and `current-status.md` all state the same evidence hierarchy, and `docs/history/` archives superseded long-form documents rather than deleting them.
8. **Bundle size improved** while the codebase grew — entry chunk 251.52 kB → 212.85 kB.

---

## 7. Feature-baseline comparison

Compared against `feature-baseline.md` (60 rows) and, where identity was needed, `history/feature-baseline-2026-07-23R.md` (96 rows).

- **Regressions detected: 0.** Routes unchanged at 25; no capability lost reachability; no safeguard weakened. Every safeguard change observed was a strengthening.
- **Governance regression: 1** — loss of stable IDs from the live baseline (`DOC-005`). This is a control regression, not a feature regression.
- Formerly-absent safeguards now present: repository CI quality gate (`SAFE-025`), database/RLS integration test layer (`SAFE-026`, partial), pinned application runtime (`SAFE-041`), semantic bottom navigation (`SAFE-042`), editor baseline (part of `SAFE-044`).
- Still absent: browser end-to-end test layer (`SAFE-027`), current-data refresh strategy (`SAFE-023`), generated Supabase types and strict TS (`SAFE-024`), administrator authorisation model (`SAFE-032`), proven production restore (`SAFE-033`).

---

## 8. Unknowns and limitations

| ID | Limitation |
| --- | --- |
| `L-1` | **No version-control metadata.** No `.git` in the archive, so branch and commit SHA could not be captured and the release-control baseline `51c87e6e…` could not be confirmed. This was raised at `2026-07-23R` and recurs. **Future audits must run against a clone.** |
| `L-2` | **No hosted access of any kind** — no Supabase (development or production), Netlify, GitHub or deployed site. Every production and hosted-development claim in `current-status.md` is carried forward on the owner's evidence, not independently verified here. |
| `L-3` | **The pgTAP suite was not executed.** The 12 database test files were read but not run; that requires a local Supabase stack. Their *existence and CI wiring* is verified; their *pass state* is not. |
| `L-4` | **The 15 database-parity tests were skipped**, as designed, because `DATABASE_PARITY` was unset. |
| `L-5` | **No browser, accessibility or performance measurement.** All UI, `A11Y-*` and `PERF-*` positions are carried forward. |
| `L-6` | **`docs/quality/README.md` could not be read** because it does not exist, so this audit could not verify its own compliance against the project's own severity, status and evidence definitions (`DOC-004`). |
| `L-7` | Migration *content* was inspected for the specific repairs listed in § 3; migrations 21–35 were **not** exhaustively reviewed line by line. |

---

## 9. Verdict

| Area | Position |
| --- | --- |
| **Repository development** | **Safe to continue controlled development.** Materially stronger than at `2026-07-23R`: 35 migrations, 12 pgTAP files, two CI workflows, a fail-closed deployment contract, 434 passing tests, zero vulnerabilities. |
| **Production** | **Not safe for a real scored competition — unchanged.** `OPS-006` (live application/database mismatch) is correctly contained but not resolved. Four originally-Critical integrity findings remain open *in production* despite being repaired in the repository. |
| **Quality governance** | **Degraded, and this is the notable new concern.** The charter defining severity, status and resolution standards is gone (`DOC-004`); the live baseline has lost the identifiers its regression control depends on (`DOC-005`); a CI gate filters on a non-existent path (`TEST-002`); and `DOC-001` and `HYGIENE-001` carry statements the repository contradicts. The engineering improved substantially while the system that measures the engineering weakened. |
| **Regression position** | **No feature or safeguard regression.** One governance-control regression. |

**Overall:** *Safe to continue development; not production-ready; repair the governance layer before the next remediation batch, so that batch can be measured.*

---

## 10. Recommended next actions

Ordered by risk-per-unit-effort. All five are documentation or configuration; none touches application code, and none should be bundled into the production rollout window.

| Priority | Action | Finding | Effort |
| --- | --- | --- | --- |
| 1 | Fix the `database-parity.yml` path filter — `scripts/database-rollout/**`, not `scripts/database-parity/**` | `TEST-002` | XS |
| 2 | Restore `docs/quality/README.md` | `DOC-004` | XS (draft supplied) |
| 3 | Correct `HYGIENE-001` and reopen `DOC-001`; apply the corrected `test-script.md` | § 5 | XS (supplied) |
| 4 | Re-attach stable IDs to `feature-baseline.md` | `DOC-005` | S — **owner work, not delegable to an auditor** |
| 5 | Fix relative links in `docs/quality/history/`; make `envFileHygiene` skip without git | `DOC-006`, `TEST-003` | XS |

Action 1 matters most and is the smallest. The production rollout sequence in `current-status.md` depends on `scripts/database-rollout/` SQL that currently receives no automated verification — that gate should be firing before, not after, the approved migration window opens.

**Next audit baseline:** `2026-07-24R`, with the § 8 limitations attached. The next audit should run against a git clone with hosted access, and should execute the pgTAP suite, so `L-1` through `L-4` can be closed.
