import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

vi.mock('../../../src/services/supabase/euroPublication', () => ({
  fetchEuroPublicationState: vi.fn(),
}))

import { EuroDestinationPage } from '../../../src/features/euro/EuroDestinationPage'
import {
  euroSignedInPanel,
  EURO_DESTINATIONS,
  type EuroDestination,
} from '../../../src/features/euro/euroSignedInModel'
import { SiteProvider } from '../../../src/app/site/SiteProvider'
import { siteConfiguration } from '../../../src/app/site/siteConfiguration'
import { EURO_LANDING_STATES } from '../../../src/features/landing/euroLandingModel'
import type { EuroLandingState } from '../../../src/features/landing/euroLandingModel'

/**
 * The Euro deployment's signed-in destinations, over every publication state.
 *
 * The defect being held closed is the one PR #702 left: a signed-in visitor to
 * the Euro domain was served the domestic Hub's own pages with Euro navigation
 * labels above them. Every assertion below is either "this is the tournament's
 * answer" or "this states no football it does not have".
 */

const HUB_ORIGIN = 'https://hub.example'

function renderPage(
  state: EuroLandingState | 'fails',
  destination: EuroDestination = 'home',
  { noSiblingSite = false }: { noSiblingSite?: boolean } = {},
) {
  const read =
    state === 'fails'
      ? () => Promise.reject(new Error('network'))
      : () => Promise.resolve({ state, changedAt: '2026-08-11T00:00:00.000Z' })

  return render(
    <SiteProvider
      configuration={siteConfiguration('euro', {
        siblingOrigin: noSiblingSite ? undefined : HUB_ORIGIN,
      })}
    >
      <MemoryRouter>
        <EuroDestinationPage
          destination={destination}
          readPublicationState={read as never}
        />
      </MemoryRouter>
    </SiteProvider>,
  )
}

describe('euroSignedInPanel', () => {
  it('answers every publication state at every destination', () => {
    // A state added to contract 143 and not handled must land on the closed
    // shape rather than produce an undefined heading.
    for (const state of EURO_LANDING_STATES) {
      for (const destination of EURO_DESTINATIONS) {
        const panel = euroSignedInPanel(state, destination)
        expect(panel.heading.length, `${state}/${destination}`).toBeGreaterThan(0)
        expect(panel.body.length, `${state}/${destination}`).toBeGreaterThan(0)
        expect(panel.awaiting.length).toBeGreaterThan(0)
      }
    }
  })

  it('treats an unreadable state exactly as it treats a hidden one', () => {
    // Failing closed is not "a bit more cautious": the words must be the same,
    // or an outage is distinguishable from a tournament nobody has opened.
    for (const destination of EURO_DESTINATIONS) {
      const hidden = euroSignedInPanel('hidden', destination)
      const unknown = euroSignedInPanel('unknown', destination)
      expect(unknown.heading).toBe(hidden.heading)
      expect(unknown.body).toBe(hidden.body)
      expect(unknown.offerSiblingSite).toBe(hidden.offerSiblingSite)
    }
  })

  it('stops sending a player to the other site once this one is open', () => {
    // The mirror image of the defect: once Euro 2028 is running, a player who
    // came here for it must not be pointed at the weekly platform.
    for (const state of ['registration-open', 'live'] as const) {
      for (const destination of EURO_DESTINATIONS) {
        expect(euroSignedInPanel(state, destination).offerSiblingSite).toBe(false)
      }
    }
    expect(euroSignedInPanel('prelaunch', 'home').offerSiblingSite).toBe(true)
    expect(euroSignedInPanel('completed', 'home').offerSiblingSite).toBe(true)
  })

  it('takes its status label from the same table the public page uses', () => {
    expect(euroSignedInPanel('prelaunch', 'home').status).toBe('Coming soon')
    expect(euroSignedInPanel('live', 'home').status).toBe('Tournament live')
  })
})

describe('a signed-in Euro destination', () => {
  it('never renders a domestic Hub surface', async () => {
    renderPage('hidden', 'play')
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeTruthy())

    const body = document.body.textContent ?? ''
    // The Hub's own inbox, calendar and private-play copy. Any of these here
    // means the wrong product is rendering at a Euro address.
    for (const domestic of ['Premier League table', 'Matchweek', 'Your competitions']) {
      expect(body, `Euro /play renders the domestic surface: ${domestic}`).not.toContain(
        domestic,
      )
    }
  })

  it('fails closed when the publication read throws', async () => {
    renderPage('fails', 'home')
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 1, name: /Euro 2028 is not open yet/ }),
      ).toBeTruthy(),
    )
    // No error banner: a stranger cannot act on an outage, and the answer the
    // failure produces is the same answer `hidden` produces.
    expect(screen.queryByText(/something went wrong/i)).toBeNull()
  })

  it('links to the Hub while the tournament is closed, and not while it is open', async () => {
    const closed = renderPage('prelaunch', 'home')
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeTruthy())
    expect(
      screen.getAllByRole('link', { name: /Football Prediction Hub|play every matchweek/i })
        .length,
    ).toBeGreaterThan(0)
    closed.unmount()

    renderPage('live', 'home')
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeTruthy())
    expect(screen.queryByRole('link', { name: /play every matchweek/i })).toBeNull()
  })

  it('omits the Hub link entirely when no sibling origin is configured', async () => {
    renderPage('prelaunch', 'home', { noSiblingSite: true })
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeTruthy())

    // A button pointing at a guessed domain is worse than one fewer button.
    expect(screen.queryByRole('link', { name: /Prediction Hub/i })).toBeNull()
    // The sentence still says the weekly platform exists, which is true.
    expect(screen.getByText(/weekly Prediction Hub runs every matchweek/i)).toBeTruthy()
  })

  it('does not present domestic Match Predictor as something to play here', async () => {
    renderPage('prelaunch', 'home')
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeTruthy())

    const bonus = screen.getByRole('heading', { name: 'Bonus Games' })
    expect(bonus).toBeTruthy()
    const list = bonus.parentElement?.textContent ?? ''
    expect(list).toContain('Last Man Standing')
    expect(list).toContain('Predictor Championship')
    expect(list).not.toContain('Match Predictor')
  })
})
