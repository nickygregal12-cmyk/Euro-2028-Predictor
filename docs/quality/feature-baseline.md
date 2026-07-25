# Current feature and safeguard baseline

**Latest production reconciliation:** [`reconciliations/2026-07-25-contract-35-production-promotion.md`](reconciliations/2026-07-25-contract-35-production-promotion.md)  
**Current hosted state:** [`current-status.md`](current-status.md)  
**Latest formal pre-rollout audit:** [`audits/2026-07-25-repeat-verification-audit.md`](audits/2026-07-25-repeat-verification-audit.md) (`2026-07-25R`)  
**Identifier repair:** [`reconciliations/2026-07-24-feature-baseline-identifiers.md`](reconciliations/2026-07-24-feature-baseline-identifiers.md)

> **Stable traceability control.** Every compact current row has one primary identifier. All 96 identifiers from the archived baseline (`FEAT-001`–`FEAT-044`, `PLAN-001`–`PLAN-008`, `SAFE-001`–`SAFE-044`) remain in the continuity register with an explicit disposition. New capabilities introduced after that archive use identifiers beginning at `FEAT-045` and `SAFE-045`.
>
> Current `main` code, migrations, executable tests and verified hosted evidence override older status wording. Consolidation never frees an identifier for reuse.

This baseline prevents silent feature loss and scope import. Update it whenever classification, reachability, enforcement layer or hosted status changes.

## Classification rules

- **Implemented and production-hosted:** working capability supported by the current production application/database pair.
- **Implemented with evidence gap:** production capability is present, but a specific browser/operational journey remains under a separate assurance finding.
- **Repository/development implemented:** working code and/or hosted-development support exists, but production is incomplete.
- **Partial:** meaningful implementation exists but a required layer, route or journey remains absent.
- **UI prototype only:** presentation exists without a working production data path.
- **Documented/planned:** intent exists without current working implementation.
- **Not present:** no current implementation evidence.

## Original Predictor and core application

| ID | Capability | Current classification | Evidence boundary |
| --- | --- | --- | --- |
| `FEAT-001` | Authentication, signup/login, password recovery, moderation and sign-out | Implemented and production-hosted | Auth routes and Supabase integration; final launch SMTP/Turnstile settings still require verification |
| `FEAT-006` | First-use welcome gate | Implemented and production-hosted | `/welcome`, profile `welcomed_at`, Browser E2E |
| `FEAT-009` | Group score prediction | Implemented and production-hosted | Predictor UI and protected `match_predictions` boundary |
| `FEAT-015` | Joker selection | Implemented and production-hosted | UI, database guard and scoring configuration |
| `FEAT-010` | Predicted group table | Implemented and production-hosted | Pure tournament-domain logic and production derived-position path |
| `FEAT-045` | Recursive head-to-head predicted ordering | Implemented and production-hosted | Private SQL resolver and TypeScript parity are deployed at contract 35 |
| `FEAT-012` | Manual predicted same-group tie resolution | Implemented and production-hosted | Production replay/validation and stored decisions verified |
| `FEAT-013` | Best-third ranking and manual boundary resolution | Implemented and production-hosted | Production replay and exact-set decisions verified |
| `FEAT-014` | Winner-only Original Predictor bracket | Implemented and production-hosted | Production atomic persistence and full-tree replay are present |
| `FEAT-046` | Atomic complete-bracket replacement | Implemented and production-hosted | Production RPC present; rollback-only authenticated smoke passed |
| `FEAT-016` | Golden Boot selection | Implemented and production-hosted | Original prediction data and UI |
| `FEAT-017` | Derived group-stage goals prediction | Implemented and production-hosted | Derived from 36 group scores |
| `FEAT-018` | Review and manual submission UI | Implemented and production-hosted | Production RPC-only submission boundary verified |
| `FEAT-047` | Pending-write settlement before manual submit | Implemented and production-hosted | Disposable browser coverage and rollback-only production submission smoke passed |
| `FEAT-048` | Persisted score clearing | Implemented with evidence gap | Production RPC/trigger path is deployed; controlled authenticated production browser clear/reload evidence remains under `TEST-001` |
| `FEAT-020` | Automatic valid-entry submission at lock | Documented/planned | No scheduler/server implementation |
| `FEAT-041` | Deadline reminder emails | Documented/planned | No scheduler or email implementation |

## Competition integrity safeguards

