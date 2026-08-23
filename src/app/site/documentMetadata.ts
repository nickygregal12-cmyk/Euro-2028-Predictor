import { SITE_ICON_SIZES, THEME_COLOUR } from './siteIcons.js'
import {
  absoluteUrl,
  type SitePublicMetadata,
} from './sitePublicMetadata.js'
import { WEB_APP_MANIFEST_PATH } from './webAppManifest.js'

/** Where the invite card's artwork is served from. Emitted per variant. */
export const INVITE_OPEN_GRAPH_IMAGE_PATH = '/og-invite.png'

/** The document an invite link is served, and the path Netlify rewrites to it. */
export const INVITE_DOCUMENT_PATH = '/join.html'

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

/** Escape a value for an HTML attribute. */
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
 * A social card for one KIND of link, where the site's own card is wrong for it.
 *
 * ============================ WHY THIS IS PER ROUTE AND NOT PER LEAGUE ======
 *
 * The obvious version of an invite card names the league. It must not, and the
 * reason is recorded rather than cautious.
 *
 * An invite code is a guessable bearer token, and three contracts have narrowed
 * what one reveals. Contract 152 cut `get_league_preview` to `name` and
 * `is_member` and charged a 20-a-minute `league_invite_probe` BEFORE the lookup,
 * so a wrong guess costs what a right one does. Contract 158 removed the member
 * count and the owner name, because those "identify WHICH private group a
 * guessed code belongs to". Contract 159 found `resolve_invite_code` was a
 * second, unlimited door still returning `id` and `members`, and put it on the
 * same budget. `MIG-UI-07` states the resulting rule outright: the count is
 * deliberately not rendered, because a second surface showing it would reopen
 * the hole.
 *
 * A social card is fetched by an UNAUTHENTICATED, UNRATE-LIMITED crawler. Any
 * per-code content here would be a fourth door and the worst of them — no
 * session, no limiter, machine-readable. And it is not only the name: a card
 * that merely DIFFERED between a real code and a guessed one would be a free
 * validity oracle, which is the exact thing the limiter exists to price.
 *
 * So this card is identical for every code — valid, invalid, or absent. It
 * needs no lookup, so there is nothing to probe. What it can still do, and what
 * the generic site card could not, is tell the person holding the link what it
 * is for; that is the part that decides whether anybody taps it, and it costs
 * no disclosure at all.
 */
export type ShareCard = {
  readonly title: string
  readonly description: string
  /** Root-relative path of this card's image. */
  readonly imagePath: string
  readonly imageAlt: string
}

/** The card an invite link unfurls to. Carries nothing about which invite. */
export function inviteShareCard(metadata: SitePublicMetadata): ShareCard {
  return {
    title: `Your invitation to ${metadata.productName}`,
    // "See the invitation" rather than "see who invited you", because contract
    // 158 removed the owner name and the join screen therefore cannot show it.
    // A card that promised it would be writing a cheque the product refuses.
    description:
      'A link to join a private competition. Open it to see the invitation and take your place.',
    imagePath: INVITE_OPEN_GRAPH_IMAGE_PATH,
    imageAlt: `An invitation to a private competition on ${metadata.productName}`,
  }
}

