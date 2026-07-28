# Current quality status

> The only live implementation and hosted-status authority. Current code, migrations, executable tests and verified hosted evidence override older audits, reconciliations, TODOs and chat narratives.

**Status date:** 28 July 2026

## Baseline

| Field | Current value |
| --- | --- |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Repository contract | 54 canonical migrations through `20260729010000_predictor_cup_foundation.sql` (contract 48 = H2H rank history; 49–54 = Bonus Games B2–B7a) |
| Delivery evidence | PRs #122, #124, #126, #128, #131, #134, #136, #138 and #141 cover the lifecycle, recovery, bounded/paginated reads, operating caps and Profile/H2H resilience; PR #143 adds secure other-player profiles; PR #145 adds richer H2H rank history and bracket health (contract 48); the Bonus Games branch adds ADR-0010 B1–B5 (contracts 49–52) |
| Verified production release source | PR #145, merged as `1da5fb0` — see `investigations/2026-07-28-contract-48-production-release.md` |
| Development Supabase | `iouzoutneyjpugbbtdem` — contract 54 applied 28 July 2026 with canonical history (54 versions through `20260729010000_predictor_cup_foundation`), verified deny-all bonus-table posture (incl. the three Cup tables), hardened RPC grants, the extended bonus result fan-out live and the Cup draw operation service-role-only |
| Production Supabase | `vkfnsqdyhvtwyqkisxhk` — **contract 48** applied 28 July 2026 per the dated release record (48 canonical versions through `20260728122500_h2h_rank_history`, verified read-only during merge reconciliation); remains locked at the milestone |
| Netlify contexts | `dev`, `branch-deploy` and `deploy-preview` declare 54 and match the repository/development contract; `production` declares 48 and uses production Supabase |
| Published production deploy | contract-48 release published from `main` per the Git-based deployment described in the dated release record |
| Production recovery | green encrypted backup run `30264080847`; disposable restore passed; artifact preserved off GitHub |
| Production smoke | contract-44 release identity and signed-in operation manually verified; the exact-head Production Smoke workflow remains an operational follow-up |

Production is a controlled future-tournament target, not an active Euro 2028 service. Its database and application are aligned and locked at contract 48 (the H2H rank-history milestone). Contracts 49–54 (the Bonus Games platform, KO Predictor, Last Man Standing and the Cup foundation) are development-only and must not be promoted to production without a later approved milestone gate.

## Executive verdicts

| Area | Verdict |
| --- | --- |
| Contract alignment | **Intentionally split.** Repository, development Supabase and non-production Netlify are aligned at contract 54; production database and application are aligned and locked at contract 48. Merge reconciliation 28 July 2026: the H2H branch's contract 48 and the Bonus Games branch's former 48–51 were renumbered into one chain (48 = H2H, 49–52 = bonus), and the H2H migration — production-released but never applied to development — was applied to development during the merge. |
| Recovery | **Verified.** The deferred exception is closed by green run #7 and off-GitHub encrypted custody. |
| Administrator result control | **Implemented.** Protected routes, capability checks, confirm/correct/clear, immutable revisions and regulation/extra-time/penalty handling are browser-proven; one owner-controlled production results administrator is assigned through server-owned Auth metadata. |
| Actual qualification control | **Implemented.** Exact third-place boundary ties are detected, ordered only by authorised administrators, reasoned, reviewed, revisioned and replayed transactionally. |
| Automatic valid-entry recovery | **Implemented.** A database-owned one-minute job submits only complete valid entries at lock, records immutable outcomes and exposes success/failure only to the entry owner. |
| Bounded Original Predictor reads | **Implemented.** Overall and private-league standings use server-ranked keyset pagination, independent caller context and deterministic ordering; owner transfer uses a separate bounded search. |
| Operating-cap enforcement | **Implemented.** Contract 44 serialises signup and league-creation counters with advisory locks, enforces public-user and total-league limits at authoritative write boundaries, and exposes safe capacity controls. The current public signup limit remains 50 pending SMTP verification; 250 is the tested technical capacity. |
| Representative scale evidence | **Strong at the current cap.** Non-league reads/recomputation are recorded at 250 entries; private-league traversal is recorded at 250 members with complete deterministic pages and rollback-only hosted evidence. |
| Tournament database lifecycle | **Proven.** Deterministic 51-match, boundary-tie, automatic-submission and excess-data pgTAP journeys cover the full lifecycle and intended read boundaries. |
| Product-facing result lifecycle | **Proven.** Match Centre, fixtures and H2H consume server-owned result/winner data. H2H headline points use authoritative standings/rival totals rather than partial browser recomputation. |
| Profile/H2H resilience | **Proven.** Own Profile and H2H react to current provider values, expose retry actions and retain bounded server contracts; league-to-H2H is browser-proven on desktop and phone. |
| Other-player profile privacy | **Implemented and hosted-proven.** Co-members receive only identity/league/entry state before lock; after lock a submitted entry receives authoritative rank/points and bounded 36/24/100 detail. Outsiders are denied server-side. |
| Browser/reset lifecycle | **Proven.** Authenticated journeys cover the complete tournament, private-league pagination/ownership transfer and the secure hidden-to-full player-profile transition on desktop and phone. |
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
- H2H authoritative headline totals from bounded server reads, with browser-derived comparison statistics;
- own Profile/H2H refresh from current provider values plus explicit retry for partial/transient reads;
- co-member-only player profiles with safe pre-lock summary, explicit post-lock no-entry state and bounded full post-lock detail;
- two-way Profile/H2H navigation while overall standings remain non-clickable under the current privacy boundary;
- predicted-bracket replay and atomic bracket persistence;
- version-safe score clearing and immutable result/qualification revisions;
- overall standings served by server-ranked keyset pagination (50 default / 100 maximum) with deterministic cursors and current-user position context;
- private-league standings served by equivalent keyset pagination with server-owned rank/tie/position semantics, independent caller context and bounded incremental loading;
- owner-only transfer-candidate search separated from standings, with authoritative membership validation retained;
- lightweight league summaries retain latest activity without downloading standings;
- transaction-serialised public-user and total-league operating limits enforced at signup and league creation, with anonymous-safe capacity preflight and service-role-only adjustment;
- user league lists capped at 20, match-pick payloads capped at 250, rival-entry payloads fixed to 36/24 and player-profile detail fixed to 36/24/100;
- exact function execution allowlists, empty security-definer search paths and closed direct-table access;
- protected administrator routes and capability parsing;
- a top-nav app bar on every signed-in screen with section context, theme toggle and avatar access to the user's profile;
- responsive administrator result and qualification controls with review and required reasons;
- authorised and unauthorised administrator browser journeys on desktop/mobile;
- environment/deployment-contract guards;
- CI, Database parity, Browser E2E and exact-head preview smoke;
- production backup/restore rehearsal and contract-44 release publication.

