# ADR 0014 — Predictor Cup season formats

- **Status:** Accepted direction — partially implemented
- **Date:** 29 July 2026
- **Amended by:** [ADR 0020](0020-football-prediction-hub-product-model.md) — the game is named **Predictor Championship** in the interface, with every internal identifier left unchanged, and global entry closes at Matchday 1 rather than at the draw. Every format rule below — the group cap of twenty, the meetings arithmetic, the split, the seeded playoff, points-per-game cross-group ranking, the published immutable fixture list, the settlement cutoff, the tie-break sequence and the jokers-never-apply law — is **unchanged and remains the format authority**.

> **Implementation progress — 5 August 2026.** Format selection, launch threshold, neutral points/settlement machinery, season sources, circle-method scheduling rules, split persistence, one-parent ancestry and a continuing table derived across settled initial and split fixtures are merged. The phase-transition driver that creates/schedules the child groups, its bounded browser read and the Predictor Championship surfaces remain unbuilt. **Updated 6 August 2026:** the bounded browser read landed as contract 120 and the phase-transition driver as contract 124, which also states the odd-field consequence this record left open — the smaller half finishes its round-robin early, inside one competition-wide matchday numbering. The multi-group shape, the tie-settlement caller and the Championship surfaces remain unbuilt.

## Context

The Predictor Cup is implemented for tournament use: a transparent random draw into groups, three group matchdays scored head-to-head on prediction-point totals, roughly two-thirds qualifying via automatic places and points-per-game wildcards, a seeded playoff reducing to a power of two, and a knockout resolved by Extra-Time Accuracy then the guaranteed Penalty Number decider. Full rules in `docs/predictor-cup-rules.md`.

A league season changes two things. The points source becomes matchweek totals from the season Predictor (ADR 0012) rather than a tournament entry's scorelines. And the calendar changes from roughly four natural windows to thirty-eight, which makes structures possible that a tournament could not support.

The Cup is also one of the two competitions whose emotional shape differs from the incumbent accumulation leaderboard: a player takes 3, 1 or 0 from a fixture against a named opponent, and prediction points become the mechanism rather than the scoreboard. That distinction is a primary differentiation claim and the formats below must protect it.

## Decision

**Two competition types, with different structures.**

### Public Cup

One public Cup per season, running its full length. Entry closes at the draw, because a draw fixes every fixture. Structure is the existing tournament design with a longer clock: groups, then a knockout phase splitting off near the end, to a single winner.

Size the group stage to fill roughly half to two-thirds of the season and leave the remainder for qualification and knockout rounds. The existing seeded playoff round already reduces an awkward qualifier count to a power of two.

**Eliminated entrants become spectators, not consolation entrants.** The remaining bracket, who is left and eventually the winner stay visible. No Shield or Plate: the Predictor runs every week and Last Man Standing competitions restart continuously, so Cup elimination removes one competition from a player's week rather than emptying it.

### Private Cup — field size selects the format

The creator chooses nothing about structure. **A group is capped at twenty entrants**, and field size determines the shape:

| Field | Format |
|---|---|
| 2–3 | Declined. Head-to-head is offered instead — a two-player league is not a cup |
| 4–20 | **One group.** Meetings sized to fit, then a split if the meeting count is odd, or a knockout playoff if it is even |
| 21+ | **Groups of no more than twenty**, then qualification, seeded playoff and knockout |

**The split is not a Scottish feature to be selected. It is what balances an odd number of meetings.** The real Scottish Premiership splits *because* twelve teams playing three times is unbalanced — someone would take an extra home fixture — and the split is the traditional remedy. The Premier League does not split because two meetings is already balanced. The format therefore follows the arithmetic rather than the host league, and the Scottish shape emerges by itself:

```
meetings = floor(remaining_rounds / (N − 1))
odd meetings  → split into halves; the post-split round-robin provides the balance
even meetings → no split is needed; the remainder is spare calendar
```

> **AMENDED 18 August 2026 by an owner decision, implemented as contract 198
> (`CUP-006`).** The line above used to read "even meetings → remainder becomes
> a seeded knockout playoff", and the table below reported that remainder as the
> tail. Both were wrong in the same way: they described what was LEFT OVER, not
> what a knockout NEEDS.
>
> **A knockout is what happens when the field is too big for one league.** A
> single group IS a league and finishes as one — on the table, with the split
> balancing an odd meeting count. The league is **never shortened** to make room
> for a bracket. A knockout is added to a single group only when the rounds left
> after the full league happen to be enough for the qualifier count, and
> otherwise the table decides it.
>
> A consequence the owner was shown and accepted: whether a single group ends in
> a knockout depends on how the league rounds divide the calendar, so
> neighbouring field sizes end differently. Over 38 matchweeks 18 entrants reach
> a knockout and 19 do not.
>
> For a **multi-group** competition the field cannot be one league, so it always
> ends in a knockout, and its calendar is **reserved by arithmetic working
> backwards** before the groups are sized. Reserving shrinks the groups: sixty
> entrants over 38 matchweeks are four groups of fifteen, not three of twenty.

