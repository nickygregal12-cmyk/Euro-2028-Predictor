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

### What recent contracts meant for the design authorities

**What each contract *is* lives in [`../../CLAUDE.md`](../../CLAUDE.md).** This table records only
the consequence for visual and presentation authority, which is the question this document exists to
answer. A contract with no consequence here is **absent rather than restated** —
until 11 August 2026 all eighteen were restated in full, byte-identical to
CLAUDE.md and to five other documents, and the copy was the whole reason the
same paragraph existed in seven places at once.

| Contract | Effect on a visual authority |
| --- | --- |
| 133 | **None.** It supplies server-owned opponent, table and fixture data for the accepted Championship surfaces, and does not make History available |
| 134 | **None.** A privileges-only database correction on the rate-limit log, with no user-visible surface |
| 135–136 | Contract 135 moves **no** visual authority — it is the provider result rule and its driver. **Contract 136 does change what a surface can draw with**: `ClubIdentity` has always taken a three-letter code and a colour string and had never been given either, so every club rendered in the neutral fallback. The matchweek card now carries both, from an owner-controlled reference rather than a provider, and a club the reference does not name renders exactly as before. No crest, logo or provider image is introduced |
| 137 | **None.** It makes two Premier League clubs actually render in their own colours, which contract 136 intended and did not achieve for them |
| 138–139 | **None.** Contract 139 is the data behind a Matches surface |
| 140–141 | **None.** Contract 141 is the data behind form and head-to-head context |
| 142 | **None** |

| 159–160 | **None.** Contract 160 supplies the Table surface the Matches section has had no data for |
| 161–164 | Contract 162 supplies the read state the AppBar's absent notification control was waiting on; 161 supplies season history; 164 supplies the Last Man Standing field view |
| 165–168 | Contracts 165 and 168 supply the organiser and administration panels; 167 supplies the Championship group-stage view |
| 169 | No new surface. The Championship group-stage view and the phase view now rank a season over the season, and `table_source` lets a surface say which authority ranked it |
| 170 | The action centre finally has something to show most players: the matchweek card, with `predicted` and `fixtures` so the item reads "6 of 10" |
| 171 | A league prediction list can now say "showing 200 of 205" instead of presenting a truncated list as the whole league |
| 172 | The action centre's inbox stops being permanently empty, so the AppBar's absent notification control finally has something behind it. It also adds an administrator health panel's data |
| 173 | The Matchweek Recap gains a feed item of its own, carrying the banked points, the fixtures scored and whether the Joker was played |
| 174 | `/admin/season` gains a second queue to show: staged calendar changes, each with a decoded proposal, what we hold, named warnings and blockers, and a decidable flag. **Not consumed** |
| 175 | A live Match Centre may show what the current score is worth and what the next goal would do, labelled as a projection and never as points. The read states per fixture whether its basis is official or provisional, so the surface never has to guess. **Not consumed** |
| 176 | A player profile may show how somebody predicts, with every denominator supplied so the surface never invents one. Metrics below the sample minimum arrive flagged rather than hidden. **Not consumed** |
| 177 | An offline draft surface can submit a batch and render a per-fixture answer — accepted, locked, conflicted — instead of one exception. A conflict arrives with both the stored and the drafted score, which is exactly the choice such a surface has to offer. **Not consumed** |
| 178 | `/admin/season` gains a third thing it could show: the latest scoring verification and any disagreement it found. **Not consumed** |
| 179 | `/leagues` gains the read it needs to show private Last Man Standing and Championship containers at all, and `MIG-UI-20`'s private workspace gains its server half. **Not consumed** |
| 180 | No presentation change. A Championship-only player can now reach the matchweek card, which is a capability rather than a screen |

| 181 | A join that would exceed a hundred members is refused by the server with `league_member_limit_reached`, so an invite surface can say "this league is full" rather than failing opaquely. **Not consumed** |

| 182 | No presentation change whatsoever. A guard over which function ranks a Championship group |

| 183 | The favourite-club picker loses its two-read join, and a leaderboard can show the caller's neighbours without paging to them. **Not consumed** |
| 185 | **No player-facing design change.** A private Hub-only admin analytical lab at `/admin/ai` and paper-betting evidence loop; it requires the `competitions` administration capability, is absent from the Euro 2028 route tree and exposes no prediction or betting surface to players |

| 184 | No presentation change. A qualification rule that works at every group size |

| 186 | No presentation change. A stored fact about where a group stage ends |
| 187 | No presentation change **yet**, and one becomes possible: a season Championship now has a bracket to render. The read of it is `CUP-003` and is not built |

*Current to contract 187.*
