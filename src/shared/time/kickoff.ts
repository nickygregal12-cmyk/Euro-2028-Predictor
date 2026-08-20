/**
 * The one place a kickoff, a deadline or a match day becomes something a player
 * reads.
 *
 * THE VIEWER'S OWN ZONE IS THE AUTHORITY, and that is a reversal recorded
 * rather than a drift. The Matches section shipped resolving days and times in
 * the COMPETITION's persisted zone, on the reasoning that "a Saturday 15:00
 * kickoff is Saturday to everyone who follows that league". The owner's UI
 * finalisation direction of 10 August 2026 decides the other way and says so
 * without qualification: kickoffs display in the viewer's local browser/device
 * timezone, no location permission, a UK viewer sees 17:45 for a 16:45 UTC
 * kickoff and a viewer elsewhere sees their own equivalent. Both rules are
 * defensible; having two of them in one product is not, which is why this
 * module exists and why the competition zone is no longer threaded into
 * presentation.
 *
 * THE DAY AND THE TIME MOVE TOGETHER. Grouping by the competition's day while
 * printing the viewer's time is the worst of the two: an Auckland reader would
 * see "Saturday 22 August" with "04:45" under it, which is neither true. So a
 * fixture's day heading and its time are resolved in the same zone, always.
 *
 * NO RAW TIMESTAMP REACHES A PLAYER. Every function here returns `null` for an
 * absent or unparseable instant rather than "Invalid Date" or an ISO string,
 * and callers drop the line. A deadline is a promise about when something stops
 * being possible; a broken one is worse than a missing one.
 *
 * IT IS NEVER A LOCK AUTHORITY. The server decides what is open, what is
 * locked, what has been played and what has settled. Everything here is
 * presentation, and no caller may compare one of these strings, or the clock
 * behind them, against a rule.
 */

/** The zone the viewer's device is in, or UTC when the platform will not say. */
export function viewerTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

function instant(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const at = new Date(iso)
  return Number.isNaN(at.getTime()) ? null : at
}

/**
 * `zone` is an optional input so models stay pure and their tests stay
 * deterministic. Production callers omit it and get the viewer's own zone —
 * which is the rule, not a default worth overriding for convenience.
 */
type Zone = string | undefined

function zoneOf(zone: Zone): string {
  return zone ?? viewerTimeZone()
}

/**
 * A kickoff on its own: "17:45".
 *
 * This is what a fixture row prints when the day is already a heading above it,
 * which is the ordinary case and the one the direction singles out.
 *
 * TWENTY-FOUR HOUR, EVERYWHERE. The zone is the viewer's; the clock face is the
 * product's. Football schedules are published on a 24-hour clock, the
 * direction's worked examples are all 24-hour, and a fixture list is a column
 * of times a reader scans and compares — "05:45 PM" among them is two
 * characters of noise per row and sorts badly to the eye. The DAY wording below
 * still follows the viewer's locale, because month order genuinely is a reading
 * preference; a football kickoff time is closer to a fact about the fixture.
 */
