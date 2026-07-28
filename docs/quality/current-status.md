# Current quality status

> The only live implementation and hosted-status authority. Current code, migrations, executable tests and verified hosted evidence override older audits, reconciliations, TODOs and chat narratives.

**Status date:** 28 July 2026

## Baseline

| Field | Current value |
| --- | --- |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Repository contract | 58 canonical migrations through `20260729090000_clear_predictions_race_safety.sql` (contract 48 = H2H rank history; 49–56 = Bonus Games B2–B7c; 57 = Account entry controls; 58 = race-safe clearing) |
| Delivery evidence | PRs #122, #124, #126, #128, #131, #134, #136, #138 and #141 cover the lifecycle, recovery, bounded/paginated reads, operating caps and Profile/H2H resilience; PR #143 adds secure other-player profiles; PR #145 adds richer H2H rank history and bracket health; PR #150 adds contracts 49–52 for the Bonus Games platform and KO Predictor; PR #157 contains contracts 53–55 for Last Man Standing and Predictor Cup group-stage delivery; PR #164 completes Predictor Cup at contract 56; PR #167 adds the private Account surface and contract-57 entry controls; PR #171 hardens clear-entry concurrency at contract 58 |
| Verified production release source | `af5aa15a151f5c4236ba3f2756faab4b357f31ee` — contract-55 Bonus Games milestone |
| Development Supabase | `iouzoutneyjpugbbtdem` — exactly 58 canonical versions through `20260729090000_clear_predictions_race_safety.sql`; contract 58 has one canonical history row, hardened execution posture and no production promotion |
| Production Supabase | `vkfnsqdyhvtwyqkisxhk` — exactly **contract 55** through `20260729030000_predictor_cup_group_scoring.sql`; preserved-data and privilege checks passed |
| Netlify contexts | `dev`, `branch-deploy` and `deploy-preview` declare 58 and use development Supabase; `production` declares 55 and uses production Supabase |
| Published production deploy | `6a68e4f9ee76002a26ffbee6`, ready; exact contract-55 release identity, HTTP smoke and Chromium smoke passed |
| Production recovery | fresh encrypted contract-48 pre-promotion backup and disposable restore passed immediately before contracts 49–55; encrypted artifact retained |
| Production smoke | exact contract-55 release identity, HTTP smoke and Chromium browser smoke passed; the manual workflow now requires the exact release commit |

Production is a controlled future-tournament target, not an active Euro 2028 service. Its database and application are aligned and re-locked at contract 55 after the approved Bonus Games milestone promotion. Contracts 56–58 (Cup knockouts, Account controls and clear-entry race safety) are development-only and must not be promoted without a later approved milestone gate.

## Executive verdicts

| Area | Verdict |
| --- | --- |
| Contract alignment | **Intentionally split and internally aligned.** Repository branch, development Supabase and non-production Netlify are at contract 58; production database, application and Netlify context remain locked at the contract-55 milestone. |
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
| Account controls | **Development-delivered.** Contract 57 provides the private Account page, identity/auth editing, reminder preference and pre-lock Original entry wipe. Contract 58 makes the wipe resistant to delayed autosaves by retiring the old entry identity after child cleanup; stale writes fail the foreign key. Privacy/support explanatory content remains a small application follow-up. |
| Bonus Games | **Complete (ADR-0010 B1–B7c).** Contracts 49–55 (production-released) carry the platform, hub, shared knockout store, KO Predictor, tournament-format Last Man Standing and Cup group stage; contract 56 (development only) completes the Cup — audited qualification gate with the §5.2 mini head-to-head, per-game wildcards, banded seeding, playoff with byes, parity-laned Penalty Numbers, points/AET/penalty/walkover round settle, champion and Golden Predictor. |
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
- deny-all Bonus Games storage separated from Original Predictor scoring/leagues;
- bounded Games hub registration/withdrawal, shared per-kickoff knockout prediction storage and server-ranked KO Predictor standings;
- tournament-format Last Man Standing with one-use teams, deadline locking and result-correction-aware survivor resolution;
- Predictor Cup deterministic group draw, dedicated groups/members/fixtures and read-derived regulation-time group scoring/tables;
- the Predict hub hero + journey map: weighted 51-pick completion, lock countdown, champion anchor, a Continue deep-link to the first incomplete thing, a numbered stepper with tie-aware A–F quick-jump chips, step eyebrows and stage-boundary CTAs, and first-cut post-lock My-entry/spectator states;
- private Account management for display name, password, email, reminder preference, sign-out and pre-lock Original entry clearing;
- race-safe clear-entry semantics that remove Original children before retiring the entry identity, making stale autosaves non-resurrecting while preserving accounts, leagues and Bonus Games;
- exact function execution allowlists, empty security-definer search paths and closed direct-table access;
- protected administrator routes and capability parsing;
- a top-nav app bar on every signed-in screen with section context, theme toggle and avatar access to the user's profile;
- responsive administrator result and qualification controls with review and required reasons;
- authorised and unauthorised administrator browser journeys on desktop/mobile;
- environment/deployment-contract guards;
- CI, Database parity, Browser E2E and exact-head preview smoke;
- production backup/restore rehearsal, contracts 49–55 migration promotion and exact contract-55 release smoke.

## Immediate product gaps

- Account privacy/reveal explanation and configuration-driven contact-admin action;
- post-lock consensus/trends surface and richer My-entry reveal state;
- completion, loading, empty, retry and error-state coverage across remaining tournament and comparison surfaces;
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

**Finish Account hardening, then move into post-lock experience**

1. Complete PR #171 exact preview/browser evidence and merge contract 58.
2. Add the missing Account privacy/reveal explanation and configuration-driven Contact admin action as a small application-only slice.
3. Build post-lock consensus/trends and the richer My-entry hero from the stable contract-58 baseline.
4. Re-measure full recomputation at complete tournament result volume during the later dress rehearsal.

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
