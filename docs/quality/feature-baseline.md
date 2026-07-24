# Current feature and safeguard baseline

**Formal audit:** `2026-07-23L`; re-compared at `2026-07-24R` (no regression)  
**Latest reconciliation date:** 24 July 2026  
**Full audit evidence:** [`audits/2026-07-23-live-environment-audit.md`](audits/2026-07-23-live-environment-audit.md)  
**Current hosted state:** [`current-status.md`](current-status.md)  
**Current production release:** [`reconciliations/2026-07-24-post-merge-production-release-state.md`](reconciliations/2026-07-24-post-merge-production-release-state.md)  
**Identifier repair:** [`reconciliations/2026-07-24-feature-baseline-identifiers.md`](reconciliations/2026-07-24-feature-baseline-identifiers.md)

> **Stable traceability control.** Every compact current row has one primary identifier. All 96 identifiers from the archived baseline (`FEAT-001`–`FEAT-044`, `PLAN-001`–`PLAN-008`, `SAFE-001`–`SAFE-044`) remain present in the identifier-continuity register below with an explicit disposition. Capabilities and safeguards introduced after that archive use new identifiers beginning at `FEAT-045` and `SAFE-045`.
>
> Consolidation does not retire or erase an archived identifier. A consolidated or preserved-standalone ID remains reserved permanently and must be reused if the same capability, safeguard or root cause returns. Current code, migrations, executable tests, verified hosted evidence and `current-status.md` override older status wording; the archived file remains immutable evidence.

This baseline prevents silent feature loss and scope import. Update it whenever a feature or safeguard changes classification, reachability, enforcement layer or hosted status.

## Classification rules

- **Implemented and production-hosted:** working application capability supported by the current production schema.
- **Deployed client / backend absent:** production application code is live but its required production database capability is missing.
- **Repository/development implemented:** working code and/or hosted-development database support exists, but production does not provide the complete capability.
- **Partial:** meaningful implementation exists but a required layer, route or journey remains absent.
- **UI prototype only:** presentation exists without a working production data path.
- **Documented/planned:** rule or intent exists without current working implementation.
- **Not present:** no current implementation evidence.

## Original Predictor and core application

| ID | Capability | Current classification | Evidence boundary |
| --- | --- | --- | --- |
| `FEAT-001` | Authentication, signup/login, password recovery, moderation and sign-out | Implemented and production-hosted | Current Auth routes and Supabase integration; provider/dashboard settings and recovery delivery still need final launch verification |
| `FEAT-006` | First-use welcome gate | Implemented and production-hosted | `/welcome`, profile `welcomed_at` |
| `FEAT-009` | Group score prediction | Implemented and production-hosted | Group predictor and `match_predictions` |
| `FEAT-015` | Joker selection | Implemented and production-hosted | UI, database guard and scoring configuration |
| `FEAT-010` | Predicted group table | Implemented and production-hosted | Pure group-table/domain logic |
| `FEAT-045` | Recursive head-to-head predicted ordering | Production client plus repository/development SQL parity | Client works; private SQL resolver pending production rollout |
| `FEAT-012` | Manual predicted same-group tie resolution | Implemented and production-hosted | Stronger server validation pending rollout |
| `FEAT-013` | Best-third ranking and manual boundary resolution | Implemented and production-hosted | Server replay pending rollout |
| `FEAT-014` | Winner-only Original Predictor bracket | **Deployed client / backend absent** | Production commit `a403b079` calls `replace_predicted_progression`; production RPC is absent (`OPS-006`) |
| `FEAT-046` | Atomic complete-bracket replacement | **Deployed client / backend absent** | Migration 33 passes on development; live production client requires it but production schema does not provide it |
| `FEAT-016` | Golden Boot selection | Implemented and production-hosted | Original prediction data and UI |
| `FEAT-017` | Derived group-stage goals prediction | Implemented and production-hosted | Derived from 36 group scores |
| `FEAT-018` | Review and manual submission UI | Implemented and production-hosted | Production server boundary remains old |
| `FEAT-047` | Pending-write settlement before manual submit | Repository implemented | Provider/controller tests pass; production/browser closure pending (`REL-003`) |
| `FEAT-048` | Persisted score clearing | **Deployed client / backend absent** | Production commit `a403b079` calls `delete_match_prediction`; production RPC is absent, so clearing reaches a save error (`DATA-005`) |
| `FEAT-020` | Automatic valid-entry submission at lock | Documented/planned | `FUNC-002` open |
| `FEAT-041` | Deadline reminder emails | Documented/planned | No scheduler or email implementation |

## Competition integrity safeguards

