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

vi.mock('../../src/app/providers/LiveResultsProvider', () => ({
  LiveResultsProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="live-results">{children}</div>
  ),
}))

// TournamentJourney has a default production reader, but every assertion below
// injects the read explicitly. Mock the module so importing the component does
// not initialise the real Supabase client in this credential-free unit test.
vi.mock('../../src/services/supabase/euroPublication', () => ({
  fetchEuroPublicationState: vi.fn(),
}))

import { TournamentJourney } from '../../src/app/TournamentJourney'
import { SiteProvider } from '../../src/app/site/SiteProvider'
import { siteConfiguration } from '../../src/app/site/siteConfiguration'
import type { EuroPublicationSnapshot } from '../../src/services/supabase/euroPublication'

const CHANGED_AT = '2026-08-09T17:00:00.000Z'

/**
 * The publication gate is only reachable on the deployment that serves the
 * tournament, so every assertion about it renders the Euro site explicitly.
 * The Hub's own refusal is a separate describe below — that is the point of the
 * two gates being independent.
 */
const EURO_SITE = siteConfiguration('euro')
/**
 * A deployment that does NOT serve the tournament.
 *
 * Constructed explicitly rather than taken from `siteConfiguration('hub')`,
 * because both deployments serve it today — see the field's own note. The
 * refusal is proven here so that turning it on is a value change with evidence
 * behind it rather than an untested branch.
 */
const NON_TOURNAMENT_SITE = { ...siteConfiguration('hub'), servesEuroTournament: false }

function renderJourney(
  url: string,
  readPublicationState: () => Promise<EuroPublicationSnapshot>,
  site = EURO_SITE,
) {
  render(
    <SiteProvider configuration={site}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/" element={<p>Hub home</p>} />
          <Route element={<TournamentJourney readPublicationState={readPublicationState} />}>
            <Route path="/profile" element={<p>Euro profile</p>} />
            <Route path="/admin/results" element={<p>Admin results</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </SiteProvider>,
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

/**
 * `EURO-001`: a deployment that is not the tournament's site does not serve its
 * player routes.
 *
 * A catalogue that merely omits Euro is not a control, because a guessable URL
 * still resolves — which is what made this a recorded defect rather than a
 * finished requirement. The refusal happens BEFORE the publication read, so
 * such a build also pays no round trip for a question that cannot change what
 * it renders.
 *
 * NEITHER DEPLOYMENT SETS THIS TODAY. These assertions describe the mechanism
 * so the owner's decision to turn it on is one configured value with proof
 * behind it, rather than an untested branch discovered on the day.
 */
describe('TournamentJourney deployment gate', () => {
  it('refuses every Euro player route, whatever the server says', async () => {
    const readPublicationState = vi.fn().mockResolvedValue({
      state: 'live',
      changedAt: CHANGED_AT,
    })

    renderJourney('/profile', readPublicationState, NON_TOURNAMENT_SITE)

    expect(await screen.findByText('Hub home')).toBeInTheDocument()
    expect(screen.queryByText('Euro profile')).not.toBeInTheDocument()
    expect(screen.queryByTestId('tournament-data')).not.toBeInTheDocument()
  })

  it('does not even ask the server, because the answer cannot change the outcome', async () => {
    const readPublicationState = vi.fn().mockResolvedValue({
      state: 'live',
      changedAt: CHANGED_AT,
    })

    renderJourney('/profile', readPublicationState, NON_TOURNAMENT_SITE)

    await screen.findByText('Hub home')
    await waitFor(() => expect(readPublicationState).not.toHaveBeenCalled())
  })

  /**
   * BOTH GATES EXEMPT THE ADMINISTRATION PATH, and the second exemption is a
   * correction this suite forced. Withholding `/admin/results` from a
   * non-tournament deployment removed the only Results Centre there is — there
   * is no separate administration site — so a hidden tournament could not be
   * prepared to the point where it could be published.
   */
  it('keeps the admin preparation route, because there is no other Results Centre', async () => {
    const readPublicationState = vi.fn().mockResolvedValue({
      state: 'hidden',
      changedAt: CHANGED_AT,
    })

    renderJourney('/admin/results', readPublicationState, NON_TOURNAMENT_SITE)

    expect(await screen.findByText('Admin results')).toBeInTheDocument()
    expect(screen.getByTestId('tournament-data')).toBeInTheDocument()
  })
})
