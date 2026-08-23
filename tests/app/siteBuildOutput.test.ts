import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  applyDocumentHead,
  documentHeadTags,
  INVITE_OPEN_GRAPH_IMAGE_PATH,
  inviteShareCard,
  robotsTxt,
  sitemapXml,
} from '../../src/app/site/documentMetadata'
import { SITE_ICON_FILES } from '../../src/app/site/siteIcons'
import { sitePublicMetadata } from '../../src/app/site/sitePublicMetadata'
import { SITE_VARIANTS } from '../../src/app/site/siteVariant'

/**
 * What the two Netlify sites actually ship.
 *
 * This applies the real build transform to the real `index.html` rather than
 * asserting on a fixture, because the failure this guards against is a template
 * edit: someone adds a `<title>` or a canonical tag back into the document by
 * hand, both sites ship it, and the per-variant generator silently stops being
 * the authority. Running `vite build` twice would prove the same thing and take
 * two minutes; `applyDocumentHead` IS the transform the plugin calls, so this
 * proves it in milliseconds.
 */

const repositoryRoot = resolve(import.meta.dirname, '../..')
const EURO_ORIGIN = 'https://euro28predictor.com'

function indexHtml(): string {
  return readFileSync(resolve(repositoryRoot, 'index.html'), 'utf8')
}

function builtDocument(variant: 'hub' | 'euro', publicOrigin?: string): string {
  return applyDocumentHead(indexHtml(), sitePublicMetadata(variant, { publicOrigin }))
}

describe('index.html is a template, not a document', () => {
  it('authors no title, canonical or social tag of its own', () => {
    const template = indexHtml()
    const managed = template.slice(
      template.indexOf('<!-- SITE METADATA: generated -->'),
      template.indexOf('<!-- /SITE METADATA -->'),
    )
    // Only the placeholder title lives inside the block; nothing outside it.
    const outside = template.replace(managed, '')
    expect(outside).not.toContain('<title>')
    expect(outside).not.toContain('rel="canonical"')
    expect(outside).not.toContain('og:')
    expect(outside).not.toContain('twitter:')
    expect(outside).not.toContain('euro28predictor.com')
  })

  it('authors no icon of its own either, since the icons are per variant now', () => {
    // They used to be three static tags here, which meant one committed icon
    // set for two products: the Hub installed itself under the tournament's
    // mark. `documentMetadata.ts` emits them inside the block now, and
    // `installablePwa.test.ts` proves the two sets differ.
    const template = indexHtml()
    const managed = template.slice(
      template.indexOf('<!-- SITE METADATA: generated -->'),
      template.indexOf('<!-- /SITE METADATA -->'),
    )
    const outside = template.replace(managed, '')
    expect(outside).not.toContain('rel="icon"')
    expect(outside).not.toContain('apple-touch-icon')
    expect(outside).not.toContain('rel="manifest"')
  })

  it('keeps the application entry point outside the block', () => {
    const built = builtDocument('hub')
    expect(built).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />')
    expect(built).toContain('<script type="module" src="/src/main.tsx"></script>')
    expect(built).toContain('<div id="root"></div>')
  })
})

describe('the Hub build', () => {
  const built = builtDocument('hub')

  it('is the weekly product', () => {
    expect(built).toContain('<title>Predictor Hub</title>')
    expect(built).toContain('Premier League and the Scottish Premiership')
  })

  // `EURO-001`/`EURO-003`: Euro 2028 absent from the weekly platform's public
  // metadata, and absent from its domain.
  it('mentions Euro 2028 nowhere, and never carries the Euro origin', () => {
    expect(built).not.toContain('euro28predictor.com')
    expect(built.toLowerCase()).not.toContain('euro 2028')
  })

  it('has no canonical URL until a domain is configured for it', () => {
    expect(built).not.toContain('rel="canonical"')
    expect(sitemapXml(sitePublicMetadata('hub'))).toBeNull()
    expect(robotsTxt(sitePublicMetadata('hub'))).not.toContain('Sitemap:')
  })

  it('publishes its own domain once one is configured', () => {
    const withDomain = builtDocument('hub', 'https://predictionhub.example')
    expect(withDomain).toContain('<link rel="canonical" href="https://predictionhub.example/" />')
    expect(withDomain).not.toContain('euro28predictor.com')
  })
})

describe('the Euro build', () => {
  const built = builtDocument('euro', EURO_ORIGIN)

  it('is the tournament product on the tournament domain', () => {
    expect(built).toContain('<title>Euro 2028 Predictor</title>')
    expect(built).toContain(`<link rel="canonical" href="${EURO_ORIGIN}/" />`)
    expect(built).toContain(`<meta property="og:url" content="${EURO_ORIGIN}/" />`)
  })

  it('does not present itself as the weekly platform', () => {
    expect(built).not.toContain('<title>Predictor Hub</title>')
    expect(built).not.toContain('og:site_name" content="Predictor Hub')
  })
})

describe('the two builds cannot be confused for one another', () => {
  it('differ in title, description and canonical', () => {
    const hub = builtDocument('hub', 'https://predictionhub.example')
    const euro = builtDocument('euro', EURO_ORIGIN)
    expect(hub).not.toBe(euro)
    expect(hub).not.toContain(EURO_ORIGIN)
    expect(euro).not.toContain('predictionhub.example')
  })
})

