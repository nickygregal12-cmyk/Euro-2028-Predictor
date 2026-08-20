import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import { VNextMatchPredictor } from '../../src/vnext/predictor/VNextMatchPredictor'
import { predictorScenarios, shellScenarios } from '../../src/vnext/fixtures'
import type { PredictorActions, PredictorModel } from '../../src/vnext/models/predictor'

/**
 * A PREDICTION LANDING IS FOLLOWED, NOT PREDICTED.
 *
 * ============================ THE FAILURE THIS FORBIDS ==================
 *
 * A surface that confirmed on the keystroke would tell a player their
 * prediction was in before anybody had agreed that it was — and the save that
 * then failed would have been FELT as a success. The row would say "Not saved"
 * a second later, in the same place, after the device had already buzzed.
 *
 * So both halves of the confirmation — the haptic and the settle — follow the
 * save coordinator's transition into `saved`, which is the write coming back.
 * These cases hold that, because it is the sort of rule that is easy to
 * regress into something that feels faster.
 */

const vibrate = vi.fn()

Object.defineProperty(globalThis.navigator, 'vibrate', {
  value: vibrate,
  configurable: true,
  writable: true,
})

const INERT: PredictorActions = {
  setPrediction: () => {},
  clearPrediction: () => {},
  setJoker: () => {},
  confirmCard: () => {},
  retrySave: () => {},
  reload: () => {},
  refreshAfterDeadline: () => {},
}

function withSave(model: PredictorModel, id: string, save: 'saving' | 'saved' | 'error') {
  return {
    ...model,
    fixtures: model.fixtures.map((fixture) =>
      fixture.id === id ? { ...fixture, save } : fixture,
    ),
  }
}

function renderPredictor(model: PredictorModel) {
  return render(
    <VNextRoot>
      <VNextShellProvider model={shellScenarios.oneCompetition}>
        <VNextMatchPredictor model={model} actions={INERT} />
      </VNextShellProvider>
    </VNextRoot>,
  )
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('the confirmation follows the server', () => {
  const open = predictorScenarios.open
  const first = open.fixtures[0]

  it('says nothing on arrival, however much is already predicted', () => {
    // A card loads with predictions on it and NOTHING has been saved this
    // session — `saveStateOf` answers `idle` for a fixture the coordinator has
    // not touched. Buzzing here would congratulate a player for opening a page.
    renderPredictor(open)
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('says nothing while the write is still in flight', () => {
    renderPredictor(withSave(open, first?.id ?? '', 'saving'))
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('confirms once the coordinator reports the write came back', () => {
    const view = renderPredictor(withSave(open, first?.id ?? '', 'saving'))
    expect(vibrate).not.toHaveBeenCalled()

    view.rerender(
      <VNextRoot>
        <VNextShellProvider model={shellScenarios.oneCompetition}>
          <VNextMatchPredictor
            model={withSave(open, first?.id ?? '', 'saved')}
            actions={INERT}
          />
        </VNextShellProvider>
      </VNextRoot>,
    )

    expect(vibrate).toHaveBeenCalledTimes(1)
  })

  it('runs no success feedback when the write refused', () => {
    const view = renderPredictor(withSave(open, first?.id ?? '', 'saving'))

    view.rerender(
      <VNextRoot>
        <VNextShellProvider model={shellScenarios.oneCompetition}>
          <VNextMatchPredictor
            model={withSave(open, first?.id ?? '', 'error')}
            actions={INERT}
          />
        </VNextShellProvider>
      </VNextRoot>,
    )

    expect(vibrate).not.toHaveBeenCalled()
    // AND THE ROW SAYS SO, in the place the confirmation would have been.
    expect(screen.getAllByText('Not saved').length).toBeGreaterThan(0)
  })

  it('never confirms at all where the player has turned haptics off', () => {
    const view = render(
      <VNextRoot haptics="off">
        <VNextShellProvider model={shellScenarios.oneCompetition}>
          <VNextMatchPredictor
            model={withSave(open, first?.id ?? '', 'saving')}
            actions={INERT}
          />
        </VNextShellProvider>
      </VNextRoot>,
    )

    view.rerender(
      <VNextRoot haptics="off">
        <VNextShellProvider model={shellScenarios.oneCompetition}>
          <VNextMatchPredictor
            model={withSave(open, first?.id ?? '', 'saved')}
            actions={INERT}
          />
        </VNextShellProvider>
      </VNextRoot>,
    )

    expect(vibrate).not.toHaveBeenCalled()
  })
})