| ID | Safeguard | Current classification | Production position |
| --- | --- | --- | --- |
| `SAFE-007` | RPC-only submission | Repository/development implemented | Production clients can still update entries directly |
| `SAFE-045` | Server-derived predicted group positions | Repository/development implemented | Production table remains client-writable |
| `SAFE-008` | Same-tournament prediction guards | Partial repository/development | Major guards exist; wider constraints remain; production pending |
| `SAFE-006` | Lock-time write rejection | Partial | Earlier production triggers exist; hardened boundaries pending |
| `SAFE-009` | Full predicted bracket-tree replay | Repository/development implemented | Production submission uses old shape validation |
| `SAFE-046` | Optimistic complete-bracket conflict detection | **Deployed client / backend absent** | Production client expects the atomic RPC; backend does not contain it |
| `SAFE-047` | Save-settlement submission barrier | Repository implemented | Awaiting compatible production and browser E2E |
| `SAFE-048` | Version-safe match-prediction deletion | **Deployed client / backend absent** | Production client expects migration 35's RPC; backend does not contain it |
| `SAFE-049` | Derived-position invalidation after score clear | Repository/development implemented | Production clear cannot reach the required delete-trigger path through the missing RPC |
| `SAFE-050` | Authoritative result method and winner | Repository/development implemented | Production result lifecycle absent |
| `SAFE-051` | Immutable result revision history | Repository/development implemented | Production revision path absent |
| `SAFE-052` | Real knockout winner propagation | Repository/development implemented | Production propagation absent |
| `SAFE-010` | Serialized score recomputation | Repository/development implemented | Production old scorer remains |
| `SAFE-053` | Exact function execution allowlists | Repository/development implemented | Production broad grants remain |
| `SAFE-013` | Production/development environment separation | Implemented for the current Netlify project | Preview, branch and development contexts use development Supabase with fail-closed guards; the unrelated legacy public site remains `OPS-008` |
| `SAFE-054` | Application/schema compatibility gate before automatic deploy | Implemented and containing the mismatch | Repository contract 35 cannot replace production while the hosted contract remains 20 |

## Leagues, social and viewing

| ID | Capability | Current classification | Notes |
| --- | --- | --- | --- |
| `FEAT-027` | Overall standings | Implemented and production-hosted | Integrity still depends on production rollout |
| `FEAT-028` | Private league create, join, leave, delete and transfer | Implemented and production-hosted | Abuse and security review remains |
| `FEAT-029` | Invite deep links | Implemented and production-hosted | Pre-auth invite preview remains weak |
| `FEAT-049` | League detail and member rows | Implemented and production-hosted | Other-player destination incomplete |
| `FEAT-031` | H2H comparison | Implemented and production-hosted, pass 1 | Rank graph and bracket health planned |
| `FEAT-035` | Own profile and points breakdown | Implemented and production-hosted | Current routes present |
| `FEAT-036` | Other-player full profile | Partial/UI prototype | Final secure route and flow incomplete |
| `FEAT-032` | Match list and Match Centre | Implemented and production-hosted | Expanded phase and administration states planned |
| `FEAT-050` | Post-lock prediction trends | Documented/planned | No production capability |

## Administration, assurance and operations

| ID | Capability or safeguard | Classification | Notes |
| --- | --- | --- | --- |
| `FEAT-040` | Result confirm, correct and clear server functions | Repository/development implemented | Service-role functions pending production rollout |
| `FEAT-039` | Browser result administration | Not present | No version-controlled admin model or page |
| `SAFE-032` | Administrator bootstrap and authorisation model | Not present | Former `profiles.role` runbook is invalid and disabled |
| `SAFE-012` | Fake clock and simulation isolation | Partial development capability | Full isolated rehearsal remains open |
| `SAFE-025` | Application CI | Implemented | Install, build/type-check, lint, tests and dependency audit |
| `SAFE-026` | Disposable database integration CI | Implemented | 35-migration rebuild, lint, pgTAP and differential parity |
| `SAFE-055` | Provider-level submission and clear regression tests | Implemented | Not a substitute for browser E2E |
| `SAFE-027` | Browser E2E | Not present | Launch blocker |
| `FEAT-042` | Monitoring and alerting | Not verified/present | Open operations work |
| `SAFE-033` | Verified backup and restore | Not present | Evidence and rehearsal required |
| `SAFE-031` | Safe application rollback | Documented | Must prove compatibility with the current production schema |
| `SAFE-029` | Automatic production deploy | Implemented by Netlify/Git integration | Guarded by `SAFE-054`; production remains frozen while contracts differ |

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

The archived source is [`history/feature-baseline-2026-07-23R.md`](history/feature-baseline-2026-07-23R.md). Dispositions below are permanent traceability statements, not claims that omitted compact rows stopped existing.

