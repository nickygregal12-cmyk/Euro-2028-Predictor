# Provider ingestion contract 73

**Status:** repository candidate only  
**Hosted authority:** none  
**Production authority:** none

## Purpose

Contract 73 adds the minimum safe custody boundary for external football fixture and result providers. It follows contract 72's Last Man Standing setup and entrant-state persistence. Provider evidence remains separate from application fixture, result and scoring authority.

Decoded provider data has no write path into tournament matches, season fixtures, official results, locks, scores, rank history or standings.

## Supported providers

The server-only poller has strict decoders for:

- SportMonks;
- API-Football;
- football-data.org.

Missing required objects, identifiers, authoritative kickoff instants, distinct participants or valid score values fail closed with a path-specific `ProviderDecodeError`. Duplicate provider fixture identifiers in one response are rejected. Normalized records are evidence only.

## Service authentication

`provider-poll` is service-to-service only.

- `verify_jwt = false` is deliberate because current Supabase secret keys are API keys, not JWTs.
- The caller supplies the named `provider-poll` key in the `apikey` header.
- The function selects that key from `SUPABASE_SECRET_KEYS` and compares it before request parsing or provider I/O.
- Disposable local Supabase may use `SUPABASE_SERVICE_ROLE_KEY` only for an allowlisted local hostname.
- Hosted legacy-key fallback is refused.
- Custody RPC calls use the same key through `apikey`, never as a bearer token.

No caller or provider credential may appear in repository files, Netlify variables, browser bundles, request URLs, archived headers, logs or response payloads.

## Fixed-origin provider boundary

The caller chooses a provider and supplies a bounded provider-relative path. The function:

- resolves only against one fixed HTTPS origin per provider;
- rejects absolute and protocol-relative URLs, parent traversal, credentials and fragments;
- rejects credential-shaped query parameters rather than silently rewriting them;
- refuses redirects;
- applies a bounded request timeout;
- uses the provider's documented authentication header.

The database independently constrains archived request URLs to the selected provider origin and rejects credential-shaped query parameters.

## Archive-before-decode sequence

The function must:

1. authenticate before parsing the request or contacting a provider;
2. fetch only from the selected fixed HTTPS origin;
3. stream the response through a 12 MiB hard archive bound;
4. archive complete response text, safe selected headers and request evidence;
5. only after archival succeeds, enforce the 10 MiB processing limit;
6. parse JSON and apply the strict provider decoder;
7. append success or failure processing evidence.

Provider HTTP errors and successful responses between 10 MiB and 12 MiB are archived and receive failed processing evidence. A transport failure or body exceeding the hard archive bound cannot be represented as a complete response and returns correlation evidence only.

## Database custody

Two append-only relations live in the unexposed `predictor_internal` schema:

- `provider_raw_responses` stores exact response text, generated SHA-256, fixed-origin request evidence, safe response headers and correlation identity;
- `provider_response_processing` stores decoder attempts, either a normalized array with an exact count or a named failure.

Both relations have RLS enabled, no direct table grants and update/delete refusal triggers. Two public `security definer` RPCs use an empty `search_path`, revoke browser execution and grant execution only to `service_role`.

## Provider secrets

Provider credentials belong only in Development Supabase Edge Function secrets:

- `SPORTMONKS_API_TOKEN`;
- `API_FOOTBALL_API_KEY`;
- `FOOTBALL_DATA_API_KEY`.

## Concurrent lineage

Provider custody was prepared while contracts 68–72 were claimed by concurrent work. Contract 72 became the Last Man Standing setup and entrant-state store. Contract 73 is rebuilt from exact merged contract-72 commit `23c30d7b72b6891746bfc9c7991dd14b0a53c746` and preserves that migration and all earlier authorities unchanged.

## Explicit non-authority

Contract 73 does not:

- apply a hosted migration;
- deploy the Edge Function;
- create or rotate a caller key;
- set provider credentials;
- call a provider;
- map provider identities to application competitions, clubs or fixtures;
- update fixtures, results, locks, scores or standings;
- change Netlify or production.

A first hosted Development poll requires a separate guarded rollout after contract 73 is hosted, the named key and provider secret are configured, and unauthorised access is proved against the hosted function. Production remains prohibited.

## Required merge evidence

- zero-to-73 rebuild;
- database lint and complete pgTAP;
- migration/RPC signature parity;
- strict decoder unit tests;
- source guards for authentication, fixed origins, bounded reads, archive-before-decode and non-authority;
- exhaustive TypeScript project coverage for Edge Function sources;
- disposable-local Edge Function startup and unauthorised `401` proof;
- full authenticated browser regression;
- exact deploy preview;
- no hosted database write, function deployment, key/secret change, provider request, Netlify mutation or production action.
