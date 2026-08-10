# Design authority — start here

**The latest design document is
[`ui-finalisation.md`](ui-finalisation.md) (owner direction, 10 August 2026).**
It is the current UI authority for the signed-in weekly product and says what
"finished" means for each surface. The target design it finalises is
[`hub-architecture-and-modernisation-plan.md`](hub-architecture-and-modernisation-plan.md)
(revision 1.5, 4 August 2026), which remains the answer to "what should this
look like when it is done" and is unchanged except where the finalisation
direction supersedes it on presentation.

This folder exists because that question previously had no single answer. Design
intent was spread across `docs/design-system.md` (component-level, Euro-era),
ADR 0020, ADR 0021 and ADR 0023 (product model, sharing, information
architecture), with no document describing the finished product. Anyone asking
"what are we building towards" had to assemble it.

| Document | What it decides | Status |
| --- | --- | --- |
| [`ui-finalisation.md`](ui-finalisation.md) | What "finished" means for the signed-in weekly product: responsive desktop composition and the persistent rail, the viewer-timezone kickoff contract, Player & League Insights as a pillar, the Match Centre and league-workspace targets, unified private create/join, the `UI-F01`–`UI-F18` sequence and the separated backend queue | **Current UI authority**, accepted 10 August 2026 |
| [`hub-architecture-and-modernisation-plan.md`](hub-architecture-and-modernisation-plan.md) | Target architecture, information architecture, page/journey design, the complete UI state model, feedback hierarchy, rollout method, and — in Appendix E — the public acquisition landing page and standalone Euro 2028 boundary | **Current target design (rev 1.5)** |
| [`hub-landing-prototype.html`](hub-landing-prototype.html) | The executable form of Appendix E: the public landing page and an accurate signed-in Hub preview | **Current prototype**, conforms to E.3/E.4/E.7 |
| [`ui-modernisation-execution.md`](ui-modernisation-execution.md) | How the target design becomes production code: the reconciled migration order, the `src/premium/**` reference-only classification (guarded by `tests/design/premiumPrototypeBoundary.test.ts`), the approved tooling phases and the first-slice acceptance criteria | **Current delivery sequence**, adopted 5 August 2026 |
| [`../design-system.md`](../design-system.md) | Component-level rules built for the Euro tournament: score input, match card, group tables, bracket, navigation | **In force for what exists**; superseded on presentation by the plan where the two describe the same surface |

## The Euro 2028 boundary moved — 6 August 2026

Appendix E of the target plan describes the public acquisition landing page and a "standalone Euro 2028 boundary". [ADR 0026](../adr/0026-public-site-separation-shared-accounts-and-euro-2028-acquisition.md) has since decided what that boundary actually is, and it is stronger than a section of one site:

- **two separate frontend deployments over one shared backend** — the weekly platform on the eventual umbrella-brand domain (`SITE-002`, `SITE-003`), Euro 2028 on the purchased tournament domain (`SITE-004`);
- **while Euro 2028's publication state is hidden, it must not be promoted anywhere on the weekly platform** (`EURO-001`, `EURO-003`) — not on the landing page, not in Hub discovery, not in a competition card, navigation, page metadata, the sitemap or an Open Graph preview. The weekly landing target is domestic;
- **the Euro site's own surfaces are a separate, later design.** They are not Appendix E with different copy, and this folder does not yet hold them.

This changes **presentation scope only**. It sets no scoring, lock, membership, settlement, progression or reveal rule, consistent with the boundary this authority already observes. Where Appendix E's existing domestic landing hierarchy and design decisions do not concern Euro, they are unchanged.

The removal itself is implementation work and is **not done**: `EURO-001` in [`../quality/accepted-requirements.md`](../quality/accepted-requirements.md) records that the weekly Hub still lists Euro 2028 today.

## What this authority does and does not do

It is a **presentation and delivery** authority. Its own Document Control section
says so: *"Accepted ADRs, later amendments, migrations, executable tests and
explicit rule authorities govern implementation … This plan may organise delivery
and presentation, but must not silently change those rules."*

So it may not change scoring, locks, memberships, settlement, progression or
visibility rules. Those remain with the ADRs, the migrations and the executable
tests. Where the plan restates a rule (Appendix D.1), it is *recording* the
repository's rule, not creating one — and if the restatement and the code
disagree, the code and its tests win, and the disagreement is a defect in the
document.

