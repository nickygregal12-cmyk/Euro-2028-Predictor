# Repeat verification audit — 23 July 2026

> **Audit designation:** `2026-07-23R`
>
> This is a **repeat audit** under the controls in [`../audit-prompt.md`](../audit-prompt.md) § *Repeat-audit and quality-baseline controls*. It does **not** replace or supersede the baseline [`2026-07-23-full-audit.md`](2026-07-23-full-audit.md), which remains the authoritative evidence record for the original 45 findings. This report adds executed-check evidence that the baseline audit could not obtain, retests every baseline finding, and records two new findings.
>
> **No code, migration, schema, deployment or configuration change was made during this audit.**

---

## 1. Audit identity and scope

| Field | Value |
| --- | --- |
| Audit designation | `2026-07-23R` (repeat verification) |
| Audit date | 2026-07-23 |
| Baseline audit | [`2026-07-23-full-audit.md`](2026-07-23-full-audit.md) at `b68c4858a179adce433e01db439cabb93c6a0c01` |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Branch | Not determinable — see limitation `L-1` |
| Commit SHA | **Not determinable** — see limitation `L-1` |
| Artefact audited | Repository source archive `Euro-2028-Predictor-main.zip`, extracted to an isolated Linux container |
| Deployed site | **Not inspected** — no network access to the production domain from the audit container |
| Supabase (dev / prod) | **Not inspected** — no database access |
| Netlify | **Not inspected** — no dashboard or deploy-metadata access |

### 1.1 Snapshot-versus-baseline correspondence

The archive could not be tied to a commit SHA, but every structural counter recorded in [`../feature-baseline.md`](../feature-baseline.md) and [`../current-status.md`](../current-status.md) reproduces exactly:

| Measure | Baseline value | This snapshot | Match |
| --- | --- | --- | --- |
| Supabase migration files | 20 | 20 | ✅ |
| Test files + support files | 43 | 43 (42 test files + `tests/setup.ts`) | ✅ |
| `path=` route declarations in `src/App.tsx` | 23 production + catch-all + 1 dev-only | 25 total, decomposing identically | ✅ |
| `package.json` version | `0.0.0` | `0.0.0` | ✅ |
| Unit/component test cases | ~326 static / 335 reported | **335 executed** | ✅ |

**Conclusion:** the snapshot is materially identical to the audited baseline commit. No feature, safeguard, route or migration has been added, removed or renamed. **No regression against `feature-baseline.md` was detected**, and no baseline entry required a status downgrade.

---

## 2. Executed checks — the principal new evidence

The baseline audit recorded build, lint, type-check, test and dependency-vulnerability results as *"not independently executed"*. All five have now been executed in a clean container from the committed lockfile.

| # | Command | Result | Trustworthy? | What it does **not** cover |
| --- | --- | --- | --- | --- |
| C-1 | `npm ci --no-audit --no-fund` | ✅ 136 packages installed from `package-lock.json` in 11s; no peer or resolution errors | Yes — install is fully reproducible from the committed lockfile | Node/npm runtime is unpinned (`OPS-004`); this ran on Node v22.22.2 / npm 10.9.7, which is **not** proven to match Netlify's build image |
| C-2 | `npx tsc -b` | ✅ Exit 0, zero diagnostics | **Partially.** See § 2.1 | `strict`, `strictNullChecks` and `noImplicitAny` are all absent from `tsconfig.app.json`, so this proves far less than a green type-check normally would |
| C-3 | `npx oxlint` | ✅ 0 errors, 0 warnings across 211 files, 95 rules | Yes, as far as it goes | 95 rules is a modest rule set; no type-aware linting, no React-hooks exhaustive-deps enforcement observed, no accessibility lint plugin |
| C-4 | `npx vite build` | ✅ Built in 1.80s; `dist/` = 1.5 MB; largest chunk `index-*.js` 251.52 kB (80.53 kB gzip); every leaf route emitted as a separate chunk | Yes | Build success is not runtime correctness; no browser was exercised |
| C-5 | `npx vitest run` | ✅ **42 files / 335 tests, all passing**, 63.88s | Yes for what is tested — see `TEST-001` | Zero database, RLS, RPC, policy, trigger or browser-journey coverage |
| C-6 | `npm audit --json` | ✅ **0 vulnerabilities** across 181 resolved dependencies (20 prod, 162 dev, 51 optional, 11 peer) | Yes, at audit date | Reflects the advisory database at audit time only |

