import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ScoringRulesPage } from '../../../src/features/more/ScoringRulesPage'

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/more/scoring']}>
      <Routes>
        <Route path="/more/scoring" element={<ScoringRulesPage />} />
        <Route path="/more" element={<p>More destination</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ScoringRulesPage domestic weekly rules', () => {
  it('explains all three domestic games without tournament-only mechanics', () => {
    renderPage()

    expect(screen.getByRole('heading', { name: 'How the games work' })).toBeVisible()
    expect(screen.getByText('Match Predictor')).toBeVisible()
    expect(screen.getByText('Last Man Standing')).toBeVisible()
    expect(screen.getByText('Predictor Championship')).toBeVisible()

    expect(screen.getByText('+5')).toBeVisible()
    expect(screen.getByText('+3')).toBeVisible()
    expect(screen.getByText(/10 per season, split 5 in each half/)).toBeVisible()
    expect(screen.getByText(/30 min before kickoff/)).toBeVisible()

    expect(screen.queryByText(/Group positions/)).toBeNull()
    expect(screen.queryByText(/Golden Boot/)).toBeNull()
    expect(screen.queryByText(/Champion pick/)).toBeNull()
  })

  it('returns to More through an explicit deterministic exit', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Back to More' }))
    expect(screen.getByText('More destination')).toBeVisible()
  })
})
