import { normaliseOrigin, type SiteOrigins } from './siteConfiguration.js'
import { type SiteVariant } from './siteVariant.js'

/**
 * What a deployment PUBLISHES, as opposed to what its running application
 * needs.
 *
 * WHY THIS IS NOT PART OF `SiteConfiguration`, AND THE REASON IS MEASURED.
 * `SiteProvider` sits above the router, so every byte of the configuration is
 * in the entry chunk that every visitor downloads before anything renders.
 * Nothing below is read at runtime: the descriptions, taglines, monogram, Open
 * Graph image path, sitemap paths and canonical origin are consumed by
 * `documentMetadata.ts` at BUILD time, and by the two landing pages, which are
 * lazily routed. Carrying them in the runtime configuration put the entry chunk
 * on its 76 KB ceiling — 32 bytes under locally and over on CI, which is a coin
 * flip rather than a budget. Splitting them took it back under with headroom.
 *
 * The split is also the honest description of the two things: one is the
 * product the browser is running, the other is what the published document
 * says about it.
 *
 * Pure and Node-importable, for the same reason `siteConfiguration.ts` is —
 * `vite.config.ts` calls this to generate the head, the sitemap and robots.
 */

export type SiteBrandCopy = {
  /** For a narrow app bar and the collapsed rail. */
  readonly shortName: string
  readonly monogram: string
  readonly tagline: string
  /** The `<meta name="description">` and the Open Graph description. */
  readonly description: string
}

export type SitePublicMetadata = {
  readonly variant: SiteVariant
  readonly productName: string
  readonly brand: SiteBrandCopy
  /**
   * The absolute origin this site's canonical URL, Open Graph URLs, sitemap and
   * share links are built on, or null when no domain is configured for it.
   *
   * NULL IS A REAL AND EXPECTED VALUE, not a gap to paper over. The Hub's
   * permanent domain is not purchased, and a build that guessed one — or worse,
   * fell back to the other site's — would emit a canonical tag pointing at a
   * different product. Every consumer omits the tag rather than inventing a
   * URL; `documentMetadata.ts` is where that is carried out.
   */
  readonly canonicalOrigin: string | null
  /** Path of this variant's generated Open Graph image. */
  readonly openGraphImagePath: string
  /** Public paths worth listing in this site's sitemap, root first. */
  readonly sitemapPaths: readonly string[]
}

const HUB: { productName: string; brand: SiteBrandCopy } = {
  productName: 'Predictor Hub',
  brand: {
    shortName: 'Predictor Hub',
    monogram: 'PH',
    tagline: 'Three games. Every matchweek. One private league to settle it.',
    description:
      'Score predictions, Jokers and private leagues across the Premier League and the Scottish Premiership.',
  },
}

const EURO: { productName: string; brand: SiteBrandCopy } = {
  productName: 'Euro 2028 Predictor',
  brand: {
    shortName: 'Euro 2028',
    monogram: 'E28',
    tagline: 'One tournament. Every match. The league that decides it.',
    description:
      'Predict every Euro 2028 match, play the knockout bracket and settle it in a private league with your mates.',
  },
}

/** The descriptive brand copy for one deployment. */
export function siteBrandCopy(variant: SiteVariant): SiteBrandCopy {
  return (variant === 'euro' ? EURO : HUB).brand
}

/** Everything one deployment publishes about itself. */
export function sitePublicMetadata(
  variant: SiteVariant,
  origins: SiteOrigins = {},
): SitePublicMetadata {
  const identity = variant === 'euro' ? EURO : HUB
  return {
    variant,
    productName: identity.productName,
    brand: identity.brand,
    canonicalOrigin: normaliseOrigin(origins.publicOrigin),
    // Vite emits this name from the current variant's own site-asset directory.
    // It deliberately cannot live in public/: files there are copied to both
    // products byte-for-byte, which is how the Hub used to unfurl Euro artwork.
    openGraphImagePath: '/og-image.png',
    sitemapPaths: ['/'],
  }
}

/**
 * Resolve a path against this site's canonical origin.
 *
 * Returns null when no origin is configured. Every caller must treat that as
 * "emit nothing" — never as "use a default" — because the only default
 * available is the other site's domain, and pointing one product's canonical
 * URL at the other is the exact failure this whole seam exists to prevent.
 */
export function absoluteUrl(
  metadata: SitePublicMetadata,
  path: string,
): string | null {
  const origin = metadata.canonicalOrigin
  if (!origin) return null
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`
}
