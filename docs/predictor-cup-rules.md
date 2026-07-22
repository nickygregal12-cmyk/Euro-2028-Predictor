# EURO 2028 Predictor Cup — Draft Competition Rules (v0.1)

A head-to-head prediction tournament that mirrors football: random groups, qualification, seeding and knockout survival.

**Core idea:** every entrant makes normal EURO 2028 predictions. Those prediction points become a head-to-head score against a scheduled opponent. Group wins earn 3 table points, draws earn 1, defeats earn 0. Qualifiers enter a seeded knockout bracket until one Predictor Cup Champion remains.

> **STATUS — concept rules v0.1, 22 July 2026.** Format complete enough for product and technical planning; match windows, naming and capacity controls can still be refined before launch. Source: Nicky's draft rules document (this file is the repo-canonical copy).
>
> **Decisions stamped 2026-07-22 (chat session — binding on this doc):**
> - **The Predictor Cup SUPERSEDES Fan Duels** in launch scope (roadmap Phase 7). Fan Duels' direct-challenge mode is parked.
> - **Jokers NEVER apply to Cup scoring** — raw 5/3/0 only. Jokers are an Original Predictor mechanic; doubling must not leak into head-to-head fairness.
> - **Entry requires a submitted Original Predictor entry** — the Cup group stage reads its 36 scorelines; an entrant without one would score zero all group stage.
> - **Knockout scorelines come from the SHARED prediction store with the KO Predictor** (competition-structure §1): collected once, per-kickoff locks, each game scores them under its own rules. "Never predict the same real match twice" is a schema fact.
> - **Shield/Plate secondary cups are PARKED** — announced-later scope, never launch-blocking.
>
> **Open before the format is final:** the **window plan** — field size → bracket depth → real-fixture bundles. The real calendar offers ~4 natural post-group windows (R16 / QF / SF / Final); deep brackets (e.g. 86 entrants → 6 knockout rounds) need real rounds split into smaller bundles (e.g. R16 as four windows of two matches), which raises tie frequency — the tie-breaks below are built for that, but the mapping must be published here before the first Cup prediction locks (§13.1). **Mechanism adopted 2026-07-22:** windows are STORED DATA (architecture doc §7) — admin-adjustable rows, not hardcoded arrays — so the plan is configured once the field size is known, and published from the same data.

---

## Rules at a glance

| Area | Rule |
| --- | --- |
| Entrants | Any total of 6 or more; the field is not restricted to a fixed capacity. |
| Groups | Groups of four preferred; groups of three only when required by the final entry total. |
| Group fixtures | Three Predictor Cup matchdays; every user continues predicting during a bye. |
| Table points | Win 3, draw 1, loss 0. |
| Qualification | Approximately two-thirds of entrants progress through automatic and wildcard places. |
| Knockouts | A seeded playoff reduces the qualifiers to a standard power-of-two bracket. |
| Tied knockout | Base score tie → extra-time accuracy check → guaranteed penalty-number decider. |
| Other games | Cup scoring is separate from Original Predictor, KO Predictor and private leagues. |

**Important terminology:** "Prediction points" are the points a user scores from real EURO matches. "Table points" are the 3–1–0 points awarded for a Predictor Cup group result. They are separate values and must never be combined.

## 1. Competition purpose and principles

- The Predictor Cup is a parallel tournament between users of the predictor app. It converts ordinary match predictions into football-style head-to-head fixtures, group tables and a knockout bracket.
- One prediction entry is used across the app; users are not asked to predict the same real match twice.
- The Predictor Cup has its own results, tables, bracket and champion.
- Predictor Cup points do not add to Original Predictor or KO Predictor leaderboard totals.
- Tournament luck is accepted as part of head-to-head play; a cumulative-points award (Golden Predictor, §11.3) separately recognises the most consistently accurate predictor.
- Rules, scoring windows and tie-break methods must be published before the first Cup prediction locks.

## 2. Entry, deadlines and eligibility

### 2.1 Entry
Optional. A registered app user joins the Cup before the published entry deadline. Minimum six confirmed entrants. *(Decided: requires a submitted Original Predictor entry — see status block.)*

### 2.2 Closing the field
- The final entrant count is frozen when entries close; the group allocator runs only after the field has closed.
- No requirement to stop at 32, 64, 96, 128, 192 or any other fixed number.
- Late users may still join other predictor modes but cannot be inserted into an active Cup.
- A waiting-list user may replace a withdrawal only before the draw is published.

### 2.3 Draw basis
First edition: transparent random group draw. A later edition may introduce published seeding pots if reliable historical performance data exists. The draw method must not change after entries close.

## 3. Dynamic group creation for any entrant number

The system creates the smallest practical number of three-player groups and places all remaining entrants into four-player groups. Supports every field size from six upward — no bots, blank positions or artificial first-round eliminations.

| Entrant total ÷ 4 | Group allocation rule |
| --- | --- |
| Remainder 0 | All groups contain four players. |
| Remainder 1 | Three groups of three; all others four. |
| Remainder 2 | Two groups of three; all others four. |
| Remainder 3 | One group of three; all others four. |

