# Provider ingestion contract 69

**Status:** repository candidate only  
**Hosted authority:** none  
**Production authority:** none

## Purpose

Contract 69 introduces the minimum safe custody boundary for external football fixture and result providers. It follows contract 68, which created the empty league-season fixture container. The two contracts are deliberately separate: provider evidence is not fixture authority.

Decoded provider data has no write path into competition fixtures, official results, locks, scores, rank history or standings.

## Supported provider contracts

The server-only poller supports three explicit integrations:

- SportMonks;
- API-Football;
- football-data.org.

Each provider has a strict decoder. Missing required objects, identifiers, authoritative kickoff instants, distinct participants or valid score values fail closed with a path-specific `ProviderDecodeError`. Duplicate fixture identifiers in one response are rejected.

Normalized records are evidence only, not application-domain fixtures.

## Service authentication

`provider-poll` is service-to-service only.

- `verify_jwt = false` is deliberate because current Supabase secret keys are API keys, not JWTs.
- The caller supplies the named `provider-poll` secret key in the `apikey` header.
- The function selects that key from `SUPABASE_SECRET_KEYS` and compares it before request parsing or provider I/O.
- Disposable local Supabase may fall back to `SUPABASE_SERVICE_ROLE_KEY` only for an allowlisted local hostname.
- Hosted environments must provide the named key; hosted legacy fallback is refused.
- Data API custody RPC calls use the same key in `apikey`, never as a bearer token.

The named key must not appear in repository files, Netlify, browser variables, logs or response payloads.

## Fixed-origin provider boundary

The caller chooses a provider and supplies a bounded provider-relative path. The function:

- resolves only against one fixed HTTPS origin per provider;
- rejects absolute and protocol-relative URLs, parent traversal, credentials and fragments;
- rejects credential-shaped query parameters;
- refuses redirects;
- applies a bounded request timeout;
- never places a provider credential in the URL;
- uses the provider's documented authentication header.

The database independently constrains archived request URLs to the matching provider origin and rejects credential-shaped query parameters.

## Archive-before-decode sequence

The function must:

1. authenticate before parsing the request or contacting a provider;
2. fetch only from the selected fixed HTTPS origin;
3. stream the response through a 12 MiB hard archive bound;
4. archive complete response text, safe selected headers and request evidence;
5. only after archival succeeds, enforce the 10 MiB processing limit;
6. parse JSON and apply the strict provider decoder;
7. append a success or failure processing attempt.

Provider HTTP errors and successful responses between 10 MiB and 12 MiB are archived and receive failed processing evidence. A transport failure or body exceeding the 12 MiB hard bound cannot be represented as a complete archived response and therefore returns only correlation evidence.

## Database custody

Two relations live in the unexposed `predictor_internal` schema:

- `provider_raw_responses` stores exact response text, generated SHA-256, fixed-origin request evidence, safe response headers and correlation identity;
- `provider_response_processing` stores append-only decoder attempts, either a normalized array with an exact count or a named failure.

Both relations have RLS enabled, grant no direct table access and reject update/delete operations. They are reachable only through two public custody RPCs that are `security definer`, use an empty `search_path`, revoke execution from browser roles and grant execution only to `service_role`.

## Provider credentials

Provider credentials belong only in Development Supabase Edge Function secrets:

- `SPORTMONKS_API_TOKEN`;
- `API_FOOTBALL_API_KEY`;
- `FOOTBALL_DATA_API_KEY`.

No provider credential belongs in a request URL, archived header evidence, repository file, Netlify variable, browser bundle, log or response body.

## Renumbering provenance

The custody implementation was first prepared on a stale contract-68 branch while concurrent contract-68 fixture work was in flight. Contract 68 subsequently became the canonical season-fixture migration. This branch rebuilds custody on that exact merged head as contract 69. Existing internal decoder evidence label `contract-68-v1` identifies the decoder format from the original reviewed draft; it is not the database migration contract and does not imply that custody landed at contract 68.

## Non-authority and rollout boundary

Contract 69 does not:

- apply a hosted migration;
- deploy the Edge Function;
- create or rotate a caller key;
- set provider credentials;
- call a provider;
- map provider identities to application competitions, teams or fixtures;
- update fixtures, results, locks, scores or standings;
- change Netlify or production.

A first hosted Development poll requires separate approval after contracts 68 and 69 are rolled out, the named key and provider secret are configured, and unauthorised access is proved against the hosted function. Production remains prohibited.

## Required merge evidence

- zero-to-69 rebuild;
- database lint and complete pgTAP;
- migration/RPC signature parity;
- strict decoder unit tests;
- source guards for authentication, fixed origins, bounded reads, archive-before-decode and non-authority;
- exhaustive TypeScript project coverage for Edge Function sources;
- disposable-local Edge Function startup and unauthorised 401 proof;
- full authenticated browser regression;
- exact deploy preview;
- no hosted database write, function deployment, key/secret change, provider request, Netlify mutation or production action.
