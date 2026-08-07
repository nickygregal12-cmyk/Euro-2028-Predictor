# Scottish private Championship weekend rehearsal

**Dated evidence: 7 August 2026. Development only.**

This records the live Scottish Premiership rehearsal prepared for the real 8-9 August 2026 fixtures. It is intentionally a Development state record, not a production seed and not a migration contract.

## What was created

A deterministic private Predictor Championship was opened on the Scottish Premiership 2026/27 Development season with eight existing test accounts. No new Auth users were created.

The field is:

1. Nicky Gregal
2. Dev Tester
3. Al
4. Bo
5. Cristiano
6. Priya Shah
7. Alex Turner
8. Jordan Blake

The private competition id is `d3fa0007-2026-4808-8000-000000000001`.

The public Predictor Championship was deliberately left untouched. It still has its existing two entrants and no group/fixture structure. The public threshold opens into the multi-group format, and the repository does not yet have the driver required to launch that format. Bypassing that rule with seed data would prove the wrong competition.

## Matchweek 2 cards

Nicky Gregal's existing Scottish Match Predictor Matchweek 2 card was treated as immutable input: six predictions, already confirmed. The seed did not alter any of those score choices.

The seven supporting Development accounts had no Scottish Matchweek 2 entry/card before this rehearsal. They were joined to Match Predictor through `join_competition_game`, given deterministic score predictions through `save_season_prediction`, and confirmed through `confirm_season_matchweek_card`. All eight entrants now have a six-pick confirmed Matchweek 2 card.

The purpose is not to make the support players realistic predictors. It is to give the private Championship real, different player-owned Match Predictor cards to compare when the same real fixtures settle this weekend.

## Championship calendar

The existing season launch authority selected an eight-player `single_group` format: four meetings, 28 league rounds, followed by the already-defined seeded playoff tail.

The generated Championship begins on Scottish Matchweek 2. Nicky Gregal's first tie is **home vs Alex Turner**, using the 8-9 August Matchweek 2 fixture card. Later ties continue over the real Scottish season calendar; the draw is now fixed and must not be regenerated.

For Matchweek 2 the Championship window locks at **14:00 UTC / 15:00 BST on Saturday 8 August 2026**.

## Last Man Standing boundary

The existing Last Man Standing rehearsal was not changed. Nicky Gregal remains entered with **Aberdeen** selected for Matchweek 2. The LMS buffer locks that pick at **13:30 UTC / 14:30 BST on Saturday 8 August 2026**.

## What this proves and what it does not

This gives Development a real weekend state in which Nicky Gregal participates in Match Predictor, Last Man Standing and a live private Predictor Championship over the same Scottish fixtures.

The private Championship is not yet discoverable through the normal competition-games browser read: that read deliberately resolves only the current public instance. `get_season_cup_phase` can read a private competition when its id is already known, but the signed-in route has no bounded authority for discovering the caller's private Championship instances or naming the current opponent/fixture.

That is the next server contract, not something to work around in React. Contract 132 is already reserved by the concurrent provider initial-fixture approval branch. If it remains the next migration when that branch lands, the private Championship discovery/fixture read should reserve **Contract 133** at that time, after re-reading `main` and the deployment contract.

## Reproducibility

`scripts/seed-dev/seed-scottish-private-championship-weekend.ts` prints the rehearsal SQL but opens no database connection itself.

Its generated SQL:

- requires the exact eight Development identities before doing anything;
- requires Scottish Matchweek 2 to have six fixtures and still be unlocked on first application;
- refuses to replace Nicky Gregal's existing confirmed six-pick card;
- refuses to overwrite a partially populated support card;
- uses the existing player RPCs for Match Predictor membership, prediction saves and confirmation;
- creates only the private competition root directly, then uses the protected competition-admin launch authority;
- on a later replay, verifies the already-launched eight-player field and leaves it untouched;
- contains no delete, truncate or reset path.

The already-launched live Development state was verified after application: eight private Championship entrants, one group of eight, 28 Championship fixtures for Nicky across the league phase, all eight confirmed Matchweek 2 Match Predictor cards, the public Championship unchanged, and Nicky's Aberdeen LMS pick unchanged.
