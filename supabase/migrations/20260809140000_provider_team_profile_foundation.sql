-- Contract 144: provider team profile enrichment foundation.
--
-- This is deliberately not a second provider identity system. Contract 112's
-- provider_entity_map remains the authority for which provider team belongs to
-- which platform team in which competition season. This table stores only the
-- current provider-supplied profile facts observed for an already-mapped team.
--
-- It is also deliberately not a result path. Nothing here writes season_fixtures,
-- scores, statuses, locks, settlement or progression. Missing enrichment is a
-- normal no-data state and must never become a game-correctness dependency.
--
-- Provider image URLs are retained as evidence/reference only. Contract 144 does
-- not grant a browser read and does not establish rights to render or re-host
-- club imagery.

begin;

create table predictor_internal.provider_team_profiles (
  provider_entity_map_id uuid primary key
    references public.provider_entity_map(id) on delete cascade,

  provider_name text not null,
  short_code text,
  founded_year integer,
  provider_country_id text,
  provider_venue_id text,
  provider_image_ref text,

  source_raw_response_id uuid not null
    references predictor_internal.provider_raw_responses(id) on delete restrict,
  source_fetched_at timestamptz not null,
  first_observed_at timestamptz not null,
  last_observed_at timestamptz not null,
  last_changed_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),

  constraint provider_team_profiles_name_bound
    check (char_length(btrim(provider_name)) between 1 and 200),
  constraint provider_team_profiles_short_code_bound
    check (short_code is null or char_length(btrim(short_code)) between 1 and 32),
  constraint provider_team_profiles_founded_year_bound
    check (founded_year is null or founded_year between 1800 and 2200),
  constraint provider_team_profiles_country_id_bound
    check (provider_country_id is null or char_length(btrim(provider_country_id)) between 1 and 128),
  constraint provider_team_profiles_venue_id_bound
    check (provider_venue_id is null or char_length(btrim(provider_venue_id)) between 1 and 128),
  constraint provider_team_profiles_image_ref_bound
    check (provider_image_ref is null or char_length(btrim(provider_image_ref)) between 1 and 4096),
  constraint provider_team_profiles_observation_order
    check (
      first_observed_at <= last_observed_at
      and last_changed_at between first_observed_at and last_observed_at
      and source_fetched_at = last_observed_at
    )
);

comment on table predictor_internal.provider_team_profiles is
  'Contract 144. Server-only current provider profile facts for an already-mapped team. Provider media fields are reference/provenance only and are not public-display authority.';

comment on column predictor_internal.provider_team_profiles.short_code is
  'Provider descriptive short code. Not identity and intentionally not unique; measured SportMonks evidence reports DUD for both Dundee and Dundee United.';

comment on column predictor_internal.provider_team_profiles.provider_image_ref is
  'Provider image URL/reference retained for provenance only. No public rendering or re-hosting right is implied.';

create index provider_team_profiles_source_idx
  on predictor_internal.provider_team_profiles (source_raw_response_id);

alter table predictor_internal.provider_team_profiles enable row level security;

revoke all on table predictor_internal.provider_team_profiles
  from public, anon, authenticated, service_role;

