# Current feature and safeguard baseline

**Latest development reconciliation:** [`reconciliations/2026-07-27-admin-migration-version-reconciliation.md`](reconciliations/2026-07-27-admin-migration-version-reconciliation.md)
**Last verified final-target baseline:** [`reconciliations/2026-07-27-contract-38-final-target-promotion.md`](reconciliations/2026-07-27-contract-38-final-target-promotion.md)
**Sentry assurance:** [`reconciliations/2026-07-26-sentry-operational-assurance.md`](reconciliations/2026-07-26-sentry-operational-assurance.md)  
**Current hosted state:** [`current-status.md`](current-status.md)  
**Identifier repair:** [`reconciliations/2026-07-24-feature-baseline-identifiers.md`](reconciliations/2026-07-24-feature-baseline-identifiers.md)

> Every compact current row has one primary identifier. All archived identifiers remain reserved in the continuity register. Current code, migrations, tests and verified hosted evidence override older wording.

## Classification rules

- **Implemented and final-target-hosted:** working capability supported by the verified contract-38 production application/database pair.
- **Implemented and development-hosted; final-target pending:** reserved for a future development-only capability that has not yet reached production.
- **Implemented with evidence gap:** hosted capability exists but a required browser/operational journey remains incomplete.
- **Partial:** meaningful implementation exists but a required layer, route or journey is absent.
- **UI prototype only:** presentation exists without an authoritative data path.
- **Documented/planned:** intent exists without working implementation.
- **Not present:** no current implementation evidence.

Repository, development Supabase and non-production Netlify contexts are contract 43; production Supabase and Netlify production remain deliberately locked at contract 38 after the verified milestone release. See `current-status.md` for the live contract position.

## Original Predictor and core application

| ID | Capability | Current classification | Evidence boundary |
| --- | --- | --- | --- |
| `FEAT-001` | Authentication, signup/login, password recovery, moderation and sign-out | Implemented and final-target-hosted | Auth routes/Supabase; final SMTP/Turnstile settings remain |
| `FEAT-006` | First-use welcome gate | Implemented and final-target-hosted | `/welcome`, `welcomed_at`, Browser E2E |
| `FEAT-009` | Group score prediction | Implemented and final-target-hosted | Predictor UI and protected prediction boundary |
| `FEAT-015` | Joker selection | Implemented and final-target-hosted | UI, database guard and scoring config |
| `FEAT-010` | Predicted group table | Implemented and final-target-hosted | Domain logic and derived-position path |
| `FEAT-045` | Recursive head-to-head predicted ordering | Implemented and final-target-hosted | SQL resolver and TypeScript parity |
| `FEAT-012` | Manual predicted same-group tie resolution | Implemented and final-target-hosted | Replay/validation and stored decisions |
| `FEAT-013` | Best-third ranking/manual boundary resolution | Implemented and final-target-hosted | Replay and exact-set decisions |
| `FEAT-014` | Winner-only Original bracket | Implemented and final-target-hosted | Atomic persistence and full-tree replay |
| `FEAT-046` | Atomic complete-bracket replacement | Implemented and final-target-hosted | Protected RPC and conflict boundary |
| `FEAT-016` | Golden Boot selection | Implemented and final-target-hosted | Prediction data/UI |
| `FEAT-017` | Derived group-stage goals | Implemented and final-target-hosted | Derived from 36 group scores |
| `FEAT-018` | Review and manual submission | Implemented and final-target-hosted | RPC-only submission boundary |
| `FEAT-047` | Pending-write settlement before submit | Implemented and final-target-hosted | Browser coverage and smoke |
| `FEAT-048` | Persisted score clearing | Implemented with evidence gap | RPC/trigger hosted; final-target browser proof remains |
| `FEAT-020` | Automatic valid-entry submission at lock | Documented/planned | Approved target; no scheduler/server implementation |
| `FEAT-041` | Deadline reminder emails | Documented/planned | No scheduler/email implementation |

