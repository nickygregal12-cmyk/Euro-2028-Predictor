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

### What recent contracts meant for this baseline

**What each contract *is* lives in [`../../CLAUDE.md`](../../CLAUDE.md).** This table records only
the consequence for the feature and safeguard baseline, which is the question this document exists to
answer. A contract with no consequence here is **absent rather than restated** —
until 11 August 2026 all eighteen were restated in full, byte-identical to
CLAUDE.md and to five other documents, and the copy was the whole reason the
same paragraph existed in seven places at once.

| Contract | Effect on the baseline |
| --- | --- |
| 133 | Closes the server-read prerequisite for the private season Championship UI: an entrant can discover their own private instance and read the server-owned group, opponent, table and fixture schedule without direct private-table grants |
| 134 | **Adds no feature.** It closes risk-register `DB-005` by revoking `public.rate_limit_events` and its identity sequence from both browser roles, and proves in pgTAP that the limiter still logs, still refuses at its ceiling and still prunes |
| 135–136 | **Changes the baseline in one place and one only**: the official result of a **league-season** fixture may now be written by a measured provider final status with no human action, under the owner's ADR 0020 amendment. It goes through the same audited writer an administrator uses, it is numbered and attributable, and an administrator's correction ends provider authority over that fixture. **The tournament baseline is unchanged** — Euro 2028 results remain confirmable only by a signed-in administrator. Contract 136 adds club codes and colours; a club the reference does not name is unchanged |
| 137 | **Adds no feature.** It corrects contract 136's club name normaliser so Chelsea and Aston Villa resolve, and adds the Hull City row the real Development field needed |
| 138–139 | Both are reads. Contract 138 also writes a review marker that **decides nothing** |
| 140–141 | Contract 141 adds **club football facts, not a league table** — a table carries competition rules this derivation has no authority over |
| 142 | **Adds no feature and moves no rule** |

| 159 | Closes the last of `SEC-001`: the universal invite resolver charged no limit and returned a member count |
| 160 | Adds the **domestic league table** — competition rules, deductions and awarded outcomes — which contract 141's form derivation explicitly was not |
| 161–164 | Season history discovery, the action centre's read state, the provider-neutral reminder ledger, and the Last Man Standing field behind its round's own lock |
| 165–168 | Organiser reads that disclose no selection; the multi-group Championship draw and its reader; the administration inspection reads |
| 169 | The season Championship initial group table, measured over the matchdays actually played rather than the tournament's three |
| 170 | The matchweek prediction action, completing on the card rather than on a prediction existing |
| 171 | Deterministic, self-declaring caps on the two league prediction reads |
| 172 | The `pg_cron` schedule for action generation, reminder scheduling and stall reclamation, plus a competition-administrator health read. **Scheduling only — nothing sends** |
| 173 | The settled-matchweek recap action, expiring seven days after settlement and carrying no deadline, so it never becomes a reminder |
| 174 | Staged provider calendar changes — discovered, postponed, abandoned, cancelled, withdrawn — with an administrator decision that is the only thing able to change a fixture |
| 175 | A read-only projection of a matchweek under the current or one hypothetical goal, through the existing scoring authority. Never banked, never official |
| 176 | Deterministic per-player prediction metrics, each returned with its own denominator and a minimum-sample flag |
| 177 | A batch prediction submission with per-fixture outcomes — accepted, locked, conflict, invalid, refused — so an offline device can reconcile without losing the drafts that were submittable |
| 178 | An independent recomputation of settled scoring that records disagreements and corrects nothing |
| 179 | Private Last Man Standing and Championship containers can be found again after they are created or joined, and one can be opened |
| 180 | Joining the Championship gives a player the shared season prediction card without joining them to the Match Predictor |

| 181 | An ordinary private league stops admitting members at a hundred, and says so rather than growing without bound |

| 182 | There is exactly one way a season Championship group is ranked, and the database refuses to hold a second |

| 183 | Picking a favourite club takes one request instead of two, and a club that plays nobody still has its badge; a player ranked deep in the table can see who is immediately above them |
| 185 | A private nine-league modelling and paper-betting lab has a complete fixture-to-CLV lifecycle, secret-safe paid-odds custody, free historical/fixture price ingestion and bounded admin evidence; it has no platform-result or player-product authority and is not hosted by this record |

