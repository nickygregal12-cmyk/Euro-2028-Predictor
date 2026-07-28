# Current quality status

> The only live implementation and hosted-status authority. Current code, migrations, executable tests and verified hosted evidence override older audits, reconciliations, TODOs and chat narratives.

**Status date:** 28 July 2026

## Baseline

| Field | Current value |
| --- | --- |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Repository contract | 46 canonical migrations through `20260727221000_private_league_summary_activity.sql` (draft PR #138) |
| Delivery evidence | PRs #122, #124, #126, #128, #131, #134 and #136 cover the full tournament lifecycle, automatic valid-entry recovery, bounded Original Predictor reads, paginated overall standings and operating-cap enforcement; draft PR #138 adds paginated private-league standings and owner-only transfer-candidate search |
| Verified production release source | `515e794aa483a779c971e16a364fcbd243fa7ee6` |
| Development Supabase | `iouzoutneyjpugbbtdem` — contract 46 applied, canonical history aligned and baseline data unchanged |
| Production Supabase | `vkfnsqdyhvtwyqkisxhk` — **contract 44** applied 28 July 2026 after a fresh green backup (run `30337648499`); remains locked at the milestone |
| Netlify contexts | `dev`, `branch-deploy` and `deploy-preview` declare 46 and use development Supabase; `production` declares 44 and uses production Supabase |
| Published production deploy | `6a686e30f2f13c07f10e30d8` from `515e794aa483a779c971e16a364fcbd243fa7ee6` — contract 44, ready and manually verified signed-in |
| Production recovery | green encrypted backup run `30264080847`; disposable restore passed; artifact preserved off GitHub |
| Production smoke | contract-44 release identity and signed-in operation manually verified; the exact-head Production Smoke workflow remains an operational follow-up |

Production is a controlled future-tournament target, not an active Euro 2028 service. Its database and application are aligned and locked at contract 44. Contracts 45–46 are development-only through draft PR #138; they must not be promoted to production without a later approved milestone gate.

## Executive verdicts

| Area | Verdict |
| --- | --- |
| Contract alignment | **Intentionally split.** Repository, development and non-production Netlify are at contract 46; production database and application are aligned and locked at contract 44. |
| Recovery | **Verified.** The deferred exception is closed by green run #7 and off-GitHub encrypted custody. |
| Administrator result control | **Implemented.** Protected routes, capability checks, confirm/correct/clear, immutable revisions and regulation/extra-time/penalty handling are browser-proven; one owner-controlled production results administrator is assigned through server-owned Auth metadata. |
| Actual qualification control | **Implemented.** Exact third-place boundary ties are detected, ordered only by authorised administrators, reasoned, reviewed, revisioned and replayed transactionally. |
| Automatic valid-entry recovery | **Implemented.** A database-owned one-minute job submits only complete valid entries at lock, records immutable outcomes and exposes success/failure only to the entry owner. |
| Bounded Original Predictor reads | **Implemented.** Overall standings use server-ranked keyset pagination; contract 45 adds equivalent bounded pagination and independent caller context to private-league standings, with a separate owner-only transfer search. |
| Operating-cap enforcement | **Implemented.** Contract 44 serialises signup and league-creation counters with advisory locks, enforces the public-user and total-league limits at authoritative write boundaries, and exposes safe capacity controls. The current public signup limit remains 50 pending SMTP verification; 250 is the tested technical capacity. |
| Representative scale evidence | **Strong at the current cap.** Non-league reads and recomputation are recorded at 250 entries; private-league traversal is recorded at 250 members with five complete 50-row pages, no duplicates and rollback-only hosted evidence. |
| Tournament database lifecycle | **Proven.** Deterministic 51-match, boundary-tie, automatic-submission and excess-data pgTAP journeys cover the full lifecycle and intended read boundaries. |
| Product-facing result lifecycle | **Proven.** Match Centre, fixtures and H2H consume the server-owned knockout winner, including level extra-time scores and penalty shootouts. |
| Browser/reset lifecycle | **Proven.** Authenticated journeys cover real group completion, knockout results, boundary resolution, automatic submission and private-league pagination/ownership transfer on disposable local Supabase. |
| Launch readiness | **Not ready.** Official data, remaining product states, accessibility, operational ownership and the later full dress rehearsal remain. |

## Implemented foundation

- canonical group ordering and explicit unresolved-tie handling;
- RPC-only manual submission and server-derived predicted positions;
- database-scheduled automatic submission that reuses the authoritative validator;
- immutable per-entry/per-lock automatic-submission outcomes;
- owner-visible manual, automatic, pending and failed submission states;
- a narrow server-only after-lock refresh for derived group positions while user-owned prediction tables remain locked;
- authoritative result lifecycle, revisions and serialised scoring;
- server-owned actual Round-of-16 population from completed group standings and best-third allocation;
- authorised actual third-place qualification-boundary resolution with exact-set validation;
- group-result fingerprints that invalidate stale official tie decisions;
- transactional bracket replay that refuses to rewrite a played knockout fixture;
- real winner propagation from the Round of 16 through the final;
- Match Centre, fixtures and H2H consumption of authoritative regulation, extra-time and penalty results;
- predicted-bracket replay and atomic bracket persistence;
- version-safe score clearing and immutable result/qualification revisions;
- overall standings served by server-ranked keyset pagination (50 default / 100 maximum) with deterministic cursors and current-user position context;
- private-league standings served by equivalent keyset pagination with server-owned rank/tie/position semantics, independent caller context and bounded incremental loading;
- owner-only transfer-candidate search separated from standings, with authoritative membership validation retained;
- lightweight league summaries retain latest activity without downloading standings;
- transaction-serialised public-user and total-league operating limits enforced at signup and league creation, with anonymous-safe capacity preflight and service-role-only adjustment;
- user league lists capped at 20, and match-pick payloads capped at 250;
- rival-entry payloads fixed to 36 group predictions and 24 tournament teams;
- exact function execution allowlists, empty security-definer search paths and closed direct-table access;
- protected administrator routes and capability parsing;
- a top-nav app bar on every signed-in screen with section context, theme toggle and avatar access to the user's profile;
- responsive administrator result and qualification controls with review and required reasons;
- authorised and unauthorised administrator browser journeys on desktop/mobile;
- environment/deployment-contract guards;
- CI, Database parity, Browser E2E and exact-head preview smoke;
- production backup/restore rehearsal and contract-44 release publication.

## Immediate product gaps

- representative product-surface verification for profiles, richer H2H and comparison journeys at the intended caps;
- completion, loading, empty, retry and error-state coverage across remaining product surfaces;
- reminder delivery only after Auth/SMTP ownership and reliability are verified;
- official teams, fixtures, regulations and lock instant;
- league tie-breakers (`docs/scoring-rules.md` §5) are implemented in `src/domain/tournament/calculateLeagueRank.ts` but not yet wired into final shipped standings reads; final-standings activation and explanation UI remain;
- automated axe coverage, manual accessibility review and the later full product dress rehearsal.

## Development mode

The project uses proportionate controls:

| Change class | Gate |
| --- | --- |
| UI, copy, styling, docs | CI; targeted preview/UI verification when relevant |
| Features and development schema | CI plus relevant unit/integration, Database parity and Browser E2E |
| Production schema, auth, scoring, destructive work or release | Backup when data is at risk, preflight, explicit approval, full verification and dated evidence |

Production promotion is milestone-only. Development can advance ahead of production with the difference recorded in this file. The heavier release posture returns around six months before the tournament, or earlier when real users or valuable live data appear.

## Current next batch

**Stage 3C2 — product-surface verification and state repair**

Completed evidence:

1. Non-league reads at 250 submitted entries remain single-digit milliseconds and kilobytes; full recomputation with 12 results is ~354 ms and rank-history capture ~4 ms — [`investigations/2026-07-28-stage-3c2-scale-read-recompute-evidence.md`](investigations/2026-07-28-stage-3c2-scale-read-recompute-evidence.md).
2. Private-league standings traverse all 250 members exactly once across five 50-row pages; warm pages are ~23–24 ms and ~14 kB, owner search is ~3.2 ms and the lightweight summary is ~1.2 ms — [`investigations/2026-07-28-stage-3c2-private-league-evidence.md`](investigations/2026-07-28-stage-3c2-private-league-evidence.md).
3. Contracts 45–46 are development-hosted with canonical history, exact privileges and a compatible Netlify preview; production remains contract 44.

Remaining:

1. Complete the final PR #138 CI, Database parity, Browser E2E and exact-head preview-smoke gate, then merge.
2. Test profile, H2H and comparison surfaces against representative data on desktop and phone.
3. Repair completion, loading, empty, retry and error states exposed by those journeys.
4. Re-measure full recomputation at complete tournament result volume during the later dress rehearsal.

## Operational follow-ups

- run the exact-head Production Smoke workflow for the published contract-44 release;
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
