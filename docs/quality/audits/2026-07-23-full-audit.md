# Euro 2028 Predictor — Full Website and Repository Audit

**Audit date:** 23 July 2026  
**Audit mode:** Read-only, evidence-based audit  
**Repository:** `nickygregal12-cmyk/Euro-2028-Predictor`  
**Authoritative branch:** `main`  
**Audited commit:** `b68c4858a179adce433e01db439cabb93c6a0c01`  
**Production deployment:** Netlify production deploy at the same commit  
**Supplied snapshot:** `Euro-2028-Predictor-main (1)(2).zip`

**Deployed domains identified:** `euro28predictor.com`; `euro28predictor.netlify.app`  
**Development Supabase project reference identified:** `iouzoutneyjpugbbtdem`  
**Production Supabase project reference identified:** `vkfnsqdyhvtwyqkisxhk`  

> **Environment evidence boundary:** Deployment metadata and repository configuration were inspected. The audit did not authenticate into every deployed route, read live Netlify environment-variable values, execute live Supabase policies or compare the live production schema to migration history. Project references identify environments and are not credentials.
>
> **Development verdict:** Safe to continue controlled development after containing the Critical integrity risks; unrelated feature expansion should pause until the first repair batch lands.
>
> **Production verdict:** Safe only after critical repairs; not production-ready for a real scored competition.
>
> **Environment-isolation verdict:** Partial assurance. Separate project references are documented, but live environment values and cross-environment protections were not directly verified.
>
> **Supabase assurance level:** Repository-level static assurance only. Migrations, RLS, functions and triggers were inspected without executing them against the live development or production database.

> ## Final verdict
>
> **Safe only after critical repairs.**
>
> The codebase is structured well enough to continue developing incrementally. A wholesale rewrite is not justified. It is **not safe to launch a real points competition yet**, because several core database and scoring invariants can be bypassed or are not connected end to end.

---

## Evidence boundary and scope discipline

This report audits only the current Euro 2028 Predictor application represented by:

1. the current GitHub `main` branch;
2. the supplied archive, whose archive identifier matches the current `main` commit;
3. current repository documentation;
4. current migrations and schema;
5. current tests;
6. the current production Netlify deployment metadata; and
7. clearly marked current TODO/roadmap files.

No requirement, score value, feature or game mode was imported from:

- the previous World Cup predictor;
- older repository snapshots;
- previous chat discussions;
- abandoned prototypes;
- similarly named modes in other projects; or
- future ideas that lack active runtime and database support.

Where an item appears only in planning or design documentation, it is classified as **Planned**, **Documented but not implemented**, **UI prototype only**, or **Legacy/obsolete** rather than implemented.

### Current GitHub and deployment reconciliation

The supplied archive comment is `b68c4858a179adce433e01db439cabb93c6a0c01`. GitHub `main` currently points to that same commit, and Netlify reports the production deploy as:

- branch: `main`;
- commit: `b68c4858a179adce433e01db439cabb93c6a0c01`;
- state: `ready`;
- framework: Vite;
- no Netlify Functions;
- no Netlify Edge Functions;
- automated root-page Lighthouse averages: Performance 97, Accessibility 100, Best Practices 100, SEO 100, PWA 40;
- automated secret scan: no matches in 327 scanned files.

These automated results are useful but limited. They do not prove the authenticated application journeys, database policies, scoring correctness, keyboard operation, screen-reader behaviour or every responsive layout.

---

# Orientation summary

## Repository inventory

The supplied snapshot contains approximately:

- **325 files** across **46 directories**;
- **219 files** under `src/`;
- **43 test/support files**, with about **326 `it()` / `test()` cases**;
- **20 append-only Supabase migration files**;
- **23 files** within the Supabase area;
- **14 substantial files** under `docs/`;
- **7 scripts**;
- **7 public assets**.

The archive does not contain `.git` metadata or installed dependencies. GitHub and Netlify were therefore used to verify that the snapshot is the current production `main` commit.

## Technical stack

| Area | Current implementation |
|---|---|
| Repository shape | Single application, not a monorepo |
| Frontend | React 19 |
| Language | TypeScript 6 |
| Router | React Router 7 |
| Build | Vite 8 |
| Package manager | npm with one lockfile |
| Backend | Direct browser-to-Supabase requests plus PostgreSQL RPCs and triggers |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Hosting | Netlify |
| CAPTCHA | Cloudflare Turnstile |
| State | React Context, component state, refs and a custom save coordinator |
| Styling | Global CSS variables/tokens plus CSS Modules |
| Unit/component tests | Vitest, Testing Library, jsdom |
| Linting | Oxlint |
| Formatting | No formatter configuration or script identified |
| Runtime schema validation | No dedicated schema-validation library identified |
| Generated database types | None identified |
| End-to-end tests | None identified |
| CI workflows | None included |
| Serverless/edge runtime | None deployed in the current production release |

## Important directory map

| Path | Purpose |
|---|---|
| `src/main.tsx` | Browser bootstrap |
| `src/App.tsx` | All current runtime routes and lazy loading |
| `src/app/` | Application shell, providers, route gates and save coordination |
| `src/design-system/` | Reusable components, icons, modal, table and form styling |
| `src/domain/tournament/` | Pure tournament calculations, scoring and rules |
| `src/features/` | User-facing pages grouped by feature |
| `src/services/supabase/` | Supabase reads, writes and RPC wrappers |
| `src/dev/` | Development-only component gallery |
| `src/styles/` | Global styles and design tokens |
| `supabase/migrations/` | Version-controlled schema, RLS, functions, triggers and scoring |
| `supabase/seed.sql` | Development/reference tournament data |
| `supabase/prod-baseline.sql` | Production reference baseline |
| `scripts/seed-dev/` | Guarded development seeding and simulation |
| `tests/` | Pure-domain, service, utility and selected rendered component tests |
| `docs/` | Product rules, design, roadmap, TODO and operations documentation |
| `public/` | Favicons, robots, sitemap and social assets |

## Existing checks

The scripts were inspected before execution.

| Command | Result | Interpretation |
|---|---|---|
| `npm run build` | Could not run successfully because dependencies were not installed; TypeScript could not resolve Vite and Node type packages. | This is an environment limitation, not evidence that the source fails to build. The current Netlify production deploy did build successfully at the audited commit. |
| `npm run lint` | `oxlint` was unavailable because dependencies were absent. | No independent lint result was obtained. |
| `npm run test` | `vitest` was unavailable because dependencies were absent. | Tests were inspected statically but not executed in the audit environment. |
| Dependency installation | Not performed. | The audit prompt allowed installation only when permitted; explicit approval was not provided. |
| Migrations | Not applied. | No database was altered. |
| Live authenticated journeys | Not performed. | The deployment was verified through Netlify metadata, but the audit environment could not inspect authenticated screens or query the production database. |
| Dependency vulnerability scan | Not performed. | No package installation or registry audit was used. |

The current production deploy’s commit message claims TypeScript, Oxlint, 335 tests and a production build were checked before deployment. That statement is useful provenance but was not treated as independent test evidence.

---

# 1. Executive summary

## Overall condition

The Euro 2028 Predictor is a serious, substantially implemented single-game application rather than a superficial prototype. It contains:

- account creation and authentication;
- a first-use welcome gate;
- group score prediction;
- predicted group tables and manual predicted-tie resolution;
- best-third-place calculation;
- a winner-only **Original Predictor** knockout bracket;
- jokers;
- Golden Boot selection;
- derived group-stage total-goals prediction;
- review and manual submission;
- overall and private leagues;
- invite links;
- H2H comparison;
- match listing and match-centre views;
- profiles and points breakdown;
- share-card functionality; and
- database-side score events and leaderboard RPCs.

The central architectural direction is sound: pure domain functions, a service boundary, route-level splitting, reusable design-system components and broad RLS are all worth preserving.

The project is nevertheless not production-ready. The most serious issue is not visual polish but **competition integrity**.

The database awards group-position points from `predicted_group_positions`, yet no current frontend provider or Supabase service saves or loads those rows. A normal user therefore cannot receive that part of the score. At the same time, authenticated owners have broad direct write access to the table, and it is omitted from the database lock and optimistic-version protections. A crafted client can therefore insert or alter those scoring inputs after lock.

The server submission RPC can also be bypassed because owners can directly update `entries.submitted_at`. The database treats a non-null timestamp as submission eligibility in several downstream functions, but RLS does not require the transition to pass `submit_entry()`.

The knockout result model stores only two scores and has no authoritative winner, result method, extra-time result or penalty result. A drawn knockout match cannot be represented or progressed correctly, including the final.

These are targeted repair problems, not evidence that the whole application should be discarded.

## Safe to continue building?

**Yes, but feature expansion should pause until the database-integrity batch is completed.**

It is safe to continue using the current architecture after:

- all scoring-input tables are protected;
- submission is made RPC-only;
- cross-tournament relationships are validated;
- group-position persistence is connected end to end; and
- knockout result resolution is properly modelled.

## Production readiness

**Not production-ready.**

A real tournament should not rely on the current leaderboard until the scoring and write-integrity defects are fixed and proved through database integration tests.

## Strongest areas

- Pure tournament-domain modules.
- Route-level lazy loading.
- A dedicated Supabase service layer.
- Broad RLS coverage.
- Explicit `search_path` on inspected security-definer functions.
- Server-side lock triggers for several prediction tables.
- Thoughtful retry/conflict handling in the save coordinator.
- Strong development seeding and autologin safeguards.
- A reusable design system.
- A comparatively good modal focus implementation.
- Netlify security headers, self-hosted fonts and no unsafe HTML-rendering sink identified.
- A substantial existing pure/unit test base.

## Weakest areas

- Database invariants across entries, matches, teams, groups and tournaments.
- End-to-end group-position persistence.
- Submission eligibility and deadline finalisation.
- Knockout result lifecycle.
- Atomicity of multi-row bracket saves.
- SQL/RLS integration testing.
- Live data freshness and degraded-state communication.
- Safe result administration.
- Deployment recovery, monitoring and schema reproducibility.
- Documentation freshness.

## Most serious risk

A convincing but incorrect leaderboard can be produced through a combination of:

1. group-position predictions not being saved through the application;
2. direct post-lock writes to the table that scoring trusts;
3. direct client updates to submission timestamps;
4. missing same-tournament constraints; and
5. a knockout result schema that cannot identify a penalty-decided winner.

## Immediate recommendation

Freeze bonus-game and visual expansion. Implement one small, reviewed, append-only **database integrity migration** first. It should:

- prevent direct authenticated updates to `entries.submitted_at`;
- add same-tournament validation;
- add lock enforcement to `predicted_group_positions`;
- correct `submit_entry()` scoping;
- protect deletion paths; and
- introduce executable RLS/RPC regression tests.

Do not combine this first batch with UI redesign, result-model expansion or codebase cleanup.

---

# 2. Scorecard