| Archived ID(s) | Disposition in the current baseline |
| --- | --- |
| `FEAT-001` | Primary ID for the consolidated authentication and account-access row |
| `FEAT-002`, `FEAT-003`, `FEAT-004`, `FEAT-005`, `FEAT-044` | Consolidated into `FEAT-001`; the original IDs remain reserved |
| `FEAT-006` | Primary current row |
| `FEAT-007` | Preserved standalone: theme switching remains an implemented design-system capability |
| `FEAT-008` | Preserved standalone: tournament reference-data loading remains auditable through provider/service evidence and `DATA-006` |
| `FEAT-009`, `FEAT-010`, `FEAT-012`, `FEAT-013`, `FEAT-014`, `FEAT-015`, `FEAT-016`, `FEAT-017`, `FEAT-020`, `FEAT-027`, `FEAT-029`, `FEAT-031`, `FEAT-035`, `FEAT-036`, `FEAT-039`, `FEAT-040`, `FEAT-041`, `FEAT-042` | Retained as primary current-row IDs |
| `FEAT-011` | Consolidated into safeguard row `SAFE-045` for server-derived predicted positions |
| `FEAT-018`, `FEAT-019` | Consolidated into current review and manual submission row `FEAT-018` |
| `FEAT-021` | Consolidated into lock safeguard row `SAFE-006` |
| `FEAT-022`, `FEAT-023`, `FEAT-024`, `FEAT-025`, `FEAT-026` | Preserved standalone scoring capabilities; current values and parity are governed by scoring rules, TypeScript, SQL, tests and `SAFE-034` |
| `FEAT-028`, `FEAT-030` | Consolidated into current private-league lifecycle row `FEAT-028` |
| `FEAT-032`, `FEAT-033` | Consolidated into current match list and Match Centre row `FEAT-032` |
| `FEAT-034` | Preserved standalone: Home dashboard remains implemented and tracked by current route evidence and open performance/reliability findings |
| `FEAT-037` | Preserved standalone: share-card capability remains implemented; browser-output retest remains applicable |
| `FEAT-038` | Preserved standalone: scoring explanation route remains implemented and must stay aligned with authoritative scoring |
| `FEAT-043` | Preserved standalone: public marketing landing page remains not present and is not approved scope |
| `PLAN-001`, `PLAN-002`, `PLAN-003`, `PLAN-004`, `PLAN-008` | Retained as primary current-row IDs |
| `PLAN-005` | Preserved planned ID: bonus-games hub remains absent until implemented modes exist |
| `PLAN-006` | Preserved planned ID: shared knockout prediction store remains future architecture |
| `PLAN-007` | Preserved planned ID: typed competition entries remain future architecture |
| `SAFE-001`, `SAFE-002`, `SAFE-003`, `SAFE-004` | Preserved standalone architecture safeguards: pure domain, route splitting, Supabase boundary and RLS coverage |
| `SAFE-005` | Preserved standalone for search-path pinning; new exact execution allowlists use `SAFE-053` |
| `SAFE-006`, `SAFE-007`, `SAFE-008`, `SAFE-009`, `SAFE-010`, `SAFE-012`, `SAFE-013`, `SAFE-025`, `SAFE-026`, `SAFE-027`, `SAFE-029`, `SAFE-031`, `SAFE-032`, `SAFE-033` | Retained as primary current-row IDs |
| `SAFE-011` | Preserved standalone: development autologin remains fail-closed and environment-gated |
| `SAFE-014`, `SAFE-015`, `SAFE-016`, `SAFE-017` | Preserved standalone security, privacy and migration safeguards |
| `SAFE-018` | Preserved standalone optimistic save coordination; strengthened bracket, settlement and deletion controls use `SAFE-046`–`SAFE-048` |
| `SAFE-019`, `SAFE-020`, `SAFE-021`, `SAFE-022`, `SAFE-023`, `SAFE-024` | Preserved standalone accessibility, state, refresh and type-safety safeguards |
| `SAFE-028`, `SAFE-030` | Preserved standalone responsive-mobile and secret-scan safeguards |
| `SAFE-034` | Preserved standalone deterministic-scoring safeguard and authority for archived scoring IDs |
| `SAFE-035` | Consolidated into private-league lifecycle row `FEAT-028`; destructive confirmations remain mandatory |
| `SAFE-036` | Preserved standalone competition-scope separation safeguard |
| `SAFE-037`, `SAFE-038`, `SAFE-039`, `SAFE-040` | Preserved standalone entry, documentation, safe-error and rate-limit safeguards |
| `SAFE-041`, `SAFE-042`, `SAFE-043`, `SAFE-044` | Preserved standalone runtime, navigation, score-bound and release-metadata safeguards |

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
| `SAFE-054` | Application/schema compatibility gate before automatic deploy |
| `SAFE-055` | Provider-level submission and clear regression tests |

## Current route and data baseline

The production application retains 23 explicit production routes plus catch-all. `/dev/components` is development-only. Route counts do not prove completeness or database compatibility.

Post-deploy read-only production counts are four profiles, four entries, one submitted entry, 36 predictions, two tie decisions, eight progression rows and zero stored match scores.

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
- treat roadmap or gallery content as implemented.
