# Repeat verification audit — 25 July 2026

> **Audit designation:** `2026-07-25R`
>
> Repeat audit under `audit-prompt.md` § *Repeat-audit and quality-baseline controls*.
> Historical audits remain immutable evidence.
>
> **Audit boundary:** repository and hosted inspection were non-destructive. No production migration, migration-history repair, data mutation, Netlify production deployment or hosted contract change was performed.

---

## 1. Audit identity

| Field | Value |
| --- | --- |
| Designation | `2026-07-25R` |
| Date | 25 July 2026 |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Audited branch | `main` |
| Audited commit | `bd509101dd1d21a9882f6c40bef9676986215919` |
| Commit title | `Remove unused Vite scaffold asset (#74)` |
| Current production Netlify deploy | `6a630e4de510f100077bc120`, ready |
| Production deploy source | `a6d3f1c97a93d48789435457769fd627c305ff27` |
| Repository database contract | 35 |
| Production declared contract | 20 |
| Development Supabase | `iouzoutneyjpugbbtdem` |
| Production Supabase | `vkfnsqdyhvtwyqkisxhk` |
| Disposable restore target reserved | `eckuehkcmkhuhmsfxtxu` |
| Prior formal audit | `2026-07-24R` |

### 1.1 Authority documents read first

- `AGENTS.md`;
- `docs/quality/README.md`;
- `docs/quality/current-status.md`;
- `docs/quality/feature-baseline.md`;
- `docs/quality/risk-register.md`;
- `docs/quality/deferred-decisions.md`;
- `docs/quality/audit-prompt.md`;
- `docs/ops-production-backup-restore.md`;
- `docs/ops-hosted-migration-rollout.md`;
- `docs/ops-pending-migrations.md`;
- `docs/build-todo.md`;
- the `2026-07-24R` audit and relevant reconciliation evidence.

### 1.2 Limitations

The operator no longer had access to the local repository or plaintext backup directory during the final audit phase. Therefore this audit did not independently rerun `npm ci`, `npm run build`, lint, Vitest, Playwright, local Supabase rebuild, pgTAP or the restore commands.

The audit instead used:

- exact current `main` files from GitHub;
- successful owner-authored GitHub Actions evidence from the latest merged implementation heads;
- successful CI, Database parity and Browser E2E evidence from draft PR #76;
- current Netlify project/deploy/environment evidence;
- current read-only production Supabase queries;
- the operator-observed production backup, checksum and encryption transcript.

No Cloudflare widget configuration, Supabase Auth CAPTCHA secret/toggle, GitHub branch-protection ruleset or off-device archive contents were directly inspectable. Those remain unknown rather than assumed safe.

---

## 2. Executive verdict

### Repository development

**Safe to continue controlled development.** The current application is a disciplined React/TypeScript/Vite/Supabase codebase with route splitting, domain-layer tournament logic, database-backed integrity controls, disposable database parity, substantial authenticated browser E2E and fail-closed environment/deployment guards.

### Production

**Safe only after the existing critical release and recovery gates are completed.** The production application/database pair remains incompatible at two live write boundaries because production lacks the contract-35 bracket-replacement and score-deletion RPCs. The mismatch is contained by the production contract value remaining at 20.

### Recovery

A real production backup now exists, has been checksum-verified, encrypted and copied off the working Mac. This materially improves `OPS-003`, but the archive has not yet been retrieved from off-device custody and restored to a disposable Supabase-compatible target. Recovery is therefore **partially evidenced, not proven**.

### Audit result

No new application-code Critical or High defect was confirmed. One existing governance root cause, `DOC-001`, regressed: several live authority documents lagged behind merged implementation and current hosted evidence. This audit repairs that documentation drift without changing runtime behaviour.

---

## 3. Repository orientation

