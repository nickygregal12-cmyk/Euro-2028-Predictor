/**
 * Presentation formatting for vNext.
 *
 * DETERMINISM. Nothing here reads the clock. Every function that needs "now"
 * takes it as an argument, and every formatter pins its locale and time zone.
 * Left to the environment, a story would render 15:30 on a laptop and 10:30 in
 * CI, and a screenshot comparison would be worthless.
 *
 * The pinned zone is a workshop decision, not a product one — real integration
 * will use the user's zone, and that is listed as unresolved in the workshop
 * note rather than settled here.
 */

const WORKSHOP_LOCALE = 'en-GB'
const WORKSHOP_TIME_ZONE = 'Europe/London'

const timeFormatter = new Intl.DateTimeFormat(WORKSHOP_LOCALE, {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: WORKSHOP_TIME_ZONE,
})

const weekdayFormatter = new Intl.DateTimeFormat(WORKSHOP_LOCALE, {
  weekday: 'short',
  timeZone: WORKSHOP_TIME_ZONE,
})

const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: WORKSHOP_TIME_ZONE,
})

const numberFormatter = new Intl.NumberFormat(WORKSHOP_LOCALE)

/** "Sat 21 August" — the heading over a day's fixtures. */
const dayHeadingFormatter = new Intl.DateTimeFormat(WORKSHOP_LOCALE, {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
  timeZone: WORKSHOP_TIME_ZONE,
})

/** "17:30" */
export function formatTime(iso: string): string {
  return timeFormatter.format(new Date(iso))
}

/** "1,428" — ranks and totals that get large enough to need grouping. */
export function formatNumber(value: number): string {
  return numberFormatter.format(value)
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
  return `${weekdayFormatter.format(new Date(kickoff))} ${time}`
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
  return dayKeyFormatter.format(new Date(iso))
}

/** "Sat 21 August" — the heading a day's fixtures sit under. */
export function formatDayHeading(iso: string): string {
  return dayHeadingFormatter.format(new Date(iso))
}

/** How many calendar days apart two instants are, in the workshop's zone. */
function calendarDayOffset(target: string, now: string): number {
  const targetDay = Date.parse(`${dayKeyFormatter.format(new Date(target))}T00:00:00Z`)
  const nowDay = Date.parse(`${dayKeyFormatter.format(new Date(now))}T00:00:00Z`)
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
