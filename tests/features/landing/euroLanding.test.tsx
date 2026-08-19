import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

// The page's default reader is the real one; every assertion injects its own.
// Mocking the module keeps this credential-free unit test from initialising a
// Supabase client on import.
vi.mock('../../../src/services/supabase/euroPublication', () => ({
  fetchEuroPublicationState: vi.fn(),
}))

import { EuroLandingPage } from '../../../src/features/landing/EuroLandingPage'
import { SiteProvider } from '../../../src/app/site/SiteProvider'
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider'
import { siteConfiguration } from '../../../src/app/site/siteConfiguration'
import {
  actionHref,
  euroLandingPresentation,
  EURO_LANDING_STATES,
  resolveActions,
} from '../../../src/features/landing/euroLandingModel'
import { EURO_PUBLICATION_STATES } from '../../../src/services/supabase/euroPublicationModel'
import type { EuroPublicationState } from '../../../src/services/supabase/euroPublicationModel'

const HUB_ORIGIN = 'https://predictionhub.example'
const CHANGED_AT = '2026-08-11T12:00:00.000Z'

function renderPage(
  state: EuroPublicationState | 'fails',
  { noSiblingSite = false }: { noSiblingSite?: boolean } = {},
) {
  const sibling = noSiblingSite ? undefined : HUB_ORIGIN
  const read = vi.fn(() =>
    state === 'fails'
      ? Promise.reject(new Error('network unavailable'))
      : Promise.resolve({ state, changedAt: CHANGED_AT }),
  )

  render(
    <SiteProvider
      configuration={siteConfiguration('euro', {
        publicOrigin: 'https://euro28predictor.com',
        siblingOrigin: sibling,
      })}
    >
      <ThemeProvider>
        <MemoryRouter>
          <EuroLandingPage readPublicationState={read} />
        </MemoryRouter>
      </ThemeProvider>
    </SiteProvider>,
  )
  return read
}

describe('the model covers the lifecycle it claims to', () => {
  it('has a presentation for every server state, and one for no answer', () => {
    for (const state of EURO_LANDING_STATES) {
      expect(euroLandingPresentation(state).state).toBe(state)
    }
    expect(EURO_LANDING_STATES).toEqual([...EURO_PUBLICATION_STATES, 'unknown'])
  })

  // `EURO-003`: nothing may imply registration is open when it is not.
  it('offers registration in exactly the two states that have it', () => {
    const open = EURO_LANDING_STATES.filter(
      (state) => euroLandingPresentation(state).registrationOpen,
    )
    expect(open).toEqual(['registration-open', 'live'])
  })

  it('drops a sibling-site action rather than linking nowhere, and promotes the other', () => {
    const prelaunch = euroLandingPresentation('prelaunch')
    expect(prelaunch.primary.target).toBe('siblingSite')

    const withSite = resolveActions(prelaunch, HUB_ORIGIN)
    expect(withSite.primary?.target).toBe('siblingSite')
    expect(actionHref(withSite.primary!, HUB_ORIGIN)).toBe(HUB_ORIGIN)

    const withoutSite = resolveActions(prelaunch, null)
    expect(withoutSite.primary?.target).toBe('signin')
    expect(withoutSite.secondary).toBeNull()
  })
})

describe('what the page shows before it has an answer', () => {
  it('starts closed, and stays closed when the read fails', async () => {
    renderPage('fails')

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Euro 2028 is on its way.',
    )
    // Nothing changes after the rejection; the safe state was already showing.
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: /create/i })).not.toBeInTheDocument(),
    )
  })

  it('never offers account creation while the server says hidden', async () => {
    renderPage('hidden')
    await screen.findAllByText(/not open yet/i)
    expect(screen.queryByRole('link', { name: /create/i })).not.toBeInTheDocument()
  })
})

