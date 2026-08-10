import type { FixtureListRow, FixtureListView } from '../season/fixtureListModel'

/**
 * One chronological football view across every competition the player plays in.
 *
 * WHAT IT REPLACES. `/matches` asked which competition, then showed that
 * competition's fixtures. Football does not happen one competition at a time,
 * and the 10 August authority requires a combined Today / Upcoming / Results
 * view defaulting to the player's own competitions rather than the platform
 * catalogue.
 *
 * IT MERGES PRESENTED VIEWS, IT DOES NOT RE-PRESENT FIXTURES. Every row here
 * came out of `presentFixtureList`, so the rules that matter — a provisional
 * score is never a result, played comes from the server and never from a clock,
 * kickoffs resolve in the viewer's zone, the matchweek label prints only where
 * a day mixes them — are honoured by construction rather than by a second copy
 * that can drift. This model orders, groups by day and labels each row with the
 * competition it belongs to.
 *
 * EVERY ROW NAMES ITS COMPETITION. Two competitions in one list makes "Celtic v
 * Rangers" unambiguous and "United v City" not; the label is the whole reason a
 * combined view is readable.
 *
 * DAY KEYS ARE ALREADY THE VIEWER'S. `presentFixtureList` resolved them in the
 * viewer's zone, so merging on the key cannot put two competitions' Saturdays
 * on different rows.
 *
 * TODAY IS A PRESENTATION QUESTION, NOT A LOCK. `today` is an input day key.
 * Nothing here decides whether a match has been played — that is the server's
 * `played`, carried on the row.
 *
 * PURE.
 */

export type CombinedFixtureRow = FixtureListRow & {
  competitionKey: string
  competitionName: string
}

export type CombinedFixtureDay = {
  key: string
  label: string
  rows: readonly CombinedFixtureRow[]
}

export type CombinedFixtureView = 'today' | 'upcoming' | 'results'

export type CombinedFixtureSource = {
  competitionKey: string
  competitionName: string
  view: FixtureListView
}

export type CombinedFixtures = {
  days: readonly CombinedFixtureDay[]
  empty: boolean
  /** Competitions whose fixtures could not be read, by name. */
  unreadable: readonly string[]
  /** How many rows each view holds, so an empty tab can say so honestly. */
  counts: Readonly<Record<CombinedFixtureView, number>>
}

function rowsOf(sources: readonly CombinedFixtureSource[]): {
  key: string
  label: string
  row: CombinedFixtureRow
}[] {
  return sources.flatMap((source) =>
    source.view.days.flatMap((day) =>
      day.rows.map((row) => ({
        key: day.key,
        label: day.label,
        row: {
          ...row,
          competitionKey: source.competitionKey,
          competitionName: source.competitionName,
        },
      })),
    ),
  )
}

function keep(
  entry: { key: string; row: CombinedFixtureRow },
  view: CombinedFixtureView,
  today: string,
): boolean {
  switch (view) {
    case 'today':
      return entry.key === today
    case 'results':
      // The server's status, never a comparison against the clock — which
      // would call an abandoned match finished and a delayed one over.
      return entry.row.played
    case 'upcoming':
      return !entry.row.played
  }
}

export function presentCombinedFixtures(
  sources: readonly CombinedFixtureSource[],
  unreadable: readonly string[],
  view: CombinedFixtureView,
  today: string,
  competitionFilter: string | 'all' = 'all',
): CombinedFixtures {
  const all = rowsOf(sources).filter(
    (entry) => competitionFilter === 'all' || entry.row.competitionKey === competitionFilter,
  )

  const counts = {
    today: all.filter((entry) => keep(entry, 'today', today)).length,
    upcoming: all.filter((entry) => keep(entry, 'upcoming', today)).length,
    results: all.filter((entry) => keep(entry, 'results', today)).length,
  }

  const wanted = all.filter((entry) => keep(entry, view, today))

  const byDay = new Map<string, { label: string; rows: CombinedFixtureRow[] }>()
  for (const entry of wanted) {
    const bucket = byDay.get(entry.key) ?? { label: entry.label, rows: [] }
    bucket.rows.push(entry.row)
    byDay.set(entry.key, bucket)
  }

  const days = [...byDay.entries()]
    .sort(([left], [right]) =>
      // Results read backwards: the most recent result is the one being looked
      // for, while the next fixture is the one that matters going forward.
      view === 'results' ? right.localeCompare(left) : left.localeCompare(right),
    )
    .map(([key, bucket]) => ({
      key,
      label: bucket.label,
      // Within a day, kick-off order across competitions. A row with no kickoff
      // sorts last: it is scheduled but untimed, not first thing in the morning.
      rows: [...bucket.rows].sort((left, right) => {
        if (left.kickoff === right.kickoff) {
          return left.competitionName.localeCompare(right.competitionName)
        }
        if (left.kickoff === null) return 1
        if (right.kickoff === null) return -1
        return left.kickoff.localeCompare(right.kickoff)
      }),
    }))

  return { days, empty: days.length === 0, unreadable, counts }
}
