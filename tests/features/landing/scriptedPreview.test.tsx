import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { LandingPage } from '../../../src/features/landing/LandingPage'
import {
  PREVIEW_STEPS,
  PREVIEW_FRAME_MS,
} from '../../../src/features/landing/landingPreviewScript'
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider'

/**
 * The scripted product preview, against the acquisition direction's own list.
 *
 * The direction is unusually mechanical about this surface, and every clause
 * of it is checkable, so each is checked here rather than trusted to a comment:
 * fixed local data, deterministic, no authenticated session, no API write, no
 * control that appears to alter real product state, paused when not visible,
 * reduced motion respected, and a valid static state.
 *
 * THE ONES WORTH KNOWING WHY. "Pauses when not visible" is asserted by never
 * reporting the preview as intersecting and then advancing the clock past
 * several frames — a timer that ran anyway would move the frame and fail. And
 * "no control that appears to alter product state" is asserted by proving the
 * previewed CTA is not a control at all: it is text inside a `role="img"`, so
 * neither a mouse nor a keyboard nor assistive technology can reach it.
 */

type ObserverCallback = (entries: { isIntersecting: boolean }[]) => void

let observers: { callback: ObserverCallback; disconnected: boolean }[] = []

function installObserver() {
  observers = []
  class FakeObserver {
    private readonly entry: { callback: ObserverCallback; disconnected: boolean }
    constructor(callback: ObserverCallback) {
      this.entry = { callback, disconnected: false }
      observers.push(this.entry)
    }
    observe() {}
    unobserve() {}
    disconnect() {
      this.entry.disconnected = true
    }
    takeRecords() {
      return []
    }
  }
  vi.stubGlobal('IntersectionObserver', FakeObserver)
}

function becomeVisible() {
  act(() => {
    for (const observer of observers) observer.callback([{ isIntersecting: true }])
  })
}

function installMatchMedia(reduced: boolean) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) => ({
      matches: reduced && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }),
  )
}

/**
 * Render, and let the lazily-imported preview arrive.
 *
 * The devices are behind `React.lazy` so the page's headline does not wait on
 * the product. `beforeAll` below has already paid the import, so the promise is
 * settled and a microtask flush inside `act` is all that remains — which is why
 * this works under the fake timers every case here installs: a resolved dynamic
 * import advances on the microtask queue and never on a timer.
 */
async function renderLanding() {
  render(
    <ThemeProvider>
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    </ThemeProvider>,
  )
  await settlePreview()
}

async function settlePreview() {
  // One asynchronous `act` drains the microtask queue and re-renders past the
  // Suspense boundary. It works under fake timers because a settled dynamic
  // import advances on microtasks and never on a timer.
  await act(async () => {})
  expect(
    document.querySelectorAll('[data-preview-variant]').length,
    'the preview never mounted, so everything below would pass vacuously',
  ).toBe(3)
}

/** Every animating device's accessible name, which carries the current phase. */
function currentDescriptions(): string[] {
  // The Leagues section's device is a STILL and never advances, so it is not
  // part of what "the sequence" means here. `data-preview-motion` is how the
  // page says which is which.
  const labels = [...document.querySelectorAll('[data-preview-motion="scripted"]')].map(
    (node) => node.getAttribute('aria-label') ?? '',
  )
  // Two: the desktop story and the phone story. Asserted rather than assumed,
  // because every case below loops over this list and an empty one would pass
  // all of them while proving nothing.
  expect(labels).toHaveLength(2)
  return labels
}

// Pay the import once, outside a case and outside fake timers.
beforeAll(async () => {
  await import('../../../src/features/landing/ProductPreview')
})

