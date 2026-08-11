# Current feature and safeguard baseline

**Baseline reconciliation date:** 5 August 2026  
**Historical contract-60 audit:** [`audits/2026-07-29-contract-60-full-documentation-audit.md`](audits/2026-07-29-contract-60-full-documentation-audit.md)  
**Historical contract-60 production release:** [`investigations/2026-07-29-contract60-production-promotion.md`](investigations/2026-07-29-contract60-production-promotion.md)  
**Current implementation and hosted state:** [`current-status.md`](current-status.md)  
**Identifier repair:** [`reconciliations/2026-07-24-feature-baseline-identifiers.md`](reconciliations/2026-07-24-feature-baseline-identifiers.md)

> Every compact current row has one primary identifier. Archived identifiers remain reserved in the continuity register. Current code, migrations, executable tests and verified hosted evidence override older wording.

## Classification rules

- **Implemented and production-hosted:** working capability verified in the published Euro production baseline. This classification is about the capability, not a claim that production has every later platform contract.
- **Implemented and development-hosted; production pending:** working capability present in the repository/development path but not promoted to production.
- **Implemented in repository; hosted state delegated:** working code exists, while the exact environment publication state is intentionally read from `current-status.md` rather than copied here.
- **Implemented with evidence gap:** hosted capability exists but a required browser, accessibility or operational journey remains incomplete.
- **Partial:** meaningful implementation exists but a required layer, route or journey is absent.
- **UI prototype only:** presentation exists without an authoritative data path.
- **Documented/planned:** intent exists without working implementation.
- **Not present:** no current implementation evidence.

Repository, development, production and Netlify contract values move independently. This baseline does not restate them. [`current-status.md`](current-status.md) and the machine contract records decide exact hosted state; the fixed `euro-2028-baseline` tag remains the recoverable contract-63 tournament anchor.

## Platform backend overlay — not yet compact user features

The stable compact rows below preserve the established feature/safeguard identifiers. Since that identifier set was created, the repository has also delivered substantial platform backend foundations that are not yet complete user-facing features and therefore do not receive speculative `FEAT-*` IDs here:

