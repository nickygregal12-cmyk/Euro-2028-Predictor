import type {
  SeasonFixtureList,
  SeasonListFixture,
} from '../../services/supabase/seasonFixtureListModel'
import type { ClubIdentityTokens } from '../../domain/clubIdentity/clubIdentityTypes'
import { formatKickoffTime, formatMatchDay, matchDayKey } from '../../shared/time/kickoff'
import { postponedScheduleNote } from '../../shared/fixtures/scheduleNote'

/**
 * A deterministic zone override. Production omits it and the shared authority
 * resolves the viewer's own, which is the rule; the dev harnesses and the tests
 * pin one so a screenshot and an assertion do not depend on the machine.
 */
type Zone = string | undefined

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
 * DAYS AND TIMES ARE THE VIEWER'S, not the competition's. This surface shipped
 * resolving both in the competition's persisted zone; the owner's 10 August
 * 2026 UI direction reverses that, and `src/shared/time/kickoff.ts` holds the
 * reasoning and the formatting. The zone parameter survives only as a
 * deterministic override for harnesses and tests.
 *
 * PURE. No clock is read, and the server's order is preserved rather than
 * re-derived.
 */

export type FixtureListClub = {
  name: string
  tokens: ClubIdentityTokens
}

export type FixtureListRow = {
  id: string
  home: FixtureListClub
  away: FixtureListClub
  /** "15:00" in the VIEWER's zone, or null when no kickoff is scheduled. */
  kickoff: string | null
  /**
   * The kickoff as the server sent it.
   *
   * CARRIED BESIDE THE FORMATTED TIME, not instead of it. A surface that
   * compares fixtures across days — "which of these finished since Tuesday",
   * "which is next" — cannot do it with "15:00", and re-parsing a localised
   * string would be a second, worse formatter. It is an ordering fact and never
   * a lock: whether a match has been played is still the server's `played`.
   */
  kickoffAt: string | null
  /** "Matchweek 5", printed only when the day carries more than one. */
  roundLabel: string | null
  /**
   * The round itself, always. `roundLabel` answers "should this row print its
   * matchweek"; this answers "which matchweek is it", which a surface reading
   * the player's card for this fixture needs whether or not the day mixes them.
   */
  round: { ordinal: number; name: string }
  /**
   * THE WORD FOR A FIXTURE THAT IS NOT GOING AHEAD AS PRINTED (contract 207).
   *
   * "Postponed", "Abandoned" or "Void", and null on every ordinary fixture.
   * It is the platform's own `season_fixtures.status`, never a provider's
   * opinion and never a comparison of a kickoff against a clock.
   */
  abnormal: string | null
  /**
   * A note qualifying the slot: "New date to be confirmed" while a
   * postponement has no replacement, "Rescheduled" once a moved fixture is
   * going ahead. Null where the date needs no qualification.
   */
  scheduleNote: string | null
  /** "2 - 1" once the platform has settled it. */
  score: string | null
  /** A provider's current score, when there is no official one. Never a result. */
  provisional: string | null
  /** When the provider last reported that provisional score, in the viewer's
   *  zone. Null when there is none to report. */
  provisionalAt: string | null
  played: boolean
  accessibleSummary: string
}

export type FixtureListDay = {
  /** `YYYY-MM-DD` in the viewer's zone. Sorts and keys correctly. */
  key: string
  /** "Saturday 8 August", in the viewer's zone. */
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
  timeZone: Zone,
): { key: string; label: string; time: string } | null {
  const key = matchDayKey(instant, timeZone)
  const label = formatMatchDay(instant, timeZone)
  const time = formatKickoffTime(instant, timeZone)
  if (key === null || label === null || time === null) return null
  return { key, label, time }
}

function summarise(fixture: SeasonListFixture, kickoff: string | null, mixed: boolean): string {
  const who = `${fixture.home.name} against ${fixture.away.name}`
  const round = mixed ? `, ${fixture.round.label}` : ''

  if (fixture.result) {
    return `${fixture.home.name} ${fixture.result.home}, ${fixture.away.name} ${fixture.result.away}${round}`
  }

  // CONTRACT 207. Said BEFORE the kickoff and instead of it where there is
  // nothing valid to say: a sentence that ends "kick-off 15:00" about a match
  // that is off is worse than one that does not mention a time at all.
  const abnormal = abnormalWord(fixture.status)
  if (abnormal !== null) {
    const note = scheduleNoteOf(fixture)
    const when = note === null ? '' : `, ${note.toLowerCase()}`
    return `${who}, ${abnormal.toLowerCase()}${when}${round}`
  }

  const moved = fixture.schedule.rescheduled ? ', rescheduled' : ''
  return kickoff
    ? `${who}${moved}, kick-off ${kickoff}${round}`
    : `${who}${moved}, kick-off to be confirmed${round}`
}

