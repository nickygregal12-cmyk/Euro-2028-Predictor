# Contract 134 — provider team profile foundation

**Status:** implemented repository candidate; hosted rollout pending  
**Contract owner:** `feature/provider-enrichment-foundation-contract-134` / PR #595  
**Depends on:** Contract 133 already in `main`; hosted Development must reach 133 and complete the #593 signed-in verification before Contract 134 may be merged/hosted  
**Does not authorise:** a hosted migration, provider request, public crest rendering, result write, scoring change or Production polling

## Purpose

Contract 134 is the first durable storage slice from `provider-enrichment-plan.md`. It stores provider-supplied **team reference/profile facts** against the provider-to-platform identity already owned by `public.provider_entity_map`.

The Supabase-CLI-generated migration is:

`supabase/migrations/20260808164832_provider_team_profile_foundation.sql`

It deliberately does not create venue, player, kit, lineup, event or statistic truth. The 8 August provider capability audit proved enough SportMonks Scottish team metadata for this layer without guessing deeper endpoint shapes.

The retained Development fixture response contains all 12 Scottish Premiership clubs and supplies, per participant:

- provider team id;
- provider team name;
- provider short code;
- founded year;
- provider country id;
- provider venue id;
- provider `image_path` reference.

All 12 provider team ids already resolve to the intended platform `teams` row through `provider_entity_map`. The committed extracted evidence is:

`docs/quality/evidence/2026-08-08-sportmonks-scottish-team-enrichment.json`

No new provider request was required to build this contract.

## Measured constraints

### Provider short code is descriptive, not identity

SportMonks reports `DUD` for both Dundee and Dundee United in the same competition. Therefore:

- `short_code` is intentionally non-unique;
- no lookup may resolve a team by short code;
- provider id plus the existing season-scoped mapping remains identity authority.

### Venue id is still only a provider reference

The retained participant object supplies a provider venue id, but the project has not yet measured the venue endpoint or created canonical venue mappings. Contract 134 stores the provider venue id as a nullable reference only. It does not invent a `venues` row or claim platform venue identity.

### Image path is reference-only

The provider audit did not establish public-display or re-hosting rights for club logos. Contract 134 retains the URL/reference as provenance only:

- no browser read in this contract returns it;
- no image is downloaded into project storage;
- no UI renders it;
- a later display decision requires a separate rights/licensing decision.

### Enrichment cannot become result truth

Nothing in this storage family may write or gate:

- `season_fixtures.status`;
- `season_fixtures.home_score` / `away_score`;
- result confirmation;
- scoring;
- settlement;
- progression;
- lock state.

A missing or malformed profile is a normal no-data state and must never block gameplay or settlement.

## Implemented storage

Contract 134 adds the server-only table:

`predictor_internal.provider_team_profiles`

### Identity

The profile key is the existing mapping row:

- `provider_entity_map_id uuid primary key` -> `public.provider_entity_map(id)` with `on delete cascade`.

This keeps `provider_entity_map` as the only provider-to-platform identity authority. A profile cannot exist until the provider team has already been mapped within the competition season.

### Current provider facts

The table stores only fields measured in the retained response:

- `provider_name text not null`;
- `short_code text null`;
- `founded_year integer null`;
- `provider_country_id text null`;
- `provider_venue_id text null`;
- `provider_image_ref text null`.

Generic club colours were deliberately not added: the retained Scottish participant payload supplies no measured generic-colour field.

### Provenance

Every current row names the retained custody response that produced it:

- `source_raw_response_id` -> `predictor_internal.provider_raw_responses(id)` with `on delete restrict`;
- `source_fetched_at`;
- `first_observed_at`;
- `last_observed_at`;
- `last_changed_at`.

The writer derives provider/fetched-at provenance from the custody row itself. It does not accept a caller-supplied provider label.

## Access model

This is operational enrichment data, not a browser table.

The implemented migration:

1. creates the table in `predictor_internal`;
2. enables RLS as defence in depth;
3. revokes table access from `public`, `anon`, `authenticated` and `service_role`;
4. exposes no browser RPC;
5. creates `predictor_internal.upsert_provider_team_profile(...)` and revokes its default/browser/service-role execute rights.

The provider-poll Edge Function therefore gains no enrichment-write side effect merely because storage exists.

## Implemented write behaviour

`predictor_internal.upsert_provider_team_profile(...)` accepts an existing team mapping plus a retained raw response and performs the current-fact upsert.

It:

- refuses null/missing mapping or source ids;
- refuses blank provider names;
- refuses a missing mapping or a mapping whose `entity_kind` is not `team`;
- refuses a missing source response;
- refuses a source response from another provider;
- refuses a non-2xx source response;
- refuses older retained evidence from overwriting a newer current fact;
- permits duplicate short codes across different teams;
- permits nullable founded/country/venue/image fields;
- advances `last_observed_at` on a later identical observation without advancing `last_changed_at`;
- advances `last_changed_at` when a provider fact actually changes;
- writes only `predictor_internal.provider_team_profiles`;
- never fetches from a provider itself.

The global ingestion write-boundary inventory explicitly names this writer and limits its write surface to the internal profile table.

## Deterministic evidence/extraction

`scripts/ops/extract-sportmonks-team-enrichment.ts` provides an offline parser for retained SportMonks fixture bytes. It:

- makes no HTTP request;
- opens no database connection;
- deduplicates repeated participants by provider team id;
- fails closed if one provider id carries conflicting facts within the response;
- deliberately permits duplicate short codes;
- preserves image URL only as `imageRef`.

This makes the evidence reproducible; it is not runtime ingestion authority.

## Verification implemented

`supabase/tests/186_provider_team_profile_foundation.sql` plus the repository-wide security/write-boundary suites prove the Contract-134 boundary, including:

- internal table existence and access restrictions;
- mapping/source provenance enforcement;
- non-team mapping refusal;
- source-provider mismatch refusal;
- duplicate provider short codes accepted;
- blank names refused;
- identical versus changed observation timestamps;
- stale evidence refusal;
- the new writer's explicit internal-only write surface;
- no unintended browser/service-role access.

The deterministic development/browser seed was also re-verified against Contract 134 after a disposable rebuild and authenticated Browser E2E journey.

## Population strategy

**The 12 Scottish profile rows are not seeded by the schema migration.**

The retained raw-response UUID belongs to Development custody. Embedding that environment-specific UUID in a portable repository migration would make Production and clean rebuilds depend on Development data.

The controlled population sequence is therefore:

1. promote Development 132 -> 133 through the existing guarded Development fast lane;
2. verify the real signed-in Scottish private Championship journey and merge #593;
3. revalidate/merge Contract 134;
4. promote Development to Contract 134 through the guarded migration lane;
5. run the separate Development-only 12-club profile backfill from the committed retained evidence;
6. verify 12/12 mappings and 12/12 profiles and prove protected fixture/result/scoring state did not move;
7. only then design a bounded read/UI surface.

PR #596 prepares that separate operator backfill lane. It is intentionally stacked behind #595 and is not executable against hosted Development while the database remains below Contract 134.

Production population remains a later, separately authorised operational action. It is not a side effect of deploying the schema.

## Rollout gate

Contract 134 is not eligible for hosted application while Development remains at Contract 132.

Current required sequence:

`Development 132 -> guarded Contract 133 rollout -> signed-in #593 verification -> #593 merge -> #595 revalidation/merge -> guarded Development 134 rollout -> guarded 12-club profile backfill -> bounded enrichment read/UI decision`

This preserves the dependency chain and prevents enrichment work from leapfrogging the blocked Championship rollout or becoming official result/scoring authority.
