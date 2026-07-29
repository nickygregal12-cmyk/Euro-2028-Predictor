# Euro 2028 Predictor — Roadmap

**Status date:** 29 July 2026  
**Authority:** The only live execution sequence. Use `docs/quality/current-status.md` for current facts.

## Stage 0 — Release and control foundation: complete

- branch/PR/CI discipline and deployment-contract guards;
- encrypted production backup and disposable restore rehearsal;
- milestone-only production promotion and exact-head smoke;
- administrator authorisation and protected application routes.

## Stage 1 — Result and qualification control: complete

- result confirm, correct and clear with required review/reasons;
- immutable revisions and regulation/extra-time/penalty handling;
- actual group standings, best-thirds and Round-of-16 population;
- authorised exact-boundary tie resolution and transactional bracket replay;
- authorised/unauthorised desktop and mobile Browser E2E.

## Stage 2 — Full tournament lifecycle: complete

- seeded complete 51-match tournament journey;
- valid/incomplete entries, predicted tables/brackets, lock and submission;
- automatic valid-entry submission at lock using the authoritative validator;
- all group and knockout results, corrections, clears and downstream replay;
- scoring recomputation, rank history, champion and revision evidence;
- clean canonical rebuild, pgTAP and authenticated browser reset journeys.

## Stage 3 — Capacity, bounded reads and comparison surfaces: complete

- server-ranked keyset pagination for overall and private-league standings;
- independent caller context and bounded owner transfer search;
- operating-cap enforcement at signup and league creation;
- representative 250-entry and 250-member evidence;
- secure co-member profiles with pre/post-lock reveal boundaries;
- resilient own Profile/H2H, authoritative totals, rank history and bracket health.

## Stage 4 — Core product experience: complete first production cut

Delivered through PRs #162, #165–#178:

- resilient Match Centre states and deterministic fixture switching;
- Predict hero/journey map, 51-pick completion and always-forward stage flow;
- truthful Matches list states;
- private Account page for display name, password, email, reminders and sign-out;
- privacy/reveal explanation and configuration-driven Contact admin;
- race-safe pre-lock Original entry clearing that preserves accounts, leagues and Bonus Games;
- automated axe WCAG 2.2 AA coverage across key desktop/phone routes;
- Matches tournament-information sub-views for group tables, best thirds, authoritative knockout bracket and result-derived statistics.

Exit met for the first production cut: the principal prediction, match, profile, comparison, Account and tournament-information journeys are implemented, resilient and production-aligned at contract 60.

## Stage 5 — Bonus competitions: complete

ADR-0010 B1–B7c is delivered and production-aligned:

1. **Platform:** single competition lifecycle resolver, deny-all storage, bounded hub, voluntary registration/withdrawal and audit.
2. **Shared knockout store:** one versioned prediction per user/per knockout match with per-kickoff locking.
3. **KO Predictor:** Exact 5 / Result 3 / Through +2, rolling-entry banking and server-ranked standings.
4. **Last Man Standing:** win/advance to survive, one team once, deadline locking, correction re-derivation and wipeout voiding.
5. **Predictor Cup:** deterministic groups, regulation-time scoring, complete §5.2 qualification, wildcards, banded seeding, playoff/byes, fixed bracket, parity-laned Penalty Numbers, points/AET/penalty/walkover settlement, champion and Golden Predictor.

Contracts 59–60 preserve those rules while removing the two temporary-table implementation dependencies so hosted database lint is clean.

## Stage 6 — Post-lock product experience: current

### 6A — Consensus and richer My-entry state

- post-lock prediction consensus/trends;
- clearer My-entry hero and reveal state;
- movement/impact explanations without exposing pre-lock picks;
- loading, empty, partial and retry states on desktop and phone.

### 6B — Final standings activation

- wire `calculateLeagueRank` into final authoritative standings;
- expose the applied tie-break criteria in the UI;
- prove deterministic final ranking under all equal-points cases;
- keep Original and Bonus Games standings separate.

### 6C — Remaining product-state completion

- finish secondary comparison/loading/error states;
- manual keyboard/screen-reader/contrast review alongside automated axe;
- deferred Matches slices: Predicted/Live table switcher, mid-groups bracket projection and feed-gated top scorers.

## Stage 7 — Official data and dress rehearsal

- replace provisional teams, fixtures, regulations and lock instant with official sources;
- verify source provenance/effective dates and remove provisional labels;
- full time-travel rehearsal from pre-tournament through final/awards;
- complete-volume recomputation, correction and rollback measurement;
- application rollback rehearsal and current production backup restore repeat;
- monitoring, backup, Cron and incident ownership.

## Stage 8 — Launch readiness

- Auth/SMTP ownership and reminder-delivery reliability;
- final Turnstile and leaked-password decisions;
- official support/administrator ownership;
- branch protection and required-check verification;
- final security, accessibility and phone-first product sweep;
- release freeze and exact production dress rehearsal.