## Competition integrity safeguards

| ID | Safeguard | Current classification | Current position |
| --- | --- | --- | --- |
| `SAFE-007` | RPC-only submission | Implemented and final-target-hosted | Direct browser entry mutation denied |
| `SAFE-045` | Server-derived predicted positions | Implemented and final-target-hosted | Derived/protected rows |
| `SAFE-008` | Same-tournament and authoritative reference guards | Implemented and final-target-hosted | Migration 36 guards six relationship groups in development and the final target |
| `SAFE-006` | Lock-time write rejection | Implemented and final-target-hosted | Final browser lock assurance remains |
| `SAFE-009` | Full predicted bracket replay | Implemented and final-target-hosted | Validation/submission replay |
| `SAFE-046` | Optimistic bracket conflict detection | Implemented and final-target-hosted | Atomic expected-version boundary |
| `SAFE-047` | Save-settlement submission barrier | Implemented and final-target-hosted | Submission-settlement proof |
| `SAFE-048` | Version-safe prediction deletion | Implemented with evidence gap | Final-target browser clear/conflict proof remains |
| `SAFE-049` | Derived-position invalidation after clear | Implemented and final-target-hosted | Trigger path hosted |
| `SAFE-050` | Authoritative result method/winner | Implemented and final-target-hosted | Database authority; frontend penalty consumption needs repair |
| `SAFE-051` | Immutable result revision history | Implemented and final-target-hosted | Direct-access denial and verifier |
| `SAFE-052` | Real knockout winner propagation | Implemented and final-target-hosted | Contract-36 functions/validation hosted |
| `SAFE-010` | Serialized score recomputation | Implemented and final-target-hosted | Result/scoring operations serialized |
| `SAFE-053` | Exact function execution allowlists | Implemented and final-target-hosted | Zero anonymous application execution in verifier |
| `SAFE-013` | Final-target/development isolation | Implemented and hosted | Production uses final-target; non-production uses development |
| `SAFE-054` | Application/schema compatibility gate | Implemented and actively enforcing | Development and production 38/38 verified; incompatible builds blocked |

Safe error mapping and redacting client-error capture remain governed by preserved `SAFE-039`.

## Leagues, social and viewing

| ID | Capability | Current classification | Notes |
| --- | --- | --- | --- |
| `FEAT-027` | Overall standings | Implemented and final-target-hosted | Contract-36 scoring reads |
| `FEAT-028` | Private league lifecycle | Implemented and final-target-hosted | Abuse/security review remains |
| `FEAT-029` | Invite deep links | Implemented and final-target-hosted | Pre-auth context weak |
| `FEAT-049` | League detail/member rows | Implemented and final-target-hosted | Other-player destination incomplete |
| `FEAT-031` | H2H comparison | Implemented and final-target-hosted, pass 1 | Rank graph/bracket health planned; penalty winner repair needed |
| `FEAT-035` | Own profile/points breakdown | Implemented and final-target-hosted | `/profile` present |
| `FEAT-036` | Other-player full profile | Partial/UI prototype | Complete secure flow absent |
| `FEAT-032` | Match list and Match Centre | Implemented and final-target-hosted | Authoritative penalty-winner display/impact repair remains |
| `FEAT-050` | Post-lock trends | Documented/planned | No hosted capability |

## Administration, accessibility, assurance and operations

