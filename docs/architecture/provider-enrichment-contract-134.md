# Contract 134 — provider team profile foundation

**Status:** pre-migration design, measured against retained Development evidence  
**Contract owner:** `feature/provider-enrichment-foundation-contract-134`  
**Depends on:** repository Contract 133; hosted Development must reach 133 before any 134 rollout  
**Does not authorise:** a hosted migration, provider request, public crest rendering, result write, scoring change or Production polling

## Purpose

Contract 134 is the first durable storage slice from `provider-enrichment-plan.md`. It stores provider-supplied **team reference/profile facts** against the provider-to-platform team identity that already exists in `public.provider_entity_map`.

It deliberately does not create venue, player, kit, lineup, event or statistic truth. The 8 August capability audit proved enough SportMonks Scottish team metadata to design this one layer without guessing the deeper endpoint shapes.

The measured fixture response retained at `2026-08-08T16:35:03.166961Z` contains all 12 Scottish Premiership clubs and gives, per participant:

- provider team id;
- provider team name;
- provider short code;
- founded year;
- provider country id;
- provider venue id;
- provider `image_path` reference.

All 12 provider team ids already resolve to the intended platform `teams` row through `provider_entity_map`. The immutable extracted evidence is retained in `docs/quality/evidence/2026-08-08-sportmonks-scottish-team-enrichment.json`.

## Constraints discovered before DDL

### Provider short code is descriptive, not identity

SportMonks reports `DUD` for both Dundee and Dundee United in the same competition. Therefore:

- no uniqueness constraint may be placed on provider short code;
- no lookup may resolve a team by short code;
- provider id plus the existing season-scoped mapping remains identity authority.

### Venue id is still only a provider reference

The fixture participant object supplies a provider venue id, but the project has not yet measured the venue endpoint or created a canonical venue mapping. Contract 134 must retain the provider venue id as a nullable reference only. It must not invent a `venues` row or claim that the id is a platform venue identity.

### Image path is reference-only

The provider audit did not establish public-display or re-hosting rights for club logos. Contract 134 may retain the URL/reference as provenance for a later rights decision, but:

- no browser read in this contract returns it;
- no image is downloaded into project storage;
- no UI starts rendering it;
- a later display decision must be independently licensed/approved.

### Enrichment cannot become result truth

Nothing in this storage family may write or gate:

- `season_fixtures.status`;
- `season_fixtures.home_score` / `away_score`;
- result confirmation;
- scoring;
- settlement;
- progression;
- lock state.

A missing or malformed profile is a normal no-data state.

## Proposed first table

The migration should add one server-only current-fact table in `predictor_internal`, provisionally named:

`predictor_internal.provider_team_profiles`

The exact migration must be generated with the repository's Supabase CLI workflow rather than hand-inventing a timestamp.

### Identity

Use the existing mapping row as the profile key:

- `provider_entity_map_id uuid primary key` -> `public.provider_entity_map(id)` with `on delete cascade`.

This prevents Contract 134 from creating a second provider-to-platform identity system. A profile cannot exist until the provider team id has already been mapped to a platform team within a tournament.

### Current provider facts

Store only fields already measured in the retained response:

- `provider_name text not null`;
- `short_code text null`;
- `founded_year integer null`;
- `provider_country_id text null`;
- `provider_venue_id text null`;
- `provider_image_ref text null`.

Do not add generic club colours yet. No measured field in the retained Scottish payload supplies them.

### Provenance

Every current row must name the retained source that produced it:

- `source_raw_response_id uuid not null` -> `predictor_internal.provider_raw_responses(id)` with `on delete restrict`;
- `source_fetched_at timestamptz not null`;
- `first_observed_at timestamptz not null`;
- `last_observed_at timestamptz not null`;
- `last_changed_at timestamptz not null`.

The write path must prove that the source response's `provider` matches the provider on the referenced `provider_entity_map` row. Do not trust a caller-supplied provider label.

