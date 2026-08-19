import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { ActionCentre } from '../../src/app/ActionCentre'
import { outstandingCount } from '../../src/app/outstandingCount'
import type { PersistentActionsGateway } from '../../src/app/usePersistentActions'
import type { InboxAction, PlayInbox } from '../../src/features/hub/playInboxModel'
import type { PersistentPlayerAction } from '../../src/services/supabase/playerActions'

function action(overrides: Partial<InboxAction> = {}): InboxAction {
  return {
    key: 'k1', kind: 'match_predictor', competitionName: 'Premier League', seasonLabel: '2026/27',
    gameName: 'Match Predictor', title: 'Predict matchweek 4', locksAt: '2026-08-15T11:30:00Z',
    href: '/competitions/premier-league/2026-27/games/match-predictor', outstanding: true, ...overrides,
  }
}

function inbox(overrides: Partial<PlayInbox> = {}): PlayInbox {
  return { urgent: [], thisWeek: [], settled: [], unreadable: [], allClear: false, empty: false, ...overrides }
}

function persistent(overrides: Partial<PersistentPlayerAction> = {}): PersistentPlayerAction {
  return {
    actionKey: 'persist-1', actionType: 'matchweek_predictions_due', priority: 2,
    tournamentId: 'season-1', competitionId: null, deadlineAt: null, expiresAt: null,
    context: {}, seen: true, seenAt: '2026-08-18T12:01:00Z', dismissed: false,
    generatedAt: '2026-08-18T12:00:00Z', ...overrides,
  }
}

function open(
  state: PlayInbox | null,
  status: 'loading' | 'ready' = 'ready',
  persistentActions: readonly PersistentPlayerAction[] = [],
  persistentFailure = false,
) {
  const onClose = vi.fn()
  const markSeen = vi.fn(async () => undefined)
  const onDismiss = vi.fn(async () => undefined)
  const source: PersistentActionsGateway = {
    load: persistentFailure
      ? async () => { throw new Error('persistent feed unavailable') }
      : async () => ({
          unseen: persistentActions.filter((item) => !item.seen).length,
          actions: persistentActions,
        }),
    markSeen,
    dismiss: onDismiss,
  }
  render(
    <MemoryRouter>
      <ActionCentre
        open
        onClose={onClose}
        status={status}
        inbox={state}
        persistentSource={source}
      />
    </MemoryRouter>,
  )
  return { onClose, onDismiss, markSeen }
}

describe('outstandingCount', () => {
  it('counts what the player owes and nothing else', () => {
    expect(outstandingCount(inbox({
      urgent: [action({ key: 'a' })],
      thisWeek: [action({ key: 'b' }), action({ key: 'c' })],
      settled: [action({ key: 'd', outstanding: false })],
    }))).toBe(3)
  })

  it('never counts a settled action, so finishing one clears it', () => {
    expect(outstandingCount(inbox({ settled: [action({ key: 'd', outstanding: false })] }))).toBe(0)
  })

  it('claims nothing while the inbox is unknown', () => {
    expect(outstandingCount(null)).toBe(0)
  })
})

describe('the action centre panel', () => {
  it('groups what is due soon apart from the rest of the week', () => {
    open(inbox({
      urgent: [action({ key: 'a', title: 'Predict matchweek 4' })],
      thisWeek: [action({ key: 'b', title: 'Pick your club' })],
      settled: [action({ key: 'c', title: 'Matchweek 3 settled', outstanding: false })],
    }))
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

  it('keeps outstanding work distinct from persistent read state', async () => {
    open(inbox({ allClear: true }), 'ready', [persistent()])
    expect(screen.getByText(/up to date in every competition/)).toBeInTheDocument()
    expect(await screen.findByText('Predictions due')).toBeInTheDocument()
  })

  it('represents every current server action kind without inventing an invitation', async () => {
    open(inbox(), 'ready', [
      persistent({ actionKey: 'a', actionType: 'matchweek_predictions_due' }),
      persistent({ actionKey: 'b', actionType: 'lms_pick_due' }),
      persistent({ actionKey: 'c', actionType: 'cup_penalty_number_due' }),
      persistent({ actionKey: 'd', actionType: 'matchweek_settled' }),
      persistent({ actionKey: 'e', actionType: 'game_consequence' }),
    ])
    for (const title of ['Predictions due', 'Last Man Standing pick due', 'Cup penalty number due', 'Matchweek settled', 'Game update']) {
      expect(await screen.findByText(title)).toBeInTheDocument()
    }
    expect(screen.queryByText('League invitation')).toBeNull()
  })

  it('will render a league invitation only when the server actually supplies one', async () => {
    open(inbox(), 'ready', [persistent({ actionType: 'league_invitation' })])
    expect(await screen.findByText('League invitation')).toBeInTheDocument()
  })

  it('dismisses the exact server-issued action key', async () => {
    const { onDismiss } = open(inbox(), 'ready', [persistent({ actionKey: 'server-key' })])
    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }))
    expect(onDismiss).toHaveBeenCalledWith('server-key')
  })

  it('keeps the to-do list usable if persistent state cannot load', async () => {
    open(inbox({ urgent: [action({ title: 'Pick before lock' })] }), 'ready', [], true)
    expect(screen.getByText('Pick before lock')).toBeInTheDocument()
    expect(await screen.findByText(/saved updates could not be checked/i)).toBeInTheDocument()
  })

  it('is a dialog that Escape closes and that takes focus when it opens', () => {
    const { onClose } = open(inbox({ urgent: [action()] }))
    expect(screen.getByRole('dialog', { name: 'To do' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('reports that it is still checking rather than showing an empty list', () => {
    open(null, 'loading')
    expect(screen.getByText(/Checking your competitions/)).toBeInTheDocument()
    expect(screen.queryByText(/up to date/)).toBeNull()
  })

  it('renders nothing at all when closed', () => {
    const source: PersistentActionsGateway = {
      load: async () => ({ unseen: 0, actions: [] }),
      markSeen: async () => undefined,
      dismiss: async () => undefined,
    }
    render(
      <MemoryRouter>
        <ActionCentre open={false} onClose={() => {}} status="ready" inbox={inbox()} persistentSource={source} />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
