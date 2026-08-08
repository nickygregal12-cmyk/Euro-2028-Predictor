# Provider enrichment and football-data storage plan

**Status:** accepted planning priority — not implemented  
**Priority:** **P1 after the active initial-provider-adoption foundation is safely merged/verified**  
**Scope:** football reference data, team/player enrichment, pre-match context, Match Centre enrichment and historical match detail  
**Does not govern:** official result confirmation, scoring, locks, progression, settlement or game rules

This document records the next high-value use of the football APIs already available to the project. It is deliberately separate from the provider truth/settlement lane. No field described here may become scoring or progression authority merely because an API supplies it.

## Why this is a priority

The current provider path is intentionally narrow: it establishes fixture identity, teams, round, kickoff, status/score evidence and controlled fixture adoption/revision. The providers expose substantially more football information that can improve the product without changing prediction rules.

The priority is therefore to build a **separate enrichment lane** around the existing authoritative competition/fixture model rather than widening the settlement decoder into a general football-data object.

The expected product gains are:

1. richer and more credible team profiles;
2. actual match-specific shirt colours where supplied;
3. confirmed lineups and formations before kickoff;
4. live/post-match events and useful match statistics;
5. injuries, suspensions and form as prediction context;
6. historical lineups/events/statistics retained once a fixture is complete;
7. advanced statistics only after the simpler high-value data is reliable.

## Provider boundary

The repository currently proves a server-side integration for:

- SportMonks;
- API-Football;
- football-data.org.

The owner also has a fourth API, SportDB.dev, configured for the project. **SportDB.dev is not currently part of the repository's provider-poll/decoder authority.** Treat it as an enrichment candidate until its credentials, available endpoints, subscription coverage, response schemas, rate limits and storage/licensing terms are measured in Development.

Do not add a fourth results authority by implication. A new enrichment provider does not gain permission to write official results.

## First implementation step: capability audit, not schema growth

Before creating enrichment tables, run a Development-only, read-only capability audit against the actual subscriptions and representative competitions.

The audit should record, per provider and competition:

- endpoint available / unavailable;
- subscription or add-on requirement;
- representative response shape;
- rate-limit headers and practical request budget;
- update frequency/freshness;
- whether retention, caching and image storage are permitted by the provider terms;
- coverage of Premier League, Scottish Premiership and an international/tournament example where possible;
- whether the field is reliable enough to become a stored enrichment fact or should remain display-only/provisional.

Never print credentials. Archive only where the provider terms permit the existing custody model.

## Data classification

### A. Store as durable reference/master data

These are identity/reference facts that should be available locally without repeated page-load API calls. They can still have `updated_at` provenance, but they are not expected to fluctuate match by match.

- provider competition IDs and season IDs;
- provider team IDs;
- provider player IDs;
- provider venue IDs where supplied;
- canonical team name plus provider aliases/short names/codes;
- country/association identity;
- team founded year where supplied;
- player identity, date of birth and nationality where supplied;
- competition identity/type;
- historical provider fixture IDs;
- canonical provider-to-platform mappings.

Prefer one platform entity with provider-scoped mappings rather than provider IDs on the public entity itself. Provider identifier collisions are already proven possible.

### B. Store locally but refresh periodically

These belong in the database/cache because the UI should not depend on a live provider request, but they are not immutable.

#### Team profile

- crest/logo reference where the licence permits it;
- generic/default team colours;
- current home venue;
- current coach/manager;
- current squad membership.

#### Player profile

- display/known name;
- position;
- current squad number;
- height/preferred foot where useful and supplied;
- current team/club relationship;
- player image reference where licensed.

#### Venue profile

- name;
- city/country;
- capacity;
- coordinates where available.

#### Competition profile

- crest/logo reference;
- season dates;
- competition metadata not already governed by the platform's own competition authority.

These should carry source/provider and refresh timestamps. A provider profile must not silently overwrite an owner-controlled platform label where the two serve different purposes.

### C. Store as fixture-scoped snapshots

These facts change per match but become valuable historical information once the match is complete.

#### Match-specific kit colours — high priority

Where supplied, store colours against **fixture + team**, not against the team globally:

- outfield primary shirt colour;
- number colour;
- number border/trim colour;
- goalkeeper primary colour;
- goalkeeper number colour;
- goalkeeper border/trim colour.

