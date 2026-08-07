# DFA-007 evidence — Scottish Premiership playable Development rehearsal

**Date:** 7 August 2026  
**Environment:** Development Supabase `iouzoutneyjpugbbtdem`, repository/hosted contract 131  
**Scope:** the truthful Scottish Premiership 2026/27 hand-off from completed Matchweek 1 into actionable Matchweek 2 for Match Predictor and public Last Man Standing, plus the public Predictor Championship launch boundary.

## Boundary

This is hosted Development evidence, not a migration and not production state. The rehearsal used the existing protected season-result, scoring, competition-open and player-selection authorities. No direct fixture-result, game-calendar, Cup-draw or LMS-selection table write was used.

The starting state was measured immediately before the rehearsal:

- Scottish Premiership: 38 league-matchweek records, 198 season fixtures, zero played fixtures;
- Matchweek 1: six scheduled fixtures, zero confirmed results;
- public LMS: two entrants, no setup, no windows and no selections;
- public Predictor Championship: two entrants, no draw, groups or fixtures;
- the primary test player already held six confirmed Match Predictor predictions for Matchweek 2. Those rows were treated as pre-existing player state and were not rewritten by the rehearsal.

## Matchweek 1 — protected result truth

The six real opening-weekend results were confirmed through `public.admin_confirm_season_fixture_result`, under the existing result-administration gate:

| Fixture | Confirmed result |
| --- | ---: |
| Dundee United v Rangers | 1–1 |
| Falkirk v St. Mirren | 0–2 |
| Aberdeen v Hearts | 2–1 |
| St. Johnstone v Kilmarnock | 4–3 |
| Hibernian v Motherwell | 1–2 |
| Celtic v Dundee | 1–0 |

Every fixture finished `status = played`, with both score columns present and revision `1 / confirm` in `predictor_internal.season_fixture_result_revisions`.

`public.process_due_season_matchweek_scores()` then completed successfully: two league seasons were attempted and settled, with zero failures. It correctly wrote **zero player-score rows** for this Scottish Matchweek 1 because neither Development test entry had a lock-consistent Matchweek 1 prediction card. No post-lock prediction was invented or backfilled to make the rehearsal look complete.

A caller-scoped `get_season_matchweek_card` read for the primary test player subsequently returned all six Matchweek 1 fixtures as `played` with the confirmed results, `card_status = no_submission` and no fabricated settled points.

## Matchweek 2 — existing Match Predictor state preserved

The same caller-scoped card read for Matchweek 2 remained `confirmed` and retained all six predictions that existed before this rehearsal. Their score/version tuples were unchanged, including the already-edited Rangers v Hibernian row at version 3.

This matters because the rehearsal was allowed to establish last-week result truth and this-week game availability, but not to overwrite a player's existing choices merely to simplify the demo state.

## Last Man Standing — begins at Matchweek 2

The public Scottish Premiership LMS competition was opened through `public.admin_open_season_competition` under the existing competition-administration gate.

Outcome:

- `outcome = opened`;
- Classic public setup written;
- 32 remaining windows created;
- sequence 1 is **Matchweek 2**;
- first window contains the six real Matchweek 2 season fixtures;
- first lock is `2026-08-08T13:30:00Z`;
- no Matchweek 1 LMS window or selection history was created.

This proves the accepted rule that the Scottish LMS rehearsal starts at Matchweek 2 rather than pretending a Matchweek 1 game existed.

### Player persistence proof

Using the normal `save_lms_selection` player RPC rather than an administrator write:

1. the primary test player selected **Dundee** in Matchweek 2;
2. the next LMS round read returned Dundee as the stored selection at version 0;
3. before lock, the player changed the pick to **Aberdeen** using optimistic concurrency against version 0;
4. the following read returned Aberdeen at version 1;
5. a direct post-operation evidence read of the stored selection agreed: Aberdeen, version 1, used cycle 0.

The change therefore survived the same server round-trip/reload boundary the production page uses.

## Predictor Championship — truthful refusal, not synthetic success

The public Scottish Predictor Championship was also offered to `public.admin_open_season_competition` through the same protected competition-administration gate.

It correctly returned:

- `outcome = not_open`;
- `reason = below_threshold`;
- entrants = 2;
- shortfall = 98;
- fixtures = 0.

A post-call database check confirmed no draw timestamp, groups or Cup fixtures were created.

The public Championship launch contract therefore requires a 100-player field. Creating 98 synthetic retained users merely to turn this evidence green would hide the real product dependency and would violate the purpose of a truthful Development rehearsal. The Championship portion of DFA-007 remains incomplete until Development has an approved deterministic seeded-field strategy or the owning requirement/launch policy is deliberately changed.

ADR 0024 does require deterministic seed users, but the implemented reset command is deliberately **local only**: `scripts/reset-development-seed.mjs` hard-refuses both hosted project refs and states that hosted Development changes use a separate guarded path. The repository therefore has no existing governed command that can legitimately expand the hosted Championship field to 100. That missing hosted-seed path is a real prerequisite rather than a reason to bypass the launch threshold with direct Auth/table writes.

## DFA-007 verdict

**Partially proven, not complete.**

Proven on hosted Development:

- real Matchweek 1 football entered only through the protected result gate;
- normal season rederivation/scoring job runs cleanly after those results;
- Matchweek 1 is readable as completed football without invented predictions or points;
- the existing Matchweek 2 Match Predictor card remains intact;
- public LMS legitimately starts at Matchweek 2 with no invented Matchweek 1 history;
- a Matchweek 2 LMS pick can be made, changed before lock and read back persistently.

Still missing from the accepted DFA-007 evidence:

- a lock-consistent seeded Matchweek 1 prediction card that can demonstrate an actual Match Predictor points feed without post-lock fabrication;
- a governed hosted Development seed path capable of producing a Predictor Championship field large enough to pass its public launch threshold;
- after launch, the bounded Championship opponent/fixture read and the My Fixture / Fixtures UI needed to prove opponent, fixture, phase and table as one player journey.

The correct next step is to solve those missing authorities/test-fixture requirements deliberately. This rehearsal should not be repeated by overwriting the now-valid Matchweek 2 player state.