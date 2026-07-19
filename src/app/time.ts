// Small date helpers for cosmetic countdowns. The server remains the authority
// on the actual lock (CLAUDE.md architecture rule 4) — these are display only.

/** Whole days from now until an ISO date (date-only), rounded up. */
export function daysUntil(isoDate: string): number {
  const target = new Date(`${isoDate}T00:00:00`).getTime()
  return Math.ceil((target - Date.now()) / 86_400_000)
}

export function formatShortDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  })
}

/**
 * Cosmetic countdown to a match's date, for locked match cards. Whole days when
 * more than a day out, else "today"; a past date reads "underway". Display only
 * — the server is the authority on locks.
 */
export function countdownToDate(isoDate: string): string {
  const days = daysUntil(isoDate)
  if (days > 1) return `${days} days`
  if (days === 1) return 'tomorrow'
  if (days === 0) return 'today'
  return 'underway'
}

export function formatLongDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
