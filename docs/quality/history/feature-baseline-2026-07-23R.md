# Feature and safeguard baseline

This file is the primary control against silent feature loss. It records user-facing capabilities, future-scope boundaries and technical safeguards verified during the 23 July 2026 audit of `main` at commit `b68c4858a179adce433e01db439cabb93c6a0c01`.

The full evidence is preserved in the [dated audit report](audits/2026-07-23-full-audit.md). Current defects remain separately tracked in [`risk-register.md`](risk-register.md).

## Repeat verification — `2026-07-23R`

All 96 entries were re-compared during the [23 July 2026 repeat verification audit](audits/2026-07-23-repeat-verification-audit.md) against a repository snapshot that reproduces every structural counter of the baseline commit (20 migrations, 43 test/support files, 23 production routes plus catch-all plus one dev route, package version `0.0.0`).

| Result | Detail |
| --- | --- |
| **Regressions detected** | **0.** No feature lost reachability, no safeguard was weakened, no scope drift occurred. |
| Existing `Confirmed regression` entries | `SAFE-007` and `SAFE-031` persist unchanged. `SAFE-031` is now more serious in practice — see `OPS-001`, escalation proposed. |
| Validation evidence upgraded | 8 entries moved from static-only to static-plus-executed evidence: `SAFE-001`, `SAFE-002`, `SAFE-005`, `SAFE-011`, `SAFE-012`, `SAFE-015`, `SAFE-030`, `SAFE-034`. |
| Entries reinforced (no status change) | `SAFE-024`, `SAFE-025`, `SAFE-041` — see the notes in their rows. |
| New baseline entries required | **None.** New finding `OPS-005` is a defect against existing entries `SAFE-017` and `SAFE-032`, not a new capability. |
| Status changes | **None.** Every entry retains its baseline status. |

Rows carrying `2026-07-23R` in their `Last verified` column were re-verified during that audit. Rows without it retain their baseline verification and were confirmed structurally unchanged but not re-evidenced individually.

## Baseline summary

| Current status | Count |
| --- | ---: |
| Backend or database only | 4 |
| Confirmed regression | 2 |
| Documented but not implemented | 3 |
| Implemented and reachable | 36 |
| Legacy | 1 |
| Not present | 14 |
| Partially implemented | 26 |
| Planned | 8 |
| UI prototype only | 1 |
| Unable to verify | 1 |
| **Total baseline entries** | **96** |

## Verified baseline