A group of twelve predicting the Premier League still gets a split, which is correct — the structure follows the field, not the competition being predicted.

**Six field sizes land exactly on a 38-round season:**

| N | Meetings | League rounds | Split | Knockout | Spare | Total |
|---|---|---|---|---|---|---|
| 6 | 7 (odd) | 35 | 3 | — (4 qualifiers need 2, none left) | 0 | 38 |
| 8 | 5 (odd) | 35 | 3 | — (6 qualifiers need 3, none left) | 0 | 38 |
| 10 | 4 (even) | 36 | — | — (7 qualifiers need 3, only 2 left) | 2 | 38 |
| 12 | 3 (odd) | 33 | 5 | — (8 qualifiers need 3, none left) | 0 | 38 |
| 18 | 2 (even) | 34 | — | **4** (12 qualifiers) | 0 | 38 |
| 19 | 2 (even) | 36 | — | — (13 qualifiers need 4, only 2 left) | 2 | 38 |
| 20 | 2 (even) | 38 | — | — (14 qualifiers need 4, none left) | 0 | 38 |

**The knockout column is what the bracket NEEDS, not what is left over**, which
is the whole of contract 198's correction. Eighteen is added to the table
because it is the largest single group over 38 matchweeks that can actually
afford one.

**Twenty is the cap because it is the last size at which a single group still plays home and away.** Above twenty, `floor(38 / (N − 1))` falls to one meeting: everyone played once, no return fixture, no chance to avenge anything. The format degrades before it fails, and the cap sits where it is still good.

**A Cup need not fill the season.** Fourteen entrants produces a 30-round competition finishing in April. That is not a defect to be padded out — real competitions finish at different times, the honours board records the result, and the next Cup can open. Forcing every field size to consume exactly 38 rounds was the error in an earlier draft of this record.

**The split is the consolation mechanism, and it is better than a consolation bracket.** A Shield announces itself as a losers' competition. A split is the same competition continuing with a narrower field, it is how the real league works, and points carry through it — so finishing sixth rather than seventh matters, and the split point becomes a dramatic moment mid-competition rather than a sorting operation. Nobody is eliminated.

**Format arithmetic** runs on *remaining* rounds, so mid-season starts are handled. Leftover rounds are absorbed by adding a post-split or pre-split meeting rather than by starting late.

### The draw and the published fixture list

**At entry close, the complete fixture list for the entire competition is generated and published to every entrant.** A player can see in August that they face Dave in matchweek 7 and the reigning champion in matchweek 22.

This is what makes the Cup feel like a league rather than a weekly pairing appearing from nowhere, and it creates anticipation — a significant fixture is visible three weeks out. It extends the audit-trail draw requirement already inherited from the Fan Duels integrity rules: the draw occurs at entry close, the full schedule is generated and published at that moment, the draw and schedule are audited, and neither changes afterwards.

Above the cap, the same applies per group: groups are drawn at entry close, each group's full fixture list is published immediately, and the playoff and knockout structure follows once qualification resolves.

**Group formation rules where the field exceeds twenty:**

- **Groups are balanced, not filled.** Thirty entrants becomes two groups of fifteen, never a twenty and a ten.
- Where the field does not divide evenly, smaller groups take byes so every group completes a round in the same week. Groups finishing at different times would prevent the playoff starting.
- **Cross-group ranking uses points per game**, as the existing qualification rules already specify. Raw totals across groups are not comparable and must never be presented as an overall table.
- **The split applies only to the single-group case.** Merging top halves across groups would carry points earned against different opponents, breaking the comparability the design rests on. Multi-group competitions finish with qualification, seeded playoff and knockout.

**Settlement cutoff.** Cup rounds settle on fixtures played and confirmed by the next matchweek's lock. A round never hangs on a fixture moved to March. A tie settled on a reduced fixture set displays that fact — "settled on 9 of 10 fixtures" is a required label. The existing round-anomaly rule narrows accordingly: it blocks on genuine anomalies such as a tie without a valid Penalty Number, not on an ordinary postponement, which now has a defined resolution.

**Unchanged from the tournament rules:** head-to-head scoring at 3 for a win, 1 for a draw, 0 for a loss on prediction-point totals; Extra-Time Accuracy then the Penalty Number as the knockout decider; audit-trail draw and bracket.

**Jokers never apply to Cup scoring.** Raw 5/3/0 throughout. The existing law is unchanged, but the reasoning is restated here because the separation-law argument alone is not the strongest one and will not survive re-proposal.

