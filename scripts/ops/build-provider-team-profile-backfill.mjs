#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const EXPECTED_PROVIDER = 'sportmonks'
const EXPECTED_TEAM_COUNT = 12

function fail(message) {
  throw new Error(message)
}

function requiredString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) fail(`${label} is required`)
  return value.trim()
}

function optionalString(value, label) {
  if (value === null || value === undefined) return null
  return requiredString(value, label)
}

function requiredUuid(value, label) {
  const text = requiredString(value, label)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    fail(`${label} must be a UUID`)
  }
  return text
}

function sqlText(value) {
  if (value === null || value === undefined) return 'null'
  return `'${String(value).replaceAll("'", "''")}'`
}

function sqlUuid(value) {
  return `${sqlText(value)}::uuid`
}

function sqlInteger(value) {
  if (value === null || value === undefined) return 'null'
  if (!Number.isInteger(value)) fail(`Expected integer value, received ${value}`)
  return String(value)
}

export function validateProviderTeamProfileEvidence(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Evidence must be an object')
  if (input.evidenceVersion !== 1) fail('Only provider team enrichment evidenceVersion 1 is supported')

  const provider = requiredString(input.provider, 'provider')
  if (provider !== EXPECTED_PROVIDER) fail(`Only ${EXPECTED_PROVIDER} evidence is approved for this backfill`)

  const tournamentId = requiredUuid(input.competition?.platformTournamentId, 'competition.platformTournamentId')
  const rawResponseId = requiredUuid(input.source?.rawResponseId, 'source.rawResponseId')
  const rawBodySha256 = requiredString(input.source?.rawBodySha256, 'source.rawBodySha256').toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(rawBodySha256)) fail('source.rawBodySha256 must be a lowercase SHA-256 hex digest')

  if (input.policy?.newProviderRequestIssued !== false) fail('Evidence must prove no new provider request was issued')
  if (input.policy?.providerImageReferenceOnly !== true) fail('Provider images must remain reference-only')
  if (input.policy?.providerImageMayBeRenderedPublicly !== false) fail('Evidence must not authorize public provider image rendering')
  if (input.policy?.officialResultAuthority !== false) fail('Evidence must not claim official-result authority')
  if (input.policy?.scoringAuthority !== false) fail('Evidence must not claim scoring authority')

  if (!Array.isArray(input.teams) || input.teams.length !== EXPECTED_TEAM_COUNT) {
    fail(`Evidence must contain exactly ${EXPECTED_TEAM_COUNT} teams`)
  }

  const providerIds = new Set()
  const platformTeamIds = new Set()
  const teams = input.teams.map((team, index) => {
    const prefix = `teams[${index}]`
    const providerTeamId = requiredString(team.providerTeamId, `${prefix}.providerTeamId`)
    const platformTeamId = requiredUuid(team.platformTeamId, `${prefix}.platformTeamId`)
    if (providerIds.has(providerTeamId)) fail(`Duplicate provider team id ${providerTeamId}`)
    if (platformTeamIds.has(platformTeamId)) fail(`Duplicate platform team id ${platformTeamId}`)
    providerIds.add(providerTeamId)
    platformTeamIds.add(platformTeamId)

    const founded = team.founded === null || team.founded === undefined ? null : team.founded
    if (founded !== null && (!Number.isInteger(founded) || founded < 1800 || founded > 2200)) {
      fail(`${prefix}.founded must be null or a plausible integer year`)
    }

    return {
      providerTeamId,
      platformTeamId,
      providerName: requiredString(team.providerName, `${prefix}.providerName`),
      shortCode: optionalString(team.shortCode, `${prefix}.shortCode`),
      founded,
      providerCountryId: optionalString(team.providerCountryId, `${prefix}.providerCountryId`),
      providerVenueId: optionalString(team.providerVenueId, `${prefix}.providerVenueId`),
      imageRef: optionalString(team.imageRef, `${prefix}.imageRef`),
    }
  })

  return { provider, tournamentId, rawResponseId, rawBodySha256, teams }
}

function evidenceValues(teams) {
  return teams
    .map(
      (team) =>
        `  (${sqlText(team.providerTeamId)}, ${sqlUuid(team.platformTeamId)}, ${sqlText(team.providerName)}, ${sqlText(team.shortCode)}, ${sqlInteger(team.founded)}, ${sqlText(team.providerCountryId)}, ${sqlText(team.providerVenueId)}, ${sqlText(team.imageRef)})`,
    )
    .join(',\n')
}

