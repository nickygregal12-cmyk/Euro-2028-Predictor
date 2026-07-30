# Phase 0 — evidence from the World Cup predictor

**Status:** Primary evidence. Owner observation of a live product with real users.
**Date:** 30 July 2026
**Source:** the World Cup predictor, roughly 60 users, run through a full tournament by the owner.
**Authority:** This is the only user evidence the programme holds. Where it contradicts a design assumption made in `programme-plan.md`, `multi-competition-hub-build-plan.md` or the ADRs, **the evidence wins** and the assumption is corrected rather than defended.

---

## What this is, and what it is not

**Observed** — things that happened, watched by the owner across a live tournament with real users. Treated as fact.

**Stated** — the owner's view of why, or of what people would want. Treated as hypothesis, still valuable, but distinguished.

Every finding below is marked. The distinction matters because the observed findings contradict several design assumptions, and the stated ones do not yet.

A caveat the owner raised and which is recorded rather than dismissed: the World Cup product shipped the day before the tournament and was modified throughout, so some friction was implementation immaturity rather than product design. Where that applies it is noted.

---

## Observed

### O1 · Low scorers churn, and it was the main retention failure

Players with lower scores tailed off and were hard to retain. Over a four-week tournament.

**Why this is the most important finding in this document:** the season Predictor (ADR 0012) is a cumulative leaderboard over **thirty-eight weeks**. A player sitting fortieth in October has seven months with nothing to play for. The churn mechanism observed over four weeks operates over nine months in the designed product, and the field is larger.

**This corrects an assumption.** Matchweek winners, monthly standings and form tables were recorded in ADR 0012 as a fix for *late joiners*. They are not. **They are the primary retention mechanism for every player outside the top few**, which is most of the field. They need designing as a first-class feature rather than a secondary view.

### O2 · Peak usage was during matches, not at the deadline

The most-used surfaces were **leagues** and **Match Centre during matches** — watching what everyone in your league had predicted, live, as results came in. Immediately after a match finished, players checked point changes and who had got it right.

**This corrects the information architecture.** The proposed navigation was built around the weekly pick. The evidence says the pick is a chore and **the match is the event**. Saturday at three o'clock, not Friday at the deadline.

Match Centre showing a league's predictions live, with the table moving underneath, is the product. Picks is what a player does to be eligible for it.

### O3 · League tables were already being screenshotted and shared

Unprompted, into group chats.

**This corrects the growth feature.** A purpose-built "weekly results card" was identified as the highest-leverage growth mechanism. Players are already sharing something — **the league table**. The work is making the artefact they already share worth sharing, not inventing a new one.

### O4 · Separation between games was not understood

When KO Predictor was introduced as a separate game with separate scoring, players did not understand it was separate.

**With one additional game.** The hub design has three games per competition across two leagues. The separation law is architecturally correct and was **visually invisible**. Unless separation is obvious on the surface, this confusion multiplies with every competition added.

### O5 · The organiser burden was explaining scores, not collecting picks

The owner acted as organiser. The load was score corrections and questions about how points were calculated — point breakdowns were not clear enough, so players asked a person instead of reading a screen.

**Per-match "why did I get these points" transparency is a support-load feature as much as a trust feature.** It was assumed to be a nicety.

### O6 · Navigation difficulty was the dominant complaint

Players found it hard to locate things and to know how to move around. The overall leaderboard was hard to find and consequently under-used — the owner attributes this to the product's architecture rather than to players.

Some players missed knockout rounds, partly for the same reason.

### O7 · Jokers were used, and used up

All jokers were used. No confusion, no complaints, nothing perceived as unfair.

**This supports the ADR 0012 design.** The move to eight matchweek jokers split across the season halves is an extension of a mechanic that already worked.

### O8 · Profiles, other players' predictions and head-to-head were valued

The owner rates the ability to open another player's profile, see their predictions and compare head-to-head as among the best parts of the product. Head-to-head was used heavily near the tournament's end.

**Head-to-head being valued supports the Predictor Cup thesis** (ADR 0014) — that beating a named opponent is a different and stronger feeling than a leaderboard position. Note the observed usage was tournament-shaped, so it is supporting evidence rather than proof for a season-long format.

### O9 · Nothing was contested as unfair

No rule disputes across a full tournament.

### O10 · Conversation happened in group chats, not in the app

Consistently.

**Design consequence:** do not build in-app chat. Build for the group chat — shareable artefacts, invite links, deep links.

---

## Stated

### S1 · The audience

**The target: the regular.** An average male football supporter who watches on a Saturday, gambles but not on this product, and gets a buzz from sending updates to his group chat. Plays weekly, across a season, plausibly across several games.

**Design consequences:** free-to-play is correct, and this person is entirely comfortable with betting culture — the positioning should not be prim about it, while remaining free of stakes and prizes per ADR 0015.

**Not the target: the tournament-only participant.** Older, wants a World Cup sweepstake once every two years, will not create an account. Observed refusing email signup in the World Cup product.

**This corrects an earlier reading.** Email signup was initially recorded as a barrier costing users. It was not — those users were never going to sustain a weekly game. **It drops as a signup barrier and stands as the managed-entrant case** (ADR 0013): the organiser enters their pick, they appear in standings, they install nothing. This is real evidence for managed entrants rather than speculation about pub competitions.

**A separate role: the organiser.** Not necessarily a distinct person. The role carried the score-explanation burden in O5.

### S2 · Why someone would choose this

Ease of use; several separate games in one place; and the Predictor Cup specifically as the mechanic that could retain players across a season.

### S3 · Fixture volume

The full World Cup card was filled in, though the owner considers that tournament-specific. Ten to sixteen matches a week is judged acceptable for a season.

**Consistent with ADR 0012's full-card decision**, and with the ≥70% weekly completion threshold that would trigger the reduced-set fallback.

### S4 · What the owner would change

More confidence that everything works, and better testing across all stages and failure paths.

**Already the strongest characteristic of the current codebase.** Recorded because it explains why the engineering discipline is what it is.

---

## Corrections this evidence forces

| Assumption | Correction | Source |
|---|---|---|
| Secondary rankings fix late joiners | They are the primary retention mechanism for most of the field | O1 |
| The weekly pick is the centre of the product | The match is the event; the pick is the chore | O2 |
| Build a weekly results card as the growth feature | Make the league table — already shared — worth sharing | O3 |
| Separation between games is handled by the separation law | The law is architectural; separation must also be visible | O4 |
| Point transparency is a nicety | It is a support-load feature | O5 |
| Email signup is a barrier costing users | Those users are out of segment; managed entrants is the answer | S1 |

---

## Open — not answered by this evidence

- **Multi-game entry rate.** The Phase 4 gate metric. The World Cup product had one game plus a poorly-understood second. No evidence either way.
- **Whether season-long engagement resembles tournament engagement.** All observation is from a four-week tournament with a fixed end.
- **Whether tournament-only participants convert to the season product.** Euro 2028 is where they arrive in numbers. Probably the most commercially interesting question in the programme, and unanswerable until mid-2028 — instrument for it rather than guess.
- **Competitor comparison.** Playing Forescore and kicktipp for a full cycle remains outstanding and is not superseded by this document.
- **Anyone outside the owner's own network.** All sixty users arrived through one person.

---

## What this does not replace

Phase 0 as specified in `programme-plan.md` also requires interviews with organisers and players outside the owner's network, a full cycle in each competitor product, and observation of a competition run in a group chat.

This document is strong primary evidence from one product with one audience. It is not a substitute for that work, and the sample is the owner's own network.