| ID | Capability/safeguard | Classification | Notes |
| --- | --- | --- | --- |
| `FEAT-040` | Result confirm/correct/clear server functions | Implemented and final-target-hosted | Authoritative service-role functions; contract-38 browser wrappers remain pending on production |
| `FEAT-039` | Browser result administration | Partial on `main` | Protected routes, read-only control room and authorised RPC wrappers are merged; mutation UI/E2E remain |
| `SAFE-032` | Administrator bootstrap/authorization | Partial | Fail-closed `app_metadata` capability model is implemented; hosted assignment/custody evidence remains |
| `SAFE-012` | Fake clock/simulation isolation | Partial development capability | Full rehearsal open |
| `SAFE-025` | Application CI | Implemented | Build, lint, tests and audit passed on the contract-38 administrator merge |
| `SAFE-026` | Disposable database integration CI | Implemented | Full 38 rebuild, lint, pgTAP and parity |
| `SAFE-055` | Provider submission/clear regression tests | Implemented | Not all final-target browser evidence |
| `SAFE-027` | Browser E2E and hosted preview smoke | Implemented for disposable and development preview | Contract-38 authenticated, auth recovery, exact-head HTTP and anonymous browser smoke passed |
| `FEAT-042` | Monitoring and alerting | Partial hosted capability | Privacy-safe production Sentry delivery is verified; retention, server-side/IP scrubbing confirmation, backup recipient, escalation and rollback rehearsal remain |
| `SAFE-033` | Verified backup/restore | Implemented and accepted | Encrypted artifact and clean restore proof |
| `SAFE-031` | Safe application rollback | Procedure implemented; hosted rehearsal pending | Final-target rollback rehearsal remains |
| `SAFE-029` | Automatic final-target deploy | Implemented but contract-gated | Retained production stays 36; contract-38 main is correctly blocked until final promotion |

Route titles, live announcements, main focus and skip navigation exist. Manual screen-reader review remains open.

## Bonus competition scope

| ID | Competition | Classification |
| --- | --- | --- |
| `PLAN-001` | KO Predictor | Documented/planned launch scope |
| `PLAN-002` | Last Man Standing | Documented/planned launch scope |
| `PLAN-003` | Predictor Cup | Rules/planning; implementation absent |
| `PLAN-008` | Sweepstake builder | Future/non-launch-blocking |
| `PLAN-004` | Fan Duels separate mode | Legacy/superseded by Predictor Cup |

No bonus game is implemented merely because it appears in design or roadmap material.

## Identifier continuity and archived dispositions

Archived source: [`history/feature-baseline-2026-07-23R.md`](history/feature-baseline-2026-07-23R.md).