describe('netlify.toml', () => {
  const netlify = readFileSync(resolve(repositoryRoot, 'netlify.toml'), 'utf8')

  /**
   * A `[build.environment]` value applies to EVERY site using this file, so a
   * variant declared here would give both deployments the same product. The
   * variant belongs in each Netlify site's own environment variables.
   */
  it('declares no site variant or origin, because both sites share the file', () => {
    const environmentBlocks = netlify
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('#'))
      .join('\n')
    expect(environmentBlocks).not.toMatch(/^\s*VITE_SITE_VARIANT\s*=/m)
    expect(environmentBlocks).not.toMatch(/^\s*VITE_PUBLIC_SITE_ORIGIN\s*=/m)
    expect(environmentBlocks).not.toMatch(/^\s*VITE_SIBLING_SITE_ORIGIN\s*=/m)
  })
})

describe('an invite link unfurls as an invitation, and discloses nothing', () => {
  /**
   * ============================ THE FAILURE THIS PREVENTS ===================
   *
   * The obvious invite card names the league. It must not, and the reason is
   * three contracts deep rather than cautious.
   *
   * An invite code is a guessable bearer token. Contract 152 cut the preview to
   * `name` and `is_member` and charged a 20-a-minute limiter BEFORE the lookup,
   * so a wrong guess costs what a right one does. Contract 158 removed the
   * member count and the owner name, because those "identify WHICH private
   * group a guessed code belongs to". Contract 159 found `resolve_invite_code`
   * was a second, UNLIMITED door still returning `id` and `members`, and put it
   * on the same budget.
   *
   * A social card is fetched by an unauthenticated, unrate-limited crawler. Per-
   * code content here would be a fourth door and the worst of them — and not
   * only the name: a card that merely DIFFERED between a real code and a
   * guessed one is a free validity oracle, which is what the limiter prices.
   *
   * So the card must be a pure function of the SITE, with no code in its inputs
   * at all. These cases assert that shape, because a future edit that adds a
   * parameter is the one that reopens it.
   */
  const variants = SITE_VARIANTS.map((variant) => sitePublicMetadata(variant))

  it('takes the site and nothing else — there is no code to pass it', () => {
    // The signature IS the control. A card built from an invite cannot leak one
    // if it never receives one, and this is cheaper to keep true than any
    // assertion about the words.
    expect(inviteShareCard.length).toBe(1)
  })

  it.each(SITE_VARIANTS)('says what the link is for on %s', (variant) => {
    const card = inviteShareCard(sitePublicMetadata(variant))
    expect(card.title).toMatch(/invitation/i)
    expect(card.description).toMatch(/private competition/i)
    // NOT "see who invited you": contract 158 removed the owner name, so the
    // join screen cannot show it and a card promising it would be a cheque the
    // product refuses to cash.
    expect(card.description).not.toMatch(/who invited/i)
  })

  it.each(SITE_VARIANTS)('claims no membership, size or standing on %s', (variant) => {
    const card = inviteShareCard(sitePublicMetadata(variant))
    const words = `${card.title} ${card.description} ${card.imageAlt}`.toLowerCase()
    for (const forbidden of ['member', 'players', 'owner', 'admin', 'points', 'rank']) {
      expect(words, `the invite card says "${forbidden}"`).not.toContain(forbidden)
    }
  })

  it.each(SITE_VARIANTS)('is never indexed, and names no canonical address on %s', (variant) => {
    // An invite ADDRESS is the credential. A search engine that lists one
    // publishes a working invitation to everybody, and a canonical tag would
    // either publish a code or claim the invite page is the home page.
    const site = sitePublicMetadata(variant)
    const head = documentHeadTags(site, inviteShareCard(site)).join('\n')

    expect(head).toContain('name="robots" content="noindex, nofollow"')
    expect(head).not.toContain('rel="canonical"')
    expect(head).not.toContain('property="og:url"')
  })

  it.each(SITE_VARIANTS)('the ordinary site document is still indexable on %s', (variant) => {
    // The negative control. If `noindex` leaked onto every document, these
    // cases would still pass while the whole site fell out of every index.
    const head = documentHeadTags(sitePublicMetadata(variant)).join('\n')
    expect(head).not.toContain('noindex')
  })

  it.each(SITE_VARIANTS)('keeps crawlers out of the invite space on %s', (variant) => {
    const robots = robotsTxt(sitePublicMetadata(variant))
    expect(robots).toContain('Disallow: /join/')
    // Everything else stays open — discovery is the point of the rest.
    expect(robots).toContain('Allow: /')
  })

  it('carries its own artwork, in the per-variant lane', () => {
    // In `SITE_ICON_FILES` so a Hub build is physically unable to emit the Euro
    // card, which is the same rule the installed icons follow.
    expect(SITE_ICON_FILES).toContain(INVITE_OPEN_GRAPH_IMAGE_PATH.slice(1))
    for (const site of variants) {
      expect(inviteShareCard(site).imagePath).toBe(INVITE_OPEN_GRAPH_IMAGE_PATH)
      expect(inviteShareCard(site).imagePath).not.toBe(site.openGraphImagePath)
    }
  })

  it('is the same document as the site one, re-headed', () => {
    // The invite page must BOOT. It is derived from the built `index.html`, so
    // what this proves is that the transform only touches the managed block —
    // if it dropped the application's own markup, every invitation would open a
    // blank page and the person following it could not tell anybody why.
    const site = sitePublicMetadata('euro')
    const template = readFileSync(resolve(repositoryRoot, 'index.html'), 'utf8')
    const ordinary = applyDocumentHead(template, site)
    const invite = applyDocumentHead(template, site, inviteShareCard(site))

    const outsideHead = (html: string) => html.slice(html.indexOf('</head>'))
    expect(outsideHead(invite)).toBe(outsideHead(ordinary))
    expect(invite).not.toBe(ordinary)
  })
})
