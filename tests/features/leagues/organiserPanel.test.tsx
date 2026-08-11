import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OrganiserPanel } from '../../../src/features/leagues/OrganiserPanel'
import {
  mapOrganisedCompetition,
  mapOrganisedCompetitions,
} from '../../../src/services/supabase/organisedCompetitionsModel'

/**
 * The organiser's view of a competition they made (contract 165).
 *
 * THE ONE PROPERTY THAT MATTERS: owning a competition is not a reveal
 * exemption. This surface shows THAT an entrant has picked and never WHAT, and
 * it is the easiest place in the product to get that wrong — the person looking
 * created the competition, so it feels as though they should see everything in
 * it. The read carries no club at all, and these assertions keep the surface
 * from inventing one.
 *
 * THE SECOND: there is no organiser command, and its absence is designed. No
 * accepted authority grants an organiser power over another entrant, and that
 * power is the power to eliminate somebody. The panel renders a control for
 * each command the SERVER names, so a command that has not been accepted cannot
 * be added by adding a button.
 */

const LIST = mapOrganisedCompetitions({
  total: 1,
  competitions: [
    {
      id: 'c1',
      name: 'Sunday Survivors',
      game_key: 'last_man_standing',
      season_name: 'Premier League 2026/27',
      invite_code: 'LMS234DEF567',
    },
  ],
})

function detail(overrides: Record<string, unknown> = {}) {
  return mapOrganisedCompetition({
    competition: {
      id: 'c1',
      name: 'Sunday Survivors',
      game_key: 'last_man_standing',
      season_name: 'Premier League 2026/27',
      invite_code: 'LMS234DEF567',
    },
    setup: { lives: 1, saves: 0, draws_rule: 'eliminate', endgame_on_wipeout: 'play_on' },
    current_round: { window_id: 'w1', sequence: 4, label: 'Round 4', locked: false },
    counts: { entrants: 3, remaining: 2, eliminated: 1, left: 0, awaiting_pick: 1 },
    entrants: [
      {
        user_id: 'u1',
        display_name: 'Sam',
        outcome: 'active',
        still_in: true,
        has_picked_current_round: true,
      },
      {
        user_id: 'u2',
        display_name: 'Alex',
        outcome: 'active',
        still_in: true,
        has_picked_current_round: false,
      },
    ],
    organiser_commands_available: [],
    ...overrides,
  })
}

function renderPanel(view = detail()) {
  render(
    <OrganiserPanel
      list={vi.fn(async () => LIST)}
      open={vi.fn(async () => view)}
    />,
  )
}

describe('the organiser panel', () => {
  it('shows THAT an entrant has picked and never what', async () => {
    renderPanel()

    fireEvent.click(await screen.findByRole('button', { name: /Sunday Survivors/ }))

    expect(await screen.findByText(/Still in · picked/)).toBeInTheDocument()
    expect(screen.getByText(/Still in · not picked yet/)).toBeInTheDocument()
    // No club anywhere: the read carries none and the surface invents none.
    expect(screen.queryByText(/Arsenal|Chelsea|club/i)).toBeNull()
  })

  it('says plainly what an organiser cannot do, rather than leaving them to find out', async () => {
    renderPanel()
    fireEvent.click(await screen.findByRole('button', { name: /Sunday Survivors/ }))

    expect(
      await screen.findByText(/organising a competition is not authority over the people in it/),
    ).toBeInTheDocument()
  })

  it('renders a command only if the server names one', async () => {
    renderPanel()
    fireEvent.click(await screen.findByRole('button', { name: /Sunday Survivors/ }))
    await screen.findByText(/Still in · picked/)

    expect(screen.queryByRole('button', { name: /remove|eliminate|disqualif/i })).toBeNull()
  })

  it('surfaces the invite code, which is the organiser’s live question', async () => {
    renderPanel()
    fireEvent.click(await screen.findByRole('button', { name: /Sunday Survivors/ }))

    expect(await screen.findByText('LMS234DEF567')).toBeInTheDocument()
  })

  it('renders nothing at all for a player who organises nothing', async () => {
    const { container } = render(
      <OrganiserPanel
        list={vi.fn(async () => mapOrganisedCompetitions({ competitions: [] }))}
        open={vi.fn(async () => null)}
      />,
    )

    await vi.waitFor(() => expect(container.textContent).toBe(''))
  })

  it('refuses a competition the caller does not organise, rather than showing an empty one', async () => {
    render(
      <OrganiserPanel list={vi.fn(async () => LIST)} open={vi.fn(async () => null)} />,
    )
    fireEvent.click(await screen.findByRole('button', { name: /Sunday Survivors/ }))

    expect(await screen.findByText(/do not organise this competition/)).toBeInTheDocument()
  })

  it('reports a failed list as a failure, never as organising nothing', async () => {
    render(
      <OrganiserPanel
        list={vi.fn(async () => {
          throw new Error('network')
        })}
        open={vi.fn(async () => null)}
      />,
    )

    expect(await screen.findByText(/could not check what you organise/i)).toBeInTheDocument()
  })
})
