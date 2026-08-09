import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildProviderTeamProfileBackfillSql,
  validateProviderTeamProfileEvidence,
} from '../../scripts/ops/build-provider-team-profile-backfill.mjs'

type ValidatedTeam = { shortCode: string | null; providerName: string }

const evidencePath = resolve(
  process.cwd(),
  'docs/quality/evidence/2026-08-08-sportmonks-scottish-team-enrichment.json',
)
const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'))
const generatorSource = readFileSync(
  resolve(process.cwd(), 'scripts/ops/build-provider-team-profile-backfill.mjs'),
  'utf8',
)
const workflowSource = readFileSync(
  resolve(process.cwd(), '.github/workflows/development-provider-team-profile-backfill.yml'),
  'utf8',
)

function cloneEvidence() {
  return structuredClone(evidence)
}

describe('provider team profile backfill evidence', () => {
  it('accepts the retained 12-club Scottish evidence including the real DUD collision', () => {
    const validated = validateProviderTeamProfileEvidence(cloneEvidence())
    expect(validated.teams).toHaveLength(12)
    expect(
      validated.teams
        .filter((team: ValidatedTeam) => team.shortCode === 'DUD')
        .map((team: ValidatedTeam) => team.providerName),
    ).toEqual(['Dundee', 'Dundee United'])
  })

  it('refuses evidence that claims result or scoring authority', () => {
    const resultAuthority = cloneEvidence()
    resultAuthority.policy.officialResultAuthority = true
    expect(() => validateProviderTeamProfileEvidence(resultAuthority)).toThrow(/official-result authority/)

    const scoringAuthority = cloneEvidence()
    scoringAuthority.policy.scoringAuthority = true
    expect(() => validateProviderTeamProfileEvidence(scoringAuthority)).toThrow(/scoring authority/)
  })

  it('refuses incomplete or ambiguous team identity evidence', () => {
    const incomplete = cloneEvidence()
    incomplete.teams.pop()
    expect(() => validateProviderTeamProfileEvidence(incomplete)).toThrow(/exactly 12 teams/)

    const duplicate = cloneEvidence()
    duplicate.teams[1].providerTeamId = duplicate.teams[0].providerTeamId
    expect(() => validateProviderTeamProfileEvidence(duplicate)).toThrow(/Duplicate provider team id/)
  })
})

describe('provider team profile backfill SQL', () => {
  it('binds retained custody, existing provider mappings and the Contract-144 writer in one transaction', () => {
    const sql = buildProviderTeamProfileBackfillSql(cloneEvidence())
    expect(sql).toContain('\\set ON_ERROR_STOP on')
    expect(sql).toContain('begin;')
    expect(sql).toContain('commit;')
    expect(sql).toContain('predictor_internal.provider_raw_responses')
    expect(sql).toContain('source.raw_body_sha256')
    expect(sql).toContain('public.provider_entity_map')
    expect(sql).toContain('predictor_internal.upsert_provider_team_profile')
    expect(sql).toContain('create temporary table provider_team_profile_backfill_evidence')
    expect(sql).toContain('on commit drop')
    expect(sql).toContain("mapping.entity_kind = 'team'")
    expect(sql).toContain('mapping.team_id = evidence.platform_team_id')
    expect(sql).toContain('Expected 12 mapped provider teams')
    expect(sql).toContain('Provider team profile postflight does not match committed evidence')
  })

  it('locks and compares the protected fixture/result and scoring authorities before commit', () => {
    const sql = buildProviderTeamProfileBackfillSql(cloneEvidence())
    expect(sql).toContain('lock table public.season_fixtures in share mode')
    expect(sql).toContain('lock table public.season_matchweek_scores in share mode')
    expect(sql).toContain('provider_team_profile_backfill_protected_state')
    expect(sql).toContain('Provider profile backfill changed protected season fixture/result state')
    expect(sql).toContain('Provider profile backfill changed protected season scoring state')
    expect(sql.indexOf('Provider profile backfill changed protected season scoring state')).toBeLessThan(
      sql.lastIndexOf('commit;'),
    )
  })

  it('does not embed a provider-mapping row UUID or add an HTTP/provider polling path', () => {
    const sql = buildProviderTeamProfileBackfillSql(cloneEvidence())
    expect(sql).not.toContain('provider_entity_map_id uuid')
    expect(generatorSource).not.toMatch(/\bfetch\s*\(/)
    expect(generatorSource).not.toMatch(/https?\.request\s*\(/)
    expect(generatorSource).not.toContain('provider-poll')
  })

  it('escapes provider text before emitting SQL', () => {
    const changed = cloneEvidence()
    changed.teams[0].providerName = "Aberdeen O'Example"
    const sql = buildProviderTeamProfileBackfillSql(changed)
    expect(sql).toContain("Aberdeen O''Example")
    expect(sql).not.toContain("Aberdeen O'Example")
  })
})

describe('Development provider team profile backfill workflow', () => {
  it('is manually dispatched, exact-main and Development-only', () => {
    expect(workflowSource).toContain('workflow_dispatch:')
    expect(workflowSource).toContain("[ \"${GITHUB_REF}\" = 'refs/heads/main' ]")
    expect(workflowSource).toContain('iouzoutneyjpugbbtdem')
    expect(workflowSource).toContain('vkfnsqdyhvtwyqkisxhk')
    expect(workflowSource).toContain('BACKFILL-SCOTTISH-TEAM-PROFILES')
    expect(workflowSource).toContain('production provider-profile backfill is not authorised')
  })

  it('requires hosted migration parity and Contract 144 before it can write', () => {
    const parity = workflowSource.indexOf(
      'Prove Development already matches the repository and includes Contract 144',
    )
    const apply = workflowSource.indexOf('Apply the 12-club profile backfill')
    expect(parity).toBeGreaterThan(0)
    expect(apply).toBeGreaterThan(parity)
    expect(workflowSource).toContain('supabase migration list --db-url')
    expect(workflowSource).toContain('Development is behind the repository; apply migrations first')
    expect(workflowSource).toContain('20260809140000')
    expect(workflowSource).toContain('Contract 144 is not present in the Development migration ledger')
  })

  it('uses only the committed retained evidence and records bounded postflight evidence', () => {
    expect(workflowSource).toContain(
      'docs/quality/evidence/2026-08-08-sportmonks-scottish-team-enrichment.json',
    )
    expect(workflowSource).toContain('build-provider-team-profile-backfill.mjs')
    expect(workflowSource).toContain('profileCount')
    expect(workflowSource).toContain('sourceResponseCount')
    expect(workflowSource).toContain('shortCodeDudCount')
    expect(workflowSource).toContain('protectedResultScoringStateChanged')
    expect(workflowSource).not.toContain('curl ')
  })
})
