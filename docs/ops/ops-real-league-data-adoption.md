# Real league data replaces the invented seed — development, 5 August 2026

Owner-authorised: *"replace the seeded clubs with the real 20, also need to do
the same with scottish premiership."* Development only. Production is untouched
and remains contract 63.

## Safety check taken before anything was deleted

Both league seasons held **zero entries and zero predictions**, so no player
work existed to destroy. That was measured first, not assumed — replacing clubs
cascades to fixtures, and fixtures are what predictions key to.

## Which provider carries which league, established by measurement

`/competitions` on the football-data key returns **12** competitions: BSA, ELC,
PL, CL, EC, FL1, BL1, SA, DED, PPL, PD, WC. England is Premier League and
Championship only — **the Scottish Premiership is not on this plan**, so no
amount of retrying that provider would have found it.

`/leagues` on the SportMonks token returns **4**: `501 Premiership` (Scottish),
`513 Premiership Play-Offs`, `271 Superliga`, `1659 Superliga Play-offs`. So the
two leagues this platform seeds come from two different providers, which is the
first real justification for the map being provider-scoped rather than global.

| League | Provider | Ids |
| --- | --- | --- |
| Premier League 2026/27 | `football-data` | competition 2021, season 2502 |
| Scottish Premiership 2026/27 | `sportmonks` | league 501, season 28275 |

## The identifier collision this immediately produced

**SportMonks `62` is Rangers. football-data `62` is Everton.** Both now exist in
`provider_entity_map` for the same platform, and neither can be confused with
the other, because the map is keyed by
`(provider, entity_kind, provider_id, tournament_id)` and its foreign keys to
`teams` are composite on `(tournament_id, team_id)`.

Contract 112 argued for that scoping on the grounds that the alternative fails
silently — producing plausible fixtures and a league table that is subtly untrue.
This is that failure, available on the second league added, five hours later.

## What replaced what

| | Premier League | Scottish Premiership |
| --- | ---: | ---: |
| Teams | 20 invented → **20 real** | 12 invented → **12 real** |
| Fixtures | 380 invented → **380 real** | 198 invented → **198 real** |
| Map rows | 0 → **59** (1 season, 38 rounds, 20 teams) | 0 → **46** (1 season, 33 rounds, 12 teams) |
| Kickoffs | 21 Aug 2026 – 30 May 2027 | 31 Jul 2026 – 10 Apr 2027 |

Every row came from a payload already archived in
`predictor_internal.provider_raw_responses`. **No further provider calls were
made to do the replacement.**

Rounds were matched by number rather than by label: football-data `matchday`
and SportMonks round `name` both map to `competition_rounds.ordinal`, which the
seed had already numbered `pl-mw1..38` and `sp-mw1..38`.

`provider_mapping_gaps` for the Premier League now returns **`ready: true`**
with no unmapped teams and no unmapped rounds, where hours earlier it returned
`ready: false` with all twenty and all thirty-eight.

## The Scottish 33 + 5 is confirmed by the source

The real season has **33 rounds carrying 198 fixtures**, ending 10 April 2027,
and **no fixtures at all** for the five post-split rounds — because the split is
not yet known. `sp-mw34` through `sp-mw38` are therefore correctly empty rather
than missing.

That is the format the owner corrected on 5 August, against a first attempt that
built a 22-round double round-robin. The provider agrees with the correction.

## The seed boundary, and a correction to how it was first described

`scripts/seed-dev/seed-league-seasons.ts` still generates the **invented** clubs
and a synthetic round-robin, and stays committed: CI and Browser E2E need a
deterministic calendar that never calls a provider.

This section first said re-running it would overwrite real football and cascade
away every `provider_entity_map` row. **That was wrong.** Read properly, the
seed already refused any season holding fixtures, deletes nothing anywhere, and
inserts clubs with `on conflict (tournament_id, name) do nothing`. Re-running it
against development today is a no-op that prints a notice.

The genuine residual was narrower. Had fixtures been cleared while the clubs and
their map rows survived, the fixture guard would not have fired and twenty
invented clubs would have landed **alongside** the twenty real ones — no
invented name collides with a real one, so nothing would have conflicted, and
the generator would then have built a calendar over forty clubs.

The seed now refuses any season holding provider-mapped clubs, checked **before**
the fixture guard because the two protect against different things. Reached
second, it would be skipped in exactly the case it exists for. The ordering is
pinned by test, as is the continued absence of any delete.

## What this is still not

No import authority exists. This replacement was a one-off operation over
archived payloads, not a repeatable path — nothing in the repository can take
tomorrow's payload and apply it. That remains the automatic fixture import ADR
0020 §Ingestion decides, and it is now unblocked for the first time: the map has
rows, so a decoded fixture finally resolves to real rows.
