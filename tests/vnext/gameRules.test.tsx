import { describe, expect, it } from 'vitest'
import { expectNoAxeViolations } from './vnextAxe'
import { fireEvent, render, screen } from '@testing-library/react'
import { VNextGameRules } from '../../src/vnext/rules/VNextGameRules'
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
    expect(zone('rules-panel')?.textContent).toMatch(/head-to-head fixture/i)
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

  it('does not list the Championship’s tie-breaks, which are another authority’s', () => {
    render(<VNextGameRules game="championship" />)
    const panel = zone('rules-panel')?.textContent ?? ''
    expect(panel).not.toMatch(/extra time|penalty number/i)
    expect(zone('rules-elsewhere')?.textContent).toMatch(/shown on the tie itself/i)
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
