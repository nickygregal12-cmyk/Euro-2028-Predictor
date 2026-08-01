# ADR 0012 — Season Predictor rules

- **Status:** Accepted direction — unimplemented
- **Date:** 29 July 2026
- **Amended by:** [ADR 0020](0020-football-prediction-hub-product-model.md) — the Joker count becomes ten split five and five, and a fixture postponed after its round locks is reassigned to its new round with an editable prediction rather than staying frozen. The matchweek Joker unit, the one-per-matchweek maximum, the scoring values, rolling entry and the cumulative-total ranking law below are **unchanged and still authoritative**.

## Context

The Original Predictor is shaped around a tournament: predict thirty-six group scorelines plus a bracket plus Golden Boot, once, locked at the first match. A league season has no single lock instant, no groups and no bracket, so the entry model does not transfer even though the scoring engine does.

ADR 0011 establishes per-matchweek locking and competition kinds. This record settles what the Predictor actually *is* during a league season.

The competitive context matters to one decision here. The nearest comparable product uses an elaborate scoring model — goal-difference and underdog bonuses, a penalty for a failed joker, and per-league configuration. Matching it was considered and rejected; see ADR 0015.

## Decision

**Weekly scoreline predictions only, cumulative across the season.** One mechanic, one leaderboard. Predict every fixture in the matchweek; the whole round locks at its first kickoff per ADR 0011.

**No pre-season predictions.** Final table order and season top scorer are not part of the season Predictor. The equivalent tournament features — predicted group positions and Golden Boot — remain Euro-only and are not generalised.

**Existing scoring is unchanged:** exact score 5, correct result 3, per `docs/scoring-rules.md`.

**Full fixture card.** Every fixture in the round, roughly ten in the Premier League and six in the Scottish Premiership. This is the purer game and matches the tournament product, and it carries a weekly friction cost that must be engineered down rather than accepted.

**Jokers: eight per season, applied to a whole matchweek, split four and four across the two halves.**

The unit matters more than the count. Applied per *match*, eight jokers across roughly 380 fixtures contribute about 2% of a season total — decorative rather than strategic. Applied per *matchweek*, they contribute roughly 20%, close to the calibration the tournament game already uses (five jokers on thirty-six group matches). The half-season split prevents hoarding: an unsplit allocation rewards waiting for a perfect week that never arrives, and players finish with unused jokers.

One joker per matchweek maximum; declared before the round locks. **Jokers never apply to Predictor Cup scoring** — the existing law is unchanged.

**Rolling entry.** A player may join at any matchweek; earlier rounds are simply unbanked. This is the accumulation-game case, where late entry is a self-correcting disadvantage — contrast ADR 0013, where it is an advantage and is therefore prohibited.

**Cumulative total is the only ranking that decides the season.** Alongside it, and never blended into it: points per matchweek played, rolling form, **matchweek winners**, and monthly standings. These give a late joiner something they can actually win.

**Standings display matches played alongside points**, as a real league table shows games in hand. Two players on 84 points from 22 and 23 matchweeks are not tied.

**Reschedules and exceptions.** Three distinct states, never collapsed into one flag:

- **Postponed** — rescheduled before the round locks: the fixture moves to whichever round it now falls in and takes that lock. Rescheduled after the lock: **the existing prediction stands, locked, and scores whenever the match is played.** It is not reopened.
- **Abandoned** — started and not completed: the partial score does not stand; the prediction carries to the replayed fixture in full.
- **Void** — never to be played: no points to anyone, and the fixture leaves the matches-played denominator.

**Required friction mitigations, in scope for the build rather than deferred:**

- pre-fill every fixture with a sensible default so submitting is one tap for a player content with it, with the entry visibly provisional until confirmed;
- tap-to-increment rather than keyboards, whole card on one screen, no per-match navigation;
- "same as last week" as a single action;
- partial submissions auto-complete at lock using the default, consistent with the auto-assignment rule in ADR 0013.

## Consequences

- **The automatic submission scheduler broadens to season cadence** — tournament-wide automatic valid-entry submission is implemented, while the recurring thirty-eight-lock season scheduler is unbuilt.
- **Season jokers are a different rule from tournament jokers** and require their own scoring authority, their own SQL-versus-TypeScript parity coverage, and an explicit statement in `docs/scoring-rules.md` that the two are separate rules for separate competitions. They must not be merged into one implementation.
- `maxRemainingPoints.ts` generalises to a rolling context.
- Reveal fires once per matchweek at lock rather than per match.
- The Predictor Cup's group stage reads matchweek points; see ADR 0014.
- **Weekly completion rate is the metric that validates the full-card decision.** If completion falls below roughly 70% by mid-season in the closed cohort, the full card is the likely cause and a reduced set becomes a live option. This is what the 2026/27 rehearsal exists to find out.
- Secondary views (matchweek winners, monthly standings) are computed from data the leaderboard already produces; they must never feed back into the canonical total.

## Rejected alternatives

- **A hybrid adding pre-season table and top-scorer predictions.** Rejected: it imports two tournament mechanics into a game that does not need them, and multiplies the entry model for a single locked moment nobody returns to.
- **A reduced card of selected fixtures.** Rejected as the launch model — the full card is the better game and matches the tournament product. Recorded here as the identified fallback should the completion metric above indicate the friction is not survivable.
- **Per-match jokers.** Rejected on the arithmetic above: roughly 2% of a season total makes the mechanic decorative, and it would require a far larger allocation to matter.
- **An unsplit joker allocation across the whole season.** Rejected: it rewards hoarding and produces unused jokers at season end, which is a design failure dressed as strategy.
- **Reopening a prediction when a fixture is postponed after the lock.** Rejected: it would let a player change a prediction already committed, which is a worse problem than the inconvenience it solves. Consistent with the existing postponement overlay in `docs/architecture-and-tournament-states.md` §10, which preserves the submitted prediction.
- **Any aggregate ranking across leagues or games.** Rejected per ADR 0011: entering more competitions must never buy a higher score.
- **Per-league configurable scoring.** Rejected per ADR 0015.
