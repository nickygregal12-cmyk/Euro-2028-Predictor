# `provider-poll` Edge Function — development deployment record

**Dated evidence. 5 August 2026.** This records one deployment and what it does
and does not establish. It is a snapshot and must keep saying what was true when
it was written.

## What was deployed

| | |
| --- | --- |
| Project | development, `iouzoutneyjpugbbtdem` |
| Function | `provider-poll` |
| Version | 1 |
| Status | `ACTIVE` |
| `verify_jwt` | `false` |
| Bundle | `ezbr_sha256` `6c659215b856032f49908f4a0cd7374f1567eecb98b3148642c1feda1275483e` |
| Files | `index.ts` (13969 bytes), `providerDecoders.ts` (11978 bytes) |

`verify_jwt: false` matches `supabase/config.toml`, which has declared
`[functions.provider-poll] verify_jwt = false` since the function was written.
It is not a relaxation made to get a deploy through: the function does its own
authentication against a named caller key, and a platform JWT check would let
any signed-in browser session reach it.

Deployment was authorised by the owner in session on 5 August 2026.

## What this does and does not establish

**Established.** The function exists on development, its bundle parsed at deploy
time, and the deployed source reads back identical to
`supabase/functions/provider-poll/`.

**Not established, and deliberately so:**

- **No provider has been contacted.** No credential has been spent and no
  provider request has been made from this environment.
- **The named caller key has not been observed to resolve.** See below.
- **No raw response has been archived** — `provider_raw_responses` and
  `provider_response_processing` are untouched by this deployment.
- Provider terms, coverage, timezone and exceptional-state mappings remain the
  first open Stage D item and are unaffected by deploying anything.

## The configuration probe, and why it has not been run here

The function resolves its caller key **before** it does any provider I/O:

```
method check → projectSecretKey() → authorized() → parseRequest() → provider fetch
```

So a single request with a deliberately wrong `apikey` header distinguishes the
two configurations without contacting a provider, spending a credential or
writing a row:

| Response | Meaning |
| --- | --- |
| `401 {"error":"unauthorized"}` | `SUPABASE_SECRET_KEYS` contains a key named `provider-poll`; the function is configured |
| `500 {"error":"function_not_configured","detail":"Missing named Supabase secret key: provider-poll"}` | it does not |

```bash
curl -sS -w '\nHTTP %{http_code}\n' \
  -X POST https://iouzoutneyjpugbbtdem.supabase.co/functions/v1/provider-poll \
  -H 'content-type: application/json' \
  -H 'apikey: deliberately-not-the-key' \
  --data '{}'
```

It was **not** run from the agent environment: that environment's network policy
denies `CONNECT` to `iouzoutneyjpugbbtdem.supabase.co` (gateway 403), and
`pg_net` is not installed on development, so the database cannot make the call
either. Installing an extension to run a probe would be a schema change outside
a migration, which is not a thing a probe justifies.

## `SUPABASE_SECRET_KEYS` — an inference, flagged as one

`projectSecretKey()` reads the environment variable `SUPABASE_SECRET_KEYS`,
parses it as a JSON object, and takes the entry named `provider-poll`. The
Supabase dashboard **refuses** to create an Edge Function secret whose name
starts with `SUPABASE_`, so this variable is not one an operator sets. The
reading that fits the observed behaviour is that the platform injects it,
populated from the project's own API keys, and that the operator step is
therefore to create a **secret key named `provider-poll`** under API Keys.

**That inference is not documented anywhere in this repository and has not been
confirmed against Supabase's documentation or against a live 401.** The probe
above is what would confirm it. Until then, treat the configuration as unproven.
