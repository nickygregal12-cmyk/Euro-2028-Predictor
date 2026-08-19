import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'

vi.mock('../../../src/services/supabase/euroPublication', () => ({
  fetchEuroPublicationState: vi.fn(),
}))

import { EuroSignupGate } from '../../../src/features/auth/EuroSignupGate'
import { SiteProvider } from '../../../src/app/site/SiteProvider'
import { siteConfiguration } from '../../../src/app/site/siteConfiguration'
import { EURO_PUBLICATION_STATES } from '../../../src/services/supabase/euroPublicationModel'
import type { EuroPublicationState } from '../../../src/services/supabase/euroPublicationModel'
import type { SiteVariant } from '../../../src/app/site/siteVariant'

/**
 * `EURO-003` at the route boundary.
 *
 * THE HOLE THIS CLOSES. PR #702 removed the Euro landing page's "Create account"
 * control in every state where the server says registration is closed, and left
 * `/auth/signup` serving a working form. A hidden control is not a control: the
 * URL is guessable, bookmarkable, shareable and indexable, and every one of those
 * paths reached a form that created a real account for a tournament nobody had
 * published.
 *
 * THE HUB MUST STAY OPEN. One Supabase project serves both deployments, so the
 * fix could not be a project-level signup switch — that would close weekly signup
 * to close the tournament's. The gate is therefore a no-op on the Hub build, and
 * that is asserted rather than assumed.
 */

const HUB_ORIGIN = 'https://hub.example'
const FORM = 'the signup form'

function renderGate(
  variant: SiteVariant,
  state: EuroPublicationState | 'fails' | 'never',
  { noSiblingSite = false }: { noSiblingSite?: boolean } = {},
) {
  const read =
    state === 'fails'
      ? () => Promise.reject(new Error('network'))
      : state === 'never'
        ? () => new Promise<never>(() => {})
        : () => Promise.resolve({ state, changedAt: '2026-08-11T00:00:00.000Z' })

  return render(
    <SiteProvider
      configuration={siteConfiguration(variant, {
        siblingOrigin: noSiblingSite ? undefined : HUB_ORIGIN,
      })}
    >
      <MemoryRouter initialEntries={['/auth/signup']}>
        <Routes>
          <Route element={<EuroSignupGate readPublicationState={read as never} />}>
            <Route path="/auth/signup" element={<p>{FORM}</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </SiteProvider>,
  )
}

describe('the Euro signup gate', () => {
  it('leaves the Hub build entirely alone', async () => {
    // Not "allows it after checking": the Hub must not even pay the round trip,
    // because the answer cannot change what it renders.
    renderGate('hub', 'never')
    expect(await screen.findByText(FORM)).toBeTruthy()
  })

  it.each(['registration-open', 'live'] as const)(
    'serves the form when the server says %s',
    async (state) => {
      renderGate('euro', state)
      expect(await screen.findByText(FORM)).toBeTruthy()
    },
  )

  it.each(['hidden', 'prelaunch', 'completed', 'archived'] as const)(
    'refuses the form when the server says %s',
    async (state) => {
      renderGate('euro', state)
      await waitFor(() =>
        expect(
          screen.getByRole('heading', { name: /registration is not open/i }),
        ).toBeTruthy(),
      )
      expect(screen.queryByText(FORM)).toBeNull()
    },
  )

  it('refuses when the read fails, rather than falling through to the form', async () => {
    // The failure mode of an outage must be a visitor who cannot register here,
    // never one who registers for a tournament nobody published.
    renderGate('euro', 'fails')
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /registration is not open/i })).toBeTruthy(),
    )
    expect(screen.queryByText(FORM)).toBeNull()
  })

  it('shows no form while the state is still resolving', () => {
    renderGate('euro', 'never')
    expect(screen.queryByText(FORM)).toBeNull()
  })

  it('answers every state contract 143 defines', async () => {
    // A state added to the lifecycle and not classified must fail closed rather
    // than fall through, so this sweeps the authority rather than a copy of it.
    for (const state of EURO_PUBLICATION_STATES) {
      const view = renderGate('euro', state)
      await waitFor(() => {
        const open = screen.queryByText(FORM)
        const closed = screen.queryByRole('heading', { name: /registration is not open/i })
        expect(Boolean(open) !== Boolean(closed), `${state} answered neither`).toBe(true)
      })
      view.unmount()
    }
  })

  it('offers the Hub’s own signup, because the account is shared', async () => {
    renderGate('euro', 'prelaunch')
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /registration is not open/i })).toBeTruthy(),
    )
    expect(
      screen.getByRole('link', { name: /Create an account on Predictor Hub/i }),
    ).toHaveAttribute('href', `${HUB_ORIGIN}/auth/signup`)
  })

  it('drops that offer when no sibling origin is configured', async () => {
    renderGate('euro', 'prelaunch', { noSiblingSite: true })
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /registration is not open/i })).toBeTruthy(),
    )
    expect(screen.queryByRole('link', { name: /Create an account on/i })).toBeNull()
  })

  it('always keeps a way in for someone who already has an account', async () => {
    for (const state of ['hidden', 'prelaunch', 'archived'] as const) {
      const view = renderGate('euro', state)
      await waitFor(() =>
        expect(screen.getByRole('link', { name: /^sign in$/i })).toHaveAttribute(
          'href',
          '/auth/login',
        ),
      )
      view.unmount()
    }
  })
})
