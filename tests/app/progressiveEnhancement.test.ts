import { describe, expect, it, vi } from 'vitest'
import { appBadgeSupported, applyAppBadge } from '../../src/app/appBadge'
import {
  prefersReducedMotion,
  viewTransitionsSupported,
  withViewTransition,
} from '../../src/app/viewTransitions'

/**
 * `INNOV-023` and `INNOV-024`. Both are progressive enhancements, and the
 * property that matters for each is the same: on a platform that does not
 * support them, the product must behave exactly as it did before they existed.
 */

describe('INNOV-023 outstanding-action app badge', () => {
  it('reports unsupported and does nothing where the platform has no Badging API', () => {
    const bare = {} as Navigator
    expect(appBadgeSupported(bare)).toBe(false)
    expect(applyAppBadge(3, bare)).toBe(false)
  })

  it('sets the count it is given, and never derives one', () => {
    const setAppBadge = vi.fn(() => Promise.resolve())
    const clearAppBadge = vi.fn(() => Promise.resolve())
    const navigator = { setAppBadge, clearAppBadge } as unknown as Navigator

    expect(applyAppBadge(4, navigator)).toBe(true)
    expect(setAppBadge).toHaveBeenCalledWith(4)
    expect(clearAppBadge).not.toHaveBeenCalled()
  })

  it('clears rather than badging a nought', () => {
    const setAppBadge = vi.fn(() => Promise.resolve())
    const clearAppBadge = vi.fn(() => Promise.resolve())
    const navigator = { setAppBadge, clearAppBadge } as unknown as Navigator

    applyAppBadge(0, navigator)
    expect(clearAppBadge).toHaveBeenCalledTimes(1)
    expect(setAppBadge).not.toHaveBeenCalled()
  })

  it('treats a nonsensical count as unknown rather than rendering it', () => {
    const setAppBadge = vi.fn(() => Promise.resolve())
    const clearAppBadge = vi.fn(() => Promise.resolve())
    const navigator = { setAppBadge, clearAppBadge } as unknown as Navigator

    applyAppBadge(-2, navigator)
    applyAppBadge(1.5, navigator)
    expect(setAppBadge).not.toHaveBeenCalled()
    expect(clearAppBadge).toHaveBeenCalledTimes(2)
  })

  it('swallows a platform rejection rather than reporting a decoration as a fault', async () => {
    const navigator = {
      setAppBadge: () => Promise.reject(new Error('not installed')),
      clearAppBadge: () => Promise.resolve(),
    } as unknown as Navigator

    expect(() => applyAppBadge(2, navigator)).not.toThrow()
    await Promise.resolve()
  })
})

describe('INNOV-024 native view transitions', () => {
  const motion = (reduce: boolean) =>
    ({ matchMedia: () => ({ matches: reduce }) }) as unknown as Window

  it('runs the navigation directly where the platform has no transition API', () => {
    const update = vi.fn()
    const document = {} as Document
    expect(viewTransitionsSupported(document)).toBe(false)
    withViewTransition(update, { document, window: motion(false) })
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('skips the transition under prefers-reduced-motion and still navigates', () => {
    const startViewTransition = vi.fn()
    const document = { startViewTransition } as unknown as Document
    const update = vi.fn()

    expect(prefersReducedMotion(motion(true))).toBe(true)
    withViewTransition(update, { document, window: motion(true) })
    expect(startViewTransition).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('wraps the navigation where both the platform and the player allow it', () => {
    const startViewTransition = vi.fn((callback: () => void) => {
      callback()
      return { finished: Promise.resolve() }
    })
    const document = { startViewTransition } as unknown as Document
    const update = vi.fn()

    withViewTransition(update, { document, window: motion(false) })
    expect(startViewTransition).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('never strands the player when the browser throws', () => {
    const document = {
      startViewTransition: () => {
        throw new Error('nope')
      },
    } as unknown as Document
    const update = vi.fn()

    withViewTransition(update, { document, window: motion(false) })
    expect(update).toHaveBeenCalledTimes(1)
  })
})
