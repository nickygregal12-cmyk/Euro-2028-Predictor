import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { ActionCentre } from '../../src/app/ActionCentre'
import { outstandingCount } from '../../src/app/outstandingCount'
import type { InboxAction, PlayInbox } from '../../src/features/hub/playInboxModel'

/**
 * The action centre, and the one claim it must never make.
 *
 * THE COUNT IS OUTSTANDING, NOT UNREAD. `ui-finalisation.md` § 4A decided the
 * AppBar would carry no notification control, because a bell over an inbox with
 * no read state would either shout for ever or forget on a second device. That
 * reasoning stands and this control does not contradict it: "outstanding" is a
 * server-derived fact about what the player has not DONE, identical on every
 * device, and it clears when they act rather than when they glance.
 *
 * So these assertions pin the difference. Nothing here reads or writes
 * `localStorage`, there is no dismiss and no mark-as-seen, and a settled action
 * — one already done — never counts toward the badge. When contract 162 is
 * reachable from a browser, seen and dismissed state joins the panel and these
 * assertions gain siblings rather than being replaced.
 */

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

function open(state: PlayInbox | null, status: 'loading' | 'ready' = 'ready') {
  const onClose = vi.fn()
  render(
    <MemoryRouter>
      <ActionCentre open onClose={onClose} status={status} inbox={state} />
    </MemoryRouter>,
  )
  return onClose
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

  it('says nothing is outstanding without claiming anything was read', () => {
    open(inbox({ allClear: true }))

    expect(screen.getByText(/up to date in every competition/)).toBeInTheDocument()
    expect(screen.queryByText(/unread/i)).toBeNull()
    expect(screen.queryByText(/\bnew\b/i)).toBeNull()
  })

  it('offers no dismiss or mark-as-seen, because neither would survive a device change', () => {
    open(inbox({ urgent: [action()], thisWeek: [action({ key: 'b' })] }))

    expect(screen.queryByRole('button', { name: /dismiss/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /mark|seen|read/i })).toBeNull()
  })

  it('is a dialog that Escape closes and that takes focus when it opens', () => {
    const onClose = open(inbox({ urgent: [action()] }))

    const dialog = screen.getByRole('dialog', { name: 'To do' })
    expect(dialog).toBeInTheDocument()
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
    render(
      <MemoryRouter>
        <ActionCentre open={false} onClose={() => {}} status="ready" inbox={inbox()} />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