## Immediate product gaps

- completion, loading, empty, retry and error-state coverage across remaining Match Centre, tournament, account and comparison surfaces;
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

**Stage 4A–4B complete → remaining Stage 4 core experience, with the Bonus Games foundation delivered**

Completed evidence:

1. Stage 3C2 scale and surface evidence is complete through PRs #138 and #141.
2. Contract 47 rebuilds cleanly from all 47 migrations; database lint, pgTAP, TypeScript/PostgreSQL parity, CI and authenticated desktop/mobile Browser E2E pass.
3. Development-hosted profile evidence proves a 195 B pre-lock response with no score/pick detail, outsider denial with `42501`, and a 21,273 B fully capped post-lock response in 9.691 ms — [`investigations/2026-07-28-stage-4-secure-player-profile-evidence.md`](investigations/2026-07-28-stage-4-secure-player-profile-evidence.md).
4. Stage 4A closed at contract 47; Stage 4B closed at contract 48 and was production-released the same day.

Current:

1. Stage 4B richer H2H (rank history + bracket health) is delivered through PR #145 and production-released at contract 48.
2. The Bonus Games platform (ADR-0010 B1–B4) and the first two games (B5 KO Predictor, B6 Last Man Standing — contract 53, tournament format per `docs/scoring-rules.md` §8, with survival re-derived inside the result operation and pgTAP `107` covering the full lifecycle incl. a correction-driven crown change) are delivered: B1 pure domain, B2 deny-all schema (contract 49), B3 the Games hub (contract 50), B4 the shared knockout prediction store (contract 51) and B5 KO Predictor scoring (contract 52) — Exact 5 / Result 3 / Through +2 per `docs/scoring-rules.md` §8, recomputed inside the single advisory-locked result operation with rolling-entry banking, plus a bounded server-ranked standings read and the `/games/ko-predictor` surface. pgTAP `103`–`106` and Database parity are green; the full 52-migration chain is applied to development Supabase with verified posture. Last Man Standing and the Predictor Cup (B6–B7) remain gated behind the remaining Stage 4 core experience per `docs/roadmap.md` Stage 5.
3. The Predictor Cup foundation (B7a, contract 54) is delivered: dedicated deny-all cup tables, the audited seed-reproducible close-and-draw operation (service-role only), the bounded my-cup read and the `/games/cup` surface; Cup group-stage scoring (B7b) and knockouts (B7c) follow. The non-production contract chain is aligned at 54; each future contract bump repeats the owner Netlify variable update.
4. Continue through Match Centre/tournament states, account/privacy/contact-admin and post-lock trends, repairing resilient states and accessibility alongside each surface.
5. Re-measure full recomputation at complete tournament result volume during the later dress rehearsal.

## Operational follow-ups

- run the exact-head Production Smoke workflow for the published contract-48 release;
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
