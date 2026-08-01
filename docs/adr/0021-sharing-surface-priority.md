# ADR 0021 — Sharing surface priority

- **Status:** Accepted
- **Date:** 1 August 2026
- **Supersedes:** [ADR 0017](0017-brand-and-club-identity.md) **only** where it claimed the weekly results card is the platform's most important external artefact. ADR 0017's club-identity decision, the badge-free rule and the `ClubIdentity` sole-rendering-path requirement are unchanged and remain in force.

## Context

Three positions in the repository disagreed about which artefact carries the product outside itself. The disagreement was reported by [`multi-competition-hub-build-plan.md`](../architecture/multi-competition-hub-build-plan.md) §1a and deliberately left open there, because that plan's own principle 14 requires an ADR to settle a contradiction with an accepted decision rather than an edit.

**Evidence.** [`phase-0-world-cup-evidence.md`](../architecture/phase-0-world-cup-evidence.md) O3 records observed behaviour from a live World Cup predictor with roughly sixty users across a full tournament: league tables *"were already being screenshotted and shared… Unprompted, into group chats."* This is observation, not inference, and it is the only user evidence the programme holds. The evidence document also states the correction it implies: *"The work is making the artefact they already share worth sharing, not inventing a new one."*

**The prior decision.** ADR 0017's consequences state the weekly shareable results card *"must be built on `ClubIdentity`, since it is the artefact most likely to be seen outside the product."* That premise was reasoned rather than observed, and it was written before the Phase 0 evidence existed.

**What is already built.** [`design-system.md`](../design-system.md) §6 records a share-card renderer shipped on 2026-07-21 (`src/features/share/`): a client-side canvas renderer with three content states — champion tease, full bracket, during-tournament brag — plus a league variant. It is tournament-shaped. It is neither a weekly results card nor a standings view, so its existence does not settle the question either way.

Left unresolved, this decides where design and engineering investment goes for the platform's only organic growth mechanism, so it is settled here.

## Decision

**Competition standings and league-table sharing are the primary organic platform-wide sharing surface.** This follows the observed behaviour in O3 rather than a reasoned claim about what users ought to share.

**A weekly personal results card remains a valuable secondary surface** for individual achievement, retention and matchweek recap. It is demoted from "most important external artefact", not discarded — the two answer different needs, and the personal card is the one that speaks to a player who is not near the top of a table.

**The existing champion/bracket renderer remains a Euro/tournament-specific artefact.** It is not generalised to league seasons and is not the base for either surface above.

**These are three artefacts, not one component.** They must not be collapsed into a universal share card. Their data models and composition stay separate:

| Artefact | Subject | Scope |
| --- | --- | --- |
| Standings / league-table share | a group's relative position | platform-wide, every competition |
| Weekly personal result card | one player's matchweek | platform-wide, every competition |
| Champion / bracket card | one entry's tournament prediction | Euro and future tournaments only |

**Investment priority:**

1. competition standings / league-table share view;
2. weekly personal result card;
3. competition-specific celebration cards where the format supports them.

**Shared visual primitives may be reused** — poster treatment, `ClubIdentity`, typography, the Broadcast Grid language from [`design-system.md`](../design-system.md) §11. Reuse stops at presentation: a shared renderer that tried to serve all three data models would reintroduce the conflation this record exists to prevent.

## Consequences

- **The `ClubIdentity` requirement survives the change of priority.** ADR 0017 attached it to the weekly card; it attaches to whichever artefact leaves the product, and now attaches to the standings share view first. A standings view is largely club names and marks, so the badge-free constraint matters there more than it did on a champion card.
- **No sharing code changes on this branch.** This record sets priority; it does not authorise implementation. `src/features/share/` is untouched.
- **The Phase 0 evidence is unchanged.** It is evidence, and evidence is not edited to agree with a later decision. Where this record and the evidence differ in emphasis, the evidence describes what was observed and this record describes what was chosen.
- **ADR 0017's status line changes** to record the partial supersession. Its club-identity half is explicitly untouched, because that half is load-bearing for a legal position, not a growth position.
- **The build plan's §1a report is now answered** for the ADR 0017 half. The ADR 0012 half of that same report — secondary rankings becoming load-bearing for retention — remains open and is not settled here.
- **Small-numbers honesty applies** (design-system §1): a standings share view is a distribution of people, so it inherits the 50-player threshold and must not expose percentiles below it.

## Rejected alternatives

- **Editing ADR 0017 in place.** Rejected: the repository's stated convention is that substantive changes to a decision get a new ADR, and rewriting a record to match later evidence destroys the traceability that makes the evidence valuable.
- **Editing or re-weighting the Phase 0 evidence.** Rejected outright. Adjusting observation to fit a decision is the failure mode the evidence document was written to prevent.
- **One universal share-card component for all three artefacts.** Rejected: they have different subjects, different data models and different audiences. A single component would either carry three code paths behind one name or force the weakest common shape on all three.
- **Dropping the weekly personal card.** Rejected: O3 corrects which artefact is *primary*, and says nothing against a personal recap. Most of the field is not near the top of a table, and the personal card is what serves them.
- **Treating the shipped champion/bracket renderer as the platform artefact.** Rejected: it is built on tournament concepts — a champion, a bracket, a single locked entry — none of which exist in a league season.
