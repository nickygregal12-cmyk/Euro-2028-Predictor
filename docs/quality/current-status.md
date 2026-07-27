# Current quality status

> The only live implementation and hosted-status authority. Current code, migrations, executable tests and verified hosted evidence override older audits, reconciliations, TODOs and chat narratives.

**Status date:** 27 July 2026

## Baseline

| Field | Current value |
| --- | --- |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Verified production release source | `0b956e8f553f06f5bdb72ce937acc6295a8c2451` |
| Active development PR | #122 — contract 39, canonical migration `20260727150621_actual_round_of_16_population.sql` |
| Development Supabase | `iouzoutneyjpugbbtdem` — contract 39 applied and history-aligned |
| Production Supabase | `vkfnsqdyhvtwyqkisxhk` — contract 38; unchanged |
| Netlify contexts | `dev`, `branch-deploy` and `deploy-preview` declare 39 and use development Supabase; `production` remains 38 and uses production Supabase |
| Published production deploy | `6a67560deb88202a74108c37` — verified and locked |
| Production recovery | green encrypted backup run `30264080847`; disposable restore passed; artifact preserved off GitHub |
| Production smoke | exact commit, contract, routes/assets, security headers and Supabase isolation passed |

Production is a controlled future-tournament target, not an active Euro 2028 service. It remains locked at the contract-38 milestone. Contract 39 is development-only until a later production milestone receives explicit owner approval.

## Executive verdicts

| Area | Verdict |
| --- | --- |
| Contract alignment | **Controlled divergence.** Repository PR/development/preview are at 39; production remains deliberately locked at 38. |
| Recovery | **Verified.** The deferred exception is closed by green run #7 and off-GitHub encrypted custody. |
| Administrator foundation | **Implemented.** Protected routes, capability checks and authorised result RPCs are merged. |
| Administrator result UI | **Implemented.** Confirm/correct/clear forms, explicit review, reason capture and safe revision history are covered by component and browser journeys. |
| Tournament database lifecycle | **Proven in a disposable environment.** A deterministic 51-match pgTAP journey covers submission, group completion, best thirds, actual R16 population, knockout propagation, corrections, clearing, replay, scoring, rank history and immutable revisions. |
| Hosted/browser lifecycle | **In progress.** Exact-head preview and authenticated Browser E2E remain the final gates for PR #122. |
| Launch readiness | **Not ready.** Official data, accessibility, operations, automatic submission and a later full product dress rehearsal remain. |

## Implemented foundation

- canonical group ordering and explicit unresolved-tie handling;
- RPC-only submission and server-derived positions;
- authoritative result lifecycle, revisions and serialized scoring;
- server-owned actual Round-of-16 population from completed group standings and best-third allocation;
- guarded actual-bracket replay after upstream group corrections or clearing;
- real winner propagation from the Round of 16 through the final;
- predicted-bracket replay and atomic bracket persistence;
- version-safe score clearing and immutable result revisions;
- exact function execution allowlists;
- protected administrator routes and capability parsing;
- browser-authorised result confirm, correct, clear and revision RPCs;
- responsive administrator result forms with regulation, extra-time and penalty handling;
- pre-mutation review and required correction/clear reasons;
- authorised and unauthorised administrator browser journeys on desktop/mobile;
- environment/deployment-contract guards;
- CI, path-scoped Database parity and path-scoped Browser E2E;
- production backup/restore rehearsal and exact-release smoke.

## Immediate product gaps

- explicit administrator resolution for an actual cross-group third-place tie that reaches the qualification boundary;
- authoritative knockout winner/method/extra-time/penalty consumption in Match Centre and H2H;
- automatic valid-entry submission and reminders;
- bounded leaderboard/standing reads and representative performance evidence;
- official teams, fixtures, regulations and lock instant;
- manual accessibility review and a later full product dress rehearsal.

## Development mode

The project uses proportionate controls:

| Change class | Gate |
| --- | --- |
| UI, copy, styling, docs | CI; targeted preview/UI verification when relevant |
| Features and development schema | CI plus relevant unit/integration, Database parity and Browser E2E |
| Production schema, auth, scoring, destructive work or release | Backup when data is at risk, preflight, explicit approval, full verification and dated evidence |

Production promotion is milestone-only. Development can advance ahead of production with the difference recorded in this file. The heavier release posture returns around six months before the tournament, or earlier when real users or valuable data appear.

## Current next batch

**Finish Stage 2 product-facing lifecycle verification**

1. Complete exact-head deploy-preview and authenticated Browser E2E for PR #122.
2. Verify Match Centre, tournament, league and H2H states against the authoritative knockout result model.
3. Add the actual unresolved third-place qualification-boundary workflow rather than silently inventing an order.
4. Verify completion, empty, loading and error states after group and knockout transitions.
5. Keep the deterministic disposable lifecycle resettable and production-isolated.

## Operational follow-ups

- keep the manual backup workflow pinned to the current production contract before each milestone use;
- keep production locked between milestones;
- name monitoring/backup alert ownership;
- decide leaked-password protection and Turnstile configuration;
- verify branch protection;
- rehearse application rollback and later repeat backup restore against the then-current production artifact.

## Documentation authority

- Current facts: this file.
- Future sequence: `docs/roadmap.md`.
- Scoring: `docs/scoring-rules.md`.
- Architecture/tournament states: `docs/architecture-and-tournament-states.md`.
- Operations: the relevant `docs/ops-*.md` runbook.
- Dated reconciliations and audits: historical evidence only.
