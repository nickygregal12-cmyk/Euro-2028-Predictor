import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { TeamCrest } from '../../src/vnext/components/football/TeamCrest'
import { workshopTeamList, workshopTeams } from '../../src/vnext/fixtures'
import { clubOverlay } from '../../src/domain/clubIdentity/clubIdentityTokens'
import type { TeamKitPattern } from '../../src/vnext/models/football'

/**
 * THE CLUB IDENTITY THIS PRODUCT IS ALLOWED TO DRAW.
 *
 * ADR 0017 decided it and has not been superseded: the product launches
 * badge-free, `ClubIdentity` is the only path by which a club is visually
 * represented, and it renders from colour, a generic kit pattern and a
 * monogram. Stripes, hoops, halves and a sash are centuries-old football
 * conventions owned by nobody, which is exactly why they were chosen — a crest
 * is an original artistic work and a generic kit is not.
 *
 * ============================ THE GAP THESE CASES CLOSE ==================
 *
 * The domain has had FIVE patterns since the identity work landed and the
 * owner's reference data uses all five — Crystal Palace is a sash. This lane
 * declared four, so every sash club arrived as `solid` and lost the one thing
 * that told it apart. The three adapters each said so in a comment and each
 * flattened it.
 */

const KIT_PATTERNS: readonly TeamKitPattern[] = [
  'solid',
  'stripes',
  'hoops',
  'halves',
  'sash',
]

function crestOf(team: (typeof workshopTeamList)[number]) {
  const view = render(
    <VNextRoot>
      <TeamCrest team={team} />
    </VNextRoot>,
  )
  return view.container.querySelector('[role="img"]') as HTMLElement
}

describe('the lane draws every kit the domain can state', () => {
  it('declares the same five patterns the domain does', () => {
    // The domain's own union, read from source rather than restated here — a
    // restatement is a second list, and a second list is what drifted.
    const domain = readFileSync(
      resolve(process.cwd(), 'src/domain/clubIdentity/clubIdentityTypes.ts'),
      'utf8',
    )
    for (const pattern of KIT_PATTERNS) {
      expect(domain, `the domain no longer states ${pattern}`).toContain(`'${pattern}'`)
    }
  })

  it('has a rule for every pattern, so none falls through to an unpainted mark', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/vnext/components/football/TeamCrest.module.css'),
      'utf8',
    )
    for (const pattern of KIT_PATTERNS) {
      expect(css, `TeamCrest has no .${pattern} rule`).toMatch(
        new RegExp(`^\\.${pattern}\\s*\\{`, 'm'),
      )
    }
  })

  it('draws a sash club with the sash treatment rather than as solid', () => {
    const crest = crestOf(workshopTeams.braemarloch)
    // CSS modules hash the class, so the pattern is matched by its stem.
    expect(crest.className).toMatch(/sash/)
    expect(crest.className).not.toMatch(/solid/)
  })

  it('keeps the club’s own colours and never invents a second one', () => {
    // ADR 0017: colour comes from football, so it arrives as an inline custom
    // property. A sash uses the club's SECOND colour for the band — there is no
    // third value anywhere in the treatment.
    const crest = crestOf(workshopTeams.braemarloch)
    const style = crest.getAttribute('style') ?? ''
    expect(style).toContain(workshopTeams.braemarloch.colours.primary)
    expect(style).toContain(workshopTeams.braemarloch.colours.secondary)
  })

  it('never carries colour alone: the code and the full name are always there', () => {
    for (const team of workshopTeamList) {
      const view = render(
        <VNextRoot>
          <TeamCrest team={team} />
        </VNextRoot>,
      )
      const crest = view.container.querySelector('[role="img"]') as HTMLElement
      expect(crest.getAttribute('aria-label')).toBe(team.name)
      expect(crest.textContent).toContain(team.abbreviation)
      view.unmount()
    }
  })

  it('reviews the sash on a board, because the hardest pattern needs one', () => {
    // A pattern with no fixture club is a pattern nobody looks at. The identity
    // story renders `workshopTeamList`, so a club wearing it is what puts the
    // treatment in front of a reviewer at every size.
    expect(workshopTeamList.some((team) => team.kitPattern === 'sash')).toBe(true)
  })
})

describe('the reference data this exists to serve', () => {
  it('still contains a sash club, so the treatment is not decoration', () => {
    // Crystal Palace, in the owner's own curated overlay. If this ever stops
    // being true the treatment is unused and the case above is measuring the
    // fixture rather than the product.
    const sashes = Object.entries(clubOverlay).filter(
      ([, overlay]) => overlay.pattern === 'sash',
    )
    expect(sashes.length).toBeGreaterThan(0)
  })
})
