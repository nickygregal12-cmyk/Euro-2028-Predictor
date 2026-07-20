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
  // Tracks the one live widget for this container. A ref (not a local) so the
  // render guard and cleanup see the same value across React's StrictMode
  // double-invoke of this effect, guaranteeing exactly one widget per container.
  const widgetId = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled || !container.current || !window.turnstile) return
        // Never call render() twice into the same container — a second render
        // (StrictMode remount, or any re-render) would collide with the live
        // widget and error. Cleanup nulls this back out.
        if (widgetId.current !== null) return
        widgetId.current = window.turnstile.render(container.current, {
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
      if (widgetId.current !== null && window.turnstile) {
        window.turnstile.remove(widgetId.current)
        widgetId.current = null
      }
    }
  }, [siteKey])

  // Deliberately NO `cf-turnstile` class: that class is Cloudflare's trigger for
  // *implicit* auto-render (its script repeatedly scans the DOM for it), which
  // collides with our *explicit* render() above on the same container and loops
  // "skipped implicit render because a widget already exists". We render
  // explicitly to own the widget id (for cleanup) and wire the callbacks, so the
  // container must stay off Cloudflare's implicit-render radar. Analytics
  // attribution comes from the `action` passed to render(); data-action is kept
  // for documentation/parity (it's read only during the implicit render we opt
  // out of, so it's inert here but harmless).
  return <div ref={container} data-action="turnstile-spin-v2" />
}
