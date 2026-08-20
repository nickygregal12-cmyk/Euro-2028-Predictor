import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { TeamCrest } from '../../src/vnext/components/football/TeamCrest'
import { workshopTeams } from '../../src/vnext/fixtures'
import type { Team } from '../../src/vnext/models/football'
import {
  badgesPossible,
  defaultBadgePolicy,
  isPermittedBadgeUrl,
  resolveOfficialBadge,
  type ClubBadgePolicy,
} from '../../src/domain/clubIdentity/officialBadge'

/**
 * ONE DECISION ABOUT OFFICIAL BADGES, AND ONE PLACE IT IS MADE.
 *
 * ============================ THE POSITION ==============================
 *
 * ADR 0017's club identity half is in force: the product launches badge-free,
 * because a crest is simultaneously a registered trade mark AND an original
 * artistic work and there is no descriptive-use defence in copyright. The
 * 8 August 2026 provider capability audit measured every configured provider
 * and found the same disclaimer in each — SportMonks' `image_path`,
 * football-data.org's `crest`, API-SPORTS' `logo` — with the conclusion that a
 * schema may retain a provider image reference for later rights resolution but
 * "public UI must not assume it may render or re-host those assets".
 *
 * So the capability is built, switchable and OFF. These cases hold both halves:
 * that it is genuinely off, and that it genuinely works — because a kill switch
 * nobody can prove works is not a kill switch.
 */

const PL_URL = 'https://crests.football-data.org/57.png'
const SM_URL = 'https://cdn.sportmonks.com/images/soccer/teams/1/1.png'

function policy(overrides: Partial<ClubBadgePolicy> = {}): ClubBadgePolicy {
  return { enabled: true, sources: ['football-data'], competitions: null, ...overrides }
}

function teamWithBadge(url = PL_URL): Team {
  return {
    ...workshopTeams.glenmore,
    officialBadge: { url, source: 'football-data' },
  }
}

describe('the default is deny, and deny is an answer', () => {
  it('permits nothing at all', () => {
    const off = defaultBadgePolicy()
    expect(off.enabled).toBe(false)
    expect(off.sources).toEqual([])
    expect(badgesPossible(off)).toBe(false)
    expect(
      resolveOfficialBadge({ url: PL_URL, source: 'football-data' }, {
        policy: off,
        competitionId: 'season-1',
      }),
    ).toBeNull()
  })

  it('is what the shipped configuration selects', () => {
    // The flag is read at build time and fails closed. `.env.example` is the
    // operator-facing template and it must not ship a value that turns rights
    // the project has not established into a rendered image.
    const template = readFileSync(resolve(process.cwd(), '.env.example'), 'utf8')
    expect(template).toContain('VITE_UI_OFFICIAL_BADGES=false')
  })

  it('is not contradicted by the deployment’s own image policy', () => {
    // Belt and braces, and the more interesting half: even a mis-set flag
    // cannot put a provider image on a page, because the Content-Security-Policy
    // admits no remote image host. Turning badges on is a CSP change too, and
    // that is deliberate — it makes the rights decision visible in the one file
    // an operator has to edit.
    const netlify = readFileSync(resolve(process.cwd(), 'netlify.toml'), 'utf8')
    expect(netlify).toContain("img-src 'self' data:")
    for (const host of ['crests.football-data.org', 'cdn.sportmonks.com', 'media.api-sports.io']) {
      expect(netlify, `${host} is admitted by the CSP`).not.toContain(host)
    }
  })
})

describe('every gate denies on its own', () => {
  it('denies when the global switch is off, whatever else is approved', () => {
    expect(
      resolveOfficialBadge({ url: PL_URL, source: 'football-data' }, {
        policy: policy({ enabled: false }),
        competitionId: 'season-1',
      }),
    ).toBeNull()
  })

  it('denies a provider that is not approved', () => {
    expect(
      resolveOfficialBadge({ url: SM_URL, source: 'sportmonks' }, {
        policy: policy({ sources: ['football-data'] }),
        competitionId: 'season-1',
      }),
    ).toBeNull()
  })

  it('denies a competition outside the allowlist', () => {
    expect(
      resolveOfficialBadge({ url: PL_URL, source: 'football-data' }, {
        policy: policy({ competitions: ['season-allowed'] }),
        competitionId: 'season-other',
      }),
    ).toBeNull()
  })

  it('denies an unnamed competition once a list exists', () => {
    // An unknown competition must not inherit another one's licence, and a
    // surface that cannot say which competition it is in is exactly that case.
    expect(
      resolveOfficialBadge({ url: PL_URL, source: 'football-data' }, {
        policy: policy({ competitions: ['season-allowed'] }),
        competitionId: null,
      }),
    ).toBeNull()
  })

  it('allows an unnamed competition when there is no list', () => {
    expect(
      resolveOfficialBadge({ url: PL_URL, source: 'football-data' }, {
        policy: policy({ competitions: null }),
        competitionId: null,
      }),
    ).toEqual({ url: PL_URL, source: 'football-data' })
  })

  it('denies when there is simply no candidate', () => {
    expect(
      resolveOfficialBadge(null, { policy: policy(), competitionId: 'season-1' }),
    ).toBeNull()
  })
})

