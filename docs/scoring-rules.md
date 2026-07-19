# Euro 2028 Predictor — Scoring Rules (v1)

This is the single source of truth for scoring. The `calculateScore()` domain function must implement exactly this, and nothing should be hardcoded elsewhere.

---

## 1. Group match points

| Outcome | Points | With joker |
|---|---|---|
| Correct result (win/draw/loss, not exact score) | 3 | 6 |
| Exact score | 5 (total — does not stack with the 3) | 10 |
| Wrong result | 0 | 0 |

### Jokers (group stage only)

Each entry has **5 jokers** to place across the 36 group matches (max one joker per match).

- A joker **doubles all match points** for that match: exact score 5 → 10, correct result 3 → 6, wrong result 0 → 0.
- Jokers apply to group **match** points only — they do not affect group position points, knockout points, or bonus points.
- **Joker lock rule (differs from score lock):** score predictions lock at the opening match kickoff, but jokers remain placeable and movable at any time. A joker **commits at the kickoff of the match it is placed on** — at that moment it is consumed and cannot be moved. A joker can never be placed on a match that has already kicked off.
- Uncommitted jokers can be freely moved between not-yet-kicked-off matches, including during the tournament.
- Unused jokers at the end of the group stage are simply lost — no compensation.

---

## 2. Predicted group position points

| Item | Points |
|---|---|
| Correct team position | 2 per team |
| Correct complete group order (all 4 teams in right order) | +5 bonus |

Max per group: 4 teams × 2 + 5 bonus = **13 points**.

---

## 3. Knockout progression points (stacking per team)

| Stage reached correctly | Points |
|---|---|
| Round of 16 | 10 |
| Quarter-final | 15 |
| Semi-final | 20 |
| Final | 25 |
| Champion | 40 |

These stack per team. A team correctly predicted all the way to champion scores 10+15+20+25+40 = **110 points**.

Note: v0.1/v0.5 knockout mode is **winner-only selection** (no score prediction), so no exact-score bonus applies at this stage — only correct-progression points above.

---

## 4. Bonus predictions

| Bonus | Points |
|---|---|
| Golden boot winner (correct) | 25 |
| Group-stage total goals — exact number | 40 |
| Group-stage total goals — within 5 | 30 |
| Group-stage total goals — within 10 | 20 |
| Group-stage total goals — outside 10 | 0 |

Total-goals scoring is **tiered, not stacked** — a prediction lands in exactly one band (the best one it qualifies for) and scores that band's points only.

**The group-stage goals prediction is not entered separately — it is automatically derived as the sum of all goals across the user's 36 predicted group-match scores.** It updates live as predictions change and freezes with the entry at lock. This guarantees the prediction and the goals number can never contradict each other. (League tie-breaker §5.5 "closest total-goals" uses this same derived number.)

The golden boot selection is stored as a player reference; the player list populates once squads are confirmed, searchable by player name or team.

No other bonus categories in v1 (no highest-scoring team, no best-host-nation bonus).

---

## 5. League tie-breakers (when two entries have equal total points)

Applied in order until the tie is broken:

1. Most exact scores
2. Most correct outcomes
3. Most correct knockout teams
4. Correct champion
5. Closest total-goals prediction (smallest absolute difference from actual tournament goal count)

---

## 6. Group table tie-break rules (predicted group standings)

Adapted from UEFA's official EURO tie-break order, modified where UEFA's rule depends on data this app doesn't collect (see notes).

**Implementation note:** steps 1–6 are pure calculation inside `resolveGroupTies()` — the user never sees this process, the table just resolves silently and correctly. Only step 7 is ever user-facing (the manual prompt). This is a domain-logic concern, not a UI concern, and should be built/tested entirely in isolation from any screen.

Applied in order until the tie is broken:

1. Points in head-to-head match(es) between the tied teams
2. Goal difference in head-to-head match(es) between the tied teams
3. Goals scored in head-to-head match(es) between the tied teams
4. **Three-way tie special case:** if steps 1–3 separate one team from the group, re-apply steps 1–3 to the remaining two teams only
5. Goal difference across all group games
6. Goals scored across all group games
7. **Manual tie-resolution prompt** — if still tied, the user is shown a prompt and must choose the order themselves, with an explanation of why the app couldn't resolve it automatically

**Excluded from UEFA's real rule (with reasons):**
- *Penalty shoot-out between teams tied after playing each other in the final round* — not modelled; users don't predict shootouts
- *Disciplinary points (cards)* — not modelled; users don't predict cards
- *European Qualifiers ranking* — not part of this app's data model; also not applicable to Euro 2028 (no "Germany didn't qualify" scenario this cycle)

---

## Open items / things to revisit later

- Confirm whether knockout mode ever moves beyond winner-only selection (e.g. a future score-prediction knockout mode) — if so, exact-score bonus rules will need defining for that mode separately, and must stay isolated from these original-entry scores per the "never merge original and live knockout scores" rule.