| Archived ID(s) | Disposition |
| --- | --- |
| `FEAT-001` | Primary consolidated authentication/account ID |
| `FEAT-002`, `FEAT-003`, `FEAT-004`, `FEAT-005`, `FEAT-044` | Consolidated into `FEAT-001`; reserved |
| `FEAT-006` | Primary current row |
| `FEAT-007` | Theme switching preserved |
| `FEAT-008` | Tournament reference loading preserved |
| `FEAT-009`, `FEAT-010`, `FEAT-012`, `FEAT-013`, `FEAT-014`, `FEAT-015`, `FEAT-016`, `FEAT-017`, `FEAT-020`, `FEAT-027`, `FEAT-029`, `FEAT-031`, `FEAT-035`, `FEAT-036`, `FEAT-039`, `FEAT-040`, `FEAT-041`, `FEAT-042` | Retained as primary rows |
| `FEAT-011` | Consolidated into `SAFE-045` |
| `FEAT-018`, `FEAT-019` | Consolidated into `FEAT-018` |
| `FEAT-021` | Consolidated into `SAFE-006` |
| `FEAT-022`, `FEAT-023`, `FEAT-024`, `FEAT-025`, `FEAT-026` | Preserved scoring capabilities under `SAFE-034` |
| `FEAT-028`, `FEAT-030` | Consolidated into `FEAT-028` |
| `FEAT-032`, `FEAT-033` | Consolidated into `FEAT-032` |
| `FEAT-034` | Home dashboard preserved |
| `FEAT-037` | Share-card preserved |
| `FEAT-038` | Scoring explanation preserved |
| `FEAT-043` | Public marketing landing not approved/present |
| `PLAN-001`, `PLAN-002`, `PLAN-003`, `PLAN-004`, `PLAN-008` | Retained primary rows |
| `PLAN-005` | Planned bonus hub |
| `PLAN-006` | Planned shared KO store |
| `PLAN-007` | Planned typed competition entries |
| `SAFE-001`, `SAFE-002`, `SAFE-003`, `SAFE-004` | Domain, splitting, service and RLS safeguards preserved |
| `SAFE-005` | Search-path safeguard; exact allowlists use `SAFE-053` |
| `SAFE-006`, `SAFE-007`, `SAFE-008`, `SAFE-009`, `SAFE-010`, `SAFE-012`, `SAFE-013`, `SAFE-025`, `SAFE-026`, `SAFE-027`, `SAFE-029`, `SAFE-031`, `SAFE-032`, `SAFE-033` | Retained primary rows |
| `SAFE-011` | Development-autologin safeguard preserved |
| `SAFE-014`, `SAFE-015`, `SAFE-016`, `SAFE-017` | Security/privacy/migration safeguards preserved |
| `SAFE-018` | Optimistic-save safeguard; strengthened by `SAFE-046`–`SAFE-048` |
| `SAFE-019`, `SAFE-020`, `SAFE-021`, `SAFE-022`, `SAFE-023`, `SAFE-024` | Accessibility/state/refresh/type safeguards preserved |
| `SAFE-028`, `SAFE-030` | Mobile and secret-scan safeguards preserved |
| `SAFE-034` | Deterministic scoring safeguard preserved |
| `SAFE-035` | Consolidated private-league lifecycle; confirmations remain mandatory |
| `SAFE-036` | Competition separation preserved |
| `SAFE-037`, `SAFE-038`, `SAFE-039`, `SAFE-040` | Entry/docs/safe-error/rate-limit safeguards preserved |
| `SAFE-041`, `SAFE-042`, `SAFE-043`, `SAFE-044` | Runtime/navigation/score-bound/release safeguards preserved |

## New identifier register

| ID | Capability/safeguard |
| --- | --- |
| `FEAT-045` | Recursive H2H predicted ordering |
| `FEAT-046` | Atomic complete-bracket replacement |
| `FEAT-047` | Submission settlement |
| `FEAT-048` | Persisted score clearing |
| `FEAT-049` | League detail/member rows |
| `FEAT-050` | Post-lock trends |
| `SAFE-045` | Server-derived positions |
| `SAFE-046` | Bracket conflict detection |
| `SAFE-047` | Submission settlement barrier |
| `SAFE-048` | Version-safe deletion |
| `SAFE-049` | Position invalidation after clear |
| `SAFE-050` | Authoritative result method/winner |
| `SAFE-051` | Immutable revisions |
| `SAFE-052` | Real winner propagation |
| `SAFE-053` | Exact function allowlists |
| `SAFE-054` | App/schema compatibility gate |
| `SAFE-055` | Submission/clear regression tests |

## Current route and data baseline

Current `main` has authenticated Original Predictor, league, H2H, match, profile and auth routes plus catch-all. Development-only routes remain gated. Protected administrator routes and the read-only control-room foundation are merged.

Development is verified with 38 canonical migrations. The final target retains 36 migrations; exactly migrations 37–38 require controlled promotion.

## Safeguard regression rules

Do not silently:

- weaken locks, ownership, same-tournament, version or submission checks;
- re-enable direct browser writes to server-owned inputs;
- bypass RPCs, settlement or expected-version deletion;
- accept impossible brackets;
- infer penalty winners from tied public scores;
- mix Original/bonus points or predicted/real brackets;
- cross Supabase/Netlify environments or use the legacy World Cup site;
- deploy against an unverified database contract;
- omit target contract from smoke commands;
- disable or misdescribe approved Sentry production delivery;
- expose sensitive observability data;
- change scoring without rules/TypeScript/SQL/tests;
- describe planned auto-submit or roadmap/gallery content as implemented;
- treat an unrestored backup as recovery proof.