*Example: 86 entrants → 20 groups of four + 2 groups of three = (20 × 4) + (2 × 3) = 86.*

### 3.1 Group-stage length
- Three Predictor Cup matchdays.
- Four-player group: every player faces all three opponents once.
- Three-player group: two head-to-head fixtures and one bye each.
- A user on a bye still predicts every designated real match; those points remain valid for wildcard ranking and knockout seeding. A bye awards no table points and is not shown as a win.

## 4. Predictions and scoring

### 4.1 Predictor Cup scoring per real match

| Prediction outcome | Prediction points |
| --- | --- |
| Exact regulation-time score | 5 |
| Correct regulation-time result, not exact score | 3 |
| Incorrect result | 0 |

The 5-point exact score is not cumulative with the 3-point award — an exact score earns five in total. *(Decided: jokers never apply — see status block.)*

### 4.2 Regulation time
For a real knockout match, the Cup score uses the result after 90 minutes plus regulation stoppage time. Real-match extra time and penalties do not alter the submitted scoreline for this competition.

### 4.3 Head-to-head score
Each Cup round has a published bundle of real EURO fixtures. A user's prediction points from those fixtures are summed; the two totals form the Cup match score (e.g. 21–16 or 18–18).

### 4.4 Group result

| Head-to-head outcome | Table points |
| --- | --- |
| Higher prediction-points score | Winner 3; loser 0 |
| Equal prediction-points score | Both players 1 |

The displayed 21–16 represents prediction points, not predicted goals; the table still follows football logic (3–1–0).

## 5. Group-stage fixtures and tables

### 5.1 Table columns
P (Cup fixtures played) · W/D/L (head-to-head) · PF (prediction points scored) · PA (opponents' prediction points) · PD (PF − PA) · Pts (3–1–0).

### 5.2 Ranking tied players inside one group
Where players finish level on table points, rank by, in order:
1. Total prediction points across all three group-stage scoring windows (including a bye window).
2. Most exact-score predictions across those windows.
3. Most correct-result predictions across those windows.
4. Head-to-head table points between the tied users.
5. Head-to-head prediction-point difference between the tied users.
6. Overall prediction-point difference in the group.
7. Lowest total scoreline error across all designated real matches.
8. The neutral system draw number assigned when Cup entry closes.

Scoreline error = |predicted home − actual home| + |predicted away − actual away| per designated real match, summed. Lower is better.

## 6. Qualification and wildcard ranking

### 6.1 Qualification target
Target qualifiers = round(total entrants × 2 ÷ 3).

### 6.2 Automatic and wildcard positions

| Group size | Automatic | Wildcard pool | Eliminated |
| --- | --- | --- | --- |
| 4 players | 1st and 2nd | 3rd | 4th |
| 3 players | 1st | 2nd | 3rd |

Wildcard places are awarded until the target is reached — deliberately compensating for the different fixture counts in three- and four-player groups.

### 6.3 Wildcard ranking across different groups
1. Head-to-head table points **per game**.
2. Total prediction points across all three common scoring windows.
3. Most exact-score predictions.
4. Most correct-result predictions.
5. Lowest total scoreline error.
6. Neutral system draw number.

Raw table-point totals are never compared across group sizes (a three-group player has only two fixtures); per-game keeps it proportionate.

## 7. Knockout bracket, seeding and byes

### 7.1 Overall seeding
Bands: group winners first, automatic runners-up (four-player groups) next, wildcards after. Within each band: table points per fixture → total prediction points → most exacts → most correct results → lowest scoreline error → neutral draw number.

### 7.2 Creating a valid bracket from any qualifier total
Q = qualifiers; P = largest power of two ≤ Q.

| Calculation | Rule |
| --- | --- |
| Playoff ties | Q − P |
| Players entering playoff | 2 × (Q − P) |
| Players receiving a bye | 2P − Q |
| Players after playoff | P |

### 7.3 Awarding byes and pairing the playoff
- Byes go to the highest seeds and count as advancement, not a match win.
- Playoff pairs highest remaining seed vs lowest, and so on.
- Same-group players should not meet in the first playoff where an eligible seed swap avoids it.
- After the playoff the bracket is fixed — no redraw.
- Everyone, including bye recipients, keeps submitting predictions for the window (wider app scores stay complete).

## 8. Knockout ties: extra time and penalties

A knockout fixture cannot finish as a draw. Resolution order: **normal Cup points → Extra-Time Accuracy → Penalty Number.**

### 8.1 Normal-time result
Higher Cup points across the round's designated matches advances. No tie-break used.

### 8.2 First tie-break: Extra-Time Accuracy Score
- Per designated real match: |predicted home − actual home| + |predicted away − actual away|; errors summed across the window.
- Lower total error advances; recorded as "AET".
- A missing score prediction receives an error greater than the maximum possible submitted-score error for that fixture — a blank can never gain an accuracy advantage.
- Same total error → penalties.

### 8.3 Second tie-break: Penalty Number
- Every knockout submission includes a mandatory Penalty Number: predicted total regulation-time goals across all real matches in that Cup round.
- At bracket creation one player is assigned the **ODD lane** (odd whole number 1–99), the other the **EVEN lane** (even whole number 0–98).
- Penalty Numbers stay hidden until the window locks; closest to the actual total advances, recorded as "P".
- **Why penalties cannot draw:** opposite parity means the midpoint between the two numbers ends in .5, while actual total goals is a whole number — both players cannot be equidistant.
- The Penalty Number is required to complete a knockout submission; non-completion routes to walkover rules, never an unresolved tie.

### 8.4 Result display

| Decision | Display example |
| --- | --- |
| Normal Cup points | Nicky 22–18 Jamie |
| Extra-Time Accuracy | Nicky 20–20 Jamie (Nicky AET) |
| Penalty Number | Nicky 17–17 Jamie (Jamie P) |
| Non-submission | Nicky W/O Jamie |

## 9. Submission, visibility and inactivity rules

### 9.1 Locking
- Each real-match prediction locks at that match's scheduled kickoff. *(Group-stage scorelines are the Original Predictor entry's, already locked at MD1; per-kickoff locks apply to the shared knockout store.)*
- No post-lock changes except an authorised admin correction restoring a match to editable **before play begins**.
- The Penalty Number locks with the first real match in the relevant window.

