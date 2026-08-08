# Provider capability and terms audit — 8 August 2026

**Status:** measured Development evidence plus current public provider terms  
**Purpose:** first implementation step from `docs/architecture/provider-enrichment-plan.md`  
**Scope:** provider subscription capability, Scottish/Premier League coverage, rate limits, enrichment suitability and media/data-use constraints  
**Does not authorise:** a new provider, schema migration, provider-to-result truth, public image use or Production polling

## Executive finding

The three providers currently supported by the `provider-poll` Edge Function are **not interchangeable under the project's actual subscriptions**.

- **SportMonks is the only currently proven source for 2026/27 Scottish Premiership fixture/live-score evidence.** The Development free plan returns the current Scottish league and its retained response reports a 3,000-call rate limit with ample remaining capacity.
- **football-data.org currently supplies the 2026/27 Premier League calendar but not the Scottish Premiership.** The same Development credential returns all 380 Premier League fixtures and HTTP 403 for `SPL`.
- **API-Football exposes the desired enrichment endpoints, including match-lineup shirt colours, but the current free subscription does not permit the 2026 Scottish season.** The measured request returns HTTP 200 with an application-level plan error and zero fixtures.
- **SportDB.dev remains an enrichment candidate, not a supported provider.** No SportDB provider exists in the repository Edge Function/decoder contract, so its actual credential, plan and response coverage cannot be measured through the controlled custody path without first adding an explicitly reviewed enrichment-only integration. Its public terms also state that the free tier is for testing and Production use requires a paid plan.

The immediate implementation consequence is to use already archived SportMonks Scottish responses for the first durable team/profile mapping slice. Do not pay additional request cost merely to re-fetch identity data that is already retained.

## Measured Development evidence

All measurements below come from retained provider responses in the Development database. No credential value is printed or copied.

### SportMonks

Representative retained request:

`GET /v3/football/fixtures/between/2026-08-08/2026-08-09?filters=fixtureLeagues:501&include=participants;scores;round`

Latest checked evidence at 14:45 UTC on 8 August 2026:

- HTTP 200;
- Scottish Premiership league id `501`;
- six weekend fixtures decoded successfully;
- live/current score evidence present for the two Saturday matches;
- retained response rate-limit header: `3000` limit, `2995` remaining at that request;
- the payload already carries team id, name, short code, founded year, country id, venue id and `image_path` for participants;
- Development already holds 12 Scottish team mappings, 33 round mappings and one season mapping for SportMonks.

The retained subscription metadata identifies the account as `Football Free Plan` / `Standard`. SportMonks' current public free-plan page explicitly lists the Scottish Premiership, including play-offs, among its free football leagues.

**Use now:** Scottish fixtures, provisional live score/status evidence, round/team identity, and first-pass Scottish team reference enrichment.

**Do not infer:** that every paid/deeper endpoint is available on this free subscription, or that a returned team/player image may be publicly displayed without separate rights.

### football-data.org

Measured 5 August 2026:

`GET /v4/competitions/PL/matches`

- HTTP 200;
- season filter `2026`;
- 380 Premier League fixtures;
- first fixture date 21 August 2026;
- last fixture date 30 May 2027.

Measured 7 August 2026:

`GET /v4/competitions/SPL/matches?dateFrom=2026-07-31&dateTo=2026-08-07`

- HTTP 403;
- provider message says the resource is restricted and outside the current subscription permissions.

**Use now:** Premier League fixture/calendar evidence where the existing controlled provider path needs it.

**Do not use now:** Scottish Premiership polling or Scottish enrichment under the current subscription.

### API-Football

Measured 7 August 2026:

`GET /fixtures?league=179&season=2026&from=2026-07-31&to=2026-08-07`

- HTTP transport status 200;
- provider result count `0`;
- provider `errors.plan` states that the free plan does not have access to the 2026 season and suggests seasons 2022–2024.

The current API-Football documentation and product pages state that all endpoints exist on the free tier but the free plan is restricted by available seasons. The current published free quota is 100 requests/day and 10 requests/minute. Coverage is explicitly season/fixture-dependent even when an endpoint family is available.

API-Football remains the strongest **schema candidate** for match-specific kit colours because lineup payloads expose separate player and goalkeeper `primary`, `number` and `border` colours. That capability is not the same as subscription availability: the project cannot depend on 2026/27 Scottish kit-colour reads until a representative current-season lineup succeeds under the actual account.

**Use now:** no 2026/27 Scottish runtime dependency.

**Use after plan/coverage proof:** fixture-scoped shirt colours and potentially confirmed lineups/events.

### SportDB.dev

The owner has identified SportDB.dev as a fourth configured API, but the repository's deployed `provider-poll` function currently accepts only:

- `sportmonks`;
- `api-football`;
- `football-data`.

There is no SportDB decoder/provider config in that controlled path. The audit therefore has **no safe measured SportDB request** and records this as an integration gap rather than inventing subscription capability.

Current public SportDB terms state:

- REST data includes countries, competitions, teams, players, standings, fixtures and match details;
- the free tier is for testing;
- Production usage requires a paid plan;
- plans impose monthly quotas and requests-per-second limits;
- API reselling/sublicensing requires prior written permission;
- use must respect third-party terms and intellectual-property rights.

