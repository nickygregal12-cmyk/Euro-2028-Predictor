import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  applyDocumentHead,
  robotsTxt,
  sitemapXml,
} from '../../src/app/site/documentMetadata'
import { sitePublicMetadata } from '../../src/app/site/sitePublicMetadata'

/**
 * Euro 2028 is absent from every public weekly surface (`EURO-003`).
 *
 * WHAT THIS IS AND IS NOT. It is a check on the surfaces a stranger can reach
 * without signing in: the landing page's content, the document metadata that
 * unfurls in a chat app or a search result, the sitemap and robots. It is NOT
 * `EURO-004`, which asks for visibility to be enforced by a server-owned
 * publication state rather than by client absence — that is contract 143's
 * `euro_publication_state` and the `TournamentJourney` guard, tested with the
 * route rather than here. Nothing below should be read as the guard.
 *
 * SPREAD ACROSS FIVE FILES, WHICH IS THE REASON IT IS ONE TEST. The register
 * described this as an atomic change across four; there were five, because
 * `index.html`'s three meta descriptions named Euro 2028 and no list of the
 * affected surfaces had them. A guard that checks one file at a time is how the
 * fifth gets missed again.
 *
 * TWO OF THE FIVE ARE NOW GENERATED RATHER THAN AUTHORED. The sitemap and
 * `robots.txt` are built per deployment from `SiteConfiguration`, so this
 * checks what the HUB BUILD SHIPS instead of what a static file in `public/`
 * says. That is a stronger check and it retired the exception below it: the
 * Euro domain used to be excluded by name, because `index.html`, the sitemap
 * and robots all hard-coded it and no edit to this requirement could fix that.
 * The Hub build now carries no domain at all until one is configured for it, so
 * the sweep asserts the absence rather than exempting it.
 */

const repositoryRoot = process.cwd()

function read(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8')
}

/**
 * Every public-facing artefact authored in the repository, and what "public"
 * means for each.
 *
 * `LandingPage.module.css` is included deliberately: a `.euroBand` rule left
 * behind after the markup goes is dead weight that also tells the next reader
 * the section is coming back.
 */
const PUBLIC_SURFACES = [
  'index.html',
  'src/features/landing/LandingPage.tsx',
  'src/features/landing/landingContent.ts',
  'src/features/landing/LandingPage.module.css',
  'docs/design/hub-landing-prototype.html',
] as const

/**
 * Comments are stripped before the check, and that is a deliberate line rather
 * than a convenience.
 *
 * WHAT THIS GUARDS IS WHAT A STRANGER RECEIVES: rendered copy, meta content,
 * sitemap entries. Source prose is not served. Forbidding the word in comments
 * would make it impossible to record WHY the band was removed in the files it
 * was removed from — which is where the next reader looks, and exactly the kind
 * of erasure this repository's own rule against rewriting history is about. The
 * first version of this file did forbid it, and immediately failed on the
 * paragraph explaining the removal.
 */
function served(path: string, source: string): string {
  if (path.endsWith('.html') || path.endsWith('.xml')) {
    return source.replace(/<!--[\s\S]*?-->/g, ' ')
  }
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function mentionsOfEuro(path: string, source: string): string[] {
  const withoutComments = served(path, source)
  return [...withoutComments.matchAll(/euro/gi)].map((match) => {
    const at = match.index ?? 0
    return withoutComments.slice(Math.max(0, at - 40), at + 40).replace(/\s+/g, ' ')
  })
}

describe('the public weekly surfaces name no tournament', () => {
  it.each(PUBLIC_SURFACES)('%s mentions Euro nowhere', (path) => {
    expect(mentionsOfEuro(path, read(path)), `${path} still names Euro`).toEqual([])
  })

  it('reads files that exist, so the sweep is not vacuous', () => {
    for (const path of PUBLIC_SURFACES) {
      expect(read(path).length, `${path} is empty`).toBeGreaterThan(50)
    }
  })

  it('keeps the landing section list to the seven surfaces that remain', () => {
    const content = read('src/features/landing/landingContent.ts')
    expect(content).not.toMatch(/'euro'/)
    // The hero, proof, how, experience, leagues, games and final CTA.
    const order = /LANDING_SECTION_ORDER[^=]*=\s*\[(.*?)\]/s.exec(content)?.[1] ?? ''
    expect(order.match(/'/g)?.length).toBe(14)
  })
})

describe('what the Hub deployment actually publishes', () => {
  // Deliberately built with NO configured origin, which is the Hub's state
  // today: its permanent domain is not purchased.
  const hub = sitePublicMetadata('hub')

  it('serves a document head that names no tournament and no tournament domain', () => {
    const document = applyDocumentHead(read('index.html'), hub)
    expect(mentionsOfEuro('index.html', document)).toEqual([])
    expect(document).not.toContain('euro28predictor.com')
  })

  it('publishes no sitemap rather than the tournament’s', () => {
    expect(sitemapXml(hub)).toBeNull()
  })

  it('publishes a robots.txt that points at no other site', () => {
    const robots = robotsTxt(hub)
    expect(mentionsOfEuro('robots.txt', robots)).toEqual([])
    expect(robots).not.toContain('Sitemap:')
  })
})
