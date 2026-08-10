import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../src/app/providers/TournamentDataProvider', () => ({
  TournamentDataProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tournament-data">{children}</div>
  ),
}))

vi.mock('../../src/app/providers/PredictionsProvider', () => ({
  PredictionsProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="predictions">{children}</div>
  ),
}))

import { TournamentJourney } from '../../src/app/TournamentJourney'
import type { EuroPublicationSnapshot } from '../../src/services/supabase/euroPublication'

const CHANGED_AT = '2026-08-09T17:00:00.000Z'

function renderJourney(
  url: string,
  readPublicationState: () => Promise<EuroPublicationSnapshot>,
) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/" element={<p>Hub home</p>} />
        <Route element={<TournamentJourney readPublicationState={readPublicationState} />}>
          <Route path="/profile" element={<p>Euro profile</p>} />
          <Route path="/admin/results" element={<p>Admin results</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('TournamentJourney Euro publication guard', () => {
  it('refuses a guessable Euro player route while the server state is hidden', async () => {
    const readPublicationState = vi.fn().mockResolvedValue({
      state: 'hidden',
      changedAt: CHANGED_AT,
    })

    renderJourney('/profile', readPublicationState)

    expect(await screen.findByText('Hub home')).toBeInTheDocument()
    expect(screen.queryByText('Euro profile')).not.toBeInTheDocument()
    expect(screen.queryByTestId('tournament-data')).not.toBeInTheDocument()
    expect(readPublicationState).toHaveBeenCalledTimes(1)
  })

  it('fails closed when publication truth cannot be read', async () => {
    const readPublicationState = vi.fn().mockRejectedValue(new Error('network unavailable'))

    renderJourney('/profile', readPublicationState)

    expect(await screen.findByText('Hub home')).toBeInTheDocument()
    expect(screen.queryByText('Euro profile')).not.toBeInTheDocument()
    expect(screen.queryByTestId('tournament-data')).not.toBeInTheDocument()
  })

  it('allows a player route once the owner has advanced beyond hidden', async () => {
    const readPublicationState = vi.fn().mockResolvedValue({
      state: 'prelaunch',
      changedAt: CHANGED_AT,
    })

    renderJourney('/profile', readPublicationState)

    expect(await screen.findByText('Euro profile')).toBeInTheDocument()
    expect(screen.getByTestId('tournament-data')).toBeInTheDocument()
    expect(screen.getByTestId('predictions')).toBeInTheDocument()
  })

  it('keeps the authorised admin preparation route available while Euro is hidden', async () => {
    const readPublicationState = vi.fn().mockResolvedValue({
      state: 'hidden',
      changedAt: CHANGED_AT,
    })

    renderJourney('/admin/results', readPublicationState)

    expect(await screen.findByText('Admin results')).toBeInTheDocument()
    expect(screen.getByTestId('tournament-data')).toBeInTheDocument()
    await waitFor(() => expect(readPublicationState).not.toHaveBeenCalled())
  })
})
