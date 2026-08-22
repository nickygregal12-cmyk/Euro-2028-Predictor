import type { ComponentProps, ComponentType } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import { homeScenarios, shellScenarios } from '../../src/vnext/fixtures'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { VNextHome } from '../../src/vnext/home/VNextHome'
import type { HomeModel, PrimaryActionType } from '../../src/vnext/models/home'

type PrimaryActionIntent = {
  readonly kind: 'primary-action'
  readonly actionType: PrimaryActionType
}

type InteractiveHomeProps = ComponentProps<typeof VNextHome> & {
  readonly onIntent?: ((intent: PrimaryActionIntent) => void) | undefined
}

// The cast is deliberate in the regression-first commit: current Home has no
// intent seam, which is the defect. Keeping the expected prop local lets this
// test execute against that current implementation and fail on the dead button
// rather than failing earlier at TypeScript compilation.
const InteractiveHome = VNextHome as ComponentType<InteractiveHomeProps>

function renderHome(
  model: HomeModel,
  onIntent: (intent: PrimaryActionIntent) => void,
) {
  return render(
    <VNextRoot>
      <VNextShellProvider model={shellScenarios.oneCompetition}>
        <InteractiveHome model={model} onIntent={onIntent} />
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
})
