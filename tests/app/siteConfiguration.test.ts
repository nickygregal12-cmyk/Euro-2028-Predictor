import { describe, expect, it } from 'vitest'
import { normaliseOrigin, siteConfiguration } from '../../src/app/site/siteConfiguration'
import {
  absoluteUrl,
  siteBrandCopy,
  sitePublicMetadata,
} from '../../src/app/site/sitePublicMetadata'
import {
  bonusGames,
  gamesPlayedElsewhere,
  primaryGames,
  siteGames,
} from '../../src/app/site/siteGames'
import {
  DEFAULT_SITE_VARIANT,
  isSiteVariant,
  resolveSiteVariant,
  SITE_VARIANTS,
} from '../../src/app/site/siteVariant'
import {
  applyDocumentHead,
  documentHeadTags,
  HEAD_BLOCK_END,
  HEAD_BLOCK_START,
  robotsTxt,
  sitemapXml,
} from '../../src/app/site/documentMetadata'

const HUB_ORIGIN = 'https://predictionhub.example'
const EURO_ORIGIN = 'https://euro28predictor.com'

describe('resolving the variant', () => {
  it('accepts both declared variants', () => {
    for (const variant of SITE_VARIANTS) {
      expect(resolveSiteVariant(variant)).toBe(variant)
      expect(isSiteVariant(variant)).toBe(true)
    }
  })

  it('tolerates the casing and whitespace an operator actually types', () => {
    expect(resolveSiteVariant(' Euro ')).toBe('euro')
    expect(resolveSiteVariant('HUB')).toBe('hub')
  })

  // The direction of the failure is the point, not merely that it has one.
  it('fails closed to the Hub, never to Euro', () => {
    expect(DEFAULT_SITE_VARIANT).toBe('hub')
    for (const value of [undefined, null, '', 'euro2028', 'tournament', 'true', 'e']) {
      expect(resolveSiteVariant(value)).toBe('hub')
    }
  })
})