### 2.1 Important qualification on the green type-check (`C-2`)

`tsconfig.app.json` contains no `strict` flag and none of the individual strict-family flags. The enabled options are limited to `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly` and `noFallthroughCasesInSwitch`.

**A passing `tsc -b` therefore does not demonstrate null-safety or absence of implicit `any`.** Combined with the absence of generated Supabase database types and the hand-written casts on RPC responses, the type layer provides materially weaker protection than the clean result implies. This is confirming evidence for `TYPE-001`, not a new finding, but it directly limits how much assurance checks `C-2` and `C-4` can carry.

### 2.2 Build-output security observations (new positive evidence)

| Check | Result |
| --- | --- |
| Source maps in `dist/` | **None emitted** — no `.map` files |
| Supabase project references or hostnames baked into `dist/assets/*.js` | **None found** — the client reads them from environment variables at runtime |
| Committed `.env` files | **None** — only `.env.example` |
| `dangerouslySetInnerHTML` usage | **None** — confirms `SAFE-015` |
| `TODO` / `FIXME` / `HACK` markers in `src/`, `scripts/`, `tests/` | **One**, a legitimate forward-reference: `src/domain/tournament/homeDashboard.ts:84` `TODO(rank_history)` |

---

## 3. Retest of the 45 baseline findings

Every baseline finding was retested against this snapshot. **All 45 still reproduce.** None is resolved, none is a false positive, none has been silently repaired.

### 3.1 Critical — all four confirmed still open

| ID | Retest evidence at this snapshot | Outcome |
| --- | --- | --- |
| `DATA-001` | `grep -rn "predicted_group_positions" src/ tests/` returns **zero** matches. The only non-SQL reference in the whole repository is `scripts/seed-dev/index.ts:198`, a reset-table list. The table is created at `supabase/migrations/20260719120000_init_v0_1.sql:165` and scored at `20260721120000_scoring_positions_knockout_awards.sql`. There is still **no client read or write path**, so §2 group-position points can only ever score zero for a real user. | **Still open — Confirmed** |
| `SECURITY-001` | Policy `own predicted_group_positions` at `20260719120000_init_v0_1.sql:245` is `for all to authenticated` with a symmetric `using`/`with check` on entry ownership. `20260719170000_lock_and_leaderboard.sql` creates lock triggers on exactly four tables — `match_predictions`, `predicted_tie_resolutions`, `predicted_progression`, `bonus_predictions` — and `20260722120000_write_integrity.sql` adds `version` columns and version triggers to only three. `predicted_group_positions` appears in **neither**. | **Still open — Confirmed** |
| `SECURITY-002` | `entries.submitted_at` remains an ordinary nullable `timestamptz` (`init_v0_1.sql:137`) under policy `own entries` (`:228`), `for all to authenticated`, `using (user_id = auth.uid())`. No column-level grant restriction and no trigger guards the transition. A direct PostgREST `PATCH` on `entries` still bypasses every check in `submit_entry()`. | **Still open — Confirmed** |
| `DATA-002` | `create table matches` (`init_v0_1.sql:99–120`) holds `home_score` and `away_score` only. No `winner_team_id`, `result_method`, extra-time or penalty columns. `grep "alter table matches"` across all 20 migrations returns only the `enable row level security` statement. A penalty-decided knockout tie still cannot be represented. | **Still open — Confirmed** |

### 3.2 High — all fourteen confirmed still open

