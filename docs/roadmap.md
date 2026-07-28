# Euro 2028 Predictor — Roadmap

**Status date:** 28 July 2026  
**Authority:** The only live execution sequence. Use `docs/quality/current-status.md` for current facts.

## Stage 0 — Contract-38 baseline and release closure: complete

- repository, development and production aligned at contract 38;
- encrypted backup and disposable restore verified;
- production contract-38 release published and exact-head smoke passed;
- production locked for milestone-only promotion;
- administrator authorisation/RPC foundation merged.

## Stage 1 — Admin Control Room completion: complete

- result confirm, correct and clear forms;
- review before mutation and required reasons for correction/clear;
- safe immutable result revision history;
- regulation, extra-time, penalty and unresolved-participant handling;
- authorised/unauthorised desktop and mobile Browser E2E;
- production assignment/revocation model based on server-owned Auth
  `app_metadata`, never `profiles.role`.

Exit met: an authorised administrator can manage the full result lifecycle; ordinary users cannot. One owner-controlled production results administrator is assigned through the narrow `results` capability.

## Stage 2 — Full tournament lifecycle simulation: complete

Delivered through PRs #122, #124 and #126:

- seeded full 51-match tournament lifecycle with representative users and a league;
- valid pre-tournament entries, predicted tables, brackets, lock and submission;
- all 36 group results through standings and best-third qualification;
- server-owned actual Round-of-16 population using the six-group allocation contract;
- explicit authorised resolution when an actual third-place tie crosses fourth place;
- exact tie-set validation, required reason, review and immutable qualification revisions;
- group-result fingerprints that invalidate stale decisions;
- all 15 knockout matches through regulation, extra time and penalties;
- Match Centre, fixtures and H2H consumption of the authoritative knockout winner;
- correction, clearing, downstream replay and scoring recomputation;
- refusal and transactional rollback when a played R16 fixture would be rewritten;
- rank-history checkpoints, champion scoring and immutable revisions;
- clean rebuild from 40 canonical migrations in disposable local Supabase;
- authenticated Browser E2E using real group completion rather than participant injection;
- deterministic resolve, correct, clear and reset journeys with no production data.

Exit met: the complete tournament can be run repeatedly in development with deterministic database and browser evidence and no manual database repair.

## Stage 3A — Automatic valid-entry recovery at lock: complete

Delivered through PR #128 and contract 41:

- database-owned one-minute scheduler using Supabase Cron;
- server-only processor that reuses the existing authoritative submission validator;
- complete valid entries automatically submitted at the real post-lock processing time;
- incomplete or invalid entries left unsubmitted with a safe validator reason;
- immutable per-entry/per-lock automatic outcome history;
- owner-only manual, automatic, pending and failed status RPC;
- Review-page success/failure state without changing the existing manual submit flow;
- transaction-local after-lock refresh limited to derived group positions;
- no relaxation of user-owned prediction locks, version checks or ownership rules;
- 28 database lifecycle assertions and authenticated complete/incomplete browser journeys;
- clean rebuild from 41 canonical migrations.

Exit met: a complete saved entry cannot be stranded solely because its owner forgot to press Submit, while invalid entries remain safely excluded and auditable.

## Stage 3B — Original Predictor bounded reads: complete

Delivered through PR #131 and contract 42:

- overall submitted-entry standings ordered deterministically and capped at 250;
- one user's league list capped at 20;
- league standings and match-pick comparison payloads capped at 250 members/picks;
- truthful total-member and predicted-member counts retained when detail payloads are capped;
- rival-entry payload restricted to the fixed 36 group predictions and 24 tournament teams;
- existing RPC signatures, ownership and co-membership rules preserved;
- all five bounded security-definer reads moved to an empty immutable search path;
- 17 excess-data database assertions using 251 users, 21 leagues and 251 league members;
- clean rebuild from 42 canonical migrations; production remained at contract 38 at delivery time.

Exit met: current Original Predictor standings and comparison payloads cannot grow beyond the intended operating bounds.

## Stage 3B2 — Paginated overall standings: complete

Delivered through PR #134 and contract 43:

- the contract-42 capped overall standings RPC replaced by server-ranked keyset pagination;
- 50 rows by default, 100 maximum, deterministic opaque cursors;
- independent current-user position context;
- all other contract-42 read bounds unchanged;
- database (`099_paginated_overall_leaderboard`) and browser (`e2e/overall-standings.spec.ts`) proof;
- production remained at contract 38 at delivery time.

