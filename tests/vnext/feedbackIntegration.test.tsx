import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { useVNextFeedback, useFeedbackOnLatch } from '../../src/vnext/foundations/feedbackContext'
import type { FeedbackPreference } from '../../src/vnext/foundations/feedback'

/**
 * THE PREFERENCE HAS TO REACH THE PLACE THAT EMITS.
 *
 * `feedback.test.ts` proves the model: the patterns, the outcomes, and that
 * nothing in the lane reaches the device by another route. What it cannot prove
 * is the part that actually breaks — a preference that is stored, drawn in a
 * control, and then never read by the surface a player is holding. That failure
 * looks exactly like a setting that does not work, and it is invisible to a
 * unit test of a pure function.
 *
 * So these render the real provider and the real hooks.
 */

const vibrate = vi.fn()

function withVibrate() {
  Object.defineProperty(globalThis.navigator, 'vibrate', {
    value: vibrate,
    configurable: true,
    writable: true,
  })
}

afterEach(() => {
  vi.clearAllMocks()
})

function Emitter({ semantic = 'success' as const }) {
  const feedback = useVNextFeedback()
  return (
    <button type="button" onClick={() => feedback(semantic)}>
      Emit
    </button>
  )
}

function Latch({ active }: { readonly active: boolean }) {
  useFeedbackOnLatch(active, 'important')
  return <p>{active ? 'active' : 'idle'}</p>
}

function inRoot(node: React.ReactNode, haptics?: FeedbackPreference) {
  return render(<VNextRoot {...(haptics ? { haptics } : {})}>{node}</VNextRoot>)
}

describe('the stored preference reaches the surface', () => {
  it('emits for a player who has not chosen, which resolves to on', () => {
    withVibrate()
    inRoot(<Emitter />)
    screen.getByRole('button').click()
    expect(vibrate).toHaveBeenCalledTimes(1)
  })

  it('emits nothing at all when the player has turned it off', () => {
    withVibrate()
    inRoot(<Emitter />, 'off')
    screen.getByRole('button').click()
    // NOT "a shorter pattern" and not "a quieter one". Off is off.
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('is safe on a device that has no vibration at all', () => {
    // `unsupported` is the normal experience rather than a degraded one: every
    // state this product shows is already carried by a colour, a word and a
    // shape.
    Reflect.deleteProperty(globalThis.navigator, 'vibrate')
    expect(() => {
      inRoot(<Emitter />)
      screen.getByRole('button').click()
    }).not.toThrow()
  })

  it('never lets a refusing device take a command down with it', () => {
    Object.defineProperty(globalThis.navigator, 'vibrate', {
      value: () => {
        throw new Error('the device said no')
      },
      configurable: true,
      writable: true,
    })
    expect(() => {
      inRoot(<Emitter />)
      screen.getByRole('button').click()
    }).not.toThrow()
  })
})

describe('the latch emits on the transition and not on arrival', () => {
  it('says nothing to a player who arrives after the event', () => {
    // A page that mounts with the thing already true is a player opening a
    // screen where it happened yesterday. Buzzing there would be the product
    // congratulating them for arriving.
    withVibrate()
    inRoot(<Latch active />)
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('emits once when it becomes true, and not again while it stays true', () => {
    withVibrate()
    const view = inRoot(<Latch active={false} />)
    expect(vibrate).not.toHaveBeenCalled()

    view.rerender(
      <VNextRoot>
        <Latch active />
      </VNextRoot>,
    )
    expect(vibrate).toHaveBeenCalledTimes(1)

    view.rerender(
      <VNextRoot>
        <Latch active />
      </VNextRoot>,
    )
    expect(vibrate).toHaveBeenCalledTimes(1)
  })
})
