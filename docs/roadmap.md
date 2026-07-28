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
- production assignment/revocation model based on server-owned Auth `app_metadata`, never `profiles.role`.

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
- clean rebuild from 42 canonical migrations.

Exit met: current Original Predictor standings and comparison payloads cannot grow beyond the intended operating bounds.

## Stage 3B2 — Paginated overall standings: complete

Delivered through PR #134 and contract 43:

- the contract-42 capped overall standings RPC replaced by server-ranked keyset pagination;
- 50 rows by default, 100 maximum, deterministic opaque cursors;
- independent current-user position context;
- all other contract-42 read bounds unchanged;
- database and browser standings proof.

Exit met: overall standings pages are bounded and deterministic at any submitted-entry volume.

## Stage 3C1 — Operating-cap enforcement: complete

Delivered through PR #136 and contract 44:

- a private singleton operating-limit record seeded to 50 public users and 20 total leagues (250 remains the tested technical capacity; the public signup limit stays fail-closed at 50 pending SMTP verification);
- signup and league-creation counters serialised with transaction advisory locks;
- authoritative write-boundary enforcement on `auth.users` and `public.leagues`;
- anonymous-safe capacity preflight and service-role-only adjustment;
- full registration and league-cap states with contact-admin guidance;
- database concurrency assertions and authenticated capacity browser journeys;
- production subsequently promoted and released at contract 44.

Exit met: the operating caps are enforced under concurrency at the authoritative write boundaries.

## Stage 3C2 — Representative scale and surface evidence: complete

Delivered through PRs #138 and #141:

- rollback-only evidence at 250 submitted entries and a separate 250-member private league;
- non-league read, recomputation and rank-history measurements;
- server-ranked private-league keyset pagination, independent caller context and owner-only transfer search;
- five-page deterministic private-league traversal and hosted query-plan/response-size evidence;
- own Profile and H2H retry/background-refresh repairs;
- authoritative H2H headline totals;
- desktop/phone league-to-H2H surface evidence;
- contracts 45–46 applied to development and non-production only; production remained contract 44.

Exit met: core Original Predictor reads and recomputation remain correct and responsive at the operating caps, and the principal own Profile/H2H/league comparison journeys have resilient states with recorded evidence.

## Stage 4 — Core product experience: current

### Stage 4A — Secure other-player profiles: closing

PR #143 and contract 47 deliver:

- a co-member-only, bounded profile read with self access;
- identity, tournament league count and submitted-entry state only before lock;
- authoritative rank/points plus maximum 36 group predictions, 24 progression rows and 100 score events after lock;
- explicit post-lock no-entry state;
- outsider denial server-side, empty security-definer search path and exact execution grants;
- real private-league Profile navigation before and after lock;
- two-way Profile/H2H navigation while overall standings remain non-clickable under the current privacy rule;
- strict response parsing, pgTAP access/bounds tests, unit coverage and authenticated desktop/mobile lock-transition journeys;
- development-hosted timing, payload and rollback evidence;
- contract 47 applied to development and non-production only; production remains contract 44.

Close-out: merge PR #143 after exact-head CI, Database parity, Browser E2E and preview smoke are green.

### Stage 4B — Richer H2H, rank-over-time and bracket health: complete

Delivered through PR #145 and contract 48 (production-released 28 July 2026 —
see `docs/quality/investigations/2026-07-28-contract-48-production-release.md`):

1. bounded post-lock co-member rank-history read (`get_h2h_rank_history`), with browser direct-table access to `rank_history` revoked;
2. accessible rank-over-time comparison inside H2H with non-visual equivalents;
3. bracket-health metrics from predicted progression, actual advancement and remaining possible points;
4. richer H2H comparison without mixing Original and bonus scores or widening the co-member privacy boundary;
5. loading, empty, retry, error, mobile and accessibility states carried within the batch.

### Later Stage 4 sequence

1. expand Match Centre and tournament states;
2. add account, privacy and contact-admin surfaces;
3. add post-lock trends;
4. complete remaining mobile, empty/error-state and accessibility work alongside each feature rather than as a late cleanup pass.

## Stage 5 — Bonus competitions

Platform first, then each game as a thin ruleset (ADR-0010, accepted 28 July 2026). The pure platform foundation lands ahead of the remaining Stage 4 product work; every user-visible bonus surface still waits until the Original Predictor core experience is proven:

1. **B1 — platform domain (delivered):** `src/domain/competitions/` model and `resolveCompetitionStatus`, the single fourteen-state resolver every bonus surface consumes;
2. **B2 — platform schema (delivered, development only):** contract 49 adds deny-all `bonus_competitions`, `bonus_competition_windows`, `bonus_window_fixtures`, `bonus_competition_entrants`, `bonus_score_events` and `bonus_competition_audit` with RPC-only mutation and pgTAP coverage;
3. **B3 — Games hub (delivered, development only):** contract 50 adds the bounded authenticated hub read plus voluntary registration/withdrawal RPCs with audit and scored-history protection, and the More → Games (`/games`) surface consuming the single state resolver;
4. **B4 — shared knockout prediction store (delivered, development only):** contract 51 collects one knockout scoreline per user per real match — per-kickoff database locks, optimistic versions, entrant gating and the `/games/knockout` form (draws carry a who-goes-through pick, decisive scorelines imply it);
5. **B5 — KO Predictor (delivered, development only):** contract 52 scores the shared store — Exact 5 / Result 3 / Through +2 (`docs/scoring-rules.md` §8) — inside the single advisory-locked result operation, with rolling-entry banking, a bounded server-ranked standings read and the `/games/ko-predictor` surface;
6. **B6 — Last Man Standing (delivered, development only):** contract 53 implements the tournament format (`docs/scoring-rules.md` §8): window-deadline picks, team-once-per-competition, win-to-survive groups / advance-to-survive knockouts, wipeout-void, permanent elimination, with survival fully re-derived inside the single result operation and the `/games/lms` surface;
7. **B7 — Predictor Cup.**

Each mode keeps its own entry, rules, scoring and standings; B5–B7 may never add a second registration, deadline, window or audit mechanism.

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
