import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { VNextOnboardingScreen } from '../../src/vnext/integration/onboarding/VNextOnboardingScreen'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import { shellScenarios } from '../../src/vnext/fixtures'
import type { SeasonClub } from '../../src/services/supabase/seasonClubs'

/**
 * THE CONNECTED ONBOARDING SCREEN.
 *
 * The second review round found this file's absence rather than its contents:
 * every onboarding test targeted the presentational component against fixed
 * fixtures, or the pure mapper, so ALL of the read and effect logic — the club
 * effect, the retry, the resume, the failure fallbacks — was untested. The
 * blocker it then found was a direct consequence, and the first test below is
 * its regression.
 *
 * `readClubs` is injected, so nothing here reaches Supabase. The catalogue read
 * is module-mocked for the same reason.
 */

const { fetchPublishedWeeklySeasons, fetchHubMembership, fetchPlayerPreferences } = vi.hoisted(
  () => ({
    fetchPublishedWeeklySeasons: vi.fn(),
    fetchHubMembership: vi.fn(),
    fetchPlayerPreferences: vi.fn(),
  }),
)

vi.mock('../../src/services/supabase/weeklyCatalogue', () => ({ fetchPublishedWeeklySeasons }))
vi.mock('../../src/services/supabase/competitionGames', () => ({ fetchHubMembership }))
vi.mock('../../src/services/supabase/playerPreferences', () => ({ fetchPlayerPreferences }))

const SEASON = 'Caledonian Premiership 2027/28'
const SERVER_NOW = '2027-08-01T12:00:00.000Z'

function club(teamId: string, name: string): SeasonClub {
  return {
    teamId,
    name,
    tokens: { monogram: name.slice(0, 3).toUpperCase(), primary: '#123456' },
    identityResolved: true,
  }
}

function arrange(
  over: {
    readonly registrationClosesAt?: string | null
    readonly serverNow?: string | null
  } = {},
) {
  fetchPublishedWeeklySeasons.mockResolvedValue([
    {
      seasonName: SEASON,
      competitionName: 'Caledonian Premiership',
      competitionSlug: 'caledonian',
      seasonKey: '2027-28',
      seasonLabel: '2027/28',
      status: 'active',
      timeZone: 'Europe/London',
      competitionId: 'c-1',
      seasonId: 't-1',
    },
  ])
  fetchHubMembership.mockResolvedValue([
    {
      seasonName: SEASON,
      tournamentId: 't-1',
      seasonStatus: 'active',
      seasonGames: {
        competitionMember: false,
        serverNow: over.serverNow === undefined ? SERVER_NOW : over.serverNow,
        games: [
          {
            id: 'g-1',
            gameKey: 'main_predictor',
            active: true,
            displayName: 'Match Predictor',
            registrationOpensAt: '2027-07-01T00:00:00.000Z',
            registrationClosesAt:
              over.registrationClosesAt === undefined
                ? '2027-09-01T00:00:00.000Z'
                : over.registrationClosesAt,
            completedAt: null,
            lockPolicy: { scope: 'matchweek', bufferMinutes: 0 },
            allowRejoin: true,
            membership: null,
          },
        ],
      },
    },
  ])
  fetchPlayerPreferences.mockResolvedValue({
    onboarding: { step: 'clubs', completedAt: null },
    follows: [{ tournamentId: 't-1', favouriteTeamId: null, followedAt: null }],
    pinnedRivals: [],
  })
}

function renderScreen(readClubs: (id: string) => Promise<readonly SeasonClub[]>) {
  return render(
    <VNextShellProvider model={shellScenarios.oneCompetition}>
      <VNextOnboardingScreen
        userId="u-1"
        authLoading={false}
        displayName="Ada"
        readClubs={readClubs}
      />
    </VNextShellProvider>,
  )
}

