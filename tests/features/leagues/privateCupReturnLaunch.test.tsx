import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OrganiserPanel } from '../../../src/features/leagues/OrganiserPanel'
import {
  mapOrganisedCompetition,
  mapOrganisedCompetitions,
} from '../../../src/services/supabase/organisedCompetitionsModel'
import type { PrivateCupLaunchReadiness } from '../../../src/services/supabase/privateCompetitionDiscoveryModel'
import type { CupLaunchResult } from '../../../src/services/supabase/privateCompetitionsModel'

const LIST = mapOrganisedCompetitions({
  competitions: [
    {
      id: 'cup-1',
      name: 'Office Championship',
      game_key: 'predictor_cup',
      season_name: 'Premier League 2026/27',
      invite_code: 'CUP234DEF567',
    },
  ],
})

const DETAIL = mapOrganisedCompetition({
  competition: {
    id: 'cup-1',
    name: 'Office Championship',
    game_key: 'predictor_cup',
    season_name: 'Premier League 2026/27',
    invite_code: 'CUP234DEF567',
  },
  setup: null,
  current_round: null,
  counts: { entrants: 8, remaining: 8, eliminated: 0, left: 0, awaiting_pick: null },
  entrants: [],
  organiser_commands_available: [],
})

const READY: PrivateCupLaunchReadiness = {
  launched: false,
  entrants: 8,
  remainingRounds: 12,
  formatKind: 'single_group',
  canLaunch: true,
  blockedReason: null,
}

type ReadLaunch = (competitionId: string) => Promise<PrivateCupLaunchReadiness | null>
type LaunchCup = (competitionId: string) => Promise<CupLaunchResult>
type Changed = () => void

function renderCup(options?: {
  read?: ReadLaunch
  launch?: LaunchCup
  changed?: Changed
}) {
  const read = options?.read ?? vi.fn(async (_competitionId: string) => READY)
  const launch =
    options?.launch ??
    vi.fn(async (_competitionId: string): Promise<CupLaunchResult> => ({
      outcome: 'launched',
      entrants: 8,
      leagueRounds: 6,
      fixtures: 28,
    }))
  const changed = options?.changed ?? vi.fn(() => undefined)

  render(
    <OrganiserPanel
      list={vi.fn(async () => LIST)}
      open={vi.fn(async () => DETAIL)}
      readCupLaunch={read}
      launchCup={launch}
      onCompetitionChanged={changed}
    />,
  )

  return { read, launch, changed }
}

describe('return-later private Championship launch', () => {
  it('uses the server readiness verdict and explains the irreversible effect before launch', async () => {
    const { read } = renderCup()
    fireEvent.click(await screen.findByRole('button', { name: /Office Championship/ }))

    expect(await screen.findByRole('button', { name: 'Launch the Championship' })).toBeInTheDocument()
    expect(screen.getByText(/fixes the draw and closes registration/i)).toBeInTheDocument()
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument()
    expect(read).toHaveBeenCalledWith('cup-1')
  })

  it('launches through the existing server command, rereads, and reports the changed competition', async () => {
    const read = vi.fn(async (_competitionId: string): Promise<PrivateCupLaunchReadiness | null> => READY)
    read
      .mockResolvedValueOnce(READY)
      .mockResolvedValueOnce({
        ...READY,
        launched: true,
        canLaunch: false,
        blockedReason: 'already_launched',
      })
    const launch = vi.fn(async (_competitionId: string): Promise<CupLaunchResult> => ({
      outcome: 'launched',
      entrants: 8,
      leagueRounds: 6,
      fixtures: 28,
    }))
    const changed = vi.fn(() => undefined)
    renderCup({ read, launch, changed })

    fireEvent.click(await screen.findByRole('button', { name: /Office Championship/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Launch the Championship' }))

    expect(await screen.findByText('The field is fixed and registration is closed.')).toBeInTheDocument()
    expect(launch).toHaveBeenCalledWith('cup-1')
    expect(read).toHaveBeenCalledTimes(2)
    expect(changed).toHaveBeenCalledTimes(1)
  })

  it('reopens a controlled organiser selection after a parent refresh remount', async () => {
    const read = vi.fn(async (_competitionId: string): Promise<PrivateCupLaunchReadiness | null> => ({
      ...READY,
      launched: true,
      canLaunch: false,
      blockedReason: 'already_launched',
    }))

    // This is deliberately a fresh mount, not a rerender. `/leagues` temporarily
    // swaps the whole Workspace for its loading skeleton during an authoritative
    // reread, so the organiser panel is destroyed and later recreated. The page
    // owns the selected id; a recreated controlled panel must reopen it and read
    // the launched state again rather than collapsing at the success boundary.
    render(
      <OrganiserPanel
        list={vi.fn(async () => LIST)}
        open={vi.fn(async () => DETAIL)}
        readCupLaunch={read}
        launchCup={vi.fn(async (): Promise<CupLaunchResult> => ({ outcome: 'already_launched' }))}
        selectedCompetitionId="cup-1"
        onSelectedCompetitionChange={vi.fn()}
      />,
    )

    const summary = await screen.findByRole('button', { name: /Office Championship/ })
    expect(summary).toHaveAttribute('aria-expanded', 'true')
    expect(await screen.findByText('The field is fixed and registration is closed.')).toBeInTheDocument()
    expect(read).toHaveBeenCalledWith('cup-1')
  })

  it('does not render a launch command when the server refuses readiness', async () => {
    const read = vi.fn(async (_competitionId: string): Promise<PrivateCupLaunchReadiness | null> => ({
      ...READY,
      entrants: 32,
      formatKind: 'groups',
      canLaunch: false,
      blockedReason: 'field_needs_administered_draw',
    }))
    renderCup({ read })

    fireEvent.click(await screen.findByRole('button', { name: /Office Championship/ }))

    expect(await screen.findByText(/administrator-managed draw/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Launch the Championship' })).toBeNull()
  })
})
