# Multi-competition platform — roadmap

**Status date:** 8 August 2026
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

## Backend completion sequence — 11 August 2026

The remaining backend workstream, in dependency order. Contracts 159 to 168 are
delivered in the repository; everything still open says what it waits on rather
than when it happens.

| # | Work | State |
| --- | --- | --- |
| 1 | Invite security: the resolver's probe limit and disclosure | **Delivered — contract 159** |
| 2 | Authoritative domestic standings (`MIG-UI-13`) | **Delivered — contract 160** |
| 3 | Season archive discovery | **Delivered — contract 161** |
| 4 | Action-centre persistence (`MIG-UI-14`) | **Delivered — contracts 162, 170, 172 and 173.** All three writable generators exist (Last Man Standing, matchweek card, settled-matchweek recap) and contract 172 gives them the `pg_cron` caller they had none of, so the inbox stops being permanently empty. **The Championship action remains**, blocked with `CUP-002` on `CUP-001`; the private-league invitation action remains, because no stable server-side invitation event exists to derive it from. No frontend consumer |
| 5 | Reminder delivery ledger (`DFA-012`) | **Delivered — contracts 163 and 172.** Contract 172 schedules the scheduler and the stall reclamation and deliberately not the claim. **No provider is chosen and nothing sends**, and that half stays blocked on `SITE-007` |
| 6 | Last Man Standing post-lock social reads | **Delivered — contract 164** |
| 7 | Last Man Standing organiser reads | **Delivered — contract 165** (reads only). The COMMAND half is **not an engineering decision**: no accepted authority grants an organiser power over another entrant |
| 8 | Predictor Championship lifecycle | **Partially delivered** — 166 draws the multi-group field the launcher refused, 167 reads it, 169 corrects the span its table is ranked over. **Knockout progression, penalty-number reads and walkover/withdrawal handling remain**, and `admin_finalise_predictor_cup_groups` still gates qualification on `sequence between 1 and 3`, so a season group stage cannot qualify anyone yet. **Tie-settlement orchestration has been measured and is not the missing piece it looks like**: `settle_season_cup_tie` has never had a caller, and contract 169's group table derives the same result inline, so a driver storing tie outcomes would create a second ranking authority free to disagree with the one a browser reads. Which is the authority is `CUP-005`, an owner decision, recorded rather than taken. The KNOCKOUT settlement path is already competition-neutral through contracts 75–77 and 98; there is simply no knockout stage to settle |
| 9 | Season administration inspection reads | **Delivered — contract 168** |
| 10 | Keyset pagination sweep (issue [#129](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/issues/129)) | **Closed as measured, and it was not what this line said.** `get_leaderboard` and both `get_league_members` have had keyset pagination since `20260729122200`; `get_league_match_picks` caps at 250 in display-name order and `get_season_league_matchweek_predictions` caps at 200. **There is no unbounded read.** The real defect was that contract 149's cap had NO ordering, so which 200 members were ranked was arbitrary and the league leader could be dropped — closed by contract 171, which also makes both reads state that they truncated. A page ARGUMENT remains unbuilt on purpose: it needs the functions dropped and recreated, and the rollout caps of fifty users and twenty leagues mean it would page nothing |
| 11 | Provider normalisation beyond contracts 112/135/144 | **Audited, and its first real gap is closed — contract 174.** The audit found the delivered path complete for a kickoff move and a measured final result, and found `INGEST-002`, `INGEST-003` and `INGEST-005` open with contract 117 *counting and discarding* every change that was not a kickoff move. Those three are now implemented: detection stages, only an administrator publishes, and the consumer calls it. **What remains under this item is enrichment**, not correctness — lineups, events, statistics and injuries, each still needing a real consumer and provider terms before any schema. **Provider reality on hosted Development, measured read-only 12 August 2026, because the number of providers is exactly the kind of claim that goes stale:** the raw archive holds responses from **three** providers — `sportmonks` (432), `football-data` (3) and `api-football` (1) — but only **one is polling**. `sportmonks` has one enabled target, last dispatched 11 August 15:25; `football-data` has a target that is **disabled**, last dispatched 5 August; `api-football` has **no poll target at all**, so its single response is a one-off rather than a feed. **Cross-provider comparison — `INNOV-019`'s second half — is therefore not possible today**, and that is a measured blocker rather than a design preference: majority-versus-outlier needs at least two sources on a cadence. Single-provider plausibility detection (`INNOV-019` part A) has no such dependency and can proceed on contract 174's staged-proposal foundation. Twelve of 578 season fixtures carry a result |
| 19 | UI finalisation server gaps (`MIG-UI-16`, `MIG-UI-18`) | **Closed as contract 183, 12 August 2026.** Both were recorded as measured gaps rather than decisions, and both replaced a browser workaround that already worked — which is why neither was urgent alone and both were cheap together. `get_season_clubs` returns a league season's clubs with the canonical `teams.id` and contract 136's identity in one answer and joins **no** fixture, closing the one real failure of the two-read join in `seasonClubs.ts`: identity harvested from a fixture window is lost for a club that window does not cover. `get_season_leaderboard_neighbourhood` answers who is immediately above the caller in one request rather than the eighty downward paging costs at rank 4,000, and computes no rank — the total order is contract 95's, and the suite runs both reads and requires them to agree. **Neither surface consumes them yet.** `MIG-UI-14`'s remaining two feed items are still open: the Championship action is blocked with `CUP-002` on `CUP-001`, and the private-invitation action needs a stable server-side invitation EVENT to derive an idempotent key from, which an invite code is not |
| 17 | Owner-approved capacity (`CAP-003`, `CAP-006`, `CAP-007`) | **`CAP-003` delivered as contract 181, 12 August 2026; the other two are measured and not built.** ADR 0028 §§ 3–5 removed the owner blocker from all three. `CAP-003` is a trigger on `public.league_members` taking a per-league advisory lock before it counts, with no organiser exemption and no reach into the other two games. **`CAP-006` needs no migration and is deliberately not applied here**: `predictor_internal.operating_limits.public_user_limit` already permits up to 250 by its own check constraint and by `set_operating_limits`'s validation, and stands at **50** on hosted Development — so raising it to the approved 250 is one `service_role` call, and ADR 0028 authorises the figure without authorising a hosted mutation. **`CAP-007` needs both**: `total_league_limit` carries `check (… between 1 and 20)`, so 1,000 cannot be stored without a destructive constraint replacement, and "active leagues" needs a league-season lifecycle that does not exist — completed/archived state, invite expiry, a persisted final-member summary, and active-count arithmetic that excludes archived rows, all without deleting settled evidence |
| 18 | Predictor Championship backend completion (`CUP-001`–`CUP-005`) | **`CUP-005` closed as contract 182, `CUP-001` as contract 184 and `CUP-002` as contracts 186 and 187, all 12 August 2026. `CUP-003` and `CUP-004` remain, and are now unblocked in fact rather than in principle: the bracket they both need exists.** **What `CUP-002` turned out to need, re-measured against the installed catalogue.** The register named three hard-coded places; there are **four**, plus a table read: the settle gate `sequence between 1 and 3`, the existence check `sequence between 4 and 3 + v_needed`, **two** `sequence = 4` lookups, and four reads of `cup_final_group_tables`, whose own ADR 0014 § 5.2 keys are measured over sequences 1 to 3 — which no amount of window generalising would have fixed. **The prerequisite's description was also not quite right, and the correction made the work easier rather than harder:** the group-stage span is not "stored NOWHERE" — `launch_season_cup` writes it to `bonus_competition_audit` as `leagueRounds` and `launch_season_cup_groups` writes it as `roundsNeeded`. It was evidence rather than an authority, so contract 186's typed record was still needed, but the backfill is an **exact read** of the recorded plan rather than a reconstruction. **Two blockers the description did not contain, both found by driving the gate rather than reading it.** Neither season launcher has ever set `bonus_competitions.draw_completed_at` — the tournament's `admin_draw_predictor_cup` does — so the gate refused every season Championship on its FIRST check, before any span expression was reached; and `admin_finalise_predictor_cup_groups` is granted to `service_role` alone, so generalising it without `admin_finalise_season_cup_groups` would have been another authority with no caller. **Contract 187 generalises in place rather than adding beside, which is the opposite of contract 169's choice and is argued rather than assumed:** contract 169 duplicated one `order by`, while a second qualification driver would copy § 6.1's target, § 6.3's six-key wildcard order, § 7.1's bands, § 7.2's bracket arithmetic and § 7.3's avoidance pass. The tournament is unchanged **by construction** — the span resolver returns exactly 3 for one, contract 169's dispatcher returns the tournament's own rows, and the window generator returns immediately. **One thing measured and deliberately not fixed:** `select_season_cup_format` chooses the group-stage length from the calendar and its `tail.rounds` is what is LEFT OVER rather than a computed knockout requirement, so the two can disagree — a field of eight over thirty matchweeks leaves two rounds and needs three. `ensure_season_cup_knockout_windows` fails closed and names the shortfall; making the launcher reserve knockout calendar changes what shape a competition takes and is `CUP-006`. ADR 0028 §§ 6–8 removed the owner blocker from all four. `CUP-005` was smaller than the register implied: measured on the installed catalogue, `settle_season_cup_tie` is reached by **nothing**, so the second authority was potential rather than actual, and contract 182 makes that permanent with a guard that fires on the conjunction ADR 0028 forbids — a guard contract 187 re-runs on the catalogue it builds and does not weaken, because nothing in it reaches the tie rule. `CUP-003` (the Penalty Number and bracket read) and `CUP-004` (walkover and withdrawal, with no invented score or prediction points) are independent of each other and are the remaining work |
| 16 | Private-play lifecycle integrity (issue [#728](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/issues/728)) | **Backend half delivered as contract 179 and contract 180, 12 August 2026; the frontend half and two findings remain open.** `PPLAY-001` and `MIG-UI-20` have their server authority — private containers the caller participates in, and one container opened by its own id — and `PPLAY-003` has read-only launch readiness differential-tested against the launcher. `PPLAY-002` is closed at the database: entering a game that reads the shared season prediction card establishes the card and writes no membership of the game that owns it. **What is NOT closed:** `/leagues` still calls `get_my_game_leagues` for bonus-game containers, so the player-visible defect persists until the frontend consumes contract 179; `PPLAY-004`'s success copy must follow an authoritative reread; and `PPLAY-005`'s five local-Supabase browser journeys do not exist. **`DFA-008` stays open**, because create/join RPCs existing was never the acceptance evidence |
| 12 | Bounded personal-data export | **Blocked** by issue [#272](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/issues/272) / `PRIV-007` |
| 13 | Product analytics | **Not to be started.** `MIG-UI-15` needs an ADR before any migration |
| 15 | Innovation Lab UI pass (`INNOV-*`) | **Delivered for twelve rows, 11 August 2026** — see `UI-F22` in [`design/ui-finalisation.md`](design/ui-finalisation.md) and the delivery record in [`product/innovation-lab.md`](product/innovation-lab.md). It is a **frontend** item and consumed no backend work: no migration, no hosted change, no new authority. The Innovation Lab **backend** foundations are a separate item — contracts 175 to 178 under ADR 0027 — which merged first and which this pass does not consume, because they are repository-only and absent from the generated database types. **Twelve rows did not ship**, each for a stated reason, and the ones with a server dependency are registered as `INNOV-*` rows in [`quality/accepted-requirements.md`](quality/accepted-requirements.md) rather than left in a candidate list |
| 20 | Private model and paper-betting laboratory | **Contract 186 adds the multi-model forecasting evidence and is hosted nowhere; contract 185 is hosted on Development and Production; the Hub-only admin UI is implemented at `/admin/ai` and awaits exact-head application publication.** Nine leagues share one fixture/prediction/grade/value/settlement/CLV lifecycle. Free Football-Data.co.uk history and twice-weekly fixture prices are the broad coverage lane; the paid Odds API runs through the secret-safe Edge boundary with a Production 500 / 450 monthly budget, while Development collection remains disabled. SportDB.dev remains behind its capability/licensing audit. The dashboard is private, requires the `competitions` administration capability, is absent from the Euro 2028 route tree, and has no platform result or scoring authority |
| 14 | ADR 0026's two deployments (`SITE-002`, `SITE-004`, `SITE-006`) | **Delivered in the repository, 11 August 2026** — `VITE_SITE_VARIANT` and one typed `SiteConfiguration` produce two genuinely different builds from one commit, with per-deployment head, sitemap and `robots.txt` and the Hub refusing the Euro tournament's routes. **What remains is operations, not engineering:** a second Netlify site bound to the Euro domain, and both origins in the Supabase Auth redirect allow-list |

Three of these are deliberately not engineering decisions. Organiser powers over
a managed entrant (7) appear in no accepted authority, so inventing them in a
migration would be a product decision taken by a schema. Erasure (12) is blocked
by `PRIV-007`. Analytics (13) is a data-processing decision and needs its ADR
first.

**Frontend consumption, as at 11 August 2026.** Contracts 160, 161, 164, 165, 167
and 168 are consumed, and contract 158's `rotate_league_invite_code` gained its
browser control. Contract 162 is reachable and **deliberately** not consumed
until its feed is complete — see item 4.

**Contracts 169 and 171 are consumed as of 11 August 2026, and the blocker this
paragraph used to record was not real.** It said the two were waiting on a
regenerated `database.types.ts`, on the reasoning that `table_source` (169) and
`members_returned`/`members_truncated` (171) were absent from the typed client.
Measured on the live branch instead of assumed: all three functions —
`get_season_cup_phase`, `get_league_match_picks` and
`get_season_league_matchweek_predictions` — are generated as `Returns: Json`,
because they return `jsonb`. A field inside a `jsonb` payload never appears in a
generated RPC type, at 168 or at 171, so regenerating could not have unblocked
anything and its absence never blocked anything. Every one of these payloads is
decoded by hand in `src/services/supabase/`, which is where the new fields were
added. Regenerating the types at 171 remains worth doing on its own merits; it is not a
dependency of this consumption. *(It was done on 12 August 2026 at contract
**178** rather than 171, because Development had moved. PR #704's generated
artefact was stale by then and was not merged; its documentation corrections —
which are the paragraph above — were carried forward instead.)*

**Contract 170 is still not consumed**, and deliberately: its action-centre feed
is incomplete and unhosted — Production holds zero cron jobs, so its driver has
no caller there — which is the same reason item 4 withholds contract 162. *(The parenthetical
"Production holds zero cron jobs" was false and is corrected rather than
deleted: Production holds ten. What is true and narrower is that no job there
calls this driver.)*

**Contracts 172 and 173 are not consumed, and neither is consumable by a browser at all.** Contract 172 schedules jobs and adds one administrator read; contract 173 adds a generator behind an existing read. What a frontend gains from the pair is that `get_my_actions` stops answering every player with an empty list — which is a reason to build the notification control item 4 names, not a new read to call. `admin_reminder_delivery_health` is still not shown anywhere.

**Contracts 174 to 178 are consumed as of 12 August 2026.** `database.types.ts` was regenerated against hosted Development at contract 178 through `regenerate-database-types.yml`, which is what made the five callable at all. Contract 174's staged calendar changes and contract 178's shadow-scoring report are both on `/admin/season`; contract 175's projection replaced the browser What-If derivation and contract 176's metrics replaced the browser Prediction DNA derivation, in each case DELETING the derivation rather than running it beside the read; and contract 177 carries the offline drafting `INNOV-020` had deferred. Contract 178 still has no scheduled caller, and its panel says "never checked" rather than inventing evidence — see `UI-F23` in [`design/ui-finalisation.md`](design/ui-finalisation.md).

## Domestic Frontend Alpha checkpoint — 8 August 2026

The accepted sequence in the UI execution authority still governs, but its first items are no longer all open:

- `DFA-003` reusable club identity and `DFA-005` deterministic parent navigation are implemented.
- `DFA-004` route convergence and `DFA-006` meaningful action/Play aggregation are partial and remain active.
- `DFA-007` is partial: real Scottish Matchweek 1 result truth and reload-persistent Matchweek 2 LMS are proven. The private Championship read contract is now applied and persistently verified in Development; PR #593 remains parked only on the real Team-SSO-protected signed-in desktop/phone browser acceptance. The ordinary MW1 scoring/rederivation proof and later MW2 Match Predictor points feed remain separate rehearsal gaps.
- The four-provider capability/terms audit is merged as PR #594. The first provenance-backed team-profile schema candidate is PR #595, with the Development-only retained-response population lane stacked as PR #596. Both remain deliberately behind the `DFA-007` hosted/signed-in dependency and add no provider-to-official-result authority.
- Production release posture is not inferred from any of these candidates; read the live status and operations inventory for the database, Netlify declaration and actually published artifact separately.

## Development operating model

[`adr/0024-development-environment-operating-model.md`](adr/0024-development-environment-operating-model.md) is the authority for how work reaches the development environment. It exists because the ceremony protecting production had been applied to a database with no data worth protecting, and the cost was paid on every schema change.

- development data is **disposable** until a closed external cohort holds it. That expiry is a *condition*, not a date: the model ends when real entrants exist, whoever notices first;
- an **additive** development migration applies through `.github/workflows/development-fast-lane-rollout.yml`, which proves additiveness by reading the pending migrations rather than trusting the dispatcher. Anything destructive is refused and sent to `.github/workflows/development-migration-rollout.yml`, the guarded lane: it takes its boundary as input rather than being pinned, names that boundary by **filename** rather than by a contract number, proves the live source against the database before applying, and requires a destructive batch to be acknowledged by quoting the target filename back. This line named `stage-c1-development-rollout.yml` until 11 August 2026, which is a spent one-shot pinned to contract 65 — so the documented fallback could not run, a gap first recorded at contract 103 and closed here;
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
16. **Lock the final signed-in visual language and representative product states** across phone/desktop, light/dark and reduced motion. **Substantially delivered 12 August 2026** — the `UI-F18` sweep was re-run by § 13's method over 126 width/theme/route combinations and is clean apart from one recorded decision. What is NOT delivered, and is not claimed, is the hosted signed-in journey: the Team-SSO boundary on that environment is a genuine gate, so those items are recorded **unavailable** rather than passed. See § 16 of [`design/ui-finalisation.md`](design/ui-finalisation.md).
17. ~~**Build the final public landing visual and scripted non-interactive phone preview** (`DFA-011`) from those settled signed-in states.~~ **Delivered 12 August 2026** for both site variants. The scripted preview is four deterministic frames carrying the weekly loop, from fixed local data with no clock, no randomness, no session and no write; it pauses off-screen and in a hidden tab, stops entirely under `prefers-reduced-motion` with every frame still reachable by hand, renders a complete first frame before any effect runs, and carries no control inside the device. The Euro variant gets a lifecycle card rather than a preview, because that deployment has no draw, no teams and no fixtures and a preview would be the placeholder the design authority forbids. See `UI-F20` in [`design/ui-finalisation.md`](design/ui-finalisation.md).
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
9. ~~**Enforce the 18+ first cohort before any external account exists** (`AGE-001`).~~ **Withdrawn by an owner decision of 11 August 2026.** This is a free football predictor and not a betting product, so the 18+ restriction, the age gate and the date-of-birth field are rejected rather than deferred. The step is struck through rather than deleted because this list is read to choose work, and a silently removed item is indistinguishable from one nobody has reached yet. The register row `AGE-001` in [`quality/accepted-requirements.md`](quality/accepted-requirements.md) carries the decision.

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

### What recent contracts meant for this sequence

**What each contract *is* lives in [`../CLAUDE.md`](../CLAUDE.md).** This table records only
the consequence for the executable sequence, which is the question this document exists to
answer. A contract with no consequence here is **absent rather than restated** —
until 11 August 2026 all eighteen were restated in full, byte-identical to
CLAUDE.md and to five other documents, and the copy was the whole reason the
same paragraph existed in seven places at once.

| Contract | Effect on the Domestic Frontend Alpha order |
| --- | --- |
| 133 | A bounded `DFA-007` enabler after contract 132: caller-owned private Championship instances and the selected player's fixture, table and schedule state. **Reorders nothing**, and changes no Championship scoring or settlement |
| 134 | Off the Alpha sequence entirely and **reorders nothing**. It is the `DB-005` least-privilege fix: the rate-limit log is revoked from both browser roles, and the public-table exposure guard becomes exhaustive rather than grant-only |
| 135–136 | The owner's ADR 0020 amendment made executable, and it **reorders nothing**: it closes the Stage D gap where a decoded provider response was archived every five minutes and read by nothing. Contract 136 serves `DFA-003` by giving the matchweek card the club code and colours `resolveClubIdentity` has always taken and never been given |
| 137 | A correction inside contract 136, **reordering nothing** |
| 138–139 | **Neither changes a rule**; both close a built-but-unreachable gap |
| 140–141 | **Neither reorders the Alpha** |

| 159–168 | Backend completion items 1–9 of the 11 August sequence. **Items 8 (Championship knockout, penalty reads, walkover handling), 10 (pagination sweep) and 11 (provider normalisation) remain**, and the organiser COMMAND half of item 7 is not an engineering decision |
| 169 | **Reorders nothing.** It corrects the ranking span of a table contracts 120 and 167 already show, and adds no surface |
| 170 | **Reorders nothing.** It completes a generator item 4 left open and registers the Championship qualification decision rather than taking it |
| 171 | **Reorders nothing.** It closes item 10 against measurement and records that the item's own description was wrong |
| 172 | **Advances items 4 and 5 and reorders nothing else.** It gives three existing entry points a schedule. It does **not** take the `SITE-007` sender decision, and Production is untouched |
| 173 | **Advances item 4 and reorders nothing.** The Championship's own action still waits on `CUP-002`, and `CUP-002` still waits on `CUP-001` |
| 174 | **Advances item 11 and reorders nothing else.** It closes the three `INGEST` rows and adds no provider-to-official-result authority: detection writes no fixture, and the tournament path is untouched |
| 186–187 | **Advances item 18 and reorders nothing else.** Contract 186 stores where a season Championship's group stage ends; contract 187 is `CUP-002` — it generalises the one qualification driver off the tournament's four hard-coded window sequences, appends the knockout windows a season has none of, and gives a `service_role`-only authority its competition-administrator caller. **`CUP-003` and `CUP-004` are now unblocked and are the remaining Championship work.** Neither contract adds a player-facing surface |
| 175–178 | **Reorders nothing, and deliberately.** ADR 0027 promoted four Innovation Lab candidates whose backends are safe and well defined; the Domestic Frontend Alpha order is untouched, and none of the four is a dependency of any item in it. Contract 178 is the one with a sequencing consequence: its verifier has no scheduled caller, so scheduling it belongs to the same rollout decision that would apply the batch |

| 188 | **Advances no platform item.** The private AI Lab's multi-model forecasting evidence, its provider identity custody and its quarantine authority. It closes the defect that made Production's first fifty-one forecasts unusable — a second, smaller alias table inside the Edge Function — and adds the private Bet Builder. It moves no scoring, lock, settlement, progression or reveal rule, and adds no player-facing surface |

*Current to contract 189.*

> **Contract 190:** adds the database actionability gate required before Production selected-model activation. The roadmap order outside that AI Lab prerequisite is unchanged.

> **Contract 191 — the weekly-season player address.** **Reorders nothing.** It
> closes the Stage 7.5 finding that a global weekly standings row cannot be
> opened: `get_season_leaderboard` and `get_season_leaderboard_neighbourhood`
> returned no identifier of any kind, so the one standings surface every entrant
> shares was also the only one whose names led nowhere. Every row now carries a
> season-scoped `playerRef` (`entries.id`), a server-decided `reach`, and the
> auth identifier ONLY where a profile will answer — which is the set that could
> already read it from `get_season_league_standings`. **No visibility rule
> moves.** Contract 151 keeps profile disclosure at a shared private league and
> contract 129 keeps its own per-matchweek reveal boundary; what changes is that
> contract 129's accepted rule is now reachable, which it never was for anyone
> outside a private league. The rule was found in THREE implementations —
> contracts 151, 157 and 176 — and all three are consolidated onto
> `predictor_internal.season_player_reach`, with a catalogue guard refusing a
> fourth. **The one product decision it does not take** is whether a same-season
> participant should also read another participant's PROFILE; that is registered
> as `PROF-001` rather than settled by a migration.

> **Contract 192 — position over time, and one season-long rivalry.**
> **Reorders nothing.** Two measured gaps, both of which the vNext Profiles/H2H
> stage reaches: a season could produce POINTS over time and could NOT produce
> POSITION over time, because `get_season_league_rank_movement` answers one
> matchweek inside one private league and `get_h2h_rank_history` is the
> tournament's, keyed on seven hard-coded matchday keys over `entry_totals`
> that a season never writes; and `get_season_head_to_head` compares two
> players over ONE named matchweek, so a season-long comparison meant asking it
> thirty-eight times. `predictor_internal.season_rank_history` derives
> cumulative points, rank and field size at every settled matchweek, reusing
> contract 94's ranking expression and contract 94's whole field — and the
> agreement is DIFFERENTIALLY TESTED rather than asserted, over a fixture built
> with deliberate ties so that `dense_rank` and `row_number` both fail it.
> `get_season_rivalry` answers a whole comparison in one request and counts a
> matchweek only when BOTH players banked it, so a late joiner cannot be handed
> a walkover record. Both take their permission from contract 191's single
> visibility authority, neither returns an individual prediction, and the
> rivalry read speaks only about matchweeks that are settled AND past their own
> lock. `MIG-UI-04` closes.

> **Contract 193 — `CUP-003`, an entrant can see their own tie.**
> **Advances item 18 and reorders nothing else.** `get_season_cup_player_view`
> (contract 133) is group-scoped throughout — it resolves a group id from the
> phase and lists only that group's members and fixtures — which was harmless
> while no season Championship could reach a knockout. Contract 187 ended that,
> so a qualifier had no browser-reachable read of the tie in front of them.
> `get_season_cup_bracket` returns the caller's live tie, their Penalty Number
> state, their progression, the bracket and the champion, reading every
> structural fact from the rows the canonical drivers wrote. **The opponent's
> Penalty Number is never returned**, matching `get_my_cup` exactly, and
> neither is whether they have submitted one. The Penalty Number WRITE
> authority is untouched and was already season-capable through contract 98.
> **Contract 198 — `CUP-006`, the knockout a Championship reserves.**
> **Closes the last Championship item and reorders nothing else.** The register
> asked whether the launcher must RESERVE calendar for the knockout it implies.
> Measured, the defect was the opposite way round from its write-up: the format
> that should NOT have a knockout invented one out of leftover rounds, and the
> format that MUST have one reserved nothing. The owner decided it on 18 August
> 2026 (ADR 0028 section 20) -- a knockout is what happens when the field is too
> big for one league -- and ADR 0014's worked table, which reported leftovers
> rather than required depth, is corrected in place. `cup_knockout_rounds` is
> extracted so the launcher that reserves and the gate that creates the windows
> share one answer.

> **Contracts 199 and 200 — the private AI Lab becomes operable for a weekend.**
> **Neither reorders the programme and neither touches a player-facing rule.**
> Contract 199 fixes what one piece of betting evidence is: the guard against
> advising a fixture twice asked about the prediction rather than the fixture,
> so every retrain minted a second paper bet on the same match and every
> betting metric counted one opinion several times. The historical rows are
> excluded from evidence rather than deleted. Contract 200 fixes the collector
> rather than the gate: the odds heartbeat only looked twenty-four hours ahead
> while the lab forecasts ten days, so prices aged past their own freshness
> limit between matchdays and every recommendation became `PASS_STALE_PRICE`.
> No freshness, edge, confidence, agreement or uncertainty threshold moves.
> Contract 201 then makes the lab legible: three bounded admin reads that
> answer every relevant fixture, why each one is or is not actionable, whether
> each stage of the pipeline is current, and what happened one row per fixture
> rather than once per model version that forecast it.
> Contract 202 closes the loop: a fixture more than two days away was forecast
> once and never again, so results imported afterwards never reached it and the
> README's own invariant was not being met. Predictions stay immutable — the
> vocabulary gains more horizon buckets so a better forecast is a new row rather
> than a discarded one — and a second weekly training pass runs after the
> weekend's results are published rather than before.
> Contract 207 pays off the second of Stage 12's carried backend debts. It puts
> the canonical entrant outcome on the Championship bracket read, so elimination
> is stated by the settlement authority instead of being absent, and it narrows
> four `stage <> 'group'` predicates so a split fixture is no longer offered as a
> knockout tie with a Penalty Number lane it has not got.

> Contract 206 pays off the first. It pins `get_season_cup_phase`'s membership
> lookup to the caller's current phase — the unfiltered version matched both of a
> split entrant's rows and took one silently, and it is what the production
> Football Hub calls, not only the vNext lane. Neither number is settled while
> PR #920 is open: a contract number is the migration's position in the chain.

> Contract 205 fixes what the Stage 12 audit found: the canonical Championship bracket read
> raised an exception for every entrant in a competition that had reached its split, because
> its seed lookup did not say which membership phase it meant. One line, pinned to the
> initial membership — the only phase a seed can live in. Nothing calls the read yet; Stage
> 12 is about to.

> Contract 204 fixes what the rehearsal found: the AI Lab dashboards answered a
> league question with a lab-wide quarantine count. The number is scoped now, and
> the suite that always asserted it seeds a second league so it can never pass
> vacuously again.

> Contract 203 finishes the loop at the surface: the Bet Builder read takes the
> current decision from the one place that defines it, so a superseded BET
> cannot be offered as a leg and the browser stops keeping a second definition
> of "current"; and the same read carries the coverage counts, so a builder with
> no legs says why rather than looking broken.

> **Contract 197 — one chronological calendar across the player's competitions.**
> **Advances the Stage 8 Matches work and reorders nothing else.** Counted over
> `public` at contract 196, every fixture read was scoped to one season, one
> fixture or one matchweek. Nothing answered "what football is on across
> everything I am in", which `docs/product/vnext-ia-lab.md` section 7 names as
> the Matches shape Stage 8 settles on -- so that system could only have been
> built on a browser loop, and the merge is a SORT across competitions, which
> the client can neither page nor bound. This adds the read and designs none of
> the system. The per-fixture card is contract 111's, and the suite proves that
> by running both reads over the same window and requiring identical objects
> rather than asserting the copy was faithful.
>
> **Measured while doing it, and deliberately not taken.** The addressable
> Match Centre (`get_season_fixture`, contract 148) returns the fixture card and
> its competition and nothing else: no prediction of the caller's, no consensus,
> no league picks. The per-fixture reads it would compose are matchweek-scoped
> (`get_season_prediction_consensus(tournament, matchweek)`,
> `get_season_league_matchweek_predictions(league, round)`) or tournament-only
> (`get_league_match_picks(league, match_id)`, which takes a `matches` id and so
> cannot answer for a season fixture). A Match Centre therefore fetches a whole
> matchweek to render one match. That is a payload cost rather than a browser
> loop, and WHAT belongs in a Match Centre is a Stage 8 design decision that
> section 15 of the IA lab explicitly did not take — so composing a read for it
> now would be writing against a shape nobody has decided, which is the mistake
> contract 170 refused to make and this records rather than repeats.

> **Contract 196 — a player is told what happened to them in a game.**
> **Advances the cross-competition attention work and reorders nothing else.**
> It does two things, and the second is only possible because of the first.
> `bonus_competition_entrants.updated_at` was maintained by four of the seven
> writes to `outcome` and not by the three in the Championship authorities, so
> the column that dates an entrant's outcome was right for some rows and stale
> for others -- and nothing reading it could tell which. Both Championship
> authorities now set it, on the writes they already performed; no outcome
> changes and no ADR 0022 rule moves. The generator then tells `eliminated`,
> `champion` and `qualified`, and deliberately not `active` or `survived`,
> because a per-round survival written for every survivor of every Last Man
> Standing round is not news. The expiry sweep gains a fourth re-read so a
> rescore that REVERSES an outcome closes the recap that said otherwise.
> `league_invitation` is now the only declared action type without a generator,
> and it needs an invitation event the schema does not have.

> **Contract 195 — the action centre learns about the Championship tie.**
> **Advances the cross-competition attention work and reorders nothing else.**
> `player_action_items_type_allowed` has admitted `cup_penalty_number_due`
> since contract 162 and no generator ever wrote one; contract 170 said why,
> and said it honestly — a season had no bracket to act on. Contracts 187 and
> 193 gave it one, so the reason is gone. Every condition is read from
> `submit_cup_penalty_number`'s own authorities rather than restated, and the
> deadline is the window's FIRST KICKOFF, which is not the window's lock: a
> season Cup round locks a buffer earlier, so an item keyed on `window_id`
> would be swept away while the write authority was still accepting a number.
> The item carries its own key and the expiry sweep gains a third re-read.
> Every deadline-shaped action type now has a generator; `game_consequence`
> and `league_invitation` remain declared and unwritten, which is the next
> attention-system gap rather than a claim about this contract.

> **`CUP-004` and `CUP-006` remain the Championship work.**

> **Contract 194 — `CUP-004`, eligibility at tie settlement.**
> **Advances item 18 and reorders nothing else.** Counted over the installed
> `admin_settle_predictor_cup_round`, the terms `game_memberships`,
> `disqualif`, `withdraw` and `left_at` appear zero times: the driver decided a
> knockout tie from submission and points and never asked whether either
> entrant could legally contest it, so a disqualified or withdrawn entrant who
> had submitted before being removed still won and advanced. The eligibility
> branch sits above the existing submission ladder, which is carried through
> unedited because ADR 0022 forbids altering the "neither submitted" rule and
> one function serves the tournament too. Exactly one eligible entrant
> advances, the reason is audit evidence, no score or prediction points are
> invented, and a tie neither may contest refuses rather than fabricating a
> winner. **`CUP-006` is the remaining Championship work.**
