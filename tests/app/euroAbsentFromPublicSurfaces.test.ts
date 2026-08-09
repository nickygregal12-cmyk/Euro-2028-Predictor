import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Euro 2028 is absent from every public weekly surface (`EURO-003`).
 *
 * WHAT THIS IS AND IS NOT. It is a check on the surfaces a stranger can reach
 * without signing in: the landing page's content, the document metadata that
 * unfurls in a chat app or a search result, the sitemap and robots. It is NOT
 * `EURO-004`, which asks for visibility to be enforced by a server-owned
 * publication state rather than by client absence. That state is unbuilt, so
 * everything below is a property of this build. Absence is worth holding
 * anyway — it is the difference between the requirement being violated today
 * and merely being unfinished — but nothing here should be read as the guard.
 *
 * SPREAD ACROSS FIVE FILES, WHICH IS THE REASON IT IS ONE TEST. The register
 * described this as an atomic change across four; there were five, because
 * `index.html`'s three meta descriptions named Euro 2028 and no list of the
 * affected surfaces had them. A guard that checks one file at a time is how the
 * fifth gets missed again.
 */

const repositoryRoot = process.cwd()

function read(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8')
}

/**
 * Every public-facing artefact, and what "public" means for each.
 *
 * `LandingPage.module.css` is included deliberately: a `.euroBand` rule left
 * behind after the markup goes is dead weight that also tells the next reader
 * the section is coming back.
 */
const PUBLIC_SURFACES = [
  'index.html',
  'public/sitemap.xml',
  'public/robots.txt',
  'src/features/landing/LandingPage.tsx',
  'src/features/landing/landingContent.ts',
  'src/features/landing/LandingPage.module.css',
  'docs/design/hub-landing-prototype.html',
] as const

/**
 * The canonical domain is `euro28predictor.com` and appears in the sitemap, the
 * canonical link and the Open Graph URLs. That is `SITE-003`'s problem — the
 * weekly platform's own domain waits on the brand decision deferred under ADR
 * 0019 — and not something this requirement can fix by editing a string. It is
 * excluded by name so the rest of the check can be strict rather than fuzzy.
 */
const DOMAIN = /euro28predictor\.com/g

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

describe('the public weekly surfaces name no tournament', () => {
  it.each(PUBLIC_SURFACES)('%s mentions Euro nowhere but the domain', (path) => {
    const withoutDomain = served(path, read(path)).replace(DOMAIN, 'HOST')
    const mentions = [...withoutDomain.matchAll(/euro/gi)].map((match) => {
      const at = match.index ?? 0
      return withoutDomain.slice(Math.max(0, at - 40), at + 40).replace(/\s+/g, ' ')
    })

    expect(mentions, `${path} still names Euro`).toEqual([])
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