describe('a URL is checked, not trusted', () => {
  it('accepts only the approved provider’s own host', () => {
    expect(isPermittedBadgeUrl(PL_URL, 'football-data')).toBe(true)
    // The right shape from the wrong provider is still the wrong host.
    expect(isPermittedBadgeUrl(SM_URL, 'football-data')).toBe(false)
  })

  it('refuses everything a payload could smuggle in', () => {
    const refused: readonly string[] = [
      'http://crests.football-data.org/57.png',
      'https://crests.football-data.org.evil.example/57.png',
      'https://evil.example/57.png',
      'https://user:pass@crests.football-data.org/57.png',
      'https://crests.football-data.org:8443/57.png',
      'data:image/svg+xml;base64,PHN2Zy8+',
      // eslint-disable-next-line no-script-url
      'javascript:alert(1)',
      'not a url at all',
      '',
    ]
    for (const url of refused) {
      expect(isPermittedBadgeUrl(url, 'football-data'), url).toBe(false)
    }
  })

  it('refuses a malformed URL through the resolver too', () => {
    expect(
      resolveOfficialBadge({ url: 'https://evil.example/57.png', source: 'football-data' }, {
        policy: policy(),
        competitionId: 'season-1',
      }),
    ).toBeNull()
  })
})

describe('the kit is drawn whether a badge is or not', () => {
  function crestOf(team: Team) {
    const view = render(
      <VNextRoot>
        <TeamCrest team={team} />
      </VNextRoot>,
    )
    return view
  }

  it('draws the kit identity and no image when there is no badge', () => {
    const view = crestOf(workshopTeams.glenmore)
    expect(view.container.querySelector('img')).toBeNull()
    const crest = view.container.querySelector('[role="img"]') as HTMLElement
    expect(crest.textContent).toContain('GLN')
    expect(crest.getAttribute('aria-label')).toBe('Glenmore Athletic')
  })

  it('makes no remote request at all while badges are off', () => {
    // The half a fallback cannot give you: with the switch off there is no
    // `<img>` in the tree, so there is nothing to request, nothing to decode
    // and nothing to fail.
    const view = crestOf({ ...workshopTeams.glenmore, officialBadge: null })
    expect(view.container.querySelectorAll('img')).toHaveLength(0)
  })

  it('draws the badge over the kit, never instead of it', () => {
    const view = crestOf(teamWithBadge())
    const image = view.container.querySelector('img') as HTMLImageElement
    expect(image.getAttribute('src')).toBe(PL_URL)
    // The kit and the monogram are still underneath, which is what makes every
    // failure below free.
    const crest = view.container.querySelector('[role="img"]') as HTMLElement
    expect(crest.textContent).toContain('GLN')
  })

  it('falls back to the kit when the image errors, with no broken glyph left', () => {
    const view = crestOf(teamWithBadge())
    const image = view.container.querySelector('img') as HTMLImageElement
    fireEvent.error(image)
    expect(view.container.querySelector('img')).toBeNull()
    const crest = view.container.querySelector('[role="img"]') as HTMLElement
    expect(crest.textContent).toContain('GLN')
    expect(crest.getAttribute('aria-label')).toBe('Glenmore Athletic')
  })

  it('never announces the club twice', () => {
    const view = crestOf(teamWithBadge())
    const image = view.container.querySelector('img') as HTMLImageElement
    expect(image.getAttribute('alt')).toBe('')
    expect(image.getAttribute('aria-hidden')).toBe('true')
  })

  it('is lazy by default and eager only when a caller asks', () => {
    const lazy = render(
      <VNextRoot>
        <TeamCrest team={teamWithBadge()} />
      </VNextRoot>,
    )
    expect(lazy.container.querySelector('img')?.getAttribute('loading')).toBe('lazy')
    lazy.unmount()

    const eager = render(
      <VNextRoot>
        <TeamCrest team={teamWithBadge()} size="lg" eager />
      </VNextRoot>,
    )
    expect(eager.container.querySelector('img')?.getAttribute('loading')).toBe('eager')
  })

  it('keeps a mixed row coherent: two badges and one kit', () => {
    const view = render(
      <VNextRoot>
        <TeamCrest team={teamWithBadge()} size="sm" />
        <TeamCrest team={{ ...workshopTeams.strathkelvin, officialBadge: { url: PL_URL, source: 'football-data' } }} size="sm" />
        {/* A newly promoted club with no badge — the ordinary case. */}
        <TeamCrest team={workshopTeams.braemarloch} size="sm" />
      </VNextRoot>,
    )
    expect(view.container.querySelectorAll('img')).toHaveLength(2)
    // Every crest is a complete identity regardless, which is what stops the
    // third one reading as an error beside the first two.
    for (const crest of view.container.querySelectorAll('[role="img"]')) {
      expect((crest.textContent ?? '').trim().length).toBeGreaterThan(0)
      expect(crest.getAttribute('aria-label')).toBeTruthy()
    }
  })

  it('sizes the badge inside the crest so nothing can shift', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/vnext/components/football/TeamCrest.module.css'),
      'utf8',
    )
    const badge = css.slice(css.indexOf('.badge {'))
    expect(badge).toContain('position: absolute')
    expect(badge).toContain('object-fit: contain')
  })
})

describe('presentation never holds the decision', () => {
  it('has no provider name, flag or policy anywhere in the vNext visual tree', () => {
    // The rule the central policy exists for: no `if (provider === …)` in Home,
    // in Matches, in Match Centre or anywhere else. The crest takes a resolved
    // badge and renders it.
    const crest = readFileSync(
      resolve(process.cwd(), 'src/vnext/components/football/TeamCrest.tsx'),
      'utf8',
    )
    const code = crest.split('*/').slice(1).join('*/')
    for (const forbidden of [
      'football-data',
      'sportmonks',
      'api-sports',
      'clubBadgePolicy',
      'VITE_UI_OFFICIAL_BADGES',
    ]) {
      expect(code, `${forbidden} reached the crest`).not.toContain(forbidden)
    }
  })
})
