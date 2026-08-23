import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { competitionGameRoute } from '../../src/app/weeklyRoutes'
import { homeIntentRoute } from '../../src/app/vnext/homeNavigation'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import { homeScenarios, shellScenarios } from '../../src/vnext/fixtures'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { VNextHome, type HomeIntent } from '../../src/vnext/home/VNextHome'
import type { HomeModel } from '../../src/vnext/models/home'

/**
 * "ALSO THIS WEEK" — the rest of the player's week, as presentation.
 *
 * The mapping is proved in `homeCrossGameWeek.test.ts`; this file is about what
 * a player can SEE and PRESS. The distinction that matters most here is between
 * a report and a task: a settled or eliminated game is text, and only a game
 * still asking for something gets a control. That is the failure `DFA-006`
 * names — a passive state dressed as a job — and it is checked by asking for
 * buttons rather than by reading class names.
 */

function renderHome(model: HomeModel, onIntent: (intent: HomeIntent) => void) {
  return render(
    <VNextRoot>
      <VNextShellProvider model={shellScenarios.oneCompetition}>
        <VNextHome model={model} onIntent={onIntent} />
      </VNextShellProvider>
    </VNextRoot>,
  )
}

function zone() {
  return screen.getByRole('region', { name: 'Also this week' })
}

describe('Also this week', () => {
  it('is absent entirely for a player with one game', () => {
    renderHome(homeScenarios.live, vi.fn())

    expect(screen.queryByRole('region', { name: 'Also this week' })).toBeNull()
  })

  it('names the games the primary action is not about', () => {
    renderHome(homeScenarios.lmsFirst, vi.fn())

    expect(zone()).toHaveTextContent('Matchweek 12: 7 of 10 still to predict')
    expect(zone()).toHaveTextContent('Championship: Matchday 3 against Rowan Adeyemi')
  })

  it('gives a control only to the game that is still asking', () => {
    renderHome(homeScenarios.lmsFirst, vi.fn())

    // The Match Predictor is outstanding here and the Championship never is.
    const buttons = within(zone()).getAllByRole('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]).toHaveAccessibleName(/Predict this matchweek/)
  })

  it('draws a settled side game as text with nothing to press', () => {
    renderHome(homeScenarios.sideGamesSettled, vi.fn())

    expect(zone()).toHaveTextContent('Last Man Standing: Round 12 pick is in')
    expect(within(zone()).queryAllByRole('button')).toHaveLength(0)
  })

  it('never offers a pick to an eliminated player', () => {
    renderHome(homeScenarios.lmsEliminated, vi.fn())

    expect(zone()).toHaveTextContent('Last Man Standing: you are out')
    expect(within(zone()).queryByRole('button', { name: /Pick your club/ })).toBeNull()
  })

  it('sends the player to the game the row names', () => {
    const onIntent = vi.fn()
    renderHome(homeScenarios.lmsFirst, onIntent)

    fireEvent.click(within(zone()).getByRole('button', { name: /Predict this matchweek/ }))

    expect(onIntent).toHaveBeenCalledWith({ kind: 'open-predictor' })
  })

  it('keeps every row distinguishable to a screen reader', () => {
    renderHome(homeScenarios.lmsFirst, vi.fn())

    // The visible label is the verb; the game travels in the accessible name so
    // two rows never read as one repeated control.
    const button = within(zone()).getByRole('button', { name: /Predict this matchweek/ })
    expect(button).toHaveAccessibleName(/Match Predictor/)
  })
})

describe('the primary action when Last Man Standing leads', () => {
  it('promises the pick and goes to Last Man Standing', () => {
    const onIntent = vi.fn()
    renderHome(homeScenarios.lmsFirst, onIntent)

    fireEvent.click(screen.getByRole('button', { name: 'Pick your club' }))

    expect(onIntent).toHaveBeenCalledWith({ kind: 'open-lms' })
  })

  it('resolves that intent to the canonical LMS route', () => {
    const context = { competitionSlug: 'premier-league', seasonSlug: '2026-27' }

    expect(homeIntentRoute(context, { kind: 'open-lms' })).toBe(
      competitionGameRoute(context, 'lms'),
    )
    expect(homeIntentRoute(context, { kind: 'open-championship' })).toBe(
      competitionGameRoute(context, 'championship'),
    )
  })

  it('carries no Match Predictor progress fraction', () => {
    // "3 of 10" beside a single club pick would be another game's number.
    expect(homeScenarios.lmsFirst.primaryAction.progress).toBeNull()
  })
})
