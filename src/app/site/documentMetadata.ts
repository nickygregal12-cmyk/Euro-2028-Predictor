import { SITE_ICON_SIZES, THEME_COLOUR } from './siteIcons.js'
import {
  absoluteUrl,
  type SitePublicMetadata,
} from './sitePublicMetadata.js'
import { WEB_APP_MANIFEST_PATH } from './webAppManifest.js'

/**
 * The public metadata each deployment publishes: the document head, the
 * sitemap and `robots.txt`.
 *
 * WHY THIS IS GENERATED RATHER THAN AUTHORED. `index.html`, `public/sitemap.xml`
 * and `public/robots.txt` each hard-coded `https://euro28predictor.com`. One
 * commit building two products cannot have three static files naming one
 * domain: the Hub build would have shipped a canonical tag, an Open Graph URL
 * and a sitemap pointing crawlers and every unfurled share link at the Euro
 * site. Generating all three from `SiteConfiguration` makes that impossible by
 * construction rather than by remembering.
 *
 * AN UNCONFIGURED ORIGIN EMITS NOTHING. `canonicalOrigin` is null until a domain
 * is configured for the site being built, and every function here omits the tag
 * or the file rather than substituting a default — there is no correct default,
 * only the other site's domain. A missing canonical tag costs a little SEO; a
 * wrong one sends a product's traffic to a different product.
 *
 * Pure and Node-importable: `vite.config.ts` calls these at build time. They
 * take `SitePublicMetadata` rather than the runtime `SiteConfiguration`, which
 * is what keeps this copy out of the entry chunk every visitor downloads.
 */

/**
 * Escape a value for an HTML attribute.
 *
 * The inputs are repository constants rather than user content, so this is a
 * belt rather than a control — but a product name with an apostrophe in it is
 * an entirely ordinary thing to want, and a generator that breaks the document
 * head on one is a bad generator.
 */
export function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function tag(html: string): string {
  return `    ${html}`
}

/**
 * The `<title>`, description, canonical, theme colours and social cards for one
 * site, as the lines that replace the managed block in `index.html`.
 */
export function documentHeadTags(metadata: SitePublicMetadata): string[] {
  const { brand } = metadata
  const name = escapeAttribute(metadata.productName)
  const description = escapeAttribute(brand.description)
  const canonical = absoluteUrl(metadata, '/')
  const image = absoluteUrl(metadata, metadata.openGraphImagePath)

  const appleTouchIcon = SITE_ICON_SIZES.find(
    (icon) => icon.file === 'apple-touch-icon.png',
  )

  const lines: string[] = [
    tag(`<title>${escapeAttribute(metadata.productName)}</title>`),
    tag(`<meta name="description" content="${description}" />`),

    // THE ICONS ARE GENERATED HERE FOR THE SAME REASON THE TITLE IS. They used
    // to be three static tags in `index.html`, which meant one committed icon
    // set shipped to both deployments — the Hub installed itself under the Euro
    // monogram. `assets/site-icons/<variant>/` holds one set per site and
    // `vite.config.ts` emits only this build's.
    tag('<link rel="icon" href="/favicon.ico" sizes="any" />'),
    tag('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />'),
  ]

  if (appleTouchIcon) {
    lines.push(
      tag(
        `<link rel="apple-touch-icon" sizes="${appleTouchIcon.size}x${appleTouchIcon.size}" href="/${appleTouchIcon.file}" />`,
      ),
    )
  }

  // ADR 0016 Phase 1. `crossorigin` is deliberately absent: the manifest is
  // same-origin and adding the attribute makes the request credentialled, which
  // some hosts answer differently and which no part of this needs.
  lines.push(
    tag(`<link rel="manifest" href="${WEB_APP_MANIFEST_PATH}" />`),
    // iOS reads none of the manifest. These two are what a home-screen launch
    // on an iPhone honours instead: a standalone window rather than a Safari
    // chrome, and a status bar that lets the app's own background show through
    // under the safe-area inset the layout already reserves.
    tag('<meta name="mobile-web-app-capable" content="yes" />'),
    tag('<meta name="apple-mobile-web-app-capable" content="yes" />'),
    tag(`<meta name="apple-mobile-web-app-title" content="${escapeAttribute(metadata.brand.shortName)}" />`),
    tag('<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />'),
  )

  if (canonical) lines.push(tag(`<link rel="canonical" href="${escapeAttribute(canonical)}" />`))

  lines.push(
    tag(
      `<meta name="theme-color" content="${THEME_COLOUR.dark}" media="(prefers-color-scheme: dark)" />`,
    ),
    tag(
      `<meta name="theme-color" content="${THEME_COLOUR.light}" media="(prefers-color-scheme: light)" />`,
    ),
    tag('<meta property="og:type" content="website" />'),
    tag(`<meta property="og:site_name" content="${name}" />`),
    tag(`<meta property="og:title" content="${name}" />`),
    tag(`<meta property="og:description" content="${description}" />`),
  )

  // Open Graph URLs must be absolute — a crawler resolves nothing relative — so
  // an unconfigured origin drops the pair rather than emitting a relative one
  // that silently unfurls as nothing.
  if (canonical) lines.push(tag(`<meta property="og:url" content="${escapeAttribute(canonical)}" />`))
  if (image) {
    lines.push(
      tag(`<meta property="og:image" content="${escapeAttribute(image)}" />`),
      tag('<meta property="og:image:type" content="image/jpeg" />'),
      tag('<meta property="og:image:width" content="1200" />'),
      tag('<meta property="og:image:height" content="630" />'),
      tag(`<meta property="og:image:alt" content="${escapeAttribute(brand.tagline)}" />`),
    )
  }

  lines.push(
    tag('<meta name="twitter:card" content="summary_large_image" />'),
    tag(`<meta name="twitter:title" content="${name}" />`),
    tag(`<meta name="twitter:description" content="${description}" />`),
  )
  if (image) lines.push(tag(`<meta name="twitter:image" content="${escapeAttribute(image)}" />`))

  return lines
}