## Read the baseline before you act on it

**The plan reviewed a snapshot of 93 migrations and 69 pgTAP suites** (§2.1).
That count is a document-input fact, not a live repository gauge. The repository
has moved substantially beyond the snapshot; read
[`../quality/current-status.md`](../quality/current-status.md) and
`config/deployment-contract.json` for the moving head rather than copying a count
from this design index.

The merged delta known at this 5 August review is:

| contract | what landed after the plan snapshot |
| --- | --- |
| 94 | `standings.ts` SQL parity — the season table, ranked |
| 95 | the bounded season leaderboard read, limited to league co-members |
| 96 | Cup tie refusal-order parity fix, found by differential sweep |
| 97 | server-only provider-response custody |
| 98 | the Cup RPC layer taken off the tournament link — the Penalty Number target and lock instant |
| 99 | an `invalid` automatic-submission outcome must carry a reason |
| 100 | REL-001 — the Bonus Games rederive joins the tournament lock |
| 101 | Euro post-lock reveal stops gating on shared leagues |
| 102 | the Predictor Championship split stage persisted, phase-aware |
| 103 | competition instances became repeatable through lifecycle-aware uniqueness |
| 104 | operational callers became live-instance explicit and current reads terminal-aware |
| 105 | one-parent split ancestry and a continuing table derived across both phases |
| 106 | tournament Bonus rederivation remained correction-safe after completion |
| 107 | the idempotent LMS wipeout restart creates a linked successor and copies no picks, cycles, projections or windows |
| 108 | a restarted competition cannot inherit a round that opened or locked before its predecessor finished |
| 109 | the next eligible future league matchweek is derived from the existing lock authority and the successor calendar is created exactly once |
| 110 | the season Predictor Championship gets rounds it can be played over, which no season competition had ever had |
| 111 | a season Championship is launched — drawn, scheduled and given its round-robin fixtures |
| 112 | a provider's identifiers can be related to our clubs, rounds and seasons — no surface, and no fixture written |
| 113 | a round knows the span it is played over, so a rescheduled fixture has somewhere to resolve to — still no surface |
| 114 | the season matchweek card reaches the browser — the read and three own-entry writes the UI-04 surface renders |
| 115 | the database can call a provider on a schedule at last — no surface, no fixture imported, and nothing polled until an operator records a target |
| 116 | the season Last Man Standing round reaches the browser — the entrant's own round, its fixtures, their pick and the server's survival verdict |
| 117 | a provider kickoff change reaches the fixture automatically — still no surface, and a moved match keeps its matchweek heading |
| 120 | the Championship's phase and its continuing table reach the browser — the split surface can show which phase an entrant is in and the table they are actually in |
| 119 | a rescheduled fixture stays editable to its own kickoff — the surface must show that one card in a locked matchweek is still open |

