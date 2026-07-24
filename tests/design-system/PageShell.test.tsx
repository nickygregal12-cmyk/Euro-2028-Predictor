import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { PageShell } from '../../src/design-system/PageShell'

describe('PageShell accessibility', () => {
  it('provides a keyboard skip link and focusable main target', () => {
    render(
      <MemoryRouter>
        <PageShell active="home">
          <p>Page content</p>
        </PageShell>
      </MemoryRouter>,
    )

    const skipLink = screen.getByRole('link', { name: 'Skip to main content' })
    const main = screen.getByRole('main')

    expect(skipLink.getAttribute('href')).toBe('#main-content')
    expect(main.id).toBe('main-content')
    expect(main.tabIndex).toBe(-1)
  })
})
