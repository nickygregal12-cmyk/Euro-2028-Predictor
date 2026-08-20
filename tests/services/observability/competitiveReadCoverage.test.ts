import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = resolve(import.meta.dirname, '../../..')

const COVERED_READS = [
  {
    path: 'src/services/supabase/leaderboard.ts',
    operation: 'leaderboard.page',
  },
  {
    path: 'src/services/supabase/seasonLeaderboard.ts',
    operation: 'season-leaderboard.page',
  },
  {
    path: 'src/services/supabase/matchCentre.ts',
    operation: 'match-centre.league-picks',
  },
  {
    path: 'src/services/supabase/matchCentre.ts',
    operation: 'match-centre.distribution',
  },
] as const

describe('high-value caught reads remain observable', () => {
  it.each(COVERED_READS)('$operation is reported by $path', ({ path, operation }) => {
    const source = readFileSync(resolve(repositoryRoot, path), 'utf8')
    expect(source).toContain('reportReadFailure')
    expect(source).toContain(`reportReadFailure('${operation}'`)
  })

  it('keeps the read telemetry contract content-free', () => {
    const source = readFileSync(
      resolve(repositoryRoot, 'src/services/observability/readFailure.ts'),
      'utf8',
    )

    for (const forbidden of [
      'playerId',
      'userId',
      'leagueId',
      'fixtureId',
      'matchId',
      'inviteCode',
      'displayName',
      'prediction',
      'scoreline',
      'email',
    ]) {
      expect(
        source.includes(forbidden),
        `readFailure.ts gained a ${forbidden} field; caught read telemetry must stay content-free`,
      ).toBe(false)
    }
  })
})
