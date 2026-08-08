# Multi-competition platform — roadmap

**Status date:** 7 August 2026  
**Purpose:** current delivery position and next executable slice.  
**Current facts:** [`quality/current-status.md`](quality/current-status.md)  
**Parent programme:** [`architecture/programme-plan.md`](architecture/programme-plan.md)  
**Engineering workstream:** [`architecture/multi-competition-hub-build-plan.md`](architecture/multi-competition-hub-build-plan.md)  
**Detailed inventory:** [`../MASTER-TODO.md`](../MASTER-TODO.md)  
**Accepted but unbuilt requirements:** [`quality/accepted-requirements.md`](quality/accepted-requirements.md)  
**Decision authority:** [`adr/README.md`](adr/README.md)

This roadmap does **not** duplicate the programme phases or Stage A–L engineering plan. It records where delivery is now and the next executable sequence.

> **What the finished product should look like:** [`design/README.md`](design/README.md) — the target design authority (Hub Architecture and Modernisation Plan rev 1.5, plus the landing-page prototype). It sets presentation and delivery; it changes no rule.
> **How it becomes production code:** [`design/ui-modernisation-execution.md`](design/ui-modernisation-execution.md) — the reconciled UI migration order, the premium prototype's reference-only classification and the approved tooling phases. Adopted 5 August 2026 and amended for Domestic Frontend Alpha on 7 August 2026.

## Current baseline

Every moving value — the current `main` commit, the repository contract, each hosted contract, the live production deploy — is stated in [`quality/current-status.md`](quality/current-status.md) and [`ops/ops-pending-migrations.md`](ops/ops-pending-migrations.md). **This document deliberately states none of them.**

It used to. The result was a baseline nine releases behind the repository, sitting beside a pinned deploy id and short commit — one line below a bullet warning that a pinned SHA in a live document goes stale. Naming an authority and then restating its facts produces two answers to one question, and the stale one is the one that gets read. `tests/scripts/documentationContractFreshness.test.ts` now fails if any of it comes back.

What is durable enough to state here:

