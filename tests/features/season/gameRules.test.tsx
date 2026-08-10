import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  LAST_MAN_STANDING_RULES,
  MATCH_PREDICTOR_RULES,
  PREDICTOR_CHAMPIONSHIP_RULES,
  seasonGameRules,
} from '../../../src/features/season/gameRules'
import { GameRulesDisclosure } from '../../../src/features/season/GameRulesDisclosure'
import {
  SEASON_JOKERS_PER_HALF,
  SEASON_JOKERS_PER_SEASON,
  SEASON_PREDICTOR_POINTS,
} from '../../../src/domain/season/scoring'
import { LMS_PUBLIC_JOINT_WINNER_CAP } from '../../../src/domain/season/lmsRoundResolution'
import { CUP_TIE_MATCH_POINTS } from '../../../src/domain/season/cupTieSettlement'

/**
 * The rules a season player is shown, against the rules the season runs on.
 *
 * THE FAILURE THIS PREVENTS is a second scoring authority written as prose. A
 * rules panel that says "5 points for an exact score" in a string literal is
 * correct exactly until the day it is not, and nothing fails when it stops
 * being true. So the assertions read the constants and require the text to
 * contain what they hold — and the source guard below requires the module to
 * import them rather than restate them, which is the part a passing string
 * comparison would not catch.
 */

const source = readFileSync(
  resolve(process.cwd(), 'src/features/season/gameRules.ts'),
  'utf8',
)

describe('the numbers come from the authority', () => {
  it('states the two Match Predictor values the scoring module holds', () => {
    const text = MATCH_PREDICTOR_RULES.sections.flatMap((section) => section.lines).join(' ')
    expect(text).toContain(`Exact score: ${SEASON_PREDICTOR_POINTS.exactScore} points`)
    expect(text).toContain(
      `Correct result, wrong score: ${SEASON_PREDICTOR_POINTS.correctResult} points`,
    )
    // The rule people get wrong, said explicitly rather than left to arithmetic.
    expect(text).toMatch(/replaces the 3, it does not add to it/)
  })

  it('states the Joker allowance the scoring module holds', () => {
    const text = MATCH_PREDICTOR_RULES.sections.flatMap((section) => section.lines).join(' ')
    expect(text).toContain(`${SEASON_JOKERS_PER_SEASON} a season`)
    expect(text).toContain(`${SEASON_JOKERS_PER_HALF} in each half`)
    expect(text).toContain('doubles your points for the whole matchweek')
  })

  it('describes the PUBLIC Last Man Standing setup, and says so', () => {
    const text = LAST_MAN_STANDING_RULES.sections.flatMap((section) => section.lines).join(' ')
    // The public competition is Classic: no lives, no saves, a draw eliminates.
    expect(text).toContain('no extra lives and no saves')
    expect(text).toContain('A draw eliminates you')
    expect(text).toContain(`up to ${LMS_PUBLIC_JOINT_WINNER_CAP} of them`)
    // A private competition may be set up differently, and the copy does not
    // claim otherwise.
    expect(text).toMatch(/A private competition can be set up differently/)
  })

  it('states the Championship tie points the settlement module holds', () => {
    const text = PREDICTOR_CHAMPIONSHIP_RULES.sections
      .flatMap((section) => section.lines)
      .join(' ')
    expect(text).toContain(
      `A win is worth ${CUP_TIE_MATCH_POINTS.win} points in the table, a draw ${CUP_TIE_MATCH_POINTS.draw}, a defeat ${CUP_TIE_MATCH_POINTS.loss}`,
    )
  })
})

describe('it is not a second authority', () => {
  it('imports every figure it quotes', () => {
    for (const symbol of [
      'SEASON_PREDICTOR_POINTS',
      'SEASON_JOKERS_PER_SEASON',
      'SEASON_JOKERS_PER_HALF',
      'LMS_PUBLIC_JOINT_WINNER_CAP',
      'CUP_TIE_MATCH_POINTS',
      'publicLmsSetup',
    ]) {
      expect(source, `${symbol} is not imported`).toMatch(
        new RegExp(`import[\\s\\S]*?${symbol}[\\s\\S]*?from`),
      )
    }
  })

  it('never sends a domestic player to the Euro scoring document', () => {
    // `docs/scoring-rules.md` is the preserved Euro Original Predictor
    // configuration: a different game with a different scale. The docstring
    // names it to explain the absence, so the guard is on a LINK rather than a
    // mention.
    expect(source).not.toMatch(/href=|\]\(.*scoring-rules/)
  })

  it('reaches no tournament scoring module', () => {
    expect(source).not.toMatch(/domain\/tournament/)
  })
})

describe('the disclosure', () => {
  it('is collapsed until asked, and then shows the sections', () => {
    render(<GameRulesDisclosure rules={seasonGameRules('main_predictor')} />)
    const trigger = screen.getByRole('button', { name: /How Match Predictor works/ })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Points')).not.toBeInTheDocument()

    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Points')).toBeInTheDocument()
    expect(screen.getByText('The Joker')).toBeInTheDocument()
  })

  it('renders nothing at all for a game it has no rules for', () => {
    const { container } = render(<GameRulesDisclosure rules={null} />)
    // Not an empty panel and not a generic paragraph: a game this build does
    // not describe gets no explanation rather than a possibly wrong one.
    expect(container).toBeEmptyDOMElement()
  })
})
