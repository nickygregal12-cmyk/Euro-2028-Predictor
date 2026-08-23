# ADR 0013 — Last Man Standing season rules

- **Status:** Accepted direction — partially implemented
- **Date:** 29 July 2026
- **Amended by:** [ADR 0020](0020-football-prediction-hub-product-model.md) — the thirty-minute buffer becomes a property of the Last Man Standing **game** rather than of the competition season, so the Main Predictor in the same competition locks at first kickoff with no buffer. The buffer's value and every other rule below are unchanged. ADR 0020 also records that leaving an LMS competition never permits rejoining that same running competition, consistent with the rolling-entry rejection below.

> **Implementation progress — 5 August 2026.** Presets, setup/state storage, eligibility, deterministic auto-assignment, used-team cycles, selection writes and correction-aware settlement/replay are merged. Contracts 107–109 complete the public wipeout restart lifecycle: create one linked successor, refuse inherited past rounds, derive the first eligible future league matchweek from the existing lock authority and create its calendar exactly once. Private/managed-entry and player-facing journeys remain unfinished.

## Context

Last Man Standing exists as a summary specification in `docs/competition-structure.md` §4 and is implemented for tournament use. A league season presents cases a tournament never did: thirty-eight rounds rather than seven, twenty clubs rather than twenty-four teams eliminated on a fixed bracket, reduced matchweeks caused by cup and European commitments, routine postponements, and competitions that resolve long before the fixture list ends.

The game is also the platform's strongest transfer and, with the Predictor Cup, one of the two competitions whose emotional shape differs from the incumbent's accumulation leaderboard. Its rules therefore need settling precisely rather than inheriting tournament assumptions.

## Decision

**Core play.** One team selected per matchweek; win to survive. A team, once selected, cannot be selected again until the player's used list resets.

**Round cadence.** Every matchweek is an LMS round, midweek included. This aligns the LMS round with the Predictor matchweek within a competition season, so one round boundary and one notification cover both. **Superseded in part by the ADR 0020 amendment recorded above:** the thirty-minute buffer is a property of the Last Man Standing game rather than of the competition season, so the two do **not** share one lock instant — the LMS deadline ordinarily falls thirty minutes before the Main Predictor's, which locks at first kickoff. The round cadence itself is unchanged.

**Postponed fixture: the player survives and the team is consumed.** Survival avoids a punitive and arbitrary elimination; consuming the team prevents a postponement being a free pass and avoids a carried pick colliding with the following round.

**A postponement cannot win a competition.** If a round would leave exactly one survivor and that survivor's fixture did not play, the round does not conclude the competition — it continues to the next. A title decided on a match that never took place is unsatisfying to every entrant, including the winner. This matches established practice across existing Last Man Standing operators.

**A thirty-minute buffer precedes the round lock.** The deadline is thirty minutes before the round's first kickoff rather than at it. This is conventional in existing products, gives tolerance for clock skew and slow submissions, and removes the edge case of a submission landing as the match begins. It sits above the derived lock and the per-match guard in ADR 0011, never replacing either.

**Used-team reset is mandatory.** When a player has used every eligible team, their used list resets. Without it a survivor exhausts a twenty-club pool and the competition cannot continue.

**Reduced matchweeks.** Selection is restricted to teams actually playing. The round still runs. A player with no eligible team takes the reset above rather than being eliminated on availability grounds. Thin rounds are **published in advance** — the fixture list is known weeks ahead — so players route around them deliberately.

**Round definition.** A round is an official league round designation carrying a full or near-full fixture programme, taken from the data provider's round data. A standalone rescheduled fixture is not an LMS round. Where a team appears twice within one designated round, that team is ineligible for selection that round.

**Missed selection.** Auto-assign the alphabetically first eligible unused team. Deterministic, confers no advantage, and keeps casual players in a competition they joined to enjoy.

**Entry closes after round one** — public and private alike, and for managed entrants equally. The field is fixed once the first round locks.

**Competitions repeat.** When one ends the next opens; a player knocked out in round four is weeks from a fresh start rather than months. A season honours record counts competition wins.

**Public and private both exist.** One public competition at a time, with pre-registration carrying a user into the next. Private competitions may be created by any user starting at any matchweek.

**Endgame — a round only ends the competition if it leaves exactly one survivor.** Where it would leave zero:

- *Private*, chosen at creation: **play on** (default — nobody is eliminated, survivors continue until one outlasts the rest), **shared win**, or **reset** (no winner; a fresh competition opens immediately).
- *Public*: **joint winners capped at three**. Above three there is no winner and the competition restarts with everyone re-entered and all picks reset.
- *Backstop*: if the fixture list runs out under **play on** with more than one player alive, they share the win.

**Setup options** — set at creation, immutable once the first round locks: lives (0–3), Saves (0–2), draws (eliminate or survive), endgame rule. These are presented as **three named presets with custom behind them**, not as four independent toggles.

**The draw-survival token is called a Save**, never a joker. A Save converts a drawn fixture into survival; it does not rescue a defeat, and this must be stated at the point of use.

**One entry per account per competition, enforced server-side.**

**The multiple-account exploit is created by being free to play, and every comparable product avoids it by accident.** Existing Last Man Standing operators charge an entry fee, which is not only their business model but their anti-abuse mechanism — nobody runs twenty entries at ten pounds each. With no entry fee, a single person holding twenty accounts can select a different team in each and is close to certain to survive every round. In the public competition, which is the acquisition surface, that renders the leaderboard meaningless.

