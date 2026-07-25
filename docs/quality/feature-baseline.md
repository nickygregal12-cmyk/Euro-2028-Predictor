# Current feature and safeguard baseline

**Latest formal audit:** [`2026-07-25-repeat-verification-audit.md`](audits/2026-07-25-repeat-verification-audit.md) (`2026-07-25R`)  
**Current hosted state:** [`current-status.md`](current-status.md)  
**Latest recovery/audit reconciliation:** [`reconciliations/2026-07-25-production-backup-and-repeat-audit.md`](reconciliations/2026-07-25-production-backup-and-repeat-audit.md)  
**Identifier repair:** [`reconciliations/2026-07-24-feature-baseline-identifiers.md`](reconciliations/2026-07-24-feature-baseline-identifiers.md)

> **Stable traceability control.** Every compact current row has one primary identifier. All 96 identifiers from the archived baseline (`FEAT-001`–`FEAT-044`, `PLAN-001`–`PLAN-008`, `SAFE-001`–`SAFE-044`) remain in the continuity register with an explicit disposition. New capabilities introduced after that archive use identifiers beginning at `FEAT-045` and `SAFE-045`.
>
> Current `main` code, migrations, executable tests and verified hosted evidence override older status wording. Consolidation never frees an identifier for reuse.

This baseline prevents silent feature loss and scope import. Update it whenever classification, reachability, enforcement layer or hosted status changes.

## Classification rules

- **Implemented and production-hosted:** working capability supported by the current production schema.
- **Deployed client / backend absent:** production client exists but required production database capability is missing.
- **Repository/development implemented:** working code and/or hosted-development support exists, but production is incomplete.
- **Partial:** meaningful implementation exists but a required layer, route or journey remains absent.
- **UI prototype only:** presentation exists without a working production data path.
- **Documented/planned:** intent exists without current working implementation.
- **Not present:** no current implementation evidence.

## Original Predictor and core application

| ID | Capability | Current classification | Evidence boundary |
| --- | --- | --- | --- |
| `FEAT-001` | Authentication, signup/login, password recovery, moderation and sign-out | Implemented and production-hosted | Auth routes and Supabase integration; final launch SMTP/Turnstile settings still require verification |
| `FEAT-006` | First-use welcome gate | Implemented and production-hosted | `/welcome`, profile `welcomed_at`, browser E2E |
| `FEAT-009` | Group score prediction | Implemented and production-hosted | Predictor UI and `match_predictions` |
| `FEAT-015` | Joker selection | Implemented and production-hosted | UI, database guard and scoring configuration |
| `FEAT-010` | Predicted group table | Implemented and production-hosted | Pure tournament-domain logic |
| `FEAT-045` | Recursive head-to-head predicted ordering | Production client plus repository/development SQL parity | Private SQL resolver pending production rollout |
| `FEAT-012` | Manual predicted same-group tie resolution | Implemented and production-hosted | Stronger server replay/validation pending production rollout |
| `FEAT-013` | Best-third ranking and manual boundary resolution | Implemented and production-hosted | Server replay pending production rollout |
| `FEAT-014` | Winner-only Original Predictor bracket | **Deployed client / backend absent** | Production lacks `replace_predicted_progression` |
| `FEAT-046` | Atomic complete-bracket replacement | **Deployed client / backend absent** | Migration 33 and browser conflicts pass in disposable environments; production RPC absent |
| `FEAT-016` | Golden Boot selection | Implemented and production-hosted | Original prediction data and UI |
| `FEAT-017` | Derived group-stage goals prediction | Implemented and production-hosted | Derived from 36 group scores |
| `FEAT-018` | Review and manual submission UI | Implemented and production-hosted | Production submission boundary remains the old contract |
| `FEAT-047` | Pending-write settlement before manual submit | Repository implemented | Provider and disposable browser tests pass; production closure pending |
| `FEAT-048` | Persisted score clearing | **Deployed client / backend absent** | Production lacks `delete_match_prediction`; current client fails closed |
| `FEAT-020` | Automatic valid-entry submission at lock | Documented/planned | No scheduler/server implementation |
| `FEAT-041` | Deadline reminder emails | Documented/planned | No scheduler or email implementation |

