import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProviderChangePanel } from '../../../src/features/admin/ProviderChangePanel'
import {
  mapProviderChangeDecision,
  mapProviderChangeProposals,
} from '../../../src/services/supabase/providerChangeProposalsModel'

/**
 * Contract 174 on screen.
 *
 * THE PROPERTY THAT MATTERS MOST IS WHICH CONTROLS EXIST. Approving one of
 * these is the only path in the repository that adds a fixture to a published
 * season or takes one out, so the surface must offer approval exactly where the
 * SERVER says it may — pending, with no blockers — and must never render a
 * control that the server will refuse. `decidable` is the server's word and is
 * not recomputed here.
 *
 * The other is that a refusal reaches the administrator as the server wrote it.
 * "That fixture now has a result" is the sentence they need; a generic message
 * would send them looking for a fault that is not there.
 */

const proposal = (over: Record<string, unknown> = {}) => ({
  id: 'prop-1',
  kind: 'discovered',
  state: 'pending',
  provider: 'sportmonks',
  providerFixtureId: '99887',
  detectedAt: '2026-08-11T09:00:00Z',
  seenCount: 3,
  lastSeenAt: '2026-08-12T09:00:00Z',
  round: 'Matchweek 5',
  roundOrdinal: 5,
  homeTeam: 'Liverpool',
  awayTeam: 'Arsenal',
  proposed: { kickoffAt: '2026-09-13T14:00:00Z', status: 'scheduled' },
  observed: { kickoffAt: null, status: null },
  warnings: ['The kickoff is outside this round window'],
  blockers: [],
  decidable: true,
  decidedAt: null,
  decisionReason: null,
  resultingAction: null,
  ...over,
})

const page = (proposals: unknown[], over: Record<string, unknown> = {}) =>
  mapProviderChangeProposals({
    tournament_id: 't-1',
    state: 'pending',
    total: proposals.length,
    returned: proposals.length,
    truncated: false,
    proposals,
    ...over,
  })

