# Current quality status

> The only live implementation and hosted-status authority. Current code, migrations, executable tests and verified hosted evidence override older audits, reconciliations, TODOs and chat narratives.

**Status date:** 27 July 2026

## Baseline

| Field | Current value |
| --- | --- |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Repository contract | 42 canonical migrations through `20260727182300_bounded_read_models.sql` |
| Delivery evidence | PRs #122, #124, #126, #128 and #131 cover the full tournament lifecycle, automatic valid-entry recovery and bounded Original Predictor reads |
| Verified production release source | `0b956e8f553f06f5bdb72ce937acc6295a8c2451` |
| Development Supabase | `iouzoutneyjpugbbtdem` — contract 42 applied and history-aligned |
| Production Supabase | `vkfnsqdyhvtwyqkisxhk` — contract 38; unchanged |
| Netlify contexts | `dev`, `branch-deploy` and `deploy-preview` declare 42 and use development Supabase; `production` remains 38 and uses production Supabase |
| Published production deploy | `6a67560deb88202a74108c37` — verified and locked |
| Production recovery | green encrypted backup run `30264080847`; disposable restore passed; artifact preserved off GitHub |
| Production smoke | exact commit, contract, routes/assets, security headers and Supabase isolation passed |

Production is a controlled future-tournament target, not an active Euro 2028 service. It remains locked at the contract-38 milestone. Contracts 39–42 are development-only until a later production milestone receives explicit owner approval.

## Executive verdicts

| Area | Verdict |
| --- | --- |
| Contract alignment | **Controlled divergence.** Repository, development and non-production Netlify are at 42; production remains deliberately locked at 38. |
| Recovery | **Verified.** The deferred exception is closed by green run #7 and off-GitHub encrypted custody. |
| Administrator result control | **Implemented.** Protected routes, capability checks, confirm/correct/clear, immutable revisions and regulation/extra-time/penalty handling are browser-proven. |
| Actual qualification control | **Implemented.** Exact third-place boundary ties are detected, ordered only by authorised administrators, reasoned, reviewed, revisioned and replayed transactionally. |
| Automatic valid-entry recovery | **Implemented.** A database-owned one-minute job submits only complete valid entries at lock, records immutable outcomes and exposes success/failure only to the entry owner. |
| Bounded Original Predictor reads | **Implemented.** Overall standings, user league lists, league members, match-pick comparisons and rival-entry payloads have explicit server-side maxima with deterministic ordering and unchanged access gates. |
| Tournament database lifecycle | **Proven.** Deterministic 51-match, boundary-tie, automatic-submission and excess-data pgTAP journeys cover the full lifecycle and the intended 250-user / 20-league read boundaries. |
| Product-facing result lifecycle | **Proven.** Match Centre, fixtures and H2H consume the server-owned knockout winner, including level extra-time scores and penalty shootouts. |
| Browser/reset lifecycle | **Proven.** Authenticated journeys cover real group completion, knockout results, boundary resolution and both successful and failed automatic-submission outcomes on disposable local Supabase. |
| Launch readiness | **Not ready.** Cap enforcement, representative query-plan/timing evidence, official data, accessibility and later launch operations remain. |

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
- overall standings capped at 250 submitted entries after score-first deterministic ordering;
- user league lists capped at 20, and league member/pick payloads capped at 250;
- rival-entry payloads fixed to 36 group predictions and 24 tournament teams;
- exact function execution allowlists, empty security-definer search paths and closed direct-table access;
- protected administrator routes and capability parsing;
- responsive administrator result and qualification controls with review and required reasons;
- authorised and unauthorised administrator browser journeys on desktop/mobile;
- environment/deployment-contract guards;
- CI, Database parity, Browser E2E and exact-head preview smoke;
- production backup/restore rehearsal and exact-release smoke.

## Immediate product gaps

- authoritative enforcement of the documented 250-user and 20-league operating caps;
- representative query-plan, response-size and timing evidence for profiles, leagues and scoring summaries;
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

**Stage 3 — cap enforcement and representative scale evidence**

1. Define and enforce the documented 250-user and 20-league operating caps at authoritative write boundaries, including concurrency behaviour.
2. Capture query plans, response sizes and timings for standings, league, profile, H2H and scoring-summary reads at those caps.
3. Measure score recomputation and rank-history capture with representative submitted entries.
4. Prove the main profile, league and comparison surfaces remain correct and responsive at the intended caps.
5. Repair completion, loading, empty and error states exposed by those scale journeys.

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
