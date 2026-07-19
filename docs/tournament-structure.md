# Euro 2028 — Tournament Structure Reference

Source-of-truth document for tournament facts, fixture skeleton, third-place ranking rules, and the round-of-16 allocation table. Domain functions (`rankThirdPlacedTeams()`, `resolveRoundOf16()`, `advanceBracket()`) implement exactly this.

> ⚠️ **VERIFICATION STATUS:** Fixture skeleton, venues, dates, and R16 slot structure are from UEFA's official Euro 2028 schedule (published Nov 2025, confirmed via uefa.com July 2026). The third-place ranking criteria and 15-combination allocation table are the Euro 2024 rules, carried over because the 2028 slot structure is identical — **but must be re-verified against the final UEFA Euro 2028 regulations when published (expected around the Dec 2026 qualifying draw or later)**. Do not remove this banner until verified.

---

## 1. Tournament facts

- **Dates:** 9 June – 9 July 2028
- **Hosts:** England, Scotland, Wales, Republic of Ireland (UK & Ireland joint bid)
- **Teams:** 24, in six groups of four (A–F)
- **Matches:** 51 across 9 stadiums in 8 cities
- **Kick-off times:** 15:00, 18:00, 21:00 CEST (14:00/17:00/20:00 UK/Ireland local). Final kicks off 18:00 CEST / 17:00 local. Per-matchday times confirmed after the draw in 2027.
- **Host group slots (if qualified at draw time):** Wales → A1, England → B1, Northern Ireland → D1, Republic of Ireland → E1, Scotland → F1

## 2. Venues

| City | Stadium | Notes |
|---|---|---|
| Cardiff | National Stadium of Wales (Principality) | Opening match |
| London | Wembley Stadium | Both semi-finals + final; no R16 here |
| London | Tottenham Hotspur Stadium | |
| Manchester | Manchester City Stadium (Etihad) | |
| Liverpool | Everton Stadium (Hill Dickinson) | |
| Newcastle | St James' Park | |
| Birmingham | Villa Park | |
| Glasgow | Hampden Park | |
| Dublin | Dublin Arena (Aviva) | |

## 3. Group stage fixture skeleton

Slot notation: A1–A4 are the four draw positions in Group A, etc. Real teams fill these after the Dec 2026 qualifying draw / March 2028 play-offs.

| Date | Fixture | Venue |
|---|---|---|
| 09/06 | A1 v A2 (opening match) | Cardiff |
| 10/06 | A3 v A4 | Glasgow |
| 10/06 | B1 v B2 | Manchester |
| 10/06 | B3 v B4 | Dublin |
| 11/06 | C1 v C2 | Wembley |
| 11/06 | C3 v C4 | Birmingham |
| 11/06 | D3 v D4 | Liverpool |
| 12/06 | D1 v D2 | Tottenham |
| 12/06 | E1 v E2 | Dublin |
| 12/06 | E3 v E4 | Newcastle |
| 13/06 | F1 v F2 | Glasgow |
| 13/06 | F3 v F4 | Manchester |
| 14/06 | A1 v A3 | Cardiff |
| 14/06 | A2 v A4 | Liverpool |
| 14/06 | B1 v B3 | Wembley |
| 15/06 | B2 v B4 | Birmingham |
| 15/06 | C1 v C3 | Tottenham |
| 15/06 | C2 v C4 | Newcastle |
| 16/06 | D1 v D3 | Wembley |
| 16/06 | D2 v D4 | Manchester |
| 16/06 | E1 v E3 | Dublin |
| 17/06 | E2 v E4 | Liverpool |
| 17/06 | F1 v F3 | Glasgow |
| 17/06 | F2 v F4 | Newcastle |
| 18/06 | A4 v A1 | Cardiff |
| 18/06 | A2 v A3 | Tottenham |
| 19/06 | B4 v B1 | Wembley |
| 19/06 | B2 v B3 | Dublin |
| 20/06 | C4 v C1 | Manchester |
| 20/06 | C2 v C3 | Liverpool |
| 20/06 | D4 v D1 | Birmingham |
| 20/06 | D2 v D3 | Newcastle |
| 21/06 | E4 v E1 | Dublin |
| 21/06 | E2 v E3 | Tottenham |
| 21/06 | F4 v F1 | Glasgow |
| 21/06 | F2 v F3 | Cardiff |

Final round of matches in each group kicks off simultaneously (standard UEFA practice — verify exact times after the 2027 announcement).

## 4. Round of 16

| Date | Fixture | Venue | R16 ref |
|---|---|---|---|
| 24/06 | Winner A v Runner-up C | Cardiff | R16-1 |
| 24/06 | Runner-up A v Runner-up B | Liverpool | R16-2 |
| 25/06 | Winner B v 3rd place (A/D/E/F) | Newcastle | R16-3 |
| 25/06 | Winner C v 3rd place (D/E/F) | Manchester | R16-4 |
| 26/06 | Winner F v 3rd place (A/B/C) | Glasgow | R16-5 |
| 26/06 | Runner-up D v Runner-up E | Tottenham | R16-6 |
| 27/06 | Winner E v 3rd place (A/B/C/D) | Dublin | R16-7 |
| 27/06 | Winner D v Runner-up F | Birmingham | R16-8 |