API-Football is the first provider to validate for this requirement because its lineup payload can expose match-specific player/goalkeeper colour objects. The capability audit must prove that the subscribed competitions actually return them before schema work starts.

This enables generated shirt/colour UI without maintaining copyrighted kit artwork and correctly allows the same team to wear different colours in different fixtures.

#### Confirmed lineups

Store once announced:

- starting XI;
- substitutes;
- formation;
- shirt number;
- lineup position/grid where available;
- manager/coach;
- captain where available.

Once a fixture is final, retain the confirmed lineup as historical match data.

#### Match events

Store a normalized event timeline where supported:

- goals;
- scorer;
- assist;
- minute and added time;
- penalty/own-goal markers;
- missed penalties;
- yellow/red cards;
- substitutions;
- VAR decisions/events where exposed.

Event data is presentation/enrichment evidence. The official score/result path remains protected separately.

#### Match statistics

Initial useful set:

- possession;
- shots;
- shots on target;
- corners;
- fouls;
- offsides;
- yellow/red cards;
- goalkeeper saves;
- passes/pass accuracy where reliably supplied.

Later advanced set, only where coverage and licensing are proven:

- team xG;
- player xG;
- player ratings;
- other advanced player/match metrics.

#### Player match statistics

Second-wave feature, not required for the first enrichment release:

- minutes;
- goals/assists;
- shots;
- passes;
- tackles/interceptions;
- saves;
- cards;
- rating;
- xG/advanced metrics where available.

#### Match metadata

Retain the final historical fact where available:

- venue actually used;
- referee and officials;
- attendance;
- weather snapshot if useful.

### D. Cache as current/provisional context

These are useful to users making predictions but must carry freshness/provisional status.

#### Injuries and suspensions

Store/cache:

- player;
- reason/type;
- availability state;
- expected return where supplied;
- source/provider;
- fetched/updated timestamp.

Never present stale availability as confirmed current fact.

#### Current standings/top-player lists

Provider standings, top scorers, assists and cards can be cached for football-information surfaces. Where the platform can derive a table from its own canonical settled fixtures, prefer the local derivation and use provider output as supporting/verification data. Provider tables can still be useful for governing-body adjustments that are not derivable from raw match scores.

#### Predicted lineups

Useful pre-match enrichment where a provider supplies them. They must be clearly labelled **predicted/expected** and replaced by the confirmed lineup when available.

### E. Derive ourselves instead of repeatedly buying/requesting it

Once canonical results exist locally, derive these from our own stored football facts where practical:

- recent form (`W/D/L` sequence);
- head-to-head history;
- basic goals-for/goals-against trends;
- completed-match aggregates;
- competition/player historical summaries that are straightforward sums of stored final facts.

This reduces provider coupling and makes historical displays reproducible.

### F. Do not prioritise for pre-prediction UX

Provider-generated match predictions and betting odds are not an initial enrichment priority.

Reasons:

- the product asks users to make their own predictions;
- prominently showing an API/model pick before entry can encourage copying rather than playing;
- betting/odds data creates additional product, licensing and responsible-presentation questions.

If ever used, prefer post-lock/post-pick context such as "you picked X; the provider model favoured Y" rather than steering an unlocked prediction.

## Proposed storage domains — conceptual only

No migration is authorised by this document. Names below are architectural placeholders to keep responsibilities separate:

- `team_provider_mappings`;
- `player_provider_mappings`;
- `competition_provider_mappings`;
- `venue_provider_mappings`;
- `team_profiles` / team enrichment fields;
- `players` and current squad relationships;
- `venues`;
- `fixture_provider_mappings` where the existing map is not sufficient;
- `fixture_team_kits`;
- `fixture_lineups`;
- `fixture_lineup_players`;
- `fixture_events`;
- `fixture_statistics`;
- `fixture_player_statistics`;
- `player_availability`;
- provider standings/top-player snapshots where a separate snapshot is justified.

Before implementing any of these, reconcile them with the current schema and reuse existing entities rather than creating parallel truth.

## Source strategy to validate

Use the capability audit to choose a **preferred source per enrichment domain**, with fallbacks only where they provide real resilience rather than inconsistent duplicate truth.

Starting hypotheses to test:

