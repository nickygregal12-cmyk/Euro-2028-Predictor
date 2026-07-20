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

/** Today's local date as `yyyy-mm-dd`, to compare against a match's date. */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Weekday + day + month, e.g. "Tue 14 Jun" — for the Today card's next-matchday label. */
export function formatWeekdayDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}
