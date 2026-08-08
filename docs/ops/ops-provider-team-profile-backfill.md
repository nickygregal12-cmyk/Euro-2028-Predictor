# Development provider team profile backfill

**Status:** prepared, not yet executable against hosted Development  
**Applies after:** Contract 134 is merged and Development has been promoted to the same repository contract  
**Environment:** Development only (`iouzoutneyjpugbbtdem`)  
**Production:** explicitly forbidden

This runbook populates the first durable provider-enrichment slice from bytes already retained in provider custody. It does **not** call SportMonks, change a fixture, confirm a result, run settlement/scoring, expose the profile table to a browser, or establish a right to render/re-host provider imagery.

The input authority is the committed evidence file:

`docs/quality/evidence/2026-08-08-sportmonks-scottish-team-enrichment.json`

That evidence identifies the retained SportMonks raw response, its SHA-256, the Scottish Premiership tournament, all 12 provider team ids and the already-measured platform team mappings. Dundee and Dundee United deliberately both carry provider short code `DUD`; short code is descriptive and is never used as identity.

## Why this is a workflow rather than another migration

Contract 134 creates portable schema and a server-only writer. The retained raw-response UUID is Development data, so embedding it in a repository migration would make the migration environment-specific and break a clean Production rebuild. Population is therefore a guarded operator action after schema rollout.

The workflow is `.github/workflows/development-provider-team-profile-backfill.yml`. It is `workflow_dispatch` only and runs only from exact current `main`.

## Hard prerequisites

Before dispatching:

1. Contract 133 must have completed its guarded Development rollout and the private Scottish Championship journey must have been verified/merged.
2. Contract 134 must be merged to `main`.
3. Development must already match the repository migration ledger exactly; the backfill workflow refuses pending or remote-only migrations.
4. The Contract-134 migration `20260808164832_provider_team_profile_foundation.sql` must be present in the hosted Development ledger.
5. `SUPABASE_DEV_DB_URL` must still resolve to the Development project and never to Production.
6. The retained raw response named by the evidence file must still exist with the same provider, successful HTTP status and SHA-256.
7. All 12 existing `provider_entity_map` team rows must match the provider ids and platform team ids recorded in the evidence.

If any prerequisite is false, stop. Do not repair it by weakening the workflow or by running the generated SQL manually against hosted Development.

## Dispatch

Run **Development provider team profile backfill** from `main` with:

- `project_ref`: `iouzoutneyjpugbbtdem`
- `confirmation`: `BACKFILL-SCOTTISH-TEAM-PROFILES`

No Production equivalent exists.

## What the workflow proves before writing

The lane:

- confirms exact `main`, a clean checkout and the exact Development project ref;
- refuses the known Production project ref explicitly;
- checks the Development database URL without printing the credential;
- reads the hosted migration ledger using the pinned Supabase CLI;
- refuses local pending migrations and remote-only migration history;
- requires the hosted migration count to equal the repository contract count and requires Contract 134 specifically;
- generates SQL from the committed evidence using `scripts/ops/build-provider-team-profile-backfill.mjs`.

The generator itself refuses evidence that claims result/scoring authority, public provider-image rendering authority, a new provider request, fewer/more than 12 teams, duplicate provider ids, duplicate platform team ids, or malformed provenance.

## Protected truth boundary

The generated SQL executes as one transaction with a five-second lock timeout. Before the profile write it obtains `SHARE` locks on:

- `public.season_fixtures` — fixture identity, status and result truth;
- `public.season_matchweek_scores` — stored season scoring truth.

It snapshots the Scottish Premiership rows for both relations inside the transaction, performs the 12 profile upserts through `predictor_internal.upsert_provider_team_profile`, then compares both protected snapshots before `COMMIT`.

If either protected relation differs, the transaction raises and rolls the profile backfill back. If a concurrent writer prevents the locks being obtained within five seconds, the backfill refuses rather than racing the writer.

This is in addition to the repository-wide ingestion write-boundary tests that restrict the Contract-134 writer to `predictor_internal.provider_team_profiles`.

## Expected successful result

A successful run leaves exactly 12 SportMonks Scottish Premiership team profiles linked through the existing `provider_entity_map`. The run records bounded evidence showing:

- `profileCount = 12`;
- one retained source-response id across the first population;
- `shortCodeDudCount = 2`, preserving the measured Dundee/Dundee United collision;
- protected fixture/result/scoring state unchanged.

Artifacts are retained for seven days: hosted migration ledger, generated SQL, apply log and bounded postflight JSON. They contain no provider credential or database URL.

## What happens next

Do not wire the provider polling Edge Function directly to the new writer as part of this backfill. After the 12-club Development population is verified, the next enrichment slice should decide the bounded read/UI shape separately. Provider image references stay non-rendering until a rights decision explicitly permits display or re-hosting. Venue canonicalisation and match-specific kit colours remain separate measured-data tasks.
