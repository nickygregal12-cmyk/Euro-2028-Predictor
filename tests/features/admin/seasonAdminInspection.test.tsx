import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  SeasonAdminInspection,
  type SeasonAdminInspectionProps,
} from '../../../src/features/admin/SeasonAdminInspection'
import {
  mapAdminEntrantsPage,
  mapProviderProposalPage,
} from '../../../src/services/supabase/seasonAdminInspectionModel'

/**
 * The season administration inspection panels (contract 168, `DFA-009`).
 *
 * WHAT THEY REPLACE. A section headed "Not offered here, and why", which said
 * disqualification was absent because "no browser read enumerates a
 * competition's entrants, so the control could not name who it was about to
 * remove", and that calendar approval was absent because the review panel
 * reported a COUNT rather than the list an approval would act on. Both were
 * true. Contract 168 is those two reads.
 *
 * THE THREE THINGS THESE PANELS MUST NOT DO:
 *
 *   1. offer a per-proposal approve. `admin_approve_initial_provider_fixtures`
 *      decides a whole provider's calendar, and a per-row button would claim
 *      the server can do something it cannot;
 *   2. offer a disqualification the server would refuse. `disqualifiable` is the
 *      server's own prediction, and where it is false the panel explains rather
 *      than disabling;
 *   3. take a consequential decision without a reason or a confirmation.
 */

function proposals(overrides: Record<string, unknown> = {}) {
  return mapProviderProposalPage({
    tournament_id: 's1',
    total: 2,
    limit: 50,
    offset: 0,
    has_more: false,
    states: { pending: 2 },
    blocked_total: 1,
    proposals: [
      {
        proposal_id: 'p1',
        provider: 'sportmonks',
        proposed_kickoff_at: '2026-09-01T14:00:00Z',
        state: 'pending',
        home: { provider_name: 'Arsenal FC', mapped_team_id: 't1', mapped_team_name: 'Arsenal' },
        away: { provider_name: 'Chelsea FC', mapped_team_id: 't2', mapped_team_name: 'Chelsea' },
        blockers: [],
      },
      {
        proposal_id: 'p2',
        provider: 'sportmonks',
        proposed_kickoff_at: '2026-09-02T14:00:00Z',
        state: 'pending',
        home: { provider_name: 'Mystery United', mapped_team_id: null, mapped_team_name: null },
        away: { provider_name: 'Chelsea FC', mapped_team_id: 't2', mapped_team_name: 'Chelsea' },
        blockers: ['unmapped_home_team', 'kickoff_in_the_past'],
      },
    ],
    ...overrides,
  })
}

function entrants(overrides: Record<string, unknown> = {}) {
  return mapAdminEntrantsPage({
    competition: { id: 'c1', name: 'Sunday Survivors', game_name: 'Last Man Standing' },
    total: 2,
    limit: 50,
    offset: 0,
    has_more: false,
    entrants: [
      { user_id: 'u1', display_name: 'Sam', outcome: 'active', disqualifiable: true },
      {
        user_id: 'u2',
        display_name: 'Alex',
        outcome: 'eliminated',
        disqualified_at: '2026-09-01T00:00:00Z',
        disqualifiable: false,
      },
    ],
    ...overrides,
  })
}

function renderPanels(overrides: Partial<SeasonAdminInspectionProps> = {}) {
  const approve = vi.fn(async () => {})
  const reject = vi.fn(async () => {})
  const disqualify = vi.fn(async () => {})
  render(
    <SeasonAdminInspection
      tournamentId="s1"
      seasonName="Premier League 2026/27"
      loadProposals={vi.fn(async () => proposals())}
      approve={approve}
      reject={reject}
      competitions={[{ id: 'c1', name: 'Last Man Standing' }]}
      loadEntrants={vi.fn(async () => entrants())}
      disqualify={disqualify}
      {...overrides}
    />,
  )
  return { approve, reject, disqualify }
}