/** The generated `<head>` lines for one site, or for one kind of link on it. */
export function documentHeadTags(
  metadata: SitePublicMetadata,
  card?: ShareCard,
): string[] {
  const { brand } = metadata
  const site = escapeAttribute(metadata.productName)
  const name = escapeAttribute(card?.title ?? metadata.productName)
  const description = escapeAttribute(card?.description ?? brand.description)
  const imageAlt = escapeAttribute(card?.imageAlt ?? brand.tagline)
  // A CARD-BEARING DOCUMENT HAS NO CANONICAL URL, and that is not an omission.
  // Its address carries an invite code; naming one would either publish a code
  // or claim the invite page is the home page. Both are worse than silence.
  const canonical = card ? null : absoluteUrl(metadata, '/')
  const image = absoluteUrl(metadata, card?.imagePath ?? metadata.openGraphImagePath)

  const appleTouchIcon = SITE_ICON_SIZES.find(
    (icon) => icon.file === 'apple-touch-icon.png',
  )

  const lines: string[] = [
    tag(`<title>${name}</title>`),
    tag(`<meta name="description" content="${description}" />`),
  ]

  // AN INVITE PAGE MUST NEVER BE INDEXED. Its address IS the credential, so a
  // search engine that lists one publishes a working invite to everybody. Said
  // here as well as in `robots.txt` because the two are read by different
  // crawlers at different moments, and a link posted somewhere public is
  // reachable before anything re-reads a robots file.
  if (card) {
    lines.push(tag('<meta name="robots" content="noindex, nofollow" />'))
  }

  lines.push(
    tag('<link rel="icon" href="/favicon.ico" sizes="any" />'),
    tag('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />'),
  )

  if (appleTouchIcon) {
    lines.push(
      tag(
        `<link rel="apple-touch-icon" sizes="${appleTouchIcon.size}x${appleTouchIcon.size}" href="/${appleTouchIcon.file}" />`,
      ),
    )
  }

  lines.push(
    tag(`<link rel="manifest" href="${WEB_APP_MANIFEST_PATH}" />`),
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
    tag(`<meta property="og:site_name" content="${site}" />`),
    tag(`<meta property="og:title" content="${name}" />`),
    tag(`<meta property="og:description" content="${description}" />`),
  )

  // Open Graph URLs must be absolute — a crawler resolves nothing relative — so
  // an unconfigured origin drops the pair rather than emitting a relative one.
  if (canonical) lines.push(tag(`<meta property="og:url" content="${escapeAttribute(canonical)}" />`))
  if (image) {
    lines.push(
      tag(`<meta property="og:image" content="${escapeAttribute(image)}" />`),
      tag('<meta property="og:image:type" content="image/png" />'),
      tag('<meta property="og:image:width" content="1200" />'),
      tag('<meta property="og:image:height" content="630" />'),
      tag(`<meta property="og:image:alt" content="${imageAlt}" />`),
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
 * With a `card`, the SAME document is re-headed for one kind of link — which is
 * how the invite document is produced from the built one rather than from a
 * second template. A second template would drift: it would need every script
 * tag Vite injected, and the first hash it missed would be an invite page that
 * loads nothing.
 */
export function applyDocumentHead(
  html: string,
  metadata: SitePublicMetadata,
  card?: ShareCard,
): string {
  const start = html.indexOf(HEAD_BLOCK_START)
  const end = html.indexOf(HEAD_BLOCK_END)
  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      `index.html is missing the "${HEAD_BLOCK_START}" … "${HEAD_BLOCK_END}" block. ` +
        'Site metadata is generated per variant and cannot be authored inline.',
    )
  }

  const body = documentHeadTags(metadata, card).join('\n')
  return `${html.slice(0, start + HEAD_BLOCK_START.length)}\n${body}\n${' '.repeat(4)}${html.slice(end)}`
}

/** This site's sitemap, or null when it has no configured origin. */
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

/** This site's `robots.txt`. */
export function robotsTxt(metadata: SitePublicMetadata): string {
  const sitemap = absoluteUrl(metadata, '/sitemap.xml')
  // `/join/` IS NOT CRAWLABLE, because an invite address is the credential. A
  // link pasted into a public channel would otherwise become a searchable,
  // working invitation to a private competition — the same disclosure contracts
  // 152, 158 and 159 spent three passes narrowing, arriving by a door none of
  // them was watching. Everything else stays open; discovery is the point.
  const lines = ['User-agent: *', 'Disallow: /join/', 'Allow: /']
  if (sitemap) lines.push('', `Sitemap: ${sitemap}`)
  return `${lines.join('\n')}\n`
}
