import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyDocumentHead } from '../../src/app/site/documentMetadata'
import {
  ICON_ACCENT,
  MASKABLE_SAFE_SCALE,
  PITCH_MARK,
  SITE_ICON_FILES,
  SITE_ICON_SIZES,
  THEME_COLOUR,
  faviconSvg,
  siteIconDirectory,
  siteIconMark,
} from '../../src/app/site/siteIcons'
import { sitePublicMetadata } from '../../src/app/site/sitePublicMetadata'
import { SITE_VARIANTS } from '../../src/app/site/siteVariant'
import {
  WEB_APP_MANIFEST_PATH,
  webAppManifest,
} from '../../src/app/site/webAppManifest'

/**
 * ADR 0016 Phase 1 — what actually makes each deployment installable.
 *
 * A MANIFEST EXISTING IS NOT THE CLAIM. Installability is a set of conditions a
 * browser checks: a name, a start URL inside a scope, `display` other than
 * `browser`, and an icon of at least 192 pixels — plus, for the tile not to be
 * drawn inside a white circle on Android, a maskable one. Each is asserted
 * below against the generated document rather than against a checked-in file,
 * because there is no checked-in file: both deployments generate their own.
 *
 * THE OTHER HALF IS THAT THEY DO NOT SHARE AN IDENTITY. An installed
 * application's name and icon outlive the tab it was installed from, so a Hub
 * build shipping the tournament's mark is a mistake nobody notices until it is
 * on somebody's home screen. Every assertion here is made twice, once per site,
 * and the cross-branding checks are made in both directions.
 */

const repositoryRoot = process.cwd()

function iconBytes(variant: 'hub' | 'euro', file: string): Buffer {
  return readFileSync(
    resolve(repositoryRoot, siteIconDirectory(variant), file),
  )
}

/** Width and height from a PNG's IHDR, which is always the first chunk. */
function pngSize(bytes: Buffer): { width: number; height: number } {
  expect(bytes.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  )
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

describe.each(SITE_VARIANTS)('the %s deployment', (variant) => {
  const metadata = sitePublicMetadata(variant)
  const manifest = webAppManifest(metadata)
  const head = applyDocumentHead(
    readFileSync(resolve(repositoryRoot, 'index.html'), 'utf8'),
    metadata,
  )

  it('meets every installability condition a browser checks', () => {
    expect(manifest.name).toBe(metadata.productName)
    expect(manifest.short_name.length).toBeGreaterThan(0)
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url).toBe('/')
    expect(manifest.scope).toBe('/')

    const any = manifest.icons.filter((icon) => icon.purpose === 'any')
    expect(any.map((icon) => icon.sizes)).toContain('192x192')
    expect(any.map((icon) => icon.sizes)).toContain('512x512')
    expect(
      manifest.icons.some((icon) => icon.purpose === 'maskable'),
    ).toBe(true)
  })

  it('links the manifest and its own icons from the document it ships', () => {
    expect(head).toContain(`<link rel="manifest" href="${WEB_APP_MANIFEST_PATH}" />`)
    expect(head).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />')
    expect(head).toContain('rel="apple-touch-icon" sizes="180x180"')
  })

  it('tells iOS what to do, since iOS reads no manifest at all', () => {
    expect(head).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />')
    expect(head).toContain(
      `<meta name="apple-mobile-web-app-title" content="${metadata.brand.shortName}" />`,
    )
    // `black-translucent` lets the application's own background reach under the
    // status bar, which is what the layout's safe-area insets already reserve
    // room for. Anything else leaves an opaque bar in the wrong colour.
    expect(head).toContain(
      '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
    )
  })

  it('holds every icon it declares, at the size it declares', () => {
    for (const icon of SITE_ICON_SIZES) {
      const bytes = iconBytes(variant, icon.file)
      expect(pngSize(bytes)).toEqual({ width: icon.size, height: icon.size })
    }
    for (const file of SITE_ICON_FILES) {
      expect(
        statSync(resolve(repositoryRoot, siteIconDirectory(variant), file)).size,
      ).toBeGreaterThan(0)
    }
  })

  it('paints its window and launch screen in the theme the application uses', () => {
    expect(manifest.theme_color).toBe(THEME_COLOUR.dark)
    expect(manifest.background_color).toBe(THEME_COLOUR.dark)
  })

  it('locks no orientation', () => {
    expect(manifest).not.toHaveProperty('orientation')
  })

  it('resolves every URL it publishes against the manifest, not an origin', () => {
    // `canonicalOrigin` is null for a site with no configured domain, and a
    // manifest must still work on a deploy preview and a `netlify.app`
    // address. Nothing here may be absolute.
    const urls = [
      manifest.start_url,
      manifest.scope,
      manifest.id,
      ...manifest.icons.map((icon) => icon.src),
    ]
    for (const url of urls) expect(url.startsWith('/')).toBe(true)
    expect(JSON.stringify(manifest)).not.toContain('http')
  })
})

