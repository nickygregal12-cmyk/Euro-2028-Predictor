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

  it('keeps the favicons and the application entry point outside the block', () => {
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