A later correction may update the current row, but the retained raw-response custody remains the historical evidence of previous provider values. Match-specific enrichment will require its own stronger revision model when that work begins.

## Access model

This is provider operational data, not a browser table.

The migration should:

1. create the table in `predictor_internal`;
2. enable RLS as defence in depth where supported by the repository's existing internal-table pattern;
3. revoke table access from `public`, `anon`, `authenticated` and `service_role` unless an existing internal custody pattern requires a narrower trusted role;
4. expose no browser RPC in Contract 134;
5. add any write helper in `predictor_internal`, with all default `PUBLIC` execute rights revoked.

This also aligns with Supabase's current Data API direction: new tables must not rely on implicit API grants. Contract 134 does not need a Data API grant at all.

## Write behaviour

The first write helper should accept a mapped team plus a retained raw response and perform an idempotent current-fact upsert.

Required behaviour:

- refuse a mapping whose `entity_kind` is not `team`;
- refuse a raw response from another provider;
- refuse blank provider name;
- allow duplicate short codes across different teams;
- allow nullable founded/country/venue/image fields;
- on identical facts, advance `last_observed_at` without advancing `last_changed_at`;
- on changed facts, update the current value and `last_changed_at`;
- never write canonical fixture/result tables;
- never fetch from a provider itself.

The helper should be callable only from a trusted server/operator path. Provider fetching and profile persistence remain separate operations.

## Population strategy

**Do not seed the 12 Scottish profile rows inside the schema migration.**

The measured source response is Development custody data. Production currently has no equivalent Scottish poll target/evidence, so embedding a generated Development raw-response UUID or requiring a Development-only SHA in a repository migration would make the same migration non-portable.

Instead:

1. generate and verify the Contract-134 schema migration;
2. apply 133 to Development through the existing guarded fast lane;
3. apply 134 to Development through the same migration discipline;
4. run a Development-only controlled backfill from the retained SportMonks response;
5. verify 12/12 mappings and 12/12 profile rows;
6. prove no canonical fixture/result/scoring rows changed;
7. only then decide the bounded read shape needed by team/Match Centre UI.

Production population is a later operational action after its own provider/access decision. It is not a side effect of deploying the schema.

## Deterministic extraction helper

`scripts/ops/extract-sportmonks-team-enrichment.ts` now provides an offline parser for retained SportMonks fixture bytes. It:

- makes no HTTP request;
- opens no database connection;
- deduplicates repeated participants by provider team id;
- fails closed if one provider id carries conflicting facts within the same response;
- deliberately permits duplicate short codes;
- preserves image URL only as `imageRef`.

The helper is intended to make Development backfill evidence reproducible rather than to become runtime ingestion authority.

## Contract 134 tests to add with the generated migration

The pgTAP suite should prove at least:

- table exists in the intended internal schema;
- no browser/service-role table grant exists;
- mapping FK is enforced;
- source raw-response FK is enforced;
- non-team mapping is refused;
- source-provider mismatch is refused;
- duplicate provider short codes across teams are accepted;
- blank names are refused;
- identical re-observation preserves `last_changed_at`;
- changed provider fact advances `last_changed_at`;
- no function added by Contract 134 can write `season_fixtures` result/status columns;
- no browser-executable function is introduced unintentionally.

The existing ingestion-write-boundary and Stage C relation/function inventories must be reconciled if the new internal relation/helper falls within their asserted scope.

## Rollout gate

Contract 134 is not eligible for hosted application while Development remains at Contract 132.

Required sequence:

`Development 132 -> guarded Contract 133 rollout -> signed-in #593 Championship verification -> #593 merge -> generate/review Contract 134 migration -> Contract 134 tests -> Development 134 -> controlled 12-club profile backfill`

This preserves the existing dependency chain and avoids using enrichment work as a reason to leapfrog the blocked Championship backend rollout.