| 184 | A Championship group of any permitted size can qualify somebody, instead of only its winner |

| 186 | A season Championship records where its group stage ends, so anything downstream can ask |
| 187 | A season Championship can actually finish its group stage: it qualifies, seeds and brackets, over the matchdays it plays rather than over three |
| 188 | The AI Lab keeps the evidence behind a forecast, refuses one built on a broken club identity, and can be asked for an accumulator at one real bookmaker |

*Current to contract 189.*

## Innovation Lab UI pass — 11 August 2026

Twelve `INNOV-*` rows from [`../product/innovation-lab.md`](../product/innovation-lab.md) were promoted by the owner and worked on in one frontend session. The classification below is the baseline's own, and it is deliberately conservative: a surface counts as **Implemented in repository** and nothing stronger, because none of it has been published and no hosted claim is made here.

**The backend halves of four of these rows landed separately and first**, as contracts 175 to 178 under [ADR 0027](../adr/0027-innovation-lab-backend-foundations.md) — `INNOV-001`, `INNOV-002`, `INNOV-020` and `INNOV-018`. They are **repository-only**: Development is hosted at 174, so none is in the generated database types and none is reachable from a browser. Every surface below therefore derives from reads that were already granted and is unaffected; where one of those contracts answers a gap this pass recorded, the Innovation Lab's own delivery record says so.

**This pass changed no database, no hosted environment, no provider configuration and no Edge Function.** It added **no** scoring, lock, settlement, reveal, membership or standings authority. Every figure any new surface renders is derived from a read the server already grants, using `src/domain/season/scoring.ts` — the authority the database is parity-checked against — rather than a value re-typed into a component.

| Innovation | Baseline effect | Classification |
| --- | --- | --- |
| `INNOV-001` What-If | The Match Centre answers what the current score and the next goal are worth, and — after the matchweek's own lock — what they would do to a private league's table. Every figure is a labelled projection; the panel refuses to render for a settled fixture or without a provider score | Implemented in repository |
| `INNOV-002` Prediction DNA | The player's season route describes how they predict, from their own recorded predictions. Below ten predictions it says so rather than quoting a share | Implemented in repository |
| `INNOV-006` Matchday TV | A read-only large-screen route for a room, carrying no write path, no account control and no admin read. Rotation stops under reduced motion | Implemented in repository |
| `INNOV-007` Share | One share control over an allow-list of share kinds. There is no kind for an unlocked prediction and no field for another player's name | Implemented in repository |
| `INNOV-011` Divergence | How unusual the player's own pick was, derived from the consensus counts already on the page. It cannot outrun the reveal rule because the payload it reads does not exist before the lock | Implemented in repository |
| `INNOV-012` Side honours | Five deterministic per-matchweek awards on a private league, each publishing its rule and sharing rather than breaking a tie. **They change no points and no league position** | Implemented in repository |
| `INNOV-014` Closest misses | What a settled matchweek's near misses would have been worth, visually separated from the official total | Implemented in repository |
| `INNOV-016` Matchday briefing | One strip on Home and `/play` joining the action inbox, today's football and the player's standing. It computes no deadline, lock or rank | Implemented in repository |
| `INNOV-017` Submission receipt | What has actually been submitted, claiming only what the card read said. **No reference number, no timestamp and no cryptographic claim** — the server returns none of them | Implemented in repository |
| `INNOV-023` App badge | The installed icon carries the same outstanding count the AppBar shows, from the same inbox. Absent platform support changes nothing | Implemented in repository |
| `INNOV-024` View transitions | Opt-in per link on two high-value navigations, suppressed under reduced motion in code as well as in CSS | Implemented in repository |
| `INNOV-013` Archaeology | **No new surface.** The historic-fixture experience was already carried by the Match Centre route, and `INNOV-011` supplied the one missing part. Recorded so a later session does not build a second one | Superseded |

