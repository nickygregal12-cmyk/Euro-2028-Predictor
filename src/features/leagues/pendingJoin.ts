// A pending league join survives the logged-out case: tapping an invite link
// while signed out stashes the code, sends the visitor through sign-up, then the
// auth route gate returns them to /join/CODE (design-system §6 — "deep links
// survive the logged-out case"). localStorage so it also survives the redirect
// to the hosted auth screens and a full reload.

const KEY = 'euro28.pendingJoinCode'

export function setPendingJoin(code: string): void {
  try {
    localStorage.setItem(KEY, code)
  } catch {
    // storage unavailable (private mode) — the join just won't resume; harmless
  }
}

export function getPendingJoin(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function clearPendingJoin(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
