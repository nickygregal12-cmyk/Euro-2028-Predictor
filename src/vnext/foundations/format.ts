import {
  formatKickoffTime,
  formatMatchDayShortWeekday,
  formatWeekdayShort,
  matchDayKey,
} from '../../shared/time/kickoff'

/**
 * Presentation formatting for vNext.
 *
 * DETERMINISM BY DEFAULT. Nothing here reads the clock. Every function that
 * needs "now" takes it as an argument, and every formatter resolves its locale
 * and time zone from ONE place, which by default is the workshop pin. Left to
 * the environment, a story would render 15:30 on a laptop and 10:30 in CI, and
 * a screenshot comparison would be worthless.
 *
 * ============================ AND THEN STAGE 14 ARRIVED ==================
 *
 * The pin used to be unconditional, and this file's own docblock flagged the
 * consequence: *"the pinned zone is a workshop decision, not a product one —
 * real integration will use the user's zone."* Stage 14 is real integration,
 * and the debt came due the moment a vNext surface joined the shipping graph:
 * `tests/app/kickoffFormattingAuthority.test.ts` failed, because the product
 * suddenly had two authorities for formatting an instant and the newer one
 * told a player in Dublin, New York or Sydney what time the match kicks off
 * IN LONDON. On Matches, which is almost entirely kickoff times.
 *
 * ============================ WHY A SETTING AND NOT A PARAMETER ==========
 *
 * The obvious fix — thread a zone through every formatter — is 42 call sites
 * across 13 files, every one of them an ALREADY ACCEPTED surface. Stage 14
 * does not own redesigning those, and a parameter added to `formatTime` in
 * thirteen files is a large diff that makes each of them slightly worse to
 * read for a fact none of them decides.
 *
 * So the zone is resolved ONCE, at the application seam, and the formatters
 * read it. `configureVNextFormatting` is the only mutation and the only place
 * that knows a viewer exists.
 *
 * THE DEFAULT IS THE WORKSHOP PIN, WHICH IS THE PROPERTY THAT MATTERS. A
 * story, a jsdom test and a Storybook screenshot never call the configurator,
 * so they get `en-GB`/`Europe/London` exactly as before and stay deterministic.
 * Only the production adapter calls it. That is why this is module state rather
 * than a React context: a context would have to be threaded through the same 13
 * files to be read, which is the diff it was meant to avoid.
 */

const WORKSHOP_TIME_ZONE = 'Europe/London'
const WORKSHOP_LOCALE = 'en-GB'

/**
 * The zone every formatter below resolves in. Defaults to the workshop pin so
 * stories and jsdom tests stay deterministic; the production seam replaces it
 * with the viewer's.
 */
let activeZone: string = WORKSHOP_TIME_ZONE

/**
 * Point vNext's formatters at a viewer. Called once, from the production seam
 * (`src/app/vnext/`). Passing nothing restores the workshop pin, which is what
 * a test that touched the setting must do afterwards.
 */
export function configureVNextTimeZone(timeZone?: string): void {
  activeZone = timeZone ?? WORKSHOP_TIME_ZONE
  numberCache = null
}

/** Numbers are not instants, so they keep the workshop locale. */
let numberCache: Intl.NumberFormat | null = null
const numberFormatter = () => (numberCache ??= new Intl.NumberFormat(WORKSHOP_LOCALE))

/**
 * `required` turns the authority's `string | null` into the `string` these
 * formatters have always returned. The authority returns `null` for an
 * unparseable instant so a caller can drop the line; these call sites are fed
 * by mappers that have already rejected a bad instant, and an empty string is
 * the honest fallback rather than "Invalid Date".
 */
function required(value: string | null): string {
  return value ?? ''
}

/** "17:30" */
export function formatTime(iso: string): string {
  return required(formatKickoffTime(iso, activeZone))
}

/** "1,428" — ranks and totals that get large enough to need grouping. */
export function formatNumber(value: number): string {
  return numberFormatter().format(value)
}

/** "+6", "0", "−3". Uses a real minus sign, which lines up in tabular figures. */
export function formatSignedPoints(value: number): string {
  if (value > 0) return `+${value}`
  if (value < 0) return `−${Math.abs(value)}`
  return '0'
}

/** "Today 17:30", "Tomorrow 12:00", "Sat 15:00". */
export function formatKickoffLabel(kickoff: string, now: string): string {
  const dayOffset = calendarDayOffset(kickoff, now)
  const time = formatTime(kickoff)
  if (dayOffset === 0) return `Today ${time}`
  if (dayOffset === 1) return `Tomorrow ${time}`
  if (dayOffset === -1) return `Yesterday ${time}`
  return `${required(formatWeekdayShort(kickoff, activeZone))} ${time}`
}

/**
 * "38 min", "2 hr 15 min", "3 days". Null once the instant has passed, because
 * a countdown that has run out is a different state and should be labelled by
 * the caller rather than shown as "0 min".
 */
export function formatCountdown(target: string, now: string): string | null {
  const millis = new Date(target).getTime() - new Date(now).getTime()
  if (!Number.isFinite(millis) || millis <= 0) return null

  const totalMinutes = Math.floor(millis / 60_000)
  if (totalMinutes < 60) return `${totalMinutes} min`

  const hours = Math.floor(totalMinutes / 60)
  if (hours < 24) {
    const minutes = totalMinutes % 60
    return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`
  }

  const days = Math.floor(hours / 24)
  return days === 1 ? '1 day' : `${days} days`
}

/**
 * "2027-08-21" — a stable key for the calendar day an instant falls on.
 *
 * FOR GROUPING, AND FOR NOTHING ELSE. Splitting a matchweek's fixtures into the
 * days they are played on is layout: it is the football information architecture
 * a fixture list has always had, and it is what stops a card of ten reading as
 * ten identical rows. It decides no lock, no state and no permission.
 *
 * It uses the SAME pinned zone as `formatTime` and `formatKickoffLabel`, so a day
 * heading and the kickoff times under it can never disagree about which day a
 * 22:45 kickoff belongs to. The zone is a workshop decision and the product-wide
 * time-zone policy is still open, which is recorded in the workshop note.
 */
export function formatDayKey(iso: string): string {
  return required(matchDayKey(iso, activeZone))
}

/** "Sat 21 August" — the heading a day's fixtures sit under. */
export function formatDayHeading(iso: string): string {
  return required(formatMatchDayShortWeekday(iso, activeZone))
}

/** How many calendar days apart two instants are, in the workshop's zone. */
function calendarDayOffset(target: string, now: string): number {
  const targetDay = Date.parse(`${required(matchDayKey(target, activeZone))}T00:00:00Z`)
  const nowDay = Date.parse(`${required(matchDayKey(now, activeZone))}T00:00:00Z`)
  return Math.round((targetDay - nowDay) / 86_400_000)
}

/** "1st", "2nd", "1,428th". */
export function formatOrdinal(value: number): string {
  const formatted = formatNumber(value)
  const lastTwo = Math.abs(value) % 100
  if (lastTwo >= 11 && lastTwo <= 13) return `${formatted}th`
  switch (Math.abs(value) % 10) {
    case 1:
      return `${formatted}st`
    case 2:
      return `${formatted}nd`
    case 3:
      return `${formatted}rd`
    default:
      return `${formatted}th`
  }
}

/** "72%" from a 0–1 share. */
export function formatShare(share: number): string {
  return `${Math.round(share * 100)}%`
}

/** "2–1", with an en dash rather than a hyphen. */
export function formatScoreline(home: number, away: number): string {
  return `${home}–${away}`
}