In an accumulation game a joker is symmetric: a doubled week helps a player against the entire field equally, and every player has the same allocation. In a head-to-head competition it is not symmetric in the same way, because it is aimed at one named opponent — and **with the full fixture list published at the draw, a player can see in August which matchweek they face the strongest opponent, and spend a joker precisely there.**

Roughly eight fixtures per season would become near-automatic wins, since a jokered matchweek is worth approximately double an unjokered one while the margin between a good and an average predictor over a single week is nothing like that large. The competition would be decided substantially by schedule-reading and token timing rather than by predicting better, which directly erodes what the Cup exists to be.

Two supporting reasons. It would fork the rules: the tournament Cup already implements jokers-never-apply, so permitting them here creates two Cup scoring models — the same fragmentation rejected in ADR 0015 for per-league custom scoring. And it couples two competitions' strategy, forcing a player to reason about joker placement in the season leaderboard and in every Cup simultaneously.

**A separate Cup-only token allocation would avoid the coupling** and is recorded as a considered option. It is rejected as a second token economy to explain, test and balance, on a platform where Last Man Standing already carries lives and Saves.

**Launch timing.** The Cup is launch scope, but the first competition opens once the field justifies it — a defined entrant threshold or a scheduled start some months into the season — rather than in launch week. A transparent draw is a fine product with two hundred entrants and a thin one with twenty, and the group stage reads matchweek points that accumulate regardless.

## Consequences

- Structural work is bounded: the draw, groups, qualification, seeding, bracket and Penalty Number machinery already exist and are production-hosted. The new work is the format selector, the split, and the matchweek points source.
- **Format selection must be deterministic and tested at every field size from 3 to at least 100**, with exact-fit assertions at N=6, 8, 10, 12, 19 and 20, and a group-path assertion at N=21.
- **The Scottish Premiership split affects sizing.** Post-split fixtures are not announced until the split occurs, so only 33 rounds are known when an SPFL season begins. Size the league phase against the known calendar and let the five split rounds serve as the post-split window — the real split provides exactly the finish the format needs.
- **The published fixture list is generated once and is immutable.** Schedule generation must be deterministic from the audited draw, so the same draw always yields the same fixtures and the schedule can be independently reproduced from the audit record.
- Mid-season starts compress the calculation and lower the viable single-group ceiling. A Cup starting at matchweek 20 has eighteen rounds remaining, which supports a materially smaller field before groups are required.
- Odd fields split unevenly — thirteen becomes seven and six — and the smaller half finishes its round-robin earlier. This needs a stated behaviour rather than being discovered mid-season.
- The Cup inherits every exception state from ADR 0012: postponed, abandoned and void are distinct, and a fixture's prediction scores whenever it is eventually played even if the tie has already settled. That divergence is correct under the separation law and must be surfaced, not hidden.
- KO Predictor remains out of scope during a league season; see ADR 0011.

## Rejected alternatives

- **A Shield or Plate consolation bracket.** Rejected: it labels its entrants as losers, and the split delivers continued competition without eliminating anyone. Retained in `docs/competition-structure.md` as a parked enhancement, not a gap.
- **A single format for all field sizes.** Rejected: a round-robin fails above roughly twenty-six entrants, and groups-and-knockout is a poor experience for six. Field size selecting the format produces something coherent at every size and asks the creator nothing.
- **Letting the creator choose the structure.** Rejected: it exposes a decision most creators cannot make well, and it permits incoherent combinations such as a split with a four-player field.
- **A group larger than twenty.** Rejected on arithmetic: above twenty the meeting count falls to one, so entrants play each other once with no return fixture. The format degrades before it fails, so the cap sits where it is still good rather than where it stops working.
- **Capping a group at twelve.** Rejected — this was an earlier version of this record. It was derived from the Scottish split landing exactly at twelve, and mistook one exact fit for the boundary of the format. Twenty is the true ceiling, and six field sizes fit exactly rather than one.
- **Forcing every field size to consume a full season.** Rejected: a fourteen-entrant Cup finishing in April is a complete competition, not a truncated one. Padding it distorted the format arithmetic in an earlier draft.
- **Allowing jokers in Cup scoring.** Rejected on the competitive reasoning above — with a published fixture list, jokers would be aimed at specific opponents and would decide ties by schedule-reading rather than prediction quality.
- **Merging top halves across multiple groups after a split.** Rejected: it would carry points earned against different opponents into a combined table.
- **An overall cross-group table by raw points.** Rejected: groups face different opposition. Points per game is the honest measure and is already specified in the qualification rules.
- **Holding a Cup round open until a postponed fixture is played.** Rejected: across a league season this could stall a round for weeks. The cutoff at the next matchweek's lock resolves it deterministically.
- **Opening the first public Cup in launch week.** Rejected: a thin field would give the platform's most distinctive competition its worst possible first impression.
