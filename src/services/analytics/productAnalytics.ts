type ProductEventProperties = Record<string, string | number | boolean | null>

type PostHogModule = typeof import('posthog-js')

let clientPromise: Promise<PostHogModule> | null = null
let initialised = false
// The in-flight initialisation, memoised. `captureProductEvent` waits on this
// so an event recorded during startup is QUEUED rather than dropped: init is
// asynchronous (it imports a chunk), and the window between the first render
// and `initialised` flipping is exactly when an invite landing fires.
let initPromise: Promise<boolean> | null = null

function analyticsConfig() {
  const key = import.meta.env.VITE_POSTHOG_KEY?.trim()
  if (!key) return null
  return {
    key,
    host: import.meta.env.VITE_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com',
  }
}

function loadClient() {
  clientPromise ??= import('posthog-js')
  return clientPromise
}

function warnInDevelopment(message: string, error: unknown) {
  if (import.meta.env.DEV) console.warn(message, error)
}

/**
 * Product analytics is explicitly opt-in at build/deploy time.
 *
 * With no VITE_POSTHOG_KEY the PostHog chunk is never requested and the app
 * behaves exactly as it did before this integration. Automatic capture is
 * disabled so events stay intentional and reviewable. A configured analytics
 * failure must never stop prediction entry or authentication, so this path is
 * fail-quiet in the same spirit as the existing optional observability layer.
 */
export function initProductAnalytics(): Promise<boolean> {
  // NOTHING TO MEMOISE WHEN THERE IS NOTHING CONFIGURED. Caching the `false`
  // from an unconfigured call would make it permanent for the life of the
  // module, so a key arriving later -- which is what a test that walks the
  // opt-in does -- could never take effect. Only a real attempt is remembered.
  if (!analyticsConfig()) return Promise.resolve(false)

  // Memoised, so a second call joins the first rather than initialising twice,
  // and `captureProductEvent` has something to wait on during startup.
  initPromise ??= runInitialisation()
  return initPromise
}

async function runInitialisation(): Promise<boolean> {
  const config = analyticsConfig()
  if (!config) return false
  try {
    const { default: posthog } = await loadClient()
    posthog.init(config.key, {
      api_host: config.host,
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      persistence: 'localStorage+cookie',
    })
    initialised = true
    return true
  } catch (error) {
    initialised = false
    warnInDevelopment('Product analytics failed to initialise; continuing without it.', error)
    return false
  }
}

/**
 * Capture only player-facing product behaviour. Do not pass private AI Lab
 * inputs, provider payloads, secrets, or service-role/database credentials.
 */
export async function captureProductEvent(
  event: string,
  properties: ProductEventProperties = {},
): Promise<boolean> {
  if (!analyticsConfig()) return false

  // WAIT FOR AN INITIALISATION ALREADY UNDER WAY. Refusing here while init is
  // still resolving silently drops every event in the startup window, which is
  // the window an invite landing lands in. Callers are fire-and-forget, so
  // waiting costs a player nothing.
  //
  // Only ever waits on an initialisation somebody already started: with no
  // `initProductAnalytics()` call there is no promise, and this stays the
  // opt-in it was.
  if (!initialised && initPromise) await initPromise
  if (!initialised) return false

  try {
    const { default: posthog } = await loadClient()
    posthog.capture(event, properties)
    return true
  } catch (error) {
    warnInDevelopment(`Product analytics event ${event} was not sent.`, error)
    return false
  }
}
