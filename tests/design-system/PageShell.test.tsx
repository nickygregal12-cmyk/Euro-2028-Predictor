import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
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

  it('renders the top bar above the content region', () => {
    render(
      <MemoryRouter>
        <PageShell active="home" topBar={<header data-testid="top-bar">Bar</header>}>
          <p>Page content</p>
        </PageShell>
      </MemoryRouter>,
    )

    const bar = screen.getByTestId('top-bar')
    const main = screen.getByRole('main')
    expect(bar.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