| Domain | First provider to validate | Notes |
| --- | --- | --- |
| Match-specific kit colours | API-Football | Strong candidate from lineup colour payloads |
| Confirmed lineups/formations | API-Football / SportMonks | Pick based on subscribed competition coverage/freshness |
| Basic live events/stats | API-Football / SportMonks | Normalize only the fields the product uses |
| Advanced xG/player metrics | SportMonks | Treat as optional enrichment/add-on until coverage is proven |
| Team crest/basic profile/club colours | football-data.org plus other provider fallback | Retention/image terms must be checked |
| Player/profile/transfer enrichment | SportMonks/API-Football/SportDB.dev | SportDB remains untrusted until measured |
| Injuries/suspensions | SportMonks/API-Football | Freshness is part of the UI contract |

Do not merge providers field-by-field merely because all four can answer. Prefer one source, explicit provenance and a measured fallback.

## Refresh model to design

Exact schedules must be chosen from measured rate limits, but the intended classes are:

- identity/master data: during competition onboarding, then infrequent reconciliation;
- team/player profiles and squads: periodic refresh, not page-load fetches;
- injuries/suspensions: regular refresh with a tighter pre-match window;
- predicted lineups: pre-match only;
- confirmed lineups/kit colours: tighter polling shortly before kickoff until confirmed;
- live events/statistics: match-window polling within provider limits;
- final match enrichment: one or more post-final reconciliation reads, then freeze the historical snapshot unless a provider correction is detected.

A first release can use a slower cadence than the provider's maximum freshness. Reliability and request budget matter more than sub-minute UI initially.

## Provenance and correction requirements

Every stored enrichment family should be able to answer:

- which provider supplied it;
- which provider entity/fixture it referred to;
- when it was fetched;
- when it was last changed;
- whether it is provisional or final;
- whether a later provider correction replaced an earlier value.

Historical match enrichment should not be destructively overwritten without retaining enough revision/provenance to explain a visible correction.

## Licensing and image rule

API access does not automatically grant unlimited redistribution or permanent media storage.

Before downloading or re-hosting crests/player images/provider media:

1. confirm the subscribed provider terms permit caching/storage and public display;
2. distinguish storing an external URL/reference from copying the binary asset;
3. record any attribution requirement;
4. avoid building the UI around an asset that the project is not entitled to retain.

The same check applies to long-term raw-response retention for any new provider/endpoint.

## Non-negotiable architecture boundary

The enrichment lane may improve what the user **sees**. It must not silently change what the game **decides**.

Keep this path separate:

`provider evidence -> protected fixture/result review -> canonical result -> scoring/progression/settlement`

from:

`provider enrichment -> normalized/cacheable football detail -> team/competition/Match Centre UI`

A missing crest, stale injury, malformed lineup, unavailable xG response or SportDB outage must never block result confirmation, prediction settlement or points.

## Delivery priority

Treat this as a **P1 product/data workstream** once the active provider foundation is settled. Do not steal a contract number already owned by an open branch.

Recommended delivery slices:

1. **Capability and terms audit** across all four configured APIs using Development only.
2. **Provider mapping/profile foundation** for teams/players/venues without altering scoring truth.
3. **Team visual enrichment** — crest/default colours/venue metadata where licensed.
4. **Fixture kit colours + confirmed lineups** — highest-value Match Centre upgrade.
5. **Match event timeline + basic match statistics**.
6. **Pre-match availability context** — injuries/suspensions and locally derived form/H2H.
7. **Player match statistics and advanced metrics/xG** only after the core enrichment lane is stable.
8. **SportDB.dev promotion from candidate to supported enrichment provider** only after its real response/terms audit passes.

Each slice should have graceful no-data behaviour. No page may become unusable because a provider does not cover one league or one enrichment endpoint.

## Definition of done for the planning priority

This planning item remains open until:

- actual subscription capability has been measured for all four APIs;
- provider terms/retention constraints are recorded;
- a preferred source/fallback matrix is approved;
- enrichment storage is explicitly separated from result/scoring authority;
- the first team-profile + match-kit + confirmed-lineup path works against real Development fixtures;
- missing/late provider data has tested fallbacks;
- completed fixture enrichment can be retained as a reproducible historical snapshot;
- the Match Centre consumes the enrichment without making provider availability part of settlement correctness.