| Category | Score | Evidence-based justification | Required for 10/10 |
|---|---:|---|---|
| Product completeness | **6/10** | The Original Predictor, leagues, H2H, profile and match centre are substantive. Automatic lock submission, safe result administration, full account controls, other-player profiles and several live/post-lock states remain incomplete. Future bonus games are not part of the current implementation. | Every promised current-scope journey implemented, reachable and tested with production-like data; no placeholder actions or launch-critical deferred lifecycle. |
| Functional correctness | **4/10** | Group-position scoring is disconnected from client persistence; clearing a score does not clear storage; submit can race autosave; knockout draws cannot resolve; actual group ties can fall back to slot order. | End-to-end acceptance tests for every current scoring rule, result method, lock boundary, correction and refresh scenario. |
| Architecture | **6/10** | Good domain/service/feature separation and lazy routes. Core prediction orchestration is concentrated in one large provider, compound writes are client-coordinated and important invariants are not encoded at the database boundary. | Transactional RPCs for compound operations, explicit state machines, database-enforced domain scope and clearer responsibility boundaries. |
| Code quality | **6/10** | Naming and comments are generally strong. Strict TypeScript is disabled, database results are manually cast, several reads fail silently and some comments/docs are stale. | Strict typing, generated DB contracts, runtime parsing at trust boundaries and consistent explicit error handling. |
| Frontend maintainability | **6/10** | Feature folders and CSS Modules are positive. `PredictionsProvider.tsx`, `ReviewPage.tsx`, `MatchCentreScreen.tsx` and `LeagueDetailPage.tsx` are becoming coordination hotspots. | Smaller cohesive hooks/modules, uniform query states and rendered journey tests. |
| Backend maintainability | **5/10** | Append-only migrations and narrow RPCs are useful. Cross-entity scope is incomplete, result progression is manual and large scoring functions mix derivation, deletion and persistence. | Tested invariants, safe admin operations, generated contracts, migration CI and documented recovery. |
| UI consistency | **7/10** | Shared tokens, controls, shell and CSS Modules indicate a coherent system. The audited deploy has strong automated root Lighthouse results. Full authenticated visual comparison was unavailable. | Browser-verified design contracts across every route and visual-regression coverage. |
| Mobile experience | **6/10** | Mobile-first components, bottom navigation and compact layouts are evident. The latest deploy reports automated mobile Lighthouse performance of 97. Authenticated 320 px, landscape and large-text testing was not completed. | Manual and automated testing from 320 px upward, large text, safe-area and keyboard behaviour. |
| Accessibility | **6/10** | Labels, status roles and a strong modal implementation are present. No skip link or route-change announcement was identified, and an ARIA menu lacks the full keyboard pattern. Root automated Lighthouse reports 100, but that is not a full WCAG audit. | WCAG 2.2 AA verification with axe plus keyboard, screen-reader, zoom, focus, contrast and dynamic-state testing. |
| Security | **4/10** | RLS is widespread and security-definer functions generally pin search path. Direct submission timestamps and unprotected group-position rows defeat important application rules. | Least-privilege policies/grants, complete server validation, RLS tests, admin audit controls, abuse controls and verified environment isolation. |
| Data integrity | **3/10** | Missing group-position persistence, cross-tournament FK gaps, partial bracket validation and no resolved knockout winner are fundamental. | Composite scope constraints or validation triggers, transactional writes, complete result lifecycle and reconciliation tests. |
| Performance | **6/10** | Lazy routes, modest static assets and a 97 automated root performance score are positive. Home has sequential per-league requests; no authenticated bundle/query profiling or pagination evidence exists. | Route budgets, measured Core Web Vitals, batched summaries, pagination and profiled SQL indexes at expected capacity. |
| Reliability | **4/10** | Fail-soft loads can show valid-looking empty data; no active refresh strategy exists; bracket writes are non-atomic; scoring recompute has a documented concurrency race. | Explicit degraded states, idempotent transactions, stale-data strategy, advisory locking and outage/fault-injection tests. |
| Testing | **4/10** | Approximately 326 tests show strong domain-test intent. No disposable database, RLS/policy tests, migration tests, E2E journeys, responsive tests or repository CI were identified. | A complete project-specific pyramid: domain, SQL/RLS, integration, E2E, accessibility and visual tests in CI. |
| Deployment and operations | **4/10** | Production deploys successfully through Netlify and includes security headers and secret scanning. No repository CI, monitoring, safe schema gate, recovery rehearsal or safe rollback exists; current docs point rollback at development data. | Gated releases, environment-isolated staging, production-only rollback, monitoring, backups, alerts and rehearsed incident procedures. |
| Documentation | **5/10** | Documentation records many decisions and current future-mode boundaries. README and result-entry status are stale; admin bootstrap conflicts with the schema; large append-only files obscure current truth. | One concise authoritative status/architecture source, validated runbooks and automated docs checks. |
| Repository hygiene | **7/10** | No committed secret was identified, Netlify secret scan found no match, one lockfile exists and no build output was committed. A few scaffold/reference leftovers and extensive historical documents remain. | Verified import cleanup, pinned runtime, licence/release policy and repository/branch-rule review. |
| Future maintainability | **5/10** | The domain layer supports growth, but active rules are duplicated across TypeScript, SQL, tests and docs without differential execution. Planned bonus-game documents also create scope noise. | One enforceable current-rule contract, typed boundaries, SQL differential tests and clean separation between active scope and future plans. |

No category receives 10/10 because no area has sufficient production evidence to justify it.

---

# 3. Critical findings

## DATA-001 — Group-position predictions are scored but never persisted by the application

**ID:** DATA-001  
**Title:** Current group-position scoring has no client persistence path  
**Severity:** Critical  
**Confidence:** Confirmed  
**Category:** Data / Functional correctness  
**Evidence:**

- `supabase/migrations/20260719120000_init_v0_1.sql:163-176` creates `predicted_group_positions`.
- `supabase/migrations/20260721120000_scoring_positions_knockout_awards.sql` awards §2 points by reading `predicted_group_positions`.
- Repository-wide runtime search found no `src/` service, provider or feature that reads or writes that table.
- `src/app/providers/PredictionsProvider.tsx` loads score predictions, tie resolutions, progression and Golden Boot, but not final group-position rows.
- The UI derives group order in memory from score predictions and tie resolutions.

**Problem:** The scoring engine expects materialised final predicted positions, but the application never saves them.

**Impact:** A normal complete entry can receive zero group-position points despite displaying a predicted group table. This can change league winners.

**Recommended fix:**

1. Derive the 24 final position rows from the same group/tie logic used by the UI.
2. Save them through one transaction/RPC.
3. Reconcile them when the entry loads.
4. Recompute affected positions whenever a group score or tie resolution changes.
5. Validate exactly positions 1–4 with four unique in-group teams.
6. Backfill and verify existing complete entries.

**Validation:**

- Complete all six groups and confirm exactly 24 rows.
- Refresh and confirm the displayed order matches persisted rows.
- Alter a score/tie and confirm only the correct positions change atomically.
- Enter actual final group results and hand-check §2 score events.
- Run a TypeScript-versus-SQL differential test.

**Dependencies:** SECURITY-001, DATA-003 and the chosen transaction design.

---

## SECURITY-001 — Group-position scoring inputs bypass lock and version controls

**ID:** SECURITY-001  
**Title:** Owners can alter group-position rows after tournament lock  
**Severity:** Critical  
**Confidence:** Confirmed  
**Category:** Security / Data integrity  
**Evidence:**

- `supabase/migrations/20260719120000_init_v0_1.sql:245-254` grants owners `FOR ALL` access to their `predicted_group_positions`.
- `supabase/migrations/20260719170000_lock_and_leaderboard.sql` creates lock triggers for match predictions, tie resolutions, progression and bonus predictions, but not this table.
- `supabase/migrations/20260722120000_write_integrity.sql:44-46` adds versions only to match predictions, progression and bonus predictions.
- The SQL scoring function trusts these rows.

**Problem:** Any authenticated owner can bypass the UI and use Supabase’s API to insert, update or delete these rows after seeing tournament results.

**Impact:** Post-deadline manipulation can alter leaderboard points during any later recomputation.

**Recommended fix:**

- Add insert/update/delete lock enforcement.
- Remove unrestricted direct client mutation in favour of one validated RPC.
- Add revision checking or immutable snapshots.
- Validate tournament, group and team scope.
- Audit existing rows close to and after lock.

**Validation:**

- Test direct REST insert, update and delete before and after lock.
- Invalid scope and every post-lock mutation must fail server-side.
- Admin corrections must use an explicit privileged path and leave an audit record.

**Dependencies:** DATA-001.

---

## SECURITY-002 — Submission validation can be bypassed by updating `entries.submitted_at`

**ID:** SECURITY-002  
**Title:** Submission state is directly writable by the entry owner  
**Severity:** Critical  
**Confidence:** Confirmed  
**Category:** Security / Functional correctness  
**Evidence:**

- `entries.submitted_at` is an ordinary nullable column in `supabase/migrations/20260719120000_init_v0_1.sql:133-140`.
- The `"own entries"` policy is `FOR ALL` at lines 227-231.
- `src/services/supabase/predictions.ts` uses `submit_entry()`, but database policy does not require that path.
- Leaderboard and reveal functions rely on `submitted_at is not null`.

**Problem:** A client can directly stamp, clear or change the submission timestamp without passing server completeness checks.

**Impact:** Malformed/incomplete entries can become eligible for standings and post-lock comparison. The timestamp is not reliable proof of a valid submission.

**Recommended fix:**

- Split the broad policy into operation-specific policies.
- Deny authenticated clients direct update permission on submission fields.
- Make `submit_entry()` the only authenticated transition.
- Decide whether submission is monotonic and whether an explicit `submission_source` is required.
- Revalidate all existing submitted rows.

**Validation:**

- Direct Supabase API update of `submitted_at` fails.
- Valid RPC submission succeeds.
- Incomplete, malformed and foreign-scope entries fail.
- Legacy invalid submissions are excluded or repaired.

**Dependencies:** DATA-003 and FUNC-001.

---

## DATA-002 — Knockout results cannot represent extra time, penalties or an authoritative winner

**ID:** DATA-002  
**Title:** The current result schema cannot resolve a tied knockout match  
**Severity:** Critical  
**Confidence:** Confirmed  
**Category:** Data / Product correctness  
**Evidence:**

- `matches` contains only `home_score` and `away_score` in `supabase/migrations/20260719120000_init_v0_1.sql:99-124`.
- There is no winner, result method, extra-time score or penalty score field.
- The scoring migration identifies champion/progression from score comparison.
- `src/features/h2h/H2HPage.tsx` explicitly avoids treating tied knockout matches as resolved.
- No production `confirm_match_result` RPC or admin route exists.

**Problem:** A real knockout tie can finish level under the stored score representation but still have a winner.

**Impact:** Round-of-16 progression, later participants, H2H health, knockout points and the champion can be wrong or absent.

**Recommended fix:**

Create an explicit result lifecycle containing:

- regulation score;
- extra-time score when applicable;
- penalty score when applicable;
- result method;
- authoritative winner team;
- provisional/confirmed/corrected status;
- confirming actor and timestamp.

Use one privileged transactional result-confirmation operation.

**Validation:**

Test regulation, extra-time and penalties in every round, including corrections and a final won on penalties. Downstream participants and score events must update atomically and exactly once.

**Dependencies:** REL-001 and owner confirmation of how displayed scores correspond to official scoring.

---

# 4. High-priority findings

## DATA-003 — Same-tournament relationships are not enforced

**ID:** DATA-003  
**Title:** Predictions can reference matches, groups, teams or players from another tournament  
**Severity:** High  
**Confidence:** Confirmed  
**Category:** Data / Security  
**Evidence:**

- Prediction tables have independent foreign keys to entries and referenced records.
- There is no composite constraint proving both sides share `tournament_id`.
- `submit_entry()` counts completed group predictions by `entry_id` and `m.round = 'group'` without explicitly scoping the joined match to the entry tournament.
- Group-position and bonus relationships have the same structural issue.

**Problem:** Ownership of an entry is checked, but scope of every referenced object is not.

**Impact:** With two tournaments, crafted rows can satisfy completion, contaminate score calculations or produce impossible picks.

**Recommended fix:** Add composite unique/FK relationships where practical or immutable validation triggers/RPCs for every relationship.

**Validation:** Seed two tournaments and run adversarial inserts/updates for every table.

**Dependencies:** Existing-data audit.

---