/** The markers `index.html` carries around the generated block. */
export const HEAD_BLOCK_START = '<!-- SITE METADATA: generated -->'
export const HEAD_BLOCK_END = '<!-- /SITE METADATA -->'

/**
 * Replace the managed block in `index.html` with this site's metadata.
 *
 * THROWS WHEN THE MARKERS ARE MISSING rather than appending or returning the
 * document untouched. A silent no-op would ship the Hub build carrying whatever
 * the template happened to say — which, before this existed, was the Euro
 * domain. A failed build is the correct outcome of a template someone edited
 * without noticing what generates it.
 */
export function applyDocumentHead(html: string, metadata: SitePublicMetadata): string {
  const start = html.indexOf(HEAD_BLOCK_START)
  const end = html.indexOf(HEAD_BLOCK_END)
  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      `index.html is missing the "${HEAD_BLOCK_START}" … "${HEAD_BLOCK_END}" block. ` +
        'Site metadata is generated per variant and cannot be authored inline.',
    )
  }

  const body = documentHeadTags(metadata).join('\n')
  return `${html.slice(0, start + HEAD_BLOCK_START.length)}\n${body}\n${' '.repeat(4)}${html.slice(end)}`
}

/**
 * This site's sitemap, or null when it has no configured origin.
 *
 * A sitemap is a list of absolute URLs and nothing else; without an origin there
 * is no honest file to write, so none is emitted. The application is auth-gated,
 * so the canonical root remains the only index-worthy address.
 */
export function sitemapXml(metadata: SitePublicMetadata): string | null {
  const origin = metadata.canonicalOrigin
  if (!origin) return null

  const entries = metadata.sitemapPaths
    .map((path) => absoluteUrl(metadata, path))
    .filter((url): url is string => url !== null)
    .map(
      (url) =>
        `  <url>\n    <loc>${escapeAttribute(url)}</loc>\n    <changefreq>weekly</changefreq>\n  </url>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`
}

/**
 * This site's `robots.txt`.
 *
 * The `Sitemap:` line is omitted without an origin, for the same reason the
 * canonical tag is: a sitemap reference on the wrong domain is worse than none.
 */
export function robotsTxt(metadata: SitePublicMetadata): string {
  const sitemap = absoluteUrl(metadata, '/sitemap.xml')
  const lines = ['User-agent: *', 'Allow: /']
  if (sitemap) lines.push('', `Sitemap: ${sitemap}`)
  return `${lines.join('\n')}\n`
}