describe('the staged proposals panel', () => {
  it('names every blocker on the proposal it belongs to', async () => {
    renderPanels()

    expect(await screen.findByText('Mystery United v Chelsea')).toBeInTheDocument()
    expect(screen.getByText('Home club is not mapped to one of ours')).toBeInTheDocument()
    expect(screen.getByText('Kick-off is already in the past')).toBeInTheDocument()
  })

  it('offers no per-proposal approve, because the server has none', async () => {
    renderPanels()
    await screen.findByText('Mystery United v Chelsea')

    // One whole-calendar decision, not one per row.
    expect(screen.getAllByRole('button', { name: /Approve/ })).toHaveLength(1)
    expect(screen.getByRole('button', { name: /Approve sportmonks’s calendar/ })).toBeInTheDocument()
  })

  it('refuses to decide without a reason', async () => {
    renderPanels()
    await screen.findByText('Mystery United v Chelsea')

    expect(screen.getByRole('button', { name: /Approve sportmonks/ })).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Checked all 380' } })
    expect(screen.getByRole('button', { name: /Approve sportmonks/ })).toBeEnabled()
  })

  it('confirms before approving, and says how much it decides', async () => {
    const { approve } = renderPanels()
    await screen.findByText('Mystery United v Chelsea')

    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Checked all 380' } })
    fireEvent.click(screen.getByRole('button', { name: /Approve sportmonks/ }))

    expect(await screen.findByText(/2 in total/)).toBeInTheDocument()
    expect(approve).not.toHaveBeenCalled()

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(approve).toHaveBeenCalledWith('sportmonks', 'Checked all 380'))
  })

  it('says nothing is staged rather than showing an empty decision', async () => {
    renderPanels({
      loadProposals: vi.fn(async () =>
        proposals({ proposals: [], total: 0, blocked_total: 0, states: {} }),
      ),
    })

    expect(await screen.findByText(/Nothing is staged for this season/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Approve/ })).toBeNull()
  })
})

describe('the entrants panel', () => {
  it('offers a disqualification only where the server says it would accept one', async () => {
    renderPanels()

    expect(await screen.findByText('Sam')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Disqualify' })).toHaveLength(1)
    // Explained, never a disabled control to hover over.
    expect(screen.getByText('Already disqualified')).toBeInTheDocument()
  })

  it('names the person and warns it cannot be undone before disqualifying', async () => {
    const { disqualify } = renderPanels()
    await screen.findByText('Sam')

    fireEvent.click(screen.getByRole('button', { name: 'Disqualify' }))

    expect(await screen.findByText(/Disqualify Sam\?/)).toBeInTheDocument()
    expect(screen.getByText(/can never rejoin it/)).toBeInTheDocument()
    expect(disqualify).not.toHaveBeenCalled()
  })

  it('records the reason with the disqualification', async () => {
    const { disqualify } = renderPanels()
    await screen.findByText('Sam')

    fireEvent.click(screen.getByRole('button', { name: 'Disqualify' }))
    // Two Reason fields are on screen — the calendar decision's and this one —
    // so the modal's is named exactly.
    fireEvent.change(
      await screen.findByLabelText('Reason (required, recorded with the decision)'),
      { target: { value: 'Duplicate account' } },
    )
    // The row's control and the modal's confirmation share a name, so the
    // confirmation is reached through the dialog rather than by position.
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Disqualify' }),
    )

    await waitFor(() =>
      expect(disqualify).toHaveBeenCalledWith('c1', 'u1', 'Duplicate account'),
    )
  })

  it('reports a failed entrant read as a failure, never as an empty competition', async () => {
    renderPanels({
      loadEntrants: vi.fn(async () => {
        throw new Error('network')
      }),
    })

    expect(await screen.findByText(/could not load the entrants/i)).toBeInTheDocument()
    expect(screen.queryByText(/Nobody has entered/)).toBeNull()
  })
})