describe('ProviderChangePanel', () => {
  it('names the proposal, the fixture and what the provider proposes beside what we hold', async () => {
    render(<ProviderChangePanel load={async () => page([proposal()])} decide={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('A fixture we do not hold')).toBeInTheDocument())

    expect(screen.getByText('Liverpool v Arsenal')).toBeInTheDocument()
    expect(screen.getByText(/Matchweek 5 · matchweek 5/)).toBeInTheDocument()
    // Repeats matter: fifty reports is a different thing from one.
    expect(screen.getByText(/seen 3 times/)).toBeInTheDocument()
    // The comparison, field by field, and never a raw provider payload.
    expect(screen.getByRole('rowheader', { name: 'kickoffAt' })).toBeInTheDocument()
    expect(screen.getByText('2026-09-13T14:00:00Z')).toBeInTheDocument()
    // Warnings named, not counted.
    expect(screen.getByText('The kickoff is outside this round window')).toBeInTheDocument()
  })

  it('names the consequence on the approve control rather than saying "approve"', async () => {
    render(<ProviderChangePanel load={async () => page([proposal()])} decide={vi.fn()} />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add this fixture' })).toBeInTheDocument(),
    )

    render(
      <ProviderChangePanel
        load={async () => page([proposal({ id: 'prop-2', kind: 'cancelled' })])}
        decide={vi.fn()}
      />,
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Void this fixture' })).toBeInTheDocument(),
    )
  })

  it('offers no approval where the server said it is not decidable, and names the blockers', async () => {
    render(
      <ProviderChangePanel
        load={async () =>
          page([
            proposal({
              decidable: false,
              blockers: ['That fixture already carries a result'],
            }),
          ])
        }
        decide={vi.fn()}
      />,
    )
    await waitFor(() =>
      expect(screen.getByText('That fixture already carries a result')).toBeInTheDocument(),
    )
    expect(screen.queryByRole('button', { name: 'Add this fixture' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument()
    expect(screen.getByText(/cannot be approved while the blockers above stand/)).toBeInTheDocument()
  })

  it('sends the decision and the reason to the server, and reports what it recorded', async () => {
    const decide = vi.fn(async () =>
      mapProviderChangeDecision({
        proposal_id: 'prop-1',
        state: 'rejected',
        repeated: false,
        resulting_action: { calendar_unchanged: true },
      }),
    )
    render(<ProviderChangePanel load={async () => page([proposal()])} decide={decide} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Not our fixture' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))

    await waitFor(() => expect(decide).toHaveBeenCalledWith('prop-1', 'reject', 'Not our fixture'))
    await waitFor(() => expect(screen.getByText('Recorded as rejected.')).toBeInTheDocument())
  })

  it('treats a repeated decision as an answer rather than a failure', async () => {
    const decide = vi.fn(async () =>
      mapProviderChangeDecision({ proposal_id: 'prop-1', state: 'approved', repeated: true }),
    )
    render(<ProviderChangePanel load={async () => page([proposal()])} decide={decide} />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add this fixture' })).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add this fixture' }))
    await waitFor(() =>
      expect(screen.getByText('Already approved. Nothing changed.')).toBeInTheDocument(),
    )
  })

  it('shows the server’s own refusal rather than a generic failure', async () => {
    const decide = vi.fn(async () => {
      throw {
        code: '55000',
        message: 'That fixture now has a result; approving would rescore a settled matchweek',
      }
    })
    render(<ProviderChangePanel load={async () => page([proposal()])} decide={decide} />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add this fixture' })).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add this fixture' }))
    await waitFor(() =>
      expect(
        screen.getByText(
          'That fixture now has a result; approving would rescore a settled matchweek',
        ),
      ).toBeInTheDocument(),
    )
  })

  it('renders an unauthorised caller as a refusal, not as an empty queue', async () => {
    render(
      <ProviderChangePanel
        load={async () => {
          throw { code: '42501', message: 'not an admin' }
        }}
        decide={vi.fn()}
      />,
    )
    await waitFor(() =>
      expect(screen.getByText(/does not hold the administrator capability/)).toBeInTheDocument(),
    )
    expect(screen.queryByText(/No provider calendar change is waiting/)).not.toBeInTheDocument()
  })

  it('says plainly when nothing is waiting', async () => {
    render(<ProviderChangePanel load={async () => page([])} decide={vi.fn()} />)
    await waitFor(() =>
      expect(
        screen.getByText('No provider calendar change is waiting for a decision.'),
      ).toBeInTheDocument(),
    )
  })

  it('shows a decided proposal without any control over it', async () => {
    render(
      <ProviderChangePanel
        load={async () =>
          page([
            proposal({
              state: 'approved',
              decidable: false,
              decidedAt: '2026-08-12T10:00:00Z',
              decisionReason: null,
              resultingAction: { created_season_fixture_id: 'fx-9' },
            }),
          ])
        }
        decide={vi.fn()}
      />,
    )
    await waitFor(() => expect(screen.getByText(/Approved/)).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add this fixture' })).not.toBeInTheDocument()
  })
})

describe('mapProviderChangeProposals', () => {
  it('defaults an absent decidable flag to false rather than opening the write path', () => {
    const decoded = mapProviderChangeProposals({
      tournament_id: 't-1',
      proposals: [{ id: 'p-1', kind: 'discovered' }],
    })
    expect(decoded.proposals[0]?.decidable).toBe(false)
  })

  it('drops a row it cannot identify or describe', () => {
    const decoded = mapProviderChangeProposals({
      tournament_id: 't-1',
      proposals: [{ kind: 'discovered' }, { id: 'p-1' }, { id: 'p-2', kind: 'postponed' }],
    })
    expect(decoded.proposals.map((row) => row.id)).toEqual(['p-2'])
  })

  it('carries an unrecognised kind through rather than hiding the row', () => {
    const decoded = mapProviderChangeProposals({
      tournament_id: 't-1',
      proposals: [{ id: 'p-1', kind: 'relocated' }],
    })
    expect(decoded.proposals[0]?.kind).toBe('relocated')
  })
})
