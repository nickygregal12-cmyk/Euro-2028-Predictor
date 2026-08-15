type ProductEventProperties = Record<string, string | number | boolean | null>

type PostHogModule = typeof import('posthog-js')

let clientPromise: Promise<PostHogModule> | null = null
let initialised = false

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
export async function initProductAnalytics(): Promise<boolean> {
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
  if (!initialised || !analyticsConfig()) return false
  try {
    const { default: posthog } = await loadClient()
    posthog.capture(event, properties)
    return true
  } catch (error) {
    warnInDevelopment(`Product analytics event ${event} was not sent.`, error)
    return false
  }
}
