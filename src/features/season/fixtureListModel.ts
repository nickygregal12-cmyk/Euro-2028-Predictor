import type {
  SeasonFixtureList,
  SeasonListFixture,
} from '../../services/supabase/seasonFixtureListModel'
import type { ClubIdentityTokens } from '../../domain/clubIdentity/clubIdentityTypes'

/**
 * Presentation model for a competition's fixtures over a date window
 * (contract 139).
 *
 * ORDERED BY KICKOFF, LABELLED BY MATCHWEEK. This is the whole point, and it is
 * the owner's 5 August amendment stated as code: a fixture postponed out of
 * matchweek 5 into November keeps `competition_round_id = 5` deliberately, so
 * grouping by round files a November match under a September heading and puts
 * it nowhere near the matches it is actually played beside. The day is the
 * grouping key; the matchweek is something each row prints.
 *
 * IT REPLACES `matchesModel`'s BY-ROUND VIEW rather than joining it. Two models
 * over the same fixtures, one grouping by round and one by day, would be two
 * answers to "when is this played" — and the by-round one is the answer the
 * amendment forbids.
 *
 * THE MATCHWEEK LABEL IS ONLY PRINTED WHEN A DAY MIXES THEM, which is the case
 * it exists for. An ordinary Saturday is one matchweek and repeating it on
 * every row is noise; a Saturday carrying a postponed match from six weeks ago
 * is exactly when a reader needs to be told.
 *
 * PROVISIONAL IS NEVER A RESULT. `result` comes from the platform's settlement;
 * `live` is what a provider currently reports, and the read keeps them in
 * separate fields precisely so a surface cannot quietly promote one to the
 * other. A row shows the official score when there is one, and otherwise may
 * show a provisional score SAID TO BE PROVISIONAL — never as the score.
 *
 * PURE. Time zone is an input, no clock is read, and the server's order is
 * preserved rather than re-derived.
 */

export type FixtureListClub = {
  name: string
  tokens: ClubIdentityTokens
}

export type FixtureListRow = {
  id: string
  home: FixtureListClub
  away: FixtureListClub
  /** "15:00" in the competition's zone, or null when no kickoff is scheduled. */
  kickoff: string | null
  /** "Matchweek 5", printed only when the day carries more than one. */
  roundLabel: string | null
  /** "2 - 1" once the platform has settled it. */
  score: string | null
  /** A provider's current score, when there is no official one. Never a result. */
  provisional: string | null
  played: boolean
  accessibleSummary: string
}

export type FixtureListDay = {
  /** `YYYY-MM-DD` in the competition's zone. Sorts and keys correctly. */
  key: string
  /** "Saturday 8 August", in the competition's zone. */
  label: string
  rows: readonly FixtureListRow[]
}

export type FixtureListView = {
  days: readonly FixtureListDay[]
  empty: boolean
  /** Null when every fixture has a result; a sentence when none or some do. */
  resultsNote: string | null
  /** True when at least one day mixes matchweeks — a rescheduled fixture. */
  hasRescheduled: boolean
}

/**
 * A handful of rows from the same window, for a surface that is not the fixture
 * list — Overview's "what is on".
 *
 * IT IS A SLICE OF THE LIST, NOT A SECOND READ OF IT. Deriving the preview from
 * the view the Matches section already builds is what stops the two disagreeing:
 * one order, one set of labels, one rule about provisional scores. A separate
 * model over the same fixtures would be a second answer to the same question,
 * which is the shape the by-round view was retired for.
 */
export type FixturePreviewRow = FixtureListRow & {
  /** The day this row sits under, carried on the row because a preview has no
   *  day headings to sit under. */
  dayLabel: string
}

export type FixturePreview = {
  /**
   * `upcoming` when the window still holds a fixture that has not been played
   * and the list runs forward from it; `results` when every fixture in the
   * window is played and the list is the most recent of them. The distinction
   * is the heading's, and it must come from the data rather than from a clock.
   */
  kind: 'upcoming' | 'results'
  rows: readonly FixturePreviewRow[]
  /** Fixtures in the same window that this preview is not showing. */
  hidden: number
  empty: boolean
}

export function previewFixtures(view: FixtureListView, limit: number): FixturePreview {
  const all: FixturePreviewRow[] = view.days.flatMap((day) =>
    day.rows.map((row) => ({ ...row, dayLabel: day.label })),
  )

  // The first fixture the server has not marked played — never a comparison
  // against now, which would call an abandoned match finished and a delayed one
  // over. The days are already in kickoff order, so the rows after it are the
  // ones still to come.
  const next = all.findIndex((row) => !row.played)
  const rows =
    next === -1
      ? // Every fixture in the window is played, so the useful few are the last
        // ones rather than the first: a season's most recent results.
        all.slice(Math.max(0, all.length - limit))
      : all.slice(next, next + limit)

  return {
    kind: next === -1 ? 'results' : 'upcoming',
    rows,
    hidden: all.length - rows.length,
    empty: all.length === 0,
  }
}

