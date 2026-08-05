# Design authority — start here

**The latest design document is
[`hub-architecture-and-modernisation-plan.md`](hub-architecture-and-modernisation-plan.md)
(revision 1.5, 4 August 2026).** It is the answer to "what should this look like
when it is done".

This folder exists because that question previously had no single answer. Design
intent was spread across `docs/design-system.md` (component-level, Euro-era),
ADR 0020, ADR 0021 and ADR 0023 (product model, sharing, information
architecture), with no document describing the finished product. Anyone asking
"what are we building towards" had to assemble it.

| Document | What it decides | Status |
| --- | --- | --- |
| [`hub-architecture-and-modernisation-plan.md`](hub-architecture-and-modernisation-plan.md) | Target architecture, information architecture, page/journey design, the complete UI state model, feedback hierarchy, rollout method, and — in Appendix E — the public acquisition landing page and standalone Euro 2028 boundary | **Current target design (rev 1.5)** |
| [`hub-landing-prototype.html`](hub-landing-prototype.html) | The executable form of Appendix E: the public landing page and an accurate signed-in Hub preview | **Current prototype**, conforms to E.3/E.4/E.7 |
| [`ui-modernisation-execution.md`](ui-modernisation-execution.md) | How the target design becomes production code: the reconciled migration order, the `src/premium/**` reference-only classification (guarded by `tests/design/premiumPrototypeBoundary.test.ts`), the approved tooling phases and the first-slice acceptance criteria | **Current delivery sequence**, adopted 5 August 2026 |
| [`../design-system.md`](../design-system.md) | Component-level rules built for the Euro tournament: score input, match card, group tables, bracket, navigation | **In force for what exists**; superseded on presentation by the plan where the two describe the same surface |

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
real fixture list depends on something eventually doing that.

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