**Use now:** none in runtime or canonical provider evidence.

**Next proof required:** an enrichment-only adapter or other controlled server-side read that can measure the actual account without giving SportDB result/scoring authority.

## Media and retention constraints

### Team crests, player photos and other images

A URL returned by an API is **not proof that the project owns public-display rights**.

- SportMonks states that logos/profile photos remain copyrighted by their legal owners and that the application must arrange proof of intellectual property before displaying them.
- football-data.org states that team logos/profile photos are copyrighted by their legal owners and consent/proof of intellectual property must be arranged by the customer.
- API-SPORTS states that logos/images/trademarks are supplied for identification/descriptive purposes, that it does not own those assets, and that additional authorization may be required from rights holders.
- SportDB's public terms prohibit use that violates third-party IP rights and do not establish a blanket club-logo licence.

Therefore the first enrichment schema may retain a **provider image reference/provenance field for later rights resolution**, but public UI must not assume it may render or re-host those assets. Do not copy provider crest binaries into project storage without a separate rights decision.

### Data retention

- SportMonks' current terms allow distribution/transfer/storage of data supplied by the service while prohibiting unapproved resale of the provider's product. This supports the existing custody model for permitted data, subject to the separate third-party image rule.
- football-data.org explicitly says that after cancellation the customer may no longer reference football data obtained through the API on their site/service. Long-lived product reliance must therefore remain subscription-aware rather than assuming perpetual post-cancellation display rights.
- API-SPORTS availability and free-plan data may change without notice; stored enrichment should keep provider/fetched timestamps and must degrade safely when current data becomes unavailable.
- SportDB Production use requires a paid plan under its published terms; its retention/media details remain unapproved until the actual account and relevant endpoint terms are measured.

## Preferred-source matrix after this audit

| Enrichment / evidence domain | Preferred source now | Fallback / blocker | Decision |
| --- | --- | --- | --- |
| Scottish 2026/27 fixture + live score/status evidence | SportMonks | No currently proven Scottish fallback | Use Development polling; evidence only, never official result truth |
| Premier League 2026/27 fixture calendar | football-data.org | Other providers may be tested later | Existing 380-fixture proof is sufficient for calendar evidence |
| Scottish team id/name/code/founded/venue mapping | SportMonks archived payloads | None needed for first slice | Store from retained custody data, not new calls |
| Public club crest rendering | None | Rights proof required | Do not ship copyrighted provider images merely because a URL exists |
| Match-specific shirt colours | API-Football schema candidate | Current free plan blocks 2026 Scottish season | Do not implement runtime dependency until current-season access succeeds |
| Confirmed Scottish lineups/events | SportMonks first to measure | API-Football after current-season access | Measure representative included payload/endpoint before schema expansion |
| Player/profile/venue enrichment | SportMonks first; SportDB candidate | SportDB actual plan not measured | Start with team/venue identifiers already present; expand only from measured fields |
| Provider standings used for platform scoring | None | Local canonical settled fixtures | Provider standings remain football-information evidence, not game scoring authority |

## First durable implementation slice

The next schema/code slice should be deliberately small:

1. reuse the existing `provider_entity_map` for provider-to-platform identity wherever it already fits;
2. add only the minimum provenance-backed team/venue profile storage that cannot be represented there cleanly;
3. populate the 12 Scottish clubs from already archived SportMonks participant objects;
4. retain source provider, provider entity id and fetched/changed timestamps;
5. store `image_path` only as a non-rendering provider reference pending rights proof;
6. expose generic/team colours only if they come from a measured non-copyrighted data field or owner-controlled value;
7. keep all enrichment reads separate from `season_fixtures` result confirmation and scoring/settlement authorities;
8. make missing enrichment a normal no-data state, never a release/settlement failure.

Do **not** create kit/lineup/event tables in the first slice. Those should follow only after representative current-season payloads are measured for the endpoints that will populate them.

## Audit gaps still open

This audit materially narrows the design but does not pretend to complete every item in the planning definition of done.

Still required:

- measure SportMonks current-season lineup/event/statistic availability for representative Scottish fixtures within the free-plan quota;
- measure API-Football current-season lineup/kit fields only after the account has access to a current season;
- add a controlled SportDB enrichment-only integration and measure its actual account/coverage before considering it supported;
- decide club crest/image rights separately from provider API access;
- measure any endpoint-specific retention/attribution rule before expanding raw-response custody beyond the current fixture endpoints.

## Public sources checked

- SportMonks free plan: https://www.sportmonks.com/football-api/free-plan/
- SportMonks terms: https://www.sportmonks.com/terms-of-service/
- SportMonks FAQ: https://www.sportmonks.com/faq/
- API-Football documentation: https://www.api-football.com/documentation
- API-Football current plan overview: https://www.api-football.com/
- API-SPORTS terms: https://api-sports.io/terms
- football-data.org pricing: https://www.football-data.org/pricing
- football-data.org conditions/IP wording: https://www.football-data.org/about
- SportDB terms: https://sportdb.dev/tos.html

Public terms and plan pages can change. The measured Development responses above remain dated evidence of what the actual configured integrations returned on 5–8 August 2026.