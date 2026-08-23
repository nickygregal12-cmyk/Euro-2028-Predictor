import { describe, expect, it } from 'vitest'
import {
  DOMESTIC_COMPETITIONS,
  GAMES,
  HOW_STEPS,
  LANDING_NAV,
  LANDING_SECTION_ORDER,
  LEGAL_LINKS,
} from '../../../src/features/landing/landingContent'
import {
  PREVIEW_STEPS,
  previewStepAt,
} from '../../../src/features/landing/landingPreviewScript'
import {
  MARKETING_PHASES,
  marketingPhaseAt,
} from '../../../src/vnext/fixtures/marketing/story'

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
    // ORDER IS NOT PROMINENCE, and this asserts only the order. The three are
    // peers — the case below holds that — and Match Predictor leads because it
    // is the one whose card the other two are built on top of, which is a fact
    // about the formats rather than a ranking of them.
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

    // AND THE FACT IS STATED SOMEWHERE, IN WHATEVER WORDS FIT. This used to
    // demand the literal `separately` or `independent`, which forced a
    // specification's vocabulary onto an acquisition page: the copy read "every
    // game is joined separately and scored on its own", which is true, is a
    // sentence somebody wrote to settle a product rule, and makes no stranger
    // want to predict any football. The REQUIREMENT is that a visitor is not
    // left believing one sign-up enrols them in three games. "Each game is its
    // own competition" carries that; so would half a dozen other phrasings, and
    // this accepts them.
    expect(prose).toMatch(/separately|independent|its own competition|on its own/i)
  })

  it('gives the three weekly games equal prominence', () => {
    // The product direction is explicit that Match Predictor, Last Man Standing
    // and the Predictor Championship carry equal weight, and ADR 0012-0014 make
    // them three separate games rather than one product with two add-ons. This
    // copy used to lead with "the weekly foundation" and describe the other two
    // as things to "discover later", which taught a visitor to expect a
    // hierarchy the signed-in product does not have.
    expect(GAMES).toHaveLength(3)

    const prose = GAMES.map((game) => `${game.body} ${game.meta}`).join(' ')

    // No game is ranked against another, and none is described as secondary.
    expect(prose).not.toMatch(/foundation|optional|extra|add-on|the rest|later/i)
    // "start with" and "begin with" rank the games. A group stage that comes
    // before a knockout does not, so the ordering words are matched only where
    // they are about which GAME to play.
    expect(prose).not.toMatch(/start with|begin with|then the others|once you have mastered/i)

    // Each says the same KIND of thing: what you do, and how often.
    for (const game of GAMES) {
      expect(game.body.length, `${game.name} has no description`).toBeGreaterThan(40)
      expect(game.meta, `${game.name} does not say how often it is played`).toMatch(
        /every/i,
      )
    }

    // And they are comparable in weight rather than one being three times the
    // length of another, which is prominence by another means.
    const lengths = GAMES.map((game) => game.body.length)
    expect(Math.max(...lengths) / Math.min(...lengths)).toBeLessThan(1.6)
  })

  it('pairs every caption with the phase it describes, one for one', () => {
    // THE DEFECT THIS WHOLE REBUILD EXISTS TO END, in its smallest form. The
    // product half of the preview and the words around it are two files now, and
    // a caption that had drifted off its phase would describe the wrong picture
    // — the same failure as the old page's, at a smaller scale.
    expect(PREVIEW_STEPS.map((step) => step.id)).toEqual(
      MARKETING_PHASES.map((phase) => phase.id),
    )
  })

  it('moves around the Competition Deck rather than sitting on one screen', () => {
    // A five-phase story that never left Home would render perfectly and say
    // nothing about the product's shape, which is the thing the page exists to
    // show. All four destinations appear, and none of them is Hub, Predict or
    // More — the information architecture the product retired and the old
    // preview was still advertising.
    const visited = new Set(MARKETING_PHASES.map((phase) => phase.destination))
    expect([...visited].sort()).toEqual(['games', 'home', 'leagues', 'matches'])
  })

  it('describes every phase as a preview, for assistive technology', () => {
    // The device is a picture of the product carrying an invented competition,
    // table and points. Its accessible name is the only thing standing between a
    // screen-reader user and hearing those numbers as their own standings, so
    // each phase has to say what it is — and because the device changes, EACH
    // PHASE has to, not just the first.
    for (const step of PREVIEW_STEPS) {
      expect(step.description, `${step.id} is not described as a preview`).toMatch(
        /^Preview of the signed-in product on (Home|Matches|Games|Leagues)/,
      )
      expect(step.description.length).toBeGreaterThan(80)
    }
  })

  it('says what CHANGED at every step, so the motion is not decoration', () => {
    for (const step of PREVIEW_STEPS) {
      expect(step.step.length, `${step.id} has no caption`).toBeGreaterThan(8)
      expect(step.headline.length, `${step.id} does not say what changed`).toBeGreaterThan(24)
    }
  })

  it('runs a deterministic script with no clock and no randomness', () => {
    // The whole reason the preview may exist on a public page: it reads nothing.
    // Two visitors, two renders and a screenshot runner see the same sequence in
    // the same order, which is also what makes a visual baseline possible.
    expect(PREVIEW_STEPS.length).toBe(5)
    const ids = PREVIEW_STEPS.map((step) => step.id)
    expect(new Set(ids).size).toBe(ids.length)
    // Total by construction, including from a negative step, on both halves.
    expect(previewStepAt(0)).toBe(PREVIEW_STEPS[0])
    expect(previewStepAt(PREVIEW_STEPS.length)).toBe(PREVIEW_STEPS[0])
    expect(previewStepAt(-1)).toBe(PREVIEW_STEPS[PREVIEW_STEPS.length - 1])
    expect(marketingPhaseAt(0)).toBe(MARKETING_PHASES[0])
    expect(marketingPhaseAt(MARKETING_PHASES.length)).toBe(MARKETING_PHASES[0])
    expect(marketingPhaseAt(-1)).toBe(MARKETING_PHASES[MARKETING_PHASES.length - 1])
  })

  it('never previews another player\u2019s unrevealed prediction', () => {
    // A marketing page must not teach a visitor to expect the product to break a
    // reveal rule. The league phase is a SETTLED matchweek, which is when the
    // real product reveals.
    const leagues = MARKETING_PHASES.find((phase) => phase.destination === 'leagues')
    expect(leagues?.surface.kind).toBe('leagues')
    if (leagues?.surface.kind === 'leagues') {
      expect(leagues.surface.model.private?.movementSettled).toBe(true)
    }
  })

  it('names no real person as a player', () => {
    // The workshop's signed-in player carries the repository owner's own name,
    // which is unremarkable in a private review surface and wrong on a public
    // page: a stranger reads a named individual as a real person with a real
    // standing. `MARKETING_PLAYER` replaces it everywhere the viewer is drawn,
    // and this is the case that notices when a new phase forgets to.
    for (const phase of MARKETING_PHASES) {
      expect(phase.shell.player.name).toBe('Rowan Adeyemi')
      if (phase.surface.kind === 'home') {
        expect(phase.surface.model.user.name).toBe('Rowan Adeyemi')
      }
      if (phase.surface.kind === 'leagues') {
        const you = phase.surface.model.private?.you
        if (you) expect(you.player.displayName).toBe('Rowan Adeyemi')
      }
    }
  })

  it('previews a ONE-competition product, which is what a new player gets', () => {
    // The shell's binding product test, applied to the acquisition page. A
    // visitor deciding whether to sign up should see the small product, because
    // that is the one they will get — not a twenty-competition dashboard with
    // one thing selected.
    for (const phase of MARKETING_PHASES) {
      expect(phase.shell.contexts).toHaveLength(1)
      expect(phase.shell.attention).toEqual([])
    }
  })

  it('draws no legal link to a document that does not exist', () => {
    // A footer link that answers Not Found reads as a document that exists and
    // was withheld, which is worse than an absent one. Privacy and Terms are
    // DECLARED so the deferral is visible and publishing either is a one-line
    // change — and they carry no route until there is one.
    expect(LEGAL_LINKS.map((link) => link.label)).toEqual([
      'About & Disclaimer',
      'Privacy',
      'Terms',
    ])
    expect(LEGAL_LINKS.find((link) => link.label === 'About & Disclaimer')?.to).toBe('/about')
    expect(LEGAL_LINKS.find((link) => link.label === 'Privacy')?.to).toBeNull()
    expect(LEGAL_LINKS.find((link) => link.label === 'Terms')?.to).toBeNull()
  })

  it('only offers navigation to sections the page actually renders', () => {
    // A public nav anchor pointing at a removed section is a link to nowhere,
    // and the page's own anchors are the only navigation it has.
    for (const { id } of LANDING_NAV) {
      expect(LANDING_SECTION_ORDER).toContain(id)
    }
  })
})