## Competition integrity safeguards

| ID | Safeguard | Current classification | Production position |
| --- | --- | --- | --- |
| `SAFE-007` | RPC-only submission | Repository/development implemented | Production clients can still update entries directly |
| `SAFE-045` | Server-derived predicted group positions | Repository/development implemented | Production table remains client-writable |
| `SAFE-008` | Same-tournament prediction guards | Partial repository/development | Major guards exist; draft migration 36 is unmerged; production pending |
| `SAFE-006` | Lock-time write rejection | Partial | Earlier production triggers exist; hardened boundaries pending |
| `SAFE-009` | Full predicted bracket-tree replay | Repository/development implemented | Production submission uses old validation |
| `SAFE-046` | Optimistic complete-bracket conflict detection | **Deployed client / backend absent** | Production client expects the atomic RPC |
| `SAFE-047` | Save-settlement submission barrier | Repository implemented | Compatible-production browser evidence pending |
| `SAFE-048` | Version-safe match-prediction deletion | **Deployed client / backend absent** | Production backend does not contain the RPC |
| `SAFE-049` | Derived-position invalidation after score clear | Repository/development implemented | Production cannot reach the required delete-trigger path |
| `SAFE-050` | Authoritative result method and winner | Repository/development implemented | Production result lifecycle absent |
| `SAFE-051` | Immutable result revision history | Repository/development implemented | Production revision path absent |
| `SAFE-052` | Real knockout winner propagation | Repository/development implemented | Production propagation absent |
| `SAFE-010` | Serialized score recomputation | Repository/development implemented | Production old scorer remains |
| `SAFE-053` | Exact function execution allowlists | Repository/development implemented | Production broad grants remain |
| `SAFE-013` | Production/development environment separation | Implemented for the current Netlify project | Non-production contexts use development Supabase; legacy site remains separate `OPS-008` |
| `SAFE-054` | Application/schema compatibility gate | Implemented and containing mismatch | Repository contract 35 cannot deploy while production declares 20 |
| `SAFE-039` | Safe user-facing error mapping | Implemented | Central mapper prevents raw infrastructure details reaching users |

## Leagues, social and viewing

| ID | Capability | Current classification | Notes |
| --- | --- | --- | --- |
| `FEAT-027` | Overall standings | Implemented and production-hosted | Integrity still depends on production rollout |
| `FEAT-028` | Private league create, join, leave, delete and transfer | Implemented and production-hosted | Abuse/security review remains |
| `FEAT-029` | Invite deep links | Implemented and production-hosted | Pre-auth invite preview remains weak |
| `FEAT-049` | League detail and member rows | Implemented and production-hosted | Other-player destination incomplete |
| `FEAT-031` | H2H comparison | Implemented and production-hosted, pass 1 | Rank graph and bracket health planned |
| `FEAT-035` | Own profile and points breakdown | Implemented and production-hosted | `/profile` and points redirect present |
| `FEAT-036` | Other-player full profile | Partial/UI prototype | Final secure route and complete flow absent |
| `FEAT-032` | Match list and Match Centre | Implemented and production-hosted | Expanded phase/admin states planned |
| `FEAT-050` | Post-lock prediction trends | Documented/planned | No production capability |

## Administration, accessibility, assurance and operations