| ID | Retest evidence | Outcome |
| --- | --- | --- |
| `DATA-003` | No composite same-tournament foreign keys or validation triggers present in any migration. | Still open |
| `FUNC-001` | `submit_entry()` (`20260722120000_write_integrity.sql`) retains count/membership checks without a full bracket replay. | Still open |
| `FUNC-002` | No scheduler, `pg_cron` job, edge function or server finalisation process anywhere in the repository; `docs/scoring-rules.md` §7 still requires auto-submit at lock. | Still open |
| `REL-001` | No tournament advisory lock or single transactional result-confirmation operation. | Still open |
| `DATA-004` | `_resolve_group_cluster()` still falls back to `group_teams.slot` order for genuinely unresolvable actual ties. Ties to `DEC-001`. | Still open |
| `DATA-005` | `ScoreInput` still emits `null` on clear; `PredictionsProvider` still persists only when both scores are non-null; no delete/clear service exists. | Still open |
| `REL-002` | `PredictionsProvider` still becomes ready on match predictions while tie, progression and Golden Boot reads settle later into empty/default states. | Still open |
| `REL-003` | **Directly re-verified.** `PredictionsProvider.tsx:420` `submit()` calls `submitEntry(id)` at line 425 with no flush of `timers.current` (line 134, set at 340) or `progressionTimer` (line 141, set at 409). A user who submits within `SAVE_DEBOUNCE_MS` of their last edit can still submit a server state that omits that edit. | Still open |
| `REL-004` | Bracket persistence remains multiple independent upserts/deletes via `Promise.all`. | Still open |
| `DATA-006` | Tournament selection and reference-data loading unchanged. | Still open |
| `OPS-001` | **Retested and materially more serious — see § 4.1.** | Still open, **escalation proposed** |
| `OPS-002` | **Directly re-verified and extended — see § 4.2.** `create table profiles` (`init_v0_1.sql:25–29`) has exactly three columns: `id`, `display_name`, `created_at`. No migration anywhere adds `role`. | Still open, **new linked finding `OPS-005`** |
| `TEST-001` | **Now proven by execution, not inference.** All 42 executed test files are TypeScript domain, service-mock, policy-helper or two component tests (`NotFoundPage`, `ProfileScreen`). Zero exercise Postgres, RLS, RPCs, triggers or a browser. The most safety-critical orchestration file in the codebase, `src/app/providers/PredictionsProvider.tsx` (557 lines), has **no test file at all**. | Still open — severity reaffirmed |
| `OPS-003` | No `.github/` directory exists; `netlify.toml` contains **no `[build]` section**, so build command, publish directory and Node version live only in the Netlify UI and are not version-controlled or reviewable. No error reporting, uptime or alerting integration. | Still open — reinforced |

### 3.3 Medium — all fourteen confirmed still open

| ID | Retest evidence |
| --- | --- |
| `REL-005` | Confirmed: `grep` for `.channel(`, `setInterval`, `visibilitychange`, focus-refetch across `src/` returns **zero** matches. No current-data strategy of any kind. |
| `REL-006` | Entry creation remains select-then-insert against a unique `(user_id, tournament_id)` constraint. |
| `REL-007` | Progression deletion remains a direct delete outside the version contract. Note additionally that `predicted_tie_resolutions` received **no** `version` column in `20260722120000_write_integrity.sql`, so tie edits sit outside the optimistic-concurrency contract entirely. |
| `PERF-001` | Confirmed and slightly broader than recorded: `src/features/home/useHomeData.ts` awaits `fetchLeaderboard` (201), `fetchMyScoreEventPoints` (208), `fetchMyLeagues` (211) and `fetchLastSeen` (237) **sequentially** — a four-step waterfall of independent reads — *before* the per-league `for` loop at 213–215 adds one serial round-trip per league. |
| `UX-001` | `JoinLandingPage.tsx` unchanged. |
| `A11Y-001` | Confirmed: no skip link, no route focus manager, no route live region, no dynamic title manager. The only `aria-live` in the app shell is the loading fallback (`src/app/RouteFallback.tsx:8`). |
| `A11Y-002` | `LeagueDetailPage.tsx` menu semantics unchanged. |
| `TYPE-001` | Confirmed and **strengthened** — see § 2.1. `tsconfig.app.json` has no `strict` family flags at all; no generated Supabase types module exists under `src/services/supabase/`. |
| `DOC-001` | Confirmed, with a concrete new instance — see § 4.3. |
| `SEC-001` | Unchanged. Additional observation: `public/robots.txt` is `Allow: /` for all agents and does not disallow `/join/`, so a publicly posted invite URL is crawlable. `public/sitemap.xml` correctly excludes it and documents the reasoning, so this is a marginal reinforcement of `SEC-001` rather than a separate finding. |
| `SEC-002` | Confirmed: **25** call sites across `src/features/` render an `Error.message` value. |
| `DATA-007` | Rate-limit path unchanged. |
| `UX-002` | Confirmed and directly visible in `useHomeData.ts`: `.catch(() => [])` on lines 201, 208 and 211 converts read failures into indistinguishable empty results. |
| `PERF-002` | Delete-and-rederive scoring unchanged; still unprofiled. Ties to `DEC-009`. |