| ID | Feature or safeguard | Intended status | Current status | Source of truth | Implementation evidence | Validation evidence | Last verified | Regression notes |
| -- | -------------------- | --------------- | -------------- | --------------- | ----------------------- | ------------------- | ------------- | ---------------- |
| `FEAT-001` | Login | Implemented | **Implemented and reachable** | `src/App.tsx`; Supabase Auth requirements | Routes `/auth/login`; `src/features/auth/LoginPage.tsx`; auth services | Static repository audit; service/validation tests identified; live provider settings not independently verified | 2026-07-23 (`b68c485`) | None recorded |
| `FEAT-002` | Signup with Turnstile | Implemented | **Implemented and reachable** | `docs/auth-plan.md`; auth requirements | Route `/auth/signup`; signup feature/service; Turnstile configuration references | Static audit; validation/service tests; external Turnstile/Auth dashboard not inspected | 2026-07-23 (`b68c485`) | Preserve neutral errors and fail-closed behaviour |
| `FEAT-003` | Password reset request | Implemented | **Implemented and reachable** | Auth requirements | Route `/auth/reset`; `ResetRequestPage`; Supabase Auth service | Static audit and service tests; email delivery not exercised | 2026-07-23 (`b68c485`) | Retest expired and repeated requests |
| `FEAT-004` | Password recovery completion | Implemented | **Implemented and reachable** | Auth requirements | Route `/auth/update-password`; recovery-session handling | Static audit; no full recovery-link E2E | 2026-07-23 (`b68c485`) | Retest expired/reused links |
| `FEAT-005` | Display-name moderation | Implemented | **Implemented and reachable** | `docs/auth-plan.md`; moderation migration | Profile/auth validation; display-name moderation trigger migration | Static audit; live trigger not executed | 2026-07-23 (`b68c485`) | Preserve server enforcement |
| `FEAT-006` | First-use welcome onboarding | Implemented | **Implemented and reachable** | `docs/design-system.md`; route contract | Route `/welcome`; welcome gate/provider; profile welcomed timestamp | Static audit; gate tests identified | 2026-07-23 (`b68c485`) | Watch fail-soft profile reads |
| `FEAT-007` | Theme switching | Implemented | **Implemented and reachable** | `docs/design-system.md` | Theme provider; More-page control; token system | Static audit; component/theme tests and audited commit browser verification claim | 2026-07-23 (`b68c485`) | Preserve both schemes and mobile theme-colour handling |
| `FEAT-008` | Tournament reference-data loading | Implemented | **Partially implemented** | Tournament/architecture documents | Tournament data provider and Supabase service | Static audit only | 2026-07-23 (`b68c485`) | DATA-006: explicit active-tournament scoping needed |
| `FEAT-009` | Group score prediction | Implemented | **Partially implemented** | `docs/scoring-rules.md`; `docs/tournament-structure.md` | Route `/predict/groups/:letter`; match cards; `match_predictions`; autosave | Strong domain/save test intent; DB integration absent | 2026-07-23 (`b68c485`) | DATA-005: clear/delete semantics broken |
| `FEAT-010` | Predicted group tables | Implemented | **Implemented and reachable** | Scoring/tournament rules | Group table domain functions and group routes | Pure domain tests identified | 2026-07-23 (`b68c485`) | Final scored positions are not materialised; see FEAT-011 |
| `FEAT-011` | Persisted predicted group positions | Required for current scoring | **Backend or database only** | `docs/scoring-rules.md`; scoring SQL | `predicted_group_positions` table and SQL scorer only | No client persistence; no end-to-end validation | 2026-07-23 (`b68c485`) | DATA-001 and SECURITY-001 |
| `FEAT-012` | Predicted tie resolution | Implemented | **Implemented and reachable** | Tournament/scoring rules | Tie resolver UI/domain; `predicted_tie_resolutions` | Pure tests identified; DB policy tests absent | 2026-07-23 (`b68c485`) | Late-loading/version limitations |
| `FEAT-013` | Best third-place resolution | Implemented | **Implemented and reachable** | Tournament structure | Route `/predict/third-place`; pipeline/domain logic | Domain tests identified | 2026-07-23 (`b68c485`) | Depends on trustworthy tie and group-position state |
| `FEAT-014` | Original Predictor winner-only bracket | Implemented | **Partially implemented** | `docs/scoring-rules.md`; tournament structure | Route `/predict/bracket`; bracket domain; `predicted_progression` | Domain tests identified | 2026-07-23 (`b68c485`) | FUNC-001, REL-004 and REL-007 |
| `FEAT-015` | Joker selection and commitment | Implemented | **Implemented and reachable** | `docs/scoring-rules.md` | Route `/predict/jokers`; joker domain; database trigger | Domain tests; DB trigger not integration-tested | 2026-07-23 (`b68c485`) | Preserve server-side max/commit rules |
| `FEAT-016` | Golden Boot prediction | Implemented | **Partially implemented** | `docs/scoring-rules.md` | Picker/review UI; `players`; `bonus_predictions` | Domain/service test intent | 2026-07-23 (`b68c485`) | Production player/result workflow unverified |
| `FEAT-017` | Derived total group goals prediction | Implemented | **Implemented and reachable** | `docs/scoring-rules.md` | Derived from 36 group score predictions in TS/SQL | Domain tests identified | 2026-07-23 (`b68c485`) | Must remain derived, not a separate form |
| `FEAT-018` | Prediction review | Implemented | **Implemented and reachable** | Design and scoring rules | Route `/predict/review`; shared status pipeline | Helper tests identified | 2026-07-23 (`b68c485`) | REL-002 and REL-003 affect trustworthiness |
| `FEAT-019` | Manual entry submission | Implemented | **Partially implemented** | `docs/scoring-rules.md` | Review CTA; `submit_entry()` RPC | Static audit; no real RLS/RPC integration | 2026-07-23 (`b68c485`) | SECURITY-002, FUNC-001, REL-003 |
| `FEAT-020` | Automatic valid-entry submission at lock | Required | **Documented but not implemented** | `docs/scoring-rules.md` | No scheduler/server finalisation process found | No tests | 2026-07-23 (`b68c485`) | FUNC-002 |
| `FEAT-021` | Original Predictor entry lock | Implemented | **Partially implemented** | Architecture/scoring rules | Tournament `lock_at`; database triggers; UI states | Domain tests; no DB integration | 2026-07-23 (`b68c485`) | Does not cover every scoring input |
| `FEAT-022` | Group-match scoring | Implemented | **Backend or database only** | `docs/scoring-rules.md` | TS scorer and SQL score-event recompute | TypeScript tests; SQL not executed in audit | 2026-07-23 (`b68c485`) | Preserve differential parity |
| `FEAT-023` | Group-position scoring | Implemented | **Partially implemented** | `docs/scoring-rules.md` | TS/SQL values and SQL scorer | TS tests only | 2026-07-23 (`b68c485`) | DATA-001 makes current end-to-end scoring incomplete |
| `FEAT-024` | Original knockout progression scoring | Implemented | **Partially implemented** | `docs/scoring-rules.md` | TS/SQL progression score events | TS tests only | 2026-07-23 (`b68c485`) | DATA-002 prevents authoritative penalty winner |
| `FEAT-025` | Golden Boot scoring | Implemented | **Backend or database only** | `docs/scoring-rules.md` | Tournament result field and SQL score events | TS tests; admin/result lifecycle absent | 2026-07-23 (`b68c485`) | Needs safe result administration |
| `FEAT-026` | Total group-goals scoring | Implemented | **Backend or database only** | `docs/scoring-rules.md` | TS and SQL derived scoring tiers | TS tests; SQL differential absent | 2026-07-23 (`b68c485`) | Preserve inclusive bands and non-stacking rule |
| `FEAT-027` | Overall Original Predictor leaderboard | Implemented | **Implemented and reachable** | Scoring/league requirements | Route `/league/overall`; leaderboard RPC/read model | Rank tests identified | 2026-07-23 (`b68c485`) | Eligibility integrity depends on submission repairs |
| `FEAT-028` | Private Original Predictor leagues | Implemented | **Implemented and reachable** | `docs/competition-structure.md` | Routes `/league`, `/league/:id`; league tables/RPCs | Domain/service test intent; no RLS E2E | 2026-07-23 (`b68c485`) | Keep bonus competitions separate |
| `FEAT-029` | League invite deep links | Implemented | **Partially implemented** | League requirements/design | Route `/join/:code`; preview/join RPC path | Static audit | 2026-07-23 (`b68c485`) | UX-001 and SEC-001 |
| `FEAT-030` | League ownership transfer, leave and delete | Implemented | **Implemented and reachable** | League rules | League-detail actions and privileged RPCs | Static audit; concurrency/RLS tests absent | 2026-07-23 (`b68c485`) | Preserve destructive confirmations |
| `FEAT-031` | Head-to-head comparison | Implemented | **Partially implemented** | Product/design documents | Route `/h2h/:rivalId`; reveal/rival RPCs | Domain tests identified | 2026-07-23 (`b68c485`) | DATA-002 and stale-data risk |
| `FEAT-032` | Match listing | Implemented | **Implemented and reachable** | Product/design documents | Route `/matches`; match cards/filters | Static audit | 2026-07-23 (`b68c485`) | No live refresh/status lifecycle |
| `FEAT-033` | Match centre | Implemented | **Partially implemented** | Product/design documents | Route `/match/:matchRef`; match/aggregate RPCs | Domain test intent | 2026-07-23 (`b68c485`) | Knockout result lifecycle and aggregate privacy |
| `FEAT-034` | Home dashboard | Implemented | **Partially implemented** | Design/roadmap | Route `/`; multiple league/match/profile reads | Static audit | 2026-07-23 (`b68c485`) | PERF-001, UX-002 and REL-005 |
| `FEAT-035` | Own profile and points breakdown | Implemented | **Implemented and reachable** | Product/design documents | Route `/profile`; profile/score RPCs | Rendered/domain tests identified | 2026-07-23 (`b68c485`) | Full account/privacy lifecycle incomplete |
| `FEAT-036` | Other-player full profile | Planned | **UI prototype only** | `docs/roadmap.md`; design references | Placeholder action only; no working route/data | No validation | 2026-07-23 (`b68c485`) | Do not report as implemented |
| `FEAT-037` | Share cards | Implemented | **Implemented and reachable** | Design/product requirements | Client share model/render flow | Model tests identified; browser output not manually verified | 2026-07-23 (`b68c485`) | Retest target browsers |
| `FEAT-038` | Scoring explanation page | Implemented | **Implemented and reachable** | `docs/scoring-rules.md` | Route `/more/scoring`; scoring content/config | Static audit | 2026-07-23 (`b68c485`) | Keep aligned with SQL and authoritative rules |
| `FEAT-039` | Admin control room | Planned | **Documented but not implemented** | Roadmap/design documents | No production admin route or active role model | No tests | 2026-07-23 (`b68c485`) | OPS-002 |
| `FEAT-040` | Safe result entry and correction | Required | **Documented but not implemented** | Operations documents | Manual SQL/Studio procedure only | No integration or audit tests | 2026-07-23 (`b68c485`) | DATA-002 and REL-001 |
| `FEAT-041` | Deadline reminder emails | Planned | **Planned** | Roadmap/build TODO | No scheduler/function identified | No validation | 2026-07-23 (`b68c485`) | Do not treat as launch-complete |
| `FEAT-042` | Production monitoring and incident tooling | Required | **Not present** | Operational requirements | No repository integration identified | No validation | 2026-07-23 (`b68c485`) | OPS-003 |
| `FEAT-043` | Public marketing landing page | Optional | **Not present** | No current approved requirement | Auth is the public entry surface | Not applicable | 2026-07-23 (`b68c485`) | Revisit only if product strategy requires |
| `PLAN-001` | Separate KO Predictor | Planned | **Planned** | `docs/competition-structure.md`; roadmap/design | No route, table, service, type or feature flag | Static repository audit | 2026-07-23 (`b68c485`) | Outside current implemented scope |
| `PLAN-002` | Last Man Standing | Planned | **Planned** | Competition structure/roadmap | No runtime implementation | Static repository audit | 2026-07-23 (`b68c485`) | Outside current implemented scope |
| `PLAN-003` | Predictor Cup | Planned | **Planned** | `docs/predictor-cup-rules.md`; competition structure | Rules/design only; no runtime implementation | Static repository audit | 2026-07-23 (`b68c485`) | Outside current implemented scope |
| `PLAN-004` | Fan Duels direct challenge | Superseded/parked | **Legacy** | Competition documents | No runtime implementation; concept superseded by Predictor Cup | Static repository audit | 2026-07-23 (`b68c485`) | Retain decision history; do not revive implicitly |
| `PLAN-005` | Bonus Games hub `/games` | Planned | **Planned** | Competition structure | No route/navigation entry | Static repository audit | 2026-07-23 (`b68c485`) | Create only with implemented modes |
| `PLAN-006` | Shared knockout prediction store | Planned | **Planned** | Competition architecture documents | No table/type/service | Static repository audit | 2026-07-23 (`b68c485`) | Required before separate KO competitions |
| `PLAN-007` | Typed competition entries (`entry_type`) | Planned | **Planned** | Competition architecture documents | Column absent from current schema | Static repository audit | 2026-07-23 (`b68c485`) | Future architecture, not current defect |
| `PLAN-008` | Sweepstake builder | Planned | **Planned** | Roadmap/design | No runtime implementation | Static repository audit | 2026-07-23 (`b68c485`) | Outside current scope |
| `SAFE-001` | Pure tournament-domain layer | Required safeguard | **Implemented and reachable** | `CLAUDE.md` architecture rules | `src/domain/tournament/` pure modules | **Executed `2026-07-23R`: 335 tests across 42 files all pass**; domain layer confirmed free of React/database imports | 2026-07-23R | Preserve separation during refactors |
| `SAFE-002` | Route-level code splitting | Required safeguard | **Implemented and reachable** | Performance architecture | All leaf pages loaded through `React.lazy` in `src/App.tsx` | **Executed `2026-07-23R`: `vite build` emits a separate chunk per leaf route**; `dist/` 1.5 MB, entry chunk 251.52 kB (80.53 kB gzip) | 2026-07-23R | Keep dev gallery production-excluded |
| `SAFE-003` | Supabase service boundary | Required safeguard | **Implemented and reachable** | `CLAUDE.md` architecture rules | Requests concentrated in `src/services/supabase/` | Static import review | 2026-07-23 (`b68c485`) | Do not bypass from components |
| `SAFE-004` | Row Level Security coverage | Required safeguard | **Partially implemented** | Security/data requirements | RLS enabled broadly in migrations | Static SQL review only | 2026-07-23 (`b68c485`) | TEST-001; policy weaknesses remain |
| `SAFE-005` | Security-definer search-path pinning | Required safeguard | **Implemented and reachable** | Database security practice | Inspected security-definer functions set explicit search path | Static SQL review, re-confirmed `2026-07-23R` across all 20 migrations; functions still never executed | 2026-07-23R | Retest every new privileged function |
| `SAFE-006` | Database-side prediction lock triggers | Required safeguard | **Partially implemented** | `CLAUDE.md`; lock rules | Triggers cover match predictions, ties, progression and bonus rows | Static SQL/domain tests | 2026-07-23 (`b68c485`) | SECURITY-001: group positions omitted |
| `SAFE-007` | Submission transition protected by validated RPC | Required safeguard | **Confirmed regression** | Scoring/entry-validity rules | RPC exists, but direct owner update remains possible | Static SQL review | 2026-07-23 (`b68c485`) | SECURITY-002 |
| `SAFE-008` | Same-tournament relationship validation | Required safeguard | **Not present** | Data-integrity requirement | No complete composite constraints/triggers | Static SQL review | 2026-07-23 (`b68c485`) | DATA-003 |
| `SAFE-009` | Atomic bracket snapshot persistence | Required safeguard | **Not present** | Reliability requirement | Current client fan-out writes | Static audit | 2026-07-23 (`b68c485`) | REL-004 |
| `SAFE-010` | Serialised score recomputation | Required safeguard | **Not present** | Operational/data requirement | No tournament advisory lock | Static SQL/runbook review | 2026-07-23 (`b68c485`) | REL-001 |
| `SAFE-011` | Development autologin fail-closed guard | Required safeguard | **Implemented and reachable** | `docs/auth-plan.md`; `CLAUDE.md` | DEV and env gating plus build-time refusal | **Executed `2026-07-23R`: `tests/services/autoLoginPolicy.test.ts` passes**; production `dist/` contains no Supabase project reference or hostname | 2026-07-23R | Preserve exact dev-project isolation |
| `SAFE-012` | Development seed/simulation isolation | Required safeguard | **Implemented and reachable** | Seed scripts/operations documents | Guarded development seeding and reset controls | **Executed `2026-07-23R`: `tests/scripts/seedPolicy.test.ts` and `seedData.test.ts` pass**; live environment execution still not inspected | 2026-07-23R | Live environment execution not inspected |
| `SAFE-013` | Separate development and production Supabase projects | Required safeguard | **Unable to verify** | `CLAUDE.md`; production cutover docs | Distinct project references documented | Repository/deploy metadata only; live env values not read | 2026-07-23 (`b68c485`) | Do not infer full assurance |
| `SAFE-014` | Security headers and CSP | Required safeguard | **Implemented and reachable** | `netlify.toml` | CSP, HSTS, frame, MIME, referrer and permissions headers | Production deploy metadata; static config audit | 2026-07-23 (`b68c485`) | Narrow environment origins when practical |
| `SAFE-015` | No unsafe HTML rendering sink | Required safeguard | **Implemented and reachable** | Frontend security requirement | No `dangerouslySetInnerHTML` usage identified | Static search re-run `2026-07-23R` across `src/` — zero matches | 2026-07-23R | Retest when rich content is introduced |
| `SAFE-016` | Self-hosted fonts | Preferred safeguard | **Implemented and reachable** | Performance/privacy design | Local font assets/config | Static audit | 2026-07-23 (`b68c485`) | Preserve fallback and loading behaviour |
| `SAFE-017` | Append-only database migrations | Required safeguard | **Implemented and reachable** | `CLAUDE.md`; operations docs | 20 timestamped migration files | Static audit; live migration parity unverified | 2026-07-23 (`b68c485`) | Never rewrite applied migrations |
| `SAFE-018` | Optimistic save coordination | Required safeguard | **Partially implemented** | Prediction reliability | Custom save coordinator serialises same-key writes | Unit-test/static evidence | 2026-07-23 (`b68c485`) | REL-003, REL-004 and REL-007 |
| `SAFE-019` | Accessible modal focus management | Required safeguard | **Implemented and reachable** | WCAG/design requirements | Modal handles Escape, trap, restore and scroll lock | Static component review | 2026-07-23 (`b68c485`) | Retest with screen readers |
| `SAFE-020` | SPA skip link and route-change announcement | Required safeguard | **Not present** | WCAG 2.2 AA | No route focus/live-region system found | Static audit | 2026-07-23 (`b68c485`) | A11Y-001 |
| `SAFE-021` | Accessible custom menu keyboard model | Required safeguard | **Partially implemented** | WCAG/ARIA requirements | Menu roles exist without full keyboard behaviour | Static audit | 2026-07-23 (`b68c485`) | A11Y-002 |
| `SAFE-022` | Explicit loading, error, empty and degraded states | Required safeguard | **Partially implemented** | UX/reliability requirements | Shared states exist, but failures often become empty data | Static audit | 2026-07-23 (`b68c485`) | UX-002 and REL-002 |
| `SAFE-023` | Current-data refresh strategy | Required safeguard | **Not present** | Tournament reliability requirement | No global realtime/poll/focus refetch found | Static audit | 2026-07-23 (`b68c485`) | REL-005 |
| `SAFE-024` | Generated Supabase types and strict TS boundary | Preferred safeguard | **Not present** | Maintainability requirement | Strict mode off; generated DB types absent | Reinforced `2026-07-23R`: `tsconfig.app.json` has **no** `strict`-family flag at all, so the clean executed `tsc -b` does not prove null-safety | 2026-07-23R | TYPE-001 |
| `SAFE-025` | Repository CI quality gate | Required safeguard | **Not present** | Release requirement | No workflow files identified | Reinforced `2026-07-23R`: no `.github/` directory, and `netlify.toml` has **no `[build]` section**, so build command, publish directory and Node version are not version-controlled | 2026-07-23R | TEST-001 and OPS-003 |
| `SAFE-026` | Database/RLS integration test layer | Required safeguard | **Not present** | Testing requirement | No disposable database test harness | Static repository audit | 2026-07-23 (`b68c485`) | TEST-001 |
| `SAFE-027` | Browser end-to-end test layer | Required safeguard | **Not present** | Testing requirement | No Playwright/Cypress setup | Static repository audit | 2026-07-23 (`b68c485`) | TEST-001 |
| `SAFE-028` | Responsive mobile baseline | Required safeguard | **Partially implemented** | Mobile-first design system | Responsive CSS, bottom navigation and compact routes | Root automated mobile Lighthouse 97; authenticated screens not manually audited | 2026-07-23 (`b68c485`) | Retest 320px, landscape and large text |
| `SAFE-029` | Production deploy at audited application commit | Operational safeguard | **Implemented and reachable** | Netlify deployment metadata | Production deploy reported ready at `b68c485...` | Netlify metadata; no authenticated browser audit | 2026-07-23 (`b68c485`) | Quality docs were added later and do not alter app build |
| `SAFE-030` | Automated deploy secret scan | Operational safeguard | **Implemented and reachable** | Netlify deploy controls | No matches reported in 327 scanned files | Netlify metadata, plus **independent `2026-07-23R` checks**: no committed `.env`, no source maps in `dist/`, no Supabase reference in built assets. See `REPO-002` for the ignore-pattern gap. | 2026-07-23R | Does not replace manual secret review |
| `SAFE-031` | Safe production rollback | Required safeguard | **Confirmed regression** | Operational requirement | Current runbook points live config at dev Supabase | Static documentation review | 2026-07-23 (`b68c485`) | OPS-001 |
| `SAFE-032` | Audited administrator authorisation model | Required safeguard | **Not present** | Security/operations requirement | Runbooks reference missing role column; no active model | Static schema/docs review | 2026-07-23 (`b68c485`) | OPS-002 |
| `SAFE-033` | Production monitoring, logging and restore rehearsal | Required safeguard | **Not present** | Operational requirement | No complete repository controls identified | Static audit | 2026-07-23 (`b68c485`) | OPS-003 |
| `SAFE-034` | Deterministic recalculable scoring | Required safeguard | **Partially implemented** | `CLAUDE.md`; scoring rules | TS and SQL scorers, delete/rederive model | **Executed `2026-07-23R`: TS scoring tests pass, and doc/TS/SQL point values verified identical** (group 5/3/0 ×2 joker; positions 2 + 5; KO 10/15/20/25/40 as SQL cumulative 10/25/45/70/110; Golden Boot 25; goals 40/30/20/0). SQL still not executed. | 2026-07-23R | Preserve; add differential and concurrency tests |
| `SAFE-035` | Destructive league-action confirmations | Required safeguard | **Implemented and reachable** | UX/data safety | Leave/delete/transfer use confirmation flows | Static UI audit | 2026-07-23 (`b68c485`) | Preserve during refactors |
| `SAFE-036` | Original-versus-future competition scope separation | Required safeguard | **Implemented and reachable** | `docs/competition-structure.md` | No active bonus-game routes/tables/services; Original bracket is distinct | Static repository audit | 2026-07-23 (`b68c485`) | Do not import previous-project rules |
| `FEAT-044` | Sign-out flow | Implemented | **Implemented and reachable** | Account/More behaviour | Immediate sign-out action in current UI | Static audit | 2026-07-23 (`b68c485`) | UX-004: confirmation is an unresolved polish decision |
| `SAFE-037` | Idempotent first-entry creation | Required safeguard | **Partially implemented** | Entry lifecycle/data integrity | Unique `(user_id, tournament_id)` constraint with select-then-insert client flow | Static audit | 2026-07-23 (`b68c485`) | REL-006 two-tab race |
| `SAFE-038` | Authoritative documentation consistency | Required safeguard | **Partially implemented** | Quality governance and project-control documents | Extensive docs exist, but status/runbook conflicts were confirmed | Static audit | 2026-07-23 (`b68c485`) | DOC-001 |
| `SAFE-039` | Safe user-facing error mapping | Required safeguard | **Partially implemented** | Security/UX requirements | Some structured states exist; raw `Error.message` is still displayed | Static audit | 2026-07-23 (`b68c485`) | SEC-002 |
| `SAFE-040` | Atomic abuse rate limiting | Required safeguard | **Partially implemented** | Security/abuse requirements | Database rate-limit functions exist | Static SQL review | 2026-07-23 (`b68c485`) | DATA-007 concurrency gap |
| `SAFE-041` | Pinned application runtime | Required safeguard | **Not present** | Release reproducibility | No Node/runtime pin identified | Reinforced `2026-07-23R`: no `engines`, no `.nvmrc`, no `[build.environment]` pin. All executed checks ran on Node v22.22.2 with nothing in the repository asserting that is correct. | 2026-07-23R | OPS-004 |
| `SAFE-042` | Semantic bottom navigation | Preferred safeguard | **Partially implemented** | Accessibility/navigation requirements | Bottom navigation is functional but imperative | Static component audit | 2026-07-23 (`b68c485`) | A11Y-003 |
| `SAFE-043` | Explicit score-value bounds | Preferred safeguard | **Partially implemented** | Data validation requirements | Non-negative DB check and two-digit UI input | Static audit | 2026-07-23 (`b68c485`) | DATA-008: no documented practical DB maximum |
| `SAFE-044` | Release identification and repository metadata | Preferred safeguard | **Partially implemented** | Release/repository hygiene | Package exists but version remains `0.0.0`; licence/changelog/editor baseline absent | Static repository audit | 2026-07-23 (`b68c485`) | DOC-002 and REPO-001 |