| ID | Capability or safeguard | Classification | Notes |
| --- | --- | --- | --- |
| `FEAT-040` | Result confirm, correct and clear server functions | Repository/development implemented | Service-role functions pending production rollout |
| `FEAT-039` | Browser result administration | Not present | No approved browser admin model/page |
| `SAFE-032` | Administrator bootstrap and authorization model | Not present | Former `profiles.role` runbook is invalid/disabled |
| `SAFE-012` | Fake clock and simulation isolation | Partial development capability | Full isolated rehearsal remains open |
| `SAFE-025` | Application CI | Implemented | Install, build, lint, tests and dependency audit |
| `SAFE-026` | Disposable database integration CI | Implemented | Migration rebuild, lint, pgTAP and differential parity |
| `SAFE-055` | Provider submission/clear regression tests | Implemented | Not a substitute for browser/production evidence |
| `SAFE-027` | Browser E2E | **Implemented for disposable Supabase** | Auth, predictions, saves, conflicts, locks, signup and recovery covered; invite/admin/accessibility/production smoke open |
| `FEAT-042` | Monitoring and alerting | Not verified/present | Open operations work |
| `SAFE-033` | Verified backup and restore | **Partial** | Encrypted checksum-verified off-device artifact exists; retrieval and disposable restore absent |
| `SAFE-031` | Safe application rollback | Documented | Must prove compatibility with actual production schema |
| `SAFE-029` | Automatic production deploy | Implemented by Netlify/Git | Guarded by `SAFE-054`; production remains frozen |

Current route-accessibility implementation includes route titles, live announcements, main-content focus and skip navigation. League options use disclosure semantics. Retained keyboard/screen-reader browser proof remains open under `A11Y-001` and `TEST-001`.

## Bonus competition scope

| ID | Competition | Classification |
| --- | --- | --- |
| `PLAN-001` | KO Predictor | Documented/planned launch scope |
| `PLAN-002` | Last Man Standing | Documented/planned launch scope |
| `PLAN-003` | Predictor Cup | Rules/planning present; implementation absent |
| `PLAN-008` | Sweepstake builder | Planned future; non-launch-blocking |
| `PLAN-004` | Fan Duels as a separate mode | Legacy/superseded by Predictor Cup |

No bonus game is implemented merely because a design note or component-gallery concept exists.

## Identifier continuity and archived dispositions

The archived source is [`history/feature-baseline-2026-07-23R.md`](history/feature-baseline-2026-07-23R.md). These dispositions are permanent traceability statements.

| Archived ID(s) | Disposition in the current baseline |
| --- | --- |
| `FEAT-001` | Primary ID for consolidated authentication/account access |
| `FEAT-002`, `FEAT-003`, `FEAT-004`, `FEAT-005`, `FEAT-044` | Consolidated into `FEAT-001`; IDs remain reserved |
| `FEAT-006` | Primary current row |
| `FEAT-007` | Preserved standalone: theme switching |
| `FEAT-008` | Preserved standalone: tournament reference-data loading |
| `FEAT-009`, `FEAT-010`, `FEAT-012`, `FEAT-013`, `FEAT-014`, `FEAT-015`, `FEAT-016`, `FEAT-017`, `FEAT-020`, `FEAT-027`, `FEAT-029`, `FEAT-031`, `FEAT-035`, `FEAT-036`, `FEAT-039`, `FEAT-040`, `FEAT-041`, `FEAT-042` | Retained as primary current-row IDs |
| `FEAT-011` | Consolidated into `SAFE-045` |
| `FEAT-018`, `FEAT-019` | Consolidated into current submission row `FEAT-018` |
| `FEAT-021` | Consolidated into lock safeguard `SAFE-006` |
| `FEAT-022`, `FEAT-023`, `FEAT-024`, `FEAT-025`, `FEAT-026` | Preserved standalone scoring capabilities governed by scoring authorities and `SAFE-034` |
| `FEAT-028`, `FEAT-030` | Consolidated into private-league lifecycle `FEAT-028` |
| `FEAT-032`, `FEAT-033` | Consolidated into Match list/centre `FEAT-032` |
| `FEAT-034` | Preserved standalone: Home dashboard |
| `FEAT-037` | Preserved standalone: share-card capability |
| `FEAT-038` | Preserved standalone: scoring explanation route |
| `FEAT-043` | Preserved standalone: public marketing landing not approved/present |
| `PLAN-001`, `PLAN-002`, `PLAN-003`, `PLAN-004`, `PLAN-008` | Retained as primary current rows |
| `PLAN-005` | Preserved planned: bonus-games hub |
| `PLAN-006` | Preserved planned: shared knockout prediction store |
| `PLAN-007` | Preserved planned: typed competition entries |
| `SAFE-001`, `SAFE-002`, `SAFE-003`, `SAFE-004` | Preserved architecture safeguards: domain, route splitting, service boundary and RLS |
| `SAFE-005` | Preserved search-path safeguard; exact allowlists use `SAFE-053` |
| `SAFE-006`, `SAFE-007`, `SAFE-008`, `SAFE-009`, `SAFE-010`, `SAFE-012`, `SAFE-013`, `SAFE-025`, `SAFE-026`, `SAFE-027`, `SAFE-029`, `SAFE-031`, `SAFE-032`, `SAFE-033` | Retained as primary current-row IDs |
| `SAFE-011` | Preserved development-autologin safeguard |
| `SAFE-014`, `SAFE-015`, `SAFE-016`, `SAFE-017` | Preserved security, privacy and migration safeguards |
| `SAFE-018` | Preserved optimistic-save safeguard; strengthened controls use `SAFE-046`–`SAFE-048` |
| `SAFE-019`, `SAFE-020`, `SAFE-021`, `SAFE-022`, `SAFE-023`, `SAFE-024` | Preserved accessibility, state, refresh and type-safety safeguards |
| `SAFE-028`, `SAFE-030` | Preserved mobile and secret-scan safeguards |
| `SAFE-034` | Preserved deterministic-scoring safeguard |
| `SAFE-035` | Consolidated into private-league lifecycle; destructive confirmations remain mandatory |
| `SAFE-036` | Preserved competition-scope separation safeguard |
| `SAFE-037`, `SAFE-038`, `SAFE-039`, `SAFE-040` | Preserved entry, documentation, safe-error and rate-limit safeguards |
| `SAFE-041`, `SAFE-042`, `SAFE-043`, `SAFE-044` | Preserved runtime, navigation, score-bound and release-metadata safeguards |