The Contract 107–109 backend restart lifecycle is complete. Contract 107
creates the linked successor, Contract 108 refuses inherited past rounds, and
Contract 109 derives the first eligible future league matchweek from the existing
lock authority and creates the successor calendar exactly once. When fixtures
are incomplete and no lock can be derived, the successor remains honestly
unavailable rather than guessing. Contract 110 gives the season Predictor
Championship the same thing from the other end: rounds it can be played over at
all, which no season competition had ever had, and Contract 111 launches one.
Contract 112 adds the provider identity map, which has no surface at all — it is
what a real fixture list must pass through before any of these screens can show
one — and Contract 113 gives each round the span it is played over, so a
rescheduled fixture has somewhere to resolve to. Contract 114 is the bounded
browser path the UI-04 Match Predictor surface was waiting for, so the season
card can be read and written by its own player at last. Contract 115 has no
surface either, and is listed for the same reason as 112: it is what finally
lets the database call a provider on a schedule, and every screen that shows a
real fixture list depends on something eventually doing that. Contract 117 is the first piece of that
arriving on its own: a provider kickoff change now reaches the fixture
automatically, and a moved match keeps the matchweek heading it was scheduled
under — a presentation rule as much as a data one, and the reason these screens
sort by kickoff while labelling by round. Contract 120 gives the Championship surface the phase and continuing table it will need: an entrant's own phase, their group and its table, from the authority that owns that phase. It is a read and changes no rule. Contract 119 adds the state that follows from Contract 121 adds the season play-context read — which season a URL means and which matchweek its card opens at — which is what lets that surface be registered on a production route. Contract 122 makes ADR 0012's two retention tables answerable: the monthly table, whose month comes from a round's `window_opens_at` read in the competition's own timezone, and rolling form, which needs only round ordinal. Contract 123 keeps that window fresh: contract 117 moves the kickoffs contract 113's stored span is derived from, and a refresh whose proposed span would overlap another round's window leaves the old window intact and queues a row for review rather than raising, which is what stops a derived view's recomputation being able to fail a provider import. Contract 124 then makes the Championship split actually happen — the phase-transition driver contracts 102, 105 and 120 were all waiting on, reading its plan from the launch record, carrying points and draw numbers, eliminating nobody, and letting the smaller half finish its round-robin early rather than giving it a calendar of its own. Contract 125 then closes the one that was holding all of them: a season fixture could not be given a result at all, so nothing downstream of a result had anything to show. Contract 126 then narrows a refusal that was firing too early: leaving a Last Man Standing competition blocked re-entry from the moment it was published, when ADR 0013 closes entry only once the first round locks. Both are derived views and neither touches the canonical total. Contract 127 then opens a season competition for play at all: measured, both season Last Man Standing competitions hold no round and no setup row, and both season Championships hold no group because contract 111's launch driver has never had a caller — so an administrator call writes the public Classic setup ADR 0022 pins, generates a first instance's calendar from the same derivation contract 109 uses for a successor, and hands the Championship to contract 111 unchanged. It is an operator action rather than a job, because the launch fixes the draw at whatever field size it finds. Contract 128 then gives a season league a standings table of its own: `get_league_members` derives every metric from `standing_metrics`, `score_events`, `matches` and `match_predictions`, which a competition season writes none of, so a league on a season returned every member on zero in alphabetical order with no error — the sixth instance of that shape. It is a new read rather than a widened one, because ADR 0012 ranks a season on cumulative points and pairs the total with matchweeks played while the tournament table carries five approved final tie-breakers; the totals come from `season_standings` so a league cannot disagree with the season, the rank is recomputed inside the league because a private league is its own table, and the tournament read now refuses a season league by naming the one that answers. Contract 129 then gives a season a head-to-head at all — `get_rival_entry` reads `entry_totals`, `match_predictions` over `public.matches` and `predicted_progression`, none of which a competition season writes — and its reveal boundary is the MATCHWEEK's own lock rather than the one tournament instant, hiding rather than revealing when a round's kickoffs are incomplete. Contract 130 adds the prediction consensus keyed on the round for the same reason, reusing contract 61's minimum cohort of ten but counting the entries that predicted THAT matchweek, since a season with fifty entrants of whom six played matchweek 30 is exactly what the protection exists for. Contract 131 makes contract 122's retention tables able to name their players, optionally and off by default, adding the flag as a required fourth parameter and retiring the three-argument form by revoking rather than dropping it, and mapping over what the parity-checked authorities returned so their order and their agreement with `standings.ts` are untouched.
both: inside a locked matchweek, one card can still be open, because that
fixture was moved and locks at its own kickoff. A surface that greys the whole
matchweek would be showing a rule the platform no longer has. Contract 116 does
have a surface ahead of it: it is the read a season Last Man Standing round needs
before one can be drawn at all, since the tournament read returns a season round
with no fixtures in it.

Contract 111 draws a Championship's initial group and places its round-robin
fixtures onto them. The surface must not read that as a finished Championship: what runs
is the private, organiser-created shape, and the public hundred-entrant field
takes a multi-group draw that is not built yet. Product surfaces must render
those real states; backend completion is not evidence that the player or
organiser journey exists.

None of these changes presentation authority into scoring or lifecycle authority.
**Appendix D.2's reconciliation list predates them** and must be checked against
the live status before being treated as outstanding work.

