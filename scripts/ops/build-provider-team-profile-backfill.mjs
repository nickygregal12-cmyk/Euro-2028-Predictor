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
        `    (${sqlText(team.providerTeamId)}, ${sqlUuid(team.platformTeamId)}, ${sqlText(team.providerName)}, ${sqlText(team.shortCode)}, ${sqlInteger(team.founded)}, ${sqlText(team.providerCountryId)}, ${sqlText(team.providerVenueId)}, ${sqlText(team.imageRef)})`,
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

  const evidenceCte = `evidence(provider_id, platform_team_id, provider_name, short_code, founded_year, provider_country_id, provider_venue_id, provider_image_ref) as (\n  values\n${values}\n)`

  return `\\set ON_ERROR_STOP on
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- This script is generated entirely from retained custody evidence. It issues
-- no provider request and writes only predictor_internal.provider_team_profiles.
do $guard$
declare
  v_mapping_count integer;
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
    into v_mapping_count
    from public.provider_entity_map mapping
   where mapping.provider = ${provider}
     and mapping.entity_kind = 'team'
     and mapping.tournament_id = ${tournamentId};

  if v_mapping_count <> ${EXPECTED_TEAM_COUNT} then
    raise exception 'Expected ${EXPECTED_TEAM_COUNT} mapped provider teams, found %', v_mapping_count using errcode = '22023';
  end if;
end;
$guard$;

with ${evidenceCte}
select case
         when count(*) = ${EXPECTED_TEAM_COUNT} then true
         else predictor_internal.raise_provider_team_profile_backfill_mapping_error(count(*))
       end
  from evidence e
  join public.provider_entity_map mapping
    on mapping.provider = ${provider}
   and mapping.entity_kind = 'team'
   and mapping.provider_id = e.provider_id
   and mapping.tournament_id = ${tournamentId}
   and mapping.team_id = e.platform_team_id;

with ${evidenceCte},
mapped as (
  select mapping.id as provider_entity_map_id, e.*
    from evidence e
    join public.provider_entity_map mapping
      on mapping.provider = ${provider}
     and mapping.entity_kind = 'team'
     and mapping.provider_id = e.provider_id
     and mapping.tournament_id = ${tournamentId}
     and mapping.team_id = e.platform_team_id
)
select predictor_internal.upsert_provider_team_profile(
         mapped.provider_entity_map_id,
         ${rawResponseId},
         mapped.provider_name,
         mapped.short_code,
         mapped.founded_year,
         mapped.provider_country_id,
         mapped.provider_venue_id,
         mapped.provider_image_ref
       )
  from mapped
 order by mapped.provider_id;

with ${evidenceCte},
actual as (
  select mapping.provider_id,
         mapping.team_id as platform_team_id,
         profile.provider_name,
         profile.short_code,
         profile.founded_year,
         profile.provider_country_id,
         profile.provider_venue_id,
         profile.provider_image_ref,
         profile.source_raw_response_id
    from predictor_internal.provider_team_profiles profile
    join public.provider_entity_map mapping
      on mapping.id = profile.provider_entity_map_id
   where mapping.provider = ${provider}
     and mapping.entity_kind = 'team'
     and mapping.tournament_id = ${tournamentId}
)
select case
         when count(*) filter (
           where actual.provider_id is not null
             and actual.platform_team_id = evidence.platform_team_id
             and actual.provider_name = evidence.provider_name
             and actual.short_code is not distinct from evidence.short_code
             and actual.founded_year is not distinct from evidence.founded_year
             and actual.provider_country_id is not distinct from evidence.provider_country_id
             and actual.provider_venue_id is not distinct from evidence.provider_venue_id
             and actual.provider_image_ref is not distinct from evidence.provider_image_ref
             and actual.source_raw_response_id = ${rawResponseId}
         ) = ${EXPECTED_TEAM_COUNT}
         and count(*) = ${EXPECTED_TEAM_COUNT}
         then true
         else predictor_internal.raise_provider_team_profile_backfill_verification_error(count(*))
       end
  from evidence
  left join actual using (provider_id);

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