### 3.4 Low — all thirteen confirmed still open

| ID | Retest evidence |
| --- | --- |
| `HYGIENE-001` | Confirmed: `grep -rn "vite.svg" src/ index.html public/` returns zero matches. |
| `HYGIENE-002` | Unchanged; deletion safety still unproven. Note `src/domain/rateLimit.ts` **is** covered by `tests/domain/rateLimit.test.ts`, so it is test-reachable even if not runtime-reachable. |
| `CODE-001` | Confirmed by line count: `src/dev/ComponentsPreview.tsx` 1512, `src/app/providers/PredictionsProvider.tsx` 557, `ReviewPage.tsx` 395, `LeagueDetailPage.tsx` 375, `MatchCentreScreen.tsx` 336. Total `src/` = 17,167 lines. |
| `OPS-004` | Confirmed: no `engines` field, no `.nvmrc`, no `[build.environment]` Node pin in `netlify.toml`. |
| `SEO-001` | Confirmed: `netlify.toml` `/* → /index.html` at status 200. |
| `SEO-002` | Confirmed. `index.html` metadata is genuinely good (canonical, per-scheme `theme-color`, complete Open Graph and Twitter cards, `og-image.jpg` present at 1200×630) but entirely global. |
| `A11Y-003` | Unchanged. |
| `UX-003` | Unchanged. |
| `UX-004` | Unchanged. |
| `DATA-008` | Unchanged. |
| `DOC-002` | Confirmed: `package.json` version `0.0.0`. |
| `DOC-003` | Confirmed: 1512-line dev gallery, correctly production-excluded (route gated in `src/App.tsx:52`). |
| `REPO-001` | Confirmed: no `LICENSE`, no `CHANGELOG.md`, no `.editorconfig`. |

---

## 4. New findings

### 4.1 `OPS-001` — escalation proposed, High → Critical

**This is not a new finding; it is a re-severity of an existing one on new evidence.**