| Area | Current implementation |
| --- | --- |
| Framework | React 19.2.7 with Vite 8.1.1 |
| Language | TypeScript 6.0.2 |
| Routing | React Router 8.3.0, browser router, route-level lazy loading |
| Database/Auth | Supabase Postgres, RLS, Auth and SQL RPCs |
| Hosting | Netlify |
| State | React providers/hooks, server-authoritative persisted prediction state |
| Styling | CSS Modules/design-system components, self-hosted fonts and bundled flags |
| Unit/integration tests | Vitest, Testing Library and pgTAP |
| Browser tests | Playwright/Chromium against disposable local Supabase |
| Lint | Oxlint |
| Runtime | Node 22.22.2 pinned across package, CI and Netlify |
| Repository shape | Single frontend application with version-controlled database migrations |

### 3.1 Route inventory

Current `src/App.tsx` includes:

- signed-out auth routes: login, signup, reset request and password update;
- public invite route `/join/:code`;
- authenticated welcome gate;
- Home, Predict, Group predictor, Third-place, Bracket, Jokers and Review;
- Leagues, overall standings and league detail;
- H2H;
- Matches and Match Centre;
- More, scoring rules and Profile;
- a compatibility redirect from `/more/points` to `/profile`;
- a production-safe not-found route;
- a development-only component gallery excluded from production builds.

No browser result-administration route or bonus-competition route is present on `main`.

---

## 4. Verification evidence

### 4.1 Application checks

Current `main` itself had no separate connector-visible status record, but its final merged implementation batches were validated before merge:

- PR #74 final head: CI and Browser E2E passed;
- PR #71 final head: CI and Browser E2E passed;
- PR #41 final head: CI passed;
- PR #76 head: CI, Database parity and Browser E2E passed.

PR #76 adds draft migration 36 and is not part of the audited `main` contract. Its green workflows provide current toolchain/regression evidence, not authorization to merge or deploy contract 36.

### 4.2 Current workflow quality

- `ci.yml` installs from lockfile, proves Git-less environment hygiene, builds, lints, runs the full Vitest suite and audits production dependencies.
- `database-parity.yml` rebuilds the full migration chain on disposable Supabase, runs database lint, all pgTAP suites and TypeScript/PostgreSQL differential parity, then destroys local data without backup.
- `browser-e2e.yml` rebuilds disposable Supabase, runs authenticated application journeys plus signup/password-recovery journeys, uploads diagnostics and destroys disposable data.

### 4.3 Netlify

The production project is ready on deploy `6a630e4de510f100077bc120` and source commit `a6d3f1c97a93d48789435457769fd627c305ff27`.

Observed deploy evidence:

- Performance 98;
- Accessibility 100;
- Best Practices 100;
- SEO 100;
- no deploy secret-scan matches;
- no Functions or Edge Functions in the current production deploy.

`netlify.toml` defines CSP, HSTS, frame denial, MIME sniffing protection, a strict referrer policy and a restrictive Permissions Policy. The SPA fallback still returns HTTP 200 for unknown paths, so `SEO-001` remains open despite the client-side not-found page.

### 4.4 Environment isolation and contract gate

Netlify environment evidence remains correct:

| Context | Supabase | Declared contract |
| --- | --- | ---: |
| production | production | 20 |
| deploy-preview | development | 35 |
| branch-deploy | development | 35 |
| dev | development | 35 |

The production mismatch is therefore contained. PR #76’s preview failure is correct because its branch requires contract 36 while deploy-preview correctly declares 35.

---

## 5. Production database and recovery evidence

### 5.1 Production preflight

Read-only production verification on 25 July 2026 passed:

- all migration 1–20 structural checks;
- exactly one submitted entry;
- 36 group predictions;
- two valid manual tie resolutions;
- eight progression rows in `4/2/1/1` shape;
- no score events, rank history or stored match results;
- no scope anomalies;
- valid knockout source tree;
- source fingerprints:
  - predictions `320cf25d62767dee307d3602212909af`;
  - ties `a4dcf183f5c48e3ba11ff75c59622598`;
  - progression `0d7bc491daa9b24013204d061a2d38f1`.

