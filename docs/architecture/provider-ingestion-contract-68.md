# Provider ingestion contract 67

**Status:** repository candidate only  
**Hosted authority:** none  
**Production authority:** none

## Purpose

Contract 67 introduces the minimum safe custody boundary for external football fixture and result providers. It does not make a provider authoritative for application fixtures or results, and decoded data has no write path into competition-owned fixtures, results, locks, scores or standings.

## Providers

The server-only poller supports three explicit provider contracts:

- SportMonks;
- API-Football;
- football-data.org.

Each provider has a strict decoder. Missing required objects, identities, authoritative kickoff instants, distinct participants or valid score values fail closed with a path-specific `ProviderDecodeError`. Duplicate fixture identities in one response are rejected. Provider payloads are never treated as application domain objects.

The contract follows the current provider shapes rather than guessing from display strings:

- SportMonks uses `starting_at_timestamp` for the UTC instant because `starting_at` is timezone-free, and uses the `CURRENT` score rows;
- API-Football uses `fixture.date`, whose official contract includes a timezone offset, plus `status.short` and `goals.home` / `goals.away`;
- football-data.org uses `utcDate` and `score.fullTime.home` / `score.fullTime.away`.

## Service authentication

`provider-poll` is service-to-service only.

- `verify_jwt = false` is deliberate: current Supabase secret keys are API keys, not JWTs.
- The caller sends the named `provider-poll` secret key in the `apikey` header.
- The function reads that named key from `SUPABASE_SECRET_KEYS` and compares it in constant time before parsing the request or making a provider call.
- Disposable local Supabase may fall back to the legacy `SUPABASE_SERVICE_ROLE_KEY` only when `SUPABASE_URL` resolves to an allowlisted local hostname. A hosted legacy fallback is refused.
- The same secret key is sent to the Data API in the `apikey` header when calling the two custody RPCs. It is never sent as an `Authorization: Bearer` value.

The function must not be deployed until the named secret key exists. The key belongs to Supabase API-key configuration, not the repository, Netlify or a browser environment.

## Fixed-origin request boundary

The caller selects a provider and supplies a bounded provider-relative path. The function:

- accepts only HTTPS;
- resolves against one fixed origin per provider;
- rejects absolute URLs, protocol-relative paths, parent traversal, fragments and credentials;
- refuses redirects;
- applies a bounded request timeout;
- never places a provider credential in a URL;
- uses the provider's documented authentication header: raw `Authorization` token for SportMonks, `x-apisports-key` for API-Football and `X-Auth-Token` for football-data.org.

The database independently constrains archived request URLs to the matching provider origin.

## Archive-before-decode rule

The Edge Function must:

1. authenticate the caller before any provider request;
2. fetch only from the selected provider's fixed HTTPS origin;
3. stream the response through a 12 MiB hard archive bound rather than using an unbounded `response.text()` read;
4. archive the complete response text, selected response headers and request evidence through `archive_provider_response`;
5. only after the archive succeeds, enforce the 10 MiB processing limit, parse JSON and run the provider decoder;
6. append a success or failure attempt through `record_provider_response_processing`.

If archival fails, decoding must not run. Provider HTTP errors and successful responses between 10 MiB and 12 MiB are archived and receive failed processing evidence. A transport failure or a body that breaches the 12 MiB hard archive bound has no complete response text to archive and returns a correlation id without decoding.

## Database boundary

The custody tables live in the unexposed `predictor_internal` schema:

- `provider_raw_responses` stores the exact response text, a generated SHA-256 digest, fixed-origin request evidence, selected response headers and correlation identity;
- `provider_response_processing` stores an append-only decoder attempt, either a normalized array with an exact count or a named failure.

Both tables:

- have RLS enabled as defense in depth;
- grant no direct access to `public`, `anon`, `authenticated` or `service_role`;
- reject every update and delete through append-only triggers;
- are reachable only through the two public custody RPCs.

Both RPCs:

- are `security definer` with an empty `search_path`;
- revoke execution from `public`, `anon` and `authenticated`;
- grant execution only to `service_role`.

The RPC grants are the database authorization boundary. They do not depend on user-editable metadata or JWT claim parsing.

## Provider credentials

Provider credentials belong only in development Supabase Edge Function Secrets:

- `SPORTMONKS_API_TOKEN`;
- `API_FOOTBALL_API_KEY`;
- `FOOTBALL_DATA_API_KEY`.

No provider credential belongs in the repository, Netlify, browser variables, logs, request URLs or response payloads.

## Non-authority and rollout boundary

Contract 67 does not:

- apply the migration to a hosted project;
- create the named caller key;
- deploy the Edge Function;
- set or rotate a provider secret;
- call a provider;
- map provider teams, competitions or fixtures to application records;
- update a match, result, score, lock or standings table;
- change Netlify or production.

A first poll may occur only on hosted development after contract 66 is verified there and the contract-67 migration, named secret key, Edge Function and provider secrets receive separate approval. An unauthorised request must be proved rejected before any provider request. The selected endpoint and expected response shape must be reviewed before the first call. Production remains prohibited.

## Evidence required before merge

- clean zero-to-contract-67 rebuild;
- database lint;
- complete pgTAP, including executable custody, grant, origin and append-only tests;
- migration and RPC-signature parity;
- strict decoder unit tests based on current official provider fields;
- source guard proving authentication, bounded reading and archive-before-decode order;
- TypeScript coverage of every Edge Function source;
- Edge Function startup plus an unauthorised 401 request through disposable local Supabase, with no caller key or provider credential supplied;
- full authenticated browser regression proving the new internal tables do not change seeded application behavior;
- no hosted write, provider call, key/secret change, Netlify change or production action.
