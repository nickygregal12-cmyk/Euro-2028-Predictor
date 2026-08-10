import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ScoreInput } from '../../src/design-system/ScoreInput'

/**
 * Tap-to-step score entry.
 *
 * WHY IT EXISTS, in the words it was reported in: there were "no steps to click
 * to change the score on the prediction card". Setting a score meant hitting a
 * 44px box, waiting for the numeric keyboard, typing and dismissing it — twice
 * per fixture, twenty times for a matchweek. Predicted scores are
 * overwhelmingly 0, 1 and 2, so a tap should reach them.
 *
 * TYPING IS NOT REPLACED and the last test here holds that: the box keeps its
 * numeric input, and a score of 4 is still one keystroke rather than five taps.
 */

describe('stepping a score', () => {
  it('starts an empty box at nil, because a nil is the most predicted score', () => {
    // One tap to 0, not two. Starting at 1 would put the commonest scoreline
    // an extra tap away for both teams.
    const onChange = vi.fn()
    render(<ScoreInput value={null} ariaLabel="Celtic score" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Add one to Celtic score' }))
    expect(onChange).toHaveBeenCalledWith(0)
  })

  it('adds and subtracts one from a set score', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <ScoreInput value={1} ariaLabel="Celtic score" onChange={onChange} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add one to Celtic score' }))
    expect(onChange).toHaveBeenLastCalledWith(2)

    rerender(<ScoreInput value={1} ariaLabel="Celtic score" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Subtract one from Celtic score' }))
    expect(onChange).toHaveBeenLastCalledWith(0)
  })

  it('disables subtract at the floor rather than letting it look alive and refuse', () => {
    // The complaint this whole change came from was controls that cannot act.
    // A boundary is a real reason to be disabled; silently doing nothing is not.
    const onChange = vi.fn()
    const { rerender } = render(
      <ScoreInput value={null} ariaLabel="Celtic score" onChange={onChange} />,
    )
    const minus = () =>
      screen.getByRole<HTMLButtonElement>('button', {
        name: 'Subtract one from Celtic score',
      })

    expect(minus().disabled).toBe(true)

    rerender(<ScoreInput value={0} ariaLabel="Celtic score" onChange={onChange} />)
    expect(minus().disabled).toBe(true)

    rerender(<ScoreInput value={1} ariaLabel="Celtic score" onChange={onChange} />)
    expect(minus().disabled).toBe(false)
  })

  it('does not step past the two digits the box can hold', () => {
    const onChange = vi.fn()
    render(<ScoreInput value={99} ariaLabel="Celtic score" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Add one to Celtic score' }))
    expect(onChange).toHaveBeenCalledWith(99)
  })

  it('names the team in each control, because a card carries two of them', () => {
    // "Add one" twice over says nothing about which score moves — which matters
    // most to the player who cannot see the layout.
    const onChange = vi.fn()
    render(
      <>
        <ScoreInput value={0} ariaLabel="Celtic score" onChange={onChange} />
        <ScoreInput value={0} ariaLabel="Hibernian score" onChange={onChange} />
      </>,
    )

    expect(screen.getByRole('button', { name: 'Add one to Celtic score' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add one to Hibernian score' })).toBeTruthy()
  })

  it('keeps typing exactly as it was', () => {
    // The steppers are for 0, 1 and 2. A score of 4 stays one keystroke.
    const onChange = vi.fn()
    render(<ScoreInput value={null} ariaLabel="Celtic score" onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Celtic score'), { target: { value: '4' } })
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('offers no controls on a locked score, which is a reading not an entry', () => {
    render(<ScoreInput value={2} ariaLabel="Celtic score" locked />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('offers none where the caller supplies no way to change the value', () => {
    // A stepper over a read-only box would be the dead control this change is
    // removing, reintroduced by the component itself.
    render(<ScoreInput value={2} ariaLabel="Celtic score" />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