## 5. Quarter-finals, semi-finals, final

Feed-through is by venue of the preceding round:

| Date | Fixture | Venue | QF ref |
|---|---|---|---|
| 30/06 | Winner R16-3 (Newcastle) v Winner R16-1 (Cardiff) | Wembley | QF-1 |
| 30/06 | Winner R16-5 (Glasgow) v Winner R16-6 (Tottenham) | Dublin | QF-2 |
| 01/07 | Winner R16-4 (Manchester) v Winner R16-2 (Liverpool) | Cardiff | QF-3 |
| 01/07 | Winner R16-7 (Dublin) v Winner R16-8 (Birmingham) | Glasgow | QF-4 |

| Date | Fixture | Venue |
|---|---|---|
| 04/07 | Winner QF-1 (Wembley) v Winner QF-2 (Dublin) | Wembley (SF-1) |
| 05/07 | Winner QF-2... see note | Wembley (SF-2) |
| 09/07 | Final: Winner SF-1 v Winner SF-2 | Wembley |

**SF-2 is Winner QF-4 (Glasgow) v Winner QF-3 (Cardiff).** (UEFA lists semis as "Wembley QF winners vs Dublin QF winners" and "Glasgow QF winners vs Cardiff QF winners".)

## 6. Third-place ranking criteria

All six third-placed teams are ranked; top four advance. Criteria in order (Euro 2024 rules — verify for 2028):

1. Higher number of points
2. Superior goal difference
3. Higher number of goals scored
4. Higher number of wins
5. ~~Lower disciplinary points~~ — **not predictable → skipped in app**
6. ~~European Qualifiers ranking position~~ — **not predictable → skipped in app**

**App behaviour:** criteria 1–4 are pure calculation in `rankThirdPlacedTeams()`. If teams are still tied after criterion 4, return an unresolved marker identifying the tied teams and positions → UI shows a manual tie-resolution prompt (same pattern as group tie-breaks).

## 7. Third-place → R16 allocation table (15 combinations)

Which four groups supply the qualifying thirds determines exactly which third goes to which R16 slot. Allocation is by this table only — the ranking order of the thirds (1st best vs 4th best) is irrelevant to placement.

Slot key: **WB** = Winner B's opponent (R16-3), **WC** = Winner C's opponent (R16-4), **WE** = Winner E's opponent (R16-7), **WF** = Winner F's opponent (R16-5).

| Qualifying thirds from groups | WB plays | WC plays | WE plays | WF plays |
|---|---|---|---|---|
| A B C D | 3A | 3D | 3B | 3C |
| A B C E | 3A | 3E | 3B | 3C |
| A B C F | 3A | 3F | 3B | 3C |
| A B D E | 3D | 3E | 3A | 3B |
| A B D F | 3D | 3F | 3A | 3B |
| A B E F | 3E | 3F | 3B | 3A |
| A C D E | 3E | 3D | 3C | 3A |
| A C D F | 3F | 3D | 3C | 3A |
| A C E F | 3E | 3F | 3C | 3A |
| A D E F | 3E | 3F | 3D | 3A |
| B C D E | 3E | 3D | 3B | 3C |
| B C D F | 3F | 3D | 3C | 3B |
| B C E F | 3F | 3E | 3C | 3B |
| B D E F | 3F | 3E | 3D | 3B |
| C D E F | 3F | 3E | 3D | 3C |

**Source & verification:** Euro 2024 official UEFA allocation table (via BBC Sport reproduction of UEFA's grid). Cross-checked against two real Euro 2024 outcomes:
- Actual CDEF result: England(WC)–3E Slovakia, Spain(WB)–3F Georgia, Portugal(WF)–3C Slovenia, Romania(WE)–3D Netherlands ✓ matches row
- Reported ACDE alternative: WC–3D, WB–3E, WF–3A, WE–3C ✓ matches row

**Constraint sanity check (every row must satisfy):** WB's opponent ∈ {A,D,E,F}; WC's opponent ∈ {D,E,F}; WE's opponent ∈ {A,B,C,D}; WF's opponent ∈ {A,B,C}. A unit test should assert this for all 15 rows.

> ⚠️ Carried over from Euro 2024 because the 2028 slot structure (which winners face thirds, and each slot's allowed groups) is identical. **Re-verify against the official Euro 2028 regulations when published.** If UEFA's 2028 table differs in any row, this table and `resolveRoundOf16()`'s lookup must be updated together.

## 8. Implementation notes for domain functions

- `resolveRoundOf16()` takes: group winners, runners-up, and the ranked list of qualifying thirds (with their group letters) → returns the eight R16 fixtures by slot reference. The third-place placement is a pure lookup into the section 7 table keyed by the *set* of qualifying group letters.
- Never hardcode team names into bracket logic — slots only. Real teams resolve through slots at render/scoring time.
- `advanceBracket()` operates purely on slot references (R16-1 … R16-8 → QF-1 … QF-4 → SF-1, SF-2 → Final) per sections 4–5.
- A unit test must cover **all 15 combinations** in section 7, plus the constraint sanity check.
- Knockout draws after 90 minutes: users predict a single winner per KO match (winner-only mode), so extra time/penalties don't need modelling in predictions — but `match_results` supports them for real results (already in the DB schema design).