| ID | Safeguard | Current classification | Production position |
| --- | --- | --- | --- |
| `SAFE-007` | RPC-only submission | Implemented and production-hosted | Direct browser entry mutation is denied; submission smoke passed |
| `SAFE-045` | Server-derived predicted group positions | Implemented and production-hosted | Exactly 24 production rows were derived and protected |
| `SAFE-008` | Same-tournament prediction guards | Partial | Major production guards exist; wider reference integrity remains under `DATA-003`/`DATA-006`; draft migration 36 is unmerged |
| `SAFE-006` | Lock-time write rejection | Implemented and production-hosted | Hardened production boundaries are present; final browser lock journey remains part of assurance coverage |
| `SAFE-009` | Full predicted bracket-tree replay | Implemented and production-hosted | Production validation and submission replay passed |
| `SAFE-046` | Optimistic complete-bracket conflict detection | Implemented and production-hosted | Atomic RPC and expected-version boundary deployed; production smoke passed |
| `SAFE-047` | Save-settlement submission barrier | Implemented and production-hosted | Production submission-settlement smoke passed |
| `SAFE-048` | Version-safe match-prediction deletion | Implemented with evidence gap | Production RPC and ACLs are present; final authenticated browser clear/conflict journey remains under `TEST-001` |
| `SAFE-049` | Derived-position invalidation after score clear | Implemented and production-hosted | Trigger path is deployed; final live browser journey remains an assurance task |
| `SAFE-050` | Authoritative result method and winner | Implemented and production-hosted | Production lifecycle controls and service-role smoke passed |
| `SAFE-051` | Immutable result revision history | Implemented and production-hosted | Production verifier and direct-access denial passed |
| `SAFE-052` | Real knockout winner propagation | Implemented and production-hosted | Contract-35 propagation functions and validation are deployed |
| `SAFE-010` | Serialized score recomputation | Implemented and production-hosted | Production result/scoring operations use the serialized contract |
| `SAFE-053` | Exact function execution allowlists | Implemented and production-hosted | 63-check production verifier passed with zero anonymous application execution |
| `SAFE-013` | Production/development environment separation | Implemented and production-hosted | Production uses production Supabase; non-production contexts use development Supabase |
| `SAFE-054` | Application/schema compatibility gate | Implemented | Production, repository and Netlify are aligned at contract 35; future divergence remains fail-closed |

Safe user-facing error mapping is implemented under preserved safeguard `SAFE-039`; it is recorded in the continuity register rather than adding a sixtieth compact row.

## Leagues, social and viewing

| ID | Capability | Current classification | Notes |
| --- | --- | --- | --- |
| `FEAT-027` | Overall standings | Implemented and production-hosted | Contract-35 scoring inputs and reads are deployed |
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
| `FEAT-040` | Result confirm, correct and clear server functions | Implemented and production-hosted | Service-role functions are deployed; browser administration remains absent |
| `FEAT-039` | Browser result administration | Not present | No approved browser admin model/page |
| `SAFE-032` | Administrator bootstrap and authorization model | Not present | Former `profiles.role` runbook is invalid/disabled |
| `SAFE-012` | Fake clock and simulation isolation | Partial development capability | Full isolated rehearsal remains open |
| `SAFE-025` | Application CI | Implemented | Install, build, lint, tests and dependency audit |
| `SAFE-026` | Disposable database integration CI | Implemented | Migration rebuild, lint, pgTAP and differential parity |
| `SAFE-055` | Provider submission/clear regression tests | Implemented | Not a substitute for all production browser evidence |
| `SAFE-027` | Browser E2E | Implemented for disposable Supabase; anonymous production smoke added | Auth, predictions, saves, conflicts, locks, signup, recovery, private leagues and route accessibility covered; result-admin/manual screen-reader/authenticated production mutation journeys remain |
| `FEAT-042` | Monitoring and alerting | Not verified/present | Open operations work |
| `SAFE-033` | Verified backup and restore | Implemented and accepted | Encrypted off-device artifact, corrected clean restore and forward rehearsal passed |
| `SAFE-031` | Safe application rollback | Documented/partial | Contract-35 compatible release is recorded; periodic rollback rehearsal and final launch readiness remain |
| `SAFE-029` | Automatic production deploy | Implemented by Netlify/Git | Production currently serves the approved contract-35 deploy; future incompatible builds remain blocked |

Current route-accessibility implementation includes route titles, live announcements, main-content focus and skip navigation. League options use disclosure semantics. Manual screen-reader review remains open under `A11Y-001` and `TEST-001`.

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

Current `main` retains the authenticated Original Predictor, league, H2H, match, profile and auth routes plus catch-all. `/dev/components` is development-only. Route counts do not prove completeness.

The contract-35 production evidence point records:

- one submitted entry;
- 36 predictions;
- two tie decisions;
- eight progression rows;
- 24 derived group-position rows;
- zero stored/non-scheduled results, revisions, score events and rank history;
- fingerprints `320cf25d...`, `a4dcf183...`, `0d7bc491...`.

Development and production both have exactly 35 canonical migration-history rows. Netlify production and non-production contexts all declare contract 35 while retaining their required Supabase environment separation.

## Safeguard regression rules

A future change must not silently:

- weaken lock, ownership, same-tournament, version or submission checks;
- re-enable direct browser writes to server-owned scoring inputs;
- bypass protected RPCs with direct-table fallbacks;
- bypass the settlement barrier before manual submission;
- delete a persisted score without expected-version protection;
- accept structurally impossible brackets;
- mix Original Predictor and bonus-game points or leagues;
- blend predicted and real bracket state;
- point production or previews at the wrong Supabase environment;
- deploy code requiring an unverified database capability;
- change scoring values without updating rules, TypeScript, SQL and tests;
- treat roadmap or gallery content as implemented;
- classify an encrypted but unrestored backup as proven recovery.