export function buildProviderTeamProfileBackfillSql(input) {
  const evidence = validateProviderTeamProfileEvidence(input)
  const values = evidenceValues(evidence.teams)
  const tournamentId = sqlUuid(evidence.tournamentId)
  const rawResponseId = sqlUuid(evidence.rawResponseId)
  const provider = sqlText(evidence.provider)
  const rawBodySha256 = sqlText(evidence.rawBodySha256)

  return `\\set ON_ERROR_STOP on
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- The protected season truth is locked only for this short transaction. If a
-- result/scoring writer is active, lock_timeout refuses the backfill rather than
-- racing it. The backfill never needs either table for its own write.
lock table public.season_fixtures in share mode;
lock table public.season_matchweek_scores in share mode;

create temporary table provider_team_profile_backfill_protected_state (
  relation_name text primary key,
  payload jsonb not null
) on commit drop;

insert into provider_team_profile_backfill_protected_state (relation_name, payload)
values
  (
    'season_fixtures',
    (select coalesce(jsonb_agg(to_jsonb(fixture) order by fixture.id), '[]'::jsonb)
       from public.season_fixtures fixture
      where fixture.tournament_id = ${tournamentId})
  ),
  (
    'season_matchweek_scores',
    (select coalesce(
              jsonb_agg(to_jsonb(score) order by score.entry_id, score.competition_round_id),
              '[]'::jsonb
            )
       from public.season_matchweek_scores score
      where score.tournament_id = ${tournamentId})
  );

-- Generated only from retained custody evidence. This script performs no HTTP
-- request and writes only predictor_internal.provider_team_profiles through the
-- Contract-144 writer.
create temporary table provider_team_profile_backfill_evidence (
  provider_id text primary key,
  platform_team_id uuid unique not null,
  provider_name text not null,
  short_code text,
  founded_year integer,
  provider_country_id text,
  provider_venue_id text,
  provider_image_ref text
) on commit drop;

insert into provider_team_profile_backfill_evidence (
  provider_id,
  platform_team_id,
  provider_name,
  short_code,
  founded_year,
  provider_country_id,
  provider_venue_id,
  provider_image_ref
) values
${values};

do $guard$
declare
  v_all_mapping_count integer;
  v_matching_mapping_count integer;
  v_source_provider text;
  v_source_status integer;
  v_source_sha text;
begin
  select source.provider, source.response_status, source.raw_body_sha256
    into v_source_provider, v_source_status, v_source_sha
    from predictor_internal.provider_raw_responses source
   where source.id = ${rawResponseId};

  if not found then
    raise exception 'Retained provider source response is missing' using errcode = '22023';
  end if;
  if v_source_provider <> ${provider} then
    raise exception 'Retained provider source belongs to a different provider' using errcode = '22023';
  end if;
  if v_source_status < 200 or v_source_status >= 300 then
    raise exception 'Retained provider source response was not successful' using errcode = '22023';
  end if;
  if lower(v_source_sha) <> ${rawBodySha256} then
    raise exception 'Retained provider source SHA-256 does not match committed evidence' using errcode = '22023';
  end if;

  select count(*)
    into v_all_mapping_count
    from public.provider_entity_map mapping
   where mapping.provider = ${provider}
     and mapping.entity_kind = 'team'
     and mapping.tournament_id = ${tournamentId};

  if v_all_mapping_count <> ${EXPECTED_TEAM_COUNT} then
    raise exception 'Expected ${EXPECTED_TEAM_COUNT} mapped provider teams, found %', v_all_mapping_count using errcode = '22023';
  end if;

  select count(*)
    into v_matching_mapping_count
    from provider_team_profile_backfill_evidence evidence
    join public.provider_entity_map mapping
      on mapping.provider = ${provider}
     and mapping.entity_kind = 'team'
     and mapping.provider_id = evidence.provider_id
     and mapping.tournament_id = ${tournamentId}
     and mapping.team_id = evidence.platform_team_id;

  if v_matching_mapping_count <> ${EXPECTED_TEAM_COUNT} then
    raise exception 'Committed evidence does not match all ${EXPECTED_TEAM_COUNT} provider team mappings' using errcode = '22023';
  end if;
end;
$guard$;

select predictor_internal.upsert_provider_team_profile(
         mapping.id,
         ${rawResponseId},
         evidence.provider_name,
         evidence.short_code,
         evidence.founded_year,
         evidence.provider_country_id,
         evidence.provider_venue_id,
         evidence.provider_image_ref
       )
  from provider_team_profile_backfill_evidence evidence
  join public.provider_entity_map mapping
    on mapping.provider = ${provider}
   and mapping.entity_kind = 'team'
   and mapping.provider_id = evidence.provider_id
   and mapping.tournament_id = ${tournamentId}
   and mapping.team_id = evidence.platform_team_id
 order by evidence.provider_id;

do $verify$
declare
  v_profile_count integer;
  v_matching_profile_count integer;
  v_fixtures_before jsonb;
  v_fixtures_after jsonb;
  v_scores_before jsonb;
  v_scores_after jsonb;
begin
  select count(*)
    into v_profile_count
    from predictor_internal.provider_team_profiles profile
    join public.provider_entity_map mapping
      on mapping.id = profile.provider_entity_map_id
   where mapping.provider = ${provider}
     and mapping.entity_kind = 'team'
     and mapping.tournament_id = ${tournamentId};

  if v_profile_count <> ${EXPECTED_TEAM_COUNT} then
    raise exception 'Expected ${EXPECTED_TEAM_COUNT} provider team profiles after backfill, found %', v_profile_count using errcode = '22023';
  end if;

  select count(*)
    into v_matching_profile_count
    from provider_team_profile_backfill_evidence evidence
    join public.provider_entity_map mapping
      on mapping.provider = ${provider}
     and mapping.entity_kind = 'team'
     and mapping.provider_id = evidence.provider_id
     and mapping.tournament_id = ${tournamentId}
     and mapping.team_id = evidence.platform_team_id
    join predictor_internal.provider_team_profiles profile
      on profile.provider_entity_map_id = mapping.id
     and profile.provider_name = evidence.provider_name
     and profile.short_code is not distinct from evidence.short_code
     and profile.founded_year is not distinct from evidence.founded_year
     and profile.provider_country_id is not distinct from evidence.provider_country_id
     and profile.provider_venue_id is not distinct from evidence.provider_venue_id
     and profile.provider_image_ref is not distinct from evidence.provider_image_ref
     and profile.source_raw_response_id = ${rawResponseId};

  if v_matching_profile_count <> ${EXPECTED_TEAM_COUNT} then
    raise exception 'Provider team profile postflight does not match committed evidence' using errcode = '22023';
  end if;

  select payload into v_fixtures_before
    from provider_team_profile_backfill_protected_state
   where relation_name = 'season_fixtures';
  select coalesce(jsonb_agg(to_jsonb(fixture) order by fixture.id), '[]'::jsonb)
    into v_fixtures_after
    from public.season_fixtures fixture
   where fixture.tournament_id = ${tournamentId};

  select payload into v_scores_before
    from provider_team_profile_backfill_protected_state
   where relation_name = 'season_matchweek_scores';
  select coalesce(
           jsonb_agg(to_jsonb(score) order by score.entry_id, score.competition_round_id),
           '[]'::jsonb
         )
    into v_scores_after
    from public.season_matchweek_scores score
   where score.tournament_id = ${tournamentId};

  if v_fixtures_after is distinct from v_fixtures_before then
    raise exception 'Provider profile backfill changed protected season fixture/result state' using errcode = 'P0001';
  end if;
  if v_scores_after is distinct from v_scores_before then
    raise exception 'Provider profile backfill changed protected season scoring state' using errcode = 'P0001';
  end if;
end;
$verify$;

commit;
`
}

function parseArgs(args) {
  const out = {}
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--help') out.help = true
    else if (arg === '--evidence' || arg === '--output') {
      const value = args[index + 1]
      if (!value || value.startsWith('--')) fail(`${arg} requires a value`)
      out[arg.slice(2)] = value
      index += 1
    } else fail(`Unknown argument ${arg}`)
  }
  return out
}

function runCli() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log('Usage: node scripts/ops/build-provider-team-profile-backfill.mjs --evidence <json> --output <sql>')
    return
  }
  if (!args.evidence || !args.output) fail('--evidence and --output are required')
  const evidence = JSON.parse(readFileSync(resolve(args.evidence), 'utf8'))
  const sql = buildProviderTeamProfileBackfillSql(evidence)
  const output = resolve(args.output)
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, sql)
  console.log(`Provider team profile backfill SQL written to ${output}`)
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  try {
    runCli()
  } catch (error) {
    console.error(`ERROR: ${error.message}`)
    process.exit(1)
  }
}
