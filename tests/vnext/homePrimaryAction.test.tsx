import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import { homeScenarios, shellScenarios } from '../../src/vnext/fixtures'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { VNextHome, type HomeIntent } from '../../src/vnext/home/VNextHome'
import { homeIntentToShellIntent } from '../../src/vnext/integration/home/VNextHomeScreen'
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

  it('routes every existing action type through an existing shell destination', () => {
    const contextId = 't-1'

    expect(
      homeIntentToShellIntent(
        { kind: 'primary-action', actionType: 'predict' },
        contextId,
      ),
    ).toEqual({ kind: 'game', game: 'match-predictor', contextId })

    expect(
      homeIntentToShellIntent(
        { kind: 'primary-action', actionType: 'review' },
        contextId,
      ),
    ).toEqual({ kind: 'game', game: 'match-predictor', contextId })

    expect(
      homeIntentToShellIntent(
        { kind: 'primary-action', actionType: 'watchLive' },
        contextId,
      ),
    ).toEqual({ kind: 'destination', destination: 'matches', contextId })

    expect(
      homeIntentToShellIntent(
        { kind: 'primary-action', actionType: 'joinLeague' },
        contextId,
      ),
    ).toEqual({ kind: 'destination', destination: 'leagues', contextId })
  })
})
