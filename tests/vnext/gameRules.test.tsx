import { describe, expect, it } from 'vitest'
import { expectNoAxeViolations } from './vnextAxe'
import { fireEvent, render, screen } from '@testing-library/react'
import { VNextGameRules } from '../../src/vnext/rules/VNextGameRules'
import { CUP_TIE_MATCH_POINTS } from '../../src/domain/season/cupTieSettlement'
import {
  SEASON_JOKERS_PER_HALF,
  SEASON_JOKERS_PER_SEASON,
  SEASON_PREDICTOR_POINTS,
} from '../../src/domain/season/scoring'

/**
 * HOW THE GAMES SCORE.
 *
 *   1. ONE GAME ON SCREEN. Three stacked lists is the shape this replaces.
 *   2. EVERY NUMBER IS THE DOMAIN'S. The scoring authority forbids recreating
 *      the rules in presentation code to explain them, so these assert against
 *      the constants rather than against literals — a test with its own `5` in
 *      it would keep passing the day the rule changed.
 *   3. NO PER-COMPETITION SETTING IS INVENTED.
 */

const zone = (name: string) =>
  document.querySelector(`[data-vnext-zone="${name}"]`) as HTMLElement | null

describe('one game is on screen at a time', () => {
  it('opens on the game the caller is in', () => {
    render(<VNextGameRules game="championship" />)
    expect(zone('rules')?.getAttribute('data-game')).toBe('championship')
    expect(zone('rules-panel')?.textContent).toMatch(/head-to-head tie/i)
    // The other games' rules are not also on screen.
    expect(zone('rules-panel')?.textContent).not.toMatch(/one club a round/i)
  })

  it('defaults to the Match Predictor where the caller named no game', () => {
    render(<VNextGameRules />)
    expect(zone('rules')?.getAttribute('data-game')).toBe('match-predictor')
  })

  it('switches when another game is chosen', () => {
    render(<VNextGameRules />)
    fireEvent.click(screen.getByRole('radio', { name: 'Last Man Standing' }))
    expect(zone('rules')?.getAttribute('data-game')).toBe('last-man-standing')
    expect(zone('rules-panel')?.textContent).toMatch(/one club a round/i)
    expect(zone('rules-panel')?.textContent).not.toMatch(/Exact score/i)
  })

  it('offers all three games as one group, so a screen reader hears the choice', () => {
    render(<VNextGameRules />)
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(3)
    // One group name, so arrow keys move between them rather than into the page.
    expect(new Set(radios.map((r) => (r as HTMLInputElement).name)).size).toBe(1)
    expect(screen.getByRole('group', { name: /which game/i })).toBeInTheDocument()
  })

  it('marks exactly one as chosen', () => {
    render(<VNextGameRules game="last-man-standing" />)
    const checked = screen.getAllByRole('radio').filter((r) => (r as HTMLInputElement).checked)
    expect(checked).toHaveLength(1)
    expect(checked[0]).toHaveAccessibleName('Last Man Standing')
  })
})

describe('every number comes from the scoring authority', () => {
  it('prints the exact-score and correct-result values it holds', () => {
    render(<VNextGameRules game="match-predictor" />)
    const panel = zone('rules-panel')?.textContent ?? ''
    expect(panel).toContain(`+${SEASON_PREDICTOR_POINTS.exactScore}`)
    expect(panel).toContain(`+${SEASON_PREDICTOR_POINTS.correctResult}`)
  })

  it('prints both Joker limits from their constants, IN THEIR OWN CLAUSES', () => {
    render(<VNextGameRules game="match-predictor" />)
    const panel = (zone('rules-panel')?.textContent ?? '').replace(/\s+/g, ' ')

    // NOT `toContain(String(n))`. Both limits are single digits and the panel
    // is full of them — `+5` from the exact-score row satisfies a bare
    // `toContain('5')`, so that form passed while the half limit printed 99,
    // printed the season limit in the half's place, or was deleted outright.
    // Each number is asserted inside the clause that gives it its meaning.
    expect(panel).toContain(`You get ${SEASON_JOKERS_PER_SEASON} a season`)
    expect(panel).toContain(`no more than ${SEASON_JOKERS_PER_HALF} in either half`)

    // And the two are genuinely different numbers, so neither clause can be
    // satisfied by the other's value.
    expect(SEASON_JOKERS_PER_SEASON).not.toBe(SEASON_JOKERS_PER_HALF)
  })

  it('says the Joker doubles a matchweek rather than a fixture', () => {
    render(<VNextGameRules game="match-predictor" />)
    // ADR 0012 doubles the WHOLE matchweek. Saying otherwise teaches a rule the
    // authority does not implement.
    expect(zone('rules-panel')?.textContent).toMatch(/doubles a whole matchweek, not one fixture/i)
  })
})

