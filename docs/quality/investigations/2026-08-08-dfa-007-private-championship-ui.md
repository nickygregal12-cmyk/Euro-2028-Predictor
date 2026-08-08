# DFA-007 — private Predictor Championship UI boundary

Date: 8 August 2026  
Scope: Scottish Premiership Development rehearsal  
Status: UI clean-restacked onto the exact Contract 133 candidate; hosted Development remains at Contract 132 pending the guarded rollout

## Problem reproduced

The hosted private Scottish Predictor Championship exists and the Development player `Nicky Gregal` is an active entrant, but the Contract-132 signed-in application cannot discover it.

The season game catalogue resolves one `predictor_cup` id for the season. That authority deliberately resolves the current **public** competition. The pre-existing Championship route therefore treats the public competition id as if it were the only Championship instance and passes that id directly to the phase read.

That is why a correctly seeded private Championship can exist in the database while nothing appears for the player in the UI.

The browser cannot repair this by joining `bonus_competitions`, `bonus_competition_entrants`, `bonus_cup_groups`, `bonus_cup_members` or `bonus_cup_fixtures`: authenticated direct SELECT is revoked on the private competition tables. That boundary is retained.

## UI model

`/competitions/:competition/:season/games/championship` becomes the **Championship instance index**, not an alias for the public Championship.

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

## Contract 133 server boundary

Contract 132 is now landed. Contract 133 is the active backend candidate and introduces:

- `public.get_my_season_cup_instances(uuid)`
- `public.get_season_cup_player_view(uuid)`

Instance discovery returns the public Predictor Championship plus private Predictor Championships only when the authenticated caller is already an entrant. It returns only presentation state required by the index.

The explicit player view returns player data only when the caller is an entrant. It reuses `public.get_season_cup_phase(uuid)` for authoritative phase/group/table state rather than creating a second ranking implementation, and adds disclosed member display names plus the caller's group schedule.

The Contract-133 migration has pgTAP, privilege and database-parity coverage. Its repository candidate is kept separate from this UI branch so the schema contract can merge first.

## Earlier rollback-only hosted Development proof

Before Contract 133 was committed, the proposed functions were created inside transactions against hosted Development, exercised under authenticated JWT claims, and rolled back. A persistent post-check confirmed neither function remained installed.

For the existing Development account `Nicky Gregal`, discovery returned the seeded private Scottish Predictor Championship and the player view returned the existing eight-player initial group, server-ranked table, disclosed member names and complete group schedule. Nicky Gregal vs Alex Turner was marked as the caller fixture for Matchweek 2.

An authenticated outsider saw zero private Championship instances. Calling the explicit player view with the real private competition UUID returned only the minimal non-member shape and disclosed no private visibility, entrant count, member names, group, table, fixtures or existence signal.

## Clean-restack evidence

The original UI work lived on draft PR #585 and had diverged from the backend stack. It is not being rebased or force-merged.

The genuine 13-file UI delta was isolated. Twelve application/test files are copied byte-for-byte from the reviewed #585 head onto a new branch created from the exact Contract-133 candidate. This investigation note is rewritten before landing so it describes the current contract order rather than the superseded pre-132 state.

The UI branch therefore carries no stale backend history and no guessed migration state.

## Remaining acceptance boundary

DFA-007 is not complete until all of the following are true:

1. the exact Contract-133 candidate passes all required CI, database parity, Browser E2E, hosted-inventory and CodeQL gates and merges to `main`;
2. hosted Development is upgraded from Contract 132 to 133 through the repository's guarded Development fast lane;
3. the clean Championship UI branch is validated against post-133 `main`;
4. the real signed-in Development player can discover and open the seeded private Championship in the browser;
5. the private/non-member boundary is rechecked against the persistent hosted functions;
6. full repository CI and browser coverage pass on the UI candidate;
7. Matchweek settlement continues through confirmed canonical football results rather than provider evidence.

No provider response, private-table browser grant or client-side ranking shortcut is introduced by this UI work.