**The one item that needed care is now settled.** D.2 listed *"post-lock reveal
— existing rival/profile RPCs still contain shared-league gates"* as drift to
remove, while contract 95 deliberately **applied** a co-member gate to the
season leaderboard. [ADR 0025](../adr/0025-lms-restart-lifecycle-cup-split-persistence-and-reveal-scope.md)
confirms these are **different scopes with no behavioural conflict**: D.2
concerns Euro Original Predictor post-lock entry and profile reveal, contract 95
concerns the season Main Predictor leaderboard and requires an `entries` row in
that competition season rather than co-membership. Contract 95 is unchanged; the
obsolete gates come out of the Euro post-lock RPCs only, and D.2 now says so in
its own text.

## The prototype's one repository-side change

The supplied prototype inherited its semantic colours (`--success`, `--warning`,
`--live`, `--danger`) into light mode from the dark ramp. On the light surfaces
they rendered at **1.3–2.2:1**, so the tick marks, rank deltas, "Predictions
saved" state and the authentication error all failed WCAG AA.

The repository copy restates them for light mode, solved against `#e7ebef` — the
**darkest** light surface, which is the worst case for a dark foreground — and
`--danger` additionally against the 10% tint it composes for `.auth-error`, which
is darker still. Hues are preserved to within one degree.

| token | dark (unchanged) | light (was inherited) | light now | worst case |
| --- | --- | --- | --- | ---: |
| `--success` | `#54d49a` | 1.56:1 | `#16794c` | 4.53:1 |
| `--warning` | `#f2c75c` | 1.34:1 | `#8a6301` | 4.53:1 |
| `--live` | `#ff7357` | 2.24:1 | `#cf2200` | 4.52:1 |
| `--danger` | `#ff7d95` | 2.03:1 | `#c70025` | 5.07:1 |

