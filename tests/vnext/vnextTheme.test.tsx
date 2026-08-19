import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'

/**
 * WHICH THEME THE LANE RENDERS IN.
 *
 * `DEC-016` left this open and its trigger passed: vNext was dark-only while
 * the live application has persisted a user theme choice for months, and
 * Stage 14 makes vNext that application. Shipping dark-only would have taken a
 * setting away from every player who had chosen light.
 *
 * The rule these assert is the precedence one: A CHOICE OUTRANKS THE DEVICE.
 * Resolving it in the component rather than with a `prefers-color-scheme` media
 * query in the stylesheet is what makes that possible — a media query cannot
 * see a choice, so a player who picked dark on a light laptop would get light.
 */

function matchMedia(prefersLight: boolean) {
  return (query: string): MediaQueryList =>
    ({
      matches: prefersLight && query.includes('light'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
}

function root(container: HTMLElement): HTMLElement {
  const node = container.querySelector('[data-vnext]')
  if (node === null) throw new Error('no vNext root rendered')
  return node as HTMLElement
}

describe('the vNext theme', () => {
  it('is dark by default, and dark carries no attribute', () => {
    window.matchMedia = matchMedia(false)
    const { container } = render(<VNextRoot>content</VNextRoot>)
    expect(root(container).getAttribute('data-vnext-theme')).toBeNull()
  })

  it('follows the device when the player has not chosen', () => {
    window.matchMedia = matchMedia(true)
    const { container } = render(<VNextRoot theme="system">content</VNextRoot>)
    expect(root(container).getAttribute('data-vnext-theme')).toBe('light')
  })

  it('lets a chosen light theme win on a dark device', () => {
    window.matchMedia = matchMedia(false)
    const { container } = render(<VNextRoot theme="light">content</VNextRoot>)
    expect(root(container).getAttribute('data-vnext-theme')).toBe('light')
  })

  it('lets a chosen DARK theme win on a light device', () => {
    // The half a media query cannot do, and the reason resolution is in the
    // component: the device says light, the player said dark, and the player
    // wins.
    window.matchMedia = matchMedia(true)
    const { container } = render(<VNextRoot theme="dark">content</VNextRoot>)
    expect(root(container).getAttribute('data-vnext-theme')).toBeNull()
  })

  it('falls back to the product default where matchMedia does not exist', () => {
    // Server rendering and some jsdom setups. Absence resolves to dark rather
    // than throwing.
    const original = window.matchMedia
    // @ts-expect-error deliberately removing it for this case
    delete window.matchMedia
    const { container } = render(<VNextRoot theme="system">content</VNextRoot>)
    expect(root(container).getAttribute('data-vnext-theme')).toBeNull()
    window.matchMedia = original
  })
})
