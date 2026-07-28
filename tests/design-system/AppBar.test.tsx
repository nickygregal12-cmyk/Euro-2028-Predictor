import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppBar } from '../../src/design-system/AppBar'

describe('AppBar', () => {
  it('shows the section context and the avatar initials', () => {
    render(
      <AppBar
        context="League"
        theme="dark"
        onToggleTheme={() => {}}
        displayName="Nicky Gregal"
        onOpenProfile={() => {}}
      />,
    )

    expect(screen.getByRole('banner')).toBeTruthy()
    expect(screen.getByText('League')).toBeTruthy()
    expect(screen.getByText('NG')).toBeTruthy()
  })

  it('offers the opposite theme and toggles on demand', () => {
    const onToggleTheme = vi.fn()
    const { rerender } = render(
      <AppBar
        context="Home"
        theme="dark"
        onToggleTheme={onToggleTheme}
        displayName="Nicky"
        onOpenProfile={() => {}}
      />,
    )

    const toggle = screen.getByRole('button', { name: 'Switch to light theme' })
    fireEvent.click(toggle)
    expect(onToggleTheme).toHaveBeenCalledTimes(1)

    rerender(
      <AppBar
        context="Home"
        theme="light"
        onToggleTheme={onToggleTheme}
        displayName="Nicky"
        onOpenProfile={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeTruthy()
  })

  it('opens the profile from the avatar button and survives a missing name', () => {
    const onOpenProfile = vi.fn()
    render(
      <AppBar
        context="Home"
        theme="dark"
        onToggleTheme={() => {}}
        displayName={null}
        onOpenProfile={onOpenProfile}
      />,
    )

    const avatarButton = screen.getByRole('button', { name: 'Your profile' })
    expect(avatarButton.textContent).toBe('?')
    fireEvent.click(avatarButton)
    expect(onOpenProfile).toHaveBeenCalledTimes(1)
  })
})
