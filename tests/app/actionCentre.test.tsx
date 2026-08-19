import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { ActionCentre } from '../../src/app/ActionCentre'
import { outstandingCount } from '../../src/app/outstandingCount'
import type { InboxAction, PlayInbox } from '../../src/features/hub/playInboxModel'
import type { PersistentPlayerAction } from '../../src/services/supabase/playerActions'

function action(overrides: Partial<InboxAction> = {}): InboxAction {
  return {
    key: 'k1',
    kind: 'match_predictor',
    competitionName: 'Premier League',
    seasonLabel: '2026/27',
    gameName: 'Match Predictor',
    title: 'Predict matchweek 4',
    locksAt: '2026-08-15T11:30:00Z',
    href: '/competitions/premier-league/2026-27/games/match-predictor',
    outstanding: true,
    ...overrides,
  }
}

function inbox(overrides: Partial<PlayInbox> = {}): PlayInbox {
  return {
    urgent: [],
    thisWeek: [],
    settled: [],
    unreadable: [],
    allClear: false,
    empty: false,
    ...overrides,
  }
}

function persistent(overrides: Partial<PersistentPlayerAction> = {}): PersistentPlayerAction {
  return {
    actionKey: 'persist-1',
    actionType: 'matchweek_predictions_due',
    priority: 2,
    tournamentId: 'season-1',
    competitionId: null,
    deadlineAt: null,
    expiresAt: null,
    context: {},
    seen: false,
    seenAt: null,
    dismissed: false,
    generatedAt: '2026-08-18T12:00:00Z',
    ...overrides,
  }
}

function open(
  state: PlayInbox | null,
  status: 'loading' | 'ready' = 'ready',
  persistentActions: readonly PersistentPlayerAction[] = [],
  persistentStatus: 'idle' | 'loading' | 'ready' | 'error' = 'ready',
) {
  const onClose = vi.fn()
  const onDismiss = vi.fn(async () => undefined)
  render(
    <MemoryRouter>
      <ActionCentre
        open
        onClose={onClose}
        status={status}
        inbox={state}
        persistentStatus={persistentStatus}
        persistentActions={persistentActions}
        onDismissPersistentAction={onDismiss}
      />
    </MemoryRouter>,
  )
  return { onClose, onDismiss }
}

describe('outstandingCount', () => {
  it('counts what the player owes and nothing else', () => {
    expect(
      outstandingCount(
        inbox({
          urgent: [action({ key: 'a' })],
          thisWeek: [action({ key: 'b' }), action({ key: 'c' })],
          settled: [action({ key: 'd', outstanding: false })],
        }),
      ),
    ).toBe(3)
  })

  it('never counts a settled action, so finishing one clears it', () => {
    expect(
      outstandingCount(inbox({ settled: [action({ key: 'd', outstanding: false })] })),
    ).toBe(0)
  })

  it('claims nothing while the inbox is unknown', () => {
    expect(outstandingCount(null)).toBe(0)
  })
})

describe('the action centre panel', () => {
  it('groups what is due soon apart from the rest of the week', () => {
    open(
      inbox({
        urgent: [action({ key: 'a', title: 'Predict matchweek 4' })],
        thisWeek: [action({ key: 'b', title: 'Pick your club' })],
        settled: [action({ key: 'c', title: 'Matchweek 3 settled', outstanding: false })],
      }),
    )

    expect(screen.getByRole('heading', { name: 'Due soon' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'This week' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Done and waiting' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Predict matchweek 4/ })).toBeInTheDocument()
  })

  it('names a competition it could not check rather than implying all is well', () => {
    open(inbox({ unreadable: ['Scottish Premiership'] }))
    expect(screen.getByText(/Scottish Premiership/)).toBeInTheDocument()
    expect(screen.getByText(/missing from this list/)).toBeInTheDocument()
  })

  it('still lists an action it cannot link to, rather than under-reporting', () => {
    open(inbox({ urgent: [action({ key: 'a', href: null, title: 'Something due' })] }))
    expect(screen.getByText('Something due')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Something due/ })).toBeNull()
  })

  it('keeps outstanding work distinct from persistent read state', () => {
    open(inbox({ allClear: true }), 'ready', [persistent({ seen: false })])
    expect(screen.getByText(/up to date in every competition/)).toBeInTheDocument()
    expect(screen.getByText('Predictions due')).toBeInTheDocument()
    expect(screen.getByText('New')).toBeInTheDocument()
  })

  it('represents every current server action kind without inventing an invitation', () => {
    open(inbox(), 'ready', [
      persistent({ actionKey: 'a', actionType: 'matchweek_predictions_due' }),
      persistent({ actionKey: 'b', actionType: 'lms_pick_due' }),
      persistent({ actionKey: 'c', actionType: 'cup_penalty_number_due' }),
      persistent({ actionKey: 'd', actionType: 'matchweek_settled' }),
      persistent({ actionKey: 'e', actionType: 'game_consequence' }),
    ])

    for (const title of [
      'Predictions due',
      'Last Man Standing pick due',
      'Cup penalty number due',
      'Matchweek settled',
      'Game update',
    ]) {
      expect(screen.getByText(title)).toBeInTheDocument()
    }
    expect(screen.queryByText('League invitation')).toBeNull()
  })

  it('will render a league invitation only when the server actually supplies one', () => {
    open(inbox(), 'ready', [persistent({ actionType: 'league_invitation' })])
    expect(screen.getByText('League invitation')).toBeInTheDocument()
  })

  it('dismisses the exact server-issued action key', () => {
    const { onDismiss } = open(inbox(), 'ready', [persistent({ actionKey: 'server-key' })])
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onDismiss).toHaveBeenCalledWith('server-key')
  })

  it('keeps the to-do list usable if persistent state cannot load', () => {
    open(
      inbox({ urgent: [action({ title: 'Pick before lock' })] }),
      'ready',
      [],
      'error',
    )
    expect(screen.getByText('Pick before lock')).toBeInTheDocument()
    expect(screen.getByText(/saved updates could not be checked/i)).toBeInTheDocument()
  })

  it('is a dialog that Escape closes and that takes focus when it opens', () => {
    const { onClose } = open(inbox({ urgent: [action()] }))
    const dialog = screen.getByRole('dialog', { name: 'To do' })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('reports that it is still checking rather than showing an empty list', () => {
    open(null, 'loading', [], 'loading')
    expect(screen.getByText(/Checking your competitions/)).toBeInTheDocument()
    expect(screen.queryByText(/up to date/)).toBeNull()
  })

  it('renders nothing at all when closed', () => {
    render(
      <MemoryRouter>
        <ActionCentre
          open={false}
          onClose={() => {}}
          status="ready"
          inbox={inbox()}
          persistentStatus="ready"
          persistentActions={[]}
          onDismissPersistentAction={async () => undefined}
        />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