## New identifier register

| New ID | Introduced capability or safeguard |
| --- | --- |
| `FEAT-045` | Recursive head-to-head predicted ordering |
| `FEAT-046` | Atomic complete-bracket replacement |
| `FEAT-047` | Pending-write settlement before manual submission |
| `FEAT-048` | Persisted score clearing |
| `FEAT-049` | League detail and member rows |
| `FEAT-050` | Post-lock prediction trends |
| `SAFE-045` | Server-derived predicted group positions |
| `SAFE-046` | Optimistic complete-bracket conflict detection |
| `SAFE-047` | Save-settlement submission barrier |
| `SAFE-048` | Version-safe match-prediction deletion |
| `SAFE-049` | Derived-position invalidation after score clear |
| `SAFE-050` | Authoritative result method and winner |
| `SAFE-051` | Immutable result revision history |
| `SAFE-052` | Real knockout winner propagation |
| `SAFE-053` | Exact function execution allowlists |
| `SAFE-054` | Application/schema compatibility gate |
| `SAFE-055` | Provider submission and clear regression tests |

## Current route and data baseline

Current `main` retains the authenticated Original Predictor, league, H2H, match, profile and auth routes plus catch-all. `/dev/components` is development-only. Route counts do not prove completeness or database compatibility.

Production rollout guards are source invariants, not changing total-user counts:

- one submitted entry;
- 36 predictions;
- two tie decisions;
- eight progression rows;
- zero stored match scores;
- fingerprints `320cf25d...`, `a4dcf183...`, `0d7bc491...`.

Development has exactly 35 canonical migration-history rows. Production has no migration-history table and remains contract 20.

## Safeguard regression rules

A future change must not silently:

- weaken lock, ownership, same-tournament, version or submission checks;
- re-enable direct browser writes to server-owned scoring inputs;
- add direct-table fallbacks for missing production RPCs;
- bypass the settlement barrier before manual submission;
- delete a persisted score without expected-version protection;
- accept structurally impossible brackets;
- mix Original Predictor and bonus-game points or leagues;
- blend predicted and real bracket state;
- point production or previews at the wrong Supabase environment;
- deploy code requiring absent database capabilities without an explicit compatibility decision;
- change scoring values without updating rules, TypeScript, SQL and tests;
- treat roadmap or gallery content as implemented;
- classify an encrypted but unrestored backup as proven recovery.
