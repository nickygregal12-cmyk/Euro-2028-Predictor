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