Production still has no `supabase_migrations.schema_migrations` table and lacks both contract-35 client RPCs.

### 5.2 Development database

Hosted development is now semantically and historically aligned through contract 35:

- physical schema aligned;
- exactly 35 canonical migration-history records;
- no pending migration through 35;
- exact function allowlists and helper search paths verified;
- final schema diff empty for the audited application schemas.

The previous documentation statement that development had partial/tool-generated migration history is obsolete.

### 5.3 Backup evidence

The operator created a fresh production logical bundle on 25 July 2026 containing:

- `roles.sql`;
- `schema.sql`;
- `data.sql`;
- production inventory and tool/repository provenance;
- the three verification scripts;
- managed Auth customization evidence;
- recursive SHA-256 checksums.

Observed checks:

- `auth.users` present;
- `public.profiles` present;
- owner-only file permissions;
- every plaintext checksum passed;
- encrypted AES-256 archive created;
- the encrypted archive decrypted successfully;
- the encrypted archive checksum passed;
- an off-device copy was owner-confirmed.

Still missing:

- retrieval of the off-device copy through the recorded custody path;
- post-retrieval checksum verification;
- restore to `eckuehkcmkhuhmsfxtxu` or another disposable target;
- restored Auth/profile/count/fingerprint verification;
- signup-trigger smoke proof;
- preferred forward migration rehearsal from the restored source.

The migration gate correctly remains closed.

---

## 6. Feature and business-rule verification

### 6.1 Implemented current application scope

| Capability | Classification | Evidence boundary |
| --- | --- | --- |
| Authentication, signup, login and recovery | Implemented | Routes, Supabase Auth integration and disposable browser E2E |
| Welcome gate | Implemented | `/welcome`, profile state and E2E |
| Group score prediction | Implemented | UI, services, database and tests |
| Jokers | Implemented | UI, database guard and scoring |
| Predicted tables and tie resolution | Implemented, stronger server layer pending production | Pure domain, persisted tie decisions and migrations |
| Original winner-only bracket | Deployed client / production backend absent | Production lacks atomic bracket RPC |
| Golden Boot | Implemented | UI/data/scoring |
| Review and manual submission | Implemented, production boundary old | Save-settlement code and tests; production migration pending |
| Persisted score clearing | Deployed client / production backend absent | Production lacks deletion RPC |
| Private leagues | Implemented | Create/join/leave/delete/transfer routes/services/RPCs |
| H2H | Implemented pass 1 | Route and feature module; richer graph/health planned |
| Match list and Match Centre | Implemented | Routes and aggregate RPCs |
| Own profile and points | Implemented | `/profile` |
| Other-player full profile | Partial | H2H/league path exists; dedicated complete profile journey absent |
| Browser result administration | Not present | No admin model or route |
| Automatic submission | Documented/planned | No scheduler/server implementation |
| Deadline reminders | Documented/planned | No email scheduler |
| KO Predictor | Documented/planned | No route/schema/service |
| Last Man Standing | Documented/planned | No route/schema/service |
| Predictor Cup | Rules/planning only | No runtime implementation |

### 6.2 Scoring consistency

The audited scoring authorities remain aligned:

- group result: 3;
- exact group score: 5 total, not cumulative;
- five Jokers, doubling group-match points only;
- group position: 2 each plus 5 complete-order bonus;
- knockout progression: 10 / 15 / 20 / 25 / 40, stacking;
- Golden Boot: 25;
- group-goals bands: 40 / 30 / 20, tiered.

No audit, backup, security, route or deployment work changed scoring.

---

## 7. Architecture and maintainability

### Strengths

- clear domain/service/UI boundaries;
- Supabase browser access is centralized under service modules;
- route-level lazy loading;
- database authority for lock, submission, results, scoring and integrity;
- append-only migration discipline;
- fail-closed schema/deployment contract;
- strong repository governance and stable finding IDs;
- meaningful disposable database and browser gates;
- safe centralized user-facing error mapping;
- stale-tab, concurrent-entry and optimistic-conflict controls have executable coverage.