describe('the two products differ where they are meant to', () => {
  const hub = siteConfiguration('hub', { publicOrigin: HUB_ORIGIN })
  const euro = siteConfiguration('euro', { publicOrigin: EURO_ORIGIN })

  it('names itself differently', () => {
    expect(hub.brand.productName).toBe('Predictor Hub')
    expect(euro.brand.productName).toBe('Euro 2028 Predictor')
    expect(siteBrandCopy('hub').description).not.toBe(siteBrandCopy('euro').description)
  })

  it('ranks the three weekly games equally on the Hub', () => {
    expect(primaryGames('hub').map((game) => game.key)).toEqual([
      'matchPredictor',
      'lms',
      'championship',
    ])
    expect(bonusGames('hub')).toEqual([])
    expect(gamesPlayedElsewhere('hub')).toEqual([])
    expect(hub.navigation.bonusGamesLabel).toBeNull()
  })

  it('leads with the tournament on Euro and offers only the two attachable games', () => {
    expect(primaryGames('euro').map((game) => game.key)).toEqual(['euroPredictor'])
    // Last Man Standing and the Predictor Championship attach to whatever
    // competition you enter them in, so offering them beside a tournament is
    // coherent.
    expect(bonusGames('euro').map((game) => game.key)).toEqual(['lms', 'championship'])
    expect(euro.navigation.bonusGamesLabel).toBe('Bonus Games')
  })

  it('does not present domestic Match Predictor as a Euro Bonus Game', () => {
    // It is not a game you attach to something — it IS a competition season,
    // and the seasons it runs over are the Premier League and the Scottish
    // Premiership. Under Euro 2028 it promised a weekly domestic game on a
    // tournament site with nowhere to send anyone who wanted it.
    expect(bonusGames('euro').map((game) => game.key)).not.toContain('matchPredictor')
    expect(gamesPlayedElsewhere('euro').map((game) => game.key)).toEqual(['matchPredictor'])
  })

  it('accounts for every weekly game on the Euro site, one way or the other', () => {
    // A fourth weekly game must be classified deliberately rather than become a
    // Bonus Game by omission or vanish by omission.
    const euroWeekly = [
      ...bonusGames('euro'),
      ...gamesPlayedElsewhere('euro'),
    ].map((game) => game.key)
    expect([...euroWeekly].sort()).toEqual(
      primaryGames('hub')
        .map((game) => game.key)
        .sort(),
    )
  })

  it('describes each weekly game identically on both sites', () => {
    // The game FORMAT is the same game in both products. Only its rank moves.
    for (const key of ['matchPredictor', 'lms', 'championship'] as const) {
      const onHub = siteGames('hub').find((game) => game.key === key)
      const onEuro = siteGames('euro').find((game) => game.key === key)
      expect(onHub?.summary).toBe(onEuro?.summary)
      expect(onHub?.name).toBe(onEuro?.name)
      // The rank moves; nothing else about the game does.
      expect(onHub?.rank).not.toBe(onEuro?.rank)
    }
  })

  // Today's honest value, not the target one. ADR 0026 wants the Hub to stop
  // serving the tournament's player routes and `EURO-001` records that it has
  // not; the refusal is built and proven in `TournamentJourney.test.tsx`, and
  // flipping this is an owner decision that also needs the browser suite
  // pointed at the Euro build. See the field's own note.
  it('still serves the Euro tournament on both deployments', () => {
    expect(hub.servesEuroTournament).toBe(true)
    expect(euro.servesEuroTournament).toBe(true)
  })

  it('offers the same four global destinations, in each product’s own wording', () => {
    expect(hub.navigation.destinations.map((d) => d.href)).toEqual(
      euro.navigation.destinations.map((d) => d.href),
    )
    expect(hub.navigation.destinations.map((d) => d.label)).toEqual([
      'Home',
      'Play',
      'Matches',
      'Leagues',
    ])
    expect(euro.navigation.destinations.map((d) => d.label)).toContain('Predict')
    expect(hub.navigation.competitionsGroupLabel).not.toBe(
      euro.navigation.competitionsGroupLabel,
    )
  })
})

describe('one site can never carry the other’s origin', () => {
  it('uses only the origin it was given', () => {
    const hub = sitePublicMetadata('hub', { publicOrigin: HUB_ORIGIN })
    const euro = sitePublicMetadata('euro', { publicOrigin: EURO_ORIGIN })

    expect(absoluteUrl(hub, '/')).toBe(`${HUB_ORIGIN}/`)
    expect(absoluteUrl(euro, '/')).toBe(`${EURO_ORIGIN}/`)
    expect(JSON.stringify(hub)).not.toContain('euro28predictor.com')
    expect(JSON.stringify(euro)).not.toContain(HUB_ORIGIN)
  })

  // The Hub's permanent domain is not purchased. Absent must stay absent.
  it('has no origin at all when none is configured, and invents none', () => {
    const hub = sitePublicMetadata('hub')
    expect(hub.canonicalOrigin).toBeNull()
    expect(absoluteUrl(hub, '/')).toBeNull()
    expect(JSON.stringify(hub)).not.toContain('euro28predictor.com')
  })

  it('discards an origin it cannot parse rather than emitting a malformed one', () => {
    expect(normaliseOrigin('euro28predictor.com')).toBeNull()
    expect(normaliseOrigin('   ')).toBeNull()
    expect(normaliseOrigin('javascript:alert(1)')).toBeNull()
    expect(normaliseOrigin('https://example.test/path/')).toBe('https://example.test')
  })

  it('keeps the sibling link separate from this site’s own origin', () => {
    const origins = { publicOrigin: HUB_ORIGIN, siblingOrigin: EURO_ORIGIN }
    const hub = siteConfiguration('hub', origins)
    expect(hub.routes.siblingSiteOrigin).toBe(EURO_ORIGIN)
    expect(hub.routes.siblingSiteName).toBe('Euro 2028 Predictor')

    const published = sitePublicMetadata('hub', origins)
    expect(published.canonicalOrigin).toBe(HUB_ORIGIN)
    // The sibling origin must never reach the canonical/OG metadata — and it
    // cannot, because `sitePublicMetadata` does not read it at all.
    expect(documentHeadTags(published).join('\n')).not.toContain(EURO_ORIGIN)
  })

  // The runtime configuration must not carry the published copy at all: every
  // byte of it is in the entry chunk that every visitor downloads.
  it('keeps the published copy out of the runtime configuration', () => {
    const serialised = JSON.stringify(siteConfiguration('hub', { publicOrigin: HUB_ORIGIN }))
    expect(serialised).not.toContain(siteBrandCopy('hub').description)
    expect(serialised).not.toContain(siteBrandCopy('hub').tagline)
    expect(serialised).not.toContain(HUB_ORIGIN)
  })
})