## FUNC-001 — Server submission checks bracket shape, not a valid bracket tree

**ID:** FUNC-001  
**Title:** Impossible winner combinations can pass submission  
**Severity:** High  
**Confidence:** Confirmed  
**Category:** Functional correctness / Data  
**Evidence:**

- `supabase/migrations/20260722120000_write_integrity.sql:129-176` checks progression counts, total rows and tournament membership.
- Lines 153-154 explicitly say full tie-participant validation remains a separate larger check.
- Direct pre-lock owner writes to `predicted_progression` are permitted.

**Problem:** Eight rows in the right stage buckets are not proof that every winner was a participant in its tie.

**Impact:** A crafted impossible bracket can be marked submitted and potentially score.

**Recommended fix:** Submit a complete bracket snapshot or tie-winner set to the server and replay all 15 ties against the predicted group outcome.

**Validation:** Generate valid and intentionally impossible trees; only deterministic replayable trees should submit.

**Dependencies:** DATA-001 and an atomic bracket snapshot.

---

## FUNC-002 — Automatic deadline submission is documented but not implemented

**ID:** FUNC-002  
**Title:** Lock finalisation has no server implementation  
**Severity:** High  
**Confidence:** Confirmed  
**Category:** Functional correctness / Reliability  
**Evidence:**

- `docs/scoring-rules.md:109-114` defines automatic submission of every valid entry at lock.
- Current roadmap/TODO documentation still treats it as unbuilt.
- No scheduled function, cron workflow or server operation was found.
- `submit_entry()` does not check `tournaments.lock_at`.

**Problem:** A complete user who forgets the button can be excluded, while a direct RPC caller may submit after lock.

**Impact:** Eligibility is inconsistent and can be unfair at the opening kickoff.

**Recommended fix:** Implement one server-authoritative deadline finalisation process, or amend the authoritative rules if auto-submit is no longer required.

**Validation:** Use a fake clock and test complete, incomplete, concurrently edited and late entries at the exact boundary.

**Dependencies:** REL-003 and full server validation.

---

## REL-001 — Score recomputation is not serialised

**ID:** REL-001  
**Title:** Concurrent result writes can temporarily omit score events  
**Severity:** High  
**Confidence:** Confirmed  
**Category:** Reliability / Operations  
**Evidence:**

- `docs/ops-result-entry.md` documents a delete-and-rederive race.
- The runbook instructs operators to use one SQL-editor session.
- No tournament advisory lock has landed.
- No single production result-confirmation operation exists.

**Problem:** Two result transactions can delete and rebuild score events from different snapshots.

**Impact:** A leaderboard can temporarily be incomplete until another recomputation.

**Recommended fix:** Add a tournament-scoped transaction advisory lock and combine result confirmation, progression and scoring in one transaction.

**Validation:** Execute simultaneous result confirmations in an isolated database and compare final events under every order.

**Dependencies:** DATA-002.

---

## DATA-004 — Actual group ties fall back to original slot order

**ID:** DATA-004  
**Title:** The SQL actual-table resolver has a non-authoritative final fallback  
**Severity:** High  
**Confidence:** Confirmed  
**Category:** Data / Functional correctness  
**Evidence:**

- `_resolve_group_cluster()` in `20260721120000_scoring_positions_knockout_awards.sql:123-138` orders fully unresolved actual teams by `group_teams.slot`.
- No actual/admin tie-resolution record exists.

**Problem:** Seed/slot order is deterministic software behaviour, not necessarily the official competition outcome.

**Impact:** Group-position points and knockout participants can be wrong in a fully unresolved tie case.

**Recommended fix:** Implement the complete applicable official regulations and retain an explicit authoritative override for criteria the application does not model.

**Validation:** Test official and synthetic fully tied groups and record the source of every final order.

**Dependencies:** Reverification of official Euro 2028 regulations before launch.

---

## DATA-005 — Clearing a score does not clear the stored prediction

**ID:** DATA-005  
**Title:** An empty score box can conceal an old saved value  
**Severity:** High  
**Confidence:** Confirmed  
**Category:** Data / UX  
**Evidence:**

- `src/design-system/ScoreInput.tsx:62-69` emits `null` when cleared.
- `src/app/providers/PredictionsProvider.tsx:343-355` schedules persistence only when both scores are non-null.
- No match-prediction deletion service was identified.

**Problem:** The prior complete row remains in Supabase while local UI appears blank.

**Impact:** Refresh restores the old prediction; submission/lock can include a value the user believed was removed.

**Recommended fix:** Define and implement versioned clear/delete semantics.

**Validation:** Save, clear one side, refresh and inspect the database; the empty state must persist.

**Dependencies:** Lock-safe delete behaviour.

---

## REL-002 — Entry state becomes ready before all critical prediction data loads

**ID:** REL-002  
**Title:** Late best-effort reads can overwrite active user state  
**Severity:** High  
**Confidence:** Confirmed  
**Category:** Reliability / Frontend architecture  
**Evidence:**

- `PredictionsProvider.tsx` sets ready after loading match predictions.
- Tie resolutions, progression and Golden Boot load later.
- Read errors fall back to empty/default state.

**Problem:** Pages can accept edits before the server baseline for all categories is known.

**Impact:** A late response can overwrite a new interaction, and a failed read looks like a genuinely empty selection.

**Recommended fix:** Use an explicit provider state machine and do not mark submission-critical sections ready until their baseline is known.

**Validation:** Throttle/fail each category independently and interact during loading.

**Dependencies:** Rendered integration tests.

---

## REL-003 — Submit does not flush pending autosaves

**ID:** REL-003  
**Title:** The final visible edit may not reach the server before submission  
**Severity:** High  
**Confidence:** Confirmed  
**Category:** Reliability / Functional correctness  
**Evidence:**

- Match and bracket saves are debounced.
- `PredictionsProvider.submit()` calls `submitEntry()` immediately without flushing timers or waiting for idle/acknowledged save state.

**Problem:** Client completion and server completion can differ at confirmation.

**Impact:** Submit can fail unexpectedly or stamp the previous persisted state.

**Recommended fix:** Add `flushAllAndWait()` and block confirmation while saves are pending, failed or conflicted.

**Validation:** Make the final change and submit immediately under network throttling.

**Dependencies:** Save-controller update.

---

## REL-004 — Bracket persistence is not atomic

**ID:** REL-004  
**Title:** Independent row writes can leave a partial bracket  
**Severity:** High  
**Confidence:** Confirmed  
**Category:** Reliability / Data  
**Evidence:**

- The provider computes multiple upserts/deletes and executes them with `Promise.all`.
- Individual rows may commit before another request fails.
- Deletes do not have expected-version protection.

**Problem:** A bracket is one logical object but is persisted as unrelated client requests.

**Impact:** Refresh, another device or submission can encounter an impossible mixed snapshot.

**Recommended fix:** Replace fan-out writes with one transactional snapshot RPC and one expected revision.

**Validation:** Fault-inject after arbitrary writes and prove all-or-nothing storage.

**Dependencies:** FUNC-001.

---

## DATA-006 — Tournament selection and reference-data loading are not multi-tournament safe

**ID:** DATA-006  
**Title:** The client selects the oldest tournament and fetches all group-team rows  
**Severity:** High  
**Confidence:** Confirmed  
**Category:** Data / Architecture  
**Evidence:**

- `src/services/supabase/tournamentData.ts` orders tournaments ascending by year and takes the first.
- `group_teams` is fetched without tournament/group scoping.
- Failure to load the lock timestamp becomes `null`.

**Problem:** The single-active-tournament assumption is not encoded.

**Impact:** A future/historic/test tournament can select or blend wrong data; lock errors can make the UI appear editable.

**Recommended fix:** Use an explicit active tournament identifier and scope every query. A missing authoritative lock must be a blocking error.

**Validation:** Load two tournaments and verify isolation.

**Dependencies:** Product decision on future competition support.

---

## OPS-001 — Production rollback documentation points users to the development database

**ID:** OPS-001  
**Title:** Current rollback procedure crosses environment boundaries  
**Severity:** High  
**Confidence:** Confirmed  
**Category:** Deployment / Security  
**Evidence:**

- `docs/ops-prod-cutover.md` instructs swapping live Netlify configuration back to development Supabase values.

**Problem:** Application rollback and database-environment switching are conflated.

**Impact:** Real users can see test data or write into development; CAPTCHA and environment controls can mismatch.

**Recommended fix:** Roll back to an immutable prior production deploy while retaining the production database. Document schema/data recovery separately.

**Validation:** Rehearse on staging without changing database environment.

**Dependencies:** Hosting and backup access.

---

## OPS-002 — Admin bootstrap documentation references a schema column that does not exist

**ID:** OPS-002  
**Title:** Production admin setup is not reproducible from migrations  
**Severity:** High  
**Confidence:** Confirmed for repository schema  
**Category:** Operations / Documentation / Security  
**Evidence:**

- `docs/ops-admin-bootstrap.md` and `docs/ops-prod-cutover.md` instruct setting `profiles.role = 'admin'`.
- No migration adds a `role` column to `profiles`.
- Runtime source does not contain a current admin-role model.

**Problem:** Either the runbook fails or production has unversioned drift.

**Impact:** A fresh environment cannot reproduce the intended admin setup; future authorisation work may be built on a false assumption.

**Recommended fix:** Compare production schema with migrations. Version the real role model or correct the runbook.

**Validation:** Build a blank database from migrations and execute the documented bootstrap exactly.

**Dependencies:** Read-only production schema access.

---

## TEST-001 — The current tests do not execute the database rules that determine competition integrity

**ID:** TEST-001  
**Title:** No migration, RLS, trigger or full-journey test layer  
**Severity:** High  
**Confidence:** Confirmed  
**Category:** Testing  
**Evidence:**

- Existing tests concentrate on TypeScript domain and selected rendering.
- No test harness applies migrations to disposable PostgreSQL/Supabase.
- No test authenticates multiple users against real RLS.
- No Playwright/Cypress setup exists.
- No CI workflow is included.

**Problem:** The suite can pass while the critical findings in this report remain present.

**Impact:** Green unit tests can give false confidence in the real competition.

**Recommended fix:** Add:

1. domain unit tests;
2. migration/SQL tests;
3. RLS and RPC tests under real JWT roles;
4. SQL-versus-TypeScript differential scoring;
5. provider/page integration tests;
6. a small Playwright journey suite;
7. accessibility and responsive checks.

**Validation:** Each critical issue must have a regression test that fails before its repair.

**Dependencies:** Isolated test database and CI.

---

## OPS-003 — Release, monitoring and recovery controls are incomplete

**ID:** OPS-003  
**Title:** Production operation is not fully observable or reproducible  
**Severity:** High  
**Confidence:** Confirmed for repository contents  
**Category:** Deployment and operations  
**Evidence:**

- No repository CI workflow.
- No pinned Node runtime.
- No error-reporting integration or structured production logging.
- No uptime/alert ownership.
- No rehearsed database restore procedure.
- `netlify.toml` contains routing/headers but not the complete release policy.
- Current deploy has no serverless or edge functions.

**Problem:** Safety depends heavily on manual dashboard configuration and operator memory.

**Impact:** A build, migration, environment or scoring failure can reach users or remain silent.

**Recommended fix:** Version-control runtime/build settings, require CI checks, isolate staging/preview data, add production approval gates, monitoring and tested restore procedures.

**Validation:** Rebuild a fresh staging environment using only the repo/runbooks and rehearse deployment failure, app rollback and DB restore.

**Dependencies:** Platform access.

---

# 5. Medium-priority findings

## REL-005 — No active tournament data-refresh strategy

