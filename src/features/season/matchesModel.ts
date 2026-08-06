import type {
  SeasonFixture,
  SeasonMatchweekFixtures,
} from '../../services/supabase/seasonFixtures'

/**
 * Presentation model for a competition's Matches section (§7.3:
 * "Fixtures/results/table or groups/bracket/stats").
 *
 * THIS IS A COMPETITION SURFACE, NOT A GAME SURFACE, and that is the whole
 * reason it can exist. ADR 0011 separates the competition — which supplies the
 * real football — from each game played on top of it. Fixtures belong to the
 * competition, so they are readable by anyone following it, joined or not, and
 * this model never asks whether the caller has an entry. It shows no
 * prediction, no lock and no points; those are the game's and are stated by the
 * game's own surface.
 *
 * FIXTURES ARE GROUPED BY DAY IN THE COMPETITION'S OWN TIMEZONE, not the
 * viewer's and not UTC. A Saturday 15:00 kickoff is a Saturday fixture to
 * everyone who follows that league, and a viewer in Auckland reading it as
 * Sunday would be reading a different matchday to the one the league plays.
 * `tournaments.display_timezone` is NOT NULL and validated against
 * `pg_timezone_names` precisely so this question has one answer — the same
 * decision contract 122 made for the month a matchweek belongs to.
 *
 * THE CLOCK IS NOT CONSULTED. A fixture is finished because the server said
 * `played`, never because its kickoff has passed. Inferring otherwise would
 * put a second result authority in the browser, and it would be wrong every
 * time a match is delayed, abandoned or simply not yet entered.
 *
 * TIMES ARE FORMATTED HERE RATHER THAN IN THE VIEW, which is the opposite of
 * this repository's usual split, and deliberately: the ordinary rule sends ISO
 * instants to the view so it can format in the VIEWER's locale, but these must
 * be formatted in the COMPETITION's zone, which is data rather than an ambient
 * fact. Keeping the zone out of the view is what stops it being quietly
 * defaulted away. The model stays pure — it takes the zone as an input and
 * reads no clock.
 */

export type MatchRow = {
  id: string
  homeName: string
  awayName: string
  /** "15:00" in the competition's zone, or null when no kickoff is scheduled. */
  kickoff: string | null
  /** "2 - 1" when the server has a result, otherwise null. */
  score: string | null
  played: boolean
  /** Screen-reader sentence; the row itself is a scoreline. */
  accessibleSummary: string
}

export type MatchDay = {
  /** Stable key for the day, `YYYY-MM-DD` in the competition's zone. */
  key: string
  /** "Saturday 8 August", in the competition's zone. */
  label: string
  matches: readonly MatchRow[]
}

export type MatchesView = {
  matchweek: number
  matchweekCount: number
  days: readonly MatchDay[]
  /** True when the matchweek has no fixtures at all. */
  empty: boolean
  /** Null when every fixture has a result; a sentence when none or some do. */
  resultsNote: string | null
  hasPrevious: boolean
  hasNext: boolean
}

function parts(
  instant: string,
  timeZone: string,
): { key: string; label: string; time: string } | null {
  const at = new Date(instant)
  if (Number.isNaN(at.getTime())) return null

  // `en-CA` yields `YYYY-MM-DD`, which sorts and keys correctly. It is used for
  // the KEY only; the label below is formatted for reading.
  const key = at.toLocaleDateString('en-CA', { timeZone })
  const label = at.toLocaleDateString(undefined, {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  // The ZONE is the competition's; the 12-or-24-hour FORMAT is the viewer's,
  // which is a genuine reading preference rather than a fact about the fixture.
  // `hour: 'numeric'` so a 12-hour locale reads "3:00 PM" rather than the
  // zero-padded "03:00 PM" that `'2-digit'` forces.
  const time = at.toLocaleTimeString(undefined, {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  })

  return { key, label, time }
}

function summarise(fixture: SeasonFixture, kickoff: string | null): string {
  if (fixture.homeScore !== null && fixture.awayScore !== null) {
    return `${fixture.homeName} ${fixture.homeScore}, ${fixture.awayName} ${fixture.awayScore}`
  }
  return kickoff
    ? `${fixture.homeName} against ${fixture.awayName}, kick-off ${kickoff}`
    : `${fixture.homeName} against ${fixture.awayName}, kick-off to be confirmed`
}

export function presentMatches(
  page: SeasonMatchweekFixtures,
  timeZone: string,
): MatchesView {
  const byDay = new Map<string, { label: string; matches: MatchRow[] }>()
  // Fixtures with no kickoff cannot be placed on a day. They are not dropped —
  // a scheduled fixture the league has not timed yet is still a fixture — so
  // they collect under their own heading at the end.
  const undated: MatchRow[] = []

  for (const fixture of page.fixtures) {
    const when = fixture.kickoffAt ? parts(fixture.kickoffAt, timeZone) : null
    const kickoff = when?.time ?? null
    const played = fixture.homeScore !== null && fixture.awayScore !== null

    const row: MatchRow = {
      id: fixture.id,
      homeName: fixture.homeName,
      awayName: fixture.awayName,
      kickoff,
      score: played ? `${fixture.homeScore} - ${fixture.awayScore}` : null,
      played,
      accessibleSummary: summarise(fixture, kickoff),
    }

    if (!when) {
      undated.push(row)
      continue
    }

    const day = byDay.get(when.key) ?? { label: when.label, matches: [] }
    day.matches.push(row)
    byDay.set(when.key, day)
  }

  const days: MatchDay[] = [...byDay.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, day]) => ({ key, label: day.label, matches: day.matches }))

  if (undated.length > 0) {
    days.push({ key: 'undated', label: 'Date to be confirmed', matches: undated })
  }

  const total = page.fixtures.length
  const withResults = page.fixtures.filter(
    (fixture) => fixture.homeScore !== null && fixture.awayScore !== null,
  ).length

  return {
    matchweek: page.matchweek,
    matchweekCount: page.matchweekCount,
    days,
    empty: total === 0,
    // Said plainly, because a fixture list with every score blank looks broken
    // and is not. Absent once every result is in, when there is nothing to
    // explain.
    resultsNote:
      total === 0 || withResults === total
        ? null
        : withResults === 0
          ? 'No results yet for this matchweek. A score appears once the result is confirmed — provisional scores never decide anything here.'
          : `${withResults} of ${total} results are in. The rest appear once confirmed.`,
    hasPrevious: page.matchweek > 1,
    hasNext: page.matchweek < page.matchweekCount,
  }
}

/** Everything the page may ask of the world. Injected, so the page stays pure. */
export type SeasonMatchesGateway = {
  load(matchweek: number): Promise<SeasonMatchweekFixtures>
}