-- Persist one observation from bytes already held in provider custody. The
-- source provider and fetched instant are derived from the custody row rather
-- than accepted from the caller, so provenance cannot be relabelled.
--
-- Re-observing identical facts advances last_observed_at only. A changed fact
-- also advances last_changed_at. Older custody evidence is refused rather than
-- being allowed to overwrite a newer current fact.
create or replace function predictor_internal.upsert_provider_team_profile(
  p_provider_entity_map_id uuid,
  p_source_raw_response_id uuid,
  p_provider_name text,
  p_short_code text default null,
  p_founded_year integer default null,
  p_provider_country_id text default null,
  p_provider_venue_id text default null,
  p_provider_image_ref text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $profile$
declare
  v_mapping public.provider_entity_map%rowtype;
  v_source predictor_internal.provider_raw_responses%rowtype;
  v_existing predictor_internal.provider_team_profiles%rowtype;
  v_provider_name text := nullif(btrim(coalesce(p_provider_name, '')), '');
  v_short_code text := nullif(btrim(coalesce(p_short_code, '')), '');
  v_provider_country_id text := nullif(btrim(coalesce(p_provider_country_id, '')), '');
  v_provider_venue_id text := nullif(btrim(coalesce(p_provider_venue_id, '')), '');
  v_provider_image_ref text := nullif(btrim(coalesce(p_provider_image_ref, '')), '');
  v_changed boolean;
begin
  if p_provider_entity_map_id is null or p_source_raw_response_id is null then
    raise exception 'Provider mapping and source response are required' using errcode = '22023';
  end if;

  if v_provider_name is null then
    raise exception 'Provider team name is required' using errcode = '22023';
  end if;

  select mapping.*
    into v_mapping
    from public.provider_entity_map mapping
   where mapping.id = p_provider_entity_map_id;

  if not found then
    raise exception 'Provider mapping not found' using errcode = '22023';
  end if;

  if v_mapping.entity_kind <> 'team' or v_mapping.team_id is null then
    raise exception 'Provider mapping is not a team mapping' using errcode = '22023';
  end if;

  select source.*
    into v_source
    from predictor_internal.provider_raw_responses source
   where source.id = p_source_raw_response_id;

  if not found then
    raise exception 'Provider source response not found' using errcode = '22023';
  end if;

  if v_source.provider <> v_mapping.provider then
    raise exception 'Provider source does not match team mapping' using errcode = '22023';
  end if;

  if v_source.response_status < 200 or v_source.response_status >= 300 then
    raise exception 'Provider source response was not successful' using errcode = '22023';
  end if;

  select profile.*
    into v_existing
    from predictor_internal.provider_team_profiles profile
   where profile.provider_entity_map_id = p_provider_entity_map_id
   for update;

  if found and v_source.fetched_at < v_existing.last_observed_at then
    raise exception 'Provider team profile observation is older than the current fact' using errcode = '22023';
  end if;

  if not found then
    insert into predictor_internal.provider_team_profiles (
      provider_entity_map_id,
      provider_name,
      short_code,
      founded_year,
      provider_country_id,
      provider_venue_id,
      provider_image_ref,
      source_raw_response_id,
      source_fetched_at,
      first_observed_at,
      last_observed_at,
      last_changed_at
    ) values (
      p_provider_entity_map_id,
      v_provider_name,
      v_short_code,
      p_founded_year,
      v_provider_country_id,
      v_provider_venue_id,
      v_provider_image_ref,
      p_source_raw_response_id,
      v_source.fetched_at,
      v_source.fetched_at,
      v_source.fetched_at,
      v_source.fetched_at
    );
  else
    v_changed :=
      v_existing.provider_name is distinct from v_provider_name
      or v_existing.short_code is distinct from v_short_code
      or v_existing.founded_year is distinct from p_founded_year
      or v_existing.provider_country_id is distinct from v_provider_country_id
      or v_existing.provider_venue_id is distinct from v_provider_venue_id
      or v_existing.provider_image_ref is distinct from v_provider_image_ref;

    update predictor_internal.provider_team_profiles
       set provider_name = v_provider_name,
           short_code = v_short_code,
           founded_year = p_founded_year,
           provider_country_id = v_provider_country_id,
           provider_venue_id = v_provider_venue_id,
           provider_image_ref = v_provider_image_ref,
           source_raw_response_id = p_source_raw_response_id,
           source_fetched_at = v_source.fetched_at,
           last_observed_at = v_source.fetched_at,
           last_changed_at = case
             when v_changed then v_source.fetched_at
             else v_existing.last_changed_at
           end,
           updated_at = clock_timestamp()
     where provider_entity_map_id = p_provider_entity_map_id;
  end if;

  return p_provider_entity_map_id;
end;
$profile$;

revoke all on function predictor_internal.upsert_provider_team_profile(
  uuid, uuid, text, text, integer, text, text, text
) from public, anon, authenticated, service_role;

-- The write helper is intentionally not granted to service_role in this first
-- slice. A Development backfill is an explicit operator action after the schema
-- is applied and verified; the provider-poll Edge Function does not gain an
-- enrichment write side effect merely because storage now exists.

commit;
