/**
 * Which of the two deployments this build is.
 *
 * ADR 0026 accepted **two frontend sites, one shared backend, one account**: the
 * weekly Prediction Hub and Euro 2028 are separate deployments on separate
 * domains, built from the same `main` commit. Until this module existed there
 * was no seam that could tell them apart, so "two sites" was an intention rather
 * than something a build could satisfy — and Euro remained reachable from the
 * weekly platform, which is the recorded `EURO-001` defect.
 *
 * ONE VARIABLE, READ ONCE, AT THE ROUTING AND CONFIGURATION LAYER. The same
 * reasoning as `routeFlags.ts`: a variant threaded through fifty components as
 * scattered `import.meta.env` checks cannot be reasoned about or tested, and
 * every one of them is a place the wrong product can leak. Everything that
 * differs between the two sites is derived from one `SiteConfiguration`.
 *
 * FAIL CLOSED TOWARDS THE HUB. An unset, misspelled or unknown value selects
 * `'hub'`, never `'euro'`. That direction is deliberate and is the whole point:
 * `EURO-001` and `EURO-003` require Euro 2028 to be invisible until an owner
 * publishes it, so the failure mode of a mis-set variable must be "the weekly
 * platform", never "a tournament nobody approved". The publication STATE is
 * still the server's (`euro_publication_state`, contract 143); this only
 * decides which product is being built.
 *
 * This module is deliberately free of `import.meta.env` so it can also be
 * imported by `vite.config.ts` when it generates the document head, the sitemap
 * and `robots.txt`. `currentSite.ts` is the one place the environment is read.
 */

/** The two deployments, in no significant order. */
export const SITE_VARIANTS = ['hub', 'euro'] as const

export type SiteVariant = (typeof SITE_VARIANTS)[number]

/** The variant an unrecognised configuration resolves to. See the header. */
export const DEFAULT_SITE_VARIANT: SiteVariant = 'hub'

export function isSiteVariant(value: unknown): value is SiteVariant {
  return typeof value === 'string' && (SITE_VARIANTS as readonly string[]).includes(value)
}

/**
 * Resolve `VITE_SITE_VARIANT` to a variant.
 *
 * Trimmed and lower-cased before comparison, because an operator typing `Euro`
 * or a trailing space into a Netlify environment variable meant the Euro site
 * would silently build as the Hub — a confusing failure rather than a safe one.
 * Anything still unrecognised is the Hub.
 */
export function resolveSiteVariant(value: string | undefined | null): SiteVariant {
  const normalised = (value ?? '').trim().toLowerCase()
  return isSiteVariant(normalised) ? normalised : DEFAULT_SITE_VARIANT
}
