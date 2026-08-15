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

/**
 * Product analytics is explicitly opt-in at build/deploy time.
 *
 * With no VITE_POSTHOG_KEY the PostHog chunk is never requested and the app
 * behaves exactly as it did before this integration. Automatic capture is
 * disabled so events stay intentional and reviewable.
 */
export async function initProductAnalytics(): Promise<boolean> {
  const config = analyticsConfig()
  if (!config) return false
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
  const { default: posthog } = await loadClient()
  posthog.capture(event, properties)
  return true
}