export function formatKickoffTime(iso: string | null | undefined, zone?: Zone): string | null {
  const at = instant(iso)
  if (!at) return null
  return at.toLocaleTimeString(undefined, {
    timeZone: zoneOf(zone),
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
}

/** A day heading over a group of fixtures: "Saturday 22 August". */
export function formatMatchDay(iso: string | null | undefined, zone?: Zone): string | null {
  const at = instant(iso)
  if (!at) return null
  return at.toLocaleDateString(undefined, {
    timeZone: zoneOf(zone),
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/**
 * A day and time where no heading carries the date: "Sat 22 Aug · 17:45".
 *
 * The short day, because this form appears inside rows, cards and sentences
 * where a full weekday name would dominate the line it sits on.
 */
export function formatKickoffWithDay(
  iso: string | null | undefined,
  zone?: Zone,
): string | null {
  const at = instant(iso)
  if (!at) return null
  const day = at.toLocaleDateString(undefined, {
    timeZone: zoneOf(zone),
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  const time = formatKickoffTime(iso, zone)
  return time ? `${day} · ${time}` : day
}

/**
 * The long form a standalone Match Centre hero uses, where the fixture is the
 * whole page and nothing above it carries the date: "Saturday 22 August ·
 * 17:45".
 */
export function formatKickoffLong(iso: string | null | undefined, zone?: Zone): string | null {
  const day = formatMatchDay(iso, zone)
  if (!day) return null
  const time = formatKickoffTime(iso, zone)
  return time ? `${day} · ${time}` : day
}

/**
 * `YYYY-MM-DD` for the day an instant falls on, for grouping and sorting.
 *
 * `en-CA` yields that shape reliably; it is a KEY and never shown. It is
 * resolved in the same zone as the label above it, so a list cannot group by
 * one day and print another.
 */
export function matchDayKey(iso: string | null | undefined, zone?: Zone): string | null {
  const at = instant(iso)
  if (!at) return null
  return at.toLocaleDateString('en-CA', { timeZone: zoneOf(zone) })
}

/**
 * A weekday on its own, abbreviated: "Sat".
 *
 * Added for the vNext surfaces, which print a bare weekday beside a time in
 * rows too narrow for "Saturday". It lives HERE and not there because the
 * 10 August direction asks for one formatting helper across Matches, the Match
 * Predictor, LMS, the Championship and the Match Centre, and a sixth local
 * `Intl.DateTimeFormat` in a presentation lane is exactly the drift this module
 * was created to end — five local copies once disagreed about whose zone a
 * kickoff belongs to.
 */
export function formatWeekdayShort(iso: string | null | undefined, zone?: Zone): string | null {
  const at = instant(iso)
  if (!at) return null
  return at.toLocaleDateString(undefined, { timeZone: zoneOf(zone), weekday: 'short' })
}

/**
 * A day heading with an abbreviated weekday: "Sat 22 August".
 *
 * `formatMatchDay` spells the weekday out, which is right for a wide heading
 * over a list. vNext's day headings sit in a narrower column and abbreviate;
 * both forms are legitimate and neither is a second AUTHORITY, because the zone
 * and the day boundary are still decided in one place.
 */
export function formatMatchDayShortWeekday(
  iso: string | null | undefined,
  zone?: Zone,
): string | null {
  const at = instant(iso)
  if (!at) return null
  return at.toLocaleDateString(undefined, {
    timeZone: zoneOf(zone),
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  })
}

/**
 * A day without its weekday: "22 Aug". For range labels — "22 Aug – 5 Sep" —
 * where two weekday names would crowd out the two dates that carry the meaning.
 */
export function formatDayShort(iso: string | null | undefined, zone?: Zone): string | null {
  const at = instant(iso)
  if (!at) return null
  return at.toLocaleDateString(undefined, {
    timeZone: zoneOf(zone),
    day: 'numeric',
    month: 'short',
  })
}

/**
 * A calendar date in a sentence: "9 June 2028".
 *
 * The year is included because this form is used for a date far enough from
 * today that a reader cannot infer it — a tournament's published deadline, a
 * season's start — where "9 June" alone is ambiguous.
 */
export function formatCalendarDate(iso: string | null | undefined, zone?: Zone): string | null {
  const at = instant(iso)
  if (!at) return null
  return at.toLocaleDateString(undefined, {
    timeZone: zoneOf(zone),
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * A deadline as a sentence fragment: "Sat 22 Aug · 14:30".
 *
 * Deadlines and kickoffs deliberately share one form. A player reading "locks
 * Sat 22 Aug · 14:30" above "17:45" is comparing two times, and two different
 * formats would make that comparison work.
 */
export function formatDeadline(iso: string | null | undefined, zone?: Zone): string | null {
  return formatKickoffWithDay(iso, zone)
}

/**
 * A `YYYY-MM` calendar month as a player reads it: "January 2027".
 *
 * IT IS NOT AN INSTANT AND MUST NOT BE PARSED AS ONE. Contract 122 resolves a
 * matchweek's month in the competition's own timezone — a decision about which
 * month a round BELONGS to, which is not the same question as what time a
 * fixture kicks off for the person reading, and is untouched by the viewer-zone
 * rule above. Handing `2027-01` to `new Date()` would parse it as midnight UTC
 * and shift it back across the boundary in any negative-offset locale, undoing
 * that. So the month and year are read as the numbers they are, and only the
 * month NAME is localised.
 */
export function formatMonth(month: string | null): string | null {
  if (!month) return null
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month)
  if (!match) return null
  const year = Number(match[1])
  const index = Number(match[2]) - 1
  // Day 1 at midday, in the viewer's local time, so no offset can move it into
  // an adjacent month while the formatter reads the month name off it.
  const name = new Date(year, index, 1, 12).toLocaleString(undefined, { month: 'long' })
  return `${name} ${year}`
}
