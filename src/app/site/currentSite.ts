import { siteConfiguration, type SiteConfiguration } from './siteConfiguration.js'
import { resolveSiteVariant, type SiteVariant } from './siteVariant.js'

/**
 * The one place the running build's site variant is read from the environment.
 *
 * Everything else takes a `SiteConfiguration` as an argument or calls
 * `useSite()`. That is what makes both products provable in one test process:
 * a component handed a configuration can be rendered as either site without
 * mutating `import.meta.env`, and `siteConfiguration.ts` stays pure enough for
 * `vite.config.ts` to import.
 *
 * DELIBERATELY FUNCTIONS RATHER THAN CONSTANTS, for the reason `routeFlags.ts`
 * gives: a constant evaluated at module load is invisible to a test that wants
 * to prove the other branch, and proving the other branch is the point.
 */

export function currentSiteVariant(): SiteVariant {
  return resolveSiteVariant(import.meta.env.VITE_SITE_VARIANT)
}

export function currentSiteConfiguration(): SiteConfiguration {
  return siteConfiguration(currentSiteVariant(), {
    publicOrigin: import.meta.env.VITE_PUBLIC_SITE_ORIGIN,
    siblingOrigin: import.meta.env.VITE_SIBLING_SITE_ORIGIN,
  })
}
