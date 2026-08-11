import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * `SEC-002` — a raw database, RPC or network message must never reach a screen.
 *
 * TWO LISTS, BECAUSE THERE ARE TWO OBLIGATIONS AND THEY ARE NOT THE SAME ONE.
 *
 *   - Every user-visible surface must never render an unknown error's own
 *     `.message`. That is the security property, and it applies whether or not
 *     the file catches anything itself.
 *   - Every file that CATCHES a failure and turns it into a sentence must map it
 *     through `userFacingError`. That is where the mapping is enforced.
 *
 * They used to be one list, which was correct while every surface caught its own
 * failures. `useInviteCode` broke that assumption for a good reason: the invite
 * deep link and the code-entry sheet ask the same two questions in the same
 * order, and two copies of "look the code up, then join it" is how one surface
 * starts joining a Championship through the league path. The catching moved into
 * the hook, so the mapping requirement moved with it — and the surfaces stay on
 * the first list, where the security property still binds them.
 */

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

/** The files above, plus the shared hooks they delegate their catching to. */
const ERROR_MAPPING_OWNERS = [
  ...USER_VISIBLE_SURFACES.filter(
    (path) =>
      path !== 'src/features/leagues/JoinLandingPage.tsx' &&
      path !== 'src/features/leagues/JoinLeagueModal.tsx',
  ),
  'src/features/leagues/useInviteCode.ts',
]

describe('SEC-002 user-facing error boundary', () => {
  it.each(USER_VISIBLE_SURFACES)('%s does not render an unknown error message directly', (path) => {
    const source = readFileSync(path, 'utf8')

    expect(source).not.toMatch(/instanceof\s+Error\s*\?[^:\n]*\.message/)
    expect(source).not.toMatch(/\(err\s+as\s+\{\s*message\??:/)
    expect(source).not.toMatch(/\b(?:error|err|e)\??\.message\b/)
  })

  it.each(ERROR_MAPPING_OWNERS)('%s maps a caught failure through the mapper', (path) => {
    expect(readFileSync(path, 'utf8')).toContain('userFacingError')
  })

  it('keeps raw-message inspection inside the mapper rather than UI surfaces', () => {
    const mapper = readFileSync('src/shared/errors/userFacingError.ts', 'utf8')
    expect(mapper).toContain('message?: unknown')
    expect(mapper).toContain('return fallback')
  })
})