### Remaining concerns

- `TYPE-001`: TypeScript strictness remains disabled, reducing schema-drift confidence;
- `CODE-001`: large provider/orchestration modules remain coordination hotspots;
- hand-written database types/casts remain a maintainability risk;
- `PERF-001`: serial league summary/profile loading remains unprofiled;
- `PERF-002`: full-tournament score recomputation remains accepted pending target-capacity measurement;
- branch-protection technical enforcement remains unverified.

No evidence supports a wholesale rewrite. Incremental repair remains the safer approach.

---

## 8. Accessibility, UX and public-web review

### Improved since `2026-07-24R`

- route-specific document titles, polite live-region announcements and post-navigation focus management are implemented;
- a skip-to-main mechanism is present in the shell;
- bottom navigation uses real links;
- the league options control now uses disclosure semantics rather than an incomplete ARIA menu;
- sign-out requires confirmation;
- infrastructure failures are mapped to safe stable user copy;
- current Netlify Lighthouse accessibility score is 100.

### Still open

- `A11Y-001` remains partially resolved because a real keyboard journey and screen-reader announcement review are not yet retained in browser E2E;
- browser accessibility journeys are absent from the dedicated Playwright gate;
- `UX-001`: invite context before authentication remains weak;
- `UX-002`: unavailable/error data is still not consistently separated from empty data;
- `UX-003`: other-player profile flow remains incomplete;
- `SEO-001`: SPA fallback soft 404;
- `SEO-002`: metadata remains largely global.

---

## 9. Security and privacy

### Strong controls

- RLS and server-authoritative RPC design;
- fail-closed environment isolation;
- production CSP and other response headers;
- no service-role key in browser code;
- centralized safe error mapping;
- exact function allowlists in repository/development;
- disposable-test credential isolation;
- Netlify secret scan clean for the current deploy.

### Open controls

- production still retains broad old privileges until migrations 21–35;
- `SEC-001`: invite/aggregate abuse and small-cohort disclosure review;
- `DATA-007`: count-then-insert rate limiting is not serialized;
- production leaked-password protection remains disabled/unverified;
- non-production Turnstile/Supabase CAPTCHA pairing is unverified;
- no version-controlled browser admin authorization model exists;
- branch protection is unverified.

No destructive security testing was performed.

---

## 10. Findings movement

### `DOC-001` — authority documents drifted behind current evidence

**Severity:** Medium  
**Confidence:** Confirmed  
**Category:** Documentation / Operations

**Evidence:** `current-status.md`, `risk-register.md`, `feature-baseline.md`, `ops-production-backup-restore.md`, `ops-hosted-migration-rollout.md`, `ops-pending-migrations.md` and `build-todo.md` contained mutually inconsistent facts after merged PRs and the 25 July backup work.

Confirmed examples:

- rollout documents retained the obsolete prediction fingerprint `8d76619...` while committed preflight and current production return `320cf25...`;
- development history was still described as partial despite canonical 35-row alignment;
- recovery was described as having no artifact despite a verified encrypted off-device copy;
- `A11Y-002`, `SEC-002` and `HYGIENE-001` remained open after their merged fixes;
- Browser E2E remained classified as absent in the feature baseline;
- route accessibility implementation remained described as absent.

**Impact:** A future operator could use the wrong rollout guard, duplicate completed work, misclassify risk or misunderstand the recovery gate.

**Disposition:** Reopened during audit and repaired in the audit documentation branch. Closure requires the documentation PR to pass current CI/Markdown controls and merge.

### Resolved classifications confirmed

- `A11Y-002`: repository implementation and focused test evidence are present;
- `SEC-002`: centralized safe mapping is implemented and validated;
- `HYGIENE-001`: the unused Vite asset was removed and the final head passed CI/Browser E2E.

### Partially improved classifications

