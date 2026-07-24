# Current feature and safeguard baseline

**Formal audit:** `2026-07-23L`; re-compared at `2026-07-24R` (no regression)  
**Latest reconciliation date:** 24 July 2026  
**Full audit evidence:** [`audits/2026-07-23-live-environment-audit.md`](audits/2026-07-23-live-environment-audit.md)  
**Current hosted state:** [`current-status.md`](current-status.md)  
**Current production release:** [`reconciliations/2026-07-24-post-merge-production-release-state.md`](reconciliations/2026-07-24-post-merge-production-release-state.md)

> **Traceability notice — `2026-07-24R` (`DOC-005`, open).** This document was rewritten from 96 rows carrying stable identifiers (`FEAT-001`–`FEAT-044`, `PLAN-001`–`PLAN-008`, `SAFE-001`–`SAFE-044`) to 60 rows carrying none, and the `Last verified`, `Validation evidence` and `Regression notes` columns were dropped. The previous version is preserved in full at [`history/feature-baseline-2026-07-23R.md`](history/feature-baseline-2026-07-23R.md), so no evidence has been lost.
>
> The new structure is clearer to read, but `audit-prompt.md` § *Repeat-audit and quality-baseline controls* items 3 and 4 require comparing every feature and safeguard against this file and reusing original IDs when a defect returns. Without identifiers, a future auditor cannot reliably distinguish a reworded row from a removed capability — the exact failure mode this baseline exists to prevent. The 96→60 reduction is **not** itself evidence of feature loss; several rows were consolidated and several safeguards are now covered by executable tests. The problem is that this judgement can no longer be audited.
>
> **Required repair (owner action):** re-attach the archived identifiers to the current rows, and record explicitly which archived IDs were consolidated, superseded or intentionally retired. This was deliberately not attempted by the auditor — remapping 60 rows without knowing which consolidations were intended would manufacture false traceability. Until it is done, treat [`history/feature-baseline-2026-07-23R.md`](history/feature-baseline-2026-07-23R.md) as the identifier source when a finding needs to cite a `SAFE-*` or `FEAT-*` row.
>
> `2026-07-24R` compared both documents and detected **no feature or safeguard regression**: routes remain at 25, no capability lost reachability, and every safeguard change observed was a strengthening.

This compact baseline prevents silent feature loss and scope import. Current code, migrations, executable tests, verified hosted evidence and `current-status.md` override older statuses. Historical audit files remain immutable.

## Classification rules

- **Implemented and production-hosted:** working application capability supported by the current production schema.
- **Deployed client / backend absent:** production application code is live but its required production database capability is missing.
- **Repository/development implemented:** working code and/or hosted-development database support exists, but production does not provide the complete capability.
- **Partial:** meaningful implementation exists but a required layer, route or journey remains absent.
- **UI prototype only:** presentation exists without a working production data path.
- **Documented/planned:** rule or intent exists without current working implementation.
- **Not present:** no current implementation evidence.

## Original Predictor and core application

| Capability | Current classification | Evidence boundary |
| --- | --- | --- |
| Authentication, signup/login and password recovery | Implemented and production-hosted | Current routes and Supabase Auth integration; dashboard settings still need final launch verification |
| First-use welcome gate | Implemented and production-hosted | `/welcome`, profile `welcomed_at` |
| Group score prediction | Implemented and production-hosted | Group predictor and `match_predictions` |
| Joker selection | Implemented and production-hosted | UI, DB guard and scoring configuration |
| Predicted group table | Implemented and production-hosted | Pure group-table/domain logic |
| Recursive head-to-head predicted ordering | Production client + repository/development SQL parity | Client works; private SQL resolver pending production rollout |
| Manual predicted same-group tie resolution | Implemented and production-hosted | Stronger server validation pending rollout |
| Best-third ranking and manual boundary resolution | Implemented and production-hosted | Server replay pending rollout |
| Winner-only Original Predictor bracket | **Deployed client / backend absent** | Production commit `a403b079` calls `replace_predicted_progression`; production RPC is absent (`OPS-006`) |
| Atomic complete-bracket replacement | **Deployed client / backend absent** | Migration 33 passes on development; live production client requires it but production schema does not provide it |
| Golden Boot selection | Implemented and production-hosted | Original prediction data/UI |
| Derived group-stage goals prediction | Implemented and production-hosted | Derived from 36 scores |
| Review and manual submission UI | Implemented and production-hosted | Production server boundary remains old |
| Pending-write settlement before manual submit | Repository implemented | Provider/controller tests pass; production/browser closure pending (`REL-003`) |
| Persisted score clearing | **Deployed client / backend absent** | Production commit `a403b079` calls `delete_match_prediction`; production RPC is absent, so clearing reaches save error (`DATA-005`) |
| Automatic valid-entry submission at lock | Documented/planned | `FUNC-002` open |
| Deadline reminder emails | Documented/planned | No scheduler/email implementation |

