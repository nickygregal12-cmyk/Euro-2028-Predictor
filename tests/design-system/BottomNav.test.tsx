import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { BottomNav } from '../../src/design-system/BottomNav'

describe('BottomNav', () => {
  it('renders primary destinations as real links', () => {
    render(
      <MemoryRouter>
        <BottomNav active="matches" />
      </MemoryRouter>,
    )

    const expectedDestinations = {
      Home: '/',
      Predict: '/predict',
      Matches: '/matches',
      League: '/league',
      More: '/more',
    }

    for (const [name, href] of Object.entries(expectedDestinations)) {
      const link = screen.getByRole('link', { name })
      expect(link.getAttribute('href')).toBe(href)
    }

    expect(screen.getByRole('link', { name: 'Matches' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
