import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LeagueOptionsDisclosure } from '../../../src/features/leagues/LeagueOptionsDisclosure'

function renderDisclosure(isOwner: boolean) {
  const actions = {
    onTransferOwnership: vi.fn(),
    onDeleteLeague: vi.fn(),
    onLeaveLeague: vi.fn(),
  }

  render(<LeagueOptionsDisclosure isOwner={isOwner} {...actions} />)
  return actions
}

describe('LeagueOptionsDisclosure', () => {
  it('uses disclosure semantics with ordinary action buttons', () => {
    renderDisclosure(true)

    const trigger = screen.getByRole('button', { name: 'League options' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.hasAttribute('aria-haspopup')).toBe(false)

    fireEvent.click(trigger)

    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: 'Transfer ownership' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete league' })).toBeTruthy()
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.queryByRole('menuitem')).toBeNull()
  })

  it('runs the member action and closes the disclosure', () => {
    const actions = renderDisclosure(false)
    const trigger = screen.getByRole('button', { name: 'League options' })

    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: 'Leave league' }))

    expect(actions.onLeaveLeague).toHaveBeenCalledOnce()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('closes on Escape and restores focus to the trigger', () => {
    renderDisclosure(true)
    const trigger = screen.getByRole('button', { name: 'League options' })

    fireEvent.click(trigger)
    const transfer = screen.getByRole('button', { name: 'Transfer ownership' })
    transfer.focus()
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger)
  })

  it('closes when a pointer event occurs outside', () => {
    renderDisclosure(true)
    const trigger = screen.getByRole('button', { name: 'League options' })

    fireEvent.click(trigger)
    fireEvent.mouseDown(document.body)

    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })
})