**ID:** REL-005  
**Title:** Open pages can remain convincingly stale  
**Severity:** Medium  
**Confidence:** High confidence  
**Category:** Reliability / UX  
**Evidence:** No global realtime subscription, polling, focus-refetch or current-data invalidation pattern was identified.

**Problem:** Result, rank and score changes may not appear until navigation or refresh.

**Impact:** Users can believe stale league or match-centre data is current.

**Recommended fix:** Add visible last-updated state and a measured refresh strategy.

**Validation:** Enter a result while multiple pages remain open.

**Dependencies:** Safe result lifecycle.

---

## REL-006 — First entry creation has a two-tab race

**ID:** REL-006  
**Title:** Concurrent first-use requests can produce a unique-conflict failure  
**Severity:** Medium  
**Confidence:** Confirmed  
**Category:** Reliability  
**Evidence:** Entry creation is select-then-insert despite a unique `(user_id, tournament_id)` constraint.

**Problem:** One concurrent request wins; another may surface the unique violation rather than reselecting the row.

**Impact:** A new user can see an avoidable error/loading failure on two devices or tabs.

**Recommended fix:** Use an idempotent RPC/upsert and reselect on conflict.

**Validation:** Fire two first-entry calls simultaneously.

**Dependencies:** None.

---

## REL-007 — Progression deletion is outside optimistic concurrency

**ID:** REL-007  
**Title:** A stale device can delete a newer bracket pick  
**Severity:** Medium  
**Confidence:** Confirmed  
**Category:** Reliability / Data  
**Evidence:** Version checks run on update; progression deletion is a direct delete.

**Problem:** The concurrency contract does not cover every mutation.

**Impact:** A stale tab can remove a newer selection without a conflict state.

**Recommended fix:** Use expected-version delete or one atomic bracket snapshot.

**Validation:** Delete from a stale session after another session changes the row.

**Dependencies:** REL-004.

---

## PERF-001 — Home has a sequential per-league request pattern

**ID:** PERF-001  
**Title:** League summary requests scale linearly and serially  
**Severity:** Medium  
**Confidence:** Confirmed  
**Category:** Performance  
**Evidence:** `src/features/home/useHomeData.ts` loops through leagues and awaits member requests one at a time.

**Problem:** Time to render grows with the number of leagues.

**Impact:** Slow mobile home experience and hidden partial failures.

**Recommended fix:** Add one league-summary RPC, or temporarily parallelise with a safe concurrency limit.

**Validation:** Compare request count and render time with 1, 10 and 20 leagues.

**Dependencies:** RPC design.

---

## UX-001 — Logged-out invite handling mutates storage during render

**ID:** UX-001  
**Title:** Invite context is hidden behind generic signup  
**Severity:** Medium  
**Confidence:** Confirmed  
**Category:** UX / Code quality  
**Evidence:** `JoinLandingPage.tsx` stores the pending code while rendering and redirects unauthenticated visitors before a league preview is shown.

**Problem:** Render has a side effect, and visitors cannot confirm the destination before creating an account.

**Impact:** Repeated storage writes in strict rendering and reduced trust/conversion.

**Recommended fix:** Move persistence to an effect and add a privacy-safe public preview if approved.

**Validation:** Open, refresh, sign up and resume valid/invalid/revoked invites.

**Dependencies:** Privacy decision.

---

## A11Y-001 — No skip link or route-change announcement system

**ID:** A11Y-001  
**Title:** SPA navigation lacks a complete assistive-technology transition  
**Severity:** Medium  
**Confidence:** High confidence from static inspection  
**Category:** Accessibility  
**Evidence:** No skip link, route focus manager, route live region or dynamic title manager was identified.

**Problem:** Keyboard users repeat navigation and screen-reader users may not know a route changed.

**Impact:** Slower and disorienting navigation.

**Recommended fix:** Add skip-to-main, route titles and page-heading focus/announcement.

**Validation:** Manual NVDA/VoiceOver and keyboard testing.

**Dependencies:** App shell.

---

## A11Y-002 — League options announces an ARIA menu without implementing its keyboard model

**ID:** A11Y-002  
**Title:** Custom menu semantics do not match behaviour  
**Severity:** Medium  
**Confidence:** Confirmed  
**Category:** Accessibility  
**Evidence:** `LeagueDetailPage.tsx` uses menu/menuitem roles but lacks initial focus, arrow keys, Home/End and complete Escape restoration.

**Problem:** Assistive technology is told to expect a menu interaction model that is not present.

**Impact:** Keyboard operation is confusing.

**Recommended fix:** Implement the full menu-button pattern or use a simple disclosure with normal buttons.

**Validation:** Keyboard and screen-reader check.

**Dependencies:** None.

---

## TYPE-001 — TypeScript and Supabase boundaries are weakly typed

**ID:** TYPE-001  
**Title:** Hand-written casts can hide schema drift  
**Severity:** Medium  
**Confidence:** Confirmed  
**Category:** Code quality / Reliability  
**Evidence:**

- TypeScript strict mode is not enabled.
- `skipLibCheck` is enabled.
- No generated Supabase database types were found.
- No runtime validator guards critical RPC result shapes.

**Problem:** Migration/client mismatches can survive compilation and fail only at runtime.

**Impact:** Production-only null/shape failures can become incorrect defaults.

**Recommended fix:** Generate database types, enable strict mode incrementally and parse critical responses.

**Validation:** Strict build and deliberate schema-shape change.

**Dependencies:** Dependency install and schema access.

---

## DOC-001 — Current truth is mixed with stale status and historical planning

**ID:** DOC-001  
**Title:** Repository documentation is extensive but not consistently authoritative  
**Severity:** Medium  
**Confidence:** Confirmed  
**Category:** Documentation / Maintainability  
**Evidence:**

- README status says some implemented areas are TODO.
- `docs/ops-result-entry.md` says only §1 scoring is active despite the later §2–§4 migration.
- Admin bootstrap conflicts with migrations.
- `CLAUDE.md`, roadmap, design and TODO files contain long historical updates and changing snapshots.

**Problem:** A developer or AI agent can follow obsolete instructions.

**Impact:** Duplicate work, unsafe operations and wrong assumptions about deployed state.

**Recommended fix:** Add concise `PROJECT-STATUS.md` and `ARCHITECTURE.md`, archive dated logs and validate runbook references.

**Validation:** New-developer setup/review exercise.

**Dependencies:** Production schema reconciliation.

---

## SEC-001 — Invite token and aggregate disclosure need an abuse review

**ID:** SEC-001  
**Title:** Current small-user privacy controls may be insufficient  
**Severity:** Medium  
**Confidence:** High confidence  
**Category:** Security / Privacy  
**Evidence:** Invite codes are comparatively short, and several RPCs expose cross-user/aggregate information after eligibility checks.

**Problem:** A small competition makes inference and enumeration more material.

**Impact:** League existence or participant preferences may be inferred through repeated probing.

**Recommended fix:** Longer cryptographic invite tokens, endpoint throttling and minimum-cohort rules where appropriate.

**Validation:** Enumeration/concurrency tests using multiple accounts.

**Dependencies:** Owner privacy decision.

---

## SEC-002 — Raw database messages can reach users

**ID:** SEC-002  
**Title:** Internal error wording is exposed in several flows  
**Severity:** Medium  
**Confidence:** High confidence  
**Category:** Security / UX  
**Evidence:** Several components display `Error.message` directly.

**Problem:** PostgreSQL/Supabase details can appear in the interface.

**Impact:** Confusing UX and unnecessary internal information disclosure.

**Recommended fix:** Map known SQLSTATE/error codes to safe messages and log private diagnostics with correlation IDs.

**Validation:** Force RLS, constraint, network and RPC errors.

**Dependencies:** Observability.

---

## DATA-007 — Rate limiting is count-then-insert rather than strictly atomic

**ID:** DATA-007  
**Title:** Simultaneous requests can exceed the intended threshold  
**Severity:** Medium  
**Confidence:** High confidence  
**Category:** Security / Reliability  
**Evidence:** The database rate-limit approach counts recent events and then records/permits the action without a per-user/action serialisation mechanism.

**Problem:** Concurrent transactions can all observe a count below the limit.

**Impact:** Current limits deter ordinary abuse but are not hard guarantees.

**Recommended fix:** Use an atomic bucket or advisory lock.

**Validation:** Concurrent burst test.

**Dependencies:** Load-test harness.

---

## UX-002 — Partial failures can display zeros and empty arrays as facts

**ID:** UX-002  
**Title:** “Unavailable” and “none” are visually conflated  
**Severity:** Medium  
**Confidence:** Confirmed  
**Category:** UX / Reliability  
**Evidence:** Home catches several request failures and substitutes empty collections/skips sections.

**Problem:** A backend failure can look like zero points, no leagues or no activity.

**Impact:** Users reasonably trust incorrect empty information.

**Recommended fix:** Preserve last known data, expose partial-data metadata and offer retry.

**Validation:** Fail each request independently.

**Dependencies:** Shared query-state pattern.

---

## PERF-002 — Scoring recomputes the entire tournament

**ID:** PERF-002  
**Title:** Result changes trigger whole-tournament delete and re-derive work  
**Severity:** Medium  
**Confidence:** High confidence; performance impact unmeasured  
**Category:** Performance / Reliability  
**Evidence:** Current scoring functions rebuild score events for the tournament.

**Problem:** The simple idempotent design may become expensive with the expected user cap.

**Impact:** Result entry can block or delay leaderboards if query time grows.

**Recommended fix:** Measure first. Keep full recompute as recovery; optimise incrementally only if load data requires it.

**Validation:** Seed the target 250-user workload and profile transaction duration/locks.

**Dependencies:** Disposable database.

---

# 6. Low-priority findings

| ID | Finding | Evidence / impact | Recommendation |
|---|---|---|---|
| HYGIENE-001 | Unused Vite scaffold asset | `src/assets/vite.svg` has no identified runtime import. | Remove only after a clean build/import check. |
| HYGIENE-002 | Some pure modules appear test/reference-only | `src/domain/rateLimit.ts`, `src/domain/tournament/seedData.ts` and `calculateLeagueRank.ts` are not in the current runtime import graph. | Mark their role clearly or consolidate after behaviour review. |
| CODE-001 | Several orchestration files are large | The prediction provider and some feature screens combine data, routing and presentation concerns. | Split after integrity behaviour stabilises. |
| OPS-004 | Node runtime is not pinned | No `engines`, `.nvmrc` or explicit Netlify runtime file. | Pin a supported LTS version and test it in CI. |
| SEO-001 | SPA fallback produces soft 404 responses | Netlify routes all unknown paths to `index.html`. | Document/accept for private app or add server/edge handling for public crawlable pages. |
| SEO-002 | Metadata is largely global | Static `index.html` metadata serves most paths. | Add route-specific titles; richer SEO only for public pages. |
| A11Y-003 | Bottom navigation is imperative rather than link-semantic | It works as app navigation but lacks normal link affordances. | Prefer `NavLink` where practical. |
| UX-003 | Other-player profile action is a placeholder | The league page reports that player profiles are coming soon. | Hide or label unavailable until implemented. |
| UX-004 | Sign-out is immediate | Roadmap discusses confirmation, but current action signs out directly. | Decide based on user testing; not launch-critical. |
| DATA-008 | Score values have no practical database maximum | Schema enforces non-negative `smallint`; UI accepts two digits. | Add a documented operational maximum or exception policy. |
| DOC-002 | Package version remains `0.0.0` | `package.json:4`. | Add release/version identification. |
| DOC-003 | Dev gallery is large and partly historical | `src/dev/ComponentsPreview.tsx` includes many examples and future designs. | Retain only canonical active component states. |
| REPO-001 | No licence/changelog/editor baseline | None identified. | Add according to ownership and release policy. |

---

# 7. Positive findings to preserve

