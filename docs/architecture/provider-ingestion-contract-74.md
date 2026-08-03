# Provider ingestion contract 74

**Status:** repository candidate only  
**Hosted authority:** none  
**Production authority:** none

## Purpose

Contract 74 adds the minimum safe custody boundary for external football fixture and result providers. It follows contract 73's Last Man Standing round-conclusion and season-exhaustion rules. Provider evidence remains separate from application fixture, result and scoring authority.

Decoded provider data has no write path into tournament matches, season fixtures, official results, locks, scores, rank history or standings.

## Supported providers

The server-only poller has strict decoders for SportMonks, API-Football and football-data.org. Missing required objects, identifiers, authoritative kickoff instants, distinct participants or valid score values fail closed. Duplicate provider fixture identifiers in one response are rejected. Normalized records are evidence only.

## Service authentication

`provider-poll` is service-to-service only.

- `verify_jwt = false` is deliberate because current Supabase secret keys are API keys, not JWTs.
- The caller supplies the named `provider-poll` key in the `apikey` header.
- The function selects that key from `SUPABASE_SECRET_KEYS` and compares it before request parsing or provider I/O.
- Disposable local Supabase may use `SUPABASE_SERVICE_ROLE_KEY` only for an allowlisted local hostname.
- Hosted legacy-key fallback is refused.
- Custody RPC calls use the same key through `apikey`, never as a bearer token.

No caller or provider credential may appear in repository files, browser bundles, request URLs, archived headers, logs or response payloads.

## Fixed-origin provider boundary

The caller chooses a provider and supplies a bounded provider-relative path. The function resolves only against one fixed HTTPS origin per provider; rejects absolute and protocol-relative URLs, traversal, credentials, fragments and credential-shaped query parameters; refuses redirects; applies a bounded timeout; and uses the provider's documented authentication header.

The database independently constrains archived request URLs to the selected provider origin and rejects credential-shaped query parameters.

## Archive-before-decode sequence

The function must authenticate before provider I/O, fetch only from the fixed origin, stream through a 12 MiB archive bound, archive complete text and safe response evidence, enforce the 10 MiB processing limit, decode strictly, then append success or failure evidence.

Provider HTTP errors and successful responses between 10 MiB and 12 MiB are archived and receive failed processing evidence. Transport failures or bodies exceeding the archive bound return correlation evidence only because no complete response exists to preserve.

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

Provider custody was repeatedly restacked while contracts 68–73 were claimed by concurrent work. Contract 73 became the LMS round-conclusion and season-exhaustion authority. Contract 74 is rebuilt from exact merged contract-73 commit `182270f7040d99ad9da3d7251d2bde6c21a83546` and preserves all prior migrations and authorities unchanged.

## Explicit non-authority

Contract 74 does not apply a hosted migration, deploy the Edge Function, create or rotate keys, set provider credentials, call a provider, map provider identities to application fixtures, update fixtures/results/locks/scores/standings, change Netlify or touch production.

A first hosted Development poll requires a separate guarded rollout after contract 74 is hosted, the named key and provider secret are configured, and unauthorised access is proved against the hosted function. Production remains prohibited.

## Required merge evidence

- zero-to-74 rebuild;
- database lint and complete pgTAP;
- migration/RPC signature parity;
- strict decoder units;
- source guards for authentication, fixed origins, bounded reads, archive-before-decode and non-authority;
- exhaustive TypeScript project coverage for Edge Function sources;
- disposable-local unauthorised `401` proof;
- full authenticated browser regression;
- exact deploy preview;
- no hosted database write, function deployment, key/secret change, provider request, Netlify mutation or production action.