This is the same defect class the repository already guards against for
`--mut` (PR #344, "never a foreground"), and Appendix E.4 keeps theme switching a
functional requirement of the prototype — so it is a conformance fix, not a
redesign. `tests/design/landingPrototypeContract.test.ts` now holds it, along
with the E.3 section order, the E.4 token discipline and the E.7 acceptance
checklist.

## Related authority

- [`../adr/README.md`](../adr/README.md) — decision index; ADRs 0020, 0021 and
  0023 supply the product model, sharing priority and information architecture
  the plan builds on
- [`../quality/current-status.md`](../quality/current-status.md) — the only live
  implementation and hosted-status authority
- [`../../AGENTS.md`](../../AGENTS.md) — operating rules and authority order

| 118 | the games hub stops showing a season a stale round — its windows can settle because its fixtures are finally visible to the read |

Contract 118 is a correction rather than a presentation change: no surface moved, but a season competition's hub card had been stuck on its first locked round because the read returned it no fixtures.

## Contract 132 design boundary

Real domestic fixture adoption now has a backend publication gate: provider evidence is staged first and a complete initial season is approved explicitly. UI surfaces may rely on canonical scheduled fixtures after approval, but must not treat provider score evidence as an official result until the protected result-confirmation path has run.

> **Contract 133 boundary (8 August 2026):** Contract 133 supplies server-owned opponent/table/fixture data for the accepted Predictor Championship My Fixture / Table / Fixtures surfaces. It changes no visual authority and does not make History available.

> **Contract 150 boundary (10 August 2026):** Contract 150 closes `MIG-UI-03`: how a league table moved over one settled matchweek. The gap to a rival is already derivable in the browser because both players are on screen; movement is not, because "5th to 3rd" needs the table as it stood BEFORE the matchweek and history is not on screen. It is **derived, never stored** — `season_matchweek_scores` already holds every banked total with its round, so the before-table is the sum of the rounds ordered before it; a snapshot would add a second thing that can disagree with the first and would need backfilling. Only **settled** matchweeks move anything: `settled_at` is the gate rather than the presence of a row, because a matchweek being scored is one whose totals are still changing and reporting a climb from it would show a player a position they never held. An unsettled matchweek is answered `settled: false` rather than refused. Ordering is by round **ordinal**, never by `settled_at`, so a postponed matchweek that settles late does not appear to come after matchweeks played after it.

> **Contract 149 boundary (10 August 2026):** Contract 149 closes `MIG-UI-01`: what a private league predicted, once the matchweek has locked. The tournament has had `get_league_match_picks` since before a season existed and a season had nothing, so the Match Centre's "Your leagues" section, the mobile per-fixture comparison, the desktop matchweek matrix and every "See league predictions" journey had no read to call — the same shape of gap as contracts 116, 118, 120, 122, 124, 128 and 129. **The reveal boundary is the matchweek's own lock**, resolved server-side from `season_matchweek_lock_at` with no client-supplied time anywhere, because a boundary a caller can pass an argument to is not a boundary. Before the lock it **hides rather than refuses** — a refusal would be indistinguishable from "you may not see this league" — and hides completely: no member rows, not even redacted ones, and a predicted count of zero rather than a leak of who has played. Membership is the boundary rather than game entry, as contract 128 chose, so a member who entered nothing appears with no predictions rather than being dropped. Points come from `season_matchweek_scores` and are null until settled, never recomputed, so a league cannot disagree with the season about what a matchweek was worth.

> **Contract 147–148 boundary (10 August 2026):** Two bounded season reads, closing `MIG-UI-12` and `MIG-UI-11` from the UI finalisation register. Contract 147 is the published weekly catalogue with its **route slug**: publishing a league previously needed a frontend code change for it to exist, because every catalogue read began from a static array and `competitions.slug` is revoked from every browser role by contract 121 — so a frontend could learn a season existed and not learn where it lived. It returns league seasons only, which is an `EURO-001` safety property rather than a filter of convenience: a catalogue enumerating `tournaments` without discriminating on kind would put Euro 2028 on the weekly platform's own discovery surface. Draft seasons are excluded, so Production correctly returns nothing until one is opened. Contract 148 is one season fixture addressed by its own id, a sibling of contract 139 rather than a widening of it, returning contract 139's entry shape field for field so a fixture looks the same whether it arrived from the calendar or from a link — `result` stays null until the fixture is played and a provider opinion stays in `live`. Neither adds a rule, and both are granted to `authenticated` only: making a third function anonymously executable is a publication decision, and this is not where it gets taken.

> **Contract 146 boundary (10 August 2026):** Contract 146 makes the provider poll affordable, and makes its question move. Measured on hosted Development: the one live target polled every five minutes — 288 requests a day — while the next fixture in either league was eleven days away, and it asked for a date range already in the past, so it could never have seen the fixtures it was paid to find. `cadence_minutes` keeps its name and becomes the **idle** cadence, now defaulting to one call a day; `live_cadence_minutes` applies only inside a window that opens `live_lead_minutes` before a kickoff and closes `live_tail_minutes` after it, and only while that fixture still has no result — so contract 135 writing the official result is what ends the expensive polling, rather than anyone deciding it should. A stored path may now carry `{{date:+N}}` placeholders resolved at dispatch in the competition's own timezone, so the window rolls forward on its own. It records no poll target, writes no fixture, result or status, grants nothing new to a browser role, and moves no scoring, lock, settlement, progression or reveal rule.

> **Contract 145 boundary (10 August 2026):** Contract 145 closes the atomicity half of risk-register `DATA-007`. `enforce_rate_limit` counted, compared and then inserted with nothing between the read and the write, so under the read-committed isolation the Data API uses, concurrent transactions for one caller each observed a count below the ceiling and all proceeded — a limit that could be overshot simply by running the attempts in parallel, which a scripted client does and a human never does. It now takes a transaction-scoped advisory lock keyed on the caller before the prune, the count and the insert, the same idiom `20260727191942_operating_cap_enforcement.sql` has always used for the two site-wide counters. One key per caller and never per action, so the function cannot hold two of its own locks and cannot deadlock against itself. It moves **no** relation, policy, trigger, threshold, grant or rule, and changes no scoring, lock, settlement, progression or reveal. It closes the atomicity half **only**: invalid operations still consume no limit, the expensive read RPCs are still unbounded, and there are still no edge/IP controls or alerting — so `DATA-007` stays open, reduced, and `SEC-001` is reduced rather than closed.

> **Contract 144 boundary (9 August 2026):** Contract 144 gives an already-mapped provider team a place to keep its current provider-supplied profile facts — name, short code, founded year, country, venue and image reference — in `predictor_internal.provider_team_profiles`, with a definer writer that derives provider and fetch instant from contract 112's custody row rather than accepting them from its caller, refuses evidence older than the fact it would replace, and advances `last_changed_at` only when a fact actually changed. It is **not** a second identity system: `provider_entity_map` remains the authority for which provider team is which of ours, and the profile row is keyed on that mapping. It is **not** a result path — nothing in it writes a fixture, score, status, lock, settlement or progression, and missing enrichment stays a normal no-data state rather than becoming a game-correctness dependency. The writer is granted to **nobody**, `service_role` included, so the provider poll gains no enrichment side effect merely because storage now exists; a Development backfill is an explicit operator action through its own `workflow_dispatch` job, which refuses unless Development already holds contract 144 and refuses the Production project by name. Provider image URLs are retained for provenance only and establish no right to render or re-host club imagery — the shirt a player sees still comes from contract 136's owner-controlled reference.

> **Contract 143 boundary (9 August 2026):** Contract 143 implements ADR 0026's `EURO-002`: one server-owned Euro 2028 publication state with the lifecycle `hidden -> prelaunch -> registration-open -> live -> completed -> archived`, defaulting to `hidden` so publication fails closed before any owner acts. A bounded `euro_publication_state()` read exposes the state and the instant it last changed and nothing else, and it is the second function an anonymous visitor may execute — deliberately, because ADR 0026 requires the public site and its route guard to fail closed from server truth rather than from a client-side catalogue filter. Mutation is narrower than ordinary competition administration: `admin_transition_euro_publication_state` is granted to `authenticated` only, refuses inside on `super_admin`, advances one adjacent state at a time, and demands both an expected current state and a reason it appends to an immutable history. **It does not publish Euro 2028 and it does not address `EURO-001`** — Euro is still reachable from the weekly platform, which stays a recorded defect. `EURO-003` and `EURO-004` are its consumers and remain unbuilt.

> **Contract 142 boundary (9 August 2026):** Contract 142 maps SportMonks state 22 to `in_play`, measured from retained payloads rather than documentation — the same fixture carried that token with a different score at different times, and a score cannot change after full time. It writes no result and settles nothing: it fixes the live projection for a fixture observed during its second half. It is the first thing contract 135's fail-closed vocabulary and contract 138's review queue found together, and it is the case those two were built for. No visual authority moves.

> **Contract 140–141 boundary (9 August 2026):** Contract 140 gives a Leave control the fact it needs to predict itself — `leave_competition_game` refuses once a `bonus_score_events` row exists for the caller and nothing exposed that, so the dashboard could only render a control the server would refuse or hide one that would have worked. Contract 141 derives recent club form and club head-to-head from settled season fixtures alone, which the enrichment plan classes as derive-ourselves work and which contract 135 made possible by producing results at all. Neither reads a prediction, an entry or a score event, and neither costs a provider request. Contract 141 is the data behind form and head-to-head context; it changes no visual authority.

> **Contract 138–139 boundary (9 August 2026):** Contract 138 gives an administrator the provider review queues nothing could see — measured, seven append-only queues existed and the only browser-reachable functions naming any of them were contract 132's two decision writers, so an administrator could approve a calendar they could not see and could not see the other six at all. It reads all of them bounded per section and lets an administrator acknowledge an item, which contracts 117 and 123 had always anticipated with a `reviewed_at` nothing ever set; acknowledging is never a decision about the item. Contract 139 gives a season a fixtures read at all, ordered by kickoff and labelled by round, closing the ADR 0020 amendment item that had no implementation because a season had no fixture list: a match postponed out of matchweek 5 into November now sorts into November while still saying Matchweek 5. Contract 139 is the data behind a Matches surface; it changes no visual authority.

> **Contract 137 boundary (9 August 2026):** Changes no visual authority. It makes two Premier League
> clubs actually render in their own colours, which contract 136 intended and did not achieve for them.

> **Contract 135–136 boundary (9 August 2026):** Contract 135 changes no visual authority; it is the
> provider result rule and its driver. Contract 136 does change what a surface can draw with:
> `ClubIdentity` has always taken a three-letter code and a colour string and has never been given
> either, so every club rendered in the neutral fallback. The matchweek card now carries both, from
> an owner-controlled reference rather than from a provider, and a club the reference does not name
> renders exactly as it does today. No crest, logo or provider image is introduced — the capability
> audit's media rule is untouched.

> **Contract 134 boundary (9 August 2026):** Contract 134 changes no visual or presentation authority. It is a privileges-only database correction on the rate-limit log, closing risk-register `DB-005`, with no user-visible surface.