Twelve further rows did not ship, each for a stated reason, and the reasons are recorded in the register's own delivery record rather than restated here. **None of them is rendered as a disabled or decorative control**: where a feature needs a server authority that does not exist, no surface exists either.

> **Contract 190:** records a backend safeguard: valid AI betting evidence and new bet writes require a real non-aggregate bookmaker registry venue. No frontend feature baseline changes.

> **Contract 191:** records a backend capability rather than a feature change: a global weekly-season standings row can now be addressed as a player, subject to the same disclosure boundaries as before. No frontend feature baseline changes, and no visibility rule is widened.

> **Contract 192:** records a backend capability: a weekly season can now report a player’s POSITION at every settled matchweek, not merely their points, and can answer a season-long head-to-head in one read. No frontend feature baseline changes and no disclosure boundary moves.

> **Contract 193:** records a backend capability: a season Predictor Championship entrant can now see their knockout tie and bracket. No frontend feature baseline changes, and no Championship rule moves.

> **Contract 194:** records a backend correctness fix rather than a feature: a removed player can no longer win a Championship knockout tie. No frontend feature baseline changes.

> **Contract 195:** records a backend capability: a Championship entrant with an open playoff or knockout tie is now told their Penalty Number is due, with their own lane and the real deadline. No frontend feature baseline changes and no disclosure boundary moves — the item carries no opponent identity, value or submission state.

> **Contract 196:** records a backend capability and a backend correctness fix: a player is told when they are knocked out of, qualify from or win a competition, and a Championship outcome now carries the date it happened. No frontend feature baseline changes; the item tells a player only about themselves.

> **Contract 197:** records a backend capability: a player’s football can be listed in kickoff order across their competitions in one read. No frontend feature baseline changes, no Matches surface is designed or built, and no disclosure boundary moves — it is a fixture read with no prediction, score, standing or other player in it.

> **Contract 198:** records a backend correctness fix and a rule clarification: a Championship can no longer be launched into a shape it cannot finish, and the shortfall no longer surfaces months later at qualification. No frontend feature baseline changes.

> **Contract 199:** records two backend correctness fixes in the private AI Lab: repeated advice on one fixture and market no longer counts more than once towards bet count, exposure, hit rate, ROI or CLV, and a void settlement may exist without a scoreline. No frontend feature baseline changes and no public surface is touched — the AI Lab remains private admin paper research.

> **Contract 200:** records a backend operational fix: the paid odds collector's cadence is stated as a function and asserted to stay inside the price-freshness allowance it feeds. No threshold is weakened and no frontend feature baseline changes.

> **Contract 201:** records a backend capability for the private admin AI Lab only: coverage, operational health and a fixture-level results review, each behind the competition-admin capability and executable by no anonymous role. No public surface, no player-facing feature, no publication boundary and no threshold moves; the reads report decisions and make none.

> **Contract 202:** records a backend correctness fix: a private AI Lab forecast for a fixture more than two days away was frozen at the first run of the week, so results imported afterwards never reached it. Predictions remain immutable — the fix is more horizon buckets, not an overwrite. No frontend feature baseline changes.

> **Contract 208:** moves a baseline feature. A season Championship surface can now state that a player has been ELIMINATED, which no season read supplied before; and a `single_group` competition that has reached its split is no longer offered a league fixture as a knockout tie with a Penalty Number lane. The vNext Championship consumes the first; the second removes a presentation workaround from being the only defence.

> **Contract 209:** records a correctness fix in a read PRODUCTION calls. `get_season_cup_phase`'s membership lookup matched both of a split entrant's rows and `select ... into` took one silently, so `src/services/supabase/seasonCup.ts` showed a split entrant their pre-split group, its members and its table. No baseline feature is removed; one starts being answered correctly.

> **Contract 205:** records a correctness fix in a read no surface calls yet. `get_season_cup_bracket`'s seed lookup was a scalar subquery over a table keyed by `(competition_id, user_id, phase_kind)`, so it raised — failing the whole read — for every entrant in a Championship that had split. No baseline feature moves: the read is unconsumed today, and it is fixed because Stage 12 is about to be its first caller.

