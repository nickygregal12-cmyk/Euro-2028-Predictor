// Invite-link + share helpers for leagues. Browser-API glue (clipboard, native
// share sheet) — no domain logic. The invite link wraps the code, so links and
// codes are one system (design-system §6 join flow).

/** The shareable deep link for an invite code, e.g. https://host/join/ABC234. */
export function inviteUrl(code: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/join/${code}`
}

/** Copy text to the clipboard. Resolves true on success, false otherwise. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the legacy path
  }
  // Legacy fallback for browsers without the async clipboard API.
  try {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'absolute'
    el.style.left = '-9999px'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}

/**
 * Open the native share sheet for a league invite where available. Returns
 * 'shared' on success, 'unsupported' when there's no share API (caller should
 * fall back to copy), or 'cancelled' if the user dismissed the sheet.
 */
export async function shareInvite(
  leagueName: string,
  code: string,
): Promise<'shared' | 'unsupported' | 'cancelled'> {
  const url = inviteUrl(code)
  if (typeof navigator === 'undefined' || !navigator.share) return 'unsupported'
  try {
    await navigator.share({
      title: `Join my league: ${leagueName}`,
      text: `Join "${leagueName}" on the Euro 2028 Predictor. Invite code ${code}.`,
      url,
    })
    return 'shared'
  } catch (e) {
    // AbortError = user cancelled; anything else, treat as cancelled too so the
    // caller can offer copy as the fallback.
    if (e instanceof Error && e.name === 'AbortError') return 'cancelled'
    return 'cancelled'
  }
}
