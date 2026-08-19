import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { VNextChampionshipScreen } from '../../src/vnext/integration/championship/VNextChampionshipScreen'

/**
 * THE SEAM ITSELF — 134 lines that no test rendered.
 *
 * It holds no bracket logic, which is the point of it, but it does make four
 * decisions nothing else makes: which of five states to show, whether the shell
 * wraps the body at all, what the one intent does, and how a write outcome
 * becomes the `notice` the surface prints. Every one of those is the kind of
 * wiring the compiler cannot check.
 *
 * WHAT IT MUST NEVER DO. This is a survival-shaped page, so the worst available
 * sentence is one that turns a network fault into a verdict. No state below may
 * say the reader is out or did not qualify.
 */

const server = vi.hoisted(() => ({
  state: { bracketFails: false, submitFails: null as string | null },
  calls: { submit: 0 },
  submissions: [] as { windowId: string; value: number }[],
}))

vi.mock('../../src/services/supabase/seasonPlayContext', () => ({
  createSeasonPlayContextGateway: () => ({
    load: async () => ({
      tournamentId: 't-1',
      competitionName: 'Caledonian Premiership',
      seasonLabel: '2027/28',
    }),
  }),
}))

vi.mock('../../src/services/supabase/seasonCupBracket', () => ({
  fetchSeasonCupBracket: async () => {
    if (server.state.bracketFails) throw new Error('no bracket')
    return {
      entered: true,
      serverNow: '2027-05-01T12:00:00.000Z',
      format: { kind: 'groups', producesKnockout: true, groupStageLastSequence: 20 },
      qualification: { drawn: true, qualifiers: 4, yourSeed: 1, youQualified: true },
      myTie: {
        fixtureId: 'fx-1',
        stage: 'knockout' as const,
        roundSize: 4,
        bracketSlot: 1,
        windowSequence: 21,
        windowLabel: 'Semi-finals',
        isHome: true,
        opponent: { userId: 'u-2', displayName: 'Bo' },
        locksAt: null,
      },
      penaltyNumber: {
        windowId: 'w-1',
        windowLabel: 'Semi-finals',
        lane: 'odd' as const,
        submitted: false,
        value: null,
        version: 3,
        locksAt: '2027-05-02T14:00:00.000Z',
        locked: false,
        open: true,
      },
      myTies: [
        {
          fixtureId: 'fx-1',
          stage: 'knockout' as const,
          windowSequence: 21,
          windowLabel: 'Semi-finals',
          isHome: true,
          opponent: { userId: 'u-2', displayName: 'Bo' },
          settled: false,
          youWon: false,
          decidedBy: null,
          settledAt: null,
        },
      ],
      bracket: [
        {
          fixtureId: 'fx-1',
          stage: 'knockout' as const,
          roundSize: 4,
          bracketSlot: 1,
          windowSequence: 21,
          windowLabel: 'Semi-finals',
          home: { userId: 'u-me', displayName: 'Ada' },
          away: { userId: 'u-2', displayName: 'Bo' },
          isYours: true,
          winnerUserId: null,
          decidedBy: null,
        },
      ],
      champion: null,
    }
  },
}))

vi.mock('../../src/services/supabase/seasonCupGroupStage', () => ({
  fetchSeasonCupGroupStage: async () => ({ available: false }),
}))

vi.mock('../../src/services/supabase/cup', () => ({
  submitCupPenaltyNumber: async (_competitionId: string, windowId: string, value: number) => {
    server.calls.submit += 1
    server.submissions.push({ windowId, value })
    if (server.state.submitFails !== null) {
      throw Object.assign(new Error('declined'), { code: server.state.submitFails })
    }
  },
}))

const BASE = {
  userId: 'u-me',
  authLoading: false,
  competitionSlug: 'caledonian',
  seasonSlug: '2027-28',
  championshipId: 'cup-1',
  gameName: 'Predictor Championship',
}

beforeEach(() => {
  server.state.bracketFails = false
  server.state.submitFails = null
  server.calls.submit = 0
  server.submissions.length = 0
})

/** No state this screen can reach may read as a verdict on the player. */
function expectsNoVerdict() {
  expect(document.body.textContent).not.toMatch(/eliminated|did not qualify|you are out/i)
}

describe('the screen chooses a state without ever passing a verdict', () => {
  it('asks the reader to sign in, and says nothing about the competition', () => {
    render(<VNextChampionshipScreen {...BASE} userId={null} />)
    expect(screen.getByText('Sign in to see your Championship')).toBeInTheDocument()
    expectsNoVerdict()
  })

  it('says there is nothing to show when no Championship is addressed', () => {
    render(<VNextChampionshipScreen {...BASE} championshipId={undefined} />)
    expect(screen.getByText('No Championship to show')).toBeInTheDocument()
    expectsNoVerdict()
  })

  it('renders the bracket once both reads answer', async () => {
    render(<VNextChampionshipScreen {...BASE} />)
    await waitFor(() => expect(screen.getByText('Bo')).toBeInTheDocument())
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('offers a retry on a failed read, and calls the read a read', async () => {
    server.state.bracketFails = true
    render(<VNextChampionshipScreen {...BASE} />)
    // The bracket read failing is a PANEL outcome, not a dead page: the shell
    // still builds, so the page renders with the bracket panel unavailable.
    await waitFor(() => expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument())
    expectsNoVerdict()
  })
})

describe('the one intent this screen can emit', () => {
  it('submits the number the surface handed it, against the read’s window', async () => {
    const { getByLabelText, getByRole } = render(<VNextChampionshipScreen {...BASE} />)
    await waitFor(() => expect(getByLabelText('Your Penalty Number')).toBeInTheDocument())
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.change(getByLabelText('Your Penalty Number'), { target: { value: '7' } })
    fireEvent.click(getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(server.calls.submit).toBe(1))
    expect(server.submissions).toEqual([{ windowId: 'w-1', value: 7 }])
  })

  it('prints the refusal’s own sentence rather than choosing new copy', async () => {
    server.state.submitFails = '55000'
    const { getByLabelText, getByRole } = render(<VNextChampionshipScreen {...BASE} />)
    await waitFor(() => expect(getByLabelText('Your Penalty Number')).toBeInTheDocument())
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.change(getByLabelText('Your Penalty Number'), { target: { value: '7' } })
    fireEvent.click(getByRole('button', { name: 'Submit' }))
    // The sentence `championshipRefusal` chose for 55000, carried whole.
    await waitFor(() =>
      expect(screen.getByText(/not taking Penalty Numbers/i)).toBeInTheDocument(),
    )
    expectsNoVerdict()
  })

  it('says the round was reloaded on a version conflict', async () => {
    server.state.submitFails = 'PT409'
    const { getByLabelText, getByRole } = render(<VNextChampionshipScreen {...BASE} />)
    await waitFor(() => expect(getByLabelText('Your Penalty Number')).toBeInTheDocument())
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.change(getByLabelText('Your Penalty Number'), { target: { value: '7' } })
    fireEvent.click(getByRole('button', { name: 'Submit' }))
    await waitFor(() =>
      expect(screen.getByText(/changed somewhere else/i)).toBeInTheDocument(),
    )
  })
})
