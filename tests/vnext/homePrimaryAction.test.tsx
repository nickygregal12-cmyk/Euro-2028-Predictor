import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  competitionGameRoute,
  competitionMatchCentreRoute,
  competitionSectionRoute,
} from '../../src/app/weeklyRoutes'
import { homeIntentRoute } from '../../src/app/vnext/homeNavigation'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import { homeScenarios, shellScenarios } from '../../src/vnext/fixtures'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { VNextHome, type HomeIntent } from '../../src/vnext/home/VNextHome'
import type { HomeModel } from '../../src/vnext/models/home'

function renderHome(
  model: HomeModel,
  onIntent: (intent: HomeIntent) => void,
) {
  return render(
    <VNextRoot>
      <VNextShellProvider model={shellScenarios.oneCompetition}>
        <VNextHome model={model} onIntent={onIntent} />
      </VNextShellProvider>
    </VNextRoot>,
  )
}

describe('Home primary actions', () => {
  it('emits the join-league action when the banner says Find a league', () => {
    const onIntent = vi.fn()
    renderHome(homeScenarios.newSeason, onIntent)

    fireEvent.click(screen.getByRole('button', { name: 'Find a league' }))

    expect(onIntent).toHaveBeenCalledWith({
      kind: 'primary-action',
      actionType: 'joinLeague',
    })
  })

  it('emits the predict action from the decision hero', () => {
    const onIntent = vi.fn()
    renderHome(homeScenarios.decision, onIntent)

    fireEvent.click(screen.getByRole('button', { name: /Make your prediction/ }))

    expect(onIntent).toHaveBeenCalledWith({
      kind: 'primary-action',
      actionType: 'predict',
    })
  })

  it('emits the featured fixture when the banner promises Match centre', () => {
    const onIntent = vi.fn()
    const featured = homeScenarios.live.liveMatches.find((match) => match.isFeatured)
    if (featured === undefined) throw new Error('live Home must expose a featured fixture')

    renderHome(homeScenarios.live, onIntent)
    fireEvent.click(screen.getByRole('button', { name: 'Match centre' }))

    expect(onIntent).toHaveBeenCalledWith({
      kind: 'primary-action',
      actionType: 'watchLive',
      matchId: featured.id,
    })
  })

  it('routes every existing action to its accepted application destination', () => {
    const context = {
      competitionSlug: 'premier-league',
      seasonSlug: '2027-28',
    }

    expect(homeIntentRoute(context, { kind: 'primary-action', actionType: 'predict' })).toBe(
      competitionGameRoute(context, 'match-predictor'),
    )
    expect(homeIntentRoute(context, { kind: 'primary-action', actionType: 'review' })).toBe(
      competitionGameRoute(context, 'match-predictor'),
    )
    expect(homeIntentRoute(context, { kind: 'primary-action', actionType: 'joinLeague' })).toBe(
      competitionSectionRoute(context, 'leagues'),
    )
    expect(
      homeIntentRoute(context, {
        kind: 'primary-action',
        actionType: 'watchLive',
        matchId: 'fixture-live',
      }),
    ).toBe(competitionMatchCentreRoute(context, 'fixture-live'))
  })
})