- competition-season identity, per-game availability/membership and game-owned lock policies;
- season Match Predictor fixtures, cards, Jokers, lock processing, recurring scheduling, replay-safe reassignment, scoring, stored matchweek totals and bounded standings;
- season Last Man Standing setup, eligibility, deterministic auto-assignment, used-team cycles, selection writes, correction-aware settlement and entrant-state replay;
- competition-neutral Predictor Championship/Cup points and settlement sources, circle-method scheduling rules, persisted split phases, one-parent ancestry and derived continuing standings;
- server-only provider-response custody with archive-before-processing evidence and no authority to write official competition truth;
- the Contract 110 season Championship round calendar, which schedules a competition over the next eligible league matchweeks and refuses a season that cannot supply its whole format, and the Contract 111 launch driver that draws the field and places its round-robin fixtures on those rounds;
- the Contract 116 season Last Man Standing round read: the caller's own round with its fixtures from `season_fixtures`, the pick and its version, and the survival verdict from the settlement authority — closing the read half of the gap contract 86 fixed on the write side;
- the Contract 119 rescheduled-fixture lock: Contract 119 makes a rescheduled fixture lock at its own kickoff. Contract 117 let a provider move a kickoff automatically and the lock did not follow, so a fixture postponed to the following Wednesday still locked on Saturday. Only a rescheduled fixture is affected — the owner chose that reading over the universal per-fixture one, which shares the same arithmetic but would make an ordinary matchweek predictable in stages. "Moved" is contract 117's revision record, a stored fact rather than an inference, and the rule is strictly permissive: it can extend an editing window, never shorten one;
- the Contract 120 Championship phase read: contract 102 persists the Predictor Championship split as a distinct phase and contract 105 derives the continuing table for it, but nothing browser-reachable could see either — measured on hosted development, zero functions `authenticated` may execute read `cup_split_group_tables`, `parent_group_id` or `cup_final_group_tables`. `get_season_cup_phase` returns the caller's own phase and their own group's table from whichever authority owns that phase, adding no rule and recomputing nothing. Fifth instance of the defect behind contracts 86, 98, 116 and 118; Contract 121 adds the season play-context read — which season a URL means and which matchweek its card opens at — which is what lets that surface be registered on a production route. Contract 122 makes ADR 0012's two retention tables answerable: the monthly table, whose month comes from a round's `window_opens_at` read in the competition's own timezone, and rolling form, which needs only round ordinal. Contract 123 keeps that window fresh: contract 117 moves the kickoffs contract 113's stored span is derived from, and a refresh whose proposed span would overlap another round's window leaves the old window intact and queues a row for review rather than raising, which is what stops a derived view's recomputation being able to fail a provider import. Contract 124 then makes the Championship split actually happen — the phase-transition driver contracts 102, 105 and 120 were all waiting on, reading its plan from the launch record, carrying points and draw numbers, eliminating nobody, and letting the smaller half finish its round-robin early rather than giving it a calendar of its own. Contract 125 then closes the one that was holding all of them: a season fixture could not be given a result at all, so nothing downstream of a result had anything to show. Contract 126 then narrows a refusal that was firing too early: leaving a Last Man Standing competition blocked re-entry from the moment it was published, when ADR 0013 closes entry only once the first round locks. Both are derived views and neither touches the canonical total. Contract 127 then opens a season competition for play at all: measured, both season Last Man Standing competitions hold no round and no setup row, and both season Championships hold no group because contract 111's launch driver has never had a caller — so an administrator call writes the public Classic setup ADR 0022 pins, generates a first instance's calendar from the same derivation contract 109 uses for a successor, and hands the Championship to contract 111 unchanged. It is an operator action rather than a job, because the launch fixes the draw at whatever field size it finds. Contract 128 then gives a season league a standings table of its own: `get_league_members` derives every metric from `standing_metrics`, `score_events`, `matches` and `match_predictions`, which a competition season writes none of, so a league on a season returned every member on zero in alphabetical order with no error — the sixth instance of that shape. It is a new read rather than a widened one, because ADR 0012 ranks a season on cumulative points and pairs the total with matchweeks played while the tournament table carries five approved final tie-breakers; the totals come from `season_standings` so a league cannot disagree with the season, the rank is recomputed inside the league because a private league is its own table, and the tournament read now refuses a season league by naming the one that answers. Contract 129 then gives a season a head-to-head at all — `get_rival_entry` reads `entry_totals`, `match_predictions` over `public.matches` and `predicted_progression`, none of which a competition season writes — and its reveal boundary is the MATCHWEEK's own lock rather than the one tournament instant, hiding rather than revealing when a round's kickoffs are incomplete. Contract 130 adds the prediction consensus keyed on the round for the same reason, reusing contract 61's minimum cohort of ten but counting the entries that predicted THAT matchweek, since a season with fifty entrants of whom six played matchweek 30 is exactly what the protection exists for. Contract 131 makes contract 122's retention tables able to name their players, optionally and off by default, adding the flag as a required fourth parameter and retiring the three-argument form by revoking rather than dropping it, and mapping over what the parity-checked authorities returned so their order and their agreement with `standings.ts` are untouched.
- the Contract 117 provider fixture revision import: Contract 117 is the repeatable path a provider kickoff change takes to the fixture: it revises an existing fixture's kickoff, creates none, deletes none and never writes `competition_round_id` — the owner amendment made executable. It fails closed on the whole payload when any identifier is unmapped, refuses a kickoff moved into the past or a fixture no longer scheduled, and records every move append-only as an administrator's review queue;
- the Contract 115 provider poll dispatch: `pg_net` installed, no browser-reachable function in an exposed schema permitted to call into `net` (pg_net's own grants belong to whoever owns the extension, and where the platform owns it `postgres` cannot revoke them), and the deployed `provider-poll` Edge Function driven from `pg_cron` at each target's declared cadence. It records no poll target and imports no fixture, so it is behaviour-neutral until an operator supplies two vault secrets and a target;
- the Contract 113 round play window and the Contract 114 bounded season-card browser path (the matchweek card read and its three own-entry writes, every rule enforced by the triggers that already own it) on `competition_rounds`, derived from the fixtures a round is played over, held disjoint per competition season by a trigger whose bounds are inclusive at both ends — so windows that merely touch are refused, and an ambiguous reassignment destination cannot arise from stored data;
- the Contract 112 provider identity map, which relates a provider's season, round and team identifiers to this platform's rows and refuses — through composite foreign keys rather than convention — to map a club onto a competition season it does not belong to. It resolves and reports gaps; it imports nothing;
- repeatable competition instances, explicit live/current resolution, correction-safe rederivation after completion and the complete Contract 107–109 LMS wipeout restart lifecycle: linked successor creation without copied selections/cycles/projections/windows, a past-window guard, and an idempotent scheduler that derives the first eligible future league matchweek from the established lock authority.

The Championship phase driver, bounded browser reads and season product surfaces remain partial/planned work in the roadmap. Backend presence must not be reclassified as a completed user journey. When a surface becomes a real supported capability, add one reviewed primary identifier and update the executable identifier-count guard in the same change.

## Original Predictor and core application

| ID | Capability | Current classification | Evidence boundary |
| --- | --- | --- | --- |
| `FEAT-001` | Authentication, signup/login, password recovery, moderation and sign-out | Implemented and production-hosted | Auth routes/Supabase and recovery delivery exist; Turnstile integration remains opt-in, the production build does not require its key, and the six-character password floor remains tracked under `ACQ-R09` |
| `FEAT-006` | First-use welcome gate | Implemented and production-hosted | `/welcome`, `welcomed_at`, Browser E2E |
| `FEAT-009` | Group score prediction | Implemented and production-hosted | Predictor UI and protected prediction boundary |
| `FEAT-015` | Joker selection | Implemented and production-hosted | UI, database guard and scoring config |
| `FEAT-010` | Predicted group table | Implemented and production-hosted | Domain logic, server-derived positions and parity |
| `FEAT-045` | Recursive head-to-head predicted ordering | Implemented and production-hosted | SQL resolver and TypeScript parity |
| `FEAT-012` | Manual predicted same-group tie resolution | Implemented and production-hosted | Replay/validation and stored decisions |
| `FEAT-013` | Best-third ranking/manual boundary resolution | Implemented and production-hosted | Exact-set decisions and actual qualification control |
| `FEAT-014` | Winner-only Original bracket | Implemented and production-hosted | Atomic persistence and full-tree replay |
| `FEAT-046` | Atomic complete-bracket replacement | Implemented and production-hosted | Protected RPC and conflict boundary |
| `FEAT-016` | Golden Boot selection | Implemented and production-hosted | Prediction data/UI; official squad data remains future |
| `FEAT-017` | Derived group-stage goals | Implemented and production-hosted | Derived from 36 group scores |
| `FEAT-018` | Review and manual submission | Implemented and production-hosted | RPC-only submission boundary |
| `FEAT-047` | Pending-write settlement before submit | Implemented and production-hosted | Browser coverage and smoke |
| `FEAT-048` | Persisted score and entry clearing | Implemented and production-hosted | Version-safe clearing plus contract-58 non-resurrection |
| `FEAT-020` | Automatic valid-entry submission at lock | Implemented and production-hosted | Database-scheduled processor, immutable outcomes and owner status |
| `FEAT-041` | Deadline reminder emails | Documented/planned | Preference exists; no scheduled one-hour in-app/email reminder authority exists yet |

## Competition integrity safeguards

| ID | Safeguard | Current classification | Current position |
| --- | --- | --- | --- |
| `SAFE-007` | RPC-only submission | Implemented and production-hosted | Direct browser entry mutation denied |
| `SAFE-045` | Server-derived predicted positions | Implemented and production-hosted | Derived/protected rows |
| `SAFE-008` | Same-tournament and authoritative reference guards | Implemented and production-hosted | Six relationship groups plus later Bonus Games boundaries |
| `SAFE-006` | Lock-time write rejection | Implemented and production-hosted | Browser and database coverage |
| `SAFE-009` | Full predicted bracket replay | Implemented and production-hosted | Validation/submission replay |
| `SAFE-046` | Optimistic bracket conflict detection | Implemented and production-hosted | Atomic expected-version boundary |
| `SAFE-047` | Save-settlement submission barrier | Implemented and production-hosted | Submission-settlement proof |
| `SAFE-048` | Version-safe prediction deletion | Implemented and production-hosted | Stale writes cannot recreate a cleared entry |
| `SAFE-049` | Derived-position invalidation after clear | Implemented and production-hosted | Trigger path hosted |
| `SAFE-050` | Authoritative result method/winner | Implemented and production-hosted | Regulation, extra time and penalties consumed by product UI |
| `SAFE-051` | Immutable result revision history | Implemented and production-hosted | Direct-access denial and verifier |
| `SAFE-052` | Real knockout winner propagation | Implemented and production-hosted | Transactional replay and played-fixture protection |
| `SAFE-010` | Serialized score recomputation | Implemented with environment split | Production baseline serializes Original scoring; later repository/development contracts extend the same transaction lock to Bonus rederivation |
| `SAFE-053` | Exact function execution allowlists | Implemented and production-hosted | Zero anonymous application execution; service-only internals |
| `SAFE-013` | Production/development isolation | Implemented and hosted | Separate Supabase targets are enforced; Netlify context values were independently read on 5 August 2026 and moving declarations remain in current status |
| `SAFE-054` | Application/schema compatibility gate | Implemented and actively enforcing | Each context is checked against its own declared database contract; exact values are target-specific and live in operations/current status |
| `SAFE-056` | Bonus Games catalogue visibility fallback | Implemented in current release batch | Canonical cards remain visible even if hosted catalogue rows are absent |

Safe error mapping and redacting client-error capture remain governed by preserved `SAFE-039`.

## Leagues, social and viewing

| ID | Capability | Current classification | Notes |
| --- | --- | --- | --- |
| `FEAT-027` | Overall standings | Implemented and production-hosted | Server-ranked keyset pagination and current-user context |
| `FEAT-028` | Private league lifecycle | Implemented and production-hosted | Bounded standings and transfer search; abuse review remains |
| `FEAT-029` | Invite deep links | Implemented and production-hosted | Pre-auth invite context remains partial |
| `FEAT-049` | League detail/member rows | Implemented and production-hosted | Secure profile and H2H destinations |
| `FEAT-031` | H2H comparison | Implemented and production-hosted | Authoritative totals, rank history and bracket health |
| `FEAT-035` | Own profile/points breakdown | Implemented and production-hosted | `/profile` with resilient reload/retry |
| `FEAT-036` | Other-player full profile | Implemented and production-hosted | Pre-lock ownership remains private; frozen Euro entry/profile reveal is authenticated post-lock, while league-context pick reads remain league-scoped |
| `FEAT-032` | Match list, Match Centre and tournament information | Implemented and production-hosted | Fixtures, tables, bracket, stats and authoritative result detail |
| `FEAT-050` | Post-lock trends | Implemented in repository; hosted state delegated | Consensus/trends route exists with suppression, loading/error states and player-name fallback; exact publication follows current status |

## Administration, accessibility, assurance and operations

| ID | Capability/safeguard | Classification | Notes |
| --- | --- | --- | --- |
| `FEAT-040` | Result confirm/correct/clear server functions | Implemented and production-hosted | Authoritative wrappers and immutable revisions |
| `FEAT-039` | Browser result and qualification administration | Implemented and production-hosted | Protected desktop/mobile workflows and capability checks |
| `SAFE-032` | Administrator bootstrap/authorization | Implemented with operational follow-up | Owner-controlled `app_metadata` capability assigned; custody remains operational |
| `SAFE-012` | Fake clock/simulation isolation | Partial development capability | Full dress rehearsal remains |
| `SAFE-025` | Application CI | Implemented | Build, lint, tests and production dependency audit |
| `SAFE-026` | Disposable database integration CI | Implemented | Zero-to-current migration rebuild, database lint, complete pgTAP chain, transition rehearsals and differential parity |
| `SAFE-055` | Provider submission/clear regression tests | Implemented | Unit, database and browser coverage |
| `SAFE-027` | Browser E2E and hosted preview smoke | Implemented | Auth, lifecycle, admin, profiles, capacity and accessibility journeys |
| `FEAT-042` | Monitoring and alerting | Partial hosted capability | Sentry delivery verified; ownership, retention/escalation and rollback rehearsal remain |
| `SAFE-033` | Verified backup/restore | Implemented and accepted | Encrypted artifact and disposable restore proof |
| `SAFE-031` | Safe application rollback | Procedure implemented; hosted rehearsal pending | Final rollback rehearsal remains |
| `SAFE-029` | Contract-gated production deploy | Implemented | Production fails closed on contract mismatch; exact published release identity and target contract remain in current status/release evidence |

Automated axe scanning, route titles, live announcements, main focus and skip navigation exist. Manual keyboard, screen-reader and contrast review remains open.

## Bonus competition scope

| ID | Competition/capability | Classification | Evidence boundary |
| --- | --- | --- | --- |
| `FEAT-051` | Bonus Games hub and voluntary entry | Implemented and production-hosted | `/games`, contract-50 RPCs, More navigation and resilient catalogue cards |
| `FEAT-052` | KO Predictor | Implemented and production-hosted | Shared knockout store, per-kickoff locks, 5/3/+2 scoring and standings |
| `FEAT-053` | Last Man Standing | Implemented and production-hosted | One-use teams, round locks, correction-aware settlement and survivor view |
| `FEAT-054` | Predictor Cup | Implemented and production-hosted | Draw, groups, qualification, playoff/byes, knockouts, Penalty Numbers and honours |
| `PLAN-008` | Sweepstake builder | Future/non-launch-blocking | No current implementation |
| `PLAN-004` | Fan Duels separate mode | Legacy/superseded by Predictor Cup | Direct challenge remains parked |

The production catalogue is operational reference data rather than a schema contract. The repeatable publication source is `scripts/bonus-games/publish-catalogue.sql`; it creates no entrants, predictions, draws, scores or results.

## Identifier continuity and archived dispositions

Archived source: [`history/feature-baseline-2026-07-23R.md`](history/feature-baseline-2026-07-23R.md).

| Archived ID(s) | Disposition |
| --- | --- |
| `FEAT-001` | Primary consolidated authentication/account ID |
| `FEAT-002`, `FEAT-003`, `FEAT-004`, `FEAT-005`, `FEAT-044` | Consolidated into `FEAT-001`; reserved |
| `FEAT-006` | Primary current row |
| `FEAT-007` | Theme switching preserved |
| `FEAT-008` | Tournament reference loading preserved |
| `FEAT-009`, `FEAT-010`, `FEAT-012`, `FEAT-013`, `FEAT-014`, `FEAT-015`, `FEAT-016`, `FEAT-017`, `FEAT-020`, `FEAT-027`, `FEAT-029`, `FEAT-031`, `FEAT-035`, `FEAT-036`, `FEAT-039`, `FEAT-040`, `FEAT-041`, `FEAT-042` | Retained as primary rows |
| `FEAT-011` | Consolidated into `SAFE-045` |
| `FEAT-018`, `FEAT-019` | Consolidated into `FEAT-018` |
| `FEAT-021` | Consolidated into `SAFE-006` |
| `FEAT-022`, `FEAT-023`, `FEAT-024`, `FEAT-025`, `FEAT-026` | Preserved scoring capabilities under `SAFE-034` |
| `FEAT-028`, `FEAT-030` | Consolidated into `FEAT-028` |
| `FEAT-032`, `FEAT-033` | Consolidated into `FEAT-032` |
| `FEAT-034` | Home dashboard preserved |
| `FEAT-037` | Share-card preserved |
| `FEAT-038` | Scoring explanation preserved |
| `FEAT-043` | Public marketing landing not approved/present |
| `PLAN-001`, `PLAN-005` | Superseded by `FEAT-051` |
| `PLAN-002` | Superseded by `FEAT-053` |
| `PLAN-003` | Superseded by `FEAT-054` |
| `PLAN-006` | Superseded by `FEAT-052` shared knockout store |
| `PLAN-007` | Abandoned by ADR-0010 dedicated Bonus Games tables |
| `PLAN-004`, `PLAN-008` | Retained current rows |
| `SAFE-001`, `SAFE-002`, `SAFE-003`, `SAFE-004` | Domain, splitting, service and RLS safeguards preserved |
| `SAFE-005` | Search-path safeguard; exact allowlists use `SAFE-053` |
| `SAFE-006`, `SAFE-007`, `SAFE-008`, `SAFE-009`, `SAFE-010`, `SAFE-012`, `SAFE-013`, `SAFE-025`, `SAFE-026`, `SAFE-027`, `SAFE-029`, `SAFE-031`, `SAFE-032`, `SAFE-033` | Retained primary rows |
| `SAFE-011` | Development-autologin safeguard preserved |
| `SAFE-014`, `SAFE-015`, `SAFE-016`, `SAFE-017` | Security/privacy/migration safeguards preserved |
| `SAFE-018` | Optimistic-save safeguard; strengthened by `SAFE-046`–`SAFE-048` |
| `SAFE-019`, `SAFE-020`, `SAFE-021`, `SAFE-022`, `SAFE-023`, `SAFE-024` | Accessibility/state/refresh/type safeguards preserved |
| `SAFE-028`, `SAFE-030` | Mobile and secret-scan safeguards preserved |
| `SAFE-034` | Deterministic scoring safeguard preserved |
| `SAFE-035` | Consolidated private-league lifecycle; confirmations remain mandatory |
| `SAFE-036` | Competition separation preserved |
| `SAFE-037`, `SAFE-038`, `SAFE-039`, `SAFE-040` | Entry/docs/safe-error/rate-limit safeguards preserved |
| `SAFE-041`, `SAFE-042`, `SAFE-043`, `SAFE-044` | Runtime/navigation/score-bound/release safeguards preserved |

## New identifier register

| ID | Capability/safeguard |
| --- | --- |
| `FEAT-045` | Recursive H2H predicted ordering |
| `FEAT-046` | Atomic complete-bracket replacement |
| `FEAT-047` | Submission settlement |
| `FEAT-048` | Persisted score/entry clearing |
| `FEAT-049` | League detail/member rows |
| `FEAT-050` | Post-lock trends |
| `FEAT-051` | Bonus Games hub and voluntary entry |
| `FEAT-052` | KO Predictor and shared knockout store |
| `FEAT-053` | Last Man Standing |
| `FEAT-054` | Predictor Cup |
| `SAFE-045` | Server-derived positions |
| `SAFE-046` | Bracket conflict detection |
| `SAFE-047` | Submission settlement barrier |
| `SAFE-048` | Version-safe, non-resurrecting deletion |
| `SAFE-049` | Position invalidation after clear |
| `SAFE-050` | Authoritative result method/winner |
| `SAFE-051` | Immutable revisions |
| `SAFE-052` | Real winner propagation |
| `SAFE-053` | Exact function allowlists |
| `SAFE-054` | App/schema compatibility gate |
| `SAFE-055` | Submission/clear regression tests |
| `SAFE-056` | Bonus Games catalogue visibility fallback |

## Accepted requirements that are not features yet

This baseline classifies **capabilities that exist**, on the `FEAT-*`/`PLAN-*`/`SAFE-*` identifiers its continuity register protects. A decision that has been accepted and never built has no capability to classify, so it gets no speculative identifier here — which is exactly how such requirements went missing before.

They live in [`accepted-requirements.md`](accepted-requirements.md), on their own identifier space (`SITE-*`, `ACCOUNT-*`, `EURO-*`, `AGE-*`, `PRIV-*`, `INGEST-*`, `CAP-*`), each with its owning decision, dependency and acceptance evidence. A row moves from that register into this baseline when it becomes a working capability with evidence — not before, and not by being deleted from either file.

One of them contradicts a current surface rather than merely being absent: `EURO-001` records that the weekly Hub still lists Euro 2028 while its publication state should be hidden.

## Current route and data baseline

The application contains authenticated Original Predictor, league, H2H, match, profile, Account, Trends, Bonus Games and protected administrator routes plus a real catch-all. Development-only routes remain gated. This document is not the exhaustive route manifest and does not copy migration or Netlify contract counts; executable route coverage and [`current-status.md`](current-status.md) decide those facts.

The historical Bonus Games compatibility routes remain available while the accepted Hub information architecture is adopted. Hosted catalogue publication is operational reference data, not schema authority, and must never create synthetic entrants, predictions, draws, scores or result history. The season backend overlay above has no complete public product surface yet.

## Safeguard regression rules

Do not silently:

- weaken locks, ownership, same-tournament, version or submission checks;
- re-enable direct browser writes to server-owned inputs;
- bypass RPCs, settlement or expected-version deletion;
- accept impossible brackets;
- infer penalty winners from tied public scores;
- mix Original/bonus points, one game's standings with another's, or predicted/real brackets;
- treat a backend authority as a completed or production-hosted surface without journey evidence;
- describe the Contract 109 successor scheduler as absent, or treat Contract 108's past-window guard as the scheduler;
- let a provider response become official fixture/result/scoring truth;
- copy Championship carried points into a second stored starting total;
- resolve correction-time rederivation through a live-only competition lookup after completion;
- remove a canonical Bonus Game because hosted catalogue data is absent;
- cross Supabase/Netlify environments or use the legacy World Cup site;
- deploy against an unverified database contract;
- omit target contract or release identity from smoke commands;
- disable or misdescribe approved Sentry production delivery;
- expose sensitive observability data;
- change scoring without rules/TypeScript/SQL/tests;
- describe roadmap or gallery content as implemented without code evidence;
- treat an unrestored backup as recovery proof.

**Contract 118** gives the games hub neutral window fixture facts, so a season competition's card advances instead of sticking on its first locked round.

## Contract 132 baseline

The domestic-season baseline now includes staged initial provider fixture proposals and explicit administrator approval/rejection. Initial Scottish publication is constrained to 12 teams, 33 pre-split rounds and 198 fixtures; Premier League publication is constrained to 20 teams, 38 rounds and 380 fixtures. Created fixtures remain scheduled with null official scores until the separate protected result-confirmation authority is used.

> **Contract 133 boundary (8 August 2026):** Contract 133 closes the server-read prerequisite for the private season Predictor Championship UI: an entrant can discover their own private instance and read the server-owned current group, opponent, table and fixture schedule without direct private-table grants.

> **Contract 152 boundary (10 August 2026):** Contract 152 closes the three parts of `SEC-001` that contract 145 did not. Invite codes are drawn from pgcrypto's CSPRNG with rejection sampling rather than from `random()`, and are twelve characters rather than six — `byte % 31` is not uniform, since 256 = 8*31 + 8 hands the first eight characters of the alphabet a 12.5% edge on every character, and a biased code looks exactly as random as an unbiased one. `get_league_preview` returns the league name and whether the caller is already a member, and no longer the member count or the owner's display name: those are what turned a guessed code into a positively identified private group, and disclosed a real person's name to whoever guessed. Both the preview and the join charge a new `league_invite_probe` limiter **before** they look a code up, so a wrong guess costs what a right one does — the existing 5/min membership ceiling is a trigger on `league_members`, so it fired only on a successful join and limited an attacker on the one action they were not attempting. `rotate_league_invite_code` makes a leaked code recoverable, owner-only, refusing identically for a league that is not yours and one that does not exist so rotation is not itself a probe. **It touches no existing row and changes no membership rule**: codes already issued keep working, and keep their six characters until an owner rotates them. It is repository-only, and its pgTAP suite has not been executed — the authoring environment has no Docker daemon.

> **Contract 151 boundary (10 August 2026):** Contract 151 closes `MIG-UI-02`: one player's season and what they predicted, which blocks domestic player profiles and every player link from a league table or the Match Centre. It takes the disclosure boundary the register recommended and the owner did not vary: identity is visible to **private-league co-members and nobody else** — sharing a competition is not enough, because a season may have fifty thousand entrants and none of them agreed to be looked up, whereas sharing a private league is a mutual act — prediction detail only after **that matchweek's own lock**, the boundary contract 149 established, and **no player directory**: it answers about one named player and cannot enumerate, search or rank the population. A player may always read their own profile including unlocked matchweeks, because those are their own picks. Points are never recomputed; they come from the same banked authorities the season and the leagues use. Exact-score and correct-outcome counts are derived here and are **not** a second scoring authority — counting how often a prediction matched a result is a fact about predictions, no point value appears in the function, and the counts run over settled matchweeks only so a count cannot leak an unlocked prediction.

> **Contract 150 boundary (10 August 2026):** Contract 150 closes `MIG-UI-03`: how a league table moved over one settled matchweek. The gap to a rival is already derivable in the browser because both players are on screen; movement is not, because "5th to 3rd" needs the table as it stood BEFORE the matchweek and history is not on screen. It is **derived, never stored** — `season_matchweek_scores` already holds every banked total with its round, so the before-table is the sum of the rounds ordered before it; a snapshot would add a second thing that can disagree with the first and would need backfilling. Only **settled** matchweeks move anything: `settled_at` is the gate rather than the presence of a row, because a matchweek being scored is one whose totals are still changing and reporting a climb from it would show a player a position they never held. An unsettled matchweek is answered `settled: false` rather than refused. Ordering is by round **ordinal**, never by `settled_at`, so a postponed matchweek that settles late does not appear to come after matchweeks played after it.

> **Contract 149 boundary (10 August 2026):** Contract 149 closes `MIG-UI-01`: what a private league predicted, once the matchweek has locked. The tournament has had `get_league_match_picks` since before a season existed and a season had nothing, so the Match Centre's "Your leagues" section, the mobile per-fixture comparison, the desktop matchweek matrix and every "See league predictions" journey had no read to call — the same shape of gap as contracts 116, 118, 120, 122, 124, 128 and 129. **The reveal boundary is the matchweek's own lock**, resolved server-side from `season_matchweek_lock_at` with no client-supplied time anywhere, because a boundary a caller can pass an argument to is not a boundary. Before the lock it **hides rather than refuses** — a refusal would be indistinguishable from "you may not see this league" — and hides completely: no member rows, not even redacted ones, and a predicted count of zero rather than a leak of who has played. Membership is the boundary rather than game entry, as contract 128 chose, so a member who entered nothing appears with no predictions rather than being dropped. Points come from `season_matchweek_scores` and are null until settled, never recomputed, so a league cannot disagree with the season about what a matchweek was worth.

> **Contract 147–148 boundary (10 August 2026):** Two bounded season reads, closing `MIG-UI-12` and `MIG-UI-11` from the UI finalisation register. Contract 147 is the published weekly catalogue with its **route slug**: publishing a league previously needed a frontend code change for it to exist, because every catalogue read began from a static array and `competitions.slug` is revoked from every browser role by contract 121 — so a frontend could learn a season existed and not learn where it lived. It returns league seasons only, which is an `EURO-001` safety property rather than a filter of convenience: a catalogue enumerating `tournaments` without discriminating on kind would put Euro 2028 on the weekly platform's own discovery surface. Draft seasons are excluded, so Production correctly returns nothing until one is opened. Contract 148 is one season fixture addressed by its own id, a sibling of contract 139 rather than a widening of it, returning contract 139's entry shape field for field so a fixture looks the same whether it arrived from the calendar or from a link — `result` stays null until the fixture is played and a provider opinion stays in `live`. Neither adds a rule, and both are granted to `authenticated` only: making a third function anonymously executable is a publication decision, and this is not where it gets taken.

> **Contract 146 boundary (10 August 2026):** Contract 146 makes the provider poll affordable, and makes its question move. Measured on hosted Development: the one live target polled every five minutes — 288 requests a day — while the next fixture in either league was eleven days away, and it asked for a date range already in the past, so it could never have seen the fixtures it was paid to find. `cadence_minutes` keeps its name and becomes the **idle** cadence, now defaulting to one call a day; `live_cadence_minutes` applies only inside a window that opens `live_lead_minutes` before a kickoff and closes `live_tail_minutes` after it, and only while that fixture still has no result — so contract 135 writing the official result is what ends the expensive polling, rather than anyone deciding it should. A stored path may now carry `{{date:+N}}` placeholders resolved at dispatch in the competition's own timezone, so the window rolls forward on its own. It records no poll target, writes no fixture, result or status, grants nothing new to a browser role, and moves no scoring, lock, settlement, progression or reveal rule.

> **Contract 145 boundary (10 August 2026):** Contract 145 closes the atomicity half of risk-register `DATA-007`. `enforce_rate_limit` counted, compared and then inserted with nothing between the read and the write, so under the read-committed isolation the Data API uses, concurrent transactions for one caller each observed a count below the ceiling and all proceeded — a limit that could be overshot simply by running the attempts in parallel, which a scripted client does and a human never does. It now takes a transaction-scoped advisory lock keyed on the caller before the prune, the count and the insert, the same idiom `20260727191942_operating_cap_enforcement.sql` has always used for the two site-wide counters. One key per caller and never per action, so the function cannot hold two of its own locks and cannot deadlock against itself. It moves **no** relation, policy, trigger, threshold, grant or rule, and changes no scoring, lock, settlement, progression or reveal. It closes the atomicity half **only**: invalid operations still consume no limit, the expensive read RPCs are still unbounded, and there are still no edge/IP controls or alerting — so `DATA-007` stays open, reduced, and `SEC-001` is reduced rather than closed.

> **Contract 144 boundary (9 August 2026):** Contract 144 gives an already-mapped provider team a place to keep its current provider-supplied profile facts — name, short code, founded year, country, venue and image reference — in `predictor_internal.provider_team_profiles`, with a definer writer that derives provider and fetch instant from contract 112's custody row rather than accepting them from its caller, refuses evidence older than the fact it would replace, and advances `last_changed_at` only when a fact actually changed. It is **not** a second identity system: `provider_entity_map` remains the authority for which provider team is which of ours, and the profile row is keyed on that mapping. It is **not** a result path — nothing in it writes a fixture, score, status, lock, settlement or progression, and missing enrichment stays a normal no-data state rather than becoming a game-correctness dependency. The writer is granted to **nobody**, `service_role` included, so the provider poll gains no enrichment side effect merely because storage now exists; a Development backfill is an explicit operator action through its own `workflow_dispatch` job, which refuses unless Development already holds contract 144 and refuses the Production project by name. Provider image URLs are retained for provenance only and establish no right to render or re-host club imagery — the shirt a player sees still comes from contract 136's owner-controlled reference.

> **Contract 143 boundary (9 August 2026):** Contract 143 implements ADR 0026's `EURO-002`: one server-owned Euro 2028 publication state with the lifecycle `hidden -> prelaunch -> registration-open -> live -> completed -> archived`, defaulting to `hidden` so publication fails closed before any owner acts. A bounded `euro_publication_state()` read exposes the state and the instant it last changed and nothing else, and it is the second function an anonymous visitor may execute — deliberately, because ADR 0026 requires the public site and its route guard to fail closed from server truth rather than from a client-side catalogue filter. Mutation is narrower than ordinary competition administration: `admin_transition_euro_publication_state` is granted to `authenticated` only, refuses inside on `super_admin`, advances one adjacent state at a time, and demands both an expected current state and a reason it appends to an immutable history. **It does not publish Euro 2028 and it does not address `EURO-001`** — Euro is still reachable from the weekly platform, which stays a recorded defect. `EURO-003` and `EURO-004` are its consumers and remain unbuilt.

> **Contract 142 boundary (9 August 2026):** Contract 142 maps SportMonks state 22 to `in_play`, measured from retained payloads rather than documentation — the same fixture carried that token with a different score at different times, and a score cannot change after full time. It writes no result and settles nothing: it fixes the live projection for a fixture observed during its second half. It is the first thing contract 135's fail-closed vocabulary and contract 138's review queue found together, and it is the case those two were built for. It adds no feature and moves no rule.

> **Contract 140–141 boundary (9 August 2026):** Contract 140 gives a Leave control the fact it needs to predict itself — `leave_competition_game` refuses once a `bonus_score_events` row exists for the caller and nothing exposed that, so the dashboard could only render a control the server would refuse or hide one that would have worked. Contract 141 derives recent club form and club head-to-head from settled season fixtures alone, which the enrichment plan classes as derive-ourselves work and which contract 135 made possible by producing results at all. Neither reads a prediction, an entry or a score event, and neither costs a provider request. Contract 141 adds club football facts, not a league table: a table carries competition rules this derivation has no authority over.

> **Contract 138–139 boundary (9 August 2026):** Contract 138 gives an administrator the provider review queues nothing could see — measured, seven append-only queues existed and the only browser-reachable functions naming any of them were contract 132's two decision writers, so an administrator could approve a calendar they could not see and could not see the other six at all. It reads all of them bounded per section and lets an administrator acknowledge an item, which contracts 117 and 123 had always anticipated with a `reviewed_at` nothing ever set; acknowledging is never a decision about the item. Contract 139 gives a season a fixtures read at all, ordered by kickoff and labelled by round, closing the ADR 0020 amendment item that had no implementation because a season had no fixture list: a match postponed out of matchweek 5 into November now sorts into November while still saying Matchweek 5. Both are reads; 138 also writes a review marker that decides nothing.

> **Contract 137 boundary (9 August 2026):** Adds no feature. It corrects contract 136's club name
> normaliser so Chelsea and Aston Villa resolve, and adds the Hull City row the real Development field
> needed.

> **Contract 135–136 boundary (9 August 2026):** Contract 135 changes the baseline in one place and one
> only: the official result of a **league-season** fixture may now be written by a measured provider final
> status with no human action, under the owner's ADR 0020 amendment. It is written through the same audited
> writer an administrator uses, it is numbered and attributable, and an administrator's correction ends
> provider authority over that fixture. The tournament baseline is unchanged: Euro 2028 results remain
> confirmable only by a signed-in administrator. Contract 136 adds club codes and colours to the matchweek
> card so `ClubIdentity` renders a club as itself; a club the reference does not name is unchanged.

> **Contract 134 boundary (9 August 2026):** Contract 134 adds no feature. It closes risk-register `DB-005` by revoking `public.rate_limit_events` and its identity sequence from both browser roles, and proves in pgTAP that the limiter still logs, still refuses at its ceiling and still prunes.

> **Contract 161–164 boundary (11 August 2026):** The retention and social batch. Each closes an authority that already existed with nothing able to call it — the same shape as contracts 116, 118, 120, 122, 124, 128 and 129.
>
> **Contract 161** gives a player their own season history. Contract 156 built the permanent Wrapped archive, and `get_season_wrapped` takes a `tournament_id` — so a player could only see a Wrapped for a season they could already NAME, and nothing told them which those were. Discoverability is **participation, not publication**: contract 147's catalogue lists what is PUBLISHED, so a history built on it would lose a player's 2026/27 the day it was archived, which is precisely the failure this read exists to prevent. Participation is any of an `entries` row, a `game_memberships` row in any state — `left` and `disqualified` count, because a season a player left is still a season they played — or a `bonus_competition_entrants` row, **unioned rather than joined** so a player who entered the predictor and no game is not dropped. It takes no player argument and cannot enumerate, so it is not a directory.
>
> **Contract 162** closes `MIG-UI-14`. The register's own audit found the notification CONTENT already derivable and **nothing storing what a player has already seen** — the Hub's "since you were last here" marker is `localStorage` and is explicitly not an authority, which is why the AppBar deliberately carries no bell. The identity is `(user_id, action_key)` with the key derived from what the action IS rather than when it was generated, so regeneration is idempotent by construction and an item read on a phone is the same item on a laptop. It is deliberately **two tables**: the item is the server's statement and is regenerated, the state is the player's and must survive regeneration, and one table could only do one of those — an upsert correcting a moved deadline would also rewrite the read state. A browser gets exactly two commands, both writing state only. `deadline_at` comes from the lock authorities and `completed_at` is a server verdict derived from whether the thing was actually done, so a client can manufacture neither, and dismissing an item is explicitly not completing it.
>
> **Contract 163** makes `profiles.reminder_emails` mean something. It has existed since `20260729070000_account_entry_controls.sql` as "the deadline-reminder opt-out that must exist", and measured across every migration and the one Edge Function, **nothing read it** — so a player who turned reminders off and one who left them on received the same nothing, and the opted-out player had been told a falsehood about what the platform does. This is the ledger and the state machine and **names no provider**: `SITE-007` records the transactional sender as blocked on the brand decision, so choosing one here would pre-empt an open owner decision, and `dry_run` defaults to true at every level so a wired-but-unauthorised sender sends nothing. Three independent controls stop a duplicate send — the unique key on the action, `for update skip locked` in the claim, and the claim being a state transition rather than a read. The preference is enforced at **scheduling**, so an opted-out player has no row at all rather than a row recording why one was not sent.
>
> **Contract 164** gives Last Man Standing the social half contract 116 deliberately withheld. The reveal boundary is **the round's own lock**, resolved server-side from `bonus_competition_windows.locks_at` against the database's clock, with **no client-supplied instant anywhere** — asserted in the migration, because a boundary a caller can pass an argument to is not a boundary. Before the lock it hides rather than refuses, and hides completely: not the club, and not `has_picked` either, since who has already picked is itself information in a game whose clubs are a depleting resource. Field size, eliminations and outcomes are always visible, being settled history from rounds already finished. An eliminated entrant still sees the field, because being knocked out is not being expelled, and a non-entrant is told the competition exists rather than refused.
>
> **All four are additive, all four were executed against a disposable PostgreSQL 16 before commit, and none is applied to any hosted environment.** Their pgTAP suites (`210`–`213`) are written and have **not** been executed.

> **Contract 159–160 boundary (11 August 2026):** Contract 159 closes the half of `SEC-001` contract 158 left open on a **second door**. Measured against 158's own committed text: it recreated `public.resolve_invite_code` to widen its shape check from `{6}` to `{6,16}` and carried neither of its two fixes into it — so the UNIVERSAL invite entry point charged **no limiter at all**, and returned the target's `id`, the `members` count and, for a private competition, an ownership flag. That is a wider and cheaper confirmation oracle than the `get_league_preview` `SEC-001` had just forced narrowed, and it covered the private Last Man Standing and Championship containers contract 158 could not have known about. It now charges the SAME `league_invite_probe` action at the SAME ceiling, before the shape check and before the lookup, so all three doors draw on one budget rather than giving an attacker forty attempts a minute across two functions; `id` and `members` are gone for both container kinds, `id` being removable because both joins take a code. `name`, `season`, `game` and the caller-relative flags stay, because a single entry point that cannot route a code would close `SEC-001` by breaking `MIG-UI-07`.
>
> Contract 160 closes `MIG-UI-13`, the competition's own league table, which the register recorded as "not approximable in the browser". `season_table_rules` holds each SEASON's points values, ordered tie-break keys and promotion/playoff/relegation boundaries, so a historic table keeps the rules it was played under. `season_table_adjustments` holds signed points deductions with a required reason, and only what is already effective moves today's table. **An awarded outcome is stored beside a fixture and never in it**: `season_fixtures.home_score` is what predictions were settled against, so an award written there would silently restate what every player predicted and rescore a settled matchweek months later — the match stands for the players, and the table is adjusted. Head-to-head is a mini-league among the clubs actually tied on every preceding key, ordering is total by construction, and `get_competition_table` is granted to `authenticated` only and refuses any competition that is not a `league_season`, so it cannot become an `EURO-001` discovery surface. It reads no prediction, entry or score event, and it writes no fixture — both asserted at apply time.
>
> **Neither is applied to any hosted environment.** Both are additive and both were executed against a disposable PostgreSQL 16 before commit; their pgTAP suites (`208`, `209`) have **not** been run, because the authoring environment has no Docker daemon.

> **Contract 158 boundary (11 August 2026):** Contract 158 takes the first three things `SEC-001` names. `gen_invite_code` becomes a rejection-sampled CSPRNG over pgcrypto and issues **twelve** characters rather than six, because six drawn from seeded `random()` is a 31^6 space and a keyspace that small is not what protects a private group. `get_league_preview` stops answering any authenticated caller's guess with the league's id, member count and owner's display name — that was a confirmation oracle that turned a guess into a positively identified group complete with a real person's name. Both the preview and the join now charge a `league_invite_probe` limit, because the 5/min membership budget is a trigger on `league_members` and so fired only on a SUCCESSFUL join: an attacker was rate-limited on the one action they were not attempting. `rotate_league_invite_code` makes a leaked code recoverable without deleting the league, and no existing code is rewritten — six-character codes keep working until an owner rotates them. It also widens what contracts 152 to 155 accept: the private-competition and shared-registry code constraints and contract 155's resolver move from `{6}` to `{6,16}`, because those contracts landed after this one was written and would otherwise refuse every code the new generator issues — which would have killed private competition creation outright and looked like a wrong code rather than a broken one. It is **destructive** to `check-migration-additive.mjs`, correctly: `get_league_preview` is dropped and recreated because its return type narrows. So it takes the guarded lane with its backup and rehearsal, never the fast lane.

> **Contract 152–157 boundary (10 August 2026):** Contracts 152 to 157 close the six remaining `MIG-UI` items as one batch — the private container's identity and a single invite-code namespace (152), private Last Man Standing creation, invite and join (153, `MIG-UI-05`), private Predictor Championship creation and launch (154, `MIG-UI-06`), one code entry point resolving either container (155, `MIG-UI-07`), the permanent season Wrapped archive (156, `MIG-UI-08`), and Follow, favourite team, onboarding progress and the pinned rival (157, `MIG-UI-10`/`MIG-UI-09`). Contract 153 also closes a hole it would otherwise have opened: `join_competition_game` never checked `visibility_kind`, so a private competition could have been joined by its id. None is applied to a hosted environment by this note.