function parts(
  instant: string,
  timeZone: string,
): { key: string; label: string; time: string } | null {
  const at = new Date(instant)
  if (Number.isNaN(at.getTime())) return null

  // `en-CA` yields `YYYY-MM-DD`, which sorts and keys correctly. Used for the
  // KEY only; the label below is formatted for reading.
  const key = at.toLocaleDateString('en-CA', { timeZone })
  const label = at.toLocaleDateString(undefined, {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  // The ZONE is the competition's; the 12-or-24-hour FORMAT is the viewer's,
  // which is a reading preference rather than a fact about the fixture.
  const time = at.toLocaleTimeString(undefined, {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  })

  return { key, label, time }
}

function summarise(fixture: SeasonListFixture, kickoff: string | null, mixed: boolean): string {
  const who = `${fixture.home.name} against ${fixture.away.name}`
  const round = mixed ? `, ${fixture.round.label}` : ''

  if (fixture.result) {
    return `${fixture.home.name} ${fixture.result.home}, ${fixture.away.name} ${fixture.result.away}${round}`
  }
  return kickoff ? `${who}, kick-off ${kickoff}${round}` : `${who}, kick-off to be confirmed${round}`
}

export function presentFixtureList(
  page: SeasonFixtureList,
  timeZone: string,
): FixtureListView {
  type Bucket = { label: string; fixtures: SeasonListFixture[] }
  const byDay = new Map<string, Bucket>()
  // A fixture with no kickoff cannot be placed on a day. It is not dropped — a
  // scheduled match the league has not timed yet is still a fixture — so they
  // collect under their own heading at the end.
  const undated: SeasonListFixture[] = []

  for (const fixture of page.fixtures) {
    const when = fixture.kickoffAt ? parts(fixture.kickoffAt, timeZone) : null
    if (!when) {
      undated.push(fixture)
      continue
    }
    const day = byDay.get(when.key) ?? { label: when.label, fixtures: [] }
    day.fixtures.push(fixture)
    byDay.set(when.key, day)
  }

  let hasRescheduled = false

  function rowsOf(fixtures: readonly SeasonListFixture[]): FixtureListRow[] {
    const rounds = new Set(fixtures.map((fixture) => fixture.round.ordinal))
    const mixed = rounds.size > 1
    if (mixed) hasRescheduled = true

    return fixtures.map((fixture) => {
      const when = fixture.kickoffAt ? parts(fixture.kickoffAt, timeZone) : null
      const kickoff = when?.time ?? null

      return {
        id: fixture.id,
        home: fixture.home,
        away: fixture.away,
        kickoff,
        roundLabel: mixed ? fixture.round.label : null,
        score: fixture.result ? `${fixture.result.home} - ${fixture.result.away}` : null,
        // Only where there is no official score, and only when the provider
        // sent both numbers. A one-sided provisional score is not a scoreline.
        provisional:
          !fixture.result && fixture.live && fixture.live.home !== null && fixture.live.away !== null
            ? `${fixture.live.home} - ${fixture.live.away}`
            : null,
        // The status the server settled, never the clock. A fixture is played
        // because the server said so, which is right every time a match is
        // delayed or abandoned and a clock comparison is wrong.
        played: fixture.status === 'played',
        accessibleSummary: summarise(fixture, kickoff, mixed),
      }
    })
  }

  const days: FixtureListDay[] = [...byDay.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, bucket]) => ({ key, label: bucket.label, rows: rowsOf(bucket.fixtures) }))

  if (undated.length > 0) {
    days.push({ key: 'undated', label: 'Date to be confirmed', rows: rowsOf(undated) })
  }

  const total = page.fixtures.length
  const withResults = page.fixtures.filter((fixture) => fixture.result !== null).length

  return {
    days,
    empty: total === 0,
    // Said plainly, because a fixture list with every score blank looks broken
    // and is not. Absent once every result is in, when there is nothing to
    // explain.
    resultsNote:
      total === 0 || withResults === total
        ? null
        : withResults === 0
          ? 'No results here yet. A score appears once the result is confirmed — a provisional score never decides anything.'
          : `${withResults} of ${total} results are in. The rest appear once confirmed.`,
    hasRescheduled,
  }
}
