import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'

/**
 * What a signed-out visitor gets at `/`.
 *
 * This is the whole point of the change and the whole point of the flag, so it
 * is asserted from the routing layer rather than from the page: the page can be
 * perfect and still never render if the gate sends the visitor to `/auth/login`
 * as it did before.
 *
 * `AuthProvider` is mocked because the real one imports the Supabase client at
 * module load, and this test is about the gate's decision rather than about a
 * session actually resolving.
 */

const auth = vi.hoisted(() => ({
  state: { userId: null as string | null, loading: false },
}))

vi.mock('../../src/features/auth/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    userId: auth.state.userId,
    loading: auth.state.loading,
    displayName: null,
    welcomeStatus: 'seen' as const,
    markWelcomed: () => {},
    signOut: async () => {},
    refreshProfile: () => {},
  }),
}))

// The tournament data providers mount real subscriptions on the signed-in
// branch, which this test never needs to reach.
vi.mock('../../src/app/providers/TournamentDataProvider', () => ({
  TournamentDataProvider: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('../../src/app/providers/PredictionsProvider', () => ({
  PredictionsProvider: ({ children }: { children: React.ReactNode }) => children,
}))

/**
 * Imported after `vi.resetModules()`, never at the top of the file.
 *
 * Each case re-imports the gate so the build-time flag is read fresh. A
 * statically imported `ThemeProvider` would then come from the previous module
 * registry and publish a DIFFERENT React context than the one the freshly
 * imported page consumes — so the page would throw "must be used within a
 * ThemeProvider" while visibly wrapped in one.
 */
async function loadHarness() {
  const [{ RequireAuth }, { ThemeProvider }] = await Promise.all([
    import('../../src/app/Providers'),
    import('../../src/app/providers/ThemeProvider'),
  ])
  return { RequireAuth, ThemeProvider }
}

async function renderRoot() {
  const { RequireAuth, ThemeProvider } = await loadHarness()

  // ThemeProvider wraps the whole application in `App.tsx`; the landing page's
  // theme control reads it, so the harness mirrors that nesting.
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/" element={<p>The signed-in Hub</p>} />
          </Route>
          <Route path="/auth/login" element={<p>The log in screen</p>} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

beforeEach(() => {
  auth.state = { userId: null, loading: false }
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('the anonymous root', () => {
  it('serves the landing page when the flag is on', async () => {
    vi.stubEnv('VITE_UI_PUBLIC_LANDING', 'true')

    await renderRoot()

    // Lazy-loaded, so the assertion waits rather than reading the fallback.
    expect(await screen.findByRole('heading', { level: 1 })).toHaveProperty(
      'textContent',
      'Make every match mean more.',
    )
    expect(screen.queryByText('The log in screen')).toBeNull()
  })

  it('redirects to the log in screen when the flag is off', async () => {
    // Fail closed. Unset is the state every environment starts in, and the
    // failure mode of a mis-set flag has to be the behaviour players had
    // yesterday rather than an unfinished surface nobody meant to expose.
    vi.stubEnv('VITE_UI_PUBLIC_LANDING', undefined as unknown as string)

    await renderRoot()

    await waitFor(() => expect(screen.getByText('The log in screen')).toBeTruthy())
  })

  it('redirects when the flag is set to anything other than "true"', async () => {
    vi.stubEnv('VITE_UI_PUBLIC_LANDING', 'yes')

    await renderRoot()

    await waitFor(() => expect(screen.getByText('The log in screen')).toBeTruthy())
  })

  it('still sends a signed-out visitor to log in from any other route', async () => {
    // The landing page is the root's answer, not a general one. Someone asking
    // for their own predictions needs the log in screen, which returns them
    // afterwards — replacing that with marketing copy would lose the deep link.
    vi.stubEnv('VITE_UI_PUBLIC_LANDING', 'true')
    const { RequireAuth, ThemeProvider } = await loadHarness()

    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/predict']}>
          <Routes>
            <Route element={<RequireAuth />}>
              <Route path="/predict" element={<p>Predict</p>} />
            </Route>
            <Route path="/auth/login" element={<p>The log in screen</p>} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )

    await waitFor(() => expect(screen.getByText('The log in screen')).toBeTruthy())
  })

  it('leaves the signed-in Hub on `/` exactly where it was', async () => {
    // The landing page must not have moved the Hub's URL. Every existing
    // bookmark, shared link and redirect target in the application points here.
    vi.stubEnv('VITE_UI_PUBLIC_LANDING', 'true')
    auth.state = { userId: 'player-1', loading: false }

    await renderRoot()

    await waitFor(() => expect(screen.getByText('The signed-in Hub')).toBeTruthy())
  })

  it('shows neither page while the session is still resolving', async () => {
    // A refresh that flashed the marketing page before the Hub appeared would
    // tell a signed-in player they were signed out.
    vi.stubEnv('VITE_UI_PUBLIC_LANDING', 'true')
    auth.state = { userId: null, loading: true }

    await renderRoot()

    expect(screen.queryByText('The signed-in Hub')).toBeNull()
    expect(screen.queryByText('The log in screen')).toBeNull()
    // The neutral splash, which does carry an h1 of its own — so this asks for
    // the landing page's proposition rather than for "any level-1 heading".
    expect(screen.queryByText('Make every match mean more.')).toBeNull()
  })
})
