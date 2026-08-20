import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import { VNextLms } from '../../src/vnext/lms/VNextLms'
import { lmsScenarios, shellScenarios } from '../../src/vnext/fixtures'
import type { LmsPageModel } from '../../src/vnext/models/lms'

/**
 * THE ONE CELEBRATION, AND THE THREE WAYS IT COULD BECOME CHEAP.
 *
 * Winning a Last Man Standing is the only achievement in this product that
 * gets its own motion, and it is worth having only while it stays rare. The
 * ways it stops being rare are all regressions somebody would make for a good
 * reason:
 *
 *   • it fires on ARRIVAL, so every visit to the page re-congratulates a
 *     player for something they won last month;
 *   • it fires for a standing that is not winning, because the condition got
 *     loosened to "not eliminated";
 *   • the device buzzes for a player who turned haptics off.
 *
 * Each is held below. The trophy itself is NOT conditional on any of it: the
 * mark is the fact, and only the beat is the moment.
 */

const vibrate = vi.fn()

Object.defineProperty(globalThis.navigator, 'vibrate', {
  value: vibrate,
  configurable: true,
  writable: true,
})

function lms(model: LmsPageModel, haptics?: 'on' | 'off') {
  return (
    <VNextRoot {...(haptics ? { haptics } : {})}>
      <VNextShellProvider model={shellScenarios.oneCompetition}>
        <VNextLms model={model} />
      </VNextShellProvider>
    </VNextRoot>
  )
}

function renderLms(model: LmsPageModel, haptics?: 'on' | 'off') {
  return render(lms(model, haptics))
}

afterEach(() => {
  vibrate.mockClear()
})

describe('winning a Last Man Standing', () => {
  it('says so, with the trophy, however the player arrived', () => {
    renderLms(lmsScenarios.champion)

    expect(screen.getByText('You are the last one standing.')).toBeInTheDocument()
  })

  it('does not congratulate a player who simply opened the page', () => {
    renderLms(lmsScenarios.champion)

    // ARMING, NOT FIRING. The standing was already true when the component
    // mounted, so there is no moment here — only a fact that was settled
    // before the player arrived.
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('congratulates the player once, when the standing becomes theirs', () => {
    const before: LmsPageModel = {
      ...lmsScenarios.champion,
      standing: 'active',
    }
    const { rerender } = renderLms(before)
    expect(vibrate).not.toHaveBeenCalled()

    rerender(lms(lmsScenarios.champion))

    expect(vibrate).toHaveBeenCalledTimes(1)
  })

  it('stays silent for a player who turned haptics off', () => {
    const before: LmsPageModel = {
      ...lmsScenarios.champion,
      standing: 'active',
    }
    const { rerender } = renderLms(before, 'off')

    rerender(lms(lmsScenarios.champion, 'off'))

    expect(vibrate).not.toHaveBeenCalled()
  })

  it('does not celebrate merely surviving', () => {
    const survived: LmsPageModel = {
      ...lmsScenarios.champion,
      standing: 'active',
    }
    const { rerender } = renderLms(survived)

    rerender(lms({ ...survived, standing: 'survived' }))

    expect(screen.getByText('You survived the last round.')).toBeInTheDocument()
    expect(vibrate).not.toHaveBeenCalled()
  })
})