- `A11Y-001`: implementation present; manual/browser assistive-technology closure absent;
- `OPS-003`: real encrypted off-device backup exists; restore/recovery proof absent;
- `TEST-001`: substantial Playwright coverage exists; private invite/join, admin, accessibility and production smoke remain open.

### Existing Critical/High findings retained

No existing production-dependent Critical or High finding is closed by repository evidence alone. `OPS-006`, `DATA-001`, `SECURITY-001`, `SECURITY-002`, `DATA-002`, `SECURITY-003`, `DATA-003`, `FUNC-001`, `REL-001`, `DATA-004`, `DATA-005`, `REL-003`, `REL-004`, `DATA-006`, `OPS-002`, `TEST-001` and `OPS-003` remain open or partial according to their actual environment boundary.

---

## 11. Prioritised remediation roadmap

### Stage 0 — stop-the-line

1. Retrieve, checksum-verify and restore the existing encrypted backup to the disposable project.
2. Keep production contract at 20 and migration 36 outside production.
3. Preserve the production write/deploy freeze for the future approved migration window.

### Stage 1 — correctness and data safety

1. Complete `DATA-003` through reviewed PR #76 or a successor only after contract-35 production rollout planning is reconciled.
2. Implement authoritative actual R16 population and unresolved actual-tie workflow.
3. Define and test admin correction boundaries before browser result administration.

### Stage 2 — security and permissions

1. Roll out migrations 21–35 only after recovery acceptance.
2. Resolve non-production Turnstile/CAPTCHA pairing.
3. Review leaked-password protection.
4. Replace count-then-insert rate limiting with an atomic design.
5. Complete invite/aggregate abuse review.

### Stage 3 — architecture and maintainability

1. Generate Supabase database types and begin incremental strict-TypeScript adoption.
2. Split only demonstrated orchestration hotspots.
3. Retain domain/service boundaries and avoid unnecessary rewrite.

### Stage 4 — user journeys and UX

1. Improve pre-auth invite context.
2. Separate unavailable/error/empty states.
3. Complete other-player profile and richer H2H.
4. Add remaining Match Centre states.

### Stage 5 — testing and release confidence

1. Add private league invitation/join browser E2E.
2. Add keyboard and screen-reader-oriented browser journeys.
3. Add browser result-administration E2E after admin implementation.
4. Verify branch protection and required checks.
5. Run authenticated production smoke after compatible rollout.

### Stage 6 — performance and polish

1. Profile league summary requests and target-capacity scoring.
2. Resolve soft 404 and metadata scope only if public acquisition becomes approved.
3. Complete mobile friction and content-density review.

### Stage 7 — production readiness

1. Accept verified restore evidence.
2. Repair migration history 1–20 and require a 21–35-only dry run.
3. Apply 21–35 under explicit owner approval.
4. Run post-rollout verifier, advisors and authenticated smoke tests.
5. Only then update production contract to 35 and verify the new release pair.
6. Perform a complete tournament dress rehearsal before launch.

---

## 12. Recommended next implementation batch

The safest highest-value batch remains **recovery proof**, not another production change:

1. regain access to the encrypted archive;
2. retrieve it from off-device custody;
3. verify the encrypted checksum;
4. decrypt into a restricted temporary directory;
5. verify all plaintext checksums;
6. restore to `eckuehkcmkhuhmsfxtxu`;
7. verify counts, fingerprints, Auth users/profiles and signup trigger;
8. preferably rehearse history repair plus migrations 21–35;
9. retain non-secret evidence and clean up the disposable target.

This batch is independent of PR #76 and does not require weakening any deployment guard.

---

## 13. Final verdict

- **Repository:** Safe to continue controlled development.
- **Production migration:** Blocked pending successful disposable restore and recovery acceptance.
- **Current production pair:** Incompatible but contained.
- **Migration 36:** Draft repository work only; not approved for production.
- **Documentation:** Drift found and reconciled in this audit branch.
