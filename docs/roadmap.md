# Euro 2028 Predictor — Roadmap

**Status date:** 29 July 2026  
**Authority:** The only live execution sequence. Use [`quality/current-status.md`](quality/current-status.md) for current facts.

Repository completion and hosted publication are separate. The assessed baseline is contract 60. Hosted Supabase/Netlify status is **REQUIRES OWNER VERIFICATION** unless a verifier/date is recorded.

## Stage 0 — Release and control foundation: repository complete

- branch/PR/CI discipline and deployment-contract guards;
- backup/restore and milestone-release procedures;
- administrator authorisation and protected application routes.

Hosted execution of those procedures requires owner verification.

## Stage 1 — Result and qualification control: repository complete

- result confirm, correct and clear with required review/reasons;
- immutable revisions and regulation/extra-time/penalty handling;
- actual group standings, best-thirds and Round-of-16 population;
- authorised exact-boundary tie resolution and transactional bracket replay;
- authorised/unauthorised desktop and mobile Browser E2E.

## Stage 2 — Full tournament lifecycle: repository complete

- seeded 51-match tournament journey;
- valid/incomplete entries, predicted tables/brackets, lock and submission;
- automatic valid-entry submission using the authoritative validator;
- group and knockout results, corrections, clears and downstream replay;
- scoring recomputation, rank history, champion and revision evidence;
- clean canonical rebuild, pgTAP and authenticated browser reset journeys.

## Stage 3 — Capacity, bounded reads and comparison surfaces: repository complete

- server-ranked keyset pagination for overall and private-league standings;
- independent caller context and bounded owner-transfer search;
- operating-cap enforcement at signup and league creation;
- representative 250-entry and 250-member evidence;
- secure co-member profiles with reveal boundaries;
- resilient own Profile/H2H, authoritative totals, rank history and bracket health.

## Stage 4 — Core product experience: repository complete first cut

- resilient Match Centre states and deterministic fixture switching;
- Predict hero/journey map, completion and forward stage flow;
- truthful Matches list states;
- private Account controls and Contact admin path;
- race-safe pre-lock Original entry clearing;
- automated axe coverage;
- tournament-information tables, bracket and result-derived statistics.

Hosted publication of this cut is **REQUIRES OWNER VERIFICATION**.

## Stage 5 — Bonus competitions: repository complete

ADR-0010 B1–B7c is present in the contract-60 repository:

1. **Platform:** lifecycle resolver, deny-all storage, bounded hub and voluntary registration.
2. **Shared knockout store:** versioned prediction per user/per knockout match with per-kickoff locking.
3. **KO Predictor:** Exact 5 / Result 3 / Through +2.
4. **Last Man Standing:** win/advance to survive, one team once and correction-aware settlement.
5. **Predictor Cup:** groups, qualification, seeding, playoff/byes, fixed bracket, Penalty Numbers and honours.

Contracts 59–60 preserve those rules while removing temporary-table dependencies. Hosted catalogue, registration and production-release state are **REQUIRES OWNER VERIFICATION**.

## Stage 6 — Post-lock product experience: contract-62 candidate, not baseline

PR #193 is open, draft and unmerged. It is deliberately excluded from the contract-60 baseline. Exact head `901a2bb92b74979283491e5c85d71b01657193a9` passed CI `30456665007`, Database parity `30456665266` and Browser E2E `30456664993`.

### 6A — Consensus and richer My Entry

Candidate implementation includes:

- bounded authenticated post-lock consensus/trends;
- richer locked My Entry state;
- loading, empty, error, desktop and phone coverage.

**Privacy gate:** migration 61 has no minimum cohort threshold; one submitted entry can produce aggregate output. Resolve or explicitly accept `PRIV-001` before merge.

### 6B — Final standings activation

`DEC-003` is resolved for the candidate:

- live standings remain points/shared-rank based;
- final ordering activates automatically only after every tournament match is confirmed/corrected;
- equal points are separated by exact scores, correct outcomes, correct knockout teams, correct champion and closest group-stage goals total;
- overall and private-league standings use the same order;
- Original and Bonus Games standings remain separate.

This is not contract-60 behaviour until PR #193 is merged.

### 6C — Remaining product-state completion

- finish secondary comparison/loading/error states;
- manual keyboard/screen-reader/contrast review;
- deferred Matches slices: Predicted/Live switcher, mid-groups bracket projection and feed-gated top scorers.

## Stage 7 — Baseline and repository control

1. Complete PR #195's contract-60 tag-readiness reconciliation.
2. Owner verifies development/production Supabase and Netlify contracts/releases with dated evidence.
3. Resolve or accept `PRIV-001` and decide PR #193's disposition.
4. Complete branch cleanup from PR #194.
5. Add a migration-timestamp CI guard; current review found no automatic protection against a new timestamp less than or equal to `main`.

## Stage 8 — Official data and dress rehearsal

- replace provisional teams, fixtures, regulations and lock instant with official sources;
- verify provenance/effective dates and remove provisional labels;
- full time-travel rehearsal from pre-tournament through final/awards;
- complete-volume recomputation, correction and rollback measurement;
- application rollback and backup-restore rehearsal;
- monitoring, backup, Cron and incident ownership.

## Stage 9 — Launch readiness

- Auth/SMTP ownership and reminder reliability;
- final Turnstile and leaked-password decisions;
- official support/administrator ownership;
- branch protection and required-check verification;
- final security, accessibility and phone-first sweep;
- release freeze and exact production dress rehearsal.