describe('each published state', () => {
  it('explains the product and points at the Hub in prelaunch', async () => {
    renderPage('prelaunch')
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Predict Euro 2028',
    )
    const toHub = screen.getByRole('link', { name: /play every matchweek/i })
    expect(toHub).toHaveAttribute('href', HUB_ORIGIN)
    expect(screen.queryByRole('link', { name: /create/i })).not.toBeInTheDocument()
  })

  it('leads into registration once the owner opens it', async () => {
    renderPage('registration-open')
    await screen.findAllByText(/registration open/i)
    const signup = screen.getAllByRole('link', { name: /create/i })
    expect(signup.length).toBeGreaterThan(0)
    expect(signup[0]).toHaveAttribute('href', '/auth/signup')
  })

  it('leads into predicting once the tournament is live', async () => {
    renderPage('live')
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('under way')
    expect(screen.getByRole('link', { name: /sign in and predict/i })).toHaveAttribute(
      'href',
      '/auth/login',
    )
  })

  it.each(['completed', 'archived'] as const)(
    'offers a keep-playing route to the Hub when %s',
    async (state) => {
      renderPage(state)
      await screen.findByRole('heading', { level: 1 })
      expect(
        screen.getByRole('link', { name: /keep playing every matchweek/i }),
      ).toHaveAttribute('href', HUB_ORIGIN)
      expect(screen.queryByRole('link', { name: /create/i })).not.toBeInTheDocument()
    },
  )
})

describe('the tournament page presents the weekly games as Bonus Games', () => {
  it('offers the two games that attach to a competition', async () => {
    renderPage('prelaunch')
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByRole('heading', { name: 'Bonus Games' })).toBeInTheDocument()
    for (const name of ['Last Man Standing', 'Predictor Championship']) {
      expect(screen.getByText(name)).toBeInTheDocument()
    }
  })

  it('does not offer domestic Match Predictor as one of them', async () => {
    renderPage('prelaunch')
    await screen.findByRole('heading', { level: 1 })

    // Named — a player looking for it must not conclude it does not exist —
    // but under the Hub's heading and pointing at the Hub, because it is a
    // competition season rather than a game attached to this tournament.
    const elsewhere = screen.getByRole('heading', {
      name: /Played on Predictor Hub/,
    })
    expect(elsewhere).toBeInTheDocument()
    const body = document.body.textContent ?? ''
    expect(body.indexOf('Match Predictor')).toBeGreaterThan(body.indexOf('Bonus Games'))
    expect(
      screen.getByRole('link', { name: /play it on Predictor Hub/i }),
    ).toHaveAttribute('href', HUB_ORIGIN)
  })

  it('leads with the tournament game above them', async () => {
    renderPage('prelaunch')
    await screen.findByRole('heading', { level: 1 })
    const body = document.body.textContent ?? ''
    expect(body.indexOf('Euro Predictor')).toBeLessThan(body.indexOf('Bonus Games'))
  })
})

describe('the hero status card', () => {
  it('says the tournament is not open, from the server rather than from a guess', async () => {
    renderPage('hidden')
    const card = await screen.findByRole('complementary', { name: /what is open on this site/i })
    expect(card.textContent).toMatch(/Not open yet/)
    // And it never invents a date, a phase or a countdown to fill the space.
    expect(card.textContent).not.toMatch(/days|soon|shortly/i)
  })

  it('says registration is open only when the server says so', async () => {
    renderPage('registration-open')
    const card = await screen.findByRole('complementary', { name: /what is open on this site/i })
    expect(card.textContent).toMatch(/Registration open/)
  })

  it('fails closed: an unreadable state reads as not open', async () => {
    renderPage('fails')
    const card = await screen.findByRole('complementary', { name: /what is open on this site/i })
    expect(card.textContent).toMatch(/Not open yet/)
  })

  it('keeps account creation and game entry visibly separate', async () => {
    renderPage('registration-open')
    const card = await screen.findByRole('complementary', { name: /what is open on this site/i })
    expect(card.textContent).toMatch(/Every game is joined separately/)
    expect(card.textContent).toMatch(/enters you into nothing/)
  })
})

describe('no placeholder football', () => {
  it('shows no draw, team list, fixture or countdown', async () => {
    renderPage('prelaunch')
    await screen.findByRole('heading', { level: 1 })
    const body = (document.body.textContent ?? '').toLowerCase()
    // A drawn group, a named nation, a scheduled fixture or a countdown would
    // each be football this build does not have.
    for (const forbidden of ['group a', 'group b', 'scotland', 'england', 'days to go']) {
      expect(body, `landing copy claims "${forbidden}"`).not.toMatch(
        new RegExp(`\\b${forbidden}\\b`),
      )
    }
  })

  it('omits the sibling link entirely when no Hub domain is configured', async () => {
    renderPage('prelaunch', { noSiblingSite: true })
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('link', { name: /play every matchweek/i })).not.toBeInTheDocument()
    // The promoted secondary is still a real destination, not a dead control.
    for (const link of screen.getAllByRole('link', { name: 'Sign in' })) {
      expect(link).toHaveAttribute('href', '/auth/login')
    }
  })
})