### 9.2 Opponent visibility
- An opponent's prediction for a real match stays hidden until that match locks; then the matchup view may reveal agreements, differences, live points, max-remaining and progression position.
- Later unlocked matches remain private.

### 9.3 Partial and missing submissions
- Partial submissions score normally; missing fixtures earn 0.
- Group stage: one submitter vs a complete non-submitter → walkover win (3 pts). Neither submits → fixture void, both 0.
- Knockout: active submitter advances by walkover over a complete non-submitter. Neither submits → higher seed advances by administrative walkover (never described as AET or penalties).
- No retrospective predictions after kickoff.

## 10. Result verification and corrections

### 10.1 Round finalisation
Provisional live scores allowed, but advancement is final only after: all designated matches finish (or are formally removed) → official regulation scores verified → points and tie-break values recalculated → an admin/automated hard gate confirms every head-to-head has one valid result → round marked final, next stage activates.

### 10.2 Postponed or abandoned real matches
Published before the Cup starts. Default: a match not completed within the round's stated scoring period is removed from both users' scores and tie-break calculations; remaining fixtures decide the tie.

### 10.3 Corrections after finalisation
Only to correct an official score, scoring defect or confirmed administrative error. Every correction creates an audit entry (old, new, reason, administrator). Where a correction changes who advances, the bracket and affected later rounds are recalculated or manually repaired under a documented admin procedure. No discretionary changes.

## 11. Elimination, other competitions and awards

### 11.1 Continuing after elimination
Cup elimination never stops a user predicting elsewhere — Original Predictor, KO Predictor, leagues and other bonus games continue under their own rules.

### 11.2 Optional secondary cups *(PARKED — see status block)*
A Shield (non-qualifiers) and Plate (first-main-round losers) may be offered; announced before the main Cup begins; never alter the main bracket.

### 11.3 Main honours

| Honour | Basis |
| --- | --- |
| Predictor Cup Champion | Winner of the final head-to-head tie |
| Runner-up | Losing finalist |
| Golden Predictor | Highest cumulative Cup prediction points across all designated matches, regardless of elimination |

Champion and Golden Predictor may differ — intentionally: one recognises survival, the other accuracy.

## 12. Worked example: 86 entrants

- **Groups:** 20 × four-player (80) + 2 × three-player (6) = 22 groups, 86 players.
- **Qualification:** round(86 × 2 ÷ 3) = 57 → 40 automatic (top two, four-player groups) + 2 automatic (three-player winners) + 15 wildcards (best of the 22-candidate pool).
- **Knockout reduction:** Q = 57, P = 32 → 7 byes, 50 into the playoff (25 ties) → 32 → 16 → 8 → 4 → 2 → Champion.
- **Complete path:** 22 groups → 57 qualifiers → 25 playoff ties + 7 byes → R32 → R16 → QF → SF → Final.

## 13. Competition administration and published information

### 13.1 Published before launch
Entry deadline + minimum threshold · draw date + method · the three group windows · every knockout window with its assigned real fixtures **(the window plan — see status block)** · scoring system + regulation-time rule · all tie-break orders · Extra-Time Accuracy + Penalty Number rules · postponed-match + correction procedures · any secondary competition.

### 13.2 Competition integrity
- Draw, group allocator, wildcard ranking and bracket generator must produce reproducible audit data.
- Opponent predictions and Penalty Numbers hidden until their applicable lock.
- No admin changes a user prediction after lock except a logged correction of a proven system/data error.
- Testing, simulated fixtures and fake-time scoring never touch the live Cup.
- The app always shows how a fixture was decided: normal time, AET, penalties or walkover.

## Final summary

Any field of six or more divides into groups of three and four. Three prediction windows under 3–1–0 table rules. ~Two-thirds qualify via automatic and wildcard places. A seeded playoff reduces to a power-of-two bracket. Tied knockout scores settle by lower scoreline error in extra time, then opposite-parity Penalty Numbers guarantee a winner. The last user standing is the EURO 2028 Predictor Cup Champion.