describe('no per-competition setting is invented', () => {
  it('says where Last Man Standing’s settings live when it was not given them', () => {
    render(<VNextGameRules game="last-man-standing" />)
    expect(zone('rules-elsewhere')?.textContent).toMatch(/set by whoever runs the competition/i)
    // NO RULE IS STATED for a thing this block does not know. Asserted on the
    // rows rather than the words: the sentence above says where lives are SET,
    // which is the opposite of stating one.
    expect(zone('rules-panel')?.querySelectorAll('[data-vnext-rule]')).toHaveLength(0)
  })

  it('states them where the caller supplied them', () => {
    render(
      <VNextGameRules
        game="last-man-standing"
        lmsRules={{ lives: 2, saves: 1, drawsRule: 'A draw counts as a win.' }}
      />,
    )
    const panel = zone('rules-panel')?.textContent ?? ''
    expect(panel).toContain('Lives')
    expect(panel).toContain('2')
    expect(panel).toContain('A draw counts as a win.')
    expect(zone('rules-elsewhere')).toBeNull()
  })

  it('omits the draws rule where the organiser stored none', () => {
    render(
      <VNextGameRules
        game="last-man-standing"
        lmsRules={{ lives: 1, saves: 0, drawsRule: null }}
      />,
    )
    expect(zone('rules-panel')?.querySelector('[data-vnext-rule="Lives"]')).not.toBeNull()
    expect(zone('rules-panel')?.textContent).not.toMatch(/draw/i)
  })

  it('prints the Championship’s table points from the settlement authority', () => {
    // NOT RETYPED. The same three constants `cupTieSettlement.ts` awards and
    // `cupGroupTable.ts` totals, so a rule change moves the copy with it.
    render(<VNextGameRules game="championship" />)
    const panel = zone('rules-panel')!
    expect(panel.querySelector('[data-vnext-rule="Win a tie"]')?.textContent).toContain(
      `+${CUP_TIE_MATCH_POINTS.win}`,
    )
    expect(panel.querySelector('[data-vnext-rule="Draw a tie"]')?.textContent).toContain(
      `+${CUP_TIE_MATCH_POINTS.draw}`,
    )
    expect(panel.querySelector('[data-vnext-rule="Lose a tie"]')?.textContent).toContain(
      `+${CUP_TIE_MATCH_POINTS.loss}`,
    )
  })

  it('states the three deciders in the settlement authority’s own order', () => {
    // WHY THIS REPLACED "does not list the tie-breaks". Stage 13 left them out
    // on the grounds that they were another authority's, and the result was a
    // player who read "Decided in extra time" on their own tie with nowhere to
    // find out what that meant. The order is the settler's: closer scorelines,
    // then the sealed number, then a walkover — and asserting the ORDER is what
    // stops the block quietly becoming a second settlement rule.
    render(<VNextGameRules game="championship" />)
    const steps = [...(zone('rules-panel')?.querySelectorAll('ol li') ?? [])].map(
      (node) => node.textContent ?? '',
    )
    expect(steps).toHaveLength(3)
    expect(steps[0]).toMatch(/extra time/i)
    expect(steps[1]).toMatch(/penalty number/i)
    expect(steps[2]).toMatch(/walkover/i)
    // The lane rule, stated where it can be understood in advance rather than
    // learnt from a `check_violation`.
    expect(steps[1]).toMatch(/odd/i)
    expect(steps[1]).toMatch(/even/i)
  })

  it('says a Joker never reaches a Championship tie', () => {
    // The non-obvious rule and the one worth the space: `cupTieSettlement.ts`
    // REJECTS fixture points outside the raw scale rather than trusting a
    // caller not to have doubled them.
    render(<VNextGameRules game="championship" />)
    expect(zone('rules-panel')?.textContent).toMatch(/Joker.*never your tie/i)
  })

  it('states neither Championship phase as this competition’s plan', () => {
    // Whether a season ends in a knockout is calendar arithmetic contract 198
    // computes, not a fact a rules block can know. It describes the split and
    // says the Championship page holds the real answer.
    render(<VNextGameRules game="championship" />)
    const panel = zone('rules-panel')?.textContent ?? ''
    expect(panel).toMatch(/nobody is knocked out by the split/i)
    expect(panel).toMatch(/says whether yours has one/i)
  })
})

describe('the rules control passes the accessibility scan', () => {
  // The segmented control is the one brand-new interactive control this stage
  // introduced, and it is a radio group with screen-reader-only inputs. That
  // combination is exactly what an axe gate is for.
  it.each(['match-predictor', 'last-man-standing', 'championship'] as const)(
    'the %s panel has no critical or serious violation',
    async (game) => {
      await expectNoAxeViolations(<VNextGameRules game={game} />)
    },
  )
})
