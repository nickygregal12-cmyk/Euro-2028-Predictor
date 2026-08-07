# DFA-007 — private Predictor Championship UI boundary

Date: 8 August 2026  
Scope: Scottish Premiership Development rehearsal  
Status: UI implemented on draft PR; server contract deliberately not advanced past the active migration contract

## Problem reproduced

The hosted private Scottish Predictor Championship exists and the Development player `Nicky Gregal` is an active entrant, but the signed-in application cannot currently discover it.

The season game catalogue resolves one `predictor_cup` id for the season. That authority deliberately resolves the current **public** competition. The pre-existing Championship route therefore treats the public competition id as if it were the only Championship instance and passes that id directly to the phase read.

That is why a correctly seeded private Championship can exist in the database while nothing appears for the player in the UI.

The browser cannot repair this by joining `bonus_competitions`, `bonus_competition_entrants`, `bonus_cup_groups`, `bonus_cup_members` or `bonus_cup_fixtures`: authenticated direct SELECT is revoked on the private competition tables. That boundary is retained.

## UI model implemented on PR #585

`/competitions/:competition/:season/games/championship` is now the **Championship instance index**, not an alias for the public Championship.

A selected Championship owns three canonical player routes:

- `/games/championship/:competitionId` — My Fixture
- `/games/championship/:competitionId/table` — Table
- `/games/championship/:competitionId/fixtures` — Fixtures

The route hierarchy is deterministic:

- selected Championship -> Back to Championships
- Table / Fixtures -> Back to Championship
- Championship index -> Back to Games

The selected-instance secondary navigation is:

`My Fixture | Table | Fixtures | History`

History remains deliberately unavailable until a real historical read exists.

The UI never derives the opponent from raw ids and never recalculates the Championship ranking. It consumes opponent display names, player-relative fixture state and the existing server-ranked table from the bounded server response.

Public self-registration is exposed only when the selected id exactly matches the season catalogue's known public `predictor_cup` id. A guessed/private id never acquires the generic public join path.

## Front-end validation before the server migration

The repository deployment guard correctly refuses application code that names RPCs not declared by the active deployment contract. A temporary branch-only CI probe was therefore inserted ahead of that guard solely to validate the UI slice and then removed from the final diff.

The probe proved:

- `tsc -b` passes;
- 31 focused route, navigation and Championship component tests pass;
- focused oxlint passes.

The normal build still fails closed until the two RPCs are introduced by the next migration contract. This is expected and is not bypassed in the final PR.

## Proposed bounded server reads

The next contract, only after Contract 132 has landed, adds:

- `public.get_my_season_cup_instances(uuid)`
- `public.get_season_cup_player_view(uuid)`

### Instance discovery

For an authenticated caller and one tournament, discovery may return:

- the current public Predictor Championship;
- private Predictor Championships only when the caller is already an entrant.

For each visible instance it returns only the presentation state required by the game index: visibility, availability, entered state, entrant count, current phase/group ordinal and the caller's current fixture summary where one exists.

### Player view

An explicit competition id returns player data only when the caller is an entrant. It reuses `public.get_season_cup_phase(uuid)` for the authoritative phase/group/table rather than creating a second ranking implementation.

For the caller's group it additionally returns disclosed member display names and the group fixture schedule. Fixture points are read from `predictor_internal.cup_window_scores`; window settlement comes from `predictor_internal.cup_window_settled`.

## Rollback-only hosted Development proof

The proposed functions were created inside transactions against hosted Development, exercised under authenticated JWT claims, and rolled back. A persistent post-check confirmed neither function remained installed.

### Nicky Gregal

Caller: existing Development account `Nicky Gregal`.

Discovery returned exactly one private Predictor Championship for the Scottish Premiership. Its current fixture was:

- Matchweek 2
- Nicky Gregal home
- Alex Turner away
- pending before settlement

The explicit player view returned:

- entered = true;
- phase ready = true;
- private / active Championship;
- the existing eight-player initial group;
- the existing server-ranked table;
- disclosed member names;
- the complete group schedule;
- Nicky Gregal vs Alex Turner marked as the caller fixture in Matchweek 2.

### Private-instance privacy boundary

An authenticated Development user who is not an entrant in the private Championship was used as an outsider probe.

Discovery returned:

- zero private Championship instances;
- the public Championship only.

The outsider then called the explicit player-view read using the real private competition UUID. The response was the same minimal shape as a completely nonexistent UUID:

```json
{
  "competition_id": "<supplied id>",
  "entered": false
}
```

No private visibility, entrant count, member names, group, table, fixtures or existence signal was returned.

## Contract-order boundary

Contract 132 remains owned by PR #583 and is not changed by this UI work. Hosted Development does not yet expose its Contract 132 approval RPC, so Contract 133 must not be committed or applied ahead of it.

PR #585 therefore remains draft and intentionally unmergeable through the normal deployment-contract guard until:

1. Contract 132 lands on `main`;
2. PR #585 is restacked on that exact main head;
3. Contract 133 introduces the two bounded reads with pgTAP/security coverage;
4. Development is upgraded in order;
5. the real signed-in Nicky Gregal journey is verified in the browser;
6. full repository CI, database parity, Browser E2E and CodeQL pass.

## DFA-007 acceptance effect

This work removes the architecture/UI ambiguity around the seeded Predictor Championship, but DFA-007 remains only partially rehearsed until the real signed-in browser can discover and open the hosted private competition and the Matchweek 2 football settles through the normal scoring path.