/**
 * The platform's own vocabulary, and only the three values that mean a fixture
 * is not going ahead as printed. `scheduled` and `played` produce no word:
 * a time and a score already say what they are.
 */
function abnormalWord(status: string): string | null {
  switch (status) {
    case 'postponed':
      return 'Postponed'
    case 'abandoned':
      return 'Abandoned'
    case 'void':
      return 'Void'
    default:
      return null
  }
}

/**
 * The same sentence the vNext lane draws, from the same helper, so one fixture
 * cannot be described two ways on two generations of the same product.
 */
function scheduleNoteOf(fixture: SeasonListFixture): string | null {
  if (fixture.status === 'postponed') {
    return postponedScheduleNote(fixture.kickoffAt, fixture.schedule.rescheduled)
  }
  return fixture.schedule.rescheduled ? 'Rescheduled' : null
}

/**
 * One fixture, presented on its own (contract 148).
 *
 * IT SHARES THE LIST'S VOCABULARY EXACTLY, by construction: it returns a
 * `FixtureListRow` built by the same `rowOf` the list uses, so a fixture reached
 * from a link and the same fixture reached from the calendar cannot describe
 * themselves differently. That is the whole reason contract 148 returns
 * contract 139's entry field for field.
 *
 * ITS MATCHWEEK IS ALWAYS PRINTED. In a list the label appears only when a day
 * mixes matchweeks, because repeating it on every row of an ordinary Saturday
 * is noise. A standalone Match Centre has no day heading and no neighbours to
 * compare against, so the matchweek is context the reader has nowhere else to
 * get.
 */
export function presentFixture(
  fixture: SeasonListFixture,
  timeZone?: Zone,
): { row: FixtureListRow; dayLabel: string | null } {
  const when = fixture.kickoffAt ? parts(fixture.kickoffAt, timeZone) : null
  return {
    row: rowOf(fixture, true, timeZone),
    dayLabel: when?.label ?? null,
  }
}

/**
 * One row. Shared by the list and by the single-fixture presentation above so
 * there is one set of rules about provisional scores, played state and the
 * accessible summary rather than two.
 */
function rowOf(fixture: SeasonListFixture, mixed: boolean, timeZone: Zone): FixtureListRow {
  const when = fixture.kickoffAt ? parts(fixture.kickoffAt, timeZone) : null
  // CONTRACT 207. A postponement with no replacement date has an instant on the
  // row — where it WAS due — and printing it in the slot a reader scans for a
  // kick-off is the defect this contract exists to remove. `kickoffAt` is
  // untouched beside it, because it is still the ordering fact every day
  // heading and preview is built from.
  const kickoff =
    fixture.status === 'postponed' && !fixture.schedule.rescheduled
      ? null
      : (when?.time ?? null)
  const provisional =
    !fixture.result && fixture.live && fixture.live.home !== null && fixture.live.away !== null
      ? `${fixture.live.home} - ${fixture.live.away}`
      : null

  return {
    id: fixture.id,
    home: fixture.home,
    away: fixture.away,
    kickoff,
    kickoffAt: fixture.kickoffAt,
    roundLabel: mixed ? fixture.round.label : null,
    round: { ordinal: fixture.round.ordinal, name: fixture.round.label },
    abnormal: abnormalWord(fixture.status),
    scheduleNote: scheduleNoteOf(fixture),
    score: fixture.result ? `${fixture.result.home} - ${fixture.result.away}` : null,
    // Only where there is no official score, and only when the provider
    // sent both numbers. A one-sided provisional score is not a scoreline.
    provisional,
    // Said with the score wherever the score is shown at length: "what a
    // provider reported at 16:42" is checkable, and "2 - 1" on its own
    // invites being read as the result.
    provisionalAt:
      provisional && fixture.live
        ? (parts(fixture.live.observedAt, timeZone)?.time ?? null)
        : null,
    // The status the server settled, never the clock. A fixture is played
    // because the server said so, which is right every time a match is
    // delayed or abandoned and a clock comparison is wrong.
    played: fixture.status === 'played',
    accessibleSummary: summarise(fixture, kickoff, mixed),
  }
}

export function presentFixtureList(
  page: SeasonFixtureList,
  timeZone?: Zone,
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
    return fixtures.map((fixture) => rowOf(fixture, mixed, timeZone))
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
