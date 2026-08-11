import type { FixtureListRow } from './fixtureListModel'
import type { SeasonLeagueStandingsRow } from '../../services/supabase/seasonLeagueStandingsModel'

/**
 * `INNOV-006` — what a Matchday TV panel shows, and in what order.
 *
 * IT IS READ-ONLY BY CONSTRUCTION. Every type here describes something to
 * display. There is no command, no id a caller could act on and no field a
 * write would need — a shared screen in a room full of people must not be able
 * to change anybody's entry, and the safest way to guarantee that is to give
 * the surface nothing to change it with.
 *
 * IT INVENTS NO LIVE STATE. A fixture is live only where the fixture list says
 * a provider reported a score and the platform has not confirmed a result — the
 * exact same distinction the Match Centre draws — and the panel labels it
 * provisional every time. Nothing here promotes a provisional score to a
 * result, and a competition with no football on produces an honest empty panel
 * rather than a rotation of nothing.
 *
 * PANELS THAT HAVE NOTHING TO SAY ARE DROPPED, NOT SHOWN EMPTY. A rotation that
 * spends a third of its time on a blank card is worse than a shorter rotation.
 *
 * PURE.
 */

export type TvPanelKind = 'live' | 'today' | 'table' | 'next'

export type TvPanel =
  | { kind: 'live'; title: string; fixtures: readonly FixtureListRow[] }
  | { kind: 'today'; title: string; fixtures: readonly FixtureListRow[] }
  | {
      kind: 'table'
      title: string
      rows: readonly { position: number; displayName: string; points: number; isYou: boolean }[]
      /** The league's real size, so a capped list can say what it is. */
      fieldSize: number
    }
  | { kind: 'next'; title: string; fixtures: readonly FixtureListRow[] }

export type TvModeInput = {
  competitionName: string
  seasonLabel: string
  /** Every fixture the page loaded, in kickoff order. */
  fixtures: readonly FixtureListRow[]
  /** `YYYY-MM-DD` for the day being shown, in the viewer's zone. */
  today: string
  /** A private league's table, when the host is in one. */
  league: { name: string; rows: readonly SeasonLeagueStandingsRow[]; fieldSize: number } | null
  /** Rows kept on a television. More than this and the type has to shrink. */
  tableRows?: number
}

const DEFAULT_TABLE_ROWS = 10

/**
 * A fixture a provider is currently reporting a score for, and which the
 * platform has not settled. The same two fields the Match Centre uses, in the
 * same order of precedence.
 */
function isLive(fixture: FixtureListRow): boolean {
  return fixture.provisional !== null && fixture.score === null
}

export function presentTvMode(input: TvModeInput): readonly TvPanel[] {
  const panels: TvPanel[] = []

  const live = input.fixtures.filter(isLive)
  if (live.length > 0) {
    panels.push({ kind: 'live', title: 'Live now', fixtures: live })
  }

  const today = input.fixtures.filter(
    (fixture) => fixture.kickoffAt?.slice(0, 10) === input.today && !isLive(fixture),
  )
  if (today.length > 0) {
    panels.push({ kind: 'today', title: 'Today', fixtures: today })
  }

  if (input.league && input.league.rows.length > 0) {
    panels.push({
      kind: 'table',
      title: input.league.name,
      rows: input.league.rows.slice(0, input.tableRows ?? DEFAULT_TABLE_ROWS).map((row) => ({
        position: row.position,
        displayName: row.displayName,
        points: row.points,
        isYou: row.isYou,
      })),
      fieldSize: input.league.fieldSize,
    })
  }

  // Everything still to come, soonest first, excluding today's — which already
  // has a panel of its own.
  const upcoming = input.fixtures
    .filter(
      (fixture) =>
        !fixture.played &&
        fixture.score === null &&
        fixture.kickoffAt !== null &&
        fixture.kickoffAt.slice(0, 10) > input.today,
    )
    .slice(0, 6)
  if (upcoming.length > 0) {
    panels.push({ kind: 'next', title: 'Coming up', fixtures: upcoming })
  }

  return panels
}
