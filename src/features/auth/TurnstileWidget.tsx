import { useEffect, useRef } from 'react'

// Renders the Cloudflare Turnstile widget and hands its token up. The parent
// gates submit on having a token and passes it to Supabase Auth as captchaToken;
// Supabase runs siteverify server-side (Option A). Never call siteverify from the
// browser.

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js'

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  remove: (id: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
  if (existing) {
    return new Promise((resolve) => existing.addEventListener('load', () => resolve(), { once: true }))
  }
  return new Promise((resolve, reject) => {
    const el = document.createElement('script')
    el.src = SCRIPT_SRC
    el.async = true
    el.defer = true
    el.addEventListener('load', () => resolve(), { once: true })
    el.addEventListener('error', () => reject(new Error('Turnstile failed to load')), { once: true })
    document.head.appendChild(el)
  })
}

export type TurnstileWidgetProps = {
  siteKey: string
  // Called with the token on success, or null on expiry/error. Remount the
  // widget (change its React key) to force a fresh token after a failed submit.
  onToken: (token: string | null) => void
}

export function TurnstileWidget({ siteKey, onToken }: TurnstileWidgetProps) {
  const container = useRef<HTMLDivElement>(null)
  const onTokenRef = useRef(onToken)
  onTokenRef.current = onToken

  useEffect(() => {
    let widgetId: string | undefined
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled || !container.current || !window.turnstile) return
        widgetId = window.turnstile.render(container.current, {
          sitekey: siteKey,
          action: 'turnstile-spin-v2',
          callback: (token: string) => onTokenRef.current(token),
          'error-callback': () => onTokenRef.current(null),
          'expired-callback': () => onTokenRef.current(null),
        })
      })
      .catch(() => onTokenRef.current(null))
    return () => {
      cancelled = true
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [siteKey])

  // The cf-turnstile class + data-action satisfy the analytics attribution
  // requirement (explicit render above also passes the same action).
  return <div ref={container} className="cf-turnstile" data-action="turnstile-spin-v2" />
}