describe('generated public metadata', () => {
  it('emits the full social card when the site has an origin', () => {
    const head = documentHeadTags(
      sitePublicMetadata('euro', { publicOrigin: EURO_ORIGIN }),
    ).join('\n')
    expect(head).toContain('<title>Euro 2028 Predictor</title>')
    expect(head).toContain(`<link rel="canonical" href="${EURO_ORIGIN}/" />`)
    expect(head).toContain(`<meta property="og:url" content="${EURO_ORIGIN}/" />`)
    expect(head).toContain(`<meta property="og:image" content="${EURO_ORIGIN}/og-image.jpg" />`)
  })

  it('omits every absolute-URL tag when the site has no origin', () => {
    const head = documentHeadTags(sitePublicMetadata('hub')).join('\n')
    expect(head).toContain('<title>Predictor Hub</title>')
    expect(head).toContain('<meta name="description"')
    expect(head).not.toContain('rel="canonical"')
    expect(head).not.toContain('og:url')
    expect(head).not.toContain('og:image')
    expect(head).not.toContain('twitter:image')
  })

  it('writes a sitemap only for a site that has somewhere to point at', () => {
    expect(sitemapXml(sitePublicMetadata('hub'))).toBeNull()
    const euro = sitemapXml(sitePublicMetadata('euro', { publicOrigin: EURO_ORIGIN }))
    expect(euro).toContain(`<loc>${EURO_ORIGIN}/</loc>`)
    expect(euro).not.toContain('undefined')
  })

  it('drops the robots Sitemap line rather than pointing it at another domain', () => {
    expect(robotsTxt(sitePublicMetadata('hub'))).toBe('User-agent: *\nAllow: /\n')
    expect(robotsTxt(sitePublicMetadata('euro', { publicOrigin: EURO_ORIGIN }))).toContain(
      `Sitemap: ${EURO_ORIGIN}/sitemap.xml`,
    )
  })

  it('replaces only the managed block of the document', () => {
    const template = `<head>\n    ${HEAD_BLOCK_START}\n    <title>old</title>\n    ${HEAD_BLOCK_END}\n    <link rel="icon" href="/favicon.ico" />\n  </head>`
    const applied = applyDocumentHead(
      template,
      sitePublicMetadata('euro', { publicOrigin: EURO_ORIGIN }),
    )
    expect(applied).toContain('<link rel="icon" href="/favicon.ico" />')
    expect(applied).not.toContain('<title>old</title>')
    expect(applied).toContain('<title>Euro 2028 Predictor</title>')
  })

  // A silent no-op would ship whatever the template happened to say, which
  // before this seam existed was the other product's domain.
  it('refuses a document whose markers have been removed', () => {
    expect(() => applyDocumentHead('<head></head>', sitePublicMetadata('hub'))).toThrow(
      /SITE METADATA/,
    )
  })

  it('escapes values rather than breaking the head on an apostrophe or a quote', () => {
    const head = documentHeadTags({
      ...sitePublicMetadata('hub'),
      productName: 'A "quoted" & <angled> name',
    }).join('\n')
    expect(head).toContain('&quot;quoted&quot; &amp; &lt;angled&gt;')
  })
})
