import { describe, expect, it, vi } from 'vitest'
import { expectNoAxeViolations } from './vnextAxe'
import { render, screen } from '@testing-library/react'
import {
  VNextAccessRefused,
  VNextLoadingRows,
  VNextNotFound,
  VNextNotice,
} from '../../src/vnext/states/VNextStates'
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

  it('names nothing about what it is refusing, whatever it is refusing', () => {
    // THE INVARIANT, NOT FOUR ARBITRARY WORDS. Asserting the absence of
    // "owner|members|invited" left the body free to name the thing being
    // protected in any other phrasing — "the private league Highland Rivals is
    // not yours to see" passed. What must actually hold is that the REFUSAL
    // ITSELF is byte-identical whatever was refused, which is why contract 133
    // answers an unknown id and a non-member's id identically: a refusal that
    // varies with its subject is an oracle.
    //
    // The heading is excluded because it is the SURFACE the player was already
    // on, which they knew before they got here — so it is read from the page
    // header, and the refusal is read from the status region alone.
    const refusalOf = (root: HTMLElement) =>
      (root.querySelector('[role="status"]') as HTMLElement | null)?.textContent ?? ''

    const lms = renderState(<VNextAccessRefused heading="Last Man Standing" destination="games" />)
    const said = refusalOf(lms.container)
    expect(said).toContain('not yours to see')
    lms.unmount()

    const league = renderState(
      <VNextAccessRefused heading="Highland Rivals" destination="leagues" />,
    )
    expect(refusalOf(league.container)).toBe(said)
    league.unmount()

    // Including the default, which names nothing at all.
    const bare = renderState(<VNextAccessRefused />)
    expect(refusalOf(bare.container)).toBe(said)
    bare.unmount()

    // And a heading long enough to be a real container name must not appear in
    // the refusal even by accident.
    const named = renderState(
      <VNextAccessRefused heading="Ada Lovelace's Analytical Engine XI" destination="leagues" />,
    )
    expect(refusalOf(named.container)).not.toContain('Analytical Engine')
    expect(refusalOf(named.container)).toBe(said)
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

  it('draws the row count the caller asked for, and not its own', () => {
    // `toBeGreaterThan(0)` passed for any hard-coded length, including the
    // default. Two different counts, each asserted exactly, is what makes the
    // prop load-bearing.
    // The last aria-hidden block inside the busy region is the table; the two
    // before it are the control row and the heading bar, whose counts are fixed.
    const tableRows = (root: HTMLElement) =>
      root.querySelectorAll('[aria-busy="true"] > div:last-of-type > span')

    const three = renderState(<VNextLoadingRows heading="Games" destination="games" rows={3} />)
    expect(tableRows(three.container)).toHaveLength(3)
    three.unmount()

    const seven = renderState(<VNextLoadingRows heading="Games" destination="games" rows={7} />)
    expect(tableRows(seven.container)).toHaveLength(7)
    seven.unmount()
  })

  it('takes the destination it was given rather than a hard-coded one', () => {
    // THE REGRESSION THIS MODULE WAS EXTRACTED TO FIX. It used to render
    // `destination="leagues"` with no prop at all, so a Championship that could
    // not load told the player they were in Leagues. `VNextNotice` is guarded;
    // this one was not, and hard-coding it back passed the whole file.
    // `VNextNav` marks the active destination with aria-current="page", which
    // is the same thing a screen reader is told.
    const activeIn = (root: HTMLElement) =>
      Array.from(root.querySelectorAll('[aria-current="page"]')).map((node) =>
        (node.textContent ?? '').trim(),
      )

    const games = renderState(
      <VNextLoadingRows heading="Games" destination="games" label="Loading games" />,
    )
    expect(activeIn(games.container).join(' ')).toContain('Games')
    expect(activeIn(games.container).join(' ')).not.toContain('Leagues')
    games.unmount()

    const leagues = renderState(
      <VNextLoadingRows heading="Leagues" destination="leagues" label="Loading leagues" />,
    )
    expect(activeIn(leagues.container).join(' ')).toContain('Leagues')
    expect(activeIn(leagues.container).join(' ')).not.toContain('Games')
  })
})

describe('every shared state passes the accessibility scan', () => {
  it('the notice, with and without a retry', async () => {
    await expectNoAxeViolations(
      <VNextShellProvider model={shellScenarios.oneCompetition}>
        <VNextNotice destination="games" heading="Games" title="We could not load this" body="This is our end, not yours." />
      </VNextShellProvider>,
    )
    await expectNoAxeViolations(
      <VNextShellProvider model={shellScenarios.oneCompetition}>
        <VNextNotice destination="games" heading="Games" title="We could not load this" body="This is our end, not yours." onRetry={() => {}} />
      </VNextShellProvider>,
    )
  })

  it('not found', async () => {
    await expectNoAxeViolations(
      <VNextShellProvider model={shellScenarios.oneCompetition}>
        <VNextNotFound />
      </VNextShellProvider>,
    )
  })

  it('access refused', async () => {
    await expectNoAxeViolations(
      <VNextShellProvider model={shellScenarios.oneCompetition}>
        <VNextAccessRefused heading="Leagues" destination="leagues" />
      </VNextShellProvider>,
    )
  })

  it('the loading skeleton, which must announce itself', async () => {
    await expectNoAxeViolations(
      <VNextShellProvider model={shellScenarios.oneCompetition}>
        <VNextLoadingRows heading="Leagues" destination="leagues" label="Loading standings" />
      </VNextShellProvider>,
    )
  })
})