1. **Pure domain layer:** scoring, group tables, tie resolution, bracket and other calculations are testable without React.
2. **Current scope is technically separated from future bonus games:** no bonus-game route/table/service was found in runtime.
3. **Route-level code splitting:** every leaf screen is lazy loaded.
4. **Dev-only gallery exclusion:** `/dev/components` is eliminated from production.
5. **Service boundary:** Supabase requests are concentrated under `src/services/supabase/`.
6. **Broad RLS:** all identified data tables enable RLS.
7. **Security-definer hygiene:** inspected functions pin `search_path`.
8. **Database-side lock intent:** existing score, tie, progression and bonus writes are not protected only by hidden UI.
9. **Save coordination:** same-key writes are serialised and transient/conflict outcomes are distinguished.
10. **Development safeguards:** autologin and seed scripts are pinned to the intended development project and default to safe/dry operation.
11. **Accessible modal:** Escape, focus entry, trapping, restoration and scroll locking are implemented.
12. **Security headers:** CSP, HSTS, frame denial, MIME protection, referrer and permissions policies are deployed.
13. **No unsafe HTML sink identified:** no `dangerouslySetInnerHTML` usage was found.
14. **Self-hosted fonts:** avoids a third-party font dependency at runtime.
15. **Append-only migration practice:** later fixes are new migration files.
16. **Destructive league confirmations:** leaving/deleting/transferring are not casual one-click actions.
17. **Substantial domain test intent:** the existing suite is worth extending.
18. **Netlify deployment health:** the current `main` commit deploys successfully and automated root metrics are strong.
19. **No secret match in Netlify’s current deploy scan.**
20. **No exact duplicate-content files were found in the static duplicate scan.**

---

# 8. Feature-completeness matrix

This matrix covers only current repository scope. “Original knockout bracket” is part of the Original Predictor and is not the separately planned KO Predictor.

| Feature | Status | Frontend | Backend/Data | Tests | Main concern |
|---|---|---|---|---|---|
| Login | Implemented | `/auth/login` | Supabase Auth | Service/validation tests | Live provider settings not independently verified |
| Signup | Implemented | `/auth/signup`, Turnstile | Auth/profile trigger/moderation | Validation/service tests | Email-confirmation and abuse settings external |
| Password reset | Implemented | `/auth/reset`, `/auth/update-password` | Supabase Auth | Service tests | Expired/reused-link E2E absent |
| Welcome onboarding | Implemented | `/welcome` | Profile welcome timestamp | Gate tests | Read/write fail-soft behaviour |
| Theme switching | Implemented | Shell/More | Local preference | Theme tests/components | Browser matrix unverified |
| Tournament reference data | Partially implemented | Provider-driven | Tournament/team/group/match tables | Domain fixtures | Multi-tournament selection defect |
| Group score prediction | Implemented with defect | `/predict/groups/:letter` | `match_predictions` | Strong domain/save tests | Stored-score clearing defect |
| Predicted group table | Implemented in client | Group routes | Derived in memory | Group-table tests | Final positions not persisted |
| Predicted tie resolution | Implemented | Group/third-place flows | `predicted_tie_resolutions` | Tie tests | Late loading/version gap |
| Best third-place resolution | Implemented | `/predict/third-place` | Derived client-side | Domain tests | Depends on reliable tie state |
| Original winner-only bracket | Partially implemented | `/predict/bracket` | `predicted_progression` | Bracket/domain tests | Non-atomic writes and partial validation |
| Jokers | Implemented | `/predict/jokers` and match state | Joker column/triggers | Policy/domain tests | DB tests not executed |
| Golden Boot selection | Partially implemented | Picker/review | `players`, `bonus_predictions` | Domain/service tests | Production player data not loaded in baseline |
| Derived total group goals | Implemented | Review/scoring displays | Derived from 36 predictions | Domain tests | Correctly not separate user input |
| Review screen | Implemented | `/predict/review` | Reads all current entry state | Helper tests | Can render before all state baseline is safe |
| Manual submission | Partially implemented | Review CTA | `submit_entry()` | Helper tests | Direct bypass and pending-save race |
| Automatic submission at lock | Documented but not implemented | None | None found | None | Authoritative scoring doc promises it |
| Entry lock | Partially implemented | UI lock state | DB triggers for covered tables | Domain tests | Omits group positions and some deletes |
| Group-match scoring | Implemented | Points consumers | SQL score events | TypeScript tests | SQL not integration-tested |
| Group-position scoring | Broken end to end | No persistence | SQL implementation | TS calculation tests | Normal entries cannot supply rows |
| Original knockout progression scoring | Partially implemented | Points consumers | SQL progression scoring | TS tests | Actual knockout winner model incomplete |
| Golden Boot scoring | Database structure and code implemented | Points consumers | Tournament result + SQL | TS tests | Admin/result data lifecycle absent |
| Total-goals scoring | Implemented | Points consumers | SQL derives predicted/actual group total | TS tests | SQL differential not executed |
| Overall leaderboard | Implemented with integrity risk | `/league/overall` | RPC/view | Rank tests | Invalid direct submissions can enter |
| Private leagues | Implemented | `/league`, `/league/:id` | League/member RPCs | Domain/service tests | No full RLS/E2E |
| Invite deep links | Partially implemented | `/join/:code` | Preview/join RPC | Limited | Logged-out destination hidden |
| Ownership transfer/leave/delete | Implemented | League detail | Privileged RPCs | Limited | System/concurrency tests absent |
| H2H | Implemented with limitation | `/h2h/:rivalId` | Reveal/rival RPC | Domain tests | KO drawn results ignored; stale data |
| Match listing | Implemented basic | `/matches` | Matches table | Domain tests | No live refresh |
| Match centre | Implemented basic/current scope | `/match/:matchRef` | Match/aggregate RPCs | Domain tests | KO lifecycle and privacy thresholds |
| Home dashboard | Implemented basic/current scope | `/` | Multiple RPCs | Domain tests | N+1 and fail-soft empty data |
| Own profile | Implemented | `/profile` | Profile/score RPCs | Render/domain tests | Account deletion/export/session controls absent |
| Other-player full profile | UI placeholder only | League action shows coming-soon message | None | None | Not currently implemented |
| Share cards | Implemented | Client render/share flow | Client-side | Model tests | Browser output not manually verified |
| Scoring explanation | Implemented | `/more/scoring` | Reads active config/content | Tests indirect | Must stay synchronised with SQL |
| Admin control room | Documented but not implemented | No route | No active role model | None | Manual SQL only |
| Result entry/correction | Documented/manual only | No app route | Supabase Studio/SQL | No DB integration | Concurrency and audit risks |
| Reminder emails | Planned | None | No scheduler/function | None | Not current implementation |
| Monitoring/incident tooling | Not present in repo | None | None | None | Production blind spots |
| Public marketing landing page | Not present | Auth is public entry surface | N/A | N/A | Optional depending product strategy |

---

# 9. Route and page audit

“Mobile” and “Accessibility” assessments are code-based unless explicitly noted. The audit could not log into production and manually exercise every route.

| Route/Page | Purpose | Status | Mobile | Accessibility | Functional risks |
|---|---|---|---|---|---|
| `/auth/login` | Sign in | Implemented | Responsive styles present | Labels/errors present | External auth config and rate limits unverified |
| `/auth/signup` | Create account | Implemented | Responsive | Form semantics present | Confirmation policy/abuse controls external |
| `/auth/reset` | Request password reset | Implemented | Responsive | Neutral response is positive | Delivery and expired-link E2E absent |
| `/auth/update-password` | Complete recovery | Implemented | Responsive | Manual focus/session testing required | Recovery state edge cases |
| `/join/:code` | League invite landing | Partially implemented | Compact page | Basic controls | Storage mutation during render; no logged-out preview |
| `/welcome` | First-use onboarding | Implemented | Mobile-first | Headings/buttons | Fail-open/fail-soft profile checks |
| `/` | Dynamic home | Implemented basic | Phone-first design | Main shell exists | Stale data, sequential requests, false zero states |
| `/predict` | Original Predictor hub | Implemented | Mobile cards | Focus transition unverified | Post-lock morph/edge states incomplete |
| `/predict/groups/:letter` | Enter group scores | Implemented with defect | Compact cards | Score inputs have accessible names | Clearing persistence; invalid param runtime behaviour |
| `/predict/third-place` | Resolve predicted best thirds | Implemented | Mobile workflow | Table/controls need manual reading-order test | Late tie state and group-position persistence |
| `/predict/bracket` | Original winner-only bracket | Partially implemented | Round-at-a-time | Tabs/controls present | Non-atomic save, impossible bracket and stale delete |
| `/predict/jokers` | Place/move jokers | Implemented | Mobile cards | Manual focus test needed | DB policy tests absent |
| `/predict/review` | Validate and submit | Partially implemented | Sticky mobile action | Alerts/buttons present | Pending saves, direct submission bypass |
| `/league` | League hub | Implemented | Mobile-first | Needs manual test | Fail-soft data and no bonus-game content, correctly |
| `/league/overall` | Original Predictor global table | Implemented | Compact rows | Custom row semantics need review | No pagination; eligibility integrity |
| `/league/:id` | Private league detail | Implemented with placeholder | Mobile list/table | Menu pattern incomplete | Other-player profile not implemented |
| `/h2h/:rivalId` | Original Predictor comparison | Implemented | Responsive intent | Chart/reading order unverified | KO draw model; stale data |
| `/matches` | Browse tournament matches | Implemented basic | Filters/cards | Tab keyboard behaviour needs check | No live refresh/status lifecycle |
| `/match/:matchRef` | Match centre | Implemented basic | Dedicated compact screen | Dynamic announcements need review | KO/result model; aggregate privacy |
| `/more` | Settings/secondary navigation | Implemented | Mobile list | Controls appear semantic | No `/games`; future modes correctly absent |
| `/profile` | Own profile and points | Implemented | Mobile-first | Render test exists | Missing full account/privacy controls |
| `/more/points` | Legacy compatibility | Redirect | N/A | N/A | Keep until references are confirmed gone |
| `/more/scoring` | Explain current Original scoring | Implemented | Responsive content | Heading order should be manually checked | Duplicated source-of-truth risk |
| `/dev/components` | Dev component gallery | Development only | Broad examples | Not a production route | Very large and contains future concepts |
| `*` | Not-found recovery | Implemented client view | Responsive | Component tested | Netlify returns SPA HTTP 200 soft 404 |

### Hidden/admin/unreachable observations

- No production admin route is registered.
- No active `/games` route exists.
- No result-confirmation operation is exposed to the application.
- The component gallery is correctly absent from production.
- Several designs and roadmaps describe future screens but no runtime route supports them.

---

# 10. Dead, duplicate and obsolete code/documentation

No exact duplicate-content source files were found. Deletion must still wait for a successful local install/build/import analysis.

| File/area | Classification | Evidence | Action |
|---|---|---|---|
| `src/assets/vite.svg` | Likely unused scaffold asset | No import identified | Remove after clean build confirmation |
| `src/domain/rateLimit.ts` | Test/reference-only or future | Not in current runtime import graph | Document, relocate or wire deliberately |
| `src/domain/tournament/seedData.ts` | Test/reference fixture | Used outside runtime | Mark clearly as fixture/reference |
| `src/domain/tournament/calculateLeagueRank.ts` | Pure implementation not used by active leaderboards | Tests exist; runtime appears to rank by total only | Decide whether it is future final-ranking logic or superseded |
| `src/dev/ComponentsPreview.tsx` | Dev-only and partly future-oriented | Excluded from production; very large | Reduce to canonical active component states |
| `/more/points` | Intentional legacy route | Redirects to profile | Keep until references/analytics confirm safe removal |
| README status checklist | Obsolete | Contradicts active code | Rewrite |
| `docs/ops-result-entry.md` implementation-status note | Obsolete | Says §2–§4 deferred after migration landed | Correct |
| Admin bootstrap instructions | Invalid/stale | Refer to missing `profiles.role` | Reconcile with actual schema |
| Long historical sections in roadmap/TODO/CLAUDE docs | Historical mixed with current | Multiple dated snapshots | Archive and preserve concise current truth |
| Future-mode designs in `docs/design-system.md` | Valid design reference but not runtime | No matching route/data | Clearly label as future/prototype |