describe('the two installed identities cannot be confused', () => {
  const hub = webAppManifest(sitePublicMetadata('hub'))
  const euro = webAppManifest(sitePublicMetadata('euro'))

  it('names each product as itself and never as the other', () => {
    expect(hub.name).toBe('Predictor Hub')
    expect(euro.name).toBe('Euro 2028 Predictor')
    expect(JSON.stringify(hub).toLowerCase()).not.toContain('euro')
    expect(JSON.stringify(euro).toLowerCase()).not.toContain('predictor hub')
  })

  it('draws a different mark for each, and neither is a bare monogram', () => {
    // The Hub's mark is drawn geometry rather than initials: an application
    // icon is read with no product name beside it, so a two-letter monogram
    // standing alone is a different thing from the same two letters in a
    // collapsed navigation rail.
    expect(siteIconMark('hub')).toEqual({ kind: 'pitch' })
    expect(siteIconMark('euro')).toEqual({ kind: 'wordmark', text: '28' })

    expect(iconBytes('hub', 'icon-512.png')).not.toEqual(
      iconBytes('euro', 'icon-512.png'),
    )
    expect(iconBytes('hub', 'apple-touch-icon.png')).not.toEqual(
      iconBytes('euro', 'apple-touch-icon.png'),
    )
  })

  it('generates each favicon from its own site, with its own label', () => {
    const hubSvg = faviconSvg(siteIconMark('hub'), 'Predictor Hub')
    const euroSvg = faviconSvg(siteIconMark('euro'), 'Euro 2028 Predictor')

    expect(hubSvg).toContain('aria-label="Predictor Hub"')
    expect(hubSvg.toLowerCase()).not.toContain('euro')
    expect(euroSvg).toContain('aria-label="Euro 2028 Predictor"')
    expect(euroSvg).toContain('>28<')
  })

  it('ships no shared icon in public/, which is copied to both', () => {
    // The whole reason the icons moved out of `public/`: files there are
    // copied verbatim into both deployments, so one set there is one installed
    // identity for two products.
    for (const file of ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png']) {
      expect(() => statSync(resolve(repositoryRoot, 'public', file))).toThrow()
    }
  })
})

describe('the mark survives the platform mask it will meet', () => {
  it('keeps the meaningful geometry inside the maskable safe circle', () => {
    // The specification guarantees only a circle of 80% of the tile — a radius
    // of 0.4 from the centre. Android, Windows and the task switchers each crop
    // to their own shape inside that, and none of them is available to look at
    // here, so the arithmetic is the gate.
    const SAFE_RADIUS = 0.4

    // The outer edge of the centre circle's stroke is the furthest thing that
    // carries meaning; the halfway line is deliberately allowed to run out to
    // the tile edge and be cropped, because that is what a halfway line does.
    const outerEdge =
      (PITCH_MARK.circleRadius + PITCH_MARK.circleWidth / 2) * MASKABLE_SAFE_SCALE
    expect(outerEdge).toBeLessThanOrEqual(SAFE_RADIUS)

    // And it should not be so timid that the icon reads as a dot in a field.
    expect(outerEdge).toBeGreaterThan(SAFE_RADIUS * 0.5)
  })

  it('draws the mark in the accent the rest of the product uses', () => {
    const tokens = readFileSync(
      resolve(repositoryRoot, 'src/styles/tokens.css'),
      'utf8',
    )
    expect(tokens).toContain(`--acc: ${ICON_ACCENT};`)
    expect(faviconSvg(siteIconMark('hub'), 'Predictor Hub')).toContain(ICON_ACCENT)
  })
})