Mitigations adopted, in proportion:

- **One entry per account per competition**, enforced in the database rather than the interface.
- **Verified email required** to enter the public competition. This is a floor, not a solution, but it raises the cost of bulk entry.
- **Private competitions are self-policing** and need no further control — a group of mates notices someone entering four times.
- **The public competition is monitored rather than defended.** Signup patterns, entries per email domain and correlated selection behaviour are observable; act on evidence rather than building fingerprinting for a free game with no prizes.

**This is deliberately not solved completely.** With no stake and no prize the incentive to cheat is reputational rather than financial, and disproportionate anti-abuse machinery would cost more than the abuse. The decision is to make casual abuse inconvenient, to be able to detect systematic abuse, and to revisit if the public competition attracts it. What must not happen is discovering the exploit after launch and treating it as a defect. **Managed entrants are supported in Last Man Standing only.** One team selection a week is proxyable; ten scorelines a week across a full card is not, and an organiser proxying several Predictor entries would abandon the task mid-season.

**Managed entrants are exempt from the one-entry rule by design**, since an organiser legitimately controls several. They carry a visible marker precisely so this is transparent.

## Consequences

- LMS scoring and elimination rules require their own authority and their own SQL-versus-TypeScript parity coverage. They are not an extension of Predictor scoring, and the "joker" term must not be reused.
- **The round-definition rule depends entirely on how the selected data provider models round designations.** This must be confirmed during the provider evaluation; the rule is currently written against an assumption.
- Managed entrants must lock at exactly the same instant as real entries, with no organiser override and no late entry. An organiser able to submit after lock, or to add a proxy to a running competition, would hold a decisive advantage. Fail closed in the RPC, not in the interface.
- Every managed selection is audited with actor and time. Managed entrants carry a visible marker in standings.
- Claiming converts a managed entrant into a real account with its history preserved — the intended acquisition path.
- Bulk selection is required: an organiser with fifteen managed entrants makes fifteen selections weekly.
- Public fields may be large, so standings require pagination from the outset and the three-winner cap matters far more there than in a private league.
- **Mass elimination is more likely than independence suggests.** Players cluster on the same strong teams, and depleted pools force survivors onto similar options, so a single upset can remove the whole field. The above-three branch needs real test coverage rather than being treated as unreachable.
- Public participation exposes display names to strangers, requiring a moderation position before the public competition opens.
- Presets keep the tested surface at three configurations plus custom rather than seventy-two.
- **New paths requiring explicit coverage:** a postponement that would otherwise leave a single survivor must not conclude the competition; the thirty-minute buffer must apply ahead of the derived lock without replacing it or the per-match guard; and a second entry by the same account into one competition must be rejected at the database, not the interface.

## Rejected alternatives

- **Rolling entry into a running competition.** Rejected. Rolling entry works in accumulation games and breaks depletion games: a player joining at round eight arrives with all twenty clubs while survivors have burned eight. The KO Predictor precedent does not transfer, and an earlier draft wrongly assumed it did.
- **Elimination on a postponed fixture.** Rejected as punitive and arbitrary — the player did nothing wrong.
- **Conditionally skipping a reduced matchweek** based on what the remaining field has left. Rejected: it inverts the reward, taking an earned advantage from players who saved strong teams and handing it to those who spent early. It also fails mechanically — the decision would depend on hidden used lists, so nobody could plan, and announcing the reason would leak opponents' remaining teams.
- **Two separate picks in a double matchweek.** Rejected: it would roughly double the elimination rate in the rounds already most constrained, and it breaks the one-deadline alignment with the Predictor.
- **Carrying a postponed pick to the rescheduled fixture.** Rejected because it can collide with the following round and leaves a player effectively holding two live selections at once.
- **Giving the team back after a postponement.** Rejected as a free pass. Survival is the compensation; consumption preserves the cost.
- **Letting a postponed fixture create the sole winner.** Rejected: winning without the selected team playing makes the title arbitrary and avoidably unsatisfying.
- **No used-team reset.** Rejected because long competitions become mathematically impossible once a survivor exhausts the team pool.
- **No-pick elimination.** Rejected for the season product. It is correct in a short tournament LMS and too punitive across thirty-eight weekly deadlines; deterministic auto-assignment preserves the competition without conferring advantage.
- **Rolling entry.** Rejected for the same reason as above: a fresh entrant's untouched team pool is a structural advantage, not merely a missed-points disadvantage.
- **One annual competition.** Rejected: early elimination creates months with no reason to return. Repeating competitions produce more starts, more winners and a healthier weekly product.
- **A single universal wipeout rule.** Rejected: a mates' group may genuinely prefer playing on or sharing; the public competition needs a bounded, predictable rule. The divergence is visible and chosen at creation, not hidden.
- **Exposing all four setup options as independent toggles.** Rejected: seventy-two combinations to document, support and test, most never chosen and some incoherent.
- **Calling the draw token a joker.** Rejected: Predictor jokers double points; an LMS Save changes survival. Reusing the term would be actively misleading.
- **Managed entrants across all games.** Rejected: weekly scoreline cards create an organiser workload that does not survive a season. LMS is uniquely low-friction enough to proxy responsibly.
- **Aggressive anti-abuse fingerprinting at launch.** Rejected as disproportionate for a no-prize product before evidence of systematic abuse. Detection and the ability to act are required; perfect prevention is not.
