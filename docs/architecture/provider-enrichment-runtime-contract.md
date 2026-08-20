# Provider enrichment runtime contract

**Status:** repository-backed foundation; not a hosted activation record  
**Parent plan:** `docs/architecture/provider-enrichment-plan.md`  
**Scope:** current provider-poll capability, provenance and freshness semantics  
**Does not govern:** result confirmation, scoring, locks, progression, settlement or any other competitive truth

## Current repository reality

The repository is further ahead than the original enrichment planning status implies, but narrower than the eventual product ambition.

The server-side `provider-poll` function currently accepts four provider identifiers:

- `sportmonks`;
- `api-football`;
- `football-data`;
- `the-odds-api`.

The first three have fail-closed fixture decoders that normalize fixture identity, competition/season/round identifiers, teams, kickoff, provider status and score evidence. The Odds API has a separate odds-market normalization path with a database budget check before the provider request. The poller also bounds response size, archives provider responses through the existing custody path and retains useful rate-limit headers.

That wiring is **not** evidence that every endpoint exposed by those providers is available on the hosted subscriptions, licensed for retention, or suitable for production use.

`SportDB.dev` remains an enrichment candidate described by the parent plan. It is not currently a `provider-poll` runtime provider and has no repository decoder/import path. A configured credential outside this repository would not change that status.

## Capability-state rule

`supabase/functions/provider-poll/enrichmentContract.ts` is the machine-readable repository capability contract.

A capability may be marked `implemented` only when the current repository contains the decoder/import path that consumes it. Provider documentation, a configured secret, an available endpoint or an assumed subscription tier is insufficient.

Current implemented capability is deliberately narrow:

| Provider | Repository runtime | Implemented today | Richer context |
| --- | --- | --- | --- |
| SportMonks | configured | fixture evidence | planned, subscription/payload evidence still required |
| API-Football | configured | fixture evidence | planned, subscription/payload evidence still required |
| football-data.org | configured | fixture evidence | selected profile/venue/standings work remains unverified |
| The Odds API | configured | odds-market import | product priority remains deferred |
| SportDB.dev | candidate only | none | candidate until real capability/terms evidence exists |

The richer-context set includes team/player profiles, venue data, standings, match-specific kit colours, confirmed/predicted lineups, events, statistics and injuries/suspensions. None of those are declared implemented by the foundation contract yet.

## Provenance rule

Every enrichment fact that leaves provider-specific decoding must be capable of carrying a source stamp with:

- provider;
- provider entity identifier when one exists;
- fetched timestamp;
- explicit authority marker `enrichment-only`.

The authority marker is intentionally not configurable. Provider data may help what the player sees, but it cannot become canonical scoring/result/lock truth through a caller option.

## Freshness rule

Current/provisional enrichment must be evaluated against an explicit freshness budget. The evaluator is deterministic: callers provide both `fetchedAt` and `now`.

Semantics are:

- age less than or exactly equal to the permitted maximum is `fresh`;
- age above the permitted maximum is `stale`;
- malformed timestamps are `unknown`;
- a provider timestamp in the future relative to the supplied clock is `unknown`;
- an invalid freshness budget is rejected rather than guessed.

The helper deliberately does not choose one global TTL. Injuries, lineups, standings and reference profiles have different useful lifetimes; those budgets belong to the domain-specific implementation once real provider behaviour has been measured.

UI that consumes provisional provider context must preserve these states rather than silently rendering an old fact as current.

## Evidence boundary

This foundation was built without calling any external football provider and without consuming paid provider credits. Its evidence comes from repository implementation and deterministic fixtures in the existing Vitest ingestion suite.

A future capability audit may use Development-only representative requests when explicitly authorised and when they are genuinely required to establish subscription coverage, response schema, freshness, rate limits or licensing constraints. It must not make calls merely to manufacture evidence that static repository code can already prove.

## Next implementation gate

Before adding storage or Match Centre UI for a richer domain:

1. choose one domain rather than widening the settlement fixture decoder;
2. establish subscription/competition coverage from retained or explicitly authorised Development evidence;
3. record retention/licensing constraints;
4. choose the preferred provider and meaningful fallback, if any;
5. define the domain-specific freshness budget and no-data behaviour;
6. preserve `enrichment-only` provenance through storage and UI;
7. prove provider outage/malformed/stale data cannot affect prediction locks, confirmation, settlement or points.

The first high-value candidates remain match-specific kit colours and confirmed lineups, followed by events/basic statistics and pre-match availability context. Their repository capability must remain `plannedUnverified` until the corresponding implementation and evidence exist.