> **Contract 209:** moves a real baseline behaviour. A provider postponement now reaches `season_fixtures.status` on its own, and is reversed on its own when the provider recants, so Home, Matches and the Match Centre show a postponed match as postponed rather than as an ordinary fixture at a kickoff that will not happen. A rescheduled fixture accepts its new date and its prediction deadline follows it. The legacy production Matches list, its Overview preview and the legacy Match Centre gain the same states in the same words — they had none at all, so a postponement would have rendered there as an ordinary row at a dead kickoff.

> **Contract 210:** removes no baseline feature and adds none. It makes the contract 209 behaviour above arrive in time to be one. A player's prediction locks at their matchweek's first kickoff, and until now the provider feed was read once a day until fifteen minutes before a kickoff — so a postponement announced in the day before a deadline could be applied only after that deadline had passed. The live poll window now opens twelve hours before a kickoff, which brackets the lock. Nothing a player sees changes shape; what changes is whether they see it while it still matters.

> **Contract 211:** removes no baseline feature and adds none. It keeps the contract 210 behaviour above and changes what pays for it. Covering a deadline at ten-minute resolution for twelve hours cost 252 provider calls on a real Premier League matchweek, against a published budget of about 58 on a matchday; an hourly deadline watch covers more of the same window for 36. A player sees the same thing, and the mechanism that shows it is affordable enough to leave switched on.

> **Contract 212:** removes no baseline feature. It corrects one, in the player's favour. The Main Predictor published a single matchweek deadline and drew every fixture against it, while the database has enforced per fixture since contract 119 — so a rescheduled or postponed fixture read as locked when the write would have been accepted. The card now publishes each fixture's own lock instant and whether it has passed, and the surface draws each fixture against its own. A player may now predict a fixture the rules always allowed them to predict; nothing that was refused before becomes allowed.

> **Contract 213:** removes no baseline feature and adds none. It removes seven documentation-seeded SportMonks status tokens that were never observed in a payload, so each now resolves `unknown`: it moves no fixture and is recorded for review instead. A player sees nothing different today, because nothing has ever sent one of these tokens — what changes is what would happen if something did.

> **Contract 204:** records a read-model correctness fix in the private AI Lab: two league-scoped dashboards reported a lab-wide quarantine count beside league-scoped numbers. Scoped through a new custody view, `ai.quarantined_predictions`. No public surface, no threshold moves, and nothing in the browser reads the field today — it is fixed because the next surface to use it would have inherited the defect.

> **Contract 203:** records a backend correctness fix in the private admin Bet Builder: a superseded BET could be offered as an actionable leg, and the browser was re-deriving currency across nine paged reads to compensate. The rule moves to the database rather than disappearing, and is proved in both directions. No public surface and no threshold moves.

**Contract 206:** records backend support for same-season competitive profile visibility using the season-scoped player reference. It deliberately does not reclassify a user-facing feature yet: Development rollout, generated types and the consuming browser journey are still required, and the new path exposes no target authentication identifier.

### Contract 214 — season card confirmation baseline

Season matchweek confirmation now describes the current card rather than an earlier edit state. Successful material prediction/Joker changes clear the confirmation back to provisional; no-op and rejected writes do not. Confirmation time/reference are server-derived display evidence, not a second receipt ledger or cryptographic proof.

### Contract 215 review — private AI Lab evidence currency

Contract 215 hardens an existing private administrative research capability rather than creating a new compact user feature or safeguard identifier. Historical forecasts remain inspectable, but only the canonical newest forecast may produce the current value decision and stale recommendation evidence fails closed across a forecast-version change. No public betting surface, scoring rule, competition state, player data boundary or hosted classification changes here, so the compact `FEAT-*` / `SAFE-*` rows above are unchanged.

### Contract 216 — reminder dispatch baseline

The reminder path now has all four of its jobs: generate, schedule, reclaim and
dispatch. Classification is unchanged for the player-facing surface — reminders
are still **implemented and switched off** — but the safeguard inventory gains
one that previously existed only on paper. The per-row `dry_run` flag is now
capable of refusing a send; before this contract the claim overwrote it and the
gate could not fire.