## Feature-preservation rules

- Do not add assumed features or rules.
- Do not import features, scoring or architecture from previous predictor projects.
- Planned features must not be recorded as implemented.
- Database scaffolding alone is not a completed feature.
- An unreachable component is not a completed user-facing feature.
- A hidden interface does not prove that a feature is absent; inspect routes, imports, flags, services and data.
- A visual prototype without working data and actions is a prototype, not a complete feature.
- Renamed or relocated capabilities should retain their baseline identity where the material behaviour is unchanged.
- Intentionally removed or superseded features retain their row and decision reference.
- Security, data, deployment, accessibility and testing safeguards remain listed after refactoring.
- Where intended and actual behaviour conflict, keep both visible until repaired or explicitly decided.
- Every future full audit and release-sensitive review must compare the current implementation against this file.
- Update a row only with current code/runtime evidence and repeatable validation evidence; do not update it from memory, comments or a passing test name alone.

## Status vocabulary

Use one of the established statuses already present in the table, including:

- Implemented and reachable
- Implemented but unreachable
- Partially implemented
- UI prototype only
- Backend or database only
- Feature-flagged
- Documented but not implemented
- Planned
- Deferred
- Legacy
- Obsolete
- Removed intentionally
- Confirmed regression
- Likely regression
- Not present
- Unable to verify