- Euro 2028: recoverable at `euro-2028-baseline`, with remaining tournament work parked until January 2028;
- production Netlify deploys are paused by the prebuild contract gate until an intentional production migration/release milestone. The last good deploy stays live;
- Stage B: complete through PR #226, with the retained checklist closed by PR #239;
- Stage C: design baseline, assertion classification, C2 non-interference and the detailed C1 schema overlay are complete. The Stage C1 migration is merged (PRs #317, #349) with hosted rollout tooling and a guarded GitHub workflow (PRs #350, #351); the hosted development apply **completed and was postflight-verified 2–3 August 2026** (PRs #359–#368 hardened the tooling en route). No production write is authorised;
- lock policy is **game-owned** (ADR 0020, PR #353): the competition supplies identity, calendar and structure; each game supplies its own explicit lock policy, failing closed when missing or incompatible.

## Development operating model

[`adr/0024-development-environment-operating-model.md`](adr/0024-development-environment-operating-model.md) is the authority for how work reaches the development environment. It exists because the ceremony protecting production had been applied to a database with no data worth protecting, and the cost was paid on every schema change.

- development data is **disposable** until a closed external cohort holds it. That expiry is a *condition*, not a date: the model ends when real entrants exist, whoever notices first;
- an **additive** development migration applies through `.github/workflows/development-fast-lane-rollout.yml`, which proves additiveness by reading the pending migrations rather than trusting the dispatcher. Anything destructive is refused and sent back to `stage-c1-development-rollout.yml`, which keeps the backup and restore rehearsal;
- a deploy preview whose hosted database trails the repository contract now **builds and reports the gap** instead of failing. Production keeps the fatal check. This ended a circular gate in which a schema-advancing PR could not produce a green preview before the merge that would make its schema real;
- browser journeys are **selected from the change** (`scripts/select-browser-journeys.mjs`), widening to the full suite on anything unrecognised. Contract and schema changes always run everything;
- development data is **reseedable** through `npm run reset:development`, which refuses both hosted project refs.

**What ADR 0024 does not relax:** production backup, preflight, approval and verification; RLS; TypeScript/PostgreSQL parity; and the C2 block under issue #272. Production has no fast lane.

## Delivered foundation

### Stage A — authority and control alignment

The platform ADRs, parent/child planning hierarchy, state architecture and domain controls are established. Brand selection is deferred with a trigger under ADR 0019 and is not on the engineering critical path.

### Stage B — competition-context foundation and surface migration

Complete on `main`:

- pure context, lock and match-state foundation through PR #212;
- Home migration through PR #219;
- Matches, Match Centre, entry lock and `MatchTemporalState` retirement through PR #226;
- clean application, database, preview and authenticated-browser gates before integration;
- retained inventory closure through PR #239.

### Landed control and Stage C preparation

- PR #228: cross-tournament read scoping, production guard derivation, real 404 routing and deployment-contract controls.
- PR #229: Original Predictor scoring parity.
- PR #232: complete Database parity directory execution.
- PR #233: CSP/application resource parity.
- PR #235: environment and deployment-RPC/database-privilege parity.
- PR #245: timezone-authority before-state.
- PR #246: effective account-deletion action before-state.
- PR #250: exhaustive public-table RLS and security-definer `search_path` guard.
- PR #252: `competitionTimeZone`/`viewerTimeZone` seam with temporary viewer fallback.
- PR #255: TypeScript test project and corrected timezone fixtures.
- PR #258: Playwright/e2e, TypeScript tool and config coverage.
- PR #261: production-smoke coverage, explicit strictness and exhaustive committed TS/TSX project guard.
- PR #264: typechecking for the three JavaScript deploy gates and an explicit deferred JavaScript inventory.
- PR #265: exhaustive public-view and direct browser relation-grant guard.
- PR #266: disposable-local leaderboard scale evidence; ACQ-R02 remains open and no standings migration was introduced.
- Original Stage C TypeScript contracts: `stageCRelationCoverage`, `stageCFunctionCoverage`, `stageCTriggerBindingCoverage`, `stageCTournamentIdCompatibility` and `stageCEuroSeedPreservation`.
- Hostile reference before-state: `031_stage_c_reference_scope_before_state.sql` (PR #286).
- Lock and late-write before-state: `032_stage_c_lock_before_state.sql` (PR #292).
- C1 boundary: `stageC1ContractClassification.test.ts` enforces the 40/0/9 assertion split; `stageC1NonInterference` freezes auth ownership, deletion FKs and ownership RLS.
- C1 overlay: `stageC1SchemaOverlayCoverage.test.ts` proves every original relation and reviewed function has a current C1/C2/shared disposition.
- C1 lock-function consistency: `stageC1LockFunctionConsistency.test.ts` compares the entry-lock trigger definitions to each other. The migration defines each twice because the season-scope backfill writes to lock-guarded tables, and the second definition of the generic guard had drifted to `security definer` + `session_user` — which left the trusted automatic-submission refresh permanently unreachable. `pg_proc` cannot see this, because the live database only shows the last definition.
- PRs #319–#340 (31 July 2026): gate integrity and accessibility enforcement. CI refuses to pass a suite that discovered no test files; the browser-suite path filter now watches what its jobs read, including the deployment contract; the deploy smoke compares served security headers against the committed ones rather than checking four of thirteen directives; every `e2e` spec is proven to run under exactly one Playwright config with a project gate that exists. Accessibility moved from a scan over 11 of 34 routes to every declared route plus the component gallery, component states no route renders, the design-token contrast matrix and the declared CSS pairings — with axe's `incomplete` results counted, not discarded. Thirteen real defects were found and fixed, and the palette was raised so every text pairing meets AA (`--gold-strong` added; the light muted ramp rebalanced). Two accessibility deferrals remain, both "covered elsewhere" rather than gaps.

PRs #245 and #246 remain before-state contracts. PR #252 is the application seam. PRs #250, #255, #258, #261, #264 and #265 are preservation invariants.

## Stage C design and governance

PR #236 — **merged 30 July 2026** — remains the original combined design record.

The accepted implementation authority is now:

- [`architecture/stage-c1-c2-governance.md`](architecture/stage-c1-c2-governance.md) — C1/C2 split;
- [`architecture/stage-c1-contract-classification.md`](architecture/stage-c1-contract-classification.md) — 40 C1, zero authorised C2 after-state and nine shared-before-state assertions;
- [`architecture/stage-c1-schema-overlay.md`](architecture/stage-c1-schema-overlay.md) — relation, function, RLS, migration-order and evidence dispositions for C1.

Stage C1 keeps current auth-owned competitive rows unchanged and is tracked by issue #303. Stage C2 remains blocked by the independent data-protection review in issue #272.

None of these documents authorises a migration or hosted write.

## Delivered platform backend since Stage C

The repository has moved well beyond the original Stage C foundation. The moving contract and hosted values remain in [`quality/current-status.md`](quality/current-status.md) and [`ops/ops-pending-migrations.md`](ops/ops-pending-migrations.md); the durable delivered capabilities are:

- the competition-season catalogue, separate game memberships and game-owned lock policies;
- season fixtures, Match Predictor cards, Jokers, lock resolution, recurring submission scheduling, scoring, replay-safe fixture reassignment, stored matchweek totals and bounded standings;
- season LMS eligibility, deterministic auto-assignment, used-team cycles, selection writes, correction-aware settlement and entrant-state replay;
- competition-neutral Championship/Cup points and settlement sources, season scheduling rules, persisted split phases, one-parent ancestry and a continuing table derived from settled initial and split fixtures;
- provider-response custody with strict decoding, archive-before-processing evidence and no path from a provider response to official result truth;
- repeatable competition instances, explicit live/current instance resolution, correction-safe terminal rederivation and a complete LMS restart lifecycle: Contract 107 creates the fresh successor without copied picks, cycles, projections or windows; Contract 108 refuses inherited past rounds; Contract 109 selects the first derivable future league matchweek, creates the successor calendar exactly once and drives the transition from settlement's immutable report;
- the Contract 116 season Last Man Standing round read: Contract 116 lets a season Last Man Standing entrant SEE the round they can already pick in: contract 86 widened the selection trigger to season fixtures, but the read was never widened — `get_my_lms` resolves every window through `bonus_window_fixtures` joined to `public.matches`, so a season round comes back with an empty fixture array. `get_season_lms_round` reads `season_cup_window_fixtures` joined to `season_fixtures`, returns one round — the earliest still open to a pick — and answers survival from `predictor_internal.season_lms_pick_outcome`, the same authority the settlement replay folds over, rather than handing a browser raw scores to judge, because a season fixture carries no winner column. Nothing about any other entrant appears in it; no table grant is added and no rule moves.
- the Contract 119 rescheduled-fixture lock: Contract 119 makes a rescheduled fixture lock at its own kickoff. Contract 117 let a provider move a kickoff automatically and the lock did not follow, so a fixture postponed to the following Wednesday still locked on Saturday. Only a rescheduled fixture is affected — the owner chose that reading over the universal per-fixture one, which shares the same arithmetic but would make an ordinary matchweek predictable in stages. "Moved" is contract 117's revision record, a stored fact rather than an inference, and the rule is strictly permissive: it can extend an editing window, never shorten one;
- the Contract 120 Championship phase read: contract 102 persists the Predictor Championship split as a distinct phase and contract 105 derives the continuing table for it, but nothing browser-reachable could see either — measured on hosted development, zero functions `authenticated` may execute read `cup_split_group_tables`, `parent_group_id` or `cup_final_group_tables`. `get_season_cup_phase` returns the caller's own phase and their own group's table from whichever authority owns that phase, adding no rule and recomputing nothing. Fifth instance of the defect behind contracts 86, 98, 116 and 118; Contract 121 adds the season play-context read — which season a URL means and which matchweek its card opens at — which is what lets that surface be registered on a production route. Contract 122 makes ADR 0012's two retention tables answerable: the monthly table, whose month comes from a round's `window_opens_at` read in the competition's own timezone, and rolling form, which needs only round ordinal. Both are derived views and neither touches the canonical total. Contract 123 then closes the freshness gap contract 122 named and deliberately left: contract 113 stores a round's play span, contract 117 moves the kickoffs it is derived from, and nothing ran between them. The refresh is per round and never raises — a proposed span that would overlap another round's window leaves the old window exactly as it stands and queues an append-only row naming what was kept, what was proposed and which round blocked it — so the provider import cannot start failing because a derived view could not be recomputed, which was the whole reason the decision was deferred. Contract 124 then supplies the Championship phase-transition driver that contracts 102, 105 and 120 were each built in anticipation of: it creates the two child groups from the final initial table, carries points and draw numbers, eliminates nobody and refuses the multi-group field ADR 0014 excludes. It closes that ADR's one open consequence — an odd field splits unevenly, and the smaller half now finishes its round-robin early inside a single competition-wide matchday numbering rather than being given a calendar of its own. Contract 125 gives a season fixture a result at all: measured, nothing in the repository could write `season_fixtures.home_score`, so no matchweek settled and every season surface downstream of a result was honest and empty. It writes the result, records an immutable revision and settles nothing — the existing cron rederivation does that — and keeps the protected confirmation gate by construction, since the provider importer writes only a kickoff. Contract 126 then narrows a refusal that was firing too early: leaving a Last Man Standing competition blocked re-entry from the moment it was published, when ADR 0013 closes entry only once the first round locks — so the flag is now read together with whether the competition is running. Contract 127 then opens a season competition for play at all: measured, both season Last Man Standing competitions hold no round and no setup row, and both season Championships hold no group because contract 111's launch driver has never had a caller — so an administrator call writes the public Classic setup ADR 0022 pins, generates a first instance's calendar from the same derivation contract 109 uses for a successor, and hands the Championship to contract 111 unchanged. It is an operator action rather than a job, because the launch fixes the draw at whatever field size it finds. Contract 128 then gives a season league a standings table of its own: `get_league_members` derives every metric from `standing_metrics`, `score_events`, `matches` and `match_predictions`, which a competition season writes none of, so a league on a season returned every member on zero in alphabetical order with no error — the sixth instance of that shape. It is a new read rather than a widened one, because ADR 0012 ranks a season on cumulative points and pairs the total with matchweeks played while the tournament table carries five approved final tie-breakers; the totals come from `season_standings` so a league cannot disagree with the season, the rank is recomputed inside the league because a private league is its own table, and the tournament read now refuses a season league by naming the one that answers. Contract 129 then gives a season a head-to-head at all — `get_rival_entry` reads `entry_totals`, `match_predictions` over `public.matches` and `predicted_progression`, none of which a competition season writes — and its reveal boundary is the MATCHWEEK's own lock rather than the one tournament instant, hiding rather than revealing when a round's kickoffs are incomplete. Contract 130 adds the prediction consensus keyed on the round for the same reason, reusing contract 61's minimum cohort of ten but counting the entries that predicted THAT matchweek, since a season with fifty entrants of whom six played matchweek 30 is exactly what the protection exists for. Contract 131 makes contract 122's retention tables able to name their players, optionally and off by default, adding the flag as a required fourth parameter and retiring the three-argument form by revoking rather than dropping it, and mapping over what the parity-checked authorities returned so their order and their agreement with `standings.ts` are untouched.
- the Contract 117 provider fixture revision import: Contract 117 is the repeatable path a provider kickoff change takes to the fixture: it revises an existing fixture's kickoff, creates none, deletes none and never writes `competition_round_id` — the owner amendment made executable. It fails closed on the whole payload when any identifier is unmapped, refuses a kickoff moved into the past or a fixture no longer scheduled, and records every move append-only as an administrator's review queue;
- the Contract 115 provider poll dispatch, which is what finally lets the database call a provider: `pg_net` was available and not installed, so PostgreSQL could make no outbound HTTP request and the deployed `provider-poll` Edge Function had a scheduler that could not reach it. It installs the extension, forbids any browser-reachable function in an exposed schema from calling into `net` — pg_net's own grants belong to whoever owns the extension, and where Supabase's image owns it `postgres` is neither superuser nor a member of `supabase_admin` and cannot revoke them — and drives the Edge Function from `pg_cron` at each target's declared cadence, recording no target and importing no fixture, so on application it runs and does nothing;
- the Contract 113 round play window and the Contract 114 bounded season-card browser path (the matchweek card read and its three own-entry writes, every rule enforced by the triggers that already own it), which closes the gap contract 112 stopped at: `fixtureReassignment.ts` resolves a moved kickoff BY ROUND WINDOW and `competition_rounds` had none, so that authority was unreachable from the database. It stores the window rather than computing it at read time, because the derivation reads fixtures and reassignment moves one — computing at resolve time would make the answer depend on the question;
- the Contract 112 provider identity map, which relates a provider's season, round and team identifiers to this platform's rows within one competition season. Every ingestion step was blocked on it: a decoded fixture names team `1234` playing team `5678` in round `40`, and nothing anywhere said which of our clubs those were. It is the map alone — it writes no fixture, because the authority for a moved kickoff resolves by round window and `competition_rounds` has none, which is a lock-adjacent decision needing its own contract rather than a side effect of ingestion plumbing;
- the Contract 111 season Predictor Championship launch driver, and the Contract 110 round calendar beneath it. Until it, `bonus_cup_fixtures.window_id` was `NOT NULL` and nothing in the repository created a window for a season competition, so no season Championship fixture could be persisted in either phase — which is why its phase-transition driver could not be built.

These are backend and control foundations. They do not mean that every Domestic Frontend Alpha journey has been delivered.

## Domestic Frontend Alpha amendment — 7 August 2026

The next named weekly-product milestone is **Domestic Frontend Alpha**. This section is the current delivery order for the frontend/product programme and supersedes the 6 August frontend ordering retained below. The goal is a genuinely usable Development product for Premier League 2026/27 and Scottish Premiership 2026/27 across Match Predictor, Last Man Standing and Predictor Championship — not continued accumulation of isolated backend and UI slices.

After currently active PRs settle:

1. **Stabilise/apply the current Development contract batch** under ADR 0024. This is an operational prerequisite, not Production promotion.
2. **Canonical weekly route/navigation replacement** (`DFA-004`) — converge on Hub → competition → game and one typed/generated route authority.
3. **Euro/tournament-route absence on the weekly site** (`EURO-001`–`EURO-004`) — publication state/route guards first, then all weekly discovery/content/metadata surfaces.
4. **Deterministic parent/back navigation** (`DFA-005`) — every shipped non-root weekly route has a logical parent independent of browser history and executable orphan-route coverage.
5. **First-sign-in onboarding and personalisation** (`DFA-001`, `DFA-002`) — followed competitions, optional favourite team, independent game choice, private-play choice, interrupted-resume and pending-invite recovery.
6. **Reusable shirt-style club identity** (`DFA-003`) — one canonical-team component with accessible label/fallback and bounded abstract shirt patterns.
7. **Truthful Scottish Matchweek 1 settled Development state** (`DFA-007`) — real football results; lock-consistent synthetic test-user predictions only where needed; normal protected scoring/rederivation.
8. **Scottish Last Man Standing begins at Matchweek 2** (`DFA-007`) — join, real clubs, select/change before lock and reload persistence; no invented Matchweek 1 LMS history.
9. **Scottish Predictor Championship begins at Matchweek 2** (`DFA-007`) — seeded deterministic field, opponent/fixtures/phase/table reachable, Match Predictor points feeding it through the existing authority.
10. **All three games usable for both domestic competitions** — joined first, available second; every game card has honest state, direct action, deadline/round where relevant, route and help/rules.
11. **Private create/invite/join for all three game types** (`DFA-008`) — Match Predictor league, LMS competition and Predictor Championship while preserving existing server-owned limits and rules.
12. **Competition Play weekly-action aggregation** (`DFA-006`) — one answer to “What do I need to do this week?” derived from each game's authoritative state.
13. **Development competition administration** (`DFA-009`) — visible readiness and guarded callers for setup actions the protected server authorities already permit; never a second rules engine.
14. **Match Centre engagement** — connect football state to the player's prediction and appropriate points/trends/league/LMS/Championship consequences while preserving provisional-vs-official truth.
15. **Final personalised Hub Home** (`DFA-010`) — one primary urgent/next action, at most two compact secondary actions, then live football and relevant favourite/followed/rank/recap/private context.
16. **Lock the final signed-in visual language and representative product states** across phone/desktop, light/dark and reduced motion.
17. **Build the final public landing visual and scripted non-interactive phone preview** (`DFA-011`) from those settled signed-in states. The current landing implementation remains an intermediate acquisition shell, not final visual acceptance.
18. **Reminders and player history** (`DFA-012`) — incomplete Match Predictor / missing LMS pick near lock first, then useful season history for all three games.
19. **Full phone-first Development acceptance journey** — prove first sign-in through repeat use as one coherent weekly product.

The player-level test is the one in ADR 0023: within a few seconds a player should understand what needs action, when it locks, what is happening in the football and how they are doing.

Provider ingestion, CI, security and operational work may continue in parallel where dependencies justify it. They do not silently reorder the signed-in Alpha back into a backend-first accumulation phase. Production migration/publication remains separately controlled and is not authorised by this sequence.

## 6 August executable sequence — retained history

The sequence below records the position before the Domestic Frontend Alpha amendment. It is retained because its provider, cohort, Production, C2 and brand constraints remain useful evidence. Where it describes remaining frontend order, the 7 August Alpha sequence above now wins.

1. **Continue provider ingestion from the rehearsal that has already run.** The first bounded non-production rehearsal — one owner-authorised request, raw custody proven to precede decode, processing evidence proven append-only, no official fixture, result, lock, score, total, rank or standing written — **was completed on 5 August 2026** and is recorded in [`ops/ops-first-live-provider-poll.md`](ops/ops-first-live-provider-poll.md). This step stood written as though it were still ahead, which is worth correcting rather than quietly deleting: a fresh session reads this list to choose work, and an item that is already done sends it to redo finished work instead of the next one. What genuinely remains under [`../MASTER-TODO.md`](../MASTER-TODO.md) Stage D is automatic fixture **creation** and the administrative reassignment workflow — deliberately not attempted by contract 117, because a fixture appearing that this platform did not know about changes what a competition *is* — plus deterministic anomaly fixtures, proving stale data fails closed, and the headless season and its anomaly log. The custody boundary itself is not reopened by any of it.
2. **Build the season game surfaces in the order [`design/ui-modernisation-execution.md`](design/ui-modernisation-execution.md) records.** The design plan's §13.2 and this roadmap previously disagreed about sequence; the reconciliation is deliberate and owned there: visual foundations and component gallery first, then thin global/competition shells, then the phone-first Match Predictor behind a route-level flag, then standings, LMS weekly selection, the Championship surfaces, the full Hub action/social experience, public acquisition, and legacy retirement last. Backend availability is not a substitute for a usable surface. The provider ingestion work remaining in step 1 runs in parallel: it blocks provider-fed production behaviour, not tokens, components, fixture-backed states or shell work. **For remaining work this clause is superseded by the Domestic Frontend Alpha order above.**
3. **Instrument before cohort exposure.** Emit the Phase 1 taxonomy from the first surface commit, then run the headless season/anomaly log and only introduce a closed cohort after the provisional path is stable.
4. **Keep production paused as a separate milestone.** Repository and development progress do not authorise production migration or publication. Production promotion retains backup, preflight, approval, exact-artifact verification and rollback evidence.
5. **Keep Stage C2 blocked.** No ownership, erasure, pseudonymisation or replacement ownership-RLS work enters the platform until issue #272 records the independent data-protection decision.
6. **Review ACQ-R02 only at its trigger.** Reopen maintained standings only on a material cap increase or adverse rehearsal/hosted concurrency evidence, not merely because the design exists.
7. **Hide Euro 2028 from the weekly platform, then build the second site.** [ADR 0026](adr/0026-public-site-separation-shared-accounts-and-euro-2028-acquisition.md) decides two frontend sites over one shared backend, one account across both and a server-owned publication state. **The first item is a live defect rather than a future feature:** the weekly Hub lists Euro 2028 from its static catalogue while the competition should be hidden (`EURO-001`), and its routes are reachable. The order is the server-owned state and route guards first (`EURO-002`, `EURO-004`), then removal from landing content, Hub discovery, cards, navigation, metadata, sitemap, Open Graph and guessable routes (`EURO-003`), and only then the separate Euro deployment (`SITE-002`, `SITE-004`). Documentation of the boundary is not the implementation of it.
8. **Take the two brand-blocked items when the brand lands, not before.** The weekly platform's domain (`SITE-003`) and the neutral transactional sender (`SITE-007`) both wait on ADR 0019's Phase 0 trigger. Custom SMTP is already live through the Euro domain, so nothing is blocked on email delivery — only on the name.
9. **Enforce the 18+ first cohort before any external account exists** (`AGE-001`). A server-side signup rule with matching eligibility wording and fixtures, on the pattern the display-name and password rules already use. It is not satisfied by footer copy, and it is not satisfied by the Stage C2 work either.

Every accepted-but-unimplemented clause carries its stable identifier, dependency and acceptance evidence in [`quality/accepted-requirements.md`](quality/accepted-requirements.md). That register — not this list — is the authority for what remains accepted and unbuilt; this list decides only the order.

## Parked Euro 2028 scope

The complete inventory remains in [`../MASTER-TODO.md`](../MASTER-TODO.md) for January 2028. It includes official data, final tournament presentation, administration fit-for-final verification, rehearsal, operational recovery and the published-release decision.

## Programme and stage navigation

- Product phases, discovery, instrumentation, cohort thresholds and go-to-market: [`architecture/programme-plan.md`](architecture/programme-plan.md).
- Engineering Stages A–L and engineering gates: [`architecture/multi-competition-hub-build-plan.md`](architecture/multi-competition-hub-build-plan.md).
- Stage C implementation split: [`architecture/stage-c1-c2-governance.md`](architecture/stage-c1-c2-governance.md).
- Stage C assertion boundary: [`architecture/stage-c1-contract-classification.md`](architecture/stage-c1-contract-classification.md).
- Stage C1 implementation overlay: [`architecture/stage-c1-schema-overlay.md`](architecture/stage-c1-schema-overlay.md).
- Original combined Stage C design and coverage: [`architecture/stage-c-competition-season-schema.md`](architecture/stage-c-competition-season-schema.md) and [`architecture/stage-c-schema-coverage.md`](architecture/stage-c-schema-coverage.md).
- Current implementation and hosted facts: [`quality/current-status.md`](quality/current-status.md).
- Detailed active and parked tasks: [`../MASTER-TODO.md`](../MASTER-TODO.md).
- Decisions: [`adr/README.md`](adr/README.md).

When documents disagree, keep the conflict visible until deliberately reconciled. ADRs decide architecture and rules; current code/tests and verified hosted evidence decide implementation truth.

**Contract 118 stops the games hub being blind to a season's fixtures.** `get_bonus_games` built its per-window fixtures from `bonus_window_fixtures` joined to `public.matches` with no branch on competition kind, so a season window returned an empty array — and because a window can only settle when `total > 0 and confirmed >= total`, a season competition's first locked round stayed in flight permanently and the hub card stuck on it. Three internal functions supply the facts instead: a tournament limb, a season limb mapping season status onto the tournament vocabulary on contract 77's established equivalence, and a neutral combiner that unions rather than branches. Fourth instance of one defect — contracts 86, 98, 116 and this — and `168_tournament_only_browser_reads.sql` now catches the fifth.

## Contract 132 checkpoint — real season data adoption

Contract 132 establishes the controlled first-publication authority for real domestic season calendars. It stages provider evidence first, requires an explicit administrator decision, rejects partial initial schedules, and leaves result confirmation outside provider automation. Development remains the first hosted validation target before Production promotion.

> **Contract 133 boundary (8 August 2026):** Contract 133 is a bounded DFA-007 enabler after Contract 132: it exposes caller-owned private Predictor Championship instances and selected player fixture/table/schedule state. It does not reorder the Domestic Frontend Alpha or change Championship scoring/settlement.

## Contract 134 candidate — first provider enrichment storage slice

After the Contract 133 Development rollout and private Championship verification, the next data slice is Contract 134: provider team profile facts keyed by the existing provider identity map, sourced from retained custody evidence. Development backfill is a separate guarded operation; no Production population, public image use, result authority or scoring dependency is implied by the schema.