Exit met: overall standings pages are bounded and deterministic at any submitted-entry volume.

## Stage 3C1 — Operating-cap enforcement: complete

Delivered through PR #136 and contract 44:

- a private singleton operating-limit record seeded to 50 public users and 20 total leagues (250 remains the tested technical capacity; the public signup limit stays fail-closed at 50 pending SMTP verification);
- signup and league-creation counters serialised with transaction advisory locks;
- `BEFORE INSERT` enforcement on `auth.users` and `public.leagues`;
- an anonymous-safe aggregate capacity RPC and a service-role-only limit adjustment RPC;
- full registration and league-cap states with contact-admin guidance;
- a 24-assertion database lifecycle plus authenticated capacity browser journeys;
- clean rebuild from 44 canonical migrations; production was subsequently promoted and released at contract 44.

Exit met: the operating caps are enforced under concurrency at the authoritative write boundaries.

## Stage 3C2 — Representative scale and surface evidence: closing

Completed:

1. Seed representative volumes without weakening production isolation. Rollback-only fixtures cover 250 submitted entries and a separate 250-member private league; no synthetic hosted data was retained.
2. Capture non-league read and recomputation evidence — `docs/quality/investigations/2026-07-28-stage-3c2-scale-read-recompute-evidence.md`.
3. Capture private-league pagination, caller-context, owner-search and lightweight-summary evidence — `docs/quality/investigations/2026-07-28-stage-3c2-private-league-evidence.md`.
4. Measure score recomputation and rank-history capture at representative submitted-entry volume: ~354 ms / ~4 ms at 250 entries with 12 results. Re-measure at full result volume during the dress rehearsal.
5. Apply contracts 45–46 to development with canonical history and move non-production Netlify contexts to the matching contract; production remains locked at 44.
6. Merge PR #138 after green CI, Database parity, Browser E2E and exact-head preview smoke, delivering paginated private-league standings and owner-only transfer search.
7. Through PR #141, repair Profile/H2H background refresh and retry states, use authoritative H2H headline totals, retain bounded rival/standings reads and prove league-to-H2H on desktop and phone.

Close-out:

1. Merge PR #141 after exact-head CI, authenticated Browser E2E and preview smoke are green.
2. Carry resilient loading/empty/retry/error treatment into each Stage 4 surface rather than creating another broad pre-product audit batch.
3. Add reminders only after Auth/SMTP ownership and delivery reliability are verified.

Exit: core Original Predictor reads and recomputation remain correct and responsive at the operating caps, and the principal Profile/H2H/league comparison journeys have complete resilient states with recorded desktop/mobile evidence.

## Stage 4 — Core product experience: next

Build in this order after PR #141:

1. complete other-player profiles and the richer H2H layer;
2. add rank-over-time and bracket health;
3. expand Match Centre and tournament states;
4. add account, privacy and contact-admin surfaces;
5. add post-lock trends;
6. finish mobile, empty/error-state and accessibility work alongside each feature rather than as a late cleanup pass.

## Stage 5 — Bonus competitions

Build only after the Original Predictor lifecycle and integrity/scale stage are proven:

1. KO Predictor;
2. Last Man Standing;
3. Predictor Cup.

Each mode keeps its own entry window, rules, scoring and leagues.

## Stage 6 — Operations and launch preparation

- monitoring ownership and incident response;
- Auth, SMTP, CAPTCHA and leaked-password decisions;
- branch protection and required checks;
- official teams, fixtures, regulations and lock instant;
- privacy/GDPR self-service;
- security, accessibility and performance assurance;
- full dress rehearsal, application rollback and backup/restore rehearsal.

Reintroduce stricter release governance around six months before Euro 2028, or earlier when real users or valuable live data appear.

## Non-negotiable rules

- Original and bonus points/leagues never combine.
- Predicted and real brackets never blend.
- Database rules protect locks, results and scoring inputs.
- Submission waits for current writes to settle.
- Protected RPCs never gain unsafe direct-table fallbacks.
- Public function execution is closed by default.
- Production writes require explicit owner approval.
- Production promotion is milestone-only.
- Official future facts remain provisional until authoritative verification.