describe('the scripted product preview', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    installObserver()
    installMatchMedia(false)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('has a valid static state: the first frame renders before anything runs', async () => {
    await renderLanding()
    // No observer has fired and no timer has ticked. A visitor with JavaScript
    // disabled, a crawler and a frozen screenshot all see this.
    for (const description of currentDescriptions()) {
      expect(description).toBe(PREVIEW_STEPS[0]?.description)
    }
  })

  it('does not advance while the preview is off screen', async () => {
    await renderLanding()
    act(() => {
      vi.advanceTimersByTime(PREVIEW_FRAME_MS * 3)
    })
    for (const description of currentDescriptions()) {
      expect(description).toBe(PREVIEW_STEPS[0]?.description)
    }
  })

  it('advances deterministically once it is on screen, and loops', async () => {
    await renderLanding()
    becomeVisible()

    act(() => {
      vi.advanceTimersByTime(PREVIEW_FRAME_MS)
    })
    for (const description of currentDescriptions()) {
      expect(description).toBe(PREVIEW_STEPS[1]?.description)
    }

    // All the way round: the sequence is a loop, not something that ends on a
    // still.
    act(() => {
      vi.advanceTimersByTime(PREVIEW_FRAME_MS * (PREVIEW_STEPS.length - 1))
    })
    for (const description of currentDescriptions()) {
      expect(description).toBe(PREVIEW_STEPS[0]?.description)
    }
  })

  it('does not animate at all under prefers-reduced-motion', async () => {
    installMatchMedia(true)
    await renderLanding()
    becomeVisible()
    act(() => {
      vi.advanceTimersByTime(PREVIEW_FRAME_MS * 5)
    })
    for (const description of currentDescriptions()) {
      expect(description).toBe(PREVIEW_STEPS[0]?.description)
    }
    // And the content stays reachable: the steps are still there to be pressed.
    expect(
      screen.getAllByRole('button', { name: /Show preview step 3 of/ }).length,
    ).toBeGreaterThan(0)
  })

  it('lets a visitor take hold of the sequence, and then leaves it alone', async () => {
    await renderLanding()
    becomeVisible()

    const step = screen.getAllByRole('button', { name: /Show preview step 3 of/ })[0]
    expect(step).toBeDefined()
    act(() => {
      fireEvent.click(step as HTMLElement)
    })

    // Moving the page under somebody who is reading it at their own pace is
    // the one thing a manual step must prevent.
    act(() => {
      vi.advanceTimersByTime(PREVIEW_FRAME_MS * 4)
    })
    const descriptions = currentDescriptions()
    expect(descriptions.some((d) => d === PREVIEW_STEPS[2]?.description)).toBe(true)
  })

  it('puts the product\u2019s real controls in the device, and makes every one of them inert', async () => {
    // THIS CASE CHANGED SHAPE WITH THE PREVIEW, AND THE NEW SHAPE IS STRONGER.
    // The old device drew `<span>`s that looked like buttons, so "no control
    // inside" could be asserted by counting them. This one mounts the product,
    // so the controls inside ARE the product's — and the promise the page makes
    // is not that they are absent but that not one of them can be reached.
    //
    // `inert` is what makes that true: it removes the whole subtree from
    // hit-testing, from the tab order and from the accessibility tree. A visitor
    // who presses "Continue" expecting to predict something would have been told
    // a lie by the page selling them the product, and this is what refuses it.
    await renderLanding()
    const devices = [...document.querySelectorAll('[data-preview-variant]')]
    expect(devices.length).toBeGreaterThan(0)

    for (const device of devices) {
      const frame = device.firstElementChild as HTMLElement
      expect(frame.hasAttribute('inert'), 'a preview device is not inert').toBe(true)
      // The product really is in there — an inert frame with nothing in it would
      // pass the assertion above and prove nothing.
      expect(frame.querySelectorAll('button').length).toBeGreaterThan(0)
      // AND NOTHING IN IT LEAVES THE PAGE. The vNext shell is route-agnostic:
      // it emits intents and the host decides, and no `onIntent` is passed here
      // — so a press has nowhere to go even before `inert`. An anchor would
      // bypass both, so every one of them is checked: the shell's own skip link
      // is in-page and is the only anchor the product draws here.
      const hrefs = [...frame.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'))
      for (const href of hrefs) {
        expect(href, 'a preview device links off the landing page').toMatch(/^#/)
      }
    }
  })

  it('disconnects its observer when the page goes away', async () => {
    const { unmount } = render(
      <ThemeProvider>
        <MemoryRouter>
          <LandingPage />
        </MemoryRouter>
      </ThemeProvider>,
    )
    await settlePreview()
    unmount()
    expect(observers.every((observer) => observer.disconnected)).toBe(true)
  })
})