### Unsafe to delete without further evidence

- Any migration file.
- Seed/prod-baseline files referenced by operations.
- Any domain module used by tests until canonical replacement is agreed.
- CSS Modules or barrel exports, because static import search can miss indirect use.
- Historical production logs before actual schema/deploy state is reconciled.

---

# 11. Missing production requirements

## Mandatory before a real launch

1. Persist and validate final predicted group positions.
2. Protect every scoring input from post-lock direct writes.
3. Make submission state RPC-only.
4. Validate same-tournament scope across all prediction references.
5. Reconstruct and validate the entire submitted bracket server-side.
6. Model authoritative knockout winners, extra time and penalties.
7. Add one transactional result-confirmation operation.
8. Serialize score recomputation.
9. Implement automatic lock submission or revise the authoritative rule.
10. Flush/acknowledge all saves before submission.
11. Replace bracket fan-out with an atomic snapshot.
12. Add database migration/RLS/RPC tests.
13. Add SQL-versus-TypeScript scoring differential tests.
14. Add end-to-end entry, refresh, submit, lock, league and reveal tests.
15. Reconcile production schema with migrations.
16. Replace unsafe rollback procedure.
17. Pin runtime and add repository CI.
18. Add monitoring, error reporting, uptime checking and alert ownership.
19. Add safe, audited result administration.
20. Complete manual responsive/accessibility testing.
21. Reverify current official competition regulations and confirmed kickoff instant before launch.
22. Require human approval for migrations, production env changes, result corrections and award assignment.

## Strongly recommended

- Explicit stale/degraded/offline states.
- Focus/refetch or measured realtime.
- Generated Supabase types and strict TypeScript.
- Longer invite tokens and stronger endpoint throttling.
- Privacy thresholds for small aggregates.
- Pagination/batched league and leaderboard queries.
- Account deletion/export and clear retention/privacy copy.
- Session/device and change-email/password controls.
- A concise authoritative architecture/status document.
- Automated accessibility and visual checks.
- Exact per-environment CSP origins.
- Structured error mapping.
- Staging parity and preview isolation.
- Capacity/load testing at the stated 250-user/20-league assumptions.

## Optional

- Public marketing landing page.
- Route-specific social/SEO enhancements.
- Other-player full profile.
- Rich prediction trends/consensus.
- Additional visual recap states.
- Incremental scoring optimisation if profiling justifies it.
- All bonus games after Original Predictor integrity is proved.

---

# 12. Prioritised remediation roadmap

Effort: **XS** isolated; **S** small/contained; **M** multiple files/moderate; **L** substantial cross-system; **XL** architecture/migration heavy.

## Stage 0 — Stop-the-line risks

| ID | Task | Reason | Severity | Files/Systems | Dependencies | Effort | Validation |
|---|---|---|---|---|---|---|---|
| S0-01 | Deny direct client updates to `entries.submitted_at` | Submission RPC is bypassable | Critical | Entry grants/policies/RPC | None | M | JWT REST update fails; RPC matrix passes |
| S0-02 | Lock and validate `predicted_group_positions` | Post-lock score manipulation | Critical | New migration/table/RPC | Persistence contract | M | Before/after-lock tests |
| S0-03 | Add same-tournament invariants | Foreign data can contaminate scoring | High | Tables/triggers/RPCs | Existing-data check | L | Two-tournament adversarial suite |
| S0-04 | Correct submission query scoping | Foreign group matches can count | High | `submit_entry()` | S0-03 helpful | S | SQL tests |
| S0-05 | Remove development-database rollback | Environment crossover | High | Ops/Netlify | Release inventory | S | Staging rehearsal |
| S0-06 | Reconcile production schema/admin role | Drift or invalid runbook | High | Production DB/migrations/docs | Human access | M | Schema diff and clean rebuild |

## Stage 1 — Correctness and data safety

| ID | Task | Reason | Severity | Files/Systems | Dependencies | Effort | Validation |
|---|---|---|---|---|---|---|---|
| S1-01 | Atomic group-position persistence | Current §2 is broken | Critical | Provider/service/RPC | S0-02/03 | L | 24-row lifecycle and scoring |
| S1-02 | Authoritative knockout result model | Penalties cannot resolve | Critical | Schema/types/scoring | Rules decision | XL | Regulation/ET/pens matrix |
| S1-03 | Transactional result confirmation | Keep result/progression/score atomic | High | SQL RPC/admin flow | S1-02 | L | Correction and atomicity tests |
| S1-04 | Advisory lock recomputation | Remove concurrency race | High | Scoring SQL | S1-03 | S | Concurrent transactions |
| S1-05 | Versioned score clearing | Blank must mean blank | High | Provider/service/SQL | Delete contract | M | Save-clear-refresh |
| S1-06 | Flush saves before submit | Prevent stale submission | High | Save controller/provider | None | M | Immediate-submit test |
| S1-07 | Atomic bracket snapshot | Avoid partial rows | High | Provider/RPC | Bracket model | L | Fault injection |
| S1-08 | Full bracket replay on submit | Reject impossible trees | High | Submission RPC/domain | S1-01/07 | L | Invalid-tree generator |
| S1-09 | Authoritative actual tie override | Slot fallback unsafe | High | Result/scoring/admin | Official rules | M | Fully tied groups |
| S1-10 | Idempotent entry creation | Two-tab race | Medium | Service/RPC | None | S | Concurrent creation |

## Stage 2 — Security and permissions

| ID | Task | Reason | Severity | Files/Systems | Dependencies | Effort | Validation |
|---|---|---|---|---|---|---|---|
| S2-01 | Replace broad `FOR ALL` policies | Least privilege | High | Entry/prediction RLS | Stage 0 | M | Operation-by-role matrix |
| S2-02 | Version an audited admin model | Current docs/schema conflict | High | Auth/claims/RPCs | S0-06 | L | Escalation/audit tests |
| S2-03 | Stronger invite tokens/rate limits | Enumeration risk | Medium | League RPCs | Privacy decision | M | Burst/enumeration tests |
| S2-04 | Small-cohort privacy rules | Protect participant inference | Medium | Aggregate RPCs | Privacy policy | M | 1–N cohorts |
| S2-05 | Safe error mapping | Remove backend leakage | Medium | UI/service layer | Monitoring | M | Error catalogue |
| S2-06 | Narrow CSP origins | Reduce exfiltration surface | Medium | Netlify config | Environment design | S | CSP/browser smoke |
| S2-07 | Account/session controls | Complete user security lifecycle | Medium | Auth/account | Product scope | L | Account E2E |

## Stage 3 — Architecture and maintainability

| ID | Task | Reason | Severity | Files/Systems | Dependencies | Effort | Validation |
|---|---|---|---|---|---|---|---|
| S3-01 | Generate database types | Reduce schema drift | Medium | Services/types/CI | DB access | M | Typed build |
| S3-02 | Enable strict TypeScript | Catch hidden null/shape defects | Medium | TS/source | S3-01 useful | L | Strict build |
| S3-03 | Provider/query state machines | Eliminate hidden empty defaults | High | Providers/pages | Integrity stable | L | Slow/failure integration |
| S3-04 | Split prediction orchestration | Reduce hotspot | Medium | Provider/hooks | Stage 1 complete | M | Behaviour tests |
| S3-05 | Differential scoring suite | TS and SQL are duplicated | High | Domain/SQL/tests | Test DB | L | Random completed tournaments |
| S3-06 | Authoritative current documentation | Reduce agent/developer errors | Medium | README/docs | S0-06 | M | New-developer exercise |
| S3-07 | Remove/classify unused assets/modules | Hygiene | Low | Source/assets/dev | Working build | S | Import/build tests |

## Stage 4 — User journeys and UX

| ID | Task | Reason | Severity | Files/Systems | Dependencies | Effort | Validation |
|---|---|---|---|---|---|---|---|
| S4-01 | Explicit loading/degraded/stale UI | Prevent convincing false states | Medium | Shared page states | S3-03 | M | Per-request failure tests |
| S4-02 | Logged-out invite preview | Improve trust and recovery | Medium | Invite route/RPC | Privacy decision | M | Full invite E2E |
| S4-03 | Route focus/title/skip link | Accessibility | Medium | Shell/router | None | M | Keyboard/screen reader |
| S4-04 | Fix menu-button semantics | Accessibility | Medium | League detail | None | S | WAI-ARIA test |
| S4-05 | Complete current post-lock states | Core product lifecycle | High | Home/Predict/League/Profile | Correct scoring | L | Time-travel E2E |
| S4-06 | Hide/finish placeholder player profiles | Avoid dead action | Low | League/profile | Product choice | S/M | Route/action test |
| S4-07 | Add account/privacy controls | User trust | Medium | Account/Auth | S2-07 | L | Lifecycle E2E |

## Stage 5 — Testing and release confidence

| ID | Task | Reason | Severity | Files/Systems | Dependencies | Effort | Validation |
|---|---|---|---|---|---|---|---|
| S5-01 | Disposable Supabase test database | Required for policies/migrations | High | CI/Supabase | Stage 0 migrations | L | Clean apply on every run |
| S5-02 | RLS/RPC adversarial tests | Protect integrity | High | SQL/tests | S5-01 | L | Multi-user matrix |
| S5-03 | E2E Original Predictor journey | Prove real user flow | High | Playwright/app/DB | S5-01 | L | Signup→lock journey |
| S5-04 | Multi-tab/offline/failure tests | Save reliability | High | Browser/provider | Stage 1 | M | Conflict/fault suite |
| S5-05 | Accessibility automation/manual checklist | WCAG confidence | Medium | Routes/components | Stage 4 | M | Axe + screen readers |
| S5-06 | Visual responsive regression | Protect signed-off design | Medium | Major routes | Stable UI | M | 320/360/tablet/desktop |
| S5-07 | Required CI branch gate | Prevent unsafe main deploy | High | GitHub/Netlify | Tests exist | M | PR cannot merge red |

## Stage 6 — Performance and polish

| ID | Task | Reason | Severity | Files/Systems | Dependencies | Effort | Validation |
|---|---|---|---|---|---|---|---|
| S6-01 | Batch home league summaries | Remove serial N+1 | Medium | Home/RPC | DB test harness | M | 1/10/20 league profile |
| S6-02 | Add pagination | Protect list growth | Medium | Leaderboards/members | UX design | M | Large dataset test |
| S6-03 | Measure scoring recomputation | Confirm capacity | Medium | SQL | Correct scorer | M | 250-user profile |
| S6-04 | Bundle/route budgets | Preserve mobile performance | Low | Vite/CI | Working CI | S | Budget checks |
| S6-05 | Live refresh strategy | Correct tournament freshness | Medium | Queries/realtime | Result lifecycle | M/L | Update propagation/load |
| S6-06 | Final copy/empty/error consistency | Product polish | Low | UI | Stable states | M | Content review |

## Stage 7 — Production readiness

