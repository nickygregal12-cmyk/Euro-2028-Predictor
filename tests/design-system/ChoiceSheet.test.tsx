import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ChoiceSheet } from '../../src/design-system/ChoiceSheet'

describe('ChoiceSheet', () => {
  const options = [
    { value: 'overall', label: 'Overall' },
    { value: 'friends', label: 'Friends League' },
  ]

  it('renders the selected option without a native select control', () => {
    const { container } = render(
      <ChoiceSheet label="Prediction scope" value="overall" options={options} onChange={() => {}} />,
    )

    expect(screen.getByRole('button', { name: /overall/i })).toBeInTheDocument()
    expect(container.querySelector('select')).toBeNull()
  })

  it('opens a branded dialog and changes the selected value', () => {
    const onChange = vi.fn()
    render(
      <ChoiceSheet label="Prediction scope" value="overall" options={options} onChange={onChange} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /overall/i }))
    expect(screen.getByRole('dialog', { name: 'Prediction scope' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'Friends League' }))
    expect(onChange).toHaveBeenCalledWith('friends')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('marks the current option as checked', () => {
    render(
      <ChoiceSheet label="Prediction scope" value="friends" options={options} onChange={() => {}} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /friends league/i }))
    expect(screen.getByRole('radio', { name: 'Friends League' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })
})
