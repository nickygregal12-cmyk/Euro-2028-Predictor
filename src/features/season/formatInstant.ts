/**
 * One place a season surface turns an ISO instant into something a player
 * reads.
 *
 * THE MODELS DELIBERATELY DO NOT DO THIS. They hand over ISO strings so they
 * stay pure and their tests stay locale-independent; formatting belongs to the
 * view, in the viewer's own locale, as the Matches surface already does.
 *
 * IT RETURNS NULL RATHER THAN A PLACEHOLDER for an absent or unreadable
 * instant. A deadline is a promise about when something stops being possible,
 * and "Invalid Date" or an em dash in that sentence is worse than the sentence
 * not appearing at all — the caller drops the line instead.
 */
export function formatInstant(instant: string | null): string | null {
  if (!instant) return null
  const at = new Date(instant)
  if (Number.isNaN(at.getTime())) return null
  return at.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * A `YYYY-MM` calendar month as a player reads it: "January 2027".
 *
 * IT IS NOT AN INSTANT AND MUST NOT BE PARSED AS ONE. Contract 122 already
 * resolved the month in the competition's own timezone, precisely so a 20:00
 * UTC kickoff on 31 January is January in London rather than February
 * somewhere else. Handing `2027-01` to `new Date()` would parse it as midnight
 * UTC and `toLocaleString` would then shift it back across the boundary in any
 * negative-offset locale — undoing the one decision the contract made. So the
 * month and year are read as the numbers they are, and only the month NAME is
 * localised.
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