| ID | Task | Reason | Severity | Files/Systems | Dependencies | Effort | Validation |
|---|---|---|---|---|---|---|---|
| S7-01 | Pin runtime and complete build config | Reproducibility | High | Package/Netlify | CI | S | Clean build |
| S7-02 | Staging/preview data isolation | Prevent production writes | High | Netlify/Supabase | Platform access | M | Environment matrix |
| S7-03 | Monitoring/error reporting/uptime | Operational visibility | High | App/platform | Error mapping | M | Test alerts |
| S7-04 | Backup/restore rehearsal | Recovery | High | Supabase/ops | Platform access | L | Documented restore |
| S7-05 | Production-only rollback rehearsal | Safe release recovery | High | Netlify/ops | S0-05 | M | Rollback drill |
| S7-06 | Final regulations/data verification | Avoid wrong tournament facts | High | Seed/config/rules | Official sources | M | Owner sign-off |
| S7-07 | Full dress rehearsal | Prove lifecycle | High | Entire system | Stages 0–6 | XL | Time-travel tournament |
| S7-08 | Human launch gate | Production-sensitive approval | High | Checklist | All mandatory | S | Signed evidence pack |

---

# 13. Recommended first implementation batch

## Batch name: `DB-INTEGRITY-ENTRY-BOUNDARY-1`

This should be one isolated migration/test batch. It should not include UI redesign, bonus modes, result modelling or provider refactoring.

### Scope

1. Replace the broad authenticated entry update permission so users cannot directly change `submitted_at`.
2. Add server validation that every match prediction belongs to the entry tournament.
3. Add equivalent same-tournament validation for group positions, progression and Golden Boot/player references.
4. Add lock triggers to `predicted_group_positions` for insert/update/delete.
5. Correct `submit_entry()` group-count scoping.
6. Add an explicit lock check to submission if manual post-lock submission is not permitted.
7. Add version-safe or protected deletion semantics where the migration can do so without redesigning the bracket.
8. Add executable policy/RPC tests for two users and two tournaments.

### Why this batch first

- It closes direct competition-manipulation paths.
- It is reviewable as a database-boundary change.
- It does not require choosing the full knockout result schema.
- It protects later work on group-position persistence.
- It creates the testing harness needed for every later migration.

### Excluded deliberately

- UI visual changes.
- Group-position client implementation.
- Knockout result redesign.
- Admin panel.
- Future bonus games.
- General provider refactor.
- Performance optimisation.

### Validation gate

The batch is complete only when:

- an owner cannot directly stamp/clear `submitted_at`;
- a valid complete RPC submission succeeds;
- every foreign-tournament insert/update fails;
- group-position writes work before lock and fail after lock;
- non-owner access remains denied;
- service-role/admin behaviour is explicitly documented;
- all tests run from a clean disposable database;
- a schema diff shows no unversioned manual change.

---

# 14. Unknowns and limitations

## Systems not directly inspected

- The live production Supabase schema, policies and migration-history table.
- Supabase Auth dashboard settings.
- Turnstile dashboard configuration.
- Netlify environment-variable values.
- GitHub branch-protection/settings not exposed in the snapshot.
- Production logs and real user data.
- Backup schedules and restore capability.
- DNS/domain configuration beyond the active Netlify project metadata.

## Commands not independently completed

- Local TypeScript build, lint and tests, because dependencies were absent and installation was not authorised.
- Dependency vulnerability audit.
- SQL migration execution.
- RLS/RPC integration suite, because none exists.
- End-to-end browser tests, because none exists and the production login was not used.
- Manual mobile/screen-reader audit.

## Live-site limitations

- Netlify proves the production `main` deployment is ready at the audited commit.
- Automated root Lighthouse scores are strong.
- These do not verify authenticated routes, Supabase behaviour, live scoring or every screen.
- The audit environment could not reliably retrieve and interact with the production pages directly.

## Findings requiring owner/platform confirmation

- Whether production contains an unversioned `profiles.role` column.
- Whether all 20 migrations are applied in production.
- Whether email confirmation is intentionally disabled.
- Whether auto-submit remains an authoritative launch requirement.
- How official extra-time and penalty scores should be stored/displayed.
- The exact real tournament lock instant once fixtures are official.
- Privacy thresholds for aggregate prediction displays.
- Whether final league tie-breakers must actively reorder final standings rather than leave shared ranks.
- Whether player/squad data will arrive through a manual migration or admin workflow.

---

# Appendix A — Current feature inventory and scope classification

## Active Original Predictor feature inventory

| Potential/current feature | Classification | Evidence | Notes |
|---|---|---|---|
| User accounts | Implemented | `src/features/auth/`; auth routes in `src/App.tsx`; Supabase client/services | Login, signup and recovery exist |
| Turnstile signup protection | Implemented | Signup UI/service/config references | Provider settings external |
| Display-name moderation | Implemented | Profile/auth validation plus DB migration/policies | Exact production behaviour needs DB test |
| First-time welcome | Implemented | `/welcome`, route gate/provider | One-time profile state |
| Group score predictions | Implemented | `/predict/groups/:letter`; prediction provider; `match_predictions` | Clear/delete defect |
| Predicted group tables | Implemented in client | Group-domain functions and UI | Final rows not persisted |
| Predicted tie-resolution prompt | Implemented | Tie domain/UI; `predicted_tie_resolutions` | Manual fallback for predicted ties |
| Best third-place resolver | Implemented | `/predict/third-place`; domain tests | Original Predictor only |
| Original knockout bracket | Partially implemented | `/predict/bracket`; bracket domain; `predicted_progression` | Winner-only, not KO Predictor |
| Joker system | Implemented | Joker route, provider, migrations | Five group-stage jokers |
| Golden Boot prediction | Partially implemented | Player picker; `players`; `bonus_predictions` | Baseline player list not populated |
| Total group goals prediction | Implemented as derived value | `groupGoals.ts`, scoring config/docs/SQL | Not a separate form field |
| Review | Implemented | `/predict/review` | Critical state-race risks |
| Manual submit | Partially implemented | `submit_entry()` and review CTA | Bypassable |
| Auto-submit at lock | Documented but not implemented | `docs/scoring-rules.md`; TODO/roadmap | No scheduler/process |
| Score lock | Partially implemented | `tournaments.lock_at`, triggers | Not every scoring table |
| Overall standings | Implemented | `/league/overall`, leaderboard RPC | Integrity depends on valid submitted state |
| Private Original leagues | Implemented | `/league`, `/league/:id`, league migrations/RPCs | No bonus-game tabs, correctly |
| Invite links | Partially implemented | `/join/:code` | Signed-out preview limitation |
| H2H | Implemented | `/h2h/:rivalId` | Original Predictor |
| Matches | Implemented | `/matches` | Basic result/status lifecycle |
| Match centre | Implemented | `/match/:matchRef` | Group/current data stronger than KO lifecycle |
| Profile and points breakdown | Implemented | `/profile`, RPCs/components | Account management incomplete |
| Share cards | Implemented | Share domain/components | Browser verification unavailable |
| Other-player full profile | UI prototype/placeholder only | League action message | No active route/data |
| Admin panel/control room | Documented but not implemented | Docs/design only; no route | Manual SQL is current operation |
| Result-entry UI | Not present | No route/component | SQL editor is documented path |
| Email reminders | Planned | Docs only | No email function/scheduler |
| Realtime/live subscriptions | Not present | No active implementation found | Data can become stale |
| PWA/offline app | Not present | No service worker/manifest install support | Netlify PWA score 40 |

## Important classification distinction

The active route `/predict/bracket` is the **winner-only knockout section of the Original Predictor**. It is not evidence that the separately named **KO Predictor** exists.

---

# Appendix B — Current scoring audit

## Files containing current Original Predictor scoring values or calculations

### Authoritative/current documentation

- `docs/scoring-rules.md`

### TypeScript configuration and calculation

- `src/domain/tournament/scoringConfig.ts`
- `src/domain/tournament/calculateScore.ts`
- `src/domain/tournament/scoreEvents.ts`
- `src/domain/tournament/groupGoals.ts`
- `src/domain/tournament/maxRemainingPoints.ts`
- `src/features/predict/matchScoring.ts`
- `src/domain/tournament/matchCentre.ts`
- `src/features/more/ScoringRulesPage.tsx`
- `src/domain/tournament/calculateLeagueRank.ts` — final tie-break pure implementation, apparently not used by active leaderboard rendering
- `src/domain/tournament/rankLeaderboard.ts` — current running points ranking/shared-rank behaviour

### Database scoring and trigger implementation

- `supabase/migrations/20260720130000_add_scoring.sql` — initial group-match scoring
- `supabase/migrations/20260720140000_scoring_read_model.sql`
- `supabase/migrations/20260720180000_add_rank_history.sql` — redefines scoring pipeline while adding snapshots
- `supabase/migrations/20260721120000_scoring_positions_knockout_awards.sql` — latest complete §1–§4 recompute
- Related result/award triggers in the same migration chain
- `score_events` and `entry_totals` schema/read model

### Development/admin reference pipeline

- `scripts/seed-dev/scoreEntries.ts`
- Result-entry and recompute guidance in `docs/ops-result-entry.md`

### Current tests containing scoring expectations

- `tests/domain/calculateScore.test.ts`
- `tests/domain/scoringCompletion.test.ts`
- `tests/domain/scoreEvents.test.ts`
- `tests/domain/groupGoals.test.ts`
- `tests/domain/maxRemainingPoints.test.ts`
- `tests/domain/matchCentre.test.ts`
- `tests/domain/calculateLeagueRank.test.ts`
- `tests/scripts/scoreEntries.test.ts`
- Related H2H/profile/rank tests

## Current scoring table

| Scoring rule | Current value | Evidence | Implemented where | Tested | Conflicts |
|---|---:|---|---|---|---|
| Correct group result, wrong score | 3 | `docs/scoring-rules.md:7-13`; `scoringConfig.ts:7-11` | TS scorer; match UI; latest SQL scorer | Yes, TS | No active value conflict |
| Exact group score | 5 total | Same as above | TS and SQL | Yes | No; explicitly does not stack with 3 |
| Wrong group result | 0 | Same | TS and SQL | Yes | None |
| Joker multiplier | ×2 | `scoring-rules.md:15-23`; `scoringConfig.ts:13-18` | TS/SQL group-match scoring | Yes | None |
| Joker allowance | 5 | `scoring-rules.md:17`; `scoringConfig.ts:20-24` | UI and DB policy/trigger | Yes in domain/policy intent | None |
| Correct team in exact predicted group position | 2 | `scoring-rules.md:27-34`; config | TS/SQL | TS calculation tests | Implementation disconnected from app persistence |
| Complete four-team group order bonus | +5 | Same | TS/SQL | Yes, TS | No value conflict |
| Maximum per predicted group | 13 | Derived: 4×2+5 | TS/SQL | Yes | None |
| Team correctly reaches R16 | 10 | `scoring-rules.md:38-50`; config | TS/SQL | Yes | None |
| Correctly reaches quarter-final | +15 stacking | Same | TS/SQL | Yes | None |
| Correctly reaches semi-final | +20 stacking | Same | TS/SQL | Yes | None |
| Correctly reaches final | +25 stacking | Same | TS/SQL | Yes | None |
| Correct champion | +40 stacking | Same | TS/SQL | Yes | None |
| Correct all-way champion-team total | 110 | 10+15+20+25+40 | TS/SQL cumulative event | Yes | None |
| Golden Boot correct | 25 | `scoring-rules.md:54-70`; config | TS/SQL | Yes, TS | Production result/data lifecycle incomplete |
| Total group goals exact | 40 | Same | Derived TS/SQL | Yes | None |
| Total group goals within 5 inclusive | 30 | Same | TS/SQL | Yes | None |
| Total group goals within 10 inclusive | 20 | Same | TS/SQL | Yes | None |
| Total group goals outside 10 | 0 | Same | TS/SQL | Yes | None |
| Total-goals bands stack? | No; best single tier only | `scoring-rules.md:64` | TS/SQL | Yes | None |
| Total-goals user input | No separate input; sum of 36 score predictions | `scoring-rules.md:66` | Domain/SQL | Yes | None |
| Running equal-points rank | Shared standard-competition rank; alphabetical display inside tie | `rankLeaderboard.ts`; seed ranking | Runtime/client/read model | Yes | Final tie-break rules are separate and not active |
| Documented final league tie-breakers | Exact scores, correct outcomes, correct KO teams, champion, closest goals | `scoring-rules.md:74-82` | Pure `calculateLeagueRank.ts` only | Yes, pure tests | **Runtime gap:** active leaderboard does not appear to apply final tie-break sequence |

