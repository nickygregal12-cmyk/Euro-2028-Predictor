import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const USER_VISIBLE_SURFACES = [
  'src/app/providers/PredictionsProvider.tsx',
  'src/app/providers/TournamentDataProvider.tsx',
  'src/features/h2h/H2HPage.tsx',
  'src/features/home/useHomeData.ts',
  'src/features/league/LeaguePage.tsx',
  'src/features/league/OverallStandingsPage.tsx',
  'src/features/leagues/CreateLeagueModal.tsx',
  'src/features/leagues/JoinLandingPage.tsx',
  'src/features/leagues/JoinLeagueModal.tsx',
  'src/features/leagues/LeagueDetailPage.tsx',
  'src/features/leagues/TransferOwnershipModal.tsx',
  'src/features/matches/MatchCentrePage.tsx',
  'src/features/profile/ProfilePage.tsx',
]

describe('SEC-002 user-facing error boundary', () => {
  it.each(USER_VISIBLE_SURFACES)('%s does not render an unknown error message directly', (path) => {
    const source = readFileSync(path, 'utf8')

    expect(source).not.toMatch(/\b(?:error|err|e)\s+instanceof\s+Error\s*\?\s*\1?\.message/)
    expect(source).not.toMatch(/\(err\s+as\s+\{\s*message\??:/)
    expect(source).not.toMatch(/\b(?:error|err|e)\??\.message\b/)
    expect(source).toContain('userFacingError')
  })

  it('keeps raw-message inspection inside the mapper rather than UI surfaces', () => {
    const mapper = readFileSync('src/shared/errors/userFacingError.ts', 'utf8')
    expect(mapper).toContain('message?: unknown')
    expect(mapper).toContain('return fallback')
  })
})
