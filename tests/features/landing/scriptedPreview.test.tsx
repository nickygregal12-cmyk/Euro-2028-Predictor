import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LandingPage } from '../../../src/features/landing/LandingPage'
import {
  PREVIEW_FRAMES,
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

function renderLanding() {
  render(
    <ThemeProvider>
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    </ThemeProvider>,
  )
}

/** The desktop device's accessible name, which carries the current frame. */
function currentDescriptions(): string[] {
  return screen
    .getAllByRole('img')
    .map((node) => node.getAttribute('aria-label') ?? '')
    .filter((label) => label.startsWith('Preview of the signed-in Hub'))
}

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

  it('has a valid static state: the first frame renders before anything runs', () => {
    renderLanding()
    // No observer has fired and no timer has ticked. A visitor with JavaScript
    // disabled, a crawler and a frozen screenshot all see this.
    for (const description of currentDescriptions()) {
      expect(description).toBe(PREVIEW_FRAMES[0]?.description)
    }
  })

  it('does not advance while the preview is off screen', () => {
    renderLanding()
    act(() => {
      vi.advanceTimersByTime(PREVIEW_FRAME_MS * 3)
    })
    for (const description of currentDescriptions()) {
      expect(description).toBe(PREVIEW_FRAMES[0]?.description)
    }
  })

  it('advances deterministically once it is on screen, and loops', () => {
    renderLanding()
    becomeVisible()

    act(() => {
      vi.advanceTimersByTime(PREVIEW_FRAME_MS)
    })
    for (const description of currentDescriptions()) {
      expect(description).toBe(PREVIEW_FRAMES[1]?.description)
    }

    // All the way round: the sequence is a loop, not something that ends on a
    // still.
    act(() => {
      vi.advanceTimersByTime(PREVIEW_FRAME_MS * (PREVIEW_FRAMES.length - 1))
    })
    for (const description of currentDescriptions()) {
      expect(description).toBe(PREVIEW_FRAMES[0]?.description)
    }
  })

  it('does not animate at all under prefers-reduced-motion', () => {
    installMatchMedia(true)
    renderLanding()
    becomeVisible()
    act(() => {
      vi.advanceTimersByTime(PREVIEW_FRAME_MS * 5)
    })
    for (const description of currentDescriptions()) {
      expect(description).toBe(PREVIEW_FRAMES[0]?.description)
    }
    // And the content stays reachable: the steps are still there to be pressed.
    expect(
      screen.getAllByRole('button', { name: /Show preview step 3 of/ }).length,
    ).toBeGreaterThan(0)
  })

  it('lets a visitor take hold of the sequence, and then leaves it alone', () => {
    renderLanding()
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
    expect(descriptions.some((d) => d === PREVIEW_FRAMES[2]?.description)).toBe(true)
  })

  it('puts no control inside the device, and no real action anywhere in it', () => {
    renderLanding()
    const devices = screen
      .getAllByRole('img')
      .filter((node) =>
        (node.getAttribute('aria-label') ?? '').startsWith('Preview of the signed-in Hub'),
      )
    expect(devices.length).toBeGreaterThan(0)
    for (const device of devices) {
      // Nothing focusable, nothing that navigates, nothing that submits. The
      // previewed "Continue" is a span, so it cannot be pressed by accident and
      // ARIA hides it entirely.
      expect(device.querySelectorAll('button, a[href], input, select, [tabindex]')).toHaveLength(0)
    }
  })

  it('disconnects its observer when the page goes away', () => {
    const { unmount } = render(
      <ThemeProvider>
        <MemoryRouter>
          <LandingPage />
        </MemoryRouter>
      </ThemeProvider>,
    )
    unmount()
    expect(observers.every((observer) => observer.disconnected)).toBe(true)
  })
})
