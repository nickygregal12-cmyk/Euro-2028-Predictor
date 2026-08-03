# Provider ingestion contract 68

**Status:** repository candidate only  
**Hosted authority:** none  
**Production authority:** none

## Purpose

Contract 68 introduces the minimum safe custody boundary for external football fixture and result providers after contract 67 aligns league-season games to the shared matchweek lock scope.

It does not make any provider authoritative for application fixtures or results. Decoded data has no write path into competition fixtures, official results, locks, scores, rank history or standings.

## Supported provider contracts

The server-only poller supports three explicit integrations:

- SportMonks;
- API-Football;
- football-data.org.

Each provider has a strict decoder. Missing required objects, identifiers, authoritative kickoff instants, distinct participants or valid score values fail closed with a path-specific `ProviderDecodeError`. Duplicate fixture identifiers in one response are rejected.

The decoder reads current documented fields rather than guessing from display values:

- SportMonks: `starting_at_timestamp` for the UTC instant and `CURRENT` score rows;
- API-Football: timezone-qualified `fixture.date`, `status.short`, `goals.home` and `goals.away`;
- football-data.org: `utcDate`, `status`, and `score.fullTime.home` / `away`.

Normalized records are evidence only, not application-domain fixtures.

## Service authentication

`provider-poll` is service-to-service only.

- `verify_jwt = false` is deliberate because current Supabase secret keys are API keys, not JWTs.
- The caller supplies the named `provider-poll` secret key in the `apikey` header.
- The function selects that key from `SUPABASE_SECRET_KEYS` and compares it in constant time before request parsing or provider I/O.
- Disposable local Supabase may fall back to `SUPABASE_SERVICE_ROLE_KEY` only when `SUPABASE_URL` resolves to an allowlisted local hostname.
- Hosted environments must provide the named key; a hosted legacy fallback is refused.
- Data API custody RPC calls use the same key in `apikey`, never as an `Authorization: Bearer` value.

The named key belongs to Supabase API-key configuration. It must not appear in the repository, Netlify, browser variables, logs or response payloads.

## Fixed-origin provider boundary

The caller chooses a provider and supplies a bounded provider-relative path. The function:

- resolves only against one fixed HTTPS origin per provider;
- rejects absolute and protocol-relative URLs, parent traversal, credentials and fragments;
- rejects credential-shaped query parameters;
- refuses redirects;
- applies a bounded request timeout;
- never places a provider credential in the URL;
- uses the provider's documented authentication header.

The database independently constrains every archived request URL to the matching provider origin and rejects credential-shaped query parameters.

## Bounded archive-before-decode sequence

The function must:

1. authenticate before parsing the request or contacting a provider;
2. fetch only from the selected fixed HTTPS origin;
3. stream the response through a 12 MiB hard archive bound;
4. archive the complete response text, safe selected headers and request evidence;
5. only after archival succeeds, enforce the 10 MiB processing limit;
6. parse JSON and apply the provider decoder;
7. append a success or failure processing attempt.

Provider HTTP errors and successful responses between 10 MiB and 12 MiB are archived and receive failed processing evidence. A transport failure or body that breaches the 12 MiB hard bound has no complete response text to archive and returns a correlation identifier without decoding.

## Database custody

The two custody relations live in the unexposed `predictor_internal` schema:

- `provider_raw_responses` stores exact response text, generated SHA-256, fixed-origin request evidence, safe response headers and correlation identity;
- `provider_response_processing` stores one append-only decoder attempt, either a normalized array with an exact count or a named failure.

Both relations:

- have RLS enabled as defense in depth;
- grant no direct access to `public`, `anon`, `authenticated` or `service_role`;
- reject every update and delete;
- are reachable only through the two public custody RPCs.

The RPCs:

- are `security definer` with an empty `search_path`;
- revoke execution from `public`, `anon` and `authenticated`;
- grant execution only to `service_role`.

RPC grants are the database authorization boundary. They do not depend on JWT claim parsing or user-editable metadata.

## Provider credentials

Provider credentials belong only in development Supabase Edge Function Secrets:

- `SPORTMONKS_API_TOKEN`;
- `API_FOOTBALL_API_KEY`;
- `FOOTBALL_DATA_API_KEY`.

No provider credential belongs in a request URL, archived header evidence, repository file, Netlify variable, browser bundle, log or response body.

## Non-authority and rollout boundary

Contract 68 does not:

- apply a hosted migration;
- create the named Supabase caller key;
- deploy the Edge Function;
- set or rotate provider credentials;
- call a provider;
- map provider identities to application competitions, teams or fixtures;
- update a match, result, lock, score or standings relation;
- change Netlify or production.

A first hosted-development poll requires separate approval after contract 67 and 68 rollout, named-key creation, Edge Function deployment, provider-secret configuration and proof that an unauthorized request is rejected. Production remains prohibited.

## Required merge evidence

- zero-to-68 rebuild;
- database lint;
- complete pgTAP, including custody, grant, origin, no-credential and append-only tests;
- migration/RPC signature parity;
- strict decoder unit tests;
- source guards proving authentication, bounded reading and archive-before-decode order;
- exhaustive TypeScript coverage for Edge Function sources;
- disposable-local Edge Function startup and unauthorized 401 proof with no provider secret supplied;
- full authenticated browser regression;
- exact deploy preview;
- no hosted write, function deployment, key/secret change, provider request, Netlify mutation or production action.
