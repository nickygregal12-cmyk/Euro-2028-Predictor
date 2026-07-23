# Current feature and safeguard baseline

**Current verification:** `2026-07-23L`  
**Audited application/deploy:** `51d8ac607ee9d04bc932df1fea01a488f844f05a`  
**Full evidence:** [`audits/2026-07-23-live-environment-audit.md`](audits/2026-07-23-live-environment-audit.md)

This file is the compact control against silent feature loss and scope import. The earlier 96-row baseline remains in Git history and the dated `2026-07-23`/`2026-07-23R` audits. Current code, hosted evidence and `current-status.md` override its old statuses.

## Classification rules

- **Implemented and hosted:** working application capability supported by the current original hosted schema.
- **Repository/local only:** implemented and executable in the full repository migration chain, but absent from both hosted databases.
- **Partial:** meaningful implementation exists, but a required layer/journey is missing.
- **UI prototype only:** present only in the dev component gallery or non-functional presentation.
- **Documented/planned:** rule or intent exists without current working code/data support.
- **Not present:** no current implementation evidence.

## Original Predictor and core application

| Capability | Current classification | Evidence boundary |
| --- | --- | --- |
| Authentication, signup/login and password-recovery screens | Implemented and hosted | Current routes and Supabase Auth integration; dashboard settings not fully re-verified |
| First-use welcome gate | Implemented and hosted | `/welcome`, profile `welcomed_at` |
| Group score prediction | Implemented and hosted | Group predictor and `match_predictions` |
| Joker selection | Implemented and hosted | UI, DB guard, scoring configuration |
| Predicted group table | Implemented and hosted | Pure group-table/domain logic |
| Recursive head-to-head predicted ordering | Implemented and hosted in client; repository/local SQL parity | `resolveGroupTies`; private SQL resolver pending hosted rollout |
| Manual predicted same-group tie resolution | Implemented and hosted | UI/data flow; later stronger server validation pending hosted rollout |
| Best-third ranking and manual boundary resolution | Implemented and hosted | Domain/UI; later server replay pending hosted rollout |
| Winner-only Original Predictor bracket | Implemented and hosted UI/read path | Current production write path is incompatible with hosted DB (`OPS-006`) |
| Atomic complete-bracket replacement | Repository/local only | PR #14; `replace_predicted_progression` absent hosted |
| Golden Boot selection | Implemented and hosted | Original prediction data/UI |
| Derived group-stage goals prediction | Implemented and hosted | Derived from 36 predicted scores |
| Review page and manual submission UI | Implemented and hosted | Submission security/derivation improvements pending hosted rollout |
| Automatic valid-entry submission at lock | Documented/planned | `FUNC-002` open |
| Deadline reminder emails | Planned | No current scheduled implementation |

## Competition integrity safeguards

| Safeguard | Current classification | Hosted position |
| --- | --- | --- |
| RPC-only submission | Repository/local only | Hosted clients can still update entries directly |
| Server-derived predicted group positions | Repository/local only | Hosted table remains client-writable |
| Same-tournament prediction guards | Repository/local partial | Major guards pending hosted; wider constraints still open |
| Lock-time write rejection | Partial | Earlier hosted triggers exist; later hardened boundary pending |
| Full predicted bracket-tree replay | Repository/local only | Hosted submission validates only the old shape |
| Optimistic complete-snapshot bracket conflict detection | Repository/local only | Hosted atomic RPC absent |
| Authoritative result method/winner | Repository/local only | Hosted result lifecycle absent |
| Immutable result revision history | Repository/local only | Hosted revision table/functions absent |
| Real knockout winner propagation | Repository/local only | Hosted propagation absent |
| Serialized score recomputation | Repository/local only | Hosted old scorer remains |
| Production/development separation | Partial safeguard | Separate projects exist; production preview contexts are not isolated |

## Leagues, social and viewing

| Capability | Current classification | Notes |
| --- | --- | --- |
| Overall standings | Implemented and hosted | Current scoring integrity still depends on hosted rollout |
| Private league create/join/leave/delete/transfer | Implemented and hosted | Abuse/security review remains |
| Invite deep links | Implemented and hosted | Invite preview before auth remains weak |
| League detail and expandable member rows | Implemented and hosted | Other-player destination remains incomplete |
| H2H comparison | Implemented and hosted, pass 1 | Rank graph/bracket health planned |
| Own profile and points breakdown | Implemented and hosted | `/more/points` redirects to profile |
| Other-player full profile | Partial/UI prototype | Secure data path/presentational states exist; final route/flow incomplete |
| Match list and Match Centre | Implemented and hosted | Expanded phase/admin states planned |
| Post-lock prediction trends | Planned | No current production route/capability |

## Administration and operations

| Capability | Classification | Notes |
| --- | --- | --- |
| Result confirm/correct/clear server functions | Repository/local only | Service-role functions pending hosted migration |
| Browser result administration | Not present | No version-controlled admin role or page |
| Administrator bootstrap | Not present | Former `profiles.role` runbook was invalid and is disabled |
| Fake clock / simulation | Partial development capability | Full isolated tournament rehearsal remains open |
| Application CI | Implemented | Build/type-check, lint, tests, dependency audit |
| Disposable database integration CI | Implemented | Migration rebuild, lint, pgTAP, differential parity |
| Browser E2E | Not present | Launch blocker |
| Monitoring and alerting | Not verified/present in repo | Open operations work |
| Verified backup and restore | Not present | Runbook/rehearsal required |
| Safe application rollback | Documented | Must also prove app/schema compatibility |

## Bonus competition scope

| Competition | Classification |
| --- | --- |
| KO Predictor | Documented/planned launch scope |
| Last Man Standing | Documented/planned launch scope |
| Predictor Cup | Rules/planning present; implementation not present |
| Sweepstake builder | Planned future; explicitly non-launch-blocking |
| Fan Duels as a separate mode | Legacy/superseded by Predictor Cup |

No bonus game is classified as implemented merely because a design note or component-gallery concept exists.

## Current route baseline

The production application retains 23 explicit production routes plus catch-all. `/dev/components` is development-only and excluded from production builds. Route counts alone do not prove that every screen is complete or that its database write path is compatible.

## Safeguard regression rules

A future change must not silently:

- weaken lock, ownership, same-tournament or submission checks;
- re-enable direct browser writes to server-owned scoring inputs;
- accept structurally impossible brackets;
- mix Original Predictor and bonus-game points/leagues;
- blend predicted and real bracket state;
- point production or production previews at the wrong Supabase environment;
- deploy code requiring database capabilities absent from the target schema;
- change scoring values without updating rules, TypeScript, SQL and tests;
- treat component-gallery prototypes or roadmap text as implemented features.

Update this file when a feature changes classification or a safeguard becomes hosted, regresses or is superseded.
