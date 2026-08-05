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

## Standing state left behind

The target row is **enabled at a 60-minute cadence**, so `pg_cron` will poll
hourly from now on and archive roughly 365 KB per call — about 8.8 MB a day,
with no consumer for any of it until the import exists. That is a deliberate
choice to leave running, and a cheap one to widen; it is recorded here so the
growth is expected rather than discovered.
