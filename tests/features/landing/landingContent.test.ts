import { describe, expect, it } from 'vitest'
import {
  DOMESTIC_COMPETITIONS,
  GAMES,
  HOW_STEPS,
  HUB_PREVIEW_DESCRIPTION,
  LANDING_NAV,
  LANDING_SECTION_ORDER,
  PHONE_PREVIEW_DESCRIPTION,
  PREVIEW_CONTEXT_SLOTS,
  PREVIEW_LEAGUE_ROWS,
} from '../../../src/features/landing/landingContent'

/**
 * The landing page's content model, against the authority that fixes it.
 *
 * Appendix E is unusually specific for a design document: E.3 orders the eight
 * surfaces, E.7 is a checklist of properties the finished page must have, and
 * E.6 makes membership safety a content rule rather than a schema one. Those
 * are all assertable, and worth asserting — a marketing page is exactly the
 * kind of surface that gets edited quickly by whoever is nearest the copy, and
 * "Euro 2028 drifted above the domestic competitions" is not something CI would
 * otherwise notice.
 */

describe('the landing page content model', () => {
  it('renders Appendix E.3’s eight surfaces, in its order', () => {
    expect(LANDING_SECTION_ORDER).toEqual([
      'hero',
      'proof',
      'how',
      'experience',
      'leagues',
      'games',
      'final',
    ])
  })

  it('offers no Euro 2028 section at all (EURO-003)', () => {
    // This assertion used to say the opposite: that Euro sat somewhere BELOW
    // the proof band, because revision 1.5 put an acquisition band there and
    // the only risk was it climbing. ADR 0026 superseded that positioning and
    // EURO-003 requires Euro absent from the weekly platform entirely while its
    // publication state is hidden, so the ordering question no longer exists —
    // there is nothing to order.
    expect(LANDING_SECTION_ORDER).not.toContain('euro' as never)
    expect(DOMESTIC_COMPETITIONS.map((c) => c.name)).toEqual([
      'Scottish Premiership',
      'Premier League',
    ])
  })

  it('leads the games with Match Predictor and discloses the rest after it', () => {
    // E.3's sixth surface and E.6 together: Match Predictor is the weekly
    // habit being sold, and the other two are optional depth behind it.
    expect(GAMES[0]?.name).toBe('Match Predictor')
    expect(GAMES.map((game) => game.name)).toContain('Last Man Standing')
    expect(GAMES.map((game) => game.name)).toContain('Predictor Championship')
  })

  it('never says a game is joined for you', () => {
    // E.6: no copy may imply that following a competition enters a game, or
    // that entering one game enrols you in another. This checks the shape of
    // the claim rather than a blocklist of words — a phrase that awards
    // membership automatically is the defect, however it is spelled.
    const prose = [
      ...GAMES.map((game) => `${game.body} ${game.meta}`),
      ...HOW_STEPS.map((step) => step.body),
    ].join(' ')

    expect(prose).not.toMatch(/automatically (join|enter|enrol)/i)
    expect(prose).not.toMatch(/(joins?|enters?) you (in|into)/i)
    // And the independence is stated somewhere rather than merely not denied.
    expect(prose).toMatch(/separately|independent/i)
  })

  it('gives the desktop preview exactly three contextual slots (E.7)', () => {
    // E.7 names the count and the three kinds. A fourth slot is a design
    // decision that has to be taken in the authority first, not in a component.
    expect(PREVIEW_CONTEXT_SLOTS).toHaveLength(3)
    expect(PREVIEW_CONTEXT_SLOTS.map((slot) => slot.kind)).toEqual([
      'time-critical',
      'live',
      'social',
    ])
  })

  it('describes both previews as previews, for assistive technology', () => {
    // The previews are pictures of the product carrying invented ranks and
    // points. Their accessible name is the only thing standing between a
    // screen-reader user and hearing those numbers as their own standings, so
    // each has to say what it is.
    for (const description of [HUB_PREVIEW_DESCRIPTION, PHONE_PREVIEW_DESCRIPTION]) {
      expect(description).toMatch(/^Preview of the signed-in Hub/)
      expect(description.length).toBeGreaterThan(80)
    }
  })

  it('keeps the preview league table obviously illustrative', () => {
    // One viewer row, invented names, and a size no real league is pinned to.
    // If a real standing ever reaches this page it must come from the standings
    // authority instead — a second source of ranked football numbers is what
    // ADR 0011 forbids.
    expect(PREVIEW_LEAGUE_ROWS.filter((row) => row.isViewer)).toHaveLength(1)
    expect(PREVIEW_LEAGUE_ROWS.map((row) => row.position)).toEqual([1, 2, 3, 4, 5])
  })

  it('only offers navigation to sections the page actually renders', () => {
    // A public nav anchor pointing at a removed section is a link to nowhere,
    // and the page's own anchors are the only navigation it has.
    for (const { id } of LANDING_NAV) {
      expect(LANDING_SECTION_ORDER).toContain(id)
    }
  })
})
