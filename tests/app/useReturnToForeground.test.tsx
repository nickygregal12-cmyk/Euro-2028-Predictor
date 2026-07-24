import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useReturnToForeground } from '../../src/app/providers/useReturnToForeground'

function Harness({ onReturn }: { onReturn: () => void }) {
  useReturnToForeground(onReturn)
  return null
}

function setVisibility(value: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value,
  })
}

describe('useReturnToForeground', () => {
  afterEach(() => {
    setVisibility('visible')
  })

  it('does not run on an ordinary focus without a background transition', () => {
    const onReturn = vi.fn()
    setVisibility('visible')
    render(<Harness onReturn={onReturn} />)

    window.dispatchEvent(new Event('focus'))

    expect(onReturn).not.toHaveBeenCalled()
  })

  it('runs once when hidden content becomes visible and deduplicates focus', () => {
    const onReturn = vi.fn()
    setVisibility('visible')
    render(<Harness onReturn={onReturn} />)

    setVisibility('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    setVisibility('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('focus'))

    expect(onReturn).toHaveBeenCalledOnce()
  })

  it('uses the latest callback without reinstalling event listeners', () => {
    const first = vi.fn()
    const second = vi.fn()
    setVisibility('visible')
    const view = render(<Harness onReturn={first} />)
    view.rerender(<Harness onReturn={second} />)

    setVisibility('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    setVisibility('visible')
    window.dispatchEvent(new Event('focus'))

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledOnce()
  })
})