`docs/ops-prod-cutover.md` now opens with **`## ✅ EXECUTED — 2026-07-22 (all steps complete)`**. The production Supabase project (`vkfnsqdyhvtwyqkisxhk`) is live, all 20 migrations are applied, `seed.sql` and `prod-baseline.sql` are loaded, Auth and SMTP are configured with a rotated live key, Turnstile holds the real secret, Netlify environment variables point at production, and at least one real user account (the owner's) exists.

Step 10 of the same document still reads: *if anything goes wrong, swap the Netlify environment variables back to the **dev project values** and redeploy.*

When the cutover was pending, that instruction merely reverted to the pre-cutover state. **Now that cutover is complete, executing it would point the live public domain at the development database** — surfacing development seed and deliberately hostile test data to real users, making real production data invisible, and allowing seeded development accounts to authenticate on the live domain. That is an environment-isolation and data-exposure event, not a rollback.

The correct procedure is to roll back the **application** (Netlify deploy rollback) while retaining the production database.

- **Severity:** proposed **Critical** (from High)
- **Confidence:** Confirmed for the documented procedure
- **Recommended fix:** rewrite `docs/ops-prod-cutover.md` § 10 as an application-only rollback, and add an explicit prohibition on ever pointing production environment variables at a development project.
- **Owner action required:** confirm the escalation.

### 4.2 `OPS-005` — Production may hold schema objects absent from version control

**ID:** `OPS-005`
**Title:** Executed admin bootstrap implies production schema drift from the migration set
**Severity:** High
**Confidence:** Requires verification (needs a production database query)
**Category:** Operations / Data integrity / Security
**Evidence:**
- `docs/ops-admin-bootstrap.md` grants admin via `update profiles set role = 'admin' where …`.
- `docs/ops-prod-cutover.md` step 7/8 log records: *"Nicky's admin account created on prod and the bootstrap grant run."*
- `supabase/migrations/20260719120000_init_v0_1.sql:25–29` defines `profiles` with exactly `id`, `display_name`, `created_at`.
- `grep -rn "role" supabase/migrations/*.sql` returns no `profiles.role` column definition in any of the 20 migrations.

**Problem:** the runbook records a statement being run successfully against a column that no version-controlled migration creates. Exactly one of the following must be true:

1. the statement failed and **production has no administrator**, and the runbook log is inaccurate; or
2. the statement succeeded, meaning **`profiles.role` exists in production but not in the migration set** — undeclared schema drift.

**Impact:** under (1), the documented result-entry and administration path does not exist in production and the Phase 2 exit gate is not actually met. Under (2), the production schema cannot be reproduced from version control, a rebuild or a fresh environment stand-up would silently lose the administrator model, and an RLS or `SECURITY DEFINER` function that checks `role` would behave differently across environments. `OPS-002` already records the absent role model; this finding records the separate risk that **production and the repository disagree about the schema**.

**Recommended fix:** query production for `information_schema.columns where table_name = 'profiles'` and record the result in the quality docs. If the column exists, add an append-only migration that declares it (and any dependent policy) so version control matches reality. If it does not, correct the cutover log and treat the administrator model as unbuilt.

**Validation:** the column list from production matches the column list derivable from the 20 migrations, with the diff recorded.

**Dependencies:** production database access; `OPS-002`.

### 4.3 `REPO-002` — `.gitignore` does not cover non-local Vite environment files

**ID:** `REPO-002`
**Title:** Environment-file ignore patterns miss `.env.production` and `.env.development`
**Severity:** Low
**Confidence:** Confirmed
**Category:** Repository hygiene / Security
**Evidence:** `.gitignore` ignores `.env`, `.env.local` and `.env.*.local`. Vite also loads `.env.development`, `.env.production` and `.env.[mode]` — none of which match those patterns.
**Problem:** a file named `.env.production` created locally would be staged by a routine `git add`, and it is precisely the file most likely to contain production Supabase values.
**Impact:** low today — no such file exists, no `.env` is committed, and the Netlify deploy secret scan reported no matches across 327 scanned files (`SAFE-030`). It is a latent trap rather than a live exposure.
**Recommended fix:** replace the three patterns with `.env*` plus a `!.env.example` negation.
**Validation:** `git check-ignore -v .env.production` reports a match, and `.env.example` remains tracked.
**Dependencies:** none.

### 4.4 Documentation finding with a concrete new instance (`DOC-001`)

`README.md` — the first file any new developer or agent reads — carries a **Status** checklist stating that `resolveGroupTies()` is *"next up"* and that `rankThirdPlacedTeams()`, `resolveRoundOf16()`, `advanceBracket()`, `calculateScore()` and `calculateLeagueRank()` are unbuilt. All six exist in `src/domain/tournament/` and all six have dedicated passing test files. The README also documents an `src/features/.../admin` directory that does not exist, and omits `docs/quality/` entirely.

A corrected `README.md` accompanies this audit as a proposed documentation update. `DOC-001` remains **Open**, because the more consequential conflicts — `ops-admin-bootstrap.md` versus the actual schema, and `ops-prod-cutover.md` § 10 — are unresolved.

---

## 5. Positive findings confirmed by execution

The baseline audit's positive findings held up, and execution added several:

1. **Scoring parity is exact across all three layers.** `docs/scoring-rules.md` §§1–4, `src/domain/tournament/scoringConfig.ts` and `supabase/migrations/20260721120000_scoring_positions_knockout_awards.sql` agree on every value: group match 5/3/0 with a ×2 joker; positions 2 per team plus a 5 bonus; knockout R16 10 / QF 15 / SF 20 / FINAL 25 / CHAMPION 40, implemented in SQL as the cumulative ladder `10, 25, 45, 70, 110`; Golden Boot 25; total-goals bands 40 / 30 / 20 / 0. **No scoring conflict of any kind was found.** The "no scoring literal outside the config" discipline is genuinely held.
2. **The test suite is real and green.** 335 tests over 42 files, executed, 63.88s. Domain coverage is broad and the tests assert behaviour rather than implementation detail.
3. **Zero dependency vulnerabilities** across 181 resolved packages.
4. **Zero lint findings** across 211 files.
5. **The production bundle is clean and well split.** 1.5 MB total, no source maps, no leaked configuration, every leaf route separately chunked.
6. **`netlify.toml` security headers are strong** and, unusually, carry an explanatory comment tying every CSP allowance to the resource that needs it.
7. **`supabase/prod-baseline.sql` is exemplary operational engineering** — explicit apply order, a loud pre-condition guard, idempotency, and a written statement of what it deliberately does *not* do.
8. **`public/sitemap.xml` is honest**, listing only the canonical root and documenting why each other route class is excluded.

---

## 6. Scorecard delta

Only categories where executed evidence changes the position are listed. All others stand as recorded in the baseline audit.

| Category | Baseline | `2026-07-23R` | Reason for change |
| --- | --- | ---: | --- |
| Testing | as baseline | **unchanged** | The suite is now *proven* green rather than reported green, which raises confidence in the evidence — but it does not raise the score, because `TEST-001` (no database, RLS, RPC or browser layer) is untouched and is the reason for the score. |
| Code quality | as baseline | **+ confidence** | Lint clean, type-check clean, one legitimate TODO in 17,167 lines. Offset by § 2.1: the type-check is weak evidence with strict mode absent. |
| Security | as baseline | **+ confidence, − outlook** | Positive: zero dependency vulnerabilities, no source maps, no leaked config, no committed secrets. Negative: `OPS-001` escalation and new `OPS-005`. |
| Deployment and operations | as baseline | **↓** | `OPS-001` escalation, new `OPS-005`, and the confirmation that `netlify.toml` has no `[build]` section, so build configuration is unreviewable. |
| Documentation | as baseline | **↓ then repairable** | `README.md` is materially stale in a way the baseline did not itemise; the accompanying update repairs that specific instance. |

---

## 7. Feature-baseline comparison

Compared against all 96 entries in [`../feature-baseline.md`](../feature-baseline.md):

- **Regressions detected: 0.** No feature lost reachability, no safeguard weakened, no scope drift.
- **The two pre-existing `Confirmed regression` entries persist unchanged:** `SAFE-007` (submission not exclusively RPC-protected, `SECURITY-002`) and `SAFE-031` (rollback crosses environment boundaries, `OPS-001` — now proposed Critical).
- **Validation evidence upgraded on 8 entries** where "static audit only" can now read "static audit plus executed suite": `SAFE-001`, `SAFE-002`, `SAFE-005`, `SAFE-011`, `SAFE-012`, `SAFE-015`, `SAFE-030`, `SAFE-034`.
- **`SAFE-024` reinforced:** strict TypeScript is not merely disabled but wholly absent, and no generated types module exists.
- **`SAFE-025` reinforced:** no `.github/` directory, and no `[build]` block in `netlify.toml`.
- **`SAFE-041` reinforced:** the audit container ran Node v22.22.2 with nothing in the repository asserting that is correct.
- **No new baseline entry is required.** `OPS-005` is a defect against `SAFE-017` (append-only migrations as the schema source of truth) and `SAFE-032`, both of which already exist.

---

## 8. Unknowns and limitations

| ID | Limitation |
| --- | --- |
| `L-1` | **No version-control metadata.** The archive contains no `.git` directory, so branch and commit SHA could not be captured. Correspondence to the baseline commit is inferred from exact structural counters (§ 1.1), not proven. **Any future audit should be run against a git clone, not a source archive.** |
| `L-2` | **No deployed-site access.** The audit container has no route to the production domain. Nothing in §§ 2–7 constitutes runtime, browser or authenticated-journey evidence. |
| `L-3` | **No Supabase access (dev or prod).** No migration was applied, no policy executed, no function called, no schema queried. `OPS-005` in particular cannot be resolved without this. |
| `L-4` | **No Netlify access.** Build settings, environment-variable values, deploy history and preview isolation are unverified. The absence of a `[build]` block in `netlify.toml` means these exist only in the dashboard. |
| `L-5` | **No GitHub access.** Branch protection, required checks and Issue state are unverified. |
| `L-6` | **No browser, accessibility-tool or performance measurement.** All UI, accessibility and performance positions are carried forward from the baseline audit's static analysis. |
| `L-7` | **Runtime parity unproven.** Checks `C-1`–`C-6` ran on Node v22.22.2; `OPS-004` means this is not proven to match the Netlify build image. |
| `L-8` | Every baseline unknown in [`../current-status.md`](../current-status.md) that is not listed as resolved in § 2 **remains unresolved**. |

**Resolved by this audit:** the baseline unknowns covering *build result*, *lint result*, *type-check result*, *unit/component test result* and *dependency vulnerability state*.

---

## 9. Verdict

| Verdict | Position |
| --- | --- |
| **Development** | **Safe to continue development, on the same condition as the baseline** — contain the Critical integrity risks first and hold unrelated feature expansion until the first repair batch lands. The engineering foundation is demonstrably sound: reproducible install, clean build, clean lint, 335 passing tests, zero dependency vulnerabilities, exact three-layer scoring parity. |
| **Production** | **Not safe for a real scored competition — unchanged, and now more urgent.** The four Critical findings are all confirmed still open. Production infrastructure went live on 2026-07-22 *while* they were open, which converts several documentation defects from theoretical to operational. |
| **Environment isolation** | **Downgraded from "partial assurance" to "partial assurance with a documented live hazard."** Separate projects are confirmed in documentation, but the written rollback procedure would now actively breach isolation, and `OPS-005` raises a credible schema-drift question that only a production query can settle. |
| **Regression position** | **No regression.** Nothing has been silently lost since the baseline. |

**Overall:** *Safe only after critical repairs.*

---

## 10. Recommended next batch — unchanged

The baseline's `DB-INTEGRITY-ENTRY-BOUNDARY-1` remains the correct first batch and nothing found here displaces it:

1. deny direct client updates to `entries.submitted_at`;
2. add same-tournament validation;
3. lock and validate `predicted_group_positions`;
4. correct `submit_entry()` scoping and lock behaviour; and
5. add executable multi-user/multi-tournament RLS and RPC regression tests.

**Two documentation-only items should be handled immediately and separately**, because both are zero-risk, touch no code, and one of them removes a live operational hazard:

| Priority | Item | Effort |
| --- | --- | --- |
| **Immediate** | Rewrite `docs/ops-prod-cutover.md` § 10 as an application-only rollback (`OPS-001`). Nothing else in this audit can cause harm before the next code change; that instruction can. | XS |
| **Immediate** | Run the `information_schema` query against production to settle `OPS-005`, and record the answer. | XS |
| Next | Apply the corrected `README.md` (`DOC-001`, partial). | XS |
| Next | Widen `.gitignore` to `.env*` with a `!.env.example` negation (`REPO-002`). | XS |

**Next audit baseline:** designation `2026-07-23R`, this snapshot, with the § 8 limitations attached. The next audit should be run against a git clone with live Supabase and Netlify access so that `L-1` through `L-5` can be closed.