## Scoring conflicts and ambiguities

### No current point-value conflict found

The active Original Predictor values agree across:

- `docs/scoring-rules.md`;
- `scoringConfig.ts`;
- `calculateScore.ts`;
- the latest scoring SQL;
- current tests; and
- the scoring explanation UI.

### Important implementation/status conflicts

1. **Stale result-entry document:** `docs/ops-result-entry.md` says §2–§4 are deferred, while the later scoring migration implements them.
2. **Final league tie-breakers:** documented and pure-tested, but active leaderboard ranking appears to use total points/shared rank only. Owner confirmation is needed on when/how final tie-breakers become active.
3. **“One source” comment versus reality:** `scoringConfig.ts` says no scoring number is hardcoded elsewhere, but equivalent values are necessarily duplicated in SQL migrations and test expectations. This should be controlled by differential tests rather than assumed.
4. **Group-position scoring:** values agree, but current frontend cannot populate the database source used by SQL.
5. **Live database execution:** the production deploy contains the current code, but production migration parity and real scoring output could not be queried.

### Values intentionally excluded

The following are not conflicts because they belong only to future, separate competitions:

- planned KO Predictor: Exact 5, Result 3, Through +2;
- Predictor Cup raw match scoring and 3–1–0 table points;
- any Last Man Standing rule.

They must not be applied to current Original Predictor entries.

---

# Appendix C — Additional and future game modes

| Mode/feature | Classification | Runtime evidence | Documentation evidence | Current conclusion |
|---|---|---|---|---|
| Separate KO Predictor | **Planned** | No route, table, service, navigation, type or feature flag | `docs/competition-structure.md`, roadmap, design future screens | Outside current implemented scope |
| Last Man Standing | **Planned** | No route/table/component/service | Competition structure and roadmap only | Outside current implemented scope |
| Predictor Cup | **Planned** | No runtime route/table/service | `docs/predictor-cup-rules.md`, competition structure, roadmap | Rules/design only, not implemented |
| Fan Duels | **Legacy/obsolete concept** | No runtime implementation | Explicitly superseded by Predictor Cup; direct-challenge parked | Must not be audited as current feature |
| Bonus Games hub `/games` | **Planned** | Route absent; More page has no Games entry | Competition structure says “when built” | Not present |
| Shared knockout prediction store | **Planned database architecture** | No table/type/service | Competition structure only | Not present |
| `entries.entry_type` | **Planned schema only** | Column absent | Docs explicitly say deferred/not existing | Not present |
| Sweepstake builder | **Planned** | No runtime implementation | Roadmap/design only | Not current |
| Predictor Cup Shield/Plate | **Parked** | None | Roadmap only | Not current |
| Fan Duels direct challenge | **Parked legacy remainder** | None | Roadmap/competition docs | Not current |

## Required KO Predictor statement

The separate KO Predictor is **outside the current implemented application scope**.

### Unused scaffolding

There is no active runtime scaffolding such as:

- `/games` or KO routes;
- KO-entry tables;
- shared knockout prediction tables;
- competition type columns;
- KO-specific services;
- feature flags; or
- navigation entries.

There are detailed future design examples and planning documents. They are design/documentation scaffolding only.

### Could the architecture support it later?

Yes, but not without material schema and policy work. Reusable foundations include:

- match reference data;
- pure scoring architecture;
- score-event concepts;
- route-level feature folders;
- authentication;
- global standings patterns; and
- design-system components.

Required new foundations include:

- typed competition entries;
- the shared knockout prediction store;
- per-match locks;
- separate score events/leaderboards;
- rolling-entry rules;
- result-method/winner modelling;
- new policies and integration tests.

### Does current code incorrectly assume KO Predictor exists?

No active runtime feature appears to assume that the separate mode already exists. The main scope risk is documentation language such as “launch scope” and future design screens being mistaken for implemented code. The current schema also does not yet satisfy future-document guardrails about competition typing, but that is a future-readiness gap rather than a current runtime dependency.

---

# Appendix D — Current business rules and enforcement

| Rule | Source | Enforcement layer | Test coverage | Confidence |
|---|---|---|---|---|
| One entry per user per tournament | `entries` unique constraint | Database constraint | Not executed in DB; service tests limited | High |
| Group predictions require both scores | `match_predictions` non-null; score-pair UI | DB columns + UI | TS/UI tests | High |
| Result rows store both scores or neither | `matches_score_pair` | DB constraint | No DB integration | High |
| Scores cannot be negative | Match/prediction checks | DB + input sanitation | Domain/UI tests | High |
| UI score input max two digits | `ScoreInput.tsx` | Browser only | Component behaviour likely tested indirectly | High |
| Five jokers per entry | Scoring docs/config; joker migration | UI reflection + DB trigger/function | Domain/policy unit intent; no DB run | High |
| One joker per match | Prediction row boolean | DB row shape | Tests | High |
| Jokers affect group-match points only | Scoring docs/config/SQL | TS + DB scoring | Yes, TS | High |
| A committed joker cannot move after its match kicks off | Joker docs/migration | DB trigger + UI | Domain tests, no DB integration | High |
| A joker cannot be newly placed on a kicked-off match | Same | DB + UI | Domain tests | High |
| Group score predictions lock at tournament opening | Lock migration | DB trigger + UI | Domain tests, no DB integration | High |
| Group-position rows lock at opening | Intended by product | **Not enforced** | None | Confirmed defect |
| Golden Boot and original progression lock at opening | Lock migration | DB trigger + UI | Domain tests | High |
| Submission requires all group matches | `submit_entry()` | DB function + UI | Helper tests, no DB integration | High |
| Submission requires a complete winner-only bracket shape | `submit_entry()` | DB function + UI | Domain/helper tests | High |
| Submission requires a valid replayable bracket | Product expectation | **Not fully enforced** | No | Confirmed gap |
| Golden Boot is optional for validity | Scoring rules/review logic | UI + DB function omission | Tests | High |
| Jokers are optional for validity | Scoring rules/review logic | UI + DB function omission | Tests | High |
| Valid entries auto-submit at lock | `docs/scoring-rules.md` | **Documentation only** | None | Confirmed not implemented |
| Owners must submit through RPC | Architectural intent | UI/service only; DB bypass exists | None | Confirmed gap |
| Entry remains editable until lock even if manually submitted | Current lock design | DB lock timestamp, not submitted timestamp | Needs E2E | High |
| Other users’ detailed predictions reveal only post-lock and eligible relationship | Reveal/H2H RPCs/docs | DB function/RLS boundary | Pure/service tests; no DB integration | High |
| Users read/write only own raw prediction rows | RLS policies | RLS | No real JWT tests | High from schema |
| Reference tournament data is authenticated read-only | RLS policies | RLS; Studio/service role for writes | No DB tests | High |
| Current private leagues contain Original Predictor only | Routes/schema/docs | Runtime architecture | Static evidence | High |
| League owner cannot simply leave without transfer/delete | League RPC/UI | DB function + UI | Limited tests | High |
| League joins use invite code | League RPC | DB function | Limited | High |
| Prediction-save rate target | Rate-limit migration | DB function/trigger | No concurrency integration | Medium |
| League membership rate target | Rate-limit migration | DB function | No concurrency integration | Medium |
| Rate limits are hard under concurrency | Intended | Not guaranteed atomically | No | Possible defect |
| Group table tie logic uses H2H then overall metrics then manual predicted resolution | Scoring docs/domain | Client domain + tie storage | Strong pure tests | High |
| Actual final group order has authoritative manual fallback | Needed product rule | Missing; SQL uses slot fallback | None | Confirmed gap |
| Knockout is winner-only in current Original Predictor | Scoring docs, bracket code/schema | Client/DB progression | Domain tests | High |
| Original and future bonus scores never merge | Competition structure | Current bonus modes absent | Static only | High for current app |
| Golden Boot actual is set administratively | Tournament column/migration | Privileged DB operation | No admin integration | High |
| Group-total-goals prediction is derived | Scoring docs/domain/SQL | TS + DB scoring | Yes | High |
| Current leaderboard running ties share a rank | Rank implementation/RPC | TS/SQL read model | Yes, TS | High |
| Documented final league tie-break order is applied in production | Scoring docs | Pure module only; runtime use not found | Pure tests only | Low/unclear |
| Lock timestamp must equal real first kickoff | Ops/baseline comments | Data/config | No automated verification | Medium; production value unverified |
| Failure to load lock must block editing | Safety expectation | Current client can treat failure as null/unlocked | No | Confirmed gap |
| Result entry requires a privileged human operation | Current RLS/runbook | Supabase Studio/service role | No audit test | High |
| Result corrections are fully audited | Production requirement | No complete audit model found | None | Low/absent |
| Recompute is idempotent | SQL delete/rederive design | DB function | No SQL execution | Medium-high design confidence |
| Recompute is safe concurrently | Required | Not serialised | None | Confirmed gap |

---

# Closing verdict

## **Safe only after critical repairs**

The current project is a viable foundation. It should continue through controlled, incremental repair rather than restructuring from scratch.

It must not launch a real scored competition until:

- submission and scoring inputs are protected at the database boundary;
- group-position predictions persist end to end;
- cross-tournament scope is enforced;
- knockout winners can be represented correctly;
- result/scoring operations are atomic;
- and the database rules are covered by executable integration tests.

The separate KO Predictor, Last Man Standing, Predictor Cup and other bonus-game ideas are not current implemented features and should remain out of implementation audit scope until their routes, schema and services actually exist.

---

# Next audit baseline

The next full audit must start by comparing the current repository and deployed application against the controls created from this report:

- [`../current-status.md`](../current-status.md)
- [`../feature-baseline.md`](../feature-baseline.md)
- [`../risk-register.md`](../risk-register.md)
- [`../deferred-decisions.md`](../deferred-decisions.md)

Baseline at the audited application commit:

| Measure | Baseline |
| --- | --- |
| Audited application commit | `b68c4858a179adce433e01db439cabb93c6a0c01` |
| Explicit production routes | 23, plus catch-all not-found; one dev-only route |
| Version-controlled migrations | 20 |
| Test/support files | 43 |
| Approximate static test cases | 326; audited commit message reports 335 green |
| Independently executed local build/lint/type/tests | No — dependencies were absent and installation was not authorised |
| Production deploy metadata | Netlify deploy at audited commit reported `ready` |
| Database/RLS integration tests | None identified |
| Browser end-to-end tests | None identified |
| Open Critical findings | DATA-001, SECURITY-001, SECURITY-002, DATA-002 |
| Open High findings | DATA-003, FUNC-001, FUNC-002, REL-001, DATA-004, DATA-005, REL-002, REL-003, REL-004, DATA-006, OPS-001, OPS-002, TEST-001, OPS-003 |
| Production verdict | Safe only after critical repairs |

A future audit must retain existing finding IDs, verify whether claimed fixes have implementation and validation evidence, inspect the previously inaccessible systems where access is available, and record any silent feature or safeguard loss against the feature baseline.

