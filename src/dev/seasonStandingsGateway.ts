import type { SeasonLeaderboardPage } from '../services/supabase/seasonLeaderboard'
import type { SeasonStandingsGateway } from '../features/season/standingsModel'

/**
 * A fixture-backed gateway for the season standings surface.
 *
 * WHY A FIXTURE WHEN THE REAL RPC ALREADY EXISTS. `get_season_leaderboard` is
 * granted to `authenticated` and `SeasonLeaderboardPreview` next door already
 * reads it for real — that preview's job is to prove the seam. This one's job
 * is the opposite: to render every STATE the surface must handle, including the
 * ones a healthy database will not produce on demand. An empty table before the
 * first settlement, a 400-player table that pushes the caller off page one, a
 * refusing server and a slow page are all states the release gate asks for, and
 * waiting for a real season to reach each of them is not a review strategy.
 *
 * The paging it simulates is the server's contract, not an invention: pages
 * carry an opaque cursor, `hasMore` is never true without one (the parser
 * rejects that combination), and the caller's own row arrives in `you`
 * independently of whether it appears in `rows`.
 */

export type StandingsScenario =
  | 'healthy'
  | 'you_off_page'
  | 'ties'
  | 'empty'
  | 'slow'
  | 'load_failure'
  | 'page_failure'

const NAMES = [
  'Ada Lovelace',
  'Bo Jangles',
  'Cleo Nwosu',
  'Dee Fitzgerald',
  'Ezra Kimani',
  'Farah Haddad',
  'Gus Lindqvist',
  'Hana Okafor',
  'Ivo Petrov',
  'Jae-won Park',
  'Kit Marlowe',
  'Lena Vasquez',
  'Maximilian von Habsburg-Lothringen',
  'Nia Boateng',
  'Otto Brandt',
  'Priya Raghunathan',
]

const PAGE_SIZE = 8

function build(scenario: StandingsScenario, cursor: string | null): SeasonLeaderboardPage {
  const total = scenario === 'you_off_page' ? 400 : NAMES.length
  const offset = cursor ? Number.parseInt(cursor.replace('cursor::', ''), 10) : 0
  const slice = NAMES.slice(offset, offset + PAGE_SIZE)

  const rows = slice.map((displayName, index) => {
    const position = offset + index + 1
    // A deliberate three-way tie at ranks 4-6 in the `ties` scenario, so the
    // shared-rank presentation has something to show.
    const tied = scenario === 'ties' && position >= 4 && position <= 6
    const rank = tied ? 4 : position
    return {
      displayName,
      // Tied rows must carry EQUAL points, or the fixture contradicts itself:
      // a shared rank beside three different totals is a state the server
      // cannot produce, and a reviewer reading it would learn the wrong thing.
      points: Math.max(0, 120 - (tied ? 4 : position) * 4),
      rank,
      matchweeksPlayed: position % 5 === 0 ? 18 : 22,
      tied,
      position,
      // In `you_off_page` the caller is 399th and never appears in these rows.
      isYou: scenario !== 'you_off_page' && position === 3,
    }
  })

  const nextOffset = offset + PAGE_SIZE
  const hasMore = nextOffset < NAMES.length

  return {
    rows: scenario === 'empty' ? [] : rows,
    totalCount: scenario === 'empty' ? 0 : total,
    pageSize: PAGE_SIZE,
    hasMore: scenario === 'empty' ? false : hasMore,
    // Never a cursor without more to fetch: the parser rejects the inverse, and
    // a fixture that violated the contract would hide a real bug.
    nextCursor: scenario === 'empty' || !hasMore ? null : `cursor::${nextOffset}`,
    you:
      scenario === 'you_off_page'
        ? {
            displayName: 'You',
            points: 12,
            rank: 399,
            matchweeksPlayed: 4,
            tied: false,
            position: 399,
          }
        : scenario === 'empty'
          ? null
          : {
              displayName: NAMES[2] ?? 'You',
              points: 108,
              rank: 3,
              matchweeksPlayed: 22,
              tied: false,
              position: 3,
            },
  }
}

export function createDevSeasonStandingsGateway(
  scenario: StandingsScenario = 'healthy',
): SeasonStandingsGateway {
  return {
    async load(cursor: string | null): Promise<SeasonLeaderboardPage> {
      if (scenario === 'slow') await new Promise((resolve) => setTimeout(resolve, 1500))
      if (scenario === 'load_failure') {
        throw new Error('The standings service is unavailable.')
      }
      // Fails only the append, so the surface can show a readable table with a
      // failure beside it rather than an error page.
      if (scenario === 'page_failure' && cursor) {
        throw new Error('The standings service is unavailable.')
      }
      return build(scenario, cursor)
    },
  }
}
