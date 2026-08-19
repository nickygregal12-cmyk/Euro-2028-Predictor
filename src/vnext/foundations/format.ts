/**
 * Presentation formatting for vNext.
 *
 * DETERMINISM. Nothing here reads the clock. Every function that needs "now"
 * takes it as an argument.
 *
 * AND NOTHING HERE READS A ZONE EITHER. Every function that prints a time takes
 * one — a `VNextPresentationZone`, defaulting to the workshop's pin so a story
 * renders the same board on a laptop and in CI. Production callers pass the
 * reader's own zone, which they get from `useVNextPresentationZone()` inside
 * `VNextViewerZoneProvider`. `foundations/presentationZone.tsx` holds why the
 * default is the pinned one and what stops that default reaching production.
 *
 * The product-wide rule is `src/shared/time/kickoff.ts` — the viewer's own
 * device zone — and this module is how a vNext presentation component obeys it
 * without importing a second formatter vocabulary into every card.
 */

import {
  WORKSHOP_PRESENTATION_ZONE,
  type VNextPresentationZone,
} from './presentationZone'

const WORKSHOP_LOCALE = 'en-GB'

const numberFormatter = new Intl.NumberFormat(WORKSHOP_LOCALE)

/**
 * `Intl.DateTimeFormat` construction is the expensive half of formatting and a
 * fixture list formats once per row, so the four shapes are cached per zone.
 * The key is the zone pair; the map is bounded by how many zones one render
 * tree uses, which is one.
 */
type ZoneFormatters = {
  readonly time: Intl.DateTimeFormat
  readonly weekday: Intl.DateTimeFormat
  readonly dayKey: Intl.DateTimeFormat
  readonly dayHeading: Intl.DateTimeFormat
}

const formatterCache = new Map<string, ZoneFormatters>()

function formatters(zone: VNextPresentationZone): ZoneFormatters {
  const key = `${zone.locale ?? ''}|${zone.timeZone}`
  const cached = formatterCache.get(key)
  if (cached) return cached
  const built: ZoneFormatters = {
    // TWENTY-FOUR HOUR, EVERYWHERE, which is `kickoff.ts`'s rule and its
    // reasoning: a fixture list is a column of times a reader compares, and
    // "05:45 PM" among them is noise per row. The zone is the reader's; the
    // clock face is the product's.
    time: new Intl.DateTimeFormat(zone.locale, {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: zone.timeZone,
    }),
    weekday: new Intl.DateTimeFormat(zone.locale, {
      weekday: 'short',
      timeZone: zone.timeZone,
    }),
    // `en-CA` yields `YYYY-MM-DD` reliably. It is a KEY and never shown, so it
    // does not follow the reader's locale — only their zone, which it must.
    dayKey: new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: zone.timeZone,
    }),
    dayHeading: new Intl.DateTimeFormat(zone.locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      timeZone: zone.timeZone,
    }),
  }
  formatterCache.set(key, built)
  return built
}

/** "17:30" */
export function formatTime(
  iso: string,
  zone: VNextPresentationZone = WORKSHOP_PRESENTATION_ZONE,
): string {
  return formatters(zone).time.format(new Date(iso))
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
export function formatKickoffLabel(
  kickoff: string,
  now: string,
  zone: VNextPresentationZone = WORKSHOP_PRESENTATION_ZONE,
): string {
  const dayOffset = calendarDayOffset(kickoff, now, zone)
  const time = formatTime(kickoff, zone)
  if (dayOffset === 0) return `Today ${time}`
  if (dayOffset === 1) return `Tomorrow ${time}`
  if (dayOffset === -1) return `Yesterday ${time}`
  return `${formatters(zone).weekday.format(new Date(kickoff))} ${time}`
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
 * It resolves in the SAME zone as `formatTime` and `formatKickoffLabel` — the one
 * the caller was rendered inside — so a day heading and the kickoff times under
 * it can never disagree about which day a 22:45 kickoff belongs to. That is the
 * property `src/shared/time/kickoff.ts` names in terms: the day and the time
 * move together, always.
 */
export function formatDayKey(
  iso: string,
  zone: VNextPresentationZone = WORKSHOP_PRESENTATION_ZONE,
): string {
  return formatters(zone).dayKey.format(new Date(iso))
}

/** "Sat 21 August" — the heading a day's fixtures sit under. */
export function formatDayHeading(
  iso: string,
  zone: VNextPresentationZone = WORKSHOP_PRESENTATION_ZONE,
): string {
  return formatters(zone).dayHeading.format(new Date(iso))
}

/** How many calendar days apart two instants are, in the reader's zone. */
function calendarDayOffset(
  target: string,
  now: string,
  zone: VNextPresentationZone,
): number {
  const { dayKey } = formatters(zone)
  const targetDay = Date.parse(`${dayKey.format(new Date(target))}T00:00:00Z`)
  const nowDay = Date.parse(`${dayKey.format(new Date(now))}T00:00:00Z`)
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
