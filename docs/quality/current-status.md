# Current quality status

> The only live implementation and hosted-status authority. Current code, migrations, executable tests and verified hosted evidence override older audits, reconciliations, TODOs and chat narratives.

**Status date:** 27 July 2026

## Baseline

| Field | Current value |
| --- | --- |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Repository contract | 41 canonical migrations through `20260727174658_automatic_entry_submission.sql` |
| Delivery evidence | PRs #122, #124, #126 and #128 cover the full tournament lifecycle and automatic valid-entry recovery at lock |
| Verified production release source | `0b956e8f553f06f5bdb72ce937acc6295a8c2451` |
| Development Supabase | `iouzoutneyjpugbbtdem` — contract 41 applied and history-aligned |
| Production Supabase | `vkfnsqdyhvtwyqkisxhk` — contract 38; unchanged |
| Netlify contexts | `dev`, `branch-deploy` and `deploy-preview` declare 41 and use development Supabase; `production` remains 38 and uses production Supabase |
| Published production deploy | `6a67560deb88202a74108c37` — verified and locked |
| Production recovery | green encrypted backup run `30264080847`; disposable restore passed; artifact preserved off GitHub |
| Production smoke | exact commit, contract, routes/assets, security headers and Supabase isolation passed |

Production is a controlled future-tournament target, not an active Euro 2028 service. It remains locked at the contract-38 milestone. Contracts 39–41 are development-only until a later production milestone receives explicit owner approval.

## Executive verdicts

| Area | Verdict |
| --- | --- |
| Contract alignment | **Controlled divergence.** Repository, development and non-production Netlify are at 41; production remains deliberately locked at 38. |
| Recovery | **Verified.** The deferred exception is closed by green run #7 and off-GitHub encrypted custody. |
| Administrator result control | **Implemented.** Protected routes, capability checks, confirm/correct/clear, immutable revisions and regulation/extra-time/penalty handling are browser-proven. |
| Actual qualification control | **Implemented.** Exact third-place boundary ties are detected, ordered only by authorised administrators, reasoned, reviewed, revisioned and replayed transactionally. |
| Automatic valid-entry recovery | **Implemented.** A database-owned one-minute job submits only complete valid entries at lock, records immutable outcomes and exposes success/failure only to the entry owner. |
| Tournament database lifecycle | **Proven.** Deterministic 51-match, boundary-tie and automatic-submission pgTAP journeys cover submission, groups, best thirds, actual R16 population, every knockout round, correction, clearing, replay, scoring, rank history and immutable audit history. |
| Product-facing result lifecycle | **Proven.** Match Centre, fixtures and H2H consume the server-owned knockout winner, including level extra-time scores and penalty shootouts. |
| Browser/reset lifecycle | **Proven.** Authenticated journeys cover real group completion, knockout results, boundary resolution and both successful and failed automatic-submission outcomes on disposable local Supabase. |
| Launch readiness | **Not ready.** Official data, bounded scale evidence, accessibility and later launch operations remain. |

## Implemented foundation

- canonical group ordering and explicit unresolved-tie handling;
- RPC-only manual submission and server-derived predicted positions;
- database-scheduled automatic submission that reuses the authoritative validator;
- immutable per-entry/per-lock automatic-submission outcomes;
- owner-visible manual, automatic, pending and failed submission states;
- a narrow server-only after-lock refresh for derived group positions while user-owned prediction tables remain locked;
- authoritative result lifecycle, revisions and serialized scoring;
- server-owned actual Round-of-16 population from completed group standings and best-third allocation;
- authorised actual third-place qualification-boundary resolution with exact-set validation;
- group-result fingerprints that invalidate stale official tie decisions;
- transactional bracket replay that refuses to rewrite a played knockout fixture;
- real winner propagation from the Round of 16 through the final;
- Match Centre, fixtures and H2H consumption of authoritative regulation, extra-time and penalty results;
- predicted-bracket replay and atomic bracket persistence;
- version-safe score clearing and immutable result/qualification revisions;
- exact function execution allowlists and closed direct-table access;
- protected administrator routes and capability parsing;
- responsive administrator result and qualification controls with review and required reasons;
- authorised and unauthorised administrator browser journeys on desktop/mobile;
- environment/deployment-contract guards;
- CI, Database parity, Browser E2E and exact-head preview smoke;
- production backup/restore rehearsal and exact-release smoke.

## Immediate product gaps

- bounded leaderboard, standing, H2H and comparison reads;
- representative performance evidence for profiles, leagues and scoring summaries;
- reminder delivery only after Auth/SMTP ownership and reliability are verified;
- completion, loading, empty and error-state coverage across the remaining product surfaces;
- official teams, fixtures, regulations and lock instant;
- manual accessibility review and a later full product dress rehearsal.

## Development mode

The project uses proportionate controls:

| Change class | Gate |
| --- | --- |
| UI, copy, styling, docs | CI; targeted preview/UI verification when relevant |
| Features and development schema | CI plus relevant unit/integration, Database parity and Browser E2E |
| Production schema, auth, scoring, destructive work or release | Backup when data is at risk, preflight, explicit approval, full verification and dated evidence |

Production promotion is milestone-only. Development can advance ahead of production with the difference recorded in this file. The heavier release posture returns around six months before the tournament, or earlier when real users or valuable live data appear.

## Current next batch

**Stage 3 — bounded reads and representative scale**

1. Inventory every leaderboard, standing, H2H and comparison RPC/query with current limits and sort keys.
2. Add explicit bounds and stable pagination where a public read can grow with users, leagues or fixtures.
3. Seed representative user/league volumes and record query plans and response sizes.
4. Prove profile, league and scoring summaries at the intended user/league caps.
5. Repair completion, loading, empty and error states found by those scale journeys.

## Operational follow-ups

- keep the manual backup workflow pinned to the current production contract before each milestone use;
- keep production locked between milestones;
- name monitoring/backup/Cron alert ownership;
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
