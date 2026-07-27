# Current quality status

> The only live implementation and hosted-status authority. Current code, migrations, executable tests and verified hosted evidence override older audits, reconciliations, TODOs and chat narratives.

**Status date:** 27 July 2026

## Baseline

| Field | Current value |
| --- | --- |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Verified release source | `0b956e8f553f06f5bdb72ce937acc6295a8c2451` |
| Repository contract | 38 canonical migrations through `20260727080159` |
| Development Supabase | `iouzoutneyjpugbbtdem` — contract 38 |
| Production Supabase | `vkfnsqdyhvtwyqkisxhk` — contract 38 |
| Netlify contexts | all declare contract 38; development/production project isolation retained |
| Published production deploy | `6a67560deb88202a74108c37` — verified and locked |
| Production recovery | green encrypted backup run `30264080847`; disposable restore passed; artifact preserved off GitHub |
| Production smoke | exact commit, contract, routes/assets, security headers and Supabase isolation passed |

Production is a controlled future-tournament target, not an active Euro 2028 service. It is locked after the contract-38 milestone so ordinary merges do not publish automatically.

## Executive verdicts

| Area | Verdict |
| --- | --- |
| Contract alignment | **Complete.** Repository, development, production and Netlify declarations are all at 38. |
| Recovery | **Verified.** The deferred exception is closed by green run #7 and off-GitHub encrypted custody. |
| Administrator foundation | **Implemented.** Protected routes, capability checks and authorised result RPCs are merged. |
| Administrator result UI | **Implemented.** Confirm/correct/clear forms, explicit review, reason capture and safe revision history are covered by component and browser journeys. |
| Tournament lifecycle | **Not yet proven end-to-end.** A full seeded simulation remains the next major gate. |
| Launch readiness | **Not ready.** Official data, accessibility, operations, automatic submission and full rehearsal remain. |

## Implemented foundation

- canonical group ordering and explicit unresolved-tie handling;
- RPC-only submission and server-derived positions;
- authoritative result lifecycle, revisions and serialized scoring;
- real winner propagation and predicted-bracket replay;
- atomic bracket persistence and version-safe score clearing;
- exact function execution allowlists;
- protected administrator routes and capability parsing;
- browser-authorised result confirm, correct, clear and revision RPCs;
- responsive administrator result forms with regulation, extra-time and penalty handling;
- pre-mutation review, required correction/clear reasons and immutable revision display;
- authorised and unauthorised administrator browser journeys on desktop/mobile;
- environment/deployment-contract guards;
- CI, path-scoped Database parity and path-scoped Browser E2E;
- production backup/restore rehearsal and exact-release smoke.

## Immediate product gaps

- authoritative knockout winner/method/extra-time/penalty consumption in Match Centre and H2H;
- real Round-of-16 population and actual unresolved-tie workflow;
- automatic valid-entry submission and reminders;
- bounded leaderboard/standing reads and representative performance evidence;
- official teams, fixtures, regulations and lock instant;
- manual accessibility review and full tournament dress rehearsal.

## Development mode

The project now uses proportionate controls:

| Change class | Gate |
| --- | --- |
| UI, copy, styling, docs | CI; targeted preview/UI verification when relevant |
| Features and development schema | CI plus relevant unit/integration, Database parity and Browser E2E |
| Production schema, auth, scoring, destructive work or release | Backup when data is at risk, preflight, explicit approval, full verification and dated evidence |

Production promotion is milestone-only. Development can advance ahead of production with the difference recorded in this file. The heavier release posture returns around six months before the tournament, or earlier when real users or valuable data appear.

## Current next batch

**First full tournament lifecycle simulation**

1. Seed a complete tournament and representative users/leagues.
2. Simulate pre-tournament entry, locks and submission.
3. Run group matches through standings, ties and best thirds.
4. Populate and play the real knockout bracket.
5. Exercise result correction, clearing, replay and scoring recomputation.
6. Verify rank history, Match Centre, H2H and completion states.
7. Record defects as product work and exit only when the lifecycle is repeatable
   and resettable in development without touching production.

## Operational follow-ups

- keep the manual backup workflow pinned to the current production contract before each milestone use;
- keep production locked between milestones;
- name monitoring/backup alert ownership;
- decide leaked-password protection and Turnstile configuration;
- verify branch protection;
- rehearse application rollback and later repeat backup restore against a contract-38 artifact.

## Documentation authority

- Current facts: this file.
- Future sequence: `docs/roadmap.md`.
- Scoring: `docs/scoring-rules.md`.
- Architecture/tournament states: `docs/architecture-and-tournament-states.md`.
- Operations: the relevant `docs/ops-*.md` runbook.
- Dated reconciliations and audits: historical evidence only.