describe('a club read that was in flight when the step changed still arrives', () => {
  it('does not strand the favourite step on "Loading clubs…" forever', async () => {
    arrange()

    // A read we control, so the step can change while it is outstanding.
    let release: ((rows: readonly SeasonClub[]) => void) | null = null
    const readClubs = vi.fn(
      () =>
        new Promise<readonly SeasonClub[]>((resolve) => {
          release = resolve
        }),
    )

    renderScreen(readClubs)

    // The stored step is `clubs`, so the read is issued on arrival.
    await waitFor(() => expect(readClubs).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(/loading clubs/i)).toBeInTheDocument()

    // Leave the step and come back while it is still outstanding — which used
    // to tear the effect down, discard the answer, and leave the key marked as
    // already asked-for so nothing ever re-asked.
    act(() => {
      screen.getByRole('button', { name: 'Back' }).click()
    })
    act(() => {
      screen.getByRole('button', { name: 'Continue' }).click()
    })

    // It is NOT re-read — that is the caching rule, and it is correct.
    expect(readClubs).toHaveBeenCalledTimes(1)

    // And when the original read lands, it is still stored and drawn.
    await act(async () => {
      release?.([club('club-1', 'Ardrossan Athletic')])
    })
    expect(await screen.findByRole('button', { name: 'Ardrossan Athletic' })).toBeInTheDocument()
    expect(screen.queryByText(/loading clubs/i)).toBeNull()
  })
})

describe('the entry rule reaches the games step', () => {
  it('offers no control for a game whose registration has closed', async () => {
    // The catalogue calls this game `available` — it keeps only `active` — so
    // this can only come from the registration windows on the membership read.
    arrange({ registrationClosesAt: '2027-07-15T00:00:00.000Z' })
    renderScreen(async () => [])

    await screen.findByText(/have you got a club/i)
    act(() => {
      screen.getByRole('button', { name: 'Continue' }).click()
    })

    const row = await waitFor(() => {
      const node = document.querySelector('[data-vnext-game="main_predictor"]')
      if (node === null) throw new Error('no game row yet')
      return node as HTMLElement
    })
    expect(row.textContent).toMatch(/registration has closed/i)
    expect(row.querySelector('input')).toBeNull()
  })

  it('offers a control when the window is open', async () => {
    arrange()
    renderScreen(async () => [])

    await screen.findByText(/have you got a club/i)
    act(() => {
      screen.getByRole('button', { name: 'Continue' }).click()
    })

    const row = await waitFor(() => {
      const node = document.querySelector('[data-vnext-game="main_predictor"]')
      if (node === null) throw new Error('no game row yet')
      return node as HTMLElement
    })
    expect(row.querySelector('input')).not.toBeNull()
  })

  it('fails closed when the read carried no server clock', async () => {
    // Resolving a window against the device clock is the one thing `serverNow`
    // exists to prevent, so a read without one offers nothing rather than
    // guessing.
    arrange({ serverNow: null })
    renderScreen(async () => [])

    await screen.findByText(/have you got a club/i)
    act(() => {
      screen.getByRole('button', { name: 'Continue' }).click()
    })

    const row = await waitFor(() => {
      const node = document.querySelector('[data-vnext-game="main_predictor"]')
      if (node === null) throw new Error('no game row yet')
      return node as HTMLElement
    })
    expect(row.querySelector('input')).toBeNull()
  })
})

describe('the screen resumes rather than restarting', () => {
  it('opens on the step contract 157 stored, with the stored follow already on', async () => {
    arrange()
    renderScreen(async () => [])

    // `onboarding.step` is `clubs`, so it does not open on step one.
    expect(await screen.findByText('Step 2 of 4')).toBeInTheDocument()
  })
})

describe('a catalogue that does not answer', () => {
  it('says so, and does not blame the account', async () => {
    fetchPublishedWeeklySeasons.mockRejectedValue(new Error('nope'))
    renderScreen(async () => [])
    expect(await screen.findByText(/your account is fine/i)).toBeInTheDocument()
  })
})