## Competition integrity safeguards

| Safeguard | Current classification | Production position |
| --- | --- | --- |
| RPC-only submission | Repository/development implemented | Production clients can still update entries directly |
| Server-derived predicted group positions | Repository/development implemented | Production table remains client-writable |
| Same-tournament prediction guards | Partial repository/development | Major guards exist; wider constraints remain; production pending |
| Lock-time write rejection | Partial | Earlier production triggers exist; hardened boundaries pending |
| Full predicted bracket-tree replay | Repository/development implemented | Production submission uses old shape validation |
| Optimistic complete-bracket conflict detection | **Deployed client / backend absent** | Production client expects the atomic RPC; backend does not contain it |
| Save-settlement submission barrier | Repository implemented | Awaiting compatible production and browser E2E |
| Version-safe match-prediction deletion | **Deployed client / backend absent** | Production client expects migration 35’s RPC; backend does not contain it |
| Derived-position invalidation after score clear | Repository/development implemented | Production clear cannot reach the required delete trigger path through the missing RPC |
| Authoritative result method/winner | Repository/development implemented | Production result lifecycle absent |
| Immutable result revision history | Repository/development implemented | Production revision path absent |
| Real knockout winner propagation | Repository/development implemented | Production propagation absent |
| Serialized score recomputation | Repository/development implemented | Production old scorer remains |
| Exact function execution allowlists | Repository/development implemented | Production broad grants remain |
| Production/development separation | Partial safeguard | Separate projects exist; production preview contexts are not isolated (`OPS-007`) |
| App/schema compatibility gate before auto-deploy | Not present | PR #20 merge automatically deployed database-dependent client code before the production schema rollout |

## Leagues, social and viewing

| Capability | Current classification | Notes |
| --- | --- | --- |
| Overall standings | Implemented and production-hosted | Integrity still depends on production rollout |
| Private league create/join/leave/delete/transfer | Implemented and production-hosted | Abuse/security review remains |
| Invite deep links | Implemented and production-hosted | Pre-auth invite preview remains weak |
| League detail and member rows | Implemented and production-hosted | Other-player destination incomplete |
| H2H comparison | Implemented and production-hosted, pass 1 | Rank graph/bracket health planned |
| Own profile and points breakdown | Implemented and production-hosted | Current routes present |
| Other-player full profile | Partial/UI prototype | Final secure route/flow incomplete |
| Match list and Match Centre | Implemented and production-hosted | Expanded phase/admin states planned |
| Post-lock prediction trends | Documented/planned | No production capability |

## Administration, assurance and operations

| Capability | Classification | Notes |
| --- | --- | --- |
| Result confirm/correct/clear server functions | Repository/development implemented | Service-role functions pending production rollout |
| Browser result administration | Not present | No version-controlled admin model/page |
| Administrator bootstrap | Not present | Former `profiles.role` runbook invalid and disabled |
| Fake clock/simulation | Partial development capability | Full isolated rehearsal remains open |
| Application CI | Implemented | Install, build/type-check, lint, tests, dependency audit |
| Disposable database integration CI | Implemented | 35-migration rebuild, lint, pgTAP and differential parity |
| Provider-level submission/clear regression tests | Implemented | Not a substitute for browser E2E |
| Browser E2E | Not present | Launch blocker |
| Monitoring and alerting | Not verified/present | Open operations work |
| Verified backup and restore | Not present | Evidence and rehearsal required |
| Safe application rollback | Documented | Must prove compatibility with current production schema |
| Automatic production deploy | Implemented by Netlify/Git integration | Requires a missing app/schema compatibility gate before database-dependent merges |

## Bonus competition scope

| Competition | Classification |
| --- | --- |
| KO Predictor | Documented/planned launch scope |
| Last Man Standing | Documented/planned launch scope |
| Predictor Cup | Rules/planning present; implementation absent |
| Sweepstake builder | Planned future; non-launch-blocking |
| Fan Duels as a separate mode | Legacy/superseded by Predictor Cup |

No bonus game is implemented merely because a design note or component-gallery concept exists.

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
- mix Original Predictor and bonus-game points/leagues;
- blend predicted and real bracket state;
- point production/previews at the wrong Supabase environment;
- deploy code requiring absent database capabilities without an explicit compatibility decision;
- change scoring values without updating rules, TypeScript, SQL and tests;
- treat roadmap or gallery content as implemented.

Update this file whenever a feature/safeguard changes classification or hosted status.
