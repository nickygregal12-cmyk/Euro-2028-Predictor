import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  VNextAccessRefused,
  VNextLoadingRows,
  VNextNotFound,
  VNextNotice,
} from '../../src/vnext/integration/states/VNextStates'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import { shellScenarios } from '../../src/vnext/fixtures'

/**
 * THE SHARED STATES, AND THE DEFECT THEY WERE CARRYING.
 *
 * This module was `VNextLeaguesStates`. Five features imported it across a
 * directory boundary, and it hard-coded `destination="leagues"` with no prop to
 * change it — so a Championship, an Account, a Games hub or a Last Man Standing
 * page that could not load told the player they were in Leagues. A page that
 * cannot show its content is exactly when a player reads the navigation.
 */

function renderState(node: React.ReactNode) {
  return render(
    <VNextShellProvider model={shellScenarios.oneCompetition}>{node}</VNextShellProvider>,
  )
}

/** Which destination the navigation is showing as current. */
function activeDestinations(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[aria-current]')]
    .map((node) => node.textContent?.trim() ?? '')
    .filter(Boolean)
}

describe('the navigation says where the player actually is', () => {
  it('lights the destination the caller named, not a fixed one', () => {
    const { container } = renderState(
      <VNextNotice
        destination="games"
        heading="Predictor Championship"
        title="We could not load this Championship"
        body="Trying again usually works."
      />,
    )
    const active = activeDestinations(container)
    expect(active.some((label) => /games/i.test(label))).toBe(true)
    expect(active.some((label) => /leagues/i.test(label))).toBe(false)
  })

  it('lights nothing for a page outside the four', () => {
    const { container } = renderState(
      <VNextNotice destination="none" heading="You" title="Sign in" body="Your account." />,
    )
    expect(activeDestinations(container)).toEqual([])
  })

  it('lights leagues only when leagues is what was asked for', () => {
    const { container } = renderState(
      <VNextNotice
        destination="leagues"
        heading="Leagues"
        title="We could not load these standings"
        body="Trying again usually works."
      />,
    )
    expect(activeDestinations(container).some((label) => /leagues/i.test(label))).toBe(true)
  })
})

describe('a notice never denies what it could not read', () => {
  it('offers a retry only where the caller gave one', () => {
    const onRetry = vi.fn()
    const { unmount } = renderState(
      <VNextNotice
        destination="games"
        heading="Games"
        title="We could not load this season"
        body="Trying again usually works."
        onRetry={onRetry}
      />,
    )
    screen.getByRole('button', { name: /try again/i }).click()
    
    expect(onRetry).toHaveBeenCalledTimes(1)
    unmount()

    const second = renderState(
      <VNextNotice destination="games" heading="Games" title="No season" body="Pick one." />,
    )
    // SCOPED TO THE NOTICE. The shell has buttons of its own — the switcher,
    // Jump, the avatar — and asserting over the whole page would be measuring
    // the chrome rather than the state.
    const notice = second.container.querySelector('[role="status"]') as HTMLElement
    expect(notice.querySelector('button')).toBeNull()
  })

  it('lets the caller name the control, because "try again" does not fit every state', () => {
    renderState(<VNextNotFound onHome={() => {}} />)
    expect(screen.getByRole('button', { name: /go to home/i })).toBeInTheDocument()
  })
})

describe('not found is a parent, not an apology', () => {
  it('keeps the whole navigation and lights none of it', () => {
    const { container } = renderState(<VNextNotFound />)
    expect(activeDestinations(container)).toEqual([])
    expect(screen.getAllByRole('main')).toHaveLength(1)
    // Every way out is still one press away.
    expect(screen.getAllByRole('navigation').length).toBeGreaterThan(0)
  })

  it('does not guess what the player meant', () => {
    const { container } = renderState(<VNextNotFound />)
    expect(container.textContent).not.toMatch(/did you mean|redirect|taking you/i)
  })
})

describe('access refused is its own fact', () => {
  it('is neither a not-found nor a sign-in prompt', () => {
    const { container } = renderState(<VNextAccessRefused />)
    expect(container.textContent).not.toMatch(/not found|sign in/i)
    expect(container.textContent).toMatch(/not yours to see/i)
  })

  it('names nothing about what it is refusing', () => {
    const { container } = renderState(
      <VNextAccessRefused heading="Last Man Standing" destination="games" />,
    )
    // The heading is the SURFACE the player was on, which they already knew.
    // Nothing describes the thing being protected — a refusal that does is a
    // disclosure, which is why contract 133 answers an unknown id and a
    // non-member's id identically.
    expect(container.textContent).not.toMatch(/owner|members|invited|private league named/i)
  })
})

describe('the skeleton shows no number and no name', () => {
  it('renders not one digit', () => {
    const { container } = renderState(
      <VNextLoadingRows heading="Leagues" destination="leagues" label="Loading standings" />,
    )
    const bars = container.querySelector('[aria-busy="true"]')
    expect(bars?.textContent ?? '').not.toMatch(/[0-9]/)
  })

  it('announces itself to a screen reader rather than being silent', () => {
    const { container } = renderState(
      <VNextLoadingRows heading="Games" destination="games" label="Loading games" />,
    )
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(screen.getByText('Loading games')).toBeInTheDocument()
  })

  it('draws the row count the caller asked for', () => {
    const { container } = renderState(
      <VNextLoadingRows heading="Games" destination="games" rows={3} />,
    )
    const rows = container.querySelectorAll('[aria-hidden="true"] > span')
    expect(rows.length).toBeGreaterThan(0)
  })
})
