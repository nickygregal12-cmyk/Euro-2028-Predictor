# Current quality status

> The only live implementation and hosted-status authority. Current code, migrations, executable tests and verified hosted evidence override older audits, reconciliations, TODOs and chat narratives.

**Status date:** 28 July 2026

## Baseline

| Field | Current value |
| --- | --- |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Repository contract | 44 canonical migrations through `20260727191942_operating_cap_enforcement.sql` |
| Delivery evidence | PRs #122, #124, #126, #128, #131, #134 and #136 cover the full tournament lifecycle, automatic valid-entry recovery, bounded Original Predictor reads, paginated overall standings and operating-cap enforcement |
| Verified production release source | `0b956e8f553f06f5bdb72ce937acc6295a8c2451` |
| Development Supabase | `iouzoutneyjpugbbtdem` — contract 44 applied and history-aligned |
| Production Supabase | `vkfnsqdyhvtwyqkisxhk` — contract 38; unchanged |
| Netlify contexts | `dev`, `branch-deploy` and `deploy-preview` declare 44 and use development Supabase; `production` remains 38 and uses production Supabase |
| Published production deploy | `6a67560deb88202a74108c37` — verified and locked |
| Production recovery | green encrypted backup run `30264080847`; disposable restore passed; artifact preserved off GitHub |
| Production smoke | exact commit, contract, routes/assets, security headers and Supabase isolation passed |

Production is a controlled future-tournament target, not an active Euro 2028 service. It remains locked at the contract-38 milestone. Contracts 39–44 are development-only until a later production milestone receives explicit owner approval.

## Executive verdicts

| Area | Verdict |
| --- | --- |
| Contract alignment | **Controlled divergence.** Repository, development and non-production Netlify are at 44; production remains deliberately locked at 38. |
| Recovery | **Verified.** The deferred exception is closed by green run #7 and off-GitHub encrypted custody. |
| Administrator result control | **Implemented.** Protected routes, capability checks, confirm/correct/clear, immutable revisions and regulation/extra-time/penalty handling are browser-proven. |
| Actual qualification control | **Implemented.** Exact third-place boundary ties are detected, ordered only by authorised administrators, reasoned, reviewed, revisioned and replayed transactionally. |
| Automatic valid-entry recovery | **Implemented.** A database-owned one-minute job submits only complete valid entries at lock, records immutable outcomes and exposes success/failure only to the entry owner. |
| Bounded Original Predictor reads | **Implemented.** User league lists, league members, match-pick comparisons and rival-entry payloads have explicit server-side maxima with deterministic ordering and unchanged access gates; overall standings use server-ranked keyset pagination (contract 43: 50 rows default, 100 maximum, deterministic cursors, independent current-user position context). |
| Operating-cap enforcement | **Implemented.** Contract 44 serialises signup and league-creation counters with advisory locks, enforces the public-user and total-league limits in `BEFORE INSERT` triggers, exposes an anonymous-safe capacity RPC and a service-role-only limit adjustment, and shows full registration/league states with contact-admin guidance. The current public signup limit is 50 (fail-closed pending SMTP verification); 250 remains the tested technical capacity. |
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
- overall standings served by server-ranked keyset pagination (50 default / 100 maximum per page) with deterministic cursors and current-user position context;
- transaction-serialised public-user and total-league operating limits enforced at signup and league creation, with anonymous-safe capacity preflight and service-role-only adjustment;
- user league lists capped at 20, and league member/pick payloads capped at 250;
- rival-entry payloads fixed to 36 group predictions and 24 tournament teams;
- exact function execution allowlists, empty security-definer search paths and closed direct-table access;
- protected administrator routes and capability parsing;
- a top-nav app bar on every signed-in screen (section context, theme toggle, avatar into own profile) with the legacy PageShell title header retired;
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
- league tie-breakers (`docs/scoring-rules.md` §5) are implemented in `src/domain/tournament/calculateLeagueRank.ts` but not yet wired into the shipped standings reads, which currently order level entries deterministically by name — final-standings tie-break wiring and its explanation UI remain;
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

**Stage 3 — representative scale evidence (cap enforcement complete)**

Operating-cap enforcement at authoritative write boundaries, including concurrency behaviour, shipped in PR #136 (contract 44). Remaining:

1. Capture query plans, response sizes and timings for standings, league, profile, H2H and scoring-summary reads at the intended caps. **First tranche captured** for the non-league reads (overall standings pages/cursors, rival entry, match-pick distribution, submission status): single-digit milliseconds and kilobytes at 250 submitted entries — [`investigations/2026-07-28-stage-3c2-scale-read-recompute-evidence.md`](investigations/2026-07-28-stage-3c2-scale-read-recompute-evidence.md). League-read evidence belongs to draft PR #138.
2. Measure score recomputation and rank-history capture with representative submitted entries. **Measured:** full delete-and-rederive recompute at 250 entries with 12 confirmed results takes ~354 ms (3,060 events); rank-history capture ~4 ms — same evidence document. Re-measure at full-tournament result volume during the dress rehearsal.
3. Prove the main profile, league and comparison surfaces remain correct and responsive at the intended caps.
4. Repair completion, loading, empty and error states exposed by those scale journeys.

Draft PR #138 (contracts 45–46) is in flight for paginated private-league standings and ownership-candidate search, including the league share of the evidence capture above.

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
