# First live provider poll — development, 5 August 2026

The first time this platform has contacted a football data provider. Recorded
because it is the step every ingestion item was waiting behind, and because what
it proves is narrower than "ingestion works".

## What ran

| | |
| --- | --- |
| Environment | Development `iouzoutneyjpugbbtdem` — **not** production |
| Contract | 115, applied earlier the same day on `16ce4d5` |
| Target | `football-data` · `/competitions/PL/matches` · Premier League 2026/27 · cadence 60 minutes |
| Driver | `public.dispatch_due_provider_polls()`, invoked once by hand rather than waiting for `pg_cron` |
| Owner authorisation | Given explicitly for one bounded target before the first credential spend |

## The chain, and where each link was proved

```
pg_cron → dispatch_due_provider_polls() → vault → net.http_post
        → provider-poll Edge Function → api.football-data.org
        → archive_provider_response → record_provider_response_processing
```

The dispatcher returned `{"configured": true, "due": 1, "dispatched": 1,
"failed": 0}`. The dispatch record carries `succeeded = true` against pg_net
request id 6, and the Edge Function answered **HTTP 200**.

Custody held. `predictor_internal.provider_raw_responses` holds **one** row —
status 200, **365,300 bytes** of verbatim response body, archived *before* any
decoding. `predictor_internal.provider_response_processing` holds one row,
`succeeded = true`, `decoded_fixture_count = 380`, no error code. So the archive
happened first and the decode is recorded as evidence rather than assumed.

## What came back

Real 2026/27 Premier League:

| | |
| --- | --- |
| Fixtures | 380 |
| Distinct teams | 20 |
| Distinct matchdays | 38 |
| Competition / season provider ids | `2021` / `2502` |
| Kickoff range | 2026-08-21T19:00Z to 2027-05-30T12:00Z |
| Statuses | `SCHEDULED` only |
| Fixtures carrying a score | 0 |

All decoded by the **committed** `providerDecoders.ts` — the same module the
ingestion tests exercise — with no contract mismatch, so the strict decoder
accepted a real payload rather than only the fixtures written for it.

## What it does NOT prove

Nothing was written to `season_fixtures`. The 578 invented development fixtures
across the two league seasons are untouched and remain the seed, not football.

`predictor_internal.provider_mapping_gaps` reports `ready: false` with **20
unmapped teams** (38 fixtures each) and **38 unmapped rounds** (10 fixtures
each) — which is to say, all of them. That is the designed answer, not a
failure: `provider_entity_map` is empty, so the first poll's job is to name
precisely which clubs and matchdays need mapping before anything can be
imported. Provider id `61` means nothing to this platform until somebody says
which of our `teams` rows it is.

SportMonks and API-Football remain uncontacted. Their credentials are set as
Edge Function secrets and remain unproven.

## Standing state left behind — corrected the same hour

The target was created **enabled at a 60-minute cadence**, which would have
archived roughly 365 KB an hour with no consumer for any of it. The owner's
direction on seeing that: it does not need updating hourly during development,
and there is no point spending API calls on it — check again in a week or so.

A week is not expressible. `provider_poll_targets_cadence_bounded` caps
`cadence_minutes` at 1440, and the migration says why in as many words: *a
target polled less often than daily is not a poll, it is a manual refresh with
extra machinery.* This is that case, so the target is **disabled** rather than
given a cadence pretending to be a schedule.

Verified after the change: `due_provider_poll_targets(now())` returns 0,
`dispatch_due_provider_polls()` returns `{"configured": true, "due": 0,
"dispatched": 0, "failed": 0}`, and `provider_poll_dispatches` holds **exactly
one row** — the hourly cadence never came round a second time. **One API call
has been spent against football-data in total.**

The row is kept rather than deleted, so the working target survives as the
reference for what a correct one looks like. Re-enabling is one statement:

```sql
update public.provider_poll_targets set enabled = true
 where provider = 'football-data' and path = '/competitions/PL/matches';
```

A refresh before then is deliberate rather than scheduled: enable, call
`public.dispatch_due_provider_polls()`, disable again. The job continues to run
every five minutes and continues to do nothing, which is the state contract 115
was designed to sit in.
