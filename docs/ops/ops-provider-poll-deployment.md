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
  -H 'apikey: <any-wrong-value>' \
  --data '{}'
```

> **Leave the `apikey` value in angle brackets.** It read
> `deliberately-not-the-key` — a literal, and `betterleaks` flags any literal
> after `apikey:` on shape alone, whatever the value says about itself. That
> finding is only reported by the whole-tree scan, which runs on `main` and not
> on a pull request, so it turned `main` red without any pull request going red
> first. An angle-bracketed placeholder is skipped by the same rule, so this
> needs no scanner allowlist — and an allowlist is the thing to avoid, because
> one drawn wide enough to cover this would also hide a real `apikey:` leak
> somewhere else. The command still works if pasted verbatim: that literal is
> itself a wrong key, which is all the probe requires. Do not substitute a
> realistic-looking value.

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

---

## Correction — 5 August 2026, after contract 115

The record above stands as written at its commit. This section corrects one
fact it got wrong, rather than editing the original.

**The caller key is named `provider_poll`, with an underscore.** The record
above says to create a secret key named `provider-poll`, matching the function
slug. That name cannot exist: Supabase rejects a hyphen in a secret key name.

This was found by measurement rather than review, and only after contract 115
gave the database a way to call out. Two probes through `net.http_post` with a
deliberately wrong `apikey` both returned:

```
500 {"error":"function_not_configured",
     "detail":"Missing named Supabase secret key: provider-poll"}
```

A resolving key would have returned `401 {"error":"unauthorized"}`. Neither
probe contacted a provider or spent a provider credential, because the function
checks its own configuration before it reads the request — which is why this was
safe to run repeatedly against a live deployment.

`CALLER_KEY_NAME` in `supabase/functions/provider-poll/index.ts` is now
`provider_poll`, pinned by `tests/scripts/providerPollContract.test.ts` in both
directions so the slug cannot creep back in. **The function slug is unchanged**:
it is still deployed as `provider-poll` at `/functions/v1/provider-poll`, and
`config.toml` still declares `[functions.provider-poll]`. The two names differ
by one character and mean different things.

The row in the probe table above should therefore read `provider_poll` wherever
it names the key. It is left as it was so the sequence stays legible.

### Redeployed and re-probed — 5 August 2026

`provider-poll` **version 3**, `ACTIVE`, `verify_jwt: false`, bundle
`ezbr_sha256 2b45e9698f63985ff6ee75da6e20c2c98fbb4bb157688254939df638fe24a81c`,
deployed from the committed sources with `CALLER_KEY_NAME = 'provider_poll'`.

A third probe through `net.http_post`, with the same deliberately wrong `apikey`
as the two that preceded it:

```
401 {"error":"unauthorized"}
```

That is the whole discriminator. The same request returned `500
function_not_configured` against version 1 and `401 unauthorized` against
version 3, so the named secret key now resolves inside the function and a wrong
key is refused. **No provider was contacted by any of the three probes** — the
function answers on its own configuration and its caller's key before it reads
the request body, let alone fetches.

What this does NOT establish: no provider credential has been exercised, no
provider response has been archived, and the three provider API keys remain
unproven. Those are reached only by a real poll, which needs the two `vault`
secrets and a `provider_poll_targets` row.

---

## Production addendum — 12 August 2026

The dated Development sequence above remains evidence of what happened on
5 August. The current Production deployment is:

| | |
| --- | --- |
| Project | Production, `vkfnsqdyhvtwyqkisxhk` |
| Function | `provider-poll` |
| Version | 14 |
| Status | `ACTIVE` |
| `verify_jwt` | `false` |
| Bundle | `ezbr_sha256` `58655828e9ace1494705b218061b0336008a9d82ba8135305062e0e11f0127e7` |
| Source | Exact contract-185 repository `main` at promotion time |

`verify_jwt: false` remains intentional. The function authenticates its
dedicated caller key in constant time before request parsing or provider I/O;
enabling platform JWT verification would admit an unrelated signed-in session
to the wrong boundary.

The Production secret path was proved without a paid provider request. With
`ai.api_budget.collection_enabled = false`, PostgreSQL called the function with
the stored dedicated caller key and a valid Odds API-shaped request. The
function authenticated the caller, loaded `ODDS_API`, evaluated the database
budget and returned:

```text
HTTP 429
odds_budget_exceeded
collection_enabled=false
used=0
```

The outbound provider `fetch` is after that branch, so the response proves
`AI_ODDS_POLL` and `ODDS_API` resolve while spending no API credit. Production
collection was then enabled at 500 monthly credits with a 450 soft cap. No live
poll was run as smoke: the non-forced dispatcher returned
`outside_collection_window`, and the final database state still held zero API
usage, zero dispatch rows and zero raw responses. Development paid collection
remains disabled with the same zero counts.

The first paid Odds API request is therefore owned by the next scheduled
Production collection window, not by migration verification. Monitor
`ai.api_usage`, `ai.odds_api_dispatches`, `ai.odds_api_raw_responses` and
`public.admin_ai_odds_api_status()` after that window; do not re-enable
Development to obtain duplicate evidence.
