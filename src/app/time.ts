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

export function formatLongDